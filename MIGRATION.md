# Electron → Tauri migration

Sentra's shell is now Tauri. This describes how the pieces fit, what is done,
and what is left.

## Shape

```
renderer (React 19, unchanged)
  │  window.api.*  ← installed by src/bridge, not a preload
  │
  └─ invoke("ipc_invoke", { channel, args })      one Tauri command, 339 channels
       │
       ├─ src-tauri/src/handlers/   served natively in Rust
       └─ src-tauri/src/sidecar.rs  everything else, over NDJSON to Node
                                      │
                                      └─ src/sidecar/  hosts the old main-process
                                         services, with `electron` aliased to a shim
```

Three properties make this work:

**One choke point.** The old preload funnelled every call through a single
`invoke(channel, schema, ...args)` helper. The Tauri side keeps exactly that
shape, so moving a channel between Rust and Node is invisible to the renderer.
`handlers::dispatch` returns `None` for anything unported and the call falls
through to the sidecar. Porting a channel = add a match arm, delete a Node
handler. Nothing in `src/renderer` changes, ever.

**`electron` is an alias, not a rewrite.** The renderer build points `electron`
at `src/bridge/electron.ts`; the sidecar build points it at
`src/sidecar/electron-shim.ts`. All 19 preload API modules and ~33k lines of
service code compile unmodified against those shims.

**The sidecar is the same code, not a port.** `src/sidecar/index.ts` calls the
same `register*Handlers()` functions in the same order the Electron main process
did.

## Status

`npm run migration:status` prints this live; `npm run test:sidecar` boots the
sidecar against a simulated host and asserts every channel registers.

| | count |
|---|---|
| Renderer channel contract | 339 |
| Served natively by Rust | 4 |
| Served by the Node sidecar | 307 |
| Never implemented, in Electron either | 28 |

The 28 are the `proxy:`, `net-log:`, `browser:` and `trading:` channels. They
have preload APIs and service files but were never wired to IPC, so calling one
has always rejected. `scripts/sidecar-smoke.mjs` tracks them explicitly so the
list shrinks if someone implements one, rather than the test passing by accident.

Beyond the contract, the shell adds 17 of its own channels (window chrome,
clipboard, app paths).

## What deliberately stayed in Node

The brief was "Rust where it's cheap". These are not cheap, and the reasons
matter more than the labels:

**StorageService** (2.1k lines) — PIN-derived account encryption, Electron
`safeStorage` envelopes, and several generations of on-disk migration. Users
have live config encrypted by it today. A reimplementation that is subtly wrong
does not throw; it locks people out of their accounts. It should be ported
against real fixtures, as its own piece of work.

**MultiInstance / Handle64** — koffi FFI into Win32 handle tables to allow
multiple Roblox clients. Portable to `windows-rs`, but it is delicate and
load-bearing.

**Playwright automation and the `.rbxm` reader** — no Rust equivalent worth
writing yet.

Two Electron APIs could *not* be reverse calls, because they are synchronous and
are used during module initialisation:

- `app.getPath` → `src/sidecar/paths.ts`. Resolves the Electron layout
  explicitly (`%APPDATA%\sentra`). Tauri would default to its bundle identifier
  (`%APPDATA%\com.sentra.app`); pointing there would show every existing user an
  empty account list while their real config sat one folder over.
- `safeStorage` → `src/sidecar/safeStorage.ts`. Real DPAPI through koffi.
  Electron's Windows safeStorage blob *is* a `CryptProtectData` blob with no
  extra entropy, so calling the same API reproduces the format byte-for-byte and
  existing encrypted config keeps opening. `npm run test:safestorage` asserts
  this: it checks the DPAPI magic and round-trips a non-ASCII value.

## Still to do

**Roblox login window.** `RobloxLoginWindowService` builds a `BrowserWindow` and
a `BrowserView` to host Roblox's login page and harvest the resulting cookie.
Tauri has no `BrowserView`; this needs a second `WebviewWindow` plus cookie
extraction. Constructing one currently throws with a pointer to this section,
rather than failing in a subtler way later. Cookie-based and quick-login imports
are unaffected.

**Auto-update.** `electron-updater` is replaced by an inert shim
(`src/sidecar/shims/electron-updater.ts`) that reports "no update available".
The real path is `tauri-plugin-updater`: add the plugin, publish
`latest.json` + signatures from CI, and re-point `UpdaterController`'s channels
at it. The shim refuses to download rather than pretending — silently doing
nothing behind a working-looking API is how users get stranded on an old build.

**macOS / Linux `safeStorage`.** DPAPI is Windows-only. The other platforms need
Keychain and libsecret, and the Rust side already has `keyring` wired up in
`host.rs` for it.

**Next channels worth porting to Rust.** The read-only Roblox HTTP endpoints
(users, friends, groups, games, catalog). `handlers/http.rs` already has the
client, with the credential-stripping redirect policy from `request.ts`
reproduced exactly.

## Commands

| | |
|---|---|
| `npm run dev` | Tauri dev with renderer HMR |
| `npm run build` | typecheck, bundle sidecar, build installers |
| `npm run build:sidecar` | bundle the Node sidecar only |
| `npm test` | both checks below |
| `npm run test:sidecar` | boot the sidecar, assert channels register |
| `npm run test:safestorage` | assert DPAPI still reads Electron's blob format |
| `npm run migration:status` | Rust/Node split, `--list` for channel names |

`npm run build:sidecar` must run before `cargo build`: Tauri treats the sidecar
as an `externalBin` and refuses to configure without it.

## Notes for whoever picks this up

- The window is created with `decorations: false` because Tauri has no
  equivalent of Electron's `titleBarOverlay`. Caption buttons are drawn by
  `components/UI/navigation/WindowControls.tsx`, and drag regions are
  `data-tauri-drag-region` attributes rather than `-webkit-app-region` (WebView2
  does not support the CSS property).
- Sidecar stdout is the protocol wire. `console.log` is redirected to stderr in
  `src/sidecar/bridge.ts`; a stray write to stdout desynchronises the stream.
- `registerRobloxHandlers()` already fans out to eleven feature controllers.
  Registering them again double-registers every channel.
