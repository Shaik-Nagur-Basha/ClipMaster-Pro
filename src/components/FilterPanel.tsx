import React, { useState } from 'react'
import { useClipStore } from '../store/useClipStore'
import TagBadge from './TagBadge'
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Quick Filter */}
      <div className="space-y-1.5">
        <p className="text-xs text-white/30 font-medium">Quick</p>
        <FilterChip
          label="⭐ Favorites"
          active={filters.isFavorite === true}
          onClick={() => setFilters({ isFavorite: filters.isFavorite === true ? null : true })}
        />
      </div>

      {/* Length */}
      <div className="space-y-1.5">
        <p className="text-xs text-white/30 font-medium">Text length</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['all', 'short', 'medium', 'long'] as LengthFilter[]).map((l) => (
            <FilterChip
              key={l}
              label={l.charAt(0).toUpperCase() + l.slice(1)}
              active={filters.lengthFilter === l}
              onClick={() => setFilters({ lengthFilter: l })}
            />
          ))}
        </div>
        <div className="text-xs text-white/20 mt-1 space-y-0.5 px-1">
          <p>Short: ≤ 100 chars</p>
          <p>Medium: 101–500</p>
          <p>Long: 500+</p>
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-1.5">
        <button
          onClick={() => setDateExpanded(!dateExpanded)}
          className="flex items-center justify-between w-full text-xs text-white/30 font-medium hover:text-white/50 transition-colors"
        >
          <span>Date range</span>
          <span>{dateExpanded ? '▲' : '▼'}</span>
        </button>
        {dateExpanded && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-white/20">From</label>
              <input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
                className="w-full mt-1 bg-surface-600 border border-white/8 text-white/70 text-xs rounded-lg px-2 py-1.5 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/20">To</label>
              <input
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) => setFilters({ dateTo: e.target.value || null })}
                className="w-full mt-1 bg-surface-600 border border-white/8 text-white/70 text-xs rounded-lg px-2 py-1.5 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/30 font-medium">Tags</p>
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

const FilterChip: React.FC<{
  label: string
  active: boolean
  onClick: () => void
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 text-left ${
      active
        ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
        : 'bg-surface-600/50 border-white/8 text-white/50 hover:border-white/20 hover:text-white/70'
    }`}
  >
    {label}
  </button>
)

export default FilterPanel
