import { useState, useCallback, useEffect } from 'react'
import { Save, Monitor, Cpu, Zap, Volume2, RefreshCw, Tag, Database, Layers, Clock } from 'lucide-react'
import type { RobloxSettings } from '../hooks/useRobloxSettings'
import CustomCheckbox from '../../../components/UI/buttons/CustomCheckbox'

interface RobloxAdvancedSettingsProps {
  settings: RobloxSettings
  onSettingsChange: (settings: Partial<RobloxSettings>) => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

const isWindows = window.platform?.isWindows !== false

function BentoCard({
  icon,
  label,
  desc,
  control,
  extraInput,
  disabled,
  colSpan = 1
}: {
  icon: React.ReactNode
  label: string
  desc: string
  control?: React.ReactNode
  extraInput?: React.ReactNode
  disabled?: boolean
  colSpan?: 1 | 2
}) {
  return (
    <div className={`relative overflow-hidden group rounded-[var(--control-radius)] border transition-all duration-300 ${disabled ? 'opacity-40 border-[var(--color-border)] bg-[var(--color-surface-hover)]' : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--accent-color)]/50 hover:shadow-[0_0_15px_rgba(var(--accent-color-rgb),0.05)]'} ${colSpan === 2 ? 'col-span-2' : 'col-span-1'} flex flex-col p-2.5`}>
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex items-start justify-between mb-2 z-10 relative">
        <div className={`w-7 h-7 rounded-[calc(var(--control-radius)-4px)] flex items-center justify-center transition-colors ${disabled ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] border border-[var(--color-border)]'}`}>
          {icon}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      
      <div className="mt-auto z-10 relative">
        <h4 className="text-xs font-bold text-[var(--color-text-primary)] leading-tight mb-0.5">{label}</h4>
        <p className="text-[9px] text-[var(--color-text-muted)] leading-snug line-clamp-2">{desc}</p>
      </div>

      {extraInput && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border)] z-10 relative">
          {extraInput}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 flex items-center gap-3 mt-2 mb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
        {children}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  )
}

export default function RobloxAdvancedSettings({
  settings,
  onSettingsChange,
  onClose,
  isLoading = false
}: RobloxAdvancedSettingsProps) {
  const [local, setLocal] = useState(settings)
  const [isSaving, setIsSaving] = useState(false)

  const set = useCallback(<K extends keyof RobloxSettings>(key: K, value: RobloxSettings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    setLocal(settings)
  }, [settings])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const changes: Partial<RobloxSettings> = {}
      ;(Object.keys(local) as (keyof RobloxSettings)[]).forEach((k) => {
        if ((local as any)[k] !== (settings as any)[k]) {
          ;(changes as any)[k] = (local as any)[k]
        }
      })
      if (Object.keys(changes).length > 0) {
        await onSettingsChange(changes)
      }
      onClose()
    } catch (e) {
      console.error('[RobloxAdvancedSettings] save error:', e)
    } finally {
      setIsSaving(false)
    }
  }, [local, settings, onSettingsChange, onClose])

  const busy = isSaving || isLoading
  const ic = 14

  return (
    <div className="flex flex-col h-full -mx-1">
      <div className="flex-1 overflow-y-auto px-1 pb-4 styled-scrollbar min-h-0">
        <div className="grid grid-cols-2 gap-2.5">
          
          <SectionLabel>Performance & System</SectionLabel>

          <BentoCard 
            icon={<Zap size={ic} />} 
            label="System Optimizations" 
            desc="Enable Windows CPU priority & affinity optimizations." 
            disabled={busy || !isWindows}
            control={<CustomCheckbox checked={local.enableOptimizations} onChange={() => set('enableOptimizations', !local.enableOptimizations)} disabled={busy || !isWindows} />}
          />

          <BentoCard 
            icon={<Database size={ic} />} 
            label="RAM Limiter" 
            desc="Trims background memory." 
            disabled={busy || !isWindows}
            control={<CustomCheckbox checked={local.memoryLimit > 0 || !!local.optimizeRamEnabled} onChange={() => {
              const isNowEnabled = !(local.memoryLimit > 0 || !!local.optimizeRamEnabled)
              set('optimizeRamEnabled', isNowEnabled)
              set('memoryLimit', isNowEnabled ? (local.ramOptimizeLimit || 1024) : 0)
            }} disabled={busy || !isWindows} />}
            extraInput={(local.memoryLimit > 0 || local.optimizeRamEnabled) && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">Limit (MB)</span>
                <input
                  type="number" min="100" max="16384" step="256"
                  value={local.memoryLimit > 0 ? local.memoryLimit : (local.ramOptimizeLimit || 1024)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1024
                    set('memoryLimit', val)
                    set('ramOptimizeLimit', val)
                  }}
                  disabled={busy || !isWindows}
                  className="w-16 text-xs px-2 py-1 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] text-center transition-colors"
                />
              </div>
            )}
          />

          <BentoCard 
            icon={<Monitor size={ic} />} 
            label="DirectX 12" 
            desc="Use modern DX12 rendering pipeline." 
            disabled={busy || !isWindows}
            control={<CustomCheckbox checked={local.useDirectX12} onChange={() => set('useDirectX12', !local.useDirectX12)} disabled={busy || !isWindows} />}
          />

          <BentoCard 
            icon={<Layers size={ic} />} 
            label="Low-End Mode" 
            desc="Drastically reduce quality for weak hardware." 
            disabled={busy}
            control={<CustomCheckbox checked={local.lowEndGraphics} onChange={() => set('lowEndGraphics', !local.lowEndGraphics)} disabled={busy} />}
          />

          <SectionLabel>Watcher Automation</SectionLabel>

          <BentoCard 
            icon={<RefreshCw size={ic} />} 
            label="Anti-AFK" 
            desc="Simulates background keypresses to prevent kick." 
            disabled={busy || !isWindows}
            control={<CustomCheckbox checked={!!local.antiAfkEnabled} onChange={() => set('antiAfkEnabled', !local.antiAfkEnabled)} disabled={busy || !isWindows} />}
          />

          <BentoCard 
            icon={<Clock size={ic} />} 
            label="Timeout Relaunch" 
            desc="Auto-restart sessions exceeding duration." 
            disabled={busy}
            control={<CustomCheckbox checked={!!local.timeoutRelaunchEnabled} onChange={() => set('timeoutRelaunchEnabled', !local.timeoutRelaunchEnabled)} disabled={busy} />}
            extraInput={local.timeoutRelaunchEnabled && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">After (Secs)</span>
                <input
                  type="number" min="60" max="86400" step="60"
                  value={local.timeoutRelaunchSeconds || 3600}
                  onChange={(e) => set('timeoutRelaunchSeconds', parseInt(e.target.value) || 3600)}
                  disabled={busy}
                  className="w-16 text-xs px-2 py-1 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] text-center transition-colors"
                />
              </div>
            )}
          />

          <SectionLabel>Client Tweaks</SectionLabel>

          <BentoCard 
            icon={<RefreshCw size={ic} />} 
            label="FPS Cap" 
            desc="Overrides internal physics cap." 
            disabled={busy}
            control={<CustomCheckbox checked={!!local.framerateCapEnabled} onChange={() => set('framerateCapEnabled', !local.framerateCapEnabled)} disabled={busy} />}
            extraInput={local.framerateCapEnabled && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">Target FPS</span>
                <input
                  type="number" min="1" max="360"
                  value={local.framerateCapValue || 60}
                  onChange={(e) => set('framerateCapValue', parseInt(e.target.value) || 60)}
                  disabled={busy}
                  className="w-16 text-xs px-2 py-1 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] text-center transition-colors"
                />
              </div>
            )}
          />

          <BentoCard 
            icon={<Cpu size={ic} />} 
            label="Physics" 
            desc="Roblox engine simulation preference." 
            disabled={busy}
            control={
              <select
                value={local.defaultPhysicsEngine}
                onChange={(e) => set('defaultPhysicsEngine', e.target.value as 'Terrain' | 'Legacy')}
                disabled={busy}
                className="text-[10px] font-medium px-2 py-1 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] cursor-pointer disabled:opacity-50 transition-colors"
              >
                <option value="Terrain">Terrain</option>
                <option value="Legacy">Legacy</option>
              </select>
            }
          />

          <BentoCard 
            icon={<Monitor size={ic} />} 
            label="Headless Mode" 
            desc="Completely hides game windows." 
            disabled={busy || !isWindows}
            control={<CustomCheckbox checked={!!local.headlessModeEnabled} onChange={() => set('headlessModeEnabled', !local.headlessModeEnabled)} disabled={busy || !isWindows} />}
          />

          <BentoCard 
            icon={<Tag size={ic} />} 
            label="Rename Windows" 
            desc="Title matches username." 
            disabled={busy || !isWindows}
            control={<CustomCheckbox checked={!!local.renameWindowsEnabled} onChange={() => set('renameWindowsEnabled', !local.renameWindowsEnabled)} disabled={busy || !isWindows} />}
          />

          <BentoCard 
            icon={<Volume2 size={ic} />} 
            label="Mono Audio" 
            desc="Disable dual-channel audio." 
            disabled={busy}
            control={<CustomCheckbox checked={local.disableDualChannelAudio} onChange={() => set('disableDualChannelAudio', !local.disableDualChannelAudio)} disabled={busy} />}
          />

        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-[var(--color-border)] shrink-0">
        <button
          onClick={() => {
            setLocal(settings)
            onClose()
          }}
          disabled={busy}
          className="px-4 py-2 text-xs font-semibold rounded-lg text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-6 py-2 text-xs font-bold rounded-lg text-black bg-[var(--accent-color)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(var(--accent-color-rgb),0.3)]"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
