/**
 * The sidecar's half of the NDJSON transport described in
 * `src-tauri/src/sidecar.rs`.
 *
 * stdout carries protocol frames and nothing else, so anything that would
 * otherwise `console.log` is redirected to stderr before the first frame is
 * written. A stray log line on stdout would desynchronise the stream.
 */

import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

type ChannelHandler = (args: unknown[]) => unknown;

interface Registration {
  handler: ChannelHandler;
  once: boolean;
}

const channels = new Map<string, Registration>();
const pendingHostCalls = new Map<
  string,
  { resolve: (value: never) => void; reject: (reason: Error) => void }
>();

/** stdout is the wire; keep application logging off it. */
const stdout = process.stdout;
const render = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

console.log = (...args: unknown[]) =>
  void process.stderr.write(args.map(render).join(" ") + "\n");
console.info = console.log;
console.debug = console.log;
console.warn = console.log;

function writeFrame(frame: unknown): void {
  stdout.write(JSON.stringify(frame) + "\n");
}

export function registerChannel(
  channel: string,
  handler: ChannelHandler | null,
  once = false,
): void {
  if (handler === null) {
    channels.delete(channel);
    return;
  }
  if (channels.has(channel)) {
    console.log(`[sidecar] channel re-registered, replacing: ${channel}`);
  }
  channels.set(channel, { handler, once });
}

export function registeredChannels(): string[] {
  return [...channels.keys()].sort();
}

/** Push an event at the renderer, replacing `webContents.send`. */
export function sendToRenderer(event: string, payload: unknown): void {
  writeFrame({ event, payload });
}

/**
 * A host that never answers must not be able to wedge the sidecar.
 *
 * This is a *default*, not a rule. Some host calls are inherently as slow as a
 * person: the Roblox login window sits open until someone finishes signing in,
 * including 2FA and a captcha. Timing those out on the generic budget cancelled
 * logins after 30 seconds while the window was still on screen, and reported it
 * as a generic capture failure.
 */
const HOST_CALL_TIMEOUT_MS = 30_000;

/** Ask the Tauri host to do something only it can do. */
export function hostCall<T>(host: string, ...args: unknown[]): Promise<T> {
  return hostCallWithTimeout<T>(host, HOST_CALL_TIMEOUT_MS, ...args);
}

/**
 * As `hostCall`, with an explicit budget for calls that wait on a person.
 * Keep it shorter than the Rust side's sidecar call timeout, so the innermost
 * layer is the one that reports the failure.
 */
export function hostCallWithTimeout<T>(
  host: string,
  timeoutMs: number,
  ...args: unknown[]
): Promise<T> {
  const rid = randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingHostCalls.delete(rid);
      reject(new Error(`host call timed out: ${host}`));
    }, timeoutMs);
    // A pending host call should never hold the process open on its own.
    timer.unref?.();

    pendingHostCalls.set(rid, {
      resolve: ((value: never) => {
        clearTimeout(timer);
        resolve(value);
      }) as (value: never) => void,
      reject: (reason: Error) => {
        clearTimeout(timer);
        reject(reason);
      },
    });
    writeFrame({ rid, host, args });
  });
}

/**
 * Resolves once every controller has registered.
 *
 * Registration is staged (critical, then features, then deferred) to match the
 * old main process. The renderer starts calling as soon as it paints, so a
 * channel owned by a later stage can be asked for before it exists. Under
 * Electron the window only loaded after registration finished; here the two
 * race, and the first call for a deferred channel would fail outright.
 */
let readyGate: Promise<void> = Promise.resolve();

export function setReadyGate(promise: Promise<void>): void {
  readyGate = promise;
}

/**
 * Restores `undefined` arguments encoded by the renderer bridge.
 *
 * See the matching comment in src/bridge/electron.ts: JSON turns `undefined`
 * inside an array into `null`, and the zod tuples guarding these channels treat
 * those very differently. `null` is left alone — only the explicit sentinel is
 * converted back.
 */
const UNDEFINED_SENTINEL = "__sentra_undefined__";

function decodeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeUndefined);
  if (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>)[UNDEFINED_SENTINEL] === true
  ) {
    return undefined;
  }
  return value;
}

async function handleCall(id: string, channel: string, args: unknown[]) {
  let registration = channels.get(channel);

  if (!registration) {
    // Wait for registration to finish before concluding it does not exist.
    await readyGate;
    registration = channels.get(channel);
  }

  if (!registration) {
    writeFrame({
      id,
      ok: false,
      error: `no sidecar handler registered for channel: ${channel}`,
    });
    return;
  }
  if (registration.once) channels.delete(channel);

  try {
    const result = await registration.handler(args.map(decodeUndefined));
    writeFrame({ id, ok: true, result: result ?? null });
  } catch (error) {
    writeFrame({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Starts the read loop. Returns once stdin closes, i.e. the host went away. */
export function listen(): void {
  const input = createInterface({ input: process.stdin });

  input.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      console.log(`[sidecar] ignoring malformed frame: ${trimmed.slice(0, 120)}`);
      return;
    }

    // A reply to one of our host calls.
    if (typeof msg.rid === "string") {
      const pending = pendingHostCalls.get(msg.rid);
      if (!pending) return;
      pendingHostCalls.delete(msg.rid);
      if (msg.ok) {
        pending.resolve(msg.result as never);
      } else {
        pending.reject(new Error(String(msg.error ?? "host call failed")));
      }
      return;
    }

    // An inbound channel call from the renderer.
    if (typeof msg.id === "string" && typeof msg.channel === "string") {
      void handleCall(
        msg.id,
        msg.channel,
        Array.isArray(msg.args) ? msg.args : [],
      );
    }
  });

  input.on("close", () => {
    console.log("[sidecar] host closed the pipe; exiting");
    process.exit(0);
  });
}
