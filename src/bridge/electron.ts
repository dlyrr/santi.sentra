/**
 * Renderer-side stand-in for the `electron` module.
 *
 * The renderer and the old preload both import `ipcRenderer` and `webUtils`
 * from `electron`. The Vite config aliases `electron` to this file, so all 19
 * preload API modules and every `window.electron.ipcRenderer` call site keep
 * working against Tauri without a single edit.
 *
 * Every call becomes one `ipc_invoke` command; every push event becomes a Tauri
 * event subscription.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Call sites annotate their own payload types, so this has to be as permissive
// as Electron's own listener overloads.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Listener = (event: any, ...args: any[]) => void;

/**
 * A few preload modules annotate against `Electron.*` types. Structural
 * stand-ins keep those annotations resolving now that Electron is gone.
 */
declare global {
  namespace Electron {
    type IpcRendererEvent = unknown;
    type OpenDialogOptions = Record<string, unknown>;
    type SaveDialogOptions = Record<string, unknown>;
  }
}

/** Kept from the old preload: the renderer may only push on these channels. */
const ALLOWED_SEND_CHANNELS = new Set(["two-factor-response"]);

const ALLOWED_RECEIVE_CHANNELS = new Set([
  "install-progress",
  "prompt-two-factor",
  "show-notification",
]);

/**
 * Tauri's `listen` resolves asynchronously, but the renderer expects `on()` to
 * hand back a synchronous unsubscribe and to support `removeListener` later.
 * Each subscription is tracked so both styles work.
 */
const subscriptions = new WeakMap<Listener, Map<string, Promise<UnlistenFn>>>();

function track(channel: string, listener: Listener): () => void {
  const unlisten = listen(channel, (event) => {
    // Electron listeners are called as (event, ...args); the first parameter
    // was always unused by this codebase.
    listener(undefined, event.payload);
  });

  let perChannel = subscriptions.get(listener);
  if (!perChannel) {
    perChannel = new Map();
    subscriptions.set(listener, perChannel);
  }
  perChannel.set(channel, unlisten);

  return () => {
    void unlisten.then((off) => off());
    perChannel?.delete(channel);
  };
}

function assertAllowed(channel: string, allowed: Set<string>, kind: string) {
  if (typeof channel !== "string" || !allowed.has(channel)) {
    throw new Error(`Blocked ${kind} on disallowed IPC channel: ${channel}`);
  }
}

export const ipcRenderer = {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return invoke("ipc_invoke", { channel, args });
  },

  send(channel: string, ...args: unknown[]): void {
    assertAllowed(channel, ALLOWED_SEND_CHANNELS, "send");
    void invoke("ipc_invoke", { channel, args });
  },

  on(channel: string, listener: Listener): () => void {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "listen");
    return track(channel, listener);
  },

  once(channel: string, listener: Listener): void {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "listen");
    const off = track(channel, (event, ...args) => {
      off();
      listener(event, ...args);
    });
  },

  removeListener(channel: string, listener: Listener): void {
    const pending = subscriptions.get(listener)?.get(channel);
    if (pending) {
      void pending.then((off) => off());
      subscriptions.get(listener)?.delete(channel);
    }
  },

  removeAllListeners(channel: string): void {
    // Tauri unsubscribes per-handle rather than per-channel, so this is a no-op
    // beyond what removeListener already covers. Left in place because several
    // components call it during cleanup.
    void channel;
  },
};

/**
 * `webUtils.getPathForFile` existed because Chromium hides real paths on File
 * objects. Tauri's drag-drop event supplies real paths directly, and the file
 * input path is stashed there by the bridge bootstrap.
 */
export const webUtils = {
  getPathForFile(file: File & { path?: string }): string {
    return file.path ?? file.name ?? "";
  },
};

export const contextBridge = {
  // Nothing to bridge: the renderer is the only context now.
  exposeInMainWorld(key: string, value: unknown): void {
    (window as unknown as Record<string, unknown>)[key] = value;
  },
};

export default { ipcRenderer, webUtils, contextBridge };
