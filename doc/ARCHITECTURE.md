# How It Works

## What Happens

1. App runs in background
2. Detects when you copy text
3. Saves to local storage automatically
4. You search and use clips anytime
5. Optional: Syncs to MongoDB cloud

## Parts of the App

- **Frontend** — React UI with 5 pages (Dashboard, Favorites, Tags, Recycle Bin, Settings)
- **Backend** — Electron main process with clipboard monitoring
- **Storage** — Local JSON file + optional MongoDB

## Tech Stack

- Desktop: Electron
- UI: React + TypeScript
- Database: JSON (local) + MongoDB (optional)
- Encryption: AES-256 for cloud backup

## Security

- Data stays local by default
- Cloud sync only if you enable it
- Encrypted when synced
- No tracking or analytics
