import React from 'react'
import { useClipStore } from '../store/useClipStore'
import FilterPanel from './FilterPanel'
import TagManager from './TagManager'
import type { ActivePage } from '../types'

const NAV_ITEMS: { page: ActivePage; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '⊞', label: 'All Clips' },
  { page: 'recycle', icon: '🗑', label: 'Recycle Bin' },
  { page: 'settings', icon: '⚙', label: 'Settings' }
]

const Sidebar: React.FC = () => {
  const { activePage, setActivePage, clips, mongoConnected, loadClips, loadSettings } = useClipStore()

  const activeCount = clips.filter((c) => !c.isDeleted).length
  const deletedCount = clips.filter((c) => c.isDeleted).length

  const getCounts = (page: ActivePage) => {
    if (page === 'dashboard') return activeCount
    if (page === 'recycle') return deletedCount
    return null
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-surface-800 border-r border-white/5 h-full overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="2" width="14" height="20" rx="2" stroke="white" strokeWidth="1.5" />
              <rect x="9" y="1" width="6" height="3" rx="1" fill="white" />
              <path d="M12 8 L12 16 M9 11 L12 8 L15 11" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="8" y1="14" x2="16" y2="14" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="17" x2="14" y2="17" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">ClipMaster</h1>
            <p className="text-xs text-brand-400 font-medium">Pro</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ page, icon, label }) => {
          const count = getCounts(page)
          return (
            <button
              key={page}
              onClick={async () => {
                setActivePage(page)
                if (page === 'settings') {
                  loadSettings()
                } else {
                  loadClips()
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                activePage === page
                  ? 'bg-brand-500/15 text-brand-400 font-medium'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{icon}</span>
                <span>{label}</span>
              </div>
              {count !== null && count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                    activePage === page
                      ? 'bg-brand-500/30 text-brand-300'
                      : 'bg-white/8 text-white/30'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-white/5 my-1" />

      {/* Scrollable filter + tag area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-thin">
        <FilterPanel />
        <div className="border-t border-white/5 pt-4">
          <TagManager />
        </div>
      </div>

      {/* Bottom status */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              mongoConnected ? 'bg-accent-500 animate-pulse-soft' : 'bg-white/20'
            }`}
          />
          <span className="text-xs text-white/30">
            {mongoConnected ? 'Synced to MongoDB' : 'Local storage only'}
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
