import fs from "fs";
import path from "path";
import https from "https";
import { app } from "electron";
import { exec } from "child_process";
import AdmZip from "adm-zip";

export class Handle64Service {
  private static isMonitoring = false;
  private static monitorInterval: NodeJS.Timeout | null = null;
  private static handle64Path = path.join(
    app.getPath("userData"),
    "handle64.exe",
  );
  private static isDownloading = false;
  private static initializationPromise: Promise<boolean> | null = null;
  private static closeHandleFailureCount = 0;
  private static readonly MAX_CONSECUTIVE_FAILURES = 3;
  private static hasFailed = false;
  private static isProcessing = false;
  private static elevationHintShown = false;

  private static getTargetExecutables(): string[] {
    return ["RobloxPlayer", "Bloxstrap"];
  }

  private static readonly SINGLETON_HANDLE_NAMES = [
    "ROBLOX_singletonEvent",
    "ROBLOX_singletonMutex",
  ];

  private static resetFailureState(): void {
    this.hasFailed = false;
    this.closeHandleFailureCount = 0;
  }

  public static async initialize(): Promise<void> {
    if (process.platform !== "win32") {
      console.log("[Handle64] Not Windows, skipping initialization");
      return;
    }
    console.log(
      `[Handle64] Checking for handle64.exe at: ${this.handle64Path}`,
    );
    if (!fs.existsSync(this.handle64Path)) {
      console.log("[Handle64] handle64.exe not found, downloading...");
      try {
        await this.downloadHandle64();
        console.log(
          "[Handle64] handle64.exe download and extraction successful",
        );
      } catch (err) {
        console.error("[Handle64] Failed to download handle64.exe:", err);
        throw err;
      }
    } else {
      console.log("[Handle64] handle64.exe found at: " + this.handle64Path);
    }
  }

  private static async downloadHandle64(): Promise<void> {
    if (this.isDownloading) {
      console.log("[Handle64] Download already in progress");
      return;
    }
    this.isDownloading = true;

    try {
      console.log("[Handle64] Downloading handle64.exe from Sysinternals...");
      const zipPath = path.join(app.getPath("temp"), "Handle.zip");

      await new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(zipPath);
        https
          .get(
            "https://download.sysinternals.com/files/Handle.zip",
            (response) => {
              if (response.statusCode !== 200) {
                reject(
                  new Error(
                    `Failed to download Handle.zip: ${response.statusCode}`,
                  ),
                );
                return;
              }
              response.pipe(file);
              file.on("finish", () => {
                file.close();
                resolve();
              });
            },
          )
          .on("error", (err) => {
            fs.unlink(zipPath, () => {});
            reject(err);
          });
      });

      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      let found = false;
      for (const entry of zipEntries) {
        if (entry.entryName.toLowerCase() === "handle64.exe") {
          fs.writeFileSync(this.handle64Path, entry.getData());
          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error("handle64.exe not found in Handle.zip");
      }

      fs.unlinkSync(zipPath);
      console.log(
        "[Handle64] Download complete and extracted to: " + this.handle64Path,
      );
    } catch (error) {
      console.error("[Handle64] Failed to download/extract handle64:", error);
      throw error;
    } finally {
      this.isDownloading = false;
    }
  }

  public static async startMonitoring(): Promise<boolean> {
    if (process.platform !== "win32") {
      console.log("[Handle64] Not on Windows, skipping");
      return false;
    }
    if (this.isMonitoring) {
      console.log("[Handle64] Already monitoring");
      return true;
    }

    if (this.initializationPromise) {
      console.log("[Handle64] Startup in progress, waiting...");
      return this.initializationPromise;
    }

    console.log("[Handle64] Starting monitoring...");
    this.initializationPromise = (async () => {
      try {
        this.resetFailureState();
        console.log("[Handle64] Initializing handle64.exe...");
        await this.initialize();
        console.log(
          "[Handle64] Initialization complete, starting handle polling loop...",
        );
        this.logElevationHintOnce();
        this.isMonitoring = true;

        this.monitorInterval = setInterval(() => {
          if (this.isMonitoring && !this.isProcessing) {
            void this.closeRobloxHandles();
          }
        }, 3000);
        console.log("[Handle64] Handle monitoring loop started (running).");
        return true;
      } catch (error) {
        console.error("[Handle64] Initialization failed:", error);
        this.isMonitoring = false;
        return false;
      }
    })();

    return this.initializationPromise;
  }

  public static async waitForReady(timeoutMs: number = 5000): Promise<boolean> {
    if (process.platform !== "win32") return false;

    if (!this.isMonitoring && !this.initializationPromise) {
      console.log(
        "[Handle64] No initialization in progress, starting initialization now...",
      );
      try {
        void this.startMonitoring();
      } catch (err) {
        console.error("[Handle64] Failed to start monitoring:", err);
        return false;
      }
    }

    if (this.isMonitoring) {
      console.log("[Handle64] Already monitoring, returning true");
      return true;
    }

    try {
      console.log(
        `[Handle64] Waiting for initialization with ${timeoutMs}ms timeout...`,
      );
      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => {
          console.log("[Handle64] Initialization timeout reached");
          resolve(false);
        }, timeoutMs),
      );
      const result = await Promise.race([
        this.initializationPromise || Promise.resolve(false),
        timeoutPromise,
      ]);
      console.log(`[Handle64] Initialization result: ${result}`);
      return result;
    } catch (err) {
      console.error("[Handle64] Error waiting for ready:", err);
      return false;
    }
  }

  public static stopMonitoring(): void {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log("[Handle64] Stopped monitoring for Roblox handles.");
  }

  private static async closeRobloxHandles(): Promise<void> {
    await this.runClosePass();
  }

  public static async runClosePass(): Promise<{
    found: number;
    closed: number;
    failed: number;
  }> {
    const result = { found: 0, closed: 0, failed: 0 };

    if (this.isProcessing) {
      for (let i = 0; i < 40 && this.isProcessing; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (this.isProcessing) return result;
    }

    this.isProcessing = true;
    try {
      if (!fs.existsSync(this.handle64Path)) {
        console.warn(
          "[Handle64] handle64.exe not found at:",
          this.handle64Path,
        );
        return result;
      }

      for (const executable of this.getTargetExecutables()) {
        const closures = await this.findSingletonHandles(executable);
        result.found += closures.length;
        if (closures.length > 0) {
          const { closed, failed } = await this.queueHandleClosures(closures);
          result.closed += closed;
          result.failed += failed;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return result;
  }

  private static findSingletonHandles(
    executable: string,
  ): Promise<Array<{ pid: string; handleHex: string }>> {
    return new Promise((resolve) => {
      exec(
        `"${this.handle64Path}" -a -p ${executable} -nobanner -accepteula`,
        { timeout: 10000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error && error.code !== 1 && error.code !== 0) {
            console.error(
              `[Handle64] scan error for ${executable} (exit code ${error.code}):`,
              error.message,
              stderr ? `stderr: ${stderr}` : "",
            );
            resolve([]);
            return;
          }

          const closures: Array<{ pid: string; handleHex: string }> = [];
          let currentPid: string | null = null;
          for (const line of (stdout || "").split("\n")) {
            const pidMatch = line.match(/pid:\s*(\d+)/i);
            if (pidMatch) {
              currentPid = pidMatch[1];
              continue;
            }
            if (
              currentPid &&
              this.SINGLETON_HANDLE_NAMES.some((n) => line.includes(n))
            ) {
              const handleMatch = line.match(/^\s*([0-9a-fA-F]+):/i);
              if (handleMatch) {
                closures.push({ pid: currentPid, handleHex: handleMatch[1] });
              }
            }
          }
          resolve(closures);
        },
      );
    });
  }

  private static async queueHandleClosures(
    closures: Array<{ pid: string; handleHex: string }>,
  ): Promise<{ closed: number; failed: number }> {
    let closed = 0;
    let failed = 0;

    for (const { pid, handleHex } of closures) {
      if (this.closeHandleFailureCount >= this.MAX_CONSECUTIVE_FAILURES) {
        console.error(
          "[Handle64] Max consecutive failures reached, stopping handle closures",
        );
        this.hasFailed = true;
        this.stopMonitoring();
        break;
      }

      console.log(
        `[Handle64] Found Roblox singleton handle ${handleHex} in PID ${pid}, closing...`,
      );

      const cleared = await new Promise<boolean>((resolve) => {
        exec(
          `"${this.handle64Path}" -c ${handleHex} -p ${pid} -y -nobanner -accepteula`,
          { timeout: 10000, maxBuffer: 10 * 1024 * 1024 },
          (closeErr, closeStdout, closeStderr) => {
            const out = `${closeStdout || ""} ${closeStderr || ""}`;
            const lc = out.toLowerCase();

            const benignGone =
              /not found|no such process|invalid handle|already closed/.test(
                lc,
              );

            const accessProblem =
              /denied|error opening process|cannot open process|failed to open/.test(
                lc,
              );
            const closedOk = /handle closed|closed\./.test(lc);

            let ok: boolean;
            if (benignGone) ok = true;
            else if (accessProblem) ok = false;
            else if (closedOk) ok = true;
            else if (!closeErr || closeErr.code === 0 || closeErr.code === 1)
              ok = true;
            else ok = false;

            if (!ok) {
              console.error(
                `[Handle64] Failed to close handle ${handleHex} for PID ${pid}:`,
                closeErr ? `exit ${closeErr.code}: ${closeErr.message}` : "",
                out.trim() ? `output: ${out.trim()}` : "",
              );
            }
            resolve(ok);
          },
        );
      });

      if (cleared) {
        closed++;
        this.closeHandleFailureCount = 0;
        console.log(
          `[Handle64] Cleared Roblox singleton handle ${handleHex} for PID ${pid}`,
        );
      } else {
        failed++;
        this.closeHandleFailureCount++;
        console.error(
          `[Handle64] Close attempt ${this.closeHandleFailureCount}/${this.MAX_CONSECUTIVE_FAILURES} failed for handle ${handleHex} (PID ${pid})`,
        );
        if (this.closeHandleFailureCount >= this.MAX_CONSECUTIVE_FAILURES) {
          console.error(
            `[Handle64] Reached max consecutive failures (${this.MAX_CONSECUTIVE_FAILURES}), marking Handle64 as failed`,
          );
          this.hasFailed = true;
          this.stopMonitoring();
        }
      }
    }

    return { closed, failed };
  }

  public static async closeHandlesNow(): Promise<boolean> {
    if (process.platform !== "win32") return false;
    try {
      await this.initialize();
    } catch (err) {
      console.error("[Handle64] closeHandlesNow: initialization failed:", err);
      return false;
    }
    this.logElevationHintOnce();
    const { found, closed, failed } = await this.runClosePass();
    if (found === 0) {
      return true;
    }
    if (failed > 0) {
      console.warn(
        `[Handle64] closeHandlesNow: ${failed}/${found} handle(s) could not be closed (elevation required?). Cleared ${closed}.`,
      );
      return false;
    }
    console.log(
      `[Handle64] closeHandlesNow: cleared ${closed}/${found} singleton handle(s)`,
    );
    return true;
  }

  private static logElevationHintOnce(): void {
    if (this.elevationHintShown) return;
    this.elevationHintShown = true;
    try {
      exec("net session", { timeout: 4000 }, (err) => {
        if (err) {
          console.warn(
            "[Handle64] sentra does not appear to be running as administrator. " +
              "The handle64 multi-instance method needs elevation to close another " +
              "process's ROBLOX_singletonEvent handle; without it, handle-closing " +
              "will fail and sentra falls back to holding the singleton mutex. " +
              "Run sentra as administrator to use the handle64 method fully.",
          );
        }
      });
    } catch {}
  }

  public static checkAndReportFailure(): boolean {
    return this.hasFailed;
  }

  public static isInstalled(): boolean {
    if (process.platform !== "win32") return false;
    return fs.existsSync(this.handle64Path);
  }

  public static async install(): Promise<boolean> {
    if (process.platform !== "win32") return false;

    try {
      await this.downloadHandle64();
      return this.isInstalled();
    } catch (error) {
      console.error("[Handle64] Failed to install:", error);
      return false;
    }
  }

  public static uninstall(): boolean {
    if (process.platform !== "win32") return false;

    try {
      if (fs.existsSync(this.handle64Path)) {
        fs.unlinkSync(this.handle64Path);
        console.log("[Handle64] Uninstalled successfully");
        return true;
      }
      return false;
    } catch (error) {
      console.error("[Handle64] Failed to uninstall:", error);
      return false;
    }
  }
}
