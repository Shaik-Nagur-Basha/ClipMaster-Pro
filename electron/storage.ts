import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, copyFileSync, fsyncSync, openSync, writeSync, closeSync } from "fs";
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
  viewMode: "list",
  displayMode: "preview",
  lastLocalSyncedAt: null,
  lastCloudSyncedAt: null,
  latestSyncedAt: null,
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

    this.ensureFile(getClipsPath(), "[]");
    this.ensureFile(getTagsPath(), JSON.stringify(DEFAULT_TAGS, null, 2));
    this.ensureFile(
      getSettingsPath(),
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
    );

    this.clipsCache = this.readJSON<ClipboardItem[]>(getClipsPath(), []);
    console.log("[Storage] Loaded", this.clipsCache.length, "clips from", getClipsPath());
    this.tagsCache = this.readJSON<Tag[]>(getTagsPath(), DEFAULT_TAGS);

    // Migration logic
    const raw = this.readJSON<any>(getSettingsPath(), {});
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
  }

  // ── Internal helpers ────────────────────────────────────────────────────
  private ensureFile(path: string, content: string): void {
    if (!existsSync(path)) {
      this.writeAtomicSync(path, content);
    }
  }

  private readJSON<T>(path: string, fallback: T): T {
    try {
      if (!existsSync(path)) return fallback;
      const content = readFileSync(path, "utf-8").trim();
      if (!content) throw new Error("File is empty");
      return JSON.parse(content) as T;
    } catch (e) {
      console.error(`[Storage] CRITICAL: Corrupt file detected at ${path}.`, e);
      
      // Attempt recovery from backup
      const bakPath = path + ".bak";
      if (existsSync(bakPath)) {
        console.warn(`[Storage] Recovery: Found backup for ${path}. Attempting restore...`);
        try {
          const bakContent = readFileSync(bakPath, "utf-8").trim();
          if (bakContent) {
            const data = JSON.parse(bakContent) as T;
            console.log(`[Storage] Recovery: Successfully restored ${path} from backup.`);
            // Immediately fix the main file using the backup
            this.writeAtomicSync(path, bakContent);
            return data;
          }
        } catch (bakErr) {
          console.error(`[Storage] Recovery: Backup for ${path} was also unreadable.`, bakErr);
        }
      }

      // If we reach here, the file is unreadable AND there is no valid backup.
      // To be safe, we rename the corrupt file instead of just letting it be overwritten,
      // allowing for manual data forensics if the user needs it.
      try {
        const corruptPath = `${path}.corrupt-${Date.now()}`;
        renameSync(path, corruptPath);
        console.error(`[Storage] Recovery: Renamed corrupt file to ${corruptPath} to prevent total loss.`);
      } catch (renameErr) {
        console.error(`[Storage] Recovery: Could not rename corrupt file.`, renameErr);
      }
      
      return fallback;
    }
  }

  private writeAtomicSync(path: string, content: string): void {
    const tempPath = path + ".tmp";
    const bakPath = path + ".bak";
    
    try {
      // 1. Write to temporary file with low-level fsync to ensure disk persistence
      const fd = openSync(tempPath, "w");
      writeSync(fd, content, 0, "utf-8");
      fsyncSync(fd);
      closeSync(fd);
      
      // 2. If original exists, create/update backup
      if (existsSync(path)) {
        try { copyFileSync(path, bakPath); } catch (e) { /* ignore backup errors */ }
      }
      
      // 3. Rename temp to original (Atomic operation on Windows for local files)
      renameSync(tempPath, path);
    } catch (e) {
      console.error(`[Storage] Atomic write failed for ${path}:`, e);
      // Cleanup temp if it exists
      try { if (existsSync(tempPath)) unlinkSync(tempPath); } catch {}
    }
  }

  public forceFlush(): void {
    if (this.needsFlush) {
      this.flush();
    }
  }

  private flush(): void {
    try {
      this.writeAtomicSync(
        getClipsPath(),
        JSON.stringify(this.clipsCache, null, 2)
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
      writeFileSync(
        getClipsPath(),
        JSON.stringify(this.clipsCache, null, 2),
        "utf-8",
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
    this.writeAtomicSync(getTagsPath(), JSON.stringify(tags, null, 2));
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

    this.settingsCache = { ...this.settingsCache, ...partial };
    this.writeAtomicSync(
      getSettingsPath(),
      JSON.stringify(this.settingsCache, null, 2)
    );
  }

  // ── RESET ───────────────────────────────────────────────────────────────
  async resetClips(): Promise<void> {
    this.clipsCache = [];
    this.writeAtomicSync(getClipsPath(), JSON.stringify([], null, 2));
  }

  async resetTags(): Promise<void> {
    this.tagsCache = DEFAULT_TAGS;
    this.writeAtomicSync(
      getTagsPath(),
      JSON.stringify(DEFAULT_TAGS, null, 2)
    );
  }

  async resetSettings(): Promise<void> {
    this.settingsCache = { ...DEFAULT_SETTINGS };
    this.writeAtomicSync(
      getSettingsPath(),
      JSON.stringify(DEFAULT_SETTINGS, null, 2)
    );
  }
}

export const storageManager = new StorageManager();
