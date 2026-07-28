import React from 'react'
import CustomCheckbox from '../../../components/UI/buttons/CustomCheckbox'

export const Section: React.FC<{
  title: string
  description?: string
  children: React.ReactNode
}> = ({ title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
)

export const SettingsCard: React.FC<{
  title: string
  description?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}> = ({ title, description, icon, actions, children }) => (
  <div className="p-4 bg-[var(--color-surface-strong)] rounded-[var(--radius-xl)] border border-[var(--color-border)]/50 hover:border-[var(--color-border-strong)]/50 transition-colors space-y-3 [--card-radius:var(--radius-xl)] [--card-gap:0.5rem] [--control-radius:calc(var(--card-radius)_-_var(--card-gap))]">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
            {icon}
          </div>
        )}
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">{title}</h4>
          {description && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
)

export const ToggleRow: React.FC<{
  title: string
  description: React.ReactNode
  checked: boolean
  onChange: () => void
  disabled?: boolean
  icon?: React.ReactNode
  hint?: React.ReactNode
}> = ({ title, description, checked, onChange, disabled, icon, hint }) => (
  <div className="flex items-start gap-3 p-4 bg-[var(--color-surface-muted)] rounded-[var(--control-radius)] border border-[var(--color-border)]/50 hover:border-[var(--color-border-strong)]/50 transition-colors">
    <div className="mt-1">
      <CustomCheckbox checked={checked} onChange={onChange} disabled={disabled} />
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{description}</p>
      {hint}
    </div>
  </div>
)
