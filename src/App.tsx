import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { APP_NAME } from "./constants";
import { useClipStore } from "./store/useClipStore";
import Sidebar from "./components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const FavoritesPage = React.lazy(() => import("./pages/FavoritesPage"));
const RecycleBinPage = React.lazy(() => import("./pages/RecycleBinPage"));
const Settings = React.lazy(() => import("./pages/Settings"));
const TagsPage = React.lazy(() => import("./pages/TagsPage"));

function PageFallback() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d0d1a",
      }}
    >
      <div
        style={{
          height: 32,
          width: 32,
          borderRadius: "50%",
          border: "4px solid rgba(99, 102, 241, 0.2)",
          borderTopColor: "#6366f1",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   WINDOW CONTROLS — called at click-time only, never cached at module-eval
───────────────────────────────────────────────────────────────────────────── */
function winMinimize() {
  (window as any).clipAPI?.minimize();
}
function winMaximize() {
  (window as any).clipAPI?.maximize();
}
function winClose() {
  (window as any).clipAPI?.close();
}

/* ─────────────────────────────────────────────────────────────────────────────
   TITLE BAR — drag-region SIBLING to buttons (never ancestor)
───────────────────────────────────────────────────────────────────────────── */
function TitleBar() {
  return (
    <div
      style={{
        height: 40,
        display: "flex",
        alignItems: "stretch",
        background: "#0d0d1a",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Drag zone */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          paddingLeft: 14,
          gap: 8,
          /* @ts-ignore */
          WebkitAppRegion: "drag",
          userSelect: "none",
          cursor: "default",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            flexShrink: 0,
            background: "linear-gradient(135deg,#6366f1,#22c55e)",
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: "rgba(255,255,255,0.28)",
          }}
        >
          {APP_NAME}
        </span>
      </div>

      {/* Window control buttons — must be siblings, NOT children of drag zone */}
      <WinBtn
        label="&#x2500;"
        title="Minimize"
        onClick={winMinimize}
        danger={false}
      />
      <WinBtn
        label="&#x2610;"
        title="Maximize / Restore"
        onClick={winMaximize}
        danger={false}
      />
      <WinBtn label="&#x2715;" title="Close" onClick={winClose} danger={true} />
    </div>
  );
}

function WinBtn({
  label,
  title,
  onClick,
  danger,
}: {
  label: string;
  title: string;
  onClick: () => void;
  danger: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 46,
        height: 40,
        border: "none",
        outline: "none",
        margin: 0,
        padding: 0,
        flexShrink: 0,
        background: hov
          ? danger
            ? "#c42b1c"
            : "rgba(255,255,255,0.1)"
          : "transparent",
        color: hov ? "#fff" : "rgba(255,255,255,0.5)",
        cursor: "pointer",
        fontSize: 15,
        fontFamily: "system-ui, Segoe UI, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 100ms, color 100ms",
      }}
    >
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Safe stub for non-Electron environments (plain browser / tests)
   Includes ALL methods defined in ClipAPI — nothing missing.
───────────────────────────────────────────────────────────────────────────── */
const noop = () => {};
const noop_p = async () => false as any;

if (typeof window !== "undefined" && !window.clipAPI) {
  console.warn(
    "[App] Electron bridge (window.clipAPI) not found. Initializing safe stub.",
  );
  window.clipAPI = {
    // Window
    minimize: noop,
    maximize: noop,
    close: noop,
    // Clipboard CRUD
    getClips: async () => [],
    addClip: async () => null,
    updateClip: noop_p,
    deleteClip: noop_p,
    permanentDelete: noop_p,
    restoreClip: noop_p,
    copyToClipboard: noop_p,
    // Tags & Settings
    getTags: async () => [],
    saveTags: noop_p,
    getSettings: async () => ({
      autoLaunch: false,
      mongoEnabled: false,
      mongoUri: "mongodb://127.0.0.1:27017/clipmaster",
      atlasEnabled: false,
      atlasUri: "",
      maxEntries: 5000,
      pollingInterval: 600,
      viewMode: "list" as const,
      displayMode: "preview" as const,
    }),
    saveSettings: noop_p,
    // Sync
    getSyncState: async () => ({
      localMongo: "idle" as const,
      atlas: "idle" as const,
      lastLocalSyncedAt: null,
      lastCloudSyncedAt: null,
      latestSyncedAt: null,
    }),
    triggerSync: noop_p,
    mongoConnect: noop_p,
    atlasConnect: noop_p,
    mongoStatus: noop_p,
    atlasStatus: noop_p,
    mongoSyncAll: noop_p,
    openExternal: noop,
    onNewClip: () => noop,
    onSyncUpdate: () => noop,
    onSettingsUpdated: () => noop,
    getAppInfo: async () => ({
      name: "ClipMaster Pro",
      version: "2.0.0",
      electron: "29.0.0",
      chrome: "122.0.0",
      node: "20.9.0",
      platform: process.platform || "win32",
      isPackaged: false,
    }),
    getReleases: async () => [],
    triggerUpdate: noop_p,
    cancelUpdateDownload: noop_p,
    checkUpdateDownloaded: noop_p,
    getActiveDownloadStatus: async () => ({ status: "idle", progress: 0, targetRelease: null }),
    onUpdateProgress: () => noop,
    onUpdateError: () => noop,
    onUpdateSuccess: () => noop,
    clearCache: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    },
  } as any;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page Router — each page wrapped in its own ErrorBoundary
───────────────────────────────────────────────────────────────────────────── */
function PageView() {
  const { activePage } = useClipStore();
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activePage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <React.Suspense fallback={<PageFallback />}>
            {activePage === "dashboard" && (
              <ErrorBoundary name="Dashboard">
                <Dashboard />
              </ErrorBoundary>
            )}
            {activePage === "favorites" && (
              <ErrorBoundary name="Favourites">
                <FavoritesPage />
              </ErrorBoundary>
            )}
            {activePage === "recycle" && (
              <ErrorBoundary name="Recycle Bin">
                <RecycleBinPage />
              </ErrorBoundary>
            )}
            {activePage === "settings" && (
              <ErrorBoundary name="Settings">
                <Settings />
              </ErrorBoundary>
            )}
            {activePage === "tags" && (
              <ErrorBoundary name="Tags">
                <TagsPage />
              </ErrorBoundary>
            )}
          </React.Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Root App
───────────────────────────────────────────────────────────────────────────── */
export default function App() {
  const {
    loadClips,
    loadTags,
    loadSettings,
    loadUIState,
    addClipFromMain,
    setMongoConnected,
    setAtlasConnected,
    setSyncState,
    searchInputRef,
    filters,
    activePage,
  } = useClipStore();

  useEffect(() => {
    // Global keyboard listener — auto-focus search input on typing
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      )
        return;

      // Handle Ctrl+V or Cmd+V globally
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (searchInputRef?.current) {
          if (document.activeElement !== searchInputRef.current) {
            searchInputRef.current.focus();
            // Move cursor to the end of the text
            const len = searchInputRef.current.value.length;
            searchInputRef.current.setSelectionRange(len, len);
          }
        }
        return; // Let native paste handle inserting the clipboard text
      }

      // Ignore special keys (Ctrl, Alt, Shift, Meta, Escape, etc.)
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key === "Escape" ||
        e.key.length > 1
      )
        return;

      // Focus search input and type the character
      if (searchInputRef?.current) {
        e.preventDefault();
        searchInputRef.current.focus();
        // Simulate typing the key
        const currentValue = searchInputRef.current.value;
        searchInputRef.current.value = currentValue + e.key;
        // Trigger the change event so React handler picks it up
        const event = new Event("change", { bubbles: true });
        searchInputRef.current.dispatchEvent(event);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [searchInputRef]);

  useEffect(() => {
    const initApp = async () => {
      // 1. Load settings & UI state first
      await loadSettings();
      await loadUIState();
      await loadTags();

      // 2. Load on-demand clips: fetch first 200 clips for fast start
      await loadClips(200);

      // Check mongo connection status (safe — mongoStatus always defined)
      const checkMongo = async () => {
        try {
          const ok = await window.clipAPI.mongoStatus();
          setMongoConnected(ok);
        } catch {
          /* ignore */
        }
      };
      await checkMongo();

      const checkAtlas = async () => {
        try {
          const s = await window.clipAPI.getSettings();
          if (s.atlasUri) {
            const ok = await window.clipAPI.atlasConnect(s.atlasUri);
            setAtlasConnected(ok);
          }
        } catch {
          /* ignore */
        }
      };
      await checkAtlas();
    };

    initApp();

    // Subscribe to new clips pushed from the main process
    const unsubClips = (window.clipAPI.onNewClip ?? noop)((item: any) =>
      addClipFromMain(item),
    );

    // Global sync update listener
    const unsubSync = (window.clipAPI.onSyncUpdate ?? noop)((state: any) =>
      setSyncState(state),
    );

    // Global settings update listener
    const unsubSettings = (window.clipAPI.onSettingsUpdated ?? noop)((settings: any) => {
      useClipStore.setState({ settings });
    });

    return () => {
      if (typeof unsubClips === "function") unsubClips();
      if (typeof unsubSync === "function") unsubSync();
      if (typeof unsubSettings === "function") unsubSettings();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On-demand loading of full history when filter is active or on specialized pages
  useEffect(() => {
    const hasFiltersActive =
      filters.search.trim().length > 0 ||
      filters.tags.length > 0 ||
      filters.isFavorite !== null ||
      filters.dateFrom !== null ||
      filters.dateTo !== null;

    if (hasFiltersActive || activePage === "favorites" || activePage === "recycle") {
      console.log("[App] Active filters or page change detected. Loading full clipboard history...");
      loadClips(); // Load full history (no limit)
    }
  }, [filters, activePage, loadClips]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <TitleBar />
      <div
        style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}
      >
        <Sidebar />
        <main
          className="bg-surface-800/50"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <PageView />
        </main>
      </div>
    </div>
  );
}
