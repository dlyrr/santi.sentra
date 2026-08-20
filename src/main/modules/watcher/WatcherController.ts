import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from "electron";
import { z } from "zod";
import { watcherService } from "./WatcherService";

const handle = <T extends any[]>(
  channel: string,
  schema: z.ZodType<T>,
  handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<any>,
) => {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const parsedArgs = schema.parse(args);
      return await handler(event, ...parsedArgs);
    } catch (error: any) {
      console.error(`[WatcherController] Error handling ${channel}:`, error);
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.message}`);
      }
      throw error;
    }
  });
};

export function registerWatcherHandlers(mainWindow: BrowserWindow): void {
  watcherService.initialize(mainWindow);

  handle("watcher:get-sessions", z.tuple([]), async () => {
    const sessions = watcherService.getSessions();
    return sessions;
  });

  handle("watcher:get-session", z.tuple([z.string()]), async (_, sessionId) => {
    const session = watcherService.getSession(sessionId);
    return session || null;
  });

  handle("watcher:start", z.tuple([]), async () => {
    watcherService.startWatching();
    return { success: true };
  });

  handle("watcher:stop", z.tuple([]), async () => {
    watcherService.stopWatching();
    return { success: true };
  });

  ipcMain.handle(
    "watcher:add-session",
    async (
      _event,
      accountId: string,
      username: string,
      userId: string,
      pid: number,
      placeId: number,
      logFile: string,
      launchConfig?: {
        cookie: string;
        placeId: string | number;
        jobId?: string;
        friendId?: string | number;
        installPath?: string;
      },
      jobId?: string,
      friendId?: string,
    ) => {
      try {
        if (!pid || typeof pid !== "number" || pid <= 0) {
          throw new Error(`Invalid PID: expected positive integer, got ${pid}`);
        }

        const session = watcherService.addSession(
          accountId,
          username,
          userId,
          pid,
          placeId,
          logFile,
          launchConfig,
          jobId,
          friendId,
        );
        return session;
      } catch (error: any) {
        console.error(
          "[WatcherController] Error handling watcher:add-session:",
          error,
        );
        throw error;
      }
    },
  );

  handle(
    "watcher:remove-session",
    z.any(),
    async (_, sessionId: string, killProcess?: boolean) => {
      watcherService.stopSession(sessionId, killProcess);
      return { success: true };
    },
  );

  handle("watcher:get-config", z.tuple([]), async () => {
    return watcherService.getConfig();
  });

  handle(
    "watcher:set-config",
    z.tuple([
      z.object({
        enabled: z.boolean().optional(),
        autoRestart: z.boolean().optional(),
        restartDelaySeconds: z.number().optional(),
        checkIntervalMs: z.number().optional(),
        logCheckIntervalMs: z.number().optional(),
        enableRAMLimiter: z.boolean().optional(),
        ramLimitMB: z.number().optional(),
        enableRAMCleanupAttempts: z.boolean().optional(),
        enableClientTimeout: z.boolean().optional(),
        clientTimeoutSeconds: z.number().optional(),
        enableCPULimiter: z.boolean().optional(),
        cpuLimitPercent: z.number().optional(),
      }),
    ]),
    async (_, config) => {
      watcherService.updateConfig(config);
      return watcherService.getConfig();
    },
  );

  handle("watcher:get-events", z.tuple([]), async () => {
    return watcherService.getEventLog();
  });

  handle("watcher:clear-events", z.tuple([]), async () => {
    watcherService.clearEventLog();
    return { success: true };
  });

  handle("watcher:clear-all", z.tuple([]), async () => {
    watcherService.clearAll();
    return { success: true };
  });

  handle(
    "watcher:auto-track-launch",
    z.tuple([
      z.object({
        accountId: z.string(),
        username: z.string(),
        userId: z.string(),
        placeId: z.number(),
        launchConfig: z.any().optional(),
        displayName: z.string().optional(),
        avatarUrl: z.string().optional(),
      }),
    ]),
    async (
      _,
      {
        accountId,
        username,
        userId,
        placeId,
        launchConfig,
        displayName,
        avatarUrl,
      },
    ) => {
      const session = await watcherService.autoTrackLaunchedGame(
        accountId,
        username,
        userId,
        placeId,
        launchConfig,
        displayName,
        avatarUrl,
      );
      return (
        session || { success: false, message: "Failed to track launched game" }
      );
    },
  );

  handle(
    "watcher:join-private-server",
    z.tuple([z.string(), z.string(), z.number()]),
    async (_, accountId, jobId, placeId) => {
      const success = await watcherService.joinPrivateServer(
        accountId,
        jobId,
        placeId,
      );
      return { success };
    },
  );

  handle(
    "watcher:join-game",
    z.tuple([z.string(), z.number()]),
    async (_, accountId, placeId) => {
      const success = await watcherService.joinGame(accountId, placeId);
      return { success };
    },
  );

  handle(
    "watcher:rejoin-private-server",
    z.tuple([z.string(), z.string()]),
    async (_, sessionId, jobId) => {
      const success = await watcherService.rejoinPrivateServer(
        sessionId,
        jobId,
      );
      return { success };
    },
  );

  handle(
    "watcher:launch-game-with-url",
    z.tuple([z.string(), z.number(), z.string()]),
    async (_, accountId, placeId, url) => {
      const success = await watcherService.launchGameWithUrl(
        accountId,
        placeId,
        url,
      );
      return { success };
    },
  );

  console.log("[WatcherController] Handlers registered");
}

export { watcherService };
