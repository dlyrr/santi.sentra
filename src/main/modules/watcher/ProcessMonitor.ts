import { exec } from "child_process";
import { promisify } from "util";
import { memoryCleanupService } from "./MemoryCleanupService";

const execAsync = promisify(exec);

export class ProcessMonitor {
  static async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      if (process.platform === "win32") {
        try {
          const allPids = await this.getRobloxProcessPids();
          const isInList = allPids.includes(pid);
          if (isInList) {
            if (Math.random() < 0.2) {
              console.warn(
                `[ProcessMonitor] PID ${pid} failed process.kill(pid, 0) check but found in Roblox process list: ${allPids.join(", ")} - returning true (process likely exists)`,
              );
            }
            return true;
          }
        } catch (checkErr) {
          console.warn(
            `[ProcessMonitor] Error verifying PID ${pid} in process list:`,
            checkErr,
          );
        }
      }
      return false;
    }
  }

  static async isRobloxRunning(): Promise<boolean> {
    const pids = await this.getRobloxProcessPids();
    return pids.length > 0;
  }

  static async getRobloxProcessPids(): Promise<number[]> {
    try {
      if (process.platform === "darwin") {
        const { stdout } = await execAsync(
          "pgrep -x RobloxPlayer 2>/dev/null || true",
        );
        const pids = stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0 && /^\d+$/.test(line))
          .map((line) => parseInt(line, 10));

        if (pids.length > 0) {
          console.log(
            `[ProcessMonitor] Found ${pids.length} Roblox processes on macOS: ${pids.join(", ")}`,
          );
        }
        return pids;
      } else if (process.platform === "win32") {
        try {
          const { stdout } = await execAsync(
            "powershell.exe -NoProfile -Command \"$items = Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('RobloxPlayerBeta.exe','RobloxPlayer.exe','Bloxstrap.exe') -and $_.MainWindowHandle -ne 0 }; $items | Sort-Object CreationDate -Descending | Select-Object -ExpandProperty ProcessId\"",
            { timeout: 3000, windowsHide: true },
          );

          const pids = stdout
            .trim()
            .split(/\r?\n/)
            .map((line) => parseInt(line.trim(), 10))
            .filter((pid) => !isNaN(pid));

          if (pids.length > 0) {
            const ordered = [...new Set(pids)];
            if (Math.random() < 0.1) {
              console.log(
                `[ProcessMonitor] Found ${ordered.length} interactive Roblox processes on Windows`,
              );
            }
            return ordered;
          }
        } catch (interactiveError) {
          console.warn(
            "[ProcessMonitor] Interactive window check failed; falling back to all Roblox processes:",
            interactiveError,
          );
        }

        try {
          const { stdout } = await execAsync(
            "wmic process where \"name='RobloxPlayerBeta.exe' OR name='RobloxPlayer.exe' OR name='Bloxstrap.exe'\" get ProcessId",
            { timeout: 3000, windowsHide: true },
          );
          const pids = stdout
            .split("\n")
            .map((line) => parseInt(line.trim(), 10))
            .filter((pid) => !isNaN(pid));

          const ordered = [...new Set(pids)];
          if (ordered.length > 0 && Math.random() < 0.1) {
            console.log(
              `[ProcessMonitor] Found ${ordered.length} Roblox processes on Windows`,
            );
          }
          return ordered;
        } catch (error) {
          console.warn(
            "[ProcessMonitor] wmic multiple names failed, trying single name:",
            error,
          );
          const { stdout } = await execAsync(
            "wmic process where \"name='RobloxPlayerBeta.exe'\" get ProcessId",
            { timeout: 3000, windowsHide: true },
          );
          const pids = stdout
            .split("\n")
            .map((line) => parseInt(line.trim(), 10))
            .filter((pid) => !isNaN(pid));
          return [...new Set(pids)];
        }
      } else if (process.platform === "linux") {
        const { stdout } = await execAsync(
          "pgrep -x RobloxPlayer 2>/dev/null || true",
        );
        const pids = stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0 && /^\d+$/.test(line))
          .map((line) => parseInt(line, 10));

        if (pids.length > 0) {
          console.log(
            `[ProcessMonitor] Found ${pids.length} Roblox processes on Linux: ${pids.join(", ")}`,
          );
        }
        return pids;
      }
    } catch (error) {
      console.error("[ProcessMonitor] Error getting Roblox processes:", error);
    }
    return [];
  }

  static async killProcess(pid: number): Promise<boolean> {
    try {
      console.log(`[ProcessMonitor] Killing Roblox process ${pid}`);

      if (process.platform === "darwin" || process.platform === "linux") {
        await execAsync(`kill -9 ${pid}`);
        console.log(`[ProcessMonitor] Successfully killed process ${pid}`);
        return true;
      } else if (process.platform === "win32") {
        await execAsync(`taskkill /PID ${pid} /T /F`);
        console.log(`[ProcessMonitor] Successfully killed process ${pid}`);
        return true;
      }
    } catch (error) {
      console.error(`[ProcessMonitor] Error killing process ${pid}:`, error);
      return false;
    }
    return false;
  }

  static async getProcessRAM(pid: number): Promise<number | null> {
    try {
      if (process.platform === "darwin") {
        const { stdout } = await execAsync(`ps -p ${pid} -o rss=`);
        const trimmed = stdout.trim();

        if (!trimmed || trimmed.length === 0) {
          console.log(
            `[ProcessMonitor] macOS: No output from ps for PID ${pid} - process may not exist`,
          );
          return null;
        }

        const ramKB = parseInt(trimmed, 10);

        if (isNaN(ramKB)) {
          console.log(
            `[ProcessMonitor] macOS: Invalid RAM value for PID ${pid}: "${trimmed}"`,
          );
          return null;
        }

        const ramMB = Math.round(ramKB / 1024);
        console.log(
          `[ProcessMonitor] macOS: PID ${pid} RSS=${ramKB}KB -> ${ramMB}MB`,
        );
        return ramMB;
      } else if (process.platform === "win32") {
        const { stdout } = await execAsync(
          `powershell.exe -NoProfile -Command "$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction SilentlyContinue; if ($p) { [int64]$p.WorkingSetSize } else { exit 1 }"`,
          { windowsHide: true },
        );
        const trimmed = stdout.trim();

        if (!trimmed || trimmed.length === 0) {
          console.log(`[ProcessMonitor] Windows: No RAM output for PID ${pid}`);
          return null;
        }

        const ramBytes = parseInt(trimmed, 10);
        if (isNaN(ramBytes)) {
          console.log(
            `[ProcessMonitor] Windows: Invalid RAM bytes for PID ${pid}: "${trimmed}"`,
          );
          return null;
        }

        const ramMB = Math.round(ramBytes / (1024 * 1024));
        console.log(
          `[ProcessMonitor] Windows: PID ${pid} WorkingSet=${ramBytes}B -> ${ramMB}MB`,
        );
        return ramMB;
      } else if (process.platform === "linux") {
        const { stdout } = await execAsync(`ps -p ${pid} -o rss=`);
        const trimmed = stdout.trim();

        if (!trimmed || trimmed.length === 0) {
          console.log(
            `[ProcessMonitor] Linux: No output from ps for PID ${pid} - process may not exist`,
          );
          return null;
        }

        const ramKB = parseInt(trimmed, 10);

        if (isNaN(ramKB)) {
          console.log(
            `[ProcessMonitor] Linux: Invalid RAM value for PID ${pid}: "${trimmed}"`,
          );
          return null;
        }

        const ramMB = Math.round(ramKB / 1024);
        console.log(
          `[ProcessMonitor] Linux: PID ${pid} RSS=${ramKB}KB -> ${ramMB}MB`,
        );
        return ramMB;
      }
    } catch (error) {
      console.error(
        `[ProcessMonitor] Error getting RAM for process ${pid}:`,
        error,
      );
    }
    return null;
  }

  static async getProcessCpuTime(pid: number): Promise<number | null> {
    if (process.platform !== "win32") return null;

    try {
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -NonInteractive -Command "(Get-Process -Id ${pid} -ErrorAction Stop).CPU"`,
        { timeout: 3000, windowsHide: true },
      );
      const cpuTime = Number.parseFloat(stdout.trim());
      return Number.isFinite(cpuTime) ? cpuTime : null;
    } catch {
      return null;
    }
  }

  static async attemptRAMCleanup(
    pid: number,
    currentRAM: number,
    maxRAMMB: number,
    failureCount: number,
    enableCleanup: boolean = true,
  ): Promise<{
    cleanedUp: boolean;
    shouldRestart: boolean;
  }> {
    try {
      if (currentRAM <= maxRAMMB) {
        return { cleanedUp: false, shouldRestart: false };
      }

      if (!enableCleanup) {
        console.log(
          `[ProcessMonitor] RAM cleanup disabled - restarting process ${pid}`,
        );
        return { cleanedUp: false, shouldRestart: true };
      }

      if (process.platform !== "win32") {
        console.log(
          `[ProcessMonitor] RAM cleanup only supported on Windows - killing process ${pid}`,
        );
        return { cleanedUp: false, shouldRestart: true };
      }

      console.log(
        `[ProcessMonitor] Attempting RAM cleanup for PID ${pid}: ${currentRAM}MB > ${maxRAMMB}MB (failure count: ${failureCount})`,
      );

      const cleanupSuccess = await memoryCleanupService.emptyWorkingSet(pid);

      if (cleanupSuccess) {
        console.log(`[ProcessMonitor] RAM cleanup succeeded for PID ${pid}`);
        return { cleanedUp: true, shouldRestart: false };
      }

      const newFailureCount = failureCount + 1;
      console.log(
        `[ProcessMonitor] RAM cleanup failed for PID ${pid} (attempt ${newFailureCount}/3)`,
      );

      if (newFailureCount >= 3) {
        console.log(
          `[ProcessMonitor] RAM cleanup failed 3 times for PID ${pid} - will restart client`,
        );
        return { cleanedUp: false, shouldRestart: true };
      }

      return { cleanedUp: false, shouldRestart: false };
    } catch (error) {
      console.error(
        `[ProcessMonitor] Error during RAM cleanup attempt for ${pid}:`,
        error,
      );
      return { cleanedUp: false, shouldRestart: false };
    }
  }

  static async getInteractiveRobloxProcessPids(): Promise<number[]> {
    try {
      if (process.platform === "darwin" || process.platform === "linux") {
        return await this.getRobloxProcessPids();
      } else if (process.platform === "win32") {
        const { stdout } = await execAsync(
          "powershell.exe -NoProfile -Command 'Get-Process -Name RobloxPlayerBeta -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -ExpandProperty Id'",
          { timeout: 3000 },
        );

        const pids = stdout
          .trim()
          .split(/\r?\n/)
          .map((line) => parseInt(line.trim(), 10))
          .filter((pid) => !isNaN(pid));

        if (pids.length > 0 && Math.random() < 0.2) {
          console.log(
            `[ProcessMonitor] Found ${pids.length} interactive Roblox processes on Windows`,
          );
        }

        return pids;
      }
    } catch (error) {
      console.error(
        "[ProcessMonitor] Error getting interactive Roblox processes:",
        error,
      );
    }
    return [];
  }

  static async checkAndLimitRAM(
    pid: number,
    maxRAMMB: number,
    failureCount: number = 0,
    enableCleanup: boolean = true,
  ): Promise<boolean> {
    try {
      const ramUsage = await this.getProcessRAM(pid);

      if (ramUsage === null) {
        console.log(
          `[ProcessMonitor] Could not get RAM for process ${pid} - process may not exist`,
        );
        return false;
      }

      console.log(
        `[ProcessMonitor] Process ${pid} RAM usage: ${ramUsage}MB (limit: ${maxRAMMB}MB)`,
      );

      if (ramUsage > maxRAMMB) {
        const { cleanedUp, shouldRestart } = await this.attemptRAMCleanup(
          pid,
          ramUsage,
          maxRAMMB,
          failureCount,
          enableCleanup,
        );

        if (shouldRestart) {
          console.log(
            `[ProcessMonitor] Process ${pid} exceeded RAM limit (${ramUsage}MB > ${maxRAMMB}MB) - will restart`,
          );
          const killed = await this.killProcess(pid);
          return killed;
        }

        if (cleanedUp) {
          console.log(
            `[ProcessMonitor] RAM cleanup succeeded for PID ${pid} - no restart needed`,
          );
          return false;
        }

        return false;
      }

      return false;
    } catch (error) {
      console.error(
        `[ProcessMonitor] Error checking RAM limit for ${pid}:`,
        error,
      );
      return false;
    }
  }
}

export const processMonitor = new ProcessMonitor();
