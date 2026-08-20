import { contextBridge, ipcRenderer } from "electron";

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
} from "./api";

const platform = {
  isMac: process.platform === "darwin",
  isWindows: process.platform === "win32",
  isLinux: process.platform === "linux",
  platform: process.platform,
};

const ALLOWED_INVOKE_CHANNELS = new Set([
  "games:launch-game",
  "watcher:set-config",
  "check-for-updates",
  "open-roblox-login-window",
]);

const ALLOWED_SEND_CHANNELS = new Set(["two-factor-response"]);

const ALLOWED_RECEIVE_CHANNELS = new Set([
  "install-progress",
  "prompt-two-factor",
  "show-notification",
]);

function assertAllowed(
  channel: string,
  allowed: Set<string>,
  kind: string,
): void {
  if (typeof channel !== "string" || !allowed.has(channel)) {
    throw new Error(`Blocked ${kind} on disallowed IPC channel: ${channel}`);
  }
}

const listenerMap = new WeakMap<
  (...args: any[]) => void,
  Map<string, (...args: any[]) => void>
>();

const restrictedIpc = {
  invoke: (channel: string, ...args: unknown[]) => {
    assertAllowed(channel, ALLOWED_INVOKE_CHANNELS, "invoke");
    return ipcRenderer.invoke(channel, ...args);
  },

  send: (channel: string, ...args: unknown[]) => {
    assertAllowed(channel, ALLOWED_SEND_CHANNELS, "send");
    ipcRenderer.send(channel, ...args);
  },

  on: (channel: string, listener: (...args: any[]) => void) => {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "listen");

    const wrapped = (_event: unknown, ...args: any[]) =>
      listener(undefined, ...args);

    let perChannel = listenerMap.get(listener);
    if (!perChannel) {
      perChannel = new Map();
      listenerMap.set(listener, perChannel);
    }
    perChannel.set(channel, wrapped);

    ipcRenderer.on(channel, wrapped);
    return () => {
      ipcRenderer.removeListener(channel, wrapped);
      perChannel?.delete(channel);
    };
  },

  once: (channel: string, listener: (...args: any[]) => void) => {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "listen");
    ipcRenderer.once(channel, (_event, ...args) =>
      listener(undefined, ...args),
    );
  },

  removeListener: (channel: string, listener: (...args: any[]) => void) => {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "listen");
    const wrapped = listenerMap.get(listener)?.get(channel);
    if (wrapped) {
      ipcRenderer.removeListener(channel, wrapped);
      listenerMap.get(listener)?.delete(channel);
    }
  },

  removeAllListeners: (channel: string) => {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "listen");
    ipcRenderer.removeAllListeners(channel);
  },
};

const electronBridge = {
  ipcRenderer: restrictedIpc,
  process: {
    platform: process.platform,
    versions: { ...process.versions },
  },
};

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

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronBridge);
    contextBridge.exposeInMainWorld("api", api);
    contextBridge.exposeInMainWorld("platform", platform);
  } catch (error) {
    console.error("Failed to expose APIs via contextBridge:", error);
  }
} else {
  (window as any).electron = electronBridge;
  (window as any).api = api;
  (window as any).platform = platform;
}
