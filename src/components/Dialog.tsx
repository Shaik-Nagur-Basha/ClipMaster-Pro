import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { IconX } from './Icons'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  maxWidth?: string
  contentClassName?: string
  headerAction?: React.ReactNode
  headerActionRight?: React.ReactNode
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
  headerActionRight,
  paddingClassName = 'px-6 py-6',
  overflowVisible = false
}) => {
  if (typeof document === 'undefined') return null

  return createPortal(
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
                  {typeof title === 'string' ? (
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h3>
                  ) : (
                    title
                  )}
                  {headerAction}
                </div>
                <div className="flex items-center gap-3">
                  {headerActionRight}
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <IconX size={18} />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className={`${paddingClassName} min-h-0 ${overflowVisible ? 'overflow-visible' : 'overflow-y-auto'} ${contentClassName}`}>
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default Dialog
