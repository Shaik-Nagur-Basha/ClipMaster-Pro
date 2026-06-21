# ClipMaster Pro

**A fast clipboard manager for Windows** — Captures everything you copy, searchable and organized.

![Version](https://img.shields.io/badge/Version-2.5.0-blue)
![License](https://img.shields.io/badge/License-MIT-blue)
![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

---

## Screenshots & Demo

<p align="center">
  <img src="screenshots/01_main.png" alt="Main Dashboard" width="800">
</p>

<p align="center">
  <img src="screenshots/02_favourites.png" alt="Favourites" width="800">
</p>

<p align="center">
  <img src="screenshots/03_tags.png" alt="Tags" width="800">
</p>

<p align="center">
  <img src="screenshots/04_recycle_bin.png" alt="Recycle Bin" width="800">
</p>

<p align="center">
  <img src="screenshots/05_settings_general.png" alt="General Settings" width="800">
</p>

<p align="center">
  <img src="screenshots/06_settings.png" alt="Settings" width="800">
</p>

### Watch the Demo Video
A video demonstration of ClipMaster Pro in action:
[Watch the Demo Video](screenshots/ClipMaster%20Pro%20Demo.mp4)

---

## What's New in v2.5.0 (Since v2.4.5)

Here are the main UI/UX, styling, and asset improvements introduced since v2.4.5:

- **Premium UI Aesthetics & Borders** — Upgraded layout boundaries for Settings and Tags pages to blend seamlessly with the sidebar, styling top/left container borders using `border-gray-600` and `border-emerald-700` respectively.
- **Consistent Page Layouts** — Centered and aligned toolbar search bars to a clean `max-w-2xl` width across Favorites, Recycle Bin, and Tags views.
- **Header Flexibility** — Removed fixed size bounds on the Tags page header to make the interface more responsive and modern.
- **Updated Previews** — Replaced all repository screenshots and demo video files to accurately showcase the new design aesthetics.

---

## Core Features
- ⚡ **Auto-Capture & Privacy** — Instant clipboard monitoring with quick-pause options (15 mins, 30 mins, 1 hour, or until restart) for private sessions.
- 🔄 **Native Version Switcher** — Switch between historical versions and install updates directly from settings using native batch/shell script overwrites.
- 🔍 **Smart Search & Pagination** — Fast search with real-time result highlighting and responsive page-by-page rendering.
- 🏷️ **Advanced Tags & Favourites** — Color-coded tags, tag filters, and dedicated Favourites page to categorize and isolate clips.
- 🎨 **Premium UI & Shortcuts** — Modern interface featuring a quick-expand detail viewer dialog, system tray controls, and keyboard shortcuts (Ctrl + Delete to bypass recycle bin).
- 📦 **Hardened Persistence** — Crash-resilient atomic "write-then-rename" file operations with automatic `.bak` recovery to prevent settings reset on forced shutdown or system crash.

## Technical Highlights
- **Crash-Resilience**: Storage manager implements atomic operations and `fsync` so settings never revert during sudden app terminations (End Task, Ctrl+Shutdown).
- **System Integration**: Startup hidden flag (`--hidden`) and a system tray manager with quick settings toggles.
- **Keyboard Optimization**: Native shortcut detection (like `Ctrl` clicking Delete to permanently remove entries).
- **Milestone**: Version 2.5.0 strengthens page aesthetics, layout consistency, background reliability, and overall responsiveness.

## Download & Install
- **[Setup Installer](https://github.com/Shaik-Nagur-Basha/ClipMaster-Pro/releases)** (79 MB) — Recommended for Windows users.
- **[Portable Version](https://github.com/Shaik-Nagur-Basha/ClipMaster-Pro/releases)** (40 MB) — No installation required.

## Documentation
- **[Release Notes](doc/RELEASE_NOTES.md)** — Detailed v2.5.0 changelog.
- **[Quick Start](doc/QUICK_START.md)** — Setup in under 60 seconds.
- **[Architecture](doc/ARCHITECTURE.md)** — Technical breakdown of the app.
- **[Troubleshooting](doc/TROUBLESHOOTING.md)** — Common fixes and support.

---

## Requirements
- Windows 10+ | 512MB RAM | 150MB Disk

## License
MIT — © 2026 ClipMaster Pro Team
