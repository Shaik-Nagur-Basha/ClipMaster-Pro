import React, { useCallback, useRef, useEffect } from "react";
import { useClipStore } from "../store/useClipStore";
import { IconSearch, IconX } from "./Icons";

const SearchBar: React.FC = () => {
  const { filters, setFilters, setSearchInputRef } = useClipStore();
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Register search input ref with store for global keyboard access
  useEffect(() => {
    setSearchInputRef(inputRef);
    return () => setSearchInputRef(null);
  }, [setSearchInputRef]);

  const handleSearch = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setFilters({ search: value });
      }, 200);
    },
    [setFilters],
  );

  const clearSearch = () => {
    setFilters({ search: "" });
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="relative flex items-center group w-full">
      <div className="absolute left-3 text-gray-600 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
        <IconSearch size={16} />
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search clipboard…"
        defaultValue={filters.search}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-9 py-2 text-[13px] text-white/85 placeholder-gray-600 transition-colors duration-150"
      />
      {filters.search && (
        <button
          onClick={clearSearch}
          className="absolute right-2 p-1 text-gray-600 hover:text-gray-400 transition-colors duration-150"
          title="Clear search"
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
