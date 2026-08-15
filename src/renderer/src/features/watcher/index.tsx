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

export default function WatcherTab({ privacyMode }: { privacyMode?: boolean }) {
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

  // Per-account start: launches this single account into the watcher
  const handleStartAccount = useCallback(
    async (account: Account, skipSetLaunching = false) => {
      if (!placeId) return alert("Please enter a Place ID first");
      if (!Number.isInteger(Number(placeId)) || Number(placeId) <= 0)
        return alert("Please enter a valid Place ID");
      if (!account.cookie) return alert("Account has no cookie");

      if (!skipSetLaunching) setIsLaunching(true);
      try {
        let jobId: string | undefined;
        // If private server link is set, extract the link code
        if (privateServerLink.trim()) {
          try {
            const url = new URL(privateServerLink);
            const code = url.searchParams.get("privateServerLinkCode");
            jobId = code || privateServerLink.trim();
          } catch {
            jobId = privateServerLink.trim();
          }
        }

        const result = (await window.electron.ipcRenderer.invoke(
          "games:launch-game",
          {
            cookie: account.cookie,
            placeId: Number(placeId),
            accountId: account.id,
            username: account.displayName || account.username,
            jobId,
          },
        )) as any;

        if (result?.success) {
          await window.api.autoTrackLaunchedGame(
            account.id,
            account.displayName || account.username,
            account.userId || "unknown",
            Number(placeId),
            { cookie: account.cookie, placeId: Number(placeId), jobId },
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

  // Per-account stop: removes session from watcher
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
      stopWatching();
      setIsWatcherRunning(false);
      return;
    }

    if (!placeId) {
      alert("Please enter a Place ID to launch accounts.");
      return;
    }
    if (!Number.isInteger(Number(placeId)) || Number(placeId) <= 0) {
      alert("Please enter a valid numeric Place ID to launch accounts.");
      return;
    }

    if (selectedAccountIds.size === 0) {
      alert("Please select at least one account to launch.");
      return;
    }

    cancelLaunchRef.current = false;
    setIsLaunching(true);

    try {
      // Keep basic autoRestart functionality without old settings
      await window.electron.ipcRenderer.invoke("watcher:set-config", {
        autoRestart: true,
        restartDelaySeconds: 5,
      });
    } catch (err) {}

    await startWatching();
    setIsWatcherRunning(true);

    // Launch all SELECTED inactive accounts sequentially
    const selectedInactive = accounts.filter(
      (a) =>
        selectedAccountIds.has(a.id) &&
        !sessions.some((s) => s.accountId === a.id),
    );
    for (const account of selectedInactive) {
      if (cancelLaunchRef.current) break;
      if (account.cookie) {
        await handleStartAccount(account, true);
        if (cancelLaunchRef.current) break;
        // Short 500ms delay between manual launches to prevent total bottleneck
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    setIsLaunching(false);
  }, [
    isWatcherRunning,
    startWatching,
    stopWatching,
    accounts,
    sessions,
    placeId,
    handleStartAccount,
    selectedAccountIds,
  ]);

  return (
    <div className="flex h-full flex-col bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]">
      {/* Main Layout */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[1fr_360px] p-6 gap-6 max-w-[1600px] mx-auto w-full">
        {/* Left Side: All Accounts Monitor */}
        <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm h-full hover:border-[var(--accent-color)]/20 transition-colors">
          <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-color-faint)] text-[var(--accent-color)] shadow-sm shrink-0">
                <MonitorPlay size={16} />
              </div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-tight">
                Account Watcher
              </h3>
              <div className="w-px h-4 bg-[var(--color-border)] hidden sm:block" />
              <span className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-0.5 text-xs font-black text-[var(--color-text-primary)]">
                {accounts.length}
              </span>
              {sessions.length > 0 && (
                <span className="bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5 text-xs font-bold text-emerald-400">
                  {sessions.length} watching
                </span>
              )}
            </div>
            {sessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseAllSessions}
                className="h-7 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10"
              >
                Stop All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-7 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
            >
              Select All
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <AccountsMonitor
              accounts={accounts}
              sessions={sessions}
              isWatcherRunning={isWatcherRunning}
              isLaunching={isLaunching}
              selectedAccountIds={selectedAccountIds}
              onToggleAccount={handleToggleAccount}
              onStartAccount={handleStartAccount}
              onStopAccount={handleStopAccount}
              onRelaunchSession={handleRelaunchSession}
              onRemoveSession={handleRemoveSession}
              privacyMode={privacyMode}
            />
          </div>
        </div>

        {/* Right Side: Config & Terminal */}
        <div className="flex flex-col gap-6 h-full min-h-0">
          {/* Launch Config Panel */}
          <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm shrink-0 hover:border-[var(--color-border-strong)] transition-colors">
            <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
              <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <GripVertical
                  size={14}
                  className="text-[var(--color-text-muted)]"
                />{" "}
                Launch Config
              </h3>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] ml-1">
                  Place ID
                </label>
                <input
                  type="text"
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full h-9 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color-border)] focus:ring-1 focus:ring-[var(--accent-color-ring)] transition-all placeholder:text-[var(--color-text-muted)]"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Private Server Link
                  </label>
                  {privateServerLink && (
                    <button
                      onClick={() => setPrivateServerLink("")}
                      className="text-[10px] text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    >
                      clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={privateServerLink}
                  onChange={(e) => setPrivateServerLink(e.target.value)}
                  placeholder="https://www.roblox.com/games/..."
                  className="w-full h-9 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color-border)] focus:ring-1 focus:ring-[var(--accent-color-ring)] transition-all placeholder:text-[var(--color-text-muted)]/40"
                />
                {privateServerLink && (
                  <p className="text-[10px] text-emerald-400/80">
                    ✓ Private server — all launches will use this link
                  </p>
                )}
              </div>

              {/* Launch All Selected */}
              {accounts.length > 0 && (
                <Button
                  variant="default"
                  onClick={handleToggleWatcher}
                  disabled={isLaunching || selectedAccountIds.size === 0}
                  className="w-full h-9 rounded-lg gap-2 mt-2 shadow-sm hover:shadow-[0_0_12px_var(--accent-color-ring)] transition-shadow duration-200"
                >
                  {isLaunching ? (
                    <Activity className="animate-spin" size={14} />
                  ) : isWatcherRunning ? (
                    <Square size={14} />
                  ) : (
                    <Play size={14} />
                  )}
                  <span className="text-xs font-bold">
                    {isWatcherRunning
                      ? "Stop Watcher"
                      : `Launch Selected (${selectedAccountIds.size})`}
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Terminal / Event Log */}
          <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[#0a0a0a] overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] flex flex-col min-h-[300px]">
            <div className="px-4 py-2 border-b border-[#222] bg-[#111] flex items-center justify-between shrink-0">
              <h3 className="text-[10px] font-bold text-[#888] flex items-center gap-1.5 tracking-wider uppercase">
                <Terminal size={12} className="text-[#666]" /> System Terminal
              </h3>
              <button
                onClick={handleClearEvents}
                className="text-[10px] font-bold text-[#555] hover:text-[#fff] transition-colors"
              >
                CLEAR
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed relative">
              {events.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-[#333]">
                  Waiting for events...
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
  );
}
