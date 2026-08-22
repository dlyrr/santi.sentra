//! App metadata, clipboard, and the trivial health probes that used to live in
//! `ModuleIpcHandlers.ts`.

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

use super::arg_str;

pub async fn handle(app: &AppHandle, channel: &str, args: &Value) -> Result<Value, String> {
    match channel {
        "app:get-version" => Ok(json!(app.package_info().version.to_string())),

        "app:get-platform" => Ok(json!({
            "platform": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "isMac": cfg!(target_os = "macos"),
            "isWindows": cfg!(target_os = "windows"),
            "isLinux": cfg!(target_os = "linux"),
        })),

        "app:get-paths" => {
            let path = app.path();
            let render = |p: Result<std::path::PathBuf, tauri::Error>| {
                p.ok()
                    .map(|v| Value::String(v.to_string_lossy().into_owned()))
                    .unwrap_or(Value::Null)
            };
            Ok(json!({
                "appData": render(path.app_data_dir()),
                "appConfig": render(path.app_config_dir()),
                "appLog": render(path.app_log_dir()),
                "cache": render(path.app_cache_dir()),
                "temp": render(path.temp_dir()),
                "resource": render(path.resource_dir()),
            }))
        }

        // Lets the renderer put a line in the app log. Validation failures
        // happen after a successful IPC round trip, so they were previously
        // invisible: the webview console is not captured anywhere.
        "app:log" => {
            let level = arg_str(args, 0).unwrap_or_else(|| "info".into());
            let message = arg_str(args, 1).unwrap_or_default();
            match level.as_str() {
                "error" => log::error!("[renderer] {message}"),
                "warn" => log::warn!("[renderer] {message}"),
                _ => log::info!("[renderer] {message}"),
            }
            Ok(Value::Null)
        }

        "clipboard:write-text" => {
            let text = arg_str(args, 0).unwrap_or_default();
            app.clipboard().write_text(text).map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }

        "clipboard:read-text" => {
            let text = app.clipboard().read_text().map_err(|e| e.to_string())?;
            Ok(json!(text))
        }

        // These were always constant-true probes; there is no reason to pay a
        // process hop for them.
        "trading:health" => Ok(json!({ "success": true, "status": "trading module ready" })),
        "browser:health" => Ok(json!({ "success": true, "status": "browser module ready" })),
        "proxy-mgmt:health" => Ok(json!({
            "success": true,
            "status": "proxy management module ready"
        })),

        other => Err(format!("unhandled app channel: {other}")),
    }
}
