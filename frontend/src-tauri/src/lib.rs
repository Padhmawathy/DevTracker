
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};

use tauri::Manager;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

struct BackendProcess {
    child: Mutex<CommandChild>,
    shutdown_requested: AtomicBool,
    terminated: AtomicBool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                // Development uses the separately started Python backend.
                return Ok(());
            }

            let command = app
                .shell()
                .sidecar("DevTrackBackend")?
                .arg("--managed");

            let (mut receiver, child) = command.spawn()?;

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
                            println!(
                                "[Backend] {}",
                                String::from_utf8_lossy(&bytes)
                            );
                        }
                        CommandEvent::Stderr(bytes) => {
                            eprintln!(
                                "[Backend] {}",
                                String::from_utf8_lossy(&bytes)
                            );
                        }
                        CommandEvent::Terminated(status) => {
                            println!("Backend terminated: {status:?}");

                            if let Some(backend) =
                                app_handle.try_state::<BackendProcess>()
                            {
                                backend.terminated.store(
                                    true,
                                    Ordering::SeqCst,
                                );

                                if backend.shutdown_requested.load(
                                    Ordering::SeqCst,
                                ) {
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

                let Some(backend) =
                    app_handle.try_state::<BackendProcess>()
                else {
                    // In development, no managed sidecar exists.
                    return;
                };

                if backend.terminated.load(Ordering::SeqCst) {
                    // Backend has already exited.
                    return;
                }

                api.prevent_close();

                // Do not send the shutdown command multiple times.
                if backend.shutdown_requested.swap(
                    true,
                    Ordering::SeqCst,
                ) {
                    return;
                }

                println!("Requesting DevTrack backend shutdown...");

                match backend.child.lock() {
                    Ok(mut child) => {
                        if let Err(error) = child.write(b"shutdown\n") {
                            eprintln!(
                                "Failed to send shutdown command: {error}"
                            );
                        }
                    }
                    Err(error) => {
                        eprintln!(
                            "Cannot access backend process: {error}"
                        );
                    }
                }

                // Allow the collector time to flush activity.
                // This is a fallback, not a forced backend kill.
                let timeout_handle = app_handle.clone();

                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(15));

                    if let Some(backend) =
                        timeout_handle.try_state::<BackendProcess>()
                    {
                        if !backend.terminated.load(Ordering::SeqCst) {
                            eprintln!(
                                "Backend did not terminate within 15 seconds."
                            );

                            timeout_handle.exit(1);
                        }
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
