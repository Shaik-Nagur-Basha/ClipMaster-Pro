import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClipStore } from '../store/useClipStore'
import { IconCheck, IconEdit, IconX, IconPlus, IconTag, IconTrash, IconSearch, IconFilter } from './Icons'
import Dialog from './Dialog'
import type { Tag } from '../types'

const PRESET_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
]

const TagManager: React.FC = () => {
  const { tags, saveTags } = useClipStore()
  
  // Creation state
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // Dialog state
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
  
  // Refs
  const creationColorRef = useRef<HTMLInputElement>(null)
  const editColorRef = useRef<HTMLInputElement>(null)
  const tagSearchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      // Handle Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (tagSearchInputRef.current) {
          if (document.activeElement !== tagSearchInputRef.current) {
            tagSearchInputRef.current.focus();
            // Move cursor to the end of the text
            const len = tagSearchInputRef.current.value.length;
            tagSearchInputRef.current.setSelectionRange(len, len);
          }
        }
        return; // Let native paste handle inserting the clipboard text
      }

      // Ignore special keys (Ctrl, Alt, Shift, Meta, Escape, etc.)
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key === "Escape" ||
        e.key.length > 1
      ) {
        return;
      }

      // Focus search input and type the character
      if (tagSearchInputRef.current) {
        e.preventDefault();
        tagSearchInputRef.current.focus();
        const char = e.key;
        setSearchQuery((prev) => prev + char);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    const tag: Tag = {
      id: Date.now().toString(),
      name,
      color: newColor,
      updatedAt: new Date().toISOString()
    }
    await saveTags([...tags, tag])
    setNewName('')
    setNewColor(PRESET_COLORS[0])
  }

  const handleEditSave = async () => {
    if (!editingTag || !editingTag.name.trim()) return
    const updatedTag = { ...editingTag, updatedAt: new Date().toISOString() }
    await saveTags(tags.map((t) => (t.id === updatedTag.id ? updatedTag : t)))
    setEditingTag(null)
  }

  const confirmDelete = async () => {
    if (!deletingTag) return
    await saveTags(tags.filter((t) => t.id !== deletingTag.id))
    setDeletingTag(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Creation Section Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Section */}
        <div className="bg-surface-700/20 rounded-2xl p-4 border border-white/5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
             <div className="flex items-center gap-2">
               <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400">
                 <IconFilter size={14} />
               </div>
               <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Search Tags</h3>
            </div>
            
            <div className="relative flex items-center group w-full">
              <div className="absolute left-3 text-gray-600 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                <IconSearch size={16} />
              </div>
              <input
                ref={tagSearchInputRef}
                type="text"
                placeholder="Search tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-9 py-2 text-[13px] text-white/85 placeholder-gray-600 transition-colors duration-150"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 p-1 text-gray-600 hover:text-gray-400 transition-colors duration-150"
                  title="Clear search"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="text-[10px] text-gray-500 font-medium leading-normal pl-1">
             Filter down your tags list by entering a search term above.
          </div>
        </div>

        {/* Creation Section */}
        <div className="bg-surface-700/20 rounded-2xl p-4 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400">
                 <IconPlus size={14} />
               </div>
               <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Create New Tag</h3>
            </div>
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="px-3.5 py-1.5 rounded-xl shadow-md transition-all duration-200 font-bold text-[10px] uppercase tracking-wider disabled:opacity-20 hover:brightness-110 active:scale-[0.98] shrink-0"
              style={{
                backgroundColor: newColor + '15',
                color: newColor,
                borderColor: newColor + '30'
              }}
            >
              Add Tag
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative flex items-center group w-full">
              <div className="absolute left-3 text-gray-600 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                <IconTag size={16} />
              </div>
              <input
                type="text"
                placeholder="Tag name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-9 py-2 text-[13px] text-white/85 placeholder-gray-600 transition-colors duration-150"
              />
            </div>

            <div className="flex items-center gap-2 px-1">
               <div className="flex flex-wrap items-center gap-1.5">
                 {PRESET_COLORS.map((c) => (
                   <button
                     key={c}
                     onClick={() => setNewColor(c)}
                     className={`w-4 h-4 rounded-full transition-all duration-200 border-black/20 ${
                       newColor === c ? 'ring-1 ring-white/60 scale-125' : 'opacity-40 hover:opacity-100'
                     }`}
                     style={{ backgroundColor: c }}
                   />
                 ))}
                 <div className="h-3 w-px bg-gray-700 mx-1" />
                 <button
                    onClick={() => creationColorRef.current?.click()}
                    className={`w-4 h-4 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-[10px] hover:border-gray-400 transition-colors ${!PRESET_COLORS.includes(newColor) ? 'ring-1 ring-white/40 scale-125 shadow-lg' : ''}`}
                    style={{ backgroundColor: !PRESET_COLORS.includes(newColor) ? newColor : undefined }}
                 >
                   {!PRESET_COLORS.includes(newColor) ? '' : '+'}
                 </button>
                 <input
                   ref={creationColorRef}
                   type="color"
                   value={newColor}
                   onChange={(e) => setNewColor(e.target.value)}
                   className="absolute invisible opacity-0 pointer-events-none"
                 />
               </div>
               <span className="text-[10px] font-mono text-gray-600 uppercase font-bold ml-auto">{newColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tags Grid - Compact according to content */}
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {filteredTags.map((tag) => (
            <motion.div
              key={tag.id}
              layout
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              whileHover={{ scale: 1.02 }}
              className="group relative flex items-center h-9 px-3 rounded-xl border transition-all duration-200 hover:brightness-110 tracking-tight shadow-sm min-w-0 max-w-[720px]"
              style={{
                backgroundColor: tag.color + '15',
                color: tag.color,
                borderColor: tag.color + '30'
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0 mr-2.5 shadow-sm" style={{ backgroundColor: tag.color }} />
              <span className="text-[12px] font-bold truncate flex-1 leading-none tracking-tight">{tag.name}</span>
              
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all ml-1 -mr-1">
                <button
                  onClick={() => setEditingTag(tag)}
                  className="p-1 px-1.5 hover:bg-black/10 rounded-lg transition-all"
                  style={{ color: tag.color }}
                >
                  <IconEdit size={12} />
                </button>
                <button
                  onClick={() => setDeletingTag(tag)}
                  className="p-1 px-1.5 hover:bg-black/10 rounded-lg transition-all"
                  style={{ color: tag.color }}
                >
                  <IconX size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {tags.length === 0 && (
          <div className="w-full py-12 flex flex-col items-center justify-center opacity-30 grayscale">
             <IconTag size={40} className="text-gray-500 mb-2 stroke-[1.5]" />
             <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center max-w-[140px]">
                No Tags Cataloged
             </p>
          </div>
        )}

        {tags.length > 0 && filteredTags.length === 0 && (
          <div className="w-full py-12 flex flex-col items-center justify-center opacity-30 grayscale">
             <IconSearch size={40} className="text-gray-500 mb-2 stroke-[1.5]" />
             <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center max-w-[180px]">
                No matching tags found
             </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog
        isOpen={!!editingTag}
        onClose={() => setEditingTag(null)}
        title={
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400">
              <IconEdit size={14} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest leading-none">Edit Tag</h3>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Tag Name</label>
            <div className="relative flex items-center group w-full">
              <div className="absolute left-3 text-gray-600 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                <IconTag size={16} />
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Tag name..."
                value={editingTag?.name ?? ''}
                onChange={(e) => setEditingTag(prev => prev ? { ...prev, name: e.target.value } : null)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-4 py-2.5 text-[13px] text-white/85 placeholder-gray-600 transition-colors duration-150"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Tag Color</label>
            <div className="flex flex-wrap gap-2 px-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setEditingTag(prev => prev ? { ...prev, color: c } : null)}
                  className={`w-6 h-6 rounded-full transition-all duration-200 border-black/20 ${
                    editingTag?.color === c ? 'ring-1 ring-white/40 scale-125 shadow-lg' : 'hover:opacity-100 opacity-60'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                onClick={() => editColorRef.current?.click()}
                className={`w-6 h-6 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-xs hover:border-gray-400 transition-colors ${editingTag && !PRESET_COLORS.includes(editingTag.color) ? 'ring-1 ring-white/40 scale-125 shadow-lg' : ''}`}
                style={{ backgroundColor: (editingTag && !PRESET_COLORS.includes(editingTag.color)) ? editingTag.color : undefined }}
              >
                +
              </button>
              <input
                ref={editColorRef}
                type="color"
                value={editingTag?.color ?? '#6366f1'}
                onChange={(e) => setEditingTag(prev => prev ? { ...prev, color: e.target.value } : null)}
                className="absolute invisible opacity-0 pointer-events-none"
              />
            </div>
            {editingTag && (
              <p className="text-[10px] font-mono text-center text-gray-500 uppercase font-bold pt-2">{editingTag.color}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setEditingTag(null)}
              className="flex-1 px-4 py-2.5 rounded-xl border-gray-700 text-gray-400 hover:text-gray-300 bg-white/5 transition-all text-xs font-bold uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              className="flex-1 px-4 py-2.5 rounded-xl transition-all duration-200 text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-[0.98]"
              style={{
                backgroundColor: (editingTag?.color ?? '#6366f1') + '15',
                color: editingTag?.color ?? '#6366f1',
                borderColor: (editingTag?.color ?? '#6366f1') + '30'
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={!!deletingTag}
        onClose={() => setDeletingTag(null)}
        title="Confirm Deletion"
        maxWidth="max-w-xs"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 rounded-full bg-red-500/10 text-red-400 border-red-500/20 mb-2">
            <IconTrash size={32} />
          </div>
          <div className="space-y-1">
            <h4 className="text-white font-bold text-lg leading-tight">Delete "{deletingTag?.name}"?</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              This will permanently remove this tag. Clips using this tag will be unaffected but un-tagged.
            </p>
          </div>
          <div className="flex flex-col w-full gap-2 pt-4">
            <button
              onClick={confirmDelete}
              className="w-full py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-xs font-bold uppercase tracking-wider"
            >
              Delete Tag
            </button>
            <button
              onClick={() => setDeletingTag(null)}
              className="w-full py-2.5 rounded-xl bg-transparent text-gray-500 hover:text-gray-300 transition-all text-[10px] font-bold uppercase tracking-[0.2em]"
            >
              Keep Tag
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default TagManager
