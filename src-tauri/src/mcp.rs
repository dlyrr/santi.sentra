//! An MCP server, inside the running app.
//!
//! Not a headless copy of santi.manager's logic — a way into *this* process.
//! Every tool here goes through `ipc::route`, the same function the renderer's
//! clicks go through, so a tool call and a click cannot disagree about what a
//! channel does. It follows that the server only means anything while the app
//! is open, which is the point: it acts on the accounts and installs you can
//! see on screen.
//!
//! Two things are deliberately not exposed.
//!
//! Cookies never leave. `get-accounts` returns them and the MCP account list
//! strips them, because a `.ROBLOSECURITY` cookie *is* the account — anything
//! holding one can log in as you, and handing them to whatever client happens
//! to be connected would make this the least secure thing in the app. Launching
//! as an account therefore takes an account id and resolves the cookie in here,
//! where it stays.
//!
//! And the listener is bound to loopback behind a bearer token that is written
//! once per install. Loopback alone is not access control: anything running as
//! this user could otherwise drive the app, and "it is only localhost" is how
//! that gets excused.

use std::net::SocketAddr;
use std::sync::Arc;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use crate::ipc;
use crate::sidecar::Sidecar;

/// The protocol version this server speaks.
const PROTOCOL_VERSION: &str = "2024-11-05";

/// Loopback only. Port 0 would be tidier, but a port that moves every launch
/// means reconfiguring the client every launch.
const PORT: u16 = 45_872;

/// Anything larger than this is not a tool call.
const MAX_BODY: usize = 1024 * 1024;

pub struct McpServer {
    pub token: String,
    pub port: u16,
}

impl McpServer {
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}/mcp", self.port)
    }
}

/// The token, made once and kept beside the app's own data.
fn load_or_create_token(app: &AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data directory: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("mcp-token");

    if let Ok(existing) = std::fs::read_to_string(&path) {
        let existing = existing.trim().to_string();
        if existing.len() >= 32 {
            return Ok(existing);
        }
    }

    // 32 bytes of randomness from the OS, hex encoded. `getrandom` is already
    // in the tree by way of rustls.
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).map_err(|e| format!("no randomness available: {e}"))?;
    let token: String = bytes.iter().map(|b| format!("{b:02x}")).collect();

    std::fs::write(&path, &token).map_err(|e| e.to_string())?;
    Ok(token)
}

/// What the tools are, in the shape `tools/list` wants.
fn tool_definitions() -> Value {
    json!([
        {
            "name": "list_accounts",
            "description": "The accounts saved in santi.manager: id, username, display name and note. Cookies are never included.",
            "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false }
        },
        {
            "name": "list_versions",
            "description": "Roblox builds available to install, newest first, per binary type (WindowsPlayer, WindowsStudio64).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "refresh": { "type": "boolean", "description": "Ignore the 15-minute cache and ask Roblox again." }
                },
                "additionalProperties": false
            }
        },
        {
            "name": "install_version",
            "description": "Download and unpack a Roblox build. Takes several minutes and a few hundred megabytes. Every package is checksum-verified.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "binaryType": { "type": "string", "enum": ["WindowsPlayer", "WindowsStudio64"] },
                    "version": { "type": "string", "description": "A version-<16 hex> hash, or the bare hash." },
                    "installPath": { "type": "string", "description": "Where to put it. Defaults to the app's Versions folder." }
                },
                "required": ["binaryType", "version"],
                "additionalProperties": false
            }
        },
        {
            "name": "detect_installations",
            "description": "Roblox installations already present on this machine.",
            "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false }
        },
        {
            "name": "launch_roblox",
            "description": "Start Roblox from an installed build, signed out.",
            "inputSchema": {
                "type": "object",
                "properties": { "installPath": { "type": "string" } },
                "required": ["installPath"],
                "additionalProperties": false
            }
        },
        {
            "name": "launch_as_account",
            "description": "Start Roblox signed in as a saved account, optionally joining a place. The account's cookie is resolved inside the app and never returned.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "accountId": { "type": "string" },
                    "placeId": { "type": "string", "description": "Omit to just open the client." },
                    "installPath": { "type": "string" }
                },
                "required": ["accountId"],
                "additionalProperties": false
            }
        }
    ])
}

/// An account, with everything that could impersonate it removed.
fn redact_account(account: &Value) -> Value {
    json!({
        "id": account.get("id").cloned().unwrap_or(Value::Null),
        "username": account.get("username").cloned().unwrap_or(Value::Null),
        "displayName": account.get("displayName").cloned().unwrap_or(Value::Null),
        "userId": account.get("userId").cloned().unwrap_or(Value::Null),
        "note": account.get("note").cloned().unwrap_or(Value::Null),
    })
}

async fn accounts(app: &AppHandle, sidecar: &Arc<Sidecar>) -> Result<Vec<Value>, String> {
    let raw = ipc::route(app, sidecar, "get-accounts", json!([]))
        .await
        .map_err(|e| e.message)?;
    Ok(raw.as_array().cloned().unwrap_or_default())
}

async fn call_tool(
    app: &AppHandle,
    sidecar: &Arc<Sidecar>,
    name: &str,
    arguments: &Value,
) -> Result<Value, String> {
    let arg = |key: &str| arguments.get(key).cloned().unwrap_or(Value::Null);
    let arg_str = |key: &str| {
        arguments
            .get(key)
            .and_then(Value::as_str)
            .map(str::to_string)
    };

    match name {
        "list_accounts" => {
            let list = accounts(app, sidecar).await?;
            Ok(json!(list.iter().map(redact_account).collect::<Vec<_>>()))
        }

        "list_versions" => {
            let refresh = arg("refresh").as_bool().unwrap_or(false);
            ipc::route(app, sidecar, "get-deploy-history", json!([refresh]))
                .await
                .map_err(|e| e.message)
        }

        "install_version" => {
            let binary_type = arg_str("binaryType").ok_or("binaryType is required")?;
            let version = arg_str("version").ok_or("version is required")?;
            let path = arg("installPath");
            ipc::route(
                app,
                sidecar,
                "install-roblox-version",
                json!([binary_type, version, path]),
            )
            .await
            .map_err(|e| e.message)
        }

        "detect_installations" => ipc::route(app, sidecar, "detect-default-installations", json!([]))
            .await
            .map_err(|e| e.message),

        "launch_roblox" => {
            let path = arg_str("installPath").ok_or("installPath is required")?;
            ipc::route(app, sidecar, "launch-roblox-install", json!([path]))
                .await
                .map_err(|e| e.message)
        }

        "launch_as_account" => {
            let account_id = arg_str("accountId").ok_or("accountId is required")?;
            let list = accounts(app, sidecar).await?;
            let account = list
                .iter()
                .find(|a| a.get("id").and_then(Value::as_str) == Some(account_id.as_str()))
                .ok_or_else(|| format!("No saved account with id {account_id}"))?;

            // Read here, passed straight back into the app, never returned.
            let cookie = account
                .get("cookie")
                .and_then(Value::as_str)
                .ok_or("That account has no stored cookie")?;

            match arg_str("placeId") {
                Some(place) => ipc::route(
                    app,
                    sidecar,
                    "launch-game",
                    json!([cookie, place, Value::Null, Value::Null, arg("installPath")]),
                )
                .await
                .map_err(|e| e.message),
                None => {
                    let path = arg_str("installPath")
                        .ok_or("Either placeId or installPath is needed to start the client")?;
                    ipc::route(app, sidecar, "launch-roblox-install", json!([path]))
                        .await
                        .map_err(|e| e.message)
                }
            }
        }

        other => Err(format!("Unknown tool: {other}")),
    }
}

/// One JSON-RPC request in, one response out. `None` for notifications, which
/// take no reply.
async fn handle_rpc(
    app: &AppHandle,
    sidecar: &Arc<Sidecar>,
    request: &Value,
) -> Option<Value> {
    let id = request.get("id").cloned();
    let method = request.get("method").and_then(Value::as_str).unwrap_or("");
    let params = request.get("params").cloned().unwrap_or(Value::Null);

    // Notifications carry no id and expect nothing back.
    if id.is_none() {
        return None;
    }

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": "santi.manager", "version": env!("CARGO_PKG_VERSION") }
        })),

        "ping" => Ok(json!({})),

        "tools/list" => Ok(json!({ "tools": tool_definitions() })),

        "tools/call" => {
            let name = params.get("name").and_then(Value::as_str).unwrap_or("");
            let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

            match call_tool(app, sidecar, name, &arguments).await {
                Ok(value) => Ok(json!({
                    "content": [{
                        "type": "text",
                        "text": serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string())
                    }]
                })),
                // A tool that fails is a result, not a protocol error: the
                // client is meant to see the message and be able to react.
                Err(message) => Ok(json!({
                    "content": [{ "type": "text", "text": message }],
                    "isError": true
                })),
            }
        }

        other => Err(format!("Unknown method: {other}")),
    };

    Some(match result {
        Ok(value) => json!({ "jsonrpc": "2.0", "id": id, "result": value }),
        Err(message) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32601, "message": message }
        }),
    })
}

fn response(status: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

async fn serve_connection(
    mut stream: TcpStream,
    app: AppHandle,
    sidecar: Arc<Sidecar>,
    token: String,
) {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 8192];

    // Read until the headers are complete, then until the declared body is.
    let (head_end, content_length) = loop {
        match stream.read(&mut chunk).await {
            Ok(0) => return,
            Ok(n) => buffer.extend_from_slice(&chunk[..n]),
            Err(_) => return,
        }

        if buffer.len() > MAX_BODY {
            let _ = stream
                .write_all(response("413 Payload Too Large", "{}").as_bytes())
                .await;
            return;
        }

        if let Some(position) = buffer
            .windows(4)
            .position(|window| window == b"\r\n\r\n")
        {
            let head = String::from_utf8_lossy(&buffer[..position]).to_string();
            let length = head
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.trim()
                        .eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().ok())?
                })
                .unwrap_or(0);

            // Authorisation is checked before anything is parsed.
            let authorised = head.lines().any(|line| {
                let Some((name, value)) = line.split_once(':') else {
                    return false;
                };
                name.trim().eq_ignore_ascii_case("authorization")
                    && value.trim() == format!("Bearer {token}")
            });

            if !authorised {
                let _ = stream
                    .write_all(
                        response(
                            "401 Unauthorized",
                            r#"{"error":"a bearer token is required"}"#,
                        )
                        .as_bytes(),
                    )
                    .await;
                return;
            }

            break (position + 4, length);
        }
    };

    while buffer.len() < head_end + content_length {
        match stream.read(&mut chunk).await {
            Ok(0) => break,
            Ok(n) => buffer.extend_from_slice(&chunk[..n]),
            Err(_) => return,
        }
    }

    let body = String::from_utf8_lossy(&buffer[head_end..]).to_string();
    let Ok(request) = serde_json::from_str::<Value>(&body) else {
        let _ = stream
            .write_all(response("400 Bad Request", r#"{"error":"invalid json"}"#).as_bytes())
            .await;
        return;
    };

    // A client may batch requests into an array.
    let reply = match &request {
        Value::Array(items) => {
            let mut replies = Vec::new();
            for item in items {
                if let Some(reply) = handle_rpc(&app, &sidecar, item).await {
                    replies.push(reply);
                }
            }
            if replies.is_empty() {
                None
            } else {
                Some(Value::Array(replies))
            }
        }
        single => handle_rpc(&app, &sidecar, single).await,
    };

    let payload = match reply {
        Some(value) => value.to_string(),
        // A notification gets an acknowledgement and no body to speak of.
        None => "{}".to_string(),
    };

    let _ = stream
        .write_all(response("200 OK", &payload).as_bytes())
        .await;
}

/// Start listening. Failing to bind is not fatal to the app.
pub fn start(app: AppHandle, sidecar: Arc<Sidecar>) -> Option<McpServer> {
    let token = match load_or_create_token(&app) {
        Ok(token) => token,
        Err(error) => {
            log::warn!("mcp: no token, server not started: {error}");
            return None;
        }
    };

    let server = McpServer {
        token: token.clone(),
        port: PORT,
    };

    let addr = SocketAddr::from(([127, 0, 0, 1], PORT));

    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind(addr).await {
            Ok(listener) => listener,
            Err(error) => {
                // Almost always a second copy of the app already listening.
                log::warn!("mcp: could not bind {addr}: {error}");
                return;
            }
        };

        log::info!("mcp: listening on http://{addr}/mcp");

        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    let app = app.clone();
                    let sidecar = Arc::clone(&sidecar);
                    let token = token.clone();
                    tauri::async_runtime::spawn(serve_connection(stream, app, sidecar, token));
                }
                Err(error) => {
                    log::warn!("mcp: accept failed: {error}");
                }
            }
        }
    });

    Some(server)
}
