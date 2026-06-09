import React from "react";
import logoIcon from "@/assets/icon.png";
import { useClipStore } from "../store/useClipStore";
import FilterPanel from "./FilterPanel";
import TagManager from "./TagManager";
import type { ActivePage } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconGrid,
  IconTrash,
  IconSettings,
  IconClock,
  IconZap,
  IconStar,
  IconTag,
  IconChevronUp,
  IconChevronDown,
} from "./Icons";

const NAV_ITEMS: { page: ActivePage; icon: any; label: string }[] = [
  { page: "dashboard", icon: IconGrid, label: "All Clips" },
  { page: "favorites", icon: IconStar, label: "Favourites" },
  { page: "tags", icon: IconTag, label: "Manage Tags" },
  { page: "recycle", icon: IconTrash, label: "Recycle Bin" },
  { page: "settings", icon: IconSettings, label: "Settings" },
];

const Sidebar: React.FC = () => {
  const {
    activePage,
    setActivePage,
    clips,
    tags,
    mongoConnected,
    atlasConnected,
    syncState,
    loadClips,
    settings,
  } = useClipStore();

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [hasMoreTop, setHasMoreTop] = React.useState(false);
  const [hasMoreBottom, setHasMoreBottom] = React.useState(false);

  const updateScrollState = React.useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isScrollable = scrollHeight > clientHeight;

      setHasMoreTop(isScrollable && scrollTop > 5);
      setHasMoreBottom(
        isScrollable && scrollTop + clientHeight < scrollHeight - 5,
      );

      if (!isScrollable) {
        setScrollProgress(0);
      } else {
        const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
        setScrollProgress(progress);
      }
    }
  }, []);

  React.useEffect(() => {
    updateScrollState();
    // Add a small delay to ensure DOM is settled
    const timer = setTimeout(updateScrollState, 100);
    return () => clearTimeout(timer);
  }, [tags, clips, updateScrollState]);

  const latestClipTimestamp = React.useMemo(() => {
    if (clips.length === 0) return 0;
    // Include all non-deleted clips for sync reference
    const validClips = clips.filter((c) => !c.isDeleted);
    if (validClips.length === 0) return 0;
    return Math.max(
      ...validClips.map((c) => new Date(c.updatedAt || c.timestamp).getTime()),
    );
  }, [clips]);

  const localHealth = React.useMemo(() => {
    if (!settings.mongoEnabled || !mongoConnected) return "error";
    if (!syncState.lastLocalSyncedAt || !latestClipTimestamp) return "ok";
    return new Date(syncState.lastLocalSyncedAt).getTime() >=
      latestClipTimestamp
      ? "ok"
      : "stale";
  }, [
    settings.mongoEnabled,
    mongoConnected,
    syncState.lastLocalSyncedAt,
    latestClipTimestamp,
  ]);

  const cloudHealth = React.useMemo(() => {
    if (!settings.atlasEnabled || !atlasConnected) return "error";
    if (!syncState.lastCloudSyncedAt || !latestClipTimestamp) return "ok";
    return new Date(syncState.lastCloudSyncedAt).getTime() >=
      latestClipTimestamp
      ? "ok"
      : "stale";
  }, [
    settings.atlasEnabled,
    atlasConnected,
    syncState.lastCloudSyncedAt,
    latestClipTimestamp,
  ]);

  const getStatusColor = (health: "error" | "stale" | "ok") => {
    if (health === "error")
      return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]";
    if (health === "stale")
      return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]";
    return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
  };

  const fmtTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

  const activeCount = clips.filter((c) => !c.isDeleted).length;
  const favoritesCount = clips.filter(
    (c) => c.isFavorite && !c.isDeleted,
  ).length;
  const deletedCount = clips.filter((c) => c.isDeleted).length;

  const getCounts = (page: ActivePage) => {
    if (page === "dashboard") return activeCount;
    if (page === "favorites") return favoritesCount;
    if (page === "recycle") return deletedCount;
    if (page === "tags") return tags.length;
    return null;
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-surface-900 border-r border-gray-700 h-full overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-4 border-gray-700">
        <div className="flex items-center gap-2">
          <img
            src={logoIcon}
            alt="ClipMaster Logo"
            className="size-9 mb-1 shrink-0 drop-shadow-lg"
          />

          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white tracking-tight leading-none">
              ClipMaster
            </h1>
            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-wider mt-0.5">
              Pro Edition
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-0.5">
        {NAV_ITEMS.map(({ page, icon: Icon, label }) => {
          const count = getCounts(page);
          const isActive = activePage === page;
          return (
            <button
              key={page}
              onClick={() => {
                setActivePage(page);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150 active:scale-95 group ${
                isActive
                  ? "bg-gray-800 text-brand-400 border-gray-700 shadow-sm"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon
                  size={16}
                  className={`transition-colors duration-150 ${
                    isActive
                      ? "text-brand-400"
                      : "text-gray-500 group-hover:text-gray-300"
                  }`}
                />
                <span className="font-medium">{label}</span>
              </div>
              {count !== null && count > 0 && (
                <span
                  className={`text-[10px] px-2 pt-0.5 rounded-full font-bold tabular-nums transition-all duration-300 backdrop-blur-md shadow-sm ${
                    isActive
                      ? page === "recycle"
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-brand-500/20 text-brand-300 border-brand-500/30"
                      : "bg-white/5 text-gray-500 border-white/5 group-hover:border-white/10 group-hover:bg-white/10 group-hover:text-gray-300"
                  } ${page === "dashboard" && "pb-[1px]"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-700/50 my-1" />

      {/* Scrollable filter area with Custom Indicator & Compact Buttons */}
      <div className="flex-1 relative overflow-hidden group/filters">
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="h-full overflow-y-auto px-2 py-2 space-y-4 scrollbar-hide [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [ms-overflow-style:none] [scrollbar-width:none]"
        >
          <FilterPanel />
        </div>

        {/* Top/Bottom Faded Edges */}
        <div
          className={`absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-surface-900 to-transparent pointer-events-none transition-opacity duration-300 ${hasMoreTop ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-surface-900 to-transparent pointer-events-none transition-opacity duration-300 ${hasMoreBottom ? "opacity-100" : "opacity-0"}`}
        />

        {/* Compact Scroll to Top Button (Top Corner) */}
        <div className="absolute right-3 top-4 z-20 pointer-events-none">
          <AnimatePresence>
            {hasMoreTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5, y: -5 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  borderColor: [
                    "rgba(255, 255, 255, 0.1)",
                    "rgba(59, 130, 246, 0.5)",
                    "rgba(255, 255, 255, 0.1)",
                  ],
                  boxShadow: [
                    "0 0 0px rgba(59, 130, 246, 0)",
                    "0 0 10px rgba(59, 130, 246, 0.2)",
                    "0 0 0px rgba(59, 130, 246, 0)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.5, 1],
                  opacity: { duration: 0.2, repeat: 0 },
                  scale: { duration: 0.2, repeat: 0 },
                  y: { duration: 0.2, repeat: 0 },
                }}
                exit={{ opacity: 0, scale: 0.5, y: -5 }}
                whileHover={{
                  scale: 1.1,
                  backgroundColor: "rgba(255,255,255,0.1)",
                }}
                whileTap={{ scale: 0.9 }}
                onClick={() =>
                  scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
                }
                className="w-5 h-5 rounded bg-surface-800/90 border border-white/10 text-gray-400 hover:text-brand-400 flex items-center justify-center backdrop-blur-md shadow-xl pointer-events-auto transition-colors"
                title="Scroll to Top"
              >
                <IconChevronUp size={12} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Compact Scroll to Bottom Button (Bottom Corner) */}
        <div className="absolute right-3 bottom-4 z-20 pointer-events-none">
          <AnimatePresence>
            {hasMoreBottom && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5, y: 5 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  borderColor: [
                    "rgba(255, 255, 255, 0.1)",
                    "rgba(59, 130, 246, 0.5)",
                    "rgba(255, 255, 255, 0.1)",
                  ],
                  boxShadow: [
                    "0 0 0px rgba(59, 130, 246, 0)",
                    "0 0 10px rgba(59, 130, 246, 0.2)",
                    "0 0 0px rgba(59, 130, 246, 0)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.5, 1],
                  opacity: { duration: 0.2, repeat: 0 },
                  scale: { duration: 0.2, repeat: 0 },
                  y: { duration: 0.2, repeat: 0 },
                }}
                exit={{ opacity: 0, scale: 0.5, y: 5 }}
                whileHover={{
                  scale: 1.1,
                  backgroundColor: "rgba(255,255,255,0.1)",
                }}
                whileTap={{ scale: 0.9 }}
                onClick={() =>
                  scrollRef.current?.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: "smooth",
                  })
                }
                className="w-5 h-5 rounded bg-surface-800/90 border border-white/10 text-gray-400 hover:text-brand-400 flex items-center justify-center backdrop-blur-md shadow-xl pointer-events-auto transition-colors"
                title="Scroll to Bottom"
              >
                <IconChevronDown size={12} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-700/50 my-1" />

      {/* Bottom status */}
      <div className="px-4 py-3 border-gray-700 space-y-2.5">
        <div className="flex items-center gap-2 px-1 mb-1">
          <IconZap size={10} className="text-brand-500" />
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em]">
            Sync Health
          </span>
        </div>

        {/* Local Status */}
        <div className="flex items-center justify-between group/local cursor-default">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span
                className={`block w-1.5 h-1.5 rounded-full transition-all duration-500 ${getStatusColor(localHealth)}`}
              />
              {localHealth === "ok" && (
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-20" />
              )}
            </div>
            <span className="text-[10px] font-bold text-gray-400 group-hover/local:text-gray-300 transition-colors uppercase tracking-tight">
              Local
            </span>
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-gray-500 group-hover/local:text-brand-400 transition-colors">
            {syncState.lastLocalSyncedAt
              ? fmtTime(syncState.lastLocalSyncedAt)
              : "OFF"}
          </span>
        </div>

        {/* Cloud Status */}
        <div className="flex items-center justify-between group/cloud cursor-default">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span
                className={`block w-1.5 h-1.5 rounded-full transition-all duration-500 ${getStatusColor(cloudHealth)}`}
              />
              {cloudHealth === "ok" && (
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-20" />
              )}
            </div>
            <span className="text-[10px] font-bold text-gray-400 group-hover/cloud:text-gray-300 transition-colors uppercase tracking-tight">
              Cloud
            </span>
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-gray-500 group-hover/cloud:text-brand-400 transition-colors">
            {syncState.lastCloudSyncedAt
              ? fmtTime(syncState.lastCloudSyncedAt)
              : "OFF"}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
