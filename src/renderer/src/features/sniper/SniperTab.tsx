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
import { Button } from "@renderer/components/UI/buttons/Button";
import { motion, AnimatePresence } from "framer-motion";
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
        } catch {}
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
        } catch {}
      });
      unsubscribersRef.current = [];
    };
  }, [autoGenerate]);

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
            progress:
              sess.checked && sess.usernames.length
                ? (sess.checked / sess.usernames.length) * 100
                : 0,
            status: sess.status as "idle" | "running" | "paused" | "completed",
            currentLoop: sess.currentLoop || 0,
            totalLoops: sess.totalLoops ?? sess.loopCount ?? 1,
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

  const handleResumeSniper = async () => {
    if (!sessionId) return;
    try {
      isRunningRef.current = true;

      setResults((prev) => ({ ...prev, status: "running" }));
      const response = await window.api.sniper.startSniper(sessionId);
      if (!response.success) {
        console.error("Failed to resume sniper:", response.error);
        isRunningRef.current = false;

        setResults((prev) => ({ ...prev, status: "paused" }));
        return;
      }

      const session = await window.api.sniper.getSession(sessionId);
      if (session.success && session.session) {
        const sess = session.session;
        setResults((prev) => ({
          ...prev,
          valid: sess.valid || prev.valid,
          taken: sess.taken || prev.taken,
          censored: sess.censored || prev.censored,
          progress:
            sess.checked && sess.usernames.length
              ? (sess.checked / sess.usernames.length) * 100
              : prev.progress,
          status: "running",
          currentLoop: sess.currentLoop || prev.currentLoop,
          totalLoops: sess.totalLoops ?? sess.loopCount ?? prev.totalLoops,
        }));
      }
    } catch (error) {
      console.error("Failed to resume sniper:", error);
      isRunningRef.current = false;
      setResults((prev) => ({ ...prev, status: "paused" }));
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
    <div className="h-full flex flex-col p-6 overflow-y-auto space-y-6 bg-[var(--color-background)]">
      {}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <Play className="w-4 h-4 text-[var(--accent-color)]" />
          <h1 className="text-md font-bold tracking-tight text-[var(--color-text-primary)]">
            Username Sniper
          </h1>
        </div>
      </div>

      {}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl mx-auto flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl shadow-sm gap-4"
      >
        <div className="flex items-center gap-4">
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
            className={`group cursor-pointer flex flex-col items-start gap-1 rounded-md px-3 py-2 transition ${
              sessionId ? "opacity-60" : "hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {fileName || "Upload Username List (.txt)"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {usernames.length > 0
                ? `${usernames.length} usernames`
                : "No file selected"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sessionId && results.status === "idle" && (
            <Button
              onClick={handleStartSniper}
              className="bg-[var(--accent-color)]"
            >
              Start Scan
            </Button>
          )}
          {sessionId && results.status === "running" && (
            <>
              <Button
                onClick={handlePauseSniper}
                variant="outline"
                className="text-amber-500"
              >
                Pause
              </Button>
              <Button
                onClick={handleStopSniper}
                variant="ghost"
                className="text-red-500"
              >
                Stop
              </Button>
            </>
          )}
          {sessionId && results.status === "paused" && (
            <>
              <Button
                onClick={handleResumeSniper}
                variant="outline"
                className="text-emerald-500"
              >
                Resume
              </Button>
              <Button
                onClick={handleStopSniper}
                variant="ghost"
                className="text-red-500"
              >
                Stop
              </Button>
            </>
          )}
          {sessionId && results.status === "completed" && (
            <Button onClick={handleClearSession} variant="ghost">
              Clear Session
            </Button>
          )}

          <Button onClick={() => setShowSettings((v) => !v)} variant="outline">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-4xl mx-auto flex-1 flex flex-col"
      >
        {}
        {results.status !== "idle" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {[
              {
                label: "Valid",
                value: results.valid.length,
                color: "text-emerald-500",
              },
              {
                label: "Taken",
                value: results.taken.length,
                color: "text-amber-500",
              },
              {
                label: "Censored",
                value: results.censored.length,
                color: "text-red-500",
              },
              {
                label: "Progress",
                value: `${results.progress.toFixed(0)}%`,
                color: "text-sky-500",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border p-3 bg-[var(--color-surface-strong)]"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {s.label}
                </p>
                <p className={`mt-1 text-2xl font-black ${s.color}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {results.status === "running" && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4 mb-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Scanning... Loop{" "}
                {results.currentLoop}/{results.totalLoops}
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

        {}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col h-full min-h-[240px] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" /> Valid
              Usernames{" "}
              <span className="text-[10px] bg-[var(--accent-color-faint)] text-[var(--accent-color)] px-2 py-0.5 rounded ml-2">
                {results.valid.length}
              </span>
            </h2>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  void navigator.clipboard.writeText(results.valid.join("\n"))
                }
                size="sm"
                variant="outline"
              >
                Copy All
              </Button>
              <Button onClick={handleExportValid} size="sm" variant="ghost">
                Export
              </Button>
            </div>
          </div>

          {results.valid.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
              No valid usernames yet
            </div>
          ) : (
            <div className="overflow-y-auto space-y-2 max-h-[360px] pr-1">
              {results.valid.map((username, idx) => (
                <div
                  key={`${username}-${idx}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 bg-[var(--color-surface)]"
                >
                  <div className="font-mono text-sm text-[var(--color-text-primary)] truncate">
                    {username}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(username)
                      }
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
              <Sparkles size={16} className="text-[var(--accent-color)]" />{" "}
              Generated Accounts{" "}
              <span className="ml-1 rounded-full bg-[var(--accent-color-faint)] px-2 py-0.5 text-xs font-bold text-[var(--accent-color)]">
                {generatedAccounts.length}
              </span>
            </h3>
            <div className="flex gap-2">
              {generatedAccounts.length > 0 && (
                <>
                  <Button onClick={handleBulkCopy} size="sm" variant="outline">
                    Bulk Copy
                  </Button>
                  <Button
                    onClick={handleClearAllAccounts}
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                  >
                    Clear All
                  </Button>
                </>
              )}
            </div>
          </div>

          {generatedAccounts.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-[var(--color-text-muted)]">
              No generated accounts yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto">
              {generatedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="border rounded-lg p-3 flex flex-col justify-between bg-[var(--color-surface)]"
                >
                  <div className="truncate">
                    <div className="font-mono text-sm font-bold text-[var(--color-text-primary)] truncate">
                      {account.username}
                    </div>
                    <div className="text-[9px] text-[var(--color-text-muted)] mt-1">
                      {account.password ? (
                        <span className="text-emerald-500">
                          ● Credentials available
                        </span>
                      ) : (
                        <span>○ Waiting for data</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end pt-3">
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          `${account.username}:${account.password || ""}:${account.cookie || ""}`,
                        )
                      }
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    >
                      <Clipboard size={14} />
                    </button>
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          account.password || "",
                        )
                      }
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    >
                      <Key size={14} />
                    </button>
                    <button
                      onClick={() => void handleDeleteAccount(account.id)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                    <Button
                      onClick={() => void handleAddToAccounts(account)}
                      size="sm"
                      variant="outline"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

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
