import { useState, useCallback, useRef, useEffect } from "react";
import {
  Play,
  Trash2,
  Square,
  Activity,
  Users,
  Settings2,
  Terminal,
  MonitorPlay,
  FileTerminal,
  GripVertical,
  RefreshCw,
} from "lucide-react";
import AccountsMonitor from "./components/AccountsMonitor";
import WatcherEventLog from "./components/WatcherEventLog";
import { Button } from "@renderer/components/UI/buttons/Button";
import { useWatcher } from "./hooks/useWatcher";
import { useAccountsManager } from "@renderer/hooks/queries";
import { useLocalStorage } from "@renderer/hooks/useLocalStorage";
import { WatcherSession } from "./hooks/useWatcher";
import type { Account } from "@renderer/types";

export default function WatcherTab({ 
  privacyMode,
  onBatchLaunchRequest,
}: { 
  privacyMode?: boolean;
  onBatchLaunchRequest?: (callback: (path?: string) => void) => void;
}) {
  const { accounts = [] } = useAccountsManager();
  const {
    sessions,
    events,
    removeSession,
    clearEvents,
    startWatching,
    stopWatching,
  } = useWatcher();

  const [isWatcherRunning, setIsWatcherRunning] = useState(false);
  const [placeId, setPlaceId] = useLocalStorage<string>("watcher-place-id", "");
  const [privateServerLink, setPrivateServerLink] = useLocalStorage<string>(
    "watcher-private-server-link",
    "",
  );
  const [isLaunching, setIsLaunching] = useState(false);

  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set(),
  );
  const cancelLaunchRef = useRef(false);

  const eventLogEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    eventLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const handleToggleAccount = useCallback((accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedAccountIds.size === accounts.length)
      setSelectedAccountIds(new Set());
    else setSelectedAccountIds(new Set(accounts.map((a) => a.id)));
  }, [accounts, selectedAccountIds.size]);

  useEffect(() => {
    eventLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const handleRelaunchSession = useCallback(
    async (session: WatcherSession) => {
      if (!session.launchConfig) {
        alert("Cannot relaunch - no launch config available");
        return;
      }

      setIsLaunching(true);
      try {
        await startWatching();
        setIsWatcherRunning(true);

        const result = (await window.electron.ipcRenderer.invoke(
          "games:launch-game",
          {
            cookie: session.launchConfig.cookie,
            placeId: session.placeId,
            accountId: session.accountId,
            username: session.displayName || session.username || "Unknown",
            installPath: session.launchConfig.installPath,
          },
        )) as any;

        if (result?.success) {
          await window.api.autoTrackLaunchedGame(
            session.accountId,
            session.username || "Unknown",
            session.userId || "unknown",
            session.placeId,
            session.launchConfig,
            session.displayName || session.username,
            session.avatarUrl,
          );
        } else {
          alert(`Failed to relaunch: ${result?.error || "Unknown error"}`);
        }
      } catch (error: any) {
        alert(`Error relaunching: ${error.message || "Unknown error"}`);
      } finally {
        setIsLaunching(false);
      }
    },
    [startWatching],
  );

  const handleRemoveSession = useCallback(
    async (sessionId: string) => {
      if (confirm("Kill process and remove session?"))
        await removeSession(sessionId, true);
    },
    [removeSession],
  );

  const handleCloseAllSessions = useCallback(async () => {
    if (confirm("Stop watching all sessions?")) {
      for (const session of sessions) {
        try {
          await removeSession(session.id);
        } catch (err) {}
      }
    }
  }, [sessions, removeSession]);

  const handleStartAccount = useCallback(
    async (account: Account, skipSetLaunching = false, installPath?: string) => {
      if (!placeId) return alert("Please enter a Place ID first");
      if (!Number.isInteger(Number(placeId)) || Number(placeId) <= 0)
        return alert("Please enter a valid Place ID");
      if (!account.cookie) return alert("Account has no cookie");

      if (!skipSetLaunching) setIsLaunching(true);
      try {
        let privateServerTarget: string | undefined;
        let jobId: string | undefined;

        if (privateServerLink.trim()) {
          const raw = privateServerLink.trim();
          try {
            const url = new URL(raw);
            const code = url.searchParams.get("privateServerLinkCode");
            if (code) {
              privateServerTarget = raw;
            } else {
              privateServerTarget = raw;
            }
          } catch {
            privateServerTarget = raw;
          }
        }

        const result = privateServerTarget
          ? ((await window.api.launchPrivateServer(
              account.cookie,
              Number(placeId),
              privateServerTarget,
            )) as any)
          : ((await window.electron.ipcRenderer.invoke("games:launch-game", {
              cookie: account.cookie,
              placeId: Number(placeId),
              accountId: account.id,
              username: account.displayName || account.username,
              jobId,
              installPath,
            })) as any);

        if (result?.success) {
          await window.api.autoTrackLaunchedGame(
            account.id,
            account.displayName || account.username,
            account.userId || "unknown",
            Number(placeId),
            { cookie: account.cookie, placeId: Number(placeId), jobId, installPath },
            account.displayName,
            account.avatarUrl,
          );
        } else {
          alert(
            `Failed to launch ${account.displayName || account.username}: ${result?.error || "Unknown error"}`,
          );
        }
      } catch (err: any) {
        alert(`Error launching: ${err.message || "Unknown error"}`);
      } finally {
        if (!skipSetLaunching) setIsLaunching(false);
      }
    },
    [placeId, privateServerLink],
  );

  const handleStartAccountClick = useCallback(
    (account: Account) => {
      if (onBatchLaunchRequest) {
        onBatchLaunchRequest((path) => handleStartAccount(account, false, path));
      } else {
        handleStartAccount(account, false);
      }
    },
    [onBatchLaunchRequest, handleStartAccount],
  );

  const handleStopAccount = useCallback(
    async (session: WatcherSession) => {
      try {
        await removeSession(session.id);
      } catch (err) {}
    },
    [removeSession],
  );

  const handleClearEvents = useCallback(async () => {
    if (confirm("Clear all events?")) await clearEvents();
  }, [clearEvents]);

  const handleToggleWatcher = useCallback(async () => {
    if (isWatcherRunning) {
      await stopWatching();
      setIsWatcherRunning(false);
      return;
    }

    if (!placeId) return alert("Please enter a Place ID first");
    if (!Number.isInteger(Number(placeId)) || Number(placeId) <= 0)
      return alert("Please enter a valid Place ID");

    const launchGroup = async (installPath?: string) => {
      setIsLaunching(true);
      try {
        await window.electron.ipcRenderer.invoke("watcher:set-config", {
          autoRestart: true,
          restartDelaySeconds: 5,
        });
      } catch (err) {}

      await startWatching();
      setIsWatcherRunning(true);

      const selectedInactive = accounts.filter(
        (a) =>
          selectedAccountIds.has(a.id) &&
          !sessions.some((s) => s.accountId === a.id),
      );
      for (const account of selectedInactive) {
        if (cancelLaunchRef.current) break;
        if (account.cookie) {
          await handleStartAccount(account, true, installPath);
          if (cancelLaunchRef.current) break;
        }
      }
      setIsLaunching(false);
    };

    if (onBatchLaunchRequest) {
      onBatchLaunchRequest(launchGroup);
    } else {
      launchGroup();
    }
  }, [
    isWatcherRunning,
    startWatching,
    stopWatching,
    accounts,
    sessions,
    placeId,
    handleStartAccount,
    selectedAccountIds,
    onBatchLaunchRequest,
  ]);

  return (
    <div className="h-full flex flex-col p-5 overflow-y-auto space-y-5 bg-[var(--color-background)]">
      {}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4 w-full">
        <div className="flex items-center gap-2.5">
          <MonitorPlay className="w-4 h-4 text-[var(--accent-color)]" />
          <h1 className="text-md font-bold tracking-tight text-[var(--color-text-primary)]">
            Account Watcher
          </h1>
        </div>
      </div>

      {}
      <div className="w-full flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl shadow-sm gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2 bg-[var(--color-surface-strong)]/60 p-2 rounded-lg border border-[var(--color-border)]/60">
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-1">
              Accounts
            </span>
            <span className="bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-xs px-2 py-0.5 rounded font-mono font-bold">
              {accounts.length}
            </span>
          </div>

          {sessions.length > 0 && (
            <div className="flex items-center gap-2 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-1">
                Active
              </span>
              <span className="bg-emerald-500/30 text-emerald-400 text-xs px-2 py-0.5 rounded font-mono font-bold">
                {sessions.length}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <>
              {isWatcherRunning ? (
                <Button
                  onClick={handleToggleWatcher}
                  disabled={isLaunching}
                  className="h-10 px-5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition-all shadow-sm border-0 flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button
                  onClick={handleToggleWatcher}
                  disabled={isLaunching || selectedAccountIds.size === 0}
                  className="h-10 px-5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-[var(--accent-color-foreground)] font-medium text-xs transition-all shadow-sm border-0 flex items-center gap-2"
                >
                  {isLaunching ? (
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Launch ({selectedAccountIds.size})</span>
                </Button>
              )}
            </>
          )}

          <Button
            onClick={() => setSelectedAccountIds(new Set())}
            disabled={selectedAccountIds.size === 0}
            variant="outline"
            className="h-10 px-3 rounded-lg border-[var(--color-border)] bg-[var(--color-surface-strong)]/40 hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50 text-xs"
          >
            Clear
          </Button>
        </div>
      </div>

      {}
      <div className="w-full flex-1 flex flex-col min-h-0">
        <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
          {}
          <div className="bg-[var(--color-surface)]/30 border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col h-full min-h-[420px]">
            <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-strong)]/20">
              <h2 className="text-xs font-bold flex items-center gap-2 text-[var(--color-text-primary)] uppercase tracking-wider">
                Active Sessions
                <span className="bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                  {sessions.length} Live
                </span>
              </h2>
              {sessions.length > 0 && (
                <Button
                  onClick={handleCloseAllSessions}
                  size="sm"
                  variant="ghost"
                  className="h-7 text-red-500 text-[11px] hover:bg-red-500/5"
                >
                  Stop All
                </Button>
              )}
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <AccountsMonitor
                accounts={accounts}
                sessions={sessions}
                isWatcherRunning={isWatcherRunning}
                isLaunching={isLaunching}
                selectedAccountIds={selectedAccountIds}
                onToggleAccount={handleToggleAccount}
                onStartAccount={handleStartAccountClick}
                onStopAccount={handleStopAccount}
                onRelaunchSession={handleRelaunchSession}
                onRemoveSession={handleRemoveSession}
                privacyMode={privacyMode}
              />
            </div>
          </div>

          {}
          <div className="flex flex-col gap-3 min-h-0">
            {}
            <div className="bg-[var(--color-surface)]/30 border border-[var(--color-border)] rounded-xl overflow-hidden p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                Launch Config
              </h3>

              <div className="space-y-2">
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)] block mb-1">
                    Place ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={placeId}
                    onChange={(e) => setPlaceId(e.target.value)}
                    placeholder="123456789"
                    className="h-8 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] font-medium text-[var(--color-text-primary)] transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-ring)]"
                  />
                </div>

                <div>
                  <label className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)] block mb-1 flex items-center justify-between">
                    <span>Private Server</span>
                    {privateServerLink && (
                      <button
                        onClick={() => setPrivateServerLink("")}
                        className="text-[7px] text-[var(--color-text-muted)] transition-colors hover:text-red-400"
                      >
                        clear
                      </button>
                    )}
                  </label>
                  <input
                    type="text"
                    value={privateServerLink}
                    onChange={(e) => setPrivateServerLink(e.target.value)}
                    placeholder="Optional"
                    className="h-8 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-text-primary)] transition-all placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-ring)]"
                  />
                  {privateServerLink && (
                    <p className="mt-1 text-[7px] font-medium text-emerald-400/80">
                      ✓ active
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2.5" />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-xl shadow-sm min-h-[200px]">
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Event Log
                </h3>
                <button
                  onClick={handleClearEvents}
                  className="text-[10px] font-bold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                >
                  CLEAR
                </button>
              </div>

              <div className="relative flex-1 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed">
                {events.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)]">
                    <span className="text-[9px]">Waiting for events...</span>
                  </div>
                ) : (
                  <>
                    <WatcherEventLog events={events} />
                    <div ref={eventLogEndRef} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
