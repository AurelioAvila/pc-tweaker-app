use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use crate::rollback::RollbackStore;
use crate::turbo;

#[derive(Serialize, Deserialize, Clone)]
pub struct GameEntry {
    pub path: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Default)]
struct Config {
    enabled: bool,
    games: Vec<GameEntry>,
}

fn config_path(dir: &PathBuf) -> PathBuf {
    dir.join("game_sessions.json")
}

fn load_config(dir: &PathBuf) -> Config {
    std::fs::read_to_string(config_path(dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config(dir: &PathBuf, config: &Config) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(config_path(dir), json).map_err(|e| e.to_string())
}

fn exe_basename(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

#[tauri::command]
pub fn list_game_sessions(app: tauri::AppHandle) -> Result<Vec<GameEntry>, String> {
    let dir = crate::store_for_dir(&app)?;
    Ok(load_config(&dir).games)
}

#[tauri::command]
pub fn game_sessions_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    let dir = crate::store_for_dir(&app)?;
    Ok(load_config(&dir).enabled)
}

#[tauri::command]
pub fn set_game_sessions_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    let mut config = load_config(&dir);
    config.enabled = enabled;
    save_config(&dir, &config)
}

#[tauri::command]
pub fn add_game_session(app: tauri::AppHandle, path: String) -> Result<GameEntry, String> {
    let dir = crate::store_for_dir(&app)?;
    let mut config = load_config(&dir);

    let name = PathBuf::from(&path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    if config
        .games
        .iter()
        .any(|g| g.path.eq_ignore_ascii_case(&path))
    {
        return Err("this game is already on the list".to_string());
    }

    let entry = GameEntry { path, name };
    config.games.push(entry.clone());
    save_config(&dir, &config)?;
    Ok(entry)
}

#[tauri::command]
pub fn remove_game_session(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    let mut config = load_config(&dir);
    config.games.retain(|g| !g.path.eq_ignore_ascii_case(&path));
    save_config(&dir, &config)
}

#[derive(Serialize, Clone)]
struct SessionEvent {
    active: bool,
    name: Option<String>,
}

/// Turbo Gaming touches an HKLM value and the active power scheme, both of
/// which need admin rights. The watcher must never silently self-elevate —
/// it goes through the exact same UAC-prompt path the manual "apply" button
/// uses, so the very first game launch after opening the app asks for
/// consent once, exactly like it would if the user had clicked it themselves.
#[cfg(windows)]
fn apply_turbo_elevated_if_needed(store: &RollbackStore) -> Result<(), String> {
    if crate::elevation::is_elevated() {
        turbo::apply(store)
    } else {
        crate::elevation::run_elevated_action("--elevated-apply", turbo::TWEAK_ID)
    }
}

#[cfg(windows)]
fn rollback_turbo_elevated_if_needed(store: &RollbackStore) -> Result<(), String> {
    if crate::elevation::is_elevated() {
        turbo::rollback(store)
    } else {
        crate::elevation::run_elevated_action("--elevated-rollback", turbo::TWEAK_ID)
    }
}

#[cfg(not(windows))]
fn apply_turbo_elevated_if_needed(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
fn rollback_turbo_elevated_if_needed(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

/// Runs for the whole lifetime of the app: every few seconds, checks whether
/// any registered game is currently running. On the transition into "a game
/// just started", it applies the same Turbo Gaming preset the user could
/// apply by hand (reusing its existing rollback-aware apply/rollback), and
/// reverts it automatically the moment the game closes — never touching
/// tweaks the user already had applied independently of a game session.
pub fn spawn_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        use tauri::Emitter;

        let currently_active: Mutex<Option<String>> = Mutex::new(None);
        let mut sys = sysinfo::System::new();

        loop {
            std::thread::sleep(Duration::from_secs(3));

            let dir = match crate::store_for_dir(&app) {
                Ok(d) => d,
                Err(_) => continue,
            };
            let config = load_config(&dir);
            if !config.enabled || config.games.is_empty() {
                continue;
            }

            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            let running_names: std::collections::HashSet<String> = sys
                .processes()
                .values()
                .filter_map(|p| p.name().to_str())
                .map(|s| s.to_lowercase())
                .collect();

            let matched = config
                .games
                .iter()
                .find(|g| running_names.contains(&exe_basename(&g.path)));

            let mut active = currently_active.lock().unwrap();
            let store = RollbackStore::new(dir);

            match (&*active, matched) {
                (None, Some(game)) => {
                    if !store.is_applied(turbo::TWEAK_ID) {
                        if let Err(e) = apply_turbo_elevated_if_needed(&store) {
                            eprintln!("game session: could not apply the preset: {}", e);
                            continue;
                        }
                    }
                    *active = Some(game.name.clone());
                    let _ = app.emit(
                        "game-session-changed",
                        SessionEvent {
                            active: true,
                            name: Some(game.name.clone()),
                        },
                    );
                }
                (Some(_), None) => {
                    if store.is_applied(turbo::TWEAK_ID) {
                        if let Err(e) = rollback_turbo_elevated_if_needed(&store) {
                            eprintln!("game session: could not revert the preset: {}", e);
                        }
                    }
                    *active = None;
                    let _ = app.emit(
                        "game-session-changed",
                        SessionEvent {
                            active: false,
                            name: None,
                        },
                    );
                }
                _ => {}
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The watcher matches a registered game against running process names,
    /// which Windows reports with its own casing — so the comparison has to be
    /// case-insensitive or a registered game would simply never be detected.
    #[test]
    fn exe_basename_normalizes_case_and_separators() {
        assert_eq!(exe_basename(r"C:\Games\VALORANT.exe"), "valorant.exe");
        assert_eq!(exe_basename("C:/Games/Valorant.EXE"), "valorant.exe");
        assert_eq!(
            exe_basename(r"D:\Steam\steamapps\common\CS2\cs2.exe"),
            "cs2.exe"
        );
    }

    #[test]
    fn exe_basename_survives_odd_paths() {
        assert_eq!(exe_basename(""), "");
        assert_eq!(exe_basename("game.exe"), "game.exe");
        assert_eq!(
            exe_basename(r"C:\Program Files\My Game\my game.exe"),
            "my game.exe"
        );
    }

    /// Windows paths are case-insensitive, so the same game picked twice with
    /// different casing must be recognized as already registered.
    #[test]
    fn the_same_game_in_different_casing_is_the_same_game() {
        let stored = r"C:\Games\Valorant.exe";
        let picked_again = r"c:\games\VALORANT.EXE";
        assert!(stored.eq_ignore_ascii_case(picked_again));
        assert_eq!(exe_basename(stored), exe_basename(picked_again));
    }
}
