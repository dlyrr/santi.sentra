import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, renameSync } from 'fs'
import { app } from 'electron'
import {
  Account,
  DEFAULT_ACCENT_COLOR,
  TabId,
  ThemePreference,
  TintPreference
} from '../../../renderer/src/types'
import { MultiInstance } from '@main/lib/MultiInstance'
import { z } from 'zod'
import { favoriteItemSchema } from '../../../shared/ipc-schemas/avatar'
import { pinService } from './PinService'

import {
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
  SIDEBAR_TAB_IDS
} from '../../../shared/navigation'
import * as crypto from 'crypto'
import { getDataFile } from '../../utils/paths'

const customFontSchema = z.object({
  family: z.string(),
  url: z.string()
})

const sidebarTabIdEnum = z.enum(SIDEBAR_TAB_IDS)
const themePreferenceEnum = z.enum(['system', 'dark', 'light'])
const tintPreferenceEnum = z.enum(['neutral', 'cool', 'warm', 'forest', 'twilight'])

const storeDataSchema = z.object({
  sidebarWidth: z.number().optional(),
  sidebarCollapsed: z.boolean().optional(),
  accountsViewMode: z.enum(['list', 'grid']).optional(),
  avatarRenderWidth: z.number().optional(),
  windowWidth: z.number().optional(),
  windowHeight: z.number().optional(),
  // Encrypted accounts stored as base64 string
  encryptedAccounts: z.string().optional(),
  // Encrypted sniper-generated accounts
  encryptedSniperAccounts: z.string().optional(),
  // Encrypted license key (AES + user PIN)
  encryptedLicense: z.string().optional(),
  favoriteGames: z.array(z.string()).optional(),
  favoriteItems: z.array(favoriteItemSchema).optional(),
  excludeFullGames: z.boolean().optional(),
  customFonts: z.array(customFontSchema).optional(),
  activeFont: z.string().nullable().optional(),
  // Watcher/Multi-Account settings
  watcherConfig: z.object({
    autoRestart: z.boolean().optional(),
    enableRAMLimiter: z.boolean().optional(),
    ramLimitMB: z.number().optional(),
    enableClientTimeout: z.boolean().optional(),
    clientTimeoutSeconds: z.number().optional(),
    enableCPULimiter: z.boolean().optional(),
    cpuLimitPercent: z.number().optional()
  }).optional(),
  // Roblox-specific advanced settings
  robloxSettings: z.object({
    allowMultipleLaunches: z.boolean().optional(),
    defaultPhysicsEngine: z.enum(['Terrain', 'Legacy']).optional(),
    enableOptimizations: z.boolean().optional(),
    memoryLimit: z.number().optional(),
    useDirectX12: z.boolean().optional(),
    lowEndGraphics: z.boolean().optional(),
    disableDualChannelAudio: z.boolean().optional(),
    // Performance & Utility
    antiAfkEnabled: z.boolean().optional(),
    renameWindowsEnabled: z.boolean().optional(),
    framerateCapEnabled: z.boolean().optional(),
    framerateCapValue: z.number().optional(),
    optimizeRamEnabled: z.boolean().optional(),
    ramOptimizeLimit: z.number().optional(),
    headlessModeEnabled: z.boolean().optional(),
    timeoutRelaunchEnabled: z.boolean().optional(),
    timeoutRelaunchSeconds: z.number().optional()
  }).optional(),
  settings: z
    .object({
      primaryAccountId: z.string().nullable().optional(),
      allowMultipleInstances: z.boolean().optional(),
      defaultInstallationPath: z.string().nullable().optional(),
      accentColor: z.string().optional(),
      useDynamicAccentColor: z.boolean().optional(),
      theme: themePreferenceEnum.optional(),
      tint: tintPreferenceEnum.optional(),
      customTheme: z.string().optional(),
      privacyMode: z.boolean().optional(),
      showSidebarProfileCard: z.boolean().optional(),
      sidebarTabOrder: z.array(sidebarTabIdEnum).optional(),
      sidebarHiddenTabs: z.array(sidebarTabIdEnum).optional(),
      // pinCodeHash stores the encrypted, hashed PIN (not plain text)
      pinCodeHash: z.string().nullable().optional(),
      pinLockout: z.object({
        count: z.number(),
        lastAttempt: z.number(),
        lockedUntil: z.number().nullable()
      }).optional(),
      browserWindowWidth: z.number().nullable().optional(),
      browserWindowHeight: z.number().nullable().optional(),
      showReturnPageButton: z.boolean().optional(),
      // User Agent settings
      userAgentSettings: z.object({
        currentUserAgentIndex: z.number().default(0).optional(),
        autoSwapUserAgent: z.boolean().default(false).optional(),
        autoSwapIntervalMinutes: z.number().default(30).optional()
      }).optional()
    })
    .optional()
})

type StoreData = z.infer<typeof storeDataSchema>

class StorageService {
  private path: string
  private data: StoreData = {}
  private decryptedAccounts: Account[] | null = null
  private decryptedSniperAccounts: Account[] | null = null
  private currentVerifiedPin: string | null = null
  // holds the raw encrypted payload when config.json is encrypted
  private encryptedBlob: string | null = null
  // PIN lockout state for persistence
  private pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null as number | null }
  private pinVerificationInProgress: boolean = false

  constructor() {
    // determine current path and try migrating any prior config
    this.path = getDataFile('config.json')
    console.log('[StorageService] initializing with path', this.path)
    this.init()
  }

  private init(): void {
    try {
      this.migrateLegacyNestedConfigIfNeeded()

      if (!existsSync(this.path)) {
        const appUserData = app.getPath('userData')
        const legacyPaths = [
          join(appUserData, 'config.json'),
          join(appUserData, 'Sentra', 'config.json'),
          join(dirname(appUserData), 'sentra', 'config.json'),
          join(dirname(appUserData), 'Sentra', 'config.json')
        ]

        for (const legacyPath of legacyPaths) {
          if (legacyPath !== this.path && existsSync(legacyPath)) {
            try {
              const legacyContent = readFileSync(legacyPath, 'utf-8')
              const dir = dirname(this.path)
              if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
              writeFileSync(this.path, legacyContent)
              console.log('[StorageService] migrated config from legacy path to current data path')
              break
            } catch (e) {
              console.error('[StorageService] failed to migrate config file from legacy path:', e)
            }
          }
        }
      }

      if (existsSync(this.path)) {
        this.load()

        if ((this.encryptedBlob && !this.getPinHash()) || !this.hasAccountPayload()) {
          if (this.loadLegacyAccountConfig()) {
            console.log('[StorageService] restored legacy config during init')
          }
        }
      } else {
        const dir = dirname(this.path)
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        this.data = {}
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error)
    }
  }

  /**
   * Decrypts the full configuration blob if it was previously stored encrypted
   * and we currently have a valid encryption key (i.e. PIN has been verified).
   * This merges the decrypted data back into `this.data` and clears
   * `this.encryptedBlob` so future operations operate on real state.
   */
  #decryptConfigBlobIfNeeded(): void {
    if (!this.encryptedBlob) return
    if (!pinService.hasEncryptionKey()) return

    try {
      console.log('[StorageService] attempting to decrypt full config blob')
      const decrypted = pinService.decryptWithVerifiedKey(this.encryptedBlob)
      if (decrypted) {
        console.log('[StorageService] full config blob decrypted successfully')
        const raw = JSON.parse(decrypted)
        console.log('[StorageService] decrypted data contains encryptedAccounts?', !!raw.encryptedAccounts)
        const result = storeDataSchema.safeParse(raw)
        if (result.success) {
          this.data = result.data
          console.log('[StorageService] schema validation passed, data.encryptedAccounts?', !!this.data.encryptedAccounts)
          this.migratePin()
        } else {
          console.error('[StorageService] decrypted config validation failed, keeping raw data', result.error)
          this.data = raw as StoreData || {}
        }
      } else {
        console.error('[StorageService] failed to decrypt config blob with verified key')
        // Reset to empty to allow new saves
        this.data = {}
      }
    } catch (e) {
      console.error('[StorageService] error decrypting config blob', e)
      // Reset to empty to allow new saves
      this.data = {}
    }

    this.encryptedBlob = null
  }

  private load(): void {
    try {
      const fileContent = readFileSync(this.path, 'utf-8').replace(/^\uFEFF/, '')
      const trimmed = fileContent.trim()

      // attempt to parse as JSON; if it fails we treat the whole file as encrypted
      let rawData: unknown
      try {
        rawData = JSON.parse(trimmed)
      } catch (e) {
        console.log('[StorageService] config.json parse failed, assuming encrypted payload')
        this.encryptedBlob = trimmed
        this.data = {}
        return
      }

      // check for wrapped encrypted format
      if (
        rawData &&
        typeof rawData === 'object' &&
        'encrypted' in (rawData as any) &&
        typeof (rawData as any).encrypted === 'string'
      ) {
        const encryptedPayload = (rawData as any).encrypted.replace(/^\uFEFF/, '')
        this.encryptedBlob = encryptedPayload
        this.data = {}

        const metadata: any = {}
        if (typeof (rawData as any).pinCodeHash === 'string') {
          metadata.pinCodeHash = (rawData as any).pinCodeHash
        }
        if ((rawData as any).pinLockout && typeof (rawData as any).pinLockout === 'object') {
          metadata.pinLockout = (rawData as any).pinLockout
        }

        if (Object.keys(metadata).length > 0) {
          this.data.settings = { ...(this.data.settings ?? {}), ...metadata }
          if (metadata.pinLockout) {
            const loadedLockout = metadata.pinLockout
            const count = Number(loadedLockout.count) || 0
            const lastAttempt = Number(loadedLockout.lastAttempt) || 0
            const lockedUntil =
              loadedLockout.lockedUntil === null ? null : Number(loadedLockout.lockedUntil) || null
            this.pinLockoutState = { count, lastAttempt, lockedUntil }
          }
        }

        return
      }

      const result = storeDataSchema.safeParse(rawData)
      if (result.success) {
        this.data = result.data
        this.encryptedBlob = null // Clear any previous encrypted blob state

        // Migrate legacy PIN metadata from root-level fields into settings for current schema.
        if (!this.data.settings) {
          this.data.settings = {}
        }
        if (!this.data.settings.pinCodeHash && typeof (rawData as any).pinCodeHash === 'string') {
          this.data.settings.pinCodeHash = (rawData as any).pinCodeHash
        }
        if (!this.data.settings.pinLockout && (rawData as any).pinLockout) {
          this.data.settings.pinLockout = (rawData as any).pinLockout
        }

        this.migratePin()
        // Load PIN lockout state (with sanitization)
        const loadedLockout = this.data.settings?.pinLockout
        if (loadedLockout) {
          // coerce numbers in case something was corrupted
          const count = Number(loadedLockout.count) || 0
          const lastAttempt = Number(loadedLockout.lastAttempt) || 0
          const lockedUntil =
            loadedLockout.lockedUntil === null ? null : Number(loadedLockout.lockedUntil) || null
          this.pinLockoutState = { count, lastAttempt, lockedUntil }
        } else {
          this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null }
        }
      } else {
        console.error('Storage validation failed, keeping raw data:', result.error)
        try {
          const backupPath = this.path + '.bak'
          writeFileSync(backupPath, fileContent)
        } catch (e) {
          console.error('Failed to backup config:', e)
        }
        this.data = rawData as StoreData || {}
        this.encryptedBlob = null
      }

      if (this.data.settings?.allowMultipleInstances) {
        MultiInstance.Enable()
      } else {
        MultiInstance.Disable()
      }
    } catch (error) {
      console.error('Failed to load storage:', error)
      this.data = {}
    }
  }

  private migratePin(): void {
    // Remove any legacy unencrypted PIN data for security
    if (this.data.settings && 'pinCode' in this.data.settings) {
      delete (this.data.settings as any).pinCode
      this.save()
    }
  }

  private hasAccountPayload(): boolean {
    return !!(
      this.encryptedBlob ||
      this.data.encryptedAccounts ||
      this.data.encryptedSniperAccounts
    )
  }

  private loadLegacyAccountConfig(): boolean {
    const legacySources = [
      join(app.getPath('documents'), 'Sentra', 'config.json'),
      join(app.getPath('userData'), 'Sentra', 'config.json'),
      join(app.getPath('userData'), 'config.json')
    ]

    for (const legacyPath of legacySources) {
      if (legacyPath === this.path || !existsSync(legacyPath)) continue

      try {
        const legacyContent = readFileSync(legacyPath, 'utf-8').replace(/^\uFEFF/, '').trim()
        if (!legacyContent) continue

        let legacyData: unknown
        try {
          legacyData = JSON.parse(legacyContent)
        } catch {
          continue
        }

        const accountsPresent =
          (legacyData && typeof legacyData === 'object' && 'encryptedAccounts' in legacyData) ||
          (legacyData && typeof legacyData === 'object' && 'encryptedSniperAccounts' in legacyData) ||
          (legacyData && typeof legacyData === 'object' && 'encrypted' in legacyData)

        if (!accountsPresent) continue

        writeFileSync(this.path, legacyContent)
        this.load()
        return true
      } catch (error) {
        console.error('[StorageService] failed to load legacy account config:', error)
      }
    }

    return false
  }

  private migrateLegacyNestedConfigIfNeeded(): void {
    if (this.encryptedBlob || this.data.encryptedAccounts || this.data.encryptedSniperAccounts) {
      return
    }

    const appUserData = app.getPath('userData')
    const legacyNestedPath = join(appUserData, 'Sentra', 'config.json')
    if (legacyNestedPath === this.path || !existsSync(legacyNestedPath)) {
      return
    }

    try {
      const legacyContent = readFileSync(legacyNestedPath, 'utf-8').trim()
      if (!legacyContent) {
        return
      }

      const legacyJson = JSON.parse(legacyContent)
      const hasLegacyAccounts =
        !!legacyJson.encryptedAccounts ||
        !!legacyJson.encryptedSniperAccounts ||
        !!legacyJson.encrypted ||
        !!legacyJson.accounts

      if (!hasLegacyAccounts) {
        return
      }

      writeFileSync(this.path, legacyContent)
      console.log('[StorageService] migrated legacy nested config into current data path')
      this.load()
    } catch (error) {
      console.error('[StorageService] failed to migrate legacy nested config:', error)
    }
  }

  private save(): void {
    // if the config is still stored as an encrypted blob and we do not have
    // the derived encryption key available, we cannot safely overwrite it.
    if (this.encryptedBlob && !pinService.hasEncryptionKey()) {
      console.warn('[StorageService] save called while config is still encrypted and PIN key unavailable; skipping write')
      return
    }

    if (this.encryptedBlob && pinService.hasEncryptionKey()) {
      this.#decryptConfigBlobIfNeeded()
    }

    try {
      // make sure the directory is still there (macOS cleaners may remove it)
      const dir = dirname(this.path)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      let output: string

      // Update PIN lockout state in data before saving
      if (!this.data.settings) {
        this.data.settings = {}
      }
      this.data.settings.pinLockout = this.pinLockoutState

      if (pinService.hasEncryptionKey()) {
        console.log('[StorageService] save() encrypting data. has encryptedAccounts?', !!this.data.encryptedAccounts, 'field:', this.data.encryptedAccounts ? this.data.encryptedAccounts.substring(0, 50) : 'NONE')
        const plain = JSON.stringify(this.data, null, 2)
        const enc = pinService.encryptWithVerifiedKey(plain)
        if (enc) {
          const wrapper: Record<string, unknown> = { encrypted: enc }
          if (this.data.settings?.pinCodeHash) {
            wrapper.pinCodeHash = this.data.settings.pinCodeHash
          }
          if (this.pinLockoutState) {
            wrapper.pinLockout = this.pinLockoutState
          }
          output = JSON.stringify(wrapper, null, 2)
          console.log('[StorageService] save() encrypted wrapper created, size:', output.length)
        } else {
          console.error('[StorageService] failed to encrypt full config with PIN')
          output = JSON.stringify(this.data, null, 2)
        }
      } else if (this.data.settings?.pinCodeHash && this.encryptedBlob) {
        // PIN is set but encryption key unavailable - preserve encrypted blob wrapper without decrypting
        // This prevents data loss when PIN key becomes temporarily unavailable
        console.warn('[StorageService] save() called without PIN key while config has PIN hash; preserving encrypted blob')
        const wrapper: Record<string, unknown> = { encrypted: this.encryptedBlob }
        if (this.data.settings.pinCodeHash) {
          wrapper.pinCodeHash = this.data.settings.pinCodeHash
        }
        if (this.pinLockoutState) {
          wrapper.pinLockout = this.pinLockoutState
        }
        output = JSON.stringify(wrapper, null, 2)
      } else {
        // No PIN set, save as plaintext
        output = JSON.stringify(this.data, null, 2)
      }

      // Atomic write: write to a temp file first, then rename.
      // This prevents config.json from being left in a corrupted state
      // if the app crashes or loses power mid-write.
      const tmpPath = this.path + '.tmp'
      writeFileSync(tmpPath, output)
      renameSync(tmpPath, this.path)
    } catch (error) {
      console.error('Failed to save storage:', error)
    }
  }

  /**
   * Update only the PIN hash in the file while preserving encrypted blob
   * This bypasses the save() guard to allow lockout state updates during verification
   */
  #updatePinHashOnly(newPinHash: string): void {
    try {
      const fileContent = readFileSync(this.path, 'utf-8')
      const parsed = JSON.parse(fileContent.trim())

      // Update only the PIN hash, preserve everything else (especially encrypted blob)
      parsed.pinCodeHash = newPinHash

      writeFileSync(this.path, JSON.stringify(parsed, null, 2))
      console.log('[StorageService] PIN hash updated (lockout state persisted)')
    } catch (err) {
      console.warn('[StorageService] Failed to update PIN hash in file:', err)
    }
  }

  #persistPinMetadata(): void {
    if (!this.data.settings) {
      this.data.settings = {}
    }
    this.data.settings.pinLockout = this.pinLockoutState

    if (this.encryptedBlob && !pinService.hasEncryptionKey()) {
      try {
        const fileContent = readFileSync(this.path, 'utf-8')
        const parsed = JSON.parse(fileContent.trim())
        if (parsed && typeof parsed === 'object') {
          if (this.data.settings.pinCodeHash) parsed.pinCodeHash = this.data.settings.pinCodeHash
          parsed.pinLockout = this.pinLockoutState
          writeFileSync(this.path, JSON.stringify(parsed, null, 2))
          return
        }
      } catch (err) {
        console.warn('[StorageService] Failed to persist PIN metadata directly:', err)
      }
    }

    this.save()
  }

  private encryptAccountsWithPin(accounts: Account[], pin: string): string | null {
    try {
      // Derive key from PIN using PBKDF2 (256-bit key)
      const salt = crypto.randomBytes(16)
      const key = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256')

      // Generate IV and encryption cipher
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

      // Encrypt the accounts JSON
      const plaintext = JSON.stringify(accounts)
      let encrypted = cipher.update(plaintext, 'utf-8', 'hex')
      encrypted += cipher.final('hex')

      // Get authentication tag
      const authTag = cipher.getAuthTag()

      // Combine: salt + iv + authTag + encrypted data (all hex encoded)
      const combined = salt.toString('hex') + iv.toString('hex') + authTag.toString('hex') + encrypted

      return combined
    } catch (error) {
      console.error('Failed to encrypt accounts:', error)
      return null
    }
  }

  /**
   * Decrypt accounts with PIN using AES-256-GCM (NO plaintext fallback)
   */
  private decryptAccountsWithPin(encryptedData: string, pin: string): Account[] | null {
    try {
      // Parse: salt (32 hex chars) + iv (24 hex chars) + authTag (32 hex chars) + encrypted data (rest)
      if (encryptedData.length < 88) {
        // Too short to be encrypted data
        console.warn('[StorageService] PIN-based decrypt: data too short')
        return null
      }

      const salt = Buffer.from(encryptedData.substring(0, 32), 'hex')
      const iv = Buffer.from(encryptedData.substring(32, 56), 'hex')
      const authTag = Buffer.from(encryptedData.substring(56, 88), 'hex')
      const encrypted = encryptedData.substring(88)

      // Derive key from PIN
      const key = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256')

      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(authTag)

      let plaintext = decipher.update(encrypted, 'hex', 'utf-8')
      plaintext += decipher.final('utf-8')

      const accounts = JSON.parse(plaintext)
      return Array.isArray(accounts) ? accounts : null
    } catch (error) {
      console.error('[StorageService] Failed to decrypt accounts:', error)
      return null
    }
  }

  public getSidebarWidth(): number | undefined {
    return this.data.sidebarWidth
  }

  public setSidebarWidth(width: number): void {
    this.data.sidebarWidth = width
    this.save()
  }

  public getSidebarCollapsed(): boolean {
    return this.data.sidebarCollapsed ?? false
  }

  public setSidebarCollapsed(collapsed: boolean): void {
    this.data.sidebarCollapsed = collapsed
    this.save()
  }

  public getAccountsViewMode(): 'list' | 'grid' {
    return this.data.accountsViewMode ?? 'list'
  }

  public setAccountsViewMode(mode: 'list' | 'grid'): void {
    this.data.accountsViewMode = mode
    this.save()
  }

  /**
   * Get accounts - ALWAYS decrypted, no plaintext fallback
   */
  public getAccounts(): Account[] {
    // if the entire config is still encrypted we have no data yet
    if (this.encryptedBlob) {
      console.log('[StorageService] getAccounts: config is still encrypted, attempting decryption')
      // attempt decryption if we have the key available (PIN verified)
      this.#decryptConfigBlobIfNeeded()
      if (this.encryptedBlob) {
        console.log('[StorageService] getAccounts: decryption failed or no key, returning empty')
        return []
      }
      console.log('[StorageService] getAccounts: decryption succeeded, encryptedAccounts now:', !!this.data.encryptedAccounts)
    }

    const pinHash = this.getPinHash()

    // If we haven't decrypted yet, try to decrypt
    if (this.decryptedAccounts === null && this.data.encryptedAccounts) {
      console.log('[StorageService] getAccounts: need to decrypt accounts. pinHash:', !!pinHash, 'currentVerifiedPin:', !!this.currentVerifiedPin)
      if (pinHash) {
        if (this.currentVerifiedPin) {
          this.decryptedAccounts = this.decryptAccountsWithPin(
            this.data.encryptedAccounts,
            this.currentVerifiedPin
          )
          console.log('[StorageService] getAccounts: decrypted', this.decryptedAccounts?.length, 'accounts')
          if (!this.decryptedAccounts) {
            const raw = this.data.encryptedAccounts.trim()
            if (raw.startsWith('[') || raw.startsWith('{')) {
              try {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) {
                  this.decryptedAccounts = parsed
                }
              } catch {
                // ignore malformed plaintext fallback
              }
            }
            this.decryptedAccounts = this.decryptedAccounts ?? []
          }
        } else {
          console.log('[StorageService] getAccounts: PIN not verified yet, returning empty')
          this.decryptedAccounts = []
        }
      } else {
        try {
          const parsed = JSON.parse(this.data.encryptedAccounts)
          if (Array.isArray(parsed)) {
            this.decryptedAccounts = parsed
          } else {
            this.decryptedAccounts = []
          }
        } catch (error) {
          this.decryptedAccounts = []
        }
      }
    }

    // If PIN is set but not verified and we still don't have decrypted accounts, return empty
    if (pinHash && !this.currentVerifiedPin && this.decryptedAccounts?.length === 0) {
      return []
    }

    return this.decryptedAccounts || []
  }

  /**
   * Set accounts - PIN-based encryption only (matches old working code)
   */
  public setAccounts(accounts: Account[]): boolean {
    console.log('[StorageService] setAccounts: Called with', accounts.length, 'accounts. pinHash exists:', !!this.getPinHash(), 'currentVerifiedPin exists:', !!this.currentVerifiedPin)
    const pinHash = this.getPinHash()

    // If PIN is set, encrypt with current verified PIN
    if (pinHash) {
      if (!this.currentVerifiedPin) {
        console.error('[StorageService] setAccounts: PIN hash exists but PIN not currently verified. Cannot save encrypted accounts.')
        // Instead of throwing, we need a mechanism to get the PIN verified
        // For now, throw so the caller can handle it
        throw new Error('PIN must be verified before saving accounts')
      }

      const pinToUse = this.currentVerifiedPin
      let encrypted: string | null = null
      try {
        encrypted = this.encryptAccountsWithPin(accounts, pinToUse)
      } catch (e) {
        throw new Error('Failed to encrypt accounts: ' + String(e))
      }

      if (!encrypted) {
        throw new Error('Failed to encrypt accounts: result was null')
      }

      console.log('[StorageService] setAccounts: Encrypting', accounts.length, 'accounts with PIN')
      this.data.encryptedAccounts = encrypted
      this.decryptedAccounts = accounts
      this.save()
      console.log('[StorageService] setAccounts: ✓ Saved', accounts.length, 'encrypted accounts to disk')
      return true
    } else {
      // No PIN yet - store plaintext for now
      console.log('[StorageService] setAccounts: Saving', accounts.length, 'plaintext accounts (no PIN set yet)')
      this.data.encryptedAccounts = JSON.stringify(accounts)
      this.decryptedAccounts = accounts
      this.save()
      console.log('[StorageService] setAccounts: ✓ Saved', accounts.length, 'plaintext accounts (no PIN)')
      return true
    }
  }
  public getDecryptedPassword(password?: string): string {
    if (!password) {
      return ''
    }
    // Passwords are now stored plaintext in Account objects
    // Encryption happens at the JSON level in config.json
    return password
  }

  /**
   * Add accounts to storage for auto-generated accounts
   */
  public addAccountsToStorage(newAccounts: Account[]): boolean {
    try {
      const existingAccounts = this.getAccounts() || []
      const combinedAccounts = [...existingAccounts, ...newAccounts]
      return this.setAccounts(combinedAccounts)
    } catch (err) {
      console.error('[StorageService] addAccountsToStorage error:', err)
      throw err
    }
  }


  public removeAccount(accountId: string): boolean {
    const accounts = this.getAccounts()
    return this.setAccounts(accounts.filter((a) => a.id !== accountId))
  }

  public updateAccount(accountId: string, updates: Partial<Account>): boolean {
    const accounts = this.getAccounts()
    const index = accounts.findIndex((a) => a.id === accountId)
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates }
      return this.setAccounts(accounts)
    }
    return false
  }

  /**
   * Get sniper-generated accounts (separate from main accounts)
   */
  public getSniperAccounts(): Account[] {
    const pinHash = this.getPinHash()

    // If we haven't decrypted yet, try to decrypt
    if (this.decryptedSniperAccounts === null && this.data.encryptedSniperAccounts) {
      if (pinHash) {
        // PIN is set - need verified PIN to decrypt
        if (this.currentVerifiedPin) {
          this.decryptedSniperAccounts = this.decryptAccountsWithPin(
            this.data.encryptedSniperAccounts,
            this.currentVerifiedPin
          )
          if (!this.decryptedSniperAccounts) {
            this.decryptedSniperAccounts = []
          }
        } else {
          this.decryptedSniperAccounts = []
        }
      } else {
        // No PIN set - try to load as plaintext
        try {
          const parsed = JSON.parse(this.data.encryptedSniperAccounts)
          this.decryptedSniperAccounts = Array.isArray(parsed) ? parsed : []
        } catch (error) {
          this.decryptedSniperAccounts = []
        }
      }
    }

    return this.decryptedSniperAccounts || []
  }

  /**
   * Set sniper-generated accounts
   */
  public setSniperAccounts(accounts: Account[]): boolean {
    const pinHash = this.getPinHash()

    if (pinHash) {
      if (!this.currentVerifiedPin) {
        throw new Error('PIN must be verified before saving accounts')
      }

      const encrypted = this.encryptAccountsWithPin(accounts, this.currentVerifiedPin)
      if (!encrypted) {
        throw new Error('Failed to encrypt sniper accounts')
      }

      this.data.encryptedSniperAccounts = encrypted
      this.decryptedSniperAccounts = accounts
      this.save()
      return true
    } else {
      this.data.encryptedSniperAccounts = JSON.stringify(accounts)
      this.decryptedSniperAccounts = accounts
      this.save()
      return true
    }
  }

  /**
   * Add a sniper-generated account (prevent duplicates by username)
   */
  public addSniperAccount(newAccount: Account): boolean {
    try {
      const existing = this.getSniperAccounts() || []
      
      // Check if account with same username already exists
      if (existing.some(acc => acc.username === newAccount.username)) {
        console.log('[StorageService] Sniper account already exists:', newAccount.username)
        return true // Don't add duplicate
      }

      const combined = [newAccount, ...existing]
      return this.setSniperAccounts(combined)
    } catch (err) {
      console.error('[StorageService] addSniperAccount error:', err)
      throw err
    }
  }

  /**
   * Remove a sniper account
   */
  public removeSniperAccount(accountId: string): boolean {
    const accounts = this.getSniperAccounts()
    return this.setSniperAccounts(accounts.filter((a) => a.id !== accountId))
  }

  /**
   * Move sniper account to main accounts
   */
  public moveSniperAccountToMain(accountId: string): boolean {
    const sniperAccounts = this.getSniperAccounts()
    const account = sniperAccounts.find(a => a.id === accountId)
    
    if (!account) return false

    // Add to main accounts
    this.addAccountsToStorage([account])
    
    // Remove from sniper accounts
    return this.removeSniperAccount(accountId)
  }

  public getFavoriteGames(): string[] {
    return this.data.favoriteGames || []
  }

  public addFavoriteGame(placeId: string): void {
    const favorites = this.data.favoriteGames || []
    if (!favorites.includes(placeId)) {
      this.data.favoriteGames = [...favorites, placeId]
      this.save()
    }
  }

  public removeFavoriteGame(placeId: string): void {
    const favorites = this.data.favoriteGames || []
    this.data.favoriteGames = favorites.filter((id) => id !== placeId)
    this.save()
  }

  public getFavoriteItems(): { id: number; name: string; type: string }[] {
    return this.data.favoriteItems || []
  }

  public addFavoriteItem(item: { id: number; name: string; type: string }): void {
    const favorites = this.data.favoriteItems || []
    if (!favorites.some((i) => i.id === item.id)) {
      this.data.favoriteItems = [...favorites, item]
      this.save()
    }
  }

  public removeFavoriteItem(itemId: number): void {
    const favorites = this.data.favoriteItems || []
    this.data.favoriteItems = favorites.filter((i) => i.id !== itemId)
    this.save()
  }

  public getSettings() {
    const sidebarTabOrder = sanitizeSidebarOrder(this.data.settings?.sidebarTabOrder)
    const sidebarHiddenTabs = sanitizeSidebarHidden(this.data.settings?.sidebarHiddenTabs)
    const storedAccent = this.data.settings?.accentColor
    const legacyAccent = storedAccent ? storedAccent.trim().toLowerCase() : ''
    const LEGACY_DEFAULT_ACCENT_COLORS = ['#1e66f5', '#3b82f6', '#2563eb']

    const accentColor =
      legacyAccent && legacyAccent !== '#ffffff'
        ? LEGACY_DEFAULT_ACCENT_COLORS.includes(legacyAccent)
          ? DEFAULT_ACCENT_COLOR
          : storedAccent!
        : DEFAULT_ACCENT_COLOR

    // Persist the migration so future sessions match.
    if (legacyAccent && LEGACY_DEFAULT_ACCENT_COLORS.includes(legacyAccent)) {
      if (!this.data.settings) this.data.settings = {}
      if (this.data.settings.accentColor !== DEFAULT_ACCENT_COLOR) {
        this.data.settings.accentColor = DEFAULT_ACCENT_COLOR
        this.save()
      }
    }

    return {
      primaryAccountId: this.data.settings?.primaryAccountId ?? null,
      allowMultipleInstances: this.data.settings?.allowMultipleInstances ?? false,
      defaultInstallationPath: this.data.settings?.defaultInstallationPath ?? null,
      accentColor,
      useDynamicAccentColor: this.data.settings?.useDynamicAccentColor ?? false,
      theme: (this.data.settings?.theme as ThemePreference | undefined) ?? 'system',
      tint: (this.data.settings?.tint as TintPreference | undefined) ?? 'neutral',
      showSidebarProfileCard: this.data.settings?.showSidebarProfileCard ?? true,
      privacyMode: this.data.settings?.privacyMode ?? false,
      sidebarTabOrder,
      sidebarHiddenTabs,
      pinCode: this.data.settings?.pinCodeHash ? 'SET' : null,
      browserWindowWidth: this.data.settings?.browserWindowWidth ?? null,
      browserWindowHeight: this.data.settings?.browserWindowHeight ?? null,
      showReturnPageButton: this.data.settings?.showReturnPageButton ?? false,
      userAgentSettings: {
        currentUserAgentIndex: this.data.settings?.userAgentSettings?.currentUserAgentIndex ?? 0,
        autoSwapUserAgent: this.data.settings?.userAgentSettings?.autoSwapUserAgent ?? false,
        autoSwapIntervalMinutes: this.data.settings?.userAgentSettings?.autoSwapIntervalMinutes ?? 30
      }
    }
  }

  /**
   * Get the raw encrypted PIN hash for verification
   */
  private isBase64PinHash(raw: string): boolean {
    return /^[A-Za-z0-9+/]+={0,2}$/.test(raw) && raw.length % 4 === 0
  }

  public getPinHash(): string | null {
    const hash = this.data.settings?.pinCodeHash ?? null
    if (!hash || typeof hash !== 'string') return null

    const parts = hash.split(':')
    const isColonHexFormat =
      (parts.length === 2 || parts.length === 3) &&
      parts.every((part) => /^[0-9a-f]+$/i.test(part) && part.length > 0)

    if (isColonHexFormat) {
      return hash
    }

    if (this.isBase64PinHash(hash)) {
      return hash
    }

    console.warn('[StorageService] Invalid PIN hash format detected, removing corrupted PIN data')
    if (this.data.settings) {
      delete this.data.settings.pinCodeHash
      delete this.data.settings.pinLockout
    }
    this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null }
    this.save()
    return null
  }

  /**
   * Get encrypted license (if any)
   */
  public getEncryptedLicense(): string | null {
    return this.data.encryptedLicense ?? null
  }

  /**
   * Store an encrypted license string (or null to clear)
   */
  public setEncryptedLicense(encrypted: string | null): void {
    if (encrypted === null) {
      if (this.data.encryptedLicense) delete this.data.encryptedLicense
    } else {
      this.data.encryptedLicense = encrypted
    }
    this.save()
  }

  /**
   * Delete encrypted license
   */
  public deleteEncryptedLicense(): void {
    if (this.data.encryptedLicense) {
      delete this.data.encryptedLicense
      this.save()
    }
  }

  /**
   * Clear all stored data and delete any existing config files.
   */
  public clearAll(): void {
    this.data = {}
    this.decryptedAccounts = null
    this.decryptedSniperAccounts = null
    this.encryptedBlob = null
    this.currentVerifiedPin = null
    this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null }

    try {
      MultiInstance.Disable()
    } catch (e) {
      // ignore
    }

    const legacyPaths = [
      this.path,
      join(app.getPath('userData'), 'config.json'),
      join(app.getPath('userData'), 'Sentra', 'config.json'),
      join(app.getPath('documents'), 'Sentra', 'config.json')
    ]

    for (const pathToDelete of legacyPaths) {
      try {
        if (existsSync(pathToDelete)) {
          unlinkSync(pathToDelete)
        }
      } catch (error) {
        console.error('[StorageService] failed to delete legacy config file during clearAll:', pathToDelete, error)
      }
    }
  }

  /**
   * Set a new PIN (will be hashed and encrypted)
   */
  public setPin(
    pin: string | null,
    currentPin?: string
  ): {
    success: boolean
    error?: string
    locked?: boolean
    lockoutSeconds?: number
    remainingAttempts?: number
  } {
    const existingHash = this.getPinHash()
    const now = Date.now()

    // Ensure we can access accounts before changing PIN
    // If accounts haven't been decrypted yet, decrypt them with current PIN
    let accounts = this.decryptedAccounts
    if (!accounts && this.data.encryptedAccounts && existingHash && currentPin?.trim()) {
      // Decrypt existing accounts with current PIN so we can re-encrypt with new PIN
      accounts = this.decryptAccountsWithPin(this.data.encryptedAccounts, currentPin.trim())
      if (!accounts) {
        // If decryption fails, return error
        return { success: false, error: 'Failed to prepare accounts for re-encryption' }
      }
    } else {
      accounts = accounts || []

      // If we're creating a new PIN and the stored accounts are still plaintext JSON,
      // parse them so they can be migrated into the new encrypted format.
      if (!existingHash && this.data.encryptedAccounts && accounts.length === 0) {
        try {
          const parsedAccounts = JSON.parse(this.data.encryptedAccounts)
          if (Array.isArray(parsedAccounts)) {
            accounts = parsedAccounts
          }
        } catch {
          // if parsing fails, keep the empty array and continue
        }
      }
    }

    if (existingHash && accounts.length > 0) {
      if (!currentPin) {
        return { success: false, error: 'Current PIN required to change or remove PIN' }
      }

      // Check if currently locked from previous failed attempts
      if (this.pinLockoutState.lockedUntil && now < this.pinLockoutState.lockedUntil) {
        const lockoutSeconds = Math.ceil((this.pinLockoutState.lockedUntil - now) / 1000)
        return {
          success: false,
          error: 'Too many failed attempts',
          locked: true,
          lockoutSeconds,
          remainingAttempts: 0
        }
      }

      const verifyResult = pinService.verifyPin(currentPin?.trim() || '', existingHash)
      if (!verifyResult.success) {
        // Track failed PIN verification attempt
        this.pinLockoutState.count++
        this.pinLockoutState.lastAttempt = now
        const remainingAttempts = Math.max(0, 5 - this.pinLockoutState.count)

        if (this.pinLockoutState.count >= 5) {
          // Apply lockout after 5 failed attempts
          const lockoutMultiplier = Math.min(this.pinLockoutState.count - 4, 12)
          const lockoutDuration = 5 * 60 * 1000 * lockoutMultiplier
          this.pinLockoutState.lockedUntil = now + lockoutDuration
          this.save()
          return {
            success: false,
            error: 'Too many failed attempts',
            locked: true,
            lockoutSeconds: Math.ceil(lockoutDuration / 1000),
            remainingAttempts: 0
          }
        }

        this.save()
        return {
          success: false,
          error: 'Incorrect current PIN',
          locked: false,
          remainingAttempts
        }
      }

      // Reset lockout state on successful verification
      this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null }
    }

    if (pin === null) {
      if (this.data.settings) {
        this.data.settings.pinCodeHash = null
      }
      pinService.resetAttempts()
      pinService.markVerified()
      this.currentVerifiedPin = null
      this.decryptedAccounts = null
      // Reset lockout state when removing PIN
      this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null }
      this.save()
      return { success: true }
    }

    const hash = pinService.createPinHash(pin.trim())

    if (!hash) {
      console.error('Secure storage unavailable. PIN will not be stored unencrypted.')
      return { success: false, error: 'Secure storage unavailable' }
    }

    if (!this.data.settings) {
      this.data.settings = {}
    }

    this.data.settings.pinCodeHash = hash

    // Reset PIN lockout state for new PIN
    this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null }

    // Verify the new PIN to set the internal encryption key state
    pinService.verifyPin(pin.trim(), hash)
    pinService.resetAttempts()
    pinService.markVerified()
    this.currentVerifiedPin = pin.trim()

    // Re-encrypt accounts with new PIN
    if (accounts.length > 0) {
      const encrypted = this.encryptAccountsWithPin(accounts, pin)
      if (encrypted) {
        this.data.encryptedAccounts = encrypted
      }
    }

    this.save()
    return { success: true }
  }

  /**
   * Verify a PIN attempt for app unlock
   * Uses PinService.verifyPinEncrypted which properly handles lockout state
   */
  public verifyPin(pin: string): {
    success: boolean
    locked: boolean
    remainingAttempts: number
    lockoutSeconds?: number
    accounts?: Account[]
  } {
    const trimmedPin = pin.trim()
    let storedHash = this.getPinHash()

    if (!storedHash) {
      const recovered = this.loadLegacyAccountConfig()
      if (recovered) {
        storedHash = this.getPinHash()
      }
    }

    const now = Date.now()

    // Check if currently locked
    if (this.pinLockoutState.lockedUntil && now < this.pinLockoutState.lockedUntil) {
      const lockoutSeconds = Math.ceil((this.pinLockoutState.lockedUntil - now) / 1000)
      return { success: false, locked: true, remainingAttempts: 0, lockoutSeconds }
    }

    // Check if attempts should reset (15 minutes since last attempt)
    if (this.pinLockoutState.lastAttempt && now - this.pinLockoutState.lastAttempt > 15 * 60 * 1000) {
      this.pinLockoutState.count = 0
      this.pinLockoutState.lastAttempt = 0
      this.pinLockoutState.lockedUntil = null
    }

    if (!storedHash) {
      return { success: false, locked: false, remainingAttempts: 5 }
    }

    const verifyResult = pinService.verifyPin(trimmedPin, storedHash)

    if (verifyResult.success) {
      console.log('[StorageService] PIN verification successful')
      this.currentVerifiedPin = trimmedPin
      pinService.resetAttempts()
      pinService.markVerified()

      // Reset lockout state on successful verification
      this.pinLockoutState.count = 0
      this.pinLockoutState.lastAttempt = 0
      this.pinLockoutState.lockedUntil = null
      this.save()  // This also decrypts the config blob via #decryptConfigBlobIfNeeded

      this.#decryptConfigBlobIfNeeded()  // Ensure blob is decrypted (no-op if already done)
      this.decryptedAccounts = null  // Force fresh decryption via getAccounts()
      console.log('[StorageService] verifyPin: ✓ PIN verified, decryptedAccounts cache cleared for re-decryption')

      // Decrypt accounts now and return them directly so the renderer
      // doesn't need a separate getAccounts() IPC round-trip
      const accounts = this.getAccounts()
      console.log('[StorageService] verifyPin: Returning', accounts.length, 'accounts')
      return { success: true, locked: false, remainingAttempts: 5, accounts }
    } else {
      console.log('[StorageService] PIN verification failed, updating lockout state')
    }

    // Failed attempt - update lockout state
    this.pinLockoutState.count++
    this.pinLockoutState.lastAttempt = now

    const remainingAttempts = Math.max(0, 5 - this.pinLockoutState.count)

    if (this.pinLockoutState.count >= 5) {
      // Calculate lockout duration with progressive penalty
      const lockoutMultiplier = Math.min(this.pinLockoutState.count - 4, 12)
      const lockoutDuration = 5 * 60 * 1000 * lockoutMultiplier
      this.pinLockoutState.lockedUntil = now + lockoutDuration
      this.#persistPinMetadata()
      return {
        success: false,
        locked: true,
        remainingAttempts: 0,
        lockoutSeconds: Math.ceil(lockoutDuration / 1000)
      }
    }

    this.#persistPinMetadata()
    return { success: false, locked: false, remainingAttempts }
  }

  /**
   * Check if PIN is currently verified (delegates to PinService)
   */
  public isPinCurrentlyVerified(): boolean {
    return pinService.isPinCurrentlyVerified()
  }

  /**
   * Get PIN lockout status
   */
  public getPinLockoutStatus(): {
    locked: boolean
    lockoutSeconds?: number
    remainingAttempts: number
  } {
    const now = Date.now()

    // Check if currently locked
    if (this.pinLockoutState.lockedUntil && now < this.pinLockoutState.lockedUntil) {
      const seconds = Math.ceil((this.pinLockoutState.lockedUntil - now) / 1000)
      return { locked: true, lockoutSeconds: seconds, remainingAttempts: 0 }
    }

    // Check if attempts should reset
    if (this.pinLockoutState.lastAttempt && now - this.pinLockoutState.lastAttempt > 15 * 60 * 1000) {
      this.pinLockoutState.count = 0
      this.pinLockoutState.lastAttempt = 0
      this.pinLockoutState.lockedUntil = null
    }

    const remainingAttempts = Math.max(0, 5 - this.pinLockoutState.count)
    return { locked: false, remainingAttempts }
  }

  public setSettings(settings: {
    primaryAccountId?: string | null
    allowMultipleInstances?: boolean
    defaultInstallationPath?: string | null
    accentColor?: string
    useDynamicAccentColor?: boolean
    theme?: ThemePreference
    tint?: TintPreference
    showSidebarProfileCard?: boolean
    privacyMode?: boolean
    sidebarTabOrder?: TabId[]
    sidebarHiddenTabs?: TabId[]
    pinCode?: string | null
    browserWindowWidth?: number | null
    browserWindowHeight?: number | null
    showReturnPageButton?: boolean
    userAgentSettings?: {
      currentUserAgentIndex?: number
      autoSwapUserAgent?: boolean
      autoSwapIntervalMinutes?: number
    }
  }): void {
    const nextSettings = { ...this.getSettings() }

    if ('primaryAccountId' in settings) {
      nextSettings.primaryAccountId = settings.primaryAccountId ?? null
    }

    if ('allowMultipleInstances' in settings) {
      nextSettings.allowMultipleInstances = !!settings.allowMultipleInstances
    }

    if ('defaultInstallationPath' in settings) {
      nextSettings.defaultInstallationPath = settings.defaultInstallationPath ?? null
    }

    if ('accentColor' in settings && typeof settings.accentColor === 'string') {
      nextSettings.accentColor = settings.accentColor
    }

    if ('useDynamicAccentColor' in settings) {
      nextSettings.useDynamicAccentColor = !!settings.useDynamicAccentColor
    }

    if ('theme' in settings && typeof settings.theme === 'string') {
      nextSettings.theme = settings.theme as ThemePreference
    }

    if ('tint' in settings && typeof settings.tint === 'string') {
      nextSettings.tint = settings.tint as TintPreference
    }

    if ('showSidebarProfileCard' in settings) {
      nextSettings.showSidebarProfileCard = !!settings.showSidebarProfileCard
    }

    if ('privacyMode' in settings) {
      nextSettings.privacyMode = !!settings.privacyMode
    }

    if ('sidebarTabOrder' in settings) {
      nextSettings.sidebarTabOrder = sanitizeSidebarOrder(
        Array.isArray(settings.sidebarTabOrder)
          ? (settings.sidebarTabOrder as TabId[])
          : nextSettings.sidebarTabOrder
      )
    }

    if ('sidebarHiddenTabs' in settings) {
      nextSettings.sidebarHiddenTabs = sanitizeSidebarHidden(
        Array.isArray(settings.sidebarHiddenTabs)
          ? (settings.sidebarHiddenTabs as TabId[])
          : nextSettings.sidebarHiddenTabs
      )
    }

    if ('pinCode' in settings) {
      this.setPin(settings.pinCode ?? null)
    }

    if ('browserWindowWidth' in settings) {
      nextSettings.browserWindowWidth = settings.browserWindowWidth ?? null
    }

    if ('browserWindowHeight' in settings) {
      nextSettings.browserWindowHeight = settings.browserWindowHeight ?? null
    }

    if ('showReturnPageButton' in settings) {
      nextSettings.showReturnPageButton = !!settings.showReturnPageButton
    }

    if ('userAgentSettings' in settings && settings.userAgentSettings) {
      nextSettings.userAgentSettings = {
        currentUserAgentIndex: typeof settings.userAgentSettings.currentUserAgentIndex === 'number' ? settings.userAgentSettings.currentUserAgentIndex : (nextSettings.userAgentSettings?.currentUserAgentIndex ?? 0),
        autoSwapUserAgent: !!settings.userAgentSettings.autoSwapUserAgent,
        autoSwapIntervalMinutes: typeof settings.userAgentSettings.autoSwapIntervalMinutes === 'number' ? settings.userAgentSettings.autoSwapIntervalMinutes : (nextSettings.userAgentSettings?.autoSwapIntervalMinutes ?? 30)
      }
    }

    nextSettings.sidebarTabOrder = sanitizeSidebarOrder(nextSettings.sidebarTabOrder)
    nextSettings.sidebarHiddenTabs = sanitizeSidebarHidden(nextSettings.sidebarHiddenTabs)

    const { pinCode, ...settingsWithoutPin } = nextSettings
    void pinCode
    this.data.settings = {
      ...(this.data.settings ?? {}),
      ...(settingsWithoutPin as any)
    }
    this.save()

    if (nextSettings.allowMultipleInstances) {
      MultiInstance.Enable()
    } else {
      MultiInstance.Disable()
    }
  }

  public getExcludeFullGames(): boolean {
    return this.data.excludeFullGames ?? false
  }

  public setExcludeFullGames(excludeFullGames: boolean): void {
    this.data.excludeFullGames = excludeFullGames
    this.save()
  }

  public getAvatarRenderWidth(): number | undefined {
    return this.data.avatarRenderWidth
  }

  public setAvatarRenderWidth(width: number): void {
    this.data.avatarRenderWidth = width
    this.save()
  }

  public getWindowWidth(): number | undefined {
    return this.data.windowWidth
  }

  public setWindowWidth(width: number): void {
    this.data.windowWidth = width
    this.save()
  }

  public getWindowHeight(): number | undefined {
    return this.data.windowHeight
  }

  public setWindowHeight(height: number): void {
    this.data.windowHeight = height
    this.save()
  }

  public getCustomFonts(): { family: string; url: string }[] {
    return this.data.customFonts || []
  }

  public addCustomFont(font: { family: string; url: string }): void {
    const fonts = this.data.customFonts || []
    if (!fonts.some((f) => f.family === font.family)) {
      this.data.customFonts = [...fonts, font]
      this.save()
    }
  }

  public removeCustomFont(family: string): void {
    const fonts = this.data.customFonts || []
    this.data.customFonts = fonts.filter((f) => f.family !== family)
    if (this.data.activeFont === family) {
      this.data.activeFont = null
    }
    this.save()
  }

  public getActiveFont(): string | null {
    return this.data.activeFont ?? null
  }

  public setActiveFont(family: string | null): void {
    this.data.activeFont = family
    this.save()
  }

  /**
   * Get watcher configuration
   */
  public getWatcherConfig(): { 
    autoRestart: boolean
    enableRAMLimiter: boolean
    ramLimitMB: number
    enableClientTimeout: boolean
    clientTimeoutSeconds: number
    enableCPULimiter: boolean
    cpuLimitPercent: number
  } {
    return {
      autoRestart: this.data.watcherConfig?.autoRestart ?? true,
      enableRAMLimiter: this.data.watcherConfig?.enableRAMLimiter ?? false,
      ramLimitMB: this.data.watcherConfig?.ramLimitMB ?? 800,
      enableClientTimeout: this.data.watcherConfig?.enableClientTimeout ?? false,
      clientTimeoutSeconds: this.data.watcherConfig?.clientTimeoutSeconds ?? 3600, // 1 hour default
      enableCPULimiter: this.data.watcherConfig?.enableCPULimiter ?? false,
      cpuLimitPercent: this.data.watcherConfig?.cpuLimitPercent ?? 80
    }
  }

  /**
   * Set watcher configuration
   */
  public setWatcherConfig(config: { 
    autoRestart?: boolean
    enableRAMLimiter?: boolean
    ramLimitMB?: number
    enableClientTimeout?: boolean
    clientTimeoutSeconds?: number
    enableCPULimiter?: boolean
    cpuLimitPercent?: number
  }): void {
    if (!this.data.watcherConfig) {
      this.data.watcherConfig = {}
    }
    if (config.autoRestart !== undefined) {
      this.data.watcherConfig.autoRestart = config.autoRestart
    }
    if (config.enableRAMLimiter !== undefined) {
      this.data.watcherConfig.enableRAMLimiter = config.enableRAMLimiter
    }
    if (config.ramLimitMB !== undefined) {
      this.data.watcherConfig.ramLimitMB = config.ramLimitMB
    }
    if (config.enableClientTimeout !== undefined) {
      this.data.watcherConfig.enableClientTimeout = config.enableClientTimeout
    }
    if (config.clientTimeoutSeconds !== undefined) {
      this.data.watcherConfig.clientTimeoutSeconds = config.clientTimeoutSeconds
    }
    if (config.enableCPULimiter !== undefined) {
      this.data.watcherConfig.enableCPULimiter = config.enableCPULimiter
    }
    if (config.cpuLimitPercent !== undefined) {
      this.data.watcherConfig.cpuLimitPercent = config.cpuLimitPercent
    }
    this.save()
  }

  /**
   * Get allow multiple instances setting
   */
  public getAllowMultipleInstances(): boolean {
    return this.data.settings?.allowMultipleInstances ?? false
  }

  /**
   * Set allow multiple instances setting
   */
  public setAllowMultipleInstances(allow: boolean): void {
    if (!this.data.settings) {
      this.data.settings = {}
    }
    // Windows only
    if (process.platform === 'win32') {
      this.data.settings.allowMultipleInstances = allow
    } else {
      this.data.settings.allowMultipleInstances = false
    }
    this.save()
    // Update MultiInstance state
    if (this.data.settings.allowMultipleInstances) {
      MultiInstance.Enable()
    } else {
      MultiInstance.Disable()
    }
  }

  /**
   * Get Roblox settings
   */
  public getRobloxSettings() {
    return {
      allowMultipleLaunches: this.data.robloxSettings?.allowMultipleLaunches ?? false,
      defaultPhysicsEngine: this.data.robloxSettings?.defaultPhysicsEngine ?? 'Terrain',
      enableOptimizations: this.data.robloxSettings?.enableOptimizations ?? false,
      memoryLimit: this.data.robloxSettings?.memoryLimit ?? 0,
      useDirectX12: this.data.robloxSettings?.useDirectX12 ?? false,
      lowEndGraphics: this.data.robloxSettings?.lowEndGraphics ?? false,
      disableDualChannelAudio: this.data.robloxSettings?.disableDualChannelAudio ?? false,
      antiAfkEnabled: this.data.robloxSettings?.antiAfkEnabled ?? false,
      renameWindowsEnabled: this.data.robloxSettings?.renameWindowsEnabled ?? false,
      framerateCapEnabled: this.data.robloxSettings?.framerateCapEnabled ?? false,
      framerateCapValue: this.data.robloxSettings?.framerateCapValue ?? 60,
      optimizeRamEnabled: this.data.robloxSettings?.optimizeRamEnabled ?? false,
      ramOptimizeLimit: this.data.robloxSettings?.ramOptimizeLimit ?? 500,
      headlessModeEnabled: this.data.robloxSettings?.headlessModeEnabled ?? false,
      timeoutRelaunchEnabled: this.data.robloxSettings?.timeoutRelaunchEnabled ?? false,
      timeoutRelaunchSeconds: this.data.robloxSettings?.timeoutRelaunchSeconds ?? 3600
    }
  }

  /**
   * Set Roblox settings
   */
  public setRobloxSettings(settings: {
    allowMultipleLaunches?: boolean
    defaultPhysicsEngine?: 'Terrain' | 'Legacy'
    enableOptimizations?: boolean
    memoryLimit?: number
    useDirectX12?: boolean
    lowEndGraphics?: boolean
    disableDualChannelAudio?: boolean
    antiAfkEnabled?: boolean
    renameWindowsEnabled?: boolean
    framerateCapEnabled?: boolean
    framerateCapValue?: number
    optimizeRamEnabled?: boolean
    ramOptimizeLimit?: number
    headlessModeEnabled?: boolean
    timeoutRelaunchEnabled?: boolean
    timeoutRelaunchSeconds?: number
  }): void {
    if (!this.data.robloxSettings) {
      this.data.robloxSettings = {}
    }
    if (settings.allowMultipleLaunches !== undefined) {
      this.data.robloxSettings.allowMultipleLaunches = settings.allowMultipleLaunches
    }
    if (settings.defaultPhysicsEngine !== undefined) {
      this.data.robloxSettings.defaultPhysicsEngine = settings.defaultPhysicsEngine
    }
    if (settings.enableOptimizations !== undefined) {
      this.data.robloxSettings.enableOptimizations = settings.enableOptimizations
    }
    if (settings.memoryLimit !== undefined) {
      this.data.robloxSettings.memoryLimit = settings.memoryLimit
    }
    if (settings.useDirectX12 !== undefined) {
      this.data.robloxSettings.useDirectX12 = settings.useDirectX12
    }
    if (settings.lowEndGraphics !== undefined) {
      this.data.robloxSettings.lowEndGraphics = settings.lowEndGraphics
    }
    if (settings.disableDualChannelAudio !== undefined) {
      this.data.robloxSettings.disableDualChannelAudio = settings.disableDualChannelAudio
    }
    if (settings.antiAfkEnabled !== undefined) {
      this.data.robloxSettings.antiAfkEnabled = settings.antiAfkEnabled
    }
    if (settings.renameWindowsEnabled !== undefined) {
      this.data.robloxSettings.renameWindowsEnabled = settings.renameWindowsEnabled
    }
    if (settings.framerateCapEnabled !== undefined) {
      this.data.robloxSettings.framerateCapEnabled = settings.framerateCapEnabled
    }
    if (settings.framerateCapValue !== undefined) {
      this.data.robloxSettings.framerateCapValue = settings.framerateCapValue
    }
    if (settings.optimizeRamEnabled !== undefined) {
      this.data.robloxSettings.optimizeRamEnabled = settings.optimizeRamEnabled
    }
    if (settings.ramOptimizeLimit !== undefined) {
      this.data.robloxSettings.ramOptimizeLimit = settings.ramOptimizeLimit
    }
    if (settings.headlessModeEnabled !== undefined) {
      this.data.robloxSettings.headlessModeEnabled = settings.headlessModeEnabled
    }
    if (settings.timeoutRelaunchEnabled !== undefined) {
      this.data.robloxSettings.timeoutRelaunchEnabled = settings.timeoutRelaunchEnabled
    }
    if (settings.timeoutRelaunchSeconds !== undefined) {
      this.data.robloxSettings.timeoutRelaunchSeconds = settings.timeoutRelaunchSeconds
    }

    this.save()
  }
}

export const storageService = new StorageService()
