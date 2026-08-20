import { ipcRenderer } from "electron";
import { invoke } from "./invoke";
import { z } from "zod";

const watcherSessionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  username: z.string(),
  displayName: z.string().optional(),
  userId: z.string(),
  avatarUrl: z.string().optional(),
  placeId: z.number(),
  jobId: z.string().optional(),
  friendId: z.string().optional(),
  pid: z.number(),
  logFile: z.string(),
  lastLogSize: z.number(),
  lastUpdate: z.number(),
  status: z.enum(["running", "crashed", "restarting"]),
  restartCount: z.number(),
  restartAttempts: z.number(),
  lastCrashTime: z.number().optional(),
  lastCrashReason: z.string().optional(),
  launchConfig: z
    .object({
      cookie: z.string(),
      placeId: z.union([z.string(), z.number()]),
      jobId: z.string().optional(),
      friendId: z.union([z.string(), z.number()]).optional(),
      installPath: z.string().optional(),
    })
    .optional(),
});

const watcherConfigSchema = z.object({
  enabled: z.boolean(),
  autoRestart: z.boolean(),
  restartDelaySeconds: z.number(),
  checkIntervalMs: z.number(),
  logCheckIntervalMs: z.number(),
  enableRAMLimiter: z.boolean().optional(),
  ramLimitMB: z.number().optional(),
  enableRAMCleanupAttempts: z.boolean().optional(),
  enableClientTimeout: z.boolean().optional(),
  clientTimeoutSeconds: z.number().optional(),
  enableCPULimiter: z.boolean().optional(),
  cpuLimitPercent: z.number().optional(),
});

const watcherEventSchema = z.object({
  timestamp: z.number(),
  type: z.enum([
    "session-started",
    "session-crashed",
    "session-restarted",
    "session-stopped",
    "error",
  ]),
  sessionId: z.string(),
  username: z.string(),
  message: z.string(),
  details: z.any().optional(),
});

export const watcherApi = {
  getSessions: () =>
    invoke("watcher:get-sessions", z.array(watcherSessionSchema)),

  getSession: (sessionId: string) =>
    invoke("watcher:get-session", watcherSessionSchema.nullable(), sessionId),

  start: () => invoke("watcher:start", z.object({ success: z.boolean() })),

  stop: () => invoke("watcher:stop", z.object({ success: z.boolean() })),

  addSession: (
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
  ) =>
    invoke(
      "watcher:add-session",
      watcherSessionSchema,
      accountId,
      username,
      userId,
      pid,
      placeId,
      logFile,
      launchConfig,
    ),

  removeSession: (sessionId: string, killProcess?: boolean) =>
    invoke(
      "watcher:remove-session",
      z.object({ success: z.boolean() }),
      sessionId,
      killProcess,
    ),

  getConfig: () => invoke("watcher:get-config", watcherConfigSchema),

  setConfig: (
    config: Partial<{
      enabled: boolean;
      autoRestart: boolean;
      restartDelaySeconds: number;
      checkIntervalMs: number;
      logCheckIntervalMs: number;
    }>,
  ) => invoke("watcher:set-config", watcherConfigSchema, config),

  getEvents: () => invoke("watcher:get-events", z.array(watcherEventSchema)),

  clearEvents: () =>
    invoke("watcher:clear-events", z.object({ success: z.boolean() })),

  clearAll: () =>
    invoke("watcher:clear-all", z.object({ success: z.boolean() })),

  onSessionCrashed: (
    callback: (data: {
      sessionId: string;
      username: string;
      reason: string;
    }) => void,
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => {
      callback(data);
    };
    ipcRenderer.on("watcher:session-crashed", handler);

    return () => {
      ipcRenderer.removeListener("watcher:session-crashed", handler);
    };
  },

  onSessionRestarted: (
    callback: (data: {
      sessionId: string;
      username: string;
      restartCount: number;
    }) => void,
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => {
      callback(data);
    };
    ipcRenderer.on("watcher:session-restarted", handler);

    return () => {
      ipcRenderer.removeListener("watcher:session-restarted", handler);
    };
  },

  onEvent: (
    callback: (event: {
      timestamp: number;
      type:
        | "session-started"
        | "session-crashed"
        | "session-restarted"
        | "session-stopped"
        | "error";
      sessionId: string;
      username: string;
      message: string;
      details?: any;
    }) => void,
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, watcherEvent: any) => {
      callback(watcherEvent);
    };
    ipcRenderer.on("watcher:event", handler);

    return () => {
      ipcRenderer.removeListener("watcher:event", handler);
    };
  },

  autoTrackLaunchedGame: (
    accountId: string,
    username: string,
    userId: string,
    placeId: number,
    launchConfig?: any,
    displayName?: string,
    avatarUrl?: string,
  ) =>
    invoke("watcher:auto-track-launch", z.any(), {
      accountId,
      username,
      userId,
      placeId,
      launchConfig,
      displayName,
      avatarUrl,
    }),

  joinPrivateServer: (accountId: string, jobId: string, placeId: number) =>
    invoke(
      "watcher:join-private-server",
      z.object({ success: z.boolean() }),
      accountId,
      jobId,
      placeId,
    ),

  joinGame: (accountId: string, placeId: number) =>
    invoke(
      "watcher:join-game",
      z.object({ success: z.boolean() }),
      accountId,
      placeId,
    ),

  rejoinPrivateServer: (sessionId: string, jobId: string) =>
    invoke(
      "watcher:rejoin-private-server",
      z.object({ success: z.boolean() }),
      sessionId,
      jobId,
    ),

  launchGameWithUrl: (accountId: string, placeId: number, url: string) =>
    invoke(
      "watcher:launch-game-with-url",
      z.object({ success: z.boolean() }),
      accountId,
      placeId,
      url,
    ),

  onSessionsUpdated: (
    callback: (sessions: typeof watcherSessionSchema) => void,
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, sessions: any) => {
      callback(sessions);
    };
    ipcRenderer.on("watcher:sessions-updated", handler);

    return () => {
      ipcRenderer.removeListener("watcher:sessions-updated", handler);
    };
  },
};
