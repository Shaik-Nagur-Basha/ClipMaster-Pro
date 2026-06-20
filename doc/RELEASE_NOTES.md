# ClipMaster Pro Release Notes

## v2.4.5 - Reliability and Filter Improvements (Latest)

**"Reliable Startup Update"**

This release improves background reliability, Windows startup integration, date filtering, application initialization, uninstaller cleanup, and configuration security.

### Background Reliability
- Added a native watchdog service that monitors and restarts background helper processes.
- Improved Electron startup, shutdown, and helper lifecycle handling.
- Updated native helper binaries and packaging to include the watchdog service.

### Installer and Auto-Launch
- Refined Windows auto-launch behavior for installed and packaged builds.
- Updated the NSIS installer integration for the new service and lifecycle changes.
- Upgraded the NSIS installer's uninstall sequence to execute thorough file, shortcut, registry, scheduled task, and multi-user AppData/ProgramData folder cleanup, ensuring zero leftover traces.

### Filtering and Performance
- Date filters now default to the actual minimum and maximum dates from page statistics.
- Settings, UI state, and tags now initialize concurrently.
- Sidebar counts are synchronized before derived capacity checks run.
- Capacity warning checks can reuse known counts, reducing unnecessary IPC calls.
- Runtime and development dependencies were reorganized for cleaner packaging.

### Security and Configuration
- Supported dynamic runtime `process.env.GITHUB_RELEASES_URL` override in the updater to prevent hardcoding target repo URLs into production bundles.
- Verified cryptographically that local encryption algorithms only rely on environment variables (`CLIPMASTER_SECRET`) with system-native `safeStorage` DPAPI fallback.
- Added a `.env.example` template to outline configurable environment variables without exposing production secrets.

---

## 🚀 v2.4.0 - Custom Popups & Performance Enhancements (Previous)

**"The Popup & Performance Update"**

This release introduces a brand new overlay popup window with optimized C# native paste helpers, custom limits (Lakh/Crore) formatting, smooth infinite scrolling, and multiple performance improvements, while fully retiring the MongoDB local/cloud sync feature.

### 🪟 High-Performance Overlay Popup & C# Helpers
- **Overlay Popup Window**: Sleek, borderless, always-on-top popup with customizable drag handle, tag filters, and control buttons.
- **Native C# Executables**: Uses lightweight C# helper processes (`paster.exe` and `clipboard-listener.exe`) for near-zero idle CPU and RAM background footprint.
- **Topmost Lock**: Employs an active window positioning loop (50ms interval) to force the popup window to stay topmost during user interactions.
- **Smart Focus Targeting**: Captures the foreground window prior to popup activation and returns focus before running paste.
- **"Pin & Close" Logic**: Automatically hides/closes the popup after pasting if unpinned, or keeps it open and refocused if pinned.

### ♾️ Infinite Scroll & Query Optimization
- **Infinite Scrolling**: Replaces paginated list views in All Clips, Favourites, and Recycle Bin with smooth, lag-free infinite scrolling and loading spinner when pagination is disabled.
- **Optimized Database Queries**: Significantly optimized tags query calculations and stats calculation, yielding a much more responsive sidebar and settings interface.

### ⚙️ Formatting & Settings Upgrades
- **Custom Max Clips limit**: Allows configuring custom clip storage limits.
- **Lakh/Crore Formatting**: Adds settings support for South Asian numbering formats.
- **General Presence Icons**: Integrated new visual layout and settings icons.
- **Refined Auto-Launch**: Hardened startup launch behavior for both packaged production installer environment and local development mode.

---

## 🚀 v2.3.0 - Fix Setup Permission Error & Clean Up Releases (Previous)

**"The Permission Fix & Release Clean Update"**

This release introduces a fully custom, native version switcher and updater, letting you browse, toggle, and install historical and latest releases directly from within the application Settings.

### 🔄 Native Version Switching & Updater
- **GitHub Release Sync**: Integrates with the public GitHub repository API to pull available release history.
- **Custom Dropdown Selector**: View historical version details (dates, names) and easily target specific versions to install or rollback.
- **"Latest Version" Badge**: A visual system highlighting the absolute newest release with auto-selection support.
- **Embedded Release Notes**: Render Markdown descriptions and changelogs directly in the Settings view before updating.
- **Background Downloader**: Robust chunk-by-chunk download streaming with interactive progress tracking, utilizing native Node `https` and redirect handling.
- **Safe Overwrite Routine**: Automatically writes detached temporary installer scripts (`.bat` / `.sh`) that wait for the app to close, overwrite the active binary with the new version, and safely relaunch.
- **Dev-Mode Simulation**: Built-in safety guards that simulate updates when running in developer mode (`!app.isPackaged`) to prevent local project environment corruption.

### 🏷️ Active Tags Upgrades & Import Icons
- **AND/OR Match Logic**: Switched default tag filtering logic to OR (matching any selected tag). Added a Venn diagram toggle button to switch between AND/OR matching.
- **Tag Sorting & Counting**: Added a bar chart toggle button to sort tags based on frequency of use in active clips. Enabling this also shows the usage count next to each tag.
- **Count Visibility**: Separated tag name truncation from count display, ensuring tag counts are always fully visible even on long tag names.
- **Import Dialog Iconography**: Replaced generic checkmark/plus icons in the Data Import System wizard with context-related icons (`IconShield` for conflicts, `IconZap` for sanitization, document icon for selecting a file, and action button icons).

### 🛠️ Preload & Store Integration
- **Zustand Updater State**: State machine managing target release versions, progress indicators, errors, and status tracking.
- **Exposed Bridge IPC**: Isolated preload channels supporting download metrics, completion indicators, and error propagation.

---

## 🚀 v2.0.0 - Hardened Persistence & UI Refinement (Previous)

**"The Data Integrity Update"**

This major release focuses on making ClipMaster Pro 100% resilient to system crashes and power loss, while introducing a more refined, technical UI for clipboard metadata.

### 🛡️ Data Integrity & Persistence
- **Atomic File Writing**: Implemented a "write-then-rename" strategy to ensure settings and clips are never corrupted during a crash.
- **Hardware-Level Sync (`fsync`)**: Every write is now forced to the physical disk before completion, surviving sudden power cuts.
- **Automatic Backup System**: The app now creates and maintains `.bak` files, with automatic recovery logic if the primary data files ever become unreadable.
- **Corruption Forensics**: Corrupt files are now preserved (renamed to `.corrupt`) instead of being silently overwritten.

### 🎨 UI & UX Modernization
- **Technical Metadata Row**: Refined the display of character counts, word counts, and timestamps with a high-contrast, premium aesthetic.
- **Dynamic Color Highlighting**: Non-favorited items now feature subtle, scannable rose/sky highlights for technical metrics.
- **Zero-Latency Polling**: Improved clipboard monitoring to be even more responsive while maintaining low CPU usage.

### 📁 Documentation
- **Screenshots Directory**: Added a new `/screenshots` folder in the root directory for repository previews.
- **Updated Architecture**: Documentation updated to reflect the new atomic storage engine.

---

# v1.0.0 - Production Ready (Initial Release)

## 🎉 What's New

**Complete clipboard management system for Windows**

ClipMaster Pro is a fast, lightweight clipboard manager that automatically captures everything you copy, making it instantly searchable and organized.

---

## 📦 Download

### Setup Installer (Recommended for Most Users)
- **File**: ClipMaster-Pro-Setup.exe
- **Size**: 85 MB
- **Type**: Professional installer with system integration
- **For**: Home users, offices, standard installation
- **Features**: Auto shortcuts, system integration, easy uninstall

### Portable Version (No Installation)
- **File**: ClipMaster-Pro-Portable.exe
- **Size**: 40 MB
- **Type**: Self-extracting, no installation
- **For**: USB drives, testing, minimal footprint
- **Features**: Instant launch, no system changes, portable

→ **Detailed comparison**: See [SETUP_VS_PORTABLE.md](SETUP_VS_PORTABLE.md)

---

## ✨ Features

- ⚡ **Auto-Capture** — Every copy saved automatically
- 🔍 **Instant Search** — Find clips in milliseconds
- 🏷️ **Smart Tags** — Organize by category
- ⭐ **Favorites** — Mark important clips
- 🗑️ **Safe Delete** — Recycle bin with restore
- 📊 **Sort & Filter** — By date, length, tags
- 🚀 **Auto-Launch** — Start with Windows (configurable)
- 🪟 **System Tray** — Minimize and resume instantly
- 🎨 **Markdown & Code** — Format-aware display

---

## 🚀 Quick Start

### Installation (Setup Version)

1. **Download** `ClipMaster-Pro-Setup.exe` (85 MB)
2. **Run** the installer
3. **Follow** the wizard (2-3 steps)
4. **Launch** app automatically
5. **Copy** any text to test
6. **Done!** ClipMaster Pro captures it

**Installation Time**: 10-20 seconds

### First Run (Portable Version)

1. **Download** `ClipMaster-Pro-Portable.exe` (40 MB)
2. **Run** the executable
3. **App launches** instantly (no setup needed)
4. **Copy** any text to test
5. **Done!** Ready to use

**Launch Time**: 3-5 seconds

→ **Detailed setup steps**: See [QUICK_START.md](QUICK_START.md)

---

## 📋 System Requirements

- **OS**: Windows 10 or newer (64-bit)
- **RAM**: 512 MB minimum
- **Disk**: 150 MB for app data
- **Internet**: None required (100% offline local app)

---

## 🔧 Configuration

### First-Time Setup (Optional)

1. **Auto-Launch**
   - Settings → Toggle "Launch on Windows startup"
   - App will start automatically when Windows boots
2. **Polling Interval**
   - Default: 600ms (checks clipboard 1.6 times per second)
   - Adjust if needed based on your usage

4. **Max Entries**
   - Default: 10,000 clips
   - Adjust storage limit based on available disk

---

## 📊 What's Loading

### On Startup
1. **Electron Runtime** (168 MB)
   - Chromium browser engine
   - JavaScript execution environment

2. **App Code** (Real React components)
   - Dashboard, Tags, Favorites, etc.
   - Zustand state management

3. **Resources** (649 MB packed as compressed assets)
   - UI fonts and icons
   - Chromium resources
   - Localization data

4. **Clipboard Monitor**
   - Starts polling Windows clipboard
   - Auto-detection of new copies
   - Deduplication

### Data Folder Location
```
C:\Users\[YourName]\AppData\Local\ClipMaster Pro\
├─ clipboard.json   (all your clips)
└─ tags.json       (your tags)
```

---

## 🎯 Key Differences: Setup vs Portable

| Feature | Setup | Portable |
|---------|-------|----------|
| Size | 85 MB | 40 MB |
| Install Time | 10-20s | None (instant) |
| Shortcuts | Yes | Manual |
| System Integration | Yes | No |
| Uninstall | Control Panel | Delete .exe |
| Auto-Launch Built-in | Yes | Manual setup |
| Best For | Regular use | USB/portable/testing |

→ **Full comparison**: See [SETUP_VS_PORTABLE.md](SETUP_VS_PORTABLE.md)

---

## 🐛 Troubleshooting

**App won't start?**
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#app-wont-start)

**No clips appearing?**
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#no-clips-appearing)

---

## 📚 Documentation

- [QUICK_START.md](QUICK_START.md) — 1-minute setup guide
- [DEPLOYMENT.md](DEPLOYMENT.md) — Detailed installation & configuration
- [SETUP_VS_PORTABLE.md](SETUP_VS_PORTABLE.md) — Installer comparison
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Fix common issues
- [ARCHITECTURE.md](ARCHITECTURE.md) — How it works (technical)

---

## 🔐 Privacy & Security

✅ **Local by default** — All data stays on your PC  
✅ **No tracking** — Zero telemetry  
✅ **Open source** — Code is public and auditable  

---

## ⚙️ Build Info

This release was built with:
- Electron 29 (desktop framework)
- React 18 + TypeScript (UI)
- Vite 5 (build tool)
- electron-builder (packaging)

**Optimization applied**:
- ASAR compression
- Removed unused graphics libraries
- English-only locale (52% smaller than multi-language)

---

## 📝 Installation Steps Summary

### Setup Version
```
1. Download ClipMaster-Pro-Setup.exe
2. Run executable
3. Click "Install"
4. Wait 10-20 seconds
5. App launches automatically
6. Test by copying text
```

### Portable Version
```
1. Download ClipMaster-Pro-Portable.exe
2. Run executable
3. App launches in 3-5 seconds
4. No installation needed
5. Test by copying text
```

---

## 🚀 Getting Started Recommendations

**For New Users**:
1. Download Setup version (85 MB)
2. Follow installation wizard
3. Read QUICK_START.md
4. Test with clipboard copies
5. Enable auto-launch (optional)

**For Advanced Users**:
1. Download Portable version (40 MB)
2. Run and verify
3. Check ARCHITECTURE.md for technical details

**For Testing/Evaluation**:
1. Download Portable version (40 MB)
2. Test features
3. Decide on full installation
4. No system changes needed

---

## 📞 Support

For issues or questions:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review [DEPLOYMENT.md](DEPLOYMENT.md)
3. See [SETUP_VS_PORTABLE.md](SETUP_VS_PORTABLE.md) for installation help

---

## 📜 License

MIT License - Use freely, modify, and redistribute

---

## ✅ Version 1.0.0 Status

- ✅ Core features complete
- ✅ Database integration (local NeDB datastores)
- ✅ UI/UX polished
- ✅ Performance optimized
- ✅ Size optimized (52% reduction from baseline)
- ✅ Ready for production

**Release Date**: April 2026  
**Status**: Stable Release (Production Ready)

---

Made with ❤️ using Electron, React, and TypeScript
