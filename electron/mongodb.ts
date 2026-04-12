import mongoose, { Schema, model, Document } from 'mongoose'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import type { ClipboardItem } from '../src/types'

// ─── Encryption Helpers ────────────────────────────────────────────────────
const MACHINE_KEY = scryptSync(
  process.env.CLIPMASTER_SECRET ?? 'clipmaster-default-secret-2026',
  'clipmaster-salt',
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
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = createDecipheriv('aes-256-cbc', MACHINE_KEY, iv)
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final()
    ])
    return decrypted.toString('utf-8')
  } catch {
    return data // Return raw if decryption fails
  }
}

// ─── Mongoose Schema ───────────────────────────────────────────────────────
interface ClipDoc extends Document {
  clipId: string
  textEncrypted: string
  timestamp: string
  tags: string[]
  isFavorite: boolean
  isDeleted: boolean
  deletedAt?: string
  wordCount: number
  charCount: number
  syncedAt: string
}

const ClipSchema = new Schema<ClipDoc>(
  {
    clipId: { type: String, required: true, unique: true, index: true },
    textEncrypted: { type: String, required: true },
    timestamp: { type: String, required: true },
    tags: { type: [String], default: [] },
    isFavorite: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: String },
    wordCount: { type: Number, default: 0 },
    charCount: { type: Number, default: 0 },
    syncedAt: { type: String, default: () => new Date().toISOString() }
  },
  { collection: 'clips' }
)

// Avoid OverwriteModelError on hot reload
const ClipModel = mongoose.models['Clip']
  ? mongoose.model<ClipDoc>('Clip')
  : model<ClipDoc>('Clip', ClipSchema)

// ─── MongoDB Manager ───────────────────────────────────────────────────────
class MongoManager {
  private connected = false
  private connecting = false

  // FIX: Full reconnect support — disconnects first if already connected
  async connect(uri: string): Promise<boolean> {
    // If already connected to same URI, return true
    if (this.connected && mongoose.connection.readyState === 1) {
      const currentUri = (mongoose.connection as unknown as { _connectionString?: string })._connectionString
      if (!currentUri || currentUri === uri) return true
    }

    // Disconnect from any previous connection
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect()
      } catch { /* ignore */ }
    }

    this.connected = false
    this.connecting = true

    // FIX: Detect Atlas (cloud) vs local and set appropriate timeouts
    const isAtlas = uri.includes('mongodb+srv://') || uri.includes('mongodb.net')
    const timeoutMs = isAtlas ? 15000 : 5000

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs,
        socketTimeoutMS: timeoutMs * 2,
        // TLS required for Atlas
        tls: isAtlas,
        // Retries for Atlas
        retryWrites: true,
        w: 'majority'
      })
      this.connected = true
      this.connecting = false
      console.log('[MongoDB] Connected:', uri.replace(/:([^@]+)@/, ':***@'))
      return true
    } catch (err) {
      this.connected = false
      this.connecting = false
      const msg = (err as Error).message
      console.warn('[MongoDB] Connection failed:', msg)
      return false
    }
  }

  isConnected(): boolean {
    return this.connected && mongoose.connection.readyState === 1
  }

  async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
    this.connected = false
    this.connecting = false
  }

  async syncEntry(item: ClipboardItem): Promise<void> {
    if (!this.isConnected()) return

    try {
      await ClipModel.findOneAndUpdate(
        { clipId: item.id },
        {
          clipId: item.id,
          textEncrypted: encrypt(item.text),
          timestamp: item.timestamp,
          tags: item.tags,
          isFavorite: item.isFavorite,
          isDeleted: item.isDeleted,
          deletedAt: item.deletedAt,
          wordCount: item.wordCount ?? 0,
          charCount: item.charCount ?? 0,
          syncedAt: new Date().toISOString()
        },
        { upsert: true, new: true }
      )
    } catch (err) {
      console.error('[MongoDB] Sync entry failed:', (err as Error).message)
    }
  }

  async syncAll(items: ClipboardItem[]): Promise<void> {
    if (!this.isConnected()) return

    const ops = items.map((item) => ({
      updateOne: {
        filter: { clipId: item.id },
        update: {
          $set: {
            clipId: item.id,
            textEncrypted: encrypt(item.text),
            timestamp: item.timestamp,
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

    if (ops.length === 0) return

    try {
      await ClipModel.bulkWrite(ops)
      console.log(`[MongoDB] Synced ${ops.length} clips`)
    } catch (err) {
      console.error('[MongoDB] Bulk sync failed:', (err as Error).message)
    }
  }

  async softDelete(id: string): Promise<void> {
    if (!this.isConnected()) return
    try {
      await ClipModel.updateOne(
        { clipId: id },
        { $set: { isDeleted: true, deletedAt: new Date().toISOString() } }
      )
    } catch { /* silent */ }
  }

  async permanentDelete(id: string): Promise<void> {
    if (!this.isConnected()) return
    try {
      await ClipModel.deleteOne({ clipId: id })
    } catch { /* silent */ }
  }

  async importFromMongo(): Promise<ClipboardItem[]> {
    if (!this.isConnected()) return []
    try {
      const docs = await ClipModel.find({}).sort({ timestamp: -1 }).lean()
      return docs.map((d) => ({
        id:        d.clipId,
        text:      decrypt(d.textEncrypted),
        timestamp: d.timestamp,
        updatedAt: (d as any).updatedAt ?? d.timestamp,   // ← required field
        tags:      d.tags,
        isFavorite: d.isFavorite,
        isDeleted:  d.isDeleted,
        deletedAt:  d.deletedAt,
        wordCount:  d.wordCount,
        charCount:  d.charCount
      }))
    } catch {
      return []
    }
  }
}

export const mongoManager = new MongoManager()
