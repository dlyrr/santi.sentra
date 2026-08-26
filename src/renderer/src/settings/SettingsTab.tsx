import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  Users,
  HardDrive,
  Palette,
  Bell,
  Lock,
  Shield,
  Sliders,
  Type,
  Plus,
  Trash2,
  Check,
  Info,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  RotateCcw,
  AlertTriangle,
  Monitor,
  Globe,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import Color from "color";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useAdminStatus,
  AdminStatus,
} from "@renderer/features/license/useAdminStatus";
import { queryKeys } from "@shared/queryKeys";
import {
  Account,
  Settings,
  TabId,
  TintPreference,
  DEFAULT_ACCENT_COLOR,
} from "@renderer/types";
import { cn } from "@renderer/lib/utils";
import CustomCheckbox from "@renderer/components/UI/buttons/CustomCheckbox";
import CustomDropdown, {
  DropdownOption,
} from "@renderer/components/UI/menus/CustomDropdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
} from "@renderer/components/UI/dialogs/Dialog";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@renderer/components/UI/inputs/ColorPicker";
import {
  useNotificationTrayStore,
  useNotifyFriendOnline,
  useNotifyFriendInGame,
  useNotifyFriendRemoved,
  useNotifyServerLocation,
} from "@renderer/features/system/stores/useNotificationTrayStore";
import { useSetAppUnlocked } from "@renderer/stores/useUIStore";
import { useTheme, CustomThemeName } from "@renderer/theme/ThemeContext";
import PinSetupDialog from "@renderer/components/UI/security/PinSetupDialog";
import { LAST_PIN_INDEX, PIN_POLICY, emptyPinDigits } from "@shared/pinPolicy";
import BackupIcon from "@renderer/components/UI/icons/BackupIcon";
import { useInstallations } from "@renderer/features/install/stores/useInstallationsStore";
import {
  CustomFont,
  getGoogleFontUrl,
  loadFont,
  unloadFont,
  applyFont,
  isValidGoogleFontFamily,
} from "@renderer/utils/fontUtils";
import { UpdaterCard } from "@renderer/features/updater";
import PrivacyPolicyModal from "@renderer/components/Modals/PrivacyPolicyModal";
import {
  DEFAULT_SIDEBAR_TAB_ORDER,
  LOCKED_SIDEBAR_TABS,
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
} from "@shared/navigation";
import {
  SIDEBAR_TAB_DEFINITION_MAP,
  SidebarTabDefinition,
} from "@renderer/constants/sidebarTabs";

interface SettingsTabProps {
  accounts: Account[];
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
}

const isMac = window.platform?.isMac ?? false;

const NewsGenerator: React.FC = () => {
  const [entries, setEntries] = useState<string[]>([]);
  const [newEntry, setNewEntry] = useState("");

  const addEntry = () => {
    if (newEntry.trim()) {
      setEntries((prev) => [...prev, newEntry.trim()]);
      setNewEntry("");
    }
  };

  const output = useMemo(() => {
    const arr = entries.map((c) => ({
      content: c,
      createdAt: new Date().toISOString(),
    }));
    return "module.exports = " + JSON.stringify(arr, null, 2);
  }, [entries]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
          New announcement text
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            className="flex-1 px-3 py-2 bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
          />
          <button
            type="button"
            onClick={addEntry}
            className="px-4 py-2 bg-[var(--accent-color)] text-black rounded-lg hover:opacity-90"
          >
            Add
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Current entries
          </h4>
          <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-1">
            {entries.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
          GitHub snippet (copy below)
        </h4>
        <textarea
          readOnly
          value={output}
          className="w-full h-40 p-2 bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-mono text-xs"
        />
      </div>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const SettingsCard: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon, actions, children }) => (
  <div className="p-4 bg-[var(--color-surface-strong)] rounded-[var(--radius-xl)] border border-[var(--color-border)]/50 hover:border-[var(--color-border-strong)]/50 transition-colors space-y-3 [--card-radius:var(--radius-xl)] [--card-gap:0.5rem] [--control-radius:calc(var(--card-radius)_-_var(--card-gap))]">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
            {icon}
          </div>
        )}
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
            {title}
          </h4>
          {description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const ToggleRow: React.FC<{
  title: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ title, description, checked, onChange, disabled, icon, hint }) => (
  <div className="flex items-start gap-3 p-4 bg-[var(--color-surface-muted)] rounded-[var(--control-radius)] border border-[var(--color-border)]/50 hover:border-[var(--color-border-strong)]/50 transition-colors">
    <div className="mt-1">
      <CustomCheckbox
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        {description}
      </p>
      {hint}
    </div>
  </div>
);

const SettingsTab: React.FC<SettingsTabProps> = ({
  accounts,
  settings,
  onUpdateSettings,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "general" | "appearance" | "notifications" | "security" | "about" | "admin"
  >("general");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [backupStep, setBackupStep] = useState<
    "pin" | "backuppin" | "location"
  >("pin");
  const [restoreStep, setRestoreStep] = useState<"pin" | "backuppin" | "file">(
    "pin",
  );
  const [backupPin, setBackupPin] = useState<string[]>(emptyPinDigits);
  const [backupPinConfirm, setBackupPinConfirm] =
    useState<string[]>(emptyPinDigits);
  const [storedBackupPin, setStoredBackupPin] = useState<string>("");
  const [restorePin, setRestorePin] = useState<string[]>(emptyPinDigits);
  const [restoreBackupPin, setRestoreBackupPin] =
    useState<string[]>(emptyPinDigits);
  const [selectedBackupFile, setSelectedBackupFile] = useState<string | null>(
    null,
  );
  const [backupLocationMode, setBackupLocationMode] = useState<
    "auto" | "custom"
  >("auto");
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [newFontFamily, setNewFontFamily] = useState("");
  const [fontError, setFontError] = useState<string | null>(null);
  const [isAddingFont, setIsAddingFont] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const [currentUserAgent, setCurrentUserAgent] = useState<string>("");
  const [userAgentIndex, setUserAgentIndex] = useState<number>(0);
  const [allUserAgents, setAllUserAgents] = useState<string[]>([]);
  const [isAutoSwapEnabled, setIsAutoSwapEnabled] = useState<boolean>(false);
  const [autoSwapInterval, setAutoSwapInterval] = useState<number>(30);
  const [isLoadingUserAgent, setIsLoadingUserAgent] = useState(false);

  const {
    data: adminData,
    isLoading: loadingAdmin,
    error: adminErr,
  } = useAdminStatus();
  console.log(
    "[SettingsTab] adminData",
    adminData,
    "loading",
    loadingAdmin,
    "error",
    adminErr,
  );
  const licenseAdmin = (adminData as AdminStatus | undefined)?.isAdmin ?? false;
  const isAdmin = licenseAdmin || accounts.some((a) => a.isAdmin);

  useEffect(() => {
    if (licenseAdmin && !accounts.every((a) => a.isAdmin)) {
      const updated = accounts.map((a) => ({ ...a, isAdmin: true }));

      queryClient.setQueryData(queryKeys.accounts.list(), updated);
      window.api.saveAccounts(updated).catch(() => {});
    }
  }, [licenseAdmin, accounts, queryClient]);
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
          } catch (e) {}
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

  const setAppUnlocked = useSetAppUnlocked();
  const addNotification = useNotificationTrayStore((s) => s.addNotification);

  const installations = useInstallations();

  const sidebarTabOrder = useMemo(
    () => sanitizeSidebarOrder(settings.sidebarTabOrder),
    [settings.sidebarTabOrder],
  );
  const sidebarHiddenTabs = useMemo(
    () => sanitizeSidebarHidden(settings.sidebarHiddenTabs),
    [settings.sidebarHiddenTabs],
  );
  const sidebarTabs = useMemo(
    () =>
      sidebarTabOrder
        .map((tabId) => SIDEBAR_TAB_DEFINITION_MAP[tabId])
        .filter(Boolean) as SidebarTabDefinition[],
    [sidebarTabOrder],
  );
  const hiddenSidebarTabsSet = useMemo(
    () => new Set(sidebarHiddenTabs),
    [sidebarHiddenTabs],
  );

  const { data: customFonts = [] } = useQuery({
    queryKey: ["customFonts"],
    queryFn: () => window.api.getCustomFonts(),
    staleTime: Infinity,
  });

  const { data: activeFont = null } = useQuery({
    queryKey: ["activeFont"],
    queryFn: () => window.api.getActiveFont(),
    staleTime: Infinity,
  });

  useEffect(() => {
    customFonts.forEach((font) => {
      loadFont(font).catch(console.error);
    });
  }, [customFonts]);

  useEffect(() => {
    applyFont(activeFont);
  }, [activeFont]);

  useEffect(() => {
    const loadUserAgentState = async () => {
      try {
        console.log("[SettingsTab] Loading user agent state...");
        setIsLoadingUserAgent(true);

        const [state, agents] = await Promise.all([
          window.api.getUserAgentState(),
          window.api.getAllUserAgents(),
        ]);
        console.log("[SettingsTab] User agent state loaded:", state);
        console.log("[SettingsTab] All user agents:", agents);
        if (state) {
          setCurrentUserAgent(state.currentUserAgent);
          setUserAgentIndex(state.currentIndex);
          setIsAutoSwapEnabled(state.autoSwapEnabled);
          setAutoSwapInterval(state.autoSwapIntervalMinutes);
        }
        setAllUserAgents(agents || []);
      } catch (error) {
        console.error("[SettingsTab] Failed to load user agent state:", error);
      } finally {
        setIsLoadingUserAgent(false);
      }
    };

    console.log("[SettingsTab] Component mounted, loading user agent state");
    loadUserAgentState();
  }, []);

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

  const addFontMutation = useMutation({
    mutationFn: async (font: CustomFont) => {
      await loadFont(font);
      await window.api.addCustomFont(font);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFonts"] });
      setNewFontFamily("");
      setFontError(null);
    },
    onError: (error: Error) => {
      setFontError(error.message);
    },
  });

  const removeFontMutation = useMutation({
    mutationFn: async (family: string) => {
      unloadFont(family);
      await window.api.removeCustomFont(family);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFonts"] });
      queryClient.invalidateQueries({ queryKey: ["activeFont"] });
    },
  });

  const setActiveFontMutation = useMutation({
    mutationFn: async (family: string | null) => {
      await window.api.setActiveFont(family);
      applyFont(family);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeFont"] });
    },
  });

  const handleAddFont = async () => {
    const trimmedFamily = newFontFamily.trim();
    if (!trimmedFamily) {
      setFontError("Please enter a font family name");
      return;
    }

    if (!isValidGoogleFontFamily(trimmedFamily)) {
      setFontError(
        "Invalid font family name. Use only letters, numbers, and spaces.",
      );
      return;
    }

    if (
      customFonts.some(
        (f) => f.family.toLowerCase() === trimmedFamily.toLowerCase(),
      )
    ) {
      setFontError("This font has already been added");
      return;
    }

    setIsAddingFont(true);
    setFontError(null);

    try {
      const url = getGoogleFontUrl(trimmedFamily);
      await addFontMutation.mutateAsync({ family: trimmedFamily, url });
    } catch {
      setFontError("Failed to load font. Make sure the font name is correct.");
    } finally {
      setIsAddingFont(false);
    }
  };

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

      setStoredBackupPin(pin1);
      setBackupStep("location");
      setBackupPin(emptyPinDigits());
      setBackupPinConfirm(emptyPinDigits());
    } else if (backupStep === "location") {
      if (!storedBackupPin) {
        setBackupError("Backup PIN was lost, please restart");
        return;
      }

      setIsBackupLoading(true);
      try {
        let accountsData =
          (queryClient.getQueryData(["accounts"]) as Account[] | undefined) ||
          [];
        if (!accountsData || accountsData.length === 0) {
          try {
            accountsData = (await window.api.getAccounts()) as Account[];
          } catch (err) {
            console.warn(
              "Failed to fetch accounts from API, falling back to cache:",
              err,
            );
            accountsData =
              (queryClient.getQueryData(["accounts"]) as Account[]) || [];
          }
        }

        let savePath: string | undefined;
        if (backupLocationMode === "custom") {
          savePath = await window.api.chooseBackupLocation();
        }

        const filepath = await window.api.createBackup(
          accountsData,
          storedBackupPin,
          savePath,
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
        setBackupLocationMode("auto");
        setStoredBackupPin("");
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

        const normalized = (restoredAccounts as any[]).map((a) => ({
          id: String(
            a?.id ?? a?.uuid ?? a?.uid ?? crypto?.randomUUID?.() ?? "",
          ),
          displayName: String(
            a?.displayName ?? a?.display_name ?? a?.name ?? "",
          ),
          username: String(a?.username ?? a?.user ?? a?.handle ?? ""),
          userId: String(a?.userId ?? a?.user_id ?? a?.uid ?? ""),

          ...a,
        }));

        console.debug(
          "[SettingsTab] Restored accounts count:",
          normalized.length,
        );

        await window.api.saveAccounts(normalized as Account[]);
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
        return;
      }

      if (e.key === "ArrowLeft" && index > 0) {
        refs.current[index - 1]?.focus();
        return;
      } else if (e.key === "ArrowRight" && index < LAST_PIN_INDEX) {
        refs.current[index + 1]?.focus();
        return;
      }

      if (/^\d$/.test(e.key) || /^Numpad/.test((e as any).code || "")) {
        e.preventDefault();
        const digit = e.key.match(/\d/)?.[0] ?? "";
        if (!digit) return;
        setter((prev: string[]) => {
          const newPin = [...prev];
          newPin[index] = digit;
          return newPin;
        });
        if (index < LAST_PIN_INDEX) refs.current[index + 1]?.focus();
        return;
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
          className="w-10 h-12 text-center text-xl font-mono rounded-lg border-2 bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none transition-all border-[var(--color-border-strong)] focus:border-[var(--accent-color)]"
        />
      ))}
    </div>
  );

  const notifyFriendOnline = useNotifyFriendOnline();
  const notifyFriendInGame = useNotifyFriendInGame();
  const notifyFriendRemoved = useNotifyFriendRemoved();
  const notifyServerLocation = useNotifyServerLocation();
  const setNotifyFriendOnline = useNotificationTrayStore(
    (state) => state.setNotifyFriendOnline,
  );
  const setNotifyFriendInGame = useNotificationTrayStore(
    (state) => state.setNotifyFriendInGame,
  );
  const setNotifyFriendRemoved = useNotificationTrayStore(
    (state) => state.setNotifyFriendRemoved,
  );
  const setNotifyServerLocation = useNotificationTrayStore(
    (state) => state.setNotifyServerLocation,
  );

  const { data: discordRPCEnabled = false, refetch: refetchDiscordRPC } =
    useQuery({
      queryKey: ["discordRPCEnabled"],
      queryFn: () => window.api.isDiscordRPCEnabled(),
      staleTime: 5000,
    });

  const toggleDiscordRPC = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        await window.api.enableDiscordRPC();
      } else {
        await window.api.disableDiscordRPC();
      }
    },
    onSuccess: () => {
      refetchDiscordRPC();
    },
  });

  const handlePrimaryAccountChange = (value: string) => {
    onUpdateSettings({ primaryAccountId: value === "" ? null : value });
  };

  const handleDefaultInstallChange = (value: string) => {
    onUpdateSettings({
      defaultInstallationPath: value === "" ? undefined : value,
    });
  };

  const handleTintChange = (value: string) => {
    onUpdateSettings({ tint: value as TintPreference });
  };

  const handleAccentColorChange = (rgba: [number, number, number, number]) => {
    try {
      const color = Color.rgb(rgba[0], rgba[1], rgba[2], rgba[3]);
      const hex = color.hex();
      onUpdateSettings({ accentColor: hex });
    } catch (e) {
      console.error("Failed to convert color:", e);
    }
  };

  const handleProfileCardToggle = () => {
    onUpdateSettings({
      showSidebarProfileCard: !settings.showSidebarProfileCard,
    });
  };

  const handlePrivacyModeToggle = () => {
    onUpdateSettings({ privacyMode: !settings.privacyMode });
  };

  const handleToggleTabVisibility = (tabId: TabId) => {
    if (LOCKED_SIDEBAR_TABS.includes(tabId)) return;

    const nextHidden = hiddenSidebarTabsSet.has(tabId)
      ? sidebarHiddenTabs.filter((id) => id !== tabId)
      : [...sidebarHiddenTabs, tabId];

    onUpdateSettings({ sidebarHiddenTabs: nextHidden });
  };

  const handleMoveTab = (tabId: TabId, direction: number) => {
    const currentIndex = sidebarTabOrder.indexOf(tabId);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= sidebarTabOrder.length) return;

    const nextOrder = [...sidebarTabOrder];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);
    onUpdateSettings({ sidebarTabOrder: nextOrder });
  };

  const handleResetNavigation = () => {
    onUpdateSettings({
      sidebarTabOrder: DEFAULT_SIDEBAR_TAB_ORDER,
      sidebarHiddenTabs: [],
    });
  };

  const handlePinSave = async (newPin: string | null, currentPin?: string) => {
    const result = await window.api.setPin(newPin, currentPin);
    if (result.success) {
      if (newPin) {
        setAppUnlocked(true);
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.settings.snapshot(),
      });
    }
    return result;
  };

  const accountOptions: DropdownOption[] = [
    { value: "", label: "None" },
    ...accounts.map((account) => ({
      value: account.id,
      label: account.displayName,
      labelNode: settings.privacyMode ? (
        <span style={{ filter: "blur(16px)" }}>{account.displayName}</span>
      ) : undefined,
      subLabel: `@${account.username}`,
      subLabelNode: settings.privacyMode ? (
        <span style={{ filter: "blur(16px)" }}>@{account.username}</span>
      ) : undefined,
    })),
  ];

  const installationOptions: DropdownOption[] = [
    { value: "", label: "System Default" },
    ...installations.map((inst) => ({
      value: inst.path,
      label: inst.name,
      subLabel: inst.version.substring(0, 15) + "...",
    })),
  ];

  const { setCustomTheme, customTheme: contextCustomTheme } = useTheme();

  const displayedCustomTheme =
    (settings.customTheme as CustomThemeName) ||
    contextCustomTheme ||
    "default";

  useEffect(() => {
    if (settings.customTheme && contextCustomTheme !== settings.customTheme) {
      setCustomTheme(settings.customTheme as CustomThemeName);
    }
  }, [settings.customTheme, contextCustomTheme, setCustomTheme]);

  const customThemeOptions: DropdownOption[] = [
    { value: "default", label: "Default", subLabel: "No extra effects" },
    { value: "hearts", label: "Hearts", subLabel: "Red falling hearts" },
    { value: "aurora", label: "Aurora", subLabel: "Purple floating particles" },
    { value: "ocean", label: "Ocean", subLabel: "Blue bubbles rising" },
    { value: "forest", label: "Forest", subLabel: "Green leaves falling" },
    { value: "sunset", label: "Sunset", subLabel: "Orange sparks drifting" },
    { value: "cosmic", label: "Cosmic", subLabel: "Cyan stars twinkling" },
    { value: "ember", label: "Ember", subLabel: "Warm ember sparks" },
    { value: "pixel", label: "Pixel", subLabel: "Pixelated sprites" },
    { value: "breeze", label: "Breeze", subLabel: "Soft drifting motes" },
    { value: "comet", label: "Comet", subLabel: "Fast streaking comets" },
    { value: "petals", label: "Petals", subLabel: "Soft flower petals" },
  ];

  const PREV_KEY = "app-custom-theme-prev-settings";

  const handleCustomThemeChange = (value: string) => {
    const newTheme = value as CustomThemeName;
    const themeColorMap: Record<
      CustomThemeName,
      { tint?: TintPreference; accentColor?: string }
    > = {
      default: {},
      hearts: { tint: "warm", accentColor: "#ff2d55" },
      aurora: { tint: "twilight", accentColor: "#8b5cf6" },
      ocean: { tint: "cool", accentColor: "#06b6d4" },
      forest: { tint: "forest", accentColor: "#16a34a" },
      sunset: { tint: "warm", accentColor: "#f97316" },
      cosmic: { tint: "twilight", accentColor: "#06b6d4" },
      ember: { tint: "warm", accentColor: "#ff5722" },
      pixel: { tint: "neutral", accentColor: "#10b981" },
      breeze: { tint: "cool", accentColor: "#bae6fd" },
      comet: { tint: "warm", accentColor: "#ffd166" },
      petals: { tint: "twilight", accentColor: "#ff7ab6" },
    };

    if (newTheme === "default") {
      try {
        const prevSettings = localStorage.getItem(PREV_KEY);
        if (prevSettings) {
          const parsed = JSON.parse(prevSettings);
          onUpdateSettings({
            tint: parsed.tint || "neutral",
            accentColor: parsed.accentColor || DEFAULT_ACCENT_COLOR,
            useDynamicAccentColor: parsed.useDynamicAccentColor ?? false,
          });
          localStorage.removeItem(PREV_KEY);
        }
      } catch (e) {
        console.warn("[SettingsTab] Failed to restore previous colors:", e);
      }
    } else {
      if (displayedCustomTheme === "default") {
        try {
          const snapshot = {
            tint: settings.tint || "neutral",
            accentColor: settings.accentColor || DEFAULT_ACCENT_COLOR,
            useDynamicAccentColor: settings.useDynamicAccentColor ?? false,
          };
          localStorage.setItem(PREV_KEY, JSON.stringify(snapshot));
        } catch (e) {
          console.warn("[SettingsTab] Failed to save color snapshot:", e);
        }
      }

      const themeColors = themeColorMap[newTheme];
      onUpdateSettings({
        useDynamicAccentColor: false,
        ...themeColors,
      });
    }

    setCustomTheme(newTheme);
    onUpdateSettings({ customTheme: newTheme });
  };

  const handleResetAccent = () => {
    onUpdateSettings({ accentColor: DEFAULT_ACCENT_COLOR });
  };

  const handleLogout = async () => {
    if (
      !confirm(
        "Are you sure you want to logout? This will clear all local configuration data.",
      )
    )
      return;
    try {
      const res = await (window.api as any).logout();
      if (res && res.success) {
        try {
          localStorage.removeItem("onboarding-storage");
        } catch {}
        window.location.reload();
      } else {
        alert("Logout failed: " + (res?.message || "Unknown error"));
      }
    } catch (err) {
      alert(
        "Logout error: " + (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  const tintOptions: DropdownOption[] = [
    { value: "neutral", label: "Neutral", subLabel: "Gray, no color cast" },
    { value: "cool", label: "Cool", subLabel: "Slight blue tint (legacy)" },
    { value: "warm", label: "Warm", subLabel: "Slight orange tint" },
    { value: "forest", label: "Forest", subLabel: "Earthy green tint" },
    { value: "twilight", label: "Twilight", subLabel: "Purple-blue tint" },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
      <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] flex items-center justify-between px-6 z-20">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          Settings
        </h2>
      </div>

      {}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex">
            {}
            {(() => {
              const tabs = [
                "general",
                "appearance",
                "notifications",
                "security",
                "about",
              ];
              if (isAdmin) tabs.push("admin");
              const activeIndex = tabs.indexOf(activeTab);
              const tabWidth = 100 / tabs.length;

              return (
                <motion.div
                  className="absolute bottom-0 h-0.5 bg-[var(--accent-color)] z-20"
                  initial={false}
                  animate={{
                    left: `${activeIndex * tabWidth}%`,
                    width: `${tabWidth}%`,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              );
            })()}

            <button
              onClick={() => setActiveTab("general")}
              className={cn(
                "flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]",
                activeTab === "general"
                  ? "text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <Sliders size={16} />
              General
            </button>

            <button
              onClick={() => setActiveTab("appearance")}
              className={cn(
                "flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]",
                activeTab === "appearance"
                  ? "text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <Type size={16} />
              Appearance
            </button>

            <button
              onClick={() => setActiveTab("notifications")}
              className={cn(
                "flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]",
                activeTab === "notifications"
                  ? "text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <Bell size={16} />
              Notifications
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={cn(
                "flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]",
                activeTab === "security"
                  ? "text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <Shield size={16} />
              Security
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={cn(
                "flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]",
                activeTab === "about"
                  ? "text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <Info size={16} />
              About
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab("admin")}
                className={cn(
                  "flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 relative z-10 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-muted)]",
                  activeTab === "admin"
                    ? "text-[var(--color-text-primary)] bg-[var(--accent-color-faint)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                )}
              >
                <Users size={16} />
                Admin
              </button>
            )}
          </div>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
        <div className="max-w-2xl mx-auto pb-8">
          {}
          {activeTab === "general" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  General Settings
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Manage your account and application preferences.
                </p>
              </div>

              <Section
                title="Accounts & launch"
                description="Set the defaults for selecting accounts and launching Roblox."
              >
                <SettingsCard
                  title="Primary account"
                  description="Automatically select this account when the application starts."
                  icon={<Users size={16} />}
                >
                  <CustomDropdown
                    options={accountOptions}
                    value={settings.primaryAccountId || ""}
                    onChange={handlePrimaryAccountChange}
                    placeholder="Select primary account"
                  />
                </SettingsCard>

                <SettingsCard
                  title="Default installation"
                  description="Choose which Roblox installation to use when launching games. If not set, you'll be prompted each time."
                  icon={<HardDrive size={16} />}
                >
                  <CustomDropdown
                    options={installationOptions}
                    value={settings.defaultInstallationPath || ""}
                    onChange={handleDefaultInstallChange}
                    placeholder="Select installation"
                  />
                </SettingsCard>
              </Section>

              <Section
                title="Privacy"
                description="Hide your account identity when sharing screenshots or streaming."
              >
                <SettingsCard
                  title="Privacy mode"
                  description="Blur account names and avatars throughout the app."
                  icon={<EyeOff size={16} />}
                >
                  <ToggleRow
                    title="Enable privacy mode"
                    description={
                      "Blurs all account names and pictures in the Accounts tab, sidebar card, and other places your account identity appears."
                    }
                    checked={settings.privacyMode}
                    onChange={handlePrivacyModeToggle}
                  />
                </SettingsCard>
              </Section>

              <Section
                title="Navigation"
                description="Control what shows in the sidebar and how it's ordered."
              >
                <SettingsCard
                  title="Sidebar profile card"
                  description="Display the selected account's quick profile in the sidebar."
                  icon={<Users size={16} />}
                >
                  <ToggleRow
                    title="Show sidebar profile card"
                    description="Display the selected account's quick profile card to see your profile faster."
                    checked={settings.showSidebarProfileCard}
                    onChange={handleProfileCardToggle}
                  />
                </SettingsCard>

                <SettingsCard
                  title="Sidebar tabs"
                  description="Hide tabs you do not use and reorder the sidebar to match your workflow."
                  icon={<Sliders size={16} />}
                  actions={
                    <button
                      type="button"
                      onClick={handleResetNavigation}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]/40 transition-colors"
                    >
                      <RotateCcw size={14} />
                      Reset
                    </button>
                  }
                >
                  <div className="space-y-2">
                    {sidebarTabs.map((tab, index) => {
                      const isHidden = hiddenSidebarTabsSet.has(tab.id);
                      const isLocked = LOCKED_SIDEBAR_TABS.includes(tab.id);

                      return (
                        <div
                          key={tab.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--control-radius)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <CustomCheckbox
                              checked={!isHidden || isLocked}
                              disabled={isLocked}
                              onChange={() => handleToggleTabVisibility(tab.id)}
                            />
                            <tab.icon
                              size={16}
                              className="text-[var(--color-text-secondary)] flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                                {tab.label}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                {isLocked ? (
                                  <span className="text-[var(--accent-color)] font-medium">
                                    Always visible
                                  </span>
                                ) : isHidden ? (
                                  <>
                                    <EyeOff size={12} />
                                    Hidden
                                  </>
                                ) : (
                                  <>
                                    <Eye size={12} />
                                    Visible
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveTab(tab.id, -1)}
                              disabled={index === 0}
                              className="p-2 rounded-[var(--control-radius)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              aria-label={`Move ${tab.label} up`}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveTab(tab.id, 1)}
                              disabled={index === sidebarTabs.length - 1}
                              className="p-2 rounded-[var(--control-radius)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              aria-label={`Move ${tab.label} down`}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SettingsCard>
              </Section>

              <Section
                title="Integrations"
                description="Connect Sentra with external services."
              >
                <SettingsCard
                  title="Discord Rich Presence"
                  description="Show your current activity on Discord, including the game you're playing."
                  icon={<Bell size={16} />}
                >
                  <ToggleRow
                    title="Discord Rich Presence"
                    description="Let Discord display when you're browsing or playing through Sentra."
                    checked={discordRPCEnabled}
                    onChange={() => toggleDiscordRPC.mutate(!discordRPCEnabled)}
                    disabled={toggleDiscordRPC.isPending}
                    hint={
                      toggleDiscordRPC.isPending ? (
                        <p className="text-xs text-[var(--accent-color)]">
                          {discordRPCEnabled
                            ? "Disabling..."
                            : "Connecting to Discord..."}
                        </p>
                      ) : null
                    }
                  />
                </SettingsCard>
              </Section>

              <Section
                title="Browser window"
                description="Defaults for the in-app browser windows used for login and account actions."
              >
                <SettingsCard
                  title="Browser window size"
                  description="Set the default width and height (in pixels) for browser windows. Leave empty to use the app default."
                  icon={<Monitor size={16} />}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <label className="text-xs text-[var(--color-text-secondary)]">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        min={200}
                        max={3840}
                        value={settings.browserWindowWidth ?? ""}
                        onChange={(e) =>
                          onUpdateSettings({
                            browserWindowWidth:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className="w-32 p-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs text-[var(--color-text-secondary)]">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        min={200}
                        max={2160}
                        value={settings.browserWindowHeight ?? ""}
                        onChange={(e) =>
                          onUpdateSettings({
                            browserWindowHeight:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className="w-32 p-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
                      />
                    </div>
                  </div>
                </SettingsCard>
              </Section>

              {}
            </div>
          )}

          {}
          {activeTab === "appearance" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  Appearance
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Customize fonts and visual styles across the app.
                </p>
              </div>

              <Section
                title="Theme & colors"
                description="Adjust the overall look of the interface."
              >
                <SettingsCard
                  title="Tint"
                  description={
                    displayedCustomTheme !== "default"
                      ? "Tint is controlled by custom theme"
                      : "Choose the base tint used for surfaces and backgrounds."
                  }
                  icon={<Palette size={16} />}
                >
                  <div
                    className={
                      displayedCustomTheme !== "default"
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }
                  >
                    <CustomDropdown
                      options={tintOptions}
                      value={settings.tint}
                      onChange={handleTintChange}
                      placeholder="Select tint"
                      disabled={displayedCustomTheme !== "default"}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Accent color"
                  description={
                    displayedCustomTheme !== "default"
                      ? "Color is controlled by custom theme"
                      : "Customize the highlight color used for buttons, indicators, and focus rings."
                  }
                  icon={<Palette size={16} />}
                >
                  <ToggleRow
                    title="Dynamic accent color"
                    description="Automatically derive the accent color from your avatar's appearance."
                    checked={settings.useDynamicAccentColor}
                    onChange={() =>
                      onUpdateSettings({
                        useDynamicAccentColor: !settings.useDynamicAccentColor,
                      })
                    }
                    disabled={displayedCustomTheme !== "default"}
                  />

                  <div
                    className={cn(
                      "flex items-center gap-3 transition-opacity duration-200",
                      (settings.useDynamicAccentColor ||
                        displayedCustomTheme !== "default") &&
                        "opacity-50 pointer-events-none",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setIsColorPickerOpen(true)}
                      className="h-12 w-12 rounded-[var(--control-radius)] border border-[var(--color-border)] bg-transparent cursor-pointer hover:border-[var(--color-border-strong)] transition-colors flex-shrink-0"
                      style={{ backgroundColor: settings.accentColor }}
                      aria-label="Select accent color"
                    />
                    <div className="flex-1 flex flex-col justify-center gap-2">
                      <label
                        htmlFor="accent-color-hex"
                        className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide"
                      >
                        Hex value
                      </label>
                      <input
                        id="accent-color-hex"
                        type="text"
                        value={settings.accentColor}
                        readOnly
                        placeholder="#ffffff"
                        spellCheck={false}
                        className="mt-1 w-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--accent-color)] focus:outline-none cursor-pointer"
                        onClick={() => setIsColorPickerOpen(true)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleResetAccent}
                          className="px-3 py-2 text-xs font-medium rounded-[var(--control-radius)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          Reset to default
                        </button>
                        <span className="text-xs text-[var(--color-text-muted)] self-center">
                          Default: {DEFAULT_ACCENT_COLOR}
                        </span>
                      </div>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Custom Theme"
                  description="Add visual effects and animations to your interface."
                  icon={<Palette size={16} />}
                >
                  <CustomDropdown
                    options={customThemeOptions}
                    value={displayedCustomTheme}
                    onChange={handleCustomThemeChange}
                    placeholder="Select custom theme"
                  />
                  {displayedCustomTheme !== "default" && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-3">
                      Active custom theme with auto-applied colors. Switch to
                      "Default" to restore previous colors.
                    </p>
                  )}
                </SettingsCard>
              </Section>

              <Section
                title="Typography"
                description="Manage the fonts used throughout the interface."
              >
                <SettingsCard
                  title="Custom fonts"
                  description="Add fonts from Google Fonts to use in the application."
                  icon={<Type size={16} />}
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFontFamily}
                      onChange={(e) => {
                        setNewFontFamily(e.target.value);
                        setFontError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddFont();
                        }
                      }}
                      placeholder="Enter Google Font name (e.g., Roboto)"
                      className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--accent-color)] focus:outline-none"
                    />
                    <button
                      onClick={handleAddFont}
                      disabled={isAddingFont || !newFontFamily.trim()}
                      className="px-4 py-2 bg-[var(--accent-color)] text-[var(--accent-color-foreground)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isAddingFont ? (
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus size={16} />
                      )}
                      Add
                    </button>
                  </div>

                  {fontError && (
                    <p className="text-xs text-red-400">{fontError}</p>
                  )}

                  <p className="text-xs text-[var(--color-text-muted)]">
                    Browse available fonts at{" "}
                    <a
                      href="https://fonts.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-color)] hover:underline"
                    >
                      fonts.google.com
                    </a>
                  </p>
                </SettingsCard>

                <SettingsCard
                  title="Active font"
                  description="Select which font to use for the application interface."
                  icon={<Type size={16} />}
                >
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveFontMutation.mutate(null)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
                        activeFont === null
                          ? "border-[var(--accent-color)] bg-[var(--accent-color-faint)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)]/30 hover:border-[var(--color-border-strong)]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="text-sm text-[var(--color-text-primary)]"
                          style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                          Inter (Default)
                        </span>
                      </div>
                      {activeFont === null && (
                        <Check
                          size={16}
                          className="text-[var(--accent-color)]"
                        />
                      )}
                    </button>

                    {customFonts.map((font) => (
                      <div
                        key={font.family}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                          activeFont === font.family
                            ? "border-[var(--accent-color)] bg-[var(--accent-color-faint)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)]/30 hover:border-[var(--color-border-strong)]",
                        )}
                      >
                        <button
                          onClick={() =>
                            setActiveFontMutation.mutate(font.family)
                          }
                          className="flex-1 flex items-center gap-3 text-left"
                        >
                          <span
                            className="text-sm text-[var(--color-text-primary)]"
                            style={{
                              fontFamily: `'${font.family}', sans-serif`,
                            }}
                          >
                            {font.family}
                          </span>
                        </button>
                        <div className="flex items-center gap-2">
                          {activeFont === font.family && (
                            <Check
                              size={16}
                              className="text-[var(--accent-color)]"
                            />
                          )}
                          <button
                            onClick={() =>
                              removeFontMutation.mutate(font.family)
                            }
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                            title="Remove font"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {customFonts.length === 0 && (
                      <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                        No custom fonts added yet. Add a font from Google Fonts
                        above.
                      </p>
                    )}
                  </div>
                </SettingsCard>
              </Section>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  Notifications
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Configure how and when you want to be notified.
                </p>
              </div>

              <Section
                title="Friend activity"
                description="Choose which friend updates trigger an alert."
              >
                <SettingsCard
                  title="Friend alerts"
                  description="Notifications about your friends coming online, joining games, or removing you."
                  icon={<Bell size={16} />}
                >
                  <ToggleRow
                    title="Friend online"
                    description="Get notified when your friends come online."
                    checked={notifyFriendOnline}
                    onChange={() => setNotifyFriendOnline(!notifyFriendOnline)}
                    icon={<Users size={14} />}
                  />
                  <ToggleRow
                    title="Friend starts playing"
                    description="Get notified when your friends start playing a game."
                    checked={notifyFriendInGame}
                    onChange={() => setNotifyFriendInGame(!notifyFriendInGame)}
                    icon={<Bell size={14} />}
                  />
                  <ToggleRow
                    title="Friend removed you"
                    description="Get notified when someone unfriends you."
                    checked={notifyFriendRemoved}
                    onChange={() =>
                      setNotifyFriendRemoved(!notifyFriendRemoved)
                    }
                    icon={<Trash2 size={14} />}
                  />
                </SettingsCard>
              </Section>

              <Section
                title="Sessions"
                description="Surface details about the servers you join."
              >
                <SettingsCard
                  title="Server information"
                  description="Show the server location when joining a Roblox game."
                  icon={<Info size={16} />}
                >
                  <ToggleRow
                    title="Server location notifications"
                    description="Get notified of the server location when joining a Roblox game."
                    checked={notifyServerLocation}
                    onChange={() =>
                      setNotifyServerLocation(!notifyServerLocation)
                    }
                    icon={<Info size={14} />}
                  />
                </SettingsCard>
              </Section>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  Security
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Manage security settings and access controls.
                </p>
              </div>

              <Section
                title="Access control"
                description={`Protect the app with a ${PIN_POLICY.length}-digit PIN.`}
              >
                <SettingsCard
                  title="PIN lock"
                  description="Set a PIN that must be entered when Sentra starts."
                  icon={<Lock size={16} />}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => setIsPinDialogOpen(true)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        settings.pinCode
                          ? "text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20"
                          : "text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)]"
                      }`}
                    >
                      {settings.pinCode
                        ? "PIN Enabled - Click to Manage"
                        : "Set Up PIN"}
                    </button>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Require the PIN at startup to keep your launcher locked
                      down.
                    </p>
                  </div>
                </SettingsCard>
              </Section>

              <Section
                title="Tools"
                description="Security and system utilities."
              >
                <SettingsCard
                  title="Backup Accounts"
                  description="Create an encrypted backup of all your accounts."
                  icon={<BackupIcon size={16} />}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setIsBackupDialogOpen(true);
                        setBackupStep("pin");
                        setBackupPin(emptyPinDigits());
                        setBackupPinConfirm(emptyPinDigits());
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] transition-colors"
                    >
                      Create Backup
                    </button>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Backup all accounts to a secure file.
                    </p>
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Restore Accounts"
                  description="Restore accounts from a backup file."
                  icon={<BackupIcon size={16} />}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setIsRestoreDialogOpen(true);
                        setRestoreStep("pin");
                        setRestorePin(emptyPinDigits());
                        setRestoreBackupPin(emptyPinDigits());
                        setSelectedBackupFile(null);
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] transition-colors"
                    >
                      Load Backup
                    </button>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Restore accounts from a backup file.
                    </p>
                  </div>
                </SettingsCard>
              </Section>

              <Section
                title="User Agent Management"
                description="Swap and rotate user agents for all browser instances."
              >
                <SettingsCard
                  title="Current User Agent"
                  description="Manually rotate your user agent or enable automatic rotation."
                  icon={<Globe size={16} />}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
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
                            console.error(
                              "[SettingsTab] Failed to swap user agent:",
                              error,
                            );
                            addNotification({
                              type: "error",
                              title: "Swap Failed",
                              message:
                                error instanceof Error
                                  ? error.message
                                  : "Failed to swap user agent",
                            });
                          } finally {
                            setIsLoadingUserAgent(false);
                          }
                        }}
                        disabled={isLoadingUserAgent}
                        className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <RotateCcw size={14} />
                        Swap User Agent
                      </button>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Current: #{userAgentIndex + 1} of {allUserAgents.length}
                      </p>
                    </div>

                    <div className="bg-[var(--color-surface-hover)]/50 p-3 rounded-lg border border-[var(--color-border-strong)]/50">
                      <p className="text-xs text-[var(--color-text-muted)] mb-2">
                        Current user agent:
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] break-words font-mono">
                        {currentUserAgent || "Loading..."}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-[var(--color-surface-hover)]/50 rounded-lg border border-[var(--color-border-strong)]/50">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-[var(--color-text-primary)]">
                            Auto-swap User Agents
                          </label>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {autoSwapInterval} minutes
                          </span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="120"
                          step="5"
                          value={autoSwapInterval}
                          onChange={(e) =>
                            setAutoSwapInterval(Number(e.target.value))
                          }
                          disabled={isLoadingUserAgent}
                          className="w-full h-2 bg-[var(--color-surface-hover)] rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            setIsLoadingUserAgent(true);
                            const result =
                              await window.api.setAutoSwapUserAgent(
                                !isAutoSwapEnabled,
                                autoSwapInterval,
                              );
                            setIsAutoSwapEnabled(result.autoSwapEnabled);
                            addNotification({
                              type: "success",
                              title: result.autoSwapEnabled
                                ? "Auto-swap Enabled"
                                : "Auto-swap Disabled",
                              message: result.autoSwapEnabled
                                ? `User agent will rotate every ${result.intervalMinutes} minutes`
                                : "Auto user agent rotation disabled",
                            });
                          } catch (error) {
                            console.error(
                              "[SettingsTab] Failed to toggle auto-swap:",
                              error,
                            );
                            addNotification({
                              type: "error",
                              title: "Toggle Failed",
                              message:
                                error instanceof Error
                                  ? error.message
                                  : "Failed to toggle auto-swap",
                            });
                          } finally {
                            setIsLoadingUserAgent(false);
                          }
                        }}
                        disabled={isLoadingUserAgent}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                          isAutoSwapEnabled
                            ? "text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20"
                            : "text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-border-strong)] border border-[var(--color-border-strong)]"
                        }`}
                      >
                        <Zap size={14} />
                        {isAutoSwapEnabled ? "On" : "Off"}
                      </button>
                    </div>
                  </div>
                </SettingsCard>
              </Section>

              <Section
                title="Advanced Features"
                description="Power options that may violate platform policies."
              >
                <SettingsCard
                  title="Multiple Roblox instances"
                  description="Control whether multiple Roblox clients may be launched simultaneously."
                  icon={<Lock size={16} />}
                >
                  <ToggleRow
                    title="Allow multiple Roblox instances"
                    description={
                      isMac
                        ? "Disabled on macOS."
                        : "Enable launching multiple Roblox clients simultaneously."
                    }
                    checked={settings.allowMultipleInstances}
                    onChange={() =>
                      onUpdateSettings({
                        allowMultipleInstances:
                          !settings.allowMultipleInstances,
                      })
                    }
                    disabled={isMac}
                    hint={
                      !isMac && (
                        <span className="text-xs text-yellow-600/80">
                          Note: This feature may violate Roblox Terms of
                          Service. Use at your own risk.
                        </span>
                      )
                    }
                  />
                </SettingsCard>
              </Section>
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  About
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Application information and updates.
                </p>
              </div>

              <Section
                title="Updates"
                description="Check for and install application updates."
              >
                <SettingsCard
                  title="Updates"
                  description="Stay current with the latest release."
                  icon={<Info size={16} />}
                >
                  <UpdaterCard />
                </SettingsCard>
              </Section>

              <Section title="Legal" description="Terms and policies.">
                <SettingsCard
                  title="Privacy Policy"
                  description="Read about how we handle your data."
                  icon={<Shield size={16} />}
                >
                  <button
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="text-xs text-[var(--accent-color)] hover:underline flex items-center gap-1"
                  >
                    View Privacy Policy
                  </button>
                </SettingsCard>
              </Section>

              <Section
                title="Session"
                description="Manage local data and application state."
              >
                <SettingsCard
                  title="Clear Data"
                  description="Clear all local configuration data and return to the login screen."
                  icon={<AlertTriangle size={16} />}
                >
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-[var(--color-text-primary)] text-sm font-medium transition-colors"
                  >
                    Clear Data
                  </button>
                </SettingsCard>
              </Section>
            </div>
          )}

          {activeTab === "admin" && isAdmin && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                  Admin Panel
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Manage announcements and administrative features.
                </p>
              </div>

              <Section
                title="News Generator"
                description="Write announcements and copy the GitHub snippet below."
              >
                <SettingsCard
                  title="Generate News.js"
                  description="Enter announcements, then copy the output for the repo."
                  icon={<Bell size={16} />}
                >
                  <NewsGenerator />
                </SettingsCard>
              </Section>
            </div>
          )}
        </div>
      </div>

      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      <Dialog
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
      >
        <DialogContent className="max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Pick Accent Color</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <DialogBody>
            <ColorPicker
              value={settings.accentColor}
              onChange={handleAccentColorChange}
              className="w-full"
            >
              <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-stretch">
                  <div className="flex-1 h-64 rounded-lg overflow-hidden border border-[var(--color-border)]">
                    <ColorPickerSelection className="h-full" />
                  </div>
                  <div className="w-8 h-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 flex items-center justify-center">
                    <ColorPickerHue
                      orientation="vertical"
                      className="h-full w-full rounded-full"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2 items-end">
                    <div>
                      <ColorPickerEyeDropper />
                    </div>
                    <div className="flex-1">
                      <ColorPickerFormat />
                    </div>
                    <div>
                      <ColorPickerOutput />
                    </div>
                  </div>
                </div>
              </div>
            </ColorPicker>
          </DialogBody>
        </DialogContent>
      </Dialog>

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
                {backupStep === "pin"
                  ? "Verify PIN"
                  : backupStep === "backuppin"
                    ? "Set Backup PIN"
                    : "Choose Backup Location"}
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
            ) : backupStep === "backuppin" ? (
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
            ) : (
              <>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Where would you like to save your backup file?
                </p>
                <div className="space-y-3">
                  <label
                    className="flex items-center gap-3 p-3 border border-[var(--color-border-strong)] rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                    onClick={() => setBackupLocationMode("auto")}
                  >
                    <input
                      type="radio"
                      checked={backupLocationMode === "auto"}
                      onChange={() => setBackupLocationMode("auto")}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        Default Location
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Backed up automatically in the app's backup folder
                      </p>
                    </div>
                  </label>
                  <label
                    className="flex items-center gap-3 p-3 border border-[var(--color-border-strong)] rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                    onClick={() => setBackupLocationMode("custom")}
                  >
                    <input
                      type="radio"
                      checked={backupLocationMode === "custom"}
                      onChange={() => setBackupLocationMode("custom")}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        Custom Location
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Choose exactly where to save your backup file
                      </p>
                    </div>
                  </label>
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  if (backupStep === "location") {
                    setBackupStep("backuppin");
                    setBackupError(null);
                  } else {
                    setIsBackupDialogOpen(false);
                  }
                }}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                {backupStep === "location" ? "Back" : "Cancel"}
              </button>
              <button
                onClick={handleBackupAccounts}
                disabled={isBackupLoading}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[var(--accent-color)] text-black hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
              >
                {isBackupLoading
                  ? "Creating..."
                  : backupStep === "pin"
                    ? "Next"
                    : backupStep === "backuppin"
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
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[var(--accent-color)] text-black hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
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
    </div>
  );
};

export default SettingsTab;
