/**
 * Round-trips a value through the sidecar's DPAPI safeStorage.
 *
 * This is the highest-consequence piece of the Electron migration: users have
 * account data on disk encrypted by Electron's safeStorage, and the replacement
 * has to produce and read the identical format. If it does not, the failure
 * mode is not a crash — it is people unable to open their own accounts.
 *
 * On Windows, Electron's safeStorage blob is a CryptProtectData blob with no
 * extra entropy, which always begins with the DPAPI magic 0x01000000.
 *
 *   node scripts/test-safestorage.mjs
 */

import { buildSync } from "esbuild";
import { rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(root, "src-tauri/binaries/safestorage-test.cjs");

if (process.platform !== "win32") {
  console.log("skipped: DPAPI safeStorage is Windows-only (see MIGRATION.md)");
  process.exit(0);
}

buildSync({
  entryPoints: [resolve(root, "src/sidecar/safeStorage.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  // koffi is a native addon and is resolved from the staged node_modules.
  external: ["koffi"],
  logLevel: "error",
});

const require = createRequire(outfile);

try {
  const { safeStorage } = require(outfile);

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("safeStorage reported itself unavailable");
  }

  // Non-ASCII included on purpose: cookies and display names are not plain
  // ASCII, and a wrong encoding round-trip would corrupt them silently.
  const secret = "ROBLOSECURITY-test-éüñ-日本語-12345";
  const blob = safeStorage.encryptString(secret);

  const magic = blob.subarray(0, 4).toString("hex");
  if (magic !== "01000000") {
    throw new Error(
      `expected a DPAPI blob (magic 01000000), got ${magic}. ` +
        "Existing Electron-encrypted config will not decrypt.",
    );
  }

  const restored = safeStorage.decryptString(blob);
  if (restored !== secret) {
    throw new Error(`round-trip mismatch: ${JSON.stringify(restored)}`);
  }

  console.log(`safeStorage: DPAPI blob (${blob.length} bytes), round-trip ok`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(outfile, { force: true });
}
