import React, { useState, useEffect } from 'react'
import { useClipStore } from '../store/useClipStore'

/* ─── Guaranteed layout styles ─── */
const S = {
  page:   { display: 'flex' as const, flexDirection: 'column' as const, width: '100%', height: '100%', overflow: 'hidden', minHeight: 0 },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 },
  body:   { flex: 1, overflowY: 'auto' as const, padding: 24, minHeight: 0, maxWidth: 672 },
}

const Settings: React.FC = () => {
  const {
    settings, saveSettings, loadSettings,
    mongoConnected, setMongoConnected,
    atlasConnected, setAtlasConnected,
    syncState
  } = useClipStore()

  // Settings-specific loading (not shared with clips)
  const [settingsLoading, setSettingsLoading] = useState(true)

  // Always reload settings when navigating here
  useEffect(() => {
    setSettingsLoading(true)
    loadSettings().finally(() => setSettingsLoading(false))
  }, []) // eslint-disable-line


  // Local state
  const [localUri,        setLocalUri]        = useState(settings.mongoUri  ?? 'mongodb://127.0.0.1:27017/clipmaster')
  const [atlasUri,        setAtlasUri]        = useState(settings.atlasUri  ?? '')
  const [saving,          setSaving]          = useState(false)
  const [localConnecting, setLocalConnecting] = useState(false)
  const [atlasConnecting, setAtlasConnecting] = useState(false)
  const [syncing,         setSyncing]         = useState(false)
  const [localStatus,     setLocalStatus]     = useState<'idle'|'ok'|'fail'|'connecting'>('idle')
  const [localError,      setLocalError]      = useState('')
  const [atlasStatus,     setAtlasStatus]     = useState<'idle'|'ok'|'fail'|'connecting'>('idle')
  const [atlasError,      setAtlasError]      = useState('')

  // Keep local fields in sync if settings reload
  useEffect(() => { setLocalUri(settings.mongoUri  ?? 'mongodb://127.0.0.1:27017/clipmaster') }, [settings.mongoUri])
  useEffect(() => { setAtlasUri(settings.atlasUri  ?? '') }, [settings.atlasUri])

  // Subscribe to live sync updates from main process
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
      if (!ok) setLocalError('Connection failed. Make sure MongoDB is running on the specified host.')
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
      if (!ok) setAtlasError('Atlas connection failed. Check:\n1. Your IP is whitelisted in Atlas → Network Access\n2. Credentials are correct\n3. Database name in the URI is valid')
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

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString() : '—'

  return (
    <div style={S.page}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <span style={{ fontSize: 18 }}>⚙️</span>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Settings</h2>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────── */}
      <div style={S.body}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* ── General ──────────────────────────────────────────────── */}
          <Section title="General">
            <SettingRow label="Launch at Windows startup" desc="Start ClipMaster Pro automatically when you log in.">
              <Toggle checked={settings.autoLaunch} onChange={(v) => saveSettings({ autoLaunch: v })} />
            </SettingRow>

            <SettingRow label="Max stored clips" desc="Oldest non-favorite clips are removed when this limit is reached.">
              <select
                value={settings.maxEntries}
                onChange={(e) => saveSettings({ maxEntries: Number(e.target.value) })}
                style={INPUT_STYLE}
              >
                {[500, 1000, 2000, 5000, 10000].map((n) => (
                  <option key={n} value={n}>{n.toLocaleString()} clips</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Default view" desc="Starting view when the app opens.">
              <select
                value={settings.viewMode}
                onChange={(e) => saveSettings({ viewMode: e.target.value as 'list' | 'grid' | 'compact' })}
                style={INPUT_STYLE}
              >
                <option value="list">List</option>
                <option value="grid">Grid</option>
                <option value="compact">Compact</option>
              </select>
            </SettingRow>

            <SettingRow label="Background sync interval" desc="How often to sync to MongoDB in the background.">
              <select
                value={settings.syncInterval ?? 30}
                onChange={(e) => saveSettings({ syncInterval: Number(e.target.value) })}
                style={INPUT_STYLE}
              >
                {[10, 30, 60, 120, 300].map((n) => (
                  <option key={n} value={n}>Every {n}s</option>
                ))}
              </select>
            </SettingRow>
          </Section>

          {/* ── Sync Status ───────────────────────────────────────────── */}
          <Card>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Sync Status
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
              <StatusPill label="JSON" status="ok" detail="Always active" />
              <StatusPill
                label="Local DB"
                status={mongoConnected ? syncState.localMongo : 'offline'}
                detail={mongoConnected ? (syncState.localMongo === 'syncing' ? 'Syncing…' : 'Active') : 'Disconnected'}
              />
              <StatusPill
                label="Atlas"
                status={atlasConnected ? syncState.atlas : 'offline'}
                detail={atlasConnected ? `Last: ${fmtTime(syncState.lastSyncedAt)}` : 'Disconnected'}
              />
            </div>
            {syncState.pendingCount > 0 && (
              <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)', textAlign: 'center', marginTop: 8 }}>
                ⏳ {syncState.pendingCount} item{syncState.pendingCount !== 1 ? 's' : ''} pending sync
              </p>
            )}
          </Card>

          {/* ── Local MongoDB ─────────────────────────────────────────── */}
          <Section
            title="Local MongoDB"
            badge={<ConnBadge connected={mongoConnected} />}
          >
            <SettingRow label="Enable local sync" desc="Sync clipboard history to a MongoDB instance running on this machine.">
              <Toggle checked={settings.mongoEnabled} onChange={(v) => saveSettings({ mongoEnabled: v })} />
            </SettingRow>

            {settings.mongoEnabled && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Local MongoDB URI</label>
                  <input
                    type="text"
                    value={localUri}
                    onChange={(e) => { setLocalUri(e.target.value); setLocalStatus('idle') }}
                    placeholder="mongodb://127.0.0.1:27017/clipmaster"
                    spellCheck={false}
                    style={TEXT_INPUT_STYLE}
                  />
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>🔐 All data is AES-256 encrypted before syncing.</p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <ConnectBtn loading={localConnecting} connected={mongoConnected} onConnect={handleConnectLocal} label="Local" />
                  {mongoConnected && (
                    <>
                      <SyncBtn loading={syncing} onClick={handleSyncAll} />
                      <DisconnBtn onClick={handleDisconnectLocal} />
                    </>
                  )}
                </div>
                <StatusMsg status={localStatus} error={localError} label="Local MongoDB" />
              </>
            )}
          </Section>

          {/* ── Atlas Cloud ───────────────────────────────────────────── */}
          <Section
            title="MongoDB Atlas (Cloud)"
            badge={<ConnBadge connected={atlasConnected} cloud />}
          >
            <SettingRow label="Enable Atlas sync" desc="Two-way sync to MongoDB Atlas. Requires internet and IP whitelist.">
              <Toggle checked={settings.atlasEnabled ?? false} onChange={(v) => saveSettings({ atlasEnabled: v })} />
            </SettingRow>

            {settings.atlasEnabled && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Atlas Connection String</label>
                  <input
                    type="password"
                    value={atlasUri}
                    onChange={(e) => { setAtlasUri(e.target.value); setAtlasStatus('idle') }}
                    placeholder="mongodb+srv://user:pass@cluster.mongodb.net/clipmaster"
                    spellCheck={false}
                    autoComplete="off"
                    style={TEXT_INPUT_STYLE}
                  />
                  <p style={{ fontSize: 11, color: 'rgba(96,165,250,0.6)' }}>Atlas → Network Access → Add Current IP Address to whitelist.</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>🔐 URI is stored encrypted. Never logged.</p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <ConnectBtn loading={atlasConnecting} connected={atlasConnected} onConnect={handleConnectAtlas} label="Atlas" />
                  {atlasConnected && (
                    <>
                      <SyncBtn loading={syncing} onClick={handleSyncAll} />
                      <DisconnBtn onClick={handleDisconnectAtlas} />
                    </>
                  )}
                </div>
                <StatusMsg status={atlasStatus} error={atlasError} label="Atlas" />
              </>
            )}
          </Section>

          {/* ── About ─────────────────────────────────────────────────── */}
          <Section title="About">
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#22c55e)', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>ClipMaster Pro v1.0.0</span>
                </div>
                <p>Built with Electron + React 18 + TypeScript</p>
                <p>Storage: JSON (primary) · Local MongoDB · Atlas (cloud)</p>
              </div>
            </Card>
          </Section>

          {/* ── Save ──────────────────────────────────────────────────── */}
          <div style={{ paddingBottom: 16 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
              style={{ opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? '↻ Saving…' : '💾 Save Settings'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

/* ─── Shared input styles ──────────────────────────────────────────────────── */
const INPUT_STYLE: React.CSSProperties = {
  background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.8)', fontSize: 13, borderRadius: 10,
  padding: '6px 12px', outline: 'none', cursor: 'pointer'
}

const TEXT_INPUT_STYLE: React.CSSProperties = {
  width: '100%', background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.9)', fontSize: 13, borderRadius: 12,
  padding: '10px 16px', fontFamily: 'monospace', outline: 'none'
}

/* ─── Sub-components ────────────────────────────────────────────────────────── */

const Section: React.FC<{ title: string; badge?: React.ReactNode; children: React.ReactNode }> = ({ title, badge, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', flex: 1, margin: 0 }}>
        {title}
      </h3>
      {badge}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
  </div>
)

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
    background: 'rgba(255,255,255,0.03)', padding: 16
  }}>
    {children}
  </div>
)

const SettingRow: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500, margin: 0 }}>{label}</p>
        {desc && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.5 }}>{desc}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  </Card>
)

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => onChange(!checked)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-checked={checked}
      role="switch"
      style={{
        position: 'relative', borderRadius: 99,
        width: 40, height: 22, border: 'none', cursor: 'pointer',
        background: checked ? '#6366f1' : (hov ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)'),
        outline: 'none', transition: 'background 200ms', flexShrink: 0
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: checked ? 20 : 2,
        width: 18, height: 18,
        borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'left 200ms'
      }} />
    </button>
  )
}

const ConnBadge: React.FC<{ connected: boolean; cloud?: boolean }> = ({ connected, cloud }) => (
  <span style={{
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, padding: '2px 10px', borderRadius: 99, fontWeight: 500,
    background: connected ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
    color:      connected ? '#4ade80'               : 'rgba(255,255,255,0.3)',
    border: `1px solid ${connected ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`
  }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#4ade80' : 'rgba(255,255,255,0.2)' }} />
    {connected ? (cloud ? '☁ Syncing' : '● Connected') : 'Disconnected'}
  </span>
)

const StatusPill: React.FC<{ label: string; status: string; detail: string }> = ({ label, status, detail }) => {
  const isGood = status === 'ok' || status === 'idle'
  const isSyncing = status === 'syncing'
  const isErr = status === 'error'
  const color = isGood ? '#4ade80' : isSyncing ? '#60a5fa' : isErr ? '#f87171' : 'rgba(255,255,255,0.25)'
  const bg    = isGood ? 'rgba(34,197,94,0.1)' : isSyncing ? 'rgba(96,165,250,0.1)' : isErr ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)'
  const bd    = isGood ? 'rgba(34,197,94,0.2)' : isSyncing ? 'rgba(96,165,250,0.2)' : isErr ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)'
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${bd}`, background: bg, padding: 8, color }}>
      <p style={{ fontWeight: 600, fontSize: 12, margin: 0 }}>{label}</p>
      <p style={{ opacity: 0.7, fontSize: 11, margin: 0 }}>{detail}</p>
    </div>
  )
}

const ConnectBtn: React.FC<{ loading: boolean; connected: boolean; onConnect: () => void; label: string }> = ({ loading, connected, onConnect, label }) => (
  <button
    onClick={onConnect}
    disabled={loading}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 14px', borderRadius: 12,
      background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
      color: '#818cf8', fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.4 : 1
    }}
  >
    {loading ? <><span className="animate-spin inline-block">↻</span> Connecting…</> : <>⚡ {connected ? `Reconnect ${label}` : `Connect ${label}`}</>}
  </button>
)

const SyncBtn: React.FC<{ loading: boolean; onClick: () => void }> = ({ loading, onClick }) => (
  <button
    onClick={onClick}
    disabled={loading}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 14px', borderRadius: 12,
      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
      color: '#4ade80', fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.4 : 1
    }}
  >
    {loading ? <><span className="animate-spin inline-block">↻</span> Syncing…</> : '↑ Sync Now'}
  </button>
)

const DisconnBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 12px', borderRadius: 12,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer'
    }}
  >
    ✕ Disconnect
  </button>
)

const StatusMsg: React.FC<{ status: string; error: string; label: string }> = ({ status, error, label }) => {
  if (status === 'ok') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 500 }}>✓ {label} connected successfully!</span>
    </div>
  )
  if (status === 'fail') return (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <p style={{ color: '#f87171', fontSize: 13, fontWeight: 500, margin: 0 }}>✕ Connection failed</p>
      {error && <p style={{ color: 'rgba(248,113,113,0.6)', fontSize: 12, marginTop: 4, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{error}</p>}
    </div>
  )
  return null
}

export default Settings
