/**
 * A drop-in stand-in for the `electron` module, for use inside the sidecar.
 *
 * The Node services that came out of the Electron main process import `ipcMain`,
 * `app`, `dialog`, `shell`, `safeStorage`, `net`, `session` and `BrowserWindow`.
 * Rewriting every call site would have meant touching ~33k lines of working
 * code, so instead the build aliases `electron` to this module and each API is
 * re-expressed on top of the Tauri host:
 *
 *   - `ipcMain.handle` registers into the sidecar's own channel table.
 *   - Anything needing a real OS surface becomes a reverse call to Rust.
 *   - `net.request` becomes a thin shim over Node's https, keeping the same
 *     event-emitter shape the original code listens to.
 *
 * Nothing here talks to Electron, and nothing here bundles Chromium.
 */

import { EventEmitter } from "node:events";
import https from "node:https";
import { hostCall, registerChannel, sendToRenderer } from "./bridge";
import { getAppPath, getPath } from "./paths";
import { safeStorage as dpapiSafeStorage } from "./safeStorage";

// Controllers declare their own positional parameter types, so this has to be
// permissive in the same way Electron's own overloads are.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (event: any, ...args: any[]) => unknown;

/** Re-exported for the controllers that annotate their handler signatures. */
export type IpcMainInvokeEvent = typeof invokeEvent;

/**
 * A handful of controllers annotate options with `Electron.SaveDialogOptions`
 * and friends. The global namespace is declared here so those annotations keep
 * resolving without editing the services.
 */
declare global {
  namespace Electron {
    type SaveDialogOptions = Record<string, unknown>;
    type OpenDialogOptions = Record<string, unknown>;
    type MessageBoxOptions = Record<string, unknown>;
    type IpcMainInvokeEvent = typeof invokeEvent;
    type IpcMainEvent = typeof invokeEvent;
    type Event = { preventDefault: () => void };
  }
}

/** Stands in for `IpcMainInvokeEvent`. The services only ever ignore it. */
const invokeEvent = Object.freeze({
  sender: {
    send: (channel: string, ...args: unknown[]) =>
      sendToRenderer(channel, args.length > 1 ? args : args[0]),
  },
});

export const ipcMain = {
  handle(channel: string, handler: Handler) {
    registerChannel(channel, (args) => handler(invokeEvent, ...args));
  },
  handleOnce(channel: string, handler: Handler) {
    registerChannel(
      channel,
      (args) => handler(invokeEvent, ...args),
      /* once */ true,
    );
  },
  removeHandler(channel: string) {
    registerChannel(channel, null);
  },
  on(channel: string, handler: Handler) {
    registerChannel(channel, (args) => handler(invokeEvent, ...args));
  },
  once(channel: string, handler: Handler) {
    registerChannel(channel, (args) => handler(invokeEvent, ...args), true);
  },
  removeListener(channel: string, _handler?: Handler) {
    registerChannel(channel, null);
  },
  removeAllListeners(channel: string) {
    registerChannel(channel, null);
  },
};

/** Only ever passed around as an opaque handle by the services. */
export type WebContents = typeof invokeEvent.sender;

/** Electron's generic event object, used in a couple of handler signatures. */
export type Event = { preventDefault: () => void };

/** Structural stand-ins for Electron types the services annotate against. */
export type BrowserWindowConstructorOptions = Record<string, any>;
export type Cookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
};

export const app = {
  // Synchronous, and resolving to the same folders Electron used. See paths.ts:
  // services call these during module initialisation, and a different userData
  // directory would orphan every existing config.
  getPath,
  getAppPath,
  getVersion: () => APP_VERSION,
  name: "sentra",
  quit: () => void hostCall<void>("app:quit"),
  relaunch: () => void hostCall<void>("app:relaunch"),
  /** The sidecar has no app lifecycle of its own; these are inert by design. */
  on: () => undefined,
  once: () => undefined,
  whenReady: () => Promise.resolve(),
  isPackaged: process.env.NODE_ENV !== "development",
};

/**
 * Populated once at boot by `primeAppVersion()`, so `app.getVersion()` can stay
 * synchronous like Electron's.
 */
let APP_VERSION = "0.0.0";

export async function primeAppVersion(): Promise<void> {
  try {
    APP_VERSION = await hostCall<string>("app:getVersion");
  } catch {
    // Non-fatal: only the About panel and the updater read this.
  }
}

export const shell = {
  openExternal: (url: string) => hostCall<void>("shell:openExternal", url),
  // Electron resolves to an error string, empty when the open succeeded.
  openPath: async (path: string): Promise<string> => {
    try {
      await hostCall<void>("shell:openPath", path);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  },
  showItemInFolder: (path: string) =>
    hostCall<void>("shell:showItemInFolder", path),
};

/**
 * Electron overloads each of these as `(options)` or `(parentWindow, options)`.
 * The Tauri host has a single window, so an owner window is accepted and
 * discarded rather than forcing every call site to drop it.
 */
const dialogOptions = (a: unknown, b?: unknown) => (b === undefined ? a : b);

export const dialog = {
  showOpenDialog: (a: unknown, b?: unknown) =>
    hostCall<{ canceled: boolean; filePaths: string[] }>(
      "dialog:showOpenDialog",
      dialogOptions(a, b),
    ),
  showSaveDialog: (a: unknown, b?: unknown) =>
    hostCall<{ canceled: boolean; filePath: string | null }>(
      "dialog:showSaveDialog",
      dialogOptions(a, b),
    ),
  showMessageBox: (a: unknown, b?: unknown) =>
    hostCall<{ response: number }>("dialog:showMessageBox", dialogOptions(a, b)),
};

/**
 * Real DPAPI, not a round-trip: this must be synchronous and must read blobs
 * Electron already wrote. See safeStorage.ts.
 */
export const safeStorage = dpapiSafeStorage;

/**
 * Every remaining service addresses only the main window, so `BrowserWindow`
 * collapses to a proxy that forwards to the real Tauri window.
 *
 * Nothing constructs one any more: the Roblox login and account-browser windows
 * are created natively in `src-tauri/src/roblox_window.rs`. Construction still
 * throws, so that a future caller reaching for an embedded browser window gets
 * told where windows actually come from instead of a confusing null.
 */
class MainWindowProxy {
  webContents = {
    send: (channel: string, ...args: unknown[]) =>
      sendToRenderer(channel, args.length > 1 ? args : args[0]),
    executeJavaScript: async (_code?: string) => undefined as unknown,
    getURL: () => "",
    loadURL: async (_url: string, _options?: unknown) => undefined,
    canGoBack: () => false,
    goBack: () => undefined,
    canGoForward: () => false,
    goForward: () => undefined,
    reload: () => undefined,
    stop: () => undefined,
    on: (_event: string, _listener?: (...args: any[]) => void) => undefined,
    once: (_event: string, _listener?: (...args: any[]) => void) => undefined,
    openDevTools: () => undefined,
    setWindowOpenHandler: (
      _handler: (details: { url: string }) => { action: "allow" | "deny" },
    ) => undefined,
    insertCSS: async (_css: string) => "",
    setUserAgent: (_userAgent: string) => undefined,
    isDestroyed: () => false,
    getUserAgent: () => "",
    session: {
      cookies: {
        get: async () => [] as unknown[],
        set: async () => undefined,
        remove: async () => undefined,
      },
    },
  };

  show() {
    return hostCall<void>("window:show");
  }
  focus() {
    return hostCall<void>("window:show");
  }
  setSize(width: number, height: number) {
    return hostCall<void>("window:setSize", width, height);
  }
  close() {
    return undefined;
  }
  destroy() {
    return undefined;
  }
  isDestroyed() {
    return false;
  }
  setAlwaysOnTop(_flag: boolean) {
    return undefined;
  }
  getSize(): [number, number] {
    return [1400, 900];
  }
  loadURL(_url: string, _options?: unknown) {
    return Promise.resolve();
  }
  on(_event: string, _listener?: (...args: any[]) => void) {
    return this;
  }
  once(_event: string, _listener?: (...args: any[]) => void) {
    return this;
  }
}

const mainWindowProxy = new MainWindowProxy();

/**
 * Extends the proxy so the instance *type* still matches what services expect
 * (`webContents`, `isDestroyed`, ...), while construction throws.
 *
 * Nothing constructs one any more — the Roblox login and account-browser
 * windows are created natively in `src-tauri/src/roblox_window.rs`. This
 * remains so that a future caller reaching for an embedded browser window is
 * told where windows come from, rather than getting a confusing null.
 */
class NotPortedWindow extends MainWindowProxy {
  /**
   * Intentionally open-ended. Construction throws, so this type never describes
   * a live object, and mirroring Electron's full BrowserView surface here would
   * be inventing an API that nothing implements. Anything genuinely reachable
   * lives on MainWindowProxy above, which stays precisely typed.
   */
  [key: string]: any;
  declare webContents: MainWindowProxy["webContents"] & Record<string, any>;

  constructor(_options?: unknown) {
    super();
    throw new Error(
      "Embedded browser windows are not created in Node. Roblox windows are " +
        "opened by the Rust shell; see src-tauri/src/roblox_window.rs.",
    );
  }
}

export class BrowserWindow extends NotPortedWindow {
  static getAllWindows = () => [mainWindowProxy as BrowserWindow];
  static getFocusedWindow = () => mainWindowProxy as BrowserWindow;
  static fromWebContents = (_webContents?: unknown) =>
    mainWindowProxy as BrowserWindow;
}

export class BrowserView extends NotPortedWindow {}

/**
 * The response object `net.request` emits. Typed explicitly so callers writing
 * `response.on("data", (chunk) => ...)` get an inferred parameter rather than
 * an implicit-any error.
 */
export interface NetIncomingMessage extends EventEmitter {
  statusCode: number;
  // Matches Electron's IncomingMessage: values are never undefined.
  headers?: Record<string, string | string[]>;
  on(event: "data", listener: (chunk: Buffer) => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

/**
 * `net.request` shim. Preserves the emitter shape (`response`, `data`, `end`,
 * `error`, `redirect`) that `src/main/lib/request.ts` is written against, so
 * its redirect and credential-stripping logic keeps working untouched.
 */
/**
 * Declaration merging, so callers writing `.on("response", (res) => ...)` get
 * an inferred parameter instead of an implicit-any error. Adding overloads this
 * way avoids clashing with EventEmitter's own polymorphic `on`.
 */
interface NetRequest {
  on(event: "response", listener: (response: NetIncomingMessage) => void): this;
  on(
    event: "redirect",
    listener: (status: number, method: string, redirectUrl: string) => void,
  ): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "timeout", listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

class NetRequest extends EventEmitter {
  private chunks: Buffer[] = [];
  private request: import("node:http").ClientRequest;

  constructor(options: { method?: string; url: string }) {
    super();
    this.request = https.request(
      options.url,
      { method: options.method ?? "GET" },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          this.emit("redirect", status, options.method ?? "GET", res.headers.location);
          return;
        }

        const response = new EventEmitter() as NetIncomingMessage;
        response.statusCode = status;
        response.headers = res.headers as Record<string, string | string[]>;

        res.on("data", (chunk: Buffer) => {
          this.chunks.push(chunk);
          response.emit("data", chunk);
        });
        res.on("end", () => response.emit("end"));
        res.on("error", (error) => response.emit("error", error));

        this.emit("response", response);
      },
    );

    this.request.on("error", (error) => this.emit("error", error));
    this.request.on("timeout", () => this.emit("timeout"));
  }

  setHeader(name: string, value: string) {
    this.request.setHeader(name, value);
  }
  removeHeader(name: string) {
    this.request.removeHeader(name);
  }
  getHeader(name: string) {
    return this.request.getHeader(name);
  }
  write(body: string | Buffer) {
    this.request.write(body);
  }
  end(body?: string | Buffer) {
    this.request.end(body);
  }
  abort() {
    this.request.destroy();
  }
  followRedirect() {
    /* handled by the caller re-issuing the request */
  }
}

export const net = {
  request: (options: string | { method?: string; url: string }) =>
    new NetRequest(typeof options === "string" ? { url: options } : options),
  /**
   * Electron's `net.fetch` is the standard fetch API routed through Chromium's
   * stack. Node's global fetch is the same interface, and the services only use
   * it for plain GETs against Roblox CDNs.
   */
  fetch: (input: string | URL | Request, init?: RequestInit) =>
    globalThis.fetch(input as never, init),
  isOnline: () => true,
};

/**
 * Cookie jars were used by the Roblox login window and the account generator,
 * both of which need a real webview the Tauri shell does not provide yet. The
 * shape is preserved so those services load; they return nothing, and their
 * callers already treat an empty cookie list as "not signed in yet".
 * See MIGRATION.md, "Roblox login window".
 */
interface ShimCookie {
  name: string;
  value: string;
  domain?: string;
}

/**
 * The concrete members are the ones anything actually calls. The index
 * signature covers the rest of Electron's session surface, which only the
 * not-yet-ported login window touches (permission handlers, cookie change
 * events) and which nothing here implements.
 */
const shimSession: Record<string, any> & {
  cookies: Record<string, any> & {
    get: (filter?: unknown) => Promise<ShimCookie[]>;
  };
} = {
  cookies: {
    get: async (_filter?: unknown): Promise<ShimCookie[]> => [],
    set: async (_details?: unknown) => undefined,
    remove: async (_url?: string, _name?: string) => undefined,
    on: (_event: string, _listener?: (...args: any[]) => void) => undefined,
    removeListener: (
      _event: string,
      _listener?: (...args: any[]) => void,
    ) => undefined,
  },
  clearStorageData: async (_options?: unknown) => undefined,
  clearCache: async () => undefined,
  setPermissionRequestHandler: (
    _handler:
      | ((
          webContents: unknown,
          permission: string,
          callback: (granted: boolean) => void,
        ) => void)
      | null,
  ) => undefined,
  clearAuthCache: async () => undefined,
  setUserAgent: (_userAgent: string) => undefined,
};

export const session = {
  defaultSession: shimSession,
  fromPartition: (_partition?: string, _options?: unknown) => shimSession,
};

export const webUtils = {
  getPathForFile: (file: { path?: string; name?: string }) =>
    file.path ?? file.name ?? "",
};

export default {
  ipcMain,
  app,
  shell,
  dialog,
  safeStorage,
  BrowserWindow,
  BrowserView,
  net,
  session,
  webUtils,
};
