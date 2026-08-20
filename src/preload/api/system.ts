import { z } from "zod";
import { webUtils } from "electron";
import { invoke } from "./invoke";
import * as S from "../../shared/ipc-schemas";

export const systemApi = {
  focusWindow: () => invoke("focus-window", z.void()),
  tileGameWindows: (config: {
    pattern?: "grid" | "rows" | "columns" | "cascade";
    monitors?: "all" | "primary" | "secondary";
    spacing?: number;
    columns?: number;
  }) =>
    invoke(
      "tile-game-windows",
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: z
          .object({
            count: z.number(),
            columns: z.number(),
            rows: z.number(),
          })
          .optional(),
      }),
      config,
    ),
  hasConfig: () => invoke("has-config", z.boolean()),

  getSidebarWidth: () => invoke("get-sidebar-width", z.number().optional()),
  setSidebarWidth: (width: number) =>
    invoke("set-sidebar-width", z.void(), width),
  getSidebarCollapsed: () => invoke("get-sidebar-collapsed", z.boolean()),
  setSidebarCollapsed: (collapsed: boolean) =>
    invoke("set-sidebar-collapsed", z.void(), collapsed),

  getSettings: () => invoke("get-settings", S.settingsSchema),
  setSettings: (settings: S.SettingsPatch) =>
    invoke("set-settings", z.void(), settings),

  getAvatarRenderWidth: () =>
    invoke("get-avatar-render-width", z.number().optional()),
  setAvatarRenderWidth: (width: number) =>
    invoke("set-avatar-render-width", z.void(), width),

  getAccountsViewMode: () =>
    invoke("get-accounts-view-mode", z.enum(["list", "grid"])),
  setAccountsViewMode: (mode: "list" | "grid") =>
    invoke("set-accounts-view-mode", z.void(), mode),

  getFavoriteGames: () => invoke("get-favorite-games", z.array(z.string())),
  addFavoriteGame: (placeId: string) =>
    invoke("add-favorite-game", z.void(), placeId),
  removeFavoriteGame: (placeId: string) =>
    invoke("remove-favorite-game", z.void(), placeId),
  getFavoriteItems: () =>
    invoke("get-favorite-items", z.array(S.favoriteItemSchema)),
  addFavoriteItem: (item: { id: number; name: string; type: string }) =>
    invoke("add-favorite-item", z.void(), item),

  getExcludeFullGames: () => invoke("get-exclude-full-games", z.boolean()),
  setExcludeFullGames: (excludeFullGames: boolean) =>
    invoke("set-exclude-full-games", z.void(), excludeFullGames),

  getLogs: () => invoke("get-logs", z.array(S.logMetadataSchema)),
  getLogContent: (filename: string) =>
    invoke("get-log-content", z.string(), filename),
  deleteLog: (filename: string) => invoke("delete-log", z.boolean(), filename),
  deleteAllLogs: () => invoke("delete-all-logs", z.boolean()),
  openLogFile: (filename: string) =>
    invoke("open-log-file", z.boolean(), filename),

  getDeployHistory: (force?: boolean) =>
    invoke("get-deploy-history", S.deployHistorySchema, force || false),
  checkForUpdates: (binaryType: string, currentVersionHash: string) =>
    invoke(
      "check-for-updates",
      S.updateCheckSchema,
      binaryType,
      currentVersionHash,
    ),

  getCustomFonts: () =>
    invoke(
      "get-custom-fonts",
      z.array(z.object({ family: z.string(), url: z.string() })),
    ),
  addCustomFont: (font: { family: string; url: string }) =>
    invoke("add-custom-font", z.void(), font),
  removeCustomFont: (family: string) =>
    invoke("remove-custom-font", z.void(), family),
  getActiveFont: () => invoke("get-active-font", z.string().nullable()),
  setActiveFont: (family: string | null) =>
    invoke("set-active-font", z.void(), family),

  getAssetPath: (assetPath: string) =>
    invoke("get-asset-path", z.string(), assetPath),

  getRobloxSettings: () =>
    invoke(
      "get-roblox-settings",
      z.object({
        defaultPhysicsEngine: z.enum(["Terrain", "Legacy"]),
        enableOptimizations: z.boolean(),
        memoryLimit: z.number(),
        useDirectX12: z.boolean(),
        lowEndGraphics: z.boolean(),
        disableDualChannelAudio: z.boolean(),
        antiAfkEnabled: z.boolean(),
        renameWindowsEnabled: z.boolean(),
        framerateCapEnabled: z.boolean(),
        framerateCapValue: z.number(),
        optimizeRamEnabled: z.boolean(),
        ramOptimization: z.number(),
        cpuOptimization: z.number(),
        headlessModeEnabled: z.boolean(),
        timeoutRelaunchEnabled: z.boolean(),
        timeoutRelaunchSeconds: z.number(),
        windowLayoutEnabled: z.boolean(),
        windowLayoutPattern: z.enum(["grid", "rows", "columns", "cascade"]),
        windowLayoutSpacing: z.number(),
        windowLayoutColumns: z.number(),
      }),
    ),
  setRobloxSettings: (settings: {
    defaultPhysicsEngine?: "Terrain" | "Legacy";
    enableOptimizations?: boolean;
    memoryLimit?: number;
    useDirectX12?: boolean;
    lowEndGraphics?: boolean;
    disableDualChannelAudio?: boolean;
    antiAfkEnabled?: boolean;
    renameWindowsEnabled?: boolean;
    framerateCapEnabled?: boolean;
    framerateCapValue?: number;
    optimizeRamEnabled?: boolean;
    ramOptimization?: number;
    cpuOptimization?: number;
    headlessModeEnabled?: boolean;
    timeoutRelaunchEnabled?: boolean;
    timeoutRelaunchSeconds?: number;
    windowLayoutEnabled?: boolean;
    windowLayoutPattern?: "grid" | "rows" | "columns" | "cascade";
    windowLayoutSpacing?: number;
    windowLayoutColumns?: number;
  }) => invoke("set-roblox-settings", z.void(), settings),

  getAllowMultipleInstances: () =>
    invoke("get-allow-multiple-instances", z.boolean()),
  setAllowMultipleInstances: (allow: boolean) =>
    invoke("set-allow-multiple-instances", z.void(), allow),

  swapUserAgent: () =>
    invoke(
      "swap-user-agent",
      z.object({
        userAgent: z.string(),
        index: z.number(),
      }),
    ),
  setUserAgentIndex: (index: number) =>
    invoke(
      "set-user-agent-index",
      z.object({
        userAgent: z.string(),
        index: z.number(),
      }),
      index,
    ),
  getCurrentUserAgent: () =>
    invoke(
      "get-current-user-agent",
      z.object({
        userAgent: z.string(),
        index: z.number(),
      }),
    ),
  getAllUserAgents: () => invoke("get-all-user-agents", z.array(z.string())),
  setAutoSwapUserAgent: (enabled: boolean, intervalMinutes?: number) =>
    invoke(
      "set-auto-swap-user-agent",
      z.object({
        autoSwapEnabled: z.boolean(),
        intervalMinutes: z.number(),
      }),
      enabled,
      intervalMinutes,
    ),
  getUserAgentState: () =>
    invoke(
      "get-user-agent-state",
      z.object({
        currentUserAgent: z.string(),
        currentIndex: z.number(),
        autoSwapEnabled: z.boolean(),
        autoSwapIntervalMinutes: z.number(),
        totalUserAgents: z.number(),
      }),
    ),

  handle64IsInstalled: () => invoke("handle64:is-installed", z.boolean()),
  handle64Install: () => invoke("handle64:install", z.boolean()),
  handle64Uninstall: () => invoke("handle64:uninstall", z.boolean()),
};

export const licenseApi = {};

export const appApi = {
  logout: () =>
    invoke(
      "app:logout",
      z.object({
        success: z.boolean(),
        message: z.string().nullable().optional(),
      }),
    ),
};

export const pinApi = {
  verifyPin: (pin: string) =>
    invoke("verify-pin", S.pinVerifyResultSchema, pin),
  isPinVerified: () => invoke("is-pin-verified", z.boolean()),
  setPin: (newPin: string | null, currentPin?: string) =>
    invoke("set-pin", S.pinSetResultSchema, { newPin, currentPin }),
  getPinLockoutStatus: () =>
    invoke("get-pin-lockout-status", S.pinLockoutStatusSchema),
};

export const installApi = {
  installRobloxVersion: (
    binaryType: string,
    version: string,
    installPath: string,
  ) =>
    invoke(
      "install-roblox-version",
      z.string().nullable(),
      binaryType,
      version,
      installPath,
    ),
  launchRobloxInstall: (installPath: string) =>
    invoke("launch-roblox-install", z.void(), installPath),
  uninstallRobloxVersion: (installPath: string) =>
    invoke("uninstall-roblox-version", z.void(), installPath),
  openRobloxFolder: (installPath: string) =>
    invoke("open-roblox-folder", z.void(), installPath),
  verifyRobloxFiles: (
    binaryType: string,
    version: string,
    installPath: string,
  ) =>
    invoke(
      "verify-roblox-files",
      z.boolean(),
      binaryType,
      version,
      installPath,
    ),
  getFFlags: (installPath: string) =>
    invoke("get-fflags", S.fflagsSchema, installPath),
  setFFlags: (installPath: string, flags: unknown) =>
    invoke("set-fflags", z.void(), installPath, flags),
  setActiveInstall: (installPath: string) =>
    invoke("set-active-install", z.void(), installPath),
  removeActiveInstall: () => invoke("remove-active-install", z.void()),
  getActiveInstallPath: () =>
    invoke("get-active-install-path", z.string().nullable()),
  detectDefaultInstallations: () =>
    invoke("detect-default-installations", S.detectedInstallationsSchema),
  installFont: (installPath: string, fontPath: string) =>
    invoke("install-font", z.void(), installPath, fontPath),
  installCursor: (installPath: string, cursorPath: string) =>
    invoke("install-cursor", z.void(), installPath, cursorPath),

  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  createBackup: (accounts: unknown[], backupPin: string, savePath?: string) =>
    invoke("create-backup", z.string(), accounts, backupPin, savePath),
  restoreBackup: (filepath: string, backupPin: string) =>
    invoke("restore-backup", z.array(z.unknown()), filepath, backupPin),
  selectInstallationDirectory: () =>
    invoke("select-installation-directory", z.string()),
  pickBackupFile: () => invoke("pick-backup-file", z.string()),
  chooseBackupLocation: () => invoke("choose-backup-location", z.string()),
};

export const netlogApi = {
  getNetLogStatus: () => invoke("net-log:get-status", S.netLogStatusSchema),
  getNetLogPath: () => invoke("net-log:get-log-path", z.string()),
  stopNetLog: () => invoke("net-log:stop", S.netLogStopResponseSchema),
  startNetLog: () => invoke("net-log:start", S.netLogStartResponseSchema),
};

export const catalogDbApi = {
  getStatus: () => invoke("get-catalog-db-status", S.catalogDbStatusSchema),
  download: () =>
    invoke("download-catalog-db", S.catalogDbDownloadResultSchema),
};
