/**
 * Reports how far the Electron -> Tauri backend port has got.
 *
 * The renderer's contract is the set of channels the preload API modules call.
 * Each is served either by Rust (listed in `handlers/mod.rs`) or by the Node
 * sidecar. This walks both sides and prints the split, so "what is left" is a
 * command rather than a guess.
 */

import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function collectChannels(dir) {
  const channels = new Set();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const c of await collectChannels(path)) channels.add(c);
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    const source = await readFile(path, "utf8");
    for (const match of source.matchAll(/\binvoke\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      channels.add(match[1]);
    }
  }
  return channels;
}

async function nativeChannels() {
  const source = await readFile(
    resolve(root, "src-tauri/src/handlers/mod.rs"),
    "utf8",
  );
  const block = source.match(
    /NATIVE_CHANNELS:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\];/,
  );
  if (!block) return new Set();
  return new Set([...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
}

const contract = await collectChannels(resolve(root, "src/preload/api"));
const native = await nativeChannels();

// Some native channels are new to the Tauri shell (window chrome) and have no
// counterpart in the old preload contract; count them separately.
const ported = [...contract].filter((c) => native.has(c)).sort();
const remaining = [...contract].filter((c) => !native.has(c)).sort();
const shellOnly = [...native].filter((c) => !contract.has(c)).sort();

const pct = ((ported.length / contract.size) * 100).toFixed(1);

console.log(`Renderer channel contract : ${contract.size}`);
console.log(`  served by Rust          : ${ported.length} (${pct}%)`);
console.log(`  served by Node sidecar  : ${remaining.length}`);
console.log(`New shell-only channels   : ${shellOnly.length}`);

const byPrefix = new Map();
for (const channel of remaining) {
  const prefix = channel.includes(":") ? channel.split(":")[0] : "(flat)";
  byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
}

console.log("\nStill on the sidecar, by module:");
for (const [prefix, count] of [...byPrefix].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${prefix}`);
}

if (process.argv.includes("--list")) {
  console.log("\nRemaining channels:");
  for (const channel of remaining) console.log(`  ${channel}`);
}
