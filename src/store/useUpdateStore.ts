import { create } from "zustand";
import { GitHubRelease } from "../types";

export interface UpdateState {
  availableReleases: GitHubRelease[];
  currentVersion: string;
  targetRelease: GitHubRelease | null;
  downloadProgress: number;
  updateStatus: "idle" | "checking" | "downloading" | "ready" | "error";
  errorMessage: string | null;
  fetchReleases: () => Promise<void>;
  setTargetRelease: (release: GitHubRelease | null) => Promise<void>;
  triggerUpdate: () => Promise<void>;
  cancelUpdate: () => Promise<void>;
  resetProgress: () => void;
  reconnectListeners: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => {
  let unsubscribeProgress: (() => void) | null = null;
  let unsubscribeError: (() => void) | null = null;
  let unsubscribeSuccess: (() => void) | null = null;
  let unsubscribeStatusReset: (() => void) | null = null;

  const cleanupListeners = () => {
    if (unsubscribeProgress) {
      unsubscribeProgress();
      unsubscribeProgress = null;
    }
    if (unsubscribeError) {
      unsubscribeError();
      unsubscribeError = null;
    }
    if (unsubscribeSuccess) {
      unsubscribeSuccess();
      unsubscribeSuccess = null;
    }
  };

  const reconnectListeners = () => {
    cleanupListeners();

    // Subscribe to progress
    unsubscribeProgress = window.clipAPI.onUpdateProgress((progress) => {
      set({ downloadProgress: progress, updateStatus: "downloading" });
    });

    // Subscribe to error
    unsubscribeError = window.clipAPI.onUpdateError((err) => {
      cleanupListeners();
      set({ updateStatus: "error", errorMessage: err });
    });

    // Subscribe to success
    unsubscribeSuccess = window.clipAPI.onUpdateSuccess(() => {
      cleanupListeners();
      set({ updateStatus: "ready", downloadProgress: 100 });
    });
  };

  // Always listen for status resets triggered by clear-cache
  if (typeof window !== "undefined" && window.clipAPI?.onUpdateStatusReset) {
    if (unsubscribeStatusReset) unsubscribeStatusReset();
    unsubscribeStatusReset = window.clipAPI.onUpdateStatusReset(() => {
      cleanupListeners();
      set({ updateStatus: "idle", downloadProgress: 0, targetRelease: null, errorMessage: null });
    });
  }

  return {
    availableReleases: [],
    currentVersion: "",
    targetRelease: null,
    downloadProgress: 0,
    updateStatus: "idle",
    errorMessage: null,
    reconnectListeners,

    fetchReleases: async () => {
      set({ updateStatus: "checking", errorMessage: null });
      try {
        const appInfo = await window.clipAPI.getAppInfo();
        const releases = await window.clipAPI.getReleases();
        
        // Filter out drafts
        const activeReleases = releases.filter((r: any) => !r.draft);

        // Get target release
        let targetRelease = activeReleases.length > 0 ? activeReleases[0] : null;
        let status: "idle" | "checking" | "downloading" | "ready" | "error" = "idle";
        let progress = 0;
        let errorMessage = null;

        // 1. Check if there is an active background download running in the main process
        let activeDownload = null;
        if (window.clipAPI?.getActiveDownloadStatus) {
          activeDownload = await window.clipAPI.getActiveDownloadStatus();
        }
        if (activeDownload && activeDownload.status !== "idle") {
          status = activeDownload.status;
          progress = activeDownload.progress;
          errorMessage = activeDownload.errorMessage;
          if (activeDownload.targetRelease) {
            targetRelease = activeDownload.targetRelease;
          }
          if (status === "downloading") {
            reconnectListeners();
          }
        } else if (targetRelease) {
          // 2. No active download in main process, verify if the file has already been fully downloaded to temp folder (persistence)
          let isDownloaded = false;
          if (window.clipAPI?.checkUpdateDownloaded) {
            isDownloaded = await window.clipAPI.checkUpdateDownloaded(targetRelease);
          }
          if (isDownloaded) {
            status = "ready";
            progress = 100;
          }
        }

        set({
          availableReleases: activeReleases,
          currentVersion: appInfo.version,
          targetRelease,
          updateStatus: status,
          downloadProgress: progress,
          errorMessage,
        });
      } catch (err: any) {
        console.error("[UpdateStore] Failed to fetch releases:", err);
        set({
          updateStatus: "error",
          errorMessage: err.message || "Failed to fetch releases from GitHub.",
        });
      }
    },

    setTargetRelease: async (release) => {
      if (!release) {
        set({ targetRelease: null, downloadProgress: 0, errorMessage: null, updateStatus: "idle" });
        return;
      }
      set({ targetRelease: release, downloadProgress: 0, errorMessage: null, updateStatus: "idle" });

      try {
        let isDownloaded = false;
        if (window.clipAPI?.checkUpdateDownloaded) {
          isDownloaded = await window.clipAPI.checkUpdateDownloaded(release);
        }
        if (isDownloaded) {
          set({ updateStatus: "ready", downloadProgress: 100 });
        }
      } catch (e) {
        console.error("[UpdateStore] checkUpdateDownloaded failed on target select:", e);
      }
    },

    triggerUpdate: async () => {
      const { targetRelease, updateStatus } = get();
      if (!targetRelease) {
        set({ updateStatus: "error", errorMessage: "No release selected for update." });
        return;
      }

      reconnectListeners();
      if (updateStatus !== "ready") {
        set({ updateStatus: "downloading", downloadProgress: 0, errorMessage: null });
      } else {
        set({ errorMessage: null });
      }

      try {
        await window.clipAPI.triggerUpdate(targetRelease);
      } catch (err: any) {
        cleanupListeners();
        set({
          updateStatus: "error",
          errorMessage: err.message || "An unexpected error occurred during update initialization.",
        });
      }
    },

    cancelUpdate: async () => {
      const { updateStatus } = get();
      if (updateStatus === "downloading") {
        try {
          if (window.clipAPI?.cancelUpdateDownload) {
            await window.clipAPI.cancelUpdateDownload();
          }
        } catch (err) {
          console.error("[UpdateStore] cancelUpdateDownload failed:", err);
        } finally {
          cleanupListeners();
          set({ updateStatus: "idle", downloadProgress: 0, errorMessage: null });
        }
      }
    },

    resetProgress: () => {
      cleanupListeners();
      set({ updateStatus: "idle", downloadProgress: 0, errorMessage: null });
    },
  };
});
