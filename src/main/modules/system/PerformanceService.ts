import { RobloxLauncherService } from "../install/LauncherService";

import { app } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ProcessMonitor } from "../watcher/ProcessMonitor";
import { watcherService } from "../watcher/WatcherService";
import { storageService } from "../system/StorageService";

const execAsync = promisify(exec);

export class PerformanceService {
  private static updateInterval: NodeJS.Timeout | null = null;
  private static frequentInterval: NodeJS.Timeout | null = null;
  private static settingsPollInterval: NodeJS.Timeout | null = null;
  private static bootstrapTimeout: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static isFrequentRunning = false;
  private static ramFailures = new Map<number, number>();
  private static cpuFailures = new Map<number, number>();
  private static cpuSamples = new Map<number, { time: number; at: number }>();

  private static loopGen = 0;

  static init() {
    try {
      if (this.shouldBeActive()) {
        this.startLoop();
      }
    } catch (err) {}

    if (!this.settingsPollInterval) {
      this.settingsPollInterval = setInterval(() => {
        try {
          const should = this.shouldBeActive();
          const anyInterval = !!(
            this.updateInterval ||
            this.frequentInterval ||
            this.bootstrapTimeout
          );
          if (should && !anyInterval) {
            this.startLoop();
          } else if (!should && anyInterval) {
            this.stopLoop();
          }
        } catch {}
      }, 30000);
    }
  }

  private static shouldBeActive() {
    try {
      const settings = storageService.getRobloxSettings();
      if (process.platform !== "win32") return false;
      return !!(
        settings.antiAfkEnabled ||
        settings.renameWindowsEnabled ||
        settings.optimizeRamEnabled ||
        settings.cpuOptimization > 0 ||
        settings.enableOptimizations ||
        settings.windowLayoutEnabled
      );
    } catch (err) {
      return false;
    }
  }

  private static stopLoop() {
    this.loopGen++;
    if (this.bootstrapTimeout) {
      clearTimeout(this.bootstrapTimeout);
      this.bootstrapTimeout = null;
    }
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.frequentInterval) {
      clearTimeout(this.frequentInterval);
      this.frequentInterval = null;
    }
    this.isRunning = false;
    this.isFrequentRunning = false;
  }

  private static startLoop() {
    if (this.bootstrapTimeout) {
      clearTimeout(this.bootstrapTimeout);
      this.bootstrapTimeout = null;
    }
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.frequentInterval) {
      clearTimeout(this.frequentInterval);
      this.frequentInterval = null;
    }

    const gen = ++this.loopGen;

    const scheduleMaintenance = () => {
      if (gen !== this.loopGen) return;
      this.updateInterval = setTimeout(async () => {
        await this.runMaintenance();
        scheduleMaintenance();
      }, 15000);
    };

    const scheduleFrequentMaintenance = () => {
      if (gen !== this.loopGen) return;
      this.frequentInterval = setTimeout(async () => {
        await this.runFrequentMaintenance();
        scheduleFrequentMaintenance();
      }, 15000);
    };

    this.bootstrapTimeout = setTimeout(() => {
      this.bootstrapTimeout = null;
      if (gen !== this.loopGen) return;
      this.runMaintenance().then(() => scheduleMaintenance());
      this.runFrequentMaintenance().then(() => scheduleFrequentMaintenance());
    }, 10000);
  }

  private static cachedPids: number[] = [];
  private static lastPidFetch: number = 0;

  private static async getPidsCached(): Promise<number[]> {
    const now = Date.now();
    if (now - this.lastPidFetch > 3000) {
      this.cachedPids = await ProcessMonitor.getRobloxProcessPids();
      this.lastPidFetch = now;
    }
    return this.cachedPids;
  }

  private static async runMaintenance() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const settings = storageService.getRobloxSettings();

      if (process.platform === "win32") {
        const pids = await this.getPidsCached();

        if (pids.length > 0) {
          if (settings.antiAfkEnabled) {
            await this.runAntiAfk(pids);
          }

          if (settings.renameWindowsEnabled) {
            await this.runWindowRenamer(pids);
          }

          if (settings.windowLayoutEnabled) {
            await this.tileRobloxWindows({
              pattern: settings.windowLayoutPattern ?? "grid",
              spacing: settings.windowLayoutSpacing ?? 12,
              columns: settings.windowLayoutColumns ?? 3,
              width: settings.windowLayoutWidth ?? 0,
              height: settings.windowLayoutHeight ?? 0,
              monitors: "all",
            });
          }
        }
      }
    } catch (err) {
      console.error("[PerformanceService] Maintenance error:", err);
    } finally {
      this.isRunning = false;
    }
  }

  private static async runFrequentMaintenance() {
    if (this.isFrequentRunning) return;
    this.isFrequentRunning = true;

    try {
      const settings = storageService.getRobloxSettings();

      if (process.platform === "win32") {
        const pids = await this.getPidsCached();

        if (pids.length > 0) {
          const resourceLimitsEnabled = settings.enableOptimizations;
          const ramLimit = Math.max(
            512,
            settings.ramOptimization || settings.memoryLimit || 2048,
          );
          const cpuLimit = Math.max(20, Math.min(95, settings.cpuOptimization || 20));

          if (resourceLimitsEnabled || settings.optimizeRamEnabled) {
            await this.enforceRamLimits(pids, ramLimit);
          }

          if (resourceLimitsEnabled || settings.cpuOptimization) {
            await this.enforceCpuLimits(pids, cpuLimit);
          }
        }
      }
    } catch (err) {
      console.error("[PerformanceService] Frequent maintenance error:", err);
    } finally {
      this.isFrequentRunning = false;
    }
  }

  private static async enforceRamLimits(
    pids: number[],
    limitMb: number,
  ): Promise<void> {
    for (const pid of pids) {
      const currentRam = await ProcessMonitor.getProcessRAM(pid);
      if (currentRam === null || currentRam <= limitMb) {
        this.ramFailures.delete(pid);
        continue;
      }

      const failures = this.ramFailures.get(pid) ?? 0;
      const shouldRestart = await ProcessMonitor.checkAndLimitRAM(
        pid,
        limitMb,
        failures,
        true,
      );

      if (shouldRestart) {
        this.ramFailures.delete(pid);
        await watcherService.restartProcessByPid(
          pid,
          `RAM stayed above ${limitMb} MB after 3 cleanup attempts`,
        );
      } else {
        this.ramFailures.set(pid, failures + 1);
      }
    }
  }

  private static async enforceCpuLimits(
    pids: number[],
    limitPercent: number,
  ): Promise<void> {
    const processorCount = Math.max(1, os.cpus().length);
    const now = Date.now();

    for (const pid of pids) {
      const cpuTime = await ProcessMonitor.getProcessCpuTime(pid);
      if (cpuTime === null) {
        this.cpuSamples.delete(pid);
        this.cpuFailures.delete(pid);
        continue;
      }

      const previous = this.cpuSamples.get(pid);
      this.cpuSamples.set(pid, { time: cpuTime, at: now });
      if (!previous || now <= previous.at || cpuTime < previous.time) continue;

      const elapsedSeconds = (now - previous.at) / 1000;
      const usagePercent =
        ((cpuTime - previous.time) / elapsedSeconds / processorCount) * 100;

      if (usagePercent <= limitPercent) {
        this.cpuFailures.delete(pid);
        continue;
      }

      const failures = (this.cpuFailures.get(pid) ?? 0) + 1;
      this.cpuFailures.set(pid, failures);
      await this.runCpuOptimization([pid], limitPercent);

      if (failures >= 3) {
        this.cpuFailures.delete(pid);
        await watcherService.restartProcessByPid(
          pid,
          `CPU stayed above ${limitPercent}% after 3 optimization attempts`,
        );
      }
    }
  }

  static async tileRobloxWindows(
    options: {
      pattern?: "grid" | "rows" | "columns" | "cascade";
      monitors?: "all" | "primary" | "secondary";
      spacing?: number;
      columns?: number;
      width?: number;
      height?: number;
    } = {},
  ): Promise<{
    success: boolean;
    message: string;
    data?: { count: number; columns: number; rows: number };
  }> {
    if (process.platform !== "win32") {
      return {
        success: false,
        message: "Window tiling is only available on Windows.",
      };
    }

    const pids = await ProcessMonitor.getRobloxProcessPids();
    if (pids.length === 0) {
      return {
        success: false,
        message: "No Roblox windows found.",
      };
    }

    const pattern = options.pattern ?? "grid";
    const spacing = Math.max(
      0,
      Math.min(50, Number(options.spacing ?? 12) || 12),
    );
    const columns = Math.max(
      1,
      Math.min(12, Number(options.columns ?? 3) || 3),
    );
    const width = Math.max(0, Math.min(3840, Number(options.width ?? 0) || 0));
    const height = Math.max(
      0,
      Math.min(2160, Number(options.height ?? 0) || 0),
    );

    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetWindow(IntPtr hWnd, int uCmd);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr MonitorFromPoint(System.Drawing.Point pt, uint dwFlags);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
      public int Left;
      public int Top;
      public int Right;
      public int Bottom;
    }
  }
"@

$pids = @(${pids.join(",")})
$pattern = '${pattern}'
$spacing = ${spacing}
$columns = ${columns}
$customWidth = ${width}
$customHeight = ${height}

$windows = @()
[Win32]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  if (-not [Win32]::IsWindowVisible($hWnd)) { return $true }
  # Skip owned windows (tool/splash/dialog owned by another window). GW_OWNER = 4.
  if ([Win32]::GetWindow($hWnd, 4) -ne [IntPtr]::Zero) { return $true }

  [uint32]$processId = 0
  [Win32]::GetWindowThreadProcessId($hWnd, [ref]$processId)
  if ($pids -contains [int]$processId) {
    $sb = New-Object System.Text.StringBuilder 256
    [Win32]::GetWindowText($hWnd, $sb, 256) | Out-Null
    $title = $sb.ToString()
    
    # Only target real Roblox windows with valid titles
    if ($title -and $title.Length -gt 0) {
      [Win32+RECT]$rect = New-Object Win32+RECT
      if ([Win32]::GetWindowRect($hWnd, [ref]$rect)) {
        $width = [Math]::Max(1, $rect.Right - $rect.Left)
        $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
        if ($width -gt 0 -and $height -gt 0) {
          $windows += [pscustomobject]@{ Handle = $hWnd; PID = [int]$processId; Left = $rect.Left; Top = $rect.Top; Width = $width; Height = $height }
        }
      }
    }
  }
  return $true
}, [IntPtr]::Zero)

if (-not $windows -or $windows.Count -eq 0) {
  exit 0
}

$screens = [System.Windows.Forms.Screen]::AllScreens
if (-not $screens -or $screens.Count -eq 0) { $screens = @([System.Windows.Forms.Screen]::PrimaryScreen) }

$ordered = $windows | Sort-Object PID
$layoutColumns = $columns
if ($pattern -eq 'rows') { $layoutColumns = [Math]::Max(1, $ordered.Count) }
if ($pattern -eq 'columns') { $layoutColumns = 1 }
$rows = 1
$index = 0
foreach ($window in $ordered) {
  $screen = $screens[$index % $screens.Count]
  $workArea = $screen.WorkingArea
  $availableWidth = [Math]::Max(1, $workArea.Width)
  $availableHeight = [Math]::Max(1, $workArea.Height)
  if ($customWidth -gt 0 -and $customHeight -gt 0) {
    $w = [Math]::Min($customWidth, $availableWidth - (2 * $spacing))
    $h = [Math]::Min($customHeight, $availableHeight - (2 * $spacing))
    if ($pattern -eq 'cascade') {
      $offset = ($index * 28) % [Math]::Max(1, [Math]::Min($availableWidth, $availableHeight) - $spacing)
      $x = $workArea.Left + $spacing + $offset
      $y = $workArea.Top + $spacing + $offset
    } else {
      $row = [Math]::Floor($index / $layoutColumns) % [Math]::Max(1, [Math]::Floor($availableHeight / ($h + $spacing)))
      $column = $index % $layoutColumns
      $x = $workArea.Left + $spacing + ($column * ($w + $spacing))
      $y = $workArea.Top + $spacing + ($row * ($h + $spacing))
    }
  } else {
    $rows = [Math]::Max(1, [Math]::Ceiling($ordered.Count / [double]$screens.Count / $layoutColumns))
    $row = [Math]::Floor($index / $layoutColumns) % $rows
    $column = $index % $layoutColumns
    $w = [Math]::Max(1, ($availableWidth - ($spacing * ($layoutColumns + 1))) / $layoutColumns)
    $h = [Math]::Max(1, ($availableHeight - ($spacing * ($rows + 1))) / $rows)
    if ($pattern -eq 'cascade') {
      $offset = ($index * 28) % [Math]::Max(1, [Math]::Min($availableWidth, $availableHeight) - $spacing)
      $x = $workArea.Left + $spacing + $offset
      $y = $workArea.Top + $spacing + $offset
    } else {
      $x = $workArea.Left + $spacing + ($column * ($w + $spacing))
      $y = $workArea.Top + $spacing + ($row * ($h + $spacing))
    }
  }
  $x = [Math]::Min($x, $workArea.Right - $w)
  $y = [Math]::Min($y, $workArea.Bottom - $h)
  $w = [Math]::Max(1, [Math]::Min($w, $availableWidth - $spacing))
  $h = [Math]::Max(1, [Math]::Min($h, $availableHeight - $spacing))

  [Win32]::ShowWindow($window.Handle, 9) | Out-Null
  [Win32]::MoveWindow($window.Handle, [int]$x, [int]$y, [int]$w, [int]$h, $true) | Out-Null
  $index++
}

[pscustomobject]@{ count = $ordered.Count; columns = $columns; rows = $rows } | ConvertTo-Json -Compress
`;

    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
        { windowsHide: true },
      );

      const trimmed = stdout.trim();
      if (!trimmed) {
        return {
          success: true,
          message: "Roblox windows were updated.",
          data: {
            count: pids.length,
            columns,
            rows: Math.ceil(pids.length / columns),
          },
        };
      }

      try {
        const parsed = JSON.parse(trimmed);
        return {
          success: true,
          message: `Arranged ${parsed.count ?? pids.length} Roblox window(s).`,
          data: {
            count: Number(parsed.count ?? pids.length),
            columns: Number(parsed.columns ?? columns),
            rows: Number(parsed.rows ?? Math.ceil(pids.length / columns)),
          },
        };
      } catch {
        return {
          success: true,
          message: "Roblox windows were updated.",
          data: {
            count: pids.length,
            columns,
            rows: Math.ceil(pids.length / columns),
          },
        };
      }
    } catch (err) {
      console.error("[PerformanceService] Window tiling failed:", err);
      return {
        success: false,
        message: "The Roblox windows could not be arranged.",
      };
    }
  }

  private static async runAntiAfk(pids: number[]) {
    try {
      const psScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, int wParam, int lParam);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  }
"@

$pids = @(${pids.join(",")})
$WM_KEYDOWN = 0x0100
$WM_KEYUP = 0x0101
$VK_F15 = 0x7E

[Win32]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  [uint32]$processId = 0
  [Win32]::GetWindowThreadProcessId($hWnd, [ref]$processId)
  if ($pids -contains $processId) {
    [Win32]::PostMessage($hWnd, $WM_KEYDOWN, $VK_F15, 0)
    [Win32]::PostMessage($hWnd, $WM_KEYUP, $VK_F15, 0)
  }
  return $true
}, [IntPtr]::Zero)
`;
      await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,

        { windowsHide: true },
      );
    } catch (err) {
      console.error("[PerformanceService] Anti-AFK error:", err);
    }
  }

  private static async runRamOptimization(pids: number[], limitMb: number) {
    try {
      const limitMbInt = Math.max(1, Math.floor(limitMb));

      const psScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("psapi.dll")]
    public static extern bool EmptyWorkingSet(IntPtr hProcess);
    [DllImport("kernel32.dll")]
    public static extern bool SetProcessWorkingSetSize(IntPtr hProcess, int dwMinimumWorkingSetSize, int dwMaximumWorkingSetSize);
  }
"@
$pids = @(${pids.join(",")})
$limitBytes = [int64]${limitMbInt} * 1MB
foreach ($p in $pids) {
  try {
    $proc = Get-Process -Id $p -ErrorAction Stop
    if ($proc.WorkingSet64 -gt $limitBytes) {
      [Win32]::SetProcessWorkingSetSize($proc.Handle, -1, -1) | Out-Null
      [Win32]::EmptyWorkingSet($proc.Handle) | Out-Null
    }
  } catch {}
}
`;
      await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,

        { windowsHide: true },
      );
    } catch (err) {
      console.error("[PerformanceService] RAM Optimization error:", err);
    }
  }

  private static async runCpuOptimization(
    pids: number[],
    targetPercent: number,
  ) {
    try {
      const targetPercentInt = Math.max(
        20,
        Math.min(95, Math.floor(targetPercent)),
      );
      const psScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("kernel32.dll")]
    public static extern bool SetProcessAffinityMask(IntPtr hProcess, UIntPtr dwProcessAffinityMask);
    [DllImport("kernel32.dll")]
    public static extern bool GetProcessAffinityMask(IntPtr hProcess, out UIntPtr lpProcessAffinityMask, out UIntPtr lpSystemAffinityMask);
    [DllImport("kernel32.dll")]
    public static extern bool SetPriorityClass(IntPtr hProcess, uint dwPriorityClass);
  }
"@
$pids = @(${pids.join(",")})
$BELOW_NORMAL_PRIORITY_CLASS = 0x00004000
$targetPercent = ${targetPercentInt}

foreach ($p in $pids) {
  try {
    $proc = Get-Process -Id $p -ErrorAction Stop
    [Win32]::SetPriorityClass($proc.Handle, $BELOW_NORMAL_PRIORITY_CLASS) | Out-Null
    
    [UIntPtr]$procMask = [UIntPtr]::Zero
    [UIntPtr]$sysMask = [UIntPtr]::Zero
    if ([Win32]::GetProcessAffinityMask($proc.Handle, [ref]$procMask, [ref]$sysMask)) {
      # Calculate logical cores. Leave at least 2 cores for system if possible (sentra logic).
      $sysMaskVal = $sysMask.ToUInt64()
      $logicalCores = 0
      for ($i = 0; $i -lt 64; $i++) {
        if (($sysMaskVal -band ([uint64]1 -shl $i)) -ne 0) {
          $logicalCores++
        }
      }
      
      $useCores = [Math]::Max(1, [Math]::Ceiling($logicalCores * ($targetPercent / 100.0)))
      
      if ($useCores -lt $logicalCores) {
        $newMask = 0
        $selected = 0
        for ($i = 0; $i -lt 64 -and $selected -lt $useCores; $i++) {
          if (($procMask.ToUInt64() -band ([uint64]1 -shl $i)) -ne 0) {
            $newMask = $newMask -bor ([uint64]1 -shl $i)
            $selected++
          }
        }
        [Win32]::SetProcessAffinityMask($proc.Handle, [UIntPtr]$newMask) | Out-Null
      }
    }
  } catch {}
}
`;
      await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,

        { windowsHide: true },
      );
    } catch (err) {
      console.error("[PerformanceService] CPU Optimization error:", err);
    }
  }

  private static async runWindowRenamer(pids: number[]) {
    try {
      if (pids.length === 0) return;

      const psScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr hWnd, int uCmd);
  }
"@

$pids = @(${pids.join(",")})
$browserTrackerMap = @{}

foreach ($p in $pids) {
  try {
    $wmi = Get-CimInstance Win32_Process -Filter "ProcessId = $p" -ErrorAction SilentlyContinue
    if ($wmi) {
      $cmd = $wmi.CommandLine
      # More robust pattern: browsertrackerid followed by non-digits, then capture digits
      if ($cmd -match 'browsertrackerid[^0-9]{0,32}([0-9]+)') {
        $browserTrackerMap["$p"] = $matches[1]
      }
    }
  } catch {}
}

@{ map = $browserTrackerMap; count = $browserTrackerMap.Count } | ConvertTo-Json -Compress
`;

      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
        { windowsHide: true },
      );

      let trackerMap: Record<string, string> = {};
      try {
        const parsed = JSON.parse(stdout.trim());
        trackerMap = parsed.map || {};
      } catch {}

      const pidToUsername: Record<string, string> = {};
      const usedTrackerIds = new Set<string>();

      for (const [pidStr, trackerId] of Object.entries(trackerMap)) {
        const username = RobloxLauncherService.activeLaunches.get(
          trackerId as string,
        );
        if (username) {
          pidToUsername[pidStr] = username;
          usedTrackerIds.add(trackerId as string);
        }
      }

      const unmappedPids = pids.filter(
        (p) => !Object.prototype.hasOwnProperty.call(pidToUsername, String(p)),
      );
      if (unmappedPids.length > 0) {
        const recentLaunches = Array.from(
          RobloxLauncherService.activeLaunches.entries(),
        )
          .filter(([trackerId]) => !usedTrackerIds.has(trackerId))
          .map(([_, username]) => username)
          .reverse()
          .slice(0, unmappedPids.length);

        for (let i = 0; i < unmappedPids.length; i++) {
          if (recentLaunches[i]) {
            pidToUsername[String(unmappedPids[i])] = recentLaunches[i];
          }
        }
      }

      if (Object.keys(pidToUsername).length === 0) return;

      let renameScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool SetWindowText(IntPtr hWnd, string lpString);
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr hWnd, int uCmd);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  }
"@

$renameMap = @{
`;

      let hasRenames = false;
      for (const [pidStr, username] of Object.entries(pidToUsername)) {
        const escapedUsername = (username as string).replace(/'/g, "''");
        renameScript += `  "${pidStr}" = '${escapedUsername}'\n`;
        hasRenames = true;
      }

      renameScript += `}

[Win32]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  [uint32]$processId = 0
  [Win32]::GetWindowThreadProcessId($hWnd, [ref]$processId)
  $pidStr = $processId.ToString()
  
  if ($renameMap.ContainsKey($pidStr)) {
    try {
      if (-not [Win32]::IsWindowVisible($hWnd)) { return $true }
      if ([Win32]::GetWindow($hWnd, 4) -ne [IntPtr]::Zero) { return $true }
      # Get window title to verify it's a Roblox window
      $sb = New-Object System.Text.StringBuilder 256
      $len = [Win32]::GetWindowText($hWnd, $sb, 256)
      $currentTitle = $sb.ToString()
      
      # Only rename if it looks like a Roblox window (not empty, or is literally "Roblox")
      if ($currentTitle -and $currentTitle.Length -gt 0) {
        $newTitle = $renameMap[$pidStr]
        [Win32]::SetWindowText($hWnd, $newTitle) | Out-Null
      }
    } catch {}
  }
  return $true
}, [IntPtr]::Zero)
`;

      if (hasRenames) {
        await execAsync(
          `powershell -NoProfile -NonInteractive -Command "${renameScript.replace(/"/g, '\\"')}"`,
          { windowsHide: true },
        );
      }
    } catch (err) {
      console.error("[PerformanceService] Window Renamer error:", err);
    }
  }
}
