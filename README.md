# ClipMaster Pro

A production-ready Windows desktop clipboard manager built with **Electron + React + TypeScript + Vite + Tailwind CSS**.

---

## Features

- ⚡ **Background clipboard monitoring** (polls every 600ms)
- 📋 **Instant capture** with dedup prevention
- 🏷️ **Tagging system** with custom colors
- ⭐ **Favorites** with one-click star
- 🔍 **Instant search** (debounced)
- 🗑️ **Recycle bin** with soft delete + restore
- 🔎 **Filter by**: length, tags, favorites, date range
- 📊 **Sort by**: newest, oldest, longest, shortest
- 🖼️ **Views**: List, Grid, Compact
- 🔤 **Display**: Preview (80 chars) or Full text
- 💾 **MongoDB cloud sync** with AES-256 encryption
- 🚀 **Auto-launch** on Windows startup
- 🪟 **System tray** — runs silently in background

---

## Project Structure

```
clipmaster-pro/
├── electron/
│   ├── main.ts          # Main process (tray, IPC, clipboard poller)
│   ├── preload.ts       # Context bridge API
│   ├── storage.ts       # JSON storage manager
│   └── mongodb.ts       # MongoDB sync with AES-256
├── src/
│   ├── components/      # UI components
│   ├── pages/           # App pages
│   ├── store/           # Zustand state
│   ├── types/           # TypeScript types
│   ├── App.tsx          # Root component + title bar
│   └── main.tsx         # React entry
├── data/
│   └── clipboard.json   # Local storage
├── public/
│   └── icon.png
├── electron.vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (optional — for cloud sync)

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

This launches the Electron app with hot-reload. The app window opens AND minimizes to system tray.

### Build (production)

```bash
npm run build
```

Outputs compiled files to `out/`.

### Package as Windows .exe

```bash
npm run dist
```

Outputs installer to `release/` directory.
- `ClipMaster Pro Setup 1.0.0.exe` — NSIS installer

---

## MongoDB Cloud Sync

1. Install and run MongoDB locally: `mongod --dbpath C:\data\db`
2. Open ClipMaster Pro → Settings
3. Enable **MongoDB sync**
4. Set URI: `mongodb://localhost:27017/clipmaster`
5. Click **Connect** to test
6. Click **Sync All** to push existing clips

> All text is encrypted with AES-256 before storage in MongoDB.

---

## Data Storage

- **Local**: `%APPDATA%\ClipMaster Pro\data\clipboard.json` (packaged)
- **Dev**: `/data/clipboard.json` (project root)
- **Cloud**: MongoDB collection `clips` (encrypted)

---

## Build Output

```
release/
  └── ClipMaster Pro Setup 1.0.0.exe   ← NSIS installer
```

---

## Keyboard Shortcuts

| Action | Key |
|--------|-----|
| Close to tray | Win button (top-right) |
| Save edit | Ctrl+Enter |
| Cancel edit | Escape |
