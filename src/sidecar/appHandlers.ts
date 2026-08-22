/**
 * The handlers that used to be registered inline in the Electron main entry
 * (`src/main/index.ts`) rather than in a controller.
 *
 * They were tied to `mainWindow` and the module-level `storageService`, so they
 * would have been lost along with that file. `focus-window` is not among them:
 * it is served natively by Rust now.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ipcMain, app } from "./electron-shim";

/**
 * A PIN-less install counts as unlocked; otherwise the PIN must have been
 * verified this session. Preserved verbatim from the main entry, because both
 * destructive handlers below gate on it.
 */
type StorageService =
  typeof import("../main/modules/system/StorageService").storageService;

/**
 * Loaded lazily. A static import would initialise StorageService (and the koffi
 * FFI chain behind it) at bundle load, before the transport is listening.
 */
async function storage(): Promise<StorageService> {
  return (await import("../main/modules/system/StorageService")).storageService;
}

function isVaultUnlocked(storageService: StorageService): boolean {
  if (!storageService) return false;
  try {
    const hasPin = !!storageService.getPinHash();
    if (!hasPin) return true;
    return storageService.isPinCurrentlyVerified();
  } catch (error) {
    console.log(`[sidecar] failed to determine vault lock state: ${error}`);
    return false;
  }
}

export function registerAppHandlers(): void {
  ipcMain.handle("tile-game-windows", async (_event, options?: unknown) => {
    try {
      const { PerformanceService } = await import(
        "../main/modules/system/PerformanceService"
      );
      return PerformanceService.tileRobloxWindows((options ?? {}) as never);
    } catch (error) {
      console.log(`[sidecar] tile-game-windows failed: ${error}`);
      return { success: false, message: "Window tiling failed." };
    }
  });

  ipcMain.handle("has-config", async () => {
    try {
      const { getDataFile } = await import("../main/utils/paths");
      const userData = app.getPath("userData");
      const documents = app.getPath("documents");

      const configCandidates = [
        getDataFile("config.json"),
        join(userData, "config.json"),
        join(userData, "Sentra", "config.json"),
        join(documents, "Sentra", "config.json"),
      ];

      for (const candidate of configCandidates) {
        if (!existsSync(candidate)) continue;

        try {
          const content = readFileSync(candidate, "utf-8").trim();
          if (!content) continue;
          const parsed = JSON.parse(content);
          if (
            parsed &&
            typeof parsed === "object" &&
            Object.keys(parsed).length > 0
          ) {
            return true;
          }
        } catch {
          // An unreadable config still counts as "configured": treating it as
          // absent would send the user through onboarding and overwrite it.
          return true;
        }
      }

      return false;
    } catch (error) {
      console.log(`[sidecar] failed to check config existence: ${error}`);
      return false;
    }
  });

  ipcMain.handle("app:logout", async () => {
    try {
      const storageService = await storage();
      if (!storageService) {
        return { success: false, message: "Storage not initialized" };
      }
      if (!isVaultUnlocked(storageService)) {
        return {
          success: false,
          message: "PIN must be verified before logging out",
        };
      }
      storageService.clearAll();
      return { success: true, message: null };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle(
    "account:get-decrypted-password",
    async (_event, accountId: unknown) => {
      try {
        const storageService = await storage();
        if (!storageService) return { success: false, password: "" };

        if (!isVaultUnlocked(storageService)) {
          return {
            success: false,
            password: "",
            error: "PIN must be verified",
          };
        }

        const accounts = storageService.getAccounts();
        const account = accounts.find((acc) => acc.id === accountId);
        if (!account) return { success: false, password: "" };

        const decrypted = storageService.getDecryptedPassword(account.password);
        return { success: true, password: decrypted };
      } catch (error) {
        return {
          success: false,
          password: "",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
}
