import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ShieldAlert, RotateCcw, X, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Account } from '@renderer/types'

interface AvatarResetGateProps {
  selectedAccounts: Account[]
  onResetDone: () => void
  onCancel: () => void
}

const BLACK_BODY_COLORS = {
  headColor3: '1b2a35',
  torsoColor3: '1b2a35',
  rightArmColor3: '1b2a35',
  leftArmColor3: '1b2a35',
  rightLegColor3: '1b2a35',
  leftLegColor3: '1b2a35'
}

// Key for localStorage
const getResetKey = (accountIds: string[]) =>
  `avatar-reset-done:${[...accountIds].sort().join(',')}`

export function hasAvatarResetBeenDone(accountIds: string[]): boolean {
  if (accountIds.length === 0) return true
  try {
    return localStorage.getItem(getResetKey(accountIds)) === 'yes'
  } catch {
    return false
  }
}

export function markAvatarResetDone(accountIds: string[]) {
  try {
    localStorage.setItem(getResetKey(accountIds), 'yes')
  } catch {}
}

const HOLD_DURATION = 1500 // ms

export const AvatarResetGate: React.FC<AvatarResetGateProps> = ({
  selectedAccounts,
  onResetDone,
  onCancel
}) => {
  const [holding, setHolding] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isResetting, setIsResetting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<Array<{ username: string; success: boolean }>>([])
  const [done, setDone] = useState(false)

  const holdStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const holdActiveRef = useRef(false)

  const startHold = useCallback(() => {
    holdActiveRef.current = true
    holdStartRef.current = Date.now()
    setHolding(true)

    const tick = () => {
      if (!holdActiveRef.current || holdStartRef.current === null) return
      const elapsed = Date.now() - holdStartRef.current
      const pct = Math.min(1, elapsed / HOLD_DURATION)
      setHoldProgress(pct)
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        triggerReset()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const endHold = useCallback(() => {
    if (holdProgress < 1) {
      holdActiveRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setHolding(false)
      setHoldProgress(0)
      holdStartRef.current = null
    }
  }, [holdProgress])

  const triggerReset = async () => {
    holdActiveRef.current = false
    setHolding(false)
    setIsResetting(true)
    setProgress({ current: 0, total: selectedAccounts.length })
    const ops: Array<{ username: string; success: boolean }> = []

    for (const account of selectedAccounts) {
      if (!account.cookie) {
        ops.push({ username: account.username, success: false })
        setProgress(prev => ({ ...prev, current: prev.current + 1 }))
        continue
      }
      try {
        await window.api.setWearingAssets(account.cookie, [])
        await window.api.setBodyColors(account.cookie, BLACK_BODY_COLORS)
        ops.push({ username: account.username, success: true })
      } catch {
        ops.push({ username: account.username, success: false })
      }
      setProgress(prev => ({ ...prev, current: prev.current + 1 }))
      await new Promise(r => setTimeout(r, 500))
    }

    setIsResetting(false)
    setResults(ops)
    setDone(true)

    // Persist reset state
    markAvatarResetDone(selectedAccounts.map(a => a.id))
  }

  const successCount = results.filter(r => r.success).length

  if (done) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-xl p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Reset Complete</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {successCount}/{selectedAccounts.length} accounts reset successfully.
              The avatar editor is now unlocked.
            </p>
          </div>
          <button
            onClick={onResetDone}
            className="mt-2 rounded-xl bg-[var(--accent-color)] px-8 py-2.5 font-bold text-[var(--accent-color-foreground)] hover:opacity-90 transition-opacity shadow-[0_0_20px_var(--accent-color-faint)]"
          >
            Open Avatar Editor →
          </button>
        </div>
      </div>
    )
  }

  if (isResetting) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-8 flex flex-col items-center text-center gap-4">
          <Loader2 className="h-12 w-12 text-[var(--accent-color)] animate-spin" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">Resetting Avatars...</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{progress.current} / {progress.total} accounts</p>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[var(--accent-color)] transition-all duration-300"
              style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
            />
          </div>
          <div className="w-full space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-lg px-3 py-1 text-xs ${r.success ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {r.success ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
                {r.username}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-black/60 backdrop-blur-xl p-8 flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-amber-400" />
        </div>

        {/* Text */}
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Reset Required</h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            You have <span className="text-[var(--color-text-primary)] font-semibold">{selectedAccounts.length} accounts</span> selected.
            To use the bulk avatar editor, all selected accounts must first be reset to default
            (no accessories, black body color).
          </p>
        </div>

        {/* Accounts preview */}
        <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
          {selectedAccounts.slice(0, 8).map(a => (
            <span key={a.id} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
              {a.username}
            </span>
          ))}
          {selectedAccounts.length > 8 && (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-[var(--color-text-muted)]">
              +{selectedAccounts.length - 8} more
            </span>
          )}
        </div>

        {/* Hold button */}
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="relative w-full overflow-hidden rounded-xl">
            {/* Progress fill behind button */}
            <div
              className="absolute inset-0 bg-amber-500/30 transition-none"
              style={{ width: `${holdProgress * 100}%` }}
            />
            <button
              onMouseDown={startHold}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={startHold}
              onTouchEnd={endHold}
              className="relative w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-3 font-bold text-amber-300 select-none cursor-pointer hover:bg-amber-500/20 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              {holding
                ? `Resetting... ${Math.round(holdProgress * 100)}%`
                : 'Hold to Reset All Avatars'}
            </button>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">Hold the button for 1.5 seconds to confirm</p>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          <X className="h-4 w-4" />
          Cancel — go back
        </button>
      </div>
    </div>
  )
}
