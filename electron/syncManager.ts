/**
 * SyncManager — Multi-layer data sync orchestrator
 *
 * Architecture (strict priority):
 *   Layer 1: JSON   — primary source of truth (ALWAYS written first)
 *   Layer 2: Local MongoDB  — secondary  (if running locally)
 *   Layer 3: MongoDB Atlas  — tertiary   (if URL configured + internet)
 *
 * Design principles:
 *   • Offline-first: JSON never blocked by network
 *   • Conflict resolution: updatedAt (latest wins)
 *   • Failure isolation: each layer fails independently
 *   • Queue: failed items retried when layer comes back online
 *   • Batching: writes are debounced + bulk-executed
 *   • No secret leakage: Atlas URI never logged in plaintext
 */

import { net } from 'electron'
import mongoose, { Schema, model, Document, Model } from 'mongoose'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import type { ClipboardItem, SyncState, SyncQueueEntry } from '../src/types'

// ─── Encryption ────────────────────────────────────────────────────────────
const MACHINE_KEY = scryptSync(
  process.env.CLIPMASTER_SECRET ?? 'clipmaster-default-secret-2026',
  'clipmaster-salt-v2',
  32
)

function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', MACHINE_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(data: string): string {
  try {
    const [ivHex, encHex] = data.split(':')
    if (!ivHex || !encHex) return data
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = createDecipheriv('aes-256-cbc', MACHINE_KEY, iv)
    return Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final()
    ]).toString('utf-8')
  } catch {
    return data
  }
}

function maskUri(uri: string): string {
  return uri.replace(/:([^@]+)@/, ':***@').replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')
}

// ─── Mongoose Schema (shared for both connections) ─────────────────────────
interface ClipDoc extends Document {
  clipId: string
  textEncrypted: string
  timestamp: string
  updatedAt: string
  tags: string[]
  isFavorite: boolean
  isDeleted: boolean
  deletedAt?: string
  wordCount: number
  charCount: number
  syncedAt: string
}

const clipSchemaDefinition = {
  clipId:        { type: String, required: true, unique: true, index: true },
  textEncrypted: { type: String, required: true },
  timestamp:     { type: String, required: true },
  updatedAt:     { type: String, required: true, default: () => new Date().toISOString() },
  tags:          { type: [String], default: [] },
  isFavorite:    { type: Boolean, default: false },
  isDeleted:     { type: Boolean, default: false },
  deletedAt:     { type: String },
  wordCount:     { type: Number, default: 0 },
  charCount:     { type: Number, default: 0 },
  syncedAt:      { type: String, default: () => new Date().toISOString() }
}

// ─── Mongoose Connection Factory ───────────────────────────────────────────
// We use SEPARATE Mongoose connections so local + Atlas can run simultaneously.
class MongoConnection {
  private conn: mongoose.Connection | null = null
  private ClipModel: Model<ClipDoc> | null = null
  private _connected = false
  private _label: string

  constructor(label: string) {
    this._label = label
  }

  async connect(uri: string, isAtlas: boolean): Promise<boolean> {
    // Disconnect existing
    if (this.conn) {
      try { await this.conn.close() } catch { /* ignore */ }
      this.conn = null
      this.ClipModel = null
      this._connected = false
    }

    const timeoutMs = isAtlas ? 15000 : 5000

    try {
      this.conn = await mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs,
        socketTimeoutMS: timeoutMs * 2,
        tls: isAtlas,
        retryWrites: true,
        w: 'majority'
      }).asPromise()

      // Create model on this specific connection
      const schema = new Schema<ClipDoc>(clipSchemaDefinition, { collection: 'clips' })
      this.ClipModel = this.conn.model<ClipDoc>('Clip', schema)

      this._connected = true
      console.log(`[Sync:${this._label}] Connected to ${maskUri(uri)}`)
      return true
    } catch (err) {
      this._connected = false
      console.warn(`[Sync:${this._label}] Connection failed:`, (err as Error).message)
      return false
    }
  }

  get connected(): boolean {
    return this._connected && this.conn?.readyState === 1
  }

  get model(): Model<ClipDoc> | null {
    return this.ClipModel
  }

  async disconnect(): Promise<void> {
    if (this.conn) {
      try { await this.conn.close() } catch { /* ignore */ }
      this.conn = null
    }
    this._connected = false
  }

  async upsertBulk(items: ClipboardItem[]): Promise<void> {
    if (!this.connected || !this.ClipModel || items.length === 0) return
    const ops = items.map(item => ({
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
            syncedAt: new Date().toISOString()
          }
        },
        upsert: true
      }
    }))
    await this.ClipModel.bulkWrite(ops, { ordered: false })
    console.log(`[Sync:${this._label}] Bulk upserted ${items.length} items`)
  }

  async fetchAll(): Promise<ClipboardItem[]> {
    if (!this.connected || !this.ClipModel) return []
    const docs = await this.ClipModel.find({}).lean()
    return docs.map(d => ({
      id: d.clipId,
      text: decrypt(d.textEncrypted),
      timestamp: d.timestamp,
      updatedAt: d.updatedAt ?? d.timestamp,
      tags: d.tags,
      isFavorite: d.isFavorite,
      isDeleted: d.isDeleted,
      deletedAt: d.deletedAt,
      wordCount: d.wordCount,
      charCount: d.charCount
    }))
  }

  async permanentDelete(id: string): Promise<void> {
    if (!this.connected || !this.ClipModel) return
    await this.ClipModel.deleteOne({ clipId: id })
  }
}

// ─── Conflict Resolution ───────────────────────────────────────────────────
/**
 * Merges two lists of clipboard items using updatedAt (latest wins).
 * Returns a merged list with no duplicates.
 */
export function mergeItems(primary: ClipboardItem[], secondary: ClipboardItem[]): ClipboardItem[] {
  const map = new Map<string, ClipboardItem>()

  for (const item of primary) {
    map.set(item.id, item)
  }

  for (const item of secondary) {
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
    } else {
      const existingTime = new Date(existing.updatedAt ?? existing.timestamp).getTime()
      const incomingTime = new Date(item.updatedAt ?? item.timestamp).getTime()
      if (incomingTime > existingTime) {
        map.set(item.id, item)  // remote wins if newer
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

// ─── Internet Detection ────────────────────────────────────────────────────
async function isInternetAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      // Use Electron's net module for accurate detection (not navigator.onLine)
      const req = net.request({ method: 'HEAD', url: 'https://1.1.1.1' })
      req.on('response', () => resolve(true))
      req.on('error', () => resolve(false))
      setTimeout(() => resolve(false), 3000)
      req.end()
    } catch {
      resolve(false)
    }
  })
}

// ─── Sync Manager ──────────────────────────────────────────────────────────
class SyncManager {
  private localConn = new MongoConnection('local')
  private atlasConn = new MongoConnection('atlas')

  private syncQueue: Map<string, SyncQueueEntry> = new Map()  // keyed by item.id
  private deleteQueue: Set<string> = new Set()                 // IDs for permanent delete
  private syncTimer: NodeJS.Timeout | null = null
  private retryTimer: NodeJS.Timeout | null = null
  private isSyncing = false

  private state: SyncState = {
    localMongo: 'idle',
    atlas: 'idle',
    lastSyncedAt: null,
    pendingCount: 0
  }

  private stateListeners: Array<(s: SyncState) => void> = []

  // ── State Broadcasting ──────────────────────────────────────────────────
  private emitState(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch, pendingCount: this.syncQueue.size + this.deleteQueue.size }
    this.stateListeners.forEach(fn => fn({ ...this.state }))
  }

  onStateChange(fn: (s: SyncState) => void): () => void {
    this.stateListeners.push(fn)
    return () => { this.stateListeners = this.stateListeners.filter(f => f !== fn) }
  }

  getState(): SyncState {
    return { ...this.state, pendingCount: this.syncQueue.size + this.deleteQueue.size }
  }

  // ── Connection Management ───────────────────────────────────────────────
  async connectLocal(uri: string): Promise<boolean> {
    this.emitState({ localMongo: 'syncing' })
    const ok = await this.localConn.connect(uri, false)
    this.emitState({ localMongo: ok ? 'idle' : 'error' })
    return ok
  }

  async connectAtlas(uri: string): Promise<boolean> {
    const isAtlas = uri.includes('mongodb+srv://') || uri.includes('mongodb.net')
    this.emitState({ atlas: 'syncing' })
    const ok = await this.atlasConn.connect(uri, isAtlas)
    this.emitState({ atlas: ok ? 'idle' : 'error' })
    return ok
  }

  isLocalConnected(): boolean { return this.localConn.connected }
  isAtlasConnected(): boolean { return this.atlasConn.connected }

  // ── Queue Management ────────────────────────────────────────────────────
  /**
   * Enqueue an item for sync to all available layers.
   * Called immediately after every JSON write — non-blocking.
   */
  enqueue(item: ClipboardItem, operation: SyncQueueEntry['operation'] = 'upsert'): void {
    if (operation === 'permanent-delete') {
      this.deleteQueue.add(item.id)
      this.syncQueue.delete(item.id)
    } else {
      // Latest write always wins in the queue (overwrite older entry)
      this.syncQueue.set(item.id, {
        item,
        operation,
        enqueuedAt: new Date().toISOString(),
        retries: 0
      })
    }
    this.emitState({})  // update pendingCount
  }

  // ── Core Sync Flow ──────────────────────────────────────────────────────
  /**
   * Run one complete sync cycle:
   *   1. Drain queue to Local MongoDB (if connected)
   *   2. Drain queue to Atlas (if connected + internet)
   *   3. Two-way merge from Atlas → JSON (conflict resolution)
   */
  async runSync(getAllJSON: () => ClipboardItem[], mergeIntoJSON: (items: ClipboardItem[]) => Promise<void>): Promise<SyncState> {
    if (this.isSyncing) return this.getState()
    this.isSyncing = true

    const queueSnapshot = new Map(this.syncQueue)
    const deleteSnapshot = new Set(this.deleteQueue)
    const upsertItems = Array.from(queueSnapshot.values())
      .filter(e => e.operation !== 'permanent-delete')
      .map(e => e.item)
    const deleteIds = Array.from(deleteSnapshot)

    // ── Layer 2: Local MongoDB ────────────────────────────────────────────
    if (this.localConn.connected) {
      this.emitState({ localMongo: 'syncing' })
      try {
        if (upsertItems.length > 0) {
          await this.localConn.upsertBulk(upsertItems)
        }
        for (const id of deleteIds) {
          await this.localConn.permanentDelete(id)
        }
        // Clear from queue on success
        queueSnapshot.forEach((_, id) => this.syncQueue.delete(id))
        deleteSnapshot.forEach(id => this.deleteQueue.delete(id))
        this.emitState({ localMongo: 'idle' })
      } catch (err) {
        console.error('[Sync:local] Failed:', (err as Error).message)
        this.emitState({ localMongo: 'error' })
        // Increment retry counter — don't clear queue
        upsertItems.forEach(item => {
          const entry = this.syncQueue.get(item.id)
          if (entry) entry.retries++
        })
      }
    }

    // ── Layer 3: Atlas ────────────────────────────────────────────────────
    if (this.atlasConn.connected) {
      const online = await isInternetAvailable()
      if (!online) {
        this.emitState({ atlas: 'offline' })
      } else {
        this.emitState({ atlas: 'syncing' })
        try {
          // Step A: Push local changes to Atlas
          const currentJSON = getAllJSON()
          if (currentJSON.length > 0 || upsertItems.length > 0) {
            const toPush = upsertItems.length > 0 ? upsertItems : currentJSON
            await this.atlasConn.upsertBulk(toPush)
          }
          for (const id of deleteIds) {
            await this.atlasConn.permanentDelete(id)
          }

          // Step B: Pull from Atlas, merge into JSON (two-way sync)
          const remoteItems = await this.atlasConn.fetchAll()
          if (remoteItems.length > 0) {
            const localItems = getAllJSON()
            const merged = mergeItems(localItems, remoteItems)
            // Only write back if there are actual differences
            const localIds = new Set(localItems.map(i => i.id))
            const hasNew = remoteItems.some(r => !localIds.has(r.id))
            const hasNewer = remoteItems.some(r => {
              const local = localItems.find(l => l.id === r.id)
              if (!local) return false
              return new Date(r.updatedAt ?? r.timestamp).getTime() >
                     new Date(local.updatedAt ?? local.timestamp).getTime()
            })
            if (hasNew || hasNewer) {
              await mergeIntoJSON(merged)
              console.log(`[Sync:atlas] Merged ${merged.length} items (${remoteItems.length} remote)`)
            }
          }

          this.emitState({ atlas: 'idle', lastSyncedAt: new Date().toISOString() })
        } catch (err) {
          console.error('[Sync:atlas] Failed:', (err as Error).message)
          this.emitState({ atlas: 'error' })
        }
      }
    }

    this.isSyncing = false
    return this.getState()
  }

  // ── Background Sync ─────────────────────────────────────────────────────
  startBackgroundSync(
    intervalSeconds: number,
    getAllJSON: () => ClipboardItem[],
    mergeIntoJSON: (items: ClipboardItem[]) => Promise<void>
  ): void {
    this.stopBackgroundSync()
    const ms = Math.max(intervalSeconds, 10) * 1000  // minimum 10s
    this.syncTimer = setInterval(() => {
      this.runSync(getAllJSON, mergeIntoJSON).catch(() => {})
    }, ms)
    console.log(`[Sync] Background sync started every ${intervalSeconds}s`)

    // Retry failed queue items every 60s
    this.retryTimer = setInterval(() => {
      if (this.syncQueue.size > 0 || this.deleteQueue.size > 0) {
        console.log(`[Sync] Retrying ${this.syncQueue.size} queued items`)
        this.runSync(getAllJSON, mergeIntoJSON).catch(() => {})
      }
    }, 60_000)
  }

  stopBackgroundSync(): void {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null }
    if (this.retryTimer) { clearInterval(this.retryTimer); this.retryTimer = null }
  }

  // ── Full Bootstrap Sync ─────────────────────────────────────────────────
  /**
   * Run on app start: sync everything from all available layers into JSON.
   */
  async bootstrapSync(
    getAllJSON: () => ClipboardItem[],
    mergeIntoJSON: (items: ClipboardItem[]) => Promise<void>
  ): Promise<void> {
    const localItems = getAllJSON()    

    // Pull from Local MongoDB if available
    if (this.localConn.connected) {
      try {
        const mongoItems = await this.localConn.fetchAll()
        if (mongoItems.length > 0) {
          const merged = mergeItems(localItems, mongoItems)
          if (merged.length !== localItems.length) {
            await mergeIntoJSON(merged)
            console.log(`[Sync:bootstrap] Merged ${mongoItems.length} items from local Mongo`)
          }
        }
      } catch (err) {
        console.warn('[Sync:bootstrap] Local Mongo pull failed:', (err as Error).message)
      }
    }

    // Pull from Atlas if available + internet
    if (this.atlasConn.connected) {
      const online = await isInternetAvailable()
      if (online) {
        try {
          const atlasItems = await this.atlasConn.fetchAll()
          if (atlasItems.length > 0) {
            const current = getAllJSON()
            const merged = mergeItems(current, atlasItems)
            await mergeIntoJSON(merged)
            console.log(`[Sync:bootstrap] Merged ${atlasItems.length} items from Atlas`)
          }
          // Push entire JSON to Atlas (ensures Atlas is up to date too)
          await this.atlasConn.upsertBulk(getAllJSON())
        } catch (err) {
          console.warn('[Sync:bootstrap] Atlas pull failed:', (err as Error).message)
        }
      }
    }
  }
}

export const syncManager = new SyncManager()
