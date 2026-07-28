import React, { useState } from 'react'
import { Sliders, Type, Bell, Shield, Info } from 'lucide-react'
import { motion } from 'framer-motion'
import { Account, Settings } from '../../types'
import { cn } from '../../lib/utils'

import { GeneralSettingsTab } from './components/GeneralSettingsTab'
import { AppearanceSettingsTab } from './components/AppearanceSettingsTab'
import { NotificationsSettingsTab } from './components/NotificationsSettingsTab'
import { SecuritySettingsTab } from './components/SecuritySettingsTab'
import { AboutSettingsTab } from './components/AboutSettingsTab'

interface SettingsTabProps {
  accounts: Account[]
  settings: Settings
  onUpdateSettings: (newSettings: Partial<Settings>) => void
}

const SettingsTab: React.FC<SettingsTabProps> = ({ accounts, settings, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<
    'general' | 'appearance' | 'notifications' | 'security' | 'about'
  >('general')

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
      <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] flex items-center justify-between px-6 z-20">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Settings</h2>
      </div>

      {/* Tabs Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex">
            {/* Animated sliding indicator */}
            <motion.div
              className="absolute bottom-0 h-0.5 bg-[var(--accent-color)] z-20"
              initial={false}
              animate={{
                left:
                  activeTab === 'general'
                    ? '0%'
                    : activeTab === 'appearance'
                      ? '20%'
                      : activeTab === 'notifications'
                        ? '40%'
                        : activeTab === 'security'
                          ? '60%'
                          : '80%',
                width: '20%'
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />

            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                'flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]',
                activeTab === 'general'
                  ? 'text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Sliders size={16} />
              General
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={cn(
                'flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]',
                activeTab === 'appearance'
                  ? 'text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Type size={16} />
              Appearance
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={cn(
                'flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]',
                activeTab === 'notifications'
                  ? 'text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Bell size={16} />
              Notifications
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={cn(
                'flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]',
                activeTab === 'security'
                  ? 'text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Shield size={16} />
              Security
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={cn(
                'flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]',
                activeTab === 'about'
                  ? 'text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Info size={16} />
              About
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="max-w-3xl mx-auto pb-8">
          {activeTab === 'general' && (
            <GeneralSettingsTab accounts={accounts} settings={settings} onUpdateSettings={onUpdateSettings} />
          )}
          {activeTab === 'appearance' && (
            <AppearanceSettingsTab />
          )}
          {activeTab === 'notifications' && (
            <NotificationsSettingsTab />
          )}
          {activeTab === 'security' && (
            <SecuritySettingsTab accounts={accounts} settings={settings} onUpdateSettings={onUpdateSettings} />
          )}
          {activeTab === 'about' && (
            <AboutSettingsTab />
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsTab