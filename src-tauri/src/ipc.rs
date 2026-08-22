//! The single entry point for every renderer -> backend call.
//!
//! The old preload funnelled all 339 channels through one `ipcRenderer.invoke`
//! helper. This mirrors that exactly: one Tauri command, keyed by channel name.
//! A channel is served natively when `handlers::dispatch` claims it, and falls
//! through to the Node sidecar otherwise.
//!
//! Porting a channel from Node to Rust therefore means adding one match arm and
//! deleting one Node handler. The renderer never learns which side answered.

use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, State};

use crate::handlers;
use crate::sidecar::Sidecar;

/// Renderer-facing error. Carries the channel so a failure in one of 339 calls
/// is actually diagnosable from the console.
#[derive(Debug, serde::Serialize)]
pub struct IpcError {
    pub channel: String,
    pub message: String,
}

impl IpcError {
    pub fn new(channel: &str, message: impl Into<String>) -> Self {
        Self {
            channel: channel.to_string(),
            message: message.into(),
        }
    }
}

#[tauri::command]
pub async fn ipc_invoke(
    app: AppHandle,
    sidecar: State<'_, Arc<Sidecar>>,
    channel: String,
    args: Value,
) -> Result<Value, IpcError> {
    let args = match args {
        Value::Null => Value::Array(vec![]),
        Value::Array(items) => Value::Array(items),
        // Defensive: a caller that passed a bare value still gets argv shape.
        other => Value::Array(vec![other]),
    };

    // Native first. `None` means "not ported yet", which is not an error.
    if let Some(result) = handlers::dispatch(&app, &channel, &args).await {
        if let Err(error) = &result {
            log::warn!("ipc {channel} (rust) failed: {error}");
        } else {
            log::debug!("ipc {channel} -> rust");
        }
        return result.map_err(|e| IpcError::new(&channel, e));
    }

    log::debug!("ipc {channel} -> sidecar");
    sidecar.call(&channel, args).await.map_err(|e| {
        // Worth a warning: a failure here is either a missing handler or a dead
        // sidecar, and both are invisible from the renderer's side.
        log::warn!("ipc {channel} (sidecar) failed: {e}");
        IpcError::new(&channel, e)
    })
}

/// Reports which side currently answers a channel. Used by the dev overlay and
/// by `npm run migration:status` to track porting progress.
#[tauri::command]
pub fn ipc_backend_for(channel: String) -> &'static str {
    if handlers::is_native(&channel) {
        "rust"
    } else {
        "sidecar"
    }
}

#[tauri::command]
pub fn ipc_native_channels() -> Vec<&'static str> {
    handlers::native_channels()
}
