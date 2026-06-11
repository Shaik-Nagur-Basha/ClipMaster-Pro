import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { APP_NAME } from "./constants";
import { useClipStore } from "./store/useClipStore";
import Sidebar from "./components/Sidebar";
import { FullPageSpinner } from "./components/LoadingSpinner";
import { ErrorBoundary } from "./components/ErrorBoundary";

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const FavoritesPage = React.lazy(() => import("./pages/FavoritesPage"));
const RecycleBinPage = React.lazy(() => import("./pages/RecycleBinPage"));
const Settings = React.lazy(() => import("./pages/Settings"));
const TagsPage = React.lazy(() => import("./pages/TagsPage"));

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

const isElectron = typeof window !== "undefined" && !!(window as any).clipAPI;
const isWindows = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

/* ─────────────────────────────────────────────────────────────────────────────
   TITLE BAR — drag-region SIBLING to buttons (never ancestor)
───────────────────────────────────────────────────────────────────────────── */
function TitleBar() {
  const showCustomButtons = !isElectron || !isWindows;

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
          className="rotating-gradient-dot"
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            flexShrink: 0,
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
      {showCustomButtons && (
        <>
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
        </>
      )}
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
    pasteClip: noop_p,
    closePopup: noop,
    setSearchFocusable: noop,
    // Tags & Settings
    getTags: async () => [],
    saveTags: noop_p,
    getSettings: async () => ({
      autoLaunch: false,
      maxEntries: 5000,
      pollingInterval: 600,
      viewMode: "list" as const,
      displayMode: "preview" as const,
    }),
    saveSettings: noop_p,
    openExternal: noop,
    onNewClip: () => noop,
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
    getActiveDownloadStatus: async () => ({
      status: "idle",
      progress: 0,
      targetRelease: null,
    }),
    onUpdateProgress: () => noop,
    onUpdateError: () => noop,
    onUpdateSuccess: () => noop,
    onUpdateStatusReset: () => noop,
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
          <React.Suspense
            fallback={
              <FullPageSpinner
                label="All Clips"
                subtitle="Loading your clipboard history"
              />
            }
          >
            {activePage === "dashboard" && (
              <ErrorBoundary name="Dashboard">
                <Dashboard />
              </ErrorBoundary>
            )}
          </React.Suspense>

          <React.Suspense
            fallback={
              <FullPageSpinner
                label="Favourites"
                subtitle="Fetching your starred clips"
              />
            }
          >
            {activePage === "favorites" && (
              <ErrorBoundary name="Favourites">
                <FavoritesPage />
              </ErrorBoundary>
            )}
          </React.Suspense>

          <React.Suspense
            fallback={
              <FullPageSpinner
                label="Recycle Bin"
                subtitle="Loading recently deleted items"
              />
            }
          >
            {activePage === "recycle" && (
              <ErrorBoundary name="Recycle Bin">
                <RecycleBinPage />
              </ErrorBoundary>
            )}
          </React.Suspense>

          <React.Suspense
            fallback={
              <FullPageSpinner
                label="Settings"
                subtitle="Configuring your workspace"
              />
            }
          >
            {activePage === "settings" && (
              <ErrorBoundary name="Settings">
                <Settings />
              </ErrorBoundary>
            )}
          </React.Suspense>

          <React.Suspense
            fallback={
              <FullPageSpinner
                label="Manage Tags"
                subtitle="Loading your tag library"
              />
            }
          >
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
    searchInputRef,
    filters,
    activePage,
    settings,
    saveSettings,
  } = useClipStore();

  useEffect(() => {
    // Global keyboard listener
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const storeState = useClipStore.getState();
      const shouldHandle = !isPopupMode || storeState.popupSearchVisible;
      const searchInputRef = storeState.searchInputRef;

      // Handle Escape in popup mode to close the popup or hide search/dropdowns
      if (e.key === "Escape" && isPopupMode) {
        // 1. If tags dropdown is open, close it first
        if (storeState.popupTagsMenuVisible) {
          e.preventDefault();
          storeState.setPopupTagsMenuVisible(false);
          return;
        }

        // 2. If search input is visible, close it
        if (storeState.popupSearchVisible) {
          e.preventDefault();
          storeState.setPopupSearchVisible(false);
          storeState.setFilters({ search: "" });
          return;
        }

        // 3. Otherwise, close the popup window if not pinned
        const isPinned = storeState.settings.popupPinned === true;
        if (!isPinned) {
          window.clipAPI.closePopup();
          return;
        }
      }

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
        if (isPopupMode && storeState.popupTagsMenuVisible) {
          const tagInput = document.querySelector('input[placeholder="Search tags..."]') as HTMLInputElement;
          if (tagInput) {
            if (document.activeElement !== tagInput) {
              tagInput.focus();
              // Move cursor to the end of the text
              const len = tagInput.value.length;
              tagInput.setSelectionRange(len, len);
            }
          }
          return; // Let native paste handle inserting the clipboard text
        }

        if (shouldHandle && searchInputRef?.current) {
          if (document.activeElement !== searchInputRef.current) {
            searchInputRef.current.focus();
            // Move cursor to the end of the text
            const len = searchInputRef.current.value.length;
            searchInputRef.current.setSelectionRange(len, len);
          }
          return; // Let native paste handle inserting the clipboard text
        }
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

      // Redirect keyboard input to tag search input if tags dropdown is open
      if (isPopupMode && storeState.popupTagsMenuVisible) {
        const tagInput = document.querySelector('input[placeholder="Search tags..."]') as HTMLInputElement;
        if (tagInput) {
          e.preventDefault();
          tagInput.focus();
          const currentValue = tagInput.value;
          tagInput.value = currentValue + e.key;
          // Trigger change event for React controlled state
          const event = new Event("change", { bubbles: true });
          tagInput.dispatchEvent(event);
        }
        return;
      }

      // Focus search input and type the character
      if (shouldHandle && searchInputRef?.current) {
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
  }, []);

  useEffect(() => {
    const initApp = async () => {
      // 1. Load settings & UI state first
      await loadSettings();
      await loadUIState();
      await loadTags();

      // 2. Load the initial page of clips
      await loadClips();
    };

    initApp();

    // Subscribe to new clips pushed from the main process
    const unsubClips = (window.clipAPI.onNewClip ?? noop)((item: any) =>
      addClipFromMain(item),
    );

    // Subscribe to window restore/show refresh events
    const unsubRefresh = (window.clipAPI.onRefreshClips ?? noop)(() => {
      console.log("[App] Window restored. Refreshing active clips...");
      loadClips();
    });

    // Global settings update listener
    const unsubSettings = (window.clipAPI.onSettingsUpdated ?? noop)(
      (settings: any) => {
        useClipStore.setState({ settings });
      },
    );

    // Subscribe to clean-memory events to force GC in renderer
    const unsubCleanMemory = (window.clipAPI.onCleanMemory ?? noop)(() => {
      if ((window as any).gc) {
        try {
          (window as any).gc();
          console.log("[Renderer] Garbage collection triggered successfully.");
        } catch (e) {}
      }
    });

    return () => {
      if (typeof unsubClips === "function") unsubClips();
      if (typeof unsubRefresh === "function") unsubRefresh();
      if (typeof unsubSettings === "function") unsubSettings();
      if (typeof unsubCleanMemory === "function") unsubCleanMemory();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isPopupMode = typeof window !== "undefined" && window.location.search.includes("popup=true");

  if (isPopupMode) {
    const isPinned = settings.popupPinned === true;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          background: "#0d0d1a",
          color: "#fff",
          fontFamily: "Inter, system-ui, sans-serif",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxSizing: "border-box",
        }}
      >
        {/* Draggable Header Bar */}
        <div
          style={{
            height: 38,
            display: "flex",
            alignItems: "center",
            background: "#0a0a14",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            flexShrink: 0,
            paddingLeft: 12,
            paddingRight: 8,
          }}
        >
          {/* Drag Handle */}
          <div
            style={{
              flex: 1,
              /* @ts-ignore */
              WebkitAppRegion: "drag",
              cursor: "move",
              height: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              userSelect: "none",
            }}
          >
            <span
              className="rotating-gradient-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Clipboard History
            </span>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              /* @ts-ignore */
              WebkitAppRegion: "no-drag",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {/* Pin Toggle Button */}
            <button
              onClick={() => saveSettings({ popupPinned: !isPinned })}
              title={isPinned ? "Unpin Window" : "Pin Window"}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                outline: "none",
                borderRadius: 6,
                color: isPinned ? "#6366f1" : "#4b5563",
                cursor: "pointer",
                transition: "all 150ms",
              }}
              className="hover:bg-white/5 active:scale-90"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill={isPinned ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.33-2.91A2 2 0 0 1 15.8 9.9V5a2 2 0 0 0-2-2h-3.6a2 2 0 0 0-2 2v4.9a2 2 0 0 1-.43 1.21L5.44 14a2 2 0 0 0-.44 1.24z" />
              </svg>
            </button>

            {/* Close Button */}
            {isPinned && (
              <button
                onClick={() => window.clipAPI.closePopup()}
                title="Close"
                style={{
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  borderRadius: 6,
                  color: "#9ca3af",
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
                className="hover:bg-rose-500/10 hover:text-rose-400 active:scale-90"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <main
          className="bg-surface-900"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <ErrorBoundary name="PopupDashboard">
            <React.Suspense fallback={<FullPageSpinner label="Loading..." />}>
              <Dashboard isPopup />
            </React.Suspense>
          </ErrorBoundary>
        </main>
      </div>
    );
  }

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
