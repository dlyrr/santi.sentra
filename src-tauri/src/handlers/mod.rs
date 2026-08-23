//! Natively-served channels.
//!
//! `dispatch` returns `None` for anything not ported yet, which sends the call
//! on to the Node sidecar. Adding a channel here is the entire porting step —
//! nothing in the renderer changes.
//!
//! What lives here is deliberately the cheap-and-safe half of the old main
//! process: window chrome, shell and dialog access, app metadata, clipboard,
//! and the Roblox HTTP layer. What is *not* here, on purpose:
//!
//!   * StorageService — 2.1k lines of PIN-derived account encryption, Electron
//!     safeStorage envelopes and legacy on-disk migrations. Reimplementing it
//!     risks locking users out of their own accounts, so it stays in Node until
//!     it can be ported against real fixtures.
//!   * MultiInstance / Handle64 — koffi FFI into Win32 handle tables.
//!   * Playwright automation and the binary .rbxm reader.

mod app;
pub mod install;
pub mod http;
pub mod shell;
pub mod updater;
pub mod window;

use serde_json::Value;
use tauri::AppHandle;

/// Every channel answered in Rust. Kept explicit so `ipc_backend_for` and the
/// migration report can tell the two halves apart without guessing.
pub const NATIVE_CHANNELS: &[&str] = &[
    // window chrome
    "focus-window",
    "window:minimize",
    "window:toggle-maximize",
    "window:close",
    "window:is-maximized",
    "window:start-drag",
    // shell + dialog
    "open-external",
    "open-path",
    "choose-backup-location",
    "open-roblox-folder",
    "open-log-file",
    // app metadata
    "app:get-version",
    "app:get-platform",
    "app:get-paths",
    "app:log",
    "clipboard:write-text",
    "clipboard:read-text",
    // health probes
    "trading:health",
    "browser:health",
    "proxy-mgmt:health",
    // installing Roblox itself, via the shared roblox-deploy crate
    "get-deploy-history",
    "install-roblox-version",
    "verify-roblox-files",
    "check-for-updates",
    // network
    "proxy:fetchFreeProxies",
    "roblox:fetch",
    // auto-update
    "updater:check",
    "updater:download",
    "updater:install",
    "updater:get-state",
];

pub fn is_native(channel: &str) -> bool {
    NATIVE_CHANNELS.contains(&channel)
}

pub fn native_channels() -> Vec<&'static str> {
    NATIVE_CHANNELS.to_vec()
}

/// Positional argument access, matching the old `ipcMain.handle(ch, (_e, a, b))`
/// calling convention the preload layer still uses.
pub fn arg(args: &Value, index: usize) -> Value {
    args.get(index).cloned().unwrap_or(Value::Null)
}

pub fn arg_str(args: &Value, index: usize) -> Option<String> {
    args.get(index)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

pub async fn dispatch(
    app: &AppHandle,
    channel: &str,
    args: &Value,
) -> Option<Result<Value, String>> {
    if !is_native(channel) {
        return None;
    }

    let result = match channel {
        "focus-window"
        | "window:minimize"
        | "window:toggle-maximize"
        | "window:close"
        | "window:is-maximized"
        | "window:start-drag" => window::handle(app, channel).await,

        "open-external" | "open-path" | "choose-backup-location" | "open-roblox-folder"
        | "open-log-file" => shell::handle(app, channel, args).await,

        "app:get-version" | "app:get-platform" | "app:get-paths" | "app:log" | "clipboard:write-text"
        | "clipboard:read-text" | "trading:health" | "browser:health" | "proxy-mgmt:health" => {
            app::handle(app, channel, args).await
        }

        "proxy:fetchFreeProxies" | "roblox:fetch" => http::handle(channel, args).await,

        "get-deploy-history" | "install-roblox-version" | "verify-roblox-files"
        | "check-for-updates" => install::handle(app, channel, args).await,

        "updater:check" | "updater:download" | "updater:install" | "updater:get-state" => {
            updater::handle(app, channel, args).await
        }

        _ => Err(format!("channel '{channel}' is listed as native but unrouted")),
    };

    Some(result)
}
