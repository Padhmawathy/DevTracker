//! DevTrack's native shell.
//!
//! Desktop (Windows): window + tray + the Python tracking backend sidecar.
//! Mobile (Android): a plain window; the app keeps its data on the phone.

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(desktop)]
    desktop::run();
    #[cfg(mobile)]
    mobile::run();
}
