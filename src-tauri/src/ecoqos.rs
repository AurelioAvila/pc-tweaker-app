//! Opt-in, process-local EcoQoS rules. The watcher exists only while PC Tweaker is open.
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

static LOCK: Mutex<()> = Mutex::new(());
static ENGINE_RUNNING: AtomicBool = AtomicBool::new(false);
static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);
static OWNER_CREATION: AtomicU64 = AtomicU64::new(0);
static CONFIG_SEQUENCE: AtomicU64 = AtomicU64::new(1);
static ENGINE_STATUS: Mutex<EngineStatus> = Mutex::new(EngineStatus {
    blocked_global: false,
    paused: false,
    active_processes: 0,
    pending_restore: 0,
    last_error: None,
});

#[derive(Clone, Default)]
struct EngineStatus {
    blocked_global: bool,
    /// Waiting for a game that manages its own performance to close.
    paused: bool,
    active_processes: usize,
    pending_restore: usize,
    last_error: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct EcoQosRule {
    pub path: String,
    pub name: String,
}

#[derive(Default, Serialize, Deserialize)]
struct Config {
    enabled: bool,
    rules: Vec<EcoQosRule>,
}

#[derive(Serialize)]
pub struct EcoQosStatus {
    pub enabled: bool,
    pub engine_running: bool,
    pub blocked_global: bool,
    pub paused: bool,
    pub rules: Vec<EcoQosRule>,
    pub active_processes: usize,
    pub pending_restore: usize,
    pub last_error: Option<String>,
}

fn config_path(dir: &Path) -> PathBuf {
    dir.join("ecoqos_rules.json")
}

fn load_config(dir: &Path) -> Result<Config, String> {
    match std::fs::read(config_path(dir)) {
        Ok(bytes) => {
            serde_json::from_slice(&bytes).map_err(|e| format!("EcoQoS rules are invalid: {e}"))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Config::default()),
        Err(e) => Err(format!("Cannot read EcoQoS rules: {e}")),
    }
}

fn save_config(dir: &Path, config: &Config) -> Result<(), String> {
    use std::io::Write;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let bytes = serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?;
    let path = config_path(dir);
    let temp = dir.join(format!(
        "ecoqos_rules.json.{}.{}.tmp",
        std::process::id(),
        CONFIG_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| -> std::io::Result<()> {
        let mut file = std::fs::File::create(&temp)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        drop(file);
        crate::rollback::replace_file(&temp, &path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temp);
    }
    result.map_err(|e| e.to_string())
}

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

fn selected_executable(path: &str) -> Result<(String, String), String> {
    let requested = Path::new(path);
    if !requested.is_absolute() || !requested.is_file() {
        return Err("Select an existing executable using its full path".to_string());
    }
    let canonical = requested.canonicalize().map_err(|e| e.to_string())?;
    let canonical = canonical
        .to_str()
        .ok_or("Executable path is not valid Unicode")?;
    let key = path_key(canonical).ok_or("Select a local .exe file")?;
    if key.contains(r"\windows\")
        || key.contains(r"\windows defender\")
        || key.contains(r"\microsoft defender\")
        || key.contains(r"\program files\windowsapps\")
    {
        return Err("Windows and security processes cannot have EcoQoS rules".to_string());
    }
    if crate::process_guard::is_protected_executable(&key) {
        return Err(crate::process_guard::self_managed_error());
    }
    Ok((canonical.to_string(), key))
}

#[tauri::command]
pub fn ecoqos_status(app: tauri::AppHandle) -> Result<EcoQosStatus, String> {
    let dir = crate::store_for_dir(&app)?;
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let config = load_config(&dir)?;
    let status = ENGINE_STATUS.lock().map_err(|e| e.to_string())?.clone();
    Ok(EcoQosStatus {
        enabled: config.enabled,
        engine_running: ENGINE_RUNNING.load(Ordering::Relaxed),
        blocked_global: status.blocked_global,
        paused: status.paused,
        rules: config.rules,
        active_processes: status.active_processes,
        pending_restore: status.pending_restore,
        last_error: status.last_error,
    })
}

#[tauri::command]
pub fn ecoqos_add_rule(app: tauri::AppHandle, path: String) -> Result<EcoQosRule, String> {
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
        return Err("This executable already has an EcoQoS rule".to_string());
    }
    let name = Path::new(&path)
        .file_stem()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let rule = EcoQosRule { path, name };
    config.rules.push(rule.clone());
    save_config(&dir, &config)?;
    Ok(rule)
}

#[tauri::command]
pub fn ecoqos_remove_rule(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir)?;
    let key = path_key(&path);
    config.rules.retain(|rule| {
        !rule.path.eq_ignore_ascii_case(&path) && !(key.is_some() && path_key(&rule.path) == key)
    });
    save_config(&dir, &config)
}

#[tauri::command]
pub fn ecoqos_set_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    if enabled {
        crate::require_pro(&dir)?;
    }
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&dir)?;
    config.enabled = enabled;
    save_config(&dir, &config)
}

#[derive(Clone, Debug, Eq, PartialEq, Hash, Serialize, Deserialize)]
struct Identity {
    pid: u32,
    creation: u64,
    executable: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
struct Masks {
    version: u32,
    control: u32,
    state: u32,
}

const EXECUTION_SPEED: u32 = 1;

fn enabled_mask(original: Masks) -> Masks {
    Masks {
        version: original.version,
        control: original.control | EXECUTION_SPEED,
        state: original.state | EXECUTION_SPEED,
    }
}

#[derive(Serialize, Deserialize)]
struct Recovery {
    identity: Identity,
    original: Masks,
    applied: Masks,
    owner_pid: u32,
    owner_creation: u64,
}

fn recovery_dir(dir: &Path) -> PathBuf {
    dir.join("ecoqos_recovery")
}

fn recovery_path(dir: &Path, id: &Identity) -> PathBuf {
    recovery_dir(dir).join(format!("{}-{}.json", id.pid, id.creation))
}

fn read_recoveries(dir: &Path) -> Result<Vec<(PathBuf, Recovery)>, String> {
    let mut result = Vec::new();
    let entries = match std::fs::read_dir(recovery_dir(dir)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(result),
        Err(e) => return Err(format!("Cannot inspect EcoQoS recovery: {e}")),
    };
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_file() {
            return Err("Unexpected entry in EcoQoS recovery directory".to_string());
        }
        let path = entry.path();
        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        let record: Recovery = serde_json::from_slice(&bytes)
            .map_err(|e| format!("Invalid EcoQoS recovery record: {e}"))?;
        if path != recovery_path(dir, &record.identity)
            || record.identity.pid == 0
            || record.identity.creation == 0
            || record.owner_pid == 0
            || record.owner_creation == 0
            || path_key(&record.identity.executable).as_deref()
                != Some(record.identity.executable.as_str())
            || record.original.version != 1
            || record.original.control & EXECUTION_SPEED != 0
            || record.original.state & EXECUTION_SPEED != 0
            || record.applied != enabled_mask(record.original)
        {
            return Err("Invalid EcoQoS recovery ownership".to_string());
        }
        result.push((path, record));
    }
    Ok(result)
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

// Exact ownership checks decide whether a prior state may be restored.
fn restore_decision(saved: &Recovery, actual: Option<(&Identity, Masks)>) -> RestoreDecision {
    match actual {
        None => RestoreDecision::Forget,
        Some((id, _)) if id != &saved.identity => RestoreDecision::Forget,
        Some((_, masks)) if masks == saved.original => RestoreDecision::Forget,
        Some((_, masks)) if masks == saved.applied => RestoreDecision::Restore,
        Some(_) => RestoreDecision::ExternalChange,
    }
}

#[derive(Debug, PartialEq, Eq)]
enum RestoreDecision {
    Forget,
    Restore,
    ExternalChange,
}

#[cfg(windows)]
mod native {
    use super::{path_key, Identity, Masks};
    use crate::process_guard::{self, Access, OpenError, ProcessHandle};
    use std::mem::size_of;
    use windows_sys::Win32::Foundation::{FILETIME, HANDLE};
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, GetProcessInformation, GetProcessTimes, ProcessPowerThrottling,
        SetProcessInformation, PROCESS_POWER_THROTTLING_CURRENT_VERSION,
        PROCESS_POWER_THROTTLING_STATE,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };

    /// Opened through the guard: query-limited to read, plus set-information
    /// (scheduling priority) only for the moment of a write.
    pub(super) struct Process(ProcessHandle);

    fn creation(handle: HANDLE) -> Result<u64, String> {
        let mut created = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut exit = created;
        let mut kernel = created;
        let mut user = created;
        if unsafe { GetProcessTimes(handle, &mut created, &mut exit, &mut kernel, &mut user) } == 0
        {
            return Err(format!(
                "GetProcessTimes: {}",
                std::io::Error::last_os_error()
            ));
        }
        Ok(((created.dwHighDateTime as u64) << 32) | created.dwLowDateTime as u64)
    }

    impl Process {
        pub(super) fn open(pid: u32, write: bool) -> Result<Option<Self>, String> {
            let access = if write { Access::Priority } else { Access::Query };
            match process_guard::open(pid, access) {
                Ok(handle) => Ok(Some(Self(handle))),
                Err(OpenError::Gone) => Ok(None),
                Err(error) => Err(format!("process {pid} could not be opened: {error}")),
            }
        }

        pub(super) fn creation(&self) -> Result<u64, String> {
            creation(self.0.raw())
        }

        /// PID, kernel creation time and canonical path. The path comes from
        /// the kernel's process table, not from this handle.
        pub(super) fn identity(&self, pid: u32) -> Result<Identity, String> {
            let name = process_guard::image_path(pid).ok_or("Process path is unavailable")?;
            let canonical = std::fs::canonicalize(&name).map_err(|e| e.to_string())?;
            let executable = path_key(
                canonical
                    .to_str()
                    .ok_or("Process path is not valid Unicode")?,
            )
            .ok_or("Process path is not a local executable")?;
            Ok(Identity {
                pid,
                creation: creation(self.0.raw())?,
                executable,
            })
        }

        pub(super) fn masks(&self) -> Result<Masks, String> {
            let mut state = PROCESS_POWER_THROTTLING_STATE {
                Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
                ControlMask: 0,
                StateMask: 0,
            };
            if unsafe {
                GetProcessInformation(
                    self.0.raw(),
                    ProcessPowerThrottling,
                    &mut state as *mut _ as _,
                    size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
                )
            } == 0
            {
                return Err(format!(
                    "GetProcessInformation: {}",
                    std::io::Error::last_os_error()
                ));
            }
            Ok(Masks {
                version: state.Version,
                control: state.ControlMask,
                state: state.StateMask,
            })
        }

        pub(super) fn set_masks(&self, masks: Masks) -> Result<(), String> {
            let state = PROCESS_POWER_THROTTLING_STATE {
                Version: masks.version,
                ControlMask: masks.control,
                StateMask: masks.state,
            };
            if unsafe {
                SetProcessInformation(
                    self.0.raw(),
                    ProcessPowerThrottling,
                    &state as *const _ as _,
                    size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
                )
            } == 0
            {
                return Err(format!(
                    "SetProcessInformation: {}",
                    std::io::Error::last_os_error()
                ));
            }
            Ok(())
        }
    }

    pub(super) fn own_creation() -> Result<u64, String> {
        creation(unsafe { GetCurrentProcess() })
    }

    pub(super) fn foreground_pid() -> Option<u32> {
        let window = unsafe { GetForegroundWindow() };
        if window.is_null() {
            return None;
        }
        let mut pid = 0;
        unsafe { GetWindowThreadProcessId(window, &mut pid) };
        (pid != 0).then_some(pid)
    }

    pub(super) fn supported() -> Result<bool, String> {
        use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ};
        use winreg::RegKey;
        let key = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey_with_flags(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion", KEY_READ)
            .map_err(|e| e.to_string())?;
        let build: String = key
            .get_value("CurrentBuildNumber")
            .map_err(|e| e.to_string())?;
        Ok(build.parse::<u32>().map_err(|e| e.to_string())? >= 22000)
    }

    pub(super) fn blocked_global() -> Result<bool, String> {
        use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ};
        use winreg::RegKey;
        let key = match RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(
            r"SYSTEM\CurrentControlSet\Control\Power\PowerThrottling",
            KEY_READ,
        ) {
            Ok(key) => key,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
            Err(e) => return Err(e.to_string()),
        };
        match key.get_value::<u32, _>("PowerThrottlingOff") {
            Ok(value) => Ok(value == 1),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(e.to_string()),
        }
    }

    pub(super) fn valid_version(masks: Masks) -> bool {
        masks.version == PROCESS_POWER_THROTTLING_CURRENT_VERSION
    }
}

/// The foreground process and the processes that started it, read from the
/// handle-free process table.
#[cfg(windows)]
fn foreground_ancestors(table: &[crate::process_guard::ProcessInfo]) -> HashSet<u32> {
    let mut result = HashSet::new();
    let Some(mut pid) = native::foreground_pid() else {
        return result;
    };
    for _ in 0..32 {
        if !result.insert(pid) {
            break;
        }
        let Some(process) = table.iter().find(|p| p.pid == pid) else {
            break;
        };
        let Some(parent) = process.parent else {
            break;
        };
        let Some(parent_process) = table.iter().find(|p| p.pid == parent) else {
            break;
        };
        if parent_process.created == 0 || parent_process.created > process.created {
            break;
        }
        pid = parent;
    }
    result
}

#[cfg(windows)]
fn restore_record(
    path: &Path,
    record: &Recovery,
    suppressed: &mut HashSet<Identity>,
) -> Result<bool, String> {
    let actual = match native::Process::open(record.identity.pid, true)? {
        Some(process) => {
            if process.creation()? != record.identity.creation {
                std::fs::remove_file(path).map_err(|e| e.to_string())?;
                return Ok(false);
            }
            // The verified PID plus kernel creation time identifies the same
            // process even if its executable file was renamed or removed.
            let id = record.identity.clone();
            let masks = process.masks()?;
            Some((process, id, masks))
        }
        None => None,
    };
    let decision = restore_decision(record, actual.as_ref().map(|(_, id, masks)| (id, *masks)));
    match decision {
        RestoreDecision::Restore => {
            let (process, _, _) = actual.unwrap();
            process.set_masks(record.original)?;
            if process.masks()? != record.original {
                return Err("EcoQoS restoration did not reproduce the saved masks".to_string());
            }
            crate::process_guard::audit(
                "ecoqos-restored",
                "restored",
                true,
                None,
            );
        }
        RestoreDecision::ExternalChange => {
            suppressed.insert(record.identity.clone());
        }
        RestoreDecision::Forget => {}
    }
    std::fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(decision == RestoreDecision::Restore)
}

/// Whether `name` is the file name of one of the rule paths.
fn named_like_a_rule(rule_keys: &[String], name: &str) -> bool {
    rule_keys
        .iter()
        .any(|k| k.rsplit('\\').next().is_some_and(|n| n.eq_ignore_ascii_case(name)))
}

/// One pass of the engine. `paused` freezes it: while a game that manages its
/// own performance runs, no process is opened, so nothing new is applied and
/// nothing applied is verified or restored until that game has closed.
#[cfg(windows)]
fn tick(
    dir: &Path,
    owner_creation: u64,
    suppressed: &mut HashSet<Identity>,
    paused: bool,
) -> Result<EngineStatus, String> {
    let mut status = EngineStatus::default();
    let config = match load_config(dir) {
        Ok(config) => config,
        Err(e) => {
            status.last_error = Some(e);
            Config::default()
        }
    };
    let supported = match native::supported() {
        Ok(value) => value,
        Err(e) => {
            status.last_error = Some(e);
            false
        }
    };
    let blocked_global = match native::blocked_global() {
        Ok(value) => value,
        Err(e) => {
            status.last_error = Some(e);
            true
        }
    };
    status.blocked_global = blocked_global;
    let records = read_recoveries(dir)?;
    if paused {
        status.paused = true;
        status.active_processes = records.len();
        return Ok(status);
    }
    let allowed = supported
        && !blocked_global
        && !SHUTTING_DOWN.load(Ordering::SeqCst)
        && config.enabled
        && crate::require_pro(dir).is_ok();
    let table = crate::process_guard::processes();
    let refreshed = table.is_ok();
    if !refreshed {
        // Without the table, another live instance's records would look
        // orphaned. Nothing is decided on a failed read.
        status.active_processes = records.len();
        status.last_error = Some("The process list could not be read".to_string());
        return Ok(status);
    }
    let table = table.unwrap_or_default();
    let foreground = foreground_ancestors(&table);
    let owner_pid = std::process::id();
    let rule_keys: Vec<String> = config.rules.iter().filter_map(|r| path_key(&r.path)).collect();
    let mut observed = HashMap::new();
    if refreshed {
        // Only processes named like a rule have their path resolved, and the
        // path comes from the kernel by PID: nothing is opened to find them.
        for process in table.iter().filter(|p| named_like_a_rule(&rule_keys, &p.name)) {
            let Some(exe) = crate::process_guard::image_path(process.pid) else {
                continue;
            };
            let Ok(canonical) = std::fs::canonicalize(exe) else {
                continue;
            };
            let Some(key) = canonical.to_str().and_then(path_key) else {
                continue;
            };
            if rule_keys.contains(&key) && !crate::process_guard::is_protected_executable(&key) {
                observed.insert(process.pid, key);
            }
        }
    }
    let mut owned = HashSet::new();
    let mut recovery_failed = false;
    for (path, record) in &records {
        let owner_is_self =
            record.owner_pid == owner_pid && record.owner_creation == owner_creation;
        if !owner_is_self {
            // Another live PC Tweaker instance retains ownership. Avoid two
            // watchers racing. Answered from the process table, not a handle.
            let old_owner_alive = table
                .iter()
                .any(|p| p.pid == record.owner_pid && p.created == record.owner_creation);
            if old_owner_alive {
                recovery_failed = true;
                status.last_error =
                    Some("Another PC Tweaker process owns EcoQoS recovery".to_string());
                continue;
            }
        }
        let desired = owner_is_self
            && allowed
            && refreshed
            && observed.get(&record.identity.pid) == Some(&record.identity.executable)
            && !foreground.contains(&record.identity.pid);
        // Still the same process instance, read from the process table: no
        // handle is opened every few seconds to re-check it. A mask someone
        // else changed meanwhile is caught when it is restored, which compares
        // before it writes.
        if desired
            && table
                .iter()
                .any(|p| p.pid == record.identity.pid && p.created == record.identity.creation)
        {
            owned.insert(record.identity.clone());
            status.active_processes += 1;
            continue;
        }
        if let Err(e) = restore_record(path, record, suppressed) {
            status.last_error = Some(e);
            recovery_failed = true;
        }
    }
    status.pending_restore = read_recoveries(dir)?
        .len()
        .saturating_sub(status.active_processes);
    if recovery_failed {
        return Ok(status);
    }
    if !allowed || !refreshed {
        if !supported && status.last_error.is_none() {
            status.last_error = Some("EcoQoS requires Windows 11".to_string());
        }
        return Ok(status);
    }
    suppressed.retain(|id| {
        table
            .iter()
            .any(|p| p.pid == id.pid && p.created == id.creation)
            && observed.get(&id.pid) == Some(&id.executable)
    });
    let mut applied_now = 0usize;
    for (pid, key) in observed {
        if foreground.contains(&pid) {
            continue;
        }
        let created = table.iter().find(|p| p.pid == pid).map_or(0, |p| p.created);
        if owned.iter().chain(suppressed.iter()).any(|id| id.pid == pid && id.creation == created) {
            // Already handled for this process instance: nothing is reopened.
            continue;
        }
        let Ok(Some(process)) = native::Process::open(pid, true) else {
            continue;
        };
        let Ok(identity) = process.identity(pid) else {
            continue;
        };
        if identity.executable != key || owned.contains(&identity) || suppressed.contains(&identity)
        {
            continue;
        }
        let Ok(original) = process.masks() else {
            continue;
        };
        if !native::valid_version(original)
            || original.control & EXECUTION_SPEED != 0
            || original.state & EXECUTION_SPEED != 0
        {
            continue;
        }
        let applied = enabled_mask(original);
        let record = Recovery {
            identity,
            original,
            applied,
            owner_pid,
            owner_creation,
        };
        save_recovery(dir, &record)?;
        // The durable record precedes the only OS write. Any failure leaves it
        // for the next tick or the next launch, with exact identity checks.
        if let Err(e) = process.set_masks(applied) {
            suppressed.insert(record.identity);
            return Err(e);
        }
        if process.masks()? != applied {
            suppressed.insert(record.identity);
            return Err("EcoQoS write did not match its saved ownership state".to_string());
        }
        status.active_processes += 1;
        applied_now += 1;
    }
    if applied_now > 0 {
        crate::process_guard::audit(
            "ecoqos-applied",
            &format!("{applied_now} processes"),
            true,
            None,
        );
    }
    status.pending_restore = read_recoveries(dir)?
        .len()
        .saturating_sub(status.active_processes);
    Ok(status)
}

pub fn start(app: tauri::AppHandle) {
    if ENGINE_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    SHUTTING_DOWN.store(false, Ordering::SeqCst);
    #[cfg(windows)]
    std::thread::spawn(move || {
        let owner_creation = match native::own_creation() {
            Ok(time) => time,
            Err(e) => {
                if let Ok(mut status) = ENGINE_STATUS.lock() {
                    status.last_error = Some(e);
                }
                ENGINE_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };
        OWNER_CREATION.store(owner_creation, Ordering::SeqCst);
        let mut suppressed = HashSet::new();
        loop {
            let result = crate::store_for_dir(&app).and_then(|dir| {
                let paused = crate::process_guard::paused(&dir);
                let _guard = LOCK.lock().map_err(|e| e.to_string())?;
                tick(&dir, owner_creation, &mut suppressed, paused)
            });
            if let Ok(mut status) = ENGINE_STATUS.lock() {
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
        ENGINE_RUNNING.store(false, Ordering::SeqCst);
    });
    #[cfg(not(windows))]
    {
        let _ = app;
        ENGINE_RUNNING.store(false, Ordering::SeqCst);
    }
}

/// Call during the application's Exit event. Crash recovery covers abrupt exits.
#[cfg(windows)]
pub fn stop(app: &tauri::AppHandle) -> Result<(), String> {
    SHUTTING_DOWN.store(true, Ordering::SeqCst);
    let owner_creation = OWNER_CREATION.load(Ordering::SeqCst);
    if owner_creation == 0 {
        return Ok(());
    }
    let dir = crate::store_for_dir(app)?;
    let _guard = LOCK.lock().map_err(|e| e.to_string())?;
    let mut suppressed = HashSet::new();
    // On exit the app restores what it changed even during a protected
    // session: protected processes are refused by the guard itself, and the
    // apps restored here are the ones the user chose.
    let status = tick(&dir, owner_creation, &mut suppressed, false)?;
    if status.pending_restore != 0 {
        return Err(
            "EcoQoS restoration remains pending; it will be retried on next launch".to_string(),
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

    fn id(pid: u32, creation: u64) -> Identity {
        Identity {
            pid,
            creation,
            executable: r"c:\apps\worker.exe".to_string(),
        }
    }
    fn record() -> Recovery {
        let original = Masks {
            version: 1,
            control: 0,
            state: 0,
        };
        Recovery {
            identity: id(100, 200),
            original,
            applied: enabled_mask(original),
            owner_pid: 1,
            owner_creation: 2,
        }
    }

    #[test]
    fn ownership_requires_same_path_pid_creation_and_exact_masks() {
        let saved = record();
        assert_eq!(
            restore_decision(&saved, Some((&id(100, 200), saved.applied))),
            RestoreDecision::Restore
        );
        assert_eq!(
            restore_decision(&saved, Some((&id(100, 201), saved.applied))),
            RestoreDecision::Forget
        );
        assert_eq!(
            restore_decision(&saved, Some((&id(101, 200), saved.applied))),
            RestoreDecision::Forget
        );
        assert_eq!(
            restore_decision(&saved, Some((&id(100, 200), saved.original))),
            RestoreDecision::Forget
        );
        assert_eq!(
            restore_decision(
                &saved,
                Some((
                    &id(100, 200),
                    Masks {
                        state: 0,
                        ..saved.applied
                    }
                ))
            ),
            RestoreDecision::ExternalChange
        );
        assert_eq!(restore_decision(&saved, None), RestoreDecision::Forget);
    }

    #[test]
    fn apply_preserves_unrelated_mask_bits_and_paths_must_be_full() {
        let original = Masks {
            version: 1,
            control: 2,
            state: 2,
        };
        assert_eq!(
            enabled_mask(original),
            Masks {
                version: 1,
                control: 3,
                state: 3
            }
        );
        assert!(path_key("worker.exe").is_none());
        assert!(path_key(r"C:\apps\..\worker.exe").is_none());
        assert_eq!(
            path_key(r"\\?\C:\Apps\worker.EXE").as_deref(),
            Some(r"c:\apps\worker.exe")
        );
    }

    #[test]
    fn recovery_is_durable_and_rejects_ambiguous_ownership() {
        let dir = std::env::temp_dir().join(format!(
            "pc-tweaker-ecoqos-test-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let saved = record();
        save_recovery(&dir, &saved).unwrap();
        assert!(save_recovery(&dir, &saved).is_err());
        assert_eq!(read_recoveries(&dir).unwrap().len(), 1);
        let path = recovery_path(&dir, &saved.identity);
        let mut altered = record();
        altered.identity.creation += 1;
        std::fs::write(&path, serde_json::to_vec(&altered).unwrap()).unwrap();
        assert!(read_recoveries(&dir).is_err());
        std::fs::remove_file(path).unwrap();
        std::fs::remove_dir(recovery_dir(&dir)).unwrap();
        std::fs::remove_dir(dir).unwrap();
    }

    /// Reading a process's EcoQoS state must work with query-limited rights
    /// alone, since that is all the engine asks for until it writes. Read
    /// only: a child this test starts is inspected, never changed.
    #[cfg(windows)]
    #[test]
    fn masks_are_readable_with_query_limited_rights_only() {
        use std::os::windows::process::CommandExt;
        let mut child = std::process::Command::new("cmd.exe")
            .args(["/c", "ping -n 6 127.0.0.1 >nul"])
            .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
            .spawn()
            .unwrap();
        let read = native::Process::open(child.id(), false)
            .unwrap()
            .expect("child is running")
            .masks();
        let _ = child.kill();
        let _ = child.wait();
        let masks = read.unwrap();
        assert!(native::valid_version(masks));
    }

    /// Explicit VM probe of the same native read/write path as the watcher.
    /// The only changed process is a child created by this test and terminated
    /// on every exit path. Never run this on the development host.
    #[cfg(windows)]
    #[test]
    #[ignore = "VM only: set PC_TWEAKER_ECOQOS_VM_PROBE to the exact guest computer name"]
    fn vm_native_apply_restore_on_disposable_child() {
        use std::os::windows::process::CommandExt;
        use std::process::{Child, Command};

        let expected = std::env::var("PC_TWEAKER_ECOQOS_VM_PROBE").expect("VM opt-in is required");
        let machine = std::env::var("COMPUTERNAME").expect("guest machine name is required");
        assert!(!expected.is_empty() && expected.eq_ignore_ascii_case(&machine));
        let model = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).Model",
            ])
            .creation_flags(0x0800_0000)
            .output()
            .unwrap();
        assert!(model.status.success());
        let model = String::from_utf8_lossy(&model.stdout).to_ascii_lowercase();
        assert!(
            ["virtual machine", "vmware", "virtualbox", "kvm", "qemu"]
                .iter()
                .any(|name| model.contains(name)),
            "VM hardware is required: {model}"
        );
        assert!(native::supported().unwrap(), "Windows 11 is required");
        assert!(
            !native::blocked_global().unwrap(),
            "global power throttling is disabled"
        );

        struct DisposableChild(Child);
        impl Drop for DisposableChild {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
        let child = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Start-Sleep -Seconds 120",
            ])
            .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
            .spawn()
            .unwrap();
        let mut child = DisposableChild(child);
        let pid = child.0.id();
        let process = native::Process::open(pid, true).unwrap().unwrap();
        let identity = process.identity(pid).unwrap();
        assert_eq!(identity.pid, pid);
        assert!(identity.creation > 0);
        assert!(identity.executable.ends_with(r"\powershell.exe"));
        let original = process.masks().unwrap();
        assert!(native::valid_version(original));
        assert_eq!(original.control & EXECUTION_SPEED, 0);
        assert_eq!(original.state & EXECUTION_SPEED, 0);
        assert!(child.0.try_wait().unwrap().is_none());
        assert_eq!(process.creation().unwrap(), identity.creation);
        let applied = enabled_mask(original);
        process.set_masks(applied).unwrap();
        assert_eq!(process.masks().unwrap(), applied);
        assert_eq!(process.creation().unwrap(), identity.creation);
        process.set_masks(original).unwrap();
        assert_eq!(process.masks().unwrap(), original);
    }
}
