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
mod startup;
mod sysmon;
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

/// Splits a batch into (needs-elevation, can-run-directly). Kept separate so
/// the "every admin tweak ends up in one group, therefore one UAC prompt"
/// guarantee is testable without actually elevating anything.
#[cfg(windows)]
fn split_by_elevation(ids: Vec<String>) -> (Vec<String>, Vec<String>) {
    ids.into_iter().partition(|id| requires_admin_for(id))
}

/// Applies several tweaks at once (the Scan screen's "fix all").
///
/// Applying them one by one would fire a separate UAC prompt for every
/// admin-level tweak — a dozen consecutive prompts for a single click. So the
/// admin ones are collected and handed to a *single* elevated helper run,
/// while the rest are applied in-process. Failures are collected per id
/// instead of aborting, so one bad tweak can't silently swallow the rest.
#[cfg(windows)]
#[tauri::command]
fn apply_tweaks(app: tauri::AppHandle, ids: Vec<String>) -> Result<Vec<String>, String> {
    let store = store_for(&app)?;
    let mut failures = Vec::new();

    let (needs_admin, direct) = split_by_elevation(ids);

    for id in &direct {
        if let Err(e) = apply_by_id(&store, id) {
            failures.push(format!("{}: {}", id, e));
        }
    }

    if !needs_admin.is_empty() {
        if elevation::is_elevated() {
            for id in &needs_admin {
                if let Err(e) = apply_by_id(&store, id) {
                    failures.push(format!("{}: {}", id, e));
                }
            }
        } else if let Err(e) = elevation::run_elevated_action("--elevated-apply-many", &needs_admin.join(",")) {
            failures.push(e);
        }
    }

    Ok(failures)
}

#[cfg(not(windows))]
#[tauri::command]
fn apply_tweaks(_app: tauri::AppHandle, _ids: Vec<String>) -> Result<Vec<String>, String> {
    Err("i tweak sono al momento supportati solo su Windows".to_string())
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
        "--elevated-apply-many" => {
            // One prompt, many tweaks: keep going past a failure so a single
            // unsupported tweak doesn't cancel everything else the user asked for.
            let mut failed = Vec::new();
            for one in id.split(',').filter(|s| !s.is_empty()) {
                if let Err(e) = apply_by_id(&store, one) {
                    failed.push(format!("{}: {}", one, e));
                }
            }
            if failed.is_empty() {
                Ok(())
            } else {
                Err(failed.join("; "))
            }
        }
        "--elevated-rollback" => rollback_by_id(&store, id),
        "--elevated-startup" => startup::apply_from_payload(id),
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
        .manage(sysmon::SysMonState::new())
        .setup(|app| {
            game_sessions::spawn_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_tweaks,
            apply_tweak,
            apply_tweaks,
            rollback_tweak,
            list_cleanup_targets,
            run_cleanup,
            scan_duplicates,
            delete_files,
            game_sessions::list_game_sessions,
            game_sessions::game_sessions_enabled,
            game_sessions::set_game_sessions_enabled,
            game_sessions::add_game_session,
            game_sessions::remove_game_session,
            startup::list_startup_items,
            startup::set_startup_enabled,
            sysmon::system_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// Every id the UI can show, gathered from the same places `list_tweaks`
    /// gathers them.
    fn all_visible_ids() -> Vec<String> {
        let mut ids: Vec<String> = tweaks::all_tweaks().iter().map(|t| t.id.to_string()).collect();
        ids.extend(
            [
                power::TWEAK_ID,
                turbo::TWEAK_ID,
                dns::TWEAK_ID,
                gaming::INPUT_LAG_ID,
                gaming::TURBO_BOOST_ID,
                gaming::KEYBOARD_DELAY_ID,
                game_priority::TWEAK_ID,
                privacy_extra::ACTIVITY_HISTORY_ID,
                services::WINDOWS_SEARCH_ID,
            ]
            .iter()
            .map(|s| s.to_string()),
        );
        ids
    }

    /// Two tweaks sharing an id would silently collide in the rollback store:
    /// applying one would overwrite the other's snapshot and their toggles
    /// would appear linked. Cheap to prevent, nasty to debug.
    #[test]
    fn every_tweak_id_is_unique() {
        let ids = all_visible_ids();
        let mut seen = std::collections::HashSet::new();
        for id in &ids {
            assert!(seen.insert(id.clone()), "duplicate tweak id: {}", id);
        }
    }

    /// The Scan screen's "fix all" must produce at most one elevation request,
    /// no matter how many admin tweaks were selected — the whole point of
    /// batching. This asserts the grouping without actually elevating.
    #[test]
    fn admin_tweaks_collapse_into_one_elevated_batch() {
        let ids = all_visible_ids();
        let expected_admin = ids.iter().filter(|id| requires_admin_for(id)).count();
        assert!(expected_admin > 1, "test is meaningless without several admin tweaks");

        let (needs_admin, direct) = split_by_elevation(ids.clone());

        assert_eq!(needs_admin.len(), expected_admin);
        assert_eq!(needs_admin.len() + direct.len(), ids.len(), "no tweak may be dropped");
        assert!(direct.iter().all(|id| !requires_admin_for(id)));

        // One payload -> one `run_elevated_action` call -> one UAC prompt.
        let payload = needs_admin.join(",");
        let round_tripped: Vec<&str> = payload.split(',').filter(|s| !s.is_empty()).collect();
        assert_eq!(round_tripped, needs_admin, "payload must survive the join/split round trip");
    }

    /// No id may contain the separator used to pass the batch to the elevated
    /// helper, or ids would be split into fragments and silently fail there.
    #[test]
    fn no_tweak_id_contains_the_batch_separator() {
        for id in all_visible_ids() {
            assert!(!id.contains(','), "id `{}` would break the batch payload", id);
        }
    }
}
