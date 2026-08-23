import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import type { UpdateState } from "../../../../../shared/ipc-schemas/updater";

export const updaterQueryKeys = {
  state: ["updater", "state"] as const,
};

export function useUpdaterState() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: updaterQueryKeys.state,
    queryFn: () => window.api.getUpdaterState(),
    staleTime: 30000,
    refetchInterval: false,
  });

  useEffect(() => {
    const cleanup = window.api.onUpdaterStatus((state: UpdateState) => {
      queryClient.setQueryData(updaterQueryKeys.state, state);
    });

    return cleanup;
  }, [queryClient]);

  return query;
}

export function useCheckForUpdates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => window.api.checkForUpdates(),
    onSuccess: (state) => {
      queryClient.setQueryData(updaterQueryKeys.state, state);
    },
  });
}

export function useDownloadUpdate() {
  return useMutation({
    mutationFn: () => window.api.downloadUpdate(),
  });
}

export function useInstallUpdate() {
  return useMutation({
    mutationFn: () => window.api.installUpdate(),
  });
}

export function useUpdater() {
  const state = useUpdaterState();
  const checkMutation = useCheckForUpdates();
  const downloadMutation = useDownloadUpdate();
  const installMutation = useInstallUpdate();

  /*
      Depend on `mutate`, not on the mutation object.

      React Query hands back a fresh result object on every render, so keying
      these callbacks to it made them change identity constantly. Anything that
      held one in an effect's dependencies re-ran that effect on every render —
      which is what stopped the automatic update check from ever firing. `mutate`
      itself is stable for the life of the mutation.
  */
  const { mutate: check } = checkMutation;
  const { mutate: download } = downloadMutation;
  const { mutate: install } = installMutation;

  const checkForUpdates = useCallback(() => check(), [check]);
  const downloadUpdate = useCallback(() => download(), [download]);
  const installUpdate = useCallback(() => install(), [install]);

  return {
    state: state.data,
    isLoading: state.isLoading,
    isChecking: checkMutation.isPending || state.data?.status === "checking",
    isDownloading:
      downloadMutation.isPending || state.data?.status === "downloading",
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
