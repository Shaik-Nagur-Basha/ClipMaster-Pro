import React from 'react'
import { useClipStore } from '../store/useClipStore'
import { IconList, IconEye, IconLayers } from './Icons'
import SortDropdown from './SortDropdown'
import type { ViewMode, DisplayMode, SortMode } from '../types'

const ViewToggle: React.FC = () => {
  const { viewMode, setViewMode, displayMode, setDisplayMode, sortMode, setSortMode } = useClipStore()

  return (
    <div className="flex items-center gap-3">
      {/* Sort Options */}
      <SortDropdown />

      <div className="h-4 w-[1px] bg-gray-700/50 mx-1" />

      {/* Mode Controls */}
      <div className="flex items-center gap-2">
        {/* Display mode toggle */}
        <div className="flex items-center p-0.5 bg-surface-800 border-gray-700 rounded-lg">
          {(['preview', 'full'] as DisplayMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setDisplayMode(mode)}
              title={mode === 'preview' ? 'Preview text' : 'Full text'}
              className={`p-1.5 rounded-md transition-all duration-150 ${
                displayMode === mode
                  ? 'bg-brand-500/20 text-brand-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700/50'
              }`}
            >
              {mode === 'preview' ? <IconEye size={16} /> : <IconLayers size={16} />}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center p-0.5 bg-surface-800 border-gray-700 rounded-lg">
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            className={`p-1.5 rounded-md transition-all duration-150 ${
              viewMode === 'list'
                ? 'bg-brand-500/20 text-brand-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700/50'
            }`}
          >
            <IconList size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ViewToggle
