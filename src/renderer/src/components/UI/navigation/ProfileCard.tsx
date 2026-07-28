import React, { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronUp,
  LogOut,
  Ticket,
  ArrowRightLeft,
  Heart
} from 'lucide-react'
import { Account } from '@renderer/types'
import { useAccountsManager, useAccountStats } from '../../../features/auth/api/useAccounts'
import { formatNumber } from '@renderer/utils/numberUtils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../display/Tooltip'
import { useClickOutside } from '../../../hooks/useClickOutside'
import { RobuxIcon } from '@renderer/components/UI/icons/RobuxIcon'
import { SlidingNumber } from '@renderer/components/UI/specialized/SlidingNumber'
import CreditsDialog from '../dialogs/CreditsDialog'
import RedeemCodeDialog from '../dialogs/RedeemCodeDialog'

export interface ProfileCardProps {
  account: Account
  selectedAccounts?: Account[]
  isCollapsed: boolean
  privacyMode: boolean
  onTransactionsClick: () => void
  direction?: 'up' | 'down'
  variant?: 'sidebar' | 'topnav'
}

export const ProfileCard = ({
  account,
  selectedAccounts = [],
  isCollapsed,
  privacyMode,
  onTransactionsClick,
  direction = 'up',
  variant = 'sidebar'
}: ProfileCardProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCreditsOpen, setIsCreditsOpen] = useState(false)
  const [isRedeemOpen, setIsRedeemOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { removeAccount } = useAccountsManager()
  const { data: accountStats } = useAccountStats(account.cookie)

  // Calculate total robux balance across selected accounts if multiple are selected
  const robuxBalance = useMemo(() => {
    if (selectedAccounts.length > 1) {
      return selectedAccounts.reduce((total, acc) => total + (acc.robuxBalance || 0), 0)
    }
    return accountStats?.robuxBalance ?? account.robuxBalance
  }, [selectedAccounts, accountStats?.robuxBalance, account.robuxBalance])

  const isMultiSelect = selectedAccounts.length > 1

  useClickOutside(containerRef, () => setIsDropdownOpen(false))

  const handleCardClick = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleSignOut = () => {
    removeAccount(account.id)
    setIsDropdownOpen(false)
  }

  const dropdownGroups = [
    // Roblox Account Actions
    [
      {
        icon: ArrowRightLeft,
        label: 'Transactions',
        onClick: () => {
          onTransactionsClick()
          setIsDropdownOpen(false)
        }
      },
      {
        icon: Ticket,
        label: 'Redeem Code',
        onClick: () => {
          setIsRedeemOpen(true)
          setIsDropdownOpen(false)
        }
      }
    ],
    // App Actions
    [
      {
        icon: Heart,
        label: 'Credits',
        onClick: () => {
          setIsCreditsOpen(true)
          setIsDropdownOpen(false)
        }
      }
    ],
    // Session Actions
    [
      {
        icon: LogOut,
        label: 'Sign out',
        onClick: handleSignOut,
        danger: true
      }
    ]
  ]
  
  // Animation properties based on direction
  const dropdownVariants = {
    initial: { opacity: 0, y: direction === 'up' ? 8 : -8, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: direction === 'up' ? 8 : -8, scale: 0.95 }
  }
  
  const dropdownPositionClasses = direction === 'up' 
    ? 'bottom-full mb-2' 
    : 'top-full mt-2'

  // Collapsed state - just show avatar with tooltip
  if (isCollapsed) {
    // ── TopNav pill variant ──────────────────────────────────────────
    if (variant === 'topnav') {
      const displayLabel = isMultiSelect
        ? `${selectedAccounts.length} Accounts`
        : privacyMode ? '••••••' : (account.displayName || account.username)

      return (
        <>
          <div className="relative" ref={containerRef}>
            <button
              onClick={handleCardClick}
              style={{ borderRadius: 'var(--control-radius)' }}
              className={`flex items-center gap-0 border transition-all duration-200 group ${
                isDropdownOpen
                  ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-hover)] shadow-md'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]'
              }`}
            >
              {/* Name pill left */}
              <span
                className="pl-3 pr-1.5 text-xs font-semibold text-[var(--color-text-primary)] whitespace-nowrap tracking-tight"
                style={privacyMode ? { filter: 'blur(10px)' } : undefined}
              >
                {displayLabel}
              </span>

              {/* Avatar right */}
              <img
                className={`h-7 w-7 bg-[var(--color-surface)] object-cover border-2 m-0.5 transition-all duration-200 flex-shrink-0 ${
                  isDropdownOpen
                    ? 'border-[var(--accent-color-border)]'
                    : 'border-[var(--color-border)] group-hover:border-[var(--color-border-strong)]'
                }`}
                src={account.avatarUrl}
                alt={privacyMode ? '' : account.displayName}
                style={{
                  borderRadius: 'calc(var(--control-radius) - 2px)',
                  ...(privacyMode ? { filter: 'blur(16px)' } : {})
                }}
              />
            </button>

            {/* TopNav Dropdown */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={dropdownVariants}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className={`absolute right-0 left-auto w-56 bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-[var(--menu-radius)] shadow-2xl z-50 overflow-hidden ${dropdownPositionClasses}`}
                >
                  {/* Mini profile header */}
                  <div className="p-3 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-2.5">
                      <img
                        className="h-8 w-8 rounded-full bg-[var(--color-surface)] object-cover border border-[var(--color-border)]"
                        src={account.avatarUrl}
                        alt={privacyMode ? '' : account.displayName}
                        style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-semibold text-sm text-[var(--color-text-primary)] truncate"
                          style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                        >
                          {isMultiSelect ? `${selectedAccounts.length} Accounts` : account.displayName}
                        </div>
                        <div
                          className="text-[var(--color-text-muted)] text-xs truncate"
                          style={privacyMode && !isMultiSelect ? { filter: 'blur(16px)' } : undefined}
                        >
                          {isMultiSelect ? 'Multiple Selected' : `@${account.username}`}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    {dropdownGroups.map((group, groupIndex) => (
                      <div
                        key={groupIndex}
                        className={
                          groupIndex > 0 ? 'mt-1 pt-1 border-t border-[var(--color-border)]' : ''
                        }
                      >
                        {group.map((item, index) => (
                          <button
                            key={index}
                            onClick={item.onClick}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-[calc(var(--menu-radius)-6px)] transition-colors ${
                              item.danger
                                ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
                            }`}
                          >
                            <item.icon size={16} />
                            <span className="font-medium">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <CreditsDialog isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />
          <RedeemCodeDialog
            isOpen={isRedeemOpen}
            onClose={() => setIsRedeemOpen(false)}
            account={account}
          />
        </>
      )
    }

    // ── Default sidebar collapsed (avatar only) ──────────────────────
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="px-3 py-3" ref={containerRef}>
              <button
                onClick={handleCardClick}
                className="relative w-full flex justify-center group"
              >
                <img
                  className={`h-10 w-10 rounded-full bg-[var(--color-surface)] object-cover border-2 transition-all duration-200 ${
                    isDropdownOpen
                      ? 'border-[var(--color-border-strong)] ring-2 ring-[var(--focus-ring)]'
                      : 'border-[var(--color-border)] group-hover:border-[var(--color-border-strong)]'
                  }`}
                  src={account.avatarUrl}
                  alt={privacyMode ? '' : account.displayName}
                  style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                />
              </button>

              {/* Collapsed Dropdown */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={dropdownVariants}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className={`absolute right-0 left-auto w-56 bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-[var(--menu-radius)] shadow-2xl z-50 overflow-hidden ${dropdownPositionClasses}`}
                  >
                    {/* Mini profile header */}
                    <div className="p-3 border-b border-[var(--color-border)]">
                      <div className="flex items-center gap-2.5">
                        <img
                          className="h-8 w-8 rounded-full bg-[var(--color-surface)] object-cover border border-[var(--color-border)]"
                          src={account.avatarUrl}
                          alt={privacyMode ? '' : account.displayName}
                          style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                        />
                        <div className="flex-1 min-w-0">
                          <div 
                            className="font-semibold text-sm text-[var(--color-text-primary)] truncate"
                            style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                          >
                            {isMultiSelect ? `${selectedAccounts.length} Accounts` : account.displayName}
                          </div>
                          <div 
                            className="text-[var(--color-text-muted)] text-xs truncate"
                            style={privacyMode && !isMultiSelect ? { filter: 'blur(16px)' } : undefined}
                          >
                            {isMultiSelect ? 'Multiple Selected' : `@${account.username}`}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-sm">
                        <RobuxIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <SlidingNumber
                          number={robuxBalance}
                          formatter={formatNumber}
                          className="font-semibold text-[var(--color-text-primary)]"
                        />
                      </div>
                    </div>
                    <div className="p-1.5">
                      {dropdownGroups.map((group, groupIndex) => (
                        <div
                          key={groupIndex}
                          className={
                            groupIndex > 0 ? 'mt-1 pt-1 border-t border-[var(--color-border)]' : ''
                          }
                        >
                          {group.map((item, index) => (
                            <button
                              key={index}
                              onClick={item.onClick}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-[calc(var(--menu-radius)-6px)] transition-colors ${
                                item.danger
                                  ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
                              }`}
                            >
                              <item.icon size={16} />
                              <span className="font-medium">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isMultiSelect ? `${selectedAccounts.length} Accounts` : (privacyMode ? 'Hidden' : account.displayName)}
          </TooltipContent>
        </Tooltip>
        <CreditsDialog isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />
        <RedeemCodeDialog
          isOpen={isRedeemOpen}
          onClose={() => setIsRedeemOpen(false)}
          account={account}
        />
      </>
    )
  }

  // Expanded state
  return (
    <div className="px-3 py-3 relative" ref={containerRef}>
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={dropdownVariants}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute left-3 right-3 bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-[var(--menu-radius)] shadow-2xl z-50 overflow-hidden ${dropdownPositionClasses}`}
          >
            <div className="p-1.5">
              {dropdownGroups.map((group, groupIndex) => (
                <div
                  key={groupIndex}
                  className={
                    groupIndex > 0 ? 'mt-1 pt-1 border-t border-[var(--color-border)]' : ''
                  }
                >
                  {group.map((item, index) => (
                    <button
                      key={index}
                      onClick={item.onClick}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-[calc(var(--menu-radius)-6px)] transition-colors ${
                        item.danger
                          ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      <item.icon size={16} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Card */}
      <button
        onClick={handleCardClick}
        className={`w-full rounded-xl border transition-all duration-200 text-left ${
          isDropdownOpen
            ? 'border-[var(--accent-color-border)] bg-[rgba(var(--accent-color-rgb),0.08)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]'
        }`}
      >
        <div className="p-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <img
                className={`h-10 w-10 rounded-full bg-[var(--color-surface)] object-cover border-2 transition-all duration-200 ${
                  isDropdownOpen
                    ? 'border-[var(--color-border-strong)]'
                    : 'border-[var(--color-border)]'
                }`}
                src={account.avatarUrl}
                alt={privacyMode ? '' : account.displayName}
                style={privacyMode ? { filter: 'blur(16px)' } : undefined}
              />
            </div>

            {/* Name, username, and robux */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div 
                    className="font-semibold text-sm text-[var(--color-text-primary)] truncate"
                    style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                  >
                    {isMultiSelect ? `${selectedAccounts.length} Accounts` : account.displayName}
                  </div>
                  <div 
                    className="text-[var(--color-text-muted)] text-xs truncate"
                    style={privacyMode && !isMultiSelect ? { filter: 'blur(16px)' } : undefined}
                  >
                    {isMultiSelect ? 'Multiple Selected' : `@${account.username}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <RobuxIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <SlidingNumber
                    number={robuxBalance}
                    formatter={formatNumber}
                    className="text-sm font-semibold text-[var(--color-text-primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Chevron indicator */}
            <div
              className={`flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? '' : 'rotate-180'}`}
            >
              <ChevronUp size={16} className="text-[var(--color-text-muted)]" />
            </div>
          </div>
        </div>
      </button>
      <CreditsDialog isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />
      <RedeemCodeDialog
        isOpen={isRedeemOpen}
        onClose={() => setIsRedeemOpen(false)}
        account={account}
      />
    </div>
  )
}
