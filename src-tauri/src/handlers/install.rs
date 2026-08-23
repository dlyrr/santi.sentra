//! Installing Roblox builds.
//!
//! The work itself lives in the `roblox-deploy` crate, shared with
//! santi.weblauncher — both apps fetch the same builds from the same CDN, and
//! keeping an implementation each is how they drifted apart. What stays here is
//! the wiring: the channels the renderer already calls, the progress payload it
//! already listens for, and the version list it already renders.
//!
//! This used to run in the Node sidecar. Moving it native removes a process hop
//! from the longest-running operation in the app, and brings with it the two
//! things the Rust side was missing — package checksums, and streaming rather
//! than holding whole packages in memory.

use std::path::PathBuf;
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;
use roblox_deploy::{
    deploy_history, install, is_installed, is_version_hash, normalize_version, resolve_version,
    BinaryType,
};
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use super::{arg, arg_str};

/// Downloads follow redirects and take as long as they take, so this is not the
/// locked-down client the Roblox API calls use.
static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("santi.manager")
        .build()
        .expect("failed to build the deployment http client")
});

/// The same fifteen minutes the TypeScript version cached for. Fetching this is
/// several requests and a text file of some size; a version list does not go
/// stale inside a quarter of an hour.
const CACHE_TTL: Duration = Duration::from_secs(15 * 60);

static HISTORY_CACHE: Lazy<Mutex<Option<(Instant, Value)>>> = Lazy::new(|| Mutex::new(None));

/// Where a build lands when the caller does not say.
///
/// `%APPDATA%\sentra\Versions\<type>-<version>`, matching what the sidecar used
/// so that installs made by older builds are still found.
fn default_install_dir(binary_type: BinaryType, version: &str) -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA is not set".to_string())?;
    Ok(PathBuf::from(appdata)
        .join("sentra")
        .join("Versions")
        .join(format!("{}-{}", binary_type.as_str(), version)))
}

/// Every version worth offering, per binary type.
///
/// The channels are the two the app has always looked at. Past builds come from
/// the deploy history, which is the only public record of them — the
/// client-version endpoint knows nothing but what is current.
async fn history() -> Value {
    let mut out = Map::new();

    for binary_type in [BinaryType::WindowsPlayer, BinaryType::WindowsStudio64] {
        let mut versions: Vec<String> = Vec::new();

        for channel in ["live", "zflag"] {
            if let Ok(info) = resolve_version(&CLIENT, binary_type, channel).await {
                // `version` is the client version — 0.734.0.7340917 — and is not
                // what any CDN path is built from. The deployment hash, which is,
                // comes back under clientVersionUpload.
                let hash = normalize_version(&info.client_version_upload);
                if is_version_hash(&hash) && !versions.contains(&hash) {
                    versions.push(hash);
                }
            }
        }

        // Additive, and failure here is not fatal: the current builds above are
        // enough to install with, and the history is a convenience.
        if let Ok(past) = deploy_history(&CLIENT, binary_type, "live").await {
            for version in past {
                if !versions.contains(&version) {
                    versions.push(version);
                }
            }
        }

        out.insert(binary_type.as_str().to_string(), json!(versions));
    }

    // The renderer indexes these by name; a Mac key with nothing behind it is
    // honest on a Windows-only build, and keeps the shape it expects.
    out.insert("MacPlayer".into(), json!([]));
    out.insert("MacStudio".into(), json!([]));

    Value::Object(out)
}

async fn get_deploy_history(force: bool) -> Result<Value, String> {
    let mut cache = HISTORY_CACHE.lock().await;

    if !force {
        if let Some((fetched, value)) = cache.as_ref() {
            if fetched.elapsed() < CACHE_TTL {
                return Ok(value.clone());
            }
        }
    }

    let fresh = history().await;
    *cache = Some((Instant::now(), fresh.clone()));
    Ok(fresh)
}

async fn install_version(app: &AppHandle, args: &Value) -> Result<Value, String> {
    let raw_type = arg_str(args, 0).unwrap_or_default();
    let binary_type = BinaryType::parse(&raw_type)
        .ok_or_else(|| format!("Unknown binary type \"{raw_type}\""))?;

    let version = arg_str(args, 1).ok_or("No version given")?;
    let version = normalize_version(&version);

    let install_dir = match arg_str(args, 2).filter(|p| !p.trim().is_empty()) {
        Some(path) => PathBuf::from(path),
        None => default_install_dir(binary_type, &version)?,
    };

    let emitter = app.clone();
    let result = install(
        CLIENT.clone(),
        binary_type,
        "LIVE",
        &version,
        &install_dir,
        move |progress| {
            // The renderer has always been handed {status, progress, detail},
            // where progress is a percentage. Keep it that way.
            let percent = if progress.total > 0 {
                (progress.completed as f64 / progress.total as f64) * 100.0
            } else if progress.phase == "done" {
                100.0
            } else {
                0.0
            };

            let status = match progress.phase.as_str() {
                "manifest" => "Reading manifest",
                "downloading" => "Downloading",
                "finalising" => "Finalising",
                "done" => "Done",
                other => other,
            };

            let _ = emitter.emit(
                "install-progress",
                json!({
                    "status": status,
                    "progress": percent,
                    "detail": progress.message,
                }),
            );
        },
    )
    .await;

    match result {
        Ok(()) => {
            if !is_installed(&install_dir, binary_type) {
                return Err(format!(
                    "The install finished but {} is not there",
                    binary_type.executable()
                ));
            }
            Ok(json!(install_dir.to_string_lossy()))
        }
        Err(err) => Err(format!("{err:#}")),
    }
}

/// Is there a newer build than the one this installation is pinned to?
///
/// "Newer" means "not the one the channel currently serves" — Roblox version
/// hashes carry no ordering, so there is nothing to compare but identity.
async fn check_for_updates(args: &Value) -> Result<Value, String> {
    let raw_type = arg_str(args, 0).unwrap_or_default();
    let current = arg_str(args, 1).unwrap_or_default();

    let history = get_deploy_history(true).await?;
    let versions = history
        .get(&raw_type)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("No version history found for {raw_type}"))?;

    let latest = versions
        .first()
        .and_then(Value::as_str)
        .ok_or_else(|| format!("No version history found for {raw_type}"))?;

    Ok(json!({
        "hasUpdate": latest != normalize_version(&current),
        "latestVersion": latest,
    }))
}

pub async fn handle(app: &AppHandle, channel: &str, args: &Value) -> Result<Value, String> {
    match channel {
        "get-deploy-history" => {
            let force = arg(args, 0).as_bool().unwrap_or(false);
            get_deploy_history(force).await
        }
        "install-roblox-version" => install_version(app, args).await,

        // Repairing an install is installing it again over the top: the same
        // download, the same checksums, the same extraction. It answers with a
        // boolean rather than the path.
        "verify-roblox-files" => install_version(app, args).await.map(|_| json!(true)),

        "check-for-updates" => check_for_updates(args).await,
        other => Err(format!("install handler got an unexpected channel: {other}")),
    }
}
