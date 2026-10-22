use serde::{Deserialize, Serialize};
use std::{
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};
use tauri::{Emitter, State, WebviewWindow};
use uuid::Uuid;

use tauri::Manager;
use tauri_plugin_shell::{
    ShellExt,
    process::{CommandChild, CommandEvent},
};

struct BackendProcess {
    child: Mutex<CommandChild>,
    shutdown_requested: AtomicBool,
    terminated: AtomicBool,
}

struct DesktopApiToken(String);

#[derive(Deserialize)]
struct ApiRequest {
    path: String,
    method: String,
    body: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct ApiResponse {
    status: u16,
    body: String,
}

#[tauri::command]
async fn desktop_api_request(
    window: WebviewWindow,
    token: State<'_, DesktopApiToken>,
    request: ApiRequest,
) -> Result<ApiResponse, String> {
    if window.label() != "main" {
        return Err("Unauthorized window".into());
    }

    // Only allow the frontend to access DevTrack API routes.
    if !request.path.starts_with("/api/")
        || request.path.contains("..")
        || request.path.contains('\\')
        || request.path.contains('%')
        || request.path.contains('#')
    {
        return Err("Invalid API path".into());
    }

    let method = match request.method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        _ => return Err("Unsupported HTTP method".into()),
    };

    let client = reqwest::Client::new();

    let mut builder = client
        .request(method, format!("http://127.0.0.1:8000{}", request.path))
        .header("X-DevTrack-Token", &token.0)
        .timeout(Duration::from_secs(15));

    if let Some(body) = request.body {
        builder = builder.json(&body);
    }

    let response = builder.send().await.map_err(|error| error.to_string())?;

    let status = response.status().as_u16();
    let body = response.text().await.map_err(|error| error.to_string())?;

    Ok(ApiResponse { status, body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let links: Vec<&String> = args
                    .iter()
                    .filter(|arg| arg.starts_with("devtrack://"))
                    .collect();

                // Only Open Check-ins should bring DevTrack to the foreground.
                let should_show = links.is_empty()
                    || links.iter().any(|url| {
                        url.starts_with("devtrack://open/")
                    });

                if should_show {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }

                // Forward all deep links without changing window visibility.
                for url in links {
                    let _ = window.emit("devtrack-deep-link", url.clone());
                }
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![desktop_api_request])
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Register devtrack:// with Windows during development only.
            // Installed builds must receive protocol registration from their package.
            #[cfg(all(debug_assertions, windows))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                // Development uses the separately started Python backend.
                return Ok(());
            }
            let auth_token = Uuid::new_v4().simple().to_string();

            app.manage(DesktopApiToken(auth_token.clone()));
            let command = app.shell().sidecar("DevTrackBackend")?.arg("--managed");

            let (mut receiver, mut child) = command.spawn()?;

            child.write(format!("auth {auth_token}\n").as_bytes())?;

            println!("DevTrack backend PID: {}", child.pid());

            app.manage(BackendProcess {
                child: Mutex::new(child),
                shutdown_requested: AtomicBool::new(false),
                terminated: AtomicBool::new(false),
            });

            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                while let Some(event) = receiver.recv().await {
                    match event {
                        CommandEvent::Stdout(bytes) => {
                            println!("[Backend] {}", String::from_utf8_lossy(&bytes));
                        }
                        CommandEvent::Stderr(bytes) => {
                            eprintln!("[Backend] {}", String::from_utf8_lossy(&bytes));
                        }
                        CommandEvent::Terminated(status) => {
                            println!("Backend terminated: {status:?}");

                            if let Some(backend) = app_handle.try_state::<BackendProcess>() {
                                backend.terminated.store(true, Ordering::SeqCst);

                                if backend.shutdown_requested.load(Ordering::SeqCst) {
                                    app_handle.exit(0);
                                }
                            }

                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app_handle = window.app_handle();

                let Some(backend) = app_handle.try_state::<BackendProcess>() else {
                    // In development, no managed sidecar exists.
                    return;
                };

                if backend.terminated.load(Ordering::SeqCst) {
                    // Backend has already exited.
                    return;
                }

                api.prevent_close();

                // Do not send the shutdown command multiple times.
                if backend.shutdown_requested.swap(true, Ordering::SeqCst) {
                    return;
                }

                println!("Requesting DevTrack backend shutdown...");

                match backend.child.lock() {
                    Ok(mut child) => {
                        if let Err(error) = child.write(b"shutdown\n") {
                            eprintln!("Failed to send shutdown command: {error}");
                        }
                    }
                    Err(error) => {
                        eprintln!("Cannot access backend process: {error}");
                    }
                }

                // Allow the collector time to flush activity.
                // This is a fallback, not a forced backend kill.
                let timeout_handle = app_handle.clone();

                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(15));

                    if let Some(backend) = timeout_handle.try_state::<BackendProcess>() {
                        if !backend.terminated.load(Ordering::SeqCst) {
                            eprintln!("Backend did not terminate within 15 seconds.");

                            timeout_handle.exit(1);
                        }
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
