import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Info, Shield, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react'
import { UpdaterCard } from '../../updater'
import PrivacyPolicyModal from '../../../components/Modals/PrivacyPolicyModal'

export const AboutSettingsTab: React.FC = () => {
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false)

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout? This will clear all local configuration data.')) return
    try {
      const res = await (window.api as any).logout()
      if (res && res.success) {
        try { localStorage.removeItem('onboarding-storage-v3'); localStorage.removeItem('onboarding-storage') } catch {}
        window.location.reload()
      } else {
        alert('Logout failed: ' + (res?.message || 'Unknown error'))
      }
    } catch (err) {
      alert('Logout error: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="pb-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">About</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5 leading-relaxed">Application information, legal documents, and session management.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">

          {/* Application */}
          <div className="col-span-2 flex items-center gap-3 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Application</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* Updates card — full width */}
          <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center gap-3 mb-4 z-10 relative">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                <RefreshCw size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Updates</h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Check for and install the latest version of Sentra.</p>
              </div>
            </div>
            <div className="pt-4 border-t border-[var(--color-border)] z-10 relative">
              <UpdaterCard />
            </div>
          </div>

          {/* Legal & Data */}
          <div className="col-span-2 flex items-center gap-3 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Legal & Data</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* Privacy Policy */}
          <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center gap-3 mb-4 z-10 relative">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                <Shield size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Privacy Policy</h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Read about how we handle your data.</p>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
              <button
                onClick={() => setIsPrivacyModalOpen(true)}
                className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} />
                View Privacy Policy
              </button>
            </div>
          </div>

          {/* Clear Data — danger */}
          <div className="relative overflow-hidden group rounded-xl border border-red-500/20 hover:border-red-500/40 bg-[var(--color-surface)] transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center gap-3 mb-4 z-10 relative">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Clear Local Data</h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Erase all config and return to login. This cannot be undone.</p>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
              <button
                onClick={handleLogout}
                className="w-full py-2 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors border border-red-500/30 flex items-center justify-center gap-2"
              >
                <AlertTriangle size={14} />
                Clear Data & Logout
              </button>
            </div>
          </div>

        </div>
      </motion.div>

      <PrivacyPolicyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
    </>
  )
}
