import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useClipStore, selectFilteredClips } from "../store/useClipStore";
import EntryCard from "../components/EntryCard";
import SearchBar from "../components/SearchBar";
import ViewToggle from "../components/ViewToggle";
import FloatingScrollButtons from "../components/FloatingScrollButtons";
import { IconInbox } from "../components/Icons";
import type { ClipboardItem } from "../types";

const Dashboard: React.FC = () => {
  const store = useClipStore();
  const { displayMode, isLoading, settings } = store;

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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const paginated = settings.paginationEnabled;
  const totalPages = paginated
    ? Math.max(1, Math.ceil(filtered.length / pageSize))
    : 1;
  const pageClips = paginated
    ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filtered;
  const pageEndCount = paginated
    ? Math.min(currentPage * pageSize, filtered.length)
    : filtered.length;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const isEmpty = filtered.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-900">
      {/* Toolbar */}
      <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 border-white/5 shrink-0 bg-surface-800/40 backdrop-blur-sm">
        <div className="flex-1">
          <SearchBar />
        </div>
        <ViewToggle />
      </div>

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
      <div className="flex items-center justify-between px-6 py-2 shrink-0 bg-surface-800/20">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          {filtered.length} {filtered.length === 1 ? "Entry" : "Entries"} Cached
        </p>
        {paginated && filtered.length > pageSize && (
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-md px-2 py-1 bg-surface-900 border border-gray-700 text-gray-300 hover:bg-surface-800 disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {currentPage}/{totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-md px-2 py-1 bg-surface-900 border border-gray-700 text-gray-300 hover:bg-surface-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div
        ref={contentRef}
        className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar relative ${
          paginated ? "hide-scrollbar-thumb" : ""
        }`}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="px-6 py-4">
            <ListView clips={pageClips} displayMode={displayMode} />
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {paginated && !isEmpty && filtered.length > pageSize && (
        <div className="flex items-center justify-between px-6 py-3 shrink-0 bg-surface-800/20 border-t border-white/5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <span className="text-cyan-400/75">{pageEndCount}</span> of {filtered.length} entries
          </p>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-md px-2 py-1 bg-surface-900 border border-gray-700 text-gray-300 hover:bg-surface-800 disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {currentPage}/{totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-md px-2 py-1 bg-surface-900 border border-gray-700 text-gray-300 hover:bg-surface-800 disabled:opacity-40"
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

// ─── Loading Skeleton ─────────────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className="h-32 rounded-xl bg-surface-800 border border-gray-700/50 animate-pulse"
        style={{ opacity: 1 - i * 0.15 }}
      />
    ))}
  </div>
);

export default Dashboard;
