import React from 'react'
import { useClipStore } from '../store/useClipStore'
import FilterPanel from './FilterPanel'
import TagManager from './TagManager'
import type { ActivePage } from '../types'
import { 
  IconGrid, 
  IconTrash, 
  IconSettings, 
  IconClock,
  IconZap,
  IconStar,
  IconTag
} from './Icons'

const NAV_ITEMS: { page: ActivePage; icon: any; label: string }[] = [
  { page: 'dashboard', icon: IconGrid, label: 'All Clips' },
  { page: 'favorites', icon: IconStar, label: 'Favorites' },
  { page: 'tags', icon: IconTag, label: 'Manage Tags' },
  { page: 'recycle', icon: IconTrash, label: 'Recycle Bin' },
  { page: 'settings', icon: IconSettings, label: 'Settings' }
]

const Sidebar: React.FC = () => {
  const { 
    activePage, setActivePage, clips, 
    mongoConnected, atlasConnected, 
    syncState, loadClips, loadSettings 
  } = useClipStore()

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'

  const activeCount = clips.filter((c) => !c.isDeleted).length
  const favoritesCount = clips.filter((c) => c.isFavorite && !c.isDeleted).length
  const deletedCount = clips.filter((c) => c.isDeleted).length

  const getCounts = (page: ActivePage) => {
    if (page === 'dashboard') return activeCount
    if (page === 'favorites') return favoritesCount
    if (page === 'recycle') return deletedCount
    return null
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-surface-900 border-r border-gray-700 h-full overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-2.5">
          <img 
            src="/icon.png" 
            alt="ClipMaster Logo" 
            className="size-9 shrink-0 drop-shadow-lg" 
          />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white tracking-tight leading-none">ClipMaster</h1>
            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-wider mt-0.5">Pro Edition</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-0.5">
        {NAV_ITEMS.map(({ page, icon: Icon, label }) => {
          const count = getCounts(page)
          const isActive = activePage === page
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
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150 active:scale-95 group ${
                isActive
                  ? 'bg-gray-800 text-brand-400 border border-gray-700 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon 
                  size={16} 
                  className={`transition-colors duration-150 ${
                    isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300'
                  }`} 
                />
                <span className="font-medium">{label}</span>
              </div>
              {count !== null && count > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums transition-all duration-300 border backdrop-blur-md shadow-sm ${
                    isActive
                      ? page === 'recycle'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                      : 'bg-white/5 text-gray-500 border-white/5 group-hover:border-white/10 group-hover:bg-white/10 group-hover:text-gray-300'
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
      <div className="mx-4 border-t border-gray-700/50 my-1" />

      {/* Scrollable filter area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4 scrollbar-thin">
        <FilterPanel />
      </div>

      {/* Bottom status */}
      <div className="px-4 py-2 border-t border-gray-700 bg-surface-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span
                className={`block w-1.5 h-1.5 rounded-full ${
                  mongoConnected ? 'bg-accent-500' : 'bg-gray-600'
                }`}
              />
              {mongoConnected && (
                <span className="absolute inset-0 rounded-full bg-accent-500 animate-ping opacity-40 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              )}
            </div>
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-tight">
              {mongoConnected ? 'Synced' : 'Local'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <IconClock size={11} />
            <span className="text-[10px] font-medium tracking-tight">
              {atlasConnected ? fmtTime(syncState.lastSyncedAt) : '--:--'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
