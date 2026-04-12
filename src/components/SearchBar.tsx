import React, { useCallback, useRef } from 'react'
import { useClipStore } from '../store/useClipStore'
import { IconSearch, IconX } from './Icons'

const SearchBar: React.FC = () => {
  const { filters, setFilters } = useClipStore()
  const debounceRef = useRef<NodeJS.Timeout>()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setFilters({ search: value })
      }, 200)
    },
    [setFilters]
  )

  const clearSearch = () => {
    setFilters({ search: '' })
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="relative flex items-center group w-full max-w-md">
      <div className="absolute left-3 text-gray-500 group-focus-within:text-brand-400 transition-colors pointer-events-none">
        <IconSearch size={16} />
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search clipboard history…"
        defaultValue={filters.search}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full bg-surface-900 border border-gray-700 hover:border-gray-600 focus:border-brand-500/50 rounded-md pl-9 pr-9 py-1.5 text-[13px] text-white/90 placeholder-gray-600 outline-none transition-all duration-150"
      />
      {filters.search && (
        <button
          onClick={clearSearch}
          className="absolute right-2.5 p-0.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all active:scale-90"
          title="Clear search"
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  )
}

export default SearchBar

