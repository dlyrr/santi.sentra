import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, X, Loader2, AlertCircle, Calendar, ChevronDown } from 'lucide-react'
import { Dialog, DialogContent } from '../../components/UI/dialogs/Dialog'
import type { Account } from '../../types'

interface AccountTotals {
  accountId: string
  username: string
  incomingRobux: number
  outgoingRobux: number
  salesTotal: number
  purchasesTotal: number
  error?: string
}

type TimeFrame = 'Day' | 'Week' | 'Month' | 'Year'

const TIME_FRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: 'Day', label: 'Today' },
  { value: 'Week', label: 'This Week' },
  { value: 'Month', label: 'This Month' },
  { value: 'Year', label: 'This Year' }
]

interface BulkTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  selectedIds: Set<string>
}

const BulkTransactionsModal: React.FC<BulkTransactionsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  selectedIds
}) => {
  const [results, setResults] = useState<AccountTotals[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('Month')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setResults([])
      setProgress(0)
      setIsDropdownOpen(false)
      return
    }

    setResults([]) // Clear previous results when fetching new timeframe
    setProgress(0)
    let isActive = true

    const fetchTotals = async () => {
      setIsLoading(true)
      const selectedAccounts = accounts.filter((a) => selectedIds.has(a.id) && a.cookie)
      if (selectedAccounts.length === 0) {
        setResults([])
        setProgress(100)
        setIsLoading(false)
        return
      }

      let currentCompleted = 0
      setCompletedCount(0)
      
      const updateProgress = () => {
        currentCompleted += 1
        if (!isActive) return
        setCompletedCount(currentCompleted)
        setProgress(Math.round((currentCompleted / selectedAccounts.length) * 100))
      }

      const totals: AccountTotals[] = []

      // Process in small batches of 3 to avoid hammering the Roblox API (Rate Limits)
      const batchSize = 3
      for (let i = 0; i < selectedAccounts.length; i += batchSize) {
        if (!isActive) return
        
        const batch = selectedAccounts.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map(async (account) => {
            try {
              const data = await window.api.getTransactionTotals(account.cookie!, timeFrame)
              return {
                accountId: account.id,
                username: account.username,
                incomingRobux: data.incomingRobuxTotal ?? 0,
                outgoingRobux: data.outgoingRobuxTotal ?? 0,
                salesTotal: data.salesTotal ?? 0,
                purchasesTotal: data.purchasesTotal ?? 0
              }
            } catch (err) {
              console.error(`Failed to fetch transactions for ${account.username}:`, err)
              return {
                accountId: account.id,
                username: account.username,
                incomingRobux: 0,
                outgoingRobux: 0,
                salesTotal: 0,
                purchasesTotal: 0,
                error: 'Failed to fetch (Invalid or Rate Limited)'
              }
            } finally {
              updateProgress()
            }
          })
        )
        totals.push(...batchResults)
        
        // Add a small delay between batches to respect rate limits
        if (i + batchSize < selectedAccounts.length) {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
      }

      if (!isActive) return
      setResults(totals)
      setIsLoading(false)
    }

    void fetchTotals()

    return () => {
      isActive = false
    }
  }, [isOpen, accounts, selectedIds, timeFrame])

  const totalIncoming = results.reduce((sum, r) => sum + r.incomingRobux, 0)
  const totalOutgoing = results.reduce((sum, r) => sum + r.outgoingRobux, 0)
  const totalSales = results.reduce((sum, r) => sum + r.salesTotal, 0)
  const totalPurchases = results.reduce((sum, r) => sum + r.purchasesTotal, 0)
  const net = totalIncoming - totalOutgoing

  const fmt = (n: number) => n.toLocaleString()

  return (
    <Dialog isOpen={isOpen} onClose={isLoading ? () => {} : onClose}>
      <DialogContent className="max-w-2xl bg-[#0e0e10] border border-white/10 shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Transaction Totals</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                {selectedIds.size} account{selectedIds.size !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="absolute top-5 right-16 z-50" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-white/10 hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
            >
              <Calendar size={14} className="text-[var(--color-text-muted)]" />
              <span>{TIME_FRAME_OPTIONS.find((o) => o.value === timeFrame)?.label || 'This Month'}</span>
              <ChevronDown size={12} className={`text-[var(--color-text-muted)] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-36 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                <div className="p-1">
                  {TIME_FRAME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTimeFrame(option.value)
                        setIsDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${
                        timeFrame === option.value
                          ? 'bg-[var(--accent-color)] text-[var(--accent-color-foreground)] font-bold'
                          : 'text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-5 right-5 rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-white/10 hover:text-[var(--color-text-primary)] disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <div className="space-y-1.5">
              <p className="text-[var(--color-text-primary)] font-medium">Fetching transaction data…</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {progress}% complete ({completedCount}/{selectedIds.size} accounts)
              </p>
            </div>
            <div className="w-full max-w-xs bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {!isLoading && results.length > 0 && (
          <div className="flex flex-col">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 p-6 pb-4 md:grid-cols-4">
              <div className="rounded-xl bg-white/5 border border-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Incoming</p>
                <p className="text-xl font-bold text-emerald-400">{fmt(totalIncoming)}</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Outgoing</p>
                <p className="text-xl font-bold text-red-400">{fmt(totalOutgoing)}</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Net</p>
                <p className={`text-xl font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {net >= 0 ? '+' : ''}{fmt(net)}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Sales</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{fmt(totalSales)}</p>
              </div>
            </div>

            {/* Per-account table */}
            <div className="mx-6 mb-6 rounded-xl border border-white/5 overflow-hidden">
              <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Account</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">In</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Out</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {results.map((r) => {
                      const rowNet = r.incomingRobux - r.outgoingRobux
                      return (
                        <tr key={r.accountId} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                            {r.error ? (
                              <span className="flex items-center gap-1.5 text-red-400">
                                <AlertCircle size={14} /> {r.username}
                              </span>
                            ) : r.username}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="flex items-center justify-end gap-1 text-emerald-400 font-medium">
                              <TrendingUp size={13} /> {fmt(r.incomingRobux)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="flex items-center justify-end gap-1 text-red-400 font-medium">
                              <TrendingDown size={13} /> {fmt(r.outgoingRobux)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            <span className={rowNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {rowNet >= 0 ? '+' : ''}{fmt(rowNet)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!isLoading && (
          <div className="border-t border-white/10 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 h-10 rounded-xl bg-white/5 border border-white/10 font-semibold text-[var(--color-text-primary)] text-sm transition hover:bg-white/10"
            >
              Close
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default BulkTransactionsModal
