import { app } from "electron";
import path, { join } from "path";

/**
 * Returns a directory where the application should store its data.
 *
 * We use the standard userData directory on all platforms for app-specific data.
 */
import fs from "fs";

function migrateDocsConfigToUserData(docPath: string, userDataPath: string) {
  const docsConfig = join(docPath, "config.json");
  const userConfig = join(userDataPath, "config.json");

  try {
    if (!fs.existsSync(docsConfig)) return;
    const docData = fs.readFileSync(docsConfig, "utf8").trim();
    if (!docData) return;
    const docsJson = JSON.parse(docData);

    if (!fs.existsSync(userConfig)) {
      fs.copyFileSync(docsConfig, userConfig);
      return;
    }

    const userData = fs.readFileSync(userConfig, "utf8").trim();
    const userJson = userData ? JSON.parse(userData) : {};

    const userHasAccounts = !!(
      userJson.encryptedAccounts ||
      userJson.encryptedSniperAccounts ||
      userJson.encrypted ||
      userJson.accounts
    );
    const docsHasAccounts = !!(
      docsJson.encryptedAccounts ||
      docsJson.encryptedSniperAccounts ||
      docsJson.encrypted ||
      docsJson.accounts
    );

    const shouldMergeAccounts = !userHasAccounts && docsHasAccounts;
    const shouldCopyAll = !userData || userData === "{}" || userData === "";

    if (!shouldMergeAccounts && !shouldCopyAll) {
      return;
    }

    const merged = { ...docsJson, ...userJson };

    // Preserve existing PIN metadata from user data if present.
    if (userJson.settings?.pinCodeHash) {
      merged.settings = {
        ...(docsJson.settings || {}),
        ...userJson.settings,
      };
    }

    // Preserve lockout state from user data if present.
    if (userJson.settings?.pinLockout) {
      merged.settings = merged.settings || {};
      merged.settings.pinLockout = userJson.settings.pinLockout;
    }

    fs.writeFileSync(userConfig, JSON.stringify(merged, null, 2));
  } catch (error) {
    console.warn(
      "[paths] Failed to migrate Documents config to userData:",
      error,
    );
  }
}

export function getDataPath(): string {
  const baseUserData = app.getPath("userData");
  const appName = app.name?.trim() || "sentra";
  const normalizedAppName = appName.toLowerCase();
  const baseName = path.basename(baseUserData).toLowerCase();

  let userDataPath = baseUserData;
  if (baseName !== normalizedAppName) {
    userDataPath = join(path.dirname(baseUserData), normalizedAppName);
  }

  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    console.log("[paths] getDataPath ->", {
      baseUserData,
      userDataPath,
      appName,
    });
    const testFile = join(userDataPath, ".sentra_write_test");
    fs.writeFileSync(testFile, "");
    fs.unlinkSync(testFile);

    const docPath = join(app.getPath("documents"), "Sentra");
    if (fs.existsSync(docPath)) {
      migrateDocsConfigToUserData(docPath, userDataPath);
    }

    return userDataPath;
  } catch (e) {
    console.warn(
      "[paths] userData directory not writable, falling back to documents",
      e,
    );
    const docPath = join(app.getPath("documents"), "Sentra");
    if (!fs.existsSync(docPath)) {
      fs.mkdirSync(docPath, { recursive: true });
    }
    return docPath;
  }
}

/**
 * Helper for getting the full path to a file inside the data directory.
 */
export function getDataFile(...segments: string[]): string {
  return join(getDataPath(), ...segments);
}
