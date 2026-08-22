import type {} from "./window";
import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  lazy,
  Suspense,
} from "react";
import notificationIcon from "../../../resources/build/icons/png/256x256.png";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { Account, AccountStatus, JoinMethod } from "./types";
import { mapPresenceToStatus, isActiveStatus } from "./utils/statusUtils";
import { applyAccentColor } from "./utils/themeUtils";
import { getDominantAccentColorFromImageUrl } from "./utils/imageAccentColor";
import JoinModal from "./components/Modals/JoinModal";
import EditNoteModal from "./features/auth/Modals/EditNoteModal";
import AddAccountModal from "./features/auth/Modals/AddAccountModal";
import TwoFactorModal from "./components/Modals/TwoFactorModal";
import promptTwoFactor from "./lib/twoFactor";
import Sidebar from "./components/UI/navigation/Sidebar";
import TopNav from "./components/UI/navigation/TopNav";
import NotificationTray from "./components/UI/feedback/NotificationTray";
import SnackbarContainer from "./features/system/components/SnackbarContainer";

import ContextMenu from "./components/UI/menus/ContextMenu";
import AccountsTab from "./features/auth/index";
import PinLockScreen from "./components/UI/security/PinLockScreen";
import AlertDialog from "./components/UI/dialogs/AlertDialog";
import {
  OnboardingScreen,
  useHasCompletedOnboarding,
  useOnboardingStore,
} from "./features/onboarding";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useClickOutside } from "./hooks/useClickOutside";
import { useNotification } from "./features/system/stores/useSnackbarStore";
import InstanceSelectionModal from "./components/Modals/InstanceSelectionModal";
import { useInstallations } from "./features/install/stores/useInstallationsStore";
import LoadingSpinner, {
  LoadingSpinnerFullPage,
} from "./components/UI/feedback/LoadingSpinner";
import {
  useAccountsManager,
  useAccountStatusPolling,
  useSettingsManager,
  useFriends,
} from "./hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../shared/queryKeys";
import {
  bulkOperationLimiter,
  executeWithRetry,
  isRateLimitError,
  sleep,
} from "./lib/rateLimiter";
import {
  getVisibleSidebarTabs,
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
  SIDEBAR_TAB_IDS,
} from "@shared/navigation";
import { useCommandPaletteStore } from "./features/command-palette/stores/useCommandPaletteStore";
import { initCatalogSearchIndex } from "./features/command-palette/hooks";
import ErrorBoundary from "./components/ErrorBoundary";
import { useFriendPresenceNotifications } from "./hooks/useFriendPresenceNotifications";
import { useFriendJoinPopup } from "./hooks/useFriendJoinPopup";
import {
  useNotificationTrayStore,
  useNotifyServerLocation,
} from "./features/system/stores/useNotificationTrayStore";
import { useTheme } from "./theme/ThemeContext";
import { ThemeEffects } from "./components/ThemeEffects";

import {
  useActiveTab,
  useSetActiveTab,
  useModals,
  useOpenModal,
  useCloseModal,
  useActiveMenu,
  useSetActiveMenu,
  useEditingAccount,
  useSetEditingAccount,
  useInfoAccount,
  useSetInfoAccount,
  useSelectedGame,
  useSetSelectedGame,
  usePendingLaunchConfig,
  useSetPendingLaunchConfig,
  useAvailableInstallations,
  useSetAvailableInstallations,
  useAppUnlocked,
  useSetAppUnlocked,
  useNavLayout,
} from "./stores/useUIStore";

import {
  useSelectedIds,
  useSetSelectedIds,
  useSelectionStore,
} from "./stores/useSelectionStore";
import {
  useContentRadius,
  useNavBorderStyle,
  useUIDensity,
  useBlurIntensity,
  useIconWeight,
  useMotionSpeed,
  useFontWeight,
  useInitViewPreferencesFromBackend,
} from "./stores/useViewPreferencesStore";

const ProfileTab = lazy(() => import("./features/profile/index"));
const FriendsTab = lazy(() => import("./features/friends/index"));
const GroupsTab = lazy(() => import("./features/groups/index"));
const GamesTab = lazy(() => import("./features/games/index"));
const CatalogTab = lazy(() => import("./features/catalog/index"));
const InventoryTab = lazy(() => import("./features/inventory/index"));
const TransactionsTab = lazy(() => import("./features/transactions/index"));
const LogsTab = lazy(() => import("./features/system/LogsView"));
const SettingsTab = lazy(() => import("./features/settings/index"));
const AvatarTab = lazy(() => import("./features/avatar/index"));
const InstallTab = lazy(() => import("./features/install/index"));

const WatcherTab = lazy(() => import("./features/watcher/index"));
const MacroTab = lazy(() => import("./features/macro/index"));
const SniperTab = lazy(() => import("./features/sniper/index"));
const GeneratorTab = lazy(() => import("./features/generator/index"));
const AccountSettingsTab = lazy(
  () => import("./features/accountSettings/index"),
);
const GameDetailsModal = lazy(
  () => import("./features/games/Modals/GameDetailsModal"),
);
const AccessoryDetailsModal = lazy(
  () => import("./features/avatar/Modals/AccessoryDetailsModal"),
);
const UniversalProfileModal = lazy(
  () => import("./components/Modals/UniversalProfileModal"),
);
const CommandPalette = lazy(() => import("./features/command-palette/index"));
import BulkActionModal from "./features/auth/BulkActionModal";
import BulkTransactionsModal from "./features/auth/BulkTransactionsModal";

interface JoinConfig {
  method: JoinMethod;
  target: string;
}

const isMac = window.platform?.isMac ?? false;

const App: React.FC = () => {
  const catalogInitTriggeredRef = useRef(false);
  const lastAvatarRefreshAtRef = useRef(0);
  const avatarRefreshInFlightRef = useRef(false);
  const onboardingInitializedRef = useRef(false);

  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const hasCompletedOnboarding = useHasCompletedOnboarding();
  const isInitialized = useOnboardingStore((state) => state.isInitialized);
  const initializeFirstLaunch = useOnboardingStore(
    (state) => state.initializeFirstLaunch,
  );

  useEffect(() => {
    if (onboardingInitializedRef.current) return;
    onboardingInitializedRef.current = true;
    initializeFirstLaunch();
  }, [initializeFirstLaunch]);

  useEffect(() => {
    const remove = window.electron.ipcRenderer.on(
      "prompt-two-factor",
      async (
        _event: any,
        payload: { accountId?: string; message?: string },
      ) => {
        try {
          const code = await promptTwoFactor(payload);
          try {
            window.electron.ipcRenderer.send("two-factor-response", code);
          } catch {}
        } catch (err) {}
      },
    );

    return () => remove();
  }, []);

  const isAppUnlocked = useAppUnlocked();
  const setAppUnlocked = useSetAppUnlocked();

  const handlePinUnlock = useCallback(() => {
    setAppUnlocked(true);
  }, [setAppUnlocked]);

  const refreshRecentlyPlayed = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.games.recentlyPlayed(),
    });
  }, [queryClient]);

  const notifyServerLocation = useNotifyServerLocation();
  const addTrayNotification = useNotificationTrayStore(
    (state) => state.addNotification,
  );

  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  const isCommandPaletteOpen = useCommandPaletteStore((s) => s.isOpen);

  useEffect(() => {
    if (!isCommandPaletteOpen || catalogInitTriggeredRef.current) return;
    catalogInitTriggeredRef.current = true;
    initCatalogSearchIndex();
  }, [isCommandPaletteOpen]);

  const activeTab = useActiveTab();
  const setActiveTabState = useSetActiveTab();
  const modals = useModals();
  const openModal = useOpenModal();
  const closeModal = useCloseModal();
  const activeMenu = useActiveMenu();
  const setActiveMenu = useSetActiveMenu();
  const editingAccount = useEditingAccount();
  const setEditingAccount = useSetEditingAccount();
  const infoAccount = useInfoAccount();
  const setInfoAccount = useSetInfoAccount();
  const selectedGame = useSelectedGame();
  const setSelectedGame = useSetSelectedGame();
  const pendingLaunchConfig = usePendingLaunchConfig();
  const setPendingLaunchConfig = useSetPendingLaunchConfig();
  const [batchLaunchCallback, setBatchLaunchCallback] = useState<
    ((path?: string) => void) | null
  >(null);
  const availableInstallations = useAvailableInstallations();
  const setAvailableInstallations = useSetAvailableInstallations();

  const selectedIds = useSelectedIds();
  const setSelectedIds = useSetSelectedIds();
  const navLayout = useNavLayout();
  const contentRadius = useContentRadius();
  const navBorderStyle = useNavBorderStyle();
  const uiDensity = useUIDensity();
  const blurIntensity = useBlurIntensity();
  const iconWeight = useIconWeight();
  const motionSpeed = useMotionSpeed();
  const fontWeight = useFontWeight();

  const {
    accounts,
    isLoading: isLoadingAccounts,
    setAccounts,
    addAccount,
  } = useAccountsManager();

  useInitViewPreferencesFromBackend();

  const {
    settings,
    isLoading: isLoadingSettings,
    updateSettings,
  } = useSettingsManager();

  const [removeAccountOpen, setRemoveAccountOpen] = useState(false);
  const [removeAccountId, setRemoveAccountId] = useState<string | null>(null);
  const [removeMultipleCount, setRemoveMultipleCount] = useState(0);

  const [editingNoteAccounts, setEditingNoteAccounts] = useState<
    Account[] | null
  >(null);
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<
    "addFriend" | "joinGroup" | null
  >(null);
  const [isBulkActionProcessing, setIsBulkActionProcessing] = useState(false);
  const [bulkTransactionsOpen, setBulkTransactionsOpen] = useState(false);

  const [showBrowserCustomDialog, setShowBrowserCustomDialog] = useState(false);
  const [browserCustomUrl, setBrowserCustomUrl] = useState("");
  const [browserCustomAccountIds, setBrowserCustomAccountIds] =
    useState<Set<string> | null>(null);

  const refreshAccountAvatarUrls = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const now = Date.now();
      const minIntervalMs = 60 * 1000;
      if (!force && now - lastAvatarRefreshAtRef.current < minIntervalMs)
        return;
      if (avatarRefreshInFlightRef.current) return;

      avatarRefreshInFlightRef.current = true;
      const currentAccounts =
        queryClient.getQueryData<Account[]>(queryKeys.accounts.list()) || [];
      const userIds = currentAccounts
        .map((a) => Number(a.userId))
        .filter((id) => Number.isFinite(id));

      if (userIds.length === 0) {
        avatarRefreshInFlightRef.current = false;
        return;
      }

      try {
        const currentSelectedIds = useSelectionStore.getState().selectedIds;
        const selectedAccounts =
          currentSelectedIds.size > 0 ? Array.from(currentSelectedIds) : [];
        const selectedAccountId = selectedAccounts[0];
        const selectedAccount = currentAccounts.find(
          (a) => a.id === selectedAccountId,
        );
        const cookie =
          selectedAccount?.cookie ||
          currentAccounts.find((a) => a.cookie)?.cookie;
        const avatarMap = await window.api.getBatchUserAvatars(
          userIds,
          "420x420",
          cookie,
        );
        setAccounts((prev) => {
          let changed = false;
          const next = prev.map((acc) => {
            const uid = Number(acc.userId);
            const nextUrl = Number.isFinite(uid) ? avatarMap[uid] : null;

            if (nextUrl && nextUrl !== acc.avatarUrl) {
              changed = true;
              return { ...acc, avatarUrl: nextUrl };
            }
            return acc;
          });

          return changed ? next : prev;
        });

        lastAvatarRefreshAtRef.current = now;
      } catch (error) {
        console.warn(
          "[accounts] failed to refresh avatar thumbnails",
          error instanceof Error ? error.message : String(error),
        );
        showNotification("Failed to refresh avatar thumbnails", "error");
      } finally {
        avatarRefreshInFlightRef.current = false;
      }
    },
    [queryClient, setAccounts],
  );

  const initialAvatarRefreshRef = useRef(false);
  useEffect(() => {
    if (isLoadingAccounts) return;

    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    if (!initialAvatarRefreshRef.current) {
      startupTimer = setTimeout(() => {
        void refreshAccountAvatarUrls({ force: true });
        initialAvatarRefreshRef.current = true;
      }, 1500);
    }

    const intervalId = window.setInterval(() => {
      void refreshAccountAvatarUrls();
    }, 60 * 1000);
    return () => {
      if (startupTimer) clearTimeout(startupTimer);
      window.clearInterval(intervalId);
    };
  }, [isLoadingAccounts, refreshAccountAvatarUrls]);

  const joinDateBackfillRef = useRef(false);
  const premiumBackfillRef = useRef(false);
  useEffect(() => {
    if (isLoadingAccounts || joinDateBackfillRef.current) return;
    const missing = accounts.filter((a) => !a.joinDate && a.userId);
    if (missing.length === 0) return;
    joinDateBackfillRef.current = true;
    const userIds = missing
      .map((a) => Number(a.userId))
      .filter((id) => Number.isFinite(id));
    if (userIds.length === 0) return;

    const timer = setTimeout(() => {
      window.api
        .getBatchJoinDates(userIds)
        .then((dateMap) => {
          setAccounts((prev) =>
            prev.map((acc) => {
              if (acc.joinDate) return acc;
              const uid = Number(acc.userId);
              const created = Number.isFinite(uid) ? dateMap[uid] : undefined;
              if (created) return { ...acc, joinDate: created };
              return acc;
            }),
          );
        })
        .catch((err) => console.warn("[joinDate backfill] failed:", err));
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLoadingAccounts, accounts, setAccounts]);

  useEffect(() => {
    if (isLoadingAccounts || premiumBackfillRef.current) return;

    const missingPremium = accounts.filter(
      (a) => a.cookie && a.userId && a.isPremium === undefined,
    );
    if (missingPremium.length === 0) return;

    premiumBackfillRef.current = true;

    const timer = setTimeout(() => {
      Promise.all(
        missingPremium.map(async (account) => {
          const userId = Number(account.userId);
          if (!Number.isFinite(userId))
            return { id: account.id, isPremium: false };

          try {
            const details = await window.api.getExtendedUserDetails(
              account.cookie!,
              userId,
            );
            return { id: account.id, isPremium: details?.isPremium ?? false };
          } catch {
            return { id: account.id, isPremium: false };
          }
        }),
      )
        .then((updates) => {
          setAccounts((prev) =>
            prev.map((acc) => {
              const update = updates.find((u) => u.id === acc.id);
              return update ? { ...acc, isPremium: update.isPremium } : acc;
            }),
          );
        })
        .catch((err) => console.warn("[premium backfill] failed:", err));
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLoadingAccounts, accounts, setAccounts]);

  const sidebarTabOrder = useMemo(
    () => sanitizeSidebarOrder(settings.sidebarTabOrder),
    [settings.sidebarTabOrder],
  );
  const sidebarHiddenTabs = useMemo(
    () => sanitizeSidebarHidden(settings.sidebarHiddenTabs),
    [settings.sidebarHiddenTabs],
  );
  const visibleSidebarTabs = useMemo(
    () => getVisibleSidebarTabs(sidebarTabOrder, sidebarHiddenTabs),
    [sidebarHiddenTabs, sidebarTabOrder],
  );

  useAccountStatusPolling();

  const initialSelectionApplied = useRef(false);

  useEffect(() => {
    if (
      !isLoadingAccounts &&
      !isLoadingSettings &&
      !initialSelectionApplied.current
    ) {
      if (
        settings.primaryAccountId &&
        accounts.some((a) => a.id === settings.primaryAccountId)
      ) {
        setSelectedIds(new Set([settings.primaryAccountId]));
      }
      initialSelectionApplied.current = true;
    }
  }, [
    isLoadingAccounts,
    isLoadingSettings,
    accounts,
    settings.primaryAccountId,
    setSelectedIds,
  ]);

  const sidebarRef = useRef<HTMLElement>(null);
  const { sidebarWidth, isResizing, setIsResizing } = useSidebarResize();

  const filterRef = useRef<HTMLDivElement>(null);

  useClickOutside(filterRef, () => {});

  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest("[data-menu-id]") &&
        !target.closest(".fixed.z-\\[1100\\]")
      ) {
        setActiveMenu(null);
      }
    };

    const handleScroll = () => setActiveMenu(null);

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [activeMenu, setActiveMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!isCommandPaletteOpen) {
          openCommandPalette();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCommandPalette, isCommandPaletteOpen]);

  const selectedAccountId = useMemo(() => {
    return selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
  }, [selectedIds]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId || isLoadingAccounts) return;
    void refreshAccountAvatarUrls();
  }, [isLoadingAccounts, refreshAccountAvatarUrls, selectedAccountId]);

  const accentAvatarUrl = useMemo(() => {
    if (selectedAccount?.avatarUrl) return selectedAccount.avatarUrl;
    if (settings.primaryAccountId) {
      return (
        accounts.find((a) => a.id === settings.primaryAccountId)?.avatarUrl ??
        null
      );
    }
    return null;
  }, [accounts, selectedAccount?.avatarUrl, settings.primaryAccountId]);

  useEffect(() => {
    if (!settings.useDynamicAccentColor || !accentAvatarUrl) return;

    const controller = new AbortController();
    getDominantAccentColorFromImageUrl(accentAvatarUrl, {
      signal: controller.signal,
    })
      .then((hex) => {
        if (controller.signal.aborted) return;
        applyAccentColor(hex);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn(
          "[theme] failed to derive accent from avatar thumbnail",
          error,
        );
      });

    return () => controller.abort();
  }, [accentAvatarUrl, settings.useDynamicAccentColor]);

  const { data: friendsData = [] } = useFriends(selectedAccount);

  useFriendPresenceNotifications(
    friendsData,
    !!selectedAccount,
    selectedAccount?.id,
  );
  useFriendJoinPopup();

  const [quickProfileUserId, setQuickProfileUserId] = useState<string | null>(
    null,
  );

  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("dark");
  }, [setTheme]);

  useEffect(() => {
    const isSidebarTab = SIDEBAR_TAB_IDS.includes(activeTab);
    if (isSidebarTab && !visibleSidebarTabs.includes(activeTab)) {
      const fallbackTab = visibleSidebarTabs[0];
      if (fallbackTab) {
        setActiveTabState(fallbackTab);
      }
    }
  }, [activeTab, setActiveTabState, visibleSidebarTabs]);

  useEffect(() => {
    window.api.setDiscordRPCTab(activeTab).catch((error) => {
      console.error("Failed to set Discord RPC tab:", error);
    });
  }, [activeTab]);

  const [commandPaletteAccessory, setCommandPaletteAccessory] = useState<{
    id: number;
    name: string;
    imageUrl?: string;
  } | null>(null);

  const handleCommandPaletteViewProfile = useCallback((userId: string) => {
    setQuickProfileUserId(userId);
  }, []);

  const handleCommandPaletteViewAccessory = useCallback(
    (item: { id: number; name: string; imageUrl?: string }) => {
      setCommandPaletteAccessory(item);
    },
    [],
  );

  const multiInstanceAllowed = settings.allowMultipleInstances;

  const performLaunch = async (config: JoinConfig, installPath?: string) => {
    closeModal("join");

    const accountsToLaunch = accounts.filter((acc) => selectedIds.has(acc.id));
    if (accountsToLaunch.length === 0) {
      showNotification("No accounts selected", "warning");
      return;
    }

    if (accountsToLaunch.length > 1 && !multiInstanceAllowed) {
      showNotification(
        "Multi-instance launching is disabled in Settings.",
        "warning",
      );
      return;
    }

    let launchPlaceId: string | number = "";
    let launchJobId: string | undefined = undefined;
    let launchFriendId: string | undefined = undefined;
    let launchPrivateServerTarget: string | undefined = undefined;

    try {
      if (config.method === JoinMethod.PlaceId) {
        launchPlaceId = config.target;
      } else if (config.method === JoinMethod.Friend) {
        const parts = config.target.split(":");
        if (parts.length === 2) {
          launchFriendId = parts[0];
          launchPlaceId = parts[1];
        }
      } else if (config.method === JoinMethod.PrivateServer) {
        const raw = config.target.trim();
        if (!raw) {
          showNotification("Private server target is required", "warning");
          return;
        }

        if (/^https?:\/\//i.test(raw)) {
          try {
            const url = new URL(raw);
            const placeMatch = url.pathname.match(/\/games\/(\d+)/i);
            const placeFromUrl = placeMatch?.[1];
            if (!placeFromUrl) {
              showNotification(
                "Private server URL is missing a valid place ID",
                "warning",
              );
              return;
            }
            launchPlaceId = placeFromUrl;
            launchPrivateServerTarget = raw;
          } catch {
            showNotification("Private server link is invalid", "warning");
            return;
          }
        } else if (raw.includes(":")) {
          const [placePart, ...serverParts] = raw.split(":");
          if (!placePart || !serverParts.length) {
            showNotification(
              "Use the format PlaceID:PrivateServerCode",
              "warning",
            );
            return;
          }
          launchPlaceId = placePart;
          launchPrivateServerTarget = serverParts.join(":");
        } else {
          showNotification(
            "Use a private server link or format like PlaceID:ServerCode",
            "warning",
          );
          return;
        }
      } else if (config.method === JoinMethod.Username) {
        const targetUser = await window.api.getUserByUsername(config.target);
        if (!targetUser) {
          showNotification(`User "${config.target}" not found`, "error");
          return;
        }
        const cookie = accountsToLaunch[0].cookie;
        if (!cookie) {
          showNotification(
            "First selected account needs a valid cookie to check presence",
            "error",
          );
          return;
        }
        const presence = await window.api.getUserPresence(
          cookie,
          targetUser.id,
        );

        if (!presence || presence.userPresenceType !== 2) {
          showNotification(
            `${config.target} is not currently in a game`,
            "warning",
          );
          return;
        }
        const resolvedPlaceId = presence.rootPlaceId ?? presence.placeId;
        if (!resolvedPlaceId) {
          showNotification(
            "Unable to determine the game location for this user.",
            "error",
          );
          return;
        }
        launchPlaceId = resolvedPlaceId;
        launchJobId = presence.gameId ?? undefined;
      } else if (config.method === JoinMethod.JobId) {
        if (config.target.includes(":")) {
          const [pid, jid] = config.target.split(":");
          launchPlaceId = pid;
          launchJobId = jid;
        } else {
          showNotification(
            'Launching by Job ID requires Place ID. Use Format "PlaceID:JobID"',
            "warning",
          );
          return;
        }
      }

      if (!launchPlaceId) {
        showNotification("Invalid Place ID", "error");
        return;
      }

      showNotification(
        `Launching ${accountsToLaunch.length} account${accountsToLaunch.length === 1 ? "" : "s"}...`,
        "info",
      );

      const accountsWithCookie = accountsToLaunch.filter((acc) => acc.cookie);
      if (accountsWithCookie.length === 0) {
        showNotification("No accounts with valid cookies selected", "warning");
        return;
      }

      let launchedAny = false;

      const launchOneAccount = async (
        account: (typeof accountsToLaunch)[0],
      ) => {
        try {
          const logsBeforeLaunch = notifyServerLocation
            ? await window.api.getLogs()
            : [];

          setAccounts((prev) =>
            prev.map((a) =>
              a.id === account.id
                ? { ...a, lastActive: new Date().toISOString() }
                : a,
            ),
          );
          const logTimestampBefore =
            logsBeforeLaunch.length > 0 ? logsBeforeLaunch[0].lastModified : 0;

          if (launchPrivateServerTarget) {
            await window.api.launchPrivateServer(
              account.cookie!,
              launchPlaceId,
              launchPrivateServerTarget,
              installPath,
            );
          } else {
            await window.api.launchGame(
              account.cookie!,
              launchPlaceId,
              launchJobId,
              launchFriendId,
              installPath,
            );
          }
          showNotification(
            `Launched successfully for ${account.displayName}`,
            "success",
          );
          launchedAny = true;

          if (notifyServerLocation) {
            const pollForServerLocation = async () => {
              const maxAttempts = 15;
              const pollInterval = 2000;

              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise((r) => setTimeout(r, pollInterval));

                try {
                  const currentLogs = await window.api.getLogs();
                  const newLog = currentLogs.find(
                    (log) =>
                      log.lastModified > logTimestampBefore &&
                      log.serverIp &&
                      log.placeId === String(launchPlaceId),
                  );

                  if (newLog?.serverIp) {
                    const region = await window.api.getRegionFromAddress(
                      newLog.serverIp,
                    );
                    if (region && region !== "Unknown" && region !== "Failed") {
                      addTrayNotification({
                        type: "info",
                        title: "Server Location",
                        message: `Connected to server in ${region}`,
                        gameInfo: {
                          name: `Place ${launchPlaceId}`,
                          placeId: String(launchPlaceId),
                        },
                      });

                      if ("Notification" in window) {
                        if (Notification.permission === "granted") {
                          new Notification("Server Location", {
                            body: `Connected to server in ${region}`,
                            icon: notificationIcon,
                          });
                        } else if (Notification.permission !== "denied") {
                          Notification.requestPermission().then(
                            (permission) => {
                              if (permission === "granted") {
                                new Notification("Server Location", {
                                  body: `Connected to server in ${region}`,
                                  icon: notificationIcon,
                                });
                              }
                            },
                          );
                        }
                      }
                    }
                    return;
                  }
                } catch (pollError) {
                  console.warn("Error polling for server location:", pollError);
                }
              }
              console.warn("Timed out waiting for server location from logs");
            };

            pollForServerLocation();
          }
        } catch (e: any) {
          console.error(
            `Failed to launch for ${account.displayName}`,
            e instanceof Error ? e.message : String(e),
          );
          showNotification(
            `Failed to launch for ${account.displayName}: ${e.message}`,
            "error",
          );
        }
      };

      await Promise.all(accountsWithCookie.map(launchOneAccount));
      launchedAny = accountsWithCookie.length > 0;

      if (launchedAny) {
        window.setTimeout(() => {
          refreshRecentlyPlayed();
        }, 4000);
      }
    } catch (error: any) {
      console.error(
        "Launch error:",
        error instanceof Error ? error.message : String(error),
      );
      showNotification(`Launch failed: ${error.message}`, "error");
    }
  };

  const installations = useInstallations();
  const uniqueInstallations = useMemo(() => {
    const seen = new Set<string>();
    return installations.filter((installation) => {
      const normalizedPath = installation.path.trim().toLowerCase();
      if (!normalizedPath || seen.has(normalizedPath)) return false;
      seen.add(normalizedPath);
      return true;
    });
  }, [installations]);

  const handleLaunch = useCallback(
    (config: JoinConfig) => {
      const defaultInstallPath = settings.defaultInstallationPath?.trim();
      const singleInstallationPath =
        uniqueInstallations.length === 1
          ? uniqueInstallations[0]?.path
          : undefined;

      if (defaultInstallPath) {
        performLaunch(config, defaultInstallPath);
        return;
      }

      if (uniqueInstallations.length <= 1) {
        performLaunch(config, singleInstallationPath);
        return;
      }

      setAvailableInstallations(uniqueInstallations);
      setPendingLaunchConfig(config);
      closeModal("join");
      openModal("instanceSelection");
    },
    [
      settings.defaultInstallationPath,
      uniqueInstallations,
      performLaunch,
      setAvailableInstallations,
      setPendingLaunchConfig,
      closeModal,
      openModal,
    ],
  );

  const handleCommandPaletteLaunchGame = useCallback(
    (method: JoinMethod, target: string) => {
      if (selectedIds.size === 0) {
        showNotification("Select an account first to launch a game", "warning");
        return;
      }
      handleLaunch({ method, target });
    },
    [selectedIds.size, showNotification, handleLaunch],
  );

  const handleInstanceSelect = useCallback(
    (path?: string) => {
      closeModal("instanceSelection");
      if (pendingLaunchConfig) {
        performLaunch(pendingLaunchConfig, path);
        setPendingLaunchConfig(null);
      } else if (batchLaunchCallback) {
        batchLaunchCallback(path);
        setBatchLaunchCallback(null);
      }
    },
    [closeModal, pendingLaunchConfig, performLaunch, batchLaunchCallback],
  );

  const handleBatchLaunchRequest = useCallback(
    (callback: (path?: string) => void) => {
      const defaultInstallPath = settings.defaultInstallationPath?.trim();
      const singleInstallationPath =
        uniqueInstallations.length === 1
          ? uniqueInstallations[0]?.path
          : undefined;

      if (defaultInstallPath) {
        callback(defaultInstallPath);
        return;
      }

      if (uniqueInstallations.length <= 1) {
        callback(singleInstallationPath);
        return;
      }

      setAvailableInstallations(uniqueInstallations);
      setBatchLaunchCallback(() => callback);
      openModal("instanceSelection");
    },
    [
      settings.defaultInstallationPath,
      uniqueInstallations,
      setAvailableInstallations,
      openModal,
    ],
  );

  const handleFriendJoin = useCallback(
    (placeId: string | number, jobId?: string, userId?: string | number) => {
      const placeTarget =
        typeof placeId === "number" ? placeId.toString() : placeId;
      let config: JoinConfig;
      if (userId) {
        config = {
          method: JoinMethod.Friend,
          target: `${userId}:${placeTarget}`,
        };
      } else if (jobId) {
        config = {
          method: JoinMethod.JobId,
          target: `${placeTarget}:${jobId}`,
        };
      } else {
        config = { method: JoinMethod.PlaceId, target: placeTarget };
      }
      handleLaunch(config);
    },
    [handleLaunch],
  );

  const handleBulkOpenBrowsers = useCallback(() => {
    if (selectedIds.size === 0) return;

    const selectedAccounts = accounts.filter((account) =>
      selectedIds.has(account.id),
    );
    const accountsWithCookies = selectedAccounts.filter(
      (account) => account.cookie,
    );
    const missingCookies = selectedAccounts.filter(
      (account) => !account.cookie,
    );
    if (missingCookies.length > 0) {
      showNotification(
        `Skipping ${missingCookies.length} account${missingCookies.length === 1 ? "" : "s"} without a valid cookie`,
        "warning",
      );
    }

    if (accountsWithCookies.length === 0) return;

    void (async () => {
      await Promise.all(
        accountsWithCookies.map(async (account, index) => {
          if (index > 0)
            await new Promise((resolve) => setTimeout(resolve, index * 200));
          try {
            await window.api.openBrowserWithAccount(
              account.id,
              "https://www.roblox.com/home",
            );
            setAccounts((prev) =>
              prev.map((a) =>
                a.id === account.id
                  ? { ...a, lastActive: new Date().toISOString() }
                  : a,
              ),
            );
          } catch (error) {
            console.error(
              "Failed to open browser for",
              account.username,
              error,
            );
          }
        }),
      );

      showNotification(
        `Opened ${accountsWithCookies.length} browser window${accountsWithCookies.length === 1 ? "" : "s"}`,
        "success",
      );
    })();
  }, [accounts, selectedIds, showNotification]);

  const handleBulkCopyCookies = useCallback(() => {
    if (selectedIds.size === 0) return;

    const selectedAccounts = accounts.filter((account) =>
      selectedIds.has(account.id),
    );
    const cookies = selectedAccounts
      .filter((account) => account.cookie)
      .map((account) => account.cookie);
    if (cookies.length === 0) {
      showNotification(
        "No valid cookies found in selected accounts",
        "warning",
      );
      return;
    }

    void navigator.clipboard
      .writeText(cookies.join("\n"))
      .then(() => {
        showNotification(
          `Copied ${cookies.length} cookie${cookies.length === 1 ? "" : "s"} to clipboard`,
          "success",
        );
      })
      .catch((error) => {
        console.error("Failed to copy cookies", error);
        showNotification("Failed to copy cookies to clipboard", "error");
      });
  }, [accounts, selectedIds, showNotification]);

  const handleBulkRemove = useCallback(() => {
    if (selectedIds.size === 0) return;
    setRemoveMultipleCount(selectedIds.size);
    setRemoveAccountId(null);
    setRemoveAccountOpen(true);
  }, [selectedIds.size]);

  const handleBulkAddFriend = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBulkActionType("addFriend");
    setBulkActionOpen(true);
  }, [selectedIds.size]);

  const handleBulkJoinGroup = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBulkActionType("joinGroup");
    setBulkActionOpen(true);
  }, [selectedIds.size]);

  const handleChangeDisplayName = useCallback(
    (id: string) => {
      setSelectedIds(new Set([id]));
      openModal("changeDisplayName");
      setActiveMenu(null);
    },
    [openModal, setSelectedIds, setActiveMenu],
  );

  const handleBulkChangeDisplayName = useCallback(() => {
    if (selectedIds.size === 0) return;
    openModal("changeDisplayName");
    setActiveMenu(null);
  }, [openModal, selectedIds, setActiveMenu]);

  const handleBulkActionSubmit = async (targetId: number) => {
    if (selectedIds.size === 0 || !bulkActionType) return;
    setIsBulkActionProcessing(true);

    const selectedAccounts = accounts.filter((account) =>
      selectedIds.has(account.id),
    );
    const missingCookies = selectedAccounts.filter(
      (account) => !account.cookie,
    );
    if (missingCookies.length > 0) {
      showNotification(
        `Skipping ${missingCookies.length} account${missingCookies.length === 1 ? "" : "s"} without a valid cookie`,
        "warning",
      );
    }

    let successCount = 0;
    let failCount = 0;

    for (const account of selectedAccounts) {
      if (!account.cookie) continue;
      try {
        if (bulkActionType === "addFriend") {
          await executeWithRetry(
            bulkOperationLimiter,
            () => window.api.sendFriendRequest(account.cookie!, targetId),
            {
              retryCondition: isRateLimitError,
              maxAttempts: 20,
              initialDelayMs: 5000,
              maxDelayMs: 60000,
            },
          );
        } else if (bulkActionType === "joinGroup") {
          await executeWithRetry(
            bulkOperationLimiter,
            () => window.api.joinGroup(account.cookie!, targetId),
            {
              retryCondition: isRateLimitError,
              maxAttempts: 20,
              initialDelayMs: 5000,
              maxDelayMs: 60000,
            },
          );
        }
        successCount++;
        await sleep(1000);
      } catch (error) {
        console.error(
          `Failed bulk ${bulkActionType} for`,
          account.username,
          error,
        );
        failCount++;
      }
    }

    setIsBulkActionProcessing(false);
    setBulkActionOpen(false);
    setBulkActionType(null);

    const actionName =
      bulkActionType === "addFriend"
        ? "Friend requests sent"
        : "Group join requests sent";
    if (failCount === 0) {
      showNotification(
        `Success: ${actionName} from ${successCount} account${successCount === 1 ? "" : "s"}`,
        "success",
      );
    } else {
      showNotification(
        `Completed: ${actionName} from ${successCount} account${successCount === 1 ? "" : "s"}. Failed: ${failCount}`,
        "warning",
      );
    }
  };

  const handleIndividualRemove = useCallback(
    (id: string) => {
      setRemoveAccountId(id);
      setRemoveAccountOpen(true);
      setActiveMenu(null);
    },
    [setActiveMenu],
  );

  const handleEditNote = useCallback(
    (id: string) => {
      const account = accounts.find((a) => a.id === id);
      if (account) {
        setEditingNoteAccounts([account]);
      }
      setActiveMenu(null);
    },
    [accounts],
  );

  const handleBulkEditNote = useCallback(() => {
    const selected = accounts.filter((a) => selectedIds.has(a.id));
    if (selected.length > 0) {
      setEditingNoteAccounts(selected);
    }
    setActiveMenu(null);
  }, [accounts, selectedIds]);

  const handleSaveNote = useCallback(
    (accountIds: string[], newNote: string) => {
      const idsSet = new Set(accountIds);
      setAccounts((prev) =>
        prev.map((acc) =>
          idsSet.has(acc.id) ? { ...acc, notes: newNote } : acc,
        ),
      );
      setEditingNoteAccounts(null);
    },
    [setAccounts],
  );

  const handleReauth = async (id: string) => {
    setActiveMenu(null);
    const account = accounts.find((a) => a.id === id);
    if (!account) return;

    showNotification(`Please log into ${account.username}...`, "info");

    try {
      const cookie = await window.api.openRobloxLoginWindow();
      if (!cookie) {
        showNotification("Login cancelled", "warning");
        return;
      }

      const data = await window.api.validateCookie(cookie);
      if (data.id.toString() !== id) {
        showNotification(
          `You logged into a different account (${data.name}). Re-authentication failed.`,
          "error",
        );
        return;
      }

      let isPremium = false;
      try {
        const details = await window.api.getExtendedUserDetails(
          cookie,
          Number(data.id),
        );
        isPremium = details?.isPremium ?? false;
      } catch (e) {
        console.warn(
          "Failed to refresh premium status during re-auth:",
          e instanceof Error ? e.message : String(e),
        );
      }

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === id ? { ...acc, cookie, age: data.age, isPremium } : acc,
        ),
      );
      showNotification(
        `Successfully re-authenticated ${account.displayName}!`,
        "success",
      );
    } catch (e) {
      if (e instanceof Error && e.message === "LOGIN_WINDOW_CLOSED") {
        showNotification("Login window closed", "warning");
        return;
      }
      showNotification(
        "Failed to re-authenticate: " +
          (e instanceof Error ? e.message : String(e)),
        "error",
      );
    }
  };

  const handleBulkReauth = async () => {
    setActiveMenu(null);
    const idsToReauth = Array.from(selectedIds);
    if (idsToReauth.length === 0) return;

    showNotification(
      `Re-authenticating ${idsToReauth.length} accounts...`,
      "info",
    );

    let successCount = 0;
    let failCount = 0;

    for (const id of idsToReauth) {
      const account = accounts.find((a) => a.id === id);
      if (!account) continue;

      showNotification(`Please log into ${account.username}...`, "info");

      try {
        const cookie = await window.api.openRobloxLoginWindow();
        if (!cookie) {
          failCount++;
          continue;
        }

        const data = await window.api.validateCookie(cookie);
        if (data.id.toString() !== id) {
          showNotification(
            `Expected ${account.username}, but logged into ${data.name}. Skipping...`,
            "error",
          );
          failCount++;
          continue;
        }

        let isPremium = false;
        try {
          const details = await window.api.getExtendedUserDetails(
            cookie,
            Number(data.id),
          );
          isPremium = details?.isPremium ?? false;
        } catch (e) {
          console.warn(
            "Failed to refresh premium status during bulk re-auth:",
            e instanceof Error ? e.message : String(e),
          );
        }

        setAccounts((prev) =>
          prev.map((acc) =>
            acc.id === id ? { ...acc, cookie, age: data.age, isPremium } : acc,
          ),
        );
        successCount++;
      } catch (e) {
        if (e instanceof Error && e.message === "LOGIN_WINDOW_CLOSED") {
          showNotification(
            "Login window closed. Stopping bulk re-auth.",
            "warning",
          );
          break;
        }
        failCount++;
      }
    }

    if (successCount > 0) {
      showNotification(
        `Successfully re-authenticated ${successCount} accounts.`,
        "success",
      );
    }
    if (failCount > 0) {
      showNotification(
        `Failed to re-authenticate ${failCount} accounts.`,
        "error",
      );
    }
  };

  const handleOpenBrowserHome = async (id: string) => {
    const account = accounts.find((a) => a.id === id);
    if (!account) {
      showNotification("Account not found", "error");
      setActiveMenu(null);
      return;
    }

    try {
      await window.api.openBrowserWithAccount(
        id,
        "https://www.roblox.com/home",
      );
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, lastActive: new Date().toISOString() } : a,
        ),
      );
      showNotification(
        `Opening Roblox home for ${account.displayName || account.username}...`,
        "info",
      );
    } catch (error) {
      console.error("Failed to open browser:", error);
      showNotification("Failed to open browser with account", "error");
    }
    setActiveMenu(null);
  };

  const handleOpenBrowserCustom = useCallback(
    (id: string) => {
      setBrowserCustomAccountIds(new Set([id]));
      setShowBrowserCustomDialog(true);
      setActiveMenu(null);
    },
    [setActiveMenu],
  );

  const handleBulkOpenBrowserCustom = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBrowserCustomAccountIds(new Set(selectedIds));
    setShowBrowserCustomDialog(true);
    setActiveMenu(null);
  }, [selectedIds, setActiveMenu]);

  const handleBrowserCustomUrlSubmit = async () => {
    if (
      !browserCustomUrl.trim() ||
      !browserCustomAccountIds ||
      browserCustomAccountIds.size === 0
    )
      return;

    let finalUrl = browserCustomUrl.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }

    const selectedAccounts = accounts.filter(
      (a) => browserCustomAccountIds.has(a.id) && a.cookie,
    );

    if (selectedAccounts.length === 0) {
      showNotification("No valid accounts found to open", "error");
      return;
    }

    const results = await Promise.allSettled(
      selectedAccounts.map(async (acc, index) => {
        if (index > 0) await new Promise((r) => setTimeout(r, index * 200));
        await window.api.openBrowserWithAccount(acc.id, finalUrl);
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === acc.id
              ? { ...a, lastActive: new Date().toISOString() }
              : a,
          ),
        );
      }),
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    if (successCount > 0) {
      showNotification(
        `Opened ${finalUrl} for ${successCount} account${successCount === 1 ? "" : "s"}`,
        "success",
      );
    } else {
      showNotification("Failed to open browsers", "error");
    }

    setShowBrowserCustomDialog(false);
    setBrowserCustomUrl("");
    setBrowserCustomAccountIds(null);
  };

  const handleOpenBrowsers = async () => {
    const accountsToOpen = accounts.filter(
      (acc) => selectedIds.has(acc.id) && acc.cookie,
    );
    if (accountsToOpen.length === 0) {
      const totalSelected = accounts.filter((acc) =>
        selectedIds.has(acc.id),
      ).length;
      if (totalSelected === 0) {
        showNotification("No accounts selected", "warning");
      } else {
        showNotification(
          "None of the selected accounts have a valid cookie",
          "warning",
        );
      }
      return;
    }

    await Promise.all(
      accountsToOpen.map(async (account, index) => {
        if (index > 0)
          await new Promise((resolve) => setTimeout(resolve, index * 200));
        try {
          await window.api.openBrowserWithAccount(
            account.id,
            "https://www.roblox.com/home",
          );
          setAccounts((prev) =>
            prev.map((a) =>
              a.id === account.id
                ? { ...a, lastActive: new Date().toISOString() }
                : a,
            ),
          );
        } catch (error) {
          console.error(
            `Failed to open browser for ${account.displayName}:`,
            error instanceof Error ? error.message : String(error),
          );
          showNotification(
            `Failed to open browser for ${account.displayName || account.username}`,
            "error",
          );
        }
      }),
    );

    showNotification(
      `Opened ${accountsToOpen.length} browser window${accountsToOpen.length !== 1 ? "s" : ""}`,
      "success",
    );
  };

  const handleGetCookie = async (id: string) => {
    const account = accounts.find((a) => a.id === id);
    if (!account) {
      showNotification("Account not found", "error");
      return;
    }

    if (account.cookie) {
      try {
        await navigator.clipboard.writeText(account.cookie);
        showNotification(
          `Cookie copied for ${account.displayName || account.username}`,
          "success",
        );
      } catch (error) {
        console.error(
          "Failed to copy cookie:",
          error instanceof Error ? error.message : String(error),
        );
        showNotification("Failed to copy cookie to clipboard", "error");
      }
    } else {
      showNotification(
        `No cookie available for ${account.displayName || account.username}`,
        "warning",
      );
    }
  };

  const handleGetCookies = async () => {
    const accountsToExport = accounts.filter((acc) => selectedIds.has(acc.id));
    if (accountsToExport.length === 0) {
      showNotification("No accounts selected", "warning");
      return;
    }

    const cookies = accountsToExport
      .filter((acc) => acc.cookie)
      .map((acc) => acc.cookie)
      .join("\n");

    if (cookies.length === 0) {
      showNotification(
        "No valid cookies found in selected accounts",
        "warning",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(cookies);
      showNotification(
        `Copied ${accountsToExport.filter((acc) => acc.cookie).length} cookie${
          accountsToExport.filter((acc) => acc.cookie).length !== 1 ? "s" : ""
        } to clipboard`,
        "success",
      );
    } catch (error) {
      console.error(
        "Failed to copy cookies:",
        error instanceof Error ? error.message : String(error),
      );
      showNotification("Failed to copy cookies to clipboard", "error");
    }
    setActiveMenu(null);
  };

  const handleAddAccount = async (
    cookie: string,
    importedVia?: "browser" | "cookie" | "cookielist",
  ) => {
    try {
      const cookieValue = cookie.trim();
      const expectedStart =
        "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_";

      let actualCookieValue = cookieValue;
      const match = cookieValue.match(/\.ROBLOSECURITY=([^;]+)/);
      if (match) {
        actualCookieValue = match[1].trim();
      }

      if (!actualCookieValue.startsWith(expectedStart)) {
        showNotification(
          "Invalid cookie format. The cookie must start with the Roblox security warning.",
          "error",
        );
        return;
      }

      const data = await window.api.validateCookie(actualCookieValue);

      const existing =
        queryClient.getQueryData<Account[]>(queryKeys.accounts.list()) || [];
      if (existing.some((acc) => acc.id === data.id.toString())) {
        showNotification("Account already added!", "warning");
        return;
      }

      const avatarUrl = await window.api.getAvatarUrl(data.id.toString());

      let premiumStatus = false;
      try {
        const details = await window.api.getExtendedUserDetails(
          actualCookieValue,
          Number(data.id),
        );
        premiumStatus = details?.isPremium ?? false;
      } catch (e) {
        console.warn(
          "Failed to fetch premium status:",
          e instanceof Error ? e.message : String(e),
        );
      }

      let status = AccountStatus.Offline;
      try {
        const statusData = await window.api.getAccountStatus(actualCookieValue);
        if (statusData) {
          status = mapPresenceToStatus(statusData.userPresenceType);
        }
      } catch (e) {
        console.warn(
          "Failed to fetch account status:",
          e instanceof Error ? e.message : String(e),
        );
      }

      const newAccount: Account = {
        id: data.id.toString(),
        displayName: data.displayName,
        username: data.name,
        userId: data.id.toString(),
        cookie: actualCookieValue,
        status: status,
        importedVia: importedVia || "cookie",
        avatarUrl: avatarUrl,
        isPremium: premiumStatus,
        lastActive: isActiveStatus(status) ? new Date().toISOString() : "",
        robuxBalance: 0,
        friendCount: 0,
        followerCount: 0,
        followingCount: 0,
        notes: "",
        joinDate: data.created,
        age: data.age,
      };

      const freshAccounts =
        queryClient.getQueryData<Account[]>(queryKeys.accounts.list()) || [];
      const isFirstAccount = freshAccounts.length === 0;
      addAccount(newAccount);
      const currentPrimary = queryClient.getQueryData<{
        primaryAccountId?: string;
      }>(queryKeys.settings.snapshot())?.primaryAccountId;
      if (isFirstAccount && !currentPrimary) {
        updateSettings({ primaryAccountId: newAccount.id });
      }

      closeModal("addAccount");
      showNotification(
        `Successfully added account: ${newAccount.displayName}`,
        "success",
      );
    } catch (error) {
      console.error(
        "Failed to add account:",
        error instanceof Error ? error.message : String(error),
      );
      showNotification(
        "Failed to add account. Please check the cookie and try again.",
        "error",
      );
    }
  };

  if (!isInitialized || isLoadingAccounts) {
    return (
      <div className="flex h-screen w-full bg-[var(--color-app-bg)] text-[var(--color-text-muted)] font-sans">
        <LoadingSpinnerFullPage label="Loading..." />
      </div>
    );
  }

  return (
    <div
      id="app-container"
      data-radius={contentRadius}
      data-nav-border={navBorderStyle}
      data-density={uiDensity}
      data-blur={blurIntensity}
      data-icon-weight={iconWeight}
      data-motion={motionSpeed}
      data-font-weight={fontWeight}
      className={`flex h-screen w-full bg-[var(--color-app-bg)] text-[var(--color-text-muted)] font-sans overflow-hidden overflow-x-hidden selection:bg-[var(--accent-color-soft)] selection:text-[var(--color-text-primary)] ${settings.privacyMode ? "privacy-mode" : ""} ${navLayout === "topbar" ? "flex-col" : "flex-row"}`}
    >
      {}
      {navLayout === "sidebar" ? (
        <Sidebar
          sidebarWidth={sidebarWidth}
          isResizing={isResizing}
          sidebarRef={sidebarRef}
          onResizeStart={() => setIsResizing(true)}
          selectedAccounts={accounts.filter((a) => selectedIds.has(a.id))}
          primaryAccount={
            accounts.find((a) => a.id === settings.primaryAccountId) ||
            accounts[0] ||
            null
          }
          selectedAccount={selectedAccount}
          showProfileCard={settings.showSidebarProfileCard}
          privacyMode={settings.privacyMode}
          tabOrder={sidebarTabOrder}
          hiddenTabs={sidebarHiddenTabs}
        />
      ) : (
        <TopNav
          selectedAccounts={accounts.filter((a) => selectedIds.has(a.id))}
          primaryAccount={
            accounts.find((a) => a.id === settings.primaryAccountId) ||
            accounts[0] ||
            null
          }
          selectedAccount={selectedAccount}
          showProfileCard={settings.showSidebarProfileCard}
          privacyMode={settings.privacyMode}
          tabOrder={sidebarTabOrder}
          hiddenTabs={sidebarHiddenTabs}
          onOpenCommandPalette={openCommandPalette}
          onOpenTransactions={() => setActiveTabState("Transactions")}
          onOpenUserProfile={handleCommandPaletteViewProfile}
        />
      )}

      {}
      <main
        className="flex-1 flex flex-col min-w-0 bg-transparent h-full relative overflow-hidden text-[var(--color-text-secondary)]"
        style={{ zIndex: 3 }}
      >
        {}
        {navLayout === "sidebar" && (
          <div
            className="h-[45px] bg-[var(--color-titlebar)] flex-shrink-0 w-full border-b border-[var(--color-border)] flex items-center justify-end"
            style={
              {
                WebkitAppRegion: "drag",
                paddingRight: isMac ? "16px" : "138px",
              } as React.CSSProperties
            }
          >
            {}
            <div
              className="flex items-center mr-2 gap-2"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openCommandPalette();
                }}
                className="relative p-2 rounded-md transition-all hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                title="Search (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
              </button>
              <NotificationTray
                onOpenUserProfile={handleCommandPaletteViewProfile}
              />
              {!isMac && (
                <div className="w-px h-5 bg-[var(--color-border)] mx-2" />
              )}
            </div>
          </div>
        )}
        {}
        <div className="flex-1 flex flex-col h-full min-h-0 w-full relative tab-transition-surface">
          <div
            className={`flex-1 overflow-hidden h-full flex flex-col ${
              ["Accounts", "Groups", "Settings", "Profile", "Friends"].includes(
                activeTab,
              )
                ? "glass-panel-main rounded-none"
                : ""
            }`}
          >
            {(() => {
              switch (activeTab) {
                case "Accounts":
                  return (
                    <AccountsTab
                      accounts={accounts}
                      onAccountsChange={setAccounts}
                      allowMultipleInstances={multiInstanceAllowed}
                      privacyMode={settings.privacyMode}
                      onBatchLaunchRequest={handleBatchLaunchRequest}
                    />
                  );
                case "Profile":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      {selectedAccount ? (
                        <ProfileTab
                          account={selectedAccount}
                          privacyMode={settings.privacyMode}
                          onJoinGame={handleFriendJoin}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                          <p>Select an account to view profile</p>
                        </div>
                      )}
                    </Suspense>
                  );
                case "Friends":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <FriendsTab
                        selectedAccount={selectedAccount}
                        onFriendJoin={handleFriendJoin}
                      />
                    </Suspense>
                  );
                case "Groups":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <GroupsTab selectedAccount={selectedAccount} />
                    </Suspense>
                  );
                case "Games":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <GamesTab onGameSelect={setSelectedGame} />
                    </Suspense>
                  );
                case "Catalog":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <CatalogTab
                        onItemSelect={handleCommandPaletteViewAccessory}
                        onCreatorSelect={(creatorId) =>
                          setQuickProfileUserId(String(creatorId))
                        }
                        cookie={accounts.find((a) => a.cookie)?.cookie}
                      />
                    </Suspense>
                  );
                case "Inventory":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <InventoryTab account={selectedAccount} />
                    </Suspense>
                  );
                case "Transactions":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <TransactionsTab
                        accounts={accounts.filter((a) => selectedIds.has(a.id))}
                      />
                    </Suspense>
                  );
                case "Logs":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <LogsTab privacyMode={settings.privacyMode} />
                    </Suspense>
                  );
                case "Avatar":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <AvatarTab account={selectedAccount} />
                    </Suspense>
                  );
                case "Install":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <InstallTab />
                    </Suspense>
                  );

                case "Watcher":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <WatcherTab 
                        privacyMode={settings.privacyMode} 
                        onBatchLaunchRequest={handleBatchLaunchRequest}
                      />
                    </Suspense>
                  );
                case "Macro":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <MacroTab />
                    </Suspense>
                  );
                case "Sniper":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <SniperTab />
                    </Suspense>
                  );
                case "Generator":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <GeneratorTab />
                    </Suspense>
                  );
                case "Settings":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <SettingsTab
                        accounts={accounts}
                        settings={settings}
                        onUpdateSettings={updateSettings}
                      />
                    </Suspense>
                  );
                case "AccountSettings":
                  return (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          <LoadingSpinner size="lg" label="Loading..." />
                        </div>
                      }
                    >
                      <AccountSettingsTab
                        account={selectedAccount}
                        privacyMode={settings.privacyMode}
                      />
                    </Suspense>
                  );
                default:
                  return null;
              }
            })()}
          </div>
        </div>
      </main>

      {}
      <JoinModal
        isOpen={modals.join}
        onClose={() => closeModal("join")}
        onLaunch={handleLaunch}
        selectedCount={selectedIds.size}
      />

      <AddAccountModal
        isOpen={modals.addAccount}
        onClose={() => closeModal("addAccount")}
        onAdd={handleAddAccount}
      />

      <EditNoteModal
        isOpen={!!editingNoteAccounts}
        onClose={() => setEditingNoteAccounts(null)}
        onSave={handleSaveNote}
        accounts={editingNoteAccounts}
        privacyMode={settings.privacyMode}
      />

      <Suspense fallback={null}>
        <UniversalProfileModal
          isOpen={!!infoAccount}
          onClose={() => setInfoAccount(null)}
          userId={infoAccount?.userId || null}
          selectedAccount={infoAccount}
          privacyMode={settings.privacyMode}
          initialData={{
            name: infoAccount?.username,
            displayName: infoAccount?.displayName,
            status: infoAccount?.status,
            headshotUrl: infoAccount?.avatarUrl,
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <GameDetailsModal
          isOpen={!!selectedGame}
          onClose={() => setSelectedGame(null)}
          onLaunch={handleLaunch}
          game={selectedGame}
          account={selectedAccount || accounts.find((a) => a.cookie) || null}
        />
      </Suspense>

      {}
      <TwoFactorModal />

      {}
      <AnimatePresence>
        {showBrowserCustomDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-40"
            onClick={() => setShowBrowserCustomDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-lg p-6 w-96 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">
                Open Link
              </h2>
              <input
                type="text"
                value={browserCustomUrl}
                onChange={(e) => setBrowserCustomUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleBrowserCustomUrlSubmit();
                  }
                }}
                placeholder="Enter URL (e.g., roblox.com or https://example.com)"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] mb-4"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowBrowserCustomDialog(false);
                    setBrowserCustomUrl("");
                    setBrowserCustomAccountIds(null);
                  }}
                  className="px-4 py-2 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBrowserCustomUrlSubmit}
                  disabled={!browserCustomUrl.trim()}
                  className="px-4 py-2 rounded-md bg-[var(--accent-color)] text-[var(--accent-color-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Open
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstanceSelectionModal
        isOpen={modals.instanceSelection}
        onClose={() => {
          closeModal("instanceSelection");
          setPendingLaunchConfig(null);
        }}
        onSelect={handleInstanceSelect}
        installations={availableInstallations}
      />

      <Suspense fallback={null}>
        <UniversalProfileModal
          isOpen={!!quickProfileUserId}
          onClose={() => setQuickProfileUserId(null)}
          userId={quickProfileUserId}
          selectedAccount={accounts.find((a) => a.cookie) || null}
          privacyMode={settings.privacyMode}
          initialData={null}
        />
      </Suspense>

      <Suspense fallback={null}>
        <AccessoryDetailsModal
          isOpen={!!commandPaletteAccessory}
          onClose={() => setCommandPaletteAccessory(null)}
          assetId={commandPaletteAccessory?.id || null}
          account={accounts.find((a) => a.cookie) || null}
          initialData={
            commandPaletteAccessory
              ? {
                  name: commandPaletteAccessory.name,
                  imageUrl: commandPaletteAccessory.imageUrl || "",
                }
              : undefined
          }
        />
      </Suspense>

      {}
      <AnimatePresence>
        {isCommandPaletteOpen && (
          <Suspense fallback={null}>
            <ErrorBoundary>
              <CommandPalette
                onViewProfile={handleCommandPaletteViewProfile}
                onLaunchGame={handleCommandPaletteLaunchGame}
                onViewAccessory={handleCommandPaletteViewAccessory}
              />
            </ErrorBoundary>
          </Suspense>
        )}
      </AnimatePresence>

      {}
      <ContextMenu
        activeMenu={activeMenu}
        accounts={accounts}
        selectedIds={selectedIds}
        onViewDetails={setInfoAccount}
        onEditNote={handleEditNote}
        onReauth={handleReauth}
        onOpenBrowserHome={handleOpenBrowserHome}
        onOpenBrowserCustom={handleOpenBrowserCustom}
        onGetCookie={handleGetCookie}
        onRemove={handleIndividualRemove}
        onBulkOpenBrowsers={handleBulkOpenBrowsers}
        onBulkCopyCookies={handleBulkCopyCookies}
        onBulkRemove={handleBulkRemove}
        onBulkOpenBrowserCustom={handleBulkOpenBrowserCustom}
        onBulkEditNote={handleBulkEditNote}
        onBulkReauth={handleBulkReauth}
        onChangeDisplayName={handleChangeDisplayName}
        onBulkChangeDisplayName={handleBulkChangeDisplayName}
        onClose={() => setActiveMenu(null)}
      />

      <AlertDialog
        isOpen={removeAccountOpen}
        onClose={() => {
          setRemoveAccountOpen(false);
          setRemoveAccountId(null);
          setRemoveMultipleCount(0);
        }}
        title={
          removeAccountId
            ? "Remove Account"
            : `Remove ${removeMultipleCount} Accounts`
        }
        message={
          removeAccountId
            ? "Are you sure you want to remove this account? This action cannot be undone."
            : `Are you sure you want to remove ${removeMultipleCount} account${removeMultipleCount !== 1 ? "s" : ""}? This action cannot be undone.`
        }
        type="confirm"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => {
          if (removeAccountId) {
            setAccounts((prev) =>
              prev.filter((acc) => acc.id !== removeAccountId),
            );
            if (selectedIds.has(removeAccountId)) {
              const newSet = new Set(selectedIds);
              newSet.delete(removeAccountId);
              setSelectedIds(newSet);
            }
          } else if (removeMultipleCount > 0) {
            setAccounts((prev) =>
              prev.filter((acc) => !selectedIds.has(acc.id)),
            );
            setSelectedIds(new Set());
          }
          setRemoveAccountId(null);
          setRemoveMultipleCount(0);
        }}
        isDangerous
      />

      {}
      {bulkActionType && (
        <BulkActionModal
          isOpen={bulkActionOpen}
          onClose={() => {
            setBulkActionOpen(false);
            setBulkActionType(null);
          }}
          actionType={bulkActionType}
          onSubmit={handleBulkActionSubmit}
          isProcessing={isBulkActionProcessing}
          selectedCount={selectedIds.size}
        />
      )}

      {}
      <SnackbarContainer />

      {}
      <AnimatePresence>
        {hasCompletedOnboarding && !isAppUnlocked && (
          <PinLockScreen onUnlock={handlePinUnlock} />
        )}
      </AnimatePresence>

      {}
      <AnimatePresence>
        {!hasCompletedOnboarding && <OnboardingScreen />}
      </AnimatePresence>

      {}
      {}
      <ThemeEffects />
    </div>
  );
};

export default App;
