import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Lock, Globe, RotateCcw, Zap, Sliders, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Section, SettingsCard, ToggleRow } from './SharedComponents'
import BackupIcon from '../../../components/UI/icons/BackupIcon'
import { Account, Settings } from '../../../types'
import { useSetAppUnlocked } from '../../../stores/useUIStore'
import { useNotificationTrayStore } from '../../system/stores/useNotificationTrayStore'
import { queryKeys } from '../../../../../shared/queryKeys'
import PinSetupDialog from '../../../components/UI/security/PinSetupDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody
} from '../../../components/UI/dialogs/Dialog'
import RobloxAdvancedSettings from './RobloxAdvancedSettings'
import UserAgentSettingsModal from './UserAgentSettingsModal'
import { useRobloxSettings } from '../hooks/useRobloxSettings'

interface SecuritySettingsTabProps {
  accounts: Account[]
  settings: Settings
  onUpdateSettings: (newSettings: Partial<Settings>) => void
}

const isMac = window.platform?.isMac ?? false

export const SecuritySettingsTab: React.FC<SecuritySettingsTabProps> = ({
  accounts,
  settings,
  onUpdateSettings
}) => {
  const queryClient = useQueryClient()
  const setAppUnlocked = useSetAppUnlocked()
  const addNotification = useNotificationTrayStore((s) => s.addNotification)

  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false)
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false)
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [backupStep, setBackupStep] = useState<'pin' | 'backuppin'>('pin')
  const [restoreStep, setRestoreStep] = useState<'pin' | 'backuppin' | 'file'>('pin')
  const [backupPin, setBackupPin] = useState<string[]>(Array(6).fill(''))
  const [backupPinConfirm, setBackupPinConfirm] = useState<string[]>(Array(6).fill(''))
  const [restorePin, setRestorePin] = useState<string[]>(Array(6).fill(''))
  const [restoreBackupPin, setRestoreBackupPin] = useState<string[]>(Array(6).fill(''))
  const [selectedBackupFile, setSelectedBackupFile] = useState<string | null>(null)
  const [isBackupLoading, setIsBackupLoading] = useState(false)
  const [isRestoreLoading, setIsRestoreLoading] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [isRobloxSettingsOpen, setIsRobloxSettingsOpen] = useState(false)
  const [isUserAgentModalOpen, setIsUserAgentModalOpen] = useState(false)
  const { settings: robloxSettings, updateSettings: updateRobloxSettings, isLoading: isRobloxSettingsLoading } = useRobloxSettings()
  
  // User Agent state
  const [currentUserAgent, setCurrentUserAgent] = useState<string>('')
  const [userAgentIndex, setUserAgentIndex] = useState<number>(0)
  const [allUserAgents, setAllUserAgents] = useState<string[]>([])
  const [isAutoSwapEnabled, setIsAutoSwapEnabled] = useState<boolean>(false)
  const [autoSwapInterval, setAutoSwapInterval] = useState<number>(30)
  const [isLoadingUserAgent, setIsLoadingUserAgent] = useState(false)
  
  // PIN input refs
  const backupPinRefs = useRef<(HTMLInputElement | null)[]>([])
  const backupPinConfirmRefs = useRef<(HTMLInputElement | null)[]>([])
  const restorePinRefs = useRef<(HTMLInputElement | null)[]>([])
  const restoreBackupPinRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!isBackupDialogOpen) {
      backupPinRefs.current = []
      backupPinConfirmRefs.current = []
    }
  }, [isBackupDialogOpen])

  useEffect(() => {
    if (!isRestoreDialogOpen) {
      restorePinRefs.current = []
      restoreBackupPinRefs.current = []
    }
  }, [isRestoreDialogOpen])

  useEffect(() => {
    const loadUserAgentState = async () => {
      try {
        setIsLoadingUserAgent(true)
        const state = await window.api.getUserAgentState()
        setCurrentUserAgent(state.currentUserAgent)
        setUserAgentIndex(state.currentIndex)
        setIsAutoSwapEnabled(state.autoSwapEnabled)
        setAutoSwapInterval(state.autoSwapIntervalMinutes)
        const agents = await window.api.getAllUserAgents()
        setAllUserAgents(agents)
      } catch (error) {
        console.error('[Settings] Failed to load user agent state:', error)
      } finally {
        setIsLoadingUserAgent(false)
      }
    }
    loadUserAgentState()
  }, [])

  const handleRotateNext = async () => {
    try {
      setIsLoadingUserAgent(true)
      const result = await window.api.swapUserAgent()
      setCurrentUserAgent(result.userAgent)
      setUserAgentIndex(result.index)
      addNotification({
        type: 'success',
        title: 'User Agent Swapped',
        message: `Rotated to user agent #${result.index + 1}`
      })
    } catch (error) {
      console.error('[SettingsTab] Failed to swap user agent:', error)
      addNotification({
        type: 'error',
        title: 'Swap Failed',
        message: error instanceof Error ? error.message : 'Failed to swap user agent'
      })
    } finally {
      setIsLoadingUserAgent(false)
    }
  }

  const handleSelectAgent = async (index: number) => {
    try {
      setIsLoadingUserAgent(true)
      const result = await window.api.setUserAgentIndex(index)
      setCurrentUserAgent(result.userAgent)
      setUserAgentIndex(result.index)
      addNotification({
        type: 'success',
        title: 'User Agent Selected',
        message: `Switched to user agent #${result.index + 1}`
      })
    } catch (error) {
      console.error('[SettingsTab] Failed to set user agent:', error)
      addNotification({
        type: 'error',
        title: 'Selection Failed',
        message: error instanceof Error ? error.message : 'Failed to select user agent'
      })
    } finally {
      setIsLoadingUserAgent(false)
    }
  }

  const handleToggleAutoSwap = async () => {
    try {
      setIsLoadingUserAgent(true)
      const result = await window.api.setAutoSwapUserAgent(!isAutoSwapEnabled, autoSwapInterval)
      setIsAutoSwapEnabled(result.autoSwapEnabled)
      addNotification({
        type: 'success',
        title: result.autoSwapEnabled ? 'Auto-rotate Enabled' : 'Auto-rotate Disabled',
        message: result.autoSwapEnabled
          ? `User agent will rotate every ${result.intervalMinutes} minutes`
          : 'Automatic user agent rotation disabled'
      })
    } catch (error) {
      console.error('[SettingsTab] Failed to toggle auto-swap:', error)
      addNotification({
        type: 'error',
        title: 'Toggle Failed',
        message: error instanceof Error ? error.message : 'Failed to toggle auto-rotate'
      })
    } finally {
      setIsLoadingUserAgent(false)
    }
  }
  
  const focusFirstRef = (refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => {
    const tryFocus = () => {
      for (let i = 0; i < refs.current.length; i++) {
        const el = refs.current[i]
        if (el) {
          try {
            el.focus()
            el.select && el.select()
            return true
          } catch (e) {
            console.warn('Failed to load FFlags:', e instanceof Error ? e.message : String(e))
          }
        }
      }
      return false
    }

    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        if (!tryFocus()) setTimeout(tryFocus, 50)
      })
    } else {
      tryFocus()
    }
  }

  useEffect(() => {
    if (isBackupDialogOpen && backupStep === 'pin') {
      backupPinRefs.current = new Array(6).fill(null)
      backupPinConfirmRefs.current = new Array(6).fill(null)
      focusFirstRef(backupPinRefs)
    }
  }, [isBackupDialogOpen, backupStep])

  useEffect(() => {
    if (isBackupDialogOpen && backupStep === 'backuppin') {
      backupPinRefs.current = new Array(6).fill(null)
      backupPinConfirmRefs.current = new Array(6).fill(null)
      focusFirstRef(backupPinRefs)
    }
  }, [isBackupDialogOpen, backupStep])

  useEffect(() => {
    if (isRestoreDialogOpen && restoreStep === 'pin') {
      restorePinRefs.current = new Array(6).fill(null)
      restoreBackupPinRefs.current = new Array(6).fill(null)
      focusFirstRef(restorePinRefs)
    }
  }, [isRestoreDialogOpen, restoreStep])

  useEffect(() => {
    if (isRestoreDialogOpen && restoreStep === 'backuppin') {
      restorePinRefs.current = new Array(6).fill(null)
      restoreBackupPinRefs.current = new Array(6).fill(null)
      focusFirstRef(restoreBackupPinRefs)
    }
  }, [isRestoreDialogOpen, restoreStep])

  const handleBackupAccounts = async () => {
    setBackupError(null)
    
    if (backupStep === 'pin') {
      const pinStr = backupPin.join('')
      if (backupPin.some(digit => digit === '')) {
        setBackupError('Please enter all 6 digits')
        return
      }
      try {
        const result = await window.api.verifyPin(pinStr)
        if (result.success) {
          setBackupStep('backuppin')
          setBackupPin(Array(6).fill(''))
          setBackupPinConfirm(Array(6).fill(''))
        } else {
          setBackupError('Incorrect PIN')
          setBackupPin(Array(6).fill(''))
        }
      } catch (error) {
        setBackupError('PIN verification failed: ' + (error instanceof Error ? error.message : String(error)))
        setBackupPin(Array(6).fill(''))
      }
    } else if (backupStep === 'backuppin') {
      const pin1 = backupPin.join('')
      const pin2 = backupPinConfirm.join('')
      
      if (backupPin.some(digit => digit === '')) {
        setBackupError('Please enter all 6 digits for encryption PIN')
        return
      }
      if (backupPinConfirm.some(digit => digit === '')) {
        setBackupError('Please enter all 6 digits for confirmation PIN')
        return
      }
      if (pin1 !== pin2) {
        setBackupError('Backup PINs do not match')
        setBackupPin(Array(6).fill(''))
        setBackupPinConfirm(Array(6).fill(''))
        return
      }

      setIsBackupLoading(true)
      try {
        let accountsData = accounts
        let saveLocation: string | undefined
        try {
          saveLocation = await window.api.chooseBackupLocation()
        } catch (e) {
          throw new Error('Backup cancelled')
        }

        const filepath = await window.api.createBackup(accountsData, pin1, saveLocation)
        addNotification({
          type: 'success',
          title: 'Backup created',
          message: `Saved backup to ${filepath}`
        })
        setIsBackupDialogOpen(false)
        setBackupStep('pin')
        setBackupPin(Array(6).fill(''))
        setBackupPinConfirm(Array(6).fill(''))
        setBackupError(null)
      } catch (error) {
        const msg = (error instanceof Error ? error.message : String(error))
        addNotification({ type: 'error', title: 'Backup failed', message: msg })
        setBackupError('Backup failed: ' + msg)
      } finally {
        setIsBackupLoading(false)
      }
    }
  }

  const handleRestoreBackup = async () => {
    setRestoreError(null)
    
    if (restoreStep === 'pin') {
      const pinStr = restorePin.join('')
      if (restorePin.some(digit => digit === '')) {
        setRestoreError('Please enter all 6 digits')
        return
      }
      try {
        const result = await window.api.verifyPin(pinStr)
        if (result.success) {
          setRestoreStep('file')
          setRestorePin(Array(6).fill(''))
        } else {
          setRestoreError('Incorrect PIN')
          setRestorePin(Array(6).fill(''))
        }
      } catch (error) {
        setRestoreError('PIN verification failed: ' + (error instanceof Error ? error.message : String(error)))
        setRestorePin(Array(6).fill(''))
      }
    } else if (restoreStep === 'file') {
      try {
        const filepath = await window.api.pickBackupFile()
        if (filepath) {
          setSelectedBackupFile(filepath)
          setRestoreStep('backuppin')
        }
      } catch (error) {
        setRestoreError('File selection failed: ' + (error instanceof Error ? error.message : String(error)))
      }
    } else if (restoreStep === 'backuppin') {
      const pinStr = restoreBackupPin.join('')
      if (restoreBackupPin.some(digit => digit === '')) {
        setRestoreError('Please enter all 6 digits')
        return
      }
      if (!selectedBackupFile) {
        setRestoreError('No backup file selected')
        return
      }

      setIsRestoreLoading(true)
      try {
        const restoredAccounts = await window.api.restoreBackup(selectedBackupFile, pinStr)
        await window.api.saveAccounts(restoredAccounts as Account[])
        addNotification({
          type: 'success',
          title: 'Backup restored',
          message: `Imported ${restoredAccounts.length} accounts from backup`
        })
        setIsRestoreDialogOpen(false)
        setRestoreStep('pin')
        setRestorePin(Array(6).fill(''))
        setRestoreBackupPin(Array(6).fill(''))
        setSelectedBackupFile(null)
        setRestoreError(null)
        queryClient.invalidateQueries({ queryKey: ['accounts'] })
      } catch (error) {
        const msg = (error instanceof Error ? error.message : String(error))
        addNotification({ type: 'error', title: 'Restore failed', message: msg })
        setRestoreError('Restore failed: ' + msg)
      } finally {
        setIsRestoreLoading(false)
      }
    }
  }

  const handlePinInputChange = useCallback(
    (index: number, value: string, setter: any, refs: React.MutableRefObject<(HTMLInputElement | null)[]>) => {
      const digit = value.slice(-1)
      if (!/^\d?$/.test(digit)) return

      setter((prev: string[]) => {
        const newPin = [...prev]
        newPin[index] = digit
        return newPin
      })

      if (digit && index < 5) {
        refs.current[index + 1]?.focus()
      }
    },
    []
  )

  const handlePinKeyDown = useCallback(
    (
      index: number,
      e: React.KeyboardEvent<HTMLInputElement>,
      currentPin: string[],
      setter: any,
      refs: React.MutableRefObject<(HTMLInputElement | null)[]>
    ) => {
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (!currentPin[index] && index > 0) {
          refs.current[index - 1]?.focus()
          setter((prev: string[]) => {
            const newPin = [...prev]
            newPin[index - 1] = ''
            return newPin
          })
        } else {
          setter((prev: string[]) => {
            const newPin = [...prev]
            newPin[index] = ''
            return newPin
          })
        }
      }
    },
    []
  )

  const renderPinInputs = (
    values: string[],
    setter: any,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => (
    <div className="flex gap-2 justify-center">
      {values.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handlePinInputChange(index, e.target.value, setter, refs)}
          onKeyDown={(e) => handlePinKeyDown(index, e, values, setter, refs)}
          onPaste={(e) => {
            try {
              const text = e.clipboardData?.getData('text') || ''
              const digits = text.replace(/\D/g, '').split('')
              if (digits.length === 0) return
              setter((prev: string[]) => {
                const next = [...prev]
                for (let i = 0; i < digits.length && index + i < next.length; i++) {
                  next[index + i] = digits[i]
                }
                return next
              })
              requestAnimationFrame(() => {
                const lastIndex = Math.min(index + digits.length - 1, refs.current.length - 1)
                refs.current[lastIndex]?.focus()
              })
            } catch (err) {}
          }}
          onPointerDown={() => {
            try { refs.current[index]?.focus() } catch (err) {}
          }}
          onTouchStart={() => {
            try { refs.current[index]?.focus() } catch (err) {}
          }}
          onClick={() => {
            try { refs.current[index]?.focus() } catch (err) {}
          }}
          aria-label={`PIN digit ${index + 1}`}
          tabIndex={0}
          style={{ pointerEvents: 'auto' }}
          className="w-10 h-12 text-center text-xl font-mono rounded-lg border-2 bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none transition-all border-[var(--color-border-strong)] focus:border-[var(--color-border-strong)]"
        />
      ))}
    </div>
  )

  const handlePinSave = async (newPin: string | null, currentPin?: string) => {
    const result = await window.api.setPin(newPin, currentPin)
    if (result.success) {
      if (newPin) setAppUnlocked(true)
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.snapshot() })
    }
    return result
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="pb-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Security</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5 leading-relaxed">Manage access controls, account backups, and advanced configurations.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">

          {/* Access Control */}
          <div className="col-span-2 flex items-center gap-3 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Access Control</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* PIN Lock — full width */}
          <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center justify-between z-10 relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                  <Lock size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">PIN Lock</h4>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Require a 6-digit PIN when Sentra starts.</p>
                </div>
              </div>
              <button
                onClick={() => setIsPinDialogOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 shrink-0 ${settings.pinCode
                  ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30'
                  : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] border border-[var(--color-border-strong)]'
                }`}
              >
                {settings.pinCode ? (
                  <>
                    <Lock size={14} /> PIN Enabled — Manage
                  </>
                ) : (
                  'Set Up PIN'
                )}
              </button>
            </div>
            {settings.pinCode && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] z-10 relative">
                <p className="text-xs text-[var(--color-text-muted)]">Your PIN is active. The app will be locked on next launch.</p>
              </div>
            )}
          </div>

          {/* Tools */}
          <div className="col-span-2 flex items-center gap-3 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Backup & Restore</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* Backup */}
          <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center gap-3 mb-4 z-10 relative">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                <BackupIcon size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Backup Accounts</h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Create an encrypted backup of all your accounts.</p>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
              <button
                onClick={() => { setIsBackupDialogOpen(true); setBackupStep('pin'); setBackupPin(Array(6).fill('')); setBackupPinConfirm(Array(6).fill('')) }}
                className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] flex items-center justify-center gap-2"
              >
                <BackupIcon size={14} />
                Create Backup
              </button>
            </div>
          </div>

          {/* Restore */}
          <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center gap-3 mb-4 z-10 relative">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                <RotateCcw size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Restore Accounts</h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Restore accounts from an existing backup file.</p>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
              <button
                onClick={() => { setIsRestoreDialogOpen(true); setRestoreStep('pin'); setRestorePin(Array(6).fill('')); setRestoreBackupPin(Array(6).fill('')); setSelectedBackupFile(null) }}
                className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} />
                Load Backup
              </button>
            </div>
          </div>

          {/* Advanced */}
          <div className="col-span-2 flex items-center gap-3 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Advanced Features</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* User Agent */}
          <div className="relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center gap-3 mb-4 z-10 relative">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                <Globe size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">User Agent</h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {isAutoSwapEnabled ? `Auto-rotating every ${autoSwapInterval}m` : `Static — Agent #${userAgentIndex + 1}`}
                </p>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative">
              <button
                onClick={() => setIsUserAgentModalOpen(true)}
                className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] flex items-center justify-center gap-2"
              >
                <Globe size={14} />
                Configure
              </button>
            </div>
          </div>

          {/* Multiple Instances */}
          <div className="relative overflow-hidden group rounded-xl border border-amber-500/20 hover:border-amber-500/40 bg-[var(--color-surface)] transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center gap-3 mb-4 z-10 relative">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Zap size={16} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Multi-Instance</h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Launch multiple Roblox clients at once.{isMac ? ' (Experimental on macOS)' : ''}</p>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--color-border)] z-10 relative flex items-center justify-between">
              <span className="text-[10px] text-amber-500/80 font-medium">⚠ May violate Roblox ToS</span>
              <button
                onClick={() => onUpdateSettings({ allowMultipleInstances: !settings.allowMultipleInstances })}
                className={`relative w-11 h-6 rounded-full border transition-all duration-300 ${settings.allowMultipleInstances ? 'bg-amber-500 border-amber-500' : 'bg-[var(--color-surface-hover)] border-[var(--color-border)]'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${settings.allowMultipleInstances ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Roblox Advanced Settings */}
          <div className="col-span-2 relative overflow-hidden group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--accent-color)]/40 transition-all duration-300 flex flex-col p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-color)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <div className="flex items-center justify-between z-10 relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--accent-color)] transition-colors shrink-0">
                  <Sliders size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-none">Roblox Advanced Settings</h4>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Configure physics, graphics, memory, and client performance options.</p>
                </div>
              </div>
              <button
                onClick={() => setIsRobloxSettingsOpen(true)}
                disabled={isRobloxSettingsLoading}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent-color)] hover:brightness-110 text-white transition-all disabled:opacity-50 shrink-0"
              >
                {isRobloxSettingsLoading ? 'Loading…' : 'Configure'}
              </button>
            </div>
          </div>

        </div>
      </motion.div>

      <PinSetupDialog
        isOpen={isPinDialogOpen}
        onClose={() => setIsPinDialogOpen(false)}
        onSave={handlePinSave}
        currentPin={settings.pinCode}
      />

      <Dialog isOpen={isBackupDialogOpen} onClose={() => setIsBackupDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[var(--accent-color)]" />
              <DialogTitle>{backupStep === 'pin' ? 'Verify PIN' : 'Set Backup PIN'}</DialogTitle>
            </div>
            <DialogClose />
          </DialogHeader>
          <DialogBody className="space-y-6">
            {backupError && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-400">{backupError}</span>
              </div>
            )}
            {backupStep === 'pin' ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Enter your PIN to proceed with account backup.
                  </p>
                  {renderPinInputs(backupPin, setBackupPin, backupPinRefs)}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Create a PIN to encrypt your backup file. You'll need this PIN to restore.
                  </label>
                  {renderPinInputs(backupPin, setBackupPin, backupPinRefs)}
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Confirm PIN
                  </label>
                  {renderPinInputs(backupPinConfirm, setBackupPinConfirm, backupPinConfirmRefs)}
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsBackupDialogOpen(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBackupAccounts}
                disabled={isBackupLoading}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[var(--accent-color)] text-black hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
              >
                {isBackupLoading ? 'Creating...' : backupStep === 'pin' ? 'Next' : 'Create Backup'}
              </button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog isOpen={isRestoreDialogOpen} onClose={() => setIsRestoreDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[var(--accent-color)]" />
              <DialogTitle>
                {restoreStep === 'pin' ? 'Verify PIN' : restoreStep === 'file' ? 'Select Backup' : 'Enter Backup PIN'}
              </DialogTitle>
            </div>
            <DialogClose />
          </DialogHeader>
          <DialogBody className="space-y-6">
            {restoreError && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-400">{restoreError}</span>
              </div>
            )}
            {restoreStep === 'pin' ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Enter your PIN to proceed with account restoration.
                  </p>
                  {renderPinInputs(restorePin, setRestorePin, restorePinRefs)}
                </div>
              </>
            ) : restoreStep === 'file' ? (
              <>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Click the button below to select your backup file.
                </p>
                {selectedBackupFile && (
                  <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] p-2 rounded-lg break-all">
                    Selected: {selectedBackupFile.split('\\').pop()}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--color-text-secondary)]">
                    Enter the PIN that was used to create the backup file.
                  </label>
                  {renderPinInputs(restoreBackupPin, setRestoreBackupPin, restoreBackupPinRefs)}
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsRestoreDialogOpen(false)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={isRestoreLoading}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-[var(--accent-color)] text-black hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
              >
                {isRestoreLoading ? 'Processing...' : restoreStep === 'pin' ? 'Next' : restoreStep === 'file' ? 'Select File' : 'Restore'}
              </button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog isOpen={isRobloxSettingsOpen} onClose={() => setIsRobloxSettingsOpen(false)}>
        <DialogContent className="w-[90vw] max-w-lg h-[75vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[var(--accent-color)]" />
              <DialogTitle>Roblox Advanced Settings</DialogTitle>
            </div>
            <DialogClose />
          </DialogHeader>
          <DialogBody className="px-4 py-3 flex-1 min-h-0">
            <RobloxAdvancedSettings
              settings={robloxSettings}
              onSettingsChange={updateRobloxSettings}
              onClose={() => setIsRobloxSettingsOpen(false)}
              isLoading={isRobloxSettingsLoading}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <UserAgentSettingsModal
        isOpen={isUserAgentModalOpen}
        onClose={() => setIsUserAgentModalOpen(false)}
        currentUserAgent={currentUserAgent}
        userAgentIndex={userAgentIndex}
        allUserAgents={allUserAgents}
        isLoadingUserAgent={isLoadingUserAgent}
        isAutoSwapEnabled={isAutoSwapEnabled}
        autoSwapInterval={autoSwapInterval}
        setAutoSwapInterval={setAutoSwapInterval}
        onRotateNext={handleRotateNext}
        onSelectAgent={handleSelectAgent}
        onToggleAutoSwap={handleToggleAutoSwap}
      />
    </>
  )
}
