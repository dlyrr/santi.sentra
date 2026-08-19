import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle2, AlertCircle, Settings } from "lucide-react";
import { Account } from "@renderer/types";
import { Button } from "@renderer/components/UI/buttons/Button";
import {
  bulkOperationLimiter,
  executeWithRetry,
  isRateLimitError,
  sleep,
} from "@renderer/lib/rateLimiter";

interface BulkRobloxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccounts: Account[];
  onSuccess?: () => void;
}

export const BulkRobloxSettingsModal = ({
  isOpen,
  onClose,
  selectedAccounts,
  onSuccess,
}: BulkRobloxSettingsModalProps) => {
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<
    { id: string; success: boolean; message?: string }[]
  >([]);

  const handleSubmit = async () => {
    if (!newDisplayName.trim()) return;

    setIsProcessing(true);
    setResults([]);

    const processResults: { id: string; success: boolean; message?: string }[] =
      [];

    for (const acc of selectedAccounts) {
      if (!acc.cookie || !acc.userId) {
        processResults.push({
          id: acc.id,
          success: false,
          message: "Invalid cookie or user ID",
        });
        setResults([...processResults]);
        continue;
      }

      try {
        const result = await executeWithRetry(
          bulkOperationLimiter,
          async () => {
            return await window.api.updateDisplayName(
              acc.cookie!,
              parseInt(acc.userId, 10),
              newDisplayName.trim(),
            );
          },
          {
            retryCondition: (error) => {
              if (isRateLimitError(error)) return true;
              const maybeError = error as any;
              const message =
                typeof maybeError?.message === "string"
                  ? maybeError.message
                  : typeof error === "string"
                    ? error
                    : "";
              return /(?:429|rate limit|too many requests)/i.test(message);
            },
          },
        );

        processResults.push({
          id: acc.id,
          success: result.success,
          message: result.error,
        });
      } catch (err: any) {
        processResults.push({
          id: acc.id,
          success: false,
          message: err.message || "Unknown error",
        });
      }

      setResults([...processResults]);
      await sleep(1000);
    }

    setIsProcessing(false);
    if (onSuccess) onSuccess();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={!isProcessing ? onClose : undefined}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-strong)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--accent-color)]/20 text-[var(--accent-color)]">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Bulk Roblox Settings
                    </h2>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {selectedAccounts.length} accounts selected
                    </p>
                  </div>
                </div>
                {!isProcessing && (
                  <button
                    onClick={onClose}
                    className="pressable p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="p-5 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                      New Display Name
                    </label>
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      disabled={isProcessing}
                      placeholder="Enter new display name..."
                      className="w-full h-10 px-3 bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--accent-color)] transition-colors disabled:opacity-50"
                    />
                  </div>

                  {results.length > 0 && (
                    <div className="mt-6 space-y-2">
                      <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Progress
                      </h3>
                      <div className="space-y-1.5">
                        {results.map((r, idx) => {
                          const acc = selectedAccounts.find(
                            (a) => a.id === r.id,
                          );
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded bg-[var(--color-surface)]/50 border border-[var(--color-border-subtle)] text-sm"
                            >
                              <span className="text-[var(--color-text-secondary)] truncate pr-4">
                                {acc?.username || acc?.id}
                              </span>
                              {r.success ? (
                                <span className="flex items-center gap-1.5 text-emerald-400 shrink-0">
                                  <CheckCircle2 size={14} /> Success
                                </span>
                              ) : (
                                <span
                                  className="flex items-center gap-1.5 text-red-400 shrink-0"
                                  title={r.message}
                                >
                                  <AlertCircle size={14} /> Failed
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-strong)] flex justify-end gap-3 shrink-0">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  {results.length > 0 ? "Close" : "Cancel"}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    isProcessing || !newDisplayName.trim() || results.length > 0
                  }
                  className="min-w-[120px]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />{" "}
                      Processing...
                    </>
                  ) : results.length > 0 ? (
                    "Done"
                  ) : (
                    "Apply to All"
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BulkRobloxSettingsModal;
