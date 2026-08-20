import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { queryKeys } from "../../../../../shared/queryKeys";
import { Settings, DEFAULT_ACCENT_COLOR } from "@renderer/types";
import {
  DEFAULT_SIDEBAR_TAB_ORDER,
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
} from "@shared/navigation";
import { applyAccentColor } from "@renderer/utils/themeUtils";
import { applyTint, getCurrentThemeNameFromDom } from "@renderer/theme/theme";
import { initializeFonts, CustomFont } from "@renderer/utils/fontUtils";

const DEFAULT_SETTINGS: Settings = {
  primaryAccountId: null,
  allowMultipleInstances: false,
  multiInstanceMethod: "mutex",
  defaultInstallationPath: null,
  accentColor: DEFAULT_ACCENT_COLOR,
  useDynamicAccentColor: false,
  tint: "neutral",
  showSidebarProfileCard: true,
  privacyMode: false,
  sidebarTabOrder: DEFAULT_SIDEBAR_TAB_ORDER,
  sidebarHiddenTabs: [],
  pinCode: null,

  catalogViewMode: "default",
  inventoryViewMode: "default",
  uiDensity: "default",
  motionSpeed: "default",

  isSidebarCollapsed: false,
  navLayout: "sidebar",

  defaultPhysicsEngine: "Terrain" as const,
  enableOptimizations: false,
  memoryLimit: 0,
  useDirectX12: false,
  lowEndGraphics: false,
  disableDualChannelAudio: false,
  antiAfkEnabled: false,
  renameWindowsEnabled: false,
  framerateCapEnabled: false,
  framerateCapValue: 60,
  optimizeRamEnabled: false,
  ramOptimization: 2048,
  cpuOptimization: 0,
  headlessModeEnabled: false,
  timeoutRelaunchEnabled: false,
  timeoutRelaunchSeconds: 3600,
  windowLayoutEnabled: false,
  windowLayoutPattern: "grid" as const,
  windowLayoutSpacing: 12,
  windowLayoutColumns: 3,
  windowLayoutWidth: 0,
  windowLayoutHeight: 0,
};

const LEGACY_DEFAULT_ACCENT_COLORS = ["#1e66f5", "#3b82f6", "#2563eb"];

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.snapshot(),
    queryFn: async () => {
      const data = await window.api.getSettings();

      const rawAccent =
        typeof data?.accentColor === "string" ? data.accentColor.trim() : "";
      const accentColor = !rawAccent
        ? DEFAULT_ACCENT_COLOR
        : LEGACY_DEFAULT_ACCENT_COLORS.includes(rawAccent.toLowerCase())
          ? DEFAULT_ACCENT_COLOR
          : rawAccent;

      return {
        ...DEFAULT_SETTINGS,
        ...data,
        accentColor,
        useDynamicAccentColor: data?.useDynamicAccentColor ?? false,
        tint: (data?.tint as Settings["tint"]) || "neutral",
        showSidebarProfileCard: data?.showSidebarProfileCard ?? true,
        privacyMode: data?.privacyMode ?? false,
        sidebarTabOrder: sanitizeSidebarOrder(data?.sidebarTabOrder as any),
        sidebarHiddenTabs: sanitizeSidebarHidden(
          data?.sidebarHiddenTabs as any,
        ),

        catalogViewMode: (data?.catalogViewMode ??
          DEFAULT_SETTINGS.catalogViewMode) as Settings["catalogViewMode"],
        inventoryViewMode: (data?.inventoryViewMode ??
          DEFAULT_SETTINGS.inventoryViewMode) as Settings["inventoryViewMode"],
        uiDensity: (data?.uiDensity ??
          DEFAULT_SETTINGS.uiDensity) as Settings["uiDensity"],
        motionSpeed: (data?.motionSpeed ??
          DEFAULT_SETTINGS.motionSpeed) as Settings["motionSpeed"],
        contentRadius: (data?.contentRadius ??
          "rounded") as Settings["contentRadius"],
        navBorderStyle: (data?.navBorderStyle ??
          "solid") as Settings["navBorderStyle"],
        blurIntensity: (data?.blurIntensity ??
          "medium") as Settings["blurIntensity"],
        iconWeight: (data?.iconWeight ?? "regular") as Settings["iconWeight"],
        fontWeight: (data?.fontWeight ?? "regular") as Settings["fontWeight"],

        isSidebarCollapsed:
          data?.isSidebarCollapsed ?? DEFAULT_SETTINGS.isSidebarCollapsed,
        navLayout: (data?.navLayout ??
          DEFAULT_SETTINGS.navLayout) as Settings["navLayout"],

        defaultPhysicsEngine: (data?.defaultPhysicsEngine ??
          DEFAULT_SETTINGS.defaultPhysicsEngine) as Settings["defaultPhysicsEngine"],
        enableOptimizations:
          data?.enableOptimizations ?? DEFAULT_SETTINGS.enableOptimizations,
        memoryLimit: data?.memoryLimit ?? DEFAULT_SETTINGS.memoryLimit,
        useDirectX12: data?.useDirectX12 ?? DEFAULT_SETTINGS.useDirectX12,
        lowEndGraphics: data?.lowEndGraphics ?? DEFAULT_SETTINGS.lowEndGraphics,
        disableDualChannelAudio:
          data?.disableDualChannelAudio ??
          DEFAULT_SETTINGS.disableDualChannelAudio,
        antiAfkEnabled: data?.antiAfkEnabled ?? DEFAULT_SETTINGS.antiAfkEnabled,
        renameWindowsEnabled:
          data?.renameWindowsEnabled ?? DEFAULT_SETTINGS.renameWindowsEnabled,
        framerateCapEnabled:
          data?.framerateCapEnabled ?? DEFAULT_SETTINGS.framerateCapEnabled,
        framerateCapValue:
          data?.framerateCapValue ?? DEFAULT_SETTINGS.framerateCapValue,
        optimizeRamEnabled:
          data?.optimizeRamEnabled ?? DEFAULT_SETTINGS.optimizeRamEnabled,
        ramOptimization:
          data?.ramOptimization ?? DEFAULT_SETTINGS.ramOptimization,
        cpuOptimization:
          data?.cpuOptimization ?? DEFAULT_SETTINGS.cpuOptimization,
        headlessModeEnabled:
          data?.headlessModeEnabled ?? DEFAULT_SETTINGS.headlessModeEnabled,
        timeoutRelaunchEnabled:
          data?.timeoutRelaunchEnabled ??
          DEFAULT_SETTINGS.timeoutRelaunchEnabled,
        timeoutRelaunchSeconds:
          data?.timeoutRelaunchSeconds ??
          DEFAULT_SETTINGS.timeoutRelaunchSeconds,
        windowLayoutEnabled:
          data?.windowLayoutEnabled ?? DEFAULT_SETTINGS.windowLayoutEnabled,
        windowLayoutPattern: (data?.windowLayoutPattern ??
          DEFAULT_SETTINGS.windowLayoutPattern) as Settings["windowLayoutPattern"],
        windowLayoutSpacing:
          data?.windowLayoutSpacing ?? DEFAULT_SETTINGS.windowLayoutSpacing,
        windowLayoutColumns:
          data?.windowLayoutColumns ?? DEFAULT_SETTINGS.windowLayoutColumns,
        windowLayoutWidth:
          data?.windowLayoutWidth ?? DEFAULT_SETTINGS.windowLayoutWidth,
        windowLayoutHeight:
          data?.windowLayoutHeight ?? DEFAULT_SETTINGS.windowLayoutHeight,
      };
    },
    staleTime: Infinity,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<Settings>) =>
      window.api.setSettings(settings),
    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.settings.snapshot(),
      });

      const previousSettings = queryClient.getQueryData<Settings>(
        queryKeys.settings.snapshot(),
      );

      queryClient.setQueryData(
        queryKeys.settings.snapshot(),
        (old: Settings | undefined) => ({
          ...DEFAULT_SETTINGS,
          ...old,
          ...newSettings,
        }),
      );

      return { previousSettings };
    },
    onError: (_err, _newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(
          queryKeys.settings.snapshot(),
          context.previousSettings,
        );
      }
    },
  });
}

export function useSettingsManager() {
  const { data: settings = DEFAULT_SETTINGS, isLoading } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  useEffect(() => {
    if (settings.accentColor && !settings.useDynamicAccentColor) {
      applyAccentColor(settings.accentColor);
    }
  }, [settings.accentColor, settings.useDynamicAccentColor]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const tint = settings.tint || "neutral";
    document.documentElement.dataset.tint = tint;
    applyTint(getCurrentThemeNameFromDom(), tint);
  }, [settings.tint]);

  useEffect(() => {
    const raw =
      typeof settings.accentColor === "string"
        ? settings.accentColor.trim().toLowerCase()
        : "";
    if (
      raw &&
      LEGACY_DEFAULT_ACCENT_COLORS.includes(raw) &&
      raw !== DEFAULT_ACCENT_COLOR
    ) {
      updateSettingsMutation.mutate({ accentColor: DEFAULT_ACCENT_COLOR });
    }
  }, [settings.accentColor, updateSettingsMutation]);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        const [customFonts, activeFont] = await Promise.all([
          window.api.getCustomFonts(),
          window.api.getActiveFont(),
        ]);
        await initializeFonts(customFonts as CustomFont[], activeFont);
      } catch (error) {
        console.error("Failed to initialize fonts:", error);
      }
    };
    loadFonts();
  }, []);

  const updateSettings = useCallback(
    (newSettings: Partial<Settings>) => {
      updateSettingsMutation.mutate(newSettings);
    },
    [updateSettingsMutation],
  );

  return {
    settings,
    isLoading,
    updateSettings,
  };
}

export function useSidebarWidth() {
  return useQuery({
    queryKey: queryKeys.settings.sidebarWidth(),
    queryFn: () => window.api.getSidebarWidth(),
    staleTime: Infinity,
  });
}

export function useSetSidebarWidth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (width: number) => window.api.setSidebarWidth(width),
    onSuccess: (_data, width) => {
      queryClient.setQueryData(queryKeys.settings.sidebarWidth(), width);
    },
  });
}

export function useAccountsViewMode() {
  return useQuery({
    queryKey: queryKeys.settings.accountsViewMode(),
    queryFn: () => window.api.getAccountsViewMode(),
    staleTime: Infinity,
  });
}

export function useSetAccountsViewMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode: "list" | "grid") => window.api.setAccountsViewMode(mode),
    onSuccess: (_data, mode) => {
      queryClient.setQueryData(queryKeys.settings.accountsViewMode(), mode);
    },
  });
}

export function useAvatarRenderWidth() {
  return useQuery({
    queryKey: queryKeys.settings.avatarRenderWidth(),
    queryFn: () => window.api.getAvatarRenderWidth(),
    staleTime: Infinity,
  });
}

export function useSetAvatarRenderWidth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (width: number) => window.api.setAvatarRenderWidth(width),
    onSuccess: (_data, width) => {
      queryClient.setQueryData(queryKeys.settings.avatarRenderWidth(), width);
    },
  });
}
