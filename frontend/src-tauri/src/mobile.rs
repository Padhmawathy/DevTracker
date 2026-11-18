//! The phone app: no backend process, just a private data file.
//!
//! The frontend keeps all of its data in one JSON document
//! (see frontend/src/services/localStore.ts). These commands read and write
//! it in the app's private storage. Saves are crash-safe: the new data is
//! written to a temp file first, the previous version is kept as `.bak`, and
//! the temp file then replaces the live file.

use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const FILE: &str = "devtrack-data.json";
const MAX_BYTES: usize = 50 * 1024 * 1024;

fn data_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(FILE))
}

fn read_valid(path: &PathBuf) -> Option<String> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str::<serde_json::Value>(&text).ok()?;
    Some(text)
}

#[tauri::command]
fn load_store(app: AppHandle) -> Result<Option<String>, String> {
    let path = data_path(&app)?;
    if let Some(text) = read_valid(&path) {
        return Ok(Some(text));
    }
    // The live file is missing or damaged: fall back to the last good copy.
    Ok(read_valid(&path.with_extension("json.bak")))
}

#[tauri::command]
fn save_store(app: AppHandle, data: String) -> Result<(), String> {
    if data.len() > MAX_BYTES {
        return Err("Data is too large to save.".into());
    }
    serde_json::from_str::<serde_json::Value>(&data).map_err(|e| e.to_string())?;

    let path = data_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    let bak = path.with_extension("json.bak");

    {
        use std::io::Write;
        let mut file = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        file.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }
    if path.exists() {
        fs::copy(&path, &bak).map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![load_store, save_store])
        .run(tauri::generate_context!())
        .expect("error while running DevTrack");
}
