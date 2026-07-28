import { RobloxLauncherService } from '../install/LauncherService'

import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { ProcessMonitor } from '../watcher/ProcessMonitor'
import { storageService } from '../system/StorageService'

const execAsync = promisify(exec)

export class PerformanceService {
  private static updateInterval: NodeJS.Timeout | null = null
  private static fastInterval: NodeJS.Timeout | null = null
  private static isRunning = false
  private static isFastRunning = false
  private static wasHeadless = false

  static init() {
    this.startLoop()
    
    // Also re-apply framerate cap on startup if enabled
    const settings = storageService.getRobloxSettings()
    if (settings.framerateCapEnabled && settings.framerateCapValue) {
      this.applyFramerateCap(settings.framerateCapValue)
    }
  }

  private static startLoop() {
    if (this.updateInterval) {
      clearTimeout(this.updateInterval)
    }
    if (this.fastInterval) {
      clearTimeout(this.fastInterval)
    }

    // Use recursive setTimeout to prevent overlapping async calls.
    // setInterval would fire a new tick even if the previous async call is still running.
    const scheduleMaintenance = () => {
      this.updateInterval = setTimeout(async () => {
        await this.runMaintenance()
        scheduleMaintenance()
      }, 120000)
    }

    const scheduleFastMaintenance = () => {
      this.fastInterval = setTimeout(async () => {
        await this.runFastMaintenance()
        scheduleFastMaintenance()
      }, 5000)
    }

    // Initial run after 10s
    setTimeout(() => {
      this.runMaintenance().then(() => scheduleMaintenance())
      this.runFastMaintenance().then(() => scheduleFastMaintenance())
    }, 10000)
  }

  private static async runMaintenance() {
    if (this.isRunning) return
    this.isRunning = true

    try {
      const settings = storageService.getRobloxSettings()
      
      // Features only apply on Windows for now
      if (process.platform === 'win32') {
        const pids = await ProcessMonitor.getRobloxProcessPids()
        
        if (pids.length > 0) {
          // Anti-AFK
          if (settings.antiAfkEnabled) {
            await this.runAntiAfk(pids)
          }

          // RAM Optimization
          if (settings.optimizeRamEnabled) {
            await this.runRamOptimization(pids, settings.ramOptimizeLimit || 500)
          }

          // CPU Optimization (logic bla)
          if (settings.enableOptimizations) {
            await this.runCpuOptimization(pids)
          }

          // Rename Windows
          if (settings.renameWindowsEnabled) {
            await this.runWindowRenamer(pids)
          }
        }
      }
    } catch (err) {
      console.error('[PerformanceService] Maintenance error:', err)
    } finally {
      this.isRunning = false
    }
  }

  private static async runFastMaintenance() {
    if (this.isFastRunning) return
    this.isFastRunning = true

    try {
      const settings = storageService.getRobloxSettings()
      
      if (process.platform === 'win32') {
        const headlessEnabled = !!settings.headlessModeEnabled
        
        // Only run if we need to hide them, OR if we just turned it off and need to restore them
        if (headlessEnabled || this.wasHeadless) {
          const pids = await ProcessMonitor.getRobloxProcessPids()
          if (pids.length > 0) {
            await this.runHeadlessMode(pids, headlessEnabled)
          }
        }
        
        this.wasHeadless = headlessEnabled
      }
    } catch (err) {
      console.error('[PerformanceService] Fast maintenance error:', err)
    } finally {
      this.isFastRunning = false
    }
  }

  private static async runHeadlessMode(pids: number[], hide: boolean) {
    try {
      // SW_HIDE = 0, SW_SHOW = 5, SC_RESTORE = 9
      const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
if (-not ([System.Management.Automation.PSTypeName]'HeadlessWin32').Type) {
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class HeadlessWin32 {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  }
"@
}
$pids = @(${pids.join(',')})
$hide = ${hide ? '$true' : '$false'}
$SW_HIDE = 0
$SW_SHOW = 5
$SW_RESTORE = 9

[HeadlessWin32]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  [uint]$processId = 0
  [HeadlessWin32]::GetWindowThreadProcessId($hWnd, [ref]$processId)
  if ($pids -contains $processId) {
    $len = [HeadlessWin32]::GetWindowTextLength($hWnd)
    if ($len -gt 0) {
      if ($hide) {
        [HeadlessWin32]::ShowWindow($hWnd, $SW_HIDE) | Out-Null
      } else {
        [HeadlessWin32]::ShowWindow($hWnd, $SW_RESTORE) | Out-Null
      }
    }
  }
  return $true
}, [IntPtr]::Zero)
`
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`)
    } catch (err) {
      console.error('[PerformanceService] Headless Mode error:', err)
    }
  }

  private static async runAntiAfk(pids: number[]) {
    try {
      console.log(`[PerformanceService] Running Anti-AFK for ${pids.length} processes...`)
      // Use PowerShell to send a harmless key (F15) to the windows of these processes
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

$pids = @(${pids.join(',')})
$WM_KEYDOWN = 0x0100
$WM_KEYUP = 0x0101
$VK_F15 = 0x7E

[Win32]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  [uint]$processId = 0
  [Win32]::GetWindowThreadProcessId($hWnd, [ref]$processId)
  if ($pids -contains $processId) {
    [Win32]::PostMessage($hWnd, $WM_KEYDOWN, $VK_F15, 0)
    [Win32]::PostMessage($hWnd, $WM_KEYUP, $VK_F15, 0)
  }
  return $true
}, [IntPtr]::Zero)
`
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`)
    } catch (err) {
      console.error('[PerformanceService] Anti-AFK error:', err)
    }
  }

  private static async runRamOptimization(pids: number[], limitMb: number) {
    try {
      console.log(`[PerformanceService] Optimizing RAM for ${pids.length} processes...`)
      
      // other project inspired deep RAM optimization using SetProcessWorkingSetSize and EmptyWorkingSet
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
$pids = @(${pids.join(',')})
foreach ($p in $pids) {
  try {
    $proc = Get-Process -Id $p -ErrorAction Stop
    [Win32]::SetProcessWorkingSetSize($proc.Handle, -1, -1) | Out-Null
    [Win32]::EmptyWorkingSet($proc.Handle) | Out-Null
  } catch {}
}
`
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`)
    } catch (err) {
      console.error('[PerformanceService] RAM Optimization error:', err)
    }
  }

  private static async runCpuOptimization(pids: number[]) {
    try {
      console.log(`[PerformanceService] Optimizing CPU Affinity for ${pids.length} processes...`)
      
      // other project inspired CPU Affinity & QoS adjustment.
      // - Disables CPU Boost on process by setting Power Throttling / Priority
      // - Sets Process Affinity to leave system headroom
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
$pids = @(${pids.join(',')})
$IDLE_PRIORITY_CLASS = 0x00000040

foreach ($p in $pids) {
  try {
    $proc = Get-Process -Id $p -ErrorAction Stop
    [Win32]::SetPriorityClass($proc.Handle, $IDLE_PRIORITY_CLASS) | Out-Null
    
    [UIntPtr]$procMask = [UIntPtr]::Zero
    [UIntPtr]$sysMask = [UIntPtr]::Zero
    if ([Win32]::GetProcessAffinityMask($proc.Handle, [ref]$procMask, [ref]$sysMask)) {
      # Calculate logical cores. Leave at least 2 cores for system if possible (sentra logic).
      $sysMaskVal = $sysMask.ToUInt64()
      $logicalCores = 0
      for ($i = 0; $i -lt 64; $i++) {
        if (($sysMaskVal -band (1 -shl $i)) -ne 0) {
          $logicalCores++
        }
      }
      
      $useCores = $logicalCores
      if ($logicalCores -gt 4) {
        $useCores = $logicalCores - 2
      } elseif ($logicalCores -gt 2) {
        $useCores = $logicalCores - 1
      }
      
      if ($useCores -lt $logicalCores) {
        $newMask = 0
        for ($i = 0; $i -lt $useCores; $i++) {
          $newMask = $newMask -bor (1 -shl $i)
        }
        [Win32]::SetProcessAffinityMask($proc.Handle, [UIntPtr]$newMask) | Out-Null
      }
    }
  } catch {}
}
`
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`)
    } catch (err) {
      console.error('[PerformanceService] CPU Optimization error:', err)
    }
  }

  private static async runWindowRenamer(pids: number[]) {
    try {
      console.log(`[PerformanceService] Renaming windows for ${pids.length} processes...`)
      
      const psScript = `
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
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  }
"@

$pids = @(${pids.join(',')})
$browserTrackerMap = @{}

# Try to extract browserTrackerId from command line
foreach ($p in $pids) {
  try {
    $wmi = Get-CimInstance Win32_Process -Filter "ProcessId = $p"
    if ($wmi) {
      $cmd = $wmi.CommandLine
      if ($cmd -match 'browsertrackerid:(\\d+)') {
        $browserTrackerMap["$p"] = $matches[1]
      }
    }
  } catch {}
}

$browserTrackerMap | ConvertTo-Json -Compress
`
      const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`)
      
      try {
        const trackerMap = JSON.parse(stdout.trim())
        if (Object.keys(trackerMap).length === 0) return

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
    public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  }
"@

$renameMap = @{
`
        let hasRenames = false
        for (const [pidStr, trackerId] of Object.entries(trackerMap)) {
          const username = RobloxLauncherService.activeLaunches.get(trackerId as string)
          if (username) {
            renameScript += `  "${pidStr}" = "${username}"\n`
            hasRenames = true
          }
        }
        
        renameScript += `}

[Win32]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  [uint]$processId = 0
  [Win32]::GetWindowThreadProcessId($hWnd, [ref]$processId)
  $pidStr = $processId.ToString()
  
  if ($renameMap.ContainsKey($pidStr)) {
    $len = [Win32]::GetWindowTextLength($hWnd)
    if ($len -gt 0) {
        $sb = New-Object System.Text.StringBuilder ($len + 1)
        [Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
        $currentTitle = $sb.ToString()
        if ($currentTitle -match 'Roblox') {
           [Win32]::SetWindowText($hWnd, $renameMap[$pidStr])
        }
    }
  }
  return $true
}, [IntPtr]::Zero)
`
        if (hasRenames) {
          await execAsync(`powershell -NoProfile -NonInteractive -Command "${renameScript.replace(/"/g, '\\"')}"`)
        }
      } catch (err) {}
      
    } catch (err) {
      console.error('[PerformanceService] Window Renamer error:', err)
    }
  }

  public static applyFramerateCap(fps: number) {
    try {
      const localAppData = process.env.LOCALAPPDATA
      if (!localAppData) return
      
      const settingsPath = path.join(localAppData, 'Roblox', 'GlobalBasicSettings_13.xml')
      if (!fs.existsSync(settingsPath)) {
        console.warn('[PerformanceService] GlobalBasicSettings_13.xml not found.')
        return
      }

      let content = fs.readFileSync(settingsPath, 'utf8')
      const regex = /(<int name="FramerateCap">)-?\d+(<\/int>)/
      
      if (regex.test(content)) {
        content = content.replace(regex, `$1${fps}$2`)
        fs.writeFileSync(settingsPath, content, 'utf8')
        console.log(`[PerformanceService] Applied Framerate Cap: ${fps}`)
      }
    } catch (err) {
      console.error('[PerformanceService] Error applying framerate cap:', err)
    }
  }
}
