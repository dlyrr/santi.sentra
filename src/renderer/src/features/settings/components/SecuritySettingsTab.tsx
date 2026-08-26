import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  Globe,
  RotateCcw,
  Zap,
  Sliders,
  AlertTriangle,
  Download,
  Trash2,
  RotateCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BentoCard,
  BentoToggle,
  SectionDivider,
  PageHeader,
} from "./SharedComponents";
import CustomDropdown from "../../../components/UI/menus/CustomDropdown";
import BackupIcon from "../../../components/UI/icons/BackupIcon";
import { Account, Settings } from "../../../types";
import { useSetAppUnlocked } from "../../../stores/useUIStore";
import { useNotificationTrayStore } from "../../system/stores/useNotificationTrayStore";
import { queryKeys } from "../../../../../shared/queryKeys";
import { LAST_PIN_INDEX, PIN_POLICY, emptyPinDigits } from "@shared/pinPolicy";
import PinSetupDialog from "../../../components/UI/security/PinSetupDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
} from "../../../components/UI/dialogs/Dialog";
import RobloxAdvancedSettings from "./RobloxAdvancedSettings";
import UserAgentSettingsModal from "./UserAgentSettingsModal";

interface SecuritySettingsTabProps {
  accounts: Account[];
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
}

const isMac = window.platform?.isMac ?? false;

export const SecuritySettingsTab: React.FC<SecuritySettingsTabProps> = ({
  accounts,
  settings,
  onUpdateSettings,
}) => {
  const queryClient = useQueryClient();
  const setAppUnlocked = useSetAppUnlocked();
  const addNotification = useNotificationTrayStore((s) => s.addNotification);

  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [backupStep, setBackupStep] = useState<"pin" | "backuppin">("pin");
  const [restoreStep, setRestoreStep] = useState<"pin" | "backuppin" | "file">(
    "pin",
  );
  const [backupPin, setBackupPin] = useState<string[]>(emptyPinDigits);
  const [backupPinConfirm, setBackupPinConfirm] =
    useState<string[]>(emptyPinDigits);
  const [restorePin, setRestorePin] = useState<string[]>(emptyPinDigits);
  const [restoreBackupPin, setRestoreBackupPin] =
    useState<string[]>(emptyPinDigits);
  const [selectedBackupFile, setSelectedBackupFile] = useState<string | null>(
    null,
  );
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRobloxSettingsOpen, setIsRobloxSettingsOpen] = useState(false);
  const [isUserAgentModalOpen, setIsUserAgentModalOpen] = useState(false);
  const [handle64IsInstalled, setHandle64IsInstalled] = useState(false);
  const [handle64IsLoading, setHandle64IsLoading] = useState(false);

  const handleRobloxSettingsChange = useCallback(
    async (updates: Partial<Settings>) => {
      onUpdateSettings(updates);
    },
    [onUpdateSettings],
  );

  const [currentUserAgent, setCurrentUserAgent] = useState<string>("");
  const [userAgentIndex, setUserAgentIndex] = useState<number>(0);
  const [allUserAgents, setAllUserAgents] = useState<string[]>([]);
  const [isAutoSwapEnabled, setIsAutoSwapEnabled] = useState<boolean>(false);
  const [autoSwapInterval, setAutoSwapInterval] = useState<number>(30);
  const [isLoadingUserAgent, setIsLoadingUserAgent] = useState(false);

  const backupPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const backupPinConfirmRefs = useRef<(HTMLInputElement | null)[]>([]);
  const restorePinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const restoreBackupPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isBackupDialogOpen) {
      backupPinRefs.current = [];
      backupPinConfirmRefs.current = [];
    }
  }, [isBackupDialogOpen]);

  useEffect(() => {
    if (!isRestoreDialogOpen) {
      restorePinRefs.current = [];
      restoreBackupPinRefs.current = [];
    }
  }, [isRestoreDialogOpen]);

  useEffect(() => {
    const loadUserAgentState = async () => {
      try {
        setIsLoadingUserAgent(true);
        const state = await window.api.getUserAgentState();
        setCurrentUserAgent(state.currentUserAgent);
        setUserAgentIndex(state.currentIndex);
        setIsAutoSwapEnabled(state.autoSwapEnabled);
        setAutoSwapInterval(state.autoSwapIntervalMinutes);
        const agents = await window.api.getAllUserAgents();
        setAllUserAgents(agents);
      } catch (error) {
        console.error("[Settings] Failed to load user agent state:", error);
      } finally {
        setIsLoadingUserAgent(false);
      }
    };
    loadUserAgentState();
  }, []);

  useEffect(() => {
    const checkHandle64Status = async () => {
      if (
        settings.allowMultipleInstances &&
        settings.multiInstanceMethod === "handle64"
      ) {
        try {
          const installed = await window.api.handle64IsInstalled();
          setHandle64IsInstalled(installed);
        } catch (error) {
          console.error("[Settings] Failed to check handle64 status:", error);
        }
      }
    };
    checkHandle64Status();
  }, [settings.allowMultipleInstances, settings.multiInstanceMethod]);

  const handleRotateNext = async () => {
    try {
      setIsLoadingUserAgent(true);
      const result = await window.api.swapUserAgent();
      setCurrentUserAgent(result.userAgent);
      setUserAgentIndex(result.index);
      addNotification({
        type: "success",
        title: "User Agent Swapped",
        message: `Rotated to user agent #${result.index + 1}`,
      });
    } catch (error) {
      console.error("[SettingsTab] Failed to swap user agent:", error);
      addNotification({
        type: "error",
        title: "Swap Failed",
        message:
          error instanceof Error ? error.message : "Failed to swap user agent",
      });
    } finally {
      setIsLoadingUserAgent(false);
    }
  };

  const handleSelectAgent = async (index: number) => {
    try {
      setIsLoadingUserAgent(true);
      const result = await window.api.setUserAgentIndex(index);
      setCurrentUserAgent(result.userAgent);
      setUserAgentIndex(result.index);
      addNotification({
        type: "success",
        title: "User Agent Selected",
        message: `Switched to user agent #${result.index + 1}`,
      });
    } catch (error) {
      console.error("[SettingsTab] Failed to set user agent:", error);
      addNotification({
        type: "error",
        title: "Selection Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to select user agent",
      });
    } finally {
      setIsLoadingUserAgent(false);
    }
  };

  const handleToggleAutoSwap = async () => {
    try {
      setIsLoadingUserAgent(true);
      const result = await window.api.setAutoSwapUserAgent(
        !isAutoSwapEnabled,
        autoSwapInterval,
      );
      setIsAutoSwapEnabled(result.autoSwapEnabled);
      addNotification({
        type: "success",
        title: result.autoSwapEnabled
          ? "Auto-rotate Enabled"
          : "Auto-rotate Disabled",
        message: result.autoSwapEnabled
          ? `User agent will rotate every ${result.intervalMinutes} minutes`
          : "Automatic user agent rotation disabled",
      });
    } catch (error) {
      console.error("[SettingsTab] Failed to toggle auto-swap:", error);
      addNotification({
        type: "error",
        title: "Toggle Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to toggle auto-rotate",
      });
    } finally {
      setIsLoadingUserAgent(false);
    }
  };

  const handleHandle64Install = async () => {
    try {
      setHandle64IsLoading(true);
      const success = await window.api.handle64Install();
      if (success) {
        setHandle64IsInstalled(true);
        addNotification({
          type: "success",
          title: "Handle64 Installed",
          message: "Multi-instance driver installed successfully",
        });
      } else {
        addNotification({
          type: "error",
          title: "Installation Failed",
          message: "Failed to install Handle64",
        });
      }
    } catch (error) {
      console.error("[SettingsTab] Failed to install handle64:", error);
      addNotification({
        type: "error",
        title: "Installation Error",
        message:
          error instanceof Error ? error.message : "Failed to install Handle64",
      });
    } finally {
      setHandle64IsLoading(false);
    }
  };

  const handleHandle64Refresh = async () => {
    try {
      setHandle64IsLoading(true);
      const installed = await window.api.handle64IsInstalled();
      setHandle64IsInstalled(installed);
      addNotification({
        type: "success",
        title: "Status Updated",
        message: installed
          ? "Handle64 is installed"
          : "Handle64 is not installed",
      });
    } catch (error) {
      console.error("[SettingsTab] Failed to refresh handle64 status:", error);
      addNotification({
        type: "error",
        title: "Refresh Failed",
        message:
          error instanceof Error ? error.message : "Failed to check status",
      });
    } finally {
      setHandle64IsLoading(false);
    }
  };

  const handleHandle64Uninstall = async () => {
    if (!confirm("Remove Handle64 driver? You can reinstall it anytime."))
      return;

    try {
      setHandle64IsLoading(true);
      const success = await window.api.handle64Uninstall();
      if (success) {
        setHandle64IsInstalled(false);
        addNotification({
          type: "success",
          title: "Handle64 Uninstalled",
          message: "Multi-instance driver removed",
        });
      } else {
        addNotification({
          type: "error",
          title: "Uninstall Failed",
          message: "Failed to uninstall Handle64",
        });
      }
    } catch (error) {
      console.error("[SettingsTab] Failed to uninstall handle64:", error);
      addNotification({
        type: "error",
        title: "Uninstall Error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to uninstall Handle64",
      });
    } finally {
      setHandle64IsLoading(false);
    }
  };

  const focusFirstRef = (
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => {
    const tryFocus = () => {
      for (let i = 0; i < refs.current.length; i++) {
        const el = refs.current[i];
        if (el) {
          try {
            el.focus();
            el.select && el.select();
            return true;
          } catch (e) {
            console.warn(
              "Failed to load FFlags:",
              e instanceof Error ? e.message : String(e),
            );
          }
        }
      }
      return false;
    };

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        if (!tryFocus()) setTimeout(tryFocus, 50);
      });
    } else {
      tryFocus();
    }
  };

  useEffect(() => {
    if (isBackupDialogOpen && backupStep === "pin") {
      backupPinRefs.current = new Array(PIN_POLICY.length).fill(null);
      backupPinConfirmRefs.current = new Array(PIN_POLICY.length).fill(null);
      focusFirstRef(backupPinRefs);
    }
  }, [isBackupDialogOpen, backupStep]);

  useEffect(() => {
    if (isBackupDialogOpen && backupStep === "backuppin") {
      backupPinRefs.current = new Array(PIN_POLICY.length).fill(null);
      backupPinConfirmRefs.current = new Array(PIN_POLICY.length).fill(null);
      focusFirstRef(backupPinRefs);
    }
  }, [isBackupDialogOpen, backupStep]);

  useEffect(() => {
    if (isRestoreDialogOpen && restoreStep === "pin") {
      restorePinRefs.current = new Array(PIN_POLICY.length).fill(null);
      restoreBackupPinRefs.current = new Array(PIN_POLICY.length).fill(null);
      focusFirstRef(restorePinRefs);
    }
  }, [isRestoreDialogOpen, restoreStep]);

  useEffect(() => {
    if (isRestoreDialogOpen && restoreStep === "backuppin") {
      restorePinRefs.current = new Array(PIN_POLICY.length).fill(null);
      restoreBackupPinRefs.current = new Array(PIN_POLICY.length).fill(null);
      focusFirstRef(restoreBackupPinRefs);
    }
  }, [isRestoreDialogOpen, restoreStep]);

  const handleBackupAccounts = async () => {
    setBackupError(null);

    if (backupStep === "pin") {
      const pinStr = backupPin.join("");
      if (backupPin.some((digit) => digit === "")) {
        setBackupError(`Please enter all ${PIN_POLICY.length} digits`);
        return;
      }
      try {
        const result = await window.api.verifyPin(pinStr);
        if (result.success) {
          setBackupStep("backuppin");
          setBackupPin(emptyPinDigits());
          setBackupPinConfirm(emptyPinDigits());
        } else {
          setBackupError("Incorrect PIN");
          setBackupPin(emptyPinDigits());
        }
      } catch (error) {
        setBackupError(
          "PIN verification failed: " +
            (error instanceof Error ? error.message : String(error)),
        );
        setBackupPin(emptyPinDigits());
      }
    } else if (backupStep === "backuppin") {
      const pin1 = backupPin.join("");
      const pin2 = backupPinConfirm.join("");

      if (backupPin.some((digit) => digit === "")) {
        setBackupError(
          `Please enter all ${PIN_POLICY.length} digits for encryption PIN`,
        );
        return;
      }
      if (backupPinConfirm.some((digit) => digit === "")) {
        setBackupError(
          `Please enter all ${PIN_POLICY.length} digits for confirmation PIN`,
        );
        return;
      }
      if (pin1 !== pin2) {
        setBackupError("Backup PINs do not match");
        setBackupPin(emptyPinDigits());
        setBackupPinConfirm(emptyPinDigits());
        return;
      }

      setIsBackupLoading(true);
      try {
        const accountsData = accounts;
        let saveLocation: string | undefined;
        try {
          saveLocation = await window.api.chooseBackupLocation();
        } catch (e) {
          throw new Error("Backup cancelled");
        }

        const filepath = await window.api.createBackup(
          accountsData,
          pin1,
          saveLocation,
        );
        addNotification({
          type: "success",
          title: "Backup created",
          message: `Saved backup to ${filepath}`,
        });
        setIsBackupDialogOpen(false);
        setBackupStep("pin");
        setBackupPin(emptyPinDigits());
        setBackupPinConfirm(emptyPinDigits());
        setBackupError(null);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        addNotification({
          type: "error",
          title: "Backup failed",
          message: msg,
        });
        setBackupError("Backup failed: " + msg);
      } finally {
        setIsBackupLoading(false);
      }
    }
  };

  const handleRestoreBackup = async () => {
    setRestoreError(null);

    if (restoreStep === "pin") {
      const pinStr = restorePin.join("");
      if (restorePin.some((digit) => digit === "")) {
        setRestoreError(`Please enter all ${PIN_POLICY.length} digits`);
        return;
      }
      try {
        const result = await window.api.verifyPin(pinStr);
        if (result.success) {
          setRestoreStep("file");
          setRestorePin(emptyPinDigits());
        } else {
          setRestoreError("Incorrect PIN");
          setRestorePin(emptyPinDigits());
        }
      } catch (error) {
        setRestoreError(
          "PIN verification failed: " +
            (error instanceof Error ? error.message : String(error)),
        );
        setRestorePin(emptyPinDigits());
      }
    } else if (restoreStep === "file") {
      try {
        const filepath = await window.api.pickBackupFile();
        if (filepath) {
          setSelectedBackupFile(filepath);
          setRestoreStep("backuppin");
        }
      } catch (error) {
        setRestoreError(
          "File selection failed: " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    } else if (restoreStep === "backuppin") {
      const pinStr = restoreBackupPin.join("");
      if (restoreBackupPin.some((digit) => digit === "")) {
        setRestoreError(`Please enter all ${PIN_POLICY.length} digits`);
        return;
      }
      if (!selectedBackupFile) {
        setRestoreError("No backup file selected");
        return;
      }

      setIsRestoreLoading(true);
      try {
        const restoredAccounts = await window.api.restoreBackup(
          selectedBackupFile,
          pinStr,
        );
        await window.api.saveAccounts(restoredAccounts as Account[]);
        addNotification({
          type: "success",
          title: "Backup restored",
          message: `Imported ${restoredAccounts.length} accounts from backup`,
        });
        setIsRestoreDialogOpen(false);
        setRestoreStep("pin");
        setRestorePin(emptyPinDigits());
        setRestoreBackupPin(emptyPinDigits());
        setSelectedBackupFile(null);
        setRestoreError(null);
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        addNotification({
          type: "error",
          title: "Restore failed",
          message: msg,
        });
        setRestoreError("Restore failed: " + msg);
      } finally {
        setIsRestoreLoading(false);
      }
    }
  };

  const handlePinInputChange = useCallback(
    (
      index: number,
      value: string,
      setter: any,
      refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    ) => {
      const digit = value.slice(-1);
      if (!/^\d?$/.test(digit)) return;

      setter((prev: string[]) => {
        const newPin = [...prev];
        newPin[index] = digit;
        return newPin;
      });

      if (digit && index < LAST_PIN_INDEX) {
        refs.current[index + 1]?.focus();
      }
    },
    [],
  );

  const handlePinKeyDown = useCallback(
    (
      index: number,
      e: React.KeyboardEvent<HTMLInputElement>,
      currentPin: string[],
      setter: any,
      refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    ) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        if (!currentPin[index] && index > 0) {
          refs.current[index - 1]?.focus();
          setter((prev: string[]) => {
            const newPin = [...prev];
            newPin[index - 1] = "";
            return newPin;
          });
        } else {
          setter((prev: string[]) => {
            const newPin = [...prev];
            newPin[index] = "";
            return newPin;
          });
        }
      }
    },
    [],
  );

  const renderPinInputs = (
    values: string[],
    setter: any,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => (
    <div className="flex gap-2 justify-center">
      {values.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) =>
            handlePinInputChange(index, e.target.value, setter, refs)
          }
          onKeyDown={(e) => handlePinKeyDown(index, e, values, setter, refs)}
          onPaste={(e) => {
            try {
              const text = e.clipboardData?.getData("text") || "";
              const digits = text.replace(/\D/g, "").split("");
              if (digits.length === 0) return;
              setter((prev: string[]) => {
                const next = [...prev];
                for (
                  let i = 0;
                  i < digits.length && index + i < next.length;
                  i++
                ) {
                  next[index + i] = digits[i];
                }
                return next;
              });
              requestAnimationFrame(() => {
                const lastIndex = Math.min(
                  index + digits.length - 1,
                  refs.current.length - 1,
                );
                refs.current[lastIndex]?.focus();
              });
            } catch (err) {}
          }}
          onPointerDown={() => {
            try {
              refs.current[index]?.focus();
            } catch (err) {}
          }}
          onTouchStart={() => {
            try {
              refs.current[index]?.focus();
            } catch (err) {}
          }}
          onClick={() => {
            try {
              refs.current[index]?.focus();
            } catch (err) {}
          }}
          aria-label={`PIN digit ${index + 1}`}
          tabIndex={0}
          style={{ pointerEvents: "auto" }}
          className="w-10 h-12 text-center text-xl font-mono rounded-lg border-2 bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none transition-all border-[var(--color-border-strong)] focus:border-[var(--color-border-strong)]"
        />
      ))}
    </div>
  );

  const handlePinSave = async (newPin: string | null, currentPin?: string) => {
    const result = await window.api.setPin(newPin, currentPin);
    if (result.success) {
      if (newPin) setAppUnlocked(true);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.settings.snapshot(),
      });
    }
    return result;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="pb-10"
      >
        <div className="grid grid-cols-2 gap-4">
          <PageHeader
            title="Security"
            description="Manage access controls, account backups, and advanced configurations."
          />

          <SectionDivider label="Access Control" />

          {}
          <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center justify-between z-10 relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                  <Lock size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">
                    PIN Lock
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Require a {PIN_POLICY.length}-digit PIN when Sentra starts.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPinDialogOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 shrink-0 ${
                  settings.pinCode
                    ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30"
                    : "text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] border border-[var(--color-border-strong)]"
                }`}
              >
                {settings.pinCode ? (
                  <>
                    <Lock size={14} /> PIN Enabled — Manage
                  </>
                ) : (
                  "Set Up PIN"
                )}
              </button>
            </div>
            {settings.pinCode && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] z-10 relative">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Your PIN is active. The app will be locked on next launch.
                </p>
              </div>
            )}
          </div>

          <SectionDivider label="Backup & Restore" />

          <BentoCard
            icon={<BackupIcon size={16} />}
            title="Backup Accounts"
            description="Create an encrypted backup of all your accounts."
          >
            <button
              onClick={() => {
                setIsBackupDialogOpen(true);
                setBackupStep("pin");
                setBackupPin(emptyPinDigits());
                setBackupPinConfirm(emptyPinDigits());
              }}
              className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] flex items-center justify-center gap-2"
            >
              <BackupIcon size={14} />
              Create Backup
            </button>
          </BentoCard>

          <BentoCard
            icon={<RotateCcw size={16} />}
            title="Restore Accounts"
            description="Restore accounts from an existing backup file."
          >
            <button
              onClick={() => {
                setIsRestoreDialogOpen(true);
                setRestoreStep("pin");
                setRestorePin(emptyPinDigits());
                setRestoreBackupPin(emptyPinDigits());
                setSelectedBackupFile(null);
              }}
              className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} />
              Load Backup
            </button>
          </BentoCard>

          <SectionDivider label="Advanced Features" />

          <BentoCard
            icon={<Globe size={16} />}
            title="User Agent"
            description={
              isAutoSwapEnabled
                ? `Auto-rotating every ${autoSwapInterval}m`
                : `Static — Agent #${userAgentIndex + 1}`
            }
          >
            <button
              onClick={() => setIsUserAgentModalOpen(true)}
              className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] flex items-center justify-center gap-2"
            >
              <Globe size={14} />
              Configure
            </button>
          </BentoCard>

          <BentoCard
            icon={<Zap size={16} />}
            title="Multi-Instance"
            description={`Launch multiple Roblox clients at once.${isMac ? " (Experimental on macOS)" : ""}`}
            accent="warning"
          >
            <div className="flex items-center justify-between gap-3">
              {}
              {settings.allowMultipleInstances && (
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <CustomDropdown
                      options={[
                        { value: "mutex", label: "Mutex" },
                        { value: "handle64", label: "Handle64" },
                      ]}
                      value={settings.multiInstanceMethod || "mutex"}
                      onChange={(method) =>
                        onUpdateSettings({
                          multiInstanceMethod: method as "mutex" | "handle64",
                        })
                      }
                      placeholder="Method"
                    />
                  </div>

                  {}
                  {settings.multiInstanceMethod === "handle64" && (
                    <div className="flex items-center gap-1">
                      {!handle64IsInstalled && (
                        <button
                          onClick={handleHandle64Install}
                          disabled={handle64IsLoading}
                          className="py-1.5 px-2 text-[11px] font-medium rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1 whitespace-nowrap"
                        >
                          {handle64IsLoading ? (
                            <div className="w-2.5 h-2.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                          ) : (
                            <>
                              <Download size={10} />
                              Install
                            </>
                          )}
                        </button>
                      )}

                      {handle64IsInstalled && (
                        <button
                          onClick={handleHandle64Uninstall}
                          disabled={handle64IsLoading}
                          className="py-1.5 px-2 text-[11px] font-medium rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1 whitespace-nowrap"
                        >
                          {handle64IsLoading ? (
                            <div className="w-2.5 h-2.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <>
                              <Trash2 size={10} />
                              Delete
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={handleHandle64Refresh}
                        disabled={handle64IsLoading}
                        className="py-1.5 px-2 text-[11px] font-medium rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition-all disabled:opacity-50 flex items-center justify-center"
                        title="Check if Handle64 is installed"
                      >
                        {handle64IsLoading ? (
                          <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RotateCw size={10} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {}
              <BentoToggle
                checked={settings.allowMultipleInstances}
                onChange={() =>
                  onUpdateSettings({
                    allowMultipleInstances: !settings.allowMultipleInstances,
                  })
                }
              />
            </div>
          </BentoCard>

          {}
          <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center justify-between z-10 relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                  <Sliders size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">
                    Roblox Advanced Settings
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Configure physics, graphics, memory, and client performance
                    options.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRobloxSettingsOpen(true)}
                disabled={false}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent-color)] hover:brightness-110 text-[var(--accent-color-foreground)] transition-all disabled:opacity-50 shrink-0"
              >
                Configure
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <PinSetupDialog
        isOpen={isPinDialogOpen}
        onClose={() => setIsPinDialogOpen(false)}
        onSave={handlePinSave}
        currentPin={settings.pinCode}
      />

      <Dialog
        isOpen={isBackupDialogOpen}
        onClose={() => setIsBackupDialogOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[var(--accent-color)]" />
              <DialogTitle>
                {backupStep === "pin" ? "Verify PIN" : "Set Backup PIN"}
              </DialogTitle>
            </div>
            <DialogClose />
          </DialogHeader>
          <DialogBody className="space-y-6">
            {backupError && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-400">{backupError}</span>
              </div>
            )}
            {backupStep === "pin" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Enter your PIN to proceed with account backup.
                  </p>
                  {renderPinInputs(backupPin, setBackupPin, backupPinRefs)}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Create a PIN to encrypt your backup file. You'll need this
                    PIN to restore.
                  </label>
                  {renderPinInputs(backupPin, setBackupPin, backupPinRefs)}
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Confirm PIN
                  </label>
                  {renderPinInputs(
                    backupPinConfirm,
                    setBackupPinConfirm,
                    backupPinConfirmRefs,
                  )}
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsBackupDialogOpen(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBackupAccounts}
                disabled={isBackupLoading}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[var(--accent-color)] text-[var(--accent-color-foreground)] hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
              >
                {isBackupLoading
                  ? "Creating..."
                  : backupStep === "pin"
                    ? "Next"
                    : "Create Backup"}
              </button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog
        isOpen={isRestoreDialogOpen}
        onClose={() => setIsRestoreDialogOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[var(--accent-color)]" />
              <DialogTitle>
                {restoreStep === "pin"
                  ? "Verify PIN"
                  : restoreStep === "file"
                    ? "Select Backup"
                    : "Enter Backup PIN"}
              </DialogTitle>
            </div>
            <DialogClose />
          </DialogHeader>
          <DialogBody className="space-y-6">
            {restoreError && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-400">{restoreError}</span>
              </div>
            )}
            {restoreStep === "pin" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Enter your PIN to proceed with account restoration.
                  </p>
                  {renderPinInputs(restorePin, setRestorePin, restorePinRefs)}
                </div>
              </>
            ) : restoreStep === "file" ? (
              <>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Click the button below to select your backup file.
                </p>
                {selectedBackupFile && (
                  <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] p-2 rounded-lg break-all">
                    Selected: {selectedBackupFile.split("\\").pop()}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Enter the PIN that was used to create the backup file.
                  </label>
                  {renderPinInputs(
                    restoreBackupPin,
                    setRestoreBackupPin,
                    restoreBackupPinRefs,
                  )}
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsRestoreDialogOpen(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={isRestoreLoading}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[var(--accent-color)] text-[var(--accent-color-foreground)] hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
              >
                {isRestoreLoading
                  ? "Processing..."
                  : restoreStep === "pin"
                    ? "Next"
                    : restoreStep === "file"
                      ? "Select File"
                      : "Restore"}
              </button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog
        isOpen={isRobloxSettingsOpen}
        onClose={() => setIsRobloxSettingsOpen(false)}
      >
        <DialogContent className="w-[90vw] max-w-lg h-[75vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[var(--accent-color)]" />
              <DialogTitle>Roblox Advanced Settings</DialogTitle>
            </div>
            <DialogClose />
          </DialogHeader>
          <DialogBody className="px-4 py-3 flex-1 min-h-0">
            <RobloxAdvancedSettings
              settings={settings}
              onSettingsChange={handleRobloxSettingsChange}
              onClose={() => setIsRobloxSettingsOpen(false)}
              isLoading={false}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <UserAgentSettingsModal
        isOpen={isUserAgentModalOpen}
        onClose={() => setIsUserAgentModalOpen(false)}
        currentUserAgent={currentUserAgent}
        userAgentIndex={userAgentIndex}
        allUserAgents={allUserAgents}
        isLoadingUserAgent={isLoadingUserAgent}
        isAutoSwapEnabled={isAutoSwapEnabled}
        autoSwapInterval={autoSwapInterval}
        setAutoSwapInterval={setAutoSwapInterval}
        onRotateNext={handleRotateNext}
        onSelectAgent={handleSelectAgent}
        onToggleAutoSwap={handleToggleAutoSwap}
      />
    </>
  );
};
