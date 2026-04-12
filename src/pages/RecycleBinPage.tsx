import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClipStore } from '../store/useClipStore'
import type { ClipboardItem } from '../types'

const RecycleBinPage: React.FC = () => {
  const clips         = useClipStore((s) => s.clips)
  const restoreClip   = useClipStore((s) => s.restoreClip)
  const permanentDelete = useClipStore((s) => s.permanentDelete)
  const loadClips     = useClipStore((s) => s.loadClips)

  // Local loading flag — independent of the shared isLoading (which loadClips sets)
  const [loading, setLoading] = useState(true)
  const [emptying, setEmptying] = useState(false)

  // Always reload from disk when this page mounts
  useEffect(() => {
    setLoading(true)
    loadClips().finally(() => setLoading(false))
  }, []) // eslint-disable-line

  // Derive deleted clips fresh from store (reactive to restores/permanent deletes)
  const deleted = clips
    .filter((c) => c.isDeleted === true)
    .sort((a, b) =>
      new Date(b.deletedAt ?? b.timestamp).getTime() -
      new Date(a.deletedAt ?? a.timestamp).getTime()
    )

  const handleEmptyBin = async () => {
    if (!window.confirm('Permanently delete ALL items in the bin? This cannot be undone.')) return
    setEmptying(true)
    for (const item of deleted) await permanentDelete(item.id)
    setEmptying(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🗑️</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>Recycle Bin</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              {loading
                ? 'Loading…'
                : deleted.length === 0
                  ? 'Empty'
                  : `${deleted.length} deleted clip${deleted.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {!loading && deleted.length > 0 && (
          <button
            onClick={handleEmptyBin}
            disabled={emptying}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 10, cursor: emptying ? 'not-allowed' : 'pointer',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', fontSize: 12, fontWeight: 500, opacity: emptying ? 0.5 : 1
            }}
          >
            {emptying ? '⏳ Clearing…' : '🗑️ Empty Bin'}
          </button>
        )}
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <SkeletonList />
        ) : deleted.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AnimatePresence initial={false}>
              {deleted.map((item) => (
                <ClipCard
                  key={item.id}
                  item={item}
                  onRestore={restoreClip}
                  onDelete={permanentDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
const ClipCard: React.FC<{
  item: ClipboardItem
  onRestore: (id: string) => void
  onDelete:  (id: string) => void
}> = ({ item, onRestore, onDelete }) => {
  const [hov, setHov] = useState(false)

  const timeAgo = (ts: string): string => {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60_000)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ago`
    if (h > 0) return `${h}h ago`
    if (m > 0) return `${m}m ago`
    return 'just now'
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 16px', borderRadius: 14,
        background: hov ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
        transition: 'background 120ms, border-color 120ms'
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0, marginTop: 2,
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
      }}>🗑️</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, lineHeight: 1.55,
          color: 'rgba(255,255,255,0.75)',
          fontFamily: 'ui-monospace, Consolas, monospace',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          {item.text}
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            Deleted {timeAgo(item.deletedAt ?? item.timestamp)}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
            {(item.charCount ?? item.text.length).toLocaleString()} chars
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <button
          onClick={() => onRestore(item.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
            color: '#4ade80', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
          }}
        >↩ Restore</button>
        <button
          onClick={() => onDelete(item.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
            color: '#f87171', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
          }}
        >✕ Delete forever</button>
      </div>
    </motion.div>
  )
}

/* ── Empty ────────────────────────────────────────────────────────────────── */
const EmptyState: React.FC = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: 340, gap: 18, textAlign: 'center'
  }}>
    <div style={{
      width: 72, height: 72, borderRadius: 18, fontSize: 32,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>🗑️</div>
    <div style={{ maxWidth: 280 }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
        Recycle bin is empty
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.65 }}>
        Clips deleted from <span style={{ color: '#818cf8' }}>All Clips</span> appear here.
        Restore them or delete them forever.
      </p>
    </div>
  </div>
)

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
const SkeletonList: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {[1, 0.75, 0.5, 0.3].map((op, i) => (
      <div key={i} className="animate-pulse" style={{
        height: 82, borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.05)', opacity: op
      }} />
    ))}
  </div>
)

export default RecycleBinPage
