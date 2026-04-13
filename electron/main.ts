import {
  app, BrowserWindow, clipboard, ipcMain,
  Menu, nativeImage, Tray, shell
} from 'electron'
import { join } from 'path'
import { getDataDir, storageManager } from './storage'
import { syncManager }    from './syncManager'
import type { ClipboardItem, SyncState } from '../src/types'

// ─── Environment Setup ─────────────────────────────────────────────────────
// Ensure userData path matches our storage logic early in the lifecycle
app.setPath('userData', getDataDir())

// ─── Singleton guard ────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

// ─── State ──────────────────────────────────────────────────────────────────
let mainWindow:        BrowserWindow | null = null
let tray:              Tray | null = null
let clipboardPoller:   NodeJS.Timeout | null = null
let lastClipboardText  = ''
let isQuitting         = false

// ─── Window ─────────────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100, height: 760, minWidth: 800, minHeight: 600,
    frame: false,
    backgroundColor: '#0d0d1a',
    show: false,
    title: 'ClipMaster Pro',
    icon: join(__dirname, app.isPackaged ? '../renderer/icon.png' : '../../public/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => { mainWindow?.show(); mainWindow?.focus() })
  mainWindow.on('close', e => { if (!isQuitting) { e.preventDefault(); mainWindow?.hide() } })
  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── Tray ───────────────────────────────────────────────────────────────────
function createTray(): void {
  const iconPath = join(__dirname, app.isPackaged ? '../renderer/icon.png' : '../../public/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  const menu = Menu.buildFromTemplate([
    { label: 'Open ClipMaster Pro', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Pause Capturing', type: 'checkbox', checked: false,
      click: item => { item.checked ? stopPoller() : startPoller() }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } }
  ])
  tray.setToolTip('ClipMaster Pro')
  tray.setContextMenu(menu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// ─── Clipboard Polling ──────────────────────────────────────────────────────
function startPoller(): void {
  if (clipboardPoller) return
  lastClipboardText = clipboard.readText() ?? ''

  clipboardPoller = setInterval(async () => {
    try {
      const current = clipboard.readText() ?? ''
      if (!current.trim() || current === lastClipboardText) return
      lastClipboardText = current

      // ════ LAYER 1: Write to JSON (ALWAYS FIRST) ════
      const newItem = await storageManager.addEntry(current)
      if (!newItem) return

      // Notify renderer immediately (UI updates before any sync)
      mainWindow?.webContents.send('new-clip', newItem)

      // ════ LAYERS 2 & 3: Enqueue for async sync (non-blocking) ════
      syncManager.enqueue(newItem, 'upsert')
      syncManager.runSync(
        () => storageManager.readAll(),
        items => storageManager.mergeItems(items)
      ).then(state => {
        mainWindow?.webContents.send('sync-update', state)
      }).catch(() => {})

    } catch { /* ignore poller errors */ }
  }, 600)
}

function stopPoller(): void {
  if (clipboardPoller) { clearInterval(clipboardPoller); clipboardPoller = null }
}

// ─── IPC Registration ───────────────────────────────────────────────────────
function registerIPC(): void {

  // ── Window controls ─────────────────────────────────────────────────────
  ipcMain.on('window-minimize', () => { console.log('[IPC] minimize'); mainWindow?.minimize() })
  ipcMain.on('window-maximize', () => {
    console.log('[IPC] maximize')
    if (!mainWindow) return
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  })
  ipcMain.on('window-close',    () => { console.log('[IPC] close'); mainWindow?.hide() })

  // ── Clipboard CRUD ───────────────────────────────────────────────────────
  ipcMain.handle('get-clips', () => storageManager.readAll())

  ipcMain.handle('add-clip', async (_e, text: string) => {
    const item = await storageManager.addEntry(text)
    if (item) {
      syncManager.enqueue(item, 'upsert')
      syncManager.runSync(
        () => storageManager.readAll(),
        items => storageManager.mergeItems(items)
      ).then(s => mainWindow?.webContents.send('sync-update', s)).catch(() => {})
    }
    return item
  })

  ipcMain.handle('update-clip', async (_e, item: ClipboardItem) => {
    await storageManager.updateEntry(item)
    syncManager.enqueue(item, 'upsert')
    return true
  })

  ipcMain.handle('delete-clip', async (_e, id: string) => {
    await storageManager.softDelete(id)
    const item = storageManager.readAll().find(c => c.id === id)
    if (item) syncManager.enqueue(item, 'soft-delete')
    return true
  })

  ipcMain.handle('permanent-delete', async (_e, id: string) => {
    await storageManager.permanentDelete(id)
    syncManager.enqueue({ id } as ClipboardItem, 'permanent-delete')
    return true
  })

  ipcMain.handle('restore-clip', async (_e, id: string) => {
    await storageManager.restoreEntry(id)
    const item = storageManager.readAll().find(c => c.id === id)
    if (item) syncManager.enqueue(item, 'upsert')
    return true
  })

  ipcMain.handle('copy-to-clipboard', (_e, text: string) => {
    clipboard.writeText(text)
    lastClipboardText = text   // prevent immediate re-capture
    return true
  })

  // ── Tags & Settings ──────────────────────────────────────────────────────
  ipcMain.handle('get-tags',      () => storageManager.getTags())
  ipcMain.handle('save-tags',     (_e, tags) => storageManager.saveTags(tags).then(() => true))
  ipcMain.handle('get-settings',  () => storageManager.getSettings())
  ipcMain.handle('save-settings', async (_e, partial: Record<string, unknown>) => {
    await storageManager.saveSettings(partial as never)
    if ('autoLaunch' in partial) {
      app.setLoginItemSettings({ openAtLogin: Boolean(partial.autoLaunch), name: 'ClipMaster Pro' })
    }
    return true
  })

  // ── Sync Control ─────────────────────────────────────────────────────────
  ipcMain.handle('get-sync-state', () => syncManager.getState())

  ipcMain.handle('trigger-sync', async (_e, target: 'local' | 'atlas' | 'all' = 'all') => {
    const state = await syncManager.runSync(
      () => storageManager.readAll(),
      items => storageManager.mergeItems(items),
      true, // force: true
      target
    )
    return state
  })

  ipcMain.handle('mongo-connect', async (_e, uri: string) => {
    const ok = await syncManager.connectLocal(uri)
    if (ok) {
      await storageManager.saveSettings({ mongoEnabled: true, mongoUri: uri })
      // Bootstrap sync from local Mongo
      await syncManager.bootstrapSync(
        () => storageManager.readAll(),
        items => storageManager.mergeItems(items)
      )
    }
    return ok
  })

  ipcMain.handle('atlas-connect', async (_, uri) => {
    const ok = await syncManager.connectAtlas(uri)
    if (ok) {
      await storageManager.saveSettings({ atlasEnabled: true, atlasUri: uri })
      // Bootstrap sync from Atlas
      await syncManager.bootstrapSync(
        () => storageManager.readAll(),
        items => storageManager.mergeItems(items)
      ).catch(() => {})
    }
    return ok
  })

  ipcMain.handle('atlas-disconnect', async () => {
    await syncManager.disconnectAtlas()
    return true
  })

  ipcMain.handle('mongo-disconnect', async () => {
    await syncManager.disconnectLocal()
    return true
  })

  ipcMain.handle('mongo-status',   () => syncManager.isLocalConnected())
  ipcMain.handle('atlas-status',   () => syncManager.isAtlasConnected())


  ipcMain.handle('open-external', (_e, url: string) => { shell.openExternal(url) })

  ipcMain.handle('get-app-info', () => ({
    name: 'ClipMaster Pro',
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    isPackaged: app.isPackaged
  }))
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // ════ 1. Init JSON storage first — source of truth ════
  await storageManager.init()

  // ════ 2. Register IPC (must be before window creation) ════
  registerIPC()

  // ════ 3. Create UI ════
  createWindow()
  createTray()

  // ════ 4. Auto-connect & Auto-detect MongoDB layers ════
  const settings = storageManager.getSettings()
  
  // Hydrate initial sync state from disk before connecting
  syncManager.initSyncState({ 
    lastLocalSyncedAt: settings.lastLocalSyncedAt || null,
    lastCloudSyncedAt: settings.lastCloudSyncedAt || null
  })

  // 1. First Launch Auto-detection
  await syncManager.autoDetectLocalMongo(() => storageManager.readAll())

  // 2. Connect Local Mongo if enabled OR URI exists
  if (settings.mongoEnabled || settings.mongoUri) {
    syncManager.connectLocal(settings.mongoUri).then(ok => {
      if (ok) {
        syncManager.bootstrapSync(
          () => storageManager.readAll(),
          items => storageManager.mergeItems(items)
        ).catch(() => {})
      }
    }).catch(() => {})
  }

  // 3. Connect Atlas Cloud if URI exists (Trigger full connect action)
  if (settings.atlasUri) {
    syncManager.connectAtlas(settings.atlasUri).then(async ok => {
      if (ok) {
        syncManager.bootstrapSync(
          () => storageManager.readAll(),
          items => storageManager.mergeItems(items)
        ).catch(() => {})
      }
    }).catch(() => {})
  }

  // ════ 5. Subscribe sync state updates → renderer ════
  syncManager.onStateChange((state: SyncState) => {
    mainWindow?.webContents.send('sync-update', state)
    
    // Authoritative persistence of sync timestamps (including null)
    storageManager.saveSettings({ 
        lastLocalSyncedAt: state.lastLocalSyncedAt,
        lastCloudSyncedAt: state.lastCloudSyncedAt,
        latestSyncedAt: state.latestSyncedAt
    }).catch(() => {})
  })

  // ════ 6. Start background sync + clipboard polling ════
  syncManager.startBackgroundSync(
    () => storageManager.readAll(),
    items => storageManager.mergeItems(items)
  )
  startPoller()

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show(); mainWindow.focus()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  stopPoller()
  syncManager.stopBackgroundSync()
})

app.on('window-all-closed', () => {
  // Keep running in tray on Windows/Linux
})
