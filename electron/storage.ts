import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import type { ClipboardItem, Tag, AppSettings } from "../src/types";

// ─── Path Resolution ───────────────────────────────────────────────────────
export function getDataDir(): string {
  const isDev = !app.isPackaged;
  const isAllUsers = process.env.ALL_USERS === "true";

  if (isDev) {
    return join(process.cwd(), "data");
  }

  if (isAllUsers) {
    // Use windows-standard shared data directory for All Users install
    return join("C:\\ProgramData", app.getName(), "data");
  }

  // Fallback to default Electron behavior (AppData/Roaming/{appName})
  // We keep our files in a subfolder 'data' within userData for cleanliness
  return join(app.getPath("userData"), "data");
}

const getClipsPath = () => join(getDataDir(), "clipboard.json");
const getTagsPath = () => join(getDataDir(), "tags.json");
const getSettingsPath = () => join(getDataDir(), "settings.json");

// ─── Defaults ──────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  mongoEnabled: false,
  mongoUri: null,
  atlasEnabled: false,
  atlasUri: null,
  maxEntries: 5000,
  pollingInterval: 600,
  paginationEnabled: false,
  viewMode: "list",
  displayMode: "preview",
  lastLocalSyncedAt: null,
  lastCloudSyncedAt: null,
  latestSyncedAt: null,
  pauseCaptureOption: "never",
  pauseUntil: null,
};

const DEFAULT_TAGS: Tag[] = [
  { id: "favorites", name: "Favorites", color: "#22c55e" },
  { id: "work", name: "Work", color: "#6366f1" },
  { id: "personal", name: "Personal", color: "#f59e0b" },
];

// ─── Debounce ──────────────────────────────────────────────────────────────
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T {
  let t: NodeJS.Timeout;
  return ((...a: unknown[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  }) as T;
}

// ─── Storage Manager ───────────────────────────────────────────────────────
class StorageManager {
  private clipsCache: ClipboardItem[] = [];
  private tagsCache: Tag[] = [];
  private settingsCache: AppSettings = { ...DEFAULT_SETTINGS };
  private needsFlush = false;

  private debouncedFlush = debounce(
    this.flush.bind(this) as (...args: unknown[]) => void,
    300,
  );

  // ── Init ────────────────────────────────────────────────────────────────
  async init(): Promise<void> {
    const dir = getDataDir();
    console.log("[Storage] Data directory:", dir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.clipsCache = this.loadFileWithBackup<ClipboardItem[]>(getClipsPath(), []);
    console.log("[Storage] Loaded", this.clipsCache.length, "clips from", getClipsPath());
    this.tagsCache = this.loadFileWithBackup<Tag[]>(getTagsPath(), DEFAULT_TAGS);

    // Migration logic
    const raw = this.loadFileWithBackup<any>(getSettingsPath(), DEFAULT_SETTINGS);
    const migratedSettings = { ...DEFAULT_SETTINGS, ...raw };

    // Migrate old field to both cloud tracking and latest pointer
    if (raw.lastSyncedAt && !raw.lastCloudSyncedAt) {
      migratedSettings.lastCloudSyncedAt = raw.lastSyncedAt;
      migratedSettings.latestSyncedAt = raw.lastSyncedAt;
    }

    // Cleanup old internal flags if they exist
    delete (migratedSettings as any).lastSyncedAt;
    delete (migratedSettings as any).firstLaunch;

    this.settingsCache = migratedSettings as AppSettings;

    // Save migrated settings back atomically
    this.writeAtomic(getSettingsPath(), JSON.stringify(this.settingsCache, null, 2));
  }

  // ── Internal helpers ────────────────────────────────────────────────────
  private writeAtomic(path: string, content: string): void {
    const tmpPath = path + ".tmp";
    const bakPath = path + ".bak";
    try {
      // 1. Write to temporary file
      writeFileSync(tmpPath, content, "utf-8");
      // 2. Rename temporary file to target file (atomic replace)
      renameSync(tmpPath, path);
      // 3. Make a backup copy after a successful write
      try {
        writeFileSync(bakPath, content, "utf-8");
      } catch (bakErr) {
        console.error(`[Storage] Failed to write backup for ${path}:`, bakErr);
      }
    } catch (e) {
      console.error(`[Storage] Atomic write failed for ${path}, falling back to direct write:`, e);
      // Fallback: write directly to the target path if rename fails
      try {
        writeFileSync(path, content, "utf-8");
        writeFileSync(bakPath, content, "utf-8");
      } catch (fallbackError) {
        console.error(`[Storage] Direct fallback write failed for ${path}:`, fallbackError);
      }
      // Clean up tmp file if it still exists
      try {
        if (existsSync(tmpPath)) {
          unlinkSync(tmpPath);
        }
      } catch {}
    }
  }

  private loadFileWithBackup<T>(path: string, fallback: T): T {
    const bakPath = path + ".bak";

    // Helper to check if file exists and is valid JSON
    const tryParse = (filePath: string): T | null => {
      if (!existsSync(filePath)) return null;
      try {
        const data = readFileSync(filePath, "utf-8").trim();
        if (!data) return null; // empty file
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    };

    // 1. Try main file
    const mainData = tryParse(path);
    if (mainData !== null) {
      return mainData;
    }

    // 2. Try backup file
    console.warn(`[Storage] Main file ${path} is missing or corrupted. Trying backup...`);
    const bakData = tryParse(bakPath);
    if (bakData !== null) {
      console.log(`[Storage] Successfully restored ${path} from backup.`);
      // Restore main file from backup
      this.writeAtomic(path, JSON.stringify(bakData, null, 2));
      return bakData;
    }

    // 3. Both failed, write fallback/defaults to both
    console.warn(`[Storage] Both main and backup files for ${path} failed. Writing defaults.`);
    this.writeAtomic(path, JSON.stringify(fallback, null, 2));
    return fallback;
  }

  private flush(): void {
    try {
      this.writeAtomic(
        getClipsPath(),
        JSON.stringify(this.clipsCache, null, 2),
      );
      this.needsFlush = false;
    } catch (e) {
      console.error("[Storage] Flush failed:", e);
      this.needsFlush = true;
    }
  }

  private scheduleFlush(): void {
    this.needsFlush = true;
    this.debouncedFlush();
  }

  // ── CLIPS ───────────────────────────────────────────────────────────────

  /**
   * Return current clipboard cache and flush any pending disk writes.
   * Avoids reloading the full JSON file on every read.
   */
  readAll(): ClipboardItem[] {
    if (this.needsFlush) {
      this.flush();
    }
    return this.clipsCache;
  }

  /**
   * Add a new clipboard entry.
   * Always writes to JSON first (Layer 1 — source of truth).
   * Sets both timestamp and updatedAt for conflict resolution.
   */
  async addEntry(text: string): Promise<ClipboardItem | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    console.log("[Storage] addEntry called, trimmed length:", trimmed.length, "cache size:", this.clipsCache.length);

    const now = new Date().toISOString();

    // Dedup: if exact same text exists (non-deleted), re-surface it to the top
    const existingIdx = this.clipsCache.findIndex(
      (c) => c.text === trimmed && !c.isDeleted,
    );
    if (existingIdx !== -1) {
      const [existing] = this.clipsCache.splice(existingIdx, 1);
      existing.timestamp = now;
      existing.updatedAt = now;
      this.clipsCache.unshift(existing);
      this.flush();
      console.log("[Storage] Re-surfaced existing clip:", existing.id);
      return existing;
    }

    // Enforce max entries: purge oldest non-favorite first
    const maxEntries = this.settingsCache.maxEntries ?? 5000;
    const active = this.clipsCache.filter((c) => !c.isDeleted);
    if (active.length >= maxEntries) {
      const oldest = active
        .filter((c) => !c.isFavorite)
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        )[0];
      if (oldest) await this.permanentDelete(oldest.id);
    }

    const item: ClipboardItem = {
      id: uuidv4(),
      text: trimmed,
      timestamp: now,
      updatedAt: now,
      tags: [],
      isFavorite: false,
      isDeleted: false,
      wordCount: trimmed.split(/\s+/).filter(Boolean).length,
      charCount: trimmed.length,
    };

    this.clipsCache.unshift(item);
    this.flush(); // Layer 1 write (immediate for new entries)
    console.log("[Storage] New clip saved:", item.id, "→", getClipsPath());
    return item;
  }

  async updateEntry(item: ClipboardItem): Promise<void> {
    const idx = this.clipsCache.findIndex((c) => c.id === item.id);
    if (idx === -1) return;
    this.clipsCache[idx] = {
      ...item,
      updatedAt: new Date().toISOString(), // always bump updatedAt on write
      wordCount: item.text.split(/\s+/).filter(Boolean).length,
      charCount: item.text.length,
    };
    this.scheduleFlush();
  }

  async softDelete(id: string): Promise<void> {
    const item = this.clipsCache.find((c) => c.id === id);
    if (!item) return;
    item.isDeleted = true;
    item.deletedAt = new Date().toISOString();
    item.updatedAt = item.deletedAt;
    this.scheduleFlush();
  }

  async restoreEntry(id: string): Promise<void> {
    const item = this.clipsCache.find((c) => c.id === id);
    if (!item) return;
    item.isDeleted = false;
    item.updatedAt = new Date().toISOString();
    delete item.deletedAt;
    this.scheduleFlush();
  }

  async permanentDelete(id: string): Promise<void> {
    this.clipsCache = this.clipsCache.filter((c) => c.id !== id);
    this.scheduleFlush();
  }

  async permanentDeleteBulk(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    this.clipsCache = this.clipsCache.filter((c) => !idSet.has(c.id));
    this.scheduleFlush();
  }

  /**
   * Merge-into-JSON — called by SyncManager after Atlas two-way sync.
   * Replaces in-memory cache AND flushes to disk immediately.
   */
  async mergeItems(merged: ClipboardItem[]): Promise<void> {
    this.clipsCache = merged;
    // Force immediate write (not debounced) since this is a sync operation
    try {
      this.writeAtomic(
        getClipsPath(),
        JSON.stringify(this.clipsCache, null, 2),
      );
      console.log(`[Storage] Flushed ${merged.length} merged items to JSON`);
    } catch (e) {
      console.error("[Storage] Merge flush failed:", e);
    }
  }

  // ── TAGS ────────────────────────────────────────────────────────────────
  getTags(): Tag[] {
    return this.tagsCache;
  }

  async saveTags(tags: unknown[]): Promise<void> {
    this.tagsCache = tags as Tag[];
    this.writeAtomic(getTagsPath(), JSON.stringify(tags, null, 2));
  }

  // ── SETTINGS ────────────────────────────────────────────────────────────
  getSettings(): AppSettings {
    return this.settingsCache;
  }

  async saveSettings(partial: Partial<AppSettings>): Promise<void> {
    // Never log Atlas URI
    const safe = { ...partial };
    if ("atlasUri" in safe)
      delete (safe as Record<string, unknown>)["atlasUri"];
    // console.log('[Storage] Saving settings:', safe)

    this.settingsCache = { ...this.settingsCache, ...partial };
    this.writeAtomic(
      getSettingsPath(),
      JSON.stringify(this.settingsCache, null, 2),
    );
  }

  // ── RESET ───────────────────────────────────────────────────────────────
  async resetClips(): Promise<void> {
    this.clipsCache = [];
    this.writeAtomic(getClipsPath(), JSON.stringify([], null, 2));
  }

  async resetTags(): Promise<void> {
    this.tagsCache = DEFAULT_TAGS;
    this.writeAtomic(getTagsPath(), JSON.stringify(DEFAULT_TAGS, null, 2));
  }

  async resetSettings(): Promise<void> {
    this.settingsCache = { ...DEFAULT_SETTINGS };
    this.writeAtomic(getSettingsPath(), JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }
}

export const storageManager = new StorageManager();