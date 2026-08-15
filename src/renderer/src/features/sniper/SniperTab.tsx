import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Square,
  Download,
  Trash2,
  AlertCircle,
  Settings,
  Copy,
  Key,
  Clipboard,
  Plus,
  Sparkles,
  CheckCircle2,
  Loader2,
  Upload,
} from "lucide-react";
import { useAccountsManager } from "../auth/api/useAccounts";
import { AccountStatus } from "@renderer/types";
import { v4 as uuidv4 } from "uuid";
import { SniperSettingsModal } from "./SniperSettingsModal";

interface SniperResult {
  valid: string[];
  taken: string[];
  censored: string[];
  progress: number;
  status: "idle" | "running" | "paused" | "completed";
  currentLoop: number;
  totalLoops: number;
}

export const SniperTab = () => {
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("sniper_sessionId") || "";
    }
    return "";
  });
  const [usernames, setUsernames] = useState<string[]>([]);
  const [results, setResults] = useState<SniperResult>({
    valid: [],
    taken: [],
    censored: [],
    progress: 0,
    status: "idle",
    currentLoop: 0,
    totalLoops: 1,
  });
  const [fileName, setFileName] = useState<string>("");
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [loopCount, setLoopCount] = useState<number>(1);
  const [checkInterval, setCheckInterval] = useState<number>(200);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [autoGenerate, setAutoGenerate] = useState<boolean>(false);
  const [generatedAccounts, setGeneratedAccounts] = useState<any[]>([]);
  const [isAddingToAccounts, setIsAddingToAccounts] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);
  const isRunningRef = useRef(false);
  const { addAccount } = useAccountsManager();

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem("sniper_sessionId", sessionId);
    } else {
      sessionStorage.removeItem("sniper_sessionId");
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSniperAccounts();
  }, []);

  const loadSniperAccounts = async () => {
    try {
      const result = await window.api.generator.sniperGetAccounts();
      if (result.success && result.accounts) {
        setGeneratedAccounts(result.accounts);
      }
    } catch (err) {
      console.error("[SniperTab] Failed to load sniper accounts:", err);
    }
  };

  useEffect(() => {
    const setupListeners = () => {
      unsubscribersRef.current.forEach((unsub) => {
        try {
          unsub();
        } catch {
          /* ignore cleanup errors */
        }
      });
      unsubscribersRef.current = [];

      const unsubscribeValid = window.api.sniper.onValid((data) => {
        setResults((prev) => ({
          ...prev,
          valid: [...prev.valid, data.username],
        }));
        if (autoGenerate) {
          void window.api.generator
            .createAccountWithUsername(data.username)
            .then((result) => {
              if (result.success && result.accountId) {
                void loadSniperAccounts();
              }
            });
        }
      });

      const unsubscribeTaken = window.api.sniper.onTaken((data) => {
        setResults((prev) => ({
          ...prev,
          taken: [...prev.taken, data.username],
        }));
      });

      const unsubscribeCensored = window.api.sniper.onCensored((data) => {
        setResults((prev) => ({
          ...prev,
          censored: [...prev.censored, data.username],
        }));
      });

      const unsubscribeProgress = window.api.sniper.onProgress((data) => {
        setResults((prev) => ({
          ...prev,
          progress: (data.checked / data.total) * 100,
          currentLoop: data.loop,
          totalLoops: data.totalLoops,
        }));
      });

      const unsubscribeCompleted = window.api.sniper.onCompleted(() => {
        isRunningRef.current = false;
        setResults((prev) => ({ ...prev, status: "completed" }));
      });

      const unsubscribeError = window.api.sniper.onError((data) => {
        console.error("[Frontend] onError:", data);
      });

      unsubscribersRef.current = [
        unsubscribeValid,
        unsubscribeTaken,
        unsubscribeCensored,
        unsubscribeProgress,
        unsubscribeCompleted,
        unsubscribeError,
      ];
    };

    setupListeners();

    return () => {
      unsubscribersRef.current.forEach((unsub) => {
        try {
          unsub();
        } catch {
          /* ignore cleanup errors */
        }
      });
      unsubscribersRef.current = [];
    };
  }, [autoGenerate]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && unsubscribersRef.current.length === 0) {
        window.api.sniper.onValid((data) => {
          setResults((prev) => ({
            ...prev,
            valid: [...prev.valid, data.username],
          }));
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const syncSessionState = async () => {
      if (!sessionId) return;
      try {
        const session = await window.api.sniper.getSession(sessionId);
        if (session.success && session.session) {
          const sess = session.session;
          setUsernames(sess.usernames || []);
          if (sess.usernames && sess.usernames.length > 0) {
            setFileName(`${sess.usernames.length} usernames`);
          }
          setResults({
            valid: sess.valid || [],
            taken: sess.taken || [],
            censored: sess.censored || [],
            progress: sess.checked
              ? (sess.checked / sess.usernames.length) * 100
              : 0,
            status: sess.status as "idle" | "running" | "paused" | "completed",
            currentLoop: sess.currentLoop || 0,
            totalLoops: sess.totalLoops || 1,
          });
          isRunningRef.current = sess.status === "running";
        }
      } catch (error) {
        console.error("Failed to sync:", error);
      }
    };

    if (sessionId) {
      void syncSessionState();
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && sessionId) {
        void syncSessionState();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      setUsernames(lines);
      try {
        const response = await window.api.sniper.createSession(
          lines,
          [],
          loopEnabled,
          loopCount,
          checkInterval,
        );
        if (response.success && response.sessionId) {
          setSessionId(response.sessionId);
          setResults({
            valid: [],
            taken: [],
            censored: [],
            progress: 0,
            status: "idle" as const,
            currentLoop: 0,
            totalLoops: loopCount,
          });
        }
      } catch (error) {
        console.error("Failed to create sniper session:", error);
      }
    };
    reader.readAsText(file);
  };

  const handleStartSniper = async () => {
    if (!sessionId) return;
    try {
      isRunningRef.current = true;
      setResults((prev) => ({
        ...prev,
        status: "running",
        valid: [],
        taken: [],
        censored: [],
        progress: 0,
      }));
      const response = await window.api.sniper.startSniper(sessionId);
      if (!response.success) {
        console.error("Failed to start sniper:", response.error);
        isRunningRef.current = false;
        setResults((prev) => ({ ...prev, status: "idle" }));
      }
    } catch (error) {
      console.error("Failed to start sniper:", error);
      isRunningRef.current = false;
      setResults((prev) => ({ ...prev, status: "idle" }));
    }
  };

  const handlePauseSniper = async () => {
    if (!sessionId) return;
    try {
      const response = await window.api.sniper.pauseSession(sessionId);
      if (response.success) {
        setResults((prev) => ({ ...prev, status: "paused" }));
      }
    } catch (error) {
      console.error("Failed to pause sniper:", error);
    }
  };

  const handleStopSniper = async () => {
    if (!sessionId) return;
    try {
      isRunningRef.current = false;
      const response = await window.api.sniper.stopSession(sessionId);
      if (response.success) {
        setResults((prev) => ({ ...prev, status: "idle" }));
      }
    } catch (error) {
      console.error("Failed to stop sniper:", error);
    }
  };

  const handleExportValid = async () => {
    if (results.valid.length === 0) return;
    const content = results.valid.join("\n");
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(content),
    );
    element.setAttribute("download", "valid_usernames.txt");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleClearSession = async () => {
    if (!sessionId) return;
    try {
      isRunningRef.current = false;
      const response = await window.api.sniper.clearSession(sessionId);
      if (response.success) {
        setSessionId("");
        setUsernames([]);
        setResults({
          valid: [],
          taken: [],
          censored: [],
          progress: 0,
          status: "idle",
          currentLoop: 0,
          totalLoops: 1,
        });
        setFileName("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  };

  const handleAddToAccounts = async (account: any) => {
    setIsAddingToAccounts(account.id);
    try {
      let userId = "";
      let displayName = account.username;
      let avatarUrl = "";
      try {
        const userResult = await window.api.user.getUserByUsername(
          account.username,
        );
        if (userResult) {
          userId = String(userResult.id || "");
          displayName = userResult.displayName || account.username;
        }
      } catch (err) {
        console.error("[SniperTab] Failed to fetch user by username:", err);
      }
      try {
        const avatarResult = await window.api.user.getAvatarUrlByUsername(
          account.username,
        );
        avatarUrl = avatarResult?.url || "";
      } catch (err) {
        console.error(
          "[SniperTab] Failed to fetch avatar for",
          account.username,
          ":",
          err,
        );
      }
      addAccount({
        id: uuidv4(),
        username: account.username,
        displayName,
        userId,
        cookie: account.cookie || undefined,
        password: account.password,
        status: AccountStatus.Offline,
        avatarUrl,
        lastActive: new Date().toISOString(),
        robuxBalance: 0,
        friendCount: 0,
        followerCount: 0,
        followingCount: 0,
        notes: "",
      });
    } catch (err) {
      console.error("[SniperTab] Failed to add account to accounts tab:", err);
      alert("Failed to add account to accounts tab");
    } finally {
      setIsAddingToAccounts(null);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (confirm("Delete this account?")) {
      try {
        const result =
          await window.api.generator.sniperRemoveAccount(accountId);
        if (result.success) {
          await loadSniperAccounts();
        } else {
          alert("Failed to delete account");
        }
      } catch (err) {
        console.error("[SniperTab] Failed to delete account:", err);
        alert("Failed to delete account");
      }
    }
  };

  const handleClearAllAccounts = async () => {
    if (confirm("Delete all generated accounts?")) {
      try {
        for (const account of generatedAccounts) {
          await window.api.generator.sniperRemoveAccount(account.id);
        }
        setGeneratedAccounts([]);
      } catch (err) {
        console.error("[SniperTab] Failed to clear accounts:", err);
      }
    }
  };

  const handleBulkCopy = async () => {
    try {
      const copyData = generatedAccounts.map(
        (account) =>
          `${account.username}:${account.password || ""}:${account.cookie || ""}`,
      );
      await navigator.clipboard.writeText(copyData.join("\n"));
      alert(`Copied ${copyData.length} accounts to clipboard`);
    } catch (err) {
      console.error("[SniperTab] Failed to bulk copy:", err);
    }
  };

  const statusColor = {
    idle: "text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] border-[var(--color-border-strong)]",
    running: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    paused: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    completed: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  }[results.status];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
      <div className="flex flex-col gap-5 p-6 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Username Sniper
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Rapid availability scanner
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusColor}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${results.status === "running" ? "animate-pulse bg-emerald-400" : "bg-current"}`}
              />
              {results.status}
            </span>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`rounded-xl border p-2 text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)] ${showSettings ? "border-[var(--accent-color-border)] bg-[var(--accent-color-faint)] text-[var(--accent-color)]" : "border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-hover)]"}`}
              title="Sniper Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {results.status !== "idle" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Valid",
                value: results.valid.length,
                color: "text-emerald-500",
                border: "border-emerald-500/20 bg-emerald-500/5",
              },
              {
                label: "Taken",
                value: results.taken.length,
                color: "text-amber-500",
                border: "border-amber-500/20 bg-amber-500/5",
              },
              {
                label: "Censored",
                value: results.censored.length,
                color: "text-red-500",
                border: "border-red-500/20 bg-red-500/5",
              },
              {
                label: "Progress",
                value: `${results.progress.toFixed(0)}%`,
                color: "text-sky-500",
                border: "border-sky-500/20 bg-sky-500/5",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl border p-4 ${stat.border}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {stat.label}
                </p>
                <p className={`mt-1 text-2xl font-black ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Progress Bar */}
        {results.status === "running" && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Scanning... Loop {results.currentLoop}/{results.totalLoops}
              </span>
              <span>{results.progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--accent-color)] transition-all duration-300"
                style={{ width: `${results.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Control Panel */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-5">
          <div className="flex flex-col gap-4">
            {/* File Upload Area */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileSelect}
              disabled={!!sessionId}
              className="hidden"
            />

            <div
              onClick={() => !sessionId && fileInputRef.current?.click()}
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                sessionId
                  ? "cursor-default border-[var(--color-border)] opacity-60"
                  : "border-[var(--color-border)] hover:border-[var(--accent-color)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <Upload
                className={`mb-3 h-8 w-8 transition-colors ${sessionId ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-muted)] group-hover:text-[var(--accent-color)]"}`}
              />
              <p className="font-semibold text-[var(--color-text-secondary)]">
                {fileName ? fileName : "Upload Username List (.txt)"}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {usernames.length > 0
                  ? `${usernames.length} usernames loaded`
                  : "Click to browse or drop a .txt file"}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {sessionId && results.status === "idle" && (
                <button
                  onClick={handleStartSniper}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent-color)] py-3 font-bold text-[var(--color-text-primary)] transition hover:brightness-110"
                >
                  <Play size={18} /> Start Scan
                </button>
              )}
              {sessionId && results.status === "running" && (
                <>
                  <button
                    onClick={handlePauseSniper}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 font-bold text-amber-500 transition hover:bg-amber-500/20"
                  >
                    <Pause size={18} /> Pause
                  </button>
                  <button
                    onClick={handleStopSniper}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 font-bold text-red-500 transition hover:bg-red-500/20"
                  >
                    <Square size={18} /> Stop
                  </button>
                </>
              )}
              {sessionId && results.status === "paused" && (
                <>
                  <button
                    onClick={handleStartSniper}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 font-bold text-emerald-500 transition hover:bg-emerald-500/20"
                  >
                    <Play size={18} /> Resume
                  </button>
                  <button
                    onClick={handleStopSniper}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 font-bold text-red-500 transition hover:bg-red-500/20"
                  >
                    <Square size={18} /> Stop
                  </button>
                </>
              )}
              {sessionId && results.status === "completed" && (
                <button
                  onClick={handleClearSession}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 font-bold text-[var(--color-text-secondary)] transition hover:text-red-500"
                >
                  <Trash2 size={18} /> Clear Session
                </button>
              )}
              {!sessionId && (
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-500">
                  <AlertCircle size={16} className="shrink-0" />
                  Upload a .txt list above to start scanning usernames.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Valid Usernames Panel */}
        {results.valid.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-emerald-500">
                <CheckCircle2 size={18} />
                Valid Usernames ({results.valid.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    void navigator.clipboard.writeText(results.valid.join("\n"))
                  }
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-500 transition hover:bg-emerald-500/20"
                >
                  <Copy size={13} /> Copy All
                </button>
                <button
                  onClick={handleExportValid}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-500 transition hover:bg-emerald-500/20"
                >
                  <Download size={13} /> Export
                </button>
              </div>
            </div>
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {results.valid.map((username, index) => (
                <div
                  key={`${username}-${index}`}
                  className="flex items-center justify-between rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-2.5"
                >
                  <span className="font-mono text-sm font-medium text-[var(--color-text-primary)]">
                    {username}
                  </span>
                  <button
                    onClick={() => void navigator.clipboard.writeText(username)}
                    className="text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
                    title="Copy"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Accounts Panel */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <Sparkles size={18} className="text-[var(--accent-color)]" />
              Generated Accounts
              <span className="ml-1 rounded-full bg-[var(--accent-color-faint)] px-2 py-0.5 text-xs font-bold text-[var(--accent-color)]">
                {generatedAccounts.length}
              </span>
            </h3>
            {generatedAccounts.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleBulkCopy}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)]"
                >
                  <Copy size={13} /> Bulk Copy
                </button>
                <button
                  onClick={handleClearAllAccounts}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 text-xs font-semibold text-red-500 transition hover:bg-red-500/10"
                >
                  <Trash2 size={13} /> Clear All
                </button>
              </div>
            )}
          </div>

          {generatedAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-12 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-muted)]">
                No generated accounts yet.
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Enable auto-generate and scan a valid username list.
              </p>
            </div>
          ) : (
            <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
              {generatedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 hover:bg-[var(--color-surface-hover)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--color-text-primary)]">
                      {account.username}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {account.password ? (
                        <span className="text-emerald-500">
                          ● Credentials available
                        </span>
                      ) : (
                        <span>○ Waiting for data</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          `${account.username}:${account.password || ""}:${account.cookie || ""}`,
                        )
                      }
                      className="rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                      title="Copy all credentials"
                    >
                      <Clipboard size={15} />
                    </button>
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          account.password || "",
                        )
                      }
                      className="rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                      title="Copy password"
                    >
                      <Key size={15} />
                    </button>
                    <button
                      onClick={() => void handleDeleteAccount(account.id)}
                      className="rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => void handleAddToAccounts(account)}
                      disabled={isAddingToAccounts === account.id}
                      className="rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-emerald-500/10 hover:text-emerald-500 disabled:opacity-40"
                      title="Add to accounts"
                    >
                      {isAddingToAccounts === account.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Plus size={15} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SniperSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        sessionId={!!sessionId}
        loopEnabled={loopEnabled}
        setLoopEnabled={setLoopEnabled}
        loopCount={loopCount}
        setLoopCount={setLoopCount}
        checkInterval={checkInterval}
        setCheckInterval={setCheckInterval}
        autoGenerate={autoGenerate}
        setAutoGenerate={setAutoGenerate}
      />
    </div>
  );
};
