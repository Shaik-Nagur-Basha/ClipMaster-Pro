import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
  shell,
  session,
  globalShortcut,
  screen,
  Notification,
} from "electron";
import { join } from "path";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { IncomingMessage } from "http";
import { spawn, spawnSync, ChildProcess, exec } from "child_process";
import { getDataDir, storageManager } from "./storage";
import type { ClipboardItem, AppSettings } from "../src/types";
import { exportManager } from "./exportManager";
import { importManager } from "./importManager";
import { syncAutoLaunch } from "./autoLaunch";

// ─── Environment Setup ─────────────────────────────────────────────────────
app.setPath("userData", getDataDir());
app.commandLine.appendSwitch("js-flags", "--expose-gc --max-old-space-size=128");
app.disableHardwareAcceleration();

function checkIsAdmin(): boolean {
  try {
    const res = spawnSync("net", ["session"]);
    return res.status === 0;
  } catch (e) {
    return false;
  }
}

function killOtherInstances() {
  const ourPid = process.pid;
  try {
    spawnSync("powershell", [
      "-Command",
      `Get-Process -Name 'ClipMaster Pro' -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${ourPid} } | Stop-Process -Force`
    ]);
  } catch (err) {
    console.error("Failed to kill other instances:", err);
  }
}

// ─── Singleton guard ────────────────────────────────────────────────────────
let gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  if (checkIsAdmin()) {
    console.log("[Main] Elevated instance detected another running instance. Terminating standard background processes...");
    killOtherInstances();
    spawnSync("powershell", ["-Command", "Start-Sleep -m 500"]);
    gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      console.error("[Main] Failed to acquire lock even after killing other instances. Quitting.");
      app.quit();
      process.exit(0);
    }
  } else {
    app.quit();
    process.exit(0);
  }
}

const isStartupHidden = process.argv.includes("--hidden");

// ─── State ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let popupWindow: BrowserWindow | null = null;
let isPasting = false;
let blurTimeout: NodeJS.Timeout | null = null;
let tray: Tray | null = null;
let targetHwnd = "0";
let isSearchFocusable = false;
let pollTimer: NodeJS.Timeout | null = null;
let hookProcess: ChildProcess | null = null;
let lastClipboardText = "";
let isQuitting = false;
let pauseTimeout: NodeJS.Timeout | null = null;

let clipboardListenerProc: ChildProcess | null = null;
let nativeListenerWatchdog: NodeJS.Timeout | null = null;
let nativeListenerStartTime = 0;
let isRecyclingNativeListener = false;
function getCachedSettings(): AppSettings {
  return storageManager.getSettings();
}

function broadcastSettingsUpdated(updated: AppSettings): void {
  mainWindow?.webContents.send("settings-updated", updated);
  popupWindow?.webContents.send("settings-updated", updated);
}

let registeredShortcutKey: string | null = null;

function registerAppShortcut(): void {
  const settings = storageManager.getSettings();
  const enabled = settings.globalShortcutEnabled !== false;
  const shortcutKey = settings.globalShortcutKey || "CommandOrControl+Shift+V";

  if (!enabled) {
    if (registeredShortcutKey) {
      try {
        globalShortcut.unregister(registeredShortcutKey);
        console.log(`[Shortcut] Unregistered global shortcut: ${registeredShortcutKey}`);
      } catch (err) {
        console.error("[Shortcut] Failed to unregister shortcut:", err);
      }
      registeredShortcutKey = null;
    }
    return;
  }

  if (registeredShortcutKey === shortcutKey) {
    try {
      if (globalShortcut.isRegistered(shortcutKey)) {
        return;
      }
    } catch {}
  }

  if (registeredShortcutKey) {
    try {
      globalShortcut.unregister(registeredShortcutKey);
    } catch (err) {
      console.error("[Shortcut] Failed to unregister old shortcut:", err);
    }
    registeredShortcutKey = null;
  }

  try {
    const isRegistered = globalShortcut.register(shortcutKey, () => {
      console.log(`[Shortcut] Triggered hotkey: ${shortcutKey}`);
      
      // Capture the active window handle before creating/showing the popup
      try {
        const pasterPath = getPasterPath();
        const child = spawnSync(pasterPath, ["get-foreground"], { windowsHide: true });
        targetHwnd = child.stdout.toString().trim();
        console.log(`[Shortcut] Captured target window HWND: ${targetHwnd}`);
      } catch (err) {
        console.error("[Shortcut] Failed to capture active window:", err);
        targetHwnd = "0";
      }

      createPopupWindow();
    });

    if (isRegistered) {
      registeredShortcutKey = shortcutKey;
      console.log(`[Shortcut] Registered global shortcut: ${shortcutKey}`);
    } else {
      console.warn(`[Shortcut] Could not register shortcut ${shortcutKey}. It might be in use by another application.`);
    }
  } catch (err) {
    console.error(`[Shortcut] Invalid shortcut key or registration error for ${shortcutKey}:`, err);
  }
}


// UI State Caching to preserve page/selection across window recreate
let uiState = {
  activePage: "dashboard",
  selectedClipId: null,
  sortMode: "newest",
  filters: {
    search: "",
    tags: [],
    isFavorite: null,
    lengthFilter: "all",
    dateFrom: null,
    dateTo: null,
    minWordCount: null,
    maxWordCount: null,
  },
};
let uiStateSaveTimeout: NodeJS.Timeout | null = null;

let memoryCleanupTimeout: NodeJS.Timeout | null = null;

function cleanUpMemory(): void {
  console.log("[Memory] Initiating memory cleanup...");
  try {
    session.defaultSession.clearCache().catch(() => {});
  } catch (err) {}

  if (global.gc) {
    try {
      global.gc();
      console.log("[Memory] Main process garbage collection completed successfully.");
    } catch (e) {
      console.warn("[Memory] Main process GC failed:", e);
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send("clean-memory");
    } catch (e) {}
  }
}

function scheduleMemoryCleanup(delayMs: number = 3000): void {
  if (memoryCleanupTimeout) {
    clearTimeout(memoryCleanupTimeout);
  }
  memoryCleanupTimeout = setTimeout(() => {
    cleanUpMemory();
    memoryCleanupTimeout = null;
  }, delayMs);
}

function getPasterPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    const devPath = join(__dirname, "paster.exe");
    if (fs.existsSync(devPath)) return devPath;
    return join(__dirname, "../../electron/paster.exe");
  }
  const prodPath = join(__dirname, "paster.exe").replace("app.asar", "app.asar.unpacked");
  return prodPath;
}

function startHookProcess(): void {
  if (hookProcess) return;
  if (!popupWindow || popupWindow.isDestroyed()) return;

  const hwndBuf = popupWindow.getNativeWindowHandle();
  if (!hwndBuf) return;

  try {
    const hwnd = process.arch === "x64" ? hwndBuf.readBigUInt64LE().toString() : hwndBuf.readUInt32LE().toString();
    const pasterPath = getPasterPath();
    console.log(`[Popup] Starting persistent hook process for HWND: ${hwnd}`);
    hookProcess = spawn(pasterPath, [hwnd, "hook"], { windowsHide: true });
    
    hookProcess.stdout?.on("data", (data) => {
      const lines = data.toString().split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        console.log(`[Paster Output] ${trimmed}`);
        if (trimmed.startsWith("CHAR:")) {
          const val = trimmed.substring(5);
          popupWindow?.webContents.send("hooked-key", { type: "char", value: val });
        } else if (trimmed.startsWith("KEY:")) {
          const val = trimmed.substring(4);
          popupWindow?.webContents.send("hooked-key", { type: "key", value: val });
        } else if (trimmed === "CLICK_OUTSIDE") {
          console.log("[Popup] Detected mouse click outside popup. Hiding search/tag focus...");
          popupWindow?.webContents.send("click-outside");
        }
      }
    });

    hookProcess.on("close", () => {
      console.log(`[Popup] Persistent hook process closed.`);
      hookProcess = null;
    });
  } catch (err) {
    console.error("[Popup] Failed to start persistent hook process:", err);
  }
}

function stopHookProcess(): void {
  if (hookProcess) {
    try {
      hookProcess.kill();
    } catch {}
    hookProcess = null;
  }
}

function closePopupWindow(): void {
  stopHookProcess();
  if (popupWindow && !popupWindow.isDestroyed()) {
    try {
      popupWindow.hide();
    } catch {}
  }
}

function createPopupWindow(): void {
  const width = 420;
  const height = 550;

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);

  // Center horizontally relative to the cursor
  let x = cursorPoint.x - Math.floor(width / 2);
  // Place it 15px below the cursor
  let y = cursorPoint.y + 15;

  const bounds = display.bounds;
  if (x < bounds.x) x = bounds.x;
  if (x + width > bounds.x + bounds.width) x = bounds.x + bounds.width - width;
  
  // If placing it below the cursor pushes it off the bottom of the screen, place it above the cursor instead!
  if (y + height > bounds.y + bounds.height) {
    y = cursorPoint.y - height - 15; // 15px above the cursor
  }
  if (y < bounds.y) y = bounds.y;

  if (popupWindow && !popupWindow.isDestroyed()) {
    if (popupWindow.isVisible()) {
      closePopupWindow();
    } else {
      popupWindow.setBounds({ x, y, width, height });
      popupWindow.showInactive();
      startHookProcess();
      
      // Refresh clips list in the renderer
      popupWindow.webContents.send("refresh-clips");
    }
    return;
  }

  popupWindow = new BrowserWindow({
    width: width,
    height: height,
    x: x,
    y: y,
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    backgroundColor: "#0d0d1a",
    icon: join(
      __dirname,
      app.isPackaged ? "../renderer/icon.ico" : "../../public/icon.ico",
    ),
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const popupUrl = !app.isPackaged && process.env["ELECTRON_RENDERER_URL"]
    ? `${process.env["ELECTRON_RENDERER_URL"]}?popup=true`
    : `file://${join(__dirname, "../renderer/index.html")}?popup=true`;

  popupWindow.loadURL(popupUrl);

  // Hook WM_MOUSEACTIVATE (0x0021) to prevent window from taking focus and deactivating target application on click
  const WM_MOUSEACTIVATE = 0x0021;
  const MA_NOACTIVATE = 3;
  popupWindow.hookWindowMessage(WM_MOUSEACTIVATE, () => {
    return MA_NOACTIVATE;
  });

  popupWindow.once("ready-to-show", () => {
    // Call paster.exe to set topmost via HWND_TOPMOST and apply WS_EX_TOPMOST/WS_EX_NOACTIVATE style BEFORE showing the window
    const hwndBuf = popupWindow?.getNativeWindowHandle();
    if (hwndBuf) {
      try {
        const hwnd = process.arch === "x64" ? hwndBuf.readBigUInt64LE().toString() : hwndBuf.readUInt32LE().toString();
        const pasterPath = getPasterPath();
        console.log(`[Popup] Pre-setting topmost/noactivate styles for HWND: ${hwnd}`);
        const child = spawn(pasterPath, [hwnd, "topmost"], { windowsHide: true });
        
        let styleApplied = false;
        child.stdout?.on("data", (data) => {
          const msg = data.toString().trim();
          console.log("[Popup] paster topmost stdout:", msg);
          if (msg.includes("TOPMOST_SUCCESS") && !styleApplied) {
            styleApplied = true;
            if (popupWindow && !popupWindow.isDestroyed()) {
              popupWindow.showInactive();
              startHookProcess();
            }
          }
        });
        child.stderr?.on("data", (data) => {
          console.error("[Popup] paster topmost stderr:", data.toString().trim());
        });

        child.on("close", () => {
          console.log(`[Popup] paster topmost monitor closed for HWND: ${hwnd}`);
        });
      } catch (err) {
        console.error("[Popup] Failed to apply topmost styling:", err);
      }
    }
  });

  popupWindow.on("blur", () => {
    if (isPasting) return;
    
    blurTimeout = setTimeout(() => {
      if (popupWindow && !popupWindow.isDestroyed() && !popupWindow.isFocused()) {
        const settings = storageManager.getSettings();
        if (settings.popupPinned !== true) {
          closePopupWindow();
        }
      }
    }, 150);
  });

  popupWindow.on("focus", () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
  });

  popupWindow.on("moved", () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.setAlwaysOnTop(true);
    }
  });

  popupWindow.on("closed", () => {
    if (hookProcess) {
      try {
        hookProcess.kill();
      } catch {}
      hookProcess = null;
    }
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
    popupWindow = null;
    scheduleMemoryCleanup(500);
  });
}

// ─── Window ─────────────────────────────────────────────────────────────────
function createWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    // Force window to foreground on Windows
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    frame: process.platform !== "win32",
    titleBarStyle: process.platform === "win32" ? "hidden" : undefined,
    titleBarOverlay: process.platform === "win32" ? {
      color: "#0d0d1a",
      symbolColor: "#a0a0b0",
      height: 40,
    } : undefined,
    backgroundColor: "#0d0d1a",
    show: false,
    title: "ClipMaster Pro",
    icon: join(
      __dirname,
      app.isPackaged ? "../renderer/icon.ico" : "../../public/icon.ico",
    ),
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Window Close Behavior:
  // Let it close and destroy the window completely if isQuitting is false.
  // This frees renderer process memory when backgrounded.
  mainWindow.on("closed", () => {
    mainWindow = null;
    scheduleMemoryCleanup(1000);
  });

  mainWindow.on("minimize", () => {
    try {
      (mainWindow?.webContents as any).forcefullyDeprioritize?.();
    } catch (e) {}
    scheduleMemoryCleanup(1500);
  });

  mainWindow.on("blur", () => {
    scheduleMemoryCleanup(5000); // 5 seconds after becoming inactive
  });

  mainWindow.on("focus", () => {
    if (memoryCleanupTimeout) {
      clearTimeout(memoryCleanupTimeout);
      memoryCleanupTimeout = null;
    }
  });

  mainWindow.on("restore", () => {
    if (memoryCleanupTimeout) {
      clearTimeout(memoryCleanupTimeout);
      memoryCleanupTimeout = null;
    }
    try {
      mainWindow?.webContents.send("refresh-clips");
    } catch (e) {}
  });

  mainWindow.on("show", () => {
    if (memoryCleanupTimeout) {
      clearTimeout(memoryCleanupTimeout);
      memoryCleanupTimeout = null;
    }
    try {
      mainWindow?.webContents.send("refresh-clips");
    } catch (e) {}
  });
}

// ─── Tray ───────────────────────────────────────────────────────────────────
function createTray(): void {
  const iconPath = join(
    __dirname,
    app.isPackaged ? "../renderer/icon.ico" : "../../public/icon.ico",
  );
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("ClipMaster Pro");
  tray.on("double-click", () => {
    createWindow();
  });
  updateTrayMenu();
}

function updateTrayMenu(): void {
  if (!tray) return;
  const settings = storageManager.getSettings();
  const isPaused = settings.pauseCaptureOption && settings.pauseCaptureOption !== "never";

  const menu = Menu.buildFromTemplate([
    {
      label: "Open ClipMaster Pro",
      click: () => {
        createWindow();
      },
    },
    { type: "separator" },
    {
      label: "Pause Capturing",
      type: "checkbox",
      checked: Boolean(isPaused),
      click: async (item) => {
        const option = item.checked ? "restart" : "never";
        if (option === "never") {
          clearPauseTimeout();
        }
        await storageManager.saveSettings({
          pauseCaptureOption: option,
          pauseUntil: null,
        });
        const updated = storageManager.getSettings();
        broadcastSettingsUpdated(updated);
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function clearPauseTimeout(): void {
  if (pauseTimeout) {
    clearTimeout(pauseTimeout);
    pauseTimeout = null;
  }
}

function setupPauseTimeout(ms: number): void {
  clearPauseTimeout();
  pauseTimeout = setTimeout(async () => {
    await storageManager.saveSettings({
      pauseCaptureOption: "never",
      pauseUntil: null,
    });
    const updated = storageManager.getSettings();
    broadcastSettingsUpdated(updated);
    updateTrayMenu();
    pauseTimeout = null;
  }, ms);
}

// ─── Clipboard Polling ──────────────────────────────────────────────────────
async function handleClipboardCapture(text: string): Promise<void> {
  console.log("[Clipboard] Capture triggered, length:", text.length);
  try {
    const newItem = await storageManager.addEntry(text);
    console.log("[Clipboard] addEntry result:", newItem ? newItem.id : "null (ignored)");
    if (!newItem) return;

    // Only update renderer if the window is currently visible and not minimized.
    // This saves CPU and RAM rendering loops in the background.
    const isWindowVisible = mainWindow && !mainWindow.isMinimized() && mainWindow.isVisible();
    if (isWindowVisible && mainWindow) {
      mainWindow.webContents.send("new-clip", newItem);
    }

    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.webContents.send("new-clip", newItem);
    }
  } catch (err) {
    console.error("[Clipboard] Capture error:", err);
  }
}

const POLL_INTERVAL_MS = 500;
let pollTick = 0;

function startPoller(): void {
  if (pollTimer) return;
  if (clipboardListenerProc) {
    console.log("[Clipboard] Native listener is active. Skipping poller start.");
    return;
  }
  lastClipboardText = clipboard.readText() ?? "";
  console.log("[Clipboard] Poller started, seed:", JSON.stringify(lastClipboardText.substring(0, 60)));

  pollTimer = setInterval(() => {
    try {
      const current = clipboard.readText() ?? "";
      pollTick++;
      if (pollTick % 10 === 0) {
        console.log(`[Clipboard] tick=${pollTick} current[0..40]=${JSON.stringify(current.substring(0, 40))} same=${current === lastClipboardText}`);
      }

      // Check if capturing is paused
      const settings = getCachedSettings();
      if (settings.pauseCaptureOption && settings.pauseCaptureOption !== "never") {
        if (settings.pauseCaptureOption === "restart") {
          lastClipboardText = current;
          return;
        }

        if (settings.pauseUntil) {
          if (Date.now() < settings.pauseUntil) {
            lastClipboardText = current;
            return;
          } else {
            storageManager.saveSettings({
              pauseCaptureOption: "never",
              pauseUntil: null,
            });
            broadcastSettingsUpdated(storageManager.getSettings());
            updateTrayMenu();
          }
        }
      }

      if (!current.trim() || current === lastClipboardText) return;
      console.log("[Clipboard] Change detected! length:", current.length, "preview:", JSON.stringify(current.substring(0, 80)));
      lastClipboardText = current;
      handleClipboardCapture(current);
    } catch (err) {
      console.error("[Clipboard] Poll error:", err);
    }
  }, POLL_INTERVAL_MS);
}

function stopPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("[Clipboard] Poller stopped");
  }
}

function getClipboardListenerPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    const devPath = join(__dirname, "clipboard-listener.exe");
    if (fs.existsSync(devPath)) return devPath;
    return join(__dirname, "../../electron/clipboard-listener.exe");
  }
  const prodPath = join(__dirname, "clipboard-listener.exe").replace("app.asar", "app.asar.unpacked");
  return prodPath;
}

function startClipboardListener(): void {
  stopPoller();
  if (clipboardListenerProc) return;

  const helperPath = getClipboardListenerPath();
  console.log("[Clipboard] Spawning native listener from:", helperPath);

  try {
    clipboardListenerProc = spawn(helperPath, [], {
      windowsHide: true,
    });
    nativeListenerStartTime = Date.now();

    clipboardListenerProc.stdout?.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg.includes("CLIPBOARD_CHANGED")) {
        const current = clipboard.readText() ?? "";

        // Check if capturing is paused
        const settings = getCachedSettings();
        if (settings.pauseCaptureOption && settings.pauseCaptureOption !== "never") {
          if (settings.pauseCaptureOption === "restart") {
            lastClipboardText = current;
            return;
          }

          if (settings.pauseUntil) {
            if (Date.now() < settings.pauseUntil) {
              lastClipboardText = current;
              return;
            } else {
              storageManager.saveSettings({
                pauseCaptureOption: "never",
                pauseUntil: null,
              });
              broadcastSettingsUpdated(storageManager.getSettings());
              updateTrayMenu();
            }
          }
        }

        if (!current.trim() || current === lastClipboardText) return;
        console.log("[Clipboard] Native change detected! length:", current.length);
        lastClipboardText = current;
        handleClipboardCapture(current);
      }
    });

    clipboardListenerProc.on("error", (err) => {
      console.error("[Clipboard] Native listener error, falling back:", err);
      startPollerFallback();
    });

    clipboardListenerProc.on("exit", (code) => {
      if (isRecyclingNativeListener) {
        isRecyclingNativeListener = false;
        console.log("[Clipboard] Native listener exited due to recycling. Starting new instance...");
        clipboardListenerProc = null;
        startClipboardListener();
        return;
      }
      if (code !== 0 && !isQuitting) {
        console.warn(`[Clipboard] Native listener exited with code ${code}. Restarting poller fallback.`);
        clipboardListenerProc = null;
        startPollerFallback();
      }
    });

    console.log("[Clipboard] Native Windows clipboard listener started successfully.");
  } catch (err) {
    console.error("[Clipboard] Failed to start native listener:", err);
    startPollerFallback();
  }
}

function startPollerFallback(): void {
  console.log("[Clipboard] Falling back to polling mode...");
  if (clipboardListenerProc) {
    try {
      clipboardListenerProc.kill();
    } catch {}
    clipboardListenerProc = null;
  }
  startPoller();
}

function stopClipboardListener(): void {
  stopPoller();
  stopNativeListenerWatchdog();
  if (clipboardListenerProc) {
    try {
      clipboardListenerProc.kill();
    } catch {}
    clipboardListenerProc = null;
    console.log("[Clipboard] Native Windows clipboard listener stopped.");
  }
}

function stopNativeListenerWatchdog(): void {
  if (nativeListenerWatchdog) {
    clearInterval(nativeListenerWatchdog);
    nativeListenerWatchdog = null;
  }
}

function startNativeListenerWatchdog(): void {
  // Simple empty stub since native listener watchdog is no longer needed
}

function restartNativeListener(): void {
  console.log("[Clipboard] Restarting native clipboard listener...");
  if (clipboardListenerProc) {
    isRecyclingNativeListener = true;
    try {
      clipboardListenerProc.kill();
    } catch {}
    clipboardListenerProc = null;
  } else {
    startClipboardListener();
  }
}

let activeDownloadRequest: any = null;
let wasDownloadCancelled = false;
let activeDownloadRelease: any = null;
let activeDownloadProgress = 0;
let activeDownloadStatus: "idle" | "checking" | "downloading" | "ready" | "error" = "idle";
let activeDownloadErrorMessage: string | null = null;

// Helper to download a file with progress tracking and redirection handling
function downloadFile(url: string, destPath: string, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = (targetUrl: string) => {
      const req = https.get(targetUrl, {
        headers: {
          "User-Agent": "ClipMaster-Pro-Updater",
          "Accept": "application/octet-stream",
        }
      }, (res: IncomingMessage) => {
        if ([301, 302, 307, 308].includes(res.statusCode || 0)) {
          if (res.headers.location) {
            request(res.headers.location);
            return;
          }
        }

        if (res.statusCode !== 200) {
          activeDownloadRequest = null;
          reject(new Error(`Failed to download: HTTP ${res.statusCode} ${res.statusMessage}`));
          return;
        }

        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let receivedBytes = 0;
        let lastReportedProgress = -1;
        let lastReportTime = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on("data", (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            const progress = Math.round((receivedBytes / totalBytes) * 100);
            const now = Date.now();
            if (progress !== lastReportedProgress && (now - lastReportTime >= 150 || progress === 100)) {
              lastReportedProgress = progress;
              lastReportTime = now;
              onProgress(progress);
            }
          }
        });

        res.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          activeDownloadRequest = null;
          resolve();
        });

        fileStream.on("error", (err) => {
          activeDownloadRequest = null;
          fs.unlink(destPath, () => {});
          reject(err);
        });

        res.on("error", (err) => {
          activeDownloadRequest = null;
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      req.on("error", (err) => {
        activeDownloadRequest = null;
        reject(err);
      });

      activeDownloadRequest = req;
    };

    request(url);
  });
}

// ─── IPC Registration ───────────────────────────────────────────────────────
function registerIPC(): void {
  // ── Window controls ─────────────────────────────────────────────────────
  ipcMain.on("window-minimize", () => {
    console.log("[IPC] minimize");
    mainWindow?.minimize();
  });
  ipcMain.on("window-maximize", () => {
    console.log("[IPC] maximize");
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on("window-close", () => {
    console.log("[IPC] close - closing to tray");
    mainWindow?.close(); // Triggers standard window close and destruction
  });

  ipcMain.on("update-target-hwnd", () => {
    try {
      const pasterPath = getPasterPath();
      const child = spawnSync(pasterPath, ["get-foreground"], { windowsHide: true });
      const activeHwnd = child.stdout.toString().trim();
      
      if (popupWindow && !popupWindow.isDestroyed()) {
        const hwndBuf = popupWindow.getNativeWindowHandle();
        const popupHwndStr = process.arch === "x64" ? hwndBuf.readBigUInt64LE().toString() : hwndBuf.readUInt32LE().toString();
        if (activeHwnd !== popupHwndStr && activeHwnd !== "0" && activeHwnd !== "") {
          targetHwnd = activeHwnd;
          console.log(`[Hover] Updated target window HWND: ${targetHwnd}`);
        }
      }
    } catch (err) {
      console.error("[Hover] Failed to update target window HWND:", err);
    }
  });

  ipcMain.on("set-search-focusable", (_e, focusable: boolean) => {
    console.log(`[IPC] set-search-focusable: ${focusable}`);
    isSearchFocusable = focusable;
    if (!hookProcess) {
      startHookProcess();
    }
    if (hookProcess && hookProcess.stdin && !hookProcess.stdin.destroyed) {
      if (focusable) {
        hookProcess.stdin.write("ENABLE_KEYBOARD\n");
      } else {
        hookProcess.stdin.write("DISABLE_KEYBOARD\n");
      }
    }
  });

function showUacWarningNotification() {
  const notification = new Notification({
    title: "ClipMaster Pro",
    body: "Cannot paste into elevated window (e.g. Task Manager). Please run ClipMaster Pro as Administrator.",
    silent: false,
  });
  notification.show();
}

  ipcMain.handle("paste-clip", async () => {
    console.log("[IPC] paste-clip triggered");
    if (popupWindow && !popupWindow.isDestroyed()) {
      isPasting = true;
      
      const hwndBuf = popupWindow.getNativeWindowHandle();
      const hwnd = process.arch === "x64" ? hwndBuf.readBigUInt64LE().toString() : hwndBuf.readUInt32LE().toString();
      
      const settings = storageManager.getSettings();
      const isPinned = settings.popupPinned === true;
      
      // DO NOT hide the popup before pasting.
      // Like Windows Clipboard (Win+V), the popup stays visible during the paste.
      // Hiding it causes Windows to re-evaluate activation and steal focus from the target.
      
      const pasterPath = getPasterPath();
      try {
        // TEMPORARILY disable keyboard hook during paste so Ctrl+V is not intercepted
        if (hookProcess && hookProcess.stdin && !hookProcess.stdin.destroyed) {
          console.log("[Paste] Temporarily disabling keyboard hook during paste");
          hookProcess.stdin.write("DISABLE_KEYBOARD\n");
        }

        // We always pass "0" (never refocus the popup window) to prevent deactivation of target window.
        const child = spawn(pasterPath, [hwnd, targetHwnd, "50", "0"], { windowsHide: true });

        child.stdout?.on("data", (data) => {
          const msg = data.toString().trim();
          console.log("[Paste] paster stdout:", msg);
          if (msg.includes("UAC_ELEVATION_BLOCKED")) {
            showUacWarningNotification();
          }
          if (msg.includes("PASTE_DONE")) {
            // Paste is complete and focus has been re-asserted on target.
            // NOW it's safe to hide the popup.
            if (!isPinned) {
              closePopupWindow();
            }
          }
        });

        const done = () => {
          setTimeout(() => {
            if (isPinned) {
              // Pinned popup: keep it visible, but refocus target window so it remains active.
              setTimeout(() => {
                if (targetHwnd && targetHwnd !== "0") {
                  console.log(`[Paste] Pinned refocusing target window: ${targetHwnd}`);
                  const childRefocus = spawn(pasterPath, [targetHwnd, "refocus"], { windowsHide: true });
                  childRefocus.stdout?.on("data", (data) => {
                    console.log("[Refocus-Pinned] paster stdout:", data.toString().trim());
                  });
                }
              }, 50);
              
              // Re-enable keyboard hook if search or tags input was focused
              if (isSearchFocusable && hookProcess && hookProcess.stdin && !hookProcess.stdin.destroyed) {
                console.log("[Paste] Re-enabling keyboard hook for pinned popup");
                hookProcess.stdin.write("ENABLE_KEYBOARD\n");
              }
              
              isPasting = false;
            } else {
              // Unpinned popup: hide it, and refocus target window.
              closePopupWindow();
              
              // Refocus the target window after hiding the popup!
              // Wait 50ms for the window hide to process at OS level
              setTimeout(() => {
                if (targetHwnd && targetHwnd !== "0") {
                  console.log(`[Paste] Unpinned refocusing target window: ${targetHwnd}`);
                  const childRefocus = spawn(pasterPath, [targetHwnd, "refocus"], { windowsHide: true });
                  childRefocus.stdout?.on("data", (data) => {
                    console.log("[Refocus-Unpinned] paster stdout:", data.toString().trim());
                  });
                }
              }, 50);
              
              isPasting = false;
            }
          }, 30);
        };
        child.on("close", done);
        child.on("error", done);
      } catch (err) {
        console.error("[Paste] Failed to spawn paster:", err);
        isPasting = false;
      }
    }
  });

  ipcMain.on("close-popup", () => {
    closePopupWindow();
  });

  // ── Clipboard CRUD ───────────────────────────────────────────────────────
  ipcMain.handle("get-clips", async (_e, options?: any) => await storageManager.readAll(options));
  ipcMain.handle("get-counts", async () => await storageManager.getCounts());

  ipcMain.handle("add-clip", async (_e, text: string) => {
    const item = await storageManager.addEntry(text);
    return item;
  });

  ipcMain.handle("update-clip", async (_e, item: ClipboardItem) => {
    await storageManager.updateEntry(item);
    return true;
  });

  ipcMain.handle("delete-clip", async (_e, id: string) => {
    await storageManager.softDelete(id);
    return true;
  });

  ipcMain.handle("permanent-delete", async (_e, id: string) => {
    await storageManager.permanentDelete(id);
    return true;
  });

  ipcMain.handle("permanent-delete-bulk", async (_e, ids: string[]) => {
    await storageManager.permanentDeleteBulk(ids);
    return true;
  });

  ipcMain.handle("restore-clip", async (_e, id: string) => {
    await storageManager.restoreEntry(id);
    return true;
  });

  ipcMain.handle("copy-to-clipboard", async (_e, text: string) => {
    clipboard.writeText(text);
    lastClipboardText = text; // prevent immediate re-capture
    return true;
  });

  // ── Tags & Settings ──────────────────────────────────────────────────────
  ipcMain.handle("get-tags", async () => await storageManager.getTags());
  ipcMain.handle("save-tags", async (_e, tags) => {
    await storageManager.saveTags(tags);
    return true;
  });
  ipcMain.handle("get-settings", async () => storageManager.getSettings());
  ipcMain.handle(
    "save-settings",
    async (_e, partial: Record<string, unknown>) => {
      if ("pauseCaptureOption" in partial) {
        const option = partial.pauseCaptureOption as string;
        if (option === "15mins") {
          partial.pauseUntil = Date.now() + 15 * 60 * 1000;
          setupPauseTimeout(15 * 60 * 1000);
        } else if (option === "30mins") {
          partial.pauseUntil = Date.now() + 30 * 60 * 1000;
          setupPauseTimeout(30 * 60 * 1000);
        } else if (option === "1hour") {
          partial.pauseUntil = Date.now() + 60 * 60 * 1000;
          setupPauseTimeout(60 * 60 * 1000);
        } else {
          partial.pauseUntil = null;
          clearPauseTimeout();
        }
      }

      await storageManager.saveSettings(partial as never);
      if ("autoLaunch" in partial) {
        syncAutoLaunch(Boolean(partial.autoLaunch));
      }
      if ("globalShortcutEnabled" in partial || "globalShortcutKey" in partial) {
        registerAppShortcut();
      }
      updateTrayMenu();
      broadcastSettingsUpdated(storageManager.getSettings());
      return storageManager.getSettings();
    },
  );


  // ── UI State Channel ─────────────────────────────────────────────────────
  ipcMain.on("update-ui-state", (_e, state) => {
    uiState = { ...uiState, ...state };
    if (uiStateSaveTimeout) {
      clearTimeout(uiStateSaveTimeout);
    }
    uiStateSaveTimeout = setTimeout(() => {
      storageManager.saveUiState(uiState).catch(() => {});
      uiStateSaveTimeout = null;
    }, 1000); // 1-second debounce to merge rapid updates
  });

  ipcMain.handle("get-ui-state", async () => {
    return uiState;
  });



  ipcMain.handle("open-external", async (_e, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle("get-app-info", async () => ({
    name: "ClipMaster Pro",
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    isPackaged: app.isPackaged,
  }));

  // ── Application Updates ──────────────────────────────────────────────────
  ipcMain.handle("get-releases", async () => {
    try {
      const releasesUrl = import.meta.env.MAIN_VITE_GITHUB_RELEASES_URL || process.env.GITHUB_RELEASES_URL;
      if (!releasesUrl) {
        console.warn("[Update] MAIN_VITE_GITHUB_RELEASES_URL or GITHUB_RELEASES_URL is not defined. Skipping update check.");
        return [];
      }
      const response = await fetch(releasesUrl, {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "ClipMaster-Pro-Updater",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch releases: HTTP ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error("[Update] Fetch releases failed:", err);
      throw err;
    }
  });

  function selectAssetForPlatform(assets: any[]): any {
    const platform = process.platform;
    if (platform === "win32") {
      const currentExe = app.getPath("exe").toLowerCase();
      const isInstalled = !currentExe.includes("\\temp\\") && !currentExe.includes("\\appdata\\local\\temp\\");

      if (isInstalled) {
        let selectedAsset = assets.find((a: any) => a.name.endsWith(".exe") && (a.name.toLowerCase().includes("setup") || a.name.toLowerCase().includes("installer")));
        if (!selectedAsset) {
          selectedAsset = assets.find((a: any) => a.name.endsWith(".exe"));
        }
        return selectedAsset;
      } else {
        let selectedAsset = assets.find((a: any) => a.name.endsWith(".exe") && !a.name.toLowerCase().includes("setup") && !a.name.toLowerCase().includes("installer"));
        if (!selectedAsset) {
          selectedAsset = assets.find((a: any) => a.name.endsWith(".exe"));
        }
        return selectedAsset;
      }
    } else if (platform === "darwin") {
      return assets.find((a: any) => a.name.endsWith(".dmg") || a.name.endsWith(".zip") || a.name.endsWith(".pkg"));
    } else {
      return assets.find((a: any) => a.name.endsWith(".AppImage") || a.name.endsWith(".deb") || a.name.endsWith(".tar.gz"));
    }
  }

  ipcMain.handle("trigger-update", async (_e, release: any) => {
    const platform = process.platform;
    const assets = release.assets || [];
    const selectedAsset = selectAssetForPlatform(assets);

    if (!selectedAsset) {
      const errMsg = `No suitable binary asset found for platform '${platform}' in release ${release.tag_name}`;
      console.error("[Update] " + errMsg);
      mainWindow?.webContents.send("update-error", errMsg);
      return;
    }

    console.log(`[Update] Selected asset for download: ${selectedAsset.name} from URL: ${selectedAsset.browser_download_url}`);

    const tempDir = app.getPath("temp");
    const tempFilePath = path.join(tempDir, selectedAsset.name);

    try {
      wasDownloadCancelled = false;
      activeDownloadRelease = release;
      activeDownloadErrorMessage = null;

      let isAlreadyDownloaded = false;
      if (fs.existsSync(tempFilePath)) {
        const stats = fs.statSync(tempFilePath);
        if (stats.size === selectedAsset.size) {
          isAlreadyDownloaded = true;
        }
      }

      if (!isAlreadyDownloaded) {
        activeDownloadStatus = "downloading";
        activeDownloadProgress = 0;
        mainWindow?.webContents.send("update-progress", 0);
        
        await downloadFile(selectedAsset.browser_download_url, tempFilePath, (progress) => {
          activeDownloadProgress = progress;
          mainWindow?.webContents.send("update-progress", progress);
        });

        console.log("[Update] Download completed to:", tempFilePath);

        activeDownloadStatus = "ready";
        activeDownloadProgress = 100;
        mainWindow?.webContents.send("update-success");
        return; // Early return: do not install automatically. Wait for user to click apply.
      } else {
        console.log("[Update] File already fully downloaded. Skipping download step and proceeding to installation.");
        mainWindow?.webContents.send("update-progress", 100);
      }

      activeDownloadStatus = "ready";
      activeDownloadProgress = 100;

      // Perform dev mode safety check
      if (!app.isPackaged) {
        console.log("[Update] Development Mode active: Overwrite and restart simulation successful.");
        mainWindow?.webContents.send("update-progress", 100);
        setTimeout(() => {
          mainWindow?.webContents.send("update-success");
        }, 500);
        return;
      }

      const currentExe = app.getPath("exe");
      const currentPid = process.pid;

      if (platform === "win32") {
        const isSetup = selectedAsset.name.toLowerCase().includes("setup") || selectedAsset.name.toLowerCase().includes("installer");
        if (isSetup) {
          console.log("[Update] Spawning Setup installer via shell.openPath:", tempFilePath);
          shell.openPath(tempFilePath).then((error) => {
            if (error) {
              console.error("[Update] shell.openPath failed:", error);
              mainWindow?.webContents.send("update-error", `Failed to launch installer: ${error}`);
            } else {
              app.quit();
            }
          }).catch((err) => {
            console.error("[Update] shell.openPath exception:", err);
            mainWindow?.webContents.send("update-error", `Failed to launch installer: ${err.message || err}`);
          });
        } else {
          const scriptPath = path.join(tempDir, "install-update.bat");
          const batContent = `@echo off
set /a retry=0
:loop
tasklist /FI "PID eq ${currentPid}" 2>NUL | find /I "${currentPid}" >NUL
if "%ERRORLEVEL%"=="0" (
  timeout /t 1 /nobreak >NUL
  goto loop
)
:copy_attempt
set /a retry+=1
copy /Y "${tempFilePath}" "${currentExe}"
if errorlevel 1 (
  if %retry% LSS 10 (
    timeout /t 1 /nobreak >NUL
    goto copy_attempt
  )
  echo Failed to copy updated executable. Permissions or a file lock might be preventing this.
  pause
  exit /b 1
)
start "" "${currentExe}"
del "%~f0"
`;
          fs.writeFileSync(scriptPath, batContent, "utf-8");

          console.log("[Update] Spawning updater script:", scriptPath);
          const child = spawn("cmd.exe", ["/c", scriptPath], {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          });
          child.unref();
          app.quit();
        }

      } else if (platform === "darwin") {
        const scriptPath = path.join(tempDir, "install-update.sh");
        const shContent = `#!/bin/bash
while kill -0 ${currentPid} 2>/dev/null; do
  sleep 1
done
cp -f "${tempFilePath}" "${currentExe}"
chmod +x "${currentExe}"
open "${currentExe}"
rm "$0"
`;
        fs.writeFileSync(scriptPath, shContent, { encoding: "utf-8", mode: 0o755 });

        console.log("[Update] Spawning updater script:", scriptPath);
        const child = spawn("/bin/bash", [scriptPath], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        app.quit();
      } else {
        throw new Error(`Auto-updater file overwrite script not implemented for platform '${platform}'`);
      }

    } catch (err: any) {
      console.error("[Update] Update process failed:", err);
      const message = wasDownloadCancelled ? "Download cancelled by user." : (err.message || String(err));
      activeDownloadStatus = wasDownloadCancelled ? "idle" : "error";
      activeDownloadErrorMessage = message;
      mainWindow?.webContents.send("update-error", message);
    }
  });

  ipcMain.handle("cancel-update-download", () => {
    if (activeDownloadRequest) {
      wasDownloadCancelled = true;
      activeDownloadRequest.destroy();
      activeDownloadRequest = null;
      activeDownloadRelease = null;
      activeDownloadProgress = 0;
      activeDownloadStatus = "idle";
      activeDownloadErrorMessage = null;
      console.log("[Update] Download cancelled by user.");
      return true;
    }
    return false;
  });

  ipcMain.handle("check-update-downloaded", async (_e, release: any) => {
    try {
      const selectedAsset = selectAssetForPlatform(release.assets || []);
      if (!selectedAsset) return false;

      const tempDir = app.getPath("temp");
      const tempFilePath = path.join(tempDir, selectedAsset.name);

      if (fs.existsSync(tempFilePath)) {
        const stats = fs.statSync(tempFilePath);
        if (stats.size === selectedAsset.size) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("[Update] Check download status failed:", err);
      return false;
    }
  });

  ipcMain.handle("get-active-download-status", async () => {
    return {
      status: activeDownloadStatus,
      progress: activeDownloadProgress,
      targetRelease: activeDownloadRelease,
      errorMessage: activeDownloadErrorMessage,
    };
  });

  // ── Export System IPC ──────────────────────────────────────────────────
  ipcMain.removeHandler("start-export");
  ipcMain.handle("start-export", async (event, options) => {
    try {
      const summary = await exportManager.startExport(options, (step, percent) => {
        event.sender.send("export-progress", { step, percent });
      });
      return summary;
    } catch (err: any) {
      console.error("[IPC] start-export failed:", err);
      throw err;
    }
  });

  ipcMain.removeHandler("cancel-export");
  ipcMain.handle("cancel-export", () => {
    exportManager.cancelExport();
    return true;
  });

  ipcMain.removeHandler("save-export-file");
  ipcMain.handle("save-export-file", async (_e, tempFilePath: string, defaultName: string) => {
    try {
      return await exportManager.saveExportFile(tempFilePath, defaultName);
    } catch (err) {
      console.error("[IPC] save-export-file failed:", err);
      return false;
    }
  });

  ipcMain.removeHandler("cleanup-export");
  ipcMain.handle("cleanup-export", () => {
    exportManager.cleanupExport();
    return true;
  });

  // ── Import System IPC ──────────────────────────────────────────────────
  ipcMain.removeHandler("select-and-import-file");
  ipcMain.handle("select-and-import-file", async (event) => {
    try {
      if (!mainWindow) throw new Error("Main window not available.");
      
      // Pause clipboard listener monitoring temporarily during database import
      stopClipboardListener();
      
      const summary = await importManager.selectAndImportFile(mainWindow, (step, percent) => {
        event.sender.send("import-progress", { step, percent });
      });

      // Resume clipboard listener after import completes
      startClipboardListener();
      
      // Notify the renderer process to refresh settings from disk if updated
      if (summary.success && summary.importedSettings) {
        broadcastSettingsUpdated(storageManager.getSettings());
      }
      
      return summary;
    } catch (err: any) {
      console.error("[IPC] select-and-import-file failed:", err);
      // Ensure we resume monitoring if it failed
      startClipboardListener();
      throw err;
    }
  });

  async function clearAppCacheAndTempData(): Promise<void> {
    try {
      // Cancel and clean up exports during clear cache
      exportManager.cancelExport();
      exportManager.cleanupExport();

      // 1. Clear session cache and storage data (only valid Electron storage types)
      const ses = (mainWindow && mainWindow.webContents && mainWindow.webContents.session) || session.defaultSession;
      if (ses) {
        try {
          await ses.clearCache();
        } catch (cacheErr) {
          console.warn("[Cache] clearCache warning:", cacheErr);
        }
        try {
          await ses.clearStorageData({
            storages: ["cachestorage", "serviceworkers"]
          });
        } catch (storageErr) {
          console.warn("[Cache] clearStorageData warning:", storageErr);
        }
      }

      // 2. Clear downloaded update executable versions and export folders in temp folder (case-insensitive)
      const tempDir = app.getPath("temp");
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          const filePath = path.join(tempDir, file);
          const lowerFile = file.toLowerCase();
          if (
            lowerFile.includes("clipmaster") ||
            lowerFile.startsWith("install-update")
          ) {
            try {
              const stat = fs.statSync(filePath);
              if (stat.isFile()) {
                fs.unlinkSync(filePath);
                console.log("[Cache] Deleted temp update file:", file);
              } else if (stat.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
                console.log("[Cache] Deleted temp directory:", file);
              }
            } catch (unlinkErr) {
              console.error(`[Cache] Failed to delete temp file/dir ${file}:`, unlinkErr);
            }
          }
        }
      }

      // 3. Reset active download status variables in main process memory
      if (activeDownloadRequest) {
        try {
          activeDownloadRequest.destroy();
          console.log("[Cache] Aborted active update download during clear cache.");
        } catch (destroyErr) {
          console.warn("[Cache] Failed to destroy active download request:", destroyErr);
        }
        activeDownloadRequest = null;
      }
      activeDownloadRelease = null;
      activeDownloadProgress = 0;
      activeDownloadStatus = "idle";
      activeDownloadErrorMessage = null;
      wasDownloadCancelled = false;

      // 4. Notify renderer to reset update status to idle
      mainWindow?.webContents.send("update-status-reset");
    } catch (err) {
      console.error("[Cache] clearAppCacheAndTempData failed:", err);
    }
  }

  ipcMain.removeHandler("reset-all");
  ipcMain.handle("reset-all", async () => {
    try {
      clearPauseTimeout();

      // 1. Clear application cache and temporary folders/files
      await clearAppCacheAndTempData();

      // 2. Reset and wipe NeDB databases
      await storageManager.resetClips();
      await storageManager.resetTags();
      await storageManager.resetSettings();
      const sm = storageManager as any;
      if (typeof sm.resetUiState === "function") {
        await sm.resetUiState();
      }

      updateTrayMenu();
      return true;
    } catch (err) {
      console.error("[IPC] reset-all failed:", err);
      return false;
    }
  });

  ipcMain.removeHandler("clear-cache");
  ipcMain.handle("clear-cache", async () => {
    try {
      console.log("[IPC] Starting clear-cache process...");
      await clearAppCacheAndTempData();

      // Compact databases manually
      const sm = storageManager as any;
      if (sm.clipsDb && typeof sm.clipsDb.persistence?.compactDatafile === "function") {
        sm.clipsDb.persistence.compactDatafile();
      }
      if (sm.tagsDb && typeof sm.tagsDb.persistence?.compactDatafile === "function") {
        sm.tagsDb.persistence.compactDatafile();
      }
      if (sm.settingsDb && typeof sm.settingsDb.persistence?.compactDatafile === "function") {
        sm.settingsDb.persistence.compactDatafile();
      }
      if (sm.queueDb && typeof sm.queueDb.persistence?.compactDatafile === "function") {
        sm.queueDb.persistence.compactDatafile();
      }
      if (sm.syncLogsDb && typeof sm.syncLogsDb.persistence?.compactDatafile === "function") {
        sm.syncLogsDb.persistence.compactDatafile();
      }

      console.log("[IPC] clear-cache process completed successfully.");
      return true;
    } catch (err) {
      console.error("[IPC] clear-cache failed:", err);
      return false;
    }
  });
}

function clearTempUpdateFiles(): void {
  try {
    const tempDir = app.getPath("temp");
    if (!fs.existsSync(tempDir)) return;
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const lowerFile = file.toLowerCase();
      if (
        lowerFile.includes("clipmaster") ||
        lowerFile.startsWith("install-update")
      ) {
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            fs.unlinkSync(filePath);
            console.log("[Startup] Cleaned up temp update file:", file);
          } else if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log("[Startup] Cleaned up temp directory:", file);
          }
        } catch (err) {
          // Ignore startup deletion errors
        }
      }
    }
  } catch (err) {
    console.error("[Startup] Failed to clean up temp update files:", err);
  }
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // ════ 0. Clean up temp update files ════
  clearTempUpdateFiles();

  // ════ 1. Init NeDB storage first — source of truth ════
  await storageManager.init();
  try {
    uiState = storageManager.getUiState(uiState);
  } catch (err) {
    console.error("[Storage] Failed to restore UI State:", err);
  }

  // ════ 2. Register IPC ════
  registerIPC();

  // ════ 2.5 Register Global Shortcut ════
  registerAppShortcut();

  // ════ 3. Create Tray (Do NOT call createWindow here, starts Headless) ════
  createTray();

  // ════ 4. Start clipboard polling ════

  const initSettings = storageManager.getSettings();

  // Synchronize startup auto launch task
  syncAutoLaunch(Boolean(initSettings.autoLaunch));

  if (initSettings.pauseCaptureOption === "restart") {
    storageManager.saveSettings({
      pauseCaptureOption: "never",
      pauseUntil: null,
    }).catch(() => {});
  } else if (initSettings.pauseUntil) {
    const remaining = initSettings.pauseUntil - Date.now();
    if (remaining <= 0) {
      storageManager.saveSettings({
        pauseCaptureOption: "never",
        pauseUntil: null,
      }).catch(() => {});
    } else {
      setupPauseTimeout(remaining);
    }
  }

  startClipboardListener();

  if (!isStartupHidden) {
    createWindow();
  }

  app.on("activate", () => {
    // Only open the window if explicitly activated (standard macOS behavior, or similar)
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("second-instance", () => {
  createWindow();
});

// Perform UI state saving on app termination
app.on("before-quit", async (e) => {
  if (isQuitting) return;
  e.preventDefault();
  isQuitting = true;
  stopClipboardListener();

  if (popupWindow) {
    try {
      popupWindow.close();
    } catch {}
  }

  // Unregister all global shortcuts
  try {
    globalShortcut.unregisterAll();
    console.log("[Shortcut] Unregistered all shortcuts on quit.");
  } catch (err) {
    console.error("[Shortcut] Failed to unregister shortcuts on quit:", err);
  }

  if (uiStateSaveTimeout) {
    clearTimeout(uiStateSaveTimeout);
    uiStateSaveTimeout = null;
  }

  console.log("[App] Saving final UI State...");
  await storageManager.saveUiState(uiState).catch(() => {});
  app.quit();
});

app.on("will-quit", () => {
  try {
    globalShortcut.unregisterAll();
    console.log("[Shortcut] final unregisterAll in will-quit");
  } catch {}
});

app.on("window-all-closed", () => {
  // Keep running in tray on Windows/Linux
});
