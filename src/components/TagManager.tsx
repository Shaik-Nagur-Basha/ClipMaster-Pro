import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClipStore } from '../store/useClipStore'
import { IconCheck, IconEdit, IconX, IconPlus, IconTag } from './Icons'
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
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700/50">
        <IconTag size={12} className="text-gray-500" />
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tag Management</h3>
      </div>

      {/* Tag list */}
      <div className="space-y-1">
        <AnimatePresence>
          {tags.map((tag) => (
            <motion.div
              key={tag.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:border-gray-700 hover:bg-surface-700/30 transition-all duration-150"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
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
                  className="flex-1 bg-surface-900 text-white text-[11px] rounded px-2 py-0.5 outline-none border border-brand-500/50"
                />
              ) : (
                <span className="flex-1 text-xs text-gray-300 font-medium">{tag.name}</span>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {editId === tag.id ? (
                  <button
                    onClick={() => handleEditSave(tag.id)}
                    className="p-1 text-accent-400 hover:bg-accent-500/10 rounded"
                  >
                    <IconCheck size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => { setEditId(tag.id); setEditName(tag.name) }}
                    className="p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-600/50 rounded"
                  >
                    <IconEdit size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                >
                  <IconX size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add tag */}
      <div className="space-y-3 pt-3 border-t border-gray-700/50">
        <div className="relative">
          <input
            type="text"
            placeholder="New tag name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="w-full bg-surface-800 border border-gray-700 text-white text-xs rounded-lg pl-3 pr-10 py-2 outline-none focus:border-brand-500/50 transition-colors placeholder-gray-600"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="absolute right-1.5 top-1.5 p-1 rounded-md bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 disabled:opacity-0 transition-all duration-200"
          >
            <IconPlus size={14} />
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 px-1">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                newColor === c 
                  ? 'scale-125 ring-2 ring-white/50 ring-offset-2 ring-offset-surface-800' 
                  : 'hover:scale-110 opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default TagManager
