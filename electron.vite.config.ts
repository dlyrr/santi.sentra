import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

const sharedAliases = {
  "@renderer": resolve("src/renderer/src"),
  "@main": resolve("src/main"),
  "@preload": resolve("src/preload"),
  "@shared": resolve("src/shared"),
  "@assets": resolve("assets"),
};

export default defineConfig({
  main: {
    resolve: {
      alias: { ...sharedAliases },
    },
    plugins: [
      externalizeDepsPlugin({
        // Explicitly externalize koffi and other potential native deps
        exclude: [],
      }),
    ],
    build: {
      rollupOptions: {
        external: ["koffi", "better-sqlite3"],
      },
    },
  },
  preload: {
    resolve: {
      alias: { ...sharedAliases },
    },
    // The main window runs with `sandbox: true`. A sandboxed preload can only
    // `require()` "electron" and a few Node builtins — it CANNOT require
    // arbitrary npm packages. externalizeDepsPlugin() would leave
    // `require("zod")` in the output, which throws at preload load time and
    // silently prevents the contextBridge from ever running (renderer then
    // sees `window.electron === undefined`). So bundle zod into the preload
    // instead of externalizing it. `electron` stays external via electron-vite's
    // defaults regardless.
    plugins: [externalizeDepsPlugin({ exclude: ["zod"] })],
  },
  renderer: {
    resolve: {
      alias: { ...sharedAliases },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    assetsInclude: ["**/*.dds"], // Include DDS files as assets
    plugins: [react(), tailwindcss()],
    worker: {
      format: "es",
    },
    optimizeDeps: {
      exclude: ["multithreading"],
    },
    build: {
      commonjsOptions: {
        exclude: [/node_modules\/multithreading\//],
      },
    },
  },
});
