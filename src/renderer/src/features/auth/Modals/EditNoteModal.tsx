import React, { useState, useEffect } from 'react'
import { Save, FileText } from 'lucide-react'
import { Account } from '@renderer/types'
import { Dialog, DialogContent, DialogClose } from '@renderer/components/UI/dialogs/Dialog'

interface EditNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (accountIds: string[], newNote: string) => void
  account?: Account | null
  accounts?: Account[] | null
  privacyMode?: boolean
}

const EditNoteModal: React.FC<EditNoteModalProps> = ({ isOpen, onClose, onSave, account, accounts, privacyMode }) => {
  const [note, setNote] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (account) {
        setNote(account.notes || '')
      } else if (accounts && accounts.length > 0) {
        // If bulk, only set if all have same note, else empty
        const firstNote = accounts[0].notes || ''
        const allSame = accounts.every((a) => (a.notes || '') === firstNote)
        setNote(allSame ? firstNote : '')
      }
    }
  }, [isOpen, account, accounts])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (account) {
      onSave([account.id], note)
      onClose()
    } else if (accounts) {
      onSave(accounts.map((a) => a.id), note)
      onClose()
    }
  }

  if (!isOpen || (!account && (!accounts || accounts.length === 0))) return null

  const isBulk = !!accounts && accounts.length > 1
  const subtitle = isBulk 
    ? `For ${accounts.length} selected accounts`
    : account 
      ? `For @${account.username}` 
      : ''

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="w-full max-w-md bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden ring-1 ring-[var(--accent-color-ring)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-app-bg)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-surface)] rounded-lg">
              <FileText className="text-[var(--color-text-secondary)]" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Edit Note{isBulk ? 's' : ''}</h3>
              <p 
                className="text-sm text-[var(--color-text-muted)]"
                style={privacyMode ? { filter: 'blur(16px)' } : undefined}
              >{subtitle}</p>
            </div>
          </div>
          <DialogClose />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="noteInput" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Account Note
            </label>
            <textarea
              id="noteInput"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Main storage account"
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--accent-color)] transition-all min-h-[120px] resize-none"
              autoFocus
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="pressable flex-1 px-4 py-3 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pressable flex-[2] flex items-center justify-center gap-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] font-bold py-3 rounded-lg transition-colors border border-[var(--accent-color-border)] shadow-[0_5px_20px_var(--accent-color-shadow)]"
            >
              <Save size={18} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditNoteModal
