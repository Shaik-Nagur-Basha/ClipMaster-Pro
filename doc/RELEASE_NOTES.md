# ClipMaster Pro v1.0.0 - Release Notes

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
- 💾 **Cloud Sync** — Optional MongoDB backup
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
- **Internet**: Optional (for MongoDB sync only)

---

## 🔧 Configuration

### First-Time Setup (Optional)

1. **Auto-Launch**
   - Settings → Toggle "Launch on Windows startup"
   - App will start automatically when Windows boots

2. **MongoDB Cloud Sync** (Optional)
   - Settings → MongoDB section
   - Paste MongoDB connection string
   - Click Connect to backup clips online

3. **Polling Interval**
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

**MongoDB won't connect?**
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#mongodb-wont-connect)

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
✅ **Encrypted sync** — AES-256 for MongoDB backup  
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
3. Configure MongoDB if desired
4. Check ARCHITECTURE.md for technical details

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
- ✅ Database integration (local + MongoDB)
- ✅ UI/UX polished
- ✅ Performance optimized
- ✅ Size optimized (52% reduction from baseline)
- ✅ Ready for production

**Release Date**: April 2026  
**Status**: Stable Release (Production Ready)

---

Made with ❤️ using Electron, React, and TypeScript
