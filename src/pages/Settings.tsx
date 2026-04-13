import React, { useState, useEffect, useRef } from 'react'
import logoIcon from '@/assets/icon.png'
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
  IconX,
  IconGrid,
  IconList,
  IconCompact,
  IconLayers,
  IconMinimize
} from '../components/Icons'
import { motion, AnimatePresence } from 'framer-motion'


const Settings: React.FC = () => {
  const {
    settings, saveSettings, loadSettings, clips,
    mongoConnected, setMongoConnected,
    atlasConnected, setAtlasConnected,
    syncState, setSyncState
  } = useClipStore()

  const latestClipTimestamp = React.useMemo(() => {
    if (clips.length === 0) return 0
    const validClips = clips.filter(c => !c.isDeleted)
    if (validClips.length === 0) return 0
    return Math.max(...validClips.map(c => new Date(c.updatedAt || c.timestamp).getTime()))
  }, [clips])

  const localHealth = React.useMemo(() => {
    if (!settings.mongoEnabled || !mongoConnected) return 'error'
    if (!syncState.lastLocalSyncedAt || !latestClipTimestamp) return 'ok'
    return new Date(syncState.lastLocalSyncedAt).getTime() >= latestClipTimestamp ? 'ok' : 'stale'
  }, [settings.mongoEnabled, mongoConnected, syncState.lastLocalSyncedAt, latestClipTimestamp])

  const cloudHealth = React.useMemo(() => {
    if (!settings.atlasEnabled || !atlasConnected) return 'error'
    if (!syncState.lastCloudSyncedAt || !latestClipTimestamp) return 'ok'
    return new Date(syncState.lastCloudSyncedAt).getTime() >= latestClipTimestamp ? 'ok' : 'stale'
  }, [settings.atlasEnabled, atlasConnected, syncState.lastCloudSyncedAt, latestClipTimestamp])

  const [settingsLoading, setSettingsLoading] = useState(true)
  const [localUri, setLocalUri] = useState(settings.mongoUri ?? 'mongodb://127.0.0.1:27017/clipmaster')
  const [atlasUri, setAtlasUri] = useState(settings.atlasUri ?? '')
  const [saving, setSaving] = useState(false)
  const [localConnecting, setLocalConnecting] = useState(false)
  const [atlasConnecting, setAtlasConnecting] = useState(false)
  const [localSyncing, setLocalSyncing] = useState(false)
  const [atlasSyncing, setAtlasSyncing] = useState(false)
  const [localStatus, setLocalStatus] = useState<'idle'|'ok'|'fail'|'connecting'>('idle')
  const [localError, setLocalError] = useState('')
  const [atlasStatus, setAtlasStatus] = useState<'idle'|'ok'|'fail'|'connecting'>('idle')
  const [atlasError, setAtlasError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    setSettingsLoading(true)
    loadSettings().finally(() => setSettingsLoading(false))
  }, []) // eslint-disable-line

  useEffect(() => { setLocalUri(settings.mongoUri ?? 'mongodb://127.0.0.1:27017/clipmaster') }, [settings.mongoUri])
  useEffect(() => { setAtlasUri(settings.atlasUri ?? '') }, [settings.atlasUri])

  // Auto-connect to Atlas if URI is present
  const hasAutoConnected = useRef(false)
  useEffect(() => {
    if (!settingsLoading && atlasUri && !atlasConnected && !hasAutoConnected.current) {
      hasAutoConnected.current = true
      handleConnectAtlas(true)
    }
  }, [settingsLoading, atlasUri, atlasConnected])


  const handleSave = async () => {
    setSaving(true)
    await saveSettings({ mongoUri: localUri, atlasUri })
    setSaving(false)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
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

  const handleConnectAtlas = async (isAuto = false) => {
    if (!atlasUri.trim()) { setAtlasStatus('fail'); setAtlasError('Enter an Atlas connection string'); return }
    setAtlasConnecting(true); setAtlasStatus('connecting'); setAtlasError('')
    try {
      const ok = await window.clipAPI.atlasConnect(atlasUri.trim())
      setAtlasConnected(ok)
      setAtlasStatus(ok ? 'ok' : 'fail')
      if (!ok) {
        setAtlasError('Atlas connection failed. Check credentials and IP whitelist.')
      } else if (!isAuto) {
        // Only force enable and save if it's a manual connection attempt
        await saveSettings({ atlasEnabled: true, atlasUri: atlasUri.trim() })
      }
    } catch (e) {
      setAtlasStatus('fail'); setAtlasError(String(e))
    } finally { setAtlasConnecting(false) }
  }

  const handleSync = async (target: 'local' | 'atlas') => {
    if (target === 'local') setLocalSyncing(true)
    else setAtlasSyncing(true)
    
    await window.clipAPI.triggerSync?.(target)
    
    if (target === 'local') setLocalSyncing(false)
    else setAtlasSyncing(false)
  }

  const handleDisconnectLocal = async () => {
    try {
      await window.clipAPI.mongoDisconnect()
      setMongoConnected(false)
      setLocalStatus('idle')
      setSyncState({ lastLocalSyncedAt: null })
      await saveSettings({ mongoEnabled: false })
    } catch (err) {
      console.error('Failed to disconnect local:', err)
    }
  }

  const handleDisconnectAtlas = async () => {
    try {
      await window.clipAPI.atlasDisconnect()
      setAtlasConnected(false)
      setAtlasStatus('idle')
      setAtlasUri('')
      setSyncState({ lastCloudSyncedAt: null })
      await saveSettings({ atlasEnabled: false, atlasUri: '' })
    } catch (e) {
      console.error('Failed to disconnect atlas:', e)
    }
  }

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

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
      <header className="flex items-center gap-3 px-6 py-3.5 border-b border-gray-700 bg-surface-800/50 backdrop-blur-md shrink-0">
        <div className="p-1.5 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-400">
          <IconSettings size={18} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-white/90">Settings</h2>
          <p className="text-[11px] text-gray-500">Application configuration and synchronization</p>
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
                <CustomSelect
                  value={settings.maxEntries}
                  onChange={(v) => saveSettings({ maxEntries: Number(v) })}
                  options={[
                    { label: '500 clips', value: 500, icon: <IconMinimize size={14} /> },
                    { label: '1,000 clips', value: 1000, icon: <IconLayers size={14} /> },
                    { label: '5,000 clips', value: 5000, icon: <IconLayers size={14} /> },
                    { label: '10,000 clips', value: 10000, icon: <IconDatabase size={14} /> },
                  ]}
                />
              </SettingRow>

              <SettingRow 
                label="Default View Mode" 
                desc="Preferred layout for the dashboard."
              >
                <CustomSelect
                  value={settings.viewMode}
                  onChange={(v) => saveSettings({ viewMode: v as any })}
                  options={[
                    { label: 'List View', value: 'list', icon: <IconList size={14} /> },
                    { label: 'Grid View', value: 'grid', icon: <IconGrid size={14} /> },
                    { label: 'Compact View', value: 'compact', icon: <IconCompact size={14} /> },
                  ]}
                />
              </SettingRow>
            </div>
          </Section>

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
                      onBlur={() => saveSettings({ mongoUri: localUri })}
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
                          onClick={() => handleSync('local')}
                          disabled={localSyncing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[13px] text-emerald-400 font-medium hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {localSyncing ? <IconRefresh size={14} className="animate-spin" /> : <IconRefresh size={14} />}
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
                        onBlur={() => saveSettings({ atlasUri: atlasUri })}
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
                      onClick={() => handleConnectAtlas(false)}
                      disabled={atlasConnecting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 border border-brand-500/30 text-[13px] text-brand-400 font-medium hover:bg-brand-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {atlasConnecting ? <IconRefresh size={14} className="animate-spin" /> : <IconCloud size={14} />}
                      {atlasConnected ? 'Reconnect Cloud' : 'Connect Cloud'}
                    </button>
                    {atlasConnected && (
                      <>
                        <button 
                          onClick={() => handleSync('atlas')}
                          disabled={atlasSyncing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[13px] text-emerald-400 font-medium hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {atlasSyncing ? <IconRefresh size={14} className="animate-spin" /> : <IconRefresh size={14} />}
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

          {/* Sync Status Overlay */}
          <div className="p-4 rounded-xl border-gray-700 shadow-sm">
            <header className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <IconRefresh size={14} className="text-brand-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Live Sync Status</span>
            </div>
          </header>
            <div className="grid grid-cols-3 gap-3">
              <StatusCard label="LocalStorage" status="ok" detail="Primary" icon={<IconShield size={14} />} />
              <StatusCard 
                label="Local Mongo" 
                status={mongoConnected ? (localHealth === 'stale' ? 'stale' : (syncState.localMongo === 'syncing' ? 'syncing' : 'ok')) : 'offline'} 
                detail={mongoConnected ? (syncState.localMongo === 'syncing' ? 'Syncing…' : (syncState.lastLocalSyncedAt ? fmtTime(syncState.lastLocalSyncedAt) || 'Linked' : 'Linked')) : 'Inactive'} 
                icon={<IconDatabase size={14} />}
                isStale={localHealth === 'stale'}
              />
              <StatusCard 
                label="Atlas Cloud" 
                status={atlasConnected ? (cloudHealth === 'stale' ? 'stale' : (syncState.atlas === 'syncing' ? 'syncing' : 'ok')) : (settings.atlasEnabled ? 'connecting' : 'offline')} 
                detail={atlasConnected ? (syncState.atlas === 'syncing' ? 'Syncing…' : (syncState.lastCloudSyncedAt ? fmtTime(syncState.lastCloudSyncedAt) || 'Linked' : 'Linked')) : (settings.atlasEnabled ? 'Connecting…' : 'Inactive')} 
                icon={<IconCloud size={14} />}
                isStale={cloudHealth === 'stale'}
              />
            </div>
          </div>

          {/* About */}
          <Section title="Application Info" icon={<IconInfo size={14} className="text-gray-500" />}>
            <div className="p-4 rounded-xl">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                     <div className="absolute inset-0 bg-brand-500/20 blur-xl rounded-full group-hover:bg-brand-500/30 transition-colors" />
                     <img src={logoIcon} alt="Logo" className="relative w-16 h-16 object-contain drop-shadow-2xl" />
                   </div>
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
          <motion.button 
            onClick={handleSave}
            disabled={saving}
            layout
            initial={false}
            className={`
              relative group flex items-center gap-2.5 px-7 py-2.5 rounded-xl
              text-[12px] font-bold uppercase tracking-widest transition-all duration-500
              overflow-hidden border border-white/5
              ${showSuccess 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]' 
                : 'bg-surface-900/50 backdrop-blur-md text-white/90 hover:text-white shadow-lg border-white/10'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {/* Background Glow */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
              ${showSuccess 
                ? 'bg-emerald-500/5' 
                : 'bg-gradient-to-tr from-brand-500/10 via-brand-500/5 to-transparent'}`} 
            />

            {/* Shine sweep */}
            {!saving && !showSuccess && (
              <motion.div
                initial={{ x: '-100%', opacity: 0 }}
                animate={{ x: '100%', opacity: [0, 0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-y-[-50%] h-[200%]"
              />
            )}

            <AnimatePresence mode="wait">
              {saving ? (
                <motion.div
                  key="saving"
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.1, y: -5 }}
                  className="flex items-center gap-2"
                >
                  <IconRefresh size={14} className="animate-spin text-brand-400" />
                  <span className="text-gray-400">Saving...</span>
                </motion.div>
              ) : showSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.1, y: -5 }}
                  className="flex items-center gap-2"
                >
                  <IconCheck size={14} className="text-emerald-400" />
                  <span className="text-emerald-400 font-extrabold">Saved</span>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.1, y: -5 }}
                  className="flex items-center gap-2"
                >
                  <IconSave size={14} className="text-brand-400 group-hover:-translate-y-0.5 transition-transform" />
                  <span>Save Changes</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Accent Line */}
            <div className={`absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-300
              ${showSuccess ? 'bg-emerald-500' : 'bg-brand-500/40 group-hover:bg-brand-500 group-hover:shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`} 
            />
          </motion.button>
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

const StatusCard: React.FC<{ 
  label: string; 
  status: string; 
  detail: string; 
  icon: React.ReactNode;
  isStale?: boolean;
}> = ({ label, status, detail, icon, isStale }) => {
  const isOk = (status === 'ok' || status === 'idle') && !isStale
  const isErr = status === 'error' || status === 'fail' || status === 'offline'
  
  let cardStyle = 'bg-brand-500/5 border-brand-500/20 text-brand-400'
  if (isOk) cardStyle = 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 font-medium'
  if (isErr) cardStyle = 'bg-rose-500/5 border-rose-500/20 text-rose-400'
  if (isStale) cardStyle = 'bg-amber-500/5 border-amber-500/20 text-amber-500 shadow-[0_4px_12px_rgba(245,158,11,0.1)]'

  return (
    <div className={`p-3 rounded-xl transition-all duration-300 ${cardStyle}`}>
      <div className="flex items-center gap-2 mb-2 opacity-80">
        <span className={`${isStale ? 'text-amber-500' : ''}`}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-[13px] font-bold truncate tabular-nums leading-none">
        {detail}
      </div>
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

const CustomSelect: React.FC<{ value: any; onChange: (v: any) => void; options: { label: string; value: any; icon?: React.ReactNode }[] }> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentOption = options.find(opt => opt.value === value) || options[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 h-9 px-4 rounded-xl border transition-all duration-200 ${
          isOpen 
          ? 'bg-surface-700 border-brand-500/30 text-brand-400 shadow-lg shadow-brand-500/5' 
          : 'bg-surface-900 border-gray-700/50 text-gray-400 hover:border-gray-500 hover:text-gray-200'
        }`}
      >
        {currentOption.icon && <span className="opacity-70">{currentOption.icon}</span>}
        <span className="text-[12px] font-medium whitespace-nowrap">{currentOption.label}</span>
        <IconChevronDown size={14} className={`opacity-40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full mt-1 right-0 w-48 z-[100] bg-surface-800 border border-white/10 rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden p-1.5"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center my-1 justify-between px-3 py-2 rounded-lg text-[12px] transition-all duration-150 ${
                  value === opt.value
                  ? 'bg-brand-500/10 text-brand-400'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                    {opt.icon && <span className={value === opt.value ? 'text-brand-400' : 'text-gray-500'}>{opt.icon}</span>}
                    <span className="font-medium">{opt.label}</span>
                </div>
                {value === opt.value && <IconCheck size={14} className="text-brand-400" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

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
