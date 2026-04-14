import React, { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useClipStore, selectFilteredClips } from "../store/useClipStore";
import EntryCard from "../components/EntryCard";
import SearchBar from "../components/SearchBar";
import ViewToggle from "../components/ViewToggle";
import FloatingScrollButtons from "../components/FloatingScrollButtons";
import Dialog from "../components/Dialog";
import { IconTrash } from "../components/Icons";
import type { ClipboardItem } from "../types";

const RecycleBinPage: React.FC = () => {
  const store = useClipStore();
  const { viewMode, displayMode, isLoading, permanentDelete } = store;
  const filtered = selectFilteredClips(store, true);
  const contentRef = useRef<HTMLDivElement>(null);

  const isEmpty = filtered.length === 0;
  const [emptying, setEmptying] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const handleEmptyBin = async () => {
    setEmptying(true);
    for (const item of filtered) {
      await permanentDelete(item.id);
    }
    setEmptying(false);
    setShowConfirmDialog(false);
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
      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="px-6 py-4">
            <ListView clips={filtered} displayMode={displayMode} />
          </div>
        )}
      </div>

      {/* Floating Scroll Buttons */}
      {!isEmpty && <FloatingScrollButtons containerRef={contentRef} />}
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

// ─── Loading Skeleton ─────────────────────────────────────────────────────
const LoadingSkeleton: React.FC = () => (
  <div className="px-6 py-6 space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className="h-32 rounded-xl bg-surface-800 border-gray-700/50 animate-pulse"
        style={{ opacity: 1 - i * 0.15 }}
      />
    ))}
  </div>
);

export default RecycleBinPage;
