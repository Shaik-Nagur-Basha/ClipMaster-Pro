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
  setTargetRelease: (release: GitHubRelease | null) => void;
  triggerUpdate: () => Promise<void>;
  resetProgress: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => {
  let unsubscribeProgress: (() => void) | null = null;
  let unsubscribeError: (() => void) | null = null;
  let unsubscribeSuccess: (() => void) | null = null;

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

  return {
    availableReleases: [],
    currentVersion: "",
    targetRelease: null,
    downloadProgress: 0,
    updateStatus: "idle",
    errorMessage: null,

    fetchReleases: async () => {
      set({ updateStatus: "checking", errorMessage: null });
      try {
        const appInfo = await window.clipAPI.getAppInfo();
        const releases = await window.clipAPI.getReleases();
        
        // Filter out drafts
        const activeReleases = releases.filter((r: any) => !r.draft);

        set({
          availableReleases: activeReleases,
          currentVersion: appInfo.version,
          // Select latest release by default
          targetRelease: activeReleases.length > 0 ? activeReleases[0] : null,
          updateStatus: "idle",
        });
      } catch (err: any) {
        console.error("[UpdateStore] Failed to fetch releases:", err);
        set({
          updateStatus: "error",
          errorMessage: err.message || "Failed to fetch releases from GitHub.",
        });
      }
    },

    setTargetRelease: (release) => {
      set({ targetRelease: release, downloadProgress: 0, errorMessage: null });
    },

    triggerUpdate: async () => {
      const { targetRelease } = get();
      if (!targetRelease) {
        set({ updateStatus: "error", errorMessage: "No release selected for update." });
        return;
      }

      cleanupListeners();
      set({ updateStatus: "downloading", downloadProgress: 0, errorMessage: null });

      // Subscribe to progress
      unsubscribeProgress = window.clipAPI.onUpdateProgress((progress) => {
        set({ downloadProgress: progress });
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

    resetProgress: () => {
      cleanupListeners();
      set({ updateStatus: "idle", downloadProgress: 0, errorMessage: null });
    },
  };
});
