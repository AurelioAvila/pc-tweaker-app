use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::rollback::RollbackStore;
use crate::turbo;

static CONFIG_LOCK: Mutex<()> = Mutex::new(());
static OWNER_SEQUENCE: AtomicU64 = AtomicU64::new(1);

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

fn config_path(dir: &Path) -> PathBuf {
    dir.join("game_sessions.json")
}

fn load_config(dir: &Path) -> Config {
    std::fs::read_to_string(config_path(dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config(dir: &Path, config: &Config) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(config_path(dir), json).map_err(|e| e.to_string())
}

/// Compare complete Windows executable paths, including extended-length paths.
/// A basename is deliberately never a substitute for a missing process path.
fn normalized_executable_path(path: &str) -> Option<String> {
    if path.is_empty() || path.contains('\0') {
        return None;
    }
    let replaced = path.replace('/', "\\");
    let mut path = replaced.as_str();
    let unc;
    if path
        .get(..8)
        .is_some_and(|p| p.eq_ignore_ascii_case(r"\\?\UNC\"))
    {
        unc = format!(r"\\{}", &path[8..]);
        path = &unc;
    } else if let Some(stripped) = path.strip_prefix(r"\\?\") {
        path = stripped;
    }
    let bytes = path.as_bytes();
    let drive_rooted =
        bytes.len() > 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\';
    let unc_rooted =
        path.starts_with(r"\\") && path[2..].split('\\').filter(|p| !p.is_empty()).count() >= 3;
    if (!drive_rooted && !unc_rooted)
        || path.split('\\').any(|p| p == "." || p == "..")
        || !path.to_ascii_lowercase().ends_with(".exe")
    {
        return None;
    }
    Some(path.to_lowercase())
}

fn executable_key(path: &str) -> Option<String> {
    let resolved = std::fs::canonicalize(path).ok();
    normalized_executable_path(resolved.as_deref().and_then(Path::to_str).unwrap_or(path))
}

/// Activation and additions require Pro. Removal and disabling are recovery
/// operations and must remain available after a subscription expires.
fn authorize_configuration_change(
    requires_pro: bool,
    check_pro: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    if requires_pro {
        check_pro()?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_game_sessions(app: tauri::AppHandle) -> Result<Vec<GameEntry>, String> {
    let dir = crate::store_for_dir(&app)?;
    let _guard = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    Ok(load_config(&dir).games)
}

#[tauri::command]
pub fn game_sessions_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    let dir = crate::store_for_dir(&app)?;
    let _guard = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    Ok(load_config(&dir).enabled)
}

#[tauri::command]
pub fn set_game_sessions_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    authorize_configuration_change(enabled, || crate::require_pro(&dir))?;
    let _guard = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir);
    config.enabled = enabled;
    save_config(&dir, &config)
}

#[tauri::command]
pub fn add_game_session(app: tauri::AppHandle, path: String) -> Result<GameEntry, String> {
    let dir = crate::store_for_dir(&app)?;
    authorize_configuration_change(true, || crate::require_pro(&dir))?;
    let requested = PathBuf::from(&path);
    if !requested.is_absolute() || !requested.is_file() {
        return Err("select an existing executable using its full path".to_string());
    }
    let key = executable_key(&path)
        .ok_or_else(|| "select an executable with the .exe extension".to_string())?;
    let _guard = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir);
    if config
        .games
        .iter()
        .any(|g| executable_key(&g.path).as_ref() == Some(&key))
    {
        return Err("this game is already on the list".to_string());
    }
    let name = requested
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let entry = GameEntry { path, name };
    config.games.push(entry.clone());
    save_config(&dir, &config)?;
    Ok(entry)
}

#[tauri::command]
pub fn remove_game_session(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    let _guard = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir);
    let key = executable_key(&path);
    config.games.retain(|g| {
        !g.path.eq_ignore_ascii_case(&path) && !(key.is_some() && executable_key(&g.path) == key)
    });
    save_config(&dir, &config)
}

#[derive(Serialize, Clone, Debug)]
struct SessionEvent {
    active: bool,
    name: Option<String>,
    /// This is observed reclaimed memory, not an estimated performance gain.
    freed_bytes: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct ProcessIdentity {
    pid: u32,
    started_at: u64,
    executable: String,
}

#[derive(Clone, Debug)]
struct MatchedGame {
    name: String,
    process: ProcessIdentity,
}

struct ProcessObservation {
    pid: u32,
    started_at: u64,
    executable: Option<String>,
}

fn find_matching_game(
    games: &[GameEntry],
    processes: &[ProcessObservation],
    current: Option<&MatchedGame>,
) -> Option<MatchedGame> {
    let registered: Vec<_> = games
        .iter()
        .filter_map(|game| executable_key(&game.path).map(|key| (game, key)))
        .collect();
    // A previously verified process may temporarily deny path inspection.
    // Retain it only while both PID and known creation time still agree.
    if let Some(current) = current {
        if registered
            .iter()
            .any(|(_, key)| key == &current.process.executable)
            && processes.iter().any(|p| {
                p.pid == current.process.pid
                    && p.started_at != 0
                    && p.started_at == current.process.started_at
                    && p.executable
                        .as_ref()
                        .is_none_or(|path| path == &current.process.executable)
            })
        {
            return Some(current.clone());
        }
    }
    for (game, key) in registered {
        if let Some(process) = processes
            .iter()
            .find(|p| p.started_at != 0 && p.executable.as_ref() == Some(&key))
        {
            return Some(MatchedGame {
                name: game.name.clone(),
                process: ProcessIdentity {
                    pid: process.pid,
                    started_at: process.started_at,
                    executable: key,
                },
            });
        }
    }
    None
}

/// Tokens are passed as a single argument to the elevated helper; they contain
/// no paths or shell syntax. PID and start time identify the originating app.
pub(crate) fn validate_owner_token(owner: &str) -> Result<(), String> {
    let parts: Vec<_> = owner.split('-').collect();
    if owner.len() > 128
        || parts.len() != 5
        || parts[0] != "gs"
        || parts[1..]
            .iter()
            .any(|p| p.is_empty() || !p.bytes().all(|b| b.is_ascii_digit()))
        || parts[1].parse::<u32>().ok().filter(|p| *p != 0).is_none()
        || parts[2].parse::<u64>().is_err()
        || parts[3].parse::<u128>().is_err()
        || parts[4].parse::<u64>().is_err()
    {
        return Err("invalid game-session owner token".to_string());
    }
    Ok(())
}

fn new_owner_token(started_at: u64) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let sequence = OWNER_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!(
        "gs-{}-{started_at}-{timestamp}-{sequence}",
        std::process::id()
    )
}

fn originating_watcher_may_be_alive(owner: &str, processes: &[ProcessObservation]) -> bool {
    if validate_owner_token(owner).is_err() {
        // An unrecognized marker is not permission to restore anything.
        return true;
    }
    let parts: Vec<_> = owner.split('-').collect();
    let pid = parts[1].parse::<u32>().unwrap();
    let started_at = parts[2].parse::<u64>().unwrap();
    processes.iter().any(|p| {
        p.pid == pid && (started_at == 0 || p.started_at == 0 || p.started_at == started_at)
    })
}

trait SessionBackend {
    /// True only if this owner created the durable Turbo snapshot.
    fn apply(&mut self, owner: &str) -> Result<bool, String>;
    /// Success also includes a manual takeover or an already removed snapshot.
    fn restore(&mut self, owner: &str) -> Result<(), String>;
    fn trim(&mut self) -> u64;
}

#[derive(Default)]
enum SessionState {
    #[default]
    Idle,
    Active {
        game: MatchedGame,
        owner: Option<String>,
    },
    CleanupPending {
        owner: String,
    },
}

impl SessionState {
    fn game(&self) -> Option<&MatchedGame> {
        match self {
            Self::Active { game, .. } => Some(game),
            _ => None,
        }
    }

    fn finish_cleanup(
        &mut self,
        backend: &mut impl SessionBackend,
    ) -> Result<SessionEvent, String> {
        if let Self::CleanupPending { owner } = self {
            backend.restore(owner)?;
        }
        // A restore error returns above and deliberately retains the owner.
        *self = Self::Idle;
        Ok(SessionEvent {
            active: false,
            name: None,
            freed_bytes: 0,
        })
    }

    fn tick(
        &mut self,
        allowed: bool,
        matched: Option<MatchedGame>,
        backend: &mut impl SessionBackend,
        make_owner: impl FnOnce() -> String,
    ) -> Result<Option<SessionEvent>, String> {
        if matches!(self, Self::CleanupPending { .. }) {
            return self.finish_cleanup(backend).map(Some);
        }
        let desired = if allowed { matched } else { None };
        if let Self::Active { game, owner } = self {
            if desired
                .as_ref()
                .is_some_and(|next| next.process == game.process)
            {
                return Ok(None);
            }
            if let Some(owner) = owner.clone() {
                *self = Self::CleanupPending { owner };
            }
            return self.finish_cleanup(backend).map(Some);
        }
        let Some(game) = desired else {
            return Ok(None);
        };
        let owner = make_owner();
        // Apply can fail after a partial system write. Retain this identity
        // before calling it so even that failure follows the restore path.
        *self = Self::CleanupPending {
            owner: owner.clone(),
        };
        let created = backend.apply(&owner)?;
        let freed_bytes = if created { backend.trim() } else { 0 };
        let event = SessionEvent {
            active: true,
            name: Some(game.name.clone()),
            freed_bytes,
        };
        *self = Self::Active {
            game,
            owner: created.then_some(owner),
        };
        Ok(Some(event))
    }
}

struct NativeBackend<'a> {
    store: &'a RollbackStore,
    dir: &'a Path,
}

impl SessionBackend for NativeBackend<'_> {
    fn apply(&mut self, owner: &str) -> Result<bool, String> {
        // This gate also runs when the entire application is already elevated.
        // The helper repeats it after UAC, immediately before system writes.
        crate::require_pro(self.dir)?;
        apply_turbo_elevated_if_needed(self.store, owner)
    }

    fn restore(&mut self, owner: &str) -> Result<(), String> {
        rollback_turbo_elevated_if_needed(self.store, owner)
    }

    fn trim(&mut self) -> u64 {
        trim_working_sets()
    }
}

#[cfg(windows)]
fn apply_turbo_elevated_if_needed(store: &RollbackStore, owner: &str) -> Result<bool, String> {
    validate_owner_token(owner)?;
    if crate::elevation::is_elevated() {
        turbo::apply_for_session(store, owner)
    } else {
        // An existing preset is observed without claiming it or asking for UAC.
        // The atomic apply below handles a concurrent manual apply safely too.
        if store.is_applied(turbo::TWEAK_ID) {
            return Ok(false);
        }
        crate::elevation::run_elevated_action("--elevated-session-apply", owner)?;
        turbo::is_owned_by_session(store, owner)
    }
}

#[cfg(windows)]
fn rollback_turbo_elevated_if_needed(store: &RollbackStore, owner: &str) -> Result<(), String> {
    validate_owner_token(owner)?;
    if !turbo::is_owned_by_session(store, owner)? {
        return Ok(());
    }
    if crate::elevation::is_elevated() {
        turbo::rollback_for_session(store, owner)?;
    } else {
        crate::elevation::run_elevated_action("--elevated-session-rollback", owner)?;
    }
    if turbo::is_owned_by_session(store, owner)? {
        return Err("the game-session restore is still pending".to_string());
    }
    Ok(())
}

#[cfg(windows)]
fn trim_working_sets() -> u64 {
    crate::ramclean::trim_for_session()
}

#[cfg(not(windows))]
fn trim_working_sets() -> u64 {
    0
}

#[cfg(not(windows))]
fn apply_turbo_elevated_if_needed(_store: &RollbackStore, _owner: &str) -> Result<bool, String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
fn rollback_turbo_elevated_if_needed(_store: &RollbackStore, _owner: &str) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

/// Only the snapshot bearing this session's durable owner token can be restored.
/// Disabling automation, removing its games and losing Pro all use that same
/// recovery path. A manual preset (including a manual takeover) is never undone.
pub fn spawn_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        use tauri::Emitter;

        let mut state = SessionState::default();
        let mut sys = sysinfo::System::new();
        let mut recovery_checked = false;
        let mut retry_after = Instant::now();
        loop {
            std::thread::sleep(Duration::from_secs(3));
            let dir = match crate::store_for_dir(&app) {
                Ok(dir) => dir,
                Err(_) => continue,
            };
            let config = match CONFIG_LOCK.lock() {
                Ok(_guard) => load_config(&dir),
                Err(_) => continue,
            };
            let refreshed = sys.refresh_processes_specifics(
                sysinfo::ProcessesToUpdate::All,
                true,
                sysinfo::ProcessRefreshKind::new().with_exe(sysinfo::UpdateKind::Always),
            );
            let mut processes: Vec<_> = sys
                .processes()
                .values()
                .map(|p| ProcessObservation {
                    pid: p.pid().as_u32(),
                    started_at: p.start_time(),
                    executable: p.exe().and_then(Path::to_str).and_then(executable_key),
                })
                .collect();
            processes.sort_by_key(|p| (p.pid, p.started_at));
            let store = RollbackStore::new(dir.clone());
            if !recovery_checked {
                if refreshed == 0 {
                    continue;
                }
                match turbo::session_owner(&store) {
                    Ok(Some(owner)) => {
                        if originating_watcher_may_be_alive(&owner, &processes) {
                            continue;
                        }
                        state = SessionState::CleanupPending { owner };
                        recovery_checked = true;
                    }
                    Ok(None) => recovery_checked = true,
                    Err(error) => {
                        eprintln!("game session: cannot inspect recovery ownership: {error}");
                        continue;
                    }
                }
            }
            let allowed =
                config.enabled && !config.games.is_empty() && crate::require_pro(&dir).is_ok();
            // A failed process enumeration is not evidence that a game exited.
            // Explicit disable/removal/expiry can still restore our own state.
            if allowed && refreshed == 0 {
                continue;
            }
            if Instant::now() < retry_after {
                continue;
            }
            let matched = if allowed {
                find_matching_game(&config.games, &processes, state.game())
            } else {
                None
            };
            let watcher_start = processes
                .iter()
                .find(|p| p.pid == std::process::id())
                .map(|p| p.started_at)
                .unwrap_or(0);
            let mut backend = NativeBackend {
                store: &store,
                dir: &dir,
            };
            match state.tick(allowed, matched, &mut backend, || {
                new_owner_token(watcher_start)
            }) {
                Ok(Some(event)) => {
                    let _ = app.emit("game-session-changed", event);
                }
                Ok(None) => {}
                Err(error) => {
                    eprintln!("game session: operation pending recovery: {error}");
                    // Retain ownership, but avoid a UAC prompt every three seconds.
                    retry_after = Instant::now() + Duration::from_secs(30);
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[derive(Default)]
    struct MockBackend {
        snapshot_owner: Option<String>,
        manual: bool,
        apply_calls: usize,
        restore_calls: usize,
        trim_calls: usize,
        fail_apply: bool,
        fail_restore: bool,
    }

    impl SessionBackend for MockBackend {
        fn apply(&mut self, owner: &str) -> Result<bool, String> {
            self.apply_calls += 1;
            if self.manual || self.snapshot_owner.is_some() {
                return Ok(false);
            }
            self.snapshot_owner = Some(owner.to_string());
            if self.fail_apply {
                return Err("partial apply".to_string());
            }
            Ok(true)
        }
        fn restore(&mut self, owner: &str) -> Result<(), String> {
            self.restore_calls += 1;
            if self.snapshot_owner.as_deref() != Some(owner) {
                return Ok(());
            }
            if self.fail_restore {
                return Err("restore failed".to_string());
            }
            self.snapshot_owner = None;
            Ok(())
        }
        fn trim(&mut self) -> u64 {
            self.trim_calls += 1;
            42
        }
    }

    fn game() -> MatchedGame {
        MatchedGame {
            name: "Game".to_string(),
            process: ProcessIdentity {
                pid: 123,
                started_at: 456,
                executable: r"c:\games\game.exe".to_string(),
            },
        }
    }
    fn owner() -> String {
        "gs-100-200-300-1".to_string()
    }
    fn entry() -> GameEntry {
        GameEntry {
            path: r"C:\Games\Game.exe".to_string(),
            name: "Game".to_string(),
        }
    }
    fn observation(path: Option<&str>, started_at: u64) -> ProcessObservation {
        ProcessObservation {
            pid: 123,
            started_at,
            executable: path.and_then(normalized_executable_path),
        }
    }

    #[test]
    fn manual_preset_survives_game_exit_without_trim_or_restore() {
        let mut state = SessionState::default();
        let mut backend = MockBackend {
            manual: true,
            ..Default::default()
        };
        let started = state
            .tick(true, Some(game()), &mut backend, owner)
            .unwrap()
            .unwrap();
        assert_eq!(started.freed_bytes, 0);
        state.tick(true, None, &mut backend, owner).unwrap();
        assert!(backend.manual);
        assert_eq!(backend.restore_calls, 0);
        assert_eq!(backend.trim_calls, 0);
    }

    #[test]
    fn manual_takeover_during_game_is_not_restored() {
        let mut state = SessionState::default();
        let mut backend = MockBackend::default();
        state.tick(true, Some(game()), &mut backend, owner).unwrap();
        backend.snapshot_owner = None;
        backend.manual = true;
        state.tick(true, None, &mut backend, owner).unwrap();
        assert!(backend.manual);
        assert!(matches!(state, SessionState::Idle));
    }

    #[test]
    fn disabling_restores_owned_state_even_while_game_is_running() {
        let mut state = SessionState::default();
        let mut backend = MockBackend::default();
        state.tick(true, Some(game()), &mut backend, owner).unwrap();
        let event = state
            .tick(false, Some(game()), &mut backend, owner)
            .unwrap()
            .unwrap();
        assert!(!event.active);
        assert_eq!(backend.restore_calls, 1);
        assert!(backend.snapshot_owner.is_none());
    }

    #[test]
    fn removing_last_game_restores_owned_state() {
        let mut state = SessionState::default();
        let mut backend = MockBackend::default();
        state.tick(true, Some(game()), &mut backend, owner).unwrap();
        let matched = find_matching_game(
            &[],
            &[observation(Some(r"C:\Games\Game.exe"), 456)],
            state.game(),
        );
        state.tick(true, matched, &mut backend, owner).unwrap();
        assert_eq!(backend.restore_calls, 1);
        assert!(backend.snapshot_owner.is_none());
    }

    #[test]
    fn failed_restore_retains_owner_and_retries_after_expiry() {
        let mut state = SessionState::default();
        let mut backend = MockBackend::default();
        state.tick(true, Some(game()), &mut backend, owner).unwrap();
        backend.fail_restore = true;
        assert!(state.tick(false, None, &mut backend, owner).is_err());
        assert!(
            matches!(&state, SessionState::CleanupPending { owner: token } if token == &owner())
        );
        assert_eq!(backend.snapshot_owner, Some(owner()));
        backend.fail_restore = false;
        state.tick(false, None, &mut backend, owner).unwrap();
        assert!(matches!(state, SessionState::Idle));
        assert_eq!(backend.restore_calls, 2);
        assert_eq!(backend.apply_calls, 1);
    }

    #[test]
    fn failed_partial_apply_is_restored_before_any_new_apply() {
        let mut state = SessionState::default();
        let mut backend = MockBackend {
            fail_apply: true,
            ..Default::default()
        };
        assert!(state.tick(true, Some(game()), &mut backend, owner).is_err());
        assert!(matches!(state, SessionState::CleanupPending { .. }));
        state.tick(true, Some(game()), &mut backend, owner).unwrap();
        assert_eq!(backend.apply_calls, 1);
        assert_eq!(backend.restore_calls, 1);
        assert_eq!(backend.trim_calls, 0);
    }

    #[test]
    fn expired_pro_cannot_start_but_can_end_a_session() {
        let mut state = SessionState::default();
        let mut backend = MockBackend::default();
        assert!(state
            .tick(false, Some(game()), &mut backend, owner)
            .unwrap()
            .is_none());
        assert_eq!(backend.apply_calls, 0);
        state.tick(true, Some(game()), &mut backend, owner).unwrap();
        state
            .tick(false, Some(game()), &mut backend, owner)
            .unwrap();
        assert_eq!(backend.restore_calls, 1);
    }

    #[test]
    fn enable_and_add_require_pro_but_disable_does_not_check_it() {
        let checked = Cell::new(0);
        let denied = || {
            checked.set(checked.get() + 1);
            Err("PRO_REQUIRED".to_string())
        };
        assert!(authorize_configuration_change(true, denied).is_err());
        assert!(authorize_configuration_change(true, denied).is_err());
        assert!(authorize_configuration_change(false, denied).is_ok());
        assert_eq!(checked.get(), 2);
    }

    #[test]
    fn another_executable_with_the_same_basename_does_not_match() {
        let processes = [observation(Some(r"C:\Other\Game.exe"), 456)];
        assert!(find_matching_game(&[entry()], &processes, None).is_none());
        assert!(normalized_executable_path("Game.exe").is_none());
    }

    #[test]
    fn complete_paths_accept_case_separator_and_extended_prefix_differences() {
        let expected = normalized_executable_path(r"C:\Games\Game.exe");
        assert_eq!(expected, normalized_executable_path("c:/games/GAME.EXE"));
        assert_eq!(
            expected,
            normalized_executable_path(r"\\?\C:\Games\Game.exe")
        );
        assert_eq!(
            normalized_executable_path(r"\\server\share\Game.exe"),
            normalized_executable_path(r"\\?\UNC\server\share\Game.exe")
        );
    }

    #[test]
    fn unverified_paths_or_creation_times_never_start_a_session() {
        assert!(find_matching_game(&[entry()], &[observation(None, 456)], None).is_none());
        assert!(find_matching_game(
            &[entry()],
            &[observation(Some(r"C:\Games\Game.exe"), 0)],
            None
        )
        .is_none());
        assert!(normalized_executable_path(r"C:\Games\..\Game.exe").is_none());
    }

    #[test]
    fn temporary_path_denial_retains_only_the_verified_process_identity() {
        assert!(find_matching_game(&[entry()], &[observation(None, 456)], Some(&game())).is_some());
        assert!(find_matching_game(&[entry()], &[observation(None, 457)], Some(&game())).is_none());
        assert!(find_matching_game(&[entry()], &[observation(None, 0)], Some(&game())).is_none());
    }

    #[test]
    fn pid_reuse_ends_the_old_session_before_starting_the_new_one() {
        let mut state = SessionState::default();
        let mut backend = MockBackend::default();
        state.tick(true, Some(game()), &mut backend, owner).unwrap();
        let mut replacement = game();
        replacement.process.started_at += 1;
        let event = state
            .tick(true, Some(replacement), &mut backend, owner)
            .unwrap()
            .unwrap();
        assert!(!event.active);
        assert_eq!(backend.restore_calls, 1);
        assert_eq!(backend.apply_calls, 1);
    }

    #[test]
    fn repeated_observation_does_not_reapply_or_trim_again() {
        let mut state = SessionState::default();
        let mut backend = MockBackend::default();
        state.tick(true, Some(game()), &mut backend, owner).unwrap();
        assert!(state
            .tick(true, Some(game()), &mut backend, owner)
            .unwrap()
            .is_none());
        assert_eq!(backend.apply_calls, 1);
        assert_eq!(backend.trim_calls, 1);
    }

    #[test]
    fn live_or_unknown_watcher_identity_prevents_startup_takeover() {
        let live = ProcessObservation {
            pid: 100,
            started_at: 200,
            executable: None,
        };
        assert!(originating_watcher_may_be_alive(&owner(), &[live]));
        let unknown = ProcessObservation {
            pid: 100,
            started_at: 0,
            executable: None,
        };
        assert!(originating_watcher_may_be_alive(&owner(), &[unknown]));
        let reused = ProcessObservation {
            pid: 100,
            started_at: 201,
            executable: None,
        };
        assert!(!originating_watcher_may_be_alive(&owner(), &[reused]));
        assert!(!originating_watcher_may_be_alive(&owner(), &[]));
        assert!(originating_watcher_may_be_alive("unrecognized", &[]));
    }

    #[test]
    fn startup_cleanup_survives_failure_and_does_not_require_pro() {
        let mut state = SessionState::CleanupPending { owner: owner() };
        let mut backend = MockBackend {
            snapshot_owner: Some(owner()),
            fail_restore: true,
            ..Default::default()
        };
        assert!(state.tick(false, None, &mut backend, owner).is_err());
        backend.fail_restore = false;
        state.tick(false, None, &mut backend, owner).unwrap();
        assert!(backend.snapshot_owner.is_none());
        assert_eq!(backend.apply_calls, 0);
    }

    #[test]
    fn owner_argument_accepts_only_bounded_numeric_tokens() {
        assert!(validate_owner_token(&owner()).is_ok());
        assert!(validate_owner_token(&new_owner_token(200)).is_ok());
        for invalid in [
            "turbo_gaming",
            "gs-0-2-3-4",
            "gs-1-2-3",
            "gs-1-2-3-4 extra",
            "gs-1-2-3-4;whoami",
            "gs-1-2-3-4-5",
        ] {
            assert!(validate_owner_token(invalid).is_err(), "{invalid}");
        }
    }
}
