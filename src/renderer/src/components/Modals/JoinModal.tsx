import React, { useState } from 'react'
import { X, Play, User, MapPin, Briefcase, LogIn } from 'lucide-react'
import { JoinMethod, JoinConfig } from '../../types'
import { Dialog, DialogContent } from '../UI/dialogs/Dialog'

export interface JoinModalProps {
  isOpen: boolean
  onClose: () => void
  onLaunch: (config: JoinConfig) => void
  selectedCount: number
}

const JoinModal: React.FC<JoinModalProps> = ({ isOpen, onClose, onLaunch, selectedCount }) => {
  const [method, setMethod] = useState<JoinMethod>(JoinMethod.Username)
  const [target, setTarget] = useState('')
  const [placeId, setPlaceId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let finalTarget = target
    if (method === JoinMethod.JobId) {
      finalTarget = `${placeId.trim()}:${target.trim()}`
    }
    onLaunch({ method, target: finalTarget })
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="w-full max-w-md bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden ring-1 ring-[var(--accent-color-ring)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-app-bg)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-surface)] rounded-lg">
              <LogIn className="text-[var(--color-text-secondary)]" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Launch Options</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {selectedCount} selected account{selectedCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="pressable p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Method Selection */}
          <div className="space-y-3">
            <label className="block text-base font-medium text-[var(--color-text-secondary)]">Join Method</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethod(JoinMethod.Username)}
                className={`pressable flex flex-col items-center justify-center gap-2 p-3 rounded border transition-all ${
                  method === JoinMethod.Username
                    ? 'bg-[var(--accent-color)] border-[var(--accent-color-border)] text-[var(--accent-color-foreground)] shadow-[0_5px_20px_var(--accent-color-shadow)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <User size={24} />
                <span className="text-sm font-medium">Username</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod(JoinMethod.PlaceId)}
                className={`pressable flex flex-col items-center justify-center gap-2 p-3 rounded border transition-all ${
                  method === JoinMethod.PlaceId
                    ? 'bg-[var(--accent-color)] border-[var(--accent-color-border)] text-[var(--accent-color-foreground)] shadow-[0_5px_20px_var(--accent-color-shadow)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <MapPin size={24} />
                <span className="text-sm font-medium">Place ID</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod(JoinMethod.JobId)}
                className={`pressable flex flex-col items-center justify-center gap-2 p-3 rounded border transition-all ${
                  method === JoinMethod.JobId
                    ? 'bg-[var(--accent-color)] border-[var(--accent-color-border)] text-[var(--accent-color-foreground)] shadow-[0_5px_20px_var(--accent-color-shadow)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <Briefcase size={24} />
                <span className="text-sm font-medium">Job ID</span>
              </button>
            </div>
          </div>

          {/* Input Fields */}
          <div className="space-y-4">
            {method === JoinMethod.JobId ? (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="placeIdInput"
                    className="block text-base font-medium text-[var(--color-text-secondary)] pb-2"
                  >
                    Game Place ID
                  </label>
                  <input
                    id="placeIdInput"
                    type="text"
                    value={placeId}
                    onChange={(e) => setPlaceId(e.target.value)}
                    placeholder="e.g. 1818"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="jobIdInput"
                    className="block text-base font-medium text-[var(--color-text-secondary)] pb-2"
                  >
                    Server Job ID
                  </label>
                  <input
                    id="jobIdInput"
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="e.g. 772-112-991"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label
                  htmlFor="targetInput"
                  className="block text-base font-medium text-[var(--color-text-secondary)] pb-2"
                >
                  {method === JoinMethod.Username && 'Target Username'}
                  {method === JoinMethod.PlaceId && 'Game Place ID'}
                </label>
                <input
                  id="targetInput"
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={method === JoinMethod.Username ? 'e.g. Builderman' : 'e.g. 1818'}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all"
                  required
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={!target || (method === JoinMethod.JobId && !placeId)}
              className="pressable flex-1 flex items-center justify-center gap-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] text-md font-bold py-3 rounded shadow-lg shadow-[0_10px_30px_var(--accent-color-shadow)] border border-[var(--accent-color-border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} fill="currentColor" />
              <span>Launch Game</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default JoinModal
