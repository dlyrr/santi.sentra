import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Account, AccountStatus } from "@renderer/types";
import { Button } from "@renderer/components/UI/buttons/Button";
import { useNotification } from "@renderer/features/system/stores/useSnackbarStore";
import CustomDropdown, {
  DropdownOption,
} from "@renderer/components/UI/menus/CustomDropdown";

interface BatchOperationsPanelProps {
  accounts: Account[];
  selectedIds: Set<string>;
}

type BatchOperation = "launch" | "validate" | "terminate";

export const BatchOperationsPanel = ({
  accounts,
  selectedIds,
}: BatchOperationsPanelProps) => {
  const { showNotification } = useNotification();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOperationRunning, setIsOperationRunning] = useState(false);
  const [currentOperation, setCurrentOperation] =
    useState<BatchOperation | null>(null);
  const [placeId, setPlaceId] = useState("");
  const [launchGap, setLaunchGap] = useState(500);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const selectedAccounts = accounts.filter((a) => selectedIds.has(a.id));

  const handleLaunchBatch = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      showNotification("No accounts selected", "warning");
      return;
    }

    if (!placeId) {
      showNotification("Please enter a Place ID", "warning");
      return;
    }

    setIsOperationRunning(true);
    setCurrentOperation("launch");
    setProgress({ current: 0, total: selectedAccounts.length });

    try {
      for (let i = 0; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i];
        if (!account.cookie) {
          console.warn(`Skipping ${account.username} - no cookie`);
          continue;
        }

        try {
          await window.electron.ipcRenderer.invoke("games:launch-game", {
            cookie: account.cookie,
            placeId: Number(placeId),
            accountId: account.id,
            username: account.displayName || account.username,
          });
        } catch (err) {
          console.error(`Failed to launch ${account.username}:`, err);
        }

        setProgress((prev) =>
          prev
            ? { ...prev, current: i + 1 }
            : { current: i + 1, total: selectedAccounts.length },
        );

        if (i < selectedAccounts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, launchGap));
        }
      }

      showNotification(
        `Launched ${selectedAccounts.length} account(s) to place ${placeId}`,
        "success",
      );
    } catch (err) {
      showNotification("Error during batch launch", "error");
      console.error(err);
    } finally {
      setIsOperationRunning(false);
      setCurrentOperation(null);
      setProgress(null);
    }
  }, [selectedAccounts, placeId, launchGap, showNotification]);

  const handleValidateBatch = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      showNotification("No accounts selected", "warning");
      return;
    }

    setIsOperationRunning(true);
    setCurrentOperation("validate");
    setProgress({ current: 0, total: selectedAccounts.length });

    let validCount = 0;
    let invalidCount = 0;

    try {
      for (let i = 0; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i];
        if (!account.cookie) {
          invalidCount++;
          continue;
        }

        try {
          await window.api.validateCookie(account.cookie);
          validCount++;
        } catch (err) {
          invalidCount++;
          console.error(`Validation failed for ${account.username}:`, err);
        }

        setProgress((prev) =>
          prev
            ? { ...prev, current: i + 1 }
            : { current: i + 1, total: selectedAccounts.length },
        );

        if (i < selectedAccounts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      showNotification(
        `Validation complete. ${validCount} valid, ${invalidCount} invalid.`,
        invalidCount > 0 ? "warning" : "success",
      );
    } catch (err) {
      showNotification("Error during batch validation", "error");
      console.error(err);
    } finally {
      setIsOperationRunning(false);
      setCurrentOperation(null);
      setProgress(null);
    }
  }, [selectedAccounts, showNotification]);

  const handleTerminateBatch = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      showNotification("No accounts selected", "warning");
      return;
    }

    if (!confirm(`Terminate ${selectedAccounts.length} client(s)?`)) return;

    setIsOperationRunning(true);
    setCurrentOperation("terminate");
    setProgress({ current: 0, total: selectedAccounts.length });

    let terminatedCount = 0;

    try {
      for (let i = 0; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i];

        try {
          if (typeof (window.api as any)?.terminateAccount === "function") {
            await (window.api as any).terminateAccount(account.id);
            terminatedCount++;
          } else {
            console.warn("terminateAccount API not available");
          }
        } catch (err) {
          console.error(`Failed to terminate ${account.username}:`, err);
        }

        setProgress((prev) =>
          prev
            ? { ...prev, current: i + 1 }
            : { current: i + 1, total: selectedAccounts.length },
        );

        if (i < selectedAccounts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      showNotification(`Terminated ${terminatedCount} client(s)`, "success");
    } catch (err) {
      showNotification("Error during batch termination", "error");
      console.error(err);
    } finally {
      setIsOperationRunning(false);
      setCurrentOperation(null);
      setProgress(null);
    }
  }, [selectedAccounts, showNotification]);

  if (selectedAccounts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-surface-hover)] transition-colors border-b border-[var(--color-border)]"
      >
        <ChevronDown
          size={16}
          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          Batch Operations
        </span>
        <span className="ml-auto text-xs bg-[var(--accent-color)] text-[var(--accent-color-foreground)] px-2 py-1 rounded">
          {selectedAccounts.length} selected
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 space-y-4 border-t border-[var(--color-border)]"
          >
            {}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Launch All to Place
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  placeholder="Place ID"
                  disabled={isOperationRunning}
                  className="flex-1 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] disabled:opacity-50"
                />
                <div className="text-xs text-[var(--color-text-muted)] flex items-center px-2">
                  Gap: {launchGap}ms
                </div>
              </div>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={launchGap}
                onChange={(e) => setLaunchGap(Number(e.target.value))}
                disabled={isOperationRunning}
                className="w-full"
              />
              <Button
                onClick={handleLaunchBatch}
                disabled={isOperationRunning || !placeId}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {currentOperation === "launch" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Launch All
              </Button>
            </div>

            {}
            <Button
              onClick={handleValidateBatch}
              disabled={isOperationRunning}
              className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {currentOperation === "validate" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Validate All Cookies
            </Button>

            {}
            <Button
              onClick={handleTerminateBatch}
              disabled={isOperationRunning}
              className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
            >
              {currentOperation === "terminate" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Terminate All Clients
            </Button>

            {}
            {progress && (
              <div className="bg-[var(--color-surface-muted)] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">
                    {currentOperation?.toUpperCase()} PROGRESS
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--accent-color)]"
                    animate={{
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
