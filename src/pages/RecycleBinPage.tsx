import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useClipStore, selectFilteredClips } from "../store/useClipStore";
import EntryCard from "../components/EntryCard";
import SearchBar from "../components/SearchBar";
import ViewToggle from "../components/ViewToggle";
import FloatingScrollButtons from "../components/FloatingScrollButtons";
import Dialog from "../components/Dialog";
import { IconTrash } from "../components/Icons";
import { ClipSkeleton } from "../components/LoadingSpinner";
import type { ClipboardItem } from "../types";
import PageSizeDropdown from "../components/PageSizeDropdown";

const RecycleBinPage: React.FC = () => {
  const store = useClipStore();
  const { displayMode, isLoading, permanentDeleteBulk, settings } = store;
  const filtered = selectFilteredClips(store, true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = settings.pageSize || 10;
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
  const [emptying, setEmptying] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const handleEmptyBin = async () => {
    setEmptying(true);
    try {
      const ids = filtered.map((item) => item.id);
      await permanentDeleteBulk(ids);
    } catch (error) {
      console.error("Bulk delete failed:", error);
    } finally {
      setEmptying(false);
      setShowConfirmDialog(false);
    }
  };

  const handleOpenConfirm = () => {
    setShowConfirmDialog(true);
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-900">
      {/* Toolbar */}
      <div className="relative z-10 flex items-center gap-4 px-6 py-4 border-white/5 shrink-0 bg-surface-800/40 backdrop-blur-sm">
        <div className="flex-1 max-w-2xl">
          <SearchBar />
        </div>
        <ViewToggle />
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between px-6 py-2 shrink-0 bg-surface-800/20">
        <div className="flex items-center gap-2">
          <IconTrash size={14} className="text-gray-500" />
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {filtered.length} Deleted{" "}
            {filtered.length === 1 ? "Entry" : "Entries"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {paginated && !isEmpty && (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400">
              <PageSizeDropdown
                value={pageSize}
                onChange={(val) => {
                  store.saveSettings({ pageSize: val });
                  setCurrentPage(1);
                }}
              />
              {filtered.length > pageSize && (
                <>
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
                </>
              )}
            </div>
          )}
          {!isEmpty && (
            <button
              onClick={handleOpenConfirm}
              disabled={emptying || isLoading}
              className="text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 transition-all disabled:opacity-30 active:scale-95"
            >
              {emptying ? "Clearing…" : "Empty Bin"}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        isOpen={showConfirmDialog}
        onClose={handleCancelConfirm}
        title="Confirm Permanent Deletion"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <IconTrash size={18} className="text-red-500" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-100 mb-1">
                This action cannot be undone
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                You are about to permanently delete{" "}
                <span className="font-semibold text-red-400">
                  {filtered.length} {filtered.length === 1 ? "item" : "items"}
                </span>{" "}
                from the recycle bin. Once deleted, they cannot be recovered.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCancelConfirm}
              className="flex-1 px-3 py-2 rounded-md border border-gray-600/50 text-gray-300 hover:text-white hover:bg-gray-700/30 hover:border-gray-500/70 bg-gray-800/20 transition-all duration-150 text-xs font-medium uppercase tracking-wide"
            >
              Cancel
            </button>
            <button
              onClick={handleEmptyBin}
              disabled={emptying}
              className="flex-1 px-3 py-2 rounded-md bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 hover:shadow-md hover:shadow-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all duration-150 text-xs font-medium uppercase tracking-wide"
            >
              {emptying ? "Deleting…" : "Delete All"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Content Area */}
      <div
        ref={contentRef}
        className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar relative ${
          paginated ? "hide-scrollbar-thumb" : ""
        }`}
      >
        {isLoading ? (
          <ClipSkeleton count={5} />
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
            <span className="text-cyan-400/75">{pageEndCount}</span> of {filtered.length} deleted items
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
      <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full" />
      <div className="relative w-24 h-24 rounded-3xl bg-surface-800 border-gray-700 flex items-center justify-center text-gray-500">
        <IconTrash size={48} strokeWidth={1.5} />
      </div>
    </div>
    <div className="text-center space-y-2">
      <h3 className="text-lg font-bold text-white tracking-tight">
        Recycle Bin Empty
      </h3>
      <p className="text-sm text-gray-500 max-w-[240px] leading-relaxed">
        Items you delete from the dashboard will appear here temporarily.
      </p>
    </div>
  </div>
);


export default RecycleBinPage;
