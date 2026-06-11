import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useClipStore, selectFilteredClips } from "../store/useClipStore";
import EntryCard from "../components/EntryCard";
import SearchBar from "../components/SearchBar";
import ViewToggle from "../components/ViewToggle";
import FloatingScrollButtons from "../components/FloatingScrollButtons";
import { IconInbox, IconTag, IconCheck, IconSearch, IconX } from "../components/Icons";
import { ClipSkeleton } from "../components/LoadingSpinner";
import type { ClipboardItem } from "../types";
import PageSizeDropdown from "../components/PageSizeDropdown";

const Dashboard: React.FC<{ isPopup?: boolean }> = ({ isPopup }) => {
  const store = useClipStore();
  const { displayMode, isLoading, settings, currentPage, totalCount, setCurrentPage, popupSearchVisible, setPopupSearchVisible, popupTagsMenuVisible, setPopupTagsMenuVisible } = store;

  if (settings.pauseCaptureOption && settings.pauseCaptureOption !== "never") {
    console.log(
      "[Dashboard] Pause capture option:",
      settings.pauseCaptureOption,
      "pauseUntil:",
      settings.pauseUntil,
      "parsedDate:",
      new Date(settings.pauseUntil || 0).toString()
    );
  }

  const filtered = selectFilteredClips(store);
  const contentRef = useRef<HTMLDivElement>(null);
  const pageSize = isPopup ? 10 : (settings.pageSize || 10);
  const paginated = settings.paginationEnabled;
  const totalPages = paginated
    ? Math.max(1, Math.ceil(totalCount / pageSize))
    : 1;
  const pageClips = filtered;
  const pageEndCount = paginated
    ? Math.min(currentPage * pageSize, totalCount)
    : totalCount;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages, setCurrentPage]);

  const isEmpty = totalCount === 0;

  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const filteredTags = store.tags.filter((tag) =>
    tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setPopupTagsMenuVisible(false);
        setTagSearchQuery("");
      }
    };
    if (popupTagsMenuVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupTagsMenuVisible, setPopupTagsMenuVisible]);

  const [isWindowFocused, setIsWindowFocused] = useState(document.hasFocus());

  useEffect(() => {
    if (!isPopup) return;
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isPopup]);

  // Auto-close search input after inactivity (10 seconds of no user interaction, only when window has focus)
  useEffect(() => {
    if (!isPopup || !popupSearchVisible || !isWindowFocused) return;

    const timeoutMs = 10000; // 10 seconds of inactivity
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setPopupSearchVisible(false);
        store.setFilters({ search: "" });
      }, timeoutMs);
    };

    resetTimer();

    const events = ["mousedown", "mousemove", "keydown", "wheel", "touchstart"];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      clearTimeout(timer);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isPopup, popupSearchVisible, isWindowFocused, setPopupSearchVisible, store]);

  // Auto-close search and tags dropdown when window loses focus (click/interact outside the window)
  useEffect(() => {
    if (!isPopup) return;

    const handleWindowBlur = () => {
      if (popupSearchVisible) {
        const hasPersistData = store.popupSearchValue.trim().length > 0;
        if (!hasPersistData) {
          setPopupSearchVisible(false);
          store.setFilters({ search: "" });
        }
      }
      if (popupTagsMenuVisible) {
        setPopupTagsMenuVisible(false);
        setTagSearchQuery("");
      }
    };

    window.addEventListener("blur", handleWindowBlur);
    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [isPopup, popupSearchVisible, popupTagsMenuVisible, setPopupSearchVisible, setPopupTagsMenuVisible, store]);

  // Dynamically update window focusability based on search or tag dropdown visibility
  useEffect(() => {
    if (!isPopup) return;
    const isFocusable = popupSearchVisible || popupTagsMenuVisible;
    window.clipAPI.setSearchFocusable?.(isFocusable);
  }, [isPopup, popupSearchVisible, popupTagsMenuVisible]);

  const handleToggleDropdown = () => {
    const nextVal = !popupTagsMenuVisible;
    if (nextVal) {
      // Mutual Exclusivity: Close search bar when opening tags
      setPopupSearchVisible(false);
      store.setFilters({ search: "" });
    } else {
      setTagSearchQuery("");
    }
    setPopupTagsMenuVisible(nextVal);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-900">
      {/* Toolbar */}
      {isPopup ? (
        <div className="relative z-10 flex flex-col px-3 py-2 border-b border-white/5 shrink-0 bg-surface-800/40 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 w-full">
              {(["all", "favorites", "recycle"] as const).map((tab) => {
                const isActive = (tab === "all" && store.activePage === "dashboard") ||
                                 (tab === "favorites" && store.activePage === "favorites") ||
                                 (tab === "recycle" && store.activePage === "recycle");
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      store.setActivePage(tab === "all" ? "dashboard" : tab === "favorites" ? "favorites" : "recycle");
                      store.setCurrentPage(1);
                      if (isPopup) {
                        setPopupSearchVisible(false);
                        store.setFilters({ search: "" });
                      }
                      store.loadClips();
                    }}
                    className={`px-2 py-1 rounded-md text-nowrap text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none select-none whiteblink-remover ${
                      isActive
                        ? "bg-brand-500/10 border border-brand-500/25 text-brand-400"
                        : "text-gray-500 hover:text-gray-300 border border-transparent"
                    }`}
                  >
                    {tab === "recycle" ? "Recycle Bin" : tab}
                  </button>
                );
              })}
              
              <div className="w-1.5" />

              {/* Right Side Buttons (Search & Tags) */}
              <div className="ml-auto flex items-center gap-1.5 relative">
                {/* Search Toggle Button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextShowSearch = !popupSearchVisible;
                    setPopupSearchVisible(nextShowSearch);
                    if (nextShowSearch) {
                      // Mutual Exclusivity: Close tags dropdown when opening search
                      setPopupTagsMenuVisible(false);
                      setTagSearchQuery("");
                      // Restore search filter using cached popupSearchValue
                      store.setFilters({ search: store.popupSearchValue });
                      setTimeout(() => {
                        const input = useClipStore.getState().searchInputRef?.current ||
                                      (document.querySelector('input[placeholder="Search clipboard\u2026"]') as HTMLInputElement);
                        input?.focus();
                      }, 50);
                    } else {
                      // Close search and clear active filter
                      store.setFilters({ search: "" });
                    }
                  }}
                  className={`flex items-center gap-1 h-6 px-2 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none select-none whiteblink-remover ${
                    popupSearchVisible || store.filters.search
                      ? "bg-brand-500/10 border-brand-500/25 text-brand-400"
                      : "border-gray-700/50 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                  }`}
                >
                  <IconSearch size={12} />
                  <span>Search</span>
                </button>

                {/* Tags Dropdown */}
                <div ref={tagDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={handleToggleDropdown}
                    className={`flex items-center gap-1 h-6 px-2 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none select-none whiteblink-remover ${
                      popupTagsMenuVisible || store.filters.tags.length > 0
                        ? "bg-brand-500/10 border-brand-500/25 text-brand-400"
                        : "border-gray-700/50 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <IconTag size={12} />
                    <span>Tags</span>
                  {store.filters.tags.length > 0 && (
                    <span className="flex items-center justify-center min-w-[14px] h-3.5 px-1 rounded bg-brand-500 text-[8px] font-bold text-white leading-none">
                      {store.filters.tags.length}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {popupTagsMenuVisible && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                      className="absolute top-full mt-1.5 right-0 w-52 z-[100] bg-surface-800 border border-white/10 rounded-xl p-1.5 shadow-2xl"
                    >
                      {/* Search tags row styled like main SearchBar (no header, search icon, right clear and count) */}
                      <div className="relative flex items-center group w-full px-2 py-1.5 border-b border-white/5">
                        <div className="absolute left-4 text-gray-600 group-focus-within:text-brand-400 transition-colors pointer-events-none duration-150">
                          <IconSearch size={12} />
                        </div>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search tags..."
                          value={tagSearchQuery}
                          onChange={(e) => setTagSearchQuery(e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-gray-700 hover:border-gray-600 focus:border-brand-500 focus:ring-0 focus:outline-none pl-7 pr-12 py-1 text-[11px] text-white/85 placeholder-gray-600 transition-colors duration-150"
                        />
                        <div className="absolute right-3.5 flex items-center gap-1.5 pointer-events-auto">
                          <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-1 py-0.2 rounded select-none" title="Total tags">
                            {store.tags.length}
                          </span>
                          {store.filters.tags.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                store.setFilters({ tags: [] });
                                store.setCurrentPage(1);
                                store.loadClips();
                              }}
                              className="p-0.5 text-gray-600 hover:text-gray-400 hover:bg-white/5 rounded transition-all duration-150 cursor-pointer focus:outline-none focus:ring-0 select-none"
                              title="Clear tag filter"
                            >
                              <IconX size={10} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto py-1 hide-scrollbar">
                        {filteredTags.length === 0 ? (
                          <div className="text-[10px] text-gray-500 italic px-2.5 py-2">
                            {tagSearchQuery ? "No matches" : "No tags created"}
                          </div>
                        ) : (
                          filteredTags.map((tag) => {
                            const isSelected = store.filters.tags.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                  const activeTags = store.filters.tags;
                                  const newTags = activeTags.includes(tag.id)
                                    ? activeTags.filter((t) => t !== tag.id)
                                    : [...activeTags, tag.id];
                                  store.setFilters({ tags: newTags });
                                  store.setCurrentPage(1);
                                  store.loadClips();
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all duration-150 my-0.5 cursor-pointer focus:outline-none focus:ring-0 whiteblink-remover ${
                                  isSelected
                                    ? "bg-brand-500/10 text-brand-400"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  <span className="font-medium truncate">{tag.name}</span>
                                </div>
                                {isSelected && <IconCheck size={12} className="text-brand-400" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            </div>
          </div>
          
          {popupSearchVisible && (
            <div className="w-full mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <SearchBar />
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 border-white/5 shrink-0 bg-surface-800/40 backdrop-blur-sm">
          <div className="flex-1">
            <SearchBar />
          </div>
          <ViewToggle />
        </div>
      )}

      {/* Pause capturing warning banner */}
      {settings.pauseCaptureOption && settings.pauseCaptureOption !== "never" && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-400/90 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-white/95">Clipboard Capture Paused</p>
              <p className="text-[11px] text-gray-400">
                {settings.pauseCaptureOption === "restart"
                  ? "Clipboard monitoring is temporarily suspended until you restart the application."
                  : `Clipboard monitoring is suspended. Resumes at ${new Date(settings.pauseUntil || 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => store.saveSettings({ pauseCaptureOption: "never", pauseUntil: null })}
            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-xs font-medium border border-amber-500/20 hover:border-amber-500/30 text-amber-400 transition-all shrink-0"
          >
            Resume Now
          </button>
        </div>
      )}

      {/* Stats Bar */}
      {!isPopup && (
        <div className="flex items-center justify-between px-6 py-2 shrink-0 bg-surface-800/20">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {totalCount} {totalCount === 1 ? "Entry" : "Entries"} Cached
          </p>
          {paginated && !isEmpty && (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400">
              {!isPopup && (
                <PageSizeDropdown
                  value={pageSize}
                  onChange={(val) => {
                    store.saveSettings({ pageSize: val });
                    setCurrentPage(1);
                  }}
                />
              )}
              {totalCount > pageSize && (
                <>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md px-2 py-1 bg-surface-900 border border-gray-700 text-gray-300 hover:bg-surface-800 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span>
                    Page {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-md px-2 py-1 bg-surface-900 border border-gray-700 text-gray-300 hover:bg-surface-800 disabled:opacity-40"
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      <div
        ref={contentRef}
        className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar relative ${
          paginated ? "hide-scrollbar-thumb" : ""
        }`}
      >
        {isLoading ? (
          <ClipSkeleton count={5} hint="Loading clipboard history" />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className={isPopup ? "px-1.5 pt-1 pb-1" : "px-6 py-4"}>
            <ListView clips={pageClips} displayMode={displayMode} isPopup={isPopup} />
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {paginated && !isEmpty && totalCount > pageSize && (
        <div className={`flex items-center justify-between shrink-0 bg-surface-800/20 border-t border-white/5 ${isPopup ? "px-3 py-1.5" : "px-6 py-3"}`}>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <span className="text-cyan-400/75">{pageEndCount}</span> of {totalCount}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-400">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded-md px-1.5 py-0.5 bg-surface-900 border border-gray-700 text-gray-300 hover:bg-surface-800 disabled:opacity-40 focus:outline-none focus:ring-0 focus-visible:outline-none"
            >
              Prev
            </button>
            <span>
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md px-1.5 py-0.5 bg-surface-900 border border-gray-700 text-gray-300 hover:bg-surface-800 disabled:opacity-40 focus:outline-none focus:ring-0 focus-visible:outline-none"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Floating Scroll Buttons */}
      {!isEmpty && (
        <FloatingScrollButtons containerRef={contentRef} disabled={paginated} />
      )}
    </div>
  );
};

// ─── List View (Standard Scrollable) ──────────────────────────────────────
const ListView: React.FC<{
  clips: ClipboardItem[];
  displayMode: "preview" | "full";
  isPopup?: boolean;
}> = ({ clips, displayMode, isPopup }) => (
  <div className={isPopup ? "space-y-1.5" : "space-y-4"}>
    <AnimatePresence mode="popLayout">
      {clips.map((item) => (
        <EntryCard
          key={item.id}
          item={item}
          displayMode={displayMode}
          viewMode="list"
        />
      ))}
    </AnimatePresence>
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full gap-6 py-20 opacity-80">
    <div className="relative">
      <div className="absolute inset-0 bg-brand-500/20 blur-3xl rounded-full" />
      <div className="relative w-24 h-24 rounded-3xl bg-surface-800 border-2 border-gray-700 flex items-center justify-center text-gray-400">
        <IconInbox size={48} strokeWidth={1.5} />
      </div>
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-lg font-bold text-white tracking-tight">
        No Clips Found
      </h3>
      <p className="text-sm text-gray-500 max-w-[240px] leading-relaxed">
        Your clipboard history is empty. Copy some text to see it appear here.
      </p>
    </div>
  </div>
);

export default Dashboard;
