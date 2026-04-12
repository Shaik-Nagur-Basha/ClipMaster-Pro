import React from 'react'
import { useClipStore } from '../store/useClipStore'
import type { ViewMode, DisplayMode, SortMode } from '../types'

const ViewToggle: React.FC = () => {
  const { viewMode, setViewMode, displayMode, setDisplayMode, sortMode, setSortMode } = useClipStore()

  return (
    <div className="flex items-center gap-2">
      {/* Sort */}
      <select
        value={sortMode}
        onChange={(e) => setSortMode(e.target.value as SortMode)}
        className="bg-surface-600 border border-white/8 text-white/70 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-white/20 transition-colors"
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="longest">Longest</option>
        <option value="shortest">Shortest</option>
      </select>

      {/* Display mode */}
      <div className="flex items-center bg-surface-600 border border-white/8 rounded-lg overflow-hidden">
        {(['preview', 'full'] as DisplayMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setDisplayMode(mode)}
            title={mode === 'preview' ? 'Preview text' : 'Full text'}
            className={`px-2.5 py-1.5 text-xs transition-all duration-150 ${
              displayMode === mode
                ? 'bg-brand-500/30 text-brand-400'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {mode === 'preview' ? '⟨…⟩' : '⟨≡⟩'}
          </button>
        ))}
      </div>

      {/* View mode */}
      <div className="flex items-center bg-surface-600 border border-white/8 rounded-lg overflow-hidden">
        {([
          { mode: 'list', icon: '▤', label: 'List view' },
          { mode: 'grid', icon: '▦', label: 'Grid view' },
          { mode: 'compact', icon: '▤', label: 'Compact view' }
        ] as { mode: ViewMode; icon: string; label: string }[]).map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            title={label}
            className={`px-2.5 py-1.5 text-xs transition-all duration-150 ${
              viewMode === mode
                ? 'bg-brand-500/30 text-brand-400'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {mode === 'list' ? '▤' : mode === 'grid' ? '▦' : '≡'}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ViewToggle
