import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class MemoryCleanupService {
  private static instance: MemoryCleanupService | null = null;
  private isWindowsPlatform: boolean = false;

  private constructor() {
    this.isWindowsPlatform = process.platform === "win32";
  }

  static getInstance(): MemoryCleanupService {
    if (!this.instance) {
      this.instance = new MemoryCleanupService();
    }
    return this.instance;
  }

  async emptyWorkingSet(pid: number): Promise<boolean> {
    if (!this.isWindowsPlatform) {
      console.log(
        `[MemoryCleanupService] EmptyWorkingSet not supported on ${process.platform} - skipping`,
      );
      return false;
    }

    try {
      const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class MemTrim {
    [DllImport("psapi.dll")]
    public static extern bool EmptyWorkingSet(IntPtr hProcess);
  }
"@
[GC]::Collect()
[GC]::WaitForPendingFinalizers()
$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if ($p) {
  [MemTrim]::EmptyWorkingSet($p.Handle) | Out-Null
  exit 0
} else {
  exit 1
}
`;

      const { stderr } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
        {
          timeout: 5000,
          windowsHide: true,
        },
      );

      if (stderr && stderr.length > 0) {
        console.log(`[MemoryCleanupService] PowerShell stderr: ${stderr}`);
      }

      console.log(
        `[MemoryCleanupService] Successfully cleaned memory for process ${pid}`,
      );
      return true;
    } catch (error) {
      console.error(
        `[MemoryCleanupService] Error calling EmptyWorkingSet for PID ${pid}:`,
        error,
      );
      return false;
    }
  }

  isSupported(): boolean {
    return this.isWindowsPlatform;
  }
}

export const memoryCleanupService = MemoryCleanupService.getInstance();
