import React, { useCallback, useRef } from 'react'
import { useClipStore } from '../store/useClipStore'
import TagBadge from './TagBadge'

const SearchBar: React.FC = () => {
  const { filters, setFilters, resetFilters } = useClipStore()
  const debounceRef = useRef<NodeJS.Timeout>()

  const handleSearch = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setFilters({ search: value })
      }, 200)
    },
    [setFilters]
  )

  return (
    <div className="relative flex items-center">
      <span className="absolute left-4 text-white/30 text-sm select-none pointer-events-none">⌕</span>
      <input
        type="text"
        placeholder="Search clipboard history…"
        defaultValue={filters.search}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full bg-surface-600 border border-white/8 hover:border-white/15 focus:border-brand-500/60 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white/90 placeholder-white/30 outline-none transition-all duration-200"
      />
      {filters.search && (
        <button
          onClick={() => {
            setFilters({ search: '' })
          }}
          className="absolute right-3 text-white/30 hover:text-white/70 text-lg leading-none transition-colors"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default SearchBar
