Credientials to be encrpt every where
Sync Across All Devices
Responsive For All Devices
portable not working, resolve it.
settings - on or off for clips accept from incognito mode, password copy

Multiple select delete in all clips, favourites, recycle bin -->> By option which is selected clip to be with full border  --->> Because to many clips for delete leads to stuck expecially in full view, normal view

Clipboard History Timeline - Today, Yesterday, This week, This Month
Auto Cleanup - 7d, 30d, 90d, Never
recycle bin - 7d, 30d, 90d, 1y, Forever
Backup Options - Automatic Daily Backup, Weekly Backup, Backup location, restore backup, Always backup
Ignore Rules - list of applications, websites, textpatterns
Filter by patterns - aadhar 12-digit number, 10-digit no's, email pattern, url's pattern, hosts-mongodb://, chrome://, etc,. ip address, pc-locations when /username/dsd/sdd/
Auto Tagging based on the applications, websites - if happens from chatgpt, gemini into prompt's, 


## 📋 **RECOMMENDED ACTIONS - SECURITY HARDENING:**

1. **Immediately:**
   - [ ] Replace hardcoded `CLIPMASTER_SECRET` with environment variable-only approach
   - [ ] Move GitHub API URL to config or environment
   - [ ] Add `.env.example` (never commit `.env`)

2. **Short-term:**
   - [ ] Encrypt database files at rest using OS-level encryption
   - [ ] Encrypt MongoDB URIs in settings storage
   - [ ] Audit and pin all dependencies
   - [ ] Add security headers and CSP to renderer

3. **Long-term:**
   - [ ] Implement key derivation per device (PBKDF2/scrypt)
   - [ ] Use credential manager (Windows Credential Manager) for URIs
   - [ ] Add SBOM (Software Bill of Materials) scanning
   - [ ] Implement code signing for executable distribution

--- Create branch for option 2 of Rewrite the UI in native C# / WPF for less and less activity.





2.3.5
#v2.4.0