import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { queryKeys } from "@shared/queryKeys";
import { Account } from "@renderer/types";
import {
  mapPresenceToStatus,
  isActiveStatus,
} from "@renderer/utils/statusUtils";
import { useActiveTab } from "@renderer/stores/useUIStore";

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: async () => {
      const result = await window.api.getAccounts();

      return Array.isArray(result) ? result : [];
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useAccountStats(cookie: string | undefined) {
  return useQuery({
    queryKey: queryKeys.accounts.stats(cookie || ""),
    queryFn: () => window.api.fetchAccountStats(cookie!),
    enabled: !!cookie,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSaveAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accounts: Account[]) =>
      window.api.saveAccounts(accounts).catch((err) => {
        console.error(
          "[useSaveAccounts] saveAccounts failed:",
          err instanceof Error ? err.message : String(err),
        );
        throw err;
      }),
    onMutate: async (newAccounts) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.list() });

      const previousAccounts = queryClient.getQueryData<Account[]>(
        queryKeys.accounts.list(),
      );

      queryClient.setQueryData(queryKeys.accounts.list(), newAccounts);

      return { previousAccounts };
    },
    onSuccess: () => {},
    onError: (err, _newAccounts, context) => {
      console.error(
        "[useSaveAccounts] mutation failed, rolling back. Error:",
        err instanceof Error ? err.message : String(err),
      );

      if (context?.previousAccounts) {
        queryClient.setQueryData(
          queryKeys.accounts.list(),
          context.previousAccounts,
        );
      }
    },
  });
}

export function useAccountsManager() {
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading } = useAccounts();
  const { mutate: saveAccounts } = useSaveAccounts();

  const setAccounts = useCallback(
    (newAccountsOrUpdater: Account[] | ((prev: Account[]) => Account[])) => {
      const currentAccounts =
        queryClient.getQueryData<Account[]>(queryKeys.accounts.list()) || [];

      const safeCurrentAccounts = Array.isArray(currentAccounts)
        ? currentAccounts
        : [];

      const newAccounts =
        typeof newAccountsOrUpdater === "function"
          ? newAccountsOrUpdater(safeCurrentAccounts)
          : newAccountsOrUpdater;

      const safeNewAccounts = Array.isArray(newAccounts) ? newAccounts : [];

      queryClient.setQueryData(queryKeys.accounts.list(), safeNewAccounts);

      saveAccounts(safeNewAccounts);
    },
    [queryClient, saveAccounts],
  );

  const addAccount = useCallback(
    (account: Account) => {
      setAccounts((prev) =>
        prev.some((a) => a.id === account.id) ? prev : [...prev, account],
      );
    },
    [setAccounts],
  );

  const removeAccount = useCallback(
    (id: string) => {
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    },
    [setAccounts],
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) => {
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc)),
      );
    },
    [setAccounts],
  );

  const moveAccount = useCallback(
    (fromId: string, toId: string) => {
      setAccounts((prev) => {
        const fromIndex = prev.findIndex((a) => a.id === fromId);
        const toIndex = prev.findIndex((a) => a.id === toId);

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex)
          return prev;

        const newAccounts = [...prev];
        const [movedAccount] = newAccounts.splice(fromIndex, 1);
        newAccounts.splice(toIndex, 0, movedAccount);

        return newAccounts;
      });
    },
    [setAccounts],
  );

  return {
    accounts,
    isLoading,
    setAccounts,
    addAccount,
    removeAccount,
    updateAccount,
    moveAccount,
  };
}

export function useAccountStatuses(
  accounts: Account[],
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  },
) {
  const cookies = accounts
    .filter((acc) => acc.cookie)
    .map((acc) => acc.cookie!);

  const sortedCookies = [...cookies].sort();

  return useQuery({
    queryKey: queryKeys.accounts.statuses(sortedCookies),
    queryFn: () => window.api.getBatchAccountStatuses(cookies),
    enabled: cookies.length > 0 && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval ?? 5000,
    staleTime: 8000,

    refetchOnWindowFocus: false,
  });
}

export function updateAccountsWithStatuses(
  accounts: Account[],
  batchResults: Record<string, { userId: number; presence?: any } | null>,
): { accounts: Account[]; hasChanges: boolean } {
  let hasChanges = false;

  const updatedAccounts = accounts.map((acc) => {
    if (!acc.cookie) return acc;

    const result = batchResults[acc.cookie];
    if (!result || !result.presence) return acc;

    const statusData = result.presence;
    const newStatus = mapPresenceToStatus(statusData.userPresenceType);
    const now = new Date();
    const statusChanged = acc.status !== newStatus;
    const isCurrentlyActive = isActiveStatus(newStatus);

    if (isCurrentlyActive) {
      const lastActiveDate = acc.lastActive
        ? new Date(acc.lastActive)
        : new Date(0);
      const shouldUpdateTimestamp =
        now.getTime() - lastActiveDate.getTime() > 5 * 60 * 1000;

      if (shouldUpdateTimestamp || statusChanged) {
        hasChanges = true;
        return { ...acc, status: newStatus, lastActive: now.toISOString() };
      }
    }

    if (statusChanged) {
      hasChanges = true;
      return { ...acc, status: newStatus };
    }

    return acc;
  });

  return { accounts: updatedAccounts, hasChanges };
}

export function useAccountStatusPolling() {
  const queryClient = useQueryClient();
  const activeTab = useActiveTab();

  const accounts =
    queryClient.getQueryData<Account[]>(queryKeys.accounts.list()) || [];

  const pollInterval = activeTab === "Accounts" ? 30000 : 5 * 60 * 1000;

  const { data: batchResults } = useAccountStatuses(accounts, {
    enabled: accounts.length > 0,
    refetchInterval: pollInterval,
  });

  useEffect(() => {
    if (!batchResults) return;

    const currentAccounts =
      queryClient.getQueryData<Account[]>(queryKeys.accounts.list()) || [];
    if (currentAccounts.length === 0) return;

    const { accounts: updatedAccounts, hasChanges } =
      updateAccountsWithStatuses(currentAccounts, batchResults);

    if (hasChanges) {
      const cached = queryClient.getQueryData<Account[]>(
        queryKeys.accounts.list(),
      );
      if (JSON.stringify(cached) !== JSON.stringify(updatedAccounts)) {
        queryClient.setQueryData(queryKeys.accounts.list(), updatedAccounts);
      }
    }
  }, [batchResults, queryClient]);
}
