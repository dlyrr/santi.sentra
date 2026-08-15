import React from 'react'
import { UserPlus, MousePointerClick } from 'lucide-react'
import { Button } from '@renderer/components/UI/buttons/Button'

interface AccountsEmptyStateProps {
  onAddAccount: () => void
}

export function AccountsEmptyState({ onAddAccount }: AccountsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center max-w-md w-full animate-in zoom-in-95 fade-in duration-500 mx-auto mt-20">
      <div className="relative group cursor-pointer w-full" onClick={onAddAccount}>
        {/* Glowing background */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color-ring)] rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
        
        <div className="relative flex flex-col items-center gap-6 p-12 bg-[var(--color-surface-strong)]/80 backdrop-blur-xl border-2 border-dashed border-white/10 group-hover:border-[var(--accent-color)]/50 rounded-3xl transition-all duration-300 hover:shadow-[0_0_40px_var(--accent-color-faint)]">
          <div className="p-4 bg-[var(--accent-color-faint)] rounded-2xl text-[var(--accent-color)] group-hover:scale-110 transition-transform duration-300 shadow-inner">
            <MousePointerClick size={40} strokeWidth={1.5} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">Drop a Cookie Here</h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-[250px] mx-auto leading-relaxed">
              Paste your Roblox `.ROBLOSECURITY` cookie anywhere, or click here to sign in via browser.
            </p>
          </div>
          <Button variant="default" size="lg" className="w-full font-bold shadow-[0_0_20px_var(--accent-color-faint)] mt-2">
            <UserPlus size={18} className="mr-2" /> Add First Account
          </Button>
        </div>
      </div>
    </div>
  )
}
