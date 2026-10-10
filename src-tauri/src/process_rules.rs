//! Opt-in priority rules: "whenever this program runs, give it this priority".
//!
//! Only programs the user picks, never Windows' own, never a game that
//! manages its own performance, and never above High: Realtime can starve the
//! input and audio threads of the whole machine, so it is not offered at all.
//!
//! Each change is made once per process instance and journaled first, in a
//! file per process (PID plus kernel creation time), with the priority it
//! had. Restoring puts that priority back only while the process still has
//! exactly the one this app set; a process someone else changed is left
//! alone. Restores run when a rule is removed or turned off, when the app
//! exits, and on the next launch after a crash. While a game that manages its
//! own performance is running, the engine opens no process at all.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

static LOCK: Mutex<()> = Mutex::new(());
static RUNNING: AtomicBool = AtomicBool::new(false);
static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);
static OWNER_CREATION: AtomicU64 = AtomicU64::new(0);
static STATUS: Mutex<EngineStatus> = Mutex::new(EngineStatus {
    paused: false,
    active_processes: 0,
    pending_restore: 0,
    last_error: None,
});

#[derive(Clone, Default)]
struct EngineStatus {
    paused: bool,
    active_processes: usize,
    pending_restore: usize,
    last_error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Priority {
    Idle,
    BelowNormal,
    Normal,
    AboveNormal,
    High,
}

impl Priority {
    /// The Windows priority class value. Realtime (0x100) has no variant.
    pub fn class(self) -> u32 {
        match self {
            Priority::Idle => 0x40,
            Priority::BelowNormal => 0x4000,
            Priority::Normal => 0x20,
            Priority::AboveNormal => 0x8000,
            Priority::High => 0x80,
        }
    }

    fn from_class(class: u32) -> Option<Self> {
        [
            Priority::Idle,
            Priority::BelowNormal,
            Priority::Normal,
            Priority::AboveNormal,
            Priority::High,
        ]
        .into_iter()
        .find(|p| p.class() == class)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PriorityRule {
    pub path: String,
    pub name: String,
    pub priority: Priority,
}

#[derive(Serialize, Deserialize, Default)]
struct Config {
    enabled: bool,
    rules: Vec<PriorityRule>,
}

/// Mirrors `PriorityRulesStatus` in src/types.ts.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityRulesStatus {
    pub enabled: bool,
    pub engine_running: bool,
    /// Waiting for a game that manages its own performance to close.
    pub paused: bool,
    pub rules: Vec<PriorityRule>,
    pub active_processes: usize,
    pub pending_restore: usize,
    pub last_error: Option<String>,
}

fn config_path(dir: &Path) -> PathBuf {
    dir.join("priority_rules.json")
}

fn load_config(dir: &Path) -> Result<Config, String> {
    match std::fs::read(config_path(dir)) {
        Ok(bytes) => {
            serde_json::from_slice(&bytes).map_err(|e| format!("Priority rules are invalid: {e}"))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Config::default()),
        Err(e) => Err(format!("Cannot read priority rules: {e}")),
    }
}

fn save_config(dir: &Path, config: &Config) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let bytes = serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?;
    let temp = dir.join(format!("priority_rules.json.{}.tmp", std::process::id()));
    std::fs::write(&temp, bytes).map_err(|e| e.to_string())?;
    crate::rollback::replace_file(&temp, &config_path(dir)).map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        e.to_string()
    })
}

/// A lower-case, full local `.exe` path, or `None`.
fn path_key(path: &str) -> Option<String> {
    if path.contains('\0') {
        return None;
    }
    let path = path.replace('/', "\\");
    let path = path.strip_prefix(r"\\?\").unwrap_or(&path);
    let bytes = path.as_bytes();
    if bytes.len() < 7
        || !bytes[0].is_ascii_alphabetic()
        || bytes[1] != b':'
        || bytes[2] != b'\\'
        || !path.to_ascii_lowercase().ends_with(".exe")
        || path.split('\\').any(|part| part == "." || part == "..")
    {
        return None;
    }
    Some(path.to_lowercase())
}

/// Why a program may not have a rule: Windows itself, security software, a
/// Store app, or a game that manages its own performance.
fn refusal(key: &str, protected: bool) -> Option<String> {
    if key.contains(r"\windows\")
        || key.contains(r"\windows defender\")
        || key.contains(r"\microsoft defender\")
        || key.contains(r"\program files\windowsapps\")
    {
        return Some("Windows and security programs keep the priority Windows gives them".into());
    }
    protected.then(crate::process_guard::self_managed_error)
}

fn selected_executable(path: &str) -> Result<(String, String), String> {
    let requested = Path::new(path);
    if !requested.is_absolute() || !requested.is_file() {
        return Err("Select an existing program using its full path".to_string());
    }
    let canonical = requested.canonicalize().map_err(|e| e.to_string())?;
    let canonical = canonical
        .to_str()
        .ok_or("Program path is not valid Unicode")?;
    let key = path_key(canonical).ok_or("Select a local .exe file")?;
    if let Some(reason) = refusal(&key, crate::process_guard::is_protected_executable(&key)) {
        return Err(reason);
    }
    Ok((canonical.to_string(), key))
}

#[tauri::command]
pub fn priority_rules_status(app: tauri::AppHandle) -> Result<PriorityRulesStatus, String> {
    let dir = crate::store_for_dir(&app)?;
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let config = load_config(&dir)?;
    let status = STATUS.lock().map_err(|e| e.to_string())?.clone();
    Ok(PriorityRulesStatus {
        enabled: config.enabled,
        engine_running: RUNNING.load(Ordering::Relaxed),
        paused: status.paused,
        rules: config.rules,
        active_processes: status.active_processes,
        pending_restore: status.pending_restore,
        last_error: status.last_error,
    })
}

#[tauri::command]
pub fn priority_rules_add(
    app: tauri::AppHandle,
    path: String,
    priority: Priority,
) -> Result<PriorityRule, String> {
    let dir = crate::store_for_dir(&app)?;
    crate::require_pro(&dir)?;
    let (path, key) = selected_executable(&path)?;
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir)?;
    if config
        .rules
        .iter()
        .any(|r| path_key(&r.path).as_deref() == Some(key.as_str()))
    {
        return Err("This program already has a priority rule".to_string());
    }
    let name = Path::new(&path)
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let rule = PriorityRule {
        path,
        name,
        priority,
    };
    config.rules.push(rule.clone());
    save_config(&dir, &config)?;
    Ok(rule)
}

/// Changing a rule's level needs Pro, like adding one. A running process is
/// put back to its own priority and then given the new level on the next
/// pass, through the same journal.
#[tauri::command]
pub fn priority_rules_set_priority(
    app: tauri::AppHandle,
    path: String,
    priority: Priority,
) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    crate::require_pro(&dir)?;
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir)?;
    let key = path_key(&path);
    let rule = config
        .rules
        .iter_mut()
        .find(|r| key.is_some() && path_key(&r.path) == key)
        .ok_or("This program has no priority rule")?;
    rule.priority = priority;
    save_config(&dir, &config)
}

/// Removing and turning off never need Pro: they lead to a restore.
#[tauri::command]
pub fn priority_rules_remove(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir)?;
    let key = path_key(&path);
    config.rules.retain(|r| {
        !r.path.eq_ignore_ascii_case(&path) && !(key.is_some() && path_key(&r.path) == key)
    });
    save_config(&dir, &config)
}

#[tauri::command]
pub fn priority_rules_set_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    if enabled {
        crate::require_pro(&dir)?;
    }
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir)?;
    config.enabled = enabled;
    save_config(&dir, &config)
}

/* ---------------------------------------------------------------- *
 * Recovery journal: one file per process this app changed.
 * ---------------------------------------------------------------- */

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Hash)]
struct Identity {
    pid: u32,
    creation: u64,
    executable: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct Recovery {
    identity: Identity,
    original: u32,
    applied: u32,
    owner_pid: u32,
    owner_creation: u64,
}

fn recovery_dir(dir: &Path) -> PathBuf {
    dir.join("priority_recovery")
}

fn recovery_path(dir: &Path, id: &Identity) -> PathBuf {
    recovery_dir(dir).join(format!("{}-{}.json", id.pid, id.creation))
}

/// Records are user-writable input: anything that does not describe exactly
/// one supported priority change is refused, never acted on.
fn valid(path: &Path, dir: &Path, r: &Recovery) -> bool {
    path == recovery_path(dir, &r.identity)
        && r.identity.pid != 0
        && r.identity.creation != 0
        && r.owner_pid != 0
        && r.owner_creation != 0
        && path_key(&r.identity.executable).as_deref() == Some(r.identity.executable.as_str())
        && Priority::from_class(r.original).is_some()
        && Priority::from_class(r.applied).is_some()
        && r.original != r.applied
}

fn read_recoveries(dir: &Path) -> Result<Vec<(PathBuf, Recovery)>, String> {
    let entries = match std::fs::read_dir(recovery_dir(dir)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("Cannot inspect priority recovery: {e}")),
    };
    let mut out = Vec::new();
    for entry in entries {
        let path = entry.map_err(|e| e.to_string())?.path();
        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        let record: Recovery = serde_json::from_slice(&bytes)
            .map_err(|e| format!("Invalid priority recovery record: {e}"))?;
        if !valid(&path, dir, &record) {
            return Err("Invalid priority recovery record".to_string());
        }
        out.push((path, record));
    }
    Ok(out)
}

fn save_recovery(dir: &Path, record: &Recovery) -> Result<(), String> {
    use std::io::Write;
    std::fs::create_dir_all(recovery_dir(dir)).map_err(|e| e.to_string())?;
    let path = recovery_path(dir, &record.identity);
    let bytes = serde_json::to_vec(record).map_err(|e| e.to_string())?;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    let result = file.write_all(&bytes).and_then(|_| file.sync_all());
    drop(file);
    if result.is_err() {
        let _ = std::fs::remove_file(&path);
    }
    result.map_err(|e| e.to_string())
}

#[derive(Debug, PartialEq, Eq)]
enum Decision {
    /// Gone, reused, or never changed: drop the record.
    Forget,
    /// Still exactly as this app left it: put the original back.
    PutBack,
    /// Someone else changed it since: their choice, record dropped.
    ExternalChange,
}

/// Pure: what to do with a record, given the process now (creation time and
/// priority class), or `None` when it has exited.
fn restore_decision(saved: &Recovery, now: Option<(u64, u32)>) -> Decision {
    match now {
        None => Decision::Forget,
        Some((creation, _)) if creation != saved.identity.creation => Decision::Forget,
        Some((_, class)) if class == saved.original => Decision::Forget,
        Some((_, class)) if class == saved.applied => Decision::PutBack,
        Some(_) => Decision::ExternalChange,
    }
}

#[cfg(windows)]
mod native {
    use crate::process_guard::{self, Access, OpenError, ProcessHandle};
    use windows_sys::Win32::Foundation::FILETIME;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, GetPriorityClass, GetProcessTimes, SetPriorityClass,
    };

    /// Opened through the guard with set-information rights, used here for
    /// the scheduling priority and nothing else.
    pub(super) struct Process(ProcessHandle);

    fn creation_of(handle: windows_sys::Win32::Foundation::HANDLE) -> Option<u64> {
        let mut t: [FILETIME; 4] = unsafe { std::mem::zeroed() };
        let [a, b, c, d] = &mut t;
        // SAFETY: the handle is live; all four out-parameters are live.
        let ok = unsafe { GetProcessTimes(handle, a, b, c, d) } != 0;
        let value = (u64::from(t[0].dwHighDateTime) << 32) | u64::from(t[0].dwLowDateTime);
        (ok && value != 0).then_some(value)
    }

    impl Process {
        pub(super) fn open(pid: u32) -> Result<Option<Self>, String> {
            match process_guard::open(pid, Access::Priority) {
                Ok(handle) => Ok(Some(Self(handle))),
                Err(OpenError::Gone) => Ok(None),
                Err(error) => Err(format!("process {pid} could not be opened: {error}")),
            }
        }

        pub(super) fn creation(&self) -> Option<u64> {
            creation_of(self.0.raw())
        }

        pub(super) fn class(&self) -> u32 {
            // SAFETY: the handle carries query rights.
            unsafe { GetPriorityClass(self.0.raw()) }
        }

        pub(super) fn set_class(&self, class: u32) -> Result<(), String> {
            // SAFETY: the handle carries set-information rights.
            if unsafe { SetPriorityClass(self.0.raw(), class) } == 0 {
                return Err(format!(
                    "Windows refused the priority change: {}",
                    std::io::Error::last_os_error()
                ));
            }
            Ok(())
        }
    }

    pub(super) fn own_creation() -> Option<u64> {
        // SAFETY: the pseudo-handle needs no closing.
        creation_of(unsafe { GetCurrentProcess() })
    }
}

#[cfg(windows)]
/// Returns whether the original priority was put back (as opposed to a
/// record forgotten because the process is gone or someone else changed it).
fn restore_record(path: &Path, record: &Recovery) -> Result<bool, String> {
    let process = native::Process::open(record.identity.pid)?;
    let now = process
        .as_ref()
        .and_then(|p| p.creation().map(|creation| (creation, p.class())));
    let decision = restore_decision(record, now);
    if decision == Decision::PutBack {
        let process = process.expect("a live process was observed");
        process.set_class(record.original)?;
        if process.class() != record.original {
            return Err("the restored priority did not stick".to_string());
        }
        crate::process_guard::audit(
            "priority-restored",
            "restored",
            true,
            None,
        );
    }
    std::fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(decision == Decision::PutBack)
}

/// One pass. `shutting_down` restores everything this instance changed.
#[cfg(windows)]
fn tick(
    dir: &Path,
    owner_creation: u64,
    handled: &mut HashSet<(u32, u64)>,
    paused: bool,
    shutting_down: bool,
) -> Result<EngineStatus, String> {
    let mut status = EngineStatus::default();
    let records = read_recoveries(dir)?;
    if paused && !shutting_down {
        status.paused = true;
        status.active_processes = records.len();
        return Ok(status);
    }
    let config = load_config(dir)?;
    let active = config.enabled
        && !shutting_down
        && !SHUTTING_DOWN.load(Ordering::SeqCst)
        && crate::require_pro(dir).is_ok();
    let table = crate::process_guard::processes()?;
    let alive =
        |pid: u32, creation: u64| table.iter().any(|p| p.pid == pid && p.created == creation);
    let owner_pid = std::process::id();
    let rule_for = |key: &str| {
        config
            .rules
            .iter()
            .find(|r| path_key(&r.path).as_deref() == Some(key))
    };

    let mut owned: HashSet<(u32, u64)> = HashSet::new();
    for (path, record) in &records {
        let mine = record.owner_pid == owner_pid && record.owner_creation == owner_creation;
        if !mine && alive(record.owner_pid, record.owner_creation) {
            status.last_error =
                Some("Another PC Tweaker process owns these priority changes".into());
            continue;
        }
        let still_wanted = mine
            && active
            && alive(record.identity.pid, record.identity.creation)
            && rule_for(&record.identity.executable)
                .is_some_and(|r| r.priority.class() == record.applied);
        if still_wanted {
            owned.insert((record.identity.pid, record.identity.creation));
            status.active_processes += 1;
            continue;
        }
        match restore_record(path, record) {
            // Put back by this app: a rule that now asks for another level
            // (or was turned back on) gets its turn below instead of waiting
            // for a restart. A priority someone else set is left as it is.
            Ok(true) => {
                handled.remove(&(record.identity.pid, record.identity.creation));
            }
            Ok(false) => {}
            Err(e) => status.last_error = Some(e),
        }
    }
    status.pending_restore = read_recoveries(dir)?
        .len()
        .saturating_sub(status.active_processes);
    handled.retain(|(pid, creation)| alive(*pid, *creation));
    if !active {
        return Ok(status);
    }

    let mut changed = 0usize;
    let candidates: Vec<_> = table
        .iter()
        .filter(|p| {
            !handled.contains(&(p.pid, p.created))
                && !owned.contains(&(p.pid, p.created))
                && config.rules.iter().any(|r| {
                    r.path
                        .rsplit(['\\', '/'])
                        .next()
                        .is_some_and(|n| n.eq_ignore_ascii_case(&p.name))
                })
        })
        .collect();
    for process in candidates {
        // Handled once per process instance, whatever the outcome: a process
        // is never reopened every few seconds.
        handled.insert((process.pid, process.created));
        let Some(key) = crate::process_guard::image_path(process.pid)
            .and_then(|p| std::fs::canonicalize(p).ok())
            .and_then(|p| p.to_str().and_then(path_key))
        else {
            continue;
        };
        let Some(rule) = rule_for(&key) else { continue };
        if crate::process_guard::is_protected_executable(&key) {
            continue;
        }
        let Ok(Some(handle)) = native::Process::open(process.pid) else {
            continue;
        };
        if handle.creation() != Some(process.created) {
            continue;
        }
        let original = handle.class();
        let wanted = rule.priority.class();
        if original == wanted || Priority::from_class(original).is_none() {
            // Already there, or Realtime set by someone else: not ours.
            continue;
        }
        let record = Recovery {
            identity: Identity {
                pid: process.pid,
                creation: process.created,
                executable: key,
            },
            original,
            applied: wanted,
            owner_pid,
            owner_creation,
        };
        save_recovery(dir, &record)?;
        // Journaled first; now the only write.
        match handle.set_class(wanted) {
            Ok(()) if handle.class() == wanted => {
                changed += 1;
                status.active_processes += 1;
            }
            Ok(()) => status.last_error = Some("A priority change did not stick".into()),
            Err(e) => status.last_error = Some(e),
        }
    }
    if changed > 0 {
        crate::process_guard::audit(
            "priority-applied",
            &format!("{changed} processes"),
            true,
            None,
        );
    }
    Ok(status)
}

pub fn start(app: tauri::AppHandle) {
    if RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    SHUTTING_DOWN.store(false, Ordering::SeqCst);
    #[cfg(windows)]
    std::thread::spawn(move || {
        let Some(owner_creation) = native::own_creation() else {
            RUNNING.store(false, Ordering::SeqCst);
            return;
        };
        OWNER_CREATION.store(owner_creation, Ordering::SeqCst);
        let mut handled = HashSet::new();
        loop {
            let result = crate::store_for_dir(&app).and_then(|dir| {
                let paused = crate::process_guard::paused(&dir);
                let _guard = LOCK.lock().map_err(|e| e.to_string())?;
                tick(&dir, owner_creation, &mut handled, paused, false)
            });
            if let Ok(mut status) = STATUS.lock() {
                match result {
                    Ok(next) => *status = next,
                    Err(e) => status.last_error = Some(e),
                }
            }
            if SHUTTING_DOWN.load(Ordering::SeqCst) {
                break;
            }
            std::thread::sleep(Duration::from_secs(3));
        }
        RUNNING.store(false, Ordering::SeqCst);
    });
    #[cfg(not(windows))]
    {
        let _ = app;
        RUNNING.store(false, Ordering::SeqCst);
    }
}

/// On exit: every priority this instance set is put back. Protected processes
/// are refused by the guard itself; the programs here are the user's choice.
#[cfg(windows)]
pub fn stop(app: &tauri::AppHandle) -> Result<(), String> {
    SHUTTING_DOWN.store(true, Ordering::SeqCst);
    let owner_creation = OWNER_CREATION.load(Ordering::SeqCst);
    if owner_creation == 0 {
        return Ok(());
    }
    let dir = crate::store_for_dir(app)?;
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let status = tick(&dir, owner_creation, &mut HashSet::new(), false, true)?;
    if status.pending_restore != 0 {
        return Err(
            "Priority restoration remains pending; it will be retried on next launch".into(),
        );
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn stop(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record() -> Recovery {
        Recovery {
            identity: Identity {
                pid: 100,
                creation: 200,
                executable: r"c:\apps\encoder.exe".into(),
            },
            original: Priority::Normal.class(),
            applied: Priority::High.class(),
            owner_pid: 1,
            owner_creation: 2,
        }
    }

    #[test]
    fn realtime_is_never_offered_and_classes_round_trip() {
        for p in [
            Priority::Idle,
            Priority::BelowNormal,
            Priority::Normal,
            Priority::AboveNormal,
            Priority::High,
        ] {
            assert_eq!(Priority::from_class(p.class()), Some(p));
        }
        assert_eq!(Priority::from_class(0x100), None, "REALTIME_PRIORITY_CLASS");
        assert!(serde_json::from_str::<Priority>("\"realtime\"").is_err());
        assert_eq!(
            serde_json::to_value(Priority::AboveNormal).unwrap(),
            "above_normal"
        );
    }

    #[test]
    fn only_a_process_still_exactly_as_left_is_restored() {
        let r = record();
        let high = Priority::High.class();
        let normal = Priority::Normal.class();
        let below = Priority::BelowNormal.class();
        assert_eq!(restore_decision(&r, Some((200, high))), Decision::PutBack);
        assert_eq!(
            restore_decision(&r, Some((201, high))),
            Decision::Forget,
            "PID reused"
        );
        assert_eq!(
            restore_decision(&r, Some((200, normal))),
            Decision::Forget,
            "already back"
        );
        assert_eq!(
            restore_decision(&r, Some((200, below))),
            Decision::ExternalChange
        );
        assert_eq!(restore_decision(&r, None), Decision::Forget);
    }

    #[test]
    fn windows_security_store_apps_and_self_managed_games_cannot_have_rules() {
        assert!(refusal(r"c:\windows\system32\svchost.exe", false).is_some());
        assert!(refusal(r"c:\program files\windows defender\msmpeng.exe", false).is_some());
        assert!(refusal(r"c:\program files\windowsapps\x\app.exe", false).is_some());
        let game = refusal(r"d:\games\shooter\shooter.exe", true).unwrap();
        assert!(game.starts_with(crate::process_guard::SELF_MANAGED_PREFIX));
        assert!(refusal(r"c:\program files\obs-studio\bin\64bit\obs64.exe", false).is_none());
        assert!(path_key("encoder.exe").is_none());
        assert!(path_key(r"C:\Apps\..\x.exe").is_none());
    }

    #[test]
    fn recovery_records_are_validated_and_written_once() {
        let dir = std::env::temp_dir().join(format!("pct-priority-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let r = record();
        save_recovery(&dir, &r).unwrap();
        assert!(
            save_recovery(&dir, &r).is_err(),
            "a record is never overwritten"
        );
        assert_eq!(
            read_recoveries(&dir).unwrap(),
            vec![(recovery_path(&dir, &r.identity), r.clone())]
        );
        let mut realtime = r.clone();
        realtime.applied = 0x100;
        std::fs::write(
            recovery_path(&dir, &r.identity),
            serde_json::to_vec(&realtime).unwrap(),
        )
        .unwrap();
        assert!(
            read_recoveries(&dir).is_err(),
            "a Realtime record is refused"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The whole native path on a child this test starts: journal, change,
    /// restore on rule removal, and the record gone afterwards.
    #[cfg(windows)]
    #[test]
    fn a_rule_changes_a_running_child_and_its_removal_restores_it() {
        use std::os::windows::process::CommandExt;
        let dir = std::env::temp_dir().join(format!("pct-priority-live-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let mut child = std::process::Command::new("cmd.exe")
            .args(["/c", "ping -n 8 127.0.0.1 >nul"])
            .creation_flags(0x0800_0000)
            .spawn()
            .unwrap();
        let pid = child.id();
        let own = native::own_creation().unwrap();
        let created = crate::process_guard::processes()
            .unwrap()
            .into_iter()
            .find(|p| p.pid == pid)
            .unwrap()
            .created;
        let exe = crate::process_guard::image_path(pid).unwrap();
        let key = path_key(std::fs::canonicalize(&exe).unwrap().to_str().unwrap()).unwrap();
        let process = native::Process::open(pid).unwrap().unwrap();
        let before = process.class();
        let r = Recovery {
            identity: Identity {
                pid,
                creation: created,
                executable: key,
            },
            original: before,
            applied: Priority::BelowNormal.class(),
            owner_pid: std::process::id(),
            owner_creation: own,
        };
        save_recovery(&dir, &r).unwrap();
        process.set_class(r.applied).unwrap();
        assert_eq!(process.class(), r.applied);
        // No rule any more (empty config): the next pass restores it.
        let status = tick(&dir, own, &mut HashSet::new(), false, false).unwrap();
        let after = process.class();
        let _ = child.kill();
        let _ = child.wait();
        assert_eq!(after, before);
        assert_eq!(status.pending_restore, 0);
        assert!(read_recoveries(&dir).unwrap().is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
