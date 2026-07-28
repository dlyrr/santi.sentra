import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  HardDrive,
  EyeOff,
  Sliders,
  RotateCcw,
  Eye,
  ChevronUp,
  ChevronDown,
  Bell,
  Monitor
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Account, Settings, TabId } from '../../../types'
import { cn } from '../../../lib/utils'
import CustomCheckbox from '../../../components/UI/buttons/CustomCheckbox'
import CustomDropdown, { DropdownOption } from '../../../components/UI/menus/CustomDropdown'
import { Section, SettingsCard, ToggleRow } from './SharedComponents'
import { useInstallations } from '../../install/stores/useInstallationsStore'
import {
  DEFAULT_SIDEBAR_TAB_ORDER,
  LOCKED_SIDEBAR_TABS,
  sanitizeSidebarHidden,
  sanitizeSidebarOrder
} from '@shared/navigation'
import {
  SIDEBAR_TAB_DEFINITION_MAP,
  SidebarTabDefinition
} from '../../../constants/sidebarTabs'

interface GeneralSettingsTabProps {
  accounts: Account[]
  settings: Settings
  onUpdateSettings: (newSettings: Partial<Settings>) => void
}

const isMac = window.platform?.isMac ?? false

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  accounts,
  settings,
  onUpdateSettings
}) => {
  const installations = useInstallations()

  const sidebarTabOrder = useMemo(
    () => sanitizeSidebarOrder(settings.sidebarTabOrder),
    [settings.sidebarTabOrder]
  )
  const sidebarHiddenTabs = useMemo(
    () => sanitizeSidebarHidden(settings.sidebarHiddenTabs),
    [settings.sidebarHiddenTabs]
  )
  const sidebarTabs = useMemo(
    () =>
      sidebarTabOrder
        .map((tabId) => SIDEBAR_TAB_DEFINITION_MAP[tabId])
        .filter(Boolean) as SidebarTabDefinition[],
    [sidebarTabOrder]
  )
  const hiddenSidebarTabsSet = useMemo(() => new Set(sidebarHiddenTabs), [sidebarHiddenTabs])

  const accountOptions: DropdownOption[] = [
    { value: '', label: 'None' },
    ...accounts.map((account) => ({
      value: account.id,
      label: account.displayName,
      labelNode: settings.privacyMode ? (
        <span style={{ filter: 'blur(16px)' }}>{account.displayName}</span>
      ) : undefined,
      subLabel: `@${account.username}`,
      subLabelNode: settings.privacyMode ? (
        <span style={{ filter: 'blur(16px)' }}>@{account.username}</span>
      ) : undefined
    }))
  ]

  const installationOptions: DropdownOption[] = [
    { value: '', label: 'System Default' },
    ...installations.map((inst) => ({
      value: inst.path,
      label: inst.name,
      subLabel: inst.version.substring(0, 15) + '...'
    }))
  ]

  const { data: discordRPCEnabled = false, refetch: refetchDiscordRPC } = useQuery({
    queryKey: ['discordRPCEnabled'],
    queryFn: () => window.api.isDiscordRPCEnabled(),
    staleTime: 5000
  })

  const toggleDiscordRPC = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        await window.api.enableDiscordRPC()
      } else {
        await window.api.disableDiscordRPC()
      }
    },
    onSuccess: () => {
      refetchDiscordRPC()
    }
  })

  const handlePrimaryAccountChange = (value: string) => {
    onUpdateSettings({ primaryAccountId: value === '' ? null : value })
  }

  const handleDefaultInstallChange = (value: string) => {
    onUpdateSettings({ defaultInstallationPath: value === '' ? undefined : value })
  }

  const handleProfileCardToggle = () => {
    onUpdateSettings({ showSidebarProfileCard: !settings.showSidebarProfileCard })
  }

  const handlePrivacyModeToggle = () => {
    onUpdateSettings({ privacyMode: !settings.privacyMode })
  }

  const handleToggleTabVisibility = (tabId: TabId) => {
    if (LOCKED_SIDEBAR_TABS.includes(tabId)) return

    const nextHidden = hiddenSidebarTabsSet.has(tabId)
      ? sidebarHiddenTabs.filter((id) => id !== tabId)
      : [...sidebarHiddenTabs, tabId]

    onUpdateSettings({ sidebarHiddenTabs: nextHidden })
  }

  const handleMoveTab = (tabId: TabId, direction: number) => {
    const currentIndex = sidebarTabOrder.indexOf(tabId)
    if (currentIndex === -1) return

    const targetIndex = currentIndex + direction
    if (targetIndex < 0 || targetIndex >= sidebarTabOrder.length) return

    const nextOrder = [...sidebarTabOrder]
    const [moved] = nextOrder.splice(currentIndex, 1)
    nextOrder.splice(targetIndex, 0, moved)
    onUpdateSettings({ sidebarTabOrder: nextOrder })
  }

  const handleResetNavigation = () => {
    onUpdateSettings({
      sidebarTabOrder: DEFAULT_SIDEBAR_TAB_ORDER,
      sidebarHiddenTabs: []
    })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">General</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1.5 leading-relaxed">Configure your account preferences and application defaults.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Accounts & Launch */}
        <div className="col-span-2 flex items-center gap-3 pt-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Accounts & Launch</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        {/* Primary Account */}
        <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <Users size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Primary Account</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Auto-selected when the app starts.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
            <CustomDropdown options={accountOptions} value={settings.primaryAccountId || ''} onChange={handlePrimaryAccountChange} placeholder="Select primary account" />
          </div>
        </div>

        {/* Default Installation */}
        <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <HardDrive size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Default Installation</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Which Roblox client to launch games with.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
            <CustomDropdown options={installationOptions} value={settings.defaultInstallationPath || ''} onChange={handleDefaultInstallChange} placeholder="Select installation" />
          </div>
        </div>

        {/* Privacy & Integrations */}
        <div className="col-span-2 flex items-center gap-3 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Privacy & Integrations</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        {/* Privacy Mode */}
        <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <EyeOff size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Privacy Mode</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Blur account names and avatars for streaming.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">{settings.privacyMode ? 'Enabled' : 'Disabled'}</span>
            <button
              onClick={handlePrivacyModeToggle}
              className={cn('relative w-11 h-6 rounded-full border transition-all duration-300', settings.privacyMode ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-[var(--color-surface-hover)] border-[var(--color-border)]')}
            >
              <div className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300', settings.privacyMode ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>
        </div>

        {/* Discord RPC */}
        <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <Bell size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Discord Rich Presence</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Show your activity in Discord status.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {toggleDiscordRPC.isPending ? (discordRPCEnabled ? 'Disabling…' : 'Connecting…') : (discordRPCEnabled ? 'Connected' : 'Disconnected')}
            </span>
            <button
              onClick={() => toggleDiscordRPC.mutate(!discordRPCEnabled)}
              disabled={toggleDiscordRPC.isPending}
              className={cn('relative w-11 h-6 rounded-full border transition-all duration-300 disabled:opacity-50', discordRPCEnabled ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-[var(--color-surface-hover)] border-[var(--color-border)]')}
            >
              <div className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300', discordRPCEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="col-span-2 flex items-center gap-3 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Navigation</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        {/* Sidebar Profile Card */}
        <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <Users size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Sidebar Profile Card</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Show quick profile in the sidebar.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">{settings.showSidebarProfileCard ? 'Visible' : 'Hidden'}</span>
            <button
              onClick={handleProfileCardToggle}
              className={cn('relative w-11 h-6 rounded-full border transition-all duration-300', settings.showSidebarProfileCard ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-[var(--color-surface-hover)] border-[var(--color-border)]')}
            >
              <div className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300', settings.showSidebarProfileCard ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>
        </div>

        {/* Browser Window Size */}
        <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <Monitor size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Browser Window Size</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Default size for in-app browser windows.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex gap-3">
            <div className="flex flex-col flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] mb-1.5 font-medium uppercase tracking-wider">Width (px)</label>
              <input type="number" min={200} max={3840} value={settings.browserWindowWidth ?? ''} onChange={(e) => onUpdateSettings({ browserWindowWidth: e.target.value === '' ? null : Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-colors" />
            </div>
            <div className="flex flex-col flex-1">
              <label className="text-[10px] text-[var(--color-text-muted)] mb-1.5 font-medium uppercase tracking-wider">Height (px)</label>
              <input type="number" min={200} max={2160} value={settings.browserWindowHeight ?? ''} onChange={(e) => onUpdateSettings({ browserWindowHeight: e.target.value === '' ? null : Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-colors" />
            </div>
          </div>
        </div>

        {/* Sidebar Tabs — full width */}
        <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center justify-between mb-4 z-10 relative">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                <Sliders size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Sidebar Tabs</h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Hide and reorder tabs to match your workflow.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetNavigation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
          <div className="pt-4 border-t border-[var(--color-border)] z-10 relative">
            <div className="space-y-2 max-h-[280px] overflow-y-auto styled-scrollbar -mr-1 pr-1">
              {sidebarTabs.map((tab, index) => {
                const isHidden = hiddenSidebarTabsSet.has(tab.id)
                const isLocked = LOCKED_SIDEBAR_TABS.includes(tab.id)
                const Icon = tab.icon
                return (
                  <div key={tab.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <CustomCheckbox checked={!isHidden || isLocked} disabled={isLocked} onChange={() => handleToggleTabVisibility(tab.id)} />
                      <Icon size={15} className="text-[var(--color-text-secondary)] flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{tab.label}</div>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                          {isLocked ? <span className="text-[var(--accent-color)] font-medium">Always visible</span> : isHidden ? <><EyeOff size={11} />Hidden</> : <><Eye size={11} />Visible</>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => handleMoveTab(tab.id, -1)} disabled={index === 0} className="p-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label={`Move ${tab.label} up`}><ChevronUp size={13} /></button>
                      <button type="button" onClick={() => handleMoveTab(tab.id, 1)} disabled={index === sidebarTabs.length - 1} className="p-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label={`Move ${tab.label} down`}><ChevronDown size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  )
}
