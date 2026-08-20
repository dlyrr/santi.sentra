import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, Flame, Loader2, Sparkles } from "lucide-react";
import { useAccountsManager } from "@renderer/hooks/queries";
import { useNotification } from "@renderer/features/system/stores/useSnackbarStore";
import { Button } from "@renderer/components/UI/buttons/Button";
import CustomDropdown, {
  DropdownOption,
} from "@renderer/components/UI/menus/CustomDropdown";

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

export default function WarmerTab() {
  const { accounts = [] } = useAccountsManager();
  const { showNotification } = useNotification();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>("all");
  const [isWarming, setIsWarming] = useState(false);
  const [warmingProgress, setWarmingProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [warmingTasks, setWarmingTasks] = useState<WarmingTask[]>(
    DEFAULT_WARMING_TASKS,
  );

  const groupOptions: DropdownOption[] = [
    { value: "all", label: "All accounts" },
    ...accounts.map((acc) => ({
      value: acc.id,
      label: acc.displayName || acc.username,
      subLabel: `@${acc.username}`,
    })),
  ];

  const selectedAccounts =
    selectedGroupId === "all"
      ? accounts
      : accounts.filter((account) => account.id === selectedGroupId);

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
    } catch (error) {
      console.error(error);
      showNotification("Warm cycle failed", "error");
    } finally {
      setIsWarming(false);
      setWarmingProgress({ completed: 0, total: selectedAccounts.length });
    }
  }, [selectedAccounts, warmingTasks, showNotification]);

  const progressPercent =
    warmingProgress.total > 0
      ? (warmingProgress.completed / warmingProgress.total) * 100
      : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  Warmer
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Keep fresh accounts looking active without forcing anything
                  risky.
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              low-noise activity
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    Target accounts
                  </label>
                  <CustomDropdown
                    options={groupOptions}
                    value={selectedGroupId || "all"}
                    onChange={(value) =>
                      setSelectedGroupId(value === "all" ? "all" : value)
                    }
                    placeholder="Select accounts"
                  />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                      Warm steps
                    </label>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {warmingTasks.filter((task) => task.enabled).length}{" "}
                      enabled
                    </span>
                  </div>

                  <div className="space-y-2">
                    {warmingTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3 text-left transition-colors hover:border-[var(--color-border-strong)]"
                      >
                        <input
                          type="checkbox"
                          checked={task.enabled}
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
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  Queue summary
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                      {selectedAccounts.length}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      selected
                    </div>
                  </div>
                  <div className="h-px bg-[var(--color-border)]" />
                  <div>
                    <div className="text-sm text-[var(--color-text-primary)] font-medium">
                      {warmingTasks.filter((task) => task.enabled).length}{" "}
                      active steps
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Safe, browser-driven activity only.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isWarming && (
              <div className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>Progress</span>
                  <span>
                    {warmingProgress.completed} / {warmingProgress.total}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <Button
                onClick={handleStartWarming}
                disabled={isWarming}
                className="flex-1 rounded-xl bg-[var(--accent-color)] text-[var(--accent-color-foreground)] hover:opacity-90"
              >
                {isWarming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running warm cycle
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start warm cycle
                  </>
                )}
              </Button>
              <Button
                onClick={() =>
                  setWarmingProgress({
                    completed: 0,
                    total: selectedAccounts.length,
                  })
                }
                variant="ghost"
                className="rounded-xl"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
