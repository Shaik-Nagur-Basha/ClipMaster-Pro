import React, { useState, useEffect, useRef } from "react";
import logoIcon from "@/assets/icon.png";
import { useClipStore } from "../store/useClipStore";
import { useUpdateStore } from "../store/useUpdateStore";
import { UpdateSettings } from "../components/UpdateSettings";
import { APP_VERSION, APP_NAME, APP_BUILD_TYPE } from "../constants";
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
} from "../components/Icons";
import { motion, AnimatePresence } from "framer-motion";
import Dialog from "../components/Dialog";

const Settings: React.FC = () => {
  const {
    settings,
    saveSettings,
    loadSettings,
    clips,
    mongoConnected,
    setMongoConnected,
    atlasConnected,
    setAtlasConnected,
    syncState,
    setSyncState,
  } = useClipStore();

  const { updateStatus, downloadProgress } = useUpdateStore();
  const [showUpdatesDialog, setShowUpdatesDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [clearCacheStep, setClearCacheStep] = useState(0);
  const [clearCacheStatus, setClearCacheStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [clearCacheError, setClearCacheError] = useState("");

  const latestClipTimestamp = React.useMemo(() => {
    if (clips.length === 0) return 0;
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

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [localUri, setLocalUri] = useState(
    settings.mongoUri ?? "mongodb://127.0.0.1:27017/clipmaster",
  );
  const [atlasUri, setAtlasUri] = useState(settings.atlasUri ?? "");
  const [localConnecting, setLocalConnecting] = useState(false);
  const [atlasConnecting, setAtlasConnecting] = useState(false);
  const [localSyncing, setLocalSyncing] = useState(false);
  const [atlasSyncing, setAtlasSyncing] = useState(false);
  const [localStatus, setLocalStatus] = useState<
    "idle" | "ok" | "fail" | "connecting"
  >("idle");
  const [localError, setLocalError] = useState("");
  const [atlasStatus, setAtlasStatus] = useState<
    "idle" | "ok" | "fail" | "connecting"
  >("idle");
  const [atlasError, setAtlasError] = useState("");
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

  useEffect(() => {
    setLocalUri(settings.mongoUri ?? "mongodb://127.0.0.1:27017/clipmaster");
  }, [settings.mongoUri]);
  useEffect(() => {
    setAtlasUri(settings.atlasUri ?? "");
  }, [settings.atlasUri]);

  // Auto-connect to Atlas if URI is present
  const hasAutoConnected = useRef(false);
  useEffect(() => {
    if (
      !settingsLoading &&
      atlasUri &&
      !atlasConnected &&
      !hasAutoConnected.current
    ) {
      hasAutoConnected.current = true;
      handleConnectAtlas(true);
    }
  }, [settingsLoading, atlasUri, atlasConnected]);

  const handleConnectLocal = async () => {
    if (!localUri.trim()) {
      setLocalStatus("fail");
      setLocalError("Enter a MongoDB URI");
      return;
    }
    setLocalConnecting(true);
    setLocalStatus("connecting");
    setLocalError("");
    try {
      const ok = await window.clipAPI.mongoConnect(localUri.trim());
      setMongoConnected(ok);
      setLocalStatus(ok ? "ok" : "fail");
      if (!ok)
        setLocalError("Connection failed. Make sure MongoDB is running.");
      else
        await saveSettings({ mongoEnabled: true, mongoUri: localUri.trim() });
    } catch (e) {
      setLocalStatus("fail");
      setLocalError(String(e));
    } finally {
      setLocalConnecting(false);
    }
  };

  const handleConnectAtlas = async (isAuto = false) => {
    if (!atlasUri.trim()) {
      setAtlasStatus("fail");
      setAtlasError("Enter an Atlas connection string");
      return;
    }
    setAtlasConnecting(true);
    setAtlasStatus("connecting");
    setAtlasError("");
    try {
      const ok = await window.clipAPI.atlasConnect(atlasUri.trim());
      setAtlasConnected(ok);
      setAtlasStatus(ok ? "ok" : "fail");
      if (!ok) {
        setAtlasError(
          "Atlas connection failed. Check credentials and IP whitelist.",
        );
      } else if (!isAuto) {
        // Only force enable and save if it's a manual connection attempt
        await saveSettings({ atlasEnabled: true, atlasUri: atlasUri.trim() });
      }
    } catch (e) {
      setAtlasStatus("fail");
      setAtlasError(String(e));
    } finally {
      setAtlasConnecting(false);
    }
  };

  const handleSync = async (target: "local" | "atlas") => {
    if (target === "local") setLocalSyncing(true);
    else setAtlasSyncing(true);

    await window.clipAPI.triggerSync?.(target);

    // Refresh UI state after bidirectional sync completes
    await useClipStore.getState().loadClips();
    await useClipStore.getState().loadTags();

    if (target === "local") setLocalSyncing(false);
    else setAtlasSyncing(false);
  };

  const handleDisconnectLocal = async () => {
    try {
      await window.clipAPI.mongoDisconnect();
      setMongoConnected(false);
      setLocalStatus("idle");
      setSyncState({ lastLocalSyncedAt: null });
      await saveSettings({ mongoEnabled: false });
    } catch (err) {
      console.error("Failed to disconnect local:", err);
    }
  };

  const handleDisconnectAtlas = async () => {
    try {
      await window.clipAPI.atlasDisconnect();
      setAtlasConnected(false);
      setAtlasStatus("idle");
      setAtlasUri("");
      setSyncState({ lastCloudSyncedAt: null });
      await saveSettings({ atlasEnabled: false, atlasUri: "" });
    } catch (e) {
      console.error("Failed to disconnect atlas:", e);
    }
  };

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
          store.setMongoConnected(false);
          store.setAtlasConnected(false);
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

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      const success = window.clipAPI?.clearCache
        ? await window.clipAPI.clearCache()
        : true;
      if (!success) {
        throw new Error("Failed to clear cache in main process");
      }
      await delay(1000);

      // Step 5: Optimizing index structures
      setClearCacheStep(5);
      const store = useClipStore.getState();
      // Also reset the update store state (downloads cleared)
      useUpdateStore.getState().resetProgress();
      await Promise.all([
        store.loadClips(),
        store.loadTags(),
      ]);
      await delay(600);

      // Complete
      setClearCacheStep(6);
      setClearCacheStatus("done");
    } catch (err: any) {
      console.error("Clear cache failed:", err);
      setClearCacheStatus("error");
      setClearCacheError(err.message || "An error occurred during cache clearance.");
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
      <div className="flex flex-col h-full bg-surface-900 items-center justify-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
        <span className="text-xs text-gray-500 font-medium">
          Loading environment…
        </span>
      </div>
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
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-surface-800 px-3 py-1.5 text-xs text-gray-300 transition hover:border-white/20 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
            title="Clear downloaded versions and cache"
          >
            <IconTrash size={14} className="text-rose-400" />
            <span>Clear Cache</span>
          </button>

          {updateStatus === "downloading" ? (
            <button
              type="button"
              onClick={() => setShowUpdatesDialog(true)}
              className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs text-brand-400 font-semibold transition hover:border-brand-500/50 hover:bg-brand-500/20 cursor-pointer"
              title="Downloading update"
            >
              <IconRefresh size={14} className="animate-spin" />
              <span className="tabular-nums">Downloading {downloadProgress}%</span>
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
              <span>Ready to Restart</span>
            </button>
          ) : updateStatus === "checking" ? (
            <button
              type="button"
              onClick={() => setShowUpdatesDialog(true)}
              className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs text-brand-400 font-semibold transition hover:border-brand-500/50 hover:bg-brand-500/20 cursor-pointer"
              title="Checking for updates"
            >
              <IconRefresh size={14} className="animate-spin" />
              <span>Checking...</span>
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
                desc="Start ClipMaster Pro automatically when you log in."
              >
                <Toggle
                  checked={settings.autoLaunch}
                  onChange={(v) => saveSettings({ autoLaunch: v })}
                />
              </SettingRow>

              <SettingRow
                label="Max stored clips"
                desc="Oldest non-favourite clips are removed when limit is reached."
              >
                <CustomSelect
                  value={settings.maxEntries}
                  onChange={(v) => saveSettings({ maxEntries: Number(v) })}
                  options={[
                    {
                      label: "500 clips",
                      value: 500,
                      icon: <IconMinimize size={14} />,
                    },
                    {
                      label: "1,000 clips",
                      value: 1000,
                      icon: <IconLayers size={14} />,
                    },
                    {
                      label: "5,000 clips",
                      value: 5000,
                      icon: <IconLayers size={14} />,
                    },
                    {
                      label: "10,000 clips",
                      value: 10000,
                      icon: <IconDatabase size={14} />,
                    },
                  ]}
                />
              </SettingRow>

              <SettingRow
                label="Enable pagination"
                desc="Show clips page-by-page in dashboard, favourites, and recycle bin."
              >
                <Toggle
                  checked={settings.paginationEnabled}
                  onChange={(v) => saveSettings({ paginationEnabled: v })}
                />
              </SettingRow>

              <SettingRow
                label="Pause capturing of clips"
                desc="Temporarily disable clipboard capture monitoring."
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
            </div>
          </Section>

          {/* Local Database */}
          <Section
            title="Local Mongo sync"
            badge={<ConnectionStatus connected={mongoConnected} />}
            icon={<IconDatabase size={14} className="text-gray-500" />}
          >
            <div className="space-y-4">
              <SettingRow
                label="Enable MongoDB Sync"
                desc="Sync clipboard data from local JSON to local MongoDB."
              >
                <Toggle
                  checked={settings.mongoEnabled}
                  onChange={(v) => saveSettings({ mongoEnabled: v })}
                />
              </SettingRow>

              {settings.mongoEnabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-gray-400">
                      Connection URI
                    </label>
                    <input
                      type="text"
                      value={localUri}
                      onChange={(e) => {
                        setLocalUri(e.target.value);
                        setLocalStatus("idle");
                      }}
                      onBlur={() => saveSettings({ mongoUri: localUri })}
                      placeholder="mongodb://localhost:27017/clipmaster"
                      className="w-full bg-surface-900 border-gray-700 rounded-lg px-4 py-2.5 text-[13px] font-mono text-gray-300 placeholder-gray-600 focus:border-brand-500/50 outline-none transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleConnectLocal}
                      disabled={localConnecting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 border-brand-500/30 text-[13px] text-brand-400 font-medium hover:bg-brand-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {localConnecting ? (
                        <IconRefresh size={14} className="animate-spin" />
                      ) : (
                        <IconRefresh size={14} />
                      )}
                      {mongoConnected
                        ? "Reconnect Database"
                        : "Connect Database"}
                    </button>
                    {mongoConnected && (
                      <>
                        <button
                          onClick={() => handleSync("local")}
                          disabled={localSyncing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border-emerald-500/30 text-[13px] text-emerald-400 font-medium hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {localSyncing ? (
                            <IconRefresh size={14} className="animate-spin" />
                          ) : (
                            <IconRefresh size={14} />
                          )}
                          Sync Data
                        </button>
                        <button
                          onClick={handleDisconnectLocal}
                          className="p-2 rounded-lg bg-gray-700/50 border-gray-600/50 text-gray-400 hover:text-white transition-colors"
                          title="Disconnect"
                        >
                          <IconX size={16} />
                        </button>
                      </>
                    )}
                  </div>
                  <InlineStatus
                    status={localStatus}
                    message={localError}
                    label="Local Database"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* Atlas Cloud */}
          <Section
            title="Cloud synchronization"
            badge={<ConnectionStatus connected={atlasConnected} />}
            icon={<IconCloud size={14} className="text-gray-500" />}
          >
            <div className="space-y-4">
              <SettingRow
                label="Enable MongoDB Atlas"
                desc="Sync your clipboard across multiple machines using the cloud."
              >
                <Toggle
                  checked={settings.atlasEnabled ?? false}
                  onChange={(v) => saveSettings({ atlasEnabled: v })}
                />
              </SettingRow>

              {settings.atlasEnabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-gray-400">
                      Atlas Connection String
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600">
                        <IconShield size={16} />
                      </div>
                      <input
                        type="password"
                        value={atlasUri}
                        onChange={(e) => {
                          setAtlasUri(e.target.value);
                          setAtlasStatus("idle");
                        }}
                        onBlur={() => saveSettings({ atlasUri: atlasUri })}
                        placeholder="mongodb+srv://..."
                        className="w-full bg-surface-900 border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-[13px] font-mono text-gray-300 placeholder-gray-600 focus:border-brand-500/50 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed px-1">
                      Encryption: Data is AES-256 encrypted before upload.
                      Ensure your IP is whitelisted in Atlas.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleConnectAtlas(false)}
                      disabled={atlasConnecting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 border-brand-500/30 text-[13px] text-brand-400 font-medium hover:bg-brand-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {atlasConnecting ? (
                        <IconRefresh size={14} className="animate-spin" />
                      ) : (
                        <IconCloud size={14} />
                      )}
                      {atlasConnected ? "Reconnect Cloud" : "Connect Cloud"}
                    </button>
                    {atlasConnected && (
                      <>
                        <button
                          onClick={() => handleSync("atlas")}
                          disabled={atlasSyncing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border-emerald-500/30 text-[13px] text-emerald-400 font-medium hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {atlasSyncing ? (
                            <IconRefresh size={14} className="animate-spin" />
                          ) : (
                            <IconRefresh size={14} />
                          )}
                          Sync Data
                        </button>
                        <button
                          onClick={handleDisconnectAtlas}
                          className="p-2 rounded-lg bg-gray-700/50 border-gray-600/50 text-gray-400 hover:text-white transition-colors"
                          title="Disconnect"
                        >
                          <IconX size={16} />
                        </button>
                      </>
                    )}
                  </div>
                  <InlineStatus
                    status={atlasStatus}
                    message={atlasError}
                    label="Cloud Atlas"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* Sync Status Overlay */}
          <div className="p-4 rounded-xl border-gray-700 shadow-sm">
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <IconRefresh size={14} className="text-brand-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Live Sync Status
                </span>
              </div>
            </header>
            <div className="grid grid-cols-3 gap-3">
              <StatusCard
                label="LocalStorage"
                status="ok"
                detail="Primary"
                icon={<IconShield size={14} />}
              />
              <StatusCard
                label="Local Mongo"
                status={
                  mongoConnected
                    ? localHealth === "stale"
                      ? "stale"
                      : syncState.localMongo === "syncing"
                        ? "syncing"
                        : "ok"
                    : "offline"
                }
                detail={
                  mongoConnected
                    ? syncState.localMongo === "syncing"
                      ? "Syncing…"
                      : syncState.lastLocalSyncedAt
                        ? fmtTime(syncState.lastLocalSyncedAt) || "Linked"
                        : "Linked"
                    : "Inactive"
                }
                icon={<IconDatabase size={14} />}
                isStale={localHealth === "stale"}
              />
              <StatusCard
                label="Atlas Cloud"
                status={
                  atlasConnected
                    ? cloudHealth === "stale"
                      ? "stale"
                      : syncState.atlas === "syncing"
                        ? "syncing"
                        : "ok"
                    : settings.atlasEnabled
                      ? "connecting"
                      : "offline"
                }
                detail={
                  atlasConnected
                    ? syncState.atlas === "syncing"
                      ? "Syncing…"
                      : syncState.lastCloudSyncedAt
                        ? fmtTime(syncState.lastCloudSyncedAt) || "Linked"
                        : "Linked"
                    : settings.atlasEnabled
                      ? "Connecting…"
                      : "Inactive"
                }
                icon={<IconCloud size={14} />}
                isStale={cloudHealth === "stale"}
              />
            </div>
          </div>
          {/* End Sync Status Overlay */}



          {/* Data Management & Reset */}
          <Section
            title="Data Management"
            icon={<IconAlertCircle size={14} className="text-rose-500/60" />}
          >
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-rose-500/5 border-rose-500/20 space-y-3">
                <div className="space-y-1">
                  <h4 className="text-[13px] font-semibold text-rose-400">
                    Clear All Data & Reset
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Permanently delete all clipboard entries, tags, and
                    settings. This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowResetDialog(true);
                    setResetConfirmText("");
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 border-rose-500/30 text-[13px] text-rose-400 font-medium hover:bg-rose-500/20 active:scale-95 transition-all"
                >
                  <IconAlertCircle size={14} />
                  Clear All Data
                </button>
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
                      Storage: Local + MongoDB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Footer Spacer */}
          <div className="h-12" />
        </div>
      </main>

      {/* Sticky Bottom Notice */}
      <footer className="px-6 py-4 border-gray-700 bg-surface-800/80 backdrop-blur-xl shrink-0">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] text-gray-500 italic">
            Settings are saved automatically and synced from local to cloud in
            the background.
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
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] text-brand-400 font-semibold animate-pulse">
                <IconRefresh size={10} className="animate-spin" />
                <span className="tabular-nums">Downloading {downloadProgress}%</span>
              </span>
            ) : updateStatus === "ready" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 font-semibold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
                <span>Ready to Restart</span>
              </span>
            ) : updateStatus === "error" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-400 font-semibold">
                <IconAlertCircle size={10} />
                <span>Update Error</span>
              </span>
            ) : updateStatus === "checking" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] text-brand-400 font-semibold animate-pulse">
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
        title="Cache Clearance & Optimization"
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
                <h4 className="text-sm font-bold text-white">Clearing Application Cache</h4>
                <p className="text-xs text-gray-400 mt-1">Please wait while we optimize ClipMaster Pro...</p>
              </div>
            </div>
          )}

          {clearCacheStatus === "done" && (
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <IconCheck size={32} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-400">Cache Successfully Cleared</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Downloaded update setup assets and version installers were deleted.
                  Local databases compacted and system caches cleared.
                  Your settings, clips, and tags remain fully preserved.
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
                <h4 className="text-sm font-bold text-rose-400">Clear Cache Failed</h4>
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
              { label: "Re-indexing clip records", step: 5 },
            ].map((item) => {
              const isPending = clearCacheStep < item.step;
              const isCurrent = clearCacheStep === item.step;
              const isCompleted = clearCacheStep > item.step;

              return (
                <div key={item.step} className="flex items-center justify-between text-xs">
                  <span className={`transition-colors duration-200 ${
                    isCompleted ? "text-gray-400 decoration-gray-500/30" : isCurrent ? "text-brand-400 font-bold" : "text-gray-500"
                  }`}>
                    {item.label}
                  </span>
                  <div>
                    {isCompleted ? (
                      <IconCheck size={14} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <IconRefresh size={14} className="animate-spin text-brand-400" />
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
              <h4 className="text-sm font-semibold text-white">How updates work:</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                ClipMaster Pro fetches the latest release assets directly from our secure GitHub repository releases.
              </p>
            </div>
            <ul className="text-xs text-gray-400 space-y-2 ml-4 list-disc">
              <li>
                <span className="font-semibold text-gray-200">Installed Version</span> is the currently running build of the application.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Latest Release</span> represents the latest stable release tagged on GitHub.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Release Notes</span> are displayed below the selector to help you inspect new features, bug fixes, or performance enhancements.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Data Safety</span>: Your clipboard history, local MongoDB databases, and personalized configurations are fully preserved during updates.
              </li>
              <li>
                <span className="font-semibold text-gray-200">Cancellation</span>: You can cancel the download at any time using the cancel button.
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
              <li>All sync connections (local MongoDB and Atlas)</li>
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
    </div>
  );
};

/* ─── UI COMPONENTS ────────────────────────────────────────────────────────── */

const Section: React.FC<{
  title: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, badge, icon, children }) => (
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
    <div className="p-1 space-y-1">{children}</div>
  </section>
);

const SettingRow: React.FC<{
  label: string;
  desc?: string;
  children: React.ReactNode;
}> = ({ label, desc, children }) => (
  <div className="flex items-center justify-between gap-6 p-4 rounded-xl bg-surface-800 border-gray-700 hover:border-gray-600 transition-colors group">
    <div className="min-w-0 space-y-1">
      <h4 className="text-[13px] font-medium text-gray-200 group-hover:text-white transition-colors">
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

const CustomSelect: React.FC<{
  value: any;
  onChange: (v: any) => void;
  options: { label: string; value: any; icon?: React.ReactNode }[];
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
            className="absolute top-full mt-1 right-0 w-48 z-[100] bg-surface-800 border-white/10 rounded-xl border overflow-hidden p-1.5"
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
                  <span className="font-medium">{opt.label}</span>
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
