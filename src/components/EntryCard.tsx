import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClipStore } from '../store/useClipStore'
import TagBadge from './TagBadge'
import type { ClipboardItem } from '../types'
import { 
  IconCopy, 
  IconStar, 
  IconTag, 
  IconEdit, 
  IconTrash, 
  IconRestore, 
  IconX, 
  IconCheck,
  IconZap
} from './Icons'

interface Props {
  item: ClipboardItem
  displayMode: 'preview' | 'full'
  viewMode: 'list' | 'grid' | 'compact'
}

const EntryCard: React.FC<Props> = ({ item, displayMode, viewMode }) => {
  const { 
    tags, 
    updateClip, 
    deleteClip, 
    toggleFavorite, 
    copyToClipboard, 
    editingClipId, 
    setEditingClip,
    toggleTagOnClip,
    restoreClip,
    permanentDelete
  } = useClipStore()
  const [editText, setEditText] = useState(item.text)
  const [copied, setCopied] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)

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
        className="group flex items-center gap-3 px-3 py-1.5 rounded-md bg-surface-800 hover:bg-surface-700 border border-gray-700/50 hover:border-gray-600 transition-all duration-150"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-gray-300 truncate font-mono">{item.text.slice(0, 80)}</p>
        </div>
        <span className="text-[11px] text-gray-500 shrink-0 tabular-nums">{timeAgo()}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionBtn icon={copied ? IconCheck : IconCopy} label="Copy" onClick={handleCopy} active={copied} />
          {item.isDeleted ? (
            <>
              <ActionBtn icon={IconRestore} label="Restore" onClick={() => restoreClip(item.id)} />
              <ActionBtn icon={IconX} label="Delete Forever" onClick={() => permanentDelete(item.id)} danger />
            </>
          ) : (
            <>
              <ActionBtn icon={IconStar} label="Favorite" onClick={() => toggleFavorite(item.id)} active={item.isFavorite} />
              <ActionBtn icon={IconTrash} label="Delete" onClick={() => deleteClip(item.id)} danger />
            </>
          )}
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
      transition={{ duration: 0.15 }}
      className={`group relative rounded-xl border ${
        item.isFavorite ? 'border-accent-500/30' : 'border-gray-700'
      } hover:border-brand-500/40 bg-surface-800 hover:bg-surface-700/80 transition-all duration-150 shadow-sm ${
        viewMode === 'grid' ? 'flex flex-col h-44' : 'flex flex-col'
      } ${showTagPicker ? 'z-30' : 'z-0'}`}
    >
      {/* Visual Indicator for favorites */}
      {item.isFavorite && (
        <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-accent-500/50" />
      )}

      <div className="p-3 flex-1 min-h-0 overflow-hidden">
        {isEditing ? (
          <textarea
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-full min-h-[100px] bg-surface-900 text-gray-100 text-[13px] rounded-lg p-2.5 resize-none outline-none border border-brand-500/40 focus:border-brand-500 font-mono leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit()
              if (e.key === 'Escape') handleCancelEdit()
            }}
          />
        ) : (
          <p
            className={`text-gray-200/90 leading-relaxed break-words font-mono ${
              viewMode === 'grid' ? 'text-[11px] line-clamp-4' : 'text-[13px]'
            }`}
          >
            {displayText}
          </p>
        )}
      </div>

      {/* Tags row */}
      {tagObjects.length > 0 && (
        <div className="px-3 pb-1.5 flex flex-wrap gap-1">
          {tagObjects.map((t) => (
            <TagBadge key={t.id} tag={t} size="sm" />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-700/50">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-gray-500 font-medium tabular-nums">{timeAgo()}</span>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-600 font-bold uppercase tracking-wider">
            <span>{item.charCount ?? item.text.length}C</span>
            {item.wordCount && <span>• {item.wordCount}W</span>}
          </div>
        </div>

        {/* Actions Context Container - relative for TagPicker */}
        <div className="relative flex items-center gap-0.5">
          {isEditing ? (
            <>
              <ActionBtn icon={IconCheck} label="Save" onClick={handleSaveEdit} active />
              <ActionBtn icon={IconX} label="Cancel" onClick={handleCancelEdit} />
            </>
          ) : (
            <AnimatePresence>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <ActionBtn icon={copied ? IconCheck : IconCopy} label={copied ? 'Copied!' : 'Copy'} onClick={handleCopy} active={copied} />
                {item.isDeleted ? (
                  <>
                    <ActionBtn icon={IconRestore} label="Restore" onClick={() => restoreClip(item.id)} />
                    <ActionBtn icon={IconX} label="Delete Forever" onClick={() => permanentDelete(item.id)} danger />
                  </>
                ) : (
                  <>
                    <ActionBtn 
                      icon={IconTag} 
                      label="Tags" 
                      onClick={() => setShowTagPicker(!showTagPicker)} 
                      active={showTagPicker} 
                    />
                    <ActionBtn icon={IconEdit} label="Edit" onClick={() => { setEditText(item.text); setEditingClip(item.id) }} />
                    <ActionBtn icon={IconStar} label="Favorite" onClick={() => toggleFavorite(item.id)} active={item.isFavorite} />
                    <ActionBtn icon={IconTrash} label="Delete" onClick={() => deleteClip(item.id)} danger />
                  </>
                )}
              </div>
            </AnimatePresence>
          )}

          {/* Tag Picker Popover - Refactored for better positioning */}
          <AnimatePresence>
            {showTagPicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                className="absolute right-0 bottom-full mb-2 z-[100] w-48 bg-surface-900 border border-gray-700 rounded-lg shadow-2xl p-2 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Select Tags</span>
                  <button onClick={() => setShowTagPicker(false)} className="text-gray-600 hover:text-gray-400 p-0.5 rounded-md hover:bg-gray-800 transition-colors">
                    <IconX size={12} />
                  </button>
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
                  {tags.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 px-2 text-center opacity-40">
                      <IconTag size={20} className="mb-1" />
                      <p className="text-[10px]">No tags defined</p>
                    </div>
                  ) : (
                    tags.map((tag) => {
                      const isSelected = item.tags.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTagOnClip(item.id, tag.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all active:scale-[0.98] ${
                            isSelected ? 'bg-gray-800 text-white' : 'hover:bg-gray-800/60 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          <div 
                            className="size-2 rounded-full ring-1 ring-white/10" 
                            style={{ backgroundColor: tag.color }} 
                          />
                          <span className="text-[12px] flex-1 text-left truncate font-medium">{tag.name}</span>
                          {isSelected && <IconCheck size={12} className="text-brand-400" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Action Button ────────────────────────────────────────────────────────
interface ActionBtnProps {
  icon: React.FC<{ size?: number; className?: string }>
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
}

const ActionBtn: React.FC<ActionBtnProps> = ({ icon: Icon, label, onClick, active, danger }) => (
  <button
    title={label}
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
    className={`size-7 rounded-md flex items-center justify-center transition-all duration-150 active:scale-75 ${
      danger
        ? 'hover:bg-red-500/10 text-gray-500 hover:text-red-400'
        : active
        ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20 shadow-sm'
        : 'hover:bg-gray-800 text-gray-500 hover:text-gray-200'
    }`}
  >
    <Icon size={15} />
  </button>
)

export default EntryCard

