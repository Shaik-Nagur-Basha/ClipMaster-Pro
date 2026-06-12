import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync, unlinkSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import Datastore from "@seald-io/nedb";
import type { ClipboardItem, Tag, AppSettings } from "../src/types";

// ─── Path Resolution ───────────────────────────────────────────────────────
export function getDataDir(): string {
  const isDev = !app.isPackaged;
  const isAllUsers = process.env.ALL_USERS === "true";

  if (isDev) {
    return join(process.cwd(), "data");
  }

  if (isAllUsers) {
    return join("C:\\ProgramData", app.getName(), "data");
  }

  return join(app.getPath("userData"), "data");
}

const getClipsPath = () => join(getDataDir(), "clipboard.json");
const getTagsPath = () => join(getDataDir(), "tags.json");
const getSettingsPath = () => join(getDataDir(), "settings.json");

// ─── Defaults ──────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: true,
  maxEntries: 5000,
  pollingInterval: 600,
  paginationEnabled: true,
  pageSize: 10,
  viewMode: "list",
  displayMode: "preview",
  pauseCaptureOption: "never",
  pauseUntil: null,
  globalShortcutEnabled: true,
  globalShortcutKey: "CommandOrControl+Shift+V",
  popupPinned: false,
};

const DEFAULT_TAGS: Tag[] = [
  { id: "favorites", name: "Favorites", color: "#22c55e" },
  { id: "work", name: "Work", color: "#6366f1" },
  { id: "personal", name: "Personal", color: "#f59e0b" },
];

// ─── Database File Integrity ───────────────────────────────────────────────
function validateDatabaseFile(filePath: string): boolean {
  if (!existsSync(filePath)) return true; // File will be created by NeDB
  try {
    const data = readFileSync(filePath, "utf-8").trim();
    if (!data) return true; // Empty file is valid NeDB
    // NeDB is JSON lines. Validate that each non-empty line parses as valid JSON.
    const lines = data.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        JSON.parse(trimmed);
      }
    }
    return true;
  } catch (err) {
    console.error(`[Storage] Validation failed for database file ${filePath}:`, err);
    return false;
  }
}

function verifyAndRestoreDb(filePath: string): void {
  const bakPath = filePath + ".bak";
  if (!validateDatabaseFile(filePath)) {
    if (existsSync(bakPath) && validateDatabaseFile(bakPath)) {
      console.warn(`[Storage] Database file ${filePath} is corrupted. Restoring from backup...`);
      try {
        copyFileSync(bakPath, filePath);
      } catch (err) {
        console.error(`[Storage] Failed to copy backup for ${filePath}:`, err);
      }
    } else {
      console.error(`[Storage] Both database file ${filePath} and backup are corrupted or missing. Starting fresh.`);
      try {
        writeFileSync(filePath, "", "utf-8");
      } catch (err) {
        console.error(`[Storage] Failed to write empty file for ${filePath}:`, err);
      }
    }
  }
}

function createDbBackup(filePath: string): void {
  const bakPath = filePath + ".bak";
  try {
    if (existsSync(filePath)) {
      copyFileSync(filePath, bakPath);
    }
  } catch (err) {
    console.error(`[Storage] Failed to create backup for ${filePath}:`, err);
  }
}

// ─── Storage Manager ───────────────────────────────────────────────────────
class StorageManager {
  public clipsDb!: Datastore<ClipboardItem>;
  public tagsDb!: Datastore<Tag>;
  public settingsDb!: Datastore<AppSettings>;

  private settingsCache: AppSettings = { ...DEFAULT_SETTINGS };

  // ── Init ────────────────────────────────────────────────────────────────
  async init(): Promise<void> {
    const dir = getDataDir();
    console.log("[Storage] Data directory:", dir);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const clipsDbPath = join(dir, "clips.db");
    const tagsDbPath = join(dir, "tags.db");
    const settingsDbPath = join(dir, "settings.db");

    // 1. Verify integrity of all database files
    verifyAndRestoreDb(clipsDbPath);
    verifyAndRestoreDb(tagsDbPath);
    verifyAndRestoreDb(settingsDbPath);

    // 2. Load datastores
    this.clipsDb = new Datastore<ClipboardItem>({ filename: clipsDbPath, autoload: true });
    this.tagsDb = new Datastore<Tag>({ filename: tagsDbPath, autoload: true });
    this.settingsDb = new Datastore<AppSettings>({ filename: settingsDbPath, autoload: true });

    // Set auto-compaction intervals
    this.clipsDb.setAutocompactionInterval(60 * 60 * 1000); // 1 hour
    this.tagsDb.setAutocompactionInterval(2 * 60 * 60 * 1000); // 2 hours
    this.settingsDb.setAutocompactionInterval(2 * 60 * 60 * 1000); // 2 hours

    // Ensure Indexes
    await this.clipsDb.ensureIndexAsync({ fieldName: "id", unique: true });
    await this.clipsDb.ensureIndexAsync({ fieldName: "timestamp" });

    // 3. Migrate old JSON data if present
    const oldClipsPath = getClipsPath();
    const oldTagsPath = getTagsPath();
    const oldSettingsPath = getSettingsPath();

    if (existsSync(oldClipsPath)) {
      try {
        const count = await this.clipsDb.countAsync({});
        if (count === 0) {
          console.log("[Storage] Migrating clipboard.json to clips.db...");
          const oldClips = this.loadFileWithBackup<ClipboardItem[]>(oldClipsPath, []);
          for (const clip of oldClips) {
            clip.version = clip.version ?? 1;
            await this.clipsDb.insertAsync(clip);
          }
          renameSync(oldClipsPath, oldClipsPath + ".migrated");
          if (existsSync(oldClipsPath + ".bak")) {
            renameSync(oldClipsPath + ".bak", oldClipsPath + ".bak.migrated");
          }
          console.log("[Storage] Migrated", oldClips.length, "clips.");
        }
      } catch (err) {
        console.error("[Storage] Clips migration failed:", err);
      }
    }

    // Load and migrate tags, or initialize defaults
    try {
      const tagsCount = await this.tagsDb.countAsync({});
      if (tagsCount === 0) {
        if (existsSync(oldTagsPath)) {
          console.log("[Storage] Migrating tags.json to tags.db...");
          const oldTags = this.loadFileWithBackup<Tag[]>(oldTagsPath, DEFAULT_TAGS);
          for (const tag of oldTags) {
            await this.tagsDb.insertAsync(tag);
          }
          renameSync(oldTagsPath, oldTagsPath + ".migrated");
          if (existsSync(oldTagsPath + ".bak")) {
            renameSync(oldTagsPath + ".bak", oldTagsPath + ".bak.migrated");
          }
          console.log("[Storage] Migrated tags.");
        } else {
          console.log("[Storage] Initializing default tags...");
          for (const tag of DEFAULT_TAGS) {
            await this.tagsDb.insertAsync(tag);
          }
        }
      }
    } catch (err) {
      console.error("[Storage] Tags initialization failed:", err);
    }

    // Initialize Settings Cache & Migrate settings
    try {
      let settingsDoc = await this.settingsDb.findOneAsync({});
      if (!settingsDoc) {
        let oldSettings = DEFAULT_SETTINGS;
        if (existsSync(oldSettingsPath)) {
          console.log("[Storage] Migrating settings.json to settings.db...");
          oldSettings = this.loadFileWithBackup<any>(oldSettingsPath, DEFAULT_SETTINGS);
          renameSync(oldSettingsPath, oldSettingsPath + ".migrated");
          if (existsSync(oldSettingsPath + ".bak")) {
            renameSync(oldSettingsPath + ".bak", oldSettingsPath + ".bak.migrated");
          }
        }
        const finalSettings = { ...DEFAULT_SETTINGS, ...oldSettings };
        delete (finalSettings as any).lastSyncedAt;
        delete (finalSettings as any).firstLaunch;
        settingsDoc = await this.settingsDb.insertAsync(finalSettings);
        console.log("[Storage] Migrated settings.");
      }
      this.settingsCache = settingsDoc;
    } catch (err) {
      console.error("[Storage] Settings migration failed, using default:", err);
      this.settingsCache = { ...DEFAULT_SETTINGS };
    }

    // Save initial backup of database files
    createDbBackup(clipsDbPath);
    createDbBackup(tagsDbPath);
    createDbBackup(settingsDbPath);
  }

  // Load JSON helper for migration fallback
  private loadFileWithBackup<T>(path: string, fallback: T): T {
    const bakPath = path + ".bak";
    const tryParse = (filePath: string): T | null => {
      if (!existsSync(filePath)) return null;
      try {
        const data = readFileSync(filePath, "utf-8").trim();
        if (!data) return null;
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    };

    const mainData = tryParse(path);
    if (mainData !== null) return mainData;

    const bakData = tryParse(bakPath);
    if (bakData !== null) return bakData;

    return fallback;
  }

  // ── CLIPS ───────────────────────────────────────────────────────────────

  async readAll(): Promise<ClipboardItem[]>;
  async readAll(limit: number): Promise<ClipboardItem[]>;
  async readAll(options: {
    limit?: number;
    skip?: number;
    search?: string;
    tags?: string[];
    isFavorite?: boolean | null;
    isDeleted?: boolean;
    sortMode?: string;
    dateFrom?: string | null;
    dateTo?: string | null;
    minWordCount?: number | null;
    maxWordCount?: number | null;
    tagMatchingMode?: "and" | "or";
  }): Promise<{ clips: ClipboardItem[]; totalCount: number }>;
  async readAll(options?: number | {
    limit?: number;
    skip?: number;
    search?: string;
    tags?: string[];
    isFavorite?: boolean | null;
    isDeleted?: boolean;
    sortMode?: string;
    dateFrom?: string | null;
    dateTo?: string | null;
    minWordCount?: number | null;
    maxWordCount?: number | null;
    tagMatchingMode?: "and" | "or";
  }): Promise<any> {
    if (options === undefined || typeof options === "number") {
      let cursor = this.clipsDb.findAsync({}).sort({ timestamp: -1 });
      if (options !== undefined) {
        cursor = cursor.limit(options);
      }
      return await cursor;
    }

    const query: any = {};

    // 1. isDeleted
    if (options.isDeleted !== undefined) {
      query.isDeleted = options.isDeleted;
    }

    // 2. isFavorite
    if (options.isFavorite === true) {
      query.isFavorite = true;
    } else if (options.isFavorite === false) {
      query.isFavorite = false;
    }

    // 3. search
    if (options.search && options.search.trim()) {
      const escaped = options.search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      query.text = new RegExp(escaped, "i");
    }

    // 4. tags
    if (options.tags && options.tags.length > 0) {
      const matchMode = options.tagMatchingMode ?? "or";
      if (matchMode === "and") {
        query.tags = { $all: options.tags };
      } else {
        query.tags = { $in: options.tags };
      }
    }

    // 5. word count / character count (filtering by length)
    if (options.minWordCount !== null && options.minWordCount !== undefined) {
      query.charCount = { ...query.charCount, $gte: options.minWordCount };
    }
    if (options.maxWordCount !== null && options.maxWordCount !== undefined) {
      query.charCount = { ...query.charCount, $lte: options.maxWordCount };
    }

    // 6. date range
    if (options.dateFrom) {
      query.timestamp = { ...query.timestamp, $gte: new Date(options.dateFrom).toISOString() };
    }
    if (options.dateTo) {
      query.timestamp = { ...query.timestamp, $lte: new Date(options.dateTo + "T23:59:59").toISOString() };
    }

    // Sorting
    let sortQuery: any = { timestamp: -1 };
    if (options.sortMode === "oldest") {
      sortQuery = { timestamp: 1 };
    } else if (options.sortMode === "longest") {
      sortQuery = { charCount: -1 };
    } else if (options.sortMode === "shortest") {
      sortQuery = { charCount: 1 };
    } else if (options.sortMode === "newest") {
      sortQuery = { timestamp: -1 };
    }

    // Fetch total count matching query
    const totalCount = await this.clipsDb.countAsync(query);

    // Fetch paginated results
    let cursor = this.clipsDb.findAsync(query).sort(sortQuery);
    if (options.skip !== undefined) {
      cursor = cursor.skip(options.skip);
    }
    if (options.limit !== undefined) {
      cursor = cursor.limit(options.limit);
    }

    const clips = await cursor;
    return { clips, totalCount };
  }

  async getCounts(): Promise<{ active: number; favorites: number; deleted: number }> {
    const active = await this.clipsDb.countAsync({ isDeleted: false });
    const favorites = await this.clipsDb.countAsync({ isDeleted: false, isFavorite: true });
    const deleted = await this.clipsDb.countAsync({ isDeleted: true });
    return { active, favorites, deleted };
  }

  async getFilterStats(options: {
    isDeleted?: boolean;
    isFavorite?: boolean | null;
    search?: string;
  }): Promise<{
    minCharCount: number;
    maxCharCount: number;
    tagCounts: Record<string, number>;
  }> {
    const query: any = {};

    if (options.isDeleted !== undefined) {
      query.isDeleted = options.isDeleted;
    }

    if (options.isFavorite === true) {
      query.isFavorite = true;
    } else if (options.isFavorite === false) {
      query.isFavorite = false;
    }

    if (options.search && options.search.trim()) {
      const escaped = options.search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      query.text = new RegExp(escaped, "i");
    }

    const clips = await this.clipsDb.findAsync(query, { tags: 1, charCount: 1, text: 1 });

    let minCharCount = 1;
    let maxCharCount = 100;
    const tagCounts: Record<string, number> = {};

    if (clips.length > 0) {
      const counts = clips.map(c => c.charCount ?? c.text.length);
      minCharCount = Math.min(...counts);
      maxCharCount = Math.max(...counts);

      clips.forEach(c => {
        if (c.tags) {
          c.tags.forEach((tId: string) => {
            tagCounts[tId] = (tagCounts[tId] || 0) + 1;
          });
        }
      });
    }

    if (maxCharCount <= minCharCount) {
      maxCharCount = minCharCount + 1;
    }

    return { minCharCount, maxCharCount, tagCounts };
  }

  async addEntry(text: string): Promise<ClipboardItem | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const now = new Date().toISOString();

    // Deduplication: resurface existing item to top
    const existing = await this.clipsDb.findOneAsync({ text: trimmed, isDeleted: false });

    // Enforce max entries limit
    const maxEntries = this.settingsCache.maxEntries ?? 5000;
    const activeCount = await this.clipsDb.countAsync({ isDeleted: false });

    if (activeCount >= maxEntries && !existing) {
      console.log(`[Storage] Max entries limit reached (${activeCount}/${maxEntries}). Clip catching stopped.`);
      return null;
    }

    if (existing) {
      const nextVersion = (existing.version ?? 0) + 1;
      const updated: ClipboardItem = {
        ...existing,
        timestamp: now,
        updatedAt: now,
        version: nextVersion
      };
      await this.clipsDb.updateAsync({ id: existing.id }, updated);
      createDbBackup(join(getDataDir(), "clips.db"));
      return updated;
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
      version: 1
    };

    await this.clipsDb.insertAsync(item);
    createDbBackup(join(getDataDir(), "clips.db"));
    return item;
  }

  async updateEntry(item: ClipboardItem): Promise<void> {
    const existing = await this.clipsDb.findOneAsync({ id: item.id });
    const nextVersion = (existing?.version ?? item.version ?? 0) + 1;

    const updated: ClipboardItem = {
      ...item,
      updatedAt: new Date().toISOString(),
      wordCount: item.text.split(/\s+/).filter(Boolean).length,
      charCount: item.text.length,
      version: nextVersion
    };

    await this.clipsDb.updateAsync({ id: item.id }, updated);
    createDbBackup(join(getDataDir(), "clips.db"));
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.clipsDb.findOneAsync({ id });
    if (!existing) return;

    const now = new Date().toISOString();
    const nextVersion = (existing.version ?? 0) + 1;

    await this.clipsDb.updateAsync(
      { id },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
          version: nextVersion,
        },
      }
    );
    createDbBackup(join(getDataDir(), "clips.db"));
  }

  async restoreEntry(id: string): Promise<void> {
    const existing = await this.clipsDb.findOneAsync({ id });
    if (!existing) return;

    const now = new Date().toISOString();
    const nextVersion = (existing.version ?? 0) + 1;

    await this.clipsDb.updateAsync(
      { id },
      {
        $set: {
          isDeleted: false,
          updatedAt: now,
          version: nextVersion,
        },
        $unset: { deletedAt: true },
      }
    );
    createDbBackup(join(getDataDir(), "clips.db"));
  }

  async permanentDelete(id: string): Promise<void> {
    await this.clipsDb.removeAsync({ id }, {});
    createDbBackup(join(getDataDir(), "clips.db"));
  }

  async permanentDeleteBulk(ids: string[]): Promise<void> {
    await this.clipsDb.removeAsync({ id: { $in: ids } }, { multi: true });
    createDbBackup(join(getDataDir(), "clips.db"));
  }

  async mergeItems(merged: ClipboardItem[]): Promise<void> {
    for (const item of merged) {
      await this.clipsDb.updateAsync({ id: item.id }, item, { upsert: true });
    }
    createDbBackup(join(getDataDir(), "clips.db"));
  }

  // ── TAGS ────────────────────────────────────────────────────────────────

  async getTags(): Promise<Tag[]> {
    return await this.tagsDb.findAsync({});
  }

  async saveTags(tags: Tag[]): Promise<void> {
    await this.tagsDb.removeAsync({}, { multi: true });
    for (const tag of tags) {
      await this.tagsDb.insertAsync(tag);
    }
    createDbBackup(join(getDataDir(), "tags.db"));
  }

  // ── SETTINGS ────────────────────────────────────────────────────────────

  getSettings(): AppSettings {
    return this.settingsCache;
  }

  async saveSettings(partial: Partial<AppSettings>): Promise<void> {
    this.settingsCache = { ...this.settingsCache, ...partial };
    // Isolation: Save settings immediately to settings.db.
    // It bypasses the synchronization queue and writes directly.
    await this.settingsDb.updateAsync({}, this.settingsCache, { upsert: true });
    createDbBackup(join(getDataDir(), "settings.db"));
  }

  // ── RESET ───────────────────────────────────────────────────────────────

  async resetClips(): Promise<void> {
    await this.clipsDb.removeAsync({}, { multi: true });
    createDbBackup(join(getDataDir(), "clips.db"));
  }

  async resetTags(): Promise<void> {
    await this.tagsDb.removeAsync({}, { multi: true });
    for (const tag of DEFAULT_TAGS) {
      await this.tagsDb.insertAsync(tag);
    }
    createDbBackup(join(getDataDir(), "tags.db"));
  }

  async resetSettings(): Promise<void> {
    this.settingsCache = { ...DEFAULT_SETTINGS };
    await this.settingsDb.removeAsync({}, { multi: true });
    await this.settingsDb.insertAsync(DEFAULT_SETTINGS);
    createDbBackup(join(getDataDir(), "settings.db"));
  }

  async resetUiState(): Promise<void> {
    const filePath = this.getUiStatePath();
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch (err) {
        console.error("[Storage] Failed to delete ui_state.json:", err);
      }
    }
  }

  // ── UI STATE PERSISTENCE ─────────────────────────────────────────────────

  getUiStatePath(): string {
    return join(getDataDir(), "ui_state.json");
  }

  getUiState(defaults: any): any {
    const filePath = this.getUiStatePath();
    if (!existsSync(filePath)) return defaults;
    try {
      const content = readFileSync(filePath, "utf-8").trim();
      if (!content) return defaults;
      return JSON.parse(content);
    } catch (err) {
      console.error("[Storage] Failed to read ui_state.json:", err);
      return defaults;
    }
  }

  async saveUiState(state: any): Promise<void> {
    const filePath = this.getUiStatePath();
    try {
      writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
    } catch (err) {
      console.error("[Storage] Failed to write ui_state.json:", err);
    }
  }

}

export const storageManager = new StorageManager();