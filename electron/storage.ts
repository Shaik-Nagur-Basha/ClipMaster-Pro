import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { ClipboardItem, Tag, AppSettings } from '../src/types'

// ─── Path Resolution ───────────────────────────────────────────────────────
export function getDataDir(): string {
  const isDev = !app.isPackaged
  const isAllUsers = process.env.ALL_USERS === 'true'

  if (isDev) {
    return join(process.cwd(), 'data')
  }

  if (isAllUsers) {
    // Use windows-standard shared data directory for All Users install
    return join('C:\\ProgramData', app.getName(), 'data')
  }

  // Fallback to default Electron behavior (AppData/Roaming/{appName})
  // We keep our files in a subfolder 'data' within userData for cleanliness
  return join(app.getPath('userData'), 'data')
}

const getClipsPath    = () => join(getDataDir(), 'clipboard.json')
const getTagsPath     = () => join(getDataDir(), 'tags.json')
const getSettingsPath = () => join(getDataDir(), 'settings.json')

// ─── Defaults ──────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  mongoEnabled: false,
  mongoUri: null,
  atlasEnabled: false,
  atlasUri: null,
  maxEntries: 5000,
  pollingInterval: 600,
  viewMode: "list",
  displayMode: "preview",
  lastLocalSyncedAt: null,
  lastCloudSyncedAt: null,
  latestSyncedAt: null
}

const DEFAULT_TAGS: Tag[] = [
  { id: 'favorites', name: 'Favorites', color: '#22c55e' },
  { id: 'work',      name: 'Work',      color: '#6366f1' },
  { id: 'personal',  name: 'Personal',  color: '#f59e0b' }
]

// ─── Debounce ──────────────────────────────────────────────────────────────
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let t: NodeJS.Timeout
  return ((...a: unknown[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }) as T
}

// ─── Storage Manager ───────────────────────────────────────────────────────
class StorageManager {
  private clipsCache:    ClipboardItem[] = []
  private tagsCache:     Tag[]           = []
  private settingsCache: AppSettings     = { ...DEFAULT_SETTINGS }

  private debouncedFlush = debounce(this.flush.bind(this) as (...args: unknown[]) => void, 300)

  // ── Init ────────────────────────────────────────────────────────────────
  async init(): Promise<void> {
    const dir = getDataDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    this.ensureFile(getClipsPath(),    '[]')
    this.ensureFile(getTagsPath(),     JSON.stringify(DEFAULT_TAGS, null, 2))
    this.ensureFile(getSettingsPath(), JSON.stringify(DEFAULT_SETTINGS, null, 2))

    this.clipsCache    = this.readJSON<ClipboardItem[]>(getClipsPath(), [])
    this.tagsCache     = this.readJSON<Tag[]>(getTagsPath(), DEFAULT_TAGS)
    
    // Migration logic
    const raw = this.readJSON<any>(getSettingsPath(), {})
    const migratedSettings = { ...DEFAULT_SETTINGS, ...raw }
    
    // Migrate old field to both cloud tracking and latest pointer
    if (raw.lastSyncedAt && !raw.lastCloudSyncedAt) {
      migratedSettings.lastCloudSyncedAt = raw.lastSyncedAt
      migratedSettings.latestSyncedAt    = raw.lastSyncedAt
    }
    
    // Cleanup old internal flags if they exist
    delete (migratedSettings as any).lastSyncedAt
    delete (migratedSettings as any).firstLaunch

    this.settingsCache = migratedSettings as AppSettings
  }

  // ── Internal helpers ────────────────────────────────────────────────────
  private ensureFile(path: string, content: string): void {
    if (!existsSync(path)) writeFileSync(path, content, 'utf-8')
  }

  private readJSON<T>(path: string, fallback: T): T {
    try { return JSON.parse(readFileSync(path, 'utf-8')) as T }
    catch { return fallback }
  }

  private flush(): void {
    try {
      writeFileSync(getClipsPath(), JSON.stringify(this.clipsCache, null, 2), 'utf-8')
    } catch (e) {
      console.error('[Storage] Flush failed:', e)
    }
  }

  // ── CLIPS ───────────────────────────────────────────────────────────────

  /** Always reads from disk — never returns stale cache */
  readAll(): ClipboardItem[] {
    try {
      const fresh = JSON.parse(readFileSync(getClipsPath(), 'utf-8')) as ClipboardItem[]
      this.clipsCache = fresh   // keep cache in sync
      return fresh
    } catch {
      return this.clipsCache   // fallback to cache on read error
    }
  }

  /**
   * Add a new clipboard entry.
   * Always writes to JSON first (Layer 1 — source of truth).
   * Sets both timestamp and updatedAt for conflict resolution.
   */
  async addEntry(text: string): Promise<ClipboardItem | null> {
    const trimmed = text.trim()
    if (!trimmed) return null

    // Dedup: ignore if exact same text already exists (non-deleted)
    if (this.clipsCache.some(c => c.text === trimmed && !c.isDeleted)) return null

    // Enforce max entries: purge oldest non-favorite first
    const maxEntries = this.settingsCache.maxEntries ?? 5000
    const active = this.clipsCache.filter(c => !c.isDeleted)
    if (active.length >= maxEntries) {
      const oldest = active
        .filter(c => !c.isFavorite)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]
      if (oldest) await this.permanentDelete(oldest.id)
    }

    const now = new Date().toISOString()
    const item: ClipboardItem = {
      id:        uuidv4(),
      text:      trimmed,
      timestamp: now,
      updatedAt: now,          // ← required for conflict resolution
      tags:      [],
      isFavorite: false,
      isDeleted:  false,
      wordCount:  trimmed.split(/\s+/).filter(Boolean).length,
      charCount:  trimmed.length
    }

    this.clipsCache.unshift(item)
    this.flush()                // Layer 1 write (immediate for new entries)
    return item
  }

  async updateEntry(item: ClipboardItem): Promise<void> {
    const idx = this.clipsCache.findIndex(c => c.id === item.id)
    if (idx === -1) return
    this.clipsCache[idx] = {
      ...item,
      updatedAt: new Date().toISOString(),  // always bump updatedAt on write
      wordCount: item.text.split(/\s+/).filter(Boolean).length,
      charCount: item.text.length
    }
    this.debouncedFlush()
  }

  async softDelete(id: string): Promise<void> {
    const item = this.clipsCache.find(c => c.id === id)
    if (!item) return
    item.isDeleted  = true
    item.deletedAt  = new Date().toISOString()
    item.updatedAt  = item.deletedAt
    this.debouncedFlush()
  }

  async restoreEntry(id: string): Promise<void> {
    const item = this.clipsCache.find(c => c.id === id)
    if (!item) return
    item.isDeleted = false
    item.updatedAt = new Date().toISOString()
    delete item.deletedAt
    this.debouncedFlush()
  }

  async permanentDelete(id: string): Promise<void> {
    this.clipsCache = this.clipsCache.filter(c => c.id !== id)
    this.debouncedFlush()
  }

  /**
   * Merge-into-JSON — called by SyncManager after Atlas two-way sync.
   * Replaces in-memory cache AND flushes to disk immediately.
   */
  async mergeItems(merged: ClipboardItem[]): Promise<void> {
    this.clipsCache = merged
    // Force immediate write (not debounced) since this is a sync operation
    try {
      writeFileSync(getClipsPath(), JSON.stringify(this.clipsCache, null, 2), 'utf-8')
      console.log(`[Storage] Flushed ${merged.length} merged items to JSON`)
    } catch (e) {
      console.error('[Storage] Merge flush failed:', e)
    }
  }

  // ── TAGS ────────────────────────────────────────────────────────────────
  getTags(): Tag[] { return this.tagsCache }

  async saveTags(tags: unknown[]): Promise<void> {
    this.tagsCache = tags as Tag[]
    writeFileSync(getTagsPath(), JSON.stringify(tags, null, 2), 'utf-8')
  }

  // ── SETTINGS ────────────────────────────────────────────────────────────
  getSettings(): AppSettings { return this.settingsCache }

  async saveSettings(partial: Partial<AppSettings>): Promise<void> {
    // Never log Atlas URI
    const safe = { ...partial }
    if ('atlasUri' in safe) delete (safe as Record<string, unknown>)['atlasUri']
    // console.log('[Storage] Saving settings:', safe)

    this.settingsCache = { ...this.settingsCache, ...partial }
    writeFileSync(getSettingsPath(), JSON.stringify(this.settingsCache, null, 2), 'utf-8')
  }
}

export const storageManager = new StorageManager()
