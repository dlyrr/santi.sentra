/**
 * Installs the globals the renderer expects, replacing the Electron preload.
 *
 * Imported for its side effects by `src/renderer/src/main.tsx` before React
 * mounts. It builds the exact same `window.api` / `window.electron` /
 * `window.platform` shape the preload used to expose, from the exact same 19
 * API modules — they are reused as-is, since `electron` is aliased to
 * `src/bridge/electron.ts` at build time.
 */

import {
  accountApi,
  usersApi,
  friendsApi,
  avatarApi,
  inventoryApi,
  catalogApi,
  catalogDatabaseApi,
  gamesApi,
  groupsApi,
  systemApi,
  licenseApi,
  appApi,
  pinApi,
  installApi,
  netlogApi,
  catalogDbApi,
  authApi,
  rolimonsApi,
  transactionsApi,
  updaterApi,
  accountSettingsApi,
  discordRPCApi,
  watcherApi,
  macroApi,
  sniperApi,
  generatorApi,
  tradingApi,
  browserApi,
  proxyMgmtApi,
} from "../preload/api";
import { restrictedIpcRenderer } from "./electron";

const api = {
  ...appApi,
  ...accountApi,
  ...authApi,
  ...avatarApi,
  ...catalogApi,
  ...catalogDatabaseApi,
  ...catalogDbApi,
  ...friendsApi,
  ...gamesApi,
  ...groupsApi,
  ...inventoryApi,
  ...usersApi,
  ...systemApi,
  ...licenseApi,
  ...pinApi,
  ...installApi,
  ...rolimonsApi,
  ...netlogApi,
  ...transactionsApi,
  ...updaterApi,
  ...accountSettingsApi,
  ...discordRPCApi,
  ...watcherApi,
  ...macroApi,
  ...sniperApi,
  ...generatorApi,
  ...tradingApi,
  ...browserApi,
  ...proxyMgmtApi,

  account: accountApi,
  user: usersApi,
  friends: friendsApi,
  avatar: avatarApi,
  inventory: inventoryApi,
  catalog: catalogApi,
  games: gamesApi,
  groups: groupsApi,
  system: systemApi,
  transactions: transactionsApi,
  updater: updaterApi,
  settings: accountSettingsApi,
  discord: discordRPCApi,
  watcher: watcherApi,
  macro: macroApi,
  sniper: sniperApi,
  generator: generatorApi,
  trading: tradingApi,
  browser: browserApi,
  proxyMgmt: proxyMgmtApi,
};

/**
 * Derived from the user agent rather than @tauri-apps/plugin-os.
 *
 * `window.platform` is read synchronously at module scope by several
 * components, so it cannot come from an async plugin call — and pulling in a
 * whole plugin (plus its Rust half and capability grant) to learn the OS name
 * is more moving parts than this needs.
 */
const current: NodeJS.Platform = (() => {
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad/i.test(ua)) return "darwin";
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "win32";
})();

const platform = {
  isMac: current === "darwin",
  isWindows: current === "win32",
  isLinux: current === "linux",
  platform: current,
};

const electron = {
  // The narrowed surface. The preload API modules use the unrestricted
  // `ipcRenderer` directly, exactly as they did under Electron.
  ipcRenderer: restrictedIpcRenderer,
  process: {
    platform: current,
    versions: {} as Record<string, string>,
  },
};

// The shapes are declared once, in src/renderer/src/window.d.ts. Re-declaring
// them here would fork the contract; the casts assert that this assembly still
// satisfies it.
window.api = api as unknown as Window["api"];
window.electron = electron as unknown as Window["electron"];
window.platform = platform as unknown as Window["platform"];

export {};
