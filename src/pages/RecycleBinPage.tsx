import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FixedSizeList as List } from 'react-window'
import { useClipStore, selectFilteredClips } from '../store/useClipStore'
import EntryCard from '../components/EntryCard'
import SearchBar from '../components/SearchBar'
import ViewToggle from '../components/ViewToggle'
import type { ClipboardItem } from '../types'

const RecycleBinPage: React.FC = () => {
  const store = useClipStore()
  const { viewMode, displayMode, isLoading, permanentDelete } = store
  const filtered = selectFilteredClips(store, true)

  const isEmpty = filtered.length === 0
  const [emptying, setEmptying] = React.useState(false)

  const handleEmptyBin = async () => {
    if (!window.confirm('Permanently delete ALL items in the bin? This cannot be undone.')) return
    setEmptying(true)
    // We do them sequentially or in chunks to avoid overwhelming the bridge
    for (const item of filtered) {
      await permanentDelete(item.id)
    }
    setEmptying(false)
  }

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
      <div className="flex items-center justify-between px-5 py-2 shrink-0 bg-surface-800/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗑️</span>
          <p className="text-xs text-white/40 font-medium">
            {filtered.length} deleted clip{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isEmpty && (
          <button
            onClick={handleEmptyBin}
            disabled={emptying || isLoading}
            className="text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all disabled:opacity-30"
          >
            {emptying ? 'Clearing…' : 'Empty Bin'}
          </button>
        )}
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
      height={window.innerHeight - 150}
      itemCount={clips.length}
      itemSize={ITEM_HEIGHT}
      width="100%"
      className="outline-none scrollbar-thin"
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
  <div className="h-full overflow-y-auto px-5 py-2 scrollbar-thin">
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
  <div className="h-full overflow-y-auto px-5 py-2 space-y-1 scrollbar-thin">
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
      🗑️
    </div>
    <div className="text-center">
      <p className="text-white/60 font-medium">Recycle bin is empty</p>
      <p className="text-white/30 text-sm mt-1">
        Items you delete from your dashboard will appear here.
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

export default RecycleBinPage
