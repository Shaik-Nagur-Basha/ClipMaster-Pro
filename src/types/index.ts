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
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  updatedAt?: string;
};


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
  tagMatchingMode?: "and" | "or";
  sortTagsByUsage?: boolean;
}

export interface AppSettings {
  autoLaunch: boolean;
  maxEntries: number;
  pollingInterval: number;
  paginationEnabled: boolean;
  pageSize?: number;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  pauseCaptureOption?: "never" | "15mins" | "30mins" | "1hour" | "restart";
  pauseUntil?: number | null;
  globalShortcutEnabled?: boolean;
  globalShortcutKey?: string;
  popupPinned?: boolean;
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
  isLoading: boolean;
  totalCount: number;
  currentPage: number;
  sidebarCounts: { active: number; favorites: number; deleted: number };
  popupSearchVisible: boolean;
  popupTagsMenuVisible: boolean;
  popupSearchValue: string;
  isSearchFocused: boolean;
  isTagSearchFocused: boolean;

  // Actions - Data
  loadClips: (forceLimit?: number) => Promise<void>;
  loadTags: () => Promise<void>;
  loadSettings: () => Promise<void>;
  loadUIState: () => Promise<void>;
  loadSidebarCounts: () => Promise<void>;
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
  setCurrentPage: (page: number) => void;
  setPopupSearchVisible: (visible: boolean) => void;
  setPopupTagsMenuVisible: (visible: boolean) => void;
  setPopupSearchValue: (value: string) => void;
  setIsSearchFocused: (focused: boolean) => void;
  setIsTagSearchFocused: (focused: boolean) => void;
}

// ─── Window bridge type ───────────────────────────────────────────────────

export interface ClipAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;

  // Clipboard CRUD
  getClips: (options?: number | any) => Promise<any>;
  getCounts: () => Promise<{ active: number; favorites: number; deleted: number }>;
  addClip: (text: string) => Promise<ClipboardItem | null>;
  updateClip: (item: ClipboardItem) => Promise<boolean>;
  deleteClip: (id: string) => Promise<boolean>;
  permanentDelete: (id: string) => Promise<boolean>;
  permanentDeleteBulk: (ids: string[]) => Promise<boolean>;
  restoreClip: (id: string) => Promise<boolean>;
  copyToClipboard: (text: string) => Promise<boolean>;
  pasteClip: () => Promise<void>;
  closePopup: () => void;
  setSearchFocusable: (focusable: boolean) => void;

  // Tags & Settings
  getTags: () => Promise<Tag[]>;
  saveTags: (tags: Tag[]) => Promise<boolean>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (s: Record<string, unknown>) => Promise<any>;

  updateUIState: (state: any) => void;
  getUIState: () => Promise<any>;

  // Data Management
  resetAll: () => Promise<boolean>;
  clearCache: () => Promise<boolean>;

  openExternal: (url: string) => void;
  onNewClip: (cb: (item: ClipboardItem) => void) => () => void;
  onRefreshClips: (cb: () => void) => () => void;
  onSettingsUpdated: (cb: (settings: AppSettings) => void) => () => void;
  onCleanMemory: (cb: () => void) => () => void;
  onHookedKey: (cb: (data: { type: "char" | "key"; value: string }) => void) => () => void;
  onClickOutside: (cb: () => void) => () => void;

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

  // Export System
  startExport: (options: ExportOptions) => Promise<ExportSummary>;
  cancelExport: () => Promise<void>;
  saveExportFile: (tempFilePath: string, defaultName: string) => Promise<boolean>;
  cleanupExport: () => Promise<void>;
  onExportProgress: (cb: (progress: { step: string; percent: number }) => void) => () => void;

  // Import System
  selectAndImportFile: () => Promise<any>;
  onImportProgress: (cb: (progress: { step: string; percent: number }) => void) => () => void;
}

export interface ExportOptions {
  source: "all" | "clips" | "tags" | "settings";
  scope: "all" | "clips" | "favorites" | "recycle" | "tagged";
  format: "raw" | "json" | "excel" | "pdf";
}

export interface ExportProgress {
  step: "preparing" | "processing" | "generating" | "compressing" | "complete";
  percent: number;
}

export interface ExportSummary {
  totalRecords: number;
  exportType: string;
  format: string;
  fileCount: number;
  finalFileSize: number;
  tempFilePath: string;
  defaultFileName: string;
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
