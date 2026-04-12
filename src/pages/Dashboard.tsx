import React, { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FixedSizeList as List } from 'react-window'
import { useClipStore, selectFilteredClips } from '../store/useClipStore'
import EntryCard from '../components/EntryCard'
import SearchBar from '../components/SearchBar'
import ViewToggle from '../components/ViewToggle'
import type { ClipboardItem } from '../types'

const Dashboard: React.FC = () => {
  const store = useClipStore()
  const { viewMode, displayMode, isLoading } = store
  const filtered = selectFilteredClips(store)

  const isEmpty = filtered.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
        <div className="flex-1">
          <SearchBar />
        </div>
        <ViewToggle />
      </div>

      {/* Count bar */}
      <div className="flex items-center justify-between px-5 py-2 shrink-0">
        <p className="text-xs text-white/30">
          {filtered.length} clip{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <EmptyState />
        ) : viewMode === 'grid' ? (
          <GridView clips={filtered} displayMode={displayMode} />
        ) : viewMode === 'compact' ? (
          <CompactView clips={filtered} />
        ) : (
          <ListView clips={filtered} displayMode={displayMode} />
        )}
      </div>
    </div>
  )
}

// ─── List View (virtualized) ──────────────────────────────────────────────
const ListView: React.FC<{ clips: ClipboardItem[]; displayMode: 'preview' | 'full' }> = ({
  clips,
  displayMode
}) => {
  const ITEM_HEIGHT = displayMode === 'full' ? 180 : 130

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={{ ...style, paddingLeft: 20, paddingRight: 20, paddingTop: 4, paddingBottom: 4 }}>
      <EntryCard item={clips[index]} displayMode={displayMode} viewMode="list" />
    </div>
  )

  return (
    <List
      height={window.innerHeight - 140}
      itemCount={clips.length}
      itemSize={ITEM_HEIGHT}
      width="100%"
      className="outline-none"
    >
      {Row}
    </List>
  )
}

// ─── Grid View ────────────────────────────────────────────────────────────
const GridView: React.FC<{ clips: ClipboardItem[]; displayMode: 'preview' | 'full' }> = ({
  clips,
  displayMode
}) => (
  <div className="h-full overflow-y-auto px-5 py-2">
    <motion.div
      layout
      className="grid grid-cols-2 xl:grid-cols-3 gap-3"
    >
      <AnimatePresence>
        {clips.map((item) => (
          <EntryCard key={item.id} item={item} displayMode={displayMode} viewMode="grid" />
        ))}
      </AnimatePresence>
    </motion.div>
  </div>
)

// ─── Compact View ─────────────────────────────────────────────────────────
const CompactView: React.FC<{ clips: ClipboardItem[] }> = ({ clips }) => (
  <div className="h-full overflow-y-auto px-5 py-2 space-y-1">
    <AnimatePresence>
      {clips.map((item) => (
        <EntryCard key={item.id} item={item} displayMode="preview" viewMode="compact" />
      ))}
    </AnimatePresence>
  </div>
)

// ─── Empty State ──────────────────────────────────────────────────────────
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4 pb-16">
    <div className="w-16 h-16 rounded-2xl bg-surface-700 flex items-center justify-center text-3xl">
      📋
    </div>
    <div className="text-center">
      <p className="text-white/60 font-medium">No clips found</p>
      <p className="text-white/30 text-sm mt-1">
        Copy something to get started, or adjust your filters.
      </p>
    </div>
  </div>
)

// ─── Loading Skeleton ─────────────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="px-5 py-4 space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="h-28 rounded-2xl bg-surface-700 animate-pulse"
        style={{ opacity: 1 - i * 0.12 }}
      />
    ))}
  </div>
)

export default Dashboard
