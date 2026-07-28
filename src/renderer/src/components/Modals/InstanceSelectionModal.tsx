import React, { useState } from 'react'
import { X, HardDrive, Play } from 'lucide-react'
import { RobloxInstallation } from '../../types'
import { Dialog, DialogContent } from '../UI/dialogs/Dialog'

interface InstanceSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (installPath?: string) => void
  installations: RobloxInstallation[]
}

const InstanceSelectionModal: React.FC<InstanceSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  installations
}) => {
  const [selectedPath, setSelectedPath] = useState<string>('')

  const handleConfirm = () => {
    onSelect(selectedPath || undefined)
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="w-full max-w-md bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden ring-1 ring-[var(--accent-color-ring)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-app-bg)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-surface)] rounded-lg">
              <HardDrive className="text-[var(--color-text-secondary)]" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Select Installation</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Choose which Roblox version to launch with</p>
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
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <button
              onClick={() => setSelectedPath('')}
              className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                selectedPath === ''
                  ? 'bg-[rgba(var(--accent-color-rgb),0.08)] border-[var(--accent-color-border)] text-[var(--color-text-primary)] shadow-[0_5px_20px_var(--accent-color-shadow)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <div
                className={`p-2 rounded shrink-0 ${selectedPath === '' ? 'bg-[rgba(var(--accent-color-rgb),0.15)] text-[var(--accent-color-foreground)]' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'}`}
              >
                <HardDrive size={20} />
              </div>
              <div>
                <div className="font-medium text-sm">System Default</div>
                <div className="text-xs opacity-70">Use the default system installation</div>
              </div>
            </button>

            {installations.map((inst) => (
              <button
                key={inst.id}
                onClick={() => setSelectedPath(inst.path)}
                className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                  selectedPath === inst.path
                    ? 'bg-[rgba(var(--accent-color-rgb),0.08)] border-[var(--accent-color-border)] text-[var(--color-text-primary)] shadow-[0_5px_20px_var(--accent-color-shadow)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                <div
                  className={`p-2 rounded shrink-0 ${selectedPath === inst.path ? 'bg-[rgba(var(--accent-color-rgb),0.15)] text-[var(--accent-color-foreground)]' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'}`}
                >
                  <HardDrive size={20} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{inst.name}</div>
                  <div className="text-xs opacity-70 truncate">{inst.version}</div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleConfirm}
            className="pressable w-full flex items-center justify-center gap-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] font-bold py-3 rounded-lg transition-all mt-4 border border-[var(--accent-color-border)] shadow-[0_10px_30px_var(--accent-color-shadow)]"
          >
            <Play size={16} fill="currentColor" />
            <span>Launch</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default InstanceSelectionModal
