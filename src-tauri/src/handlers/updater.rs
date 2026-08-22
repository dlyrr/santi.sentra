//! Auto-update, on `tauri-plugin-updater`.
//!
//! Replaces `electron-updater`, whose Node shim was deliberately inert. The
//! four channels and the `updater:status` push event keep exactly the shape the
//! existing UI already consumes (see `src/shared/ipc-schemas/updater.ts`), so
//! the settings card and the update prompt talk to the same contract as before.
//!
//! Nothing here shows UI of its own. Deciding whether to install is the app's
//! job, in the app's own prompt — no native dialog, no webview `confirm()`.

use std::sync::Arc;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;
use tokio::sync::Mutex;

/// The most recent update the checker found, kept so `updater:download` and
/// `updater:install` can act on it without checking again. The plugin's
/// `Update` handle is what actually knows how to fetch and install.
#[derive(Default)]
pub struct UpdaterState {
    pending: Mutex<Option<tauri_plugin_updater::Update>>,
    /// Kept between download and install so confirming does not re-download.
    downloaded: Mutex<Option<Vec<u8>>>,
    last: Mutex<Value>,
}

impl UpdaterState {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(None),
            downloaded: Mutex::new(None),
            last: Mutex::new(idle()),
        }
    }
}

fn idle() -> Value {
    json!({ "status": "idle", "info": null, "progress": null, "error": null })
}

fn state(status: &str, info: Value, progress: Value, error: Value) -> Value {
    json!({ "status": status, "info": info, "progress": progress, "error": error })
}

/// Publishes a state change to the renderer and remembers it, so a view that
/// mounts late can ask `updater:get-state` and catch up.
async fn publish(app: &AppHandle, value: Value) -> Value {
    let store = app.state::<Arc<UpdaterState>>();
    *store.last.lock().await = value.clone();

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("updater:status", value.clone());
    } else {
        let _ = app.emit("updater:status", value.clone());
    }
    value
}

pub async fn handle(app: &AppHandle, channel: &str, _args: &Value) -> Result<Value, String> {
    match channel {
        "updater:check" => check(app).await,
        "updater:download" => download(app).await,
        "updater:install" => install(app).await,
        "updater:get-state" => {
            let store = app.state::<Arc<UpdaterState>>();
            let last = store.last.lock().await.clone();
            Ok(last)
        }
        other => Err(format!("unhandled updater channel: {other}")),
    }
}

async fn check(app: &AppHandle) -> Result<Value, String> {
    publish(app, state("checking", Value::Null, Value::Null, Value::Null)).await;

    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => {
            // Most often this is an unsigned or endpoint-less dev build. It is
            // not a crash, but it must not look like "you are up to date".
            let message = format!("Updater unavailable: {error}");
            return Ok(publish(
                app,
                state("error", Value::Null, Value::Null, json!(message)),
            )
            .await);
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let info = json!({
                "version": update.version,
                "releaseDate": update.date.map(|d| d.to_string()),
                "releaseNotes": update.body,
            });

            let store = app.state::<Arc<UpdaterState>>();
            *store.pending.lock().await = Some(update);

            Ok(publish(app, state("available", info, Value::Null, Value::Null)).await)
        }
        Ok(None) => Ok(publish(
            app,
            state("not-available", Value::Null, Value::Null, Value::Null),
        )
        .await),
        Err(error) => Ok(publish(
            app,
            state("error", Value::Null, Value::Null, json!(error.to_string())),
        )
        .await),
    }
}

/// Downloads the pending update, reporting progress in the shape the existing
/// UI already renders.
async fn download(app: &AppHandle) -> Result<Value, String> {
    let store = app.state::<Arc<UpdaterState>>();
    let update = store.pending.lock().await.clone();

    let Some(update) = update else {
        return Err("No update is pending; check for updates first.".into());
    };

    let info = json!({
        "version": update.version,
        "releaseDate": update.date.map(|d| d.to_string()),
        "releaseNotes": update.body.clone(),
    });

    publish(
        app,
        state("downloading", info.clone(), Value::Null, Value::Null),
    )
    .await;

    let app_for_progress = app.clone();
    let info_for_progress = info.clone();
    let mut downloaded: u64 = 0;

    let bytes = update
        .download(
            move |chunk, total| {
                downloaded += chunk as u64;
                let total = total.unwrap_or(0);
                let percent = if total > 0 {
                    (downloaded as f64 / total as f64) * 100.0
                } else {
                    0.0
                };
                let progress = json!({
                    "total": total,
                    "delta": chunk,
                    "transferred": downloaded,
                    "percent": percent,
                    // The plugin does not expose a rate; the UI treats 0 as
                    // "unknown" rather than showing a bogus speed.
                    "bytesPerSecond": 0,
                });
                let app = app_for_progress.clone();
                let info = info_for_progress.clone();
                tauri::async_runtime::spawn(async move {
                    publish(&app, state("downloading", info, progress, Value::Null)).await;
                });
            },
            || {},
        )
        .await;

    match bytes {
        Ok(bytes) => {
            // Hold the bytes for the install step so the user is not made to
            // download twice after confirming.
            let store = app.state::<Arc<UpdaterState>>();
            *store.downloaded.lock().await = Some(bytes);
            publish(app, state("downloaded", info, Value::Null, Value::Null)).await;
            Ok(json!({ "success": true }))
        }
        Err(error) => {
            publish(
                app,
                state("error", info, Value::Null, json!(error.to_string())),
            )
            .await;
            Ok(json!({ "success": false }))
        }
    }
}

/// Installs what was downloaded and restarts. Does not return on success.
async fn install(app: &AppHandle) -> Result<Value, String> {
    let store = app.state::<Arc<UpdaterState>>();

    let update = store.pending.lock().await.clone();
    let bytes = store.downloaded.lock().await.take();

    let (Some(update), Some(bytes)) = (update, bytes) else {
        return Err("No downloaded update to install.".into());
    };

    if let Err(error) = update.install(bytes) {
        publish(
            app,
            state("error", Value::Null, Value::Null, json!(error.to_string())),
        )
        .await;
        return Ok(json!({ "success": false }));
    }

    // The installer takes over from here; restart so it can replace the files.
    app.restart();
}
