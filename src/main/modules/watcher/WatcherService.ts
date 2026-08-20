import { BrowserWindow } from "electron";
import { sessionManager, SessionManager } from "./SessionManager";
import { ProcessMonitor } from "./ProcessMonitor";
import { logMonitor } from "./LogMonitor";
import {
  WatcherSession,
  WatcherEvent,
  WatcherConfig,
  LaunchConfig,
} from "./types";
import { RobloxLauncherService } from "../install/LauncherService";
import { RobloxInstallService } from "../install/InstallService";
import { storageService } from "../system/StorageService";
import { PerformanceService } from "../system/PerformanceService";

export class WatcherService {
  private sessionManager: SessionManager;
  private config: WatcherConfig;
  private events: WatcherEvent[] = [];
  private monitoringLoop: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;
  private restartTimers: Map<string, NodeJS.Timeout> = new Map();

  private monitoringGeneration = 0;

  constructor() {
    this.sessionManager = sessionManager;

    const savedConfig = storageService.getWatcherConfig();
    this.config = {
      enabled: false,
      autoRestart: savedConfig.autoRestart,
      restartDelaySeconds: 5,
      checkIntervalMs: 15000,
      logCheckIntervalMs: 2000,
      enableRAMLimiter: savedConfig.enableRAMLimiter,
      ramLimitMB: savedConfig.ramLimitMB,
      enableClientTimeout: savedConfig.enableClientTimeout,
      clientTimeoutSeconds: savedConfig.clientTimeoutSeconds,
      enableCPULimiter: savedConfig.enableCPULimiter,
      cpuLimitPercent: savedConfig.cpuLimitPercent,
    };
  }

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    console.log("[WatcherService] Initialized");
  }

  startWatching(): void {
    if (this.config.enabled && this.monitoringLoop) {
      console.log("[WatcherService] Already watching");
      return;
    }

    this.config.enabled = true;
    console.log("[WatcherService] Started watching");
    this.logEvent({
      type: "session-started",
      sessionId: "watcher",
      username: "system",
      message: "Watcher started monitoring sessions",
    });

    this.startMonitoringLoop();
  }

  stopWatching(): void {
    this.monitoringGeneration++;
    if (this.monitoringLoop) {
      clearTimeout(this.monitoringLoop);
      this.monitoringLoop = null;
    }

    for (const timer of this.restartTimers.values()) {
      clearTimeout(timer);
    }
    this.restartTimers.clear();

    this.config.enabled = false;
    console.log("[WatcherService] Stopped watching");
    this.logEvent({
      type: "session-stopped",
      sessionId: "watcher",
      username: "system",
      message: "Watcher stopped monitoring sessions",
    });
  }

  addSession(
    accountId: string,
    username: string,
    userId: string,
    pid: number,
    placeId: number,
    logFile: string,
    launchConfig?: LaunchConfig,
    jobId?: string,
    friendId?: string,
    displayName?: string,
    avatarUrl?: string,
  ): WatcherSession {
    const session = this.sessionManager.createSession(
      accountId,
      username,
      userId,
      pid,
      placeId,
      logFile,
      launchConfig,
      jobId,
      friendId,
      displayName,
      avatarUrl,
    );

    console.log(
      `[WatcherService] Session created: ${session.id} for ${username} (PID: ${pid}, Place: ${placeId})`,
    );
    this.logEvent({
      type: "session-started",
      sessionId: session.id,
      username,
      message: `Session started for ${username} (PID: ${pid}, Place: ${placeId})${logFile ? ` - Watching ${logFile}` : " - Waiting for log file"}`,
    });

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(
        "watcher:sessions-updated",
        this.sessionManager.getAllSessions(),
      );
    }

    return session;
  }

  getSessions(): WatcherSession[] {
    return this.sessionManager.getAllSessions();
  }

  getSession(sessionId: string): WatcherSession | undefined {
    return this.sessionManager.getSessionById(sessionId);
  }

  stopSession(sessionId: string, killProcess?: boolean): void {
    const session = this.sessionManager.getSessionById(sessionId);
    if (session) {
      const restartTimer = this.restartTimers.get(sessionId);
      if (restartTimer) {
        clearTimeout(restartTimer);
        this.restartTimers.delete(sessionId);
      }

      console.log(`[Watcher] Session stopped for ${session.username}`);

      if (killProcess && session.pid) {
        try {
          process.kill(session.pid, "SIGKILL");
          console.log(
            `[Watcher] Killed process ${session.pid} for ${session.username}`,
          );
        } catch (err: any) {
          console.error(
            `[Watcher] Failed to kill process ${session.pid}:`,
            err,
          );
        }
      }

      if (session.logFile) {
        logMonitor.clearCache(session.logFile);
      }

      this.sessionManager.removeSession(sessionId);
    }
  }

  async restartProcessByPid(pid: number, reason: string): Promise<boolean> {
    const session = this.sessionManager
      .getAllSessions()
      .find((candidate) => candidate.pid === pid);

    if (!session || !session.launchConfig) {
      console.warn(
        `[Watcher] Cannot restart PID ${pid}: no tracked session or launch config (${reason})`,
      );
      return false;
    }

    console.log(
      `[Watcher] Restarting ${session.username} after resource limit (${reason})`,
    );
    await this.onSessionCrashed(session, reason);
    return true;
  }

  updateConfig(config: Partial<WatcherConfig>): void {
    this.config = { ...this.config, ...config };

    const storageConfig: any = {};
    if (config.autoRestart !== undefined) {
      storageConfig.autoRestart = config.autoRestart;
    }
    if (config.enableRAMLimiter !== undefined) {
      storageConfig.enableRAMLimiter = config.enableRAMLimiter;
    }
    if (config.ramLimitMB !== undefined) {
      storageConfig.ramLimitMB = config.ramLimitMB;
    }
    if (Object.keys(storageConfig).length > 0) {
      storageService.setWatcherConfig(storageConfig);
    }
    console.log("[WatcherService] Config updated:", this.config);
  }

  getConfig(): WatcherConfig {
    return { ...this.config };
  }

  getEventLog(): WatcherEvent[] {
    return [...this.events];
  }

  clearEventLog(): void {
    this.events = [];
  }

  private startMonitoringLoop(): void {
    if (this.monitoringLoop) {
      clearTimeout(this.monitoringLoop);
    }

    const generation = ++this.monitoringGeneration;

    const scheduleNext = () => {
      if (!this.config.enabled || generation !== this.monitoringGeneration)
        return;
      this.monitoringLoop = setTimeout(async () => {
        await this.checkAllSessions();
        scheduleNext();
      }, this.config.checkIntervalMs);
    };

    scheduleNext();
  }

  private async checkAllSessions(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const sessions = this.sessionManager.getAllSessions();

      if (sessions.length === 0) {
        return;
      }

      for (const session of sessions) {
        if (session.status === "restarting" || (session as any).__gaveUp) {
          continue;
        }

        if (
          this.config.enableRAMLimiter &&
          this.config.ramLimitMB &&
          this.config.ramLimitMB > 0
        ) {
          console.log(
            `[Watcher] Checking RAM for ${session.username} (PID: ${session.pid}, Limit: ${this.config.ramLimitMB}MB)`,
          );
          const currentFailureCount = session.ramCleanupFailureCount || 0;

          const enableCleanup = this.config.enableRAMCleanupAttempts !== false;
          const needsRestart = await ProcessMonitor.checkAndLimitRAM(
            session.pid,
            this.config.ramLimitMB,
            currentFailureCount,
            enableCleanup,
          );

          if (needsRestart) {
            console.log(
              `[Watcher] RAM limit exceeded for ${session.username} - marking for restart`,
            );
            const cleanupMessage = enableCleanup
              ? "after failed cleanup attempts"
              : "";
            this.logEvent({
              type: "session-crashed",
              sessionId: session.id,
              username: session.username,
              message: `Process exceeded RAM limit (${this.config.ramLimitMB}MB) ${cleanupMessage} - restarting automatically`,
              details: { reason: "RAM_LIMIT_EXCEEDED_CLEANUP_FAILED" },
            });
            const restartReason = enableCleanup
              ? `RAM limit exceeded (${this.config.ramLimitMB}MB) - cleanup failed 3 times`
              : `RAM limit exceeded (${this.config.ramLimitMB}MB)`;
            await this.onSessionCrashed(session, restartReason);
            continue;
          }

          if (enableCleanup) {
            const currentRAM = await ProcessMonitor.getProcessRAM(session.pid);
            if (currentRAM !== null && currentRAM > this.config.ramLimitMB) {
              session.ramCleanupFailureCount = currentFailureCount + 1;
              console.log(
                `[Watcher] RAM cleanup failed attempt ${session.ramCleanupFailureCount} for ${session.username}`,
              );
            } else if (
              currentRAM !== null &&
              currentRAM <= this.config.ramLimitMB
            ) {
              if (currentFailureCount > 0) {
                console.log(
                  `[Watcher] RAM cleanup succeeded for ${session.username} - resetting failure count`,
                );
              }
              session.ramCleanupFailureCount = 0;
            }
          }
        }

        const robloxSettings = storageService.getRobloxSettings();
        if (
          robloxSettings.timeoutRelaunchEnabled &&
          robloxSettings.timeoutRelaunchSeconds &&
          robloxSettings.timeoutRelaunchSeconds > 0
        ) {
          if (session.lastStartTime) {
            const secondsRunning = (Date.now() - session.lastStartTime) / 1000;
            if (secondsRunning > robloxSettings.timeoutRelaunchSeconds) {
              (session as any).__pendingTimeoutRestart = true;
            }
          }
        }

        const inRestartGracePeriod =
          session.lastRestartTime &&
          Date.now() - session.lastRestartTime < 45000;

        const recentlyLaunched =
          !session.lastRestartTime &&
          session.lastStartTime &&
          Date.now() - session.lastStartTime < 15000;

        const inGracePeriod = inRestartGracePeriod || recentlyLaunched;
        const isRunning = await ProcessMonitor.isProcessRunning(session.pid);

        if (inGracePeriod) {
          const timeReference =
            session.lastRestartTime || session.lastStartTime;
          const gracePeriodMs = inRestartGracePeriod ? 45000 : 15000;
          const elapsedMs = Date.now() - (timeReference || Date.now());
          const remaining = Math.round((gracePeriodMs - elapsedMs) / 1000);
          console.log(
            `[Watcher] Grace period active for ${session.username} (${remaining}s remaining)`,
          );
        } else if (!isRunning) {
          console.log(
            `[Watcher] PID ${session.pid} for ${session.username} returned false from isProcessRunning, verifying against system process list...`,
          );

          const allRobloxPids = await ProcessMonitor.getRobloxProcessPids();
          const isPidInSystemList = allRobloxPids.includes(session.pid);

          if (isPidInSystemList) {
            console.log(
              `[Watcher] PID ${session.pid} found in system Roblox process list (PIDs: ${allRobloxPids.join(", ")}). This is a false crash detection - skipping.`,
            );
            continue;
          }

          await new Promise((resolve) => setTimeout(resolve, 200));
          const stillRunning = await ProcessMonitor.isProcessRunning(
            session.pid,
          );
          if (stillRunning) {
            console.log(
              `[Watcher] PID ${session.pid} for ${session.username} verified running after re-check - race condition avoided`,
            );
            continue;
          }

          console.log(
            `[Watcher] PID ${session.pid} NOT found in system Roblox process list (actual PIDs: ${allRobloxPids.join(", ")}). Process is truly gone.`,
          );
          await this.onSessionCrashed(session, "Process ended unexpectedly");
          continue;
        }

        try {
          const duplicateLogOwners = sessions.filter(
            (other) =>
              other.id !== session.id &&
              other.logFile &&
              other.logFile === session.logFile,
          );

          if (duplicateLogOwners.length > 0) {
            console.log(
              `[Watcher] Skipping log scan for ${session.username} because its log file is shared with ${duplicateLogOwners.map((owner) => owner.username).join(", ")}. Using process state instead.`,
            );
            continue;
          }

          if (!session.logFile) {
            console.log(
              `[Watcher] No log file set for ${session.username}, searching...`,
            );
            const startThreshold = session.lastStartTime || Date.now();
            const foundLogFile =
              await logMonitor.findLatestLogFileAfter(startThreshold);
            if (foundLogFile) {
              const otherOwner = this.sessionManager
                .getAllSessions()
                .find((s) => s.id !== session.id && s.logFile === foundLogFile);

              if (otherOwner) {
                console.log(
                  `[Watcher] Found log file is already in use by ${otherOwner.username}, skipping for ${session.username}`,
                );
                continue;
              }

              console.log(
                `[Watcher] Found log file for ${session.username}: ${foundLogFile}`,
              );
              this.sessionManager.updateSessionLogFile(
                session.id,
                foundLogFile,
              );
              continue;
            } else {
              console.log(
                `[Watcher] Still no log file found for ${session.username}`,
              );
              continue;
            }
          }

          const startTime = session.lastStartTime ?? Date.now();
          const logFileAge = Date.now() - startTime;
          if (logFileAge > 0 && session.logFile) {
            const logStat = require("fs").existsSync(session.logFile)
              ? require("fs").statSync(session.logFile)
              : null;
            if (logStat && logStat.mtimeMs < startTime) {
              console.log(
                `[Watcher] Ignoring stale log file for ${session.username}: ${session.logFile}`,
              );
              const foundLogFile =
                await logMonitor.findLatestLogFileAfter(startTime);
              if (foundLogFile) {
                this.sessionManager.updateSessionLogFile(
                  session.id,
                  foundLogFile,
                );
              }
              continue;
            }
          }

          const logSize = logMonitor.getLogFileSize(session.logFile);

          if (logSize === 0) {
            continue;
          }

          let contentToCheck = "";

          if (logSize > session.lastLogSize) {
            contentToCheck = await logMonitor.readNewLogContent(
              session.logFile,
              session.lastLogSize,
            );
          } else if (
            logSize === session.lastLogSize &&
            session.lastLogSize > 0
          ) {
            const isRunning = await ProcessMonitor.isProcessRunning(
              session.pid,
            );
            if (!isRunning) {
              console.log(
                `[Watcher] Process closed and log size stable - doing full file scan for crash indicators`,
              );
              contentToCheck = await logMonitor.readNewLogContent(
                session.logFile,
                0,
              );
            }
          }

          if (contentToCheck && contentToCheck.length > 0) {
            const crashResult =
              logMonitor.detectCrashIndicators(contentToCheck);

            if (crashResult.crashed) {
              console.log(
                `[Watcher] Crash detected for ${session.username}: ${crashResult.reason}`,
              );
              this.sessionManager.updateLogSize(session.id, logSize);
              await this.onSessionCrashed(
                session,
                crashResult.reason || "Unknown",
              );
              continue;
            }

            this.sessionManager.updateLogSize(session.id, logSize);
          } else {
            if (logSize > session.lastLogSize) {
              this.sessionManager.updateLogSize(session.id, logSize);
            }
          }
        } catch (logError) {
          console.error(
            `[Watcher] Error checking logs for ${session.username}:`,
            logError,
          );
        }
      }

      const timedOutSessions = sessions.filter(
        (s) => (s as any).__pendingTimeoutRestart,
      );
      if (timedOutSessions.length > 0) {
        console.log(
          `[Watcher] ${timedOutSessions.length} session(s) hit timeout — staggering restarts 10s apart`,
        );

        const STAGGER_INTERVAL_MS = 10_000;
        for (let i = 0; i < timedOutSessions.length; i++) {
          const session = timedOutSessions[i];
          delete (session as any).__pendingTimeoutRestart;

          const staggerMs = i * STAGGER_INTERVAL_MS;
          const secondsRunning = session.lastStartTime
            ? Math.round((Date.now() - session.lastStartTime) / 1000)
            : 0;

          this.logEvent({
            type: "session-crashed",
            sessionId: session.id,
            username: session.username,
            message: `Timeout exceeded (${secondsRunning}s) — restarting in ${Math.round(staggerMs / 1000)}s (slot ${i + 1}/${timedOutSessions.length})`,
            details: { reason: "CLIENT_TIMEOUT" },
          });

          this.sessionManager.updateSessionStatus(session.id, "crashed");
          this.sessionManager.updateLastCrashReason(
            session.id,
            `Client timeout exceeded (${secondsRunning}s)`,
          );

          const capturedId = session.id;
          const capturedPid = session.pid;
          const capturedUsername = session.username;

          const existingStaggerTimer = this.restartTimers.get(capturedId);
          if (existingStaggerTimer) {
            clearTimeout(existingStaggerTimer);
          }
          const staggerTimer = setTimeout(async () => {
            this.restartTimers.delete(capturedId);

            if (!this.config.enabled) return;

            const liveSession = this.sessionManager.getSessionById(capturedId);
            if (!liveSession) return;
            try {
              await ProcessMonitor.killProcess(capturedPid);
            } catch {}
            console.log(
              `[Watcher] Executing staggered restart for ${capturedUsername} (slot ${i + 1})`,
            );
            await this.restartSession(liveSession);
          }, staggerMs);
          this.restartTimers.set(capturedId, staggerTimer);
        }

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(
            "watcher:sessions-updated",
            this.sessionManager.getAllSessions(),
          );
        }
      }
    } catch (error) {
      console.error("[WatcherService] Error in monitoring loop:", error);
      this.logEvent({
        type: "error",
        sessionId: "watcher",
        username: "system",
        message: `Error in monitoring loop: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private async onSessionCrashed(
    session: WatcherSession,
    reason: string,
  ): Promise<void> {
    delete (session as any).__pendingTimeoutRestart;

    this.sessionManager.updateSessionStatus(session.id, "crashed");
    this.sessionManager.updateLastCrashReason(session.id, reason);

    console.log(`[Watcher] Crash detected for ${session.username}: ${reason}`);
    this.logEvent({
      type: "session-crashed",
      sessionId: session.id,
      username: session.username,
      message: `Crash detected for ${session.username}: ${reason}`,
      details: { reason },
    });

    const killed = await ProcessMonitor.killProcess(session.pid);
    if (killed) {
      console.log(
        `[Watcher] Killed process ${session.pid} for ${session.username}`,
      );
      this.logEvent({
        type: "error",
        sessionId: session.id,
        username: session.username,
        message: `Process ${session.pid} terminated for ${session.displayName || session.username}`,
      });
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("watcher:session-crashed", {
        sessionId: session.id,
        username: session.username,
        reason,
      });
      this.mainWindow.webContents.send(
        "watcher:sessions-updated",
        this.sessionManager.getAllSessions(),
      );
    }

    console.log(
      `[Watcher] Auto-restart check: enabled=${this.config.autoRestart}, hasConfig=${!!session.launchConfig}`,
    );
    if (this.config.autoRestart && session.launchConfig) {
      console.log(
        `[Watcher] Scheduling restart for ${session.username} (attempt ${session.restartAttempts + 1}/3)`,
      );
      this.scheduleRestart(session);
    } else {
      if (!this.config.autoRestart) {
        console.log(`[Watcher] AutoRestart disabled in config`);
      }
      if (!session.launchConfig) {
        console.log(
          `[Watcher] No launch config available for ${session.username}`,
        );
      }
    }
  }

  private scheduleRestart(session: WatcherSession): void {
    const delayMs = this.config.restartDelaySeconds * 1000;

    console.log(
      `[Watcher] Scheduling restart for ${session.username} in ${this.config.restartDelaySeconds}s (attempt ${session.restartAttempts + 1})`,
    );
    this.logEvent({
      type: "session-restarted",
      sessionId: session.id,
      username: session.username,
      message: `Scheduling restart for ${session.displayName || session.username} in ${this.config.restartDelaySeconds}s (attempt ${session.restartAttempts + 1})`,
    });

    this.sessionManager.incrementRestartAttempts(session.id);

    const existingTimer = this.restartTimers.get(session.id);
    if (existingTimer) {
      console.log(
        `[Watcher] Cancelled existing restart timer for ${session.username}`,
      );
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      console.log(
        `[Watcher] Executing scheduled restart for ${session.username}`,
      );
      this.restartTimers.delete(session.id);
      await this.restartSession(session);
    }, delayMs);

    this.restartTimers.set(session.id, timer);
    console.log(`[Watcher] Restart timer set for ${session.username}`);
  }

  private async restartSession(session: WatcherSession): Promise<void> {
    try {
      if (!session.launchConfig) {
        console.log(
          `[Watcher] Cannot restart ${session.username} - no launch config`,
        );
        this.logEvent({
          type: "error",
          sessionId: session.id,
          username: session.username,
          message: `Cannot restart ${session.username} - no launch config available`,
        });
        return;
      }

      console.log(`[Watcher] Starting restart process for ${session.username}`);
      this.sessionManager.updateSessionStatus(session.id, "restarting");

      const { cookie, placeId, jobId, friendId, installPath } =
        session.launchConfig;

      console.log(
        `[Watcher] Launching game for ${session.username} on place ${placeId}`,
      );

      const isOldProcessStillRunning = await ProcessMonitor.isProcessRunning(
        session.pid,
      );
      if (isOldProcessStillRunning) {
        console.log(
          `[Watcher] Old process ${session.pid} still running, killing it`,
        );
        await ProcessMonitor.killProcess(session.pid);
      }

      const pidsBefore = await ProcessMonitor.getRobloxProcessPids();
      console.log(
        `[Watcher] Processes before restart: ${pidsBefore.join(", ")}`,
      );

      let launchSuccess = false;
      try {
        const result = await RobloxLauncherService.launchGame(
          cookie,
          placeId,
          jobId,
          friendId as string | number | undefined,
          installPath,
        );
        launchSuccess = result?.success === true;
      } catch (launchError: any) {
        console.error(
          `[Watcher] Launch error for ${session.username}:`,
          launchError,
        );
        const errorMsg = launchError?.message || "Unknown error";
        this.logEvent({
          type: "error",
          sessionId: session.id,
          username: session.username,
          message: `Failed to launch game: ${errorMsg}`,
        });
        this.sessionManager.updateSessionStatus(session.id, "crashed");

        this.scheduleRestart(session);
        return;
      }

      if (!launchSuccess) {
        console.error(
          `[Watcher] Failed to launch game for ${session.username}`,
        );
        this.logEvent({
          type: "error",
          sessionId: session.id,
          username: session.username,
          message: `Failed to launch game for ${session.displayName || session.username}`,
        });
        this.sessionManager.updateSessionStatus(session.id, "crashed");

        this.scheduleRestart(session);
        return;
      }

      console.log(
        `[Watcher] Game launched successfully for ${session.username}`,
      );

      let newPid: number | null = null;
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const pidsAfter = await ProcessMonitor.getRobloxProcessPids();
        const orderedAfter = [...pidsAfter].sort((a, b) => b - a);
        const newPids = orderedAfter.filter((pid) => !pidsBefore.includes(pid));

        if (newPids.length > 0) {
          newPid = newPids[0];
          console.log(
            `[Watcher] Detected new process PID ${newPid} after restart`,
          );
          break;
        }
      }

      if (newPid) {
        console.log(
          `[Watcher] Updating session PID from ${session.pid} to ${newPid}`,
        );
        this.sessionManager.updateSessionPid(session.id, newPid);
      } else {
        const pidsAfter = await ProcessMonitor.getRobloxProcessPids();
        console.log(
          `[Watcher] No new process detected, available processes: ${pidsAfter.join(", ")}`,
        );

        if (pidsAfter.length === 0) {
          console.error(
            `[Watcher] Restart failed for ${session.username} - no Roblox processes found after launch`,
          );
          this.sessionManager.updateSessionStatus(session.id, "crashed");
          this.logEvent({
            type: "error",
            sessionId: session.id,
            username: session.username,
            message: `Failed to restart ${session.displayName || session.username} - no process started`,
          });

          this.scheduleRestart(session);
          return;
        }

        const newProcess = pidsAfter.find((pid) => !pidsBefore.includes(pid));
        if (newProcess) {
          console.log(`[Watcher] Found new process PID ${newProcess}`);
          this.sessionManager.updateSessionPid(session.id, newProcess);
          newPid = newProcess;
        } else if (pidsAfter.length > 0) {
          const orderedAfter = [...pidsAfter].sort((a, b) => b - a);
          console.log(
            `[Watcher] No new process found, using newest available PID ${orderedAfter[0]}`,
          );
          this.sessionManager.updateSessionPid(session.id, orderedAfter[0]);
          newPid = orderedAfter[0];
        }
      }

      let newLogFile: string | null = null;
      if (newPid) {
        console.log(
          `[Watcher] Searching for new log file for process ${newPid}`,
        );
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          newLogFile = await logMonitor.findLatestLogFile();
          if (newLogFile && newLogFile !== session.logFile) {
            console.log(`[Watcher] Found new log file: ${newLogFile}`);
            break;
          }
        }

        if (newLogFile) {
          console.log(
            `[Watcher] Updating log file from ${session.logFile} to ${newLogFile}`,
          );
          this.sessionManager.updateSessionLogFile(session.id, newLogFile);
        } else {
          const startCutoff = session.lastStartTime || Date.now();
          const sinceLaunchLog =
            await logMonitor.findLatestLogFileAfter(startCutoff);
          if (sinceLaunchLog) {
            console.log(
              `[Watcher] Using launch-specific log file for ${session.username}: ${sinceLaunchLog}`,
            );
            this.sessionManager.updateSessionLogFile(
              session.id,
              sinceLaunchLog,
            );
          } else {
            console.warn(
              `[Watcher] Could not find new log file, keeping old one: ${session.logFile}`,
            );
          }
        }
      }

      this.sessionManager.incrementRestartCount(session.id);
      this.sessionManager.resetRestartAttempts(session.id);

      console.log(
        `[Watcher] Successfully restarted ${session.username} (Restart #${session.restartCount})`,
      );
      this.logEvent({
        type: "session-restarted",
        sessionId: session.id,
        username: session.username,
        message: `Successfully restarted ${session.displayName || session.username} - now running (Auto-restart #${session.restartCount})`,
      });

      this.sessionManager.updateLastRestartTime(session.id, Date.now());
      this.sessionManager.updateLastStartTime(session.id, Date.now());
      this.sessionManager.updateSessionStatus(session.id, "running");
      console.log(
        `[Watcher] Grace period started for ${session.username} (45s)`,
      );

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(
          "watcher:sessions-updated",
          this.sessionManager.getAllSessions(),
        );
      }

      const robloxSettings = storageService.getRobloxSettings();
      if (robloxSettings.windowLayoutEnabled) {
        console.log(`[Watcher] Retiling windows after successful restart of ${session.username}`);
        await PerformanceService.tileRobloxWindows({
          pattern: robloxSettings.windowLayoutPattern ?? "grid",
          spacing: robloxSettings.windowLayoutSpacing ?? 12,
          columns: robloxSettings.windowLayoutColumns ?? 3,
          width: robloxSettings.windowLayoutWidth ?? 0,
          height: robloxSettings.windowLayoutHeight ?? 0,
          monitors: "all",
        });
      }
    } catch (error) {
      console.error(`[Watcher] Error restarting ${session.username}:`, error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logEvent({
        type: "error",
        sessionId: session.id,
        username: session.username,
        message: `Error restarting ${session.displayName || session.username}: ${errorMsg}`,
      });

      this.sessionManager.updateSessionStatus(session.id, "crashed");

      this.scheduleRestart(session);
    }
  }

  async autoTrackLaunchedGame(
    accountId: string,
    username: string,
    userId: string,
    placeId: number,
    launchConfig?: LaunchConfig,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<WatcherSession | null> {
    try {
      console.log(
        `[WatcherService] Starting auto-track for ${username} (place ${placeId})`,
      );

      const initialPids = await ProcessMonitor.getRobloxProcessPids();
      console.log(
        `[WatcherService] Initial Roblox processes: ${initialPids.join(", ")} (count: ${initialPids.length})`,
      );

      let newPid: number | null = null;
      const maxWaitMs = 5000;
      for (let elapsed = 0; elapsed <= maxWaitMs; elapsed += 500) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const currentPids = await ProcessMonitor.getRobloxProcessPids();
        const newPids = currentPids.filter((pid) => !initialPids.includes(pid));

        if (newPids.length > 0) {
          newPid = [...newPids].sort((a, b) => b - a)[0];
          console.log(
            `[WatcherService] Detected new Roblox process: PID ${newPid} after ${(elapsed + 500) / 1000}s`,
          );
          break;
        }

        if (currentPids.length > 0 && elapsed >= 1500) {
          newPid = currentPids[0];
          console.log(
            `[WatcherService] Using newest active Roblox PID ${newPid} after ${(elapsed + 500) / 1000}s (no strictly new PID detected)`,
          );
          break;
        }

        if (elapsed % 2000 === 0 || elapsed === maxWaitMs) {
          console.log(
            `[WatcherService] Still waiting for process... (${(elapsed + 500) / 1000}s elapsed, current: ${currentPids.length > 0 ? currentPids.join(", ") : "none"})`,
          );
        }
      }

      if (!newPid) {
        const currentPids = await ProcessMonitor.getRobloxProcessPids();
        if (currentPids.length > 0) {
          newPid = currentPids[0];
          console.log(
            `[WatcherService] No new process detected, using newest active PID ${newPid}.`,
          );
        } else {
          console.warn("[WatcherService] No Roblox processes found");
          return null;
        }
      }

      const sessionStartedAt = Date.now();
      console.log("[WatcherService] Waiting for log file to be created...");
      let logFile: string | null = null;
      for (let i = 0; i < 12; i++) {
        logFile = await logMonitor.findLatestLogFileAfter(sessionStartedAt);
        if (logFile) {
          console.log(
            `[WatcherService] Found log file: ${logFile} after ${(i + 1) * 0.25}s`,
          );
          break;
        }
        if (i < 12) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      if (logFile) {
        const existingSession = this.sessionManager
          .getAllSessions()
          .find((s) => s.logFile === logFile);

        if (existingSession) {
          console.log(
            `[WatcherService] Log file is already in use by ${existingSession.username}, deferring log assignment for ${username}`,
          );
          logFile = null;
        }
      }

      if (logFile) {
        console.log(
          `[WatcherService] Registering session for ${username} with log: ${logFile}`,
        );
      } else {
        console.log(
          `[WatcherService] Registering session for ${username} without log file yet - will find during monitoring`,
        );
      }

      const session = this.addSession(
        accountId,
        username,
        userId,
        newPid,
        placeId,
        logFile || "",
        launchConfig,
        undefined,
        undefined,
        displayName,
        avatarUrl,
      );

      return session;
    } catch (error: any) {
      console.error(
        "[WatcherService] Error auto-tracking launched game:",
        error,
      );
      return null;
    }
  }

  async joinPrivateServer(
    accountId: string,
    jobId: string,
    placeId: number,
  ): Promise<boolean> {
    try {
      console.log(
        `[WatcherService] Joining private server: placeId=${placeId}, jobId=${jobId}`,
      );

      const accounts = storageService.getAccounts();
      const account = accounts.find((acc) => acc.id === accountId);

      if (!account || !account.cookie) {
        console.error(
          `[WatcherService] Account not found or no cookie: ${accountId}`,
        );
        return false;
      }

      const installPath = await RobloxInstallService.getActiveInstallPath();
      if (!installPath) {
        console.error("[WatcherService] No active installation found");
        return false;
      }

      const result = await RobloxLauncherService.launchGame(
        account.cookie,
        placeId,
        jobId,
        undefined,
        installPath,
      );

      const success = result?.success === true;
      console.log(`[WatcherService] Private server join result: ${success}`);

      return success;
    } catch (error: any) {
      console.error("[WatcherService] Error joining private server:", error);
      return false;
    }
  }

  async joinGame(accountId: string, placeId: number): Promise<boolean> {
    try {
      console.log(`[WatcherService] Joining game: placeId=${placeId}`);

      const accounts = storageService.getAccounts();
      const account = accounts.find((acc) => acc.id === accountId);

      if (!account || !account.cookie) {
        console.error(
          `[WatcherService] Account not found or no cookie: ${accountId}`,
        );
        return false;
      }

      const installPath = await RobloxInstallService.getActiveInstallPath();
      if (!installPath) {
        console.error("[WatcherService] No active installation found");
        return false;
      }

      const result = await RobloxLauncherService.launchGame(
        account.cookie,
        placeId,
        undefined,
        undefined,
        installPath,
      );

      const success = result?.success === true;
      console.log(`[WatcherService] Game join result: ${success}`);

      return success;
    } catch (error: any) {
      console.error("[WatcherService] Error joining game:", error);
      return false;
    }
  }

  async launchGameWithUrl(
    accountId: string,
    placeId: number,
    url: string,
  ): Promise<boolean> {
    try {
      console.log(
        `[WatcherService] Launching game with URL for placeId=${placeId}: ${url}`,
      );

      const accounts = storageService.getAccounts();
      const account = accounts.find((acc) => acc.id === accountId);

      if (!account || !account.cookie) {
        console.error(
          `[WatcherService] Account not found or no cookie: ${accountId}`,
        );
        return false;
      }

      const installPath = await RobloxInstallService.getActiveInstallPath();
      if (!installPath) {
        console.error("[WatcherService] No active installation found");
        return false;
      }

      console.log(
        `[WatcherService] Attempting to extract link code from: "${url}"`,
      );
      const linkCodeMatch = url.match(/privateServerLinkCode=([^&]+)/);
      console.log(`[WatcherService] Regex match result:`, linkCodeMatch);

      if (!linkCodeMatch || !linkCodeMatch[1]) {
        console.error(
          `[WatcherService] Invalid private server link code format. Regex did not match.`,
        );
        console.error(`[WatcherService] URL: ${url}`);
        console.error(`[WatcherService] Match result: ${linkCodeMatch}`);
        return false;
      }

      const linkCode = decodeURIComponent(linkCodeMatch[1]);
      console.log(`[WatcherService] Extracted link code: ${linkCode}`);

      try {
        const result = await RobloxLauncherService.launchWithPrivateServerLink(
          account.cookie,
          placeId,
          url,
          installPath,
        );

        const success = result?.success === true;
        console.log(
          `[WatcherService] Private server launch result: ${success}`,
        );

        return success;
      } catch (error: any) {
        console.warn(
          `[WatcherService] Private server launcher failed, falling back to launchGame: ${error.message}`,
        );

        const result = await RobloxLauncherService.launchGame(
          account.cookie,
          placeId,
          linkCode,
          undefined,
          installPath,
        );

        const success = result?.success === true;
        console.log(
          `[WatcherService] Game launch result (fallback): ${success}`,
        );

        return success;
      }
    } catch (error: any) {
      console.error("[WatcherService] Error launching game with URL:", error);
      return false;
    }
  }

  async rejoinPrivateServer(
    sessionId: string,
    jobId: string,
  ): Promise<boolean> {
    try {
      const session = this.sessionManager.getSessionById(sessionId);
      if (!session) {
        console.error(`[WatcherService] Session not found: ${sessionId}`);
        return false;
      }

      console.log(
        `[WatcherService] Rejoining private server for ${session.username}`,
      );

      const accounts = storageService.getAccounts();
      const account = accounts.find((acc) => acc.id === session.accountId);

      if (!account || !account.cookie) {
        console.error(
          `[WatcherService] Account not found or no cookie for session: ${sessionId}`,
        );
        return false;
      }

      const installPath = await RobloxInstallService.getActiveInstallPath();
      if (!installPath) {
        console.error("[WatcherService] No active installation found");
        return false;
      }

      const result = await RobloxLauncherService.launchGame(
        account.cookie,
        session.placeId,
        jobId,
        undefined,
        installPath,
      );

      const success = result?.success === true;
      if (success) {
        this.logEvent({
          type: "session-restarted",
          sessionId: session.id,
          username: session.username,
          message: `Rejoined private server with jobId: ${jobId}`,
        });
      }

      return success;
    } catch (error: any) {
      console.error("[WatcherService] Error rejoining private server:", error);
      return false;
    }
  }

  private logEvent(event: Omit<WatcherEvent, "timestamp">): void {
    const fullEvent: WatcherEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);

    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("watcher:event", fullEvent);
    }

    console.log(`[Watcher] Event: ${event.type} - ${event.message}`);
  }

  clearAll(): void {
    this.stopWatching();
    this.sessionManager.clearAllSessions();
    this.clearEventLog();
  }
}

export const watcherService = new WatcherService();
