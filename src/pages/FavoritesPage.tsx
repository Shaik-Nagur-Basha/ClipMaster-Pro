import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useClipStore, selectFilteredClips } from '../store/useClipStore'
import EntryCard from '../components/EntryCard'
import SearchBar from '../components/SearchBar'
import ViewToggle from '../components/ViewToggle'
import { IconStar } from '../components/Icons'
import type { ClipboardItem } from '../types'

const FavoritesPage: React.FC = () => {
  const store = useClipStore()
  const { viewMode, displayMode, isLoading } = store
  
  // Filter for favorite items that are not deleted
  const allClips = selectFilteredClips(store)
  const filtered = allClips.filter(c => c.isFavorite)

  const isEmpty = filtered.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-900">
      {/* Toolbar */}
      <div className="relative z-50 flex items-center gap-4 px-6 py-4 border-white/5 shrink-0 bg-surface-800/40 backdrop-blur-sm">
        <div className="flex-1 max-w-2xl">
          <SearchBar />
        </div>
        <ViewToggle />
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between px-6 py-2 shrink-0 bg-surface-800/20">
        <div className="flex items-center gap-2">
          <IconStar size={14} className="text-accent-500" />
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {filtered.length} Favorite {filtered.length === 1 ? 'Entry' : 'Entries'}
          </p>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="px-6 py-4">
            {viewMode === 'grid' ? (
              <GridView clips={filtered} displayMode={displayMode} />
            ) : viewMode === 'compact' ? (
              <CompactView clips={filtered} />
            ) : (
              <ListView clips={filtered} displayMode={displayMode} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── List View (Standard Scrollable) ──────────────────────────────────────
const ListView: React.FC<{ clips: ClipboardItem[]; displayMode: 'preview' | 'full' }> = ({
  clips,
  displayMode
}) => (
  <div className="space-y-4">
    <AnimatePresence mode="popLayout">
      {clips.map((item) => (
        <EntryCard key={item.id} item={item} displayMode={displayMode} viewMode="list" />
      ))}
    </AnimatePresence>
  </div>
)

// ─── Grid View ────────────────────────────────────────────────────────────
const GridView: React.FC<{ clips: ClipboardItem[]; displayMode: 'preview' | 'full' }> = ({
  clips,
  displayMode
}) => (
  <motion.div
    layout
    className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
  >
    <AnimatePresence mode="popLayout">
      {clips.map((item) => (
        <EntryCard key={item.id} item={item} displayMode={displayMode} viewMode="grid" />
      ))}
    </AnimatePresence>
  </motion.div>
)

// ─── Compact View ─────────────────────────────────────────────────────────
const CompactView: React.FC<{ clips: ClipboardItem[] }> = ({ clips }) => (
  <div className="space-y-2">
    <AnimatePresence mode="popLayout">
      {clips.map((item) => (
        <EntryCard key={item.id} item={item} displayMode="preview" viewMode="compact" />
      ))}
    </AnimatePresence>
  </div>
)

// ─── Empty State ──────────────────────────────────────────────────────────
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full gap-6 py-20 opacity-80">
    <div className="relative">
      <div className="absolute inset-0 bg-accent-500/10 blur-3xl rounded-full" />
      <div className="relative w-24 h-24 rounded-3xl bg-surface-800 border-2 border-gray-700 flex items-center justify-center text-accent-500/60 shadow-lg shadow-accent-500/10">
        <IconStar size={48} strokeWidth={1.5} />
      </div>
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-lg font-bold text-white tracking-tight">No Favorites Yet</h3>
      <p className="text-sm text-gray-500 max-w-[240px] leading-relaxed">
        Star your important clips to keep them separate and easy to find.
      </p>
    </div>
  </div>
)

// ─── Loading Skeleton ─────────────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="px-6 py-6 space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className="h-32 rounded-xl bg-surface-800 border border-gray-700/50 animate-pulse"
        style={{ opacity: 1 - i * 0.15 }}
      />
    ))}
  </div>
)

export default FavoritesPage
