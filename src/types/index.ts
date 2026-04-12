// ─── Core Types ───────────────────────────────────────────────────────────

export type ClipboardItem = {
  id: string
  text: string
  timestamp: string
  updatedAt: string          // ← used for conflict resolution (latest wins)
  tags: string[]
  isFavorite: boolean
  isDeleted: boolean
  deletedAt?: string
  wordCount?: number
  charCount?: number
}

export type Tag = {
  id: string
  name: string
  color: string
}

// ─── Sync-specific Types ──────────────────────────────────────────────────

export type SyncLayer = 'json' | 'local-mongo' | 'atlas'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncState {
  localMongo: SyncStatus
  atlas: SyncStatus
  lastSyncedAt: string | null
  pendingCount: number
}

export interface SyncQueueEntry {
  item: ClipboardItem
  operation: 'upsert' | 'soft-delete' | 'permanent-delete'
  enqueuedAt: string
  retries: number
}

// ─── UI State Types ───────────────────────────────────────────────────────

export type ViewMode = 'list' | 'grid' | 'compact'
export type DisplayMode = 'preview' | 'full'
export type SortMode = 'newest' | 'oldest' | 'longest' | 'shortest'
export type LengthFilter = 'all' | 'short' | 'medium' | 'long'
export type ActivePage = 'dashboard' | 'favorites' | 'recycle' | 'settings' | 'tags'

export interface FilterState {
  search: string
  tags: string[]
  isFavorite: boolean | null
  lengthFilter: LengthFilter
  dateFrom: string | null
  dateTo: string | null
  minWordCount: number | null
  maxWordCount: number | null
}

export interface AppSettings {
  autoLaunch: boolean
  mongoEnabled: boolean
  mongoUri: string           // local MongoDB URI
  atlasEnabled: boolean
  atlasUri: string           // Atlas (cloud) connection string — never logged
  maxEntries: number
  pollingInterval: number
  syncInterval: number       // background sync interval in seconds (default 30)
  viewMode: ViewMode
  displayMode: DisplayMode
}

// ─── Store State Types ────────────────────────────────────────────────────

export interface ClipStore {
  // Data
  clips: ClipboardItem[]
  tags: Tag[]
  settings: AppSettings

  // UI State
  viewMode: ViewMode
  displayMode: DisplayMode
  sortMode: SortMode
  filters: FilterState
  activePage: ActivePage
  selectedClipId: string | null
  editingClipId: string | null
  mongoConnected: boolean
  atlasConnected: boolean
  syncState: SyncState
  isLoading: boolean

  // Actions - Data
  loadClips: () => Promise<void>
  loadTags: () => Promise<void>
  loadSettings: () => Promise<void>
  addClipFromMain: (item: ClipboardItem) => void
  updateClip: (item: ClipboardItem) => Promise<void>
  deleteClip: (id: string) => Promise<void>
  permanentDelete: (id: string) => Promise<void>
  restoreClip: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<void>
  copyToClipboard: (text: string) => Promise<void>
  saveTags: (tags: Tag[]) => Promise<void>
  saveSettings: (s: Partial<AppSettings>) => Promise<void>
  toggleTagOnClip: (clipId: string, tagId: string) => Promise<void>

  // Actions - UI
  setViewMode: (mode: ViewMode) => void
  setDisplayMode: (mode: DisplayMode) => void
  setSortMode: (mode: SortMode) => void
  setFilters: (partial: Partial<FilterState>) => void
  resetFilters: () => void
  setActivePage: (page: ActivePage) => void
  setSelectedClip: (id: string | null) => void
  setEditingClip: (id: string | null) => void
  setMongoConnected: (v: boolean) => void
  setAtlasConnected: (v: boolean) => void
  setSyncState: (s: Partial<SyncState>) => void
}

// ─── Window bridge type ───────────────────────────────────────────────────

export interface ClipAPI {
  minimize: () => void
  maximize: () => void
  close: () => void

  // Clipboard CRUD
  getClips: () => Promise<ClipboardItem[]>
  addClip: (text: string) => Promise<ClipboardItem | null>
  updateClip: (item: ClipboardItem) => Promise<boolean>
  deleteClip: (id: string) => Promise<boolean>
  permanentDelete: (id: string) => Promise<boolean>
  restoreClip: (id: string) => Promise<boolean>
  copyToClipboard: (text: string) => Promise<boolean>

  // Tags & Settings
  getTags: () => Promise<Tag[]>
  saveTags: (tags: Tag[]) => Promise<boolean>
  getSettings: () => Promise<AppSettings>
  saveSettings: (s: Record<string, unknown>) => Promise<boolean>

  // Sync
  getSyncState: () => Promise<SyncState>
  triggerSync: () => Promise<SyncState>
  mongoConnect: (uri: string) => Promise<boolean>
  atlasConnect: (uri: string) => Promise<boolean>
  mongoStatus: () => Promise<boolean>
  atlasStatus: () => Promise<boolean>
  mongoSyncAll: () => Promise<boolean>

  openExternal: (url: string) => void
  onNewClip: (cb: (item: ClipboardItem) => void) => () => void
  onSyncUpdate: (cb: (state: SyncState) => void) => () => void
}

declare global {
  interface Window {
    clipAPI: ClipAPI
  }
}
