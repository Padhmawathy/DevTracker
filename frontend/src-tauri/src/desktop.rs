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

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Stop the collector cleanly, then exit. Used by the tray's Quit item.
fn quit_app(app_handle: &tauri::AppHandle) {
    log::info!("Quit requested");
    let Some(backend) = app_handle.try_state::<BackendProcess>() else {
        // In development, no managed sidecar exists.
        app_handle.exit(0);
        return;
    };

    if backend.terminated.load(Ordering::SeqCst) {
        app_handle.exit(0);
        return;
    }

    // Do not send the shutdown command multiple times.
    if backend.shutdown_requested.swap(true, Ordering::SeqCst) {
        log::warn!("Shutdown already requested; ignoring");
        return;
    }

    log::info!("Requesting DevTrack backend shutdown");

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
                log::error!("Backend did not terminate within 15 seconds");

                timeout_handle.exit(1);
            }
        }
    });
}

#[cfg(target_os = "macos")]
const TRAY_HINT: &str = "Tracking continues in the background. To exit, click the DevTrack icon in the menu bar and choose Quit DevTrack.";

#[cfg(not(target_os = "macos"))]
const TRAY_HINT: &str = "Tracking continues in the background. To exit, click ^ next to the clock, right-click the DevTrack icon and choose Quit DevTrack.";

/// The first time the window is hidden, explain that tracking continues in the tray.
fn notify_hidden_to_tray_once(app: &tauri::AppHandle) {
    use tauri_plugin_notification::NotificationExt;

    let Ok(data_dir) = app.path().app_data_dir() else {
        return;
    };
    let flag = data_dir.join("tray_hint_shown");

    if flag.exists() {
        return;
    }

    let shown = app
        .notification()
        .builder()
        .title("DevTrack is still tracking")
        .body(TRAY_HINT)
        .show();

    if shown.is_ok() {
        let _ = std::fs::create_dir_all(&data_dir);
        let _ = std::fs::write(&flag, b"1");
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let open = MenuItem::with_id(app, "open", "Open DevTrack", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit DevTrack", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("DevTrack - tracking activity")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    log::info!("Tray icon created");
    Ok(())
}


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
        .plugin(tauri_plugin_notification::init())
        // App-level handler: receives tray menu clicks on every platform.
        .on_menu_event(|app, event| {
            log::info!("App menu event: {}", event.id.as_ref());
            match event.id.as_ref() {
                "open" => show_main_window(app),
                "quit" => quit_app(app),
                _ => {}
            }
        })
        .setup(|app| {
            // Log to stdout and the OS log folder in all builds
            // (%LOCALAPPDATA%\com.devtrack.desktop\logs, ~/Library/Logs/com.devtrack.desktop).
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            log::info!("DevTrack desktop starting");

            // Tracking keeps running in the tray after the window is closed.
            build_tray(app)?;

            // Register devtrack:// with Windows during development only.
            // Installed builds must receive protocol registration from their package.
            #[cfg(all(debug_assertions, windows))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            if cfg!(debug_assertions) {
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
                            log::info!("Backend terminated: {status:?}");

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

                // While quitting from the tray, let the window close normally.
                if let Some(backend) = app_handle.try_state::<BackendProcess>() {
                    if backend.shutdown_requested.load(Ordering::SeqCst)
                        || backend.terminated.load(Ordering::SeqCst)
                    {
                        return;
                    }
                }

                // Closing the window only hides it; tracking continues in the tray.
                api.prevent_close();
                let _ = window.hide();
                notify_hidden_to_tray_once(app_handle);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            match event {
                // Clicking the Dock icon brings the hidden window back.
                tauri::RunEvent::Reopen { .. } => show_main_window(app_handle),
                // Cmd+Q and the app menu's Quit: let the collector save the
                // current activity first, as the tray's Quit does. quit_app
                // ends with app.exit(code), which arrives here with a code.
                tauri::RunEvent::ExitRequested { code: None, api, .. } => {
                    if app_handle.try_state::<BackendProcess>().is_some() {
                        api.prevent_exit();
                        quit_app(app_handle);
                    }
                }
                _ => {}
            }

            #[cfg(not(target_os = "macos"))]
            let _ = (app_handle, event);
        });
}
