import { shell } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { RobloxAuthService } from "../auth/RobloxAuthService";
import { RobloxInstallService } from "./InstallService";
import { cookieRefreshService } from "../auth/CookieRefreshService";
import { RobloxUserService } from "../users/UserService";
import { storageService } from "../system/StorageService";

import { ProcessMonitor } from "../watcher/ProcessMonitor";

const execAsync = promisify(exec);

export class RobloxLauncherService {
  public static activeLaunches = new Map<string, string>(); // browserTrackerId -> username

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

      // Map global settings to FFlags
      if (settings.useDirectX12) {
        mergedFlags["FFlagDebugGraphicsPreferD3D11"] = "True";
      }

      if (settings.lowEndGraphics) {
        mergedFlags["DFIntDebugFRMQualityLevelOverride"] = 1;
        mergedFlags["FIntRenderShadowIntensity"] = 0;
        mergedFlags["FFlagDisablePostFx"] = "True";
      }

      if (settings.framerateCapEnabled && settings.framerateCapValue) {
        mergedFlags["DFIntTaskSchedulerTargetFps"] = settings.framerateCapValue;
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
  ) {
    try {
      // getAuthenticationTicket automatically handles CSRF validation and retry.
      // We pass an empty string initially, which triggers a 403, grabs the token, and retries.
      const ticket = await RobloxAuthService.getAuthenticationTicket(
        cookie,
        "",
      );

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
        `+channel:` +
        `+LaunchExp:InApp`;

      const initialCount = await this.getRobloxProcessCount();

      if (installPath) {
        await this.syncFFlags(installPath);
        await RobloxInstallService.launchWithProtocol(
          installPath,
          protocolLaunchCommand,
        );
      } else {
        // No install path specified - use system default via protocol handler
        // On Windows, try to find a default installation first for multi-instance support
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
              // Fallback to protocol handler if no install found
              await shell.openExternal(protocolLaunchCommand);
            }
          } catch (error) {
            // Fallback to protocol handler on error
            await shell.openExternal(protocolLaunchCommand);
          }
        } else {
          await shell.openExternal(protocolLaunchCommand);
        }
      }

      // Poll for process start in background - don't block the caller
      // This allows multiple accounts to launch concurrently
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

      // Fire-and-forget process polling (don't await - return immediately)
      pollForProcess().catch((err) =>
        console.warn("[LauncherService] Process poll error:", err),
      );

      // Register the launch for window renaming
      RobloxUserService.getAuthenticatedUser(cookie)
        .then((user) => {
          if (user && user.name) {
            this.activeLaunches.set(browserTrackerId, user.name);
            // Limit map size to prevent memory leaks
            if (this.activeLaunches.size > 100) {
              const keys = Array.from(this.activeLaunches.keys());
              for (let i = 0; i < 50; i++) this.activeLaunches.delete(keys[i]);
            }
          }
        })
        .catch(() => {});

      // Return success immediately after sending the launch command
      // The game may still be starting up
      return { success: true };
    } catch (error: any) {
      console.error("Failed to launch Roblox:", error);
      throw new Error(`Failed to launch Roblox: ${error.message}`);
    }
  }

  /**
   * Launch a private server with access code
   * Based on C# JoinServer logic for private servers
   */
  static async launchPrivateServer(
    cookie: string,
    placeId: number | string,
    accessCode: string,
    linkCode?: string,
    installPath?: string,
  ) {
    try {
      // getAuthenticationTicket handles CSRF internally
      const ticket = await RobloxAuthService.getAuthenticationTicket(
        cookie,
        "",
      );

      const nowMs = Date.now();
      const browserTrackerId =
        Date.now().toString() + Math.floor(Math.random() * 10000);
      const joinAttemptId = randomUUID();

      // Private server uses RequestPrivateGame
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
        `+channel:` +
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

      // Poll for process start in background - don't block the caller
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

      // Fire-and-forget process polling
      pollForProcess().catch((err) =>
        console.warn(
          "[LauncherService] Private server process poll error:",
          err,
        ),
      );

      // Register the launch for window renaming
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

      // Return success immediately
      return { success: true };
    } catch (error: any) {
      console.error("Failed to launch private server:", error);
      throw new Error(`Failed to launch private server: ${error.message}`);
    }
  }

  /**
   * Extract access code from private server link code
   * Makes request to Roblox to get the actual access code from link code
   */
  static async extractAccessCodeFromLinkCode(
    cookie: string,
    placeId: number | string,
    linkCode: string,
  ): Promise<string> {
    try {
      // This would require making an HTTP request to Roblox
      // For now, return the link code as-is (Roblox may accept it directly)
      // In production, you'd need to parse the response from PlaceLauncher to extract the access code
      return linkCode;
    } catch (error: any) {
      console.error("Failed to extract access code from link code:", error);
      throw new Error(`Failed to extract access code: ${error.message}`);
    }
  }

  /**
   * Launch game with private server link
   * Extracts link code from URL, gets access code, and launches
   */
  static async launchWithPrivateServerLink(
    cookie: string,
    placeId: number | string,
    privateServerUrl: string,
    installPath?: string,
  ) {
    try {
      // Extract link code from the private server invite URL
      // Format: https://www.roblox.com/games/[placeId]?privateServerLinkCode=[linkCode]
      const linkCodeMatch = privateServerUrl.match(
        /privateServerLinkCode=([^&]+)/,
      );
      if (!linkCodeMatch) {
        throw new Error(
          "Invalid private server link - missing privateServerLinkCode parameter",
        );
      }

      const linkCode = decodeURIComponent(linkCodeMatch[1]);

      // Use link code as access code (simpler approach)
      // In a more complex implementation, you'd make a request to extract the actual access code
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
