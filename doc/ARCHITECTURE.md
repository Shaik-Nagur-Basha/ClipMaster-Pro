# How It Works

## What Happens

1. App runs in background
2. Detects when you copy text
3. Saves to local storage automatically
4. You search and use clips anytime

## Parts of the App

- **Frontend** — React UI with 5 pages (Dashboard, Favorites, Tags, Recycle Bin, Settings)
- **Backend** — Electron main process with clipboard monitoring
- **Storage** — Local NeDB datastores (JSON files)

## Tech Stack

- Desktop: Electron
- UI: React + TypeScript
- Database: NeDB (local)

## Security

- Data stays local on your system
- Secure, crash-resilient file writes
- No tracking or analytics
