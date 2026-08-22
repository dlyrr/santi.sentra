//! Sentra's Tauri shell.
//!
//! Replaces the Electron main process. The renderer is unchanged: it still
//! calls `window.api.*`, which still funnels through a single invoke helper —
//! that helper now targets `ipc_invoke` here instead of `ipcRenderer`.

pub mod handlers;
pub mod host;
pub mod ipc;
pub mod roblox_window;
pub mod sidecar;

use std::sync::Arc;

use tauri::{Manager, RunEvent};

use sidecar::Sidecar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Sidecar stderr and transport failures are logged through `log`; without a
    // logger installed they would be silently dropped.
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    )
    .init();

    let sidecar = Arc::new(Sidecar::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(sidecar.clone())
        .invoke_handler(tauri::generate_handler![
            ipc::ipc_invoke,
            ipc::ipc_backend_for,
            ipc::ipc_native_channels,
        ])
        // The window is configured hidden so it never flashes an unpainted
        // frame. This is the Tauri equivalent of Electron's `ready-to-show`.
        //
        // Note `webview.window()`: `Webview::show()` shows the *webview*, not
        // the window containing it. Calling it here compiles and does nothing
        // useful, leaving the app running with no visible window.
        .on_page_load(|webview, _payload| {
            if webview.label() == "main" {
                let window = webview.window();
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .setup(move |app| {
            let handle = app.handle().clone();
            let sidecar = sidecar.clone();

            // The window starts hidden so the renderer can paint before it is
            // shown, which is what `ready-to-show` bought us under Electron.
            tauri::async_runtime::spawn(async move {
                if let Err(error) = sidecar.start(handle.clone()).await {
                    log::error!("sidecar failed to start: {error:#}");
                    // The app is still useful for anything served natively, so
                    // surface the failure rather than dying silently.
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.eval(&format!(
                            "console.error('Sentra sidecar failed to start: {}')",
                            error.to_string().replace('\'', "\\'")
                        ));
                    }
                }
            });

            // Safety net. If the frontend never finishes loading, the
            // page-load hook never fires and the window stays hidden forever —
            // the app would be running with nothing on screen and no way to
            // tell. Showing it anyway turns that into a visible failure.
            let reveal = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                if let Some(window) = reveal.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(true) {
                        log::warn!(
                            "frontend did not signal page load within 10s;                              showing the window anyway"
                        );
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Sentra")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
                let sidecar = app.state::<Arc<Sidecar>>().inner().clone();
                tauri::async_runtime::block_on(sidecar.shutdown());
            }
        });
}
