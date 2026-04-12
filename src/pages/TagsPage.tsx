import React from 'react'
import { motion } from 'framer-motion'
import { useClipStore } from '../store/useClipStore'
import TagManager from '../components/TagManager'
import { IconTag, IconZap } from '../components/Icons'

const TagsPage: React.FC = () => {
  const { tags } = useClipStore()

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-900">
      {/* Header Area */}
      <div className="px-8 py-10 shrink-0 border-b border-white/5 bg-surface-800/20">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-lg shadow-brand-500/5">
                <IconTag size={24} />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Tag Management</h2>
            </div>
            <p className="text-sm text-gray-500 max-w-md leading-relaxed ml-1">
              Create and organize tags to categorize your clips. These tags will be available for quick filtering in the sidebar.
            </p>
          </div>
          
          <div className="hidden md:flex gap-8">
            <div className="text-center">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1">Total Tags</p>
              <p className="text-2xl font-mono font-bold text-white">{tags.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Management Area */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="p-8 rounded-3xl bg-surface-800/40 border border-white/5 backdrop-blur-xl shadow-2xl"
          >
            <TagManager />
          </motion.div>

          <footer className="mt-12 flex items-center justify-center gap-3 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
             <IconZap size={14} className="text-brand-400" />
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">ClipMaster Pro Edition</p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default TagsPage
