import React, { useState, useMemo, memo, useCallback } from "react";
import { UserPlus, X, MoreHorizontal, MousePointerClick } from "lucide-react";
import { Account, AccountStatus } from "@renderer/types";
import AccountsToolbar from "./AccountsToolbar";
import AccountListView from "./AccountListView";
import AccountGridView from "./AccountGridView";
import {
  useSelectedIds,
  useSetSelectedIds,
  useToggleSelection,
} from "../../stores/useSelectionStore";
import {
  useSetActiveMenu,
  useSetInfoAccount,
  useOpenModal,
} from "../../stores/useUIStore";
import { useVoiceSettingsForAccounts } from "./api/useVoiceSettings";
import { VoiceSettings } from "@shared/ipc-schemas";
import { useNotification } from "../system/stores/useSnackbarStore";
import { EmptyState } from "../../components/UI/feedback/EmptyState";
import { Button } from "../../components/UI/buttons/Button";
import { BulkRobloxSettingsModal } from "./Modals/BulkRobloxSettingsModal";
import { ChangeDisplayNameModal } from "./Modals/ChangeDisplayNameModal";
import {
  bulkOperationLimiter,
  executeWithRetry,
  isRateLimitError,
} from "@renderer/lib/rateLimiter";
import { AccountsEmptyState } from "./components/AccountsEmptyState";
import { Users } from "lucide-react";

type ViewMode = "list" | "grid";

interface AccountsTabProps {
  accounts: Account[];
  onAccountsChange: (accounts: Account[]) => void;
  onUpdateSortOrder?: (sortedIds: string[]) => void;
  allowMultipleInstances: boolean;
  privacyMode?: boolean;
  onBatchLaunchRequest?: (callback: (path?: string) => void) => void;
}

type VoiceBanInfo = {
  message: string;
  endsAt?: number;
};

const formatDurationShort = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && minutes) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push("less than 1m");

  return parts.slice(0, 2).join(" ");
};

const getVoiceBanInfo = (status?: VoiceSettings): VoiceBanInfo | null => {
  if (!status || !status.isBanned) return null;

  const seconds = status.bannedUntil?.Seconds;
  const nanos = status.bannedUntil?.Nanos ?? 0;

  const endsAt =
    typeof seconds === "number"
      ? seconds * 1000 + Math.floor(nanos / 1_000_000)
      : undefined;

  if (!endsAt) {
    return { message: "Voice chat banned" };
  }

  const remaining = endsAt - Date.now();
  const message =
    remaining > 0
      ? `Voice chat banned · ${formatDurationShort(remaining)} left`
      : "Voice chat ban active";

  return { message, endsAt };
};

const AccountsTab = memo(
  ({
    accounts,
    onAccountsChange,
    onUpdateSortOrder,
    allowMultipleInstances,
    privacyMode,
  }: AccountsTabProps) => {
    const selectedIds = useSelectedIds();
    const setSelectedIds = useSetSelectedIds();
    const toggleSelection = useToggleSelection();
    const setActiveMenu = useSetActiveMenu();
    const setInfoAccount = useSetInfoAccount();
    const openModal = useOpenModal();
    const { showNotification } = useNotification();

    const [isBulkSettingsOpen, setIsBulkSettingsOpen] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    const { statusByAccountId } = useVoiceSettingsForAccounts(accounts);
    const notifiedVoiceBansRef = React.useRef<Set<string>>(new Set());

    const voiceBanInfo = useMemo(() => {
      const map: Record<string, VoiceBanInfo> = {};

      Object.entries(statusByAccountId).forEach(([accountId, status]) => {
        const info = getVoiceBanInfo(status);
        if (info) {
          map[accountId] = info;
        }
      });

      return map;
    }, [statusByAccountId]);

    React.useEffect(() => {
      Object.entries(voiceBanInfo).forEach(([accountId, info]) => {
        if (notifiedVoiceBansRef.current.has(accountId)) return;
        const account = accounts.find((a) => a.id === accountId);
        const name = account?.displayName || account?.username || "Account";
        const remainingText = info.message
          .replace("Voice chat banned", "")
          .replace(/^·\s*/, "");
        const message =
          remainingText.length > 0
            ? `${name} is voice chat banned — ${remainingText}`
            : `${name} is voice chat banned`;

        showNotification(message, "warning");
        notifiedVoiceBansRef.current.add(accountId);
      });
    }, [voiceBanInfo, accounts, showNotification]);

    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [statusFilter, setStatusFilter] = useState<AccountStatus | "All">(
      "All",
    );

    React.useEffect(() => {
      const loadViewMode = async () => {
        try {
          const savedMode = await window.api.getAccountsViewMode();
          if (savedMode) {
            setViewMode(savedMode);
          }
        } catch (error) {
          console.error("Failed to load view mode:", error);
        }
      };
      loadViewMode();
    }, []);

    const handleViewModeToggle = () => {
      const newMode = viewMode === "list" ? "grid" : "list";
      setViewMode(newMode);
      window.api.setAccountsViewMode(newMode);
    };

    const filteredAccounts = useMemo(() => {
      return accounts.filter((acc) => {
        const matchesSearch =
          (acc.displayName || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (acc.username || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (acc.notes || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus =
          statusFilter === "All" || acc.status === statusFilter;

        return matchesSearch && matchesStatus;
      });
    }, [accounts, searchQuery, statusFilter]);

    const allSelected =
      filteredAccounts.length > 0 &&
      selectedIds.size === filteredAccounts.length;
    const isIndeterminate =
      selectedIds.size > 0 && selectedIds.size < filteredAccounts.length;

    const toggleSelectAll = useCallback(() => {
      if (allSelected) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(filteredAccounts.map((a) => a.id)));
      }
    }, [allSelected, filteredAccounts, setSelectedIds]);

    const toggleSelect = useCallback(
      (id: string) => {
        toggleSelection(id);
      },
      [toggleSelection],
    );

    const handleMenuOpen = useCallback(
      (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveMenu({
          id,
          x: e.clientX,
          y: e.clientY,
        });
      },
      [setActiveMenu],
    );

    const handleInfoOpen = useCallback(
      (e: React.MouseEvent, account: Account) => {
        e.stopPropagation();
        setInfoAccount(account);
      },
      [setInfoAccount],
    );

    const isFiltering = searchQuery !== "" || statusFilter !== "All";

    const handleMoveAccount = useCallback(
      (fromId: string, toId: string) => {
        if (isFiltering) return;

        const fromIndex = accounts.findIndex((a) => a.id === fromId);
        const toIndex = accounts.findIndex((a) => a.id === toId);

        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

        const newAccounts = [...accounts];
        const [movedItem] = newAccounts.splice(fromIndex, 1);
        newAccounts.splice(toIndex, 0, movedItem);

        if (onUpdateSortOrder) {
          onUpdateSortOrder(newAccounts.map((a) => a.id));
        }
      },
      [isFiltering, accounts, onUpdateSortOrder],
    );

    const totalRobux = useMemo(() => {
      if (selectedIds.size > 0) {
        return accounts
          .filter((a) => selectedIds.has(a.id))
          .reduce((sum, acc) => sum + (acc.robuxBalance || 0), 0);
      }
      return accounts.reduce((sum, acc) => sum + (acc.robuxBalance || 0), 0);
    }, [accounts, selectedIds]);

    const [validationProgress, setValidationProgress] = useState<{
      current: number;
      total: number;
    } | null>(null);
    const [validationStatus, setValidationStatus] = useState<
      "validating" | "ratelimited" | null
    >(null);

    const handleValidateAccounts = async () => {
      setIsValidating(true);

      const accountsToValidate = accounts.filter((acc) =>
        selectedIds.has(acc.id),
      );
      setValidationProgress({ current: 0, total: accountsToValidate.length });
      setValidationStatus("validating");

      const newAccounts = [...accounts];
      let validCount = 0;
      let invalidCount = 0;

      let processed = 0;
      for (const acc of newAccounts) {
        if (!selectedIds.has(acc.id)) continue;
        if (!acc.cookie) {
          acc.cookieInvalid = true;
          invalidCount++;
          processed++;
          setValidationProgress({
            current: processed,
            total: accountsToValidate.length,
          });
          continue;
        }

        try {
          const data = await executeWithRetry(
            bulkOperationLimiter,
            () => window.api.validateCookie(acc.cookie!),
            {
              retryCondition: isRateLimitError,
            },
          );
          acc.cookieInvalid = false;
          if (data.created) {
            acc.joinDate = data.created;
          }
          if (data.age !== undefined) {
            acc.age = data.age;
          }

          try {
            const details = await window.api.getExtendedUserDetails(
              acc.cookie!,
              Number(acc.userId),
            );
            acc.isPremium = details?.isPremium ?? false;
          } catch (error) {
            console.warn(
              "Failed to refresh premium status during validation:",
              error,
            );
          }
          validCount++;
        } catch (error: any) {
          acc.cookieInvalid = true;
          invalidCount++;
          if (isRateLimitError(error)) {
            setValidationStatus("ratelimited");
          }
        }

        processed++;
        setValidationStatus("validating");
        setValidationProgress({
          current: processed,
          total: accountsToValidate.length,
        });
      }

      onAccountsChange(newAccounts);
      window.api.saveAccounts(newAccounts).catch((error) => {
        console.error(
          "Failed to persist updated accounts after validation:",
          error,
        );
      });
      setIsValidating(false);
      setValidationProgress(null);
      setValidationStatus(null);
      showNotification(
        `Validation complete. ${validCount} valid, ${invalidCount} invalid.`,
        invalidCount > 0 ? "error" : "success",
      );
    };

    return (
      <div className="flex flex-col h-full bg-[var(--color-app-bg)] relative overflow-hidden font-sans text-[var(--color-text-secondary)]">
        <AccountsToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filteredAccountsCount={filteredAccounts.length}
          selectedCount={selectedIds.size}
          viewMode={viewMode}
          onViewModeToggle={handleViewModeToggle}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAddAccount={() => openModal("addAccount")}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          isIndeterminate={isIndeterminate}
          totalRobux={totalRobux}
          onBulkSettingsClick={() => setIsBulkSettingsOpen(true)}
          onValidateAccountsClick={handleValidateAccounts}
          isValidating={isValidating}
          validationProgress={validationProgress}
          validationStatus={validationStatus}
        />

        <BulkRobloxSettingsModal
          isOpen={isBulkSettingsOpen}
          onClose={() => setIsBulkSettingsOpen(false)}
          selectedAccounts={accounts.filter((a) => selectedIds.has(a.id))}
          onSuccess={() => {}}
        />

        <ChangeDisplayNameModal
          accounts={accounts}
          selectedIds={selectedIds}
          onAccountsChange={onAccountsChange}
        />

        <div className="flex-1 overflow-hidden relative bg-[var(--color-surface)]">
          {filteredAccounts.length === 0 ? (
            <div className="h-full flex items-center justify-center p-8">
              {accounts.length === 0 ? (
                <AccountsEmptyState
                  onAddAccount={() => openModal("addAccount")}
                />
              ) : (
                <EmptyState
                  title="No accounts match"
                  description="Try adjusting your search or clearing the filter."
                  action={
                    statusFilter !== "All" ? (
                      <button
                        onClick={() => setStatusFilter("All")}
                        className="pressable text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline mt-1 transition-colors"
                      >
                        Clear filters
                      </button>
                    ) : undefined
                  }
                  className="animate-in fade-in slide-in-from-bottom-4 duration-300"
                />
              )}
            </div>
          ) : viewMode === "list" ? (
            <AccountListView
              accounts={filteredAccounts}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onMenuOpen={handleMenuOpen}
              onInfoOpen={handleInfoOpen}
              onMoveAccount={!isFiltering ? handleMoveAccount : undefined}
              voiceBanInfo={voiceBanInfo}
              privacyMode={privacyMode}
            />
          ) : (
            <AccountGridView
              accounts={filteredAccounts}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onMenuOpen={handleMenuOpen}
              onInfoOpen={handleInfoOpen}
              onMoveAccount={!isFiltering ? handleMoveAccount : undefined}
              voiceBanInfo={voiceBanInfo}
              privacyMode={privacyMode}
            />
          )}
        </div>
      </div>
    );
  },
);

export default AccountsTab;
