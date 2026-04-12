import React from 'react'
import type { Tag } from '../types'

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
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-150 cursor-pointer select-none ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs'
      } ${
        active
          ? 'ring-2 ring-offset-1 ring-offset-surface-700 opacity-100'
          : 'opacity-75 hover:opacity-100'
      }`}
      style={{
        backgroundColor: tag.color + '22',
        color: tag.color,
        borderColor: tag.color + '44',
        border: '1px solid',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: tag.color }}
      />
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 hover:opacity-60 transition-opacity"
        >
          ×
        </button>
      )}
    </span>
  )
}

export default TagBadge
