import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClipStore } from '../store/useClipStore'
import { IconSort, IconChevronDown, IconCheck, IconClock, IconLayers, IconMinimize } from './Icons'
import type { SortMode } from '../types'

const SortDropdown: React.FC = () => {
    const { sortMode, setSortMode } = useClipStore()
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const options: { value: SortMode; label: string; icon: React.ReactNode }[] = [
        { value: 'newest', label: 'Newest First', icon: <IconClock size={14} /> },
        { value: 'oldest', label: 'Oldest First', icon: <IconClock size={14} className="opacity-50" /> },
        { value: 'longest', label: 'Longest First', icon: <IconLayers size={14} /> },
        { value: 'shortest', label: 'Shortest First', icon: <IconMinimize size={14} /> },
    ]

    const currentOption = options.find(opt => opt.value === sortMode) || options[0]

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false)
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('keydown', handleKeyDown)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen])

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 h-9 px-3 rounded-lg transition-all duration-200 ${
                    isOpen 
                    ? 'bg-surface-700 border-brand-500/30 text-brand-400 shadow-lg shadow-brand-500/5' 
                    : 'bg-surface-800/50 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:bg-surface-700/50 hover:text-gray-300'
                }`}
            >
                <IconSort size={15} className={isOpen ? 'text-brand-400' : 'text-gray-500'} />
                <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{currentOption.label}</span>
                <IconChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute top-full mt-2 right-0 w-48 bg-surface-800 border border-white/10 rounded-xl p-1.5"
                    >
                        <div className="px-2 py-1 mb-1">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Sort By</span>
                        </div>
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setSortMode(opt.value)
                                    setIsOpen(false)
                                }}
                                className={`w-full flex items-center justify-between my-1 px-3 py-2 rounded-lg text-[12px] transition-all duration-150 ${
                                    sortMode === opt.value
                                    ? 'bg-brand-500/10 text-brand-400'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className={`transition-colors ${sortMode === opt.value ? 'text-brand-400' : 'text-gray-500'}`}>
                                        {opt.icon}
                                    </span>
                                    <span className="font-medium">{opt.label}</span>
                                </div>
                                {sortMode === opt.value && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', damping: 15 }}
                                    >
                                        <IconCheck size={14} className="text-brand-400" />
                                    </motion.div>
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default SortDropdown
