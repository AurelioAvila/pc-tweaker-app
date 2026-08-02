mod cleanup;
mod dns;
mod elevation;
mod game_priority;
mod game_sessions;
mod gaming;
mod power;
mod privacy_extra;
mod rollback;
mod services;
mod turbo;
mod tweaks;

use cleanup::CleanupResult;
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
    requires_pro: bool,
    applied: bool,
}

fn category_str(c: &Category) -> &'static str {
    match c {
        Category::Performance => "performance",
        Category::Privacy => "privacy",
        Category::Ui => "ui",
        Category::Manutenzione => "manutenzione",
        Category::Gaming => "gaming",
    }
}

fn hive_str(h: &Hive) -> &'static str {
    match h {
        Hive::Hkcu => "HKCU",
        Hive::Hklm => "HKLM",
    }
}

pub fn store_for_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("impossibile risolvere la cartella dati app: {}", e))
}

fn store_for(app: &tauri::AppHandle) -> Result<RollbackStore, String> {
    Ok(RollbackStore::new(store_for_dir(app)?))
}

#[tauri::command]
fn list_tweaks(app: tauri::AppHandle) -> Result<Vec<TweakInfo>, String> {
    let store = store_for(&app)?;

    let mut list: Vec<TweakInfo> = tweaks::all_tweaks()
        .into_iter()
        .map(|t| TweakInfo {
            applied: store.is_applied(t.id),
            id: t.id.to_string(),
            name: t.name.to_string(),
            description: t.description.to_string(),
            category: category_str(&t.category).to_string(),
            hive: hive_str(&t.hive).to_string(),
            requires_admin: t.requires_admin,
            requires_pro: t.requires_pro,
        })
        .collect();

    list.push(TweakInfo {
        applied: store.is_applied(power::TWEAK_ID),
        id: power::TWEAK_ID.to_string(),
        name: "Prestazioni elevate (piano di alimentazione)".to_string(),
        description: "Passa al piano di alimentazione Windows \"Prestazioni elevate\". Utile su desktop o quando sei collegato alla corrente; ripristina il piano precedente al rollback.".to_string(),
        category: category_str(&Category::Performance).to_string(),
        hive: "—".to_string(),
        requires_admin: false,
        requires_pro: false,
    });

    let turbo = turbo::info();
    list.push(TweakInfo {
        id: turbo.id.to_string(),
        name: turbo.name.to_string(),
        description: turbo.description.to_string(),
        category: category_str(&Category::Performance).to_string(),
        hive: "—".to_string(),
        requires_admin: turbo.requires_admin,
        requires_pro: turbo.requires_pro,
        applied: store.is_applied(turbo.id),
    });

    list.push(TweakInfo {
        applied: store.is_applied(dns::TWEAK_ID),
        id: dns::TWEAK_ID.to_string(),
        name: "DNS privati (Cloudflare)".to_string(),
        description: "Passa a server DNS orientati alla privacy (1.1.1.1) sull'interfaccia di rete attiva, impedendo al tuo provider di registrare le richieste DNS. Non nasconde il tuo indirizzo IP (richiede una VPN, vedi sotto).".to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "—".to_string(),
        requires_admin: true,
        requires_pro: false,
    });

    let input_lag = gaming::input_lag_info();
    list.push(TweakInfo {
        applied: store.is_applied(input_lag.id),
        id: input_lag.id.to_string(),
        name: input_lag.name.to_string(),
        description: input_lag.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        requires_admin: input_lag.requires_admin,
        requires_pro: input_lag.requires_pro,
    });

    let turbo_boost = gaming::turbo_boost_info();
    list.push(TweakInfo {
        applied: store.is_applied(turbo_boost.id),
        id: turbo_boost.id.to_string(),
        name: turbo_boost.name.to_string(),
        description: turbo_boost.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        requires_admin: turbo_boost.requires_admin,
        requires_pro: turbo_boost.requires_pro,
    });

    let games_priority = game_priority::info();
    list.push(TweakInfo {
        applied: store.is_applied(games_priority.id),
        id: games_priority.id.to_string(),
        name: games_priority.name.to_string(),
        description: games_priority.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        requires_admin: games_priority.requires_admin,
        requires_pro: games_priority.requires_pro,
    });

    let keyboard_delay = gaming::keyboard_delay_info();
    list.push(TweakInfo {
        applied: store.is_applied(keyboard_delay.id),
        id: keyboard_delay.id.to_string(),
        name: keyboard_delay.name.to_string(),
        description: keyboard_delay.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        requires_admin: keyboard_delay.requires_admin,
        requires_pro: keyboard_delay.requires_pro,
    });

    let activity_history = privacy_extra::activity_history_info();
    list.push(TweakInfo {
        applied: store.is_applied(activity_history.id),
        id: activity_history.id.to_string(),
        name: activity_history.name.to_string(),
        description: activity_history.description.to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "—".to_string(),
        requires_admin: activity_history.requires_admin,
        requires_pro: activity_history.requires_pro,
    });

    let windows_search = services::windows_search_info();
    list.push(TweakInfo {
        applied: store.is_applied(windows_search.id),
        id: windows_search.id.to_string(),
        name: windows_search.name.to_string(),
        description: windows_search.description.to_string(),
        category: category_str(&Category::Manutenzione).to_string(),
        hive: "—".to_string(),
        requires_admin: windows_search.requires_admin,
        requires_pro: windows_search.requires_pro,
    });

    Ok(list)
}

#[cfg(windows)]
fn apply_by_id(store: &RollbackStore, id: &str) -> Result<(), String> {
    match id {
        power::TWEAK_ID => power::apply(store),
        turbo::TWEAK_ID => turbo::apply(store),
        dns::TWEAK_ID => dns::apply(store),
        gaming::INPUT_LAG_ID => gaming::apply_input_lag(store),
        gaming::TURBO_BOOST_ID => gaming::apply_turbo_boost(store),
        gaming::KEYBOARD_DELAY_ID => gaming::apply_keyboard_delay(store),
        game_priority::TWEAK_ID => game_priority::apply(store),
        privacy_extra::ACTIVITY_HISTORY_ID => privacy_extra::apply_activity_history(store),
        services::WINDOWS_SEARCH_ID => services::apply(store),
        _ => {
            let tweak = find_tweak(id).ok_or_else(|| format!("tweak sconosciuto: {}", id))?;
            tweak.apply(store)
        }
    }
}

#[cfg(windows)]
fn rollback_by_id(store: &RollbackStore, id: &str) -> Result<(), String> {
    match id {
        power::TWEAK_ID => power::rollback(store),
        turbo::TWEAK_ID => turbo::rollback(store),
        dns::TWEAK_ID => dns::rollback(store),
        gaming::INPUT_LAG_ID => gaming::rollback_input_lag(store),
        gaming::TURBO_BOOST_ID => gaming::rollback_turbo_boost(store),
        gaming::KEYBOARD_DELAY_ID => gaming::rollback_keyboard_delay(store),
        game_priority::TWEAK_ID => game_priority::rollback(store),
        privacy_extra::ACTIVITY_HISTORY_ID => privacy_extra::rollback_activity_history(store),
        services::WINDOWS_SEARCH_ID => services::rollback(store),
        _ => {
            let tweak = find_tweak(id).ok_or_else(|| format!("tweak sconosciuto: {}", id))?;
            tweak.rollback(store)
        }
    }
}

#[cfg(windows)]
fn requires_admin_for(id: &str) -> bool {
    match id {
        power::TWEAK_ID => false,
        turbo::TWEAK_ID => turbo::info().requires_admin,
        dns::TWEAK_ID => true,
        gaming::INPUT_LAG_ID => false,
        gaming::TURBO_BOOST_ID => true,
        gaming::KEYBOARD_DELAY_ID => false,
        game_priority::TWEAK_ID => true,
        privacy_extra::ACTIVITY_HISTORY_ID => true,
        services::WINDOWS_SEARCH_ID => true,
        _ => find_tweak(id).map(|t| t.requires_admin).unwrap_or(false),
    }
}

#[cfg(windows)]
#[tauri::command]
fn apply_tweak(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if requires_admin_for(&id) && !elevation::is_elevated() {
        return elevation::run_elevated_action("--elevated-apply", &id);
    }
    let store = store_for(&app)?;
    apply_by_id(&store, &id)
}

#[cfg(windows)]
#[tauri::command]
fn rollback_tweak(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if requires_admin_for(&id) && !elevation::is_elevated() {
        return elevation::run_elevated_action("--elevated-rollback", &id);
    }
    let store = store_for(&app)?;
    rollback_by_id(&store, &id)
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

#[tauri::command]
fn list_cleanup_targets() -> Vec<cleanup::CleanupInfo> {
    cleanup::cleanup_targets()
}

fn last_cleanup_result_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("impossibile risolvere la cartella dati app: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("last_cleanup_result.json"))
}

#[cfg(windows)]
#[tauri::command]
fn run_cleanup(app: tauri::AppHandle, id: String) -> Result<CleanupResult, String> {
    let requires_admin = cleanup::cleanup_targets()
        .into_iter()
        .find(|c| c.id == id)
        .map(|c| c.requires_admin)
        .unwrap_or(false);

    if requires_admin && !elevation::is_elevated() {
        elevation::run_elevated_action("--elevated-cleanup", &id)?;
        let path = last_cleanup_result_path(&app)?;
        let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&path);
        return serde_json::from_str(&json).map_err(|e| e.to_string());
    }

    cleanup::run_cleanup(&id)
}

#[cfg(not(windows))]
#[tauri::command]
fn run_cleanup(_app: tauri::AppHandle, _id: String) -> Result<CleanupResult, String> {
    Err("non supportato su questa piattaforma".to_string())
}

#[tauri::command]
fn scan_duplicates(root: String) -> Result<Vec<cleanup::DuplicateGroup>, String> {
    cleanup::scan_duplicates(&root)
}

#[tauri::command]
fn delete_files(paths: Vec<String>) -> CleanupResult {
    cleanup::delete_files(paths)
}

/// Called from `main()` when the process was relaunched elevated (via the
/// `runas` UAC prompt) to perform exactly one action headlessly, then exit.
/// This keeps the main app running unprivileged at all times.
#[cfg(windows)]
pub fn run_elevated_headless(action: &str, id: &str) -> ! {
    let dir = dirs_app_data_dir();
    let store = RollbackStore::new(dir.clone());

    let result: Result<(), String> = match action {
        "--elevated-apply" => apply_by_id(&store, id),
        "--elevated-rollback" => rollback_by_id(&store, id),
        "--elevated-cleanup" => cleanup::run_cleanup(id).and_then(|res| {
            let json = serde_json::to_string(&res).map_err(|e| e.to_string())?;
            std::fs::write(dir.join("last_cleanup_result.json"), json).map_err(|e| e.to_string())
        }),
        other => Err(format!("azione sconosciuta: {}", other)),
    };

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
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            game_sessions::spawn_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_tweaks,
            apply_tweak,
            rollback_tweak,
            list_cleanup_targets,
            run_cleanup,
            scan_duplicates,
            delete_files,
            game_sessions::list_game_sessions,
            game_sessions::game_sessions_enabled,
            game_sessions::set_game_sessions_enabled,
            game_sessions::add_game_session,
            game_sessions::remove_game_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
