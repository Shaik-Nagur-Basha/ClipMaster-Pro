import React, { useCallback, useRef } from "react";
import { useClipStore } from "../store/useClipStore";
import { IconSearch, IconX } from "./Icons";

const SearchBar: React.FC = () => {
  const { filters, setFilters } = useClipStore();
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

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
      <div className="absolute left-3 text-gray-600 group-focus-within:text-gray-400 transition-colors pointer-events-none duration-150">
        <IconSearch size={16} />
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search clipboard…"
        defaultValue={filters.search}
        onChange={(e) => handleSearch(e.target.value)}
        style={{
          boxShadow: "none",
          outline: "none",
          border: "none",
          borderBottom: "1px solid #4b5563",
        }}
        className="w-full bg-transparent hover:border-b hover:border-gray-600 focus:border-b focus:border-gray-500 pl-9 pr-9 py-2 text-[13px] text-white/85 placeholder-gray-600 transition-colors duration-150"
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
