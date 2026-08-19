import { RobloxUserService } from "../users/UserService";
import { RobloxAuthService } from "./RobloxAuthService";
import { storageService } from "../system/StorageService";
import { createHash } from "crypto";

export class CookieRefreshService {
  private validationCache: Map<
    string,
    { lastCheck: number; isValid: boolean }
  > = new Map();
  private cacheValidityMs = 1000 * 60 * 5;

  #cacheKey(cookie: string): string {
    return "cookie_" + createHash("sha256").update(cookie).digest("hex");
  }

  async validateAndRefresh(cookie: string): Promise<boolean> {
    if (!cookie || cookie.trim().length === 0) {
      return false;
    }

    try {
      const cacheKey = this.#cacheKey(cookie);
      const cached = this.validationCache.get(cacheKey);
      if (cached && Date.now() - cached.lastCheck < this.cacheValidityMs) {
        this.validationCache.delete(cacheKey);
        this.validationCache.set(cacheKey, cached);
        return cached.isValid;
      }

      const user = await RobloxUserService.getAuthenticatedUser(cookie);

      if (user && user.id) {
        this.updateAccountLastActive(user.id.toString(), cookie);

        if (this.validationCache.size >= 200) {
          const oldestKey = this.validationCache.keys().next().value;
          if (oldestKey !== undefined) this.validationCache.delete(oldestKey);
        }

        this.validationCache.set(cacheKey, {
          lastCheck: Date.now(),
          isValid: true,
        });

        return true;
      }

      return false;
    } catch (error) {
      const cacheKey = this.#cacheKey(cookie);

      if (this.validationCache.size >= 200) {
        const oldestKey = this.validationCache.keys().next().value;
        if (oldestKey !== undefined) this.validationCache.delete(oldestKey);
      }

      this.validationCache.set(cacheKey, {
        lastCheck: Date.now(),
        isValid: false,
      });

      console.error("[CookieRefreshService] Cookie validation failed:", error);
      return false;
    }
  }

  private updateAccountLastActive(userId: string, cookie: string): void {
    try {
      const accounts = storageService.getAccounts() as any[];

      const updated = accounts.map((acc) => {
        if (acc.userId === userId) {
          return {
            ...acc,
            lastActive: new Date().toISOString(),
          };
        }
        return acc;
      });

      if (JSON.stringify(accounts) !== JSON.stringify(updated)) {
        storageService.setAccounts(updated);
      }
    } catch (error) {
      console.error(
        "[CookieRefreshService] Failed to update last active:",
        error,
      );
    }
  }

  getInactivityDuration(lastActive: string): number {
    if (!lastActive) return Infinity;
    const lastActiveTime = new Date(lastActive).getTime();
    return Date.now() - lastActiveTime;
  }

  isLikelyExpired(lastActive: string): boolean {
    const inactivityMs = this.getInactivityDuration(lastActive);
    const thirtyDaysMs = 1000 * 60 * 60 * 24 * 30;
    return inactivityMs > thirtyDaysMs;
  }

  daysUntilLikelyExpiration(lastActive: string): number {
    const inactivityMs = this.getInactivityDuration(lastActive);
    const thirtyDaysMs = 1000 * 60 * 60 * 24 * 30;
    const daysRemaining = (thirtyDaysMs - inactivityMs) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(daysRemaining));
  }

  async validateBatch(cookies: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const cookie of cookies) {
      try {
        const isValid = await this.validateAndRefresh(cookie);
        results.set(cookie, isValid);
      } catch (error) {
        results.set(cookie, false);
      }
    }

    return results;
  }

  async getFreshTicket(cookie: string): Promise<string> {
    try {
      const isValid = await this.validateAndRefresh(cookie);
      if (!isValid) {
        throw new Error("Cookie is no longer valid");
      }

      const ticket = await RobloxAuthService.getAuthenticationTicket(
        cookie,
        "",
      );

      return ticket;
    } catch (error: any) {
      throw new Error(
        `Failed to get fresh authentication ticket: ${error.message}`,
      );
    }
  }

  clearCache(): void {
    this.validationCache.clear();
  }
}

export const cookieRefreshService = new CookieRefreshService();
