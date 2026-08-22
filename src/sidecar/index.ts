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

import {
  listen,
  registerChannel,
  registeredChannels,
  setReadyGate,
} from "./bridge";
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

  await registerSafely("RobloxHandlers", () => roblox.registerRobloxHandlers());
  await registerSafely("StorageController", () =>
    storage.registerStorageHandlers(),
  );
  await registerSafely("LogsController", () => logs.registerLogsHandlers());

  // Handlers that used to sit inline in the Electron main entry.
  await registerSafely("AppHandlers", () => registerAppHandlers());
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

/**
 * Registers one controller, containing any failure to that controller.
 *
 * These used to run as a straight sequence, so the first one to throw took
 * every controller after it with it. Discord Rich Presence is registered first
 * and talks to a socket that may not be there, which meant that with Discord
 * closed the Macro, Sniper, Generator and Updater channels silently never
 * existed — surfacing much later as "no sidecar handler registered for channel:
 * macro:list". Losing one feature is survivable; losing four without a word is
 * not.
 */
async function registerSafely(
  name: string,
  register: () => void | Promise<void>,
): Promise<void> {
  try {
    await register();
  } catch (error) {
    console.log(
      `[sidecar] ${name} failed to register; its channels will be unavailable: ${
        error instanceof Error ? (error.stack ?? error.message) : error
      }`,
    );
  }
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

  await registerSafely("DiscordRPCController", () =>
    modules[0].registerDiscordRPCHandlers(),
  );
  await registerSafely("WatcherController", () =>
    modules[1].registerWatcherHandlers(mainWindow),
  );
  await registerSafely("MacroController", () =>
    modules[2].registerMacroHandlers(),
  );
  await registerSafely("SniperController", () =>
    modules[3].registerSniperHandlers(),
  );
  await registerSafely("GeneratorController", () =>
    modules[4].registerGeneratorHandlers(),
  );
  await registerSafely("UpdaterController", () =>
    modules[5].registerUpdaterHandlers(mainWindow),
  );
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

  // Armed before the controllers load, so an early call waits for the whole
  // registration sequence rather than only the deferred tail.
  let markReady: () => void = () => undefined;
  setReadyGate(new Promise<void>((resolve) => (markReady = resolve)));

  await registerCritical();
  await registerFeatures();

  // Matches the old main process, which deferred these until after first paint.
  // Calls that arrive for a deferred channel in the meantime wait on this gate
  // rather than failing.
  const deferred = registerDeferred().catch((error) => {
    console.log(`[sidecar] deferred handler registration failed: ${error}`);
  });
  await deferred;
  markReady();
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
