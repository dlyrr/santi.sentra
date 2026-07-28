import { useState, useEffect, useCallback } from 'react'

export interface RobloxSettings {
  defaultPhysicsEngine: 'Terrain' | 'Legacy'
  enableOptimizations: boolean
  memoryLimit: number
  useDirectX12: boolean
  lowEndGraphics: boolean
  disableDualChannelAudio: boolean
  antiAfkEnabled: boolean
  renameWindowsEnabled: boolean
  framerateCapEnabled: boolean
  framerateCapValue: number
  optimizeRamEnabled: boolean
  ramOptimizeLimit: number
  headlessModeEnabled: boolean
  timeoutRelaunchEnabled: boolean
  timeoutRelaunchSeconds: number
}

const DEFAULT_SETTINGS: RobloxSettings = {
  defaultPhysicsEngine: 'Terrain',
  enableOptimizations: false,
  memoryLimit: 0,
  useDirectX12: false,
  lowEndGraphics: false,
  disableDualChannelAudio: false,
  antiAfkEnabled: false,
  renameWindowsEnabled: false,
  framerateCapEnabled: false,
  framerateCapValue: 60,
  optimizeRamEnabled: false,
  ramOptimizeLimit: 500,
  headlessModeEnabled: false,
  timeoutRelaunchEnabled: false,
  timeoutRelaunchSeconds: 3600
}

/**
 * useRobloxSettings - Custom hook for managing Roblox settings state and API interactions
 */
export function useRobloxSettings() {
  const [settings, setSettings] = useState<RobloxSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const loaded = await window.api.getRobloxSettings()
      setSettings({
        defaultPhysicsEngine: loaded.defaultPhysicsEngine,
        enableOptimizations: loaded.enableOptimizations,
        memoryLimit: loaded.memoryLimit,
        useDirectX12: loaded.useDirectX12,
        lowEndGraphics: loaded.lowEndGraphics,
        disableDualChannelAudio: loaded.disableDualChannelAudio,
        antiAfkEnabled: loaded.antiAfkEnabled,
        renameWindowsEnabled: loaded.renameWindowsEnabled,
        framerateCapEnabled: loaded.framerateCapEnabled,
        framerateCapValue: loaded.framerateCapValue,
        optimizeRamEnabled: loaded.optimizeRamEnabled,
        ramOptimizeLimit: loaded.ramOptimizeLimit,
        headlessModeEnabled: loaded.headlessModeEnabled,
        timeoutRelaunchEnabled: loaded.timeoutRelaunchEnabled,
        timeoutRelaunchSeconds: loaded.timeoutRelaunchSeconds
      })
    } catch (err) {
      console.error('[useRobloxSettings] Failed to load settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateSettings = useCallback(async (newSettings: Partial<RobloxSettings>) => {
    setIsLoading(true)
    setError(null)
    try {
      await window.api.setRobloxSettings(newSettings)
      setSettings((prev) => ({ ...prev, ...newSettings }))
    } catch (err) {
      console.error('[useRobloxSettings] Failed to update settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save settings')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    resetSettings: loadSettings
  }
}
