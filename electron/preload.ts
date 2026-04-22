import { contextBridge, ipcRenderer } from "electron";
import type { ClipboardItem, Tag, AppSettings, SyncState } from "../src/types";

const clipAPI = {
  // ── Window controls ────────────────────────────────────────────────────
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),

  // ── Clipboard CRUD ─────────────────────────────────────────────────────
  getClips: (): Promise<ClipboardItem[]> => ipcRenderer.invoke("get-clips"),
  addClip: (text: string) => ipcRenderer.invoke("add-clip", text),
  updateClip: (item: ClipboardItem) => ipcRenderer.invoke("update-clip", item),
  deleteClip: (id: string) => ipcRenderer.invoke("delete-clip", id),
  permanentDelete: (id: string) => ipcRenderer.invoke("permanent-delete", id),
  permanentDeleteBulk: (ids: string[]) =>
    ipcRenderer.invoke("permanent-delete-bulk", ids),
  restoreClip: (id: string) => ipcRenderer.invoke("restore-clip", id),
  copyToClipboard: (text: string) =>
    ipcRenderer.invoke("copy-to-clipboard", text),

  // ── Tags & Settings ────────────────────────────────────────────────────
  getTags: (): Promise<Tag[]> => ipcRenderer.invoke("get-tags"),
  saveTags: (tags: Tag[]) => ipcRenderer.invoke("save-tags", tags),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("get-settings"),
  saveSettings: (s: Record<string, unknown>) =>
    ipcRenderer.invoke("save-settings", s),

  // ── Sync ──────────────────────────────────────────────────────────────
  getSyncState: (): Promise<SyncState> => ipcRenderer.invoke("get-sync-state"),
  triggerSync: (target?: "local" | "atlas" | "all"): Promise<SyncState> =>
    ipcRenderer.invoke("trigger-sync", target),
  mongoConnect: (uri: string): Promise<boolean> =>
    ipcRenderer.invoke("mongo-connect", uri),
  atlasConnect: (uri: string): Promise<boolean> =>
    ipcRenderer.invoke("atlas-connect", uri),
  mongoStatus: (): Promise<boolean> => ipcRenderer.invoke("mongo-status"),
  atlasStatus: (): Promise<boolean> => ipcRenderer.invoke("atlas-status"),
  mongoSyncAll: (): Promise<boolean> => ipcRenderer.invoke("mongo-sync-all"),
  mongoDisconnect: (): Promise<boolean> =>
    ipcRenderer.invoke("mongo-disconnect"),
  atlasDisconnect: (): Promise<boolean> =>
    ipcRenderer.invoke("atlas-disconnect"),

  // ── External ──────────────────────────────────────────────────────────
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  resetAll: (): Promise<boolean> => ipcRenderer.invoke("reset-all"),

  // ── Push events from main ──────────────────────────────────────────────
  onNewClip: (cb: (item: ClipboardItem) => void) => {
    const h = (_: Electron.IpcRendererEvent, item: ClipboardItem) => cb(item);
    ipcRenderer.on("new-clip", h);
    return () => ipcRenderer.removeListener("new-clip", h);
  },
  onSyncUpdate: (cb: (state: SyncState) => void) => {
    const h = (_: Electron.IpcRendererEvent, state: SyncState) => cb(state);
    ipcRenderer.on("sync-update", h);
    return () => ipcRenderer.removeListener("sync-update", h);
  },
};

contextBridge.exposeInMainWorld("clipAPI", clipAPI);

export type ClipAPI = typeof clipAPI;
