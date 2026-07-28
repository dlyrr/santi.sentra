import React, { forwardRef, useCallback, useMemo, useContext, createContext, useState } from 'react'
import { Copy, Info, Check, Clock, Star } from 'lucide-react'
import { Account } from '@renderer/types'
import CustomCheckbox from '@renderer/components/UI/buttons/CustomCheckbox'
import StatusBadge from '@renderer/components/UI/display/StatusBadge'
import { getStatusBorderColor, getStatusColor } from '@renderer/utils/statusUtils'
import { timeAgo } from '@renderer/utils/timeUtils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/UI/display/Tooltip'
import { TableVirtuoso, TableComponents } from 'react-virtuoso'

// Context for row-level handlers
interface AccountRowContext {
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onMenuOpen: (e: React.MouseEvent, id: string) => void
  onInfoOpen: (e: React.MouseEvent, account: Account) => void
  onMoveAccount?: (fromId: string, toId: string) => void
  handleDragStart: (e: React.DragEvent, id: string) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent, targetId: string) => void
  voiceBanInfo?: Record<string, { message: string; endsAt?: number }>
  privacyMode?: boolean
}

const AccountRowContext = createContext<AccountRowContext | null>(null)

interface AccountListViewProps {
  accounts: Account[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onMenuOpen: (e: React.MouseEvent, id: string) => void
  onInfoOpen: (e: React.MouseEvent, account: Account) => void
  onMoveAccount?: (fromId: string, toId: string) => void
  voiceBanInfo?: Record<string, { message: string; endsAt?: number }>
  privacyMode?: boolean
}

const CopyUserIdButton = ({ userId }: { userId: string }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="pressable ml-1.5 text-[var(--color-text-muted)] opacity-0 group-hover/id:opacity-100 hover:text-[var(--color-text-primary)] transition-all"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  )
}



const AccountListView = ({
  accounts,
  selectedIds,
  onToggleSelect,
  onMenuOpen,
  onInfoOpen,
  onMoveAccount,
  voiceBanInfo,
  privacyMode
}: AccountListViewProps) => {
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
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

  const rowContext = useMemo<AccountRowContext>(
    () => ({
      selectedIds,
      onToggleSelect,
      onMenuOpen,
      onInfoOpen,
      onMoveAccount,
      handleDragStart,
      handleDragOver,
      handleDrop,
      voiceBanInfo,
      privacyMode
    }),
    [
      selectedIds,
      onToggleSelect,
      onMenuOpen,
      onInfoOpen,
      onMoveAccount,
      handleDragStart,
      handleDragOver,
      handleDrop,
      voiceBanInfo,
      privacyMode
    ]
  )

  // Memoize itemContent to prevent re-renders of all rows when selection changes
  const itemContent = useCallback(
    (_index: number, account: Account) => {
      const isSelected = selectedIds instanceof Set ? selectedIds.has(account.id) : false
      const ctx = rowContext
      return (
        <>
          {/* Checkbox */}
          <td
            className="px-4 py-2 whitespace-nowrap w-12"
            onClick={(e) => e.stopPropagation()}
          >
            <CustomCheckbox
              checked={isSelected}
              onChange={() => onToggleSelect(account.id)}
            />
          </td>

          {/* Account identity */}
          <td className="px-4 py-2 whitespace-nowrap">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 flex-shrink-0 relative">
                <img
                  className="h-8 w-8 rounded-full bg-[var(--color-surface-hover)] object-cover ring-1 ring-[var(--color-border)] group-hover:ring-[var(--color-border-strong)] transition-all duration-150"
                  src={account.avatarUrl}
                  alt=""
                  style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                />
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
              <div>
                <div
                  className={[
                    'text-sm font-semibold flex items-center gap-1 transition-colors duration-150',
                    isSelected
                      ? 'text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
                  ].join(' ')}
                  style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                >
                  {account.displayName}
                  {account.age !== undefined && (
                    <span className="flex items-center gap-1 bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded text-[9px] font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0 ml-1" title={`${account.age} years old`}>
                      <Clock size={9} />
                      {account.age}y
                    </span>
                  )}
                  {account.isPremium && (
                    <span className="ml-0.5 inline-flex items-center justify-center rounded-[4px] border border-amber-400/25 bg-amber-500/10 px-0.5 py-[1px]">
                      <Star size={10} className="text-amber-300 shrink-0 select-none fill-current" />
                    </span>
                  )}
                  {account.cookieInvalid && (
                    <span className="ml-2 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                      Invalid Cookie
                    </span>
                  )}
                </div>
                <div
                  className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5"
                  style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                >
                  <span>@{account.username}</span>
                </div>
              </div>
            </div>
          </td>

          {/* User ID */}
          <td className="hidden md:table-cell px-4 py-2 whitespace-nowrap">
            <div className="flex items-center group/id">
              <span
                className="text-xs text-[var(--color-text-muted)] font-mono"
                style={privacyMode ? { filter: 'blur(16px)' } : undefined}
              >
                {account.userId}
              </span>
              <CopyUserIdButton userId={account.userId} />
            </div>
          </td>

          {/* Status */}
          <td className="px-4 py-2 whitespace-nowrap">
            <div className="flex flex-col items-start gap-1">
              <StatusBadge status={account.status} />
              {ctx.voiceBanInfo?.[account.id] && (
                <span className="text-[10px] text-red-400 leading-tight">
                  {ctx.voiceBanInfo[account.id].message}
                </span>
              )}
            </div>
          </td>

          {/* Last active */}
          <td className="hidden lg:table-cell px-4 py-2 whitespace-nowrap">
            <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <Clock size={11} strokeWidth={2} />
              <span>{timeAgo(account.lastActive)}</span>
            </div>
          </td>

          {/* Notes */}
          <td className="hidden md:table-cell px-4 py-2">
            <div className="text-xs text-[var(--color-text-muted)] min-w-[80px] break-words group-hover:text-[var(--color-text-secondary)] transition-colors">
              {account.notes || <span className="opacity-25 italic">—</span>}
            </div>
          </td>

          {/* Actions */}
          <td className="px-4 py-2 whitespace-nowrap text-right">
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => onInfoOpen(e, account)}
                    className="pressable text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 hover:bg-[var(--color-surface-hover)] rounded-md"
                  >
                    <Info size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Account Info</TooltipContent>
              </Tooltip>
            </div>
          </td>
        </>
      )
    },
    [selectedIds, onToggleSelect, onInfoOpen, privacyMode, rowContext]
  )

  const tableComponents = useMemo<TableComponents<Account, AccountRowContext>>(
    () => ({
      Table: ({ style, ...props }) => (
        <table
          style={style}
          className="min-w-full table-fixed text-sm border-separate border-spacing-y-0.5"
          {...props}
        />
      ),
      TableHead: forwardRef<HTMLTableSectionElement>((props, ref) => (
        <thead ref={ref} className="sticky top-0 z-10 bg-[var(--color-surface)] shadow-[0_1px_0_var(--color-border)]" {...props} />
      )),
      TableBody: forwardRef<HTMLTableSectionElement>((props, ref) => (
        <tbody ref={ref} className="" {...props} />
      )),
      TableRow: ({ item: account, ...props }) => {
        const ctx = useContext(AccountRowContext)!
        const isSelected = ctx.selectedIds instanceof Set ? ctx.selectedIds.has(account.id) : false
        return (
          <tr
            {...props}
            draggable={!!ctx.onMoveAccount}
            onDragStart={(e) => ctx.handleDragStart(e, account.id)}
            onDragOver={ctx.handleDragOver}
            onDrop={(e) => ctx.handleDrop(e, account.id)}
            className={[
              'group transition-colors duration-100 cursor-pointer rounded-lg overflow-hidden',
              isSelected
                ? 'bg-[var(--accent-color-faint)] ring-1 ring-[var(--accent-color-border)]'
                : 'hover:bg-[var(--color-surface-hover)]'
            ].join(' ')}
            onClick={() => ctx.onToggleSelect(account.id)}
            onContextMenu={(e) => ctx.onMenuOpen(e, account.id)}
          />
        )
      }
    }),
    []
  )

  return (
    <AccountRowContext.Provider value={rowContext}>
      <div className="h-full w-full custom-scrollbar">
        <TableVirtuoso
          data={accounts}
          context={rowContext}
          overscan={200}
          components={tableComponents}
          fixedHeaderContent={() => (
            <tr>
              <th
                scope="col"
                className="px-4 py-2 text-left w-12 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider"
              />
              <th
                scope="col"
                className="px-4 py-2 text-left font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider w-[28%]"
              >
                Account
              </th>
              <th
                scope="col"
                className="hidden md:table-cell px-4 py-2 text-left font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider w-[18%]"
              >
                ID
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-left font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider w-[15%]"
              >
                Status
              </th>
              <th
                scope="col"
                className="hidden lg:table-cell px-4 py-2 text-left font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider w-[12%]"
              >
                Last Seen
              </th>
              <th
                scope="col"
                className="hidden md:table-cell px-4 py-2 text-left font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider w-[20%]"
              >
                Notes
              </th>
              <th
                scope="col"
                className="px-4 py-2 font-semibold text-[var(--color-text-muted)] text-xs uppercase tracking-wider w-[7%]"
              >
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          )}
          itemContent={itemContent}
        />
      </div>
    </AccountRowContext.Provider>
  )
}

export default AccountListView
