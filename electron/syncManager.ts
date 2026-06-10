/**
 * SyncManager — Multi-layer data sync orchestrator
 *
 * Architecture (strict priority):
 *   Layer 1: NeDB  — primary source of truth (ALWAYS written first)
 *   Layer 2: Local MongoDB  — secondary  (if running locally)
 *   Layer 3: MongoDB Atlas  — tertiary   (if URL configured + internet)
 */

import { net } from "electron";
import { storageManager } from "./storage";
import mongoose, { Schema, Document, Model } from "mongoose";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import type { ClipboardItem, SyncState, SyncQueueEntry } from "../src/types";

// ─── Encryption ────────────────────────────────────────────────────────────
const MACHINE_KEY = scryptSync(
  process.env.CLIPMASTER_SECRET ?? "clipmaster-default-secret-2026",
  "clipmaster-salt-v2",
  32,
);

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", MACHINE_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf-8"),
    cipher.final(),
  ]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(data: string): string {
  try {
    const [ivHex, encHex] = data.split(":");
    if (!ivHex || !encHex) return data;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", MACHINE_KEY, iv);
    return Buffer.concat([
      decipher.update(Buffer.from(encHex, "hex")),
      decipher.final(),
    ]).toString("utf-8");
  } catch {
    return data;
  }
}

function maskUri(uri: string): string {
  return uri
    .replace(/:([^@]+)@/, ":***@")
    .replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
}

// ─── Mongoose Schema (shared for both connections) ─────────────────────────
interface ClipDoc extends Document {
  clipId: string;
  textEncrypted: string;
  timestamp: string;
  updatedAt: string;
  tags: string[];
  isFavorite: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  wordCount: number;
  charCount: number;
  syncedAt: string;
  version: number;
}

const clipSchemaDefinition = {
  clipId: { type: String, required: true, unique: true, index: true },
  textEncrypted: { type: String, required: true },
  timestamp: { type: String, required: true },
  updatedAt: {
    type: String,
    required: true,
    default: () => new Date().toISOString(),
  },
  tags: { type: [String], default: [] },
  isFavorite: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: String },
  wordCount: { type: Number, default: 0 },
  charCount: { type: Number, default: 0 },
  syncedAt: { type: String, default: () => new Date().toISOString() },
  version: { type: Number, default: 1 },
};

const tagSchemaDefinition = {
  tagId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
  updatedAt: { type: String, default: () => new Date().toISOString() },
  syncedAt: { type: String, default: () => new Date().toISOString() },
};

// ─── Mongoose Connection Factory ───────────────────────────────────────────
class MongoConnection {
  private conn: mongoose.Connection | null = null;
  private ClipModel: Model<ClipDoc> | null = null;
  private TagModel: Model<any> | null = null;
  private _connected = false;
  private _label: string;

  constructor(label: string) {
    this._label = label;
  }

  async connect(uri: string, isAtlas: boolean): Promise<boolean> {
    if (this.conn) {
      try {
        await this.conn.close();
      } catch {
        /* ignore */
      }
      this.conn = null;
      this.ClipModel = null;
      this._connected = false;
    }

    const timeoutMs = isAtlas ? 10000 : 5000;

    try {
      const options = {
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs,
        socketTimeoutMS: isAtlas ? 45000 : 10000,
        tls: isAtlas,
        retryWrites: true,
        w: "majority",
        // Keep-alive settings to prevent dropouts
        maxPoolSize: isAtlas ? 10 : 5,
        minPoolSize: 1,
        heartbeatFrequencyMS: isAtlas ? 10000 : 30000,
      };

      const connection = mongoose.createConnection(uri, options as any);

      // Event listeners for real-time status tracking
      connection.on("connected", () => {
        this._connected = true;
        console.log(`[Sync:${this._label}] Connection established`);
      });

      connection.on("disconnected", () => {
        this._connected = false;
        console.log(`[Sync:${this._label}] Connection disconnected`);
      });

      connection.on("error", (err) => {
        this._connected = false;
        console.warn(`[Sync:${this._label}] Connection error:`, err.message);
      });

      this.conn = await connection.asPromise();

      const clipSchema = new Schema<ClipDoc>(clipSchemaDefinition, {
        collection: "clips",
      });
      this.ClipModel = this.conn.model<ClipDoc>("Clip", clipSchema);

      const tagSchema = new Schema(tagSchemaDefinition, { collection: "tags" });
      this.TagModel = this.conn.model("Tag", tagSchema);

      this._connected = true;
      console.log(`[Sync:${this._label}] Connected to ${maskUri(uri)}`);
      return true;
    } catch (err) {
      this._connected = false;
      console.warn(
        `[Sync:${this._label}] Connection failed:`,
        (err as Error).message,
      );
      return false;
    }
  }

  get connected(): boolean {
    return this._connected && this.conn?.readyState === 1;
  }

  get model(): Model<ClipDoc> | null {
    return this.ClipModel;
  }

  async getServerTime(): Promise<string | null> {
    if (!this.conn || !this.connected) return null;
    try {
      if (!this.conn || !this.conn.db) return null;
      const result = await (this.conn.db as any).command({ hello: 1 });
      return result.localTime ? new Date(result.localTime).toISOString() : null;
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.conn) {
      try {
        await this.conn.close();
      } catch {
        /* ignore */
      }
      this.conn = null;
    }
    this._connected = false;
  }

  async upsertBulk(items: ClipboardItem[]): Promise<void> {
    if (!this.connected || !this.ClipModel || items.length === 0) return;
    const ops = items.map((item) => ({
      updateOne: {
        filter: { clipId: item.id },
        update: {
          $set: {
            clipId: item.id,
            textEncrypted: encrypt(item.text),
            timestamp: item.timestamp,
            updatedAt: item.updatedAt ?? item.timestamp,
            tags: item.tags,
            isFavorite: item.isFavorite,
            isDeleted: item.isDeleted,
            deletedAt: item.deletedAt,
            wordCount: item.wordCount ?? 0,
            charCount: item.charCount ?? 0,
            syncedAt: new Date().toISOString(),
            version: item.version ?? 1,
          },
        },
        upsert: true,
      },
    }));
    await this.ClipModel.bulkWrite(ops, { ordered: false });
    console.log(`[Sync:${this._label}] Bulk upserted ${items.length} items`);
  }

  async fetchAll(): Promise<ClipboardItem[]> {
    if (!this.connected || !this.ClipModel) return [];
    const docs = await this.ClipModel.find({}).lean();
    return docs.map((d) => ({
      id: d.clipId,
      text: decrypt(d.textEncrypted),
      timestamp: d.timestamp,
      updatedAt: d.updatedAt ?? d.timestamp,
      tags: d.tags,
      isFavorite: d.isFavorite,
      isDeleted: d.isDeleted,
      deletedAt: d.deletedAt,
      wordCount: d.wordCount,
      charCount: d.charCount,
      version: d.version ?? 1,
      localMongoVersion: d.version ?? 1,
      atlasVersion: d.version ?? 1,
    }));
  }

  async permanentDelete(id: string): Promise<void> {
    if (!this.connected || !this.ClipModel) return;
    await this.ClipModel.deleteOne({ clipId: id });
  }

  async permanentDeleteBulk(ids: string[]): Promise<void> {
    if (!this.connected || !this.ClipModel || ids.length === 0) return;
    await this.ClipModel.deleteMany({ clipId: { $in: ids } });
  }

  async syncTags(tags: any[]): Promise<void> {
    if (!this.connected || !this.TagModel) return;
    if (tags.length === 0) {
      await this.TagModel.deleteMany({});
      return;
    }

    const ids = tags.map((tag) => tag.id);
    const ops = tags.map((tag) => ({
      updateOne: {
        filter: { tagId: tag.id },
        update: {
          $set: {
            tagId: tag.id,
            name: tag.name,
            color: tag.color,
            updatedAt: tag.updatedAt ?? new Date().toISOString(),
            syncedAt: new Date().toISOString(),
          },
        },
        upsert: true,
      },
    }));
    await this.TagModel.bulkWrite(ops, { ordered: false });
    await this.TagModel.deleteMany({ tagId: { $nin: ids } });
  }

  async fetchTags(): Promise<any[]> {
    if (!this.connected || !this.TagModel) return [];
    const docs = await this.TagModel.find({}).lean();
    return docs.map((d: any) => ({
      id: d.tagId,
      name: d.name,
      color: d.color,
      updatedAt: d.updatedAt || d.syncedAt,
    }));
  }
}

// ─── Conflict Resolution ───────────────────────────────────────────────────
export function mergeItems(
  primary: ClipboardItem[],
  secondary: ClipboardItem[],
): ClipboardItem[] {
  const map = new Map<string, ClipboardItem>();

  for (const item of primary) {
    map.set(item.id, item);
  }

  for (const item of secondary) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const existingVer = existing.version ?? 0;
      const incomingVer = item.version ?? 0;
      if (incomingVer > existingVer) {
        map.set(item.id, item);
      } else if (incomingVer === existingVer) {
        const existingTime = new Date(
          existing.updatedAt ?? existing.timestamp,
        ).getTime();
        const incomingTime = new Date(item.updatedAt ?? item.timestamp).getTime();
        if (incomingTime > existingTime) {
          map.set(item.id, item);
        }
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

// ─── Internet Detection ────────────────────────────────────────────────────
async function isInternetAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const req = net.request({ method: "HEAD", url: "https://1.1.1.1" });
      req.on("response", () => resolve(true));
      req.on("error", () => resolve(false));
      setTimeout(() => resolve(false), 3000);
      req.end();
    } catch {
      resolve(false);
    }
  });
}

// ─── Sync Manager ──────────────────────────────────────────────────────────
class SyncManager {
  private localConn = new MongoConnection("local");
  private atlasConn = new MongoConnection("atlas");

  private tagsDirty = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private isLocalSyncing = false;
  private isAtlasSyncing = false;
  private isWindowOpen = false;

  setWindowOpen(open: boolean): void {
    this.isWindowOpen = open;
    if (open) {
      console.log("[Sync] Application window opened. Resuming background sync...");
      this.startBackgroundSync();
    } else {
      console.log("[Sync] Application window closed. Suspending background sync...");
      this.stopBackgroundSync();
    }
  }

  private scheduleDebouncedSync(delayMs = 3000): void {
    if (!this.isWindowOpen) {
      console.log("[Sync] App window is closed. Sync deferred to window reopen.");
      return;
    }
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(() => {
      console.log("[Sync] Triggering debounced sync pass...");
      this.runSync().catch((err) => {
        console.error("[Sync:debounced] Sync pass failed:", err.message);
      });
    }, delayMs);
  }

  private state: SyncState = {
    localMongo: "idle",
    atlas: "idle",
    lastLocalSyncedAt: null,
    lastCloudSyncedAt: null,
    latestSyncedAt: null,
  };

  private stateListeners: Array<(s: SyncState) => void> = [];

  // ── State Broadcasting ──────────────────────────────────────────────────
  initSyncState(state: Partial<SyncState>): void {
    this.state = { ...this.state, ...state };
  }

  private emitState(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    this.stateListeners.forEach((fn) => fn({ ...this.state }));
  }

  onStateChange(fn: (s: SyncState) => void): () => void {
    this.stateListeners.push(fn);
    return () => {
      this.stateListeners = this.stateListeners.filter((f) => f !== fn);
    };
  }

  getState(): SyncState {
    return { ...this.state };
  }

  // Expose pending queue count through state (can be used in UI if needed)
  async getPendingCount(): Promise<number> {
    if (!storageManager.queueDb) return 0;
    return await storageManager.queueDb.countAsync({});
  }

  // ── Connection Management ───────────────────────────────────────────────
  async connectLocal(uri: string | null): Promise<boolean> {
    const finalUri = uri || "mongodb://127.0.0.1:27017/clipmaster";
    this.emitState({ localMongo: "syncing" });
    const ok = await this.localConn.connect(finalUri, false);
    this.emitState({
      localMongo: ok ? "idle" : "error",
    });
    return ok;
  }

  async disconnectLocal(): Promise<void> {
    await this.localConn.disconnect();
    this.emitState({
      localMongo: "idle",
      lastLocalSyncedAt: null,
      latestSyncedAt: this.state.lastCloudSyncedAt,
    });
  }

  async disconnectAtlas(): Promise<void> {
    await this.atlasConn.disconnect();
    this.emitState({
      atlas: "idle",
      lastCloudSyncedAt: null,
      latestSyncedAt: this.state.lastLocalSyncedAt,
    });
  }

  async autoDetectLocalMongo(getAllJSON: () => Promise<ClipboardItem[]>): Promise<void> {
    const settings = storageManager.getSettings();
    if (settings.lastLocalSyncedAt === null) {
      console.log(
        "[Sync] First launch detected, attempting local Mongo connection...",
      );
      const ok = await this.connectLocal(null);
      if (ok) {
        await storageManager.saveSettings({
          mongoEnabled: true,
          mongoUri: "mongodb://127.0.0.1:27017/clipmaster",
          lastLocalSyncedAt: new Date().toISOString(),
        });
        await this.bootstrapSync(getAllJSON);
      }
    }
  }

  async connectAtlas(uri: string): Promise<boolean> {
    const isAtlas =
      uri.includes("mongodb+srv://") || uri.includes("mongodb.net");
    this.emitState({ atlas: "syncing" });
    const ok = await this.atlasConn.connect(uri, isAtlas);
    this.emitState({ atlas: ok ? "idle" : "error" });
    return ok;
  }

  isLocalConnected(): boolean {
    return this.localConn.connected;
  }
  isAtlasConnected(): boolean {
    return this.atlasConn.connected;
  }

  // ── Queue Management ────────────────────────────────────────────────────
  async enqueue(
    item: ClipboardItem,
    operation: SyncQueueEntry["operation"] = "upsert",
  ): Promise<void> {
    if (!storageManager.queueDb) return;
    const id = item.id;
    const entry = {
      id,
      operation,
      item: operation !== "permanent-delete" ? item : undefined,
      enqueuedAt: new Date().toISOString(),
      retries: 0,
    };
    await storageManager.queueDb.updateAsync({ id }, entry, { upsert: true });

    // Threshold Check: Auto trigger sync if queue has >= 50 items, otherwise schedule debounced sync
    const count = await storageManager.queueDb.countAsync({});
    if (count >= 50 && this.isWindowOpen) {
      console.log(`[Sync] Queue size (${count}) reached threshold. Syncing...`);
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.runSync().catch(() => {});
    } else {
      this.scheduleDebouncedSync();
    }
    this.emitState({});
  }

  async enqueueBulk(
    items: ClipboardItem[],
    operation: SyncQueueEntry["operation"] = "upsert",
  ): Promise<void> {
    if (!storageManager.queueDb) return;
    const enqueuedAt = new Date().toISOString();
    for (const item of items) {
      const id = item.id;
      const entry = {
        id,
        operation,
        item: operation !== "permanent-delete" ? item : undefined,
        enqueuedAt,
        retries: 0,
      };
      await storageManager.queueDb.updateAsync({ id }, entry, { upsert: true });
    }

    const count = await storageManager.queueDb.countAsync({});
    if (count >= 50 && this.isWindowOpen) {
      console.log(`[Sync] Queue size (${count}) reached threshold. Syncing...`);
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.runSync().catch(() => {});
    } else {
      this.scheduleDebouncedSync();
    }
    this.emitState({});
  }

  enqueueTagSync(): void {
    this.tagsDirty = true;
    this.scheduleDebouncedSync();
    this.emitState({});
  }

  // ── Core Sync Flow ──────────────────────────────────────────────────────
  async runSync(
    force: boolean = false,
    target: "local" | "atlas" | "all" = "all",
  ): Promise<SyncState> {
    const alreadyLocal =
      (target === "all" || target === "local") && this.isLocalSyncing;
    const alreadyAtlas =
      (target === "all" || target === "atlas") && this.isAtlasSyncing;

    if (target === "local" && alreadyLocal) return this.getState();
    if (target === "atlas" && alreadyAtlas) return this.getState();
    if (target === "all" && (alreadyLocal || alreadyAtlas))
      return this.getState();

    if (target === "all" || target === "local") this.isLocalSyncing = true;
    if (target === "all" || target === "atlas") this.isAtlasSyncing = true;

    const startTime = Date.now();
    let queueSizeBefore = 0;
    let queueSizeAfter = 0;

    try {
      const settings = storageManager.getSettings();

      // ─── Auto-Reconnection logic ──────────────────────────────────────────
      // If Local MongoDB is enabled but not connected, try to reconnect
      if (
        (target === "all" || target === "local") &&
        settings.mongoEnabled &&
        !this.localConn.connected &&
        settings.mongoUri
      ) {
        console.log("[Sync] Local MongoDB is enabled but disconnected. Reconnecting...");
        await this.connectLocal(settings.mongoUri);
      }

      // If Atlas is enabled but not connected, try to reconnect if internet is available
      if (
        (target === "all" || target === "atlas") &&
        settings.atlasEnabled &&
        !this.atlasConn.connected &&
        settings.atlasUri
      ) {
        const isOnline = await isInternetAvailable();
        if (isOnline) {
          console.log("[Sync] Atlas Cloud is enabled but disconnected. Reconnecting...");
          await this.connectAtlas(settings.atlasUri);
        } else {
          console.log("[Sync] Atlas Cloud is enabled but offline. Skipping reconnection.");
        }
      }

      // Read persistent queue entries
      const queueEntries = await storageManager.queueDb.findAsync({});
      queueSizeBefore = queueEntries.length;

      const tagDelta = this.tagsDirty || force;
      const localTags = await storageManager.getTags();

      const hasChanges = queueEntries.length > 0 || tagDelta;

      if (!hasChanges && !force) {
        // No modifications to sync
        return this.getState();
      }

      const targetLayer: "local-mongo" | "atlas" | "all" | undefined =
        target === "local" ? "local-mongo" : target;

      // Log sync start
      await storageManager.logSyncEvent(
        "sync-start",
        undefined,
        targetLayer,
        "pending",
        `Starting sync pass. Queue size: ${queueSizeBefore}`,
        undefined,
        queueSizeBefore
      );

      // Compress the sync queue: group by clip ID and keep only the latest enqueued operation
      const grouped = new Map<string, any>();
      for (const entry of queueEntries) {
        const existing = grouped.get(entry.id);
        if (
          !existing ||
          new Date(entry.enqueuedAt).getTime() > new Date(existing.enqueuedAt).getTime()
        ) {
          grouped.set(entry.id, entry);
        }
      }
      const compressedEntries = Array.from(grouped.values());

      const changedItems = compressedEntries
        .filter((e) => e.operation !== "permanent-delete" && e.item)
        .map((e) => e.item as ClipboardItem);
      const deleteSnapshot = compressedEntries
        .filter((e) => e.operation === "permanent-delete")
        .map((e) => e.id);

      let localSucceeded = true;
      let atlasSucceeded = true;

      // ─── Layer 2: Local MongoDB ────────────────────────────────────────────
      const localEligible =
        (target === "all" || target === "local") &&
        this.localConn.connected &&
        settings.mongoEnabled;

      if (localEligible) {
        this.emitState({ localMongo: "syncing" });
        try {
          // Version comparison: only upload items where local version > localMongoVersion
          const localMongoUploads = changedItems.filter(
            (item) => (item.version ?? 1) > (item.localMongoVersion ?? 0)
          );

          if (localMongoUploads.length > 0) {
            await this.localConn.upsertBulk(localMongoUploads);
          }
          if (tagDelta) {
            await this.localConn.syncTags(localTags);
          }
          if (deleteSnapshot.length > 0) {
            await this.localConn.permanentDeleteBulk(deleteSnapshot);
          }

          // Update version metadata locally on success
          if (localMongoUploads.length > 0) {
            await storageManager.markAsSyncedToLocalMongo(localMongoUploads);
          }

          const now = new Date().toISOString();
          await storageManager.saveSettings({ lastLocalSyncedAt: now });

          this.emitState({
            localMongo: "idle",
            lastLocalSyncedAt: now,
            latestSyncedAt: now,
          });

          await storageManager.logSyncEvent(
            "sync-success",
            undefined,
            "local-mongo",
            "success",
            `Successfully synced to Local MongoDB. Upserted: ${localMongoUploads.length}, Deleted: ${deleteSnapshot.length}`,
            Date.now() - startTime,
            queueSizeBefore
          );
        } catch (err) {
          localSucceeded = false;
          const errMsg = (err as Error).message;
          console.error("[Sync:local] Failed:", errMsg);
          this.emitState({ localMongo: "error" });

          await storageManager.logSyncEvent(
            "sync-failure",
            undefined,
            "local-mongo",
            "failure",
            `Local MongoDB sync failed: ${errMsg}`,
            Date.now() - startTime,
            queueSizeBefore,
            undefined,
            "database"
          );
        }
      } else if (!settings.mongoEnabled) {
        this.emitState({ localMongo: "idle" });
      }

      // ─── Layer 3: Atlas Cloud ──────────────────────────────────────────────
      const atlasEligible =
        (target === "all" || target === "atlas") &&
        this.atlasConn.connected &&
        settings.atlasEnabled;

      if (atlasEligible) {
        const isOnline = await isInternetAvailable();
        if (!isOnline) {
          atlasSucceeded = false;
          this.emitState({ atlas: "offline" });
          await storageManager.logSyncEvent(
            "sync-failure",
            undefined,
            "atlas",
            "failure",
            "Atlas Cloud sync failed: internet unavailable",
            Date.now() - startTime,
            queueSizeBefore,
            undefined,
            "network"
          );
        } else {
          this.emitState({ atlas: "syncing" });
          try {
            // Version comparison: only upload items where local version > atlasVersion
            const atlasUploads = changedItems.filter(
              (item) => (item.version ?? 1) > (item.atlasVersion ?? 0)
            );

            if (atlasUploads.length > 0) {
              await this.atlasConn.upsertBulk(atlasUploads);
            }
            if (tagDelta) {
              await this.atlasConn.syncTags(localTags);
            }
            if (deleteSnapshot.length > 0) {
              await this.atlasConn.permanentDeleteBulk(deleteSnapshot);
            }

            // Update version metadata locally on success
            if (atlasUploads.length > 0) {
              await storageManager.markAsSyncedToAtlas(atlasUploads);
            }

            const now = new Date().toISOString();
            await storageManager.saveSettings({ lastCloudSyncedAt: now });

            this.emitState({
              atlas: "idle",
              lastCloudSyncedAt: now,
              latestSyncedAt: now,
            });

            await storageManager.logSyncEvent(
              "sync-success",
              undefined,
              "atlas",
              "success",
              `Successfully synced to MongoDB Atlas. Upserted: ${atlasUploads.length}, Deleted: ${deleteSnapshot.length}`,
              Date.now() - startTime,
              queueSizeBefore
            );
          } catch (err) {
            atlasSucceeded = false;
            const errMsg = (err as Error).message;
            console.error("[Sync:atlas] Failed:", errMsg);
            this.emitState({ atlas: "error" });

            await storageManager.logSyncEvent(
              "sync-failure",
              undefined,
              "atlas",
              "failure",
              `Atlas Cloud sync failed: ${errMsg}`,
              Date.now() - startTime,
              queueSizeBefore,
              undefined,
              "database"
            );
          }
        }
      } else if (!settings.atlasEnabled) {
        this.emitState({ atlas: "idle" });
      }

      // ─── Bidirectional Pull & Merge on Force Sync ────────────────────────
      if (force && localSucceeded && atlasSucceeded) {
        const targetConns = [];
        if (target === "all" || target === "local") targetConns.push(this.localConn);
        if (target === "all" || target === "atlas") targetConns.push(this.atlasConn);

        for (const conn of targetConns) {
          if (conn.connected) {
            console.log(`[Sync:${conn === this.localConn ? "local" : "atlas"}] Bidirectional pull/merge...`);
            
            const remoteItems = await conn.fetchAll();
            const localItems = await storageManager.readAll();
            
            const mergedItems = mergeItems(localItems, remoteItems);
            
            if (
              mergedItems.length !== localItems.length ||
              JSON.stringify(mergedItems) !== JSON.stringify(localItems)
            ) {
              await storageManager.mergeItems(mergedItems);
              await conn.upsertBulk(mergedItems);
            }

            const remoteTags = await conn.fetchTags();
            const localTags = await storageManager.getTags();
            
            const tagMap = new Map();
            localTags.forEach((t) => tagMap.set(t.id, t));
            remoteTags.forEach((rt) => {
              const existing = tagMap.get(rt.id);
              if (!existing) {
                tagMap.set(rt.id, rt);
              } else {
                const existingTime = new Date(existing.updatedAt || 0).getTime();
                const remoteTime = new Date(rt.updatedAt || 0).getTime();
                if (remoteTime > existingTime) {
                  tagMap.set(rt.id, rt);
                }
              }
            });
            
            const mergedTags = Array.from(tagMap.values());
            if (
              mergedTags.length !== localTags.length ||
              JSON.stringify(mergedTags) !== JSON.stringify(localTags)
            ) {
              await storageManager.saveTags(mergedTags);
              await conn.syncTags(mergedTags);
            }
          }
        }
      }

      // ─── Clean Up Processed Queue Entries ───────────────────────────────
      // We pull the freshly updated local items to read their updated versions.
      const freshItems = await storageManager.clipsDb.findAsync({
        id: { $in: compressedEntries.map((e) => e.id) },
      });
      const freshMap = new Map(freshItems.map((c) => [c.id, c]));

      for (const entry of compressedEntries) {
        if (entry.operation === "permanent-delete") {
          // If all active connections succeeded or were not eligible, remove deletion entry
          const localDone = !localEligible || localSucceeded;
          const atlasDone = !atlasEligible || atlasSucceeded;
          if (localDone && atlasDone) {
            await storageManager.queueDb.removeAsync(
              { id: entry.id, enqueuedAt: { $lte: entry.enqueuedAt } },
              { multi: true }
            );
          }
        } else {
          const item = freshMap.get(entry.id);
          if (item) {
            // Check if the item has successfully uploaded to all active databases
            const localDone =
              !localEligible || (item.version ?? 1) <= (item.localMongoVersion ?? 0);
            const atlasDone =
              !atlasEligible || (item.version ?? 1) <= (item.atlasVersion ?? 0);
            if (localDone && atlasDone) {
              await storageManager.queueDb.removeAsync(
                { id: entry.id, enqueuedAt: { $lte: entry.enqueuedAt } },
                { multi: true }
              );
            }
          } else {
            // Already deleted locally, clear from queue
            await storageManager.queueDb.removeAsync(
              { id: entry.id, enqueuedAt: { $lte: entry.enqueuedAt } },
              { multi: true }
            );
          }
        }
      }

      if (tagDelta && localSucceeded && atlasSucceeded) {
        this.tagsDirty = false;
      }

      queueSizeAfter = await storageManager.queueDb.countAsync({});
      await storageManager.logSyncEvent(
        "sync-success",
        undefined,
        targetLayer,
        "success",
        `Sync pass finished. Queue size: ${queueSizeBefore} -> ${queueSizeAfter}`,
        Date.now() - startTime,
        queueSizeBefore,
        queueSizeAfter
      );
    } finally {
      if (target === "all" || target === "local") this.isLocalSyncing = false;
      if (target === "all" || target === "atlas") this.isAtlasSyncing = false;
      this.emitState({});
    }

    return this.getState();
  }

  resetLocalSync(): void {
    storageManager.saveSettings({
      lastLocalSyncedAt: null,
      mongoEnabled: false,
    });
    this.emitState({
      localMongo: "idle",
      lastLocalSyncedAt: null,
    });
    console.log("[Sync] Local MongoDB sync reset");
  }

  resetCloudSync(): void {
    storageManager.saveSettings({
      lastCloudSyncedAt: null,
      atlasEnabled: false,
    });
    this.emitState({
      atlas: "idle",
      lastCloudSyncedAt: null,
    });
    console.log("[Sync] Atlas cloud sync reset");
  }

  // ── Background Sync ─────────────────────────────────────────────────────
  startBackgroundSync(): void {
    this.stopBackgroundSync();

    // Background sync runs every 10 minutes (600,000 ms) as per recommendations
    const ms = 10 * 60 * 1000;
    this.syncTimer = setInterval(() => {
      this.runSync(true).catch((err) => {
        console.error("[Sync:background] Pulse failed:", err.message);
      });
    }, ms);
    console.log(`[Sync] Background heartbeat started every 10 minutes`);

    // Run once immediately on start
    this.runSync(true).catch(() => {});

    // Retry queue items on interval (10 minutes) if pending exist
    this.retryTimer = setInterval(() => {
      storageManager.queueDb.countAsync({}).then((count) => {
        if (count > 0 || this.tagsDirty) {
          console.log(`[Sync] Retrying ${count} pending queue items`);
          this.runSync().catch(() => {});
        }
      });
    }, ms);
  }

  stopBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  // ── Full Bootstrap Sync ─────────────────────────────────────────────────
  async bootstrapSync(getAllJSON: () => Promise<ClipboardItem[]>): Promise<void> {
    const localTags = await storageManager.getTags();
    const clips = await getAllJSON();

    if (this.localConn.connected) {
      try {
        await this.localConn.upsertBulk(clips);
        await this.localConn.syncTags(localTags);
        await storageManager.markAsSyncedToLocalMongo(clips);
      } catch (err) {
        console.warn(
          "[Sync:bootstrap] Local Mongo push failed:",
          (err as Error).message,
        );
      }
    }

    if (this.atlasConn.connected) {
      const isOnline = await isInternetAvailable();
      if (isOnline) {
        try {
          await this.atlasConn.upsertBulk(clips);
          await this.atlasConn.syncTags(localTags);
          await storageManager.markAsSyncedToAtlas(clips);
        } catch (err) {
          console.warn(
            "[Sync:bootstrap] Atlas push failed:",
            (err as Error).message,
          );
        }
      }
    }
  }
}

export const syncManager = new SyncManager();
