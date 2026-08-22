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
 *
 * Note the two surfaces below. Under Electron, the preload API modules imported
 * `ipcRenderer` straight from the package, while `window.electron.ipcRenderer`
 * was a separate, channel-allowlisted wrapper built in the preload entry. That
 * split matters: the API modules legitimately listen on a dozen channels the
 * allowlist never covered. Exposing only the restricted one here collapsed the
 * two and broke every push-event feature — the Watcher tab died on load with
 * "Blocked listen on disallowed IPC channel: watcher:event".
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

/**
 * Tauri's `listen` resolves asynchronously, but callers expect `on()` to hand
 * back a synchronous unsubscribe and to support `removeListener` later. Each
 * subscription is tracked so both styles work.
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

function drop(channel: string, listener: Listener): void {
  const pending = subscriptions.get(listener)?.get(channel);
  if (pending) {
    void pending.then((off) => off());
    subscriptions.get(listener)?.delete(channel);
  }
}

/**
 * Turns a rejection from `ipc_invoke` back into a real `Error`.
 *
 * Tauri rejects with whatever the command serialised — here the `IpcError`
 * struct, a plain `{channel, message}` object. Electron rejected with an
 * `Error`, and call sites across the app branch on `error instanceof Error` and
 * compare `error.message` against sentinels like `LOGIN_WINDOW_CLOSED`. Against
 * a plain object every one of those checks silently fails and the specific
 * reason is replaced by a generic "something went wrong".
 */
function toError(raw: unknown, channel: string): Error {
  if (raw instanceof Error) return raw;

  if (raw && typeof raw === "object") {
    const record = raw as { message?: unknown; channel?: unknown };
    if (typeof record.message === "string") {
      const error = new Error(record.message);
      (error as Error & { channel?: string }).channel =
        typeof record.channel === "string" ? record.channel : channel;
      return error;
    }
  }

  if (typeof raw === "string") return new Error(raw);
  return new Error(`IPC call failed: ${channel}`);
}

/**
 * The unrestricted surface, equivalent to importing `ipcRenderer` from the
 * `electron` package inside the old preload. Used by the preload API modules,
 * which are first-party code shipped with the app.
 */
export const ipcRenderer = {
  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    try {
      return await invoke("ipc_invoke", { channel, args });
    } catch (raw) {
      throw toError(raw, channel);
    }
  },

  send(channel: string, ...args: unknown[]): void {
    void invoke("ipc_invoke", { channel, args }).catch((raw) => {
      // Fire-and-forget, but a silent failure here is still worth seeing.
      console.error(toError(raw, channel));
    });
  },

  on(channel: string, listener: Listener): () => void {
    return track(channel, listener);
  },

  once(channel: string, listener: Listener): void {
    const off = track(channel, (event, ...args) => {
      off();
      listener(event, ...args);
    });
  },

  removeListener(channel: string, listener: Listener): void {
    drop(channel, listener);
  },

  removeAllListeners(channel: string): void {
    // Tauri unsubscribes per-handle rather than per-channel, so this is a no-op
    // beyond what removeListener already covers. Several components still call
    // it during cleanup.
    void channel;
  },
};

/** Channels the renderer may push on, carried over from the old preload. */
const ALLOWED_SEND_CHANNELS = new Set(["two-factor-response"]);

/** Channels `window.electron.ipcRenderer` may subscribe to. */
const ALLOWED_RECEIVE_CHANNELS = new Set([
  "install-progress",
  "prompt-two-factor",
  "show-notification",
]);

function assertAllowed(channel: string, allowed: Set<string>, kind: string) {
  if (typeof channel !== "string" || !allowed.has(channel)) {
    throw new Error(`Blocked ${kind} on disallowed IPC channel: ${channel}`);
  }
}

/**
 * The narrowed surface exposed as `window.electron.ipcRenderer`, matching the
 * allowlist the preload entry used to apply.
 */
export const restrictedIpcRenderer = {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),

  send(channel: string, ...args: unknown[]): void {
    assertAllowed(channel, ALLOWED_SEND_CHANNELS, "send");
    ipcRenderer.send(channel, ...args);
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
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "listen");
    drop(channel, listener);
  },

  removeAllListeners(channel: string): void {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "listen");
  },
};

/**
 * `webUtils.getPathForFile` existed because Chromium hides real paths on File
 * objects. Tauri's drag-drop event supplies real paths directly.
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
