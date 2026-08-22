import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

/**
 * Renderer build for the Tauri shell, replacing electron.vite.config.ts.
 *
 * The one load-bearing line is the `electron` alias: the renderer and all 19
 * preload API modules still `import { ipcRenderer } from "electron"`, and that
 * now resolves to a Tauri-backed shim instead of Electron. Not one of those
 * files had to change.
 */
export default defineConfig({
  root: "src/renderer",
  publicDir: resolve("resources"),
  resolve: {
    alias: {
      electron: resolve("src/bridge/electron.ts"),
      "@renderer": resolve("src/renderer/src"),
      "@bridge": resolve("src/bridge"),
      "@preload": resolve("src/preload"),
      "@shared": resolve("src/shared"),
      "@assets": resolve("assets"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  assetsInclude: ["**/*.dds"],
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  optimizeDeps: {
    exclude: ["multithreading"],
  },
  server: {
    port: 5173,
    strictPort: true,
    // Tauri surfaces build errors in its own window; failing loudly in the
    // terminal is more useful than an overlay behind a custom titlebar.
    hmr: { overlay: false },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    outDir: resolve("out/renderer"),
    emptyOutDir: true,
    target: "chrome110",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    commonjsOptions: {
      exclude: [/node_modules\/multithreading\//],
    },
  },
});
