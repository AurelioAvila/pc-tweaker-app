//! The one place PC Tweaker looks at, or opens, other people's processes.
//!
//! Some games ship their own kernel-level protection, which watches who holds
//! a handle to the game and what rights it carries. An optimizer that opens
//! the game with read or write access, or keeps a handle to every process on
//! the machine, looks exactly like the tools that protection exists to stop.
//! Those games manage their own performance, and PC Tweaker leaves them be. So:
//!
//! * **Seeing processes opens nothing.** [`processes`] and [`image_path`] read
//!   the kernel's process table with `NtQuerySystemInformation`: names,
//!   parents, creation times, working sets and full image paths, without a
//!   single `OpenProcess`. `sysinfo` is not used for processes: it opens every
//!   process with `PROCESS_QUERY_INFORMATION | PROCESS_VM_READ` and keeps those
//!   handles for as long as its `System` lives.
//! * **Every `OpenProcess` goes through [`open`].** Three access masks exist and
//!   no others: query-limited, query-limited plus set-limited (CPU sets), and
//!   query-limited plus set-information, used only for scheduling priority
//!   (priority class and EcoQoS). A test fails the build if any other right,
//!   or an `OpenProcess` outside this file, appears anywhere in the source.
//! * **Protected processes are never opened.** Protection components, their
//!   descendants, and executables that sit in a protected game's folder are
//!   refused by [`open`] itself, whoever the caller is. If the process table
//!   cannot be read, nothing but this app's own process is opened.
//! * **While a protected session runs, runtime work pauses.** [`paused`] is
//!   true while a protection service or process is active (and the user has
//!   not turned the behaviour off), or while the server-side hold is on.
//!   Callers check it before touching any third-party process.
//!
//! Kernel drivers that load at boot ([`RESIDENT_DRIVERS`]) are *resident*:
//! they are present all the time, game or no game, so on their own they do
//! not pause anything. The services and clients that run with the game
//! ([`SESSION_SERVICES`], [`starts_session`]) do.
//!
//! What this cannot prove without a real protected game and a test account:
//! that a given protection accepts the remaining query-limited handles to
//! unrelated processes, and the exact moment each launcher starts its service.
//! The design keeps the remaining exposure to rights Task Manager itself uses.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Prefix of the error a refused process action returns, so the frontend can
/// show its own, localized wording instead of the English fallback.
pub const SELF_MANAGED_PREFIX: &str = "SELF_MANAGED_GAME: ";
/// Prefix for an action declined because such a game is running right now.
pub const GAME_RUNNING_PREFIX: &str = "SELF_MANAGED_GAME_RUNNING: ";
/// Prefix for an action declined because one of the user's registered games
/// (any game, protected or not) is running.
pub const REGISTERED_GAME_PREFIX: &str = "REGISTERED_GAME_RUNNING: ";

pub fn self_managed_error() -> String {
    format!("{SELF_MANAGED_PREFIX}This game manages its own performance, so PC Tweaker leaves it as it is.")
}

pub fn registered_game_error() -> String {
    format!("{REGISTERED_GAME_PREFIX}One of your games is running, so PC Tweaker waits until it closes.")
}

pub fn game_running_error() -> String {
    format!("{GAME_RUNNING_PREFIX}A game that manages its own performance is running, so PC Tweaker leaves apps as they are until it closes.")
}

/* ---------------------------------------------------------------- *
 * Recognition. Pure functions over names and paths, so every rule
 * is testable with made-up process lists.
 * ---------------------------------------------------------------- */

/// Lower-case prefixes of processes that run only while a protected game (or
/// the client that guards a match) does. Matched on the file name without
/// regard to extension, since some of them do not end in `.exe`.
const SESSION_PREFIXES: [&str; 6] = [
    "easyanticheat",
    "beservice",
    "eaanticheat.gameservice",
    "gamemon",
    "faceitclient",
    "start_protected_game",
];
const SESSION_NAMES: [&str; 1] = ["vgc.exe"];
/// Launchers named after the game they start, e.g. `<Game>_BE.exe`.
const SESSION_SUFFIXES: [&str; 3] = ["_be.exe", "_eac.exe", "_eac_eos.exe"];
/// Never opened, but running all day from sign-in, so they do not pause
/// anything on their own: tray icons and desktop clients.
const RESIDENT_PREFIXES: [&str; 2] = ["vgtray", "faceit"];

/// Services that run only while a protected game (or its client) does.
pub const SESSION_SERVICES: [&str; 6] = [
    "vgc",
    "BEService",
    "EasyAntiCheat",
    "EasyAntiCheat_EOS",
    "EAAntiCheatService",
    "npggsvc",
];
/// Kernel drivers that load at boot and stay loaded whether or not a game runs.
pub const RESIDENT_DRIVERS: [&str; 2] = ["vgk", "FACEIT"];

/// Folders a protection installs beside the game it protects.
const MARKER_DIRS: [&str; 3] = ["easyanticheat", "easyanticheat_eos", "battleye"];
const MARKER_FILES: [&str; 1] = ["start_protected_game.exe"];
/// How far up from the executable the markers are looked for: Unreal games
/// keep the binary three levels below the folder that holds them.
const MARKER_DEPTH: usize = 4;

fn file_name_lower(path_or_name: &str) -> String {
    path_or_name
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(path_or_name)
        .to_ascii_lowercase()
}

/// A process that only runs while a protected game does: seeing one starts a
/// session.
pub fn starts_session(name: &str) -> bool {
    let name = file_name_lower(name);
    SESSION_PREFIXES.iter().any(|p| name.starts_with(p))
        || SESSION_NAMES.contains(&name.as_str())
        || SESSION_SUFFIXES.iter().any(|s| name.ends_with(s))
}

/// A protection component, recognised by its process or file name. Never
/// opened, whether or not it starts a session.
pub fn is_protected_name(name: &str) -> bool {
    starts_session(name)
        || RESIDENT_PREFIXES
            .iter()
            .any(|p| file_name_lower(name).starts_with(p))
}

/// Publisher install folders whose games are all protected.
const PROTECTED_INSTALL_DIRS: [&str; 1] = [r"\riot games\"];

/// The path-only part of [`is_protected_executable`]: the name rules plus the
/// publisher install folders.
fn is_protected_path_text(path: &str) -> bool {
    let lower = path.replace('/', "\\").to_ascii_lowercase();
    is_protected_name(&lower) || PROTECTED_INSTALL_DIRS.iter().any(|d| lower.contains(d))
}

/// Whether a protection marker sits next to `exe` or in one of the folders
/// above it. `exists` is the file system, injected so tests need no disk.
fn has_folder_marker(exe: &Path, exists: &dyn Fn(&Path) -> bool) -> bool {
    let mut dir = exe.parent();
    for _ in 0..MARKER_DEPTH {
        let Some(current) = dir else { break };
        // Never climb to a drive root: everything on the drive would match.
        if current.parent().is_none() {
            break;
        }
        if MARKER_DIRS
            .iter()
            .chain(MARKER_FILES.iter())
            .any(|marker| exists(&current.join(marker)))
        {
            return true;
        }
        dir = current.parent();
    }
    false
}

/// An executable that belongs to a protected game, judged from
/// its full path. Reads the folders around it; opens no process.
pub fn is_protected_executable(path: &str) -> bool {
    is_protected_path_text(path) || has_folder_marker(Path::new(path), &|p| p.exists())
}

/* ---------------------------------------------------------------- *
 * The process table, read without opening any process.
 * ---------------------------------------------------------------- */

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent: Option<u32>,
    /// The image file name, e.g. `chrome.exe`.
    pub name: String,
    /// Kernel creation time (FILETIME ticks); identifies a process across PID
    /// reuse.
    pub created: u64,
    pub session: u32,
    pub working_set: u64,
    /// User plus kernel CPU time so far, in 100 ns units.
    pub cpu_time: u64,
}

/// The processes `roots` selects, plus every process descended from one of
/// them. A child must have been created after its parent: a PID that was
/// reused for an older-looking parent is not followed.
pub fn with_descendants(processes: &[ProcessInfo], roots: &HashSet<u32>) -> HashSet<u32> {
    let mut family = roots.clone();
    loop {
        let before = family.len();
        for p in processes {
            if family.contains(&p.pid) {
                continue;
            }
            let Some(parent) = p.parent else { continue };
            if !family.contains(&parent) {
                continue;
            }
            let parent_created = processes
                .iter()
                .find(|q| q.pid == parent)
                .map_or(0, |q| q.created);
            if p.created >= parent_created {
                family.insert(p.pid);
            }
        }
        if family.len() == before {
            return family;
        }
    }
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub enum Level {
    /// No protection component is running.
    Clear,
    /// Only a boot-time driver is loaded; no protected game is running.
    Resident,
    /// A protected game, its client or its service is running.
    Session,
}

#[derive(Debug, Clone)]
pub struct Assessment {
    pub level: Level,
    /// Protection processes and everything they started. Never opened.
    pub protected: HashSet<u32>,
    /// Creation time of every process in the table the assessment was made
    /// from, so a process can be told apart from a later one with its PID.
    pub created: std::collections::HashMap<u32, u64>,
    /// False when the process table could not be read: then nothing but
    /// this app's own process is opened.
    pub table_read: bool,
}

/// Decides the level from a process list and the names of the services and
/// drivers that are active. Pure.
pub fn assess(processes: &[ProcessInfo], active_services: Option<&[String]>) -> Assessment {
    let roots: HashSet<u32> = processes
        .iter()
        .filter(|p| is_protected_name(&p.name))
        .map(|p| p.pid)
        .collect();
    let any_of = |names: &[&str]| {
        active_services.is_some_and(|active| {
            active
                .iter()
                .any(|s| names.iter().any(|n| n.eq_ignore_ascii_case(s)))
        })
    };
    // A service manager that could not be asked is no evidence that no
    // protected game is running.
    let level = if active_services.is_none()
        || processes.iter().any(|p| starts_session(&p.name))
        || any_of(&SESSION_SERVICES)
    {
        Level::Session
    } else if any_of(&RESIDENT_DRIVERS) {
        Level::Resident
    } else {
        Level::Clear
    };
    Assessment {
        level,
        protected: with_descendants(processes, &roots),
        created: processes.iter().map(|p| (p.pid, p.created)).collect(),
        table_read: true,
    }
}

/* ---------------------------------------------------------------- *
 * Settings: the local switch and the server-side hold.
 * ---------------------------------------------------------------- */

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct Config {
    /// Pause runtime process work while a protected game runs. On by default.
    #[serde(default = "default_true")]
    respect_games: bool,
    /// Set from the server's flag. Off by default; when on, every runtime
    /// action on another process is paused for everyone.
    #[serde(default)]
    remote_hold: bool,
}

fn default_true() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Config {
            respect_games: true,
            remote_hold: false,
        }
    }
}

static CONFIG_LOCK: Mutex<()> = Mutex::new(());

fn config_path(dir: &Path) -> PathBuf {
    dir.join("process_guard.json")
}

/// A damaged file reads as the defaults, which are the cautious settings.
fn load_config(dir: &Path) -> Config {
    std::fs::read(config_path(dir))
        .ok()
        .and_then(|raw| serde_json::from_slice(&raw).ok())
        .unwrap_or_default()
}

fn save_config(dir: &Path, config: &Config) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?;
    let temp = dir.join(format!("process_guard.json.{}.tmp", std::process::id()));
    std::fs::write(&temp, json).map_err(|e| e.to_string())?;
    crate::rollback::replace_file(&temp, &config_path(dir)).map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        e.to_string()
    })
}

fn update_config(dir: &Path, change: impl FnOnce(&mut Config)) -> Result<Config, String> {
    let _lock = CONFIG_LOCK.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(dir);
    change(&mut config);
    save_config(dir, &config)?;
    Ok(config)
}

/// Whether the given level, under these settings, pauses runtime work.
fn pauses(config: Config, level: Level) -> bool {
    config.remote_hold || (config.respect_games && level == Level::Session)
}

/* ---------------------------------------------------------------- *
 * The live assessment, cached briefly: every watcher asks every few
 * seconds and the answer does not change faster than a game starts.
 * ---------------------------------------------------------------- */

const CACHE_TTL: Duration = Duration::from_secs(2);
static CACHE: Mutex<Option<(Instant, Arc<Assessment>)>> = Mutex::new(None);
static LAST_PAUSED: AtomicBool = AtomicBool::new(false);

/// The current assessment. A failed read of the process table counts as a
/// protected session: not being able to look is no reason to touch anything.
pub fn current() -> Arc<Assessment> {
    if let Ok(cache) = CACHE.lock() {
        if let Some((at, assessment)) = cache.as_ref() {
            if at.elapsed() < CACHE_TTL {
                return assessment.clone();
            }
        }
    }
    fresh()
}

/// A new assessment, bypassing the cache: for a PID the cached table has not
/// seen yet.
fn fresh() -> Arc<Assessment> {
    let assessment = Arc::new(match processes() {
        Ok(list) => {
            let mut names: Vec<&str> = SESSION_SERVICES.to_vec();
            names.extend(RESIDENT_DRIVERS);
            assess(&list, native::active_services(&names).as_deref())
        }
        Err(_) => Assessment {
            level: Level::Session,
            protected: HashSet::new(),
            created: Default::default(),
            table_read: false,
        },
    });
    if let Ok(mut cache) = CACHE.lock() {
        *cache = Some((Instant::now(), assessment.clone()));
    }
    assessment
}

/// Records an action taken on another process. Every change PC Tweaker makes
/// to a process it does not own goes through here, so the local audit log
/// answers "what touched which process, and when". Silent in unit tests,
/// which must not write the real log.
pub fn audit(action: &str, target: &str, success: bool, detail: Option<String>) {
    if !cfg!(test) {
        crate::audit::record(action, target, success, detail);
    }
}

/// Whether runtime work on other processes must wait. Also records each
/// change of answer in the audit log, once.
pub fn paused(dir: &Path) -> bool {
    let config = load_config(dir);
    let assessment = current();
    let now = pauses(config, assessment.level);
    if LAST_PAUSED.swap(now, Ordering::SeqCst) != now {
        // What triggered it stays out of the log the ledger displays: the
        // entry says that runtime work paused or resumed, nothing more.
        audit(
            "process-guard",
            if now { "paused" } else { "resumed" },
            true,
            None,
        );
    }
    now
}

/// Whether a process is off limits regardless of any setting: a protection
/// component or a process it started, an executable that belongs to a protected game
/// (judged by its path, once per process instance), or any process at all
/// when the process table cannot be read.
pub fn is_protected_pid(pid: u32) -> bool {
    !matches!(verdict(pid), Verdict::Allowed(_))
}

#[derive(Debug, PartialEq, Eq)]
enum Verdict {
    /// Allowed, for the process instance created at this time.
    Allowed(u64),
    Protected,
    /// Not in a freshly read table: it has exited.
    Gone,
}

fn verdict(pid: u32) -> Verdict {
    let mut assessment = current();
    if !assessment.created.contains_key(&pid) {
        // Started after the cached table was taken: look again.
        assessment = fresh();
    }
    if !assessment.table_read || assessment.protected.contains(&pid) {
        return Verdict::Protected;
    }
    let Some(&created) = assessment.created.get(&pid) else {
        return Verdict::Gone;
    };
    if protected_by_path(pid, created) {
        Verdict::Protected
    } else {
        Verdict::Allowed(created)
    }
}

static PATH_VERDICTS: Mutex<Option<std::collections::HashMap<(u32, u64), bool>>> = Mutex::new(None);

/// The path half of [`is_protected_pid`], cached per PID and creation time.
/// A path that cannot be read counts as protected.
fn protected_by_path(pid: u32, created: u64) -> bool {
    if let Ok(cache) = PATH_VERDICTS.lock() {
        if let Some(&verdict) = cache.as_ref().and_then(|c| c.get(&(pid, created))) {
            return verdict;
        }
    }
    let verdict = image_path(pid).is_none_or(|path| is_protected_executable(&path));
    if let Ok(mut cache) = PATH_VERDICTS.lock() {
        let map = cache.get_or_insert_with(Default::default);
        if map.len() > 4096 {
            map.clear();
        }
        map.insert((pid, created), verdict);
    }
    verdict
}

/* ---------------------------------------------------------------- *
 * Opening a process: three masks, nothing else.
 * ---------------------------------------------------------------- */

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Access {
    /// Name, times, priority and CPU sets, read only.
    Query,
    /// CPU sets: `PROCESS_SET_LIMITED_INFORMATION`.
    CpuSets,
    /// Priority class and EcoQoS: `PROCESS_SET_INFORMATION`, the one wider
    /// right, used for scheduling priority and nothing else.
    Priority,
}

#[derive(Debug, PartialEq, Eq)]
pub enum OpenError {
    /// No such process (it exited).
    Gone,
    /// It exists, and this token may not open it.
    Denied(u32),
    /// The guard refused before asking Windows.
    Protected,
}

impl std::fmt::Display for OpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpenError::Gone => write!(f, "the process has exited"),
            OpenError::Denied(code) => write!(f, "Windows denied access (error {code})"),
            OpenError::Protected => write!(f, "{}", self_managed_error()),
        }
    }
}

pub use native::ProcessHandle;

/// Opens another process with one of the three permitted masks, after the
/// guard has confirmed it is not protected.
pub fn open(pid: u32, access: Access) -> Result<ProcessHandle, OpenError> {
    if pid == std::process::id() {
        return native::open_raw(pid, access);
    }
    let judged = match verdict(pid) {
        Verdict::Allowed(created) => created,
        Verdict::Protected => return Err(OpenError::Protected),
        Verdict::Gone => return Err(OpenError::Gone),
    };
    let handle = native::open_raw(pid, access)?;
    // The PID may have been reused between the verdict and the open: the
    // handle must belong to the very process that was judged.
    if handle.creation() != Some(judged) {
        return Err(OpenError::Gone);
    }
    Ok(handle)
}

#[cfg(windows)]
mod native {
    use super::{Access, OpenError, ProcessInfo};
    use windows_sys::Wdk::System::SystemInformation::{
        NtQuerySystemInformation, SystemProcessInformation,
    };
    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, HANDLE, UNICODE_STRING};
    use windows_sys::Win32::Storage::FileSystem::{GetLogicalDrives, QueryDosDeviceW};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_INFORMATION,
        PROCESS_SET_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::System::WindowsProgramming::SYSTEM_PROCESS_INFORMATION;

    const STATUS_INFO_LENGTH_MISMATCH: i32 = 0xC000_0004_u32 as i32;
    /// `SystemProcessIdInformation`: the image path of one process by PID,
    /// answered by the kernel without a handle. What Process Explorer and
    /// System Informer use for processes they cannot open.
    const SYSTEM_PROCESS_ID_INFORMATION: i32 = 88;

    pub struct ProcessHandle(HANDLE);

    impl ProcessHandle {
        pub fn raw(&self) -> HANDLE {
            self.0
        }

        /// Kernel creation time; every permitted mask carries the query
        /// rights this needs.
        pub fn creation(&self) -> Option<u64> {
            use windows_sys::Win32::Foundation::FILETIME;
            use windows_sys::Win32::System::Threading::GetProcessTimes;
            // SAFETY: four live FILETIME out-parameters; the handle is open.
            let mut t: [FILETIME; 4] = unsafe { std::mem::zeroed() };
            let [a, b, c, d] = &mut t;
            let ok = unsafe { GetProcessTimes(self.0, a, b, c, d) } != 0;
            let value = (u64::from(t[0].dwHighDateTime) << 32) | u64::from(t[0].dwLowDateTime);
            (ok && value != 0).then_some(value)
        }
    }

    impl Drop for ProcessHandle {
        fn drop(&mut self) {
            // SAFETY: opened by OpenProcess below and closed exactly once.
            unsafe { CloseHandle(self.0) };
        }
    }

    pub fn open_raw(pid: u32, access: Access) -> Result<ProcessHandle, OpenError> {
        let mask = match access {
            Access::Query => PROCESS_QUERY_LIMITED_INFORMATION,
            Access::CpuSets => PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SET_LIMITED_INFORMATION,
            Access::Priority => PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SET_INFORMATION,
        };
        // SAFETY: plain call; a null result is checked.
        let handle = unsafe { OpenProcess(mask, 0, pid) };
        if handle.is_null() {
            // SAFETY: read straight after the failing call.
            return Err(match unsafe { GetLastError() } {
                87 => OpenError::Gone,
                code => OpenError::Denied(code),
            });
        }
        Ok(ProcessHandle(handle))
    }

    fn le_u64(bytes: &[u8]) -> u64 {
        let mut raw = [0u8; 8];
        raw.copy_from_slice(&bytes[..8]);
        u64::from_le_bytes(raw)
    }

    /// The whole process table in one kernel call.
    pub fn processes() -> Result<Vec<ProcessInfo>, String> {
        // u64 storage keeps the records 8-byte aligned.
        let mut buffer: Vec<u64> = vec![0; 64 * 1024];
        let mut needed = 0u32;
        for _ in 0..8 {
            let bytes = (buffer.len() * 8) as u32;
            // SAFETY: `buffer` holds `bytes` writable bytes.
            let status = unsafe {
                NtQuerySystemInformation(
                    SystemProcessInformation,
                    buffer.as_mut_ptr().cast(),
                    bytes,
                    &mut needed,
                )
            };
            if status == STATUS_INFO_LENGTH_MISMATCH {
                // The table grows between calls; leave room for that.
                buffer.resize((needed as usize + 64 * 1024).div_ceil(8), 0);
                continue;
            }
            if status < 0 {
                return Err(format!(
                    "the process list could not be read (0x{status:08X})"
                ));
            }
            return Ok(parse(&buffer));
        }
        Err("the process list kept growing while it was read".into())
    }

    fn parse(buffer: &[u64]) -> Vec<ProcessInfo> {
        let base = buffer.as_ptr().cast::<u8>();
        let len = buffer.len() * 8;
        let mut out = Vec::new();
        let mut offset = 0usize;
        while offset + std::mem::size_of::<SYSTEM_PROCESS_INFORMATION>() <= len {
            // SAFETY: the record lies inside the buffer (checked above).
            let record: SYSTEM_PROCESS_INFORMATION =
                unsafe { std::ptr::read_unaligned(base.add(offset).cast()) };
            let name = if record.ImageName.Buffer.is_null() || record.ImageName.Length == 0 {
                if record.UniqueProcessId as usize == 0 {
                    "System Idle Process".to_string()
                } else {
                    "System".to_string()
                }
            } else {
                // SAFETY: the kernel points ImageName into this same buffer and
                // gives its length in bytes.
                let chars = unsafe {
                    std::slice::from_raw_parts(
                        record.ImageName.Buffer,
                        record.ImageName.Length as usize / 2,
                    )
                };
                String::from_utf16_lossy(chars)
            };
            // Reserved1 is the documented opaque block; bytes 24..48 of it are
            // CreateTime, UserTime and KernelTime, at fixed offsets since NT.
            let r = &record.Reserved1;
            out.push(ProcessInfo {
                pid: record.UniqueProcessId as usize as u32,
                parent: match record.Reserved2 as usize as u32 {
                    0 => None,
                    parent => Some(parent),
                },
                name,
                created: le_u64(&r[24..32]),
                session: record.SessionId,
                working_set: record.WorkingSetSize as u64,
                cpu_time: le_u64(&r[32..40]).saturating_add(le_u64(&r[40..48])),
            });
            if record.NextEntryOffset == 0 {
                break;
            }
            offset += record.NextEntryOffset as usize;
        }
        out
    }

    #[repr(C)]
    struct ProcessIdInformation {
        process_id: HANDLE,
        image_name: UNICODE_STRING,
    }

    fn query_nt_path(pid: u32) -> Option<String> {
        let mut capacity: usize = 1024;
        for _ in 0..2 {
            let mut chars = vec![0u16; capacity];
            let mut info = ProcessIdInformation {
                process_id: pid as usize as HANDLE,
                image_name: UNICODE_STRING {
                    Length: 0,
                    MaximumLength: (capacity * 2).min(u16::MAX as usize) as u16,
                    Buffer: chars.as_mut_ptr(),
                },
            };
            // SAFETY: `info` and the buffer it points to outlive the call.
            let status = unsafe {
                NtQuerySystemInformation(
                    SYSTEM_PROCESS_ID_INFORMATION,
                    (&mut info as *mut ProcessIdInformation).cast(),
                    std::mem::size_of::<ProcessIdInformation>() as u32,
                    std::ptr::null_mut(),
                )
            };
            if status == STATUS_INFO_LENGTH_MISMATCH {
                capacity = (info.image_name.MaximumLength as usize / 2 + 1).max(capacity * 2);
                if capacity > 32 * 1024 {
                    return None;
                }
                continue;
            }
            if status < 0 {
                return None;
            }
            let len = (info.image_name.Length as usize / 2).min(chars.len());
            return Some(String::from_utf16_lossy(&chars[..len]));
        }
        None
    }

    /// Device name per drive letter, with when it was read.
    type DriveMap = (std::time::Instant, Vec<(String, char)>);
    static DRIVES: std::sync::Mutex<Option<DriveMap>> = std::sync::Mutex::new(None);

    /// Device name per drive letter (`\Device\HarddiskVolume3` -> `C`),
    /// re-read at most once a minute.
    fn drive_map() -> Vec<(String, char)> {
        if let Ok(cache) = DRIVES.lock() {
            if let Some((at, map)) = cache.as_ref() {
                if at.elapsed() < std::time::Duration::from_secs(60) {
                    return map.clone();
                }
            }
        }
        let mut map = Vec::new();
        // SAFETY: plain call.
        let drives = unsafe { GetLogicalDrives() };
        for letter in 0..26u8 {
            if drives & (1 << letter) == 0 {
                continue;
            }
            let device: Vec<u16> = format!("{}:", (b'A' + letter) as char)
                .encode_utf16()
                .chain(Some(0))
                .collect();
            let mut target = [0u16; 1024];
            // SAFETY: both buffers are live for the call; the size is in chars.
            let written = unsafe {
                QueryDosDeviceW(device.as_ptr(), target.as_mut_ptr(), target.len() as u32)
            };
            if written == 0 {
                continue;
            }
            let end = target.iter().position(|c| *c == 0).unwrap_or(target.len());
            map.push((
                String::from_utf16_lossy(&target[..end]),
                (b'A' + letter) as char,
            ));
        }
        if let Ok(mut cache) = DRIVES.lock() {
            *cache = Some((std::time::Instant::now(), map.clone()));
        }
        map
    }

    /// `\Device\HarddiskVolume3\Games\x.exe` back to `C:\Games\x.exe`.
    fn dos_path(nt: &str) -> Option<String> {
        if let Some(rest) = nt.strip_prefix(r"\??\") {
            return Some(rest.to_string());
        }
        if let Some(rest) = nt.strip_prefix(r"\Device\Mup\") {
            return Some(format!(r"\\{rest}"));
        }
        drive_map().into_iter().find_map(|(target, letter)| {
            nt.strip_prefix(&target)
                .filter(|rest| rest.starts_with('\\'))
                .map(|rest| format!("{letter}:{rest}"))
        })
    }

    pub fn image_path(pid: u32) -> Option<String> {
        if pid == 0 || pid == 4 {
            return None;
        }
        dos_path(&query_nt_path(pid)?)
    }

    /// Which of `names` (services or drivers) are anything but stopped.
    /// `None` when the service manager could not be asked at all.
    pub fn active_services(names: &[&str]) -> Option<Vec<String>> {
        use windows_sys::Win32::System::Services::{
            CloseServiceHandle, OpenSCManagerW, OpenServiceW, QueryServiceStatus,
            SC_MANAGER_CONNECT, SERVICE_QUERY_STATUS, SERVICE_STATUS, SERVICE_STOPPED,
        };
        let mut active = Vec::new();
        // SAFETY: null machine and database select the local active database.
        let manager =
            unsafe { OpenSCManagerW(std::ptr::null(), std::ptr::null(), SC_MANAGER_CONNECT) };
        if manager.is_null() {
            return None;
        }
        for name in names {
            let wide: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
            // SAFETY: the manager is live and the name NUL-terminated.
            let service = unsafe { OpenServiceW(manager, wide.as_ptr(), SERVICE_QUERY_STATUS) };
            if service.is_null() {
                continue; // not installed
            }
            // SAFETY: SERVICE_STATUS is plain data; zero is a valid value.
            let mut status: SERVICE_STATUS = unsafe { std::mem::zeroed() };
            // SAFETY: the handle is live and `status` writable.
            if unsafe { QueryServiceStatus(service, &mut status) } != 0
                && status.dwCurrentState != SERVICE_STOPPED
            {
                active.push((*name).to_string());
            }
            // SAFETY: opened above, closed once.
            unsafe { CloseServiceHandle(service) };
        }
        // SAFETY: opened above, closed once.
        unsafe { CloseServiceHandle(manager) };
        Some(active)
    }
}

#[cfg(not(windows))]
mod native {
    use super::{Access, OpenError, ProcessInfo};
    pub struct ProcessHandle(());
    impl ProcessHandle {
        pub fn creation(&self) -> Option<u64> {
            None
        }
    }
    pub fn open_raw(_pid: u32, _access: Access) -> Result<ProcessHandle, OpenError> {
        Err(OpenError::Denied(0))
    }
    pub fn processes() -> Result<Vec<ProcessInfo>, String> {
        Ok(Vec::new())
    }
    pub fn image_path(_pid: u32) -> Option<String> {
        None
    }
    pub fn active_services(_names: &[&str]) -> Option<Vec<String>> {
        Some(Vec::new())
    }
}

/// The whole process table, without opening any process.
pub fn processes() -> Result<Vec<ProcessInfo>, String> {
    native::processes()
}

/// A process's full image path (`C:\...`), without opening it. `None` for
/// kernel processes, ones that exited, and paths that are not on a drive
/// letter or network share.
pub fn image_path(pid: u32) -> Option<String> {
    native::image_path(pid)
}

/* ---------------------------------------------------------------- *
 * Tauri surface.
 * ---------------------------------------------------------------- */

/// Mirrors `ProcessGuardStatus` in src/types.ts.
#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GuardStatus {
    pub respect_games: bool,
    /// Runtime work on other processes is waiting right now.
    pub paused: bool,
}

#[tauri::command(async)]
pub fn process_guard_status(app: tauri::AppHandle) -> Result<GuardStatus, String> {
    let dir = crate::store_for_dir(&app)?;
    Ok(GuardStatus {
        respect_games: load_config(&dir).respect_games,
        paused: paused(&dir),
    })
}

#[tauri::command(async)]
pub fn set_process_guard(
    app: tauri::AppHandle,
    respect_games: bool,
) -> Result<GuardStatus, String> {
    let dir = crate::store_for_dir(&app)?;
    let config = update_config(&dir, |c| c.respect_games = respect_games)?;
    crate::audit::record(
        "process-guard-setting",
        if config.respect_games { "on" } else { "off" },
        true,
        None,
    );
    process_guard_status(app)
}

/// Fed by the frontend from the server's flag. The hold only ever adds a
/// pause; clearing it returns to the user's own setting and never lifts the
/// protection of protected processes themselves.
#[tauri::command(async)]
pub fn set_process_guard_hold(app: tauri::AppHandle, hold: bool) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    if load_config(&dir).remote_hold != hold {
        update_config(&dir, |c| c.remote_hold = hold)?;
        crate::audit::record(
            "process-guard-hold",
            if hold { "on" } else { "off" },
            true,
            None,
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(pid: u32, parent: Option<u32>, name: &str, created: u64) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent,
            name: name.into(),
            created,
            session: 1,
            working_set: 0,
            cpu_time: 0,
        }
    }

    /// Every name a recognition rule describes, written the way it shows up in
    /// a real process list: upper case, with or without `.exe`, or as a path.
    fn session_names() -> Vec<String> {
        let mut names: Vec<String> = SESSION_PREFIXES
            .iter()
            .flat_map(|p| {
                [
                    format!("{}.EXE", p.to_ascii_uppercase()),
                    format!("{p}64.des"),
                ]
            })
            .collect();
        names.extend(SESSION_NAMES.iter().map(|n| n.to_string()));
        names.extend(
            SESSION_SUFFIXES
                .iter()
                .map(|s| format!(r"C:\Games\Some Game\Game{}", s.to_ascii_uppercase())),
        );
        names
    }

    #[test]
    fn protection_components_are_recognised_by_name_and_ordinary_apps_are_not() {
        for name in session_names() {
            assert!(is_protected_name(&name), "{name}");
        }
        let mut ordinary: Vec<String> = ["chrome.exe", "explorer.exe", "obs64.exe", "Discord.exe"]
            .map(String::from)
            .into();
        // An exact name with one more letter, a name that starts like a prefix
        // and then goes its own way, a suffix used as a whole name, and only
        // the first part of a dotted prefix.
        ordinary.extend(SESSION_NAMES.iter().map(|n| n.replace(".exe", "x.exe")));
        ordinary.extend(
            SESSION_PREFIXES
                .iter()
                .map(|p| format!("{}st.exe", &p[..2])),
        );
        ordinary.extend(
            SESSION_SUFFIXES
                .iter()
                .map(|s| s.trim_start_matches('_').to_string()),
        );
        ordinary.extend(
            SESSION_PREFIXES
                .iter()
                .filter_map(|p| p.split_once('.'))
                .map(|(stem, _)| format!("{stem}.exe")),
        );
        let derived = SESSION_NAMES.len() + SESSION_PREFIXES.len() + SESSION_SUFFIXES.len();
        assert!(ordinary.len() > 4 + derived, "a near-miss kind has no case");
        for name in ordinary {
            assert!(!is_protected_name(&name), "{name}");
        }
    }

    /// Tray icons and desktop apps that start with Windows are never opened,
    /// but they do not pause anything: only what runs with a match does.
    #[test]
    fn always_on_clients_are_protected_without_starting_a_session() {
        let clients: Vec<String> = RESIDENT_PREFIXES
            .iter()
            .map(|p| format!("{}.exe", p.to_ascii_uppercase()))
            .collect();
        let longer = RESIDENT_PREFIXES.map(|p| format!("{p}service.exe"));
        for name in clients.iter().chain(&longer) {
            assert!(is_protected_name(name), "{name}");
            assert!(!starts_session(name), "{name}");
        }
        for name in session_names() {
            assert!(starts_session(&name), "{name}");
        }
        let tray = [
            p(10, None, &clients[0], 1),
            p(11, None, &clients[1], 1),
            p(12, Some(11), &clients[1], 2),
        ];
        let drivers: Vec<String> = RESIDENT_DRIVERS.iter().map(|d| d.to_string()).collect();
        let a = assess(&tray, Some(&drivers));
        assert_eq!(a.level, Level::Resident);
        let mut protected: Vec<_> = a.protected.into_iter().collect();
        protected.sort_unstable();
        assert_eq!(protected, vec![10, 11, 12]);
    }

    #[test]
    fn publisher_install_folders_count_as_protected_paths() {
        for dir in PROTECTED_INSTALL_DIRS {
            let upper = dir.to_ascii_uppercase();
            assert!(is_protected_path_text(&format!(
                r"C:{upper}Game\live\Game\Binaries\Win64\Game-Win64-Shipping.exe"
            )));
            // The folder, not a file that happens to carry its name.
            let file = format!(r"C:\Games{}.exe", dir.trim_end_matches('\\'));
            assert!(!is_protected_path_text(&file), "{file}");
            // Nor a folder named after only the first word of it.
            if let Some((first, _)) = dir.split_once(' ') {
                let other = format!(r"C:\Games{first}\notes.exe");
                assert!(!is_protected_path_text(&other), "{other}");
            }
        }
    }

    #[test]
    fn folder_markers_are_found_beside_or_above_the_binary_but_never_at_a_drive_root() {
        let markers: HashSet<PathBuf> = [
            PathBuf::from(r"C:\Games\Shooter\ShooterGame\Binaries\Win64").join(MARKER_DIRS[0]),
            PathBuf::from(r"D:\Steam\steamapps\common\Arena").join(MARKER_DIRS[2]),
            PathBuf::from(r"E:\").join(MARKER_DIRS[0]),
        ]
        .into_iter()
        .collect();
        let exists = |path: &Path| {
            markers.iter().any(|m| {
                m.to_string_lossy()
                    .eq_ignore_ascii_case(&path.to_string_lossy())
            })
        };
        assert!(has_folder_marker(
            Path::new(r"C:\Games\Shooter\ShooterGame\Binaries\Win64\Shooter-Win64-Shipping.exe"),
            &exists
        ));
        assert!(has_folder_marker(
            Path::new(r"D:\Steam\steamapps\common\Arena\ArenaGame\Binaries\Win64\ArenaGame.exe"),
            &exists
        ));
        // Five levels below the marker is beyond the search depth.
        assert!(!has_folder_marker(
            Path::new(r"D:\Steam\steamapps\common\Arena\a\b\c\d\e.exe"),
            &exists
        ));
        // A marker at the root of a drive would make the whole drive protected.
        assert!(!has_folder_marker(Path::new(r"E:\tool.exe"), &exists));
        assert!(!has_folder_marker(
            Path::new(r"C:\Program Files\OBS\obs64.exe"),
            &exists
        ));
        // Every marker, folder or file, counts when it sits beside the binary.
        let dir = Path::new(r"F:\Games\Racer");
        for marker in MARKER_DIRS.iter().chain(MARKER_FILES.iter()) {
            let beside = dir.join(marker);
            assert!(
                has_folder_marker(&dir.join("Racer.exe"), &|p: &Path| p == beside),
                "{marker}"
            );
        }
    }

    /// The tests above build their names from the lists, so they cannot see a
    /// typo or a dropped entry. This pins the lists themselves: any edit has to
    /// update the digest on purpose.
    #[test]
    fn the_recognition_lists_change_only_on_purpose() {
        let lists: [&[&str]; 9] = [
            &SESSION_PREFIXES,
            &SESSION_NAMES,
            &SESSION_SUFFIXES,
            &RESIDENT_PREFIXES,
            &SESSION_SERVICES,
            &RESIDENT_DRIVERS,
            &MARKER_DIRS,
            &MARKER_FILES,
            &PROTECTED_INSTALL_DIRS,
        ];
        // FNV-1a 64: stable across Rust releases, unlike DefaultHasher.
        let mut digest = 0xcbf2_9ce4_8422_2325_u64;
        for list in lists {
            for byte in list.iter().flat_map(|s| s.bytes().chain([0])).chain([1]) {
                digest = (digest ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3);
            }
        }
        assert_eq!(
            digest, 0xbe15_b3a2_8e0a_2b5c,
            "lists changed; if intended, pin {digest:#018x}"
        );
    }

    #[test]
    fn protected_processes_and_their_children_are_protected_but_reused_pids_are_not() {
        let launcher = format!("Game{}", SESSION_SUFFIXES[0]);
        let list = [
            p(10, None, "steam.exe", 100),
            p(20, Some(10), &launcher, 200),
            p(21, Some(20), "Game_x64.exe", 210),
            p(22, Some(21), "CrashReporter.exe", 220),
            // Claims pid 20 as its parent but is older: a reused PID.
            p(30, Some(20), "notepad.exe", 50),
            p(40, None, "discord.exe", 300),
        ];
        let a = assess(&list, Some(&[]));
        assert_eq!(a.level, Level::Session);
        let mut protected: Vec<_> = a.protected.iter().copied().collect();
        protected.sort_unstable();
        assert_eq!(protected, vec![20, 21, 22]);
    }

    #[test]
    fn boot_drivers_alone_are_resident_and_session_services_pause() {
        let list = [p(10, None, "explorer.exe", 1)];
        assert_eq!(assess(&list, Some(&[])).level, Level::Clear);
        for driver in RESIDENT_DRIVERS {
            assert_eq!(
                assess(&list, Some(&[driver.to_ascii_uppercase()])).level,
                Level::Resident,
                "{driver}"
            );
        }
        assert_eq!(
            assess(&list, None).level,
            Level::Session,
            "unknown services fail closed"
        );
        for service in SESSION_SERVICES {
            let running = [
                RESIDENT_DRIVERS[0].to_string(),
                service.to_ascii_lowercase(),
            ];
            let a = assess(&list, Some(&running));
            assert_eq!(a.level, Level::Session, "{service}");
        }
    }

    #[test]
    fn the_local_switch_and_the_server_hold_decide_the_pause() {
        let on = Config::default();
        assert!(on.respect_games && !on.remote_hold, "cautious defaults");
        assert!(pauses(on, Level::Session));
        assert!(!pauses(on, Level::Resident));
        assert!(!pauses(on, Level::Clear));
        let off = Config {
            respect_games: false,
            remote_hold: false,
        };
        assert!(!pauses(off, Level::Session));
        let held = Config {
            respect_games: false,
            remote_hold: true,
        };
        assert!(pauses(held, Level::Clear));
    }

    #[test]
    fn a_damaged_settings_file_falls_back_to_the_cautious_defaults() {
        let dir = std::env::temp_dir().join(format!("pct-guard-cfg-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(config_path(&dir), b"{not json").unwrap();
        assert_eq!(load_config(&dir), Config::default());
        update_config(&dir, |c| c.respect_games = false).unwrap();
        assert!(!load_config(&dir).respect_games);
        assert!(!load_config(&dir).remote_hold);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn the_wire_format_matches_the_typescript_contract() {
        let status = GuardStatus {
            respect_games: true,
            paused: false,
        };
        assert_eq!(
            serde_json::to_value(status).unwrap(),
            serde_json::json!({ "respectGames": true, "paused": false })
        );
    }

    /// Every `.rs` file of the crate, with comment lines dropped: a right named
    /// in an explanation is not a right requested.
    fn source_code() -> Vec<(PathBuf, Vec<String>)> {
        fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
            for entry in std::fs::read_dir(dir).unwrap() {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    walk(&path, out);
                } else if path.extension().is_some_and(|e| e == "rs") {
                    out.push(path);
                }
            }
        }
        let mut files = Vec::new();
        walk(
            &Path::new(env!("CARGO_MANIFEST_DIR")).join("src"),
            &mut files,
        );
        assert!(files.len() > 50, "the source tree was not found");
        files
            .into_iter()
            .map(|path| {
                let text = std::fs::read_to_string(&path).unwrap();
                let code = text
                    .lines()
                    .filter(|l| !l.trim_start().starts_with("//"))
                    .map(str::to_owned)
                    .collect();
                (path, code)
            })
            .collect()
    }

    /// Whether `word` occurs in `line` as a whole identifier.
    fn has_word(line: &str, word: &str) -> bool {
        let ident = |c: char| c.is_ascii_alphanumeric() || c == '_';
        line.match_indices(word).any(|(at, _)| {
            !line[..at].chars().next_back().is_some_and(ident)
                && !line[at + word.len()..].chars().next().is_some_and(ident)
        })
    }

    /// The rights ceiling, enforced on the source itself. Built with `concat!`
    /// so this list does not trip its own check.
    #[test]
    fn no_process_right_beyond_the_ceiling_appears_in_the_source() {
        let forbidden = [
            concat!("PROCESS_", "QUERY_INFORMATION"),
            concat!("PROCESS_", "SET_QUOTA"),
            concat!("PROCESS_", "VM_READ"),
            concat!("PROCESS_", "VM_WRITE"),
            concat!("PROCESS_", "VM_OPERATION"),
            concat!("PROCESS_", "DUP_HANDLE"),
            concat!("PROCESS_", "SUSPEND_RESUME"),
            concat!("PROCESS_", "TERMINATE"),
            concat!("PROCESS_", "ALL_ACCESS"),
            concat!("PROCESS_", "CREATE_THREAD"),
            concat!("PROCESS_", "CREATE_PROCESS"),
            concat!("PROCESS_", "SET_SESSIONID"),
            concat!("Read", "ProcessMemory"),
            concat!("Write", "ProcessMemory"),
            concat!("Virtual", "AllocEx"),
            concat!("Create", "RemoteThread"),
            concat!("Nt", "SuspendProcess"),
            concat!("Terminate", "Process"),
            concat!("Duplicate", "Handle"),
            concat!("Empty", "WorkingSet"),
            concat!("SetProcess", "WorkingSetSize"),
            concat!("SetProcess", "WorkingSetSizeEx"),
            concat!("SetProcess", "AffinityMask"),
            concat!("Open", "Thread"),
            // sysinfo opens every process with read rights to list them.
            concat!("refresh_", "processes"),
            concat!("refresh_", "processes_specifics"),
            concat!("Process", "RefreshKind"),
            concat!("with_", "processes"),
            concat!("refresh_", "all"),
            concat!("new_", "all"),
            concat!("refresh_", "process"),
            concat!("Processes", "ToUpdate"),
            concat!("RefreshKind::", "everything"),
            concat!("Nt", "OpenProcess"),
            concat!("Zw", "OpenProcess"),
        ];
        // Only this file may open a process, or name the two set rights.
        let guard_only = [
            concat!("Open", "Process"),
            concat!("PROCESS_", "SET_INFORMATION"),
            concat!("PROCESS_", "SET_LIMITED_INFORMATION"),
        ];
        let mut problems = Vec::new();
        for (path, code) in source_code() {
            let is_guard = path.file_name().is_some_and(|n| n == "process_guard.rs");
            for (n, line) in code.iter().enumerate() {
                for word in forbidden {
                    if has_word(line, word) {
                        problems.push(format!("{}:{}: {word}", path.display(), n + 1));
                    }
                }
                if !is_guard {
                    for word in guard_only {
                        if has_word(line, word) {
                            problems.push(format!(
                                "{}:{}: {word} outside the guard",
                                path.display(),
                                n + 1
                            ));
                        }
                    }
                }
            }
        }
        assert!(
            problems.is_empty(),
            "rights beyond the ceiling:\n{}",
            problems.join("\n")
        );
    }

    #[test]
    fn the_word_matcher_does_not_confuse_neighbouring_identifiers() {
        assert!(has_word("OpenProcess(PROCESS_X, 0, pid)", "OpenProcess"));
        assert!(!has_word("OpenProcessToken(h, 8, &mut t)", "OpenProcess"));
        assert!(!has_word(
            "PROCESS_QUERY_LIMITED_INFORMATION",
            concat!("PROCESS_", "QUERY_INFORMATION")
        ));
        assert!(!has_word("OpenThreadToken(x)", concat!("Open", "Thread")));
    }

    /// The real table, read without a handle, must contain this test process
    /// with its true creation time and image path.
    #[cfg(windows)]
    #[test]
    fn the_handle_free_process_table_describes_this_process() {
        let own = std::process::id();
        let list = processes().unwrap();
        assert!(list.len() > 5);
        let me = list
            .iter()
            .find(|p| p.pid == own)
            .expect("own process listed");
        let exe = std::env::current_exe().unwrap();
        assert!(exe
            .file_name()
            .unwrap()
            .to_string_lossy()
            .eq_ignore_ascii_case(&me.name));
        // SAFETY: own pseudo-handle; GetProcessTimes only reads.
        let created = unsafe {
            use windows_sys::Win32::Foundation::FILETIME;
            use windows_sys::Win32::System::Threading::{GetCurrentProcess, GetProcessTimes};
            let mut t: [FILETIME; 4] = std::mem::zeroed();
            let [a, b, c, d] = &mut t;
            assert_ne!(GetProcessTimes(GetCurrentProcess(), a, b, c, d), 0);
            (u64::from(t[0].dwHighDateTime) << 32) | u64::from(t[0].dwLowDateTime)
        };
        assert_eq!(me.created, created);
        assert!(me.working_set > 0);
        let path = image_path(own).expect("own image path");
        assert!(
            std::fs::canonicalize(&path).unwrap() == std::fs::canonicalize(&exe).unwrap(),
            "{path} vs {}",
            exe.display()
        );
        assert!(list.iter().any(|p| p.pid == 4));
        assert_eq!(image_path(4), None);
    }
}
