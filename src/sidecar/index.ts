/**
 * Sidecar entry point.
 *
 * Boots the Node half of the backend: the same controllers the Electron main
 * process registered, loaded in the same order, against the same
 * `register*Handlers()` contract. The only difference is that `ipcMain` now
 * resolves to the shim in `electron-shim.ts` rather than to Electron.
 *
 * Channels served natively by Rust never reach this process — the router in
 * `src-tauri/src/ipc.rs` answers them before the pipe is touched.
 */

/**
 * Several services read `process.resourcesPath` during module initialisation to
 * locate the bundled catalog database and icon assets. That property only
 * exists under Electron, so Rust passes the Tauri resource directory through
 * the environment at spawn time and it is installed here, before anything that
 * needs it is imported.
 */
if (!process.resourcesPath && process.env.SENTRA_RESOURCES) {
  Object.defineProperty(process, "resourcesPath", {
    value: process.env.SENTRA_RESOURCES,
    writable: false,
    configurable: true,
  });
}

import { listen, registerChannel, registeredChannels } from "./bridge";
import { BrowserWindow, primeAppVersion } from "./electron-shim";
import { registerAppHandlers } from "./appHandlers";

/** Stand-in for the main window handle the two window-aware controllers want. */
const mainWindow = BrowserWindow.getAllWindows()[0] as never;

async function registerCritical(): Promise<void> {
  const [roblox, storage, logs] = await Promise.all([
    import("../main/modules/core/RobloxHandler"),
    import("../main/modules/system/StorageController"),
    import("../main/modules/system/LogsController"),
  ]);

  roblox.registerRobloxHandlers();
  storage.registerStorageHandlers();
  logs.registerLogsHandlers();

  // Handlers that used to sit inline in the Electron main entry.
  registerAppHandlers();
}

/**
 * `registerRobloxHandlers` already fans out to the eleven feature controllers
 * (auth, users, friends, games, avatar, install, catalog, catalog-db, groups,
 * transactions, account settings), so they are deliberately not registered
 * again here. Only the standalone module handlers are left.
 */
async function registerFeatures(): Promise<void> {
  const { registerModuleIpcHandlers } = await import(
    "../main/ipc/ModuleIpcHandlers"
  );
  registerModuleIpcHandlers();
}

async function registerDeferred(): Promise<void> {
  const modules = await Promise.all([
    import("../main/modules/discord/DiscordRPCController"),
    import("../main/modules/watcher/WatcherController"),
    import("../main/modules/macro/MacroController"),
    import("../main/modules/sniper/SniperController"),
    import("../main/modules/generator/GeneratorController"),
    import("../main/modules/updater/UpdaterController"),
  ]);

  modules[0].registerDiscordRPCHandlers();
  modules[1].registerWatcherHandlers(mainWindow);
  modules[2].registerMacroHandlers();
  modules[3].registerSniperHandlers();
  modules[4].registerGeneratorHandlers();
  modules[5].registerUpdaterHandlers(mainWindow);
}

async function main(): Promise<void> {
  // Start reading before registration so no call is dropped on the floor while
  // the controllers are still loading; unknown channels error rather than hang.
  listen();

  // Introspection channel, used by `npm run migration:status`.
  registerChannel("sidecar:channels", async () => registeredChannels());

  // Cached in the background: only the About panel and the updater read it,
  // and blocking controller registration on a host round-trip would mean a slow
  // host delays every channel becoming available.
  void primeAppVersion();

  await registerCritical();
  await registerFeatures();

  // Matches the old main process, which deferred these until after first paint.
  setTimeout(() => {
    registerDeferred().catch((error) => {
      console.log(`[sidecar] deferred handler registration failed: ${error}`);
    });
  }, 0);

  console.log(`[sidecar] ready with ${registeredChannels().length} channels`);
}

process.on("uncaughtException", (error) => {
  console.log(`[sidecar] uncaught exception: ${error?.stack ?? error}`);
});
process.on("unhandledRejection", (reason) => {
  console.log(`[sidecar] unhandled rejection: ${reason}`);
});

main().catch((error) => {
  console.log(`[sidecar] fatal: ${error?.stack ?? error}`);
  process.exit(1);
});
