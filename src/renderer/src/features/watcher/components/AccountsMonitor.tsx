import { Play, Square, RotateCw, X, User } from "lucide-react";
import CustomCheckbox from "@renderer/components/UI/buttons/CustomCheckbox";
import { WatcherSession } from "../hooks/useWatcher";
import { Account } from "@renderer/types";
import { useState, useEffect } from "react";
import { cn } from "@renderer/lib/utils";

const ActiveTimer = ({ startTime }: { startTime: number }) => {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - startTime) / 1000),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const hours = Math.floor(mins / 60);
  const displayMins =
    hours > 0 ? (mins % 60).toString().padStart(2, "0") : mins;

  if (hours > 0) {
    return (
      <span className="ml-1.5 font-semibold text-[var(--accent-color)]">
        {hours}:{displayMins}:{secs.toString().padStart(2, "0")}
      </span>
    );
  }
  return (
    <span className="ml-1.5 font-semibold text-[var(--accent-color)]">
      {displayMins}:{secs.toString().padStart(2, "0")}
    </span>
  );
};

interface AccountsMonitorProps {
  accounts: Account[];
  sessions: WatcherSession[];
  isWatcherRunning: boolean;
  isLaunching: boolean;
  selectedAccountIds: Set<string>;
  onToggleAccount: (id: string) => void;
  onStartAccount: (account: Account) => void;
  onStopAccount: (session: WatcherSession) => void;
  onRelaunchSession: (session: WatcherSession) => void;
  onRemoveSession: (sessionId: string) => void;
  privacyMode?: boolean;
}

const STATUS_CONFIG = {
  running: {
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rowBorder: "border-emerald-500/50",
    label: "ACTIVE",
  },
  crashed: {
    dot: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    rowBorder: "border-red-500/50",
    label: "CRASHED",
  },
  restarting: {
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-ping",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rowBorder: "border-amber-500/50",
    label: "REJOINING",
  },
  inactive: {
    dot: "bg-[var(--color-text-muted)]/30",
    badge:
      "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]",
    rowBorder: "border-transparent",
    label: "INACTIVE",
  },
};

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
  privacyMode,
}: AccountsMonitorProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-[var(--color-text-muted)]">
        <User size={32} className="opacity-30 mb-3" />
        <p className="text-sm font-medium">No accounts found</p>
        <p className="text-xs opacity-50 mt-1">
          Add accounts to start monitoring
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 md:p-3">
      {accounts.map((account) => {
        const session = sessions.find((s) => s.accountId === account.id);
        const status = session?.status ?? "inactive";
        const cfg =
          STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ??
          STATUS_CONFIG.inactive;
        const isSelected = selectedAccountIds.has(account.id);

        return (
          <div
            key={account.id}
            className={cn(
              "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200",
              cfg.rowBorder,
              isSelected
                ? "border-[var(--accent-color)]/35 bg-[rgba(var(--accent-color-rgb),0.07)] shadow-[0_0_0_1px_rgba(var(--accent-color-rgb),0.08)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]",
            )}
          >
            <div className="flex shrink-0 items-center pr-1">
              <CustomCheckbox
                checked={isSelected}
                onChange={() => onToggleAccount(account.id)}
              />
            </div>

            <div className="relative h-2.5 w-2.5 shrink-0">
              <span className={`absolute inset-0 rounded-full ${cfg.dot}`} />
            </div>

            {account.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt={privacyMode ? "" : account.displayName || account.username}
                style={privacyMode ? { filter: "blur(16px)" } : undefined}
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full border object-cover transition-all",
                  isSelected
                    ? "border-[var(--accent-color)] shadow-[0_0_12px_rgba(var(--accent-color-rgb),0.25)]"
                    : "border-[var(--color-border)]",
                )}
              />
            ) : (
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[var(--color-surface)] transition-all",
                  isSelected
                    ? "border-[var(--accent-color)] text-[var(--accent-color)] shadow-[0_0_12px_rgba(var(--accent-color-rgb),0.25)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]",
                )}
              >
                <User size={12} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-semibold leading-none text-[var(--color-text-primary)]"
                style={privacyMode ? { filter: "blur(16px)" } : undefined}
              >
                {privacyMode
                  ? "Hidden"
                  : account.displayName || account.username}
              </p>
              <p className="mt-1 truncate text-[10px] font-mono text-[var(--color-text-muted)]">
                {session ? (
                  <>
                    Place {session.placeId}
                    {session.lastStartTime && status === "running" && (
                      <ActiveTimer startTime={session.lastStartTime} />
                    )}
                    {session.restartCount > 0 && (
                      <span className="ml-1.5 text-amber-500/70">
                        ↻{session.restartCount}
                      </span>
                    )}
                    {session.lastCrashReason && status === "crashed" && (
                      <span className="ml-1.5 text-red-400/70">
                        · {session.lastCrashReason}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="opacity-40">Not watching</span>
                )}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-bold tracking-[0.16em] ${cfg.badge}`}
            >
              {cfg.label}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              {session ? (
                <>
                  {status === "crashed" && (
                    <button
                      onClick={() => onRelaunchSession(session)}
                      disabled={isLaunching}
                      className="rounded-md p-1.5 text-emerald-400 transition-colors hover:bg-emerald-500/15 disabled:opacity-40"
                      title="Relaunch"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onStopAccount(session)}
                    className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Stop watching (keep running)"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveSession(session.id)}
                    className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                    title="Kill process and remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                isWatcherRunning &&
                account.cookie && (
                  <button
                    onClick={() => onStartAccount(account)}
                    disabled={isLaunching}
                    className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-40"
                    title="Start watching this account"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
