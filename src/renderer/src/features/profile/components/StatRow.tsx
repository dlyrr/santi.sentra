import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/UI/display/Tooltip'

interface StatRowProps {
  label: string
  value: string | React.ReactNode
  icon: any
  onClick?: () => void
  title?: string
  ariaLabel?: string
}

export const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  icon: Icon,
  onClick,
  title,
  ariaLabel
}) => {
  const isInteractive = typeof onClick === 'function'

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.()
    }
  }

  const content = (
    <div
      className={`group flex items-center justify-between py-2.5 px-3 -mx-3 rounded-xl transition-colors duration-200 ${
        isInteractive
          ? 'cursor-pointer hover:bg-white/5 active:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/20 outline-none'
          : 'hover:bg-white/5'
      }`}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel || (typeof value === 'string' ? `${label}: ${value}` : label)}
    >
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-primary)]/50 group-hover:text-[var(--color-text-primary)] group-hover:bg-white/10 transition-colors duration-200">
          <Icon size={14} className="opacity-80" />
        </div>
        <span className="text-sm font-medium text-[var(--color-text-primary)]/60 group-hover:text-[var(--color-text-primary)]/90 transition-colors duration-200">
          {label}
        </span>
      </div>
      <div className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
        {value}
      </div>
    </div>
  )

  if (!title) {
    return content
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  )
}
