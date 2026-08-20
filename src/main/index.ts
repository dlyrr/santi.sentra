/// <reference types="electron-vite/node" />
import { app, BrowserWindow, ipcMain, session } from "electron";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { getDataFile } from "./utils/paths";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { openExternalSafely } from "./lib/safeShell";
import iconIco from "../../resources/build/icons/win/icon.ico?asset";
import iconIcns from "../../resources/build/icons/mac/icon.icns?asset";

const mainStart = performance.now();
const logPerf = (label: string) => {
  const delta = performance.now() - mainStart;
  console.log(`[perf:main] ${label} ${delta.toFixed(1)}ms`);
};

let storageService: typeof import("./modules/system/StorageService").storageService;

function isVaultUnlocked(): boolean {
  if (!storageService) return false;
  try {
    const hasPin = !!storageService.getPinHash();
    if (!hasPin) return true;
    return storageService.isPinCurrentlyVerified();
  } catch (err) {
    console.error("[main] Failed to determine vault lock state:", err);

    return false;
  }
}

let handlersRegistered = false;

let appLock: ReturnType<typeof app.requestSingleInstanceLock> | null = null;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock && process.platform === "win32") {
  app.quit();
} else {
  appLock = gotTheLock;
}

export function gracefulShutdownForUpdate(): void {
  if (appLock) {
    try {
      appLock = null;
    } catch (err) {
      console.warn("Could not release app lock:", err);
    }
  }
}

process.on("uncaughtException", (error) => {
  if (error.message === "write EPIPE" || (error as any).code === "EPIPE")
    return;
  console.error("Uncaught exception:", error);
});

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    icon: process.platform === "darwin" ? iconIcns : iconIco,
    backgroundColor: "#111111",
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 16, y: 16 } }
      : {
          titleBarOverlay: {
            color: "#00000000",
            symbolColor: "#ffffff",
            height: 45,
          },
        }),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),

      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });

  let resizeTimeout: NodeJS.Timeout | null = null;
  mainWindow.on("resized", () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (storageService) {
        const [width, height] = mainWindow.getSize();
        storageService.setWindowWidth(width);
        storageService.setWindowHeight(height);
      }
    }, 500);
  });

  mainWindow.on("ready-to-show", () => {
    if (storageService) {
      const savedWidth = storageService.getWindowWidth();
      const savedHeight = storageService.getWindowHeight();
      if (savedWidth && savedHeight) {
        mainWindow.setSize(savedWidth, savedHeight, true);
        mainWindow.center();
      }
    }
    mainWindow.show();
    logPerf("ready-to-show");
  });

  mainWindow.webContents.once("dom-ready", () => logPerf("dom-ready"));
  mainWindow.webContents.once("did-finish-load", () =>
    logPerf("did-finish-load"),
  );

  mainWindow.webContents.on("console-message", (details) => {
    const { level, message, lineNumber, sourceId } = details;
    console.log(`[renderer:${level}] ${message} (${sourceId}:${lineNumber})`);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    openExternalSafely(details.url);
    return { action: "deny" };
  });

  const isInternalUrl = (target: string): boolean => {
    try {
      const parsed = new URL(target);
      if (parsed.protocol === "file:") return true;
      const devUrl = process.env["ELECTRON_RENDERER_URL"];
      if (is.dev && devUrl) {
        return parsed.origin === new URL(devUrl).origin;
      }
      return false;
    } catch {
      return false;
    }
  };

  const blockExternalNavigation = (
    event: { preventDefault: () => void },
    url: string,
  ): void => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    console.warn(`[main] Blocked in-app navigation to ${url}`);
    openExternalSafely(url);
  };

  mainWindow.webContents.on("will-navigate", (event, url) =>
    blockExternalNavigation(event, url),
  );
  mainWindow.webContents.on("will-redirect", (event, url) =>
    blockExternalNavigation(event, url),
  );

  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  return mainWindow;
}

function installContentSecurityPolicy(): void {
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  let devOrigin: string | null = null;
  if (devUrl) {
    try {
      devOrigin = new URL(devUrl).origin;
    } catch {
      devOrigin = null;
    }
  }

  const isOwnDocument = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "file:") return true;
      return devOrigin !== null && parsed.origin === devOrigin;
    } catch {
      return false;
    }
  };

  const scriptSrc = is.dev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'";

  const robloxConnect = "https://*.rbxcdn.com https://*.roblox.com";
  const connectSrc = is.dev
    ? `connect-src 'self' ws: wss: ${robloxConnect} ${devOrigin ?? ""}`.trim()
    : `connect-src 'self' ${robloxConnect}`;

  const policy = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "media-src 'self' data: blob: https:",
    connectSrc,
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'none'",
  ].join("; ");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (
      (details.resourceType !== "mainFrame" &&
        details.resourceType !== "subFrame") ||
      !isOwnDocument(details.url)
    ) {
      callback({});
      return;
    }

    const headers = { ...details.responseHeaders };

    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "content-security-policy") {
        delete headers[key];
      }
    }
    headers["Content-Security-Policy"] = [policy];
    callback({ responseHeaders: headers });
  });
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.sentra.app");
  if (process.platform === "darwin") app.setName("sentra");

  installContentSecurityPolicy();

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const mainWindow = createWindow();
  logPerf("window-created");

  const criticalModules = await Promise.all([
    import("./modules/core/RobloxHandler"),
    import("./modules/system/StorageController"),
    import("./modules/system/StorageService"),
    import("./modules/system/PinService"),
    import("./modules/updater/UpdaterController"),
    import("./modules/system/LogsController"),
  ]);

  const criticalLoaded = {
    registerRobloxHandlers: criticalModules[0].registerRobloxHandlers,
    registerStorageHandlers: criticalModules[1].registerStorageHandlers,
    storageService: criticalModules[2].storageService,
    pinService: criticalModules[3].pinService,
    registerUpdaterHandlers: criticalModules[4].registerUpdaterHandlers,
    registerLogsHandlers: criticalModules[5].registerLogsHandlers,
  };

  storageService = criticalLoaded.storageService;

  logPerf("critical-modules-loaded");

  criticalLoaded.registerRobloxHandlers();
  criticalLoaded.registerStorageHandlers();
  criticalLoaded.registerLogsHandlers();
  criticalLoaded.pinService.initialize();
  logPerf("critical-handlers-registered");

  const { UserAgentService } = await import("./modules/auth/UserAgentService");
  UserAgentService.resumeAutoSwapIfEnabled();

  const { registerModuleIpcHandlers } = await import("./ipc/ModuleIpcHandlers");
  registerModuleIpcHandlers();

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.once("ready-to-show", async () => {
    logPerf("ready-to-show");

    if (handlersRegistered) {
      console.log(
        "[perf:main] Handlers already registered, skipping for this window",
      );
      return;
    }
    handlersRegistered = true;
    console.log(
      "[perf:main] Locked handler registration, proceeding with setup...",
    );

    console.log("[perf:main] Starting deferred module loading...");

    const nonCriticalModules = await Promise.all([
      import("./modules/discord/DiscordRPCController"),
      import("./modules/watcher/WatcherController"),
      import("./modules/macro/MacroController"),
      import("./modules/sniper/SniperController"),
      import("./modules/generator/GeneratorController"),
      import("./modules/system/PerformanceService"),
    ]);

    const nonCriticalLoaded = {
      registerDiscordRPCHandlers:
        nonCriticalModules[0].registerDiscordRPCHandlers,
      registerWatcherHandlers: nonCriticalModules[1].registerWatcherHandlers,
      registerMacroHandlers: nonCriticalModules[2].registerMacroHandlers,
      registerSniperHandlers: nonCriticalModules[3].registerSniperHandlers,
      registerGeneratorHandlers:
        nonCriticalModules[4].registerGeneratorHandlers,
      performanceService: nonCriticalModules[5].PerformanceService,
    };

    logPerf("non-critical-modules-loaded");

    console.log(
      "[perf:main] Registering non-critical IPC handlers (one-time setup)...",
    );
    nonCriticalLoaded.registerDiscordRPCHandlers();
    nonCriticalLoaded.registerWatcherHandlers(mainWindow);
    nonCriticalLoaded.registerMacroHandlers();
    nonCriticalLoaded.registerSniperHandlers();
    nonCriticalLoaded.registerGeneratorHandlers();
    nonCriticalLoaded.performanceService.init();

    logPerf("non-critical-handlers-registered");
    console.log("[perf:main] App fully loaded and ready!");
  });

  ipcMain.handle("focus-window", () => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(true);
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
    }
  });

  ipcMain.handle(
    "tile-game-windows",
    async (
      _event,
      options?: {
        pattern?: "grid" | "rows" | "columns" | "cascade";
        monitors?: "all" | "primary" | "secondary";
        spacing?: number;
        columns?: number;
      },
    ) => {
      try {
        const { PerformanceService } =
          await import("./modules/system/PerformanceService");
        return PerformanceService.tileRobloxWindows(options ?? {});
      } catch (error) {
        console.error("[main] tile-game-windows failed:", error);
        return {
          success: false,
          message: "Window tiling failed.",
        };
      }
    },
  );

  ipcMain.handle("has-config", () => {
    try {
      const configCandidates = [
        getDataFile("config.json"),
        join(app.getPath("userData"), "config.json"),
        join(app.getPath("userData"), "Sentra", "config.json"),
        join(app.getPath("documents"), "Sentra", "config.json"),
      ];

      for (const candidate of configCandidates) {
        if (!existsSync(candidate)) continue;

        try {
          const content = readFileSync(candidate, "utf-8").trim();
          if (!content) continue;
          const parsed = JSON.parse(content);
          if (
            parsed &&
            typeof parsed === "object" &&
            Object.keys(parsed).length > 0
          ) {
            return true;
          }
        } catch {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Failed to check config existence:", error);
      return false;
    }
  });

  ipcMain.handle("app:logout", async () => {
    try {
      if (!storageService)
        return { success: false, message: "Storage not initialized" };

      if (!isVaultUnlocked()) {
        return {
          success: false,
          message: "PIN must be verified before logging out",
        };
      }
      storageService.clearAll();
      return { success: true, message: null };
    } catch (err: any) {
      return { success: false, message: err?.message ?? String(err) };
    }
  });

  ipcMain.handle(
    "account:get-decrypted-password",
    async (_event, accountId: string) => {
      try {
        if (!storageService) return { success: false, password: "" };

        if (!isVaultUnlocked()) {
          return {
            success: false,
            password: "",
            error: "PIN must be verified",
          };
        }
        const accounts = storageService.getAccounts();
        const account = accounts.find((acc) => acc.id === accountId);
        if (!account) {
          return { success: false, password: "" };
        }
        const decrypted = storageService.getDecryptedPassword(account.password);
        return { success: true, password: decrypted };
      } catch (err: any) {
        console.error("Error getting decrypted password:", err);
        return { success: false, password: "" };
      }
    },
  );

  criticalLoaded.registerUpdaterHandlers(mainWindow);

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow();
      criticalLoaded.registerUpdaterHandlers(newWindow);
    } else {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  app.on("second-instance", () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  try {
    storageService.flush();
  } catch (error) {
    console.error("[index] failed to flush storage on quit:", error);
  }
});
