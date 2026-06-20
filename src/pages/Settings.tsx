import React, { useState, useEffect, useRef } from "react";
import logoIcon from "@/assets/icon.png";
import { useClipStore } from "../store/useClipStore";
import { useUpdateStore } from "../store/useUpdateStore";
import { UpdateSettings } from "../components/UpdateSettings";
import { ExportWizard } from "../components/ExportWizard";
import { ImportWizard } from "../components/ImportWizard";
import { BulkActionWizard } from "../components/BulkActionWizard";
import type { BulkActionType } from "../components/BulkActionWizard";
import { APP_VERSION, APP_NAME, APP_BUILD_TYPE } from "../constants";
import { FullPageSpinner } from "../components/LoadingSpinner";
import {
  IconSettings,
  IconMonitor,
  IconDatabase,
  IconCloud,
  IconRefresh,
  IconInfo,
  IconChevronDown,
  IconShield,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconLayers,
  IconMinimize,
  IconTrash,
  IconClock,
  IconZap,
  IconEye,
  IconSave,
  IconRestore,
  IconArrowUp,
  IconArrowDown,
  IconEdit,
  IconList,
  IconStar,
  IconTag,
} from "../components/Icons";
import { motion, AnimatePresence } from "framer-motion";
import Dialog from "../components/Dialog";

const Settings: React.FC = () => {
  const { settings, saveSettings, loadSettings, clips } = useClipStore();

  const { updateStatus, downloadProgress } = useUpdateStore();
  const [showUpdatesDialog, setShowUpdatesDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [showExportWizard, setShowExportWizard] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<BulkActionType | null>(
    null,
  );
  const [clearingCache, setClearingCache] = useState(false);
  const [clearCacheStep, setClearCacheStep] = useState(0);
  const [clearCacheStatus, setClearCacheStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [clearCacheError, setClearCacheError] = useState("");

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);

  useEffect(() => {
    setSettingsLoading(true);
    loadSettings().finally(() => {
      setSettingsLoading(false);
      useUpdateStore.getState().fetchReleases();
    });
  }, []); // eslint-disable-line

  const handleResetAll = async () => {
    if (resetConfirmText !== "RESET ALL") {
      return;
    }
    setResetting(true);
    try {
      const ok = await window.clipAPI.resetAll();
      if (ok) {
        // Clear local state
        setResetConfirmText("");
        setShowResetDialog(false);
        // Reload all data after reset
        setTimeout(async () => {
          // Reload clips, tags, and settings from storage
          const store = useClipStore.getState();
          await Promise.all([
            store.loadClips(),
            store.loadTags(),
            loadSettings(),
          ]);
          // Reset UI state
          store.resetFilters();
          store.setActivePage("dashboard");
        }, 500);
      }
    } catch (e) {
      console.error("Failed to reset:", e);
    } finally {
      setResetting(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    setClearCacheStatus("running");
    setClearCacheStep(0);
    setClearCacheError("");
    setShowClearCacheDialog(true);

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // Step 0: Initialize
      await delay(600);

      // Step 1: Scanning temp files
      setClearCacheStep(1);
      await delay(800);

      // Step 2: Purging downloaded version assets
      setClearCacheStep(2);
      await delay(800);

      // Step 3: Clearing web application cache
      setClearCacheStep(3);
      await delay(800);

      // Step 4: Compacting database files
      setClearCacheStep(4);
      const success = window.clipAPI?.advancedClearCache
        ? await window.clipAPI.advancedClearCache()
        : window.clipAPI?.clearCache
          ? await window.clipAPI.clearCache()
          : true;
      if (!success) {
        throw new Error("Failed to clear cache in main process");
      }
      await delay(1000);

      // Step 5: Clearing singleton lock files & repairing startup tasks
      setClearCacheStep(5);
      await delay(700);

      // Step 6: Re-indexing clip records
      setClearCacheStep(6);
      const store = useClipStore.getState();
      // Also reset the update store state (downloads cleared)
      useUpdateStore.getState().resetProgress();
      await Promise.all([store.loadClips(), store.loadTags()]);
      await delay(600);

      // Complete
      setClearCacheStep(7);
      setClearCacheStatus("done");
    } catch (err: any) {
      console.error("Clear cache failed:", err);
      setClearCacheStatus("error");
      setClearCacheError(
        err.message || "An error occurred during cache clearance.",
      );
    } finally {
      setClearingCache(false);
    }
  };

  const fmtTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  if (settingsLoading) {
    return (
      <FullPageSpinner
        label="Settings"
        subtitle="Loading your environment & sync configuration"
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-900 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-6 py-3.5 border-gray-700 bg-surface-800/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-gray-700/50 border-gray-600/50 text-gray-400">
            <IconSettings size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-white/90">
              Settings
            </h2>
            <p className="text-[11px] text-gray-500">
              Application configuration and synchronization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearCache}
            disabled={clearingCache}
            className="text-nowrap inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-surface-800 px-3 py-1.5 text-xs text-gray-300 transition hover:border-white/20 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
            title="Advanced cache clear: removes lock files, stale state, and repairs startup tasks"
          >
            <IconTrash size={14} className="text-rose-400" />
            <span>Advanced Clear Cache</span>
          </button>

          {updateStatus === "downloading" ? (
            <button
              type="button"
              onClick={() => setShowUpdatesDialog(true)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 font-semibold transition hover:border-amber-500/50 hover:bg-amber-500/20 cursor-pointer"
              title="Downloading update"
            >
              <IconRefresh size={14} className="animate-spin" />
              <span className="tabular-nums">
                Downloading {downloadProgress}%
              </span>
            </button>
          ) : updateStatus === "ready" ? (
            <button
              type="button"
              onClick={() => setShowUpdatesDialog(true)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 font-semibold transition hover:border-amber-500/50 hover:bg-amber-500/20 cursor-pointer"
              title="Update ready to install"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Install Update</span>
            </button>
          ) : updateStatus === "checking" ? (
            <button
              type="button"
              onClick={() => setShowUpdatesDialog(true)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 font-semibold transition hover:border-amber-500/50 hover:bg-amber-500/20 cursor-pointer"
              title="Checking for updates"
            >
              <IconRefresh size={14} className="animate-spin" />
              <span>Checking...</span>
            </button>
          ) : updateStatus === "available" ? (
            <button
              type="button"
              onClick={() => setShowUpdatesDialog(true)}
              className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 font-semibold transition hover:border-blue-500/50 hover:bg-blue-500/20 cursor-pointer animate-pulse"
              title="New version available"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span>New Version</span>
            </button>
          ) : updateStatus === "error" ? (
            <button
              type="button"
              onClick={() => setShowUpdatesDialog(true)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-400 font-semibold transition hover:border-rose-500/50 hover:bg-rose-500/20 cursor-pointer"
              title="Update error"
            >
              <IconAlertCircle size={14} />
              <span>Update Error</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowUpdatesDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-surface-800 px-3 py-1.5 text-xs text-gray-300 transition hover:border-white/20 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Application updates"
            >
              <IconRefresh size={14} />
              <span>Updates</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowShortcutDialog(true)}
            className="inline-flex items-center justify-center rounded-full border border-gray-700 bg-surface-800 p-2 text-gray-300 transition hover:border-white/20 hover:text-white hover:bg-white/10 cursor-pointer"
            title="Show keyboard shortcuts"
          >
            <IconInfo size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 settings-scrollbar">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* General Section */}
          <Section
            title="General Presence"
            icon={<IconMonitor size={14} className="text-gray-500" />}
          >
            <div className="space-y-2">
              <SettingRow
                label="Launch at Windows startup"
                desc="Start ClipMaster Pro automatically with admin rights on login via Task Scheduler."
                icon={<IconZap size={13} />}
              >
                <Toggle
                  checked={settings.autoLaunch}
                  onChange={(v) => saveSettings({ autoLaunch: v })}
                />
              </SettingRow>

              <SettingRow
                label="Max stored clips"
                desc="Clip capture is stopped when the limit is reached."
                icon={<IconDatabase size={13} />}
              >
                <MaxClipsSelector
                  value={settings.maxEntries}
                  onChange={(v) => saveSettings({ maxEntries: v })}
                />
              </SettingRow>

              <SettingRow
                label="Enable pagination"
                desc="Show clips page-by-page in dashboard, favourites, and recycle bin."
                icon={<IconLayers size={13} />}
              >
                <Toggle
                  checked={settings.paginationEnabled}
                  onChange={(v) => saveSettings({ paginationEnabled: v })}
                />
              </SettingRow>

              <SettingRow
                label="Pause capturing of clips"
                desc="Temporarily disable clipboard capture monitoring."
                icon={<IconClock size={13} />}
              >
                <CustomSelect
                  value={settings.pauseCaptureOption || "never"}
                  onChange={(v) => saveSettings({ pauseCaptureOption: v })}
                  options={[
                    {
                      label: "Never",
                      value: "never",
                      icon: <IconShield size={14} />,
                    },
                    {
                      label: "Pause for 15 mins",
                      value: "15mins",
                      icon: <IconClock size={14} />,
                    },
                    {
                      label: "Pause for 30 mins",
                      value: "30mins",
                      icon: <IconClock size={14} />,
                    },
                    {
                      label: "Pause for 1 hour",
                      value: "1hour",
                      icon: <IconClock size={14} />,
                    },
                    {
                      label: "Pause until restart",
                      value: "restart",
                      icon: <IconRefresh size={14} />,
                    },
                  ]}
                />
              </SettingRow>

              <SettingRow
                label="Global shortcut key"
                desc="Click record and press your desired key combination (default: Ctrl + Shift + V)."
                icon={<IconZap size={13} />}
              >
                <ShortcutRecorder
                  value={
                    settings.globalShortcutKey || "CommandOrControl+Shift+V"
                  }
                  onChange={(v) => saveSettings({ globalShortcutKey: v })}
                />
              </SettingRow>
            </div>
          </Section>

          {/* End Sync Status Overlay */}

          {/* Data Management & Reset */}
          <Section
            title="Data Management"
            icon={<IconAlertCircle size={14} className="text-rose-500/60" />}
          >
            <div className="space-y-4 pt-1">
              {/* ── ROW 1: Bulk Actions (1/2) + Export + Import ── */}
              <div className="flex gap-4 items-stretch">
                {/* LEFT: Bulk Actions — half width */}
                <div className="w-1/2 flex flex-col justify-between p-5 rounded-2xl bg-surface-800/40 hover:bg-surface-800/80 transition-all duration-300 group">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 group-hover:scale-105 transition-transform duration-300 shrink-0">
                        <IconLayers size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                          Bulk Actions
                        </h4>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          Batch-operate on filtered clips
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="space-y-1">
                      {(
                        [
                          {
                            value: "move-to-recycle",
                            label: "Move to Recycle Bin",
                            desc: "Soft-delete active clips",
                            color: "text-rose-400",
                            icon: (
                              <IconTrash
                                size={15}
                                className="text-rose-400 shrink-0"
                              />
                            ),
                            hoverBg: "hover:bg-rose-500/5",
                            delayClass: "shiny-delay-1",
                            shinyColor: "244, 63, 94",
                          },
                          {
                            value: "restore-from-recycle",
                            label: "Restore From Recycle Bin",
                            desc: "Recover deleted clips",
                            color: "text-emerald-400",
                            icon: (
                              <IconRestore
                                size={15}
                                className="text-emerald-400 shrink-0"
                              />
                            ),
                            hoverBg: "hover:bg-emerald-500/5",
                            delayClass: "shiny-delay-2",
                            shinyColor: "16, 185, 129",
                          },
                          {
                            value: "move-to-favourites",
                            label: "Move to Favourites",
                            desc: "Star clips in bulk",
                            color: "text-amber-400",
                            icon: (
                              <IconStar
                                size={15}
                                className="text-amber-400 shrink-0"
                              />
                            ),
                            hoverBg: "hover:bg-amber-500/5",
                            delayClass: "shiny-delay-3",
                            shinyColor: "245, 158, 11",
                          },
                          {
                            value: "attach-tags",
                            label: "Attach Tag(s)",
                            desc: "Bulk-tag a clip selection",
                            color: "text-violet-400",
                            icon: (
                              <IconTag
                                size={15}
                                className="text-violet-400 shrink-0"
                              />
                            ),
                            hoverBg: "hover:bg-violet-500/5",
                            delayClass: "shiny-delay-4",
                            shinyColor: "139, 92, 246",
                          },
                        ] as {
                          value: BulkActionType;
                          label: string;
                          desc: string;
                          color: string;
                          icon: React.ReactNode;
                          hoverBg: string;
                          delayClass: string;
                          shinyColor: string;
                        }[]
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBulkActionType(opt.value)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent ${opt.hoverBg} transition-all duration-150 cursor-pointer group/row text-left shiny-card-effect ${opt.delayClass}`}
                          style={
                            {
                              "--shiny-color": opt.shinyColor,
                            } as React.CSSProperties
                          }
                        >
                          <div className="opacity-70 group-hover/row:opacity-100 transition-opacity">
                            {opt.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span
                              className={`block text-[11px] font-semibold text-gray-300 group-hover/row:${opt.color} transition-colors leading-snug`}
                            >
                              {opt.label}
                            </span>
                            <span className="block text-[10px] text-gray-600 group-hover/row:text-gray-500 transition-colors leading-tight mt-0.5 truncate">
                              {opt.desc}
                            </span>
                          </div>
                          <svg
                            className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover/row:opacity-30 transition-opacity"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="mt-4 text-[10px] text-gray-700 text-center">
                    Click an action to open its wizard
                  </p>
                </div>

                {/* RIGHT: Export + Import stacked */}
                <div className="flex-1 flex flex-col gap-4">
                  {/* Export System */}
                  <div className="flex-1 flex flex-col justify-between p-5 rounded-2xl bg-surface-800/40 hover:bg-surface-800/80 transition-all duration-300 group">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 group-hover:scale-105 transition-transform duration-300 shrink-0">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                        </div>
                        <h4 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">
                          Export Data
                        </h4>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Export clipboard entries, tags, and settings to Excel,
                        JSON, PDF, or Raw files.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowExportWizard(true)}
                      className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-xs font-semibold text-brand-400 active:scale-95 transition-all cursor-pointer shiny-card-effect"
                      style={
                        {
                          "--shiny-color": "99, 102, 241",
                        } as React.CSSProperties
                      }
                    >
                      <IconArrowUp size={14} />
                      <span>Start Export</span>
                    </button>
                  </div>

                  {/* Import System */}
                  <div className="flex-1 flex flex-col justify-between p-5 rounded-2xl bg-surface-800/40 hover:bg-surface-800/80 transition-all duration-300 group">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform duration-300 shrink-0">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </div>
                        <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          Import Data
                        </h4>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Restore clips, tags, and settings from a JSON or ZIP
                        backup package.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowImportWizard(true)}
                      className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-semibold text-indigo-400 active:scale-95 transition-all cursor-pointer shiny-card-effect"
                      style={
                        {
                          "--shiny-color": "99, 102, 241",
                        } as React.CSSProperties
                      }
                    >
                      <IconArrowDown size={14} />
                      <span>Start Import</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* About */}
          <Section
            title="Application Info"
            icon={<IconInfo size={14} className="text-gray-500" />}
          >
            <div className="p-4 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-brand-500/20 blur-xl rounded-full group-hover:bg-brand-500/30 transition-colors" />
                  <img
                    src={logoIcon}
                    alt="Logo"
                    className="relative w-16 h-16 object-contain drop-shadow-2xl"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-[15px] font-bold text-white/90">
                    {APP_NAME}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium tracking-tight">
                    Version {APP_VERSION} ({APP_BUILD_TYPE})
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-[11px] text-gray-600">
                      Built with React + Electron
                    </span>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <span className="text-[11px] text-gray-600">
                      Storage: Local
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Danger Zone ── */}
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-rose-500/5">
            <div className="flex items-center gap-3 min-w-0">
              <IconAlertCircle
                size={16}
                className="text-rose-500/60 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-400/80">
                  Reset Database
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5 truncate">
                  Permanently erases all clips, tags &amp; settings — cannot be
                  undone.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowResetDialog(true);
                setResetConfirmText("");
              }}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 text-xs font-semibold text-rose-400 active:scale-95 transition-all cursor-pointer"
            >
              <IconTrash size={13} />
              <span>Reset All</span>
            </button>
          </div>

          {/* Footer Spacer */}
          <div className="h-6" />
        </div>
      </main>

      {/* Sticky Bottom Notice */}
      <footer className="px-6 py-4 border-gray-700 bg-surface-800/80 backdrop-blur-xl shrink-0">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] text-gray-500 italic">
            Settings are saved automatically to your local device.
          </p>
        </div>
      </footer>

      {/* Application Updates Dialog */}
      <Dialog
        isOpen={showUpdatesDialog}
        onClose={() => setShowUpdatesDialog(false)}
        title="Application Updates"
        maxWidth="max-w-xl"
        contentClassName="settings-scrollbar"
        paddingClassName="p-0"
        headerAction={
          <div className="flex items-center gap-2">
            {updateStatus === "downloading" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-semibold animate-pulse">
                <IconRefresh size={10} className="animate-spin" />
                <span className="tabular-nums">
                  Downloading {downloadProgress}%
                </span>
              </span>
            ) : updateStatus === "ready" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-semibold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
                <span>Install Update</span>
              </span>
            ) : updateStatus === "available" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 font-semibold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
                <span>Update Available</span>
              </span>
            ) : updateStatus === "error" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-400 font-semibold">
                <IconAlertCircle size={10} />
                <span>Update Error</span>
              </span>
            ) : updateStatus === "checking" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-semibold animate-pulse">
                <IconRefresh size={10} className="animate-spin" />
                <span>Checking...</span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setShowInfoDialog(true)}
              className="inline-flex items-center justify-center rounded-full border border-gray-700 bg-surface-800 p-1.5 text-gray-400 transition hover:border-white/20 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Show updates info"
            >
              <IconInfo size={12} />
            </button>
          </div>
        }
      >
        <UpdateSettings hideHeader />
      </Dialog>

      {/* Clear Cache & Optimization Dialog */}
      <Dialog
        isOpen={showClearCacheDialog}
        onClose={() => {
          if (!clearingCache) {
            setShowClearCacheDialog(false);
            setClearCacheStatus("idle");
          }
        }}
        title="Clear Cache & Repair"
        maxWidth="max-w-md"
      >
        <div className="space-y-6 py-2">
          {clearCacheStatus === "running" && (
            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Spinning optimization visual */}
              <div className="relative flex items-center justify-center w-16 h-16">
                <div className="absolute inset-0 border-4 border-brand-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-brand-500 rounded-full animate-spin" />
                <IconZap size={24} className="text-brand-400 animate-pulse" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-white">
                  Clearing Application Cache
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Please wait while we optimize ClipMaster Pro...
                </p>
              </div>
            </div>
          )}

          {clearCacheStatus === "done" && (
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <IconCheck size={32} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-400">
                  Advanced Cache Cleared Successfully
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Singleton lock files, stale update assets, and corrupt backup
                  files have been removed. Startup tasks have been verified and
                  repaired. Local databases are compacted. Your clips, tags, and
                  settings are fully preserved. If the app previously failed to
                  launch, it will now open normally.
                </p>
              </div>
            </div>
          )}

          {clearCacheStatus === "error" && (
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <IconAlertCircle size={32} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-400">
                  Clear Cache Failed
                </h4>
                <p className="text-xs text-gray-400 mt-1">{clearCacheError}</p>
              </div>
            </div>
          )}

          {/* Step-by-step progress checklist */}
          <div className="bg-surface-900/40 border border-gray-700/50 rounded-xl p-4 space-y-3">
            {[
              { label: "Scanning temporary download folders", step: 1 },
              { label: "Purging version installation files", step: 2 },
              { label: "Purging web session caches", step: 3 },
              { label: "Compacting local database files", step: 4 },
              {
                label:
                  "Clearing singleton lock files & repairing startup tasks",
                step: 5,
              },
              { label: "Re-indexing clip records", step: 6 },
            ].map((item) => {
              const isPending = clearCacheStep < item.step;
              const isCurrent = clearCacheStep === item.step;
              const isCompleted = clearCacheStep > item.step;

              return (
                <div
                  key={item.step}
                  className="flex items-center justify-between text-xs"
                >
                  <span
                    className={`transition-colors duration-200 ${
                      isCompleted
                        ? "text-gray-400 decoration-gray-500/30"
                        : isCurrent
                          ? "text-brand-400 font-bold"
                          : "text-gray-500"
                    }`}
                  >
                    {item.label}
                  </span>
                  <div>
                    {isCompleted ? (
                      <IconCheck size={14} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <IconRefresh
                        size={14}
                        className="animate-spin text-brand-400"
                      />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-gray-700 block" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Done / Close Actions */}
          <div className="pt-2">
            {clearCacheStatus === "done" && (
              <button
                onClick={() => {
                  setShowClearCacheDialog(false);
                  setClearCacheStatus("idle");
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all text-xs uppercase tracking-wider cursor-pointer"
              >
                Close Optimizer
              </button>
            )}
            {clearCacheStatus === "error" && (
              <button
                onClick={() => {
                  setShowClearCacheDialog(false);
                  setClearCacheStatus("idle");
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold transition-all text-xs uppercase tracking-wider cursor-pointer"
              >
                Close Dialog
              </button>
            )}
            {clearCacheStatus === "running" && (
              <button
                disabled
                className="w-full px-4 py-2.5 rounded-lg bg-gray-700 text-gray-500 font-bold text-xs uppercase tracking-wider cursor-not-allowed"
              >
                Optimizing...
              </button>
            )}
          </div>
        </div>
      </Dialog>

      {/* Application Updates Information Dialog */}
      <Dialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title="Application Updates Information"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-brand-500/5 border border-brand-500/10 rounded-xl space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white">
                How updates work:
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                ClipMaster Pro fetches the latest release assets directly from
                our secure GitHub repository releases.
              </p>
            </div>
            <ul className="text-xs text-gray-400 space-y-2 ml-4 list-disc">
              <li>
                <span className="font-semibold text-gray-200">
                  Installed Version
                </span>{" "}
                is the currently running build of the application.
              </li>
              <li>
                <span className="font-semibold text-gray-200">
                  Latest Release
                </span>{" "}
                represents the latest stable release tagged on GitHub.
              </li>
              <li>
                <span className="font-semibold text-gray-200">
                  Release Notes
                </span>{" "}
                are displayed below the selector to help you inspect new
                features, bug fixes, or performance enhancements.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Data Safety</span>
                : Your clipboard history and personalized configurations are
                fully preserved during updates.
              </li>
              <li>
                <span className="font-semibold text-gray-200">
                  Cancellation
                </span>
                : You can cancel the download at any time using the cancel
                button.
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setShowInfoDialog(false)}
              className="w-full px-3 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white transition-all text-xs font-semibold uppercase tracking-wide cursor-pointer"
            >
              Close Info
            </button>
          </div>
        </div>
      </Dialog>

      {/* Shortcut Info Dialog */}
      <Dialog
        isOpen={showShortcutDialog}
        onClose={() => setShowShortcutDialog(false)}
        title="Keyboard shortcuts"
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          {/* Global Shortcut Card */}
          <div className="rounded-2xl border border-gray-700 bg-surface-900 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  Open Clipboard History Popup
                </p>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] text-gray-300">
                  {(settings.globalShortcutKey || "CommandOrControl+Shift+V")
                    .split("+")
                    .map((k, idx) => (
                      <React.Fragment key={k}>
                        {idx > 0 && (
                          <span className="text-gray-500 mx-0.5">+</span>
                        )}
                        <span className="font-semibold text-white uppercase">
                          {k === "CommandOrControl" ? "Ctrl" : k}
                        </span>
                      </React.Fragment>
                    ))}
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-gray-400">
                Press this global hotkey to instantly display a lightweight
                clipboard history window on top of any active application. This
                popup shows your 10 most recent clips, filters, custom options,
                and search features. Clicking any clip automatically copies it
                and pastes it directly into the active input field of other
                applications.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-700 bg-surface-900 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  Clip Permanent Delete
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-gray-300">
                  <span className="font-semibold text-white">Ctrl</span>
                  <span className="text-gray-500">+</span>
                  <IconTrash size={14} className="text-rose-400" />
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-gray-400">
                Hold <span className="font-semibold text-white">Ctrl</span>{" "}
                while clicking the
                <IconTrash size={14} className="inline mx-1 text-rose-400" />
                delete icon on a clip to permanently delete it instead of moving
                it to the recycle bin.
              </p>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog
        isOpen={showResetDialog}
        onClose={() => {
          setShowResetDialog(false);
          setResetConfirmText("");
        }}
        title="Confirm Data Reset"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-500/10 border-rose-500/20 rounded-lg space-y-2">
            <h4 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
              <IconAlertCircle size={16} />
              This action cannot be undone
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              You are about to permanently delete:
            </p>
            <ul className="text-xs text-gray-500 space-y-1 ml-4 list-disc">
              <li>All clipboard entries (including favourites)</li>
              <li>All custom tags and filters</li>
              <li>All application settings</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Type <span className="text-rose-400 font-bold">RESET ALL</span> to
              confirm:
            </label>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="Type RESET ALL"
              className="w-full bg-surface-900 border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:border-rose-500/50 focus:ring-0 focus-visible:ring-0 focus:outline-none outline-none transition-all"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowResetDialog(false);
                setResetConfirmText("");
              }}
              className="flex-1 px-4 py-2.5 rounded-lg border-gray-700 text-gray-300 font-medium hover:bg-surface-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleResetAll}
              disabled={resetConfirmText !== "RESET ALL" || resetting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-500/10 border-rose-500/30 text-rose-400 font-medium hover:bg-rose-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? (
                <>
                  <IconRefresh size={14} className="animate-spin" />
                  <span>Resetting...</span>
                </>
              ) : (
                <>
                  <IconAlertCircle size={14} />
                  <span>Reset All Data</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Export System Dialog */}
      <ExportWizard
        isOpen={showExportWizard}
        onClose={() => setShowExportWizard(false)}
      />

      {/* Import System Dialog */}
      <ImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
      />

      {/* Bulk Action Wizard */}
      {bulkActionType && (
        <BulkActionWizard
          isOpen={!!bulkActionType}
          actionType={bulkActionType}
          onClose={() => setBulkActionType(null)}
        />
      )}
    </div>
  );
};

/* ─── UI COMPONENTS ────────────────────────────────────────────────────────── */

const Section: React.FC<{
  title: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}> = ({ title, badge, icon, children, contentClassName = "" }) => (
  <section className="space-y-3">
    <header className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">
          {title}
        </h3>
      </div>
      {badge}
    </header>
    <div
      className={
        contentClassName
          ? `p-5 rounded-2xl ${contentClassName} space-y-4`
          : "px-1 space-y-1"
      }
    >
      {children}
    </div>
  </section>
);

const SettingRow: React.FC<{
  label: string;
  desc?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, desc, icon, children }) => (
  <div className="flex items-center justify-between gap-6 p-4 rounded-xl bg-surface-800 border-gray-700 hover:border-gray-600 transition-colors group">
    <div className="min-w-0 space-y-1">
      <h4 className="flex items-center gap-2 text-[13px] font-medium text-gray-200 group-hover:text-white transition-colors">
        {icon && <span className="opacity-60 shrink-0">{icon}</span>}
        {label}
      </h4>
      {desc && <p className="text-xs text-gray-500 leading-normal">{desc}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const StatusCard: React.FC<{
  label: string;
  status: string;
  detail: string;
  icon: React.ReactNode;
  isStale?: boolean;
}> = ({ label, status, detail, icon, isStale }) => {
  const isOk = (status === "ok" || status === "idle") && !isStale;
  const isErr = status === "error" || status === "fail" || status === "offline";

  let cardStyle = "bg-brand-500/5 border-brand-500/20 text-brand-400";
  if (isOk)
    cardStyle =
      "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 font-medium";
  if (isErr) cardStyle = "bg-rose-500/5 border-rose-500/20 text-rose-400";
  if (isStale)
    cardStyle =
      "bg-amber-500/5 border-amber-500/20 text-amber-500 shadow-[0_4px_12px_rgba(245,158,11,0.1)]";

  return (
    <div className={`p-3 rounded-xl transition-all duration-300 ${cardStyle}`}>
      <div className="flex items-center gap-2 mb-2 opacity-80">
        <span className={`${isStale ? "text-amber-500" : ""}`}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div className="text-[13px] font-bold truncate tabular-nums leading-none">
        {detail}
      </div>
    </div>
  );
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-9 h-5 rounded-full transition-all duration-300 outline-none focus-visible:ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-800 ${
      checked ? "bg-brand-500 shadow-inner" : "bg-gray-700"
    }`}
  >
    <div
      className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out ${
        checked ? "translate-x-4" : "translate-x-0"
      }`}
    />
  </button>
);

const ShortcutRecorder: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setIsRecording(false);
        setRecordedKeys([]);
        return;
      }

      const keys: string[] = [];
      if (e.ctrlKey || e.metaKey) {
        keys.push("Ctrl");
      }
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");

      const key = e.key;
      if (
        key !== "Control" &&
        key !== "Meta" &&
        key !== "Alt" &&
        key !== "Shift" &&
        key !== "Dead"
      ) {
        let mainKey = key.toUpperCase();
        if (key === " ") mainKey = "Space";
        else if (key === "ArrowUp") mainKey = "Up";
        else if (key === "ArrowDown") mainKey = "Down";
        else if (key === "ArrowLeft") mainKey = "Left";
        else if (key === "ArrowRight") mainKey = "Right";
        keys.push(mainKey);
      }

      setRecordedKeys(keys);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const hasModifiers = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
      const hasMainKey =
        recordedKeys.length > 0 &&
        !["Ctrl", "Alt", "Shift"].includes(
          recordedKeys[recordedKeys.length - 1],
        );

      if (hasMainKey || (!hasModifiers && recordedKeys.length > 0)) {
        saveShortcut();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isRecording, recordedKeys]);

  const saveShortcut = () => {
    if (recordedKeys.length > 0) {
      const hasModifier = recordedKeys.some((k) =>
        ["Ctrl", "Alt", "Shift"].includes(k),
      );
      const mainKey = recordedKeys[recordedKeys.length - 1];
      const isFunctionKey = /^F[1-9][0-2]?$/.test(mainKey);

      if (hasModifier || isFunctionKey) {
        const accelerator = recordedKeys
          .map((k) => {
            if (k === "Ctrl") return "CommandOrControl";
            return k;
          })
          .join("+");
        onChange(accelerator);
      }
    }
    setIsRecording(false);
    setRecordedKeys([]);
  };

  const keysToDisplay = isRecording
    ? recordedKeys
    : value
      ? value.split("+").map((k) => (k === "CommandOrControl" ? "Ctrl" : k))
      : [];

  return (
    <div className="flex items-center gap-3" ref={containerRef}>
      <div className="flex items-center gap-1.5 min-h-[36px] bg-surface-900 border border-gray-700/50 rounded-xl px-3 py-1.5 font-mono select-none">
        {keysToDisplay.length > 0 ? (
          keysToDisplay.map((k, idx) => (
            <React.Fragment key={k}>
              {idx > 0 && (
                <span className="text-gray-600 text-xs font-sans">+</span>
              )}
              <kbd className="inline-block px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] font-bold text-gray-200 shadow-[0_2px_4px_rgba(0,0,0,0.15)] leading-none uppercase">
                {k}
              </kbd>
            </React.Fragment>
          ))
        ) : (
          <span className="text-xs text-gray-500 font-sans italic">
            None configured
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (isRecording) {
            saveShortcut();
          } else {
            setIsRecording(true);
            setRecordedKeys([]);
          }
        }}
        className={`px-3 py-1.5 h-9 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all duration-200 outline-none cursor-pointer ${
          isRecording
            ? "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse"
            : "bg-surface-800 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white"
        }`}
      >
        {isRecording ? "Stop Recording" : "Record Shortcut"}
      </button>
    </div>
  );
};

const PREDEFINED_CLIPS = [500, 1000, 5000, 10000, 25000, 50000, 100000];

function toIndianFormat(n: number): string {
  const s = Math.floor(n).toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const groups: string[] = [];
  let i = rest.length;
  while (i > 0) {
    groups.unshift(rest.slice(Math.max(0, i - 2), i));
    i -= 2;
  }
  return groups.join(",") + "," + last3;
}

function getClipCaption(n: number): string {
  if (n >= 10000000) {
    const c = n / 10000000;
    return `${c % 1 === 0 ? c : c.toFixed(2)} Crore`;
  }
  if (n >= 100000) {
    const l = n / 100000;
    return `${l % 1 === 0 ? l : l.toFixed(2)} Lakh`;
  }
  return "";
}

const MaxClipsSelector: React.FC<{
  value: number;
  onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const isValueCustom = !PREDEFINED_CLIPS.includes(value);

  // draft stores the FORMATTED string shown in the input (e.g. "2,00,000")
  const [draft, setDraft] = React.useState(
    isValueCustom ? toIndianFormat(value) : toIndianFormat(200000),
  );
  const [isEditing, setIsEditing] = React.useState(false);
  const [valueBeforeEdit, setValueBeforeEdit] = React.useState(value);

  // Sync when settings load externally
  React.useEffect(() => {
    if (!PREDEFINED_CLIPS.includes(value) && !isEditing) {
      setDraft(toIndianFormat(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Strip commas → raw number */
  const rawFromDraft = (d: string) => Number(d.replace(/,/g, "")) || 0;

  const openEditor = () => {
    setValueBeforeEdit(value);
    setDraft(isValueCustom ? toIndianFormat(value) : toIndianFormat(200000));
    setIsEditing(true);
  };

  const handleDraftChange = (raw: string) => {
    // Keep only digits
    const digits = raw.replace(/\D/g, "");
    if (digits.length > 8) return; // cap at 1,00,00,000 (8 digits)
    setDraft(digits ? toIndianFormat(Number(digits)) : "");
  };

  const handleConfirm = () => {
    const num = rawFromDraft(draft);
    const clamped = Math.max(10, Math.min(10000000, num || 200000));
    setDraft(toIndianFormat(clamped));
    setIsEditing(false);
    onChange(clamped);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (value !== valueBeforeEdit) onChange(valueBeforeEdit);
    setDraft(
      isValueCustom ? toIndianFormat(valueBeforeEdit) : toIndianFormat(200000),
    );
  };

  // Live hint values while editing
  const liveNum = rawFromDraft(draft);
  const liveDigits = liveNum > 0 ? liveNum.toString().length : 0;
  const liveCaption = liveNum > 0 ? getClipCaption(liveNum) : "";

  const caption = isValueCustom ? getClipCaption(value) : "";

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/* ── Row: dropdown  [input  ✓  ✗ while editing] ── */}
      <div className="flex items-center gap-2">
        <CustomSelect
          value={isValueCustom ? "custom" : value}
          onChange={(v) => {
            if (v === "custom") {
              openEditor();
            } else {
              setIsEditing(false);
              onChange(Number(v));
            }
          }}
          options={[
            {
              label: "500 clips",
              value: 500,
              icon: <IconMinimize size={14} />,
            },
            { label: "1,000 clips", value: 1000, icon: <IconList size={14} /> },
            {
              label: "5,000 clips",
              value: 5000,
              icon: <IconLayers size={14} />,
            },
            {
              label: "10,000 clips",
              value: 10000,
              icon: <IconLayers size={14} />,
            },
            {
              label: "25,000 clips",
              value: 25000,
              icon: <IconDatabase size={14} />,
            },
            {
              label: "50,000 clips",
              value: 50000,
              icon: <IconDatabase size={14} />,
            },
            {
              label: "1,00,000 clips (1 Lakh)",
              value: 100000,
              icon: <IconCloud size={14} />,
            },
            {
              label:
                isValueCustom && !isEditing
                  ? `Custom: ${toIndianFormat(value)}`
                  : "Custom (up to 1 Crore)",
              caption: isValueCustom && !isEditing ? caption : undefined,
              value: "custom",
              icon: <IconEdit size={14} />,
            },
          ]}
        />

        {/* Formatted text input — only while editing */}
        {isEditing && (
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            autoFocus
            placeholder="e.g. 2,00,000"
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") handleCancel();
            }}
            className="w-24 h-9 bg-surface-900 border border-gray-700/50 rounded-xl px-3 text-[12px] font-medium text-gray-300 focus:border-brand-500/30 focus:ring-0 focus-visible:ring-0 focus:outline-none outline-none transition-all tracking-wide"
          />
        )}

        {/* Confirm ✓ */}
        {isEditing && (
          <button
            onClick={handleConfirm}
            title="Confirm"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 hover:bg-brand-500/25 hover:text-brand-300 transition-all duration-150 shrink-0"
          >
            <IconCheck size={14} />
          </button>
        )}

        {/* Cancel ✗ */}
        {isEditing && (
          <button
            onClick={handleCancel}
            title="Cancel"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-150 shrink-0"
          >
            <IconX size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

const CustomSelect: React.FC<{
  value: any;
  onChange: (v: any) => void;
  options: {
    label: string;
    caption?: string;
    value: any;
    icon?: React.ReactNode;
  }[];
}> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption =
    options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 h-9 px-4 rounded-xl transition-all duration-200 ${
          isOpen
            ? "bg-surface-700 border-brand-500/30 text-brand-400 shadow-lg shadow-brand-500/5"
            : "border-gray-700/50 text-gray-400 hover:border-gray-500 hover:text-gray-200"
        }`}
      >
        {currentOption.icon && (
          <span className="opacity-70">{currentOption.icon}</span>
        )}
        <span className="text-[12px] font-medium whitespace-nowrap">
          {currentOption.label}
        </span>
        {currentOption.caption && (
          <span className="text-[10px] font-semibold text-brand-400/80 whitespace-nowrap">
            {currentOption.caption}
          </span>
        )}
        <IconChevronDown
          size={14}
          className={`opacity-40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full mt-1 right-0 min-w-full w-max z-[100] bg-surface-800 border-white/10 rounded-xl border overflow-hidden p-1.5"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center my-1 justify-between px-3 py-2 rounded-lg text-[12px] transition-all duration-150 ${
                  value === opt.value
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {opt.icon && (
                    <span
                      className={
                        value === opt.value ? "text-brand-400" : "text-gray-500"
                      }
                    >
                      {opt.icon}
                    </span>
                  )}
                  <span className="font-medium whitespace-nowrap">
                    {opt.label}
                  </span>
                  {opt.caption && (
                    <span className="text-[10px] font-semibold text-brand-400/70">
                      {opt.caption}
                    </span>
                  )}
                </div>
                {value === opt.value && (
                  <IconCheck size={14} className="text-brand-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ConnectionStatus: React.FC<{ connected: boolean }> = ({ connected }) => (
  <div
    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
      connected
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        : "bg-gray-700/50 border-gray-600/50 text-gray-500"
    }`}
  >
    <div
      className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-gray-600"}`}
    />
    {connected ? "Linked" : "Offline"}
  </div>
);

const InlineStatus: React.FC<{
  status: string;
  message: string;
  label: string;
}> = ({ status, message, label }) => {
  if (status === "ok")
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
        <IconCheck size={16} />
        <span className="text-[13px] font-medium">
          {label} connected successfully
        </span>
      </div>
    );
  if (status === "fail")
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/10 border-rose-500/20 text-rose-400">
        <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h5 className="text-[13px] font-bold">Connection Failed</h5>
          <p className="text-xs opacity-70 leading-relaxed">
            {message || "An unknown error occurred while connecting."}
          </p>
        </div>
      </div>
    );
  return null;
};

export default Settings;
