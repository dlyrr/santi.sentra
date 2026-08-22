//! The Roblox HTTP layer, ported from `src/main/lib/request.ts`.
//!
//! The original used Electron's `net` module and hand-rolled a redirect guard
//! that strips credential headers when a redirect crosses to another host. That
//! guard is the security-relevant part and is reproduced here exactly: reqwest
//! is put in `Policy::none()` mode so redirects are followed manually.

use std::time::Duration;

use once_cell::sync::Lazy;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::redirect::Policy;
use serde_json::{json, Value};

use super::arg;

const FETCH_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_REDIRECTS: usize = 10;
const MAX_BODY_BYTES: usize = 64 * 1024 * 1024;

/// Headers that must never survive a cross-host redirect.
const CREDENTIAL_HEADERS: &[&str] = &[
    "cookie",
    "authorization",
    "x-csrf-token",
    "x-bound-auth-token",
];

static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .redirect(Policy::none())
        .timeout(FETCH_TIMEOUT)
        .gzip(true)
        .build()
        .expect("failed to build http client")
});

/// Mirrors `isAllowedRobloxHost` from the TypeScript original.
pub fn is_allowed_roblox_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    host == "roblox.com"
        || host.ends_with(".roblox.com")
        || host.ends_with(".rbxcdn.com")
        || host.ends_with(".roblox.games")
}

pub async fn handle(channel: &str, args: &Value) -> Result<Value, String> {
    match channel {
        "roblox:fetch" => roblox_fetch(arg(args, 0)).await,
        "proxy:fetchFreeProxies" => fetch_free_proxies().await,
        other => Err(format!("unhandled http channel: {other}")),
    }
}

async fn roblox_fetch(options: Value) -> Result<Value, String> {
    let url = options
        .get("url")
        .and_then(Value::as_str)
        .ok_or("roblox:fetch requires a url")?
        .to_string();
    let method = options
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or("GET")
        .to_uppercase();

    let mut headers = HeaderMap::new();
    if let Some(map) = options.get("headers").and_then(Value::as_object) {
        for (key, value) in map {
            let Some(value) = value.as_str() else { continue };
            let (Ok(name), Ok(value)) = (
                key.parse::<HeaderName>(),
                HeaderValue::from_str(value),
            ) else {
                continue;
            };
            headers.insert(name, value);
        }
    }
    if let Some(cookie) = options.get("cookie").and_then(Value::as_str) {
        let value = format!(".ROBLOSECURITY={cookie}");
        if let Ok(value) = HeaderValue::from_str(&value) {
            headers.insert(reqwest::header::COOKIE, value);
        }
    }

    let body = options.get("body").cloned().filter(|b| !b.is_null());

    let mut current = url::Url::parse(&url).map_err(|e| format!("invalid url: {e}"))?;
    if current.scheme() != "https" {
        return Err("only https requests are permitted".into());
    }
    let mut origin_host = current.host_str().unwrap_or_default().to_string();
    if !is_allowed_roblox_host(&origin_host) {
        return Err(format!("blocked request to disallowed host: {origin_host}"));
    }

    for _ in 0..MAX_REDIRECTS {
        let mut request = CLIENT
            .request(
                method.parse().map_err(|_| format!("bad method: {method}"))?,
                current.clone(),
            )
            .headers(headers.clone());

        if let Some(body) = &body {
            request = request.json(body);
        }

        let response = request.send().await.map_err(|e| e.to_string())?;
        let status = response.status();

        if status.is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("redirect without a Location header")?;

            let target = current
                .join(location)
                .map_err(|e| format!("invalid redirect target: {e}"))?;

            let target_host = target.host_str().unwrap_or_default().to_string();
            if target.scheme() != "https" || !is_allowed_roblox_host(&target_host) {
                return Err(format!("blocked redirect to disallowed host: {target_host}"));
            }

            // Crossing hosts drops every credential header, exactly as the
            // Electron implementation did.
            if target_host != origin_host {
                for name in CREDENTIAL_HEADERS {
                    headers.remove(*name);
                }
                origin_host = target_host;
            }

            current = target;
            continue;
        }

        let response_headers: serde_json::Map<String, Value> = response
            .headers()
            .iter()
            .map(|(k, v)| {
                (
                    k.as_str().to_string(),
                    Value::String(v.to_str().unwrap_or_default().to_string()),
                )
            })
            .collect();

        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        if bytes.len() > MAX_BODY_BYTES {
            return Err("response exceeded the maximum allowed size".into());
        }
        let text = String::from_utf8_lossy(&bytes).into_owned();
        let parsed: Value = serde_json::from_str(&text).unwrap_or(Value::String(text));

        return Ok(json!({
            "status": status.as_u16(),
            "ok": status.is_success(),
            "headers": response_headers,
            "body": parsed,
        }));
    }

    Err("too many redirects".into())
}

/// Ported from `ModuleIpcHandlers.ts`. Tries each source in turn and returns
/// the first that yields anything.
async fn fetch_free_proxies() -> Result<Value, String> {
    let plain = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    // proxy-list.download returns {"LISTA": [..]}
    if let Ok(response) = plain
        .get("https://www.proxy-list.download/api/v1/get?type=http")
        .send()
        .await
    {
        if let Ok(json) = response.json::<Value>().await {
            let proxies: Vec<Value> = json
                .get("LISTA")
                .and_then(Value::as_array)
                .map(|list| list.iter().take(10).cloned().collect())
                .unwrap_or_default();
            if !proxies.is_empty() {
                return Ok(json!({ "success": true, "proxies": proxies }));
            }
        }
    }

    // proxyscrape returns newline-delimited host:port
    if let Ok(response) = plain
        .get("https://api.proxyscrape.com/v2/?request=getproxies&format=textplain&timeout=5000&ssl=all&anonymity=all")
        .send()
        .await
    {
        if let Ok(text) = response.text().await {
            let proxies: Vec<Value> = text
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .take(10)
                .map(|line| Value::String(line.to_string()))
                .collect();
            if !proxies.is_empty() {
                return Ok(json!({ "success": true, "proxies": proxies }));
            }
        }
    }

    Ok(json!({
        "success": false,
        "error": "No proxies available from any source",
        "proxies": [],
    }))
}
