import { contextBridge, ipcRenderer } from "electron";
import type { ClipboardItem, Tag, AppSettings } from "../src/types";

// Registry to ensure at most one active listener exists on ipcRenderer per channel
const activeListeners = new Map<string, (...args: any[]) => void>();

function registerSingleListener(channel: string, listener: (...args: any[]) => void) {
  const existing = activeListeners.get(channel);
  if (existing) {
    ipcRenderer.removeListener(channel, existing);
  }
  ipcRenderer.on(channel, listener);
  activeListeners.set(channel, listener);

  return () => {
    const current = activeListeners.get(channel);
    if (current === listener) {
      ipcRenderer.removeListener(channel, listener);
      activeListeners.delete(channel);
    }
  };
}

const clipAPI = {
  // ── Window controls ────────────────────────────────────────────────────
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),

  // ── Clipboard CRUD ─────────────────────────────────────────────────────
  getClips: (options?: number | any): Promise<any> => ipcRenderer.invoke("get-clips", options),
  getCounts: (): Promise<{ active: number; favorites: number; deleted: number }> => ipcRenderer.invoke("get-counts"),
  getFilterStats: (options: any): Promise<any> => ipcRenderer.invoke("get-filter-stats", options),
  addClip: (text: string) => ipcRenderer.invoke("add-clip", text),
  updateClip: (item: ClipboardItem) => ipcRenderer.invoke("update-clip", item),
  deleteClip: (id: string) => ipcRenderer.invoke("delete-clip", id),
  permanentDelete: (id: string) => ipcRenderer.invoke("permanent-delete", id),
  permanentDeleteBulk: (ids: string[]) =>
    ipcRenderer.invoke("permanent-delete-bulk", ids),
  restoreClip: (id: string) => ipcRenderer.invoke("restore-clip", id),
  copyToClipboard: (text: string) =>
    ipcRenderer.invoke("copy-to-clipboard", text),
  pasteClip: (): Promise<void> => ipcRenderer.invoke("paste-clip"),
  closePopup: () => ipcRenderer.send("close-popup"),
  openSettingsWindow: () => ipcRenderer.send("open-settings-window"),
  updateTargetHwnd: () => ipcRenderer.send("update-target-hwnd"),
  setSearchFocusable: (focusable: boolean) =>
    ipcRenderer.send("set-search-focusable", focusable),
  resizePopup: (width: number, height: number) =>
    ipcRenderer.send("resize-popup", width, height),

  // ── Tags & Settings ────────────────────────────────────────────────────
  getTags: (): Promise<Tag[]> => ipcRenderer.invoke("get-tags"),
  saveTags: (tags: Tag[]) => ipcRenderer.invoke("save-tags", tags),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("get-settings"),
  saveSettings: (s: Record<string, unknown>) =>
    ipcRenderer.invoke("save-settings", s),

  // ── UI State Cache ────────────────────────────────────────────────────
  updateUIState: (state: any) => ipcRenderer.send("update-ui-state", state),
  getUIState: () => ipcRenderer.invoke("get-ui-state"),

  // ── External ──────────────────────────────────────────────────────────
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  resetAll: (): Promise<boolean> => ipcRenderer.invoke("reset-all"),
  clearCache: (): Promise<boolean> => ipcRenderer.invoke("clear-cache"),
  advancedClearCache: (): Promise<boolean> => ipcRenderer.invoke("advanced-clear-cache"),

  // ── Push events from main ──────────────────────────────────────────────
  onNewClip: (cb: (item: ClipboardItem) => void) => {
    const h = (_: Electron.IpcRendererEvent, item: ClipboardItem) => cb(item);
    return registerSingleListener("new-clip", h);
  },

  onRefreshClips: (cb: () => void) => {
    const h = () => cb();
    return registerSingleListener("refresh-clips", h);
  },

  onSettingsUpdated: (cb: (settings: AppSettings) => void) => {
    const h = (_: Electron.IpcRendererEvent, settings: AppSettings) => cb(settings);
    return registerSingleListener("settings-updated", h);
  },

  onCleanMemory: (cb: () => void) => {
    const h = () => cb();
    return registerSingleListener("clean-memory", h);
  },

  onHookedKey: (cb: (data: { type: "char" | "key"; value: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, data: { type: "char" | "key"; value: string }) => cb(data);
    return registerSingleListener("hooked-key", h);
  },

  onClickOutside: (cb: () => void) => {
    const h = () => cb();
    return registerSingleListener("click-outside", h);
  },
  onNavigateToPage: (cb: (page: string) => void) => {
    const h = (_: Electron.IpcRendererEvent, page: string) => cb(page);
    return registerSingleListener("navigate-to-page", h);
  },

  // ── Application Updates ────────────────────────────────────────────────
  getReleases: () => ipcRenderer.invoke("get-releases"),
  triggerUpdate: (release: any) => ipcRenderer.invoke("trigger-update", release),
  cancelUpdateDownload: () => ipcRenderer.invoke("cancel-update-download"),
  checkUpdateDownloaded: (release: any) => ipcRenderer.invoke("check-update-downloaded", release),
  getActiveDownloadStatus: () => ipcRenderer.invoke("get-active-download-status"),
  onUpdateProgress: (cb: (progress: number) => void) => {
    const h = (_: Electron.IpcRendererEvent, p: number) => cb(p);
    return registerSingleListener("update-progress", h);
  },
  onUpdateError: (cb: (err: string) => void) => {
    const h = (_: Electron.IpcRendererEvent, err: string) => cb(err);
    return registerSingleListener("update-error", h);
  },
  onUpdateSuccess: (cb: () => void) => {
    const h = () => cb();
    return registerSingleListener("update-success", h);
  },
  onUpdateStatusReset: (cb: () => void) => {
    const h = () => cb();
    return registerSingleListener("update-status-reset", h);
  },

  // ── Export System ──────────────────────────────────────────────────────
  startExport: (options: any): Promise<any> => ipcRenderer.invoke("start-export", options),
  cancelExport: () => ipcRenderer.invoke("cancel-export"),
  saveExportFile: (tempFilePath: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke("save-export-file", tempFilePath, defaultName),
  cleanupExport: () => ipcRenderer.invoke("cleanup-export"),
  onExportProgress: (cb: (progress: { step: string; percent: number }) => void) => {
    const h = (_e: any, p: { step: string; percent: number }) => cb(p);
    return registerSingleListener("export-progress", h);
  },

  // ── Import System ──────────────────────────────────────────────────────
  selectAndImportFile: (): Promise<any> => ipcRenderer.invoke("select-and-import-file"),
  selectAndParseImportFile: (): Promise<any> => ipcRenderer.invoke("select-and-parse-import-file"),
  executeCustomImport: (options: any): Promise<any> => ipcRenderer.invoke("execute-custom-import", options),
  onImportProgress: (cb: (progress: { step: string; percent: number }) => void) => {
    const h = (_e: any, p: { step: string; percent: number }) => cb(p);
    return registerSingleListener("import-progress", h);
  },
};

contextBridge.exposeInMainWorld("clipAPI", clipAPI);

export type ClipAPI = typeof clipAPI;
