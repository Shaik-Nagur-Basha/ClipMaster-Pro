import React, { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useClipStore, selectFilteredClips } from "../store/useClipStore";
import EntryCard from "../components/EntryCard";
import SearchBar from "../components/SearchBar";
import ViewToggle from "../components/ViewToggle";
import FloatingScrollButtons from "../components/FloatingScrollButtons";
import { IconStar } from "../components/Icons";
import { ClipSkeleton, FullPageSpinner } from "../components/LoadingSpinner";
import type { ClipboardItem } from "../types";
import PageSizeDropdown from "../components/PageSizeDropdown";

const FavoritesPage: React.FC = () => {
  const store = useClipStore();
  const { displayMode, isLoading, settings, currentPage, totalCount, setCurrentPage } = store;
  const contentRef = useRef<HTMLDivElement>(null);
  const pageSize = settings.pageSize || 10;
  const paginated = settings.paginationEnabled;

  const filtered = selectFilteredClips(store);
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

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-900">
      {/* Toolbar */}
      <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-2.5 border-white/5 shrink-0 bg-surface-900 backdrop-blur-sm">
        <div className="flex-1 max-w-2xl">
          <SearchBar />
        </div>
        <ViewToggle />
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between px-6 py-1.5 shrink-0 bg-surface-900">
        <div className="flex items-center gap-2">
          <IconStar size={14} className="text-accent-500" />
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {totalCount} Favourite {totalCount === 1 ? "Entry" : "Entries"}
          </p>
        </div>
        {paginated && !isEmpty && (
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400">
            <PageSizeDropdown
              value={pageSize}
              onChange={(val) => {
                store.saveSettings({ pageSize: val });
                setCurrentPage(1);
              }}
            />
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

      {/* Content Area */}
      <div
        ref={contentRef}
        className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar border-l border-t border-violet-500/10 rounded-tl-2xl relative bg-gradient-to-b from-[#100a18] via-[#09070c] to-[#0a0a0f] ${
          paginated && !isEmpty && totalCount > pageSize ? "border-b border-violet-500/10 rounded-bl-2xl" : ""
        } ${paginated ? "hide-scrollbar-thumb" : ""}`}
        style={{
          boxShadow: "inset 1px 1px 0px rgba(255, 255, 255, 0.15), inset -1px -1px 0px rgba(0, 0, 0, 0.5), inset 0 0 32px rgba(139, 92, 246, 0.08), 0 20px 40px -12px rgba(0, 0, 0, 0.65)"
        }}
      >
        {isLoading ? (
          paginated ? (
            <ClipSkeleton count={5} hint="Fetching your starred clips" />
          ) : (
            <FullPageSpinner label="Loading" subtitle="Fetching your starred clips" />
          )
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="px-6 py-4">
            <ListView clips={pageClips} displayMode={displayMode} />
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {paginated && !isEmpty && totalCount > pageSize && (
        <div className="flex items-center justify-between px-6 py-1.5 shrink-0 bg-surface-900">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <span className="text-cyan-400/75">{pageEndCount}</span> of {totalCount} favourites
          </p>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-400 cursor-default">
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
}> = ({ clips, displayMode }) => (
  <div className="space-y-4">
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
      <div className="absolute inset-0 bg-accent-500/10 blur-3xl rounded-full" />
      <div className="relative w-24 h-24 rounded-3xl bg-surface-800 border-2 border-gray-700 flex items-center justify-center text-accent-500/60 shadow-lg shadow-accent-500/10">
        <IconStar size={48} strokeWidth={1.5} />
      </div>
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-lg font-bold text-white tracking-tight">
        No Favourites Yet
      </h3>
      <p className="text-sm text-gray-500 max-w-[240px] leading-relaxed">
        Star your important clips to keep them separate and easy to find.
      </p>
    </div>
  </div>
);

export default FavoritesPage;
