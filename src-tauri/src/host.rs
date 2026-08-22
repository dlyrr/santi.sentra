//! Services the sidecar asks *us* for.
//!
//! The Node services still contain calls that used to resolve to Electron's
//! `app`, `dialog`, `shell`, `safeStorage` and `BrowserWindow`. The Node-side
//! `electron` shim turns each of those into a reverse call landing here, so the
//! service code itself never had to change.

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const KEYRING_SERVICE: &str = "com.sentra.app";

pub async fn handle(app: &AppHandle, host_fn: &str, args: Value) -> Result<Value, String> {
    let first_str = |index: usize| {
        args.get(index)
            .and_then(Value::as_str)
            .map(ToString::to_string)
    };

    match host_fn {
        // ---- app ----------------------------------------------------------
        "app:getVersion" => Ok(json!(app.package_info().version.to_string())),
        "app:getPath" => {
            let which = first_str(0).unwrap_or_else(|| "userData".into());
            let path = app.path();
            let resolved = match which.as_str() {
                "userData" | "appData" => path.app_data_dir(),
                "logs" => path.app_log_dir(),
                "temp" => path.temp_dir(),
                "cache" => path.app_cache_dir(),
                "home" => path.home_dir(),
                "downloads" => path.download_dir(),
                "desktop" => path.desktop_dir(),
                "documents" => path.document_dir(),
                other => return Err(format!("unknown app path: {other}")),
            };
            resolved
                .map(|p| json!(p.to_string_lossy()))
                .map_err(|e| e.to_string())
        }
        "app:quit" => {
            app.exit(0);
            Ok(Value::Null)
        }
        "app:relaunch" => {
            // Diverges: the process is replaced, so this arm never returns.
            app.restart();
        }

        // ---- shell --------------------------------------------------------
        "shell:openExternal" => {
            let url = first_str(0).ok_or("openExternal requires a url")?;
            let parsed = url::Url::parse(&url).map_err(|e| format!("invalid url: {e}"))?;
            if !matches!(parsed.scheme(), "http" | "https") {
                return Err(format!("refusing to open non-web url: {}", parsed.scheme()));
            }
            app.opener()
                .open_url(url, None::<&str>)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "shell:openPath" => {
            let path = first_str(0).ok_or("openPath requires a path")?;
            app.opener()
                .open_path(path, None::<&str>)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "shell:showItemInFolder" => {
            let path = first_str(0).ok_or("showItemInFolder requires a path")?;
            app.opener()
                .reveal_item_in_dir(path)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }

        // ---- dialog -------------------------------------------------------
        "dialog:showOpenDialog" => {
            let directory = args
                .get(0)
                .and_then(|o| o.get("properties"))
                .and_then(Value::as_array)
                .map(|props| props.iter().any(|p| p.as_str() == Some("openDirectory")))
                .unwrap_or(false);

            let (tx, rx) = std::sync::mpsc::channel();
            if directory {
                app.dialog().file().pick_folder(move |picked| {
                    let _ = tx.send(picked.map(|p| p.to_string()));
                });
            } else {
                app.dialog().file().pick_file(move |picked| {
                    let _ = tx.send(picked.map(|p| p.to_string()));
                });
            }
            let picked = rx.recv().map_err(|e| e.to_string())?;
            Ok(match picked {
                Some(path) => json!({ "canceled": false, "filePaths": [path] }),
                None => json!({ "canceled": true, "filePaths": [] }),
            })
        }
        "dialog:showSaveDialog" => {
            let (tx, rx) = std::sync::mpsc::channel();
            app.dialog().file().save_file(move |picked| {
                let _ = tx.send(picked.map(|p| p.to_string()));
            });
            let picked = rx.recv().map_err(|e| e.to_string())?;
            Ok(match picked {
                Some(path) => json!({ "canceled": false, "filePath": path }),
                None => json!({ "canceled": true, "filePath": Value::Null }),
            })
        }
        "dialog:showMessageBox" => {
            let message = args
                .get(0)
                .and_then(|o| o.get("message"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let title = args
                .get(0)
                .and_then(|o| o.get("title"))
                .and_then(Value::as_str)
                .unwrap_or("Sentra")
                .to_string();
            app.dialog().message(message).title(title).blocking_show();
            Ok(json!({ "response": 0 }))
        }

        // ---- safeStorage --------------------------------------------------
        //
        // Electron's safeStorage kept the key in the OS credential store and
        // returned an opaque blob. The same shape is preserved by holding the
        // ciphertext in the keyring under a caller-supplied id, so the Node
        // services keep treating it as "encrypt to opaque string".
        "safeStorage:isAvailable" => Ok(json!(keyring_available())),
        "safeStorage:encryptString" => {
            let plaintext = first_str(0).ok_or("encryptString requires a value")?;
            let id = first_str(1).unwrap_or_else(|| "default".into());
            let entry = keyring::Entry::new(KEYRING_SERVICE, &id).map_err(|e| e.to_string())?;
            entry.set_password(&plaintext).map_err(|e| e.to_string())?;
            Ok(json!(format!("keyring:{id}")))
        }
        "safeStorage:decryptString" => {
            let blob = first_str(0).ok_or("decryptString requires a value")?;
            let id = blob.strip_prefix("keyring:").unwrap_or("default");
            let entry = keyring::Entry::new(KEYRING_SERVICE, id).map_err(|e| e.to_string())?;
            entry.get_password().map(Value::from).map_err(|e| e.to_string())
        }

        // ---- window / webContents ----------------------------------------
        "window:send" => {
            let event = first_str(0).ok_or("window:send requires an event name")?;
            let payload = args.get(1).cloned().unwrap_or(Value::Null);
            match app.get_webview_window("main") {
                Some(window) => window.emit(&event, payload).map_err(|e| e.to_string())?,
                None => app.emit(&event, payload).map_err(|e| e.to_string())?,
            }
            Ok(Value::Null)
        }
        "window:setSize" => {
            let width = args.get(0).and_then(Value::as_f64).unwrap_or(1400.0);
            let height = args.get(1).and_then(Value::as_f64).unwrap_or(900.0);
            if let Some(window) = app.get_webview_window("main") {
                window
                    .set_size(tauri::LogicalSize::new(width, height))
                    .map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        "window:show" => {
            if let Some(window) = app.get_webview_window("main") {
                window.show().map_err(|e| e.to_string())?;
                window.set_focus().map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }

        other => Err(format!("unknown host function: {other}")),
    }
}

fn keyring_available() -> bool {
    keyring::Entry::new(KEYRING_SERVICE, "__probe__").is_ok()
}
