mod elevation;
mod rollback;
mod tweaks;

use rollback::RollbackStore;
use serde::Serialize;
use tauri::Manager;
use tweaks::{find_tweak, Category, Hive};

#[derive(Serialize)]
pub struct TweakInfo {
    id: String,
    name: String,
    description: String,
    category: String,
    hive: String,
    requires_admin: bool,
    applied: bool,
}

fn category_str(c: &Category) -> &'static str {
    match c {
        Category::Performance => "performance",
        Category::Privacy => "privacy",
        Category::Ui => "ui",
    }
}

fn hive_str(h: &Hive) -> &'static str {
    match h {
        Hive::Hkcu => "HKCU",
        Hive::Hklm => "HKLM",
    }
}

fn store_for(app: &tauri::AppHandle) -> Result<RollbackStore, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("impossibile risolvere la cartella dati app: {}", e))?;
    Ok(RollbackStore::new(dir))
}

#[tauri::command]
fn list_tweaks(app: tauri::AppHandle) -> Result<Vec<TweakInfo>, String> {
    let store = store_for(&app)?;
    Ok(tweaks::all_tweaks()
        .into_iter()
        .map(|t| TweakInfo {
            applied: store.is_applied(t.id),
            id: t.id.to_string(),
            name: t.name.to_string(),
            description: t.description.to_string(),
            category: category_str(&t.category).to_string(),
            hive: hive_str(&t.hive).to_string(),
            requires_admin: t.requires_admin,
        })
        .collect())
}

#[cfg(windows)]
#[tauri::command]
fn apply_tweak(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let tweak = find_tweak(&id).ok_or_else(|| format!("tweak sconosciuto: {}", id))?;
    if tweak.requires_admin && !elevation::is_elevated() {
        return elevation::run_elevated_action("--elevated-apply", &id);
    }
    let store = store_for(&app)?;
    tweak.apply(&store)
}

#[cfg(windows)]
#[tauri::command]
fn rollback_tweak(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let tweak = find_tweak(&id).ok_or_else(|| format!("tweak sconosciuto: {}", id))?;
    if tweak.requires_admin && !elevation::is_elevated() {
        return elevation::run_elevated_action("--elevated-rollback", &id);
    }
    let store = store_for(&app)?;
    tweak.rollback(&store)
}

#[cfg(not(windows))]
#[tauri::command]
fn apply_tweak(_app: tauri::AppHandle, _id: String) -> Result<(), String> {
    Err("i tweak sono al momento supportati solo su Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command]
fn rollback_tweak(_app: tauri::AppHandle, _id: String) -> Result<(), String> {
    Err("i tweak sono al momento supportati solo su Windows".to_string())
}

/// Called from `main()` when the process was relaunched elevated (via the
/// `runas` UAC prompt) to perform exactly one action headlessly, then exit.
/// This keeps the main app running unprivileged at all times.
#[cfg(windows)]
pub fn run_elevated_headless(action: &str, tweak_id: &str) -> ! {
    let dir = dirs_app_data_dir();
    let store = RollbackStore::new(dir);

    let result = (|| -> Result<(), String> {
        let tweak = find_tweak(tweak_id).ok_or_else(|| format!("tweak sconosciuto: {}", tweak_id))?;
        match action {
            "--elevated-apply" => tweak.apply(&store),
            "--elevated-rollback" => tweak.rollback(&store),
            other => Err(format!("azione sconosciuta: {}", other)),
        }
    })();

    match result {
        Ok(()) => std::process::exit(0),
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}

#[cfg(windows)]
fn dirs_app_data_dir() -> std::path::PathBuf {
    // Mirrors Tauri's own resolution (%APPDATA%/<identifier>) without needing
    // a running AppHandle, since the elevated helper process never builds a UI.
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(base).join("com.aurel.pc-tweaker-app")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_tweaks,
            apply_tweak,
            rollback_tweak
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
