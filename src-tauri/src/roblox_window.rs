//! The Roblox login and account-browser windows.
//!
//! These are the two places the old Electron code opened a second browser
//! window: one to let a user sign in so the `.ROBLOSECURITY` cookie can be
//! harvested, and one to open an authenticated session for a saved account.
//!
//! Electron did this with `BrowserWindow` + `BrowserView` on a named session
//! partition, and learned about the cookie through a `cookies.on("changed")`
//! event. Tauri has no cookie-change event, so the login flow polls the
//! webview's cookie store instead; the isolation that `partition` gave is
//! reproduced with a dedicated `data_directory` per window.
//!
//! Layering note: these are host functions, not IPC channels. Resolving an
//! account to a cookie needs StorageService, which lives in the Node sidecar,
//! so the sidecar stays in charge of *which* account and Rust is only in charge
//! of *the window*.

use std::path::PathBuf;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::webview::Cookie;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::time::{sleep, Instant};
use url::Url;

const LOGIN_LABEL: &str = "roblox-login";
const BROWSER_LABEL_PREFIX: &str = "roblox-browser";
const LOGIN_URL: &str = "https://www.roblox.com/login";
const ROBLOX_ORIGIN: &str = "https://www.roblox.com";
const SECURITY_COOKIE: &str = ".ROBLOSECURITY";

/// How often the login window's cookie store is checked. Roblox sets the cookie
/// once, on a redirect, so a sub-second poll reads as instant without spinning.
const POLL_INTERVAL: Duration = Duration::from_millis(400);

/// Gives up on a login the user has walked away from. Long enough for 2FA,
/// email verification and a captcha.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// How many consecutive cookie reads may fail before the window is treated as
/// broken. A webview whose message channel has died leaves the window on screen
/// but answers nothing, and without this the poll would spin against it until
/// the timeout.
const MAX_COOKIE_READ_FAILURES: u32 = 25;

pub async fn handle(app: &AppHandle, host_fn: &str, args: Value) -> Result<Value, String> {
    let options = args.get(0).cloned().unwrap_or(Value::Null);
    match host_fn {
        "roblox:open-login" => open_login(app, &options).await,
        "roblox:open-browser" => open_browser(app, &options).await,
        other => Err(format!("unknown roblox window function: {other}")),
    }
}

fn string_opt(options: &Value, key: &str) -> Option<String> {
    options
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn size(options: &Value, key: &str, fallback: f64) -> f64 {
    options
        .get(key)
        .and_then(Value::as_f64)
        .filter(|value| *value > 0.0)
        .unwrap_or(fallback)
}

/// Short unique suffix for a one-shot session directory and window label.
fn short_id() -> String {
    uuid::Uuid::new_v4().to_string()[..8].to_string()
}

/// A per-window data directory, standing in for Electron's session partition.
/// Keeping the login window's cookies out of the main webview's store is the
/// point: the app must never inherit a half-finished login.
fn session_dir(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("could not resolve the app data directory: {e}"))?;
    Ok(base.join("sessions").join(name))
}

/// Sweeps session directories left behind by previous runs.
///
/// Reusing one fixed directory does not work: WebView2 holds a lock on its user
/// data folder for as long as any process is attached, and lingers briefly
/// after a window closes. Deleting it then fails with "used by another
/// process", and creating a webview against the locked folder fails silently —
/// the window appears to build, then its message channel dies and every cookie
/// read panics inside wry.
///
/// So each attempt gets its own directory, and old ones are swept here on a
/// best-effort basis. Anything still locked is simply skipped and collected on
/// a later run.
fn sweep_old_sessions(app: &AppHandle, prefix: &str) {
    let Ok(base) = app.path().app_local_data_dir().map(|b| b.join("sessions")) else {
        return;
    };
    let Ok(entries) = std::fs::read_dir(&base) else {
        return;
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.starts_with(prefix) {
            continue;
        }
        // Locked directories belong to a window that is still open; leave them.
        let _ = std::fs::remove_dir_all(entry.path());
    }
}

/// Harvests `.ROBLOSECURITY` by letting the user sign in to Roblox.
///
/// Resolves with the cookie value, or fails with `LOGIN_WINDOW_CLOSED` if the
/// user closes the window first — the same contract the renderer already
/// handles, so the calling UI is unchanged.
async fn open_login(app: &AppHandle, options: &Value) -> Result<Value, String> {
    if let Some(existing) = app.get_webview_window(LOGIN_LABEL) {
        // Surfacing the window the user already has beats stacking a second one
        // that would race it for the same cookie.
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Err("A Roblox login window is already open.".into());
    }

    // A fresh directory per attempt, so a previous sign-in can never be
    // mistaken for a new one — the guarantee Electron got by clearing the
    // cookie from its named partition.
    sweep_old_sessions(app, "roblox-login-");
    let dir = session_dir(app, &format!("roblox-login-{}", short_id()))?;

    let url = Url::parse(LOGIN_URL).map_err(|e| e.to_string())?;
    let mut builder = WebviewWindowBuilder::new(app, LOGIN_LABEL, WebviewUrl::External(url))
        .title("Roblox Login")
        .inner_size(480.0, 720.0)
        .min_inner_size(400.0, 560.0)
        .data_directory(dir)
        .center();

    if let Some(user_agent) = string_opt(options, "userAgent") {
        builder = builder.user_agent(&user_agent);
    }

    builder
        .build()
        .map_err(|e| format!("failed to open the Roblox login window: {e}"))?;

    let deadline = Instant::now() + LOGIN_TIMEOUT;
    let origin = Url::parse(ROBLOX_ORIGIN).map_err(|e| e.to_string())?;
    let mut failures = 0u32;

    loop {
        sleep(POLL_INTERVAL).await;

        // The window disappearing is how the user says "cancel".
        let Some(window) = app.get_webview_window(LOGIN_LABEL) else {
            return Err("LOGIN_WINDOW_CLOSED".into());
        };

        if Instant::now() >= deadline {
            let _ = window.close();
            return Err("LOGIN_WINDOW_TIMEOUT".into());
        }

        match read_security_cookie(&window, &origin).await {
            CookieRead::Found(value) => {
                let _ = window.close();
                return Ok(json!(value));
            }
            CookieRead::Absent => failures = 0,
            CookieRead::Unreadable => {
                failures += 1;
                if failures >= MAX_COOKIE_READ_FAILURES {
                    let _ = window.close();
                    return Err(
                        "The Roblox login window stopped responding before a                          cookie could be read."
                            .into(),
                    );
                }
            }
        }
    }
}

/// Opens an authenticated Roblox session for an account that is already saved.
///
/// The cookie is injected before navigating, so the first request is already
/// signed in and the user never sees a logged-out frame.
async fn open_browser(app: &AppHandle, options: &Value) -> Result<Value, String> {
    let cookie_value =
        string_opt(options, "cookie").ok_or("open-browser requires an account cookie")?;
    let target = string_opt(options, "url").unwrap_or_else(|| format!("{ROBLOX_ORIGIN}/home"));

    let target_url = Url::parse(&target).map_err(|e| format!("invalid url: {e}"))?;
    let host = target_url.host_str().unwrap_or_default().to_string();
    if target_url.scheme() != "https" || !crate::handlers::http::is_allowed_roblox_host(&host) {
        // The cookie is injected into this window; sending it anywhere but
        // Roblox would hand an account session to a third party.
        return Err(format!("refusing to open a non-Roblox url: {target}"));
    }

    // A unique label and directory per window, so two accounts opened at once
    // never share a cookie jar and log each other out.
    sweep_old_sessions(app, "account-browser-");
    let suffix = short_id();
    let label = format!("{BROWSER_LABEL_PREFIX}-{suffix}");
    let dir = session_dir(app, &format!("account-browser-{suffix}"))?;

    // Start blank: the cookie has to be in place before Roblox is requested,
    // and a webview must exist before a cookie can be set on it.
    let blank = Url::parse("about:blank").map_err(|e| e.to_string())?;
    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(blank))
        .title("Roblox")
        .inner_size(size(options, "width", 1280.0), size(options, "height", 800.0))
        .data_directory(dir)
        .center();

    if let Some(user_agent) = string_opt(options, "userAgent") {
        builder = builder.user_agent(&user_agent);
    }

    let window = builder
        .build()
        .map_err(|e| format!("failed to open the Roblox browser window: {e}"))?;

    let mut cookie = Cookie::new(SECURITY_COOKIE, cookie_value);
    cookie.set_domain(".roblox.com");
    cookie.set_path("/");
    cookie.set_secure(true);
    cookie.set_http_only(true);

    if let Err(error) = window.set_cookie(cookie) {
        let _ = window.close();
        return Err(format!("failed to authenticate the browser window: {error}"));
    }

    window
        .navigate(target_url)
        .map_err(|e| format!("failed to open {target}: {e}"))?;

    Ok(Value::Null)
}

enum CookieRead {
    Found(String),
    /// Read fine; the user has not signed in yet.
    Absent,
    /// The webview did not answer.
    Unreadable,
}

/// Reads `.ROBLOSECURITY` off the webview.
///
/// Run on a blocking thread deliberately, for two reasons. On Windows this call
/// deadlocks if it runs on the main thread or inside an event handler, because
/// it round trips through the WebView2 message loop. And wry answers a dead
/// webview by dropping the reply channel and calling `unwrap` on the receive,
/// so a read against a broken webview panics; `spawn_blocking` contains that
/// panic instead of letting it take the process down.
async fn read_security_cookie(window: &WebviewWindow, origin: &Url) -> CookieRead {
    let window = window.clone();
    let origin = origin.clone();

    let joined = tokio::task::spawn_blocking(move || window.cookies_for_url(origin)).await;

    let cookies = match joined {
        Ok(Ok(cookies)) => cookies,
        Ok(Err(error)) => {
            log::trace!("cookie read failed (will retry): {error}");
            return CookieRead::Unreadable;
        }
        Err(_) => {
            // The panic described above. Nothing to log per attempt; the caller
            // gives up after enough of them.
            return CookieRead::Unreadable;
        }
    };

    cookies
        .iter()
        .find(|cookie| cookie.name() == SECURITY_COOKIE)
        .map(|cookie| cookie.value().to_string())
        .filter(|value| !value.is_empty())
        .map_or(CookieRead::Absent, CookieRead::Found)
}
