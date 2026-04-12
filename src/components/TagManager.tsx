import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClipStore } from '../store/useClipStore'
import type { Tag } from '../types'

const TAG_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
]

const TagManager: React.FC = () => {
  const { tags, saveTags } = useClipStore()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TAG_COLORS[0])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    const tag: Tag = {
      id: Date.now().toString(),
      name,
      color: newColor
    }
    await saveTags([...tags, tag])
    setNewName('')
    setNewColor(TAG_COLORS[0])
  }

  const handleDelete = async (id: string) => {
    await saveTags(tags.filter((t) => t.id !== id))
  }

  const handleEditSave = async (id: string) => {
    if (!editName.trim()) return
    await saveTags(tags.map((t) => (t.id === id ? { ...t, name: editName.trim() } : t)))
    setEditId(null)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Tags</h3>

      {/* Tag list */}
      <div className="space-y-1.5">
        <AnimatePresence>
          {tags.map((tag) => (
            <motion.div
              key={tag.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              className="group flex items-center gap-2 p-2 rounded-lg hover:bg-surface-600/50 transition-colors"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              {editId === tag.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSave(tag.id)
                    if (e.key === 'Escape') setEditId(null)
                  }}
                  className="flex-1 bg-surface-800 text-white/90 text-xs rounded px-2 py-1 outline-none border border-brand-500/50"
                />
              ) : (
                <span className="flex-1 text-sm text-white/70">{tag.name}</span>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {editId === tag.id ? (
                  <button
                    onClick={() => handleEditSave(tag.id)}
                    className="text-xs text-accent-500 hover:text-accent-400"
                  >
                    ✓
                  </button>
                ) : (
                  <button
                    onClick={() => { setEditId(tag.id); setEditName(tag.name) }}
                    className="text-xs text-white/30 hover:text-white/60"
                  >
                    ✏
                  </button>
                )}
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="text-xs text-white/30 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add tag */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <input
          type="text"
          placeholder="New tag name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="w-full bg-surface-600 border border-white/8 text-white/80 text-xs rounded-lg px-3 py-2 outline-none focus:border-brand-500/50 transition-colors placeholder-white/25"
        />
        <div className="flex flex-wrap gap-1.5">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-white/40 ring-offset-1 ring-offset-surface-800' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="w-full py-1.5 rounded-lg bg-brand-500/20 text-brand-400 text-xs font-medium hover:bg-brand-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Add Tag
        </button>
      </div>
    </div>
  )
}

export default TagManager
