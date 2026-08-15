import { useMemo } from 'react'
import type { JSX } from 'react'
import { Grid, List, UserPlus, Users, Gamepad2, Wifi, WifiOff, Wrench, User, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import CustomCheckbox from '@renderer/components/UI/buttons/CustomCheckbox'
import { AccountStatus } from '@renderer/types'
import { Button } from '@renderer/components/UI/buttons/Button'
import CustomDropdown, { DropdownOption } from '@renderer/components/UI/menus/CustomDropdown'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/UI/display/Tooltip'
import { SearchInput } from '@renderer/components/UI/inputs/SearchInput'

interface AccountsToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filteredAccountsCount: number
  selectedCount: number
  viewMode: 'list' | 'grid'
  onViewModeToggle: () => void
  statusFilter: AccountStatus | 'All'
  onStatusFilterChange: (status: AccountStatus | 'All') => void
  onAddAccount: () => void
  onToggleSelectAll?: () => void
  allSelected?: boolean
  isIndeterminate?: boolean
  totalRobux: number
  onBulkSettingsClick?: () => void
  onValidateAccountsClick?: () => void
  isValidating?: boolean
  validationProgress?: { current: number, total: number } | null
  validationStatus?: 'validating' | 'ratelimited' | null
}

const statusIcons: Record<AccountStatus, JSX.Element> = {
  [AccountStatus.Online]: <Wifi size={16} className="text-blue-500" />,
  [AccountStatus.InGame]: <Gamepad2 size={16} className="text-emerald-500" />,
  [AccountStatus.InStudio]: <Wrench size={16} className="text-orange-500" />,
  [AccountStatus.Offline]: <WifiOff size={16} className="text-[var(--color-text-muted)]" />,
  [AccountStatus.Banned]: <User size={16} className="text-red-500" />
}

const AccountsToolbar = ({
  searchQuery,
  onSearchChange,
  filteredAccountsCount,
  selectedCount,
  viewMode,
  onViewModeToggle,
  statusFilter,
  onStatusFilterChange,
  onAddAccount,
  onToggleSelectAll,
  allSelected,
  isIndeterminate,
  totalRobux,
  onBulkSettingsClick,
  onValidateAccountsClick,
  isValidating,
  validationProgress,
  validationStatus
}: AccountsToolbarProps) => {
  const filterOptions: DropdownOption[] = useMemo(() => {
    return [
      {
        value: 'All',
        label: 'All',
        icon: <Users size={16} className="text-[var(--color-text-secondary)]" />
      },
      ...Object.values(AccountStatus).map((status) => ({
        value: status,
        label: status,
        icon: statusIcons[status as AccountStatus]
      }))
    ]
  }, [])

  return (
    <div className="shrink-0 h-[64px] bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-6 gap-4 z-20">
      {/* Left: Title + Select All + counts */}
      <div className="flex items-center gap-4 shrink-0">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-none tracking-tight">Accounts</h1>
        <div className="w-px h-4 bg-[var(--color-border)]" />
        
        {onToggleSelectAll && (
          <div className="ml-0.5">
            <CustomCheckbox
              checked={!!allSelected}
              indeterminate={!!isIndeterminate}
              onChange={onToggleSelectAll}
            />
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {/* Account count */}
          <span className="flex items-center justify-center px-2 py-0.5 rounded-md bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-muted)]">
            {selectedCount > 0 ? selectedCount : filteredAccountsCount}
          </span>
          {/* Total robux */}
          {totalRobux > 0 && (
            <span className="flex items-center justify-center px-2 py-0.5 rounded-md bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-[11px] font-semibold text-emerald-400 gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 -rotate-12">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="10" y="10" width="4" height="4" rx="0.5" />
              </svg>
              {totalRobux.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Right: search + controls */}
      <div className="flex items-center gap-2 shrink-0 flex-1 justify-end min-w-0">
        {/* Bulk Actions - Only show if > 0 accounts selected */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-1.5 mr-2 shrink-0">
            {isValidating ? (
              <div className="flex flex-col gap-1 shrink-0">
                <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 backdrop-blur-md min-w-[200px] relative overflow-hidden shadow-[inset_0_0_12px_rgba(16,185,129,0.1)]">
                  <AnimatePresence>
                    {validationProgress && (
                      <motion.div
                        className={`absolute left-0 top-0 bottom-0 ${validationStatus === 'ratelimited' ? 'bg-amber-500/40' : 'bg-emerald-500/40'}`}
                        initial={{ width: '0%' }}
                        animate={{ width: `${(validationProgress.current / validationProgress.total) * 100}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    )}
                  </AnimatePresence>
                  <div className="relative z-10 flex items-center gap-2 w-full justify-between">
                    <Loader2 size={13} className={`animate-spin shrink-0 ${validationStatus === 'ratelimited' ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <span className={`text-xs font-semibold font-mono truncate ${validationStatus === 'ratelimited' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {validationStatus === 'ratelimited'
                        ? 'Rate limited. Waiting...'
                        : validationProgress
                          ? `Validating ${validationProgress.current}/${validationProgress.total}`
                          : 'Validating...'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={onValidateAccountsClick} className="gap-2 h-9 px-3 shrink-0 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-shadow duration-200">
                <Wifi size={16} />
                <span className="text-sm">Validate All</span>
              </Button>
            )}
          </div>
        )}

        {/* Add Account */}
        <Button variant="default" onClick={onAddAccount} className="gap-2 h-9 px-3 shrink-0 mr-1 shadow-sm hover:shadow-[0_0_12px_var(--accent-color-ring)] transition-shadow duration-200">
          <UserPlus size={16} />
          <span className="text-sm font-semibold">Add Account</span>
        </Button>

        {/* Search — uses the SearchInput component with built-in clear button */}
        <div className="relative flex-1 max-w-xs">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search accounts…"
            containerClassName="w-full"
            className="h-9 text-sm bg-[var(--color-surface)] border-[var(--color-border)] focus:border-[var(--accent-color-border)] focus:ring-1 focus:ring-[var(--accent-color-ring)] transition-all placeholder:text-[var(--color-text-muted)]"
          />
          {/* ⌘K hint — only shown when input is empty */}
          {!searchQuery && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
              <kbd className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded px-1 py-0.5 leading-none">
                ⌘K
              </kbd>
            </div>
          )}
        </div>

        {/* View Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onViewModeToggle}
              className="h-9 w-9 shrink-0"
            >
              {viewMode === 'list' ? <Grid size={17} /> : <List size={17} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {viewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
          </TooltipContent>
        </Tooltip>

        {/* Status Filter */}
        <CustomDropdown
          options={filterOptions}
          value={statusFilter}
          onChange={(value) => onStatusFilterChange(value as AccountStatus | 'All')}
          placeholder="Filter"
          className="w-36 shrink-0"
        />
      </div>
    </div>
  )
}

export default AccountsToolbar
