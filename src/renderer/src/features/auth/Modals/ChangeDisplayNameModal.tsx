import React, { useState, useEffect } from 'react'
import { Edit3, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/UI/dialogs/Dialog'
import { Button } from '@renderer/components/UI/buttons/Button'
import { Account } from '@renderer/types'
import { useNotification } from '@renderer/system/stores/useSnackbarStore'
import { useUIStore } from '@renderer/stores/useUIStore'
import { bulkOperationLimiter, executeWithRetry, isRateLimitError, sleep } from '@renderer/lib/rateLimiter'

interface ChangeDisplayNameModalProps {
  accounts: Account[]
  selectedIds: Set<string>
  onAccountsChange: (accounts: Account[]) => void
}

export const ChangeDisplayNameModal = ({
  accounts,
  selectedIds,
  onAccountsChange
}: ChangeDisplayNameModalProps) => {
  const isOpen = useUIStore((s) => s.modals.changeDisplayName)
  const closeModal = useUIStore((s) => s.closeModal)
  const { showNotification } = useNotification()

  const [newName, setNewName] = useState('')
  const [useSequential, setUseSequential] = useState(false)
  const [startingNumber, setStartingNumber] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [currentAccountLabel, setCurrentAccountLabel] = useState('')
  const [resultMessages, setResultMessages] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setNewName('')
      setUseSequential(selectedIds.size > 1)
      setStartingNumber(1)
      setIsProcessing(false)
      setProcessedCount(0)
      setFailedCount(0)
      setCurrentAccountLabel('')
      setResultMessages([])
    }
  }, [isOpen, selectedIds.size])

  const handleSave = async () => {
    if (!newName.trim()) {
      showNotification('Please enter a display name', 'error')
      return
    }

    setIsProcessing(true)
    setProcessedCount(0)
    setFailedCount(0)
    setCurrentAccountLabel('')
    setResultMessages([])
    showNotification('Starting display name update...', 'info')

    const updatedAccounts = [...accounts]
    let counter = startingNumber
    let updateCount = 0
    let failedCountLocal = 0
    const resultEntries: string[] = []

    for (const acc of updatedAccounts) {
      if (!selectedIds.has(acc.id)) continue

      const nameToApply = useSequential && selectedIds.size > 1
        ? `${newName.trim()}_${counter}`
        : newName.trim()

      setCurrentAccountLabel(acc.username || acc.displayName || acc.id)

      if (acc.cookie && acc.cookie.trim().length > 0) {
        try {
          const result = await executeWithRetry(
            bulkOperationLimiter,
            async () => {
              return await window.api.user.setRobloxDisplayName(acc.cookie!, nameToApply)
            },
            {
              retryCondition: (error) => {
                if (isRateLimitError(error)) return true
                const maybeError = error as any
                const message = typeof maybeError?.message === 'string'
                  ? maybeError.message
                  : typeof error === 'string'
                  ? error
                  : ''
                return /(?:429|rate limit|too many requests)/i.test(message)
              }
            }
          )

          if (result && result.success) {
            acc.displayName = nameToApply
            updateCount++
            resultEntries.push(`✓ ${acc.username || acc.id}`)
          } else {
            failedCountLocal++
            const errorMessage = result?.error || 'Rejected'
            resultEntries.push(`✗ ${acc.username || acc.id}: ${errorMessage}`)
          }
        } catch (err: any) {
          failedCountLocal++
          resultEntries.push(`✗ ${acc.username || acc.id}: ${err?.message || 'Unknown error'}`)
        }

        await sleep(1500)
      } else {
        acc.displayName = nameToApply
        updateCount++
        resultEntries.push(`⚠ ${acc.username || acc.id}: local update applied`)
      }

      if (useSequential) counter++
      setProcessedCount((prev) => prev + 1)
      setFailedCount(failedCountLocal)
      setResultMessages(resultEntries.slice(-5))
    }

    await window.api.account.saveAccounts(updatedAccounts)
    onAccountsChange(updatedAccounts)

    setIsProcessing(false)
    setCurrentAccountLabel('')

    if (failedCountLocal > 0) {
      showNotification(
        `Updated ${updateCount} accounts, ${failedCountLocal} failed. Check results in the modal.`,
        'warning'
      )
    } else {
      showNotification(`Successfully updated ${updateCount} account${updateCount === 1 ? '' : 's'}.`, 'success')
    }

    closeModal('changeDisplayName')
  }

  return (
    <Dialog isOpen={isOpen} onClose={() => closeModal('changeDisplayName')}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Edit3 size={20} className="text-blue-400" />
            </div>
            <div>
              <DialogTitle>Change Display Name</DialogTitle>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Editing profile sync data for {selectedIds.size} account(s)
              </p>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              New Display Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. MyBot"
              disabled={isProcessing}
              className="w-full h-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 text-sm focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-all placeholder-[var(--color-text-muted)] text-[var(--color-text-primary)] disabled:opacity-60"
              autoFocus
            />
          </div>

          {isProcessing && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-primary)] space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span>Processing {processedCount}/{selectedIds.size}</span>
                <span className="font-medium text-[var(--accent-color)]">{currentAccountLabel}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full bg-[var(--accent-color)] transition-all"
                  style={{ width: `${(processedCount / Math.max(1, selectedIds.size)) * 100}%` }}
                />
              </div>
              {resultMessages.length > 0 && (
                <div className="max-h-28 overflow-y-auto rounded-lg bg-black/10 p-2 text-xs text-[var(--color-text-secondary)]"> 
                  {resultMessages.slice(-5).map((message, index) => (
                    <div key={`${message}-${index}`} className="truncate">{message}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedIds.size > 1 && (
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={useSequential}
                    onChange={(e) => setUseSequential(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 rounded border-2 border-[var(--color-border)] peer-checked:border-[var(--accent-color)] peer-checked:bg-[var(--accent-color)] transition-all"></div>
                  <CheckCircle2
                    size={14}
                    className="absolute text-[var(--color-text-primary)] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                    strokeWidth={3}
                  />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                  Append sequential numbers (e.g. {newName || 'Name'} 1, {newName || 'Name'} 2)
                </span>
              </label>

              {useSequential && (
                <div className="pl-7 space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                  <label className="text-xs font-semibold text-[var(--color-text-muted)]">
                    Starting Number
                  </label>
                  <input
                    type="number"
                    value={startingNumber}
                    onChange={(e) => setStartingNumber(parseInt(e.target.value) || 1)}
                    min={1}
                    className="w-full h-9 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 text-sm focus:border-[var(--accent-color)] transition-all text-[var(--color-text-primary)]"
                  />
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => closeModal('changeDisplayName')} disabled={isProcessing}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? 'Updating…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}