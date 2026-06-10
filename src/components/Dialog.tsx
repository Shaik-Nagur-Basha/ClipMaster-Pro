import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconX } from './Icons'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
  contentClassName?: string
  headerAction?: React.ReactNode
  paddingClassName?: string
  overflowVisible?: boolean
}

const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  contentClassName = 'dialog-scrollbar',
  headerAction,
  paddingClassName = 'px-6 py-6',
  overflowVisible = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          />
          
          {/* Dialog Container */}
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`w-full ${maxWidth} max-h-[85vh] md:max-h-[90vh] bg-surface-800 border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto flex flex-col ${
                overflowVisible ? 'overflow-visible' : 'overflow-hidden'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h3>
                  {headerAction}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                >
                  <IconX size={18} />
                </button>
              </div>
              
              {/* Content */}
              <div className={`${paddingClassName} min-h-0 overflow-y-auto ${contentClassName}`}>
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default Dialog
