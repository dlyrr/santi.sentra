/**
 * Electron's `app.getPath` resolved synchronously, without a host round-trip.
 *
 * This has to be synchronous: services call it during module initialisation
 * (`Handle64Service` builds a path in a static initialiser), so an async shim
 * hands `path.join` a Promise and the process dies before it can register
 * anything.
 *
 * It also has to resolve to *exactly* the directories Electron used. Electron
 * derives `userData` from the package name, giving `%APPDATA%\sentra`. Tauri
 * would default to its bundle identifier instead (`%APPDATA%\com.sentra.app`),
 * and pointing there would present every existing user with an empty account
 * list while their real config sat untouched one folder over. The Electron
 * layout is therefore hard-coded rather than inherited from the shell.
 */

import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

/** Matches the `name` field the Electron build used for its userData folder. */
const APP_DIR_NAME = "sentra";

function appData(): string {
  if (process.platform === "win32") {
    return process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

const userData = join(appData(), APP_DIR_NAME);

const PATHS: Record<string, string> = {
  home: homedir(),
  appData: appData(),
  userData,
  sessionData: userData,
  temp: tmpdir(),
  exe: process.execPath,
  module: process.execPath,
  desktop: join(homedir(), "Desktop"),
  documents: join(homedir(), "Documents"),
  downloads: join(homedir(), "Downloads"),
  music: join(homedir(), "Music"),
  pictures: join(homedir(), "Pictures"),
  videos: join(homedir(), "Videos"),
  logs:
    process.platform === "darwin"
      ? join(homedir(), "Library", "Logs", APP_DIR_NAME)
      : join(userData, "logs"),
  crashDumps: join(userData, "Crashpad"),
};

export function getPath(name: string): string {
  const resolved = PATHS[name];
  if (!resolved) {
    throw new Error(`Unknown app path: ${name}`);
  }
  return resolved;
}

export function getAppPath(): string {
  return userData;
}
