import { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { Tooltip, TooltipTrigger, TooltipContent } from '../display/Tooltip'
import { cn } from '../../../lib/utils'

interface SidebarItemProps {
  icon: LucideIcon
  label: string
  isActive: boolean
  isCollapsed: boolean
  onClick: () => void
  count?: number
  disableLayoutAnimation?: boolean
}

const SidebarItem = ({
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  onClick,
  count,
  disableLayoutAnimation = false
}: SidebarItemProps) => {
  const shouldAnimateLayout = !disableLayoutAnimation && !isCollapsed
  const layoutProp = shouldAnimateLayout ? 'position' : false
  const layoutTransition = shouldAnimateLayout ? { layout: { duration: 0.18 } } : undefined

  const content = (
    <motion.button
      layout={layoutProp}
      transition={layoutTransition}
      onMouseDown={onClick}
      className={cn(
        'relative group w-full flex items-center py-2.5 mb-0.5 rounded-lg mx-2 transition-all duration-200',
        isCollapsed ? 'justify-center px-0 w-auto mx-2' : 'px-3 gap-3',
        isActive
          ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
      )}
      style={
        isCollapsed
          ? { width: 'calc(100% - 16px)' }
          : { width: 'calc(100% - 16px)' }
      }
    >
      {/* Active indicator bar */}
      {isActive && (
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent-color)] rounded-r-full"
          initial={{ opacity: 0, scaleY: 0.5 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0.5 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {/* Icon */}
      <motion.div
        animate={{ scale: isActive ? 1.08 : 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 shrink-0"
      >
        <Icon
          size={18}
          strokeWidth={isActive ? 2.25 : 1.85}
          className={cn(
            'transition-colors duration-200',
            isActive ? 'text-[var(--accent-color)]' : ''
          )}
        />
      </motion.div>

      {/* Label */}
      <span
        className={cn(
          'font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 origin-left relative z-10 flex items-center gap-2',
          isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
        )}
      >
        {label}
        {count !== undefined && !isCollapsed && (
          <span className="text-xs font-normal text-[var(--color-text-muted)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded-md border border-[var(--color-border)]">
            {count}
          </span>
        )}
      </span>
    </motion.button>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
          {count !== undefined && ` (${count})`}
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

export default SidebarItem
