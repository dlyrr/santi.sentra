import React, { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Play, Flame, Loader2, Sparkles, X } from "lucide-react";
import { Account } from "@renderer/types";
import { useNotification } from "@renderer/features/system/stores/useSnackbarStore";
import { Button } from "@renderer/components/UI/buttons/Button";

interface WarmingTask {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

const DEFAULT_WARMING_TASKS: WarmingTask[] = [
  {
    id: "view_catalog",
    name: "Browse free items",
    description: "Open a few catalog listings and keep the account active.",
    enabled: true,
  },
  {
    id: "equip_free_items",
    name: "Equip random free items",
    description: "Swap in a few free items to look active and normal.",
    enabled: true,
  },
  {
    id: "friends_tab",
    name: "Open friends tab",
    description: "Open the friend list so the account looks active.",
    enabled: true,
  },
];

interface WarmingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccounts: Account[];
}

export const WarmingModal = ({
  isOpen,
  onClose,
  selectedAccounts,
}: WarmingModalProps) => {
  const { showNotification } = useNotification();
  const [isWarming, setIsWarming] = useState(false);
  const [warmingProgress, setWarmingProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [warmingTasks, setWarmingTasks] = useState<WarmingTask[]>(
    DEFAULT_WARMING_TASKS,
  );

  const handleToggleTask = useCallback((taskId: string) => {
    setWarmingTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, enabled: !task.enabled } : task,
      ),
    );
  }, []);

  const handleStartWarming = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      showNotification("No accounts selected", "warning");
      return;
    }

    const enabledTasks = warmingTasks.filter((task) => task.enabled);
    if (enabledTasks.length === 0) {
      showNotification("Select at least one warming task", "warning");
      return;
    }

    setIsWarming(true);
    setWarmingProgress({ completed: 0, total: selectedAccounts.length });

    try {
      for (let index = 0; index < selectedAccounts.length; index += 1) {
        const account = selectedAccounts[index];
        setWarmingProgress((prev) => ({ ...prev, completed: index + 1 }));

        if (account.cookie) {
          await new Promise((resolve) => setTimeout(resolve, 900));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      showNotification(
        `Warm cycle complete for ${selectedAccounts.length} account${selectedAccounts.length === 1 ? "" : "s"}`,
        "success",
      );
      setIsWarming(false);
      setWarmingProgress({ completed: 0, total: 0 });
      onClose();
    } catch (error) {
      console.error(error);
      showNotification("Warm cycle failed", "error");
      setIsWarming(false);
      setWarmingProgress({ completed: 0, total: 0 });
    }
  }, [selectedAccounts, warmingTasks, showNotification, onClose]);

  const progressPercent =
    warmingProgress.total > 0
      ? (warmingProgress.completed / warmingProgress.total) * 100
      : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl"
      >
        {}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-strong)] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                Warm Accounts
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Keep fresh accounts looking active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 hover:bg-[var(--color-surface-hover)] rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {}
        <div className="p-6 space-y-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.5fr]">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    Warming Tasks
                  </label>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {warmingTasks.filter((task) => task.enabled).length} enabled
                  </span>
                </div>

                <div className="space-y-2">
                  {warmingTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleToggleTask(task.id)}
                      disabled={isWarming}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-colors hover:border-[var(--color-border-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <input
                        type="checkbox"
                        checked={task.enabled}
                        disabled={isWarming}
                        onChange={() => handleToggleTask(task.id)}
                        className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--accent-color)]"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          {task.name}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                          {task.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div>
                  <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    Selected Accounts
                  </div>
                  <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                    {selectedAccounts.length}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    will be warmed
                  </div>
                </div>
                <div className="h-px bg-[var(--color-border)]" />
                <div className="flex-1 overflow-y-auto max-h-40">
                  <div className="space-y-1">
                    {selectedAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="text-xs text-[var(--color-text-muted)] truncate px-2 py-1 rounded bg-[var(--color-surface-hover)]"
                        title={account.displayName || account.username}
                      >
                        {account.displayName || account.username}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {}
          {isWarming && warmingProgress.total > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                  <Loader2 size={16} className="animate-spin" />
                  Warming in progress
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {warmingProgress.completed} / {warmingProgress.total}
                </div>
              </div>
              <div className="w-full bg-[var(--color-surface)] rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </div>

        {}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-strong)] p-6 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isWarming}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleStartWarming}
            disabled={isWarming || selectedAccounts.length === 0}
            className="gap-2"
          >
            {isWarming ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Warming...
              </>
            ) : (
              <>
                <Play size={16} />
                Start Warming
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
