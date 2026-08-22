import { dirname, join } from "path";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  renameSync,
} from "fs";
import { app } from "electron";
import {
  Account,
  DEFAULT_ACCENT_COLOR,
  TabId,
  ThemePreference,
  TintPreference,
} from "../../../renderer/src/types";
import { MultiInstance } from "@main/lib/MultiInstance";
import { z } from "zod";
import { favoriteItemSchema } from "../../../shared/ipc-schemas/avatar";
import { pinService } from "./PinService";

import {
  sanitizeSidebarHidden,
  sanitizeSidebarOrder,
  SIDEBAR_TAB_IDS,
} from "../../../shared/navigation";
import * as crypto from "crypto";
import { getDataFile } from "../../utils/paths";
import {
  isSafeStorageAvailable,
  safeEncrypt,
  safeDecrypt,
} from "../../lib/secureStore";

const customFontSchema = z.object({
  family: z.string(),
  url: z.string(),
});

const sidebarTabIdEnum = z.string();
const themePreferenceEnum = z.enum(["system", "dark", "light"]);
const tintPreferenceEnum = z.enum([
  "neutral",
  "cool",
  "warm",
  "forest",
  "twilight",
]);

const storeDataSchema = z.object({
  sidebarWidth: z.number().optional(),
  sidebarCollapsed: z.boolean().optional(),
  accountsViewMode: z.enum(["list", "grid"]).optional(),
  avatarRenderWidth: z.number().optional(),
  windowWidth: z.number().optional(),
  windowHeight: z.number().optional(),

  encryptedAccounts: z.string().optional(),

  encryptedSniperAccounts: z.string().optional(),

  encryptedLicense: z.string().optional(),
  favoriteGames: z.array(z.string()).optional(),
  favoriteItems: z.array(favoriteItemSchema).optional(),
  excludeFullGames: z.boolean().optional(),
  customFonts: z.array(customFontSchema).optional(),
  activeFont: z.string().nullable().optional(),

  watcherConfig: z
    .object({
      autoRestart: z.boolean().optional(),
      enableRAMLimiter: z.boolean().optional(),
      ramLimitMB: z.number().optional(),
      enableClientTimeout: z.boolean().optional(),
      clientTimeoutSeconds: z.number().optional(),
      enableCPULimiter: z.boolean().optional(),
      cpuLimitPercent: z.number().optional(),
    })
    .optional(),

  robloxSettings: z
    .object({
      defaultPhysicsEngine: z.enum(["Terrain", "Legacy"]).optional(),
      enableOptimizations: z.boolean().optional(),
      memoryLimit: z.number().optional(),
      useDirectX12: z.boolean().optional(),
      lowEndGraphics: z.boolean().optional(),
      disableDualChannelAudio: z.boolean().optional(),

      antiAfkEnabled: z.boolean().optional(),
      renameWindowsEnabled: z.boolean().optional(),
      framerateCapEnabled: z.boolean().optional(),
      framerateCapValue: z.number().optional(),
      optimizeRamEnabled: z.boolean().optional(),
      ramOptimization: z.number().optional(),
      cpuOptimization: z.number().optional(),
      headlessModeEnabled: z.boolean().optional(),
      timeoutRelaunchEnabled: z.boolean().optional(),
      timeoutRelaunchSeconds: z.number().optional(),
      windowLayoutEnabled: z.boolean().optional(),
      windowLayoutPattern: z
        .enum(["grid", "rows", "columns", "cascade"])
        .optional(),
      windowLayoutSpacing: z.number().optional(),
      windowLayoutColumns: z.number().optional(),
      windowLayoutWidth: z.number().optional(),
      windowLayoutHeight: z.number().optional(),
    })
    .optional(),
  settings: z
    .object({
      primaryAccountId: z.string().nullable().optional(),
      allowMultipleInstances: z.boolean().optional(),
      multiInstanceMethod: z.enum(["mutex", "handle64"]).optional(),
      defaultInstallationPath: z.string().nullable().optional(),
      accentColor: z.string().optional(),
      useDynamicAccentColor: z.boolean().optional(),
      theme: themePreferenceEnum.optional(),
      tint: tintPreferenceEnum.optional(),
      themePreset: z.string().nullable().optional(),
      privacyMode: z.boolean().optional(),
      showSidebarProfileCard: z.boolean().optional(),
      sidebarTabOrder: z.array(sidebarTabIdEnum).optional(),
      sidebarHiddenTabs: z.array(sidebarTabIdEnum).optional(),

      pinCodeHash: z.string().nullable().optional(),
      browserWindowWidth: z.number().nullable().optional(),
      browserWindowHeight: z.number().nullable().optional(),
      pinLockout: z
        .object({
          count: z.number(),
          lastAttempt: z.number(),
          lockedUntil: z.number().nullable(),
        })
        .optional(),
      showReturnPageButton: z.boolean().optional(),
      catalogViewMode: z.string().optional(),
      inventoryViewMode: z.string().optional(),
      uiDensity: z.string().optional(),
      motionSpeed: z.string().optional(),
      isSidebarCollapsed: z.boolean().optional(),
      navLayout: z.enum(["sidebar", "topbar"]).optional(),

      userAgentSettings: z
        .object({
          currentUserAgentIndex: z.number().default(0).optional(),
          autoSwapUserAgent: z.boolean().default(false).optional(),
          autoSwapIntervalMinutes: z.number().default(30).optional(),
        })
        .optional(),
    })
    .optional(),
});

type StoreData = z.infer<typeof storeDataSchema>;

class StorageService {
  private path: string;
  private data: StoreData = {};
  private decryptedAccounts: Account[] | null = null;
  private decryptedSniperAccounts: Account[] | null = null;
  private currentVerifiedPin: string | null = null;

  private encryptedBlob: string | null = null;

  private diskUnreadable = false;

  private pinLockoutState = {
    count: 0,
    lastAttempt: 0,
    lockedUntil: null as number | null,
  };
  private pinVerificationInProgress: boolean = false;

  private _saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.path = getDataFile("config.json");
    this.init();
  }

  private init(): void {
    try {
      this.migrateLegacyNestedConfigIfNeeded();

      if (!existsSync(this.path)) {
        const appUserData = app.getPath("userData");
        const legacyPaths = [
          join(appUserData, "config.json"),
          join(appUserData, "Sentra", "config.json"),
          join(dirname(appUserData), "sentra", "config.json"),
          join(dirname(appUserData), "Sentra", "config.json"),
        ];

        for (const legacyPath of legacyPaths) {
          if (legacyPath !== this.path && existsSync(legacyPath)) {
            try {
              const legacyContent = readFileSync(legacyPath, "utf-8");
              const dir = dirname(this.path);
              if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
              writeFileSync(this.path, legacyContent);
              console.log(
                "[StorageService] migrated config from legacy path to current data path",
              );
              break;
            } catch (e) {
              console.error(
                "[StorageService] failed to migrate config file from legacy path:",
                e,
              );
            }
          }
        }
      }

      if (existsSync(this.path)) {
        this.load();

        if (
          (this.encryptedBlob && !this.getPinHash()) ||
          !this.hasAccountPayload()
        ) {
          if (this.loadLegacyAccountConfig()) {
            console.log("[StorageService] restored legacy config during init");
          }
        }
      } else {
        const dir = dirname(this.path);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        this.data = {};
      }
    } catch (error) {
      console.error("Failed to initialize storage:", error);
    }
  }

  #decryptConfigBlobIfNeeded(): void {
    if (!this.encryptedBlob) return;
    if (!pinService.hasEncryptionKey()) return;

    try {
      const decrypted = pinService.decryptWithVerifiedKey(this.encryptedBlob);
      if (decrypted) {
        const raw = JSON.parse(decrypted);
        const result = storeDataSchema.safeParse(raw);
        if (result.success) {
          this.data = result.data;
          this.migratePin();
        } else {
          console.error(
            "[StorageService] decrypted config validation failed, keeping raw data",
            result.error,
          );
          this.data = (raw as StoreData) || {};
        }
      } else {
        console.error(
          "[StorageService] failed to decrypt config blob with verified key",
        );

        this.data = {};
      }
    } catch (e) {
      console.error("[StorageService] error decrypting config blob", e);

      this.data = {};
    }

    this.encryptedBlob = null;
  }

  #atomicWrite(content: string): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmpPath = this.path + ".tmp";
    writeFileSync(tmpPath, content);
    renameSync(tmpPath, this.path);
  }

  #wrapForDisk(inner: string): string {
    if (isSafeStorageAvailable()) {
      const ss = safeEncrypt(inner);
      if (ss) {
        return JSON.stringify({ v: 2, ss });
      }
    }
    return inner;
  }

  #unwrapDiskContent(raw: string): string {
    const trimmed = raw.replace(/^﻿/, "").trim();
    if (!trimmed.startsWith("{")) return trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.v === 2 &&
        typeof parsed.ss === "string"
      ) {
        const decrypted = safeDecrypt(parsed.ss);
        if (decrypted !== null) return decrypted;
        console.error(
          "[StorageService] failed to decrypt safeStorage envelope; " +
            "config may have been copied from another machine/user",
        );

        return trimmed;
      }
    } catch {}
    return trimmed;
  }

  private load(): void {
    try {
      const rawFileContent = readFileSync(this.path, "utf-8");

      const fileContent = this.#unwrapDiskContent(rawFileContent);
      const trimmed = fileContent.trim();

      let rawData: unknown;
      try {
        rawData = JSON.parse(trimmed);
      } catch (e) {
        console.log(
          "[StorageService] config.json parse failed, assuming encrypted payload",
        );
        this.encryptedBlob = trimmed;
        this.data = {};
        return;
      }

      if (
        rawData &&
        typeof rawData === "object" &&
        (rawData as any).v === 2 &&
        typeof (rawData as any).ss === "string"
      ) {
        console.error(
          "[StorageService] config is an undecryptable safeStorage envelope; " +
            "preserving on disk (will not overwrite)",
        );
        this.encryptedBlob = trimmed;
        this.data = {};
        this.diskUnreadable = true;
        return;
      }

      if (
        rawData &&
        typeof rawData === "object" &&
        typeof (rawData as any).encrypted === "string"
      ) {
        const encryptedPayload = (rawData as any).encrypted.replace(
          /^\uFEFF/,
          "",
        );
        this.encryptedBlob = encryptedPayload;
        this.data = {};

        const metadata: any = {};
        if (typeof (rawData as any).pinCodeHash === "string") {
          metadata.pinCodeHash = (rawData as any).pinCodeHash;
        }
        if (
          (rawData as any).pinLockout &&
          typeof (rawData as any).pinLockout === "object"
        ) {
          metadata.pinLockout = (rawData as any).pinLockout;
        }

        if (Object.keys(metadata).length > 0) {
          this.data.settings = { ...(this.data.settings ?? {}), ...metadata };
          if (metadata.pinLockout) {
            const loadedLockout = metadata.pinLockout;
            const count = Number(loadedLockout.count) || 0;
            const lastAttempt = Number(loadedLockout.lastAttempt) || 0;
            const lockedUntil =
              loadedLockout.lockedUntil === null
                ? null
                : Number(loadedLockout.lockedUntil) || null;
            this.pinLockoutState = { count, lastAttempt, lockedUntil };
          }
        }

        return;
      }

      const result = storeDataSchema.safeParse(rawData);
      if (result.success) {
        this.data = result.data;
        this.encryptedBlob = null;

        if (!this.data.settings) {
          this.data.settings = {};
        }
        if (
          !this.data.settings.pinCodeHash &&
          typeof (rawData as any).pinCodeHash === "string"
        ) {
          this.data.settings.pinCodeHash = (rawData as any).pinCodeHash;
        }
        if (!this.data.settings.pinLockout && (rawData as any).pinLockout) {
          this.data.settings.pinLockout = (rawData as any).pinLockout;
        }

        this.migratePin();

        const loadedLockout = this.data.settings?.pinLockout;
        if (loadedLockout) {
          const count = Number(loadedLockout.count) || 0;
          const lastAttempt = Number(loadedLockout.lastAttempt) || 0;
          const lockedUntil =
            loadedLockout.lockedUntil === null
              ? null
              : Number(loadedLockout.lockedUntil) || null;
          this.pinLockoutState = { count, lastAttempt, lockedUntil };
        } else {
          this.pinLockoutState = {
            count: 0,
            lastAttempt: 0,
            lockedUntil: null,
          };
        }
      } else {
        console.error(
          "Storage validation failed, keeping raw data:",
          result.error,
        );
        try {
          const backupPath = this.path + ".bak";
          writeFileSync(backupPath, rawFileContent);
        } catch (e) {
          console.error("Failed to backup config:", e);
        }
        this.data = (rawData as StoreData) || {};
        this.encryptedBlob = null;
      }

      if (this.data.settings?.allowMultipleInstances) {
        MultiInstance.Enable(
          this.data.settings?.multiInstanceMethod || "mutex",
        );
      } else {
        MultiInstance.Disable();
      }
    } catch (error) {
      console.error("Failed to load storage:", error);
      this.data = {};
    }
  }

  private migratePin(): void {
    if (this.data.settings && "pinCode" in this.data.settings) {
      delete (this.data.settings as any).pinCode;
      this.save();
    }
  }

  private hasAccountPayload(): boolean {
    return !!(
      this.encryptedBlob ||
      this.data.encryptedAccounts ||
      this.data.encryptedSniperAccounts
    );
  }

  private loadLegacyAccountConfig(): boolean {
    const legacySources = [
      join(app.getPath("documents"), "Sentra", "config.json"),
      join(app.getPath("userData"), "Sentra", "config.json"),
      join(app.getPath("userData"), "config.json"),
    ];

    for (const legacyPath of legacySources) {
      if (legacyPath === this.path || !existsSync(legacyPath)) continue;

      try {
        const legacyContent = readFileSync(legacyPath, "utf-8")
          .replace(/^\uFEFF/, "")
          .trim();
        if (!legacyContent) continue;

        let legacyData: unknown;
        try {
          legacyData = JSON.parse(legacyContent);
        } catch {
          continue;
        }

        const accountsPresent =
          (legacyData &&
            typeof legacyData === "object" &&
            "encryptedAccounts" in legacyData) ||
          (legacyData &&
            typeof legacyData === "object" &&
            "encryptedSniperAccounts" in legacyData) ||
          (legacyData &&
            typeof legacyData === "object" &&
            "encrypted" in legacyData);

        if (!accountsPresent) continue;

        writeFileSync(this.path, legacyContent);
        this.load();
        return true;
      } catch (error) {
        console.error(
          "[StorageService] failed to load legacy account config:",
          error,
        );
      }
    }

    return false;
  }

  private migrateLegacyNestedConfigIfNeeded(): void {
    if (
      this.encryptedBlob ||
      this.data.encryptedAccounts ||
      this.data.encryptedSniperAccounts
    ) {
      return;
    }

    const appUserData = app.getPath("userData");
    const legacyNestedPath = join(appUserData, "Sentra", "config.json");
    if (legacyNestedPath === this.path || !existsSync(legacyNestedPath)) {
      return;
    }

    try {
      const legacyContent = readFileSync(legacyNestedPath, "utf-8").trim();
      if (!legacyContent) {
        return;
      }

      const legacyJson = JSON.parse(legacyContent);
      const hasLegacyAccounts =
        !!legacyJson.encryptedAccounts ||
        !!legacyJson.encryptedSniperAccounts ||
        !!legacyJson.encrypted ||
        !!legacyJson.accounts;

      if (!hasLegacyAccounts) {
        return;
      }

      writeFileSync(this.path, legacyContent);
      console.log(
        "[StorageService] migrated legacy nested config into current data path",
      );
      this.load();
    } catch (error) {
      console.error(
        "[StorageService] failed to migrate legacy nested config:",
        error,
      );
    }
  }

  private _saveDebounced(delayMs = 100): void {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.save();
    }, delayMs);
  }

  public flush(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      this.save();
    }
  }

  private save(): void {
    if (this.diskUnreadable) {
      return;
    }

    if (this.encryptedBlob && !pinService.hasEncryptionKey()) {
      return;
    }

    if (this.encryptedBlob && pinService.hasEncryptionKey()) {
      this.#decryptConfigBlobIfNeeded();
    }

    try {
      const dir = dirname(this.path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      let output: string;

      if (!this.data.settings) {
        this.data.settings = {};
      }
      this.data.settings.pinLockout = this.pinLockoutState;

      if (pinService.hasEncryptionKey()) {
        const plain = JSON.stringify(this.data, null, 2);
        const enc = pinService.encryptWithVerifiedKey(plain);
        if (enc) {
          const wrapper: Record<string, unknown> = { encrypted: enc };
          if (this.data.settings?.pinCodeHash) {
            wrapper.pinCodeHash = this.data.settings.pinCodeHash;
          }
          if (this.pinLockoutState) {
            wrapper.pinLockout = this.pinLockoutState;
          }
          output = JSON.stringify(wrapper, null, 2);
        } else {
          console.error(
            "[StorageService] failed to encrypt full config with PIN",
          );
          output = JSON.stringify(this.data, null, 2);
        }
      } else if (this.data.settings?.pinCodeHash && this.encryptedBlob) {
        const wrapper: Record<string, unknown> = {
          encrypted: this.encryptedBlob,
        };
        if (this.data.settings.pinCodeHash) {
          wrapper.pinCodeHash = this.data.settings.pinCodeHash;
        }
        if (this.pinLockoutState) {
          wrapper.pinLockout = this.pinLockoutState;
        }
        output = JSON.stringify(wrapper, null, 2);
      } else {
        output = JSON.stringify(this.data, null, 2);
      }

      this.#atomicWrite(this.#wrapForDisk(output));
    } catch (error) {
      console.error("Failed to save storage:", error);
    }
  }

  #persistPinMetadata(): void {
    if (this.diskUnreadable) {
      return;
    }
    if (!this.data.settings) {
      this.data.settings = {};
    }
    this.data.settings.pinLockout = this.pinLockoutState;

    if (this.encryptedBlob && !pinService.hasEncryptionKey()) {
      try {
        const raw = readFileSync(this.path, "utf-8");
        const inner = this.#unwrapDiskContent(raw);
        const parsed = JSON.parse(inner.trim());
        if (parsed && typeof parsed === "object") {
          if (this.data.settings.pinCodeHash)
            parsed.pinCodeHash = this.data.settings.pinCodeHash;
          parsed.pinLockout = this.pinLockoutState;

          this.#atomicWrite(this.#wrapForDisk(JSON.stringify(parsed, null, 2)));
          return;
        }
      } catch (err) {
        console.warn(
          "[StorageService] Failed to persist PIN metadata directly:",
          err,
        );
      }
    }

    this._saveDebounced();
  }

  private encryptAccountsWithPin(
    accounts: Account[],
    pin: string,
  ): string | null {
    try {
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(pin, salt, 100000, 32, "sha256");

      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      const plaintext = JSON.stringify(accounts);
      let encrypted = cipher.update(plaintext, "utf-8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      const combined =
        salt.toString("hex") +
        iv.toString("hex") +
        authTag.toString("hex") +
        encrypted;

      return combined;
    } catch (error) {
      console.error("Failed to encrypt accounts:", error);
      return null;
    }
  }

  private decryptAccountsWithPin(
    encryptedData: string,
    pin: string,
  ): Account[] | null {
    try {
      if (encryptedData.length < 88) {
        console.warn("[StorageService] PIN-based decrypt: data too short");
        return null;
      }

      const salt = Buffer.from(encryptedData.substring(0, 32), "hex");
      const iv = Buffer.from(encryptedData.substring(32, 56), "hex");
      const authTag = Buffer.from(encryptedData.substring(56, 88), "hex");
      const encrypted = encryptedData.substring(88);

      const key = crypto.pbkdf2Sync(pin, salt, 100000, 32, "sha256");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let plaintext = decipher.update(encrypted, "hex", "utf-8");
      plaintext += decipher.final("utf-8");

      const accounts = JSON.parse(plaintext);
      return Array.isArray(accounts) ? accounts : null;
    } catch (error) {
      console.error("[StorageService] Failed to decrypt accounts:", error);
      return null;
    }
  }

  public getSidebarWidth(): number | undefined {
    return this.data.sidebarWidth;
  }

  public setSidebarWidth(width: number): void {
    this.data.sidebarWidth = width;
    this._saveDebounced();
  }

  public getSidebarCollapsed(): boolean {
    return this.data.sidebarCollapsed ?? false;
  }

  public setSidebarCollapsed(collapsed: boolean): void {
    this.data.sidebarCollapsed = collapsed;
    this._saveDebounced();
  }

  public getAccountsViewMode(): "list" | "grid" {
    return this.data.accountsViewMode ?? "list";
  }

  public setAccountsViewMode(mode: "list" | "grid"): void {
    this.data.accountsViewMode = mode;
    this._saveDebounced();
  }

  public getAccounts(): Account[] {
    if (this.encryptedBlob) {
      this.#decryptConfigBlobIfNeeded();
      if (this.encryptedBlob) {
        return [];
      }
    }

    const pinHash = this.getPinHash();

    if (this.decryptedAccounts === null && this.data.encryptedAccounts) {
      console.log(
        "[StorageService] getAccounts: need to decrypt accounts. pinHash:",
        !!pinHash,
        "currentVerifiedPin:",
        !!this.currentVerifiedPin,
      );
      if (pinHash) {
        if (this.currentVerifiedPin) {
          this.decryptedAccounts = this.decryptAccountsWithPin(
            this.data.encryptedAccounts,
            this.currentVerifiedPin,
          );
          console.log(
            "[StorageService] getAccounts: decrypted",
            this.decryptedAccounts?.length,
            "accounts",
          );
          if (!this.decryptedAccounts) {
            const raw = this.data.encryptedAccounts.trim();
            if (raw.startsWith("[") || raw.startsWith("{")) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  this.decryptedAccounts = parsed;
                }
              } catch {}
            }
            this.decryptedAccounts = this.decryptedAccounts ?? [];
          }
        } else {
          console.log(
            "[StorageService] getAccounts: PIN not verified yet, returning empty",
          );
          this.decryptedAccounts = [];
        }
      } else {
        try {
          const parsed = JSON.parse(this.data.encryptedAccounts);
          if (Array.isArray(parsed)) {
            this.decryptedAccounts = parsed;
          } else {
            this.decryptedAccounts = [];
          }
        } catch (error) {
          this.decryptedAccounts = [];
        }
      }
    }

    if (
      pinHash &&
      !this.currentVerifiedPin &&
      this.decryptedAccounts?.length === 0
    ) {
      return [];
    }

    return this.decryptedAccounts || [];
  }

  public setAccounts(accounts: Account[]): boolean {
    console.log(
      "[StorageService] setAccounts: Called with",
      accounts.length,
      "accounts. pinHash exists:",
      !!this.getPinHash(),
      "currentVerifiedPin exists:",
      !!this.currentVerifiedPin,
    );
    const pinHash = this.getPinHash();

    if (pinHash) {
      if (!this.currentVerifiedPin) {
        console.error(
          "[StorageService] setAccounts: PIN hash exists but PIN not currently verified. Cannot save encrypted accounts.",
        );

        throw new Error("PIN must be verified before saving accounts");
      }

      const pinToUse = this.currentVerifiedPin;
      let encrypted: string | null = null;
      try {
        encrypted = this.encryptAccountsWithPin(accounts, pinToUse);
      } catch (e) {
        throw new Error("Failed to encrypt accounts: " + String(e));
      }

      if (!encrypted) {
        throw new Error("Failed to encrypt accounts: result was null");
      }

      console.log(
        "[StorageService] setAccounts: Encrypting",
        accounts.length,
        "accounts with PIN",
      );
      this.data.encryptedAccounts = encrypted;
      this.decryptedAccounts = accounts;
      this._saveDebounced();
      console.log(
        "[StorageService] setAccounts: ✓ Saved",
        accounts.length,
        "encrypted accounts to disk",
      );
      return true;
    } else {
      console.log(
        "[StorageService] setAccounts: Saving",
        accounts.length,
        "plaintext accounts (no PIN set yet)",
      );
      this.data.encryptedAccounts = JSON.stringify(accounts);
      this.decryptedAccounts = accounts;
      this._saveDebounced();
      console.log(
        "[StorageService] setAccounts: ✓ Saved",
        accounts.length,
        "plaintext accounts (no PIN)",
      );
      return true;
    }
  }
  public getDecryptedPassword(password?: string): string {
    if (!password) {
      return "";
    }

    return password;
  }

  public addAccountsToStorage(newAccounts: Account[]): boolean {
    try {
      const existingAccounts = this.getAccounts() || [];
      const combinedAccounts = [...existingAccounts, ...newAccounts];
      return this.setAccounts(combinedAccounts);
    } catch (err) {
      console.error("[StorageService] addAccountsToStorage error:", err);
      throw err;
    }
  }

  public removeAccount(accountId: string): boolean {
    const accounts = this.getAccounts();
    return this.setAccounts(accounts.filter((a) => a.id !== accountId));
  }

  public updateAccount(accountId: string, updates: Partial<Account>): boolean {
    const accounts = this.getAccounts();
    const index = accounts.findIndex((a) => a.id === accountId);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      return this.setAccounts(accounts);
    }
    return false;
  }

  public getSniperAccounts(): Account[] {
    const pinHash = this.getPinHash();

    if (
      this.decryptedSniperAccounts === null &&
      this.data.encryptedSniperAccounts
    ) {
      if (pinHash) {
        if (this.currentVerifiedPin) {
          this.decryptedSniperAccounts = this.decryptAccountsWithPin(
            this.data.encryptedSniperAccounts,
            this.currentVerifiedPin,
          );
          if (!this.decryptedSniperAccounts) {
            this.decryptedSniperAccounts = [];
          }
        } else {
          this.decryptedSniperAccounts = [];
        }
      } else {
        try {
          const parsed = JSON.parse(this.data.encryptedSniperAccounts);
          this.decryptedSniperAccounts = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          this.decryptedSniperAccounts = [];
        }
      }
    }

    return this.decryptedSniperAccounts || [];
  }

  public setSniperAccounts(accounts: Account[]): boolean {
    const pinHash = this.getPinHash();

    if (pinHash) {
      if (!this.currentVerifiedPin) {
        throw new Error("PIN must be verified before saving accounts");
      }

      const encrypted = this.encryptAccountsWithPin(
        accounts,
        this.currentVerifiedPin,
      );
      if (!encrypted) {
        throw new Error("Failed to encrypt sniper accounts");
      }

      this.data.encryptedSniperAccounts = encrypted;
      this.decryptedSniperAccounts = accounts;
      this._saveDebounced();
      return true;
    } else {
      this.data.encryptedSniperAccounts = JSON.stringify(accounts);
      this.decryptedSniperAccounts = accounts;
      this._saveDebounced();
      return true;
    }
  }

  public addSniperAccount(newAccount: Account): boolean {
    try {
      const existing = this.getSniperAccounts() || [];

      if (existing.some((acc) => acc.username === newAccount.username)) {
        console.log(
          "[StorageService] Sniper account already exists:",
          newAccount.username,
        );
        return true;
      }

      const combined = [newAccount, ...existing];
      return this.setSniperAccounts(combined);
    } catch (err) {
      console.error("[StorageService] addSniperAccount error:", err);
      throw err;
    }
  }

  public removeSniperAccount(accountId: string): boolean {
    const accounts = this.getSniperAccounts();
    return this.setSniperAccounts(accounts.filter((a) => a.id !== accountId));
  }

  public moveSniperAccountToMain(accountId: string): boolean {
    const sniperAccounts = this.getSniperAccounts();
    const account = sniperAccounts.find((a) => a.id === accountId);

    if (!account) return false;

    this.addAccountsToStorage([account]);

    return this.removeSniperAccount(accountId);
  }

  public getFavoriteGames(): string[] {
    return this.data.favoriteGames || [];
  }

  public addFavoriteGame(placeId: string): void {
    const favorites = this.data.favoriteGames || [];
    if (!favorites.includes(placeId)) {
      this.data.favoriteGames = [...favorites, placeId];
      this._saveDebounced();
    }
  }

  public removeFavoriteGame(placeId: string): void {
    const favorites = this.data.favoriteGames || [];
    this.data.favoriteGames = favorites.filter((id) => id !== placeId);
    this._saveDebounced();
  }

  public getFavoriteItems(): { id: number; name: string; type: string }[] {
    return this.data.favoriteItems || [];
  }

  public addFavoriteItem(item: {
    id: number;
    name: string;
    type: string;
  }): void {
    const favorites = this.data.favoriteItems || [];
    if (!favorites.some((i) => i.id === item.id)) {
      this.data.favoriteItems = [...favorites, item];
      this._saveDebounced();
    }
  }

  public removeFavoriteItem(itemId: number): void {
    const favorites = this.data.favoriteItems || [];
    this.data.favoriteItems = favorites.filter((i) => i.id !== itemId);
    this._saveDebounced();
  }

  public getSettings() {
    const sidebarTabOrder = sanitizeSidebarOrder(
      this.data.settings?.sidebarTabOrder as TabId[] | undefined,
    );
    const sidebarHiddenTabs = sanitizeSidebarHidden(
      this.data.settings?.sidebarHiddenTabs as TabId[] | undefined,
    );
    const storedAccent = this.data.settings?.accentColor;
    const legacyAccent = storedAccent ? storedAccent.trim().toLowerCase() : "";
    const LEGACY_DEFAULT_ACCENT_COLORS = ["#1e66f5", "#3b82f6", "#2563eb"];

    const accentColor =
      legacyAccent && legacyAccent !== "#ffffff"
        ? LEGACY_DEFAULT_ACCENT_COLORS.includes(legacyAccent)
          ? DEFAULT_ACCENT_COLOR
          : storedAccent!
        : DEFAULT_ACCENT_COLOR;

    if (legacyAccent && LEGACY_DEFAULT_ACCENT_COLORS.includes(legacyAccent)) {
      if (!this.data.settings) this.data.settings = {};
      if (this.data.settings.accentColor !== DEFAULT_ACCENT_COLOR) {
        this.data.settings.accentColor = DEFAULT_ACCENT_COLOR;
        this._saveDebounced();
      }
    }

    return {
      primaryAccountId: this.data.settings?.primaryAccountId ?? null,
      allowMultipleInstances:
        this.data.settings?.allowMultipleInstances ?? false,
      multiInstanceMethod: this.data.settings?.multiInstanceMethod ?? "mutex",
      defaultInstallationPath:
        this.data.settings?.defaultInstallationPath ?? null,
      accentColor,
      useDynamicAccentColor: this.data.settings?.useDynamicAccentColor ?? false,
      theme:
        (this.data.settings?.theme as ThemePreference | undefined) ?? "system",
      tint:
        (this.data.settings?.tint as TintPreference | undefined) ?? "neutral",
      showSidebarProfileCard:
        this.data.settings?.showSidebarProfileCard ?? true,
      privacyMode: this.data.settings?.privacyMode ?? false,
      sidebarTabOrder,
      sidebarHiddenTabs,
      pinCode: this.data.settings?.pinCodeHash ? "SET" : null,
      browserWindowWidth: this.data.settings?.browserWindowWidth ?? null,
      browserWindowHeight: this.data.settings?.browserWindowHeight ?? null,
      showReturnPageButton: this.data.settings?.showReturnPageButton ?? false,
      userAgentSettings: {
        currentUserAgentIndex:
          this.data.settings?.userAgentSettings?.currentUserAgentIndex ?? 0,
        autoSwapUserAgent:
          this.data.settings?.userAgentSettings?.autoSwapUserAgent ?? false,
        autoSwapIntervalMinutes:
          this.data.settings?.userAgentSettings?.autoSwapIntervalMinutes ?? 30,
      },

      catalogViewMode:
        (this.data.settings as any)?.catalogViewMode ?? "default",
      inventoryViewMode:
        (this.data.settings as any)?.inventoryViewMode ?? "default",
      contentRadius: (this.data.settings as any)?.contentRadius ?? "rounded",
      navBorderStyle: (this.data.settings as any)?.navBorderStyle ?? "subtle",
      uiDensity: (this.data.settings as any)?.uiDensity ?? "default",
      blurIntensity: (this.data.settings as any)?.blurIntensity ?? "medium",
      iconWeight: (this.data.settings as any)?.iconWeight ?? "regular",
      motionSpeed: (this.data.settings as any)?.motionSpeed ?? "default",
      fontWeight: (this.data.settings as any)?.fontWeight ?? "regular",
      liquidGlass: (this.data.settings as any)?.liquidGlass ?? false,
      appBackground: (this.data.settings as any)?.appBackground ?? "solid",
      customTheme: (this.data.settings as any)?.customTheme ?? undefined,

      isSidebarCollapsed:
        (this.data.settings as any)?.isSidebarCollapsed ?? false,
      navLayout: (this.data.settings as any)?.navLayout ?? "sidebar",
      antiAfkEnabled:
        this.data.robloxSettings?.antiAfkEnabled ??
        (this.data.settings as any)?.antiAfkEnabled ??
        false,
      renameWindowsEnabled:
        this.data.robloxSettings?.renameWindowsEnabled ??
        (this.data.settings as any)?.renameWindowsEnabled ??
        false,
      framerateCapEnabled:
        this.data.robloxSettings?.framerateCapEnabled ??
        (this.data.settings as any)?.framerateCapEnabled ??
        false,
      framerateCapValue:
        this.data.robloxSettings?.framerateCapValue ??
        (this.data.settings as any)?.framerateCapValue ??
        60,
      optimizeRamEnabled:
        this.data.robloxSettings?.optimizeRamEnabled ??
        (this.data.settings as any)?.optimizeRamEnabled ??
        false,
      ramOptimization:
        this.data.robloxSettings?.ramOptimization ??
        (this.data.settings as any)?.ramOptimization ??
        1024,
      cpuOptimization:
        this.data.robloxSettings?.cpuOptimization ??
        (this.data.settings as any)?.cpuOptimization ??
        0,

      defaultPhysicsEngine:
        this.data.robloxSettings?.defaultPhysicsEngine ?? "Terrain",
      enableOptimizations:
        this.data.robloxSettings?.enableOptimizations ?? false,
      memoryLimit: this.data.robloxSettings?.memoryLimit ?? 0,
      useDirectX12: this.data.robloxSettings?.useDirectX12 ?? false,
      lowEndGraphics: this.data.robloxSettings?.lowEndGraphics ?? false,
      disableDualChannelAudio:
        this.data.robloxSettings?.disableDualChannelAudio ?? false,
      headlessModeEnabled:
        this.data.robloxSettings?.headlessModeEnabled ?? false,
      timeoutRelaunchEnabled:
        this.data.robloxSettings?.timeoutRelaunchEnabled ?? false,
      timeoutRelaunchSeconds:
        this.data.robloxSettings?.timeoutRelaunchSeconds ?? 3600,
      windowLayoutEnabled:
        (this.data.robloxSettings as any)?.windowLayoutEnabled ?? false,
      windowLayoutPattern:
        (this.data.robloxSettings as any)?.windowLayoutPattern ?? "grid",
      windowLayoutSpacing:
        (this.data.robloxSettings as any)?.windowLayoutSpacing ?? 12,
      windowLayoutColumns:
        (this.data.robloxSettings as any)?.windowLayoutColumns ?? 3,
      windowLayoutWidth:
        (this.data.robloxSettings as any)?.windowLayoutWidth ?? 0,
      windowLayoutHeight:
        (this.data.robloxSettings as any)?.windowLayoutHeight ?? 0,
    };
  }

  private isBase64PinHash(raw: string): boolean {
    return /^[A-Za-z0-9+/]+={0,2}$/.test(raw) && raw.length % 4 === 0;
  }

  public getPinHash(): string | null {
    const hash = this.data.settings?.pinCodeHash ?? null;
    if (!hash || typeof hash !== "string") return null;

    const parts = hash.split(":");
    const isColonHexFormat =
      (parts.length === 2 || parts.length === 3) &&
      parts.every((part) => /^[0-9a-f]+$/i.test(part) && part.length > 0);

    if (isColonHexFormat) {
      return hash;
    }

    if (this.isBase64PinHash(hash)) {
      return hash;
    }

    console.warn(
      "[StorageService] Invalid PIN hash format detected, removing corrupted PIN data",
    );
    if (this.data.settings) {
      delete this.data.settings.pinCodeHash;
      delete this.data.settings.pinLockout;
    }
    this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null };
    this._saveDebounced();
    return null;
  }

  public getEncryptedLicense(): string | null {
    return this.data.encryptedLicense ?? null;
  }

  public setEncryptedLicense(encrypted: string | null): void {
    if (encrypted === null) {
      if (this.data.encryptedLicense) delete this.data.encryptedLicense;
    } else {
      this.data.encryptedLicense = encrypted;
    }
    this._saveDebounced();
  }

  public deleteEncryptedLicense(): void {
    if (this.data.encryptedLicense) {
      delete this.data.encryptedLicense;
      this._saveDebounced();
    }
  }

  public clearAll(): void {
    this.data = {};
    this.decryptedAccounts = null;
    this.decryptedSniperAccounts = null;
    this.encryptedBlob = null;
    this.currentVerifiedPin = null;
    this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null };

    this.diskUnreadable = false;

    try {
      MultiInstance.Disable();
    } catch (e) {}

    const legacyPaths = [
      this.path,
      join(app.getPath("userData"), "config.json"),
      join(app.getPath("userData"), "Sentra", "config.json"),
      join(app.getPath("documents"), "Sentra", "config.json"),
    ];

    for (const pathToDelete of legacyPaths) {
      try {
        if (existsSync(pathToDelete)) {
          unlinkSync(pathToDelete);
        }
      } catch (error) {
        console.error(
          "[StorageService] failed to delete legacy config file during clearAll:",
          pathToDelete,
          error,
        );
      }
    }
  }

  public setPin(
    pin: string | null,
    currentPin?: string,
  ): {
    success: boolean;
    error?: string;
    locked?: boolean;
    lockoutSeconds?: number;
    remainingAttempts?: number;
  } {
    const existingHash = this.getPinHash();
    const now = Date.now();

    let accounts = this.decryptedAccounts;
    if (
      !accounts &&
      this.data.encryptedAccounts &&
      existingHash &&
      currentPin?.trim()
    ) {
      accounts = this.decryptAccountsWithPin(
        this.data.encryptedAccounts,
        currentPin.trim(),
      );
      if (!accounts) {
        return {
          success: false,
          error: "Failed to prepare accounts for re-encryption",
        };
      }
    } else {
      accounts = accounts || [];

      if (
        !existingHash &&
        this.data.encryptedAccounts &&
        accounts.length === 0
      ) {
        try {
          const parsedAccounts = JSON.parse(this.data.encryptedAccounts);
          if (Array.isArray(parsedAccounts)) {
            accounts = parsedAccounts;
          }
        } catch {}
      }
    }

    if (existingHash) {
      if (!currentPin) {
        return {
          success: false,
          error: "Current PIN required to change or remove PIN",
        };
      }

      if (
        this.pinLockoutState.lockedUntil &&
        now < this.pinLockoutState.lockedUntil
      ) {
        const lockoutSeconds = Math.ceil(
          (this.pinLockoutState.lockedUntil - now) / 1000,
        );
        return {
          success: false,
          error: "Too many failed attempts",
          locked: true,
          lockoutSeconds,
          remainingAttempts: 0,
        };
      }

      const verifyResult = pinService.verifyPin(
        currentPin?.trim() || "",
        existingHash,
      );
      if (!verifyResult.success) {
        this.pinLockoutState.count++;
        this.pinLockoutState.lastAttempt = now;
        const remainingAttempts = Math.max(0, 5 - this.pinLockoutState.count);

        if (this.pinLockoutState.count >= 5) {
          const lockoutMultiplier = Math.min(
            this.pinLockoutState.count - 4,
            12,
          );
          const lockoutDuration = 5 * 60 * 1000 * lockoutMultiplier;
          this.pinLockoutState.lockedUntil = now + lockoutDuration;
          this._saveDebounced();
          return {
            success: false,
            error: "Too many failed attempts",
            locked: true,
            lockoutSeconds: Math.ceil(lockoutDuration / 1000),
            remainingAttempts: 0,
          };
        }

        this._saveDebounced();
        return {
          success: false,
          error: "Incorrect current PIN",
          locked: false,
          remainingAttempts,
        };
      }

      this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null };
    }

    if (pin === null) {
      if (this.data.settings) {
        this.data.settings.pinCodeHash = null;
      }
      pinService.resetAttempts();
      pinService.markVerified();
      this.currentVerifiedPin = null;
      this.decryptedAccounts = null;

      this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null };
      this._saveDebounced();
      return { success: true };
    }

    const hash = pinService.createPinHash(pin.trim());

    if (!hash) {
      console.error(
        "Secure storage unavailable. PIN will not be stored unencrypted.",
      );
      return { success: false, error: "Secure storage unavailable" };
    }

    if (!this.data.settings) {
      this.data.settings = {};
    }

    this.data.settings.pinCodeHash = hash;

    this.pinLockoutState = { count: 0, lastAttempt: 0, lockedUntil: null };

    pinService.verifyPin(pin.trim(), hash);
    pinService.resetAttempts();
    pinService.markVerified();
    this.currentVerifiedPin = pin.trim();

    if (accounts.length > 0) {
      const encrypted = this.encryptAccountsWithPin(accounts, pin);
      if (encrypted) {
        this.data.encryptedAccounts = encrypted;
      }
    }

    this._saveDebounced();
    return { success: true };
  }

  public verifyPin(pin: string): {
    success: boolean;
    locked: boolean;
    remainingAttempts: number;
    lockoutSeconds?: number;
    accounts?: Account[];
  } {
    const trimmedPin = pin.trim();
    let storedHash = this.getPinHash();

    if (!storedHash) {
      const recovered = this.loadLegacyAccountConfig();
      if (recovered) {
        storedHash = this.getPinHash();
      }
    }

    const now = Date.now();

    if (
      this.pinLockoutState.lockedUntil &&
      now < this.pinLockoutState.lockedUntil
    ) {
      const lockoutSeconds = Math.ceil(
        (this.pinLockoutState.lockedUntil - now) / 1000,
      );
      return {
        success: false,
        locked: true,
        remainingAttempts: 0,
        lockoutSeconds,
      };
    }

    if (
      this.pinLockoutState.lastAttempt &&
      now - this.pinLockoutState.lastAttempt > 15 * 60 * 1000
    ) {
      this.pinLockoutState.count = 0;
      this.pinLockoutState.lastAttempt = 0;
      this.pinLockoutState.lockedUntil = null;
    }

    if (!storedHash) {
      return { success: false, locked: false, remainingAttempts: 5 };
    }

    const verifyResult = pinService.verifyPin(trimmedPin, storedHash);

    if (verifyResult.success) {
      console.log("[StorageService] PIN verification successful");
      this.currentVerifiedPin = trimmedPin;
      pinService.resetAttempts();
      pinService.markVerified();

      this.pinLockoutState.count = 0;
      this.pinLockoutState.lastAttempt = 0;
      this.pinLockoutState.lockedUntil = null;
      this.save();

      this.#decryptConfigBlobIfNeeded();
      this.decryptedAccounts = null;
      console.log(
        "[StorageService] verifyPin: PIN verified, decryptedAccounts cache cleared for re-decryption",
      );

      const accounts = this.getAccounts();
      return { success: true, locked: false, remainingAttempts: 5, accounts };
    }

    this.pinLockoutState.count++;
    this.pinLockoutState.lastAttempt = now;

    const remainingAttempts = Math.max(0, 5 - this.pinLockoutState.count);

    if (this.pinLockoutState.count >= 5) {
      const lockoutMultiplier = Math.min(this.pinLockoutState.count - 4, 12);
      const lockoutDuration = 5 * 60 * 1000 * lockoutMultiplier;
      this.pinLockoutState.lockedUntil = now + lockoutDuration;
      this.#persistPinMetadata();
      return {
        success: false,
        locked: true,
        remainingAttempts: 0,
        lockoutSeconds: Math.ceil(lockoutDuration / 1000),
      };
    }

    this.#persistPinMetadata();
    return { success: false, locked: false, remainingAttempts };
  }

  public isPinCurrentlyVerified(): boolean {
    return pinService.isPinCurrentlyVerified();
  }

  public getPinLockoutStatus(): {
    locked: boolean;
    lockoutSeconds?: number;
    remainingAttempts: number;
  } {
    const now = Date.now();

    if (
      this.pinLockoutState.lockedUntil &&
      now < this.pinLockoutState.lockedUntil
    ) {
      const seconds = Math.ceil(
        (this.pinLockoutState.lockedUntil - now) / 1000,
      );
      return { locked: true, lockoutSeconds: seconds, remainingAttempts: 0 };
    }

    if (
      this.pinLockoutState.lastAttempt &&
      now - this.pinLockoutState.lastAttempt > 15 * 60 * 1000
    ) {
      this.pinLockoutState.count = 0;
      this.pinLockoutState.lastAttempt = 0;
      this.pinLockoutState.lockedUntil = null;
    }

    const remainingAttempts = Math.max(0, 5 - this.pinLockoutState.count);
    return { locked: false, remainingAttempts };
  }

  public setSettings(settings: {
    primaryAccountId?: string | null;
    allowMultipleInstances?: boolean;
    multiInstanceMethod?: "mutex" | "handle64";
    defaultInstallationPath?: string | null;
    accentColor?: string;
    useDynamicAccentColor?: boolean;
    theme?: ThemePreference;
    tint?: TintPreference;
    showSidebarProfileCard?: boolean;
    privacyMode?: boolean;
    sidebarTabOrder?: TabId[];
    sidebarHiddenTabs?: TabId[];
    pinCode?: string | null;
    browserWindowWidth?: number | null;
    browserWindowHeight?: number | null;
    showReturnPageButton?: boolean;
    userAgentSettings?: {
      currentUserAgentIndex?: number;
      autoSwapUserAgent?: boolean;
      autoSwapIntervalMinutes?: number;
    };

    catalogViewMode?: string;
    inventoryViewMode?: string;
    contentRadius?: string;
    navBorderStyle?: string;
    uiDensity?: string;
    blurIntensity?: string;
    iconWeight?: string;
    motionSpeed?: string;
    fontWeight?: string;
    customTheme?: string;

    isSidebarCollapsed?: boolean;
    navLayout?: string;
    antiAfkEnabled?: boolean;
    renameWindowsEnabled?: boolean;
    framerateCapEnabled?: boolean;
    framerateCapValue?: number;
    optimizeRamEnabled?: boolean;
    ramOptimization?: number;
    cpuOptimization?: number;
  }): void {
    const nextSettings = { ...this.getSettings() };

    if ("primaryAccountId" in settings) {
      nextSettings.primaryAccountId = settings.primaryAccountId ?? null;
    }

    if ("allowMultipleInstances" in settings) {
      nextSettings.allowMultipleInstances = !!settings.allowMultipleInstances;
    }
    if ("multiInstanceMethod" in settings) {
      nextSettings.multiInstanceMethod =
        settings.multiInstanceMethod || "mutex";
    }

    if ("defaultInstallationPath" in settings) {
      nextSettings.defaultInstallationPath =
        settings.defaultInstallationPath ?? null;
    }

    if ("accentColor" in settings && typeof settings.accentColor === "string") {
      nextSettings.accentColor = settings.accentColor;
    }

    if ("useDynamicAccentColor" in settings) {
      nextSettings.useDynamicAccentColor = !!settings.useDynamicAccentColor;
    }

    if ("theme" in settings && typeof settings.theme === "string") {
      nextSettings.theme = settings.theme as ThemePreference;
    }

    if ("tint" in settings && typeof settings.tint === "string") {
      nextSettings.tint = settings.tint as TintPreference;
    }

    if ("showSidebarProfileCard" in settings) {
      nextSettings.showSidebarProfileCard = !!settings.showSidebarProfileCard;
    }

    if ("privacyMode" in settings) {
      nextSettings.privacyMode = !!settings.privacyMode;
    }

    if ("sidebarTabOrder" in settings) {
      nextSettings.sidebarTabOrder = sanitizeSidebarOrder(
        Array.isArray(settings.sidebarTabOrder)
          ? (settings.sidebarTabOrder as TabId[])
          : nextSettings.sidebarTabOrder,
      );
    }

    if ("sidebarHiddenTabs" in settings) {
      nextSettings.sidebarHiddenTabs = sanitizeSidebarHidden(
        Array.isArray(settings.sidebarHiddenTabs)
          ? (settings.sidebarHiddenTabs as TabId[])
          : nextSettings.sidebarHiddenTabs,
      );
    }

    if ("pinCode" in settings && settings.pinCode !== "SET") {
      this.setPin(settings.pinCode ?? null);
    }

    if ("browserWindowWidth" in settings) {
      nextSettings.browserWindowWidth = settings.browserWindowWidth ?? null;
    }

    if ("browserWindowHeight" in settings) {
      nextSettings.browserWindowHeight = settings.browserWindowHeight ?? null;
    }

    if ("showReturnPageButton" in settings) {
      nextSettings.showReturnPageButton = !!settings.showReturnPageButton;
    }

    if ("userAgentSettings" in settings && settings.userAgentSettings) {
      nextSettings.userAgentSettings = {
        currentUserAgentIndex:
          typeof settings.userAgentSettings.currentUserAgentIndex === "number"
            ? settings.userAgentSettings.currentUserAgentIndex
            : (nextSettings.userAgentSettings?.currentUserAgentIndex ?? 0),
        autoSwapUserAgent: !!settings.userAgentSettings.autoSwapUserAgent,
        autoSwapIntervalMinutes:
          typeof settings.userAgentSettings.autoSwapIntervalMinutes === "number"
            ? settings.userAgentSettings.autoSwapIntervalMinutes
            : (nextSettings.userAgentSettings?.autoSwapIntervalMinutes ?? 30),
      };
    }

    const simpleStringKeys = [
      "catalogViewMode",
      "inventoryViewMode",
      "contentRadius",
      "navBorderStyle",
      "uiDensity",
      "blurIntensity",
      "iconWeight",
      "motionSpeed",
      "fontWeight",
      "customTheme",
      "navLayout",
    ] as const;
    for (const key of simpleStringKeys) {
      if (key in settings && typeof (settings as any)[key] === "string") {
        (nextSettings as any)[key] = (settings as any)[key];
      }
    }
    const simpleBoolKeys = [
      "isSidebarCollapsed",
      "antiAfkEnabled",
      "renameWindowsEnabled",
      "framerateCapEnabled",
      "optimizeRamEnabled",
    ] as const;
    for (const key of simpleBoolKeys) {
      if (key in settings && typeof (settings as any)[key] === "boolean") {
        (nextSettings as any)[key] = (settings as any)[key];
      }
    }
    const simpleNumKeys = [
      "framerateCapValue",
      "ramOptimization",
      "cpuOptimization",
    ] as const;
    for (const key of simpleNumKeys) {
      if (key in settings && typeof (settings as any)[key] === "number") {
        (nextSettings as any)[key] = (settings as any)[key];
      }
    }

    nextSettings.sidebarTabOrder = sanitizeSidebarOrder(
      nextSettings.sidebarTabOrder,
    );
    nextSettings.sidebarHiddenTabs = sanitizeSidebarHidden(
      nextSettings.sidebarHiddenTabs,
    );

    const { pinCode, ...settingsWithoutPin } = nextSettings;
    void pinCode;
    this.data.settings = {
      ...(this.data.settings ?? {}),
      ...(settingsWithoutPin as any),
    };

    const robloxSettingsKeys = [
      "defaultPhysicsEngine",
      "enableOptimizations",
      "memoryLimit",
      "useDirectX12",
      "lowEndGraphics",
      "disableDualChannelAudio",
      "headlessModeEnabled",
      "timeoutRelaunchEnabled",
      "timeoutRelaunchSeconds",
      "windowLayoutEnabled",
      "windowLayoutPattern",
      "windowLayoutSpacing",
      "windowLayoutColumns",
      "windowLayoutWidth",
      "windowLayoutHeight",

      "antiAfkEnabled",
      "renameWindowsEnabled",
      "framerateCapEnabled",
      "framerateCapValue",
      "optimizeRamEnabled",
      "ramOptimization",
      "cpuOptimization",
    ] as const;

    const robloxChanges: Partial<any> = {};
    for (const key of robloxSettingsKeys) {
      if (key in settings) {
        robloxChanges[key] = (settings as any)[key];
      }
    }

    if (Object.keys(robloxChanges).length > 0) {
      if (!this.data.robloxSettings) {
        this.data.robloxSettings = {};
      }
      Object.assign(this.data.robloxSettings, robloxChanges);
    }

    this._saveDebounced();

    if (this.data.settings?.allowMultipleInstances) {
      MultiInstance.Enable(this.data.settings?.multiInstanceMethod || "mutex");
    } else {
      MultiInstance.Disable();
    }
  }

  public getExcludeFullGames(): boolean {
    return this.data.excludeFullGames ?? false;
  }

  public setExcludeFullGames(excludeFullGames: boolean): void {
    this.data.excludeFullGames = excludeFullGames;
    this._saveDebounced();
  }

  public getAvatarRenderWidth(): number | undefined {
    return this.data.avatarRenderWidth;
  }

  public setAvatarRenderWidth(width: number): void {
    this.data.avatarRenderWidth = width;
    this._saveDebounced();
  }

  public getWindowWidth(): number | undefined {
    return this.data.windowWidth;
  }

  public setWindowWidth(width: number): void {
    this.data.windowWidth = width;
    this._saveDebounced();
  }

  public getWindowHeight(): number | undefined {
    return this.data.windowHeight;
  }

  public setWindowHeight(height: number): void {
    this.data.windowHeight = height;
    this._saveDebounced();
  }

  public getCustomFonts(): { family: string; url: string }[] {
    return this.data.customFonts || [];
  }

  public addCustomFont(font: { family: string; url: string }): void {
    const fonts = this.data.customFonts || [];
    if (!fonts.some((f) => f.family === font.family)) {
      this.data.customFonts = [...fonts, font];
      this._saveDebounced();
    }
  }

  public removeCustomFont(family: string): void {
    const fonts = this.data.customFonts || [];
    this.data.customFonts = fonts.filter((f) => f.family !== family);
    if (this.data.activeFont === family) {
      this.data.activeFont = null;
    }
    this._saveDebounced();
  }

  public getActiveFont(): string | null {
    return this.data.activeFont ?? null;
  }

  public setActiveFont(family: string | null): void {
    this.data.activeFont = family;
    this._saveDebounced();
  }

  public getWatcherConfig(): {
    autoRestart: boolean;
    enableRAMLimiter: boolean;
    ramLimitMB: number;
    enableClientTimeout: boolean;
    clientTimeoutSeconds: number;
    enableCPULimiter: boolean;
    cpuLimitPercent: number;
  } {
    return {
      autoRestart: this.data.watcherConfig?.autoRestart ?? true,
      enableRAMLimiter: this.data.watcherConfig?.enableRAMLimiter ?? false,
      ramLimitMB: this.data.watcherConfig?.ramLimitMB ?? 800,
      enableClientTimeout:
        this.data.watcherConfig?.enableClientTimeout ?? false,
      clientTimeoutSeconds:
        this.data.watcherConfig?.clientTimeoutSeconds ?? 3600,
      enableCPULimiter: this.data.watcherConfig?.enableCPULimiter ?? false,
      cpuLimitPercent: this.data.watcherConfig?.cpuLimitPercent ?? 80,
    };
  }

  public setWatcherConfig(config: {
    autoRestart?: boolean;
    enableRAMLimiter?: boolean;
    ramLimitMB?: number;
    enableClientTimeout?: boolean;
    clientTimeoutSeconds?: number;
    enableCPULimiter?: boolean;
    cpuLimitPercent?: number;
  }): void {
    if (!this.data.watcherConfig) {
      this.data.watcherConfig = {};
    }
    if (config.autoRestart !== undefined) {
      this.data.watcherConfig.autoRestart = config.autoRestart;
    }
    if (config.enableRAMLimiter !== undefined) {
      this.data.watcherConfig.enableRAMLimiter = config.enableRAMLimiter;
    }
    if (config.ramLimitMB !== undefined) {
      this.data.watcherConfig.ramLimitMB = config.ramLimitMB;
    }
    if (config.enableClientTimeout !== undefined) {
      this.data.watcherConfig.enableClientTimeout = config.enableClientTimeout;
    }
    if (config.clientTimeoutSeconds !== undefined) {
      this.data.watcherConfig.clientTimeoutSeconds =
        config.clientTimeoutSeconds;
    }
    if (config.enableCPULimiter !== undefined) {
      this.data.watcherConfig.enableCPULimiter = config.enableCPULimiter;
    }
    if (config.cpuLimitPercent !== undefined) {
      this.data.watcherConfig.cpuLimitPercent = config.cpuLimitPercent;
    }
    this._saveDebounced();
  }

  public getAllowMultipleInstances(): boolean {
    return this.data.settings?.allowMultipleInstances ?? false;
  }

  public setAllowMultipleInstances(allow: boolean): void {
    if (!this.data.settings) {
      this.data.settings = {};
    }

    if (process.platform === "win32") {
      this.data.settings.allowMultipleInstances = allow;
    } else {
      this.data.settings.allowMultipleInstances = false;
    }
    this._saveDebounced();

    if (this.data.settings.allowMultipleInstances) {
      MultiInstance.Enable(this.data.settings.multiInstanceMethod || "mutex");
    } else {
      MultiInstance.Disable();
    }
  }

  public getRobloxSettings() {
    return {
      defaultPhysicsEngine:
        this.data.robloxSettings?.defaultPhysicsEngine ?? "Terrain",
      enableOptimizations:
        this.data.robloxSettings?.enableOptimizations ?? false,
      memoryLimit: this.data.robloxSettings?.memoryLimit ?? 0,
      useDirectX12: this.data.robloxSettings?.useDirectX12 ?? false,
      lowEndGraphics: this.data.robloxSettings?.lowEndGraphics ?? false,
      disableDualChannelAudio:
        this.data.robloxSettings?.disableDualChannelAudio ?? false,
      antiAfkEnabled: this.data.robloxSettings?.antiAfkEnabled ?? false,
      renameWindowsEnabled:
        this.data.robloxSettings?.renameWindowsEnabled ?? false,
      framerateCapEnabled:
        this.data.robloxSettings?.framerateCapEnabled ?? false,
      framerateCapValue: this.data.robloxSettings?.framerateCapValue ?? 60,
      optimizeRamEnabled: this.data.robloxSettings?.optimizeRamEnabled ?? false,
      ramOptimization: this.data.robloxSettings?.ramOptimization ?? 2048,
      cpuOptimization: this.data.robloxSettings?.cpuOptimization ?? 0,
      headlessModeEnabled:
        this.data.robloxSettings?.headlessModeEnabled ?? false,
      timeoutRelaunchEnabled:
        this.data.robloxSettings?.timeoutRelaunchEnabled ?? false,
      timeoutRelaunchSeconds:
        this.data.robloxSettings?.timeoutRelaunchSeconds ?? 3600,
      windowLayoutEnabled:
        this.data.robloxSettings?.windowLayoutEnabled ?? false,
      windowLayoutPattern:
        this.data.robloxSettings?.windowLayoutPattern ?? "grid",
      windowLayoutSpacing: this.data.robloxSettings?.windowLayoutSpacing ?? 12,
      windowLayoutColumns: this.data.robloxSettings?.windowLayoutColumns ?? 3,
      windowLayoutWidth: this.data.robloxSettings?.windowLayoutWidth ?? 0,
      windowLayoutHeight: this.data.robloxSettings?.windowLayoutHeight ?? 0,
    };
  }

  public setRobloxSettings(settings: {
    defaultPhysicsEngine?: "Terrain" | "Legacy";
    enableOptimizations?: boolean;
    memoryLimit?: number;
    useDirectX12?: boolean;
    lowEndGraphics?: boolean;
    disableDualChannelAudio?: boolean;
    antiAfkEnabled?: boolean;
    renameWindowsEnabled?: boolean;
    framerateCapEnabled?: boolean;
    framerateCapValue?: number;
    optimizeRamEnabled?: boolean;
    ramOptimization?: number;
    cpuOptimization?: number;
    headlessModeEnabled?: boolean;
    timeoutRelaunchEnabled?: boolean;
    timeoutRelaunchSeconds?: number;
    windowLayoutEnabled?: boolean;
    windowLayoutPattern?: "grid" | "rows" | "columns" | "cascade";
    windowLayoutSpacing?: number;
    windowLayoutColumns?: number;
    windowLayoutWidth?: number;
    windowLayoutHeight?: number;
  }): void {
    if (!this.data.robloxSettings) {
      this.data.robloxSettings = {};
    }
    if (settings.defaultPhysicsEngine !== undefined) {
      this.data.robloxSettings.defaultPhysicsEngine =
        settings.defaultPhysicsEngine;
    }
    if (settings.enableOptimizations !== undefined) {
      this.data.robloxSettings.enableOptimizations =
        settings.enableOptimizations;
    }
    if (settings.memoryLimit !== undefined) {
      this.data.robloxSettings.memoryLimit = settings.memoryLimit;
    }
    if (settings.useDirectX12 !== undefined) {
      this.data.robloxSettings.useDirectX12 = settings.useDirectX12;
    }
    if (settings.lowEndGraphics !== undefined) {
      this.data.robloxSettings.lowEndGraphics = settings.lowEndGraphics;
    }
    if (settings.disableDualChannelAudio !== undefined) {
      this.data.robloxSettings.disableDualChannelAudio =
        settings.disableDualChannelAudio;
    }
    if (settings.antiAfkEnabled !== undefined) {
      this.data.robloxSettings.antiAfkEnabled = settings.antiAfkEnabled;
    }
    if (settings.renameWindowsEnabled !== undefined) {
      this.data.robloxSettings.renameWindowsEnabled =
        settings.renameWindowsEnabled;
    }
    if (settings.framerateCapEnabled !== undefined) {
      this.data.robloxSettings.framerateCapEnabled =
        settings.framerateCapEnabled;
    }
    if (settings.framerateCapValue !== undefined) {
      this.data.robloxSettings.framerateCapValue = settings.framerateCapValue;
    }
    if (settings.optimizeRamEnabled !== undefined) {
      this.data.robloxSettings.optimizeRamEnabled = settings.optimizeRamEnabled;
    }
    if (settings.ramOptimization !== undefined) {
      this.data.robloxSettings.ramOptimization = settings.ramOptimization;
    }
    if (settings.cpuOptimization !== undefined) {
      this.data.robloxSettings.cpuOptimization = settings.cpuOptimization;
    }
    if (settings.headlessModeEnabled !== undefined) {
      this.data.robloxSettings.headlessModeEnabled =
        settings.headlessModeEnabled;
    }
    if (settings.timeoutRelaunchEnabled !== undefined) {
      this.data.robloxSettings.timeoutRelaunchEnabled =
        settings.timeoutRelaunchEnabled;
    }
    if (settings.timeoutRelaunchSeconds !== undefined) {
      this.data.robloxSettings.timeoutRelaunchSeconds =
        settings.timeoutRelaunchSeconds;
    }
    if (settings.windowLayoutEnabled !== undefined) {
      this.data.robloxSettings.windowLayoutEnabled =
        settings.windowLayoutEnabled;
    }
    if (settings.windowLayoutPattern !== undefined) {
      this.data.robloxSettings.windowLayoutPattern =
        settings.windowLayoutPattern;
    }
    if (settings.windowLayoutSpacing !== undefined) {
      this.data.robloxSettings.windowLayoutSpacing =
        settings.windowLayoutSpacing;
    }
    if (settings.windowLayoutColumns !== undefined) {
      this.data.robloxSettings.windowLayoutColumns =
        settings.windowLayoutColumns;
    }
    if (settings.windowLayoutWidth !== undefined) {
      this.data.robloxSettings.windowLayoutWidth = settings.windowLayoutWidth;
    }
    if (settings.windowLayoutHeight !== undefined) {
      this.data.robloxSettings.windowLayoutHeight = settings.windowLayoutHeight;
    }

    this._saveDebounced();
  }
}

export const storageService = new StorageService();
