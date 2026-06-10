import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
  shell,
} from "electron";
import { join } from "path";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { IncomingMessage } from "http";
import { spawn, ChildProcess } from "child_process";
import { getDataDir, storageManager } from "./storage";
import { syncManager } from "./syncManager";
import type { ClipboardItem, SyncState } from "../src/types";
import { exportManager } from "./exportManager";

// ─── Environment Setup ─────────────────────────────────────────────────────
app.setPath("userData", getDataDir());

// ─── Singleton guard ────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const isStartupHidden = process.argv.includes("--hidden");

// ─── State ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let lastClipboardText = "";
let isQuitting = false;
let pauseTimeout: NodeJS.Timeout | null = null;
let clipboardListenerProc: ChildProcess | null = null;

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
    frame: false,
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
        mainWindow?.webContents.send("settings-updated", updated);
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
    mainWindow?.webContents.send("settings-updated", updated);
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

    mainWindow?.webContents.send("new-clip", newItem);
    await syncManager.enqueue(newItem, "upsert");
  } catch (err) {
    console.error("[Clipboard] Capture error:", err);
  }
}

const POLL_INTERVAL_MS = 500;
let pollTick = 0;

function startPoller(): void {
  if (pollTimer) return;
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
      const settings = storageManager.getSettings();
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
            mainWindow?.webContents.send("settings-updated", storageManager.getSettings());
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

function startClipboardListener(): void {
  if (clipboardListenerProc) return;

  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $code = @"
    using System;
    using System.Runtime.InteropServices;
    using System.Windows.Forms;

    public class ClipboardListener : Form {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool AddClipboardFormatListener(IntPtr hwnd);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

        private const int WM_CLIPBOARDUPDATE = 0x031D;

        public ClipboardListener() {
            this.CreateHandle();
            AddClipboardFormatListener(this.Handle);
        }

        protected override void WndProc(ref Message m) {
            if (m.Msg == WM_CLIPBOARDUPDATE) {
                Console.WriteLine("CLIPBOARD_CHANGED");
            }
            base.WndProc(ref m);
        }

        protected override void Dispose(bool disposing) {
            RemoveClipboardFormatListener(this.Handle);
            base.Dispose(disposing);
        }
    }
"@
    Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms
    [Application]::Run(New-Object ClipboardListener)
  `;

  try {
    clipboardListenerProc = spawn("powershell", ["-NoProfile", "-Command", script], {
      windowsHide: true,
    });

    clipboardListenerProc.stdout?.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg.includes("CLIPBOARD_CHANGED")) {
        const current = clipboard.readText() ?? "";

        // Check if capturing is paused
        const settings = storageManager.getSettings();
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
              mainWindow?.webContents.send("settings-updated", storageManager.getSettings());
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
  startPoller();
}

function stopClipboardListener(): void {
  stopPoller();
  if (clipboardListenerProc) {
    clipboardListenerProc.kill();
    clipboardListenerProc = null;
    console.log("[Clipboard] Native Windows clipboard listener stopped.");
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
        const fileStream = fs.createWriteStream(destPath);

        res.on("data", (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            const progress = Math.round((receivedBytes / totalBytes) * 100);
            if (progress !== lastReportedProgress) {
              lastReportedProgress = progress;
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

  // ── Clipboard CRUD ───────────────────────────────────────────────────────
  ipcMain.handle("get-clips", async (_e, limit?: number) => await storageManager.readAll(limit));

  ipcMain.handle("add-clip", async (_e, text: string) => {
    const item = await storageManager.addEntry(text);
    if (item) {
      await syncManager.enqueue(item, "upsert");
    }
    return item;
  });

  ipcMain.handle("update-clip", async (_e, item: ClipboardItem) => {
    await storageManager.updateEntry(item);
    await syncManager.enqueue(item, "upsert");
    return true;
  });

  ipcMain.handle("delete-clip", async (_e, id: string) => {
    await storageManager.softDelete(id);
    const item = (await storageManager.readAll()).find((c) => c.id === id);
    if (item) {
      await syncManager.enqueue(item, "soft-delete");
    }
    return true;
  });

  ipcMain.handle("permanent-delete", async (_e, id: string) => {
    await storageManager.permanentDelete(id);
    await syncManager.enqueue({ id } as ClipboardItem, "permanent-delete");
    return true;
  });

  ipcMain.handle("permanent-delete-bulk", async (_e, ids: string[]) => {
    await storageManager.permanentDeleteBulk(ids);
    await syncManager.enqueueBulk(
      ids.map((id) => ({ id }) as ClipboardItem),
      "permanent-delete",
    );
    return true;
  });

  ipcMain.handle("restore-clip", async (_e, id: string) => {
    await storageManager.restoreEntry(id);
    const item = (await storageManager.readAll()).find((c) => c.id === id);
    if (item) {
      await syncManager.enqueue(item, "upsert");
    }
    return true;
  });

  ipcMain.handle("copy-to-clipboard", (_e, text: string) => {
    clipboard.writeText(text);
    lastClipboardText = text; // prevent immediate re-capture
    return true;
  });

  // ── Tags & Settings ──────────────────────────────────────────────────────
  ipcMain.handle("get-tags", async () => await storageManager.getTags());
  ipcMain.handle("save-tags", async (_e, tags) => {
    await storageManager.saveTags(tags);
    syncManager.enqueueTagSync();
    return true;
  });
  ipcMain.handle("get-settings", () => storageManager.getSettings());
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
        app.setLoginItemSettings({
          openAtLogin: Boolean(partial.autoLaunch),
          name: "ClipMaster Pro",
          path: app.getPath("exe"),
          args: ["--hidden"],
        });
      }
      updateTrayMenu();
      return storageManager.getSettings();
    },
  );

  // ── Sync Control & Logs ──────────────────────────────────────────────────
  ipcMain.handle("get-sync-state", () => syncManager.getState());

  ipcMain.handle("get-sync-logs", async (_e, limit?: number) => {
    return await storageManager.getSyncLogs(limit);
  });

  ipcMain.handle(
    "trigger-sync",
    async (_e, target: "local" | "atlas" | "all" = "all") => {
      const state = await syncManager.runSync(true, target);
      return state;
    },
  );

  // ── UI State Channel ─────────────────────────────────────────────────────
  ipcMain.on("update-ui-state", (_e, state) => {
    uiState = { ...uiState, ...state };
    storageManager.saveUiState(uiState).catch(() => {});
  });

  ipcMain.handle("get-ui-state", () => {
    return uiState;
  });

  ipcMain.handle("mongo-connect", async (_e, uri: string) => {
    const ok = await syncManager.connectLocal(uri);
    if (ok) {
      await storageManager.saveSettings({ mongoEnabled: true, mongoUri: uri });
      await syncManager.bootstrapSync(() => storageManager.readAll());
    }
    return ok;
  });

  ipcMain.handle("atlas-connect", async (_, uri) => {
    const ok = await syncManager.connectAtlas(uri);
    if (ok) {
      await storageManager.saveSettings({ atlasEnabled: true, atlasUri: uri });
      await syncManager
        .bootstrapSync(() => storageManager.readAll())
        .catch(() => {});
    }
    return ok;
  });

  ipcMain.handle("atlas-disconnect", async () => {
    await syncManager.disconnectAtlas();
    return true;
  });

  ipcMain.handle("mongo-disconnect", async () => {
    await syncManager.disconnectLocal();
    return true;
  });

  ipcMain.handle("mongo-status", () => syncManager.isLocalConnected());
  ipcMain.handle("atlas-status", () => syncManager.isAtlasConnected());

  ipcMain.handle("open-external", (_e, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle("get-app-info", () => ({
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
      const response = await fetch("https://api.github.com/repos/Shaik-Nagur-Basha/ClipMaster-Pro/releases", {
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

  ipcMain.handle("trigger-update", async (_e, release: any) => {
    const platform = process.platform;
    const assets = release.assets || [];
    let selectedAsset = null;

    if (platform === "win32") {
      selectedAsset = assets.find((a: any) => a.name.endsWith(".exe") && !a.name.toLowerCase().includes("setup"));
      if (!selectedAsset) {
        selectedAsset = assets.find((a: any) => a.name.endsWith(".exe"));
      }
    } else if (platform === "darwin") {
      selectedAsset = assets.find((a: any) => a.name.endsWith(".dmg") || a.name.endsWith(".zip") || a.name.endsWith(".pkg"));
    } else {
      selectedAsset = assets.find((a: any) => a.name.endsWith(".AppImage") || a.name.endsWith(".deb") || a.name.endsWith(".tar.gz"));
    }

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
        const scriptPath = path.join(tempDir, "install-update.bat");
        const batContent = `@echo off
:loop
tasklist /FI "PID eq ${currentPid}" 2>NUL | find /I "${currentPid}" >NUL
if "%ERRORLEVEL%"=="0" (
  timeout /t 1 /nobreak >NUL
  goto loop
)
copy /Y "${tempFilePath}" "${currentExe}"
if errorlevel 1 (
  timeout /t 1 /nobreak >NUL
  goto loop
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
      const platform = process.platform;
      const assets = release.assets || [];
      let selectedAsset = null;

      if (platform === "win32") {
        selectedAsset = assets.find((a: any) => a.name.endsWith(".exe") && !a.name.toLowerCase().includes("setup"));
        if (!selectedAsset) {
          selectedAsset = assets.find((a: any) => a.name.endsWith(".exe"));
        }
      } else if (platform === "darwin") {
        selectedAsset = assets.find((a: any) => a.name.endsWith(".dmg") || a.name.endsWith(".zip") || a.name.endsWith(".pkg"));
      } else {
        selectedAsset = assets.find((a: any) => a.name.endsWith(".AppImage") || a.name.endsWith(".deb") || a.name.endsWith(".tar.gz"));
      }

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

  ipcMain.handle("get-active-download-status", () => {
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

  ipcMain.handle("reset-all", async () => {
    try {
      clearPauseTimeout();
      exportManager.cancelExport();
      exportManager.cleanupExport();
      await storageManager.resetClips();
      await storageManager.resetTags();
      await storageManager.resetSettings();
      await syncManager.disconnectLocal().catch(() => {});
      await syncManager.disconnectAtlas().catch(() => {});
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

      // Cancel and clean up exports during clear cache
      exportManager.cancelExport();
      exportManager.cleanupExport();

      // 1. Clear session cache and storage data (only valid Electron storage types)
      if (mainWindow && mainWindow.webContents && mainWindow.webContents.session) {
        const ses = mainWindow.webContents.session;
        try {
          await ses.clearCache();
        } catch (cacheErr) {
          console.warn("[IPC] clearCache warning:", cacheErr);
        }
        try {
          await ses.clearStorageData({
            storages: ["cachestorage", "serviceworkers"]
          });
        } catch (storageErr) {
          console.warn("[IPC] clearStorageData warning:", storageErr);
        }
      }

      // 2. Clear downloaded update executable versions in temp folder (case-insensitive)
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
              if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
                console.log("[IPC] Deleted temp update file:", file);
              }
            } catch (unlinkErr) {
              console.error(`[IPC] Failed to delete temp file ${file}:`, unlinkErr);
            }
          }
        }
      }

      // 3. Reset active download status variables in main process memory
      activeDownloadRelease = null;
      activeDownloadProgress = 0;
      activeDownloadStatus = "idle";
      activeDownloadErrorMessage = null;
      activeDownloadRequest = null;
      wasDownloadCancelled = false;

      // 4. Notify renderer to reset update status to idle
      mainWindow?.webContents.send("update-status-reset");

      // 5. Compact databases manually
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

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // ════ 1. Init NeDB storage first — source of truth ════
  await storageManager.init();
  try {
    uiState = storageManager.getUiState(uiState);
  } catch (err) {
    console.error("[Storage] Failed to restore UI State:", err);
  }

  // ════ 2. Register IPC ════
  registerIPC();

  // ════ 3. Create Tray (Do NOT call createWindow here, starts Headless) ════
  createTray();

  // ════ 4. Auto-connect & Auto-detect MongoDB layers ════
  const settings = storageManager.getSettings();

  syncManager.initSyncState({
    lastLocalSyncedAt: settings.lastLocalSyncedAt || null,
    lastCloudSyncedAt: settings.lastCloudSyncedAt || null,
  });

  await syncManager.autoDetectLocalMongo(() => storageManager.readAll());

  if (settings.mongoEnabled || settings.mongoUri) {
    syncManager
      .connectLocal(settings.mongoUri)
      .then((ok) => {
        if (ok) {
          syncManager
            .bootstrapSync(() => storageManager.readAll())
            .then(() => syncManager.runSync(true))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }

  if (settings.atlasUri) {
    syncManager
      .connectAtlas(settings.atlasUri)
      .then(async (ok) => {
        if (ok) {
          syncManager
            .bootstrapSync(() => storageManager.readAll())
            .then(() => syncManager.runSync(true))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }

  // ════ 5. Subscribe sync state updates → renderer ════
  syncManager.onStateChange((state: SyncState) => {
    mainWindow?.webContents.send("sync-update", state);

    storageManager
      .saveSettings({
        lastLocalSyncedAt: state.lastLocalSyncedAt,
        lastCloudSyncedAt: state.lastCloudSyncedAt,
        latestSyncedAt: state.latestSyncedAt,
      })
      .catch(() => {});
  });

  // ════ 6. Start background sync + clipboard polling ════
  syncManager.startBackgroundSync();

  const initSettings = storageManager.getSettings();
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

// Perform best-effort 1.5s shutdown synchronization pass on app termination
app.on("before-quit", async (e) => {
  if (isQuitting) return;
  e.preventDefault();
  isQuitting = true;
  stopClipboardListener();
  syncManager.stopBackgroundSync();

  console.log("[App] Saving final UI State...");
  await storageManager.saveUiState(uiState).catch(() => {});

  console.log("[App] Initiating best-effort shutdown sync...");
  try {
    await Promise.race([
      syncManager.runSync(),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch (err) {
    console.error("[App] Shutdown sync error:", err);
  } finally {
    app.quit();
  }
});

app.on("window-all-closed", () => {
  // Keep running in tray on Windows/Linux
});
