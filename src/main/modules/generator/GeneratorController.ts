import { ipcMain } from "electron";
import { generatorService, GeneratorConfig } from "./GeneratorService";
import { storageService } from "../system/StorageService";

export function registerGeneratorHandlers(): void {
  ipcMain.handle("generator:generate-account-data", () => {
    const accountData = generatorService.generateAccountData();
    return { success: true, accountData };
  });

  ipcMain.handle("generator:create-account", async () => {
    const result = await generatorService.createAccount();
    return result;
  });

  ipcMain.handle(
    "generator:create-account-with-username",
    async (_event, username: string) => {
      console.log(
        `[GeneratorController] IPC received: create-account-with-username with username: ${username}`,
      );
      try {
        const result =
          await generatorService.createAccountWithUsername(username);
        console.log(`[GeneratorController] IPC result:`, result);
        return result;
      } catch (err) {
        console.error(`[GeneratorController] IPC error:`, err);
        return {
          success: false,
          error: String(err),
          timestamp: Date.now(),
        };
      }
    },
  );

  ipcMain.handle("generator:launch-browser", async () => {
    try {
      await generatorService.launchBrowser();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("generator:fill-form", async (_event, accountData: any) => {
    try {
      await generatorService.fillForm(accountData);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("generator:captcha-solved", async () => {
    try {
      if ((generatorService as any).onCaptchaSolved) {
        (generatorService as any).onCaptchaSolved();
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("generator:submit-form", async () => {
    try {
      await generatorService.submitForm();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("generator:close-browser", async () => {
    try {
      await generatorService.closeBrowser();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("generator:generate-and-signup", async () => {
    try {
      const accountData = await generatorService.generateAndSignup();
      return { success: true, accountData };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("generator:get-accounts", () => {
    const accounts = generatorService.getAccounts();
    return { success: true, accounts };
  });

  ipcMain.handle("generator:clear-accounts", () => {
    generatorService.clearAccounts();
    return { success: true };
  });

  ipcMain.handle("generator:delete-account", (_event, accountId: string) => {
    const deleted = generatorService.deleteAccount(accountId);
    return { success: deleted };
  });

  ipcMain.handle(
    "generator:update-config",
    (_event, config: Partial<GeneratorConfig>) => {
      generatorService.updateConfig(config);
      return { success: true, config: generatorService.getConfig() };
    },
  );

  ipcMain.handle("generator:get-config", () => {
    return { success: true, config: generatorService.getConfig() };
  });

  ipcMain.handle("generator:get-password", (_event, accountId: string) => {
    const password = generatorService.getPassword(accountId);
    return { success: true, password };
  });

  ipcMain.handle("generator:get-cookie", (_event, accountId: string) => {
    const cookie = generatorService.getCookie(accountId);
    return { success: true, cookie };
  });

  ipcMain.handle("sniper:get-accounts", () => {
    const accounts = storageService.getSniperAccounts();
    return { success: true, accounts };
  });

  ipcMain.handle("sniper:add-account", (_event, account: any) => {
    try {
      storageService.addSniperAccount(account);
      return { success: true };
    } catch (err) {
      console.error("[GeneratorController] Failed to add sniper account:", err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("sniper:remove-account", (_event, accountId: string) => {
    try {
      const success = storageService.removeSniperAccount(accountId);
      return { success };
    } catch (err) {
      console.error(
        "[GeneratorController] Failed to remove sniper account:",
        err,
      );
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("sniper:move-to-main", (_event, accountId: string) => {
    try {
      const success = storageService.moveSniperAccountToMain(accountId);
      return { success };
    } catch (err) {
      console.error(
        "[GeneratorController] Failed to move sniper account to main:",
        err,
      );
      return { success: false, error: String(err) };
    }
  });
}
