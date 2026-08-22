//! Shell and dialog access, replacing Electron's `shell` and `dialog`.

use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use super::arg_str;

pub async fn handle(app: &AppHandle, channel: &str, args: &Value) -> Result<Value, String> {
    match channel {
        "open-external" => {
            let url = arg_str(args, 0).ok_or("open-external requires a url")?;
            // Only ever hand http(s) to the OS handler. Electron's shell.openExternal
            // would happily launch file: and custom protocols, which is a way to
            // turn a malicious profile link into code execution.
            let parsed = url::Url::parse(&url).map_err(|e| format!("invalid url: {e}"))?;
            if !matches!(parsed.scheme(), "http" | "https") {
                return Err(format!("refusing to open non-web url: {}", parsed.scheme()));
            }
            app.opener()
                .open_url(url, None::<&str>)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }

        "open-path" | "open-roblox-folder" | "open-log-file" => {
            let path = arg_str(args, 0)
                .ok_or_else(|| format!("{channel} requires a path"))?;
            app.opener()
                .open_path(path, None::<&str>)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }

        "choose-backup-location" => {
            let (tx, rx) = std::sync::mpsc::channel();
            app.dialog().file().pick_folder(move |folder| {
                let _ = tx.send(folder);
            });
            let picked = rx.recv().map_err(|e| e.to_string())?;
            match picked {
                Some(path) => Ok(json!({ "canceled": false, "path": path.to_string() })),
                None => Ok(json!({ "canceled": true, "path": Value::Null })),
            }
        }

        other => Err(format!("unhandled shell channel: {other}")),
    }
}
