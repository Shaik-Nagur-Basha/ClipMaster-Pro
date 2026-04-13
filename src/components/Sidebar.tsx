import React from "react";
import logoIcon from "@/assets/icon.png";
import { useClipStore } from "../store/useClipStore";
import FilterPanel from "./FilterPanel";
import TagManager from "./TagManager";
import type { ActivePage } from "../types";
import {
  IconGrid,
  IconTrash,
  IconSettings,
  IconClock,
  IconZap,
  IconStar,
  IconTag,
} from "./Icons";

const NAV_ITEMS: { page: ActivePage; icon: any; label: string }[] = [
  { page: "dashboard", icon: IconGrid, label: "All Clips" },
  { page: "favorites", icon: IconStar, label: "Favorites" },
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
    loadSettings,
    settings,
  } = useClipStore();

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

      {/* Scrollable filter area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4 scrollbar-hide [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent">
        <FilterPanel />
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
