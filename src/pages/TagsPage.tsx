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
      <div className="px-8 py-3 shrink-0 bg-surface-900">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 border-brand-500/20 shadow-lg shadow-brand-500/5">
                <IconTag size={16} />
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">Tag Management</h2>
            </div>
            <p className="text-[11px] text-gray-500 max-w-md leading-relaxed ml-1">
              Organize your clips easily with custom color-coded tags.
            </p>
          </div>
          
          <div className="hidden md:flex gap-8">
            <div className="text-center">
              <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-0.5">Total Tags</p>
              <p className="text-base font-mono font-bold text-white">{tags.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto hide-scrollbar border-l border-t border-emerald-700 rounded-tl-2xl bg-gradient-to-b from-[#0a1210] via-[#09090f] to-[#0a0a0f] relative"
        style={{
          boxShadow: "inset 1px 1px 0px rgba(255, 255, 255, 0.15), inset -1px -1px 0px rgba(0, 0, 0, 0.5), inset 0 0 32px rgba(16, 185, 129, 0.08), 0 20px 40px -12px rgba(0, 0, 0, 0.65)"
        }}
      >
        <div className="max-w-4xl mx-auto px-8 py-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="p-8 rounded-3xl bg-surface-700/50 border-white/5 backdrop-blur-xl shadow-2xl"
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
