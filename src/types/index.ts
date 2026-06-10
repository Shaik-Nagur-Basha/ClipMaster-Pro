// ─── Core Types ───────────────────────────────────────────────────────────

export type ClipboardItem = {
  id: string;
  text: string;
  timestamp: string;
  updatedAt: string; // ← used for conflict resolution (latest wins)
  tags: string[];
  isFavorite: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  wordCount?: number;
  charCount?: number;
  version?: number;
  localMongoVersion?: number;
  atlasVersion?: number;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  updatedAt?: string;
};

// ─── Sync-specific Types ──────────────────────────────────────────────────

export type SyncLayer = "json" | "local-mongo" | "atlas";

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

export interface SyncState {
  localMongo: SyncStatus;
  atlas: SyncStatus;
  lastLocalSyncedAt: string | null;
  lastCloudSyncedAt: string | null;
  latestSyncedAt: string | null;
}

export interface SyncQueueEntry {
  item: ClipboardItem;
  operation: "upsert" | "soft-delete" | "permanent-delete";
  enqueuedAt: string;
  retries: number;
}

// ─── UI State Types ───────────────────────────────────────────────────────

export type ViewMode = "list" | "grid" | "compact";
export type DisplayMode = "preview" | "full";
export type SortMode = "newest" | "oldest" | "longest" | "shortest";
export type LengthFilter = "all" | "short" | "medium" | "long";
export type ActivePage =
  | "dashboard"
  | "favorites"
  | "recycle"
  | "settings"
  | "tags";

export interface FilterState {
  search: string;
  tags: string[];
  isFavorite: boolean | null;
  lengthFilter: LengthFilter;
  dateFrom: string | null;
  dateTo: string | null;
  minWordCount: number | null;
  maxWordCount: number | null;
}

export interface AppSettings {
  autoLaunch: boolean;
  mongoEnabled: boolean;
  mongoUri: string | null;
  atlasEnabled: boolean;
  atlasUri: string | null;
  maxEntries: number;
  pollingInterval: number;
  paginationEnabled: boolean;
  pageSize?: number;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  lastLocalSyncedAt: string | null;
  lastCloudSyncedAt: string | null;
  latestSyncedAt: string | null;
  pauseCaptureOption?: "never" | "15mins" | "30mins" | "1hour" | "restart";
  pauseUntil?: number | null;
}

// ─── Store State Types ────────────────────────────────────────────────────

export interface ClipStore {
  // Data
  clips: ClipboardItem[];
  tags: Tag[];
  settings: AppSettings;
  searchInputRef: React.RefObject<HTMLInputElement> | null;

  // UI State
  viewMode: ViewMode;
  displayMode: DisplayMode;
  sortMode: SortMode;
  filters: FilterState;
  activePage: ActivePage;
  selectedClipId: string | null;
  editingClipId: string | null;
  mongoConnected: boolean;
  atlasConnected: boolean;
  syncState: SyncState;
  isLoading: boolean;

  // Actions - Data
  loadClips: (limit?: number) => Promise<void>;
  loadTags: () => Promise<void>;
  loadSettings: () => Promise<void>;
  loadUIState: () => Promise<void>;
  addClipFromMain: (item: ClipboardItem) => void;
  updateClip: (item: ClipboardItem) => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  permanentDeleteBulk: (ids: string[]) => Promise<void>;
  restoreClip: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  saveTags: (tags: Tag[]) => Promise<void>;
  saveSettings: (s: Partial<AppSettings>) => Promise<void>;
  toggleTagOnClip: (clipId: string, tagId: string) => Promise<void>;

  // Actions - UI
  setViewMode: (mode: ViewMode) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setSortMode: (mode: SortMode) => void;
  setFilters: (partial: Partial<FilterState>) => void;
  resetFilters: () => void;
  setActivePage: (page: ActivePage) => void;
  setSelectedClip: (id: string | null) => void;
  setEditingClip: (id: string | null) => void;
  setSearchInputRef: (ref: React.RefObject<HTMLInputElement> | null) => void;
  setMongoConnected: (v: boolean) => void;
  setAtlasConnected: (v: boolean) => void;
  setSyncState: (s: Partial<SyncState>) => void;
}

// ─── Window bridge type ───────────────────────────────────────────────────

export interface ClipAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;

  // Clipboard CRUD
  getClips: (limit?: number) => Promise<ClipboardItem[]>;
  addClip: (text: string) => Promise<ClipboardItem | null>;
  updateClip: (item: ClipboardItem) => Promise<boolean>;
  deleteClip: (id: string) => Promise<boolean>;
  permanentDelete: (id: string) => Promise<boolean>;
  permanentDeleteBulk: (ids: string[]) => Promise<boolean>;
  restoreClip: (id: string) => Promise<boolean>;
  copyToClipboard: (text: string) => Promise<boolean>;

  // Tags & Settings
  getTags: () => Promise<Tag[]>;
  saveTags: (tags: Tag[]) => Promise<boolean>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (s: Record<string, unknown>) => Promise<any>;

  // Sync
  getSyncState: () => Promise<SyncState>;
  triggerSync: (target?: "local" | "atlas" | "all") => Promise<SyncState>;
  getSyncLogs: (limit?: number) => Promise<any[]>;
  updateUIState: (state: any) => void;
  getUIState: () => Promise<any>;
  mongoConnect: (uri: string) => Promise<boolean>;
  atlasConnect: (uri: string) => Promise<boolean>;
  mongoStatus: () => Promise<boolean>;
  atlasStatus: () => Promise<boolean>;
  mongoSyncAll: () => Promise<boolean>;
  atlasDisconnect: () => Promise<boolean>;
  mongoDisconnect: () => Promise<boolean>;

  // Data Management
  resetAll: () => Promise<boolean>;
  clearCache: () => Promise<boolean>;

  openExternal: (url: string) => void;
  onNewClip: (cb: (item: ClipboardItem) => void) => () => void;
  onSyncUpdate: (cb: (state: SyncState) => void) => () => void;
  onSettingsUpdated: (cb: (settings: AppSettings) => void) => () => void;

  // Application Updates
  getAppInfo: () => Promise<{
    name: string;
    version: string;
    electron: string;
    chrome: string;
    node: string;
    platform: string;
    isPackaged: boolean;
  }>;
  getReleases: () => Promise<GitHubRelease[]>;
  triggerUpdate: (release: GitHubRelease) => Promise<void>;
  cancelUpdateDownload: () => Promise<boolean>;
  checkUpdateDownloaded: (release: GitHubRelease) => Promise<boolean>;
  getActiveDownloadStatus: () => Promise<{
    status: "idle" | "checking" | "downloading" | "ready" | "error";
    progress: number;
    targetRelease: GitHubRelease | null;
    errorMessage: string | null;
  }>;
  onUpdateProgress: (cb: (progress: number) => void) => () => void;
  onUpdateError: (cb: (error: string) => void) => () => void;
  onUpdateSuccess: (cb: () => void) => () => void;
  onUpdateStatusReset: (cb: () => void) => () => void;
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  prerelease: boolean;
  published_at: string;
  assets: GitHubReleaseAsset[];
}

declare global {
  interface Window {
    clipAPI: ClipAPI;
  }
}
