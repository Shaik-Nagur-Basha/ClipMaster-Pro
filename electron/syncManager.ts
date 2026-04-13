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
import { storageManager } from './storage'
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

const tagSchemaDefinition = {
  tagId: { type: String, required: true, unique: true, index: true },
  name:  { type: String, required: true },
  color: { type: String, required: true },
  syncedAt: { type: String, default: () => new Date().toISOString() }
}

// ─── Mongoose Connection Factory ───────────────────────────────────────────
// We use SEPARATE Mongoose connections so local + Atlas can run simultaneously.
class MongoConnection {
  private conn: mongoose.Connection | null = null
  private ClipModel: Model<ClipDoc> | null = null
  private TagModel: Model<any> | null = null
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

      // Create models on this specific connection
      const clipSchema = new Schema<ClipDoc>(clipSchemaDefinition, { collection: 'clips' })
      this.ClipModel = this.conn.model<ClipDoc>('Clip', clipSchema)

      const tagSchema = new Schema(tagSchemaDefinition, { collection: 'tags' })
      this.TagModel = this.conn.model('Tag', tagSchema)

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

  async getServerTime(): Promise<string | null> {
    if (!this.conn || !this.connected) return null
    try {
      if (!this.conn || !this.conn.db) return null
      // retrieves server's current time using basic db command (permits non-admins)
      const result = await (this.conn.db as any).command({ hello: 1 })
      return result.localTime ? new Date(result.localTime).toISOString() : null
    } catch {
      return null
    }
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

  async syncTags(tags: any[]): Promise<void> {
    if (!this.connected || !this.TagModel || tags.length === 0) return
    const ops = tags.map(tag => ({
      updateOne: {
        filter: { tagId: tag.id },
        update: {
          $set: {
            tagId: tag.id,
            name: tag.name,
            color: tag.color,
            syncedAt: new Date().toISOString()
          }
        },
        upsert: true
      }
    }))
    await this.TagModel.bulkWrite(ops, { ordered: false })
  }

  async fetchTags(): Promise<any[]> {
    if (!this.connected || !this.TagModel) return []
    const docs = await this.TagModel.find({}).lean()
    return docs.map((d: any) => ({
      id: d.tagId,
      name: d.name,
      color: d.color
    }))
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
  private isLocalSyncing = false
  private isAtlasSyncing = false

  private state: SyncState = {
    localMongo: 'idle',
    atlas: 'idle',
    lastLocalSyncedAt: null,
    lastCloudSyncedAt: null,
    latestSyncedAt: null,
  }

  private stateListeners: Array<(s: SyncState) => void> = []

  // ── State Broadcasting ──────────────────────────────────────────────────
  initSyncState(state: Partial<SyncState>): void {
    this.state = { ...this.state, ...state }
  }

  private emitState(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch }
    this.stateListeners.forEach(fn => fn({ ...this.state }))
  }

  onStateChange(fn: (s: SyncState) => void): () => void {
    this.stateListeners.push(fn)
    return () => { this.stateListeners = this.stateListeners.filter(f => f !== fn) }
  }

  getState(): SyncState {
    return { ...this.state }
  }

  // ── Connection Management ───────────────────────────────────────────────
  async connectLocal(uri: string | null): Promise<boolean> {
    const finalUri = uri || 'mongodb://127.0.0.1:27017/clipmaster'
    this.emitState({ localMongo: 'syncing' })
    const ok = await this.localConn.connect(finalUri, false)
    this.emitState({ 
      localMongo: ok ? 'idle' : 'error'
    })
    return ok
  }

  async disconnectLocal(): Promise<void> {
    await this.localConn.disconnect()
    this.emitState({ 
      localMongo: 'idle', 
      lastLocalSyncedAt: null,
      latestSyncedAt: this.state.lastCloudSyncedAt // fallback to cloud sync if local wiped
    })
  }

  async disconnectAtlas(): Promise<void> {
    await this.atlasConn.disconnect()
    this.emitState({ 
      atlas: 'idle', 
      lastCloudSyncedAt: null,
      latestSyncedAt: this.state.lastLocalSyncedAt // fallback to local sync if cloud wiped
    })
  }

  async autoDetectLocalMongo(getAllJSON: () => ClipboardItem[]): Promise<void> {
    const settings = storageManager.getSettings()
    // Requirement 3: Try connect to default mongo on first app launch
    if (settings.lastLocalSyncedAt === null) {
      console.log('[Sync] First launch detected, attempting local Mongo connection...')
      const ok = await this.connectLocal(null)
      if (ok) {
        await storageManager.saveSettings({ 
          mongoEnabled: true, 
          mongoUri: 'mongodb://127.0.0.1:27017/clipmaster',
          lastLocalSyncedAt: new Date().toISOString()
        })
        await this.runSync(getAllJSON, async (items) => {
          await storageManager.mergeItems(items)
        })
      }
    }
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
   *   1. Determine latest clip timestamp
   *   2. Sync to Local MongoDB (if enabled + condition met)
   *   3. Sync to Atlas (if enabled + condition met + internet)
   */
  async runSync(
    getAllJSON: () => ClipboardItem[], 
    mergeIntoJSON: (items: ClipboardItem[]) => Promise<void>, 
    force: boolean = false,
    target: 'local' | 'atlas' | 'all' = 'all'
  ): Promise<SyncState> {
    const alreadyLocal = (target === 'all' || target === 'local') && this.isLocalSyncing
    const alreadyAtlas = (target === 'all' || target === 'atlas') && this.isAtlasSyncing
    
    // If targeted layer is already busy, we return to avoid overlapping the SAME layer.
    // However, if we only target local, and atlas is busy, it's OK to proceed with local!
    if (target === 'local' && alreadyLocal) return this.getState()
    if (target === 'atlas' && alreadyAtlas) return this.getState()
    if (target === 'all' && (alreadyLocal || alreadyAtlas)) return this.getState()

    if (target === 'all' || target === 'local') this.isLocalSyncing = true
    if (target === 'all' || target === 'atlas') this.isAtlasSyncing = true

    try {
      const settings = storageManager.getSettings()
      const localItems = getAllJSON()
      const localTags = storageManager.getTags()
      
      const latestClipTimestamp = localItems.length > 0 
        ? Math.max(...localItems.map(i => new Date(i.updatedAt || i.timestamp).getTime()))
        : 0

      // ─── Layer 2: Local MongoDB ────────────────────────────────────────────
      const shouldLocal = target === 'all' || target === 'local'
      if (shouldLocal && this.localConn.connected && settings.mongoEnabled) {
        const lastLocal = settings.lastLocalSyncedAt ? new Date(settings.lastLocalSyncedAt).getTime() : 0
        const isOutdated = lastLocal < latestClipTimestamp
        
        if (isOutdated || force || this.syncQueue.size > 0 || this.deleteQueue.size > 0) {
          this.emitState({ localMongo: 'syncing' })
          try {
            await this.localConn.upsertBulk(localItems)
            await this.localConn.syncTags(localTags)
            for (const id of Array.from(this.deleteQueue)) await this.localConn.permanentDelete(id)
            
            const now = new Date().toISOString()
            
            // Persist to JSON file
            storageManager.saveSettings({ lastLocalSyncedAt: now })

            this.emitState({ 
              localMongo: 'idle', 
              lastLocalSyncedAt: now,
              latestSyncedAt: now
            })
          } catch (err) {
            console.error('[Sync:local] Failed:', (err as Error).message)
            this.emitState({ localMongo: 'error' })
          }
        } else {
          this.emitState({ localMongo: 'idle' })
        }
      } else if (!settings.mongoEnabled) {
        this.emitState({ localMongo: 'idle' })
      }

      // ─── Layer 3: Atlas Cloud ──────────────────────────────────────────────
      const shouldAtlas = target === 'all' || target === 'atlas'
      
      if (shouldAtlas && this.atlasConn.connected && settings.atlasEnabled) {
        const isOnline = await isInternetAvailable()
        if (!isOnline) {
          this.emitState({ atlas: 'offline' })
        } else {
          const lastCloud = settings.lastCloudSyncedAt ? new Date(settings.lastCloudSyncedAt).getTime() : 0
          const isOutdated = lastCloud < latestClipTimestamp
          
          if (isOutdated || force || this.syncQueue.size > 0 || this.deleteQueue.size > 0) {
            this.emitState({ atlas: 'syncing' })
            try {
              // 1. Push
              await this.atlasConn.upsertBulk(localItems)
              await this.atlasConn.syncTags(localTags)
              
              // Process deletions for Atlas
              for (const id of Array.from(this.deleteQueue)) {
                await this.atlasConn.permanentDelete(id)
              }
              
              // 2. Pull & Merge
              const remoteItems = await this.atlasConn.fetchAll()
              const remoteTags = await this.atlasConn.fetchTags()

              if (remoteItems.length > 0) {
                const merged = mergeItems(localItems, remoteItems)
                await mergeIntoJSON(merged)
              }
              if (remoteTags.length > 0) {
                // Simplistic tag merge: Atlas wins for simplicity in this scope
                await storageManager.saveTags(remoteTags)
              }

              const now = new Date().toISOString()
              
              // Persist to JSON file
              storageManager.saveSettings({ lastCloudSyncedAt: now })

              this.emitState({ 
                atlas: 'idle', 
                lastCloudSyncedAt: now,
                latestSyncedAt: now
              })
            } catch (err) {
              console.error('[Sync:atlas] Failed:', (err as Error).message)
              this.emitState({ atlas: 'error' })
            }
          } else {
            this.emitState({ atlas: 'idle' })
          }
        }
      } else if (!settings.atlasEnabled) {
        this.emitState({ atlas: 'idle' })
      }

      // ─── Finalize Queues ──────────────────────────────────────────────────
      // Only clear the shared queues if ALL active layers succeeded.
      // If we only targeted 'local', we cannot clear yet because 'atlas' might still need that data.
      const atlasMet = !settings.atlasEnabled || (this.atlasConn.connected && this.state.atlas === 'idle')
      const localMet = !settings.mongoEnabled || (this.localConn.connected && this.state.localMongo === 'idle')
      
      if (localMet && atlasMet) {
        this.syncQueue.clear()
        this.deleteQueue.clear()
      }

    } finally {
      if (target === 'all' || target === 'local') this.isLocalSyncing = false
      if (target === 'all' || target === 'atlas') this.isAtlasSyncing = false
      this.emitState({})
    }

    return this.getState()
  }

  resetLocalSync(): void {
    storageManager.saveSettings({ 
      lastLocalSyncedAt: null,
      mongoEnabled: false
    })
    this.emitState({ 
      localMongo: 'idle',
      lastLocalSyncedAt: null 
    })
    console.log('[Sync] Local MongoDB sync reset')
  }

  resetCloudSync(): void {
    storageManager.saveSettings({ 
      lastCloudSyncedAt: null,
      atlasEnabled: false
    })
    this.emitState({ 
      atlas: 'idle',
      lastCloudSyncedAt: null 
    })
    console.log('[Sync] Atlas cloud sync reset')
  }

  // ── Background Sync ─────────────────────────────────────────────────────
  startBackgroundSync(
    getAllJSON: () => ClipboardItem[],
    mergeIntoJSON: (items: ClipboardItem[]) => Promise<void>
  ): void {
    this.stopBackgroundSync()
    const ms = 30 * 1000 // Hardcoded 30s as per requirement
    this.syncTimer = setInterval(() => {
      this.runSync(getAllJSON, mergeIntoJSON).catch(err => {
        console.error('[Sync:background] Pulse failed:', err.message)
      })
    }, ms)
    console.log(`[Sync] Background heartbeat started every 30s`)

    // IMPORTANT: Run immediately on start (no 30s delay)
    this.runSync(getAllJSON, mergeIntoJSON).catch(() => {})

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
    const localTags = storageManager.getTags()

    // Pull from Local MongoDB if available
    if (this.localConn.connected) {
      try {
        const mongoItems = await this.localConn.fetchAll()
        const mongoTags = await this.localConn.fetchTags()

        if (mongoItems.length > 0) {
          const merged = mergeItems(localItems, mongoItems)
          await mergeIntoJSON(merged)
        }
        if (mongoTags.length > 0) {
          await storageManager.saveTags(mongoTags)
        }
        
        // Ensure Local is up to date too
        await this.localConn.upsertBulk(getAllJSON())
        await this.localConn.syncTags(storageManager.getTags())

      } catch (err) {
        console.warn('[Sync:bootstrap] Local Mongo pull failed:', (err as Error).message)
      }
    }

    // Pull from Atlas if available + internet
    if (this.atlasConn.connected) {
      const isOnline = await isInternetAvailable()
      if (isOnline) {
        try {
          const atlasItems = await this.atlasConn.fetchAll()
          const atlasTags = await this.atlasConn.fetchTags()

          if (atlasItems.length > 0) {
            const current = getAllJSON()
            const merged = mergeItems(current, atlasItems)
            await mergeIntoJSON(merged)
          }
          if (atlasTags.length > 0) {
            await storageManager.saveTags(atlasTags)
          }

          // Push entire updated state to Atlas
          await this.atlasConn.upsertBulk(getAllJSON())
          await this.atlasConn.syncTags(storageManager.getTags())
          
        } catch (err) {
          console.warn('[Sync:bootstrap] Atlas pull failed:', (err as Error).message)
        }
      }
    }
  }
}


export const syncManager = new SyncManager()
