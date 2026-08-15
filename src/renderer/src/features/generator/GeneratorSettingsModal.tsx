import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Settings2,
  Hash,
  KeyRound,
  Zap,
  MonitorSmartphone,
  Shield,
  Globe,
} from "lucide-react";
import { Button } from "@renderer/components/UI/buttons/Button";
import CustomCheckbox from "@renderer/components/UI/buttons/CustomCheckbox";

interface GeneratorConfig {
  usernamePrefix: string;
  passwordLength: number;
  includeSpecialChars: boolean;
  selectedClient?: string;
  multiGenerateCount: number;
  autoSwapBrowser: boolean;
}

interface GeneratorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GeneratorConfig;
  setConfig: React.Dispatch<React.SetStateAction<GeneratorConfig>>;
  handleUpdateConfig: () => void;
  isSavingConfig: boolean;
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

export const GeneratorSettingsModal = ({
  isOpen,
  onClose,
  config,
  setConfig,
  handleUpdateConfig,
  isSavingConfig,
}: GeneratorSettingsModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dark Blurred Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Element */}
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
                <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                  <Settings2 size={16} className="text-indigo-500" />
                  Advanced Settings Engine
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Config Body */}
              <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Username Prefix Input Row */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    <Hash size={12} /> Handle Prefix Context
                  </label>
                  <input
                    type="text"
                    value={config.usernamePrefix}
                    onChange={(e) =>
                      setConfig({ ...config, usernamePrefix: e.target.value })
                    }
                    className="w-full h-9 rounded-lg bg-[var(--color-surface-strong)] border border-[var(--color-border)] px-3 text-xs font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                    placeholder="sentra_"
                  />
                </div>

                {/* Password Configuration Row */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      <KeyRound size={12} /> Password Entropy Length
                    </label>
                    <span className="text-[10px] font-mono font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                      {config.passwordLength} chars
                    </span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    value={config.passwordLength}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        passwordLength: Number(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-[var(--color-surface-strong)] rounded-lg appearance-none cursor-pointer border border-[var(--color-border)] accent-indigo-500 my-2"
                  />
                </div>

                {/* Batch Allocation Counter */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    <Zap size={12} /> Execution Run Size
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setConfig({
                          ...config,
                          multiGenerateCount: Math.max(
                            1,
                            config.multiGenerateCount - 1,
                          ),
                        })
                      }
                      className="w-9 h-9 p-0 rounded-lg text-xs"
                    >
                      -
                    </Button>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={config.multiGenerateCount}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          multiGenerateCount: Math.max(
                            1,
                            parseInt(e.target.value) || 1,
                          ),
                        })
                      }
                      className="flex-1 h-9 rounded-lg bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-center text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:border-indigo-500 shadow-inner"
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        setConfig({
                          ...config,
                          multiGenerateCount: Math.min(
                            50,
                            config.multiGenerateCount + 1,
                          ),
                        })
                      }
                      className="w-9 h-9 p-0 rounded-lg text-xs"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Target Client Runtime Picker */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    <MonitorSmartphone size={12} /> Target User-Agent Context
                  </label>
                  <select
                    value={config.selectedClient || "Chrome Desktop"}
                    onChange={(e) =>
                      setConfig({ ...config, selectedClient: e.target.value })
                    }
                    className="w-full h-9 rounded-lg bg-[var(--color-surface-strong)] border border-[var(--color-border)] px-3 text-xs font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-indigo-500 transition-colors appearance-none shadow-inner cursor-pointer"
                  >
                    {CLIENT_NAMES.map((client) => (
                      <option key={client} value={client}>
                        {client}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Checkbox Matrix Layout */}
                <div className="grid grid-cols-1 gap-2 pt-3 border-t border-[var(--color-border)]">
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)]/40 px-3 py-2.5 transition-colors hover:border-indigo-500/30">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <Shield size={14} className="text-purple-400" />
                      Inject Special Matrix Characters
                    </span>
                    <CustomCheckbox
                      checked={config.includeSpecialChars}
                      onChange={() =>
                        setConfig({
                          ...config,
                          includeSpecialChars: !config.includeSpecialChars,
                        })
                      }
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-strong)]/40 px-3 py-2.5 transition-colors hover:border-indigo-500/30">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <Globe size={14} className="text-emerald-400" />
                      Auto-Rotate Fingerprints (Multi-Run)
                    </span>
                    <CustomCheckbox
                      checked={config.autoSwapBrowser}
                      onChange={() =>
                        setConfig({
                          ...config,
                          autoSwapBrowser: !config.autoSwapBrowser,
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              {/* Layout Footer Actions */}
              <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-strong)]/20 px-4 py-3 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="h-8 text-xs px-4"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    handleUpdateConfig();
                    onClose();
                  }}
                  className="h-8 text-xs px-4 bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)]"
                  disabled={isSavingConfig}
                >
                  {isSavingConfig ? "Saving..." : "Apply"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
