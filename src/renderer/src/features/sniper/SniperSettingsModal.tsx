import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, RotateCcw, Timer, Sparkles, Sliders } from "lucide-react";
import { Button } from "@renderer/components/UI/buttons/Button";
import CustomCheckbox from "@renderer/components/UI/buttons/CustomCheckbox";

interface SniperSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: boolean;
  loopEnabled: boolean;
  setLoopEnabled: (val: boolean) => void;
  loopCount: number;
  setLoopCount: (val: number) => void;
  checkInterval: number;
  setCheckInterval: (val: number) => void;
  autoGenerate: boolean;
  setAutoGenerate: (val: boolean) => void;
}

export const SniperSettingsModal = ({
  isOpen,
  onClose,
  sessionId,
  loopEnabled,
  setLoopEnabled,
  loopCount,
  setLoopCount,
  checkInterval,
  setCheckInterval,
  autoGenerate,
  setAutoGenerate,
}: SniperSettingsModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
              {/* Header Container */}
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3.5 bg-[var(--color-surface-strong)]/20">
                <h2 className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                  <Settings size={14} className="text-indigo-500" />
                  Scanner Parameters Engine
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Form Config Body */}
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Loop Parameter Toggler */}
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)]/40 px-3 py-2.5 transition-colors hover:border-indigo-500/20">
                    <span className="text-[11px] font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <RotateCcw size={13} className="text-purple-400" />
                      Loop Scanning Pipeline
                    </span>
                    <CustomCheckbox
                      checked={loopEnabled}
                      onChange={() => setLoopEnabled(!loopEnabled)}
                      disabled={sessionId}
                    />
                  </label>
                </div>

                {/* Conditional Loop Counter Row */}
                {loopEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-1.5"
                  >
                    <label className="flex items-center gap-2 text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      <Sliders size={11} /> Total Iteration Passes
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        onClick={() => setLoopCount(Math.max(1, loopCount - 1))}
                        disabled={sessionId}
                        className="w-8 h-8 p-0 rounded-lg text-xs"
                      >
                        -
                      </Button>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={loopCount}
                        disabled={sessionId}
                        onChange={(e) =>
                          setLoopCount(
                            Math.max(1, parseInt(e.target.value, 10) || 1),
                          )
                        }
                        className="flex-1 h-8 rounded-lg bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-center text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:border-indigo-500 shadow-inner disabled:opacity-50"
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          setLoopCount(Math.min(50, loopCount + 1))
                        }
                        disabled={sessionId}
                        className="w-8 h-8 p-0 rounded-lg text-xs"
                      >
                        +
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Delay Timing Threshold */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      <Timer size={11} /> Network Request Interval
                    </label>
                    <span className="text-[10px] font-mono font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                      {checkInterval} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5000"
                    step="1"
                    value={checkInterval}
                    disabled={sessionId}
                    onChange={(e) =>
                      setCheckInterval(
                        Math.max(1, parseInt(e.target.value, 10) || 200),
                      )
                    }
                    className="w-full h-1 bg-[var(--color-surface-strong)] rounded-lg appearance-none cursor-pointer border border-[var(--color-border)] accent-indigo-500 my-1.5 disabled:opacity-40"
                  />
                </div>

                {/* Automation Provision Trigger */}
                <div className="pt-2 border-t border-[var(--color-border)]/60">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)]/40 px-3 py-2.5 transition-colors hover:border-indigo-500/20">
                    <span className="text-[11px] font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <Sparkles size={13} className="text-emerald-400" />
                      Auto-Generate On Hit
                    </span>
                    <CustomCheckbox
                      checked={autoGenerate}
                      onChange={() => setAutoGenerate(!autoGenerate)}
                    />
                  </label>
                </div>
              </div>

              {/* Layout Footer Actions */}
              <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-strong)]/20 px-4 py-2.5 flex items-center justify-end">
                <Button
                  variant="default"
                  onClick={onClose}
                  className="h-7.5 text-xs px-5 bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] font-medium rounded-lg shadow-sm border-0"
                >
                  Confirm Configuration
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
