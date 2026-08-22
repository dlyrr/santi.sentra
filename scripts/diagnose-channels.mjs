/**
 * Calls real backend channels against the built sidecar and prints what each
 * one returns.
 *
 * Faster and far more precise than clicking through the UI: it exercises the
 * same handlers the app does, and shows the actual error string rather than
 * whatever generic message the view falls back to.
 *
 *   node scripts/diagnose-channels.mjs
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = resolve(root, "src-tauri/binaries");
const exe = join(
  binDir,
  process.platform === "win32" ? "santi.manager-sidecar.exe" : "santi.manager-sidecar",
);
const script = join(binDir, "sidecar.cjs");

if (!existsSync(exe) || !existsSync(script)) {
  console.error("sidecar not built; run `npm run build:sidecar` first");
  process.exit(1);
}

/** A well-known public Roblox account, so no local data is needed. */
const USER_ID = 1;

// The pair that matters: identical calls, one with the trailing optional
// argument omitted (what Electron delivered for `undefined`) and one with it as
// null (what JSON serialisation turns `undefined` into).
/** What the renderer bridge now puts on the wire in place of `undefined`. */
const UNDEF = { __sentra_undefined__: true };

const CALLS = [
  // NOTE: read-only by design. This talks to the real config in
  // %APPDATA%\sentra, so a probe that writes settings edits the user's actual
  // preferences. An earlier version of this script did exactly that.
  ["get-settings", [], "get-settings", []],
  ["macro:list", [], "macro:list", []],
  ["discord-rpc-get-state", [], "discord-rpc-get-state", []],
  ["get-user-by-username", ["roblox"]],
  ["get-catalog-navigation", []],
  ["get-friends  [omitted]", [], "get-friends", ["", USER_ID]],
  ["get-friends  [null]", [], "get-friends", ["", USER_ID, null]],
  ["get-friends  [sentinel]", [], "get-friends", ["", USER_ID, UNDEF]],
  ["get-followers [sentinel]", [], "get-followers", ["", USER_ID, UNDEF]],
  ["get-followings [sentinel]", [], "get-followings", ["", USER_ID, UNDEF]],
];

const child = spawn(exe, [script], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, SENTRA_RESOURCES: resolve(root, "resources") },
});

const logs = [];
const pending = new Map();

createInterface({ input: child.stderr }).on("line", (l) => logs.push(l));

createInterface({ input: child.stdout }).on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.rid) {
    // Stand in for the Tauri host.
    const result = msg.host === "app:getPath" ? tmpdir() : null;
    child.stdin.write(JSON.stringify({ rid: msg.rid, ok: true, result }) + "\n");
    return;
  }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function call(channel, args) {
  const id = `diag-${Math.random().toString(36).slice(2)}`;
  return new Promise((res) => {
    const timer = setTimeout(
      () => res({ ok: false, error: "TIMEOUT after 25s (no reply)" }),
      25_000,
    );
    pending.set(id, (msg) => {
      clearTimeout(timer);
      res(msg);
    });
    child.stdin.write(JSON.stringify({ id, channel, args }) + "\n");
  });
}

await new Promise((r) => setTimeout(r, 4000));

for (const [label, argsA, realChannel, realArgs] of CALLS) {
  const channel = realChannel ?? label;
  const args = realArgs ?? argsA;
  const started = Date.now();
  const reply = await call(channel, args);
  const ms = Date.now() - started;
  if (reply.ok) {
    // For settings calls, show only the fields under test.
    let shown = reply.result;
    if (channel === "get-settings" && shown && typeof shown === "object") {
      shown = {
        privacyMode: shown.privacyMode,
        accentColor: shown.accentColor,
        tint: shown.tint,
      };
    }
    const rendered = JSON.stringify(shown);
    console.log(
      `OK   ${label.padEnd(26)} ${String(ms).padStart(6)}ms  ${
        rendered.length > 80 ? rendered.slice(0, 80) + "…" : rendered
      }`,
    );
  } else {
    const flat = String(reply.error).replace(/\s+/g, " ").slice(0, 130);
    console.log(`FAIL ${label.padEnd(26)} ${String(ms).padStart(6)}ms  ${flat}`);
  }
}

const noise = logs.filter((l) => /error|fail|refus|denied|ECONN|ENOTFOUND/i.test(l));
if (noise.length) {
  console.log("\nsidecar errors:");
  for (const line of noise.slice(0, 15)) console.log(`  ${line}`);
}

child.kill();
