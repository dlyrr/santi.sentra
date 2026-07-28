/**
 * Theme Settings Panel Component
 * Integrates theme selection with the matching circles visual
 */

import React, { useCallback } from 'react'
import { Palette, Moon, Sun } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/UI/buttons/Button'
import { useSettingsManager } from '@renderer/hooks/queries'
import { ThemeCirclesGrid, DEFAULT_THEME_CIRCLES } from '@renderer/components/UI/theme/ThemeCircles'
import { applyTint } from '@renderer/theme/theme'
import { TintPreference } from '@renderer/types'

/**
 * Theme Settings Component
 */
export const ThemeSettings: React.FC<{ className?: string }> = ({ className }) => {
  const { settings, updateSettings } = useSettingsManager()
  
  const theme = settings?.theme ?? 'dark'
  const tint = settings?.tint ?? 'neutral'

  const handleThemeChange = useCallback(
    (newTheme: 'dark' | 'light') => {
      updateSettings({ theme: newTheme })
    },
    [updateSettings]
  )

  const handleTintChange = useCallback(
    (tintId: string) => {
      const newTint = tintId as TintPreference
      updateSettings({ tint: newTint })
      applyTint(theme === 'system' ? 'dark' : theme, newTint)
    },
    [theme, updateSettings]
  )

  return (
    <div className={cn('flex flex-col gap-6 p-4', className)}>
      {/* Color Tint Section with Theme Circles */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-[var(--color-text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
            Color Theme
          </h3>
        </div>

        <div className="bg-[var(--color-surface-hover)]/30 rounded-lg p-4 border border-[var(--color-border-strong)]/50">
          <ThemeCirclesGrid
            options={DEFAULT_THEME_CIRCLES}
            selected={tint}
            onSelect={handleTintChange}
            size="md"
            gap="normal"
            animated
            className="w-full"
          />
        </div>

        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Select a color theme to customize your experience
        </p>
      </div>
    </div>
  )
}

/**
 * Minimal Theme Selector (for quick access)
 */
export const QuickThemeSelector: React.FC<{
  className?: string
  showLabels?: boolean
}> = ({ className, showLabels = false }) => {
  const { settings, updateSettings } = useSettingsManager()
  
  const theme = settings?.theme ?? 'dark'
  const tint = settings?.tint ?? 'neutral'

  const handleTintChange = useCallback(
    (tintId: string) => {
      const newTint = tintId as TintPreference
      updateSettings({ tint: newTint })
      applyTint(theme === 'system' ? 'dark' : theme, newTint)
    },
    [theme, updateSettings]
  )

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 p-2 bg-[var(--color-surface-hover)]/50 rounded-lg border border-[var(--color-border-strong)]/50',
        className
      )}
    >
      {DEFAULT_THEME_CIRCLES.map((option) => (
        <button
          key={option.id}
          onClick={() => handleTintChange(option.id)}
          className={cn(
            'relative flex flex-col items-center gap-1 p-1 rounded transition-all duration-200',
            tint === option.id
              ? 'bg-[var(--color-surface-hover)]/50 scale-105'
              : 'opacity-60 hover:opacity-100'
          )}
          title={option.label}
        >
          <div className="flex gap-0.5">
            {/* Two mini circles */}
            <div
              className="w-3 h-3 rounded-full shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${option.color} 0%, ${option.gradientColor} 100%)`
              }}
            />
            <div
              className="w-3 h-3 rounded-full shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${option.color} 0%, ${option.gradientColor} 100%)`
              }}
            />
          </div>

          {showLabels && (
            <span className="text-[10px] text-[var(--color-text-secondary)] uppercase font-medium">
              {option.label.substring(0, 1)}
            </span>
          )}

          {tint === option.id && (
            <div className="absolute inset-0 rounded ring-2 ring-white/30" />
          )}
        </button>
      ))}
    </div>
  )
}
