import React from 'react'
import { motion } from 'framer-motion'
import { Bell, Users, UserMinus, Info, MapPin } from 'lucide-react'
import { cn } from '../../../lib/utils'
import {
  useNotifyFriendOnline,
  useNotifyFriendInGame,
  useNotifyFriendRemoved,
  useNotifyServerLocation,
  useNotificationTrayStore
} from '../../system/stores/useNotificationTrayStore'

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative w-11 h-6 rounded-full border transition-all duration-300 disabled:opacity-50',
        checked ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-[var(--color-surface-hover)] border-[var(--color-border)]'
      )}
    >
      <div className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300', checked ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  )
}

export const NotificationsSettingsTab: React.FC = () => {
  const notifyFriendOnline = useNotifyFriendOnline()
  const notifyFriendInGame = useNotifyFriendInGame()
  const notifyFriendRemoved = useNotifyFriendRemoved()
  const notifyServerLocation = useNotifyServerLocation()

  const setNotifyFriendOnline = useNotificationTrayStore((s) => s.setNotifyFriendOnline)
  const setNotifyFriendInGame = useNotificationTrayStore((s) => s.setNotifyFriendInGame)
  const setNotifyFriendRemoved = useNotificationTrayStore((s) => s.setNotifyFriendRemoved)
  const setNotifyServerLocation = useNotificationTrayStore((s) => s.setNotifyServerLocation)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Notifications</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1.5 leading-relaxed">Configure how and when you want to be notified.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Friend Activity */}
        <div className="col-span-2 flex items-center gap-3 pt-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Friend Activity</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        {/* Friend Online */}
        <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <Users size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Friend Online</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Alert when a friend comes online.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">{notifyFriendOnline ? 'On' : 'Off'}</span>
            <Toggle checked={notifyFriendOnline} onChange={() => setNotifyFriendOnline(!notifyFriendOnline)} />
          </div>
        </div>

        {/* Friend in Game */}
        <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <Bell size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Friend Starts Playing</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Alert when a friend joins a game.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">{notifyFriendInGame ? 'On' : 'Off'}</span>
            <Toggle checked={notifyFriendInGame} onChange={() => setNotifyFriendInGame(!notifyFriendInGame)} />
          </div>
        </div>

        {/* Friend Removed — full width, amber accent */}
        <div className="col-span-2 relative overflow-hidden group rounded-xl border border-amber-500/20 hover:border-amber-500/40 bg-[var(--color-surface)] transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <UserMinus size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Friend Removed You</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Get notified when someone unfriends you. Useful for keeping track of your friends list.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">{notifyFriendRemoved ? 'Enabled' : 'Disabled'}</span>
            <Toggle checked={notifyFriendRemoved} onChange={() => setNotifyFriendRemoved(!notifyFriendRemoved)} />
          </div>
        </div>

        {/* Sessions */}
        <div className="col-span-2 flex items-center gap-3 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Sessions</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        {/* Server Location */}
        <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
          <div className="flex items-center gap-3 mb-4 z-10 relative">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
              <MapPin size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Server Location</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Display the geographic location of the server when you join a Roblox game.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">{notifyServerLocation ? 'Enabled' : 'Disabled'}</span>
            <Toggle checked={notifyServerLocation} onChange={() => setNotifyServerLocation(!notifyServerLocation)} />
          </div>
        </div>

      </div>
    </motion.div>
  )
}
