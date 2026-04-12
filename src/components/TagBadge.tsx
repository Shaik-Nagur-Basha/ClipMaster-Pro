import React from 'react'
import type { Tag } from '../types'
import { IconX } from './Icons'

interface Props {
  tag: Tag
  size?: 'sm' | 'md'
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
}

const TagBadge: React.FC<Props> = ({ tag, size = 'md', onRemove, onClick, active }) => {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold tracking-tight transition-all duration-150 cursor-pointer select-none border border-transparent active:scale-95 min-w-0 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      } ${
        active
          ? 'ring-2 ring-offset-2 ring-offset-surface-900 border-opacity-50 opacity-100'
          : 'opacity-80 hover:opacity-100 bg-surface-800'
      }`}
      style={{
        backgroundColor: tag.color + '15',
        color: tag.color,
        borderColor: tag.color + '30',
      }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm"
        style={{ backgroundColor: tag.color }}
      />
      <span className="truncate max-w-[100px]">{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 p-0.5 rounded-sm hover:bg-black/20 text-current transition-colors"
          title="Remove tag"
        >
          <IconX size={size === 'sm' ? 10 : 12} />
        </button>
      )}
    </span>
  )
}

export default TagBadge
