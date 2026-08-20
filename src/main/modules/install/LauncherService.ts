import { shell } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { RobloxAuthService } from "../auth/RobloxAuthService";
import { RobloxInstallService } from "./InstallService";
import { cookieRefreshService } from "../auth/CookieRefreshService";
import { RobloxUserService } from "../users/UserService";
import { storageService } from "../system/StorageService";
import { Handle64Service } from "../../lib/Handle64Service";
import { MultiInstance } from "../../lib/MultiInstance";

import { ProcessMonitor } from "../watcher/ProcessMonitor";

const execAsync = promisify(exec);

export class RobloxLauncherService {
  public static activeLaunches = new Map<string, string>();

  private static async getRobloxProcessCount(): Promise<number> {
    try {
      const pids = await ProcessMonitor.getRobloxProcessPids();
      return pids.length;
    } catch (error) {
      return 0;
    }
  }

  private static async syncFFlags(installPath: string): Promise<void> {
    try {
      const existingFlags = await RobloxInstallService.getFFlags(installPath);
      const settings = storageService.getRobloxSettings();

      const mergedFlags = { ...existingFlags };

      if (settings.useDirectX12) {
        mergedFlags["FFlagDebugGraphicsPreferD3D11"] = "False";
      } else {
        delete mergedFlags["FFlagDebugGraphicsPreferD3D11"];
      }

      if (settings.lowEndGraphics) {
        mergedFlags["DFIntDebugFRMQualityLevelOverride"] = 1;
        mergedFlags["FIntRenderShadowIntensity"] = 0;
        mergedFlags["FFlagDisablePostFx"] = "True";
      }

      if (settings.headlessModeEnabled) {
        mergedFlags["DFIntDebugFRMQualityLevelOverride"] = 1;
        mergedFlags["FIntRenderShadowIntensity"] = 0;
        mergedFlags["FFlagDisablePostFx"] = "True";
        mergedFlags["DFIntTaskSchedulerTargetFps"] = 1;
      }

      if (!settings.lowEndGraphics && !settings.headlessModeEnabled) {
        delete mergedFlags["DFIntDebugFRMQualityLevelOverride"];
        delete mergedFlags["FIntRenderShadowIntensity"];
        delete mergedFlags["FFlagDisablePostFx"];
      }

      if (!settings.framerateCapEnabled && !settings.headlessModeEnabled) {
        delete mergedFlags["DFIntTaskSchedulerTargetFps"];
      }

      if (
        settings.framerateCapEnabled &&
        settings.framerateCapValue &&
        !settings.headlessModeEnabled
      ) {
        mergedFlags["DFIntTaskSchedulerTargetFps"] = settings.framerateCapValue;
      }

      if (settings.headlessModeEnabled) {
        mergedFlags["DFIntTaskSchedulerTargetFps"] = 1;
      }

      await RobloxInstallService.setFFlags(installPath, mergedFlags);
    } catch (err) {
      console.error("[LauncherService] Failed to sync FFlags:", err);
    }
  }

  static async launchGame(
    cookie: string,
    placeId: number | string,
    jobId?: string,
    friendId?: string | number,
    installPath?: string,
    channel?: string,
  ) {
    try {
      const settings = storageService.getRobloxSettings();
      const multiInstanceAllowed = storageService.getAllowMultipleInstances();
      const multiInstanceMethod =
        storageService.getSettings().multiInstanceMethod;

      console.log(
        `[LauncherService] Starting game launch: place=${placeId}, jobId=${jobId}, friendId=${friendId}, installPath=${installPath || "system default"}`,
      );
      console.log(
        `[LauncherService] Multi-instance mode: ${multiInstanceAllowed ? `ENABLED (${multiInstanceMethod})` : "DISABLED - only 1 Roblox process allowed"}`,
      );

      const ticket = await RobloxAuthService.getAuthenticationTicket(
        cookie,
        "",
      );
      console.log("[LauncherService] Authentication ticket obtained");

      if (multiInstanceAllowed) {
        if (multiInstanceMethod === "handle64") {
          console.log(
            "[LauncherService] Clearing Roblox singleton via Handle64...",
          );
          try {
            const cleared = await Handle64Service.closeHandlesNow();
            if (cleared) {
              console.log(
                "[LauncherService] Handle64 cleared the singleton (or none was present)",
              );
            } else {
              console.warn(
                "[LauncherService] Handle64 could not clear the singleton (it likely needs administrator rights). Relying on the owned mutex for multi-instance.",
              );
            }
          } catch (err) {
            console.warn(
              "[LauncherService] Handle64 pre-launch close failed:",
              err,
            );
          }
        } else {
          console.log(
            "[LauncherService] Preparing multi-instance (mutex) before launch...",
          );
          MultiInstance.PrepareForLaunch();
        }
      }

      const nowMs = Date.now();
      const browserTrackerId =
        Date.now().toString() + Math.floor(Math.random() * 10000);
      const joinAttemptId = randomUUID();

      let placeLauncherUrl: string;

      if (friendId) {
        placeLauncherUrl =
          `https://www.roblox.com/Game/PlaceLauncher.ashx?` +
          `request=RequestFollowUser` +
          `&browserTrackerId=${browserTrackerId}` +
          `&userId=${friendId}` +
          `&isPlayTogetherGame=false` +
          `&joinAttemptId=${joinAttemptId}` +
          `&joinAttemptOrigin=followUser`;
      } else if (jobId) {
        placeLauncherUrl =
          `https://www.roblox.com/Game/PlaceLauncher.ashx?` +
          `request=RequestGameJob` +
          `&browserTrackerId=${browserTrackerId}` +
          `&placeId=${placeId}` +
          `&gameId=${jobId}` +
          `&isPlayTogetherGame=false` +
          `&joinAttemptId=${joinAttemptId}` +
          `&joinAttemptOrigin=publicServerListJoin`;
      } else {
        placeLauncherUrl =
          `https://www.roblox.com/Game/PlaceLauncher.ashx?` +
          `request=RequestGame` +
          `&browserTrackerId=${browserTrackerId}` +
          `&placeId=${placeId}` +
          `&isPlayTogetherGame=false` +
          `&joinAttemptId=${joinAttemptId}` +
          `&joinAttemptOrigin=PlayButton`;
      }

      const protocolLaunchCommand =
        `roblox-player:1+launchmode:play` +
        `+gameinfo:${ticket}` +
        `+launchtime:${nowMs}` +
        `+placelauncherurl:${encodeURIComponent(placeLauncherUrl)}` +
        `+browsertrackerid:${browserTrackerId}` +
        `+robloxLocale:en_us` +
        `+gameLocale:en_us` +
        `+channel:${(channel ?? "").trim()}` +
        `+LaunchExp:InApp`;

      const initialCount = await this.getRobloxProcessCount();
      console.log(
        `[LauncherService] Initial Roblox process count: ${initialCount}`,
      );

      if (installPath) {
        console.log(
          `[LauncherService] Launching with custom install path: ${installPath}`,
        );
        await this.syncFFlags(installPath);
        await RobloxInstallService.launchWithProtocol(
          installPath,
          protocolLaunchCommand,
          { no3d: !!settings.headlessModeEnabled },
        );
        console.log(`[LauncherService] Protocol launched with custom path`);
      } else {
        if (process.platform === "win32") {
          try {
            console.log(
              `[LauncherService] Detecting default Windows installations...`,
            );
            const installations =
              await RobloxInstallService.detectDefaultInstallations();
            console.log(
              `[LauncherService] Found ${installations.length} installations`,
            );

            if (installations.length > 0) {
              console.log(
                `[LauncherService] Using installation: ${installations[0].path}`,
              );
              await this.syncFFlags(installations[0].path);
              await RobloxInstallService.launchWithProtocol(
                installations[0].path,
                protocolLaunchCommand,
                { no3d: !!settings.headlessModeEnabled },
              );
              console.log(
                `[LauncherService] Protocol launched with detected path`,
              );
            } else {
              console.log(
                `[LauncherService] No installations found, using protocol handler fallback`,
              );

              await shell.openExternal(protocolLaunchCommand);
              console.log(
                `[LauncherService] Protocol handler fallback executed`,
              );
            }
          } catch (error) {
            console.warn(
              `[LauncherService] Error detecting installations, using protocol fallback:`,
              error,
            );

            await shell.openExternal(protocolLaunchCommand);
            console.log(
              `[LauncherService] Protocol handler fallback executed after error`,
            );
          }
        } else {
          await shell.openExternal(protocolLaunchCommand);
        }
      }

      if (multiInstanceAllowed && multiInstanceMethod !== "handle64") {
        MultiInstance.ScheduleSingletonSweep();
      }

      const pollForProcess = async () => {
        const startTime = Date.now();
        const timeout = 30000;

        while (Date.now() - startTime < timeout) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const currentCount = await this.getRobloxProcessCount();

          if (currentCount > initialCount) {
            console.log(
              `[LauncherService] Process detected (${currentCount} vs ${initialCount})`,
            );
            return true;
          }
        }
        console.warn(
          `[LauncherService] No new Roblox process detected after 30 seconds`,
        );
        return false;
      };

      pollForProcess()
        .catch((err) =>
          console.warn("[LauncherService] Process poll error:", err),
        )
        .then((detected) => {
          if (!detected) {
            console.warn(
              "[LauncherService] Warning: Launch command sent but no process detected.",
              "This may indicate the Roblox process launched in a different way or the detection failed.",
            );
          }
        });

      RobloxUserService.getAuthenticatedUser(cookie)
        .then((user) => {
          if (user && user.name) {
            this.activeLaunches.set(browserTrackerId, user.name);

            if (this.activeLaunches.size > 100) {
              const keys = Array.from(this.activeLaunches.keys());
              for (let i = 0; i < 50; i++) this.activeLaunches.delete(keys[i]);
            }
          }
        })
        .catch(() => {});

      return { success: true };
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        "[LauncherService] Failed to launch Roblox:",
        errorMsg,
        error,
      );
      throw new Error(`Failed to launch Roblox: ${errorMsg}`);
    }
  }

  static async launchPrivateServer(
    cookie: string,
    placeId: number | string,
    accessCode: string,
    linkCode?: string,
    installPath?: string,
    channel?: string,
  ) {
    try {
      const ticket = await RobloxAuthService.getAuthenticationTicket(
        cookie,
        "",
      );

      const multiInstanceAllowed = storageService.getAllowMultipleInstances();
      const multiInstanceMethod =
        storageService.getSettings().multiInstanceMethod;
      if (multiInstanceAllowed) {
        if (multiInstanceMethod === "handle64") {
          try {
            await Handle64Service.closeHandlesNow();
          } catch (err) {
            console.warn(
              "[LauncherService] Handle64 pre-launch close failed (private server):",
              err,
            );
          }
        } else {
          MultiInstance.PrepareForLaunch();
        }
      }

      const nowMs = Date.now();
      const browserTrackerId =
        Date.now().toString() + Math.floor(Math.random() * 10000);
      const joinAttemptId = randomUUID();

      const placeLauncherUrl =
        `https://www.roblox.com/Game/PlaceLauncher.ashx?` +
        `request=RequestPrivateGame` +
        `&browserTrackerId=${browserTrackerId}` +
        `&placeId=${placeId}` +
        `&accessCode=${encodeURIComponent(accessCode)}` +
        (linkCode ? `&linkCode=${encodeURIComponent(linkCode)}` : "") +
        `&isPlayTogetherGame=false` +
        `&joinAttemptId=${joinAttemptId}` +
        `&joinAttemptOrigin=joinPrivateGameButton`;

      const protocolLaunchCommand =
        `roblox-player:1+launchmode:play` +
        `+gameinfo:${ticket}` +
        `+launchtime:${nowMs}` +
        `+placelauncherurl:${encodeURIComponent(placeLauncherUrl)}` +
        `+browsertrackerid:${browserTrackerId}` +
        `+robloxLocale:en_us` +
        `+gameLocale:en_us` +
        `+channel:${(channel ?? "").trim()}` +
        `+LaunchExp:InApp`;

      const initialCount = await this.getRobloxProcessCount();

      if (installPath) {
        await this.syncFFlags(installPath);
        await RobloxInstallService.launchWithProtocol(
          installPath,
          protocolLaunchCommand,
        );
      } else {
        if (process.platform === "win32") {
          try {
            const installations =
              await RobloxInstallService.detectDefaultInstallations();
            if (installations.length > 0) {
              await this.syncFFlags(installations[0].path);
              await RobloxInstallService.launchWithProtocol(
                installations[0].path,
                protocolLaunchCommand,
              );
            } else {
              await shell.openExternal(protocolLaunchCommand);
            }
          } catch (error) {
            await shell.openExternal(protocolLaunchCommand);
          }
        } else {
          await shell.openExternal(protocolLaunchCommand);
        }
      }

      if (multiInstanceAllowed && multiInstanceMethod !== "handle64") {
        MultiInstance.ScheduleSingletonSweep();
      }

      const pollForProcess = async () => {
        const startTime = Date.now();
        const timeout = 30000;

        while (Date.now() - startTime < timeout) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const currentCount = await this.getRobloxProcessCount();

          if (currentCount > initialCount) {
            return true;
          }
        }
        return false;
      };

      pollForProcess().catch((err) =>
        console.warn(
          "[LauncherService] Private server process poll error:",
          err,
        ),
      );

      RobloxUserService.getAuthenticatedUser(cookie)
        .then((user) => {
          if (user && user.name) {
            this.activeLaunches.set(browserTrackerId, user.name);
            if (this.activeLaunches.size > 100) {
              const keys = Array.from(this.activeLaunches.keys());
              for (let i = 0; i < 50; i++) this.activeLaunches.delete(keys[i]);
            }
          }
        })
        .catch(() => {});

      return { success: true };
    } catch (error: any) {
      console.error("Failed to launch private server:", error);
      throw new Error(`Failed to launch private server: ${error.message}`);
    }
  }

  static async extractAccessCodeFromLinkCode(
    cookie: string,
    placeId: number | string,
    linkCode: string,
  ): Promise<string> {
    try {
      return linkCode;
    } catch (error: any) {
      console.error("Failed to extract access code from link code:", error);
      throw new Error(`Failed to extract access code: ${error.message}`);
    }
  }

  static async launchWithPrivateServerLink(
    cookie: string,
    placeId: number | string,
    privateServerUrl: string,
    installPath?: string,
  ) {
    try {
      const linkCodeMatch = privateServerUrl.match(
        /privateServerLinkCode=([^&]+)/,
      );
      if (!linkCodeMatch) {
        throw new Error(
          "Invalid private server link - missing privateServerLinkCode parameter",
        );
      }

      const linkCode = decodeURIComponent(linkCodeMatch[1]);

      return await this.launchPrivateServer(
        cookie,
        placeId,
        linkCode,
        linkCode,
        installPath,
      );
    } catch (error: any) {
      console.error("Failed to launch with private server link:", error);
      throw new Error(
        `Failed to launch with private server link: ${error.message}`,
      );
    }
  }
}
