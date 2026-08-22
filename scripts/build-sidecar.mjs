/**
 * Bundles the Node sidecar and stages it where Tauri expects an external binary.
 *
 * Native modules are deliberately left external: koffi and better-sqlite3 ship
 * .node addons that cannot be inlined, and Playwright resolves its browsers
 * from its own package layout. They are copied next to the bundle instead.
 */

import { build } from "esbuild";
import { cp, mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "src-tauri/binaries");
const bundle = resolve(outDir, "sidecar.cjs");

/** Cannot be bundled: native addons and packages that resolve their own files. */
const EXTERNAL = [
  "koffi",
  "better-sqlite3",
  "playwright",
  "playwright-core",
  "multithreading",
  "@ryuziii/discord-rpc",
  "discord-rpc",
];

/** The Rust host triple, which is how Tauri names external binaries. */
function hostTriple() {
  const output = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const match = output.match(/^host:\s*(.+)$/m);
  if (!match) throw new Error("could not determine the rustc host triple");
  return match[1].trim();
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await build({
    entryPoints: [resolve(root, "src/sidecar/index.ts")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: true,
    external: EXTERNAL,
    // The services import `electron`; inside the sidecar that must resolve to
    // the shim, never to the real package.
    alias: {
      electron: resolve(root, "src/sidecar/electron-shim.ts"),
      "electron-log": resolve(root, "src/sidecar/shims/electron-log.ts"),
      "electron-updater": resolve(root, "src/sidecar/shims/electron-updater.ts"),
      "@main": resolve(root, "src/main"),
      "@shared": resolve(root, "src/shared"),
      "@assets": resolve(root, "assets"),
    },
    logLevel: "info",
  });

  // Stage the externals so `require` finds them beside the bundle.
  await mkdir(resolve(outDir, "node_modules"), { recursive: true });
  for (const dep of EXTERNAL) {
    const from = resolve(root, "node_modules", dep);
    if (!existsSync(from)) {
      console.warn(`[sidecar] optional dependency not installed, skipping: ${dep}`);
      continue;
    }
    await cp(from, resolve(outDir, "node_modules", dep), { recursive: true });
  }

  // Tauri's externalBin wants a real executable. Node's own binary is copied in
  // and paired with a launcher, which keeps native addons loadable — a
  // single-file SEA build cannot load .node addons on Windows.
  const nodeExe = process.execPath;
  const ext = process.platform === "win32" ? ".exe" : "";

  // Tauri resolves externalBin by appending the Rust host triple, and strips it
  // again when bundling. Both names are written so `tauri build` and a plain
  // `cargo run` from the crate directory each find one.
  const triple = hostTriple();
  const targetName = `sentra-sidecar${ext}`;
  const tripleName = `sentra-sidecar-${triple}${ext}`;

  if (process.platform === "win32") {
    // A .cmd shim would flash a console window, so the Node runtime itself is
    // copied under the sidecar's name. Rust passes sidecar.cjs as argv[1] when
    // it finds one beside the binary.
    await copyFile(nodeExe, resolve(outDir, targetName));
    await copyFile(nodeExe, resolve(outDir, tripleName));
  } else {
    await copyFile(nodeExe, resolve(outDir, "node"));
    const launcher = `#!/bin/sh\nexec "$(dirname "$0")/node" "$(dirname "$0")/sidecar.cjs" "$@"\n`;
    await writeFile(resolve(outDir, targetName), launcher, { mode: 0o755 });
    await writeFile(resolve(outDir, tripleName), launcher, { mode: 0o755 });
  }

  console.log(`[sidecar] built -> ${bundle}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
