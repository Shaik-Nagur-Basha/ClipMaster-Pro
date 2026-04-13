import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { APP_NAME } from "./constants";
import { useClipStore } from "./store/useClipStore";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import FavoritesPage from "./pages/FavoritesPage";
import RecycleBinPage from "./pages/RecycleBinPage";
import Settings from "./pages/Settings";
import TagsPage from "./pages/TagsPage";
import { ErrorBoundary } from "./components/ErrorBoundary";

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
          {activePage === "dashboard" && (
            <ErrorBoundary name="Dashboard">
              <Dashboard />
            </ErrorBoundary>
          )}
          {activePage === "favorites" && (
            <ErrorBoundary name="Favorites">
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
    addClipFromMain,
    setMongoConnected,
    setAtlasConnected,
    setSyncState,
  } = useClipStore();

  useEffect(() => {
    // Load all data on mount
    loadClips();
    loadTags();
    loadSettings();

    // Check mongo connection status (safe — mongoStatus always defined)
    const checkMongo = async () => {
      try {
        const ok = await window.clipAPI.mongoStatus();
        setMongoConnected(ok);
      } catch {
        /* ignore */
      }
    };
    checkMongo();

    const checkAtlas = async () => {
      try {
        const s = await (window as any).clipAPI.getSettings();
        if (s.atlasUri) {
          const ok = await (window as any).clipAPI.atlasConnect(s.atlasUri);
          setAtlasConnected(ok);
        }
      } catch {
        /* ignore */
      }
    };
    checkAtlas();

    // Secondary load after a short delay (in case main process is still booting)
    const timer = setTimeout(() => {
      console.log("[App] Performing secondary clip load...");
      loadClips();
    }, 800);

    // Subscribe to new clips pushed from the main process
    const unsubClips = (window.clipAPI.onNewClip ?? noop)((item: any) =>
      addClipFromMain(item),
    );

    // Global sync update listener
    const unsubSync = (window.clipAPI.onSyncUpdate ?? noop)((state: any) =>
      setSyncState(state),
    );

    return () => {
      clearTimeout(timer);
      if (typeof unsubClips === "function") unsubClips();
      if (typeof unsubSync === "function") unsubSync();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
