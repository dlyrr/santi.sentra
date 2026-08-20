import React, { useState, useEffect, useRef } from "react";
import { Button } from "@renderer/components/UI/buttons/Button";
import {
  Wand2,
  Trash2,
  Settings,
  Clipboard,
  Key,
  Zap,
  Check,
  UserPlus,
  X,
} from "lucide-react";
import { useAccountsManager } from "../auth/api/useAccounts";
import { AccountStatus } from "@renderer/types";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratorSettingsModal } from "./GeneratorSettingsModal";

interface GeneratedAccountData {
  id: string;
  username: string;
  password: string;
  email?: string;
  birthDate?: string;
  createdAt: number;
}

interface GeneratorConfig {
  usernamePrefix: string;
  passwordLength: number;
  includeSpecialChars: boolean;
  selectedClient?: string;
  multiGenerateCount: number;
  autoSwapBrowser: boolean;
}

const CLIENT_NAMES = [
  "Chrome Desktop",
  "Firefox Desktop",
  "Safari macOS",
  "Edge Windows",
  "Opera",
  "Brave",
  "Vivaldi",
  "Google Bot",
  "Custom",
];

export const GeneratorTab = () => {
  const [config, setConfig] = useState<GeneratorConfig>({
    usernamePrefix: "sentra_",
    passwordLength: 16,
    includeSpecialChars: true,
    selectedClient: "Chrome Desktop",
    multiGenerateCount: 1,
    autoSwapBrowser: false,
  });

  const [createdAccounts, setCreatedAccounts] = useState<
    GeneratedAccountData[]
  >([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAddingToAccounts, setIsAddingToAccounts] = useState<string | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const cancelGenerationRef = useRef(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [customInputActive, setCustomInputActive] = useState(false);

  const { addAccount } = useAccountsManager();

  useEffect(() => {
    loadConfig();
    loadAccounts();
  }, []);

  const loadConfig = async () => {
    try {
      const result = await window.api.generator.getConfig();
      if (result.success) setConfig(result.config);
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await window.api.generator.getAccounts();
      setCreatedAccounts((response?.accounts || []) as GeneratedAccountData[]);
    } catch (err) {
      console.error("Failed to load generator accounts:", err);
      setCreatedAccounts([]);
    }
  };

  const handleCancelGeneration = () => {
    cancelGenerationRef.current = true;
    setIsCancelling(true);
  };

  const handleCreateAccount = async () => {
    cancelGenerationRef.current = false;
    setIsCancelling(false);
    setIsCreating(true);
    const countToGenerate = config.multiGenerateCount;
    const originalClient = config.selectedClient;
    setGenerationProgress({ current: 0, total: countToGenerate });
    try {
      let clientIndex = CLIENT_NAMES.indexOf(
        originalClient || "Chrome Desktop",
      );
      for (let i = 0; i < countToGenerate; i++) {
        if (cancelGenerationRef.current) break;

        if (config.autoSwapBrowser && i > 0) {
          clientIndex = (clientIndex + 1) % CLIENT_NAMES.length;
          setConfig((prev) => ({
            ...prev,
            selectedClient: CLIENT_NAMES[clientIndex],
          }));
        }
        try {
          const cancelPromise = new Promise<never>((_, reject) => {
            const interval = setInterval(() => {
              if (cancelGenerationRef.current) {
                clearInterval(interval);
                reject(new Error("cancelled"));
              }
            }, 100);
          });
          const result = await Promise.race([
            window.api.generator.createAccount(),
            cancelPromise,
          ]);
          if (result.success && result.accountId) {
            await loadAccounts();

            const freshAccounts = await window.api.generator.getAccounts();
            const newAcc = (freshAccounts?.accounts || []).find(
              (a: GeneratedAccountData) => a.id === result.accountId,
            );
            if (newAcc) await handleAddToAccounts(newAcc);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (err: any) {
          if (err?.message === "cancelled" || cancelGenerationRef.current)
            break;
          console.error(`Failed to create account ${i + 1}:`, err);
        }
        if (cancelGenerationRef.current) break;
        setGenerationProgress({ current: i + 1, total: countToGenerate });
      }

      setConfig((prev) => ({ ...prev, selectedClient: originalClient }));
      await loadAccounts();
    } catch (err) {
      console.error("Failed to create accounts:", err);
    } finally {
      setIsCreating(false);
      setIsCancelling(false);
      setGenerationProgress(null);
      cancelGenerationRef.current = false;
    }
  };

  const handleAddToAccounts = async (account: GeneratedAccountData) => {
    setIsAddingToAccounts(account.id);
    try {
      const cookieResult = await window.api.generator.getCookie(account.id);
      const cookie = cookieResult.success ? cookieResult.cookie : "";
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
      } catch (err) {}

      try {
        const avatarResult = await window.api.user.getAvatarUrlByUsername(
          account.username,
        );
        avatarUrl = avatarResult?.url || "";
      } catch (err) {}

      addAccount({
        id: uuidv4(),
        username: account.username,
        displayName: displayName,
        userId: userId,
        cookie: cookie || undefined,
        status: AccountStatus.Offline,
        avatarUrl: avatarUrl,
        lastActive: new Date().toISOString(),
        robuxBalance: 0,
        friendCount: 0,
        followerCount: 0,
        followingCount: 0,
        notes: "",
      });
    } catch (err) {
      console.error("Failed to add account:", err);
    } finally {
      setIsAddingToAccounts(null);
    }
  };

  const handleUpdateConfig = async () => {
    setIsSavingConfig(true);
    try {
      await window.api.generator.updateConfig(config);
      setShowSettings(false);
    } catch (err) {
      console.error("Failed to update config:", err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleClearAccounts = async () => {
    if (
      confirm(
        "Are you sure you want to clear all generated accounts from your inventory?",
      )
    ) {
      try {
        await window.api.generator.clearAccounts();
        setCreatedAccounts([]);
      } catch (err) {}
    }
  };

  const triggerCopyFeedback = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleBulkCopy = async () => {
    try {
      const bulkData: string[] = [];
      for (const account of createdAccounts) {
        try {
          const passwordResult = await window.api.generator.getPassword(
            account.id,
          );
          const cookieResult = await window.api.generator.getCookie(account.id);
          bulkData.push(
            `${account.username}:${passwordResult?.password || ""}:${cookieResult?.cookie || ""}`,
          );
        } catch (err) {
          bulkData.push(`${account.username}::`);
        }
      }
      await navigator.clipboard.writeText(bulkData.join("\n"));
      triggerCopyFeedback("bulk");
    } catch (err) {}
  };

  const presets = [1, 5, 10, 25];
  const isPresetSelected =
    presets.includes(config.multiGenerateCount) && !customInputActive;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto space-y-6 bg-[var(--color-background)]">
      {}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <Wand2 className="w-4 h-4 text-[var(--accent-color)]" />
          <h1 className="text-md font-bold tracking-tight text-[var(--color-text-primary)]">
            Account Generator
          </h1>
        </div>
      </div>

      {}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl mx-auto flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] p-2.5 rounded-xl shadow-sm gap-4"
      >
        {}
        <div className="flex items-center gap-1.5 bg-[var(--color-surface-strong)]/60 p-1 rounded-lg border border-[var(--color-border)]/60">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-2">
            Batch
          </span>
          <div className="flex items-center gap-1">
            {presets.map((num) => (
              <button
                key={num}
                onClick={() => {
                  setCustomInputActive(false);
                  setConfig((prev) => ({ ...prev, multiGenerateCount: num }));
                }}
                className={`px-3 h-7 rounded-md text-xs font-mono font-bold transition-all ${
                  config.multiGenerateCount === num && !customInputActive
                    ? "bg-[var(--accent-color)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {num}
              </button>
            ))}

            {}
            <div
              className={`flex items-center h-7 px-1.5 rounded-md transition-all ${
                customInputActive || !isPresetSelected
                  ? "bg-[var(--color-background)] border border-[var(--accent-color)]/30"
                  : "hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <input
                type="number"
                min="1"
                max="100"
                placeholder="Custom"
                value={
                  customInputActive || !isPresetSelected
                    ? config.multiGenerateCount
                    : ""
                }
                onFocus={() => setCustomInputActive(true)}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setConfig((prev) => ({
                    ...prev,
                    multiGenerateCount: Math.min(100, Math.max(1, val)),
                  }));
                }}
                className="w-14 text-center bg-transparent border-0 text-xs font-mono font-bold focus:outline-none text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>

        {}
        <div className="flex items-center gap-2">
          {isCreating ? (
            <>
              {}
              {generationProgress && (
                <span className="text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
                  {generationProgress.current}/{generationProgress.total}
                </span>
              )}
              <div className="w-3 h-3 rounded-full border-2 border-[var(--accent-color)]/20 border-t-[var(--accent-color)] animate-spin" />
              <Button
                onClick={handleCancelGeneration}
                disabled={isCancelling}
                className={`h-10 px-5 rounded-lg font-medium text-xs transition-all shadow-sm border-0 flex items-center gap-2 text-[var(--color-text-primary)] ${
                  isCancelling
                    ? "bg-red-800 opacity-60 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>{isCancelling ? "Cancelling..." : "Cancel"}</span>
              </Button>
            </>
          ) : (
            <Button
              onClick={handleCreateAccount}
              className="h-10 px-5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--color-text-primary)] font-medium text-xs transition-all shadow-sm border-0 flex items-center gap-2"
            >
              <Zap className="w-3.5 h-3.5 fill-white/10" />
              <span>Generate ({config.multiGenerateCount})</span>
            </Button>
          )}

          <Button
            onClick={() => setShowSettings(true)}
            disabled={isCreating}
            variant="outline"
            className="h-10 w-10 p-0 rounded-lg border-[var(--color-border)] bg-[var(--color-surface-strong)]/40 hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50"
            title="Open Advanced Customization Panel"
          >
            <Settings className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          </Button>
        </div>
      </motion.div>

      {}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-4xl mx-auto flex-1 flex flex-col"
      >
        <div className="bg-[var(--color-surface)]/30 border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col h-full min-h-[420px]">
          {}
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-strong)]/20">
            <h2 className="text-xs font-bold flex items-center gap-2 text-[var(--color-text-primary)] uppercase tracking-wider">
              Generated accounts
              <span className="bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                {createdAccounts.length} Units
              </span>
            </h2>
            {createdAccounts.length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkCopy}
                  size="sm"
                  variant="outline"
                  className="h-7 border-[var(--accent-color)]/20 text-[var(--accent-color)] text-[11px] hover:bg-[var(--accent-color)]/5"
                >
                  {copiedId === "bulk" ? (
                    <Check className="w-3 h-3 mr-1 text-emerald-500" />
                  ) : (
                    <Clipboard className="w-3 h-3 mr-1" />
                  )}
                  Bulk Export Full Log
                </Button>
                <Button
                  onClick={handleClearAccounts}
                  size="sm"
                  variant="ghost"
                  className="h-7 text-red-500 text-[11px] hover:bg-red-500/5"
                >
                  Flush Table
                </Button>
              </div>
            )}
          </div>

          {}
          <div className="p-4 flex-1 overflow-y-auto">
            {createdAccounts.length === 0 ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-[var(--color-text-muted)] space-y-2">
                <Wand2 className="w-6 h-6 opacity-20" />
                <p className="text-xs font-medium">
                  No accounts generated in memory output.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <AnimatePresence>
                  {createdAccounts.map((account) => (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.99 }}
                      key={account.id}
                      className="border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 rounded-lg p-3 hover:border-[var(--accent-color)]/40 transition-colors flex flex-col gap-2.5 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div className="truncate max-w-[75%]">
                          <div className="font-mono text-xs font-bold text-[var(--color-text-primary)] truncate">
                            {account.username}
                          </div>
                          <div className="text-[9px] font-mono text-[var(--color-text-muted)] mt-0.5">
                            {new Date(account.createdAt).toLocaleTimeString()}
                          </div>
                        </div>

                        <div className="flex bg-[var(--color-background)] border border-[var(--color-border)] rounded p-0.5 gap-0.5">
                          <button
                            onClick={async () => {
                              try {
                                const pr =
                                  await window.api.generator.getPassword(
                                    account.id,
                                  );
                                const cr = await window.api.generator.getCookie(
                                  account.id,
                                );
                                await navigator.clipboard.writeText(
                                  `${account.username}:${pr?.password || ""}:${cr?.cookie || ""}`,
                                );
                                triggerCopyFeedback(account.id + "-all");
                              } catch (err) {}
                            }}
                            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--accent-color)] rounded transition-colors"
                          >
                            {copiedId === account.id + "-all" ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Clipboard className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const result =
                                  await window.api.generator.getPassword(
                                    account.id,
                                  );
                                if (result?.success) {
                                  await navigator.clipboard.writeText(
                                    result.password,
                                  );
                                  triggerCopyFeedback(account.id + "-pass");
                                }
                              } catch (err) {}
                            }}
                            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--accent-color)] rounded transition-colors"
                          >
                            {copiedId === account.id + "-pass" ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Key className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]/40">
                        {account.birthDate ? (
                          <span className="text-[9px] font-mono bg-[var(--color-background)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                            {account.birthDate}
                          </span>
                        ) : (
                          <div />
                        )}

                        <div className="flex items-center gap-1.5">
                          <Button
                            onClick={() => handleAddToAccounts(account)}
                            disabled={isAddingToAccounts === account.id}
                            size="sm"
                            className="h-6 px-2.5 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-[var(--color-text-primary)] border-0 text-[10px] font-semibold rounded transition-colors flex items-center gap-1"
                          >
                            <UserPlus className="w-2.5 h-2.5" />
                            {isAddingToAccounts === account.id
                              ? "Importing..."
                              : "Add to Sentra"}
                          </Button>
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  `Purge data item for "${account.username}"?`,
                                )
                              ) {
                                await window.api.generator.deleteAccount(
                                  account.id,
                                );
                                await loadAccounts();
                              }
                            }}
                            className="p-1 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <GeneratorSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        setConfig={setConfig}
        handleUpdateConfig={handleUpdateConfig}
        isSavingConfig={isSavingConfig}
      />
    </div>
  );
};
