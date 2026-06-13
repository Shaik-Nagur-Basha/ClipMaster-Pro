import React, { useCallback, useRef, useEffect } from "react";
import { useClipStore } from "../store/useClipStore";
import { IconSearch, IconX } from "./Icons";

const SearchBar: React.FC = () => {
  const { filters, setFilters, setSearchInputRef, popupSearchValue, setPopupSearchValue, isSearchFocused, setIsSearchFocused } = useClipStore();
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  const isPopup = typeof window !== "undefined" && window.location.search.includes("popup=true");

  // Register search input ref with store for global keyboard access and auto-focus
  useEffect(() => {
    setSearchInputRef(inputRef);
    if (isPopup) {
      setIsSearchFocused(true);
      // Tell the native hook process to enable keyboard capture BEFORE attempting
      // DOM focus — the popup window is WS_EX_NOACTIVATE so focus() alone is not
      // enough; the hook must be active first to route keystrokes into the input.
      window.clipAPI?.setSearchFocusable?.(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
    return () => {
      setSearchInputRef(null);
    };
  }, [setSearchInputRef, isPopup, setIsSearchFocused]);

  const handleSearch = useCallback(
    (value: string) => {
      setPopupSearchValue(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setFilters({ search: value });
      }, 200);
    },
    [setFilters, setPopupSearchValue],
  );

  const clearSearch = () => {
    setFilters({ search: "" });
    setPopupSearchValue("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleMouseDown = () => {
    if (isPopup && !isSearchFocused) {
      setIsSearchFocused(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  };

  const handleFocus = () => {
    if (isPopup && !isSearchFocused) {
      setIsSearchFocused(true);
    }
  };

  const handleBlur = () => {
    if (isPopup) {
      setTimeout(() => {
        if (document.activeElement !== inputRef.current) {
          setIsSearchFocused(false);
        }
      }, 100);
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
        value={popupSearchValue}
        onChange={(e) => handleSearch(e.target.value)}
        onMouseDown={handleMouseDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full bg-transparent border-0 border-b border-gray-600 hover:border-gray-500 focus:border-brand-500 focus:ring-0 focus:outline-none pl-9 pr-9 py-2 text-[13px] text-white/85 placeholder-gray-600 transition-colors duration-150"
      />
      {filters.search && (
        <button
          onMouseDown={(e) => e.preventDefault()}
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
