//! Window chrome. Electron drew the Windows caption buttons for us via
//! `titleBarOverlay`; Tauri has no equivalent, so the renderer paints its own
//! controls and drives them through these channels.

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

fn main_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())
}

pub async fn handle(app: &AppHandle, channel: &str) -> Result<Value, String> {
    let window = main_window(app)?;

    match channel {
        "focus-window" => {
            // Matches the old behaviour: un-minimise, raise, then focus.
            let _ = window.unminimize();
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "window:minimize" => {
            window.minimize().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "window:toggle-maximize" => {
            let maximized = window.is_maximized().map_err(|e| e.to_string())?;
            if maximized {
                window.unmaximize().map_err(|e| e.to_string())?;
            } else {
                window.maximize().map_err(|e| e.to_string())?;
            }
            Ok(json!(!maximized))
        }
        "window:is-maximized" => {
            let maximized = window.is_maximized().map_err(|e| e.to_string())?;
            Ok(json!(maximized))
        }
        "window:close" => {
            window.close().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "window:start-drag" => {
            window.start_dragging().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        other => Err(format!("unhandled window channel: {other}")),
    }
}
