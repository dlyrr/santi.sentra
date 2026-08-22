//! Supervises the Node sidecar and speaks newline-delimited JSON to it.
//!
//! The sidecar hosts the parts of the old Electron main process that are not
//! worth rewriting in Rust yet: the koffi FFI multi-instance work, the
//! Playwright automation, and the binary `.rbxm` reader. Everything else is
//! handled natively and never reaches this transport.
//!
//! Four message shapes cross the pipe:
//!
//!   Rust -> Node   {"id": "..", "channel": "get-settings", "args": [..]}
//!   Node -> Rust   {"id": "..", "ok": true,  "result": ..}
//!                  {"id": "..", "ok": false, "error": ".."}
//!   Node -> Rust   {"event": "install-progress", "payload": ..}      (push)
//!   Node -> Rust   {"rid": "..", "host": "dialog:open", "args": [..]} (reverse)
//!
//! The reverse call is what lets the Node-side `electron` shim reach Tauri for
//! dialogs, shell opens and window control without linking Electron.

use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Result};
use dashmap::DashMap;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

use crate::host;

/// How long a single sidecar call may take before it is abandoned. Generous,
/// because some channels drive a real browser or a multi-gigabyte download.
const CALL_TIMEOUT: Duration = Duration::from_secs(600);

type Pending = Arc<DashMap<String, oneshot::Sender<Result<Value, String>>>>;

pub struct Sidecar {
    stdin: Mutex<Option<ChildStdin>>,
    pending: Pending,
    child: Mutex<Option<Child>>,
}

impl Sidecar {
    pub fn new() -> Self {
        Self {
            stdin: Mutex::new(None),
            pending: Arc::new(DashMap::new()),
            child: Mutex::new(None),
        }
    }

    /// Spawns the sidecar and starts pumping its stdout. Called once at
    /// startup; the reader task lives for the life of the app.
    pub async fn start(&self, app: AppHandle) -> Result<()> {
        let exe = sidecar_path(&app)?;
        log::info!("starting sidecar: {}", exe.display());

        let mut command = Command::new(&exe);

        // The sidecar binary is the Node runtime, which is a console-subsystem
        // executable: spawning it pops a black terminal window next to the app.
        // CREATE_NO_WINDOW suppresses that without detaching the pipes we talk
        // over.
        #[cfg(windows)]
        {
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        // Several Node services read `process.resourcesPath` at module load to
        // locate the bundled catalog database and icons. That is an Electron
        // property, so the Tauri resource directory is handed over here.
        if let Ok(resources) = app.path().resource_dir() {
            command.env("SENTRA_RESOURCES", resources);
        }
        // The shipped binary is the Node runtime itself, so the bundle is handed
        // over as argv[1].
        let script = sidecar_script(&app, &exe)?;
        command.arg(strip_verbatim(&script));

        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| anyhow!("failed to spawn sidecar {}: {e}", exe.display()))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("sidecar stdout unavailable"))?;
        let stderr = child.stderr.take();
        *self.stdin.lock().await = child.stdin.take();
        *self.child.lock().await = Some(child);

        // Surface sidecar logs instead of letting them vanish into the pipe.
        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    log::warn!("[sidecar] {line}");
                }
            });
        }

        let pending = self.pending.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let line = line.trim().to_string();
                if line.is_empty() {
                    continue;
                }
                let msg: Value = match serde_json::from_str(&line) {
                    Ok(v) => v,
                    Err(_) => {
                        // Anything not framed as JSON is a stray console write
                        // from a dependency; treat it as a log line.
                        log::debug!("[sidecar] {line}");
                        continue;
                    }
                };
                dispatch(&app, &pending, msg).await;
            }
            log::error!("sidecar stdout closed; backend calls will now fail");
        });

        Ok(())
    }

    /// Forwards one channel call to the sidecar and waits for its reply.
    pub async fn call(&self, channel: &str, args: Value) -> Result<Value, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        self.pending.insert(id.clone(), tx);

        let frame = json!({ "id": id, "channel": channel, "args": args });
        if let Err(e) = self.write(&frame).await {
            self.pending.remove(&id);
            return Err(format!("sidecar unavailable: {e}"));
        }

        match tokio::time::timeout(CALL_TIMEOUT, rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(format!("sidecar dropped the reply for {channel}")),
            Err(_) => {
                self.pending.remove(&id);
                Err(format!("sidecar call timed out: {channel}"))
            }
        }
    }

    async fn write(&self, frame: &Value) -> Result<()> {
        let mut guard = self.stdin.lock().await;
        let stdin = guard
            .as_mut()
            .ok_or_else(|| anyhow!("sidecar is not running"))?;
        let mut line = serde_json::to_vec(frame)?;
        line.push(b'\n');
        stdin.write_all(&line).await?;
        stdin.flush().await?;
        Ok(())
    }

    pub async fn shutdown(&self) {
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.kill().await;
        }
    }
}

/// Routes one inbound sidecar frame: a reply, a push event, or a reverse call.
async fn dispatch(app: &AppHandle, pending: &Pending, msg: Value) {
    // A reply to something we asked for.
    if let Some(id) = msg.get("id").and_then(Value::as_str) {
        if let Some((_, tx)) = pending.remove(id) {
            let result = if msg.get("ok").and_then(Value::as_bool).unwrap_or(false) {
                Ok(msg.get("result").cloned().unwrap_or(Value::Null))
            } else {
                Err(msg
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("sidecar call failed")
                    .to_string())
            };
            let _ = tx.send(result);
        }
        return;
    }

    // A push event for the renderer, standing in for the old
    // mainWindow.webContents.send(..).
    if let Some(event) = msg.get("event").and_then(Value::as_str) {
        let payload = msg.get("payload").cloned().unwrap_or(Value::Null);
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit(event, payload);
        } else {
            let _ = app.emit(event, payload);
        }
        return;
    }

    // A reverse call: the Node-side electron shim needs something only Tauri
    // can do. Answer it on a task so a slow dialog cannot stall the read loop.
    if let (Some(rid), Some(host_fn)) = (
        msg.get("rid").and_then(Value::as_str),
        msg.get("host").and_then(Value::as_str),
    ) {
        let rid = rid.to_string();
        let host_fn = host_fn.to_string();
        let args = msg.get("args").cloned().unwrap_or(Value::Null);
        let app = app.clone();
        tokio::spawn(async move {
            let reply = match host::handle(&app, &host_fn, args).await {
                Ok(result) => json!({ "rid": rid, "ok": true, "result": result }),
                Err(error) => json!({ "rid": rid, "ok": false, "error": error }),
            };
            let state = app.state::<Arc<Sidecar>>();
            let _ = state.write(&reply).await;
        });
    }
}

/// Resolves the bundled sidecar binary, falling back to the dev build tree.
fn sidecar_path(app: &AppHandle) -> Result<std::path::PathBuf> {
    let name = if cfg!(windows) {
        "sentra-sidecar.exe"
    } else {
        "sentra-sidecar"
    };

    if let Ok(dir) = app.path().resource_dir() {
        let bundled = dir.join(name);
        if bundled.exists() {
            return Ok(bundled);
        }
    }

    // `npm run dev` leaves the sidecar next to the crate rather than in a
    // bundle, so look there before giving up.
    let cwd = std::env::current_dir()?;
    for candidate in [
        cwd.join("src-tauri").join("binaries").join(name),
        cwd.join("binaries").join(name),
    ] {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(anyhow!(
        "sidecar binary '{name}' not found; run `npm run build:sidecar`"
    ))
}

/// Drops Windows' `\\?\` extended-length prefix.
///
/// Tauri hands back verbatim paths, and Node cannot resolve one as a main
/// module: it fails with `EISDIR: illegal operation on a directory, lstat 'C:'`
/// because the prefix defeats its path parsing.
fn strip_verbatim(path: &std::path::Path) -> std::path::PathBuf {
    let text = path.to_string_lossy();
    match text.strip_prefix(r"\\?\") {
        Some(stripped) if !stripped.starts_with("UNC\\") => {
            std::path::PathBuf::from(stripped)
        }
        _ => path.to_path_buf(),
    }
}

/// Locates the sidecar bundle.
///
/// This is resolved separately from the binary because Tauri copies an
/// `externalBin` next to the executable but ships everything else into the
/// resource directory. The bundle also has to sit beside its `node_modules`,
/// since the externalised native addons (koffi, better-sqlite3) are resolved
/// relative to the script.
fn sidecar_script(app: &AppHandle, exe: &std::path::Path) -> Result<std::path::PathBuf> {
    let mut candidates = vec![exe.with_file_name("sidecar.cjs")];

    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("sidecar.cjs"));
        candidates.push(dir.join("binaries").join("sidecar.cjs"));
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri").join("binaries").join("sidecar.cjs"));
        candidates.push(cwd.join("binaries").join("sidecar.cjs"));
    }

    // `cargo run` from src-tauri leaves the build output several levels below
    // the crate root; walk back up to the checked-in binaries directory.
    if let Some(crate_dir) = exe.ancestors().nth(3) {
        candidates.push(crate_dir.join("binaries").join("sidecar.cjs"));
    }

    candidates
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| anyhow!("sidecar.cjs not found; run `npm run build:sidecar`"))
}
