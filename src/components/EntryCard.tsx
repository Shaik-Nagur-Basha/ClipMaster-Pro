import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClipStore } from '../store/useClipStore'
import TagBadge from './TagBadge'
import type { ClipboardItem } from '../types'

interface Props {
  item: ClipboardItem
  displayMode: 'preview' | 'full'
  viewMode: 'list' | 'grid' | 'compact'
}

const EntryCard: React.FC<Props> = ({ item, displayMode, viewMode }) => {
  const { tags, updateClip, deleteClip, toggleFavorite, copyToClipboard, editingClipId, setEditingClip } = useClipStore()
  const [editText, setEditText] = useState(item.text)
  const [copied, setCopied] = useState(false)

  const isEditing = editingClipId === item.id
  const tagObjects = tags.filter((t) => item.tags.includes(t.id))

  const displayText = displayMode === 'preview' && item.text.length > 120
    ? item.text.slice(0, 120) + '…'
    : item.text

  const timeAgo = useCallback(() => {
    const diff = Date.now() - new Date(item.timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (days > 0) return `${days}d ago`
    if (hrs > 0) return `${hrs}h ago`
    if (mins > 0) return `${mins}m ago`
    return 'just now'
  }, [item.timestamp])

  const handleCopy = async () => {
    await copyToClipboard(item.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSaveEdit = async () => {
    if (editText.trim() && editText !== item.text) {
      await updateClip({ ...item, text: editText.trim() })
    }
    setEditingClip(null)
  }

  const handleCancelEdit = () => {
    setEditText(item.text)
    setEditingClip(null)
  }

  if (viewMode === 'compact') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -8 }}
        className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 border border-white/5 hover:border-white/10 transition-all duration-150"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 truncate font-mono">{item.text.slice(0, 80)}</p>
        </div>
        <span className="text-xs text-white/30 shrink-0">{timeAgo()}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionBtn icon={copied ? '✓' : '⎘'} label="Copy" onClick={handleCopy} active={copied} />
          <ActionBtn icon="♥" label="Favorite" onClick={() => toggleFavorite(item.id)} active={item.isFavorite} />
          <ActionBtn icon="✕" label="Delete" onClick={() => deleteClip(item.id)} danger />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className={`group relative rounded-2xl border border-white/5 hover:border-brand-500/30 bg-surface-700 hover:bg-surface-600 transition-all duration-200 shadow-lg shadow-black/20 ${
        viewMode === 'grid' ? 'flex flex-col h-48' : 'flex flex-col'
      }`}
    >
      {/* Favorite indicator */}
      {item.isFavorite && (
        <div className="absolute top-0 left-0 w-full h-0.5 rounded-t-2xl bg-gradient-to-r from-brand-500 to-accent-500" />
      )}

      <div className="p-4 flex-1 min-h-0 overflow-hidden">
        {isEditing ? (
          <textarea
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-24 bg-surface-900 text-white text-sm rounded-xl p-3 resize-none outline-none border border-brand-500/50 focus:border-brand-500 font-mono leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit()
              if (e.key === 'Escape') handleCancelEdit()
            }}
          />
        ) : (
          <p
            className={`text-white/85 leading-relaxed break-words font-mono ${
              viewMode === 'grid' ? 'text-xs line-clamp-5' : 'text-sm'
            }`}
          >
            {displayText}
          </p>
        )}
      </div>

      {/* Tags row */}
      {tagObjects.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {tagObjects.map((t) => (
            <TagBadge key={t.id} tag={t} size="sm" />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30">{timeAgo()}</span>
          <span className="text-xs text-white/20">
            {item.charCount ?? item.text.length} chars
          </span>
          {item.wordCount && (
            <span className="text-xs text-white/20">{item.wordCount} words</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <ActionBtn icon="✓" label="Save" onClick={handleSaveEdit} active />
              <ActionBtn icon="✕" label="Cancel" onClick={handleCancelEdit} />
            </>
          ) : (
            <AnimatePresence>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <ActionBtn icon={copied ? '✓' : '⎘'} label={copied ? 'Copied!' : 'Copy'} onClick={handleCopy} active={copied} />
                <ActionBtn icon="✏" label="Edit" onClick={() => { setEditText(item.text); setEditingClip(item.id) }} />
                <ActionBtn icon="♥" label="Favorite" onClick={() => toggleFavorite(item.id)} active={item.isFavorite} variant="heart" />
                <ActionBtn icon="🗑" label="Delete" onClick={() => deleteClip(item.id)} danger />
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Action Button ────────────────────────────────────────────────────────
interface ActionBtnProps {
  icon: string
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  variant?: 'heart' | 'default'
}

const ActionBtn: React.FC<ActionBtnProps> = ({ icon, label, onClick, active, danger }) => (
  <button
    title={label}
    onClick={onClick}
    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all duration-150 ${
      danger
        ? 'hover:bg-red-500/20 hover:text-red-400 text-white/40'
        : active
        ? 'bg-brand-500/20 text-brand-400'
        : 'hover:bg-white/10 text-white/40 hover:text-white/80'
    }`}
  >
    {icon}
  </button>
)

export default EntryCard
