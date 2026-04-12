import React, { useState, useEffect } from 'react'
import { useClipStore } from '../store/useClipStore'
import { 
  IconSettings, 
  IconMonitor, 
  IconDatabase, 
  IconCloud, 
  IconRefresh, 
  IconSave, 
  IconInfo, 
  IconChevronDown,
  IconShield,
  IconAlertCircle,
  IconCheck,
  IconX
} from '../components/Icons'

const Settings: React.FC = () => {
  const {
    settings, saveSettings, loadSettings,
    mongoConnected, setMongoConnected,
    atlasConnected, setAtlasConnected,
    syncState
  } = useClipStore()

  const [settingsLoading, setSettingsLoading] = useState(true)
  const [localUri, setLocalUri] = useState(settings.mongoUri ?? 'mongodb://127.0.0.1:27017/clipmaster')
  const [atlasUri, setAtlasUri] = useState(settings.atlasUri ?? '')
  const [saving, setSaving] = useState(false)
  const [localConnecting, setLocalConnecting] = useState(false)
  const [atlasConnecting, setAtlasConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [localStatus, setLocalStatus] = useState<'idle'|'ok'|'fail'|'connecting'>('idle')
  const [localError, setLocalError] = useState('')
  const [atlasStatus, setAtlasStatus] = useState<'idle'|'ok'|'fail'|'connecting'>('idle')
  const [atlasError, setAtlasError] = useState('')

  useEffect(() => {
    setSettingsLoading(true)
    loadSettings().finally(() => setSettingsLoading(false))
  }, []) // eslint-disable-line

  useEffect(() => { setLocalUri(settings.mongoUri ?? 'mongodb://127.0.0.1:27017/clipmaster') }, [settings.mongoUri])
  useEffect(() => { setAtlasUri(settings.atlasUri ?? '') }, [settings.atlasUri])

  useEffect(() => {
    const unsub = window.clipAPI.onSyncUpdate?.((state) => {
      useClipStore.getState().setSyncState(state)
    }) ?? (() => {})
    return unsub
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await saveSettings({ mongoUri: localUri, atlasUri })
    setSaving(false)
  }

  const handleConnectLocal = async () => {
    if (!localUri.trim()) { setLocalStatus('fail'); setLocalError('Enter a MongoDB URI'); return }
    setLocalConnecting(true); setLocalStatus('connecting'); setLocalError('')
    try {
      const ok = await window.clipAPI.mongoConnect(localUri.trim())
      setMongoConnected(ok)
      setLocalStatus(ok ? 'ok' : 'fail')
      if (!ok) setLocalError('Connection failed. Make sure MongoDB is running.')
      else await saveSettings({ mongoEnabled: true, mongoUri: localUri.trim() })
    } catch (e) {
      setLocalStatus('fail'); setLocalError(String(e))
    } finally { setLocalConnecting(false) }
  }

  const handleConnectAtlas = async () => {
    if (!atlasUri.trim()) { setAtlasStatus('fail'); setAtlasError('Enter an Atlas connection string'); return }
    setAtlasConnecting(true); setAtlasStatus('connecting'); setAtlasError('')
    try {
      const ok = await window.clipAPI.atlasConnect(atlasUri.trim())
      setAtlasConnected(ok)
      setAtlasStatus(ok ? 'ok' : 'fail')
      if (!ok) setAtlasError('Atlas connection failed. Check credentials and IP whitelist.')
      else await saveSettings({ atlasEnabled: true, atlasUri: atlasUri.trim() })
    } catch (e) {
      setAtlasStatus('fail'); setAtlasError(String(e))
    } finally { setAtlasConnecting(false) }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    await window.clipAPI.triggerSync?.()
    setSyncing(false)
  }

  const handleDisconnectLocal = async () => {
    setMongoConnected(false); setLocalStatus('idle')
    await saveSettings({ mongoEnabled: false })
  }

  const handleDisconnectAtlas = async () => {
    setAtlasConnected(false); setAtlasStatus('idle')
    await saveSettings({ atlasEnabled: false, atlasUri: '' })
    setAtlasUri('')
  }

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

  if (settingsLoading) {
    return (
      <div className="flex flex-col h-full bg-surface-900 items-center justify-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
        <span className="text-xs text-gray-500 font-medium">Loading environment…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-900 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-gray-700 bg-surface-800/50 backdrop-blur-md shrink-0">
        <div className="p-1.5 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-400">
          <IconSettings size={18} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-white/90">Settings</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Application configuration and synchronization</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* General Section */}
          <Section title="General Presence" icon={<IconMonitor size={14} className="text-gray-500" />}>
            <div className="space-y-2">
              <SettingRow 
                label="Launch at Windows startup" 
                desc="Start ClipMaster Pro automatically when you log in."
              >
                <Toggle checked={settings.autoLaunch} onChange={(v) => saveSettings({ autoLaunch: v })} />
              </SettingRow>

              <SettingRow 
                label="Max stored clips" 
                desc="Oldest non-favorite clips are removed when limit is reached."
              >
                <Select
                  value={settings.maxEntries}
                  onChange={(v) => saveSettings({ maxEntries: Number(v) })}
                  options={[
                    { label: '500 clips', value: 500 },
                    { label: '1,000 clips', value: 1000 },
                    { label: '5,000 clips', value: 5000 },
                    { label: '10,000 clips', value: 10000 },
                  ]}
                />
              </SettingRow>

              <SettingRow 
                label="Default View Mode" 
                desc="Preferred layout for the dashboard."
              >
                <Select
                  value={settings.viewMode}
                  onChange={(v) => saveSettings({ viewMode: v as any })}
                  options={[
                    { label: 'List View', value: 'list' },
                    { label: 'Grid View', value: 'grid' },
                    { label: 'Compact View', value: 'compact' },
                  ]}
                />
              </SettingRow>
            </div>
          </Section>

          {/* Sync Status Overlay */}
          <div className="p-4 rounded-xl bg-surface-800 border border-gray-700 shadow-sm">
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <IconRefresh size={14} className="text-brand-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Live Sync Status</span>
              </div>
              {syncState.pendingCount > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {syncState.pendingCount} pending
                </div>
              )}
            </header>
            <div className="grid grid-cols-3 gap-3">
              <StatusCard label="LocalStorage" status="ok" detail="Active" icon={<IconShield size={14} />} />
              <StatusCard 
                label="Local Mongo" 
                status={mongoConnected ? syncState.localMongo : 'offline'} 
                detail={mongoConnected ? (syncState.localMongo === 'syncing' ? 'Syncing…' : 'Linked') : 'Inactive'} 
                icon={<IconDatabase size={14} />}
              />
              <StatusCard 
                label="Atlas Cloud" 
                status={atlasConnected ? syncState.atlas : 'offline'} 
                detail={atlasConnected ? `Last: ${fmtTime(syncState.lastSyncedAt)}` : 'Inactive'} 
                icon={<IconCloud size={14} />}
              />
            </div>
          </div>

          {/* Local Database */}
          <Section 
            title="Local persistence" 
            badge={<ConnectionStatus connected={mongoConnected} />}
            icon={<IconDatabase size={14} className="text-gray-500" />}
          >
            <div className="space-y-4">
              <SettingRow 
                label="Enable MongoDB Sync" 
                desc="Persist clips to a local MongoDB instance for scalability."
              >
                <Toggle checked={settings.mongoEnabled} onChange={(v) => saveSettings({ mongoEnabled: v })} />
              </SettingRow>

              {settings.mongoEnabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-gray-400">Connection URI</label>
                    <input 
                      type="text"
                      value={localUri}
                      onChange={(e) => { setLocalUri(e.target.value); setLocalStatus('idle') }}
                      placeholder="mongodb://localhost:27017/clipmaster"
                      className="w-full bg-surface-900 border border-gray-700 rounded-lg px-4 py-2.5 text-[13px] font-mono text-gray-300 placeholder-gray-600 focus:border-brand-500/50 outline-none transition-all"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleConnectLocal}
                      disabled={localConnecting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 border border-brand-500/30 text-[13px] text-brand-400 font-medium hover:bg-brand-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {localConnecting ? <IconRefresh size={14} className="animate-spin" /> : <IconRefresh size={14} />}
                      {mongoConnected ? 'Reconnect Database' : 'Connect Database'}
                    </button>
                    {mongoConnected && (
                      <>
                        <button 
                          onClick={handleSyncAll}
                          disabled={syncing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[13px] text-emerald-400 font-medium hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {syncing ? <IconRefresh size={14} className="animate-spin" /> : <IconRefresh size={14} />}
                          Sync Data
                        </button>
                        <button 
                          onClick={handleDisconnectLocal}
                          className="p-2 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-400 hover:text-white transition-colors"
                          title="Disconnect"
                        >
                          <IconX size={16} />
                        </button>
                      </>
                    )}
                  </div>
                  <InlineStatus status={localStatus} message={localError} label="Local Database" />
                </div>
              )}
            </div>
          </Section>

          {/* Atlas Cloud */}
          <Section 
            title="Cloud synchronization" 
            badge={<ConnectionStatus connected={atlasConnected} />}
            icon={<IconCloud size={14} className="text-gray-500" />}
          >
            <div className="space-y-4">
              <SettingRow 
                label="Enable MongoDB Atlas" 
                desc="Sync your clipboard across multiple machines using the cloud."
              >
                <Toggle checked={settings.atlasEnabled ?? false} onChange={(v) => saveSettings({ atlasEnabled: v })} />
              </SettingRow>

              {settings.atlasEnabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-gray-400">Atlas Connection String</label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600">
                        <IconShield size={16} />
                      </div>
                      <input 
                        type="password"
                        value={atlasUri}
                        onChange={(e) => { setAtlasUri(e.target.value); setAtlasStatus('idle') }}
                        placeholder="mongodb+srv://..."
                        className="w-full bg-surface-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-[13px] font-mono text-gray-300 placeholder-gray-600 focus:border-brand-500/50 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed px-1">
                      Encryption: Data is AES-256 encrypted before upload. Ensure your IP is whitelisted in Atlas.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleConnectAtlas}
                      disabled={atlasConnecting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 border border-brand-500/30 text-[13px] text-brand-400 font-medium hover:bg-brand-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {atlasConnecting ? <IconRefresh size={14} className="animate-spin" /> : <IconCloud size={14} />}
                      {atlasConnected ? 'Reconnect Cloud' : 'Connect Cloud'}
                    </button>
                    {atlasConnected && (
                      <>
                        <button 
                          onClick={handleSyncAll}
                          disabled={syncing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[13px] text-emerald-400 font-medium hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {syncing ? <IconRefresh size={14} className="animate-spin" /> : <IconRefresh size={14} />}
                          Sync Data
                        </button>
                        <button 
                          onClick={handleDisconnectAtlas}
                          className="p-2 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-400 hover:text-white transition-colors"
                          title="Disconnect"
                        >
                          <IconX size={16} />
                        </button>
                      </>
                    )}
                  </div>
                  <InlineStatus status={atlasStatus} message={atlasError} label="Cloud Atlas" />
                </div>
              )}
            </div>
          </Section>

          {/* About */}
          <Section title="Application Info" icon={<IconInfo size={14} className="text-gray-500" />}>
            <div className="p-4 rounded-xl bg-surface-800">
                <div className="flex items-center gap-4">
                    <img src="/icon.png" alt="ClipMaster Pro Logo" className="w-14 h-14 object-contain" />
                 <div className="space-y-1">
                   <h3 className="text-[15px] font-bold text-white/90">ClipMaster Pro</h3>
                   <p className="text-xs text-gray-500 font-medium tracking-tight">Version 1.2.4 (Official Build)</p>
                   <div className="flex items-center gap-3 pt-2">
                     <span className="text-[11px] text-gray-600">Built with React + Electron</span>
                     <div className="w-1 h-1 rounded-full bg-gray-700" />
                     <span className="text-[11px] text-gray-600">Storage: Local + MongoDB</span>
                   </div>
                 </div>
               </div>
            </div>
          </Section>

          {/* Footer Spacer */}
          <div className="h-12" />
        </div>
      </main>

      {/* Sticky Bottom Actions */}
      <footer className="px-6 py-4 border-t border-gray-700 bg-surface-800/80 backdrop-blur-xl shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <p className="text-[11px] text-gray-500 italic max-w-[200px]">Changes are applied instantly to local state but require a manual save for persistence in background services.</p>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="group flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-500 text-[13px] text-white font-semibold hover:bg-brand-400 active:scale-95 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
          >
            {saving ? <IconRefresh size={16} className="animate-spin" /> : <IconSave size={16} className="group-hover:-translate-y-0.5 transition-transform" />}
            Save All Changes
          </button>
        </div>
      </footer>
    </div>
  )
}

/* ─── UI COMPONENTS ────────────────────────────────────────────────────────── */

const Section: React.FC<{ title: string; badge?: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, badge, icon, children }) => (
  <section className="space-y-3">
    <header className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">{title}</h3>
      </div>
      {badge}
    </header>
    <div className="p-1 space-y-1">{children}</div>
  </section>
)

const SettingRow: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <div className="flex items-center justify-between gap-6 p-4 rounded-xl bg-surface-800 border border-gray-700 hover:border-gray-600 transition-colors group">
    <div className="min-w-0 space-y-1">
      <h4 className="text-[13px] font-medium text-gray-200 group-hover:text-white transition-colors">{label}</h4>
      {desc && <p className="text-xs text-gray-500 leading-normal">{desc}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

const StatusCard: React.FC<{ label: string; status: string; detail: string; icon: React.ReactNode }> = ({ label, status, detail, icon }) => {
  const isOk = status === 'ok' || status === 'idle'
  const isErr = status === 'error' || status === 'fail' || status === 'offline'
  const isWarn = status === 'syncing'

  return (
    <div className={`p-3 rounded-lg border transition-all ${
      isOk ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
      isErr ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' :
      'bg-brand-500/5 border-brand-500/20 text-brand-400'
    }`}>
      <div className="flex items-center gap-2 mb-1.5 opacity-80">
        {icon}
        <span className="text-[11px] font-bold">{label}</span>
      </div>
      <p className="text-[10px] font-medium opacity-70 truncate">{detail}</p>
    </div>
  )
}

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-9 h-5 rounded-full transition-all duration-300 outline-none focus-visible:ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-800 ${
      checked ? 'bg-brand-500 shadow-inner' : 'bg-gray-700'
    }`}
  >
    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out ${
      checked ? 'translate-x-4' : 'translate-x-0'
    }`} />
  </button>
)

const Select: React.FC<{ value: any; onChange: (v: any) => void; options: { label: string; value: any }[] }> = ({ value, onChange, options }) => (
  <div className="relative group">
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none bg-surface-900 border border-gray-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-gray-300 font-medium hover:border-gray-500 focus:border-brand-500 outline-none cursor-pointer transition-all"
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-gray-300 transition-colors">
      <IconChevronDown size={14} />
    </div>
  </div>
)

const ConnectionStatus: React.FC<{ connected: boolean }> = ({ connected }) => (
  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
    connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-gray-700/50 border-gray-600/50 text-gray-500'
  }`}>
    <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`} />
    {connected ? 'Linked' : 'Offline'}
  </div>
)

const InlineStatus: React.FC<{ status: string; message: string; label: string }> = ({ status, message, label }) => {
  if (status === 'ok') return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
      <IconCheck size={16} />
      <span className="text-[13px] font-medium">{label} connected successfully</span>
    </div>
  )
  if (status === 'fail') return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
      <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
      <div className="space-y-1">
        <h5 className="text-[13px] font-bold">Connection Failed</h5>
        <p className="text-xs opacity-70 leading-relaxed">{message || 'An unknown error occurred while connecting.'}</p>
      </div>
    </div>
  )
  return null
}

export default Settings
