import { EventEmitter } from "events";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import * as crypto from "crypto";
import { session } from "electron";
import { getDataFile } from "../../utils/paths";
import { storageService } from "../system/StorageService";
import {
  isSafeStorageAvailable,
  safeEncrypt,
  safeDecrypt,
} from "../../lib/secureStore";
import type { Account } from "../../../renderer/src/types";

import { AccountStatus } from "../../../renderer/src/types";
import { RobloxLoginWindowService } from "../auth/RobloxLoginWindowService";
import usernameSniperService from "../sniper/UsernameSniper";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type GeneratedAccountData = {
  id: string;
  username: string;
  password: string;
  birthDate?: string;
  createdAt: number;
  cookie?: string;
};

export type GeneratorConfig = {
  usernamePrefix: string;
  passwordLength: number;
  includeSpecialChars: boolean;
  autoLaunchBrowser: boolean;
};

export type AccountCreationResult = {
  success: boolean;
  username?: string;
  password?: string;
  captchaRequired?: boolean;
  error?: string;
  timestamp: number;
};

const GEN_SS_PREFIX = "sgen2:";

const LEGACY_PASSPHRASE = "sentra-generator-v1";

export class GeneratorService extends EventEmitter {
  private config: GeneratorConfig = {
    usernamePrefix: "sentra_",
    passwordLength: 16,
    includeSpecialChars: true,
    autoLaunchBrowser: true,
  };

  private createdAccounts: GeneratedAccountData[] = [];
  private configPath = getDataFile("generator-config.json");
  private accountsPath = getDataFile("generated-accounts.json");
  private passwordMap: Map<string, string> = new Map();
  private cookieMap: Map<string, string> = new Map();
  private browser: any = null;
  private page: any = null;
  private signupBrowserWindow: any = null;
  private signupBrowserWebContents: any = null;
  private signupBrowserPartition: string = "";
  private creatingAccountIds: Set<string> = new Set();
  private accountCreationQueue: Array<() => Promise<AccountCreationResult>> =
    [];
  private queueDraining = false;
  private lastSignupAccount: GeneratedAccountData | null = null;

  constructor() {
    super();
    this.loadConfig();
    this.loadAccounts();
  }

  private encryptAccounts(accounts: GeneratedAccountData[]): string {
    const plaintext = JSON.stringify(accounts);

    if (isSafeStorageAvailable()) {
      const blob = safeEncrypt(plaintext);
      if (blob) return GEN_SS_PREFIX + blob;
    }

    console.warn(
      "[Generator] safeStorage unavailable; generated-accounts.json is only obfuscated, not encrypted",
    );
    return this.encryptAccountsLegacy(plaintext);
  }

  private encryptAccountsLegacy(plaintext: string): string {
    try {
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(
        LEGACY_PASSPHRASE,
        salt,
        100000,
        32,
        "sha256",
      );

      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      let encrypted = cipher.update(plaintext, "utf-8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      return (
        salt.toString("hex") +
        iv.toString("hex") +
        authTag.toString("hex") +
        encrypted
      );
    } catch (error) {
      console.error("[Generator] Failed to encrypt accounts:", error);
      throw error;
    }
  }

  private decryptAccounts(
    encryptedData: string,
  ): GeneratedAccountData[] | null {
    const parseAccounts = (
      plaintext: string,
    ): GeneratedAccountData[] | null => {
      try {
        const accounts = JSON.parse(plaintext);
        return Array.isArray(accounts) ? accounts : null;
      } catch {
        return null;
      }
    };

    if (encryptedData.startsWith(GEN_SS_PREFIX)) {
      const plaintext = safeDecrypt(encryptedData.slice(GEN_SS_PREFIX.length));
      if (plaintext === null) {
        console.error(
          "[Generator] Could not decrypt generated-accounts.json — it may have been copied from another machine or user account",
        );
        return null;
      }
      return parseAccounts(plaintext);
    }

    try {
      if (encryptedData.length < 88) return null;

      const salt = Buffer.from(encryptedData.substring(0, 32), "hex");
      const iv = Buffer.from(encryptedData.substring(32, 56), "hex");
      const authTag = Buffer.from(encryptedData.substring(56, 88), "hex");
      const encrypted = encryptedData.substring(88);

      const key = crypto.pbkdf2Sync(
        LEGACY_PASSPHRASE,
        salt,
        100000,
        32,
        "sha256",
      );

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let plaintext = decipher.update(encrypted, "hex", "utf-8");
      plaintext += decipher.final("utf-8");

      return parseAccounts(plaintext);
    } catch (_error) {
      return null;
    }
  }

  generateAccountData(): GeneratedAccountData {
    const username = this.generateUsername();
    const password = this.generatePassword();
    const birthDate = this.generateBirthDate();

    return {
      id: crypto.randomUUID(),
      username,
      password,
      birthDate,
      createdAt: Date.now(),
    };
  }

  async checkUsernameValidity(username: string): Promise<boolean> {
    try {
      const result = await usernameSniperService.checkUsername(username);

      if (result.code === 0) {
        console.log(
          `[Generator] Username "${username}" is available (code: 0)`,
        );
        return true;
      } else if (result.code === 1) {
        console.log(`[Generator] Username "${username}" is already taken`);
        return false;
      } else if (result.code === 2) {
        console.log(`[Generator] Username "${username}" is censored`);
        return false;
      } else {
        console.log(
          `[Generator] Could not validate username "${username}": ${result.message}`,
        );
        return false;
      }
    } catch (error) {
      console.error(
        `[Generator] Error checking username "${username}":`,
        error,
      );
      return false;
    }
  }

  async generateValidUsername(maxAttempts: number = 10): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const username = this.generateUsername();
      console.log(
        `[Generator] Checking username: ${username} (attempt ${attempt + 1}/${maxAttempts})`,
      );

      const isValid = await this.checkUsernameValidity(username);
      if (isValid) {
        return username;
      }
    }

    throw new Error(
      `Failed to generate valid username after ${maxAttempts} attempts`,
    );
  }

  private generateUsername(): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomId = "";
    for (let i = 0; i < 6; i++) {
      randomId += alphabet.charAt(crypto.randomInt(alphabet.length));
    }
    return `${this.config.usernamePrefix}${randomId}`;
  }

  private generatePassword(): string {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const specialChars = "!@#$%^&*";

    let chars = uppercase + lowercase + numbers;
    if (this.config.includeSpecialChars) {
      chars += specialChars;
    }

    const length = Math.min(
      128,
      Math.max(8, Math.floor(this.config.passwordLength) || 16),
    );

    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars.charAt(crypto.randomInt(chars.length));
    }

    return password;
  }

  private generateBirthDate(): string {
    const now = new Date();
    const minAge = 13;
    const maxAge = 80;

    const minYear = now.getFullYear() - maxAge;
    const maxYear = now.getFullYear() - minAge;

    const year = crypto.randomInt(minYear, maxYear + 1);
    const month = crypto.randomInt(1, 13);
    const day = crypto.randomInt(1, 29);

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  async launchBrowser(): Promise<string> {
    const browserLaunchTimeout = 30000;
    const launchStartTime = Date.now();

    try {
      const checkTimeout = () => {
        if (Date.now() - launchStartTime > browserLaunchTimeout) {
          throw new Error("Browser launch timeout - operation took too long");
        }
      };

      if (this.signupBrowserWindow && !this.signupBrowserWindow.isDestroyed()) {
        try {
          this.signupBrowserWindow.close();
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          console.warn("[Generator] Error closing existing window:", err);
        }
      }
      checkTimeout();

      let windowWidth = 1280;
      let windowHeight = 800;
      try {
        const settings = storageService.getSettings();
        windowWidth = settings.browserWindowWidth ?? 1280;
        windowHeight = settings.browserWindowHeight ?? 800;
        console.log(
          "[Generator] Opening signup browser with dimensions:",
          windowWidth,
          "x",
          windowHeight,
        );
      } catch (settingErr) {
        console.warn(
          "[Generator] Error getting settings, using defaults:",
          settingErr,
        );
      }

      console.log("[Generator] Opening signup browser...");
      checkTimeout();

      try {
        const signupBrowserInfo =
          await RobloxLoginWindowService.openSignupBrowser(
            windowWidth,
            windowHeight,
          );
        this.signupBrowserWindow = signupBrowserInfo.browserWindow;
        this.signupBrowserWebContents = signupBrowserInfo.webContents;
        this.signupBrowserPartition = signupBrowserInfo.partition;

        console.log("[Generator] Signup browser opened");
      } catch (browserErr) {
        console.error("[Generator] Failed to open browser:", browserErr);
        throw new Error(`Browser launch failed: ${String(browserErr)}`);
      }
      checkTimeout();

      let formLoaded = false;
      const formLoadStartTime = Date.now();
      const formLoadTimeout = 12000;

      while (!formLoaded && Date.now() - formLoadStartTime < formLoadTimeout) {
        try {
          if (!this.signupBrowserWebContents) break;
          const hasForm = await this.signupBrowserWebContents
            .executeJavaScript(`
            !!(document.getElementById('signup-username') || document.querySelector('input[placeholder*="Username"]'))
          `);
          if (hasForm) {
            formLoaded = true;
            break;
          }
        } catch (err) {
          console.debug(
            "[Generator] Form check attempt failed:",
            err instanceof Error ? err.message : String(err),
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (!formLoaded) {
        console.warn("[Generator] Form did not load within timeout");
      }
      checkTimeout();

      try {
        const formDebug = await this.signupBrowserWebContents
          .executeJavaScript(`
          (() => {
            const usernameInput = document.getElementById('signup-username')
            const passwordInput = document.getElementById('signup-password')
            const allInputs = Array.from(document.querySelectorAll('input'))
            
            return {
              usernameExists: !!usernameInput,
              passwordExists: !!passwordInput,
              usernameTag: usernameInput?.tagName,
              passwordTag: passwordInput?.tagName,
              usernameOnChange: !!usernameInput?.onchange,
              passwordOnChange: !!passwordInput?.onchange,
              usernameClasses: usernameInput?.className,
              passwordClasses: passwordInput?.className,
              allInputs: allInputs.map(i => ({ 
                id: i.id, 
                name: i.name, 
                type: i.type,
                classes: i.className,
                readonly: i.readOnly,
                disabled: i.disabled
              }))
            }
          })()
        `);

        console.log("[Generator] Form structure debug: fields exist", {
          usernameExists: formDebug.usernameExists,
          passwordExists: formDebug.passwordExists,
          totalInputs: formDebug.allInputs?.length || 0,
        });
      } catch (debugErr) {
        console.warn("[Generator] Could not debug form structure:", debugErr);
      }

      console.log(
        "[Generator] Page fully loaded, ready to auto-fill signup form",
      );
      this.emit("browser-launched");
      return this.signupBrowserPartition;
    } catch (err) {
      console.error("[Generator] Browser launch error:", err);
      console.error(
        "[Generator] Error stack:",
        err instanceof Error ? err.stack : "No stack",
      );
      this.emit("browser-error", String(err));
      throw err;
    }
  }

  private async detectSignupSystem(): Promise<"old" | "new"> {
    if (!this.signupBrowserWebContents) {
      throw new Error("Browser not launched");
    }

    try {
      const hasOldSystem = await this.signupBrowserWebContents
        .executeJavaScript(`
        (() => {
          return document.getElementById('MonthDropdown') !== null
        })()
      `);

      if (hasOldSystem) {
        console.log("[Generator] Detected OLD signup system (select elements)");
        return "old";
      }

      const hasNewSystem = await this.signupBrowserWebContents
        .executeJavaScript(`
        (() => {
          const buttons = Array.from(document.querySelectorAll('button[role="combobox"]'))
          return buttons.some(btn => btn.getAttribute('aria-label')?.includes('Month'))
        })()
      `);

      if (hasNewSystem) {
        console.log("[Generator] Detected NEW signup system (radix combobox)");
        return "new";
      }

      throw new Error(
        "Could not detect signup system - page structure unknown",
      );
    } catch (err) {
      console.error("[Generator] Error detecting signup system:", err);
      throw err;
    }
  }

  async fillForm(accountData: GeneratedAccountData): Promise<void> {
    try {
      if (!this.signupBrowserWebContents) {
        throw new Error("Browser not launched");
      }

      console.log("[Generator] Filling signup form...");

      const system = await this.detectSignupSystem();

      if (
        !accountData.birthDate ||
        !accountData.birthDate.match(
          /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
        )
      ) {
        throw new Error(
          `Invalid birth date format: ${accountData.birthDate}. Expected YYYY-MM-DD.`,
        );
      }
      const [year, month, day] = accountData.birthDate.split("-");
      const monthNum = parseInt(month);
      if (monthNum < 1 || monthNum > 12) {
        throw new Error(`Invalid month: ${month}. Must be between 01-12.`);
      }
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const monthValue = monthNames[monthNum - 1];

      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      if (system === "old") {
        console.log(`[Generator] Using OLD system selectors`);

        console.log(`[Generator] Setting birthday month: ${monthValue}`);
        await this.signupBrowserWebContents.executeJavaScript(`
          (() => {
            const select = document.getElementById('MonthDropdown')
            if (select) {
              select.focus()
              select.value = '${monthValue}'
              select.dispatchEvent(new Event('input', { bubbles: true }))
              select.dispatchEvent(new Event('change', { bubbles: true }))
              select.blur()
            }
          })()
        `);
        await sleep(500);

        console.log(`[Generator] Setting birthday day: ${day}`);
        await this.signupBrowserWebContents.executeJavaScript(`
          (() => {
            const select = document.getElementById('DayDropdown')
            if (select) {
              select.focus()
              select.value = '${day}'
              select.dispatchEvent(new Event('input', { bubbles: true }))
              select.dispatchEvent(new Event('change', { bubbles: true }))
              select.blur()
            }
          })()
        `);
        await sleep(500);

        console.log(`[Generator] Setting birthday year: ${year}`);
        await this.signupBrowserWebContents.executeJavaScript(`
          (() => {
            const select = document.getElementById('YearDropdown')
            if (select) {
              select.focus()
              select.value = '${year}'
              select.dispatchEvent(new Event('input', { bubbles: true }))
              select.dispatchEvent(new Event('change', { bubbles: true }))
              select.blur()
            }
          })()
        `);
        await sleep(500);
      } else {
        console.log(`[Generator] Using NEW system selectors (radix combobox)`);

        if (!this.signupBrowserWebContents) {
          throw new Error("Browser not launched - missing webContents");
        }

        console.log(`[Generator] Setting birthday month: ${monthValue}`);

        const monthBtnClicked = await this.signupBrowserWebContents
          .executeJavaScript(`
          (() => {
            const allButtons = Array.from(document.querySelectorAll('button[role="combobox"]'))
            const monthBtn = allButtons.find(btn => btn.getAttribute('aria-label')?.includes('Month'))
            if (monthBtn) {
              monthBtn.click()
              return true
            }
            return false
          })()
        `);
        console.log("[Generator] Month button clicked:", monthBtnClicked);
        await sleep(800);

        const monthOptionClicked = await this.signupBrowserWebContents
          .executeJavaScript(`
          (() => {
            const allOptions = Array.from(document.querySelectorAll('[role="option"]'))
            let options = allOptions.filter(el => el.textContent?.trim() === '${monthValue}')
            
            if (options.length === 0) {
              options = allOptions.filter(el => el.textContent?.trim().includes('${monthValue}'))
            }
            
            if (options.length === 0) {
              options = allOptions.filter(el => el.textContent?.trim().length > 0).slice(0, 1)
            }
            
            if (options.length > 0) {
              options[0].click()
              return { found: true, text: options[0].textContent?.trim() }
            }
            return { found: false }
          })()
        `);
        console.log("[Generator] Month option result:", monthOptionClicked);
        await sleep(600);

        const dayFormatted = String(parseInt(day)).padStart(2, "0");
        await this.signupBrowserWebContents.executeJavaScript(`
          (() => {
            const buttons = Array.from(document.querySelectorAll('button[role="combobox"]'))
            const dayBtn = buttons.find(btn => btn.getAttribute('aria-label')?.includes('Day'))
            if (dayBtn) dayBtn.click()
          })()
        `);
        await sleep(600);

        await this.signupBrowserWebContents.executeJavaScript(`
          (() => {
            const options = Array.from(document.querySelectorAll('[role="option"]'))
            const opt = options.find(el => el.textContent?.trim() === '${dayFormatted}')
            if (opt) opt.click()
          })()
        `);
        await sleep(600);

        console.log(`[Generator] Setting birthday year: ${year}`);
        await this.signupBrowserWebContents.executeJavaScript(`
          (() => {
            const buttons = Array.from(document.querySelectorAll('button[role="combobox"]'))
            const yearBtn = buttons.find(btn => btn.getAttribute('aria-label')?.includes('Year'))
            if (yearBtn) yearBtn.click()
          })()
        `);
        await sleep(600);

        await this.signupBrowserWebContents.executeJavaScript(`
          (() => {
            const options = Array.from(document.querySelectorAll('[role="option"]'))
            const opt = options.find(el => el.textContent?.trim() === '${year}')
            if (opt) opt.click()
          })()
        `);
        await sleep(600);
      }

      console.log(`[Generator] Filling username: ${accountData.username}`);
      const usernameResult = await this.signupBrowserWebContents
        .executeJavaScript(`
        (() => {
          const input = document.getElementById('signup-username')
          if (input) {
            
            const text = ${JSON.stringify(accountData.username)}
            
            
            const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
            if (descriptor && descriptor.set) {
              descriptor.set.call(input, text)
            } else {
              input.value = text
            }
            
            
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
            
            
            return { filledValue: input.value }
          }
          return { filledValue: 'INPUT_NOT_FOUND' }
        })()
      `);
      console.log("[Generator] Username fill result:", usernameResult);
      await sleep(500);

      console.log(`[Generator] Filling password`);
      await this.signupBrowserWebContents.executeJavaScript(`
        (() => {
          const input = document.getElementById('signup-password')
          if (input) {
            
            const text = ${JSON.stringify(accountData.password)}
            
            
            const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
            if (descriptor && descriptor.set) {
              descriptor.set.call(input, text)
            } else {
              input.value = text
            }
            
            
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
            
            
            return { filledValue: input.value }
          }
          return { filledValue: 'INPUT_NOT_FOUND' }
        })()
      `);
      console.log("[Generator] Password filled for field signup-password");
      await sleep(500);

      console.log("[Generator] Form filled successfully");

      const verifyValues = await this.signupBrowserWebContents
        .executeJavaScript(`
        (() => {
          const username = document.getElementById('signup-username')?.value || ''
          const password = document.getElementById('signup-password')?.value || ''
          const month = document.getElementById('MonthDropdown')?.value || document.querySelector('button[role="combobox"][aria-label*="Month"]')?.textContent || ''
          return { 
            usernameLength: username.length,
            passwordLength: password.length,
            monthSet: !!month,
            allFieldsFilled: !!(username && password && month)
          }
        })()
      `);
      console.log("[Generator] Form fields populated:", verifyValues);

      this.emit("form-filled", accountData);
    } catch (err) {
      console.error("[Generator] Form fill error:", err);
      this.emit("form-error", String(err));
      throw err;
    }
  }

  async submitForm(): Promise<void> {
    try {
      if (!this.signupBrowserWebContents) {
        throw new Error("Browser not launched");
      }

      console.log("[Generator] Waiting for submit button to become enabled...");
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const safeExecute = async (code: string, label: string) => {
        try {
          if (!this.signupBrowserWebContents) {
            throw new Error("WebContents is null - browser was closed");
          }
          return await this.signupBrowserWebContents.executeJavaScript(code);
        } catch (err) {
          console.error(`[Generator] Error during "${label}":`, err);
          throw err;
        }
      };

      let oldSubmitExists = false;
      try {
        oldSubmitExists = await safeExecute(
          `
          (() => {
            return document.getElementById('signup-button') !== null
          })()
        `,
          "checking old submit button",
        );
      } catch (err) {
        console.warn("[Generator] Could not check for old submit button:", err);
        return;
      }

      if (oldSubmitExists) {
        console.log(
          "[Generator] Found OLD system submit button (#signup-button)",
        );

        let isEnabled = false;
        let attempts = 0;
        while (!isEnabled && attempts < 20) {
          try {
            isEnabled = await safeExecute(
              `
              (() => {
                const btn = document.getElementById('signup-button')
                return btn && !btn.hasAttribute('disabled') && btn.offsetHeight > 0
              })()
            `,
              "checking button enabled status",
            );
          } catch (err) {
            console.warn(
              "[Generator] Button check failed, assuming closed:",
              err,
            );
            return;
          }
          if (!isEnabled) {
            await sleep(500);
            attempts++;
          }
        }

        if (!isEnabled) {
          console.warn(
            "[Generator] Button did not become enabled after 10 seconds, trying anyway...",
          );
        } else {
          console.log("[Generator] Button is now enabled");
        }

        console.log("[Generator] Clicking signup button...");
        try {
          await safeExecute(
            `
            (() => {
              const btn = document.getElementById('signup-button')
              if (btn) btn.click()
            })()
          `,
            "clicking old submit button",
          );
        } catch (err) {
          console.warn("[Generator] Failed to click submit button:", err);
          return;
        }
      } else {
        console.log(
          '[Generator] Looking for NEW system submit button (button[type="submit"])',
        );

        let isEnabled = false;
        let attempts = 0;
        while (!isEnabled && attempts < 20) {
          try {
            isEnabled = await safeExecute(
              `
              (() => {
                const btn = document.querySelector('button[type="submit"]')
                return btn && !btn.hasAttribute('disabled') && !btn.classList.contains('disabled') && btn.offsetHeight > 0
              })()
            `,
              "checking new button enabled status",
            );
          } catch (err) {
            console.warn(
              "[Generator] Button check failed, assuming closed:",
              err,
            );
            return;
          }
          if (!isEnabled) {
            await sleep(500);
            attempts++;
          }
        }

        if (!isEnabled) {
          console.warn(
            "[Generator] Button did not become enabled after 10 seconds, trying anyway...",
          );
        } else {
          console.log("[Generator] Button is now enabled");
        }

        console.log("[Generator] Clicking submit button...");
        try {
          await safeExecute(
            `
            (() => {
              const btn = document.querySelector('button[type="submit"]')
              if (btn) btn.click()
            })()
          `,
            "clicking new submit button",
          );
        } catch (err) {
          console.warn("[Generator] Failed to click new submit button:", err);
          return;
        }
      }

      await sleep(2000);

      console.log("[Generator] Form submitted");
      this.emit("form-submitted");
    } catch (err) {
      console.error("[Generator] Form submission error:", err);
      this.emit("submit-error", String(err));
      throw err;
    }
  }

  async closeBrowser(): Promise<void> {
    try {
      if (this.signupBrowserWindow && !this.signupBrowserWindow.isDestroyed()) {
        try {
          this.signupBrowserWindow.close();
        } catch (err) {
          console.warn("[Generator] Error closing window:", err);
        }

        this.signupBrowserWindow = null;
        this.signupBrowserWebContents = null;
        this.signupBrowserPartition = "";

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      console.log("[Generator] Browser cleaned up");
      this.emit("browser-closed");
    } catch (err) {
      console.error("[Generator] Error closing browser:", err);
    }
  }

  async generateAndSignup(): Promise<GeneratedAccountData> {
    const queued = await this.enqueueCreation(async () => {
      try {
        const accountData = await this.runSignupWorkflow();
        return {
          success: true,
          username: accountData.username,
          password: accountData.password,
          timestamp: Date.now(),
        };
      } catch (err) {
        return {
          success: false,
          error: String(err),
          timestamp: Date.now(),
        };
      }
    });

    if (!queued.success || !this.lastSignupAccount) {
      throw new Error(queued.error ?? "Signup failed");
    }
    return this.lastSignupAccount;
  }

  private async runSignupWorkflow(): Promise<GeneratedAccountData> {
    try {
      const accountData = this.generateAccountData();
      this.lastSignupAccount = null;
      console.log("[Generator] Generated account data:", {
        username: accountData.username,
        birthDate: accountData.birthDate,
      });

      const partition = await this.launchBrowser();

      await this.fillForm(accountData);

      console.log(
        "[Generator] Auto-clicking signup button immediately after filling form...",
      );
      await this.submitForm();

      console.log(
        "[Generator] Monitoring for .ROBLOSECURITY cookie (max 5 minutes)...",
      );
      this.emit("waiting-for-captcha", {
        message:
          "Please complete the captcha in the browser window. Account will be added when logged in.",
      });

      const robloxSecurityCookie = await this.waitForSignupCookie(
        partition,
        600,
      );

      if (!robloxSecurityCookie) {
        console.warn(
          "[Generator] Timeout waiting for cookie (5 minutes elapsed)",
        );
        await this.closeBrowser();
        throw new Error(
          "Account creation failed: no .ROBLOSECURITY cookie was set. The captcha may not have been completed, or signup was rejected.",
        );
      }

      await this.addAccountToStorage(accountData, robloxSecurityCookie, false);

      console.log("[Generator] Account signup workflow completed successfully");
      this.lastSignupAccount = accountData;
      this.emit("signup-completed", accountData);

      return accountData;
    } catch (err) {
      console.error("[Generator] Signup workflow error:", err);

      await this.closeBrowser();
      this.emit("signup-error", String(err));
      throw err;
    }
  }

  private async waitForSignupCookie(
    partition: string,
    maxPollAttempts: number,
  ): Promise<string> {
    if (!partition) return "";
    const signupSession = session.fromPartition(partition);

    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      try {
        const cookies = await signupSession.cookies.get({
          name: ".ROBLOSECURITY",
        });
        if (cookies && cookies.length > 0 && cookies[0].value) {
          console.log("[Generator] Cookie extracted successfully");
          return cookies[0].value;
        }
      } catch (err) {
        console.debug(
          "[Generator] Cookie poll attempt failed:",
          err instanceof Error ? err.message : String(err),
        );
      }

      if ((attempt + 1) % 20 === 0) {
        console.log(
          "[Generator] Still waiting for cookie... (",
          Math.round((attempt + 1) * 0.5),
          "s elapsed)",
        );
      }
      await sleep(500);
    }

    return "";
  }

  private async addAccountToStorage(
    accountData: GeneratedAccountData,
    cookie: string,
    fromSniper: boolean = false,
  ): Promise<void> {
    try {
      const accountId = randomUUID();
      accountData.id = accountId;
      this.passwordMap.set(accountId, accountData.password);
      this.cookieMap.set(accountId, cookie);

      accountData.cookie = cookie;

      this.createdAccounts.push(accountData);
      this.persistAccounts();

      console.log(
        "[Generator] Account stored in generator storage:",
        accountData.username,
        "ID:",
        accountId,
      );

      if (fromSniper) {
        try {
          const newAccount: Account = {
            id: accountId,
            displayName: accountData.username,
            username: accountData.username,
            userId: "",
            cookie: cookie || undefined,
            password: accountData.password,
            status: AccountStatus.Offline,
            importedVia: "cookie",
            avatarUrl: "",
            lastActive: new Date().toISOString(),
            robuxBalance: 0,
            friendCount: 0,
            followerCount: 0,
            followingCount: 0,
            isPremium: false,
            isAdmin: false,
            notes: "",
          };

          storageService.addSniperAccount(newAccount);
          console.log(
            "[Generator] Account added to Sniper Generated list:",
            accountData.username,
          );
        } catch (err) {
          console.warn(
            "[Generator] Failed to add account to sniper storage:",
            err,
          );
        }
      }

      this.emit("account-created", {
        accountId,
        username: accountData.username,
      });

      console.log("[Generator] Closing signup browser...");
      if (this.signupBrowserWindow && !this.signupBrowserWindow.isDestroyed()) {
        try {
          this.signupBrowserWindow.close();
          this.signupBrowserWindow = null;
          this.signupBrowserWebContents = null;
        } catch (err) {
          console.warn("[Generator] Error closing signup window:", err);
        }
      }

      console.log("[Generator] Signup browser closed");
    } catch (err) {
      console.error("[Generator] Failed to add account to storage:", err);
      this.emit("storage-error", String(err));
    }
  }

  async createAccount(): Promise<AccountCreationResult> {
    return this.enqueueCreation(async () => {
      try {
        console.log("[Generator] Starting account creation...");

        let accountData: GeneratedAccountData;
        try {
          console.log("[Generator] Generating valid username...");
          const validUsername = await this.generateValidUsername(10);
          accountData = this.generateAccountData();
          accountData.username = validUsername;
          console.log(
            `[Generator] Generated valid account: ${accountData.username}`,
          );
        } catch (error) {
          console.error(
            "[Generator] Failed to generate valid username:",
            error,
          );
          return {
            success: false,
            error: String(error),
            timestamp: Date.now(),
          };
        }

        return await this.processAccountCreation(accountData);
      } catch (error) {
        return {
          success: false,
          error: String(error),
          timestamp: Date.now(),
        };
      }
    });
  }

  async createAccountWithUsername(
    username: string,
  ): Promise<AccountCreationResult> {
    return this.enqueueCreation(async () => {
      try {
        console.log(`[Generator] Processing account creation for: ${username}`);

        const password = this.generatePassword();
        const birthDate = this.generateBirthDate();

        const accountData: GeneratedAccountData = {
          id: randomUUID(),
          username,
          password,
          birthDate,
          createdAt: Date.now(),
        };

        return await this.processAccountCreation(accountData, true, true);
      } catch (error) {
        console.error(
          `[Generator] Account creation error for ${username}:`,
          error,
        );
        return {
          success: false,
          error: String(error),
          timestamp: Date.now(),
        };
      }
    });
  }

  private enqueueCreation(
    task: () => Promise<AccountCreationResult>,
  ): Promise<AccountCreationResult> {
    return new Promise<AccountCreationResult>((resolve) => {
      this.accountCreationQueue.push(async () => {
        const result = await task();
        resolve(result);
        return result;
      });
      void this.drainAccountCreationQueue();
    });
  }

  private async drainAccountCreationQueue(): Promise<void> {
    if (this.queueDraining) return;
    this.queueDraining = true;
    try {
      while (this.accountCreationQueue.length > 0) {
        const next = this.accountCreationQueue.shift();
        if (!next) continue;
        try {
          await next();
        } catch (err) {
          console.error("[Generator] Queued creation threw:", err);
        }
      }
    } finally {
      this.queueDraining = false;

      if (this.accountCreationQueue.length > 0) {
        void this.drainAccountCreationQueue();
      }
    }
  }

  private async processAccountCreation(
    accountData: GeneratedAccountData,
    forceLaunchBrowser: boolean = false,
    fromSniper: boolean = false,
  ): Promise<AccountCreationResult> {
    try {
      console.log(
        "[Generator] Launching browser for account creation (forceLaunchBrowser=" +
          forceLaunchBrowser +
          ")",
      );
      let partition: string;
      try {
        partition = await this.launchBrowser();
        console.log("[Generator] Browser launched successfully!");
      } catch (launchErr) {
        console.error(
          "[Generator] CRITICAL: Failed to launch browser:",
          launchErr,
        );
        throw new Error(`Failed to launch browser: ${String(launchErr)}`);
      }
      try {
        console.log("[Generator] Filling form...");
        await this.fillForm(accountData);
        console.log("[Generator] Form filled successfully!");
      } catch (fillErr) {
        console.error("[Generator] Failed to fill form:", fillErr);
        throw fillErr;
      }

      try {
        console.log("[Generator] Submitting form...");
        await this.submitForm();
        console.log("[Generator] Form submitted!");
      } catch (submitErr) {
        console.error("[Generator] Failed to submit form:", submitErr);
        throw submitErr;
      }

      console.log("[Generator] Monitoring for .ROBLOSECURITY cookie...");
      const robloxSecurityCookie = await this.waitForSignupCookie(
        partition,
        600,
      );

      if (!robloxSecurityCookie) {
        console.error(
          "[Generator] CRITICAL: Failed to get .ROBLOSECURITY cookie after signup",
        );
        throw new Error(
          "Account creation failed - no cookie returned (likely captcha/rate limit)",
        );
      }

      try {
        await this.addAccountToStorage(
          accountData,
          robloxSecurityCookie,
          fromSniper,
        );
      } catch (storageErr) {
        console.error(
          "[Generator] Failed to add account to storage:",
          storageErr,
        );
      }

      console.log(
        `[Generator] Account created successfully: ${accountData.username}`,
      );

      return {
        success: true,
        username: accountData.username,
        password: accountData.password,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.error("[Generator] Account creation error:", err);
      await this.closeBrowser();

      return {
        success: false,
        error: String(err),
        timestamp: Date.now(),
      };
    }
  }

  updateConfig(config: Partial<GeneratorConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    console.log("[Generator] Config updated:", this.config);
    this.emit("config-updated", this.config);
  }

  getConfig(): GeneratorConfig {
    return { ...this.config };
  }

  getPassword(accountId: string): string {
    return this.passwordMap.get(accountId) || "";
  }

  getCookie(accountId: string): string {
    return this.cookieMap.get(accountId) || "";
  }

  private saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.error("[Generator] Failed to save config:", err);
    }
  }

  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, "utf-8");
        const loaded = JSON.parse(data);
        this.config = { ...this.config, ...loaded };
        console.log("[Generator] Config loaded");
      }
    } catch (err) {
      console.error("[Generator] Failed to load config:", err);
    }
  }

  getAccounts(): GeneratedAccountData[] {
    return [...this.createdAccounts];
  }

  clearAccounts(): void {
    this.createdAccounts = [];
    this.passwordMap.clear();
    this.cookieMap.clear();
    this.persistAccounts();
    console.log("[Generator] All accounts cleared");
  }

  deleteAccount(accountId: string): boolean {
    const initialLength = this.createdAccounts.length;
    this.createdAccounts = this.createdAccounts.filter(
      (acc) => acc.id !== accountId,
    );

    if (this.createdAccounts.length < initialLength) {
      this.passwordMap.delete(accountId);
      this.cookieMap.delete(accountId);
      this.persistAccounts();
      console.log("[Generator] Account deleted:", accountId);
      return true;
    }
    return false;
  }

  private persistAccounts(): void {
    try {
      const encrypted = this.encryptAccounts(this.createdAccounts);
      writeFileSync(this.accountsPath, encrypted);
      console.log(
        "[Generator] Persisted",
        this.createdAccounts.length,
        "encrypted accounts to file",
      );
    } catch (err) {
      console.error("[Generator] Failed to save accounts:", err);
    }
  }

  private loadAccounts(): void {
    try {
      if (existsSync(this.accountsPath)) {
        const data = readFileSync(this.accountsPath, "utf-8");
        const decrypted = this.decryptAccounts(data);
        if (decrypted) {
          this.createdAccounts = decrypted;
          console.log(
            `[Generator] Loaded ${this.createdAccounts.length} decrypted accounts`,
          );

          this.passwordMap.clear();
          this.cookieMap.clear();
          for (const acc of this.createdAccounts) {
            if (acc?.id && typeof acc.password === "string") {
              this.passwordMap.set(acc.id, acc.password);
            }
            if (acc?.id && typeof acc.cookie === "string" && acc.cookie) {
              this.cookieMap.set(acc.id, acc.cookie);
            }
          }

          if (!data.startsWith(GEN_SS_PREFIX) && isSafeStorageAvailable()) {
            console.log(
              "[Generator] Migrating accounts vault to OS-bound encryption",
            );
            this.persistAccounts();
          }
        } else {
          console.warn(
            "[Generator] Failed to decrypt accounts, defaulting to empty array",
          );
          this.createdAccounts = [];
        }
      }
    } catch (err) {
      console.error("[Generator] Failed to load accounts:", err);
      this.createdAccounts = [];
    }
  }
}

export const generatorService = new GeneratorService();
