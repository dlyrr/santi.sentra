import { Play, Square, RotateCw, X, User } from 'lucide-react'
import CustomCheckbox from '@renderer/components/UI/buttons/CustomCheckbox'
import { WatcherSession } from '../hooks/useWatcher'
import { Account } from '@renderer/types'
import { useState, useEffect } from 'react'

const ActiveTimer = ({ startTime }: { startTime: number }) => {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startTime) / 1000))

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const hours = Math.floor(mins / 60)
  const displayMins = hours > 0 ? (mins % 60).toString().padStart(2, '0') : mins
  
  if (hours > 0) {
    return <span className="ml-1.5 font-semibold text-[var(--accent-color)]">{hours}:{displayMins}:{secs.toString().padStart(2, '0')}</span>
  }
  return <span className="ml-1.5 font-semibold text-[var(--accent-color)]">{displayMins}:{secs.toString().padStart(2, '0')}</span>
}

interface AccountsMonitorProps {
  accounts: Account[]
  sessions: WatcherSession[]
  isWatcherRunning: boolean
  isLaunching: boolean
  selectedAccountIds: Set<string>
  onToggleAccount: (id: string) => void
  onStartAccount: (account: Account) => void
  onStopAccount: (session: WatcherSession) => void
  onRelaunchSession: (session: WatcherSession) => void
  onRemoveSession: (sessionId: string) => void
  privacyMode?: boolean
}

const STATUS_CONFIG = {
  running: {
    dot: 'bg-emerald-400 animate-pulse',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    row: 'border-l-2 border-l-emerald-500/50',
    label: 'ACTIVE'
  },
  crashed: {
    dot: 'bg-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    row: 'border-l-2 border-l-red-500/50',
    label: 'CRASHED'
  },
  restarting: {
    dot: 'bg-amber-400 animate-ping',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    row: 'border-l-2 border-l-amber-500/50',
    label: 'REJOINING'
  },
  inactive: {
    dot: 'bg-[var(--color-text-muted)]/40',
    badge: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]',
    row: 'border-l-2 border-l-transparent',
    label: 'INACTIVE'
  }
}

export default function AccountsMonitor({
  accounts,
  sessions,
  isWatcherRunning,
  isLaunching,
  selectedAccountIds,
  onToggleAccount,
  onStartAccount,
  onStopAccount,
  onRelaunchSession,
  onRemoveSession,
  privacyMode
}: AccountsMonitorProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--color-text-muted)]">
        <User size={32} className="opacity-30 mb-3" />
        <p className="text-sm font-medium">No accounts found</p>
        <p className="text-xs opacity-50 mt-1">Add accounts to start monitoring</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-[var(--color-border)]">
      {accounts.map((account) => {
        const session = sessions.find((s) => s.accountId === account.id)
        const status = session?.status ?? 'inactive'
        const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.inactive

        return (
          <div
            key={account.id}
            className={`group flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-hover)] transition-colors ${cfg.row}`}
          >
            {/* Checkbox */}
            <div className="shrink-0 flex items-center pr-1">
              <CustomCheckbox
                checked={selectedAccountIds.has(account.id)}
                onChange={() => onToggleAccount(account.id)}
              />
            </div>

            {/* Status dot */}
            <div className="shrink-0 relative w-2 h-2">
              <span className={`absolute inset-0 rounded-full ${cfg.dot}`} />
            </div>

            {/* Avatar */}
            {account.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt={privacyMode ? '' : (account.displayName || account.username)}
                style={privacyMode ? { filter: 'blur(16px)' } : undefined}
                className="w-7 h-7 rounded-full border border-[var(--color-border)] shrink-0 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shrink-0 flex items-center justify-center">
                <User size={12} className="text-[var(--color-text-muted)]" />
              </div>
            )}

            {/* Name + Place ID */}
            <div className="flex-1 min-w-0">
              <p 
                className="text-xs font-semibold text-[var(--color-text-primary)] truncate leading-none"
                style={privacyMode ? { filter: 'blur(16px)' } : undefined}
              >
                {privacyMode ? 'Hidden' : (account.displayName || account.username)}
              </p>
              <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5 truncate">
                {session ? (
                  <>
                    Place {session.placeId}
                    {session.lastStartTime && status === 'running' && (
                      <ActiveTimer startTime={session.lastStartTime} />
                    )}
                    {session.restartCount > 0 && (
                      <span className="ml-1.5 text-amber-500/70">↻{session.restartCount}</span>
                    )}
                    {session.lastCrashReason && status === 'crashed' && (
                      <span className="ml-1.5 text-red-400/70 truncate"> · {session.lastCrashReason}</span>
                    )}
                  </>
                ) : (
                  <span className="opacity-40">Not watching</span>
                )}
              </p>
            </div>

            {/* Status Badge */}
            <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.badge} tracking-widest`}>
              {cfg.label}
            </span>

            {/* Actions */}
            <div className="shrink-0 flex gap-1">
              {session ? (
                <>
                  {status === 'crashed' && (
                    <button
                      onClick={() => onRelaunchSession(session)}
                      disabled={isLaunching}
                      className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                      title="Relaunch"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onStopAccount(session)}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Stop watching (keep running)"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveSession(session.id)}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Kill process and remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                isWatcherRunning && account.cookie && (
                  <button
                    onClick={() => onStartAccount(account)}
                    disabled={isLaunching}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                    title="Start watching this account"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
