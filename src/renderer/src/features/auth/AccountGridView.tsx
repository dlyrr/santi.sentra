import React, { useCallback } from 'react'
import { Info, Clock, Star } from 'lucide-react'
import { Account } from '@renderer/types'
import CustomCheckbox from '@renderer/components/UI/buttons/CustomCheckbox'
import StatusBadge from '@renderer/components/UI/display/StatusBadge'
import { getStatusBorderColor, getStatusColor } from '@renderer/utils/statusUtils'
import { timeAgo } from '@renderer/utils/timeUtils'
import { Card } from '@renderer/components/UI/display/Card'
import { Button } from '@renderer/components/UI/buttons/Button'
import { Avatar, AvatarImage, AvatarFallback } from '@renderer/components/UI/display/Avatar'
import { RobuxIcon } from '@renderer/components/UI/icons/RobuxIcon'
import { formatNumber } from '@renderer/utils/numberUtils'

interface AccountGridViewProps {
  accounts: Account[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onMenuOpen: (e: React.MouseEvent, id: string) => void
  onInfoOpen: (e: React.MouseEvent, account: Account) => void
  onMoveAccount?: (fromId: string, toId: string) => void
  voiceBanInfo?: Record<string, { message: string; endsAt?: number }>
  privacyMode?: boolean
}

// getAccountJoinYear removed because we use account.age directly now

const AccountGridView = ({
  accounts,
  selectedIds,
  onToggleSelect,
  onMenuOpen,
  onInfoOpen,
  onMoveAccount,
  voiceBanInfo,
  privacyMode
}: AccountGridViewProps) => {
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    ;(e.currentTarget as HTMLElement).setAttribute('data-dragging', 'true')
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    ;(e.currentTarget as HTMLElement).removeAttribute('data-dragging')
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (onMoveAccount) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }
    },
    [onMoveAccount]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      if (!onMoveAccount) return
      e.preventDefault()
      const sourceId = e.dataTransfer.getData('text/plain')
      if (sourceId && sourceId !== targetId) {
        onMoveAccount(sourceId, targetId)
      }
    },
    [onMoveAccount]
  )

  const isIdSelected = (id: string): boolean => selectedIds.has(id)

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 pb-4">
        {accounts.map((account) => {
          const isSelected = isIdSelected(account.id)
          const age = account.age
          return (
            <Card
              key={account.id}
              selected={isSelected}
              draggable={!!onMoveAccount}
              onDragStart={(e) => handleDragStart(e, account.id)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, account.id)}
              onClick={() => onToggleSelect(account.id)}
              onContextMenu={(e) => onMenuOpen(e, account.id)}
              className={[
                'relative group cursor-pointer overflow-hidden',
                'transition-[transform,box-shadow,border-color,background-color] duration-150',
                'hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-0.5',
                isSelected
                  ? 'border-[var(--accent-color-border)] shadow-[0_0_0_1px_var(--accent-color-border),0_2px_16px_var(--accent-color-ring)]'
                  : '',
                '[&[data-dragging]]:opacity-50 [&[data-dragging]]:scale-95'
              ].join(' ')}
            >
              {/* Gradient overlay on selected */}
              {isSelected && (
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color-faint)] to-transparent pointer-events-none z-0 rounded-xl" />
              )}

              {/* Top row: info + checkbox */}
              <div className="relative z-10 flex items-center justify-between px-2.5 pt-2.5 pb-0">
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onInfoOpen(e, account)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-md h-6 w-6"
                >
                  <Info size={12} />
                </Button>
                <div onClick={(e) => e.stopPropagation()}>
                  <CustomCheckbox
                    checked={isSelected}
                    onChange={() => onToggleSelect(account.id)}
                  />
                </div>
              </div>

              {/* Avatar + identity */}
              <div className="relative z-10 flex flex-col items-center text-center px-2.5 pt-2 pb-3">
                <div className="relative mb-2">
                  <Avatar
                    className="w-11 h-11 ring-2 ring-[var(--color-surface)] shadow-sm"
                    style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                  >
                    <AvatarImage src={account.avatarUrl} alt="" />
                    <AvatarFallback className="text-xs font-bold">
                      {account.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Status dot */}
                  <span
                    className={[
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 rounded-full',
                      getStatusBorderColor(account.status),
                      getStatusColor(account.status),
                      account.status === 'Online' || account.status === 'In-Game' || account.status === 'In Studio'
                        ? 'status-dot-pulse'
                        : ''
                    ].join(' ')}
                    style={{ borderColor: 'var(--color-surface)' }}
                  />
                </div>

                {/* Display name + age + premium */}
                <div className="flex items-center gap-1 mb-0.5 w-full justify-center">
                  <h3
                    className="text-xs font-bold truncate max-w-[90px] text-[var(--color-text-primary)]"
                    title={account.displayName}
                  >
                    {account.displayName}
                  </h3>
                  {account.isPremium && (
                    <span className="ml-0.5 inline-flex items-center justify-center rounded-[4px] border border-amber-400/25 bg-amber-500/10 px-0.5 py-[1px]">
                      <Star size={10} className="text-amber-300 shrink-0 select-none fill-current" />
                    </span>
                  )}
                  {age && (
                    <span
                      className="shrink-0 text-[8px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 leading-4"
                      title={`${age} years old`}
                    >
                      {age}y
                    </span>
                  )}
                </div>

                {account.cookieInvalid && (
                  <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 mb-0.5">
                    Invalid Cookie
                  </span>
                )}

                <p
                  className="text-[10px] text-[var(--color-text-muted)] mb-1.5 truncate w-full"
                  style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                >
                  @{account.username}
                </p>

                {/* Status */}
                <div className="mb-2">
                  <StatusBadge status={account.status} />
                  {voiceBanInfo?.[account.id] && (
                    <span className="text-[9px] text-red-400 block text-center mt-0.5">
                      {voiceBanInfo[account.id].message}
                    </span>
                  )}
                </div>

                {/* Bottom strip */}
                <div className="w-full pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[10px]">
                  {account.robuxBalance > 0 ? (
                    <div className="flex items-center gap-0.5">
                      <RobuxIcon className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      <span
                        className="font-semibold text-[var(--color-text-primary)]"
                        style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                      >
                        {formatNumber(account.robuxBalance)}
                      </span>
                    </div>
                  ) : (
                    <span
                      className="text-[var(--color-text-muted)] font-mono truncate max-w-[60px]"
                      style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                    >
                      {account.userId}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 text-[var(--color-text-muted)]">
                    <Clock size={9} strokeWidth={2} />
                    <span>{timeAgo(account.lastActive)}</span>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default AccountGridView
