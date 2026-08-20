import { existsSync, statSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { CrashDetectionResult, CrashIndicator } from "./types";

export class LogMonitor {
  private logCache: Map<string, { size: number; content: string }> = new Map();

  static getRobloxLogsDirectory(): string {
    if (process.platform === "win32") {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        let logsPath = path.join(localAppData, "Roblox", "logs");
        if (existsSync(logsPath)) {
          console.log("[LogMonitor] Found logs at (lowercase):", logsPath);
          return logsPath;
        }

        logsPath = path.join(localAppData, "Roblox", "Logs");
        if (existsSync(logsPath)) {
          console.log("[LogMonitor] Found logs at (uppercase):", logsPath);
          return logsPath;
        }

        console.warn(
          "[LogMonitor] Neither logs nor Logs found under Roblox, returning default path",
        );
        return path.join(localAppData, "Roblox", "logs");
      }

      const userProfile = process.env.USERPROFILE;
      if (userProfile) {
        let logsPath = path.join(
          userProfile,
          "AppData",
          "Local",
          "Roblox",
          "logs",
        );
        if (existsSync(logsPath)) {
          console.log("[LogMonitor] Found logs via USERPROFILE:", logsPath);
          return logsPath;
        }

        logsPath = path.join(userProfile, "AppData", "Local", "Roblox", "Logs");
        if (existsSync(logsPath)) {
          console.log(
            "[LogMonitor] Found logs via USERPROFILE (uppercase):",
            logsPath,
          );
          return logsPath;
        }

        return path.join(userProfile, "AppData", "Local", "Roblox", "logs");
      }

      return "";
    } else if (process.platform === "darwin") {
      return path.join(process.env.HOME || "", "Library", "Logs", "Roblox");
    } else if (process.platform === "linux") {
      return path.join(
        process.env.HOME || "",
        ".local",
        "share",
        "Roblox",
        "logs",
      );
    }
    return "";
  }

  async findLatestLogFile(): Promise<string | null> {
    return this.findLatestLogFileAfter(0);
  }

  async findLatestLogFileAfter(sinceTimeMs: number): Promise<string | null> {
    try {
      const logsDir = LogMonitor.getRobloxLogsDirectory();

      if (!logsDir) {
        console.error(
          "[LogMonitor] Could not determine Roblox logs directory for platform:",
          process.platform,
        );
        return null;
      }

      if (!existsSync(logsDir)) {
        console.warn(
          "[LogMonitor] Roblox logs directory does NOT exist at:",
          logsDir,
        );
        return null;
      }

      const fs = await import("fs/promises");
      const files = await fs.readdir(logsDir);

      let latestFile: string | null = null;
      let latestTime = 0;

      for (const file of files) {
        const isLogFile =
          file.endsWith(".log") ||
          file.includes("Player") ||
          file.match(/^\d+\.log/);
        if (!isLogFile) continue;

        const filePath = path.join(logsDir, file);
        try {
          const stat = statSync(filePath);
          if (stat.mtimeMs <= sinceTimeMs) continue;
          if (stat.mtimeMs > latestTime) {
            latestTime = stat.mtimeMs;
            latestFile = file;
          }
        } catch (e) {
          console.log(`[LogMonitor] Could not stat file ${file}:`, e);
        }
      }

      if (latestFile) {
        const result = path.join(logsDir, latestFile);
        console.log(
          `[LogMonitor] Found latest log file after ${sinceTimeMs}:`,
          result,
        );
        return result;
      }

      if (sinceTimeMs > 0) {
        console.warn(
          `[LogMonitor] No log files newer than ${new Date(sinceTimeMs).toISOString()} were found in ${logsDir}`,
        );
      }
      return null;
    } catch (error) {
      console.error("[LogMonitor] Error finding latest log file:", error);
      return null;
    }
  }

  getLogFileSize(logFilePath: string): number {
    try {
      if (!existsSync(logFilePath)) {
        return 0;
      }
      return statSync(logFilePath).size;
    } catch (error) {
      console.error("[LogMonitor] Error getting log file size:", error);
      return 0;
    }
  }

  async readNewLogContent(
    logFilePath: string,
    lastSize: number,
  ): Promise<string> {
    try {
      if (!existsSync(logFilePath)) {
        console.log("[LogMonitor] Log file does not exist:", logFilePath);
        return "";
      }

      const currentSize = statSync(logFilePath).size;

      if (currentSize < lastSize) {
        console.log("[LogMonitor] File was truncated, reading entire file");
        const content = await readFile(logFilePath, "utf-8");
        return content;
      }

      if (currentSize === lastSize) {
        return "";
      }

      const content = await readFile(logFilePath, "utf-8");

      const buffer = Buffer.from(content, "utf-8");

      if (lastSize > 0 && lastSize < buffer.length) {
        const newBuffer = buffer.slice(lastSize);
        const newContent = newBuffer.toString("utf-8");
        console.log(
          `[LogMonitor] Read ${newContent.length} new characters from log file`,
        );
        return newContent;
      }

      console.log("[LogMonitor] Returning entire content");
      return content;
    } catch (error) {
      console.error("[LogMonitor] Error reading log file:", error);
      return "";
    }
  }

  detectCrashIndicators(logContent: string): CrashDetectionResult {
    if (!logContent || logContent.trim().length === 0) {
      return { crashed: false };
    }

    const normalizedContent = logContent
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    console.log(
      `[LogMonitor] Scanning ${normalizedContent.length} characters for crash indicators`,
    );

    for (const indicator of [
      CrashIndicator.Segfault,
      CrashIndicator.AccessViolation,
    ]) {
      if (normalizedContent.toLowerCase().includes(indicator.toLowerCase())) {
        console.log(`[LogMonitor] Found hard crash indicator: "${indicator}"`);
        return {
          crashed: true,
          reason: indicator,
        };
      }
    }

    const lines = normalizedContent.split("\n");
    const lastLines = lines.slice(-120);
    const lastContent = lastLines.join("\n");
    const lowerContent = lastContent.toLowerCase();

    console.log(
      `[LogMonitor] Analyzing last ${lastLines.length} lines for Roblox error patterns`,
    );

    const robloxTextPatterns = [
      {
        pattern: /please reconnect|reconnect to continue/i,
        reason: "Disconnect: Roblox asked the client to reconnect",
      },
      {
        pattern:
          /same account.*(?:launched|logged in).*different device|different device.*same account|already connected.*different device|same account launched elsewhere/i,
        reason:
          "Same-account conflict: the account is already active on another device",
      },
      {
        pattern:
          /teleport failed|teleport.*failed|failed to teleport|teleport destination/i,
        reason: "Teleport failure: the experience could not move the client",
      },
      {
        pattern:
          /(?:not authorised|not authorized|permission denied)[^\r\n]{0,100}(?:launch|start|join|play|place)|(?:launch|start|join|play|place)[^\r\n]{0,100}(?:not authorised|not authorized|permission denied)/i,
        reason: "Launch failure: Roblox denied permission to start this place",
      },
      {
        pattern:
          /server\s+(?:or\s+job\s+)?(?:id\s+)?no longer exists|private server\s+(?:is\s+)?no longer exists|specific server\s+(?:is\s+)?no longer exists/i,
        reason: "Launch failure: the target server or job ID no longer exists",
      },
      {
        pattern:
          /failed to join|join failed|place launch failed|failed to launch(?:\s+(?:the|this|requested))?/i,
        reason: "Place launch failure: the client never reached a valid server",
      },
    ];

    for (const entry of robloxTextPatterns) {
      if (entry.pattern.test(lastContent)) {
        console.log(`[LogMonitor] Found Roblox text pattern: ${entry.reason}`);
        return {
          crashed: true,
          reason: entry.reason,
        };
      }
    }

    const disconnectMatch = lastContent.match(
      /Sending disconnect with reason:\s*(\d+)/i,
    );
    if (disconnectMatch) {
      const code = parseInt(disconnectMatch[1], 10);
      const disconnectInfo = this.categorizeDisconnectCode(code, lastContent);
      console.log(
        `[LogMonitor] Found disconnect code: ${code} -> ${disconnectInfo.status}`,
      );
      return {
        crashed: true,
        reason: `${disconnectInfo.status}: ${disconnectInfo.explanation}`,
      };
    }

    const lostConnMatch = lastContent.match(
      /Lost connection with reason\s*:\s*([^\n\r]+)/i,
    );
    if (lostConnMatch) {
      const message = lostConnMatch[1].trim();
      console.log(`[LogMonitor] Found lost connection: ${message}`);
      return {
        crashed: true,
        reason: `Connection Lost: ${message}`,
      };
    }

    const last20Lines = lines.slice(-20);
    const last20Content = last20Lines.join("\n");

    if (last20Content.toLowerCase().includes("d3d11 device removed")) {
      console.log("[LogMonitor] Found graphics crash: D3D11 Device Removed");
      return {
        crashed: true,
        reason:
          "Graphics Crash: D3D11 Device Removed - Graphics hardware error or driver crash",
      };
    }

    if (last20Content.toLowerCase().includes("rbxcrash")) {
      console.log("[LogMonitor] Found engine crash: RBXCRASH");
      return {
        crashed: true,
        reason: "Engine Crash: RBXCRASH - Roblox engine fatal error",
      };
    }

    console.log("[LogMonitor] No crash indicators detected in log");
    return { crashed: false };
  }

  private categorizeDisconnectCode(
    code: number,
    logContent: string,
  ): { status: string; explanation: string } {
    if (code === 260 || code === 261 || code === 262) {
      return {
        status: "Disconnect: data stream failure",
        explanation: "The client could not receive or send game data reliably.",
      };
    }
    if (code === 264 || code === 273) {
      return {
        status: "Same-account conflict",
        explanation:
          "The same account is active on another device or session and got evicted.",
      };
    }
    if (code === 267) {
      const lines = logContent.split("\n");
      const disconnectLine = lines.findIndex((line) =>
        line.includes(`Sending disconnect with reason: ${code}`),
      );
      if (disconnectLine > 1) {
        const customReason =
          lines[disconnectLine - 2]?.trim() || "Unknown reason";
        return {
          status: "Developer kick",
          explanation: `The experience kicked the user: ${customReason}`,
        };
      }
      return {
        status: "Developer kick",
        explanation: "The experience kicked the user.",
      };
    }
    if (code === 268) {
      return {
        status: "Integrity check failed",
        explanation:
          "Roblox detected a modified or interfering client environment.",
      };
    }
    if (code === 271 || code === 274) {
      return {
        status: "Server shut down",
        explanation:
          "The server ended, commonly because it was idle or the developer closed it.",
      };
    }
    if (code === 272) {
      return {
        status: "Security key mismatch",
        explanation: "The client and server security state did not match.",
      };
    }
    if (code === 277 || code === 279) {
      return {
        status: "Disconnect: network timeout",
        explanation:
          "The connection dropped before the client could remain stable.",
      };
    }
    if (code === 280) {
      return {
        status: "Client build mismatch",
        explanation:
          "The client version did not match what the server expected.",
      };
    }
    if (code >= 256 && code <= 321) {
      return {
        status: "Disconnect family",
        explanation: `The client was connected and then lost the session with code ${code}.`,
      };
    }
    if (code === 529) {
      return {
        status: "HTTP launch failure",
        explanation:
          "A place-launch handshake failed during Roblox HTTP processing.",
      };
    }
    if (code >= 512 && code <= 611) {
      return {
        status: "Join failure family",
        explanation: `The client asked to join a place and never reached a valid server (code ${code}).`,
      };
    }
    if (code >= 768 && code <= 775) {
      return {
        status: "Teleport failure family",
        explanation: `The experience attempted a teleport and it failed (code ${code}).`,
      };
    }
    return {
      status: "Unknown disconnect",
      explanation: `Disconnected with code ${code}. Check logs for details.`,
    };
  }

  async parseUserInfoFromLog(
    logFilePath: string,
  ): Promise<{ username?: string; userId?: string } | null> {
    try {
      if (!existsSync(logFilePath)) {
        return null;
      }

      const content = await readFile(logFilePath, "utf-8");
      const result: { username?: string; userId?: string } = {};

      const userNameMatch = content.match(
        /\[.*\]\s+UserName[:\s=]+([^\s\n]+)/i,
      );
      if (userNameMatch) {
        result.username = userNameMatch[1];
      }

      const userIdMatch = content.match(/\[.*\]\s+UserId[:\s=]+(\d+)/i);
      if (userIdMatch) {
        result.userId = userIdMatch[1];
      }

      return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
      console.error("[LogMonitor] Error parsing user info from log:", error);
      return null;
    }
  }

  async getPlaceIdFromLog(logFilePath: string): Promise<number | null> {
    try {
      if (!existsSync(logFilePath)) {
        return null;
      }

      const content = await readFile(logFilePath, "utf-8");

      const placeIdMatch = content.match(/PlaceId[:\s=]+(\d+)/i);
      if (placeIdMatch) {
        return parseInt(placeIdMatch[1], 10);
      }

      return null;
    } catch (error) {
      console.error("[LogMonitor] Error getting PlaceId from log:", error);
      return null;
    }
  }

  clearCache(logFilePath: string): void {
    this.logCache.delete(logFilePath);
  }

  clearAllCache(): void {
    this.logCache.clear();
  }
}

export const logMonitor = new LogMonitor();
