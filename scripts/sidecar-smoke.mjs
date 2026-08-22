/**
 * Boots the sidecar the way Rust does and checks it comes up healthy.
 *
 * Stands in for the Tauri host: speaks the same NDJSON protocol, answers the
 * reverse `host:` calls, and reports which of the renderer's channels ended up
 * registered. Running the whole app just to find out that one controller threw
 * during registration is a slow way to learn it.
 *
 *   node scripts/sidecar-smoke.mjs [--list-missing]
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = resolve(root, "src-tauri/binaries");
const exe = join(binDir, process.platform === "win32" ? "santi.manager-sidecar.exe" : "santi.manager-sidecar");
const script = join(binDir, "sidecar.cjs");

if (!existsSync(exe) || !existsSync(script)) {
  console.error("sidecar not built; run `npm run build:sidecar` first");
  process.exit(1);
}

/** The channels the renderer can actually call. */
async function contractChannels(dir) {
  const channels = new Set();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const c of await contractChannels(path)) channels.add(c);
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    const source = await readFile(path, "utf8");
    for (const m of source.matchAll(/\binvoke\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      channels.add(m[1]);
    }
  }
  return channels;
}

async function nativeChannels() {
  const source = await readFile(resolve(root, "src-tauri/src/handlers/mod.rs"), "utf8");
  const block = source.match(/NATIVE_CHANNELS:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\];/);
  return new Set(block ? [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : []);
}

/**
 * Channels the preload layer exposes that never had a handler, in Electron
 * either: the proxy, net-log, browser and trading modules ship services but
 * were never wired to IPC, so calling them has always rejected. They are
 * tracked here rather than silently tolerated, so that if someone implements
 * one the list shrinks instead of the test staying green by accident.
 */
const NEVER_IMPLEMENTED = new Set([
  "proxy:add-proxies", "proxy:import", "proxy:export", "proxy:test-proxies",
  "proxy:get-healthy", "proxy:assign-session", "proxy:release-session",
  "proxy:get-state", "proxy:set-config", "proxy:clear",
  "net-log:get-status", "net-log:get-log-path", "net-log:stop", "net-log:start",
  "browser:launch", "browser:navigate", "browser:fill-form",
  "browser:execute-automation", "browser:wait-for-user", "browser:complete-user",
  "browser:screenshot", "browser:close", "browser:is-automating",
  "trading:analyze-item", "trading:make-decision", "trading:find-opportunities",
  "trading:set-config", "trading:get-config",
]);

/** Minimal stand-in for src-tauri/src/host.rs. */
function answerHostCall(fn) {
  switch (fn) {
    case "app:getVersion":
      return "1.1.8";
    case "app:getPath":
      return tmpdir();
    case "safeStorage:isAvailable":
      return true;
    case "window:show":
    case "window:send":
      return null;
    default:
      return null;
  }
}

const child = spawn(exe, [script], {
  stdio: ["pipe", "pipe", "pipe"],
  // Rust supplies this at spawn time; the services read it during module init.
  env: { ...process.env, SENTRA_RESOURCES: resolve(root, "resources") },
});
const logs = [];
const pending = new Map();

createInterface({ input: child.stderr }).on("line", (line) => logs.push(line));

createInterface({ input: child.stdout }).on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    logs.push(`(non-JSON on stdout) ${line}`);
    return;
  }

  if (msg.rid) {
    child.stdin.write(
      JSON.stringify({ rid: msg.rid, ok: true, result: answerHostCall(msg.host) }) + "\n",
    );
    return;
  }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function call(channel, args = []) {
  const id = `smoke-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolveCall, rejectCall) => {
    const timer = setTimeout(() => rejectCall(new Error(`timeout: ${channel}`)), 30_000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolveCall(msg);
    });
    child.stdin.write(JSON.stringify({ id, channel, args }) + "\n");
  });
}

// Controllers register across a few ticks; give them a moment to settle.
await new Promise((r) => setTimeout(r, 3000));

let registered;
try {
  const reply = await call("sidecar:channels");
  if (!reply.ok) throw new Error(reply.error);
  registered = new Set(reply.result);
} catch (error) {
  console.error(`FAIL: sidecar never became ready (${error.message})`);
  console.error(logs.slice(-40).join("\n"));
  child.kill();
  process.exit(1);
}

const contract = await contractChannels(resolve(root, "src/preload/api"));
const native = await nativeChannels();
const expected = [...contract].filter(
  (c) => !native.has(c) && !NEVER_IMPLEMENTED.has(c),
);
const missing = expected.filter((c) => !registered.has(c));
const revived = [...NEVER_IMPLEMENTED].filter((c) => registered.has(c));

console.log(`sidecar channels registered : ${registered.size}`);
console.log(`expected from the sidecar   : ${expected.length}`);
console.log(`missing                     : ${missing.length}`);
console.log(`never implemented (parity)  : ${NEVER_IMPLEMENTED.size - revived.length}`);
if (revived.length) {
  console.log("\nThese are implemented now; drop them from NEVER_IMPLEMENTED:");
  for (const channel of revived) console.log(`  ${channel}`);
}

if (logs.length) {
  console.log("\nsidecar log:");
  for (const line of logs.slice(0, 30)) console.log(`  ${line}`);
}

if (missing.length && process.argv.includes("--list-missing")) {
  console.log("\nmissing channels:");
  for (const c of missing) console.log(`  ${c}`);
}

child.kill();
process.exit(missing.length === 0 ? 0 : 1);
