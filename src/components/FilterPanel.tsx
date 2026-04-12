import React, { useState } from 'react'
import { useClipStore } from '../store/useClipStore'
import TagBadge from './TagBadge'
import { IconStar, IconClock, IconChevronUp, IconChevronDown } from './Icons'
import type { LengthFilter } from '../types'

const FilterPanel: React.FC = () => {
  const { filters, setFilters, resetFilters, tags } = useClipStore()
  const [dateExpanded, setDateExpanded] = useState(false)

  const hasActiveFilters =
    filters.search ||
    filters.tags.length > 0 ||
    filters.isFavorite !== null ||
    filters.lengthFilter !== 'all' ||
    filters.dateFrom ||
    filters.dateTo

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-700/50">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors uppercase font-bold"
          >
            Reset
          </button>
        )}
      </div>

      {/* Quick Filter */}
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500 font-semibold flex items-center gap-1.5 uppercase tracking-tight">
          Quick Filter
        </p>
        <button
          onClick={() => setFilters({ isFavorite: filters.isFavorite === true ? null : true })}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-150 text-left active:scale-[0.98] ${
            filters.isFavorite === true
              ? 'bg-accent-500/10 border-accent-500/30 text-accent-400'
              : 'bg-surface-700/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
          }`}
        >
          <IconStar size={14} className={filters.isFavorite === true ? 'fill-current' : ''} />
          <span className="text-xs font-medium">Favorites Only</span>
        </button>
      </div>

      {/* Length */}
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-tight">Text Length</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['all', 'short', 'medium', 'long'] as LengthFilter[]).map((l) => (
            <button
              key={l}
              onClick={() => setFilters({ lengthFilter: l })}
              className={`text-xs px-2 py-1.5 rounded-lg border transition-all duration-150 text-center active:scale-[0.98] font-medium ${
                filters.lengthFilter === l
                  ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                  : 'bg-surface-700/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <button
          onClick={() => setDateExpanded(!dateExpanded)}
          className="flex items-center justify-between w-full text-[11px] text-gray-500 font-semibold uppercase tracking-tight hover:text-gray-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <IconClock size={12} />
            Date Range
          </span>
          {dateExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </button>
        {dateExpanded && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-medium px-1">From</label>
                <input
                  type="date"
                  value={filters.dateFrom ?? ''}
                  onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
                  className="w-full bg-surface-900 border border-gray-700 text-gray-300 text-[11px] rounded-lg px-2 py-1.5 outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-medium px-1">To</label>
                <input
                  type="date"
                  value={filters.dateTo ?? ''}
                  onChange={(e) => setFilters({ dateTo: e.target.value || null })}
                  className="w-full bg-surface-900 border border-gray-700 text-gray-300 text-[11px] rounded-lg px-2 py-1.5 outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-tight">Active Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <TagBadge
                key={tag.id}
                tag={tag}
                size="sm"
                active={filters.tags.includes(tag.id)}
                onClick={() => {
                  const newTags = filters.tags.includes(tag.id)
                    ? filters.tags.filter((t) => t !== tag.id)
                    : [...filters.tags, tag.id]
                  setFilters({ tags: newTags })
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FilterPanel
