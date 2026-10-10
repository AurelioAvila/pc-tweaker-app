//! Core steering for game sessions: while a registered game runs, its threads
//! are steered to the cores that suit it, and on an Intel hybrid CPU everything
//! else in the user's session is steered to the efficiency cores. Nothing is
//! suspended or terminated.
//!
//! The mechanism is CPU sets (`SetProcessDefaultCpuSets`), which Microsoft's
//! GDK guidance recommends over affinity masks. A process default applies to
//! every thread that has no CPU sets of its own, including threads that
//! already exist; threads a game pins itself, and processes with an affinity
//! mask, keep what they chose. (`PROCESS_POWER_THROTTLING_EXECUTION_SPEED` is
//! EcoQoS: it lowers a process's quality of service, it does not choose
//! cores, and a focused game is already high QoS. It is not used here.)
//!
//! - **AMD X3D:** when exactly one L3 domain is larger than the others, the
//!   game gets that die. Background processes are not moved: AMD's own driver
//!   keeps them on the same die during games, and there is no documented case
//!   for splitting them off.
//! - **Intel hybrid:** the game gets the highest efficiency class (P-cores);
//!   background processes get the rest. Only processes in the signed-in
//!   user's session are touched, never anything under the Windows directory,
//!   never the game's own child processes, never anything already carrying
//!   CPU sets, and never a process someone raised above normal priority. That
//!   last rule is how a streamer keeps an encoder off the E-cores.
//! - **Anything else** (one die, uniform cores): nothing to steer, so nothing
//!   is changed.
//!
//! Every change is journaled in the rollback store, owned by the session's
//! token, before it is made: process id plus kernel creation time plus the
//! exact sets applied. Restore clears a process's sets only while they are
//! still exactly those, so a reused PID or a process something else re-steered
//! is left alone. It runs when the game exits, when steering or the session is
//! turned off, when PC Tweaker quits, and on the next launch after a crash.
//! CPU sets die with their process, so a reboot needs no restore at all.

use serde::Serialize;
use std::collections::HashSet;

use crate::rollback::{RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "core_steering";
pub const MAX_PROCESSES: usize = 4096;
pub const MAX_CPU_SETS: usize = 1024;
/// GDK: let threads float across at least three to four cores.
const MIN_GAME_SETS: usize = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CpuSet {
    pub id: u32,
    pub group: u16,
    pub logical_index: u8,
    pub last_level_cache: u8,
    pub efficiency_class: u8,
    /// Reserved for one application (Game Mode exclusive sets); requests
    /// from anyone else are ignored, so it is left out of every plan.
    pub allocated: bool,
    pub l3_bytes: u32,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PlanKind {
    VCache,
    Hybrid,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Plan {
    pub kind: PlanKind,
    pub game: Vec<u32>,
    pub background: Vec<u32>,
}

/// Decides where a game and the rest of the session should run, or `None`
/// when this CPU has nothing to steer between.
pub fn plan(sets: &[CpuSet]) -> Option<Plan> {
    let usable: Vec<&CpuSet> = sets.iter().filter(|s| !s.allocated).collect();
    let classes: HashSet<u8> = usable.iter().map(|s| s.efficiency_class).collect();
    if classes.len() > 1 {
        let top = *classes.iter().max()?;
        let (game, background): (Vec<&CpuSet>, Vec<&CpuSet>) =
            usable.iter().partition(|s| s.efficiency_class == top);
        return (game.len() >= MIN_GAME_SETS && !background.is_empty()).then(|| Plan {
            kind: PlanKind::Hybrid,
            game: game.iter().map(|s| s.id).collect(),
            background: background.iter().map(|s| s.id).collect(),
        });
    }
    // One entry per last-level cache: (group, cache index) -> size.
    let mut domains: Vec<((u16, u8), u32)> = Vec::new();
    for s in &usable {
        let key = (s.group, s.last_level_cache);
        if !domains.iter().any(|(k, _)| *k == key) {
            domains.push((key, s.l3_bytes));
        }
    }
    let largest = domains.iter().map(|(_, size)| *size).max()?;
    let winners: Vec<_> = domains.iter().filter(|(_, size)| *size == largest).collect();
    if domains.len() < 2 || winners.len() != 1 || largest == 0 {
        return None;
    }
    let key = winners[0].0;
    let game: Vec<u32> = usable
        .iter()
        .filter(|s| (s.group, s.last_level_cache) == key)
        .map(|s| s.id)
        .collect();
    (game.len() >= MIN_GAME_SETS).then_some(Plan {
        kind: PlanKind::VCache,
        game,
        background: Vec::new(),
    })
}

/// A process as the session watcher sees it. `executable` is the normalized,
/// lower-case full path, or `None` when it could not be read.
pub struct Candidate {
    pub pid: u32,
    pub parent: Option<u32>,
    pub executable: Option<String>,
}

/// The processes that may be moved to the background cores, before the
/// per-process checks (session, priority, existing CPU sets) that need a
/// handle. `windows_dir` is lower case and ends with a backslash.
pub fn background_pids(
    candidates: &[Candidate],
    game_pid: u32,
    own_pid: u32,
    windows_dir: &str,
) -> Vec<u32> {
    // The game's own helpers (crash handler, web view, launcher children it
    // spawned) stay with the game.
    let mut family = HashSet::from([game_pid]);
    loop {
        let before = family.len();
        for c in candidates {
            if c.parent.is_some_and(|p| family.contains(&p)) {
                family.insert(c.pid);
            }
        }
        if family.len() == before {
            break;
        }
    }
    candidates
        .iter()
        .filter(|c| c.pid > 4 && c.pid != own_pid && !family.contains(&c.pid))
        .filter(|c| {
            c.executable
                .as_deref()
                .is_some_and(|path| !path.starts_with(windows_dir))
        })
        .map(|c| c.pid)
        .collect()
}

fn records(entry: SnapshotEntry) -> Vec<(u32, u64, Vec<u32>)> {
    let SnapshotEntry::Composite { entries } = entry else {
        return Vec::new();
    };
    entries
        .into_iter()
        .filter_map(|e| match e {
            SnapshotEntry::ProcessCpuSets {
                pid,
                creation,
                cpu_sets,
            } => Some((pid, creation, cpu_sets)),
            _ => None,
        })
        .collect()
}

fn composite(records: &[(u32, u64, Vec<u32>)]) -> SnapshotEntry {
    SnapshotEntry::Composite {
        entries: records
            .iter()
            .map(|(pid, creation, sets)| SnapshotEntry::ProcessCpuSets {
                pid: *pid,
                creation: *creation,
                cpu_sets: sets.clone(),
            })
            .collect(),
    }
}

pub fn session_owner(store: &RollbackStore) -> Result<Option<String>, String> {
    Ok(store.transaction()?.owner(TWEAK_ID).map(str::to_owned))
}

/// Puts back every process this session steered that is still exactly as it
/// was left. A failure keeps the journal so the next attempt can finish.
pub fn restore(store: &RollbackStore, owner: &str) -> Result<(), String> {
    crate::game_sessions::validate_owner_token(owner)?;
    let mut transaction = store.transaction()?;
    if transaction.owner(TWEAK_ID) != Some(owner) || transaction.entry(TWEAK_ID).is_none() {
        return Ok(());
    }
    let result = transaction.restore_entry(TWEAK_ID, |entry| {
        // Every process gets its turn even when one fails; the journal is
        // kept for a retry, and the ones already put back are skipped then
        // because their sets no longer match.
        let mut first_error = None;
        for (pid, creation, sets) in records(entry) {
            if let Err(error) = native::restore_process(pid, creation, &sets) {
                first_error.get_or_insert(error);
            }
        }
        first_error.map_or(Ok(()), Err)
    });
    crate::process_guard::audit(
        "core-steering",
        "restored",
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

/// For `RunEvent::Exit`: restore whatever the session in *this* process
/// still owns. A token from another process is that process's to restore.
pub fn restore_owned_by_this_process(store: &RollbackStore) -> Result<(), String> {
    let Some(owner) = session_owner(store)? else {
        return Ok(());
    };
    if owner.split('-').nth(1) == Some(std::process::id().to_string().as_str()) {
        restore(store, &owner)?;
    }
    Ok(())
}

pub use native::{apply, cpu_sets, extend};

/// Mirrors `CoreSteeringStatus` in src/types.ts.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CoreSteeringStatus {
    pub enabled: bool,
    /// `None` on a CPU with nothing to steer between.
    pub kind: Option<PlanKind>,
    pub game_cpu_sets: usize,
    pub background_cpu_sets: usize,
    /// Processes the running session has steered, the game included.
    pub steered_processes: usize,
}

#[tauri::command(async)]
pub fn core_steering_status(app: tauri::AppHandle) -> Result<CoreSteeringStatus, String> {
    let dir = crate::store_for_dir(&app)?;
    let plan = cpu_sets().ok().and_then(|sets| plan(&sets));
    let store = RollbackStore::new(dir.clone());
    let transaction = store.transaction()?;
    let steered = if transaction.owner(TWEAK_ID).is_some() {
        transaction.entry(TWEAK_ID).map_or(0, |e| records(e).len())
    } else {
        0
    };
    Ok(CoreSteeringStatus {
        enabled: crate::game_sessions::core_steering_enabled(&dir),
        kind: plan.as_ref().map(|p| p.kind),
        game_cpu_sets: plan.as_ref().map_or(0, |p| p.game.len()),
        background_cpu_sets: plan.as_ref().map_or(0, |p| p.background.len()),
        steered_processes: steered,
    })
}

#[cfg(windows)]
mod native {
    use super::*;
    use std::mem::{size_of, zeroed};
    use crate::process_guard::{self, Access, OpenError, ProcessHandle};
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_INSUFFICIENT_BUFFER, FILETIME};
    use windows_sys::Win32::System::RemoteDesktop::ProcessIdToSessionId;
    use windows_sys::Win32::System::SystemInformation::{
        CpuSetInformation, GetSystemCpuSetInformation, GetWindowsDirectoryW,
        SYSTEM_CPU_SET_INFORMATION, SYSTEM_CPU_SET_INFORMATION_ALLOCATED,
    };
    use windows_sys::Win32::System::Threading::{
        GetPriorityClass, GetProcessDefaultCpuSets, GetProcessTimes, SetProcessDefaultCpuSets,
        BELOW_NORMAL_PRIORITY_CLASS, IDLE_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS,
    };

    /// Every CPU set on the machine, with the size of the L3 it sits under.
    pub fn cpu_sets() -> Result<Vec<CpuSet>, String> {
        let mut needed = 0u32;
        // SAFETY: a null buffer with length 0 only asks for the size.
        unsafe {
            GetSystemCpuSetInformation(std::ptr::null_mut(), 0, &mut needed, std::ptr::null_mut(), 0)
        };
        if needed == 0 {
            return Err("Windows reported no CPU sets".into());
        }
        // u64 storage keeps each record 8-byte aligned (it holds a u64).
        let mut buffer = vec![0u64; (needed as usize).div_ceil(8)];
        // SAFETY: `buffer` holds at least `needed` bytes.
        let ok = unsafe {
            GetSystemCpuSetInformation(
                buffer.as_mut_ptr().cast(),
                needed,
                &mut needed,
                std::ptr::null_mut(),
                0,
            )
        };
        if ok == 0 {
            return Err("could not read the CPU topology".into());
        }
        let l3 = crate::x3d::win::l3_groups().unwrap_or_default();
        let bytes = buffer.as_ptr().cast::<u8>();
        let mut sets = Vec::new();
        let mut offset = 0usize;
        while offset + size_of::<SYSTEM_CPU_SET_INFORMATION>() <= needed as usize {
            // SAFETY: the record lies inside the buffer (checked above); it
            // may not be 8-aligned once walked by Size, hence read_unaligned.
            let record: SYSTEM_CPU_SET_INFORMATION =
                unsafe { std::ptr::read_unaligned(bytes.add(offset).cast()) };
            let size = record.Size as usize;
            if size == 0 {
                break;
            }
            if record.Type == CpuSetInformation {
                // SAFETY: Type says the union holds a CpuSet.
                let cpu = unsafe { record.Anonymous.CpuSet };
                // SAFETY: every bit pattern of this u8 union member is valid.
                let flags = u32::from(unsafe { cpu.Anonymous1.AllFlags });
                let bit = 1u64 << (cpu.LogicalProcessorIndex % 64);
                sets.push(CpuSet {
                    id: cpu.Id,
                    group: cpu.Group,
                    logical_index: cpu.LogicalProcessorIndex,
                    last_level_cache: cpu.LastLevelCacheIndex,
                    efficiency_class: cpu.EfficiencyClass,
                    allocated: flags & SYSTEM_CPU_SET_INFORMATION_ALLOCATED != 0,
                    l3_bytes: if cpu.Group == 0 {
                        l3.iter()
                            .find(|(mask, _)| mask & bit != 0)
                            .map_or(0, |(_, size)| *size)
                    } else {
                        0
                    },
                });
            }
            offset += size;
        }
        Ok(sets)
    }

    /// A process opened through the guard with query-limited and set-limited
    /// rights only: enough for CPU sets, refused for protected processes.
    struct Process(ProcessHandle);

    impl Process {
        fn open(pid: u32) -> Option<Self> {
            Self::open_checked(pid).ok()
        }

        fn open_checked(pid: u32) -> Result<Self, OpenError> {
            process_guard::open(pid, Access::CpuSets).map(Process)
        }

        fn creation(&self) -> Option<u64> {
            // SAFETY: FILETIME is two u32s; all four are live out-parameters.
            let mut times: [FILETIME; 4] = unsafe { zeroed() };
            let [created, exited, kernel, user] = &mut times;
            // SAFETY: the handle is open with query rights.
            let ok = unsafe { GetProcessTimes(self.0.raw(), created, exited, kernel, user) };
            let value = (u64::from(times[0].dwHighDateTime) << 32) | u64::from(times[0].dwLowDateTime);
            (ok != 0 && value != 0).then_some(value)
        }

        fn is_running(&self) -> bool {
            /// STILL_ACTIVE: the exit code of a process that has not exited.
            const STILL_ACTIVE: u32 = 259;
            let mut code = 0u32;
            // SAFETY: the handle is open with query rights; `code` is live.
            (unsafe { windows_sys::Win32::System::Threading::GetExitCodeProcess(self.0.raw(), &mut code) } != 0)
                && code == STILL_ACTIVE
        }

        /// Applies `ids` only if the process still has no CPU sets of its own
        /// at this moment. Checked again here, right before the write, because
        /// a game can choose its own sets while the journal is being written.
        /// True only when this call made the change.
        fn steer(&self, ids: &[u32]) -> bool {
            self.cpu_sets().is_some_and(|current| current.is_empty()) && self.set_cpu_sets(ids)
        }

        fn priority_is_normal_or_lower(&self) -> bool {
            // SAFETY: the handle is open with query rights.
            let class = unsafe { GetPriorityClass(self.0.raw()) };
            [NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS, IDLE_PRIORITY_CLASS].contains(&class)
        }

        fn cpu_sets(&self) -> Option<Vec<u32>> {
            let mut ids = vec![0u32; 64];
            loop {
                let mut required = 0u32;
                // SAFETY: `ids` holds `ids.len()` u32s.
                let ok = unsafe {
                    GetProcessDefaultCpuSets(self.0.raw(), ids.as_mut_ptr(), ids.len() as u32, &mut required)
                };
                if ok != 0 {
                    ids.truncate(required as usize);
                    return Some(ids);
                }
                // SAFETY: plain call, read right after the failure.
                if unsafe { GetLastError() } != ERROR_INSUFFICIENT_BUFFER
                    || required as usize <= ids.len()
                    || required as usize > MAX_CPU_SETS
                {
                    return None;
                }
                ids.resize(required as usize, 0);
            }
        }

        /// An empty slice clears the process default.
        fn set_cpu_sets(&self, ids: &[u32]) -> bool {
            let pointer = if ids.is_empty() { std::ptr::null() } else { ids.as_ptr() };
            // SAFETY: `pointer` is null with a zero count, or `ids` itself.
            (unsafe { SetProcessDefaultCpuSets(self.0.raw(), pointer, ids.len() as u32) }) != 0
        }
    }

    fn session_of(pid: u32) -> Option<u32> {
        let mut session = 0u32;
        // SAFETY: `session` is a live out-parameter.
        (unsafe { ProcessIdToSessionId(pid, &mut session) } != 0).then_some(session)
    }

    fn windows_dir() -> String {
        let mut path = [0u16; 260];
        // SAFETY: `path` holds 260 u16s, the size passed.
        let len = unsafe { GetWindowsDirectoryW(path.as_mut_ptr(), path.len() as u32) } as usize;
        let dir = if len == 0 || len >= path.len() {
            r"C:\Windows".to_string()
        } else {
            String::from_utf16_lossy(&path[..len])
        };
        format!("{}\\", dir.trim_end_matches('\\').to_lowercase())
    }

    /// Opens `pid` and returns its identity if it may be steered now.
    fn eligible(pid: u32, own_session: u32) -> Option<(Process, u64)> {
        if session_of(pid)? != own_session {
            return None;
        }
        let process = Process::open(pid)?;
        let creation = process.creation()?;
        (process.priority_is_normal_or_lower() && process.cpu_sets()?.is_empty())
            .then_some((process, creation))
    }

    fn background(
        plan: &Plan,
        candidates: &[Candidate],
        game_pid: u32,
        skip: &HashSet<u32>,
        room: usize,
    ) -> Vec<(Process, (u32, u64, Vec<u32>))> {
        if plan.background.is_empty() {
            return Vec::new();
        }
        let own = std::process::id();
        let Some(own_session) = session_of(own) else {
            return Vec::new();
        };
        background_pids(candidates, game_pid, own, &windows_dir())
            .into_iter()
            .filter(|pid| !skip.contains(pid))
            .filter_map(|pid| {
                eligible(pid, own_session)
                    .map(|(process, creation)| (process, (pid, creation, plan.background.clone())))
            })
            .take(room)
            .collect()
    }

    /// Starts steering for a session. `Ok(false)` when there is nothing to do
    /// on this CPU or for this game, which leaves no journal behind.
    pub fn apply(
        store: &RollbackStore,
        owner: &str,
        game_pid: u32,
        game_executable: &str,
        candidates: &[Candidate],
    ) -> Result<bool, String> {
        crate::game_sessions::validate_owner_token(owner)?;
        let Some(plan) = plan(&cpu_sets()?) else {
            return Ok(false);
        };
        apply_with_plan(store, owner, &plan, game_pid, game_executable, candidates)
    }

    pub(super) fn apply_with_plan(
        store: &RollbackStore,
        owner: &str,
        plan: &Plan,
        game_pid: u32,
        game_executable: &str,
        candidates: &[Candidate],
    ) -> Result<bool, String> {
        let mut steered: Vec<(Process, (u32, u64, Vec<u32>))> = Vec::new();
        if let Some(game) = Process::open(game_pid) {
            // The PID must still be the game that was matched, and a game
            // that chose its own CPU sets keeps them.
            let same = process_guard::image_path(game_pid)
                .and_then(|path| crate::game_sessions::executable_key(&path))
                .is_some_and(|key| key == game_executable);
            if let (true, Some(creation), Some(true)) =
                (same, game.creation(), game.cpu_sets().map(|s| s.is_empty()))
            {
                steered.push((game, (game_pid, creation, plan.game.clone())));
            }
        }
        steered.extend(background(
            plan,
            candidates,
            game_pid,
            &HashSet::new(),
            MAX_PROCESSES - steered.len(),
        ));
        if steered.is_empty() {
            return Ok(false);
        }
        let records: Vec<_> = steered.iter().map(|(_, r)| r.clone()).collect();
        let mut transaction = store.transaction()?;
        transaction.save_owned_entry(TWEAK_ID, composite(&records), owner)?;
        // Journaled; now the changes.
        let changed: Vec<_> = steered
            .iter()
            .filter(|(process, (_, _, sets))| process.steer(sets))
            .map(|(_, record)| record.clone())
            .collect();
        // A process that chose its own sets meanwhile must not stay in the
        // journal: if it happened to choose exactly ours, restore would clear
        // its own choice. The journal shrinks only after the writes.
        if changed.is_empty() {
            transaction.restore_entry(TWEAK_ID, |_| Ok(()))?;
            return Ok(false);
        }
        if changed.len() != records.len() {
            transaction.replace_owned_entry(TWEAK_ID, composite(&changed), owner)?;
        }
        crate::process_guard::audit(
            "core-steering",
            &format!("{} processes", changed.len()),
            true,
            None,
        );
        Ok(true)
    }

    /// Steers background processes that started after the session did, and
    /// forgets records of processes that have exited. Returns how many were
    /// added.
    pub fn extend(
        store: &RollbackStore,
        owner: &str,
        game_pid: u32,
        candidates: &[Candidate],
    ) -> Result<usize, String> {
        let mut transaction = store.transaction()?;
        if transaction.owner(TWEAK_ID) != Some(owner) {
            return Ok(0);
        }
        let Some(entry) = transaction.entry(TWEAK_ID) else {
            return Ok(0);
        };
        let Some(plan) = plan(&cpu_sets()?) else {
            return Ok(0);
        };
        let mut known = records(entry);
        let skip: HashSet<u32> = known.iter().map(|(pid, _, _)| *pid).collect();
        let fresh = background(&plan, candidates, game_pid, &skip, usize::MAX);
        if fresh.is_empty() {
            return Ok(0);
        }
        let alive: HashSet<u32> = candidates.iter().map(|c| c.pid).collect();
        known.retain(|(pid, _, _)| alive.contains(pid));
        let room = MAX_PROCESSES.saturating_sub(known.len());
        let fresh: Vec<_> = fresh.into_iter().take(room).collect();
        if fresh.is_empty() {
            return Ok(0);
        }
        let before = known.clone();
        known.extend(fresh.iter().map(|(_, r)| r.clone()));
        transaction.replace_owned_entry(TWEAK_ID, composite(&known), owner)?;
        let changed: Vec<_> = fresh
            .iter()
            .filter(|(process, (_, _, sets))| process.steer(sets))
            .map(|(_, record)| record.clone())
            .collect();
        if changed.len() != fresh.len() {
            let mut kept = before;
            kept.extend(changed.iter().cloned());
            transaction.replace_owned_entry(TWEAK_ID, composite(&kept), owner)?;
        }
        if !changed.is_empty() {
            crate::process_guard::audit(
                "core-steering",
                &format!("{} processes", changed.len()),
                true,
                None,
            );
        }
        Ok(changed.len())
    }

    /// Clears one process's sets if it is still the same process and still
    /// has exactly the sets it was given. A process that is gone, reused or
    /// re-steered by someone else counts as done. One that exists but cannot
    /// be opened (steered while PC Tweaker ran elevated, restored now without)
    /// keeps the journal, which resolves itself once that process exits.
    pub fn restore_process(pid: u32, creation: u64, applied: &[u32]) -> Result<(), String> {
        let process = match Process::open_checked(pid) {
            Ok(process) => process,
            Err(OpenError::Gone) => return Ok(()), // exited
            // A protected process is never opened; its CPU sets die with it,
            // and the journal entry resolves itself once it has exited.
            Err(error) => {
                return Err(format!(
                    "process {pid} could not be opened to restore its CPU sets: {error}"
                ))
            }
        };
        if process.creation() != Some(creation) {
            return Ok(()); // the PID now belongs to another process
        }
        if !process.is_running() {
            return Ok(()); // exited, kept open only by someone else's handle
        }
        let mut expected = applied.to_vec();
        expected.sort_unstable();
        let mut current = process.cpu_sets().unwrap_or_default();
        current.sort_unstable();
        if current != expected {
            return Ok(()); // changed since: someone else's decision now
        }
        if !process.set_cpu_sets(&[]) || process.cpu_sets().is_some_and(|s| !s.is_empty()) {
            return Err(format!("could not restore the CPU sets of process {pid}"));
        }
        Ok(())
    }

    #[cfg(test)]
    pub(super) fn own_cpu_sets() -> Option<Vec<u32>> {
        Process::open(std::process::id())?.cpu_sets()
    }

    #[cfg(test)]
    pub(super) fn own_creation() -> Option<u64> {
        Process::open(std::process::id())?.creation()
    }

    #[cfg(test)]
    pub(super) fn set_own(ids: &[u32]) -> bool {
        Process::open(std::process::id()).is_some_and(|p| p.set_cpu_sets(ids))
    }
}

#[cfg(not(windows))]
mod native {
    use super::*;
    pub fn cpu_sets() -> Result<Vec<CpuSet>, String> {
        Err("not supported on this platform".into())
    }
    pub fn apply(
        _store: &RollbackStore,
        _owner: &str,
        _game_pid: u32,
        _game_executable: &str,
        _candidates: &[Candidate],
    ) -> Result<bool, String> {
        Ok(false)
    }
    pub fn extend(
        _store: &RollbackStore,
        _owner: &str,
        _game_pid: u32,
        _candidates: &[Candidate],
    ) -> Result<usize, String> {
        Ok(0)
    }
    pub fn restore_process(_pid: u32, _creation: u64, _applied: &[u32]) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(id: u32, class: u8, llc: u8, l3_mib: u32) -> CpuSet {
        CpuSet {
            id,
            group: 0,
            logical_index: (id - 256) as u8,
            last_level_cache: llc,
            efficiency_class: class,
            allocated: false,
            l3_bytes: l3_mib << 20,
        }
    }

    /// Ids from 256, like Windows hands them out.
    fn machine(layout: &[(usize, u8, u8, u32)]) -> Vec<CpuSet> {
        let mut out = Vec::new();
        for &(count, class, llc, l3) in layout {
            for _ in 0..count {
                out.push(set(256 + out.len() as u32, class, llc, l3));
            }
        }
        out
    }

    #[test]
    fn a_7950x3d_sends_the_game_to_the_vcache_die_and_leaves_the_rest_alone() {
        let cpu = machine(&[(16, 0, 0, 96), (16, 0, 16, 32)]);
        let plan = plan(&cpu).unwrap();
        assert_eq!(plan.kind, PlanKind::VCache);
        assert_eq!(plan.game, (256..272).collect::<Vec<_>>());
        assert!(plan.background.is_empty());
    }

    #[test]
    fn a_13900k_sends_the_game_to_p_cores_and_the_rest_to_e_cores() {
        let cpu = machine(&[(16, 1, 0, 36), (16, 0, 0, 36)]);
        let plan = plan(&cpu).unwrap();
        assert_eq!(plan.kind, PlanKind::Hybrid);
        assert_eq!(plan.game, (256..272).collect::<Vec<_>>());
        assert_eq!(plan.background, (272..288).collect::<Vec<_>>());
    }

    #[test]
    fn three_efficiency_classes_give_the_game_only_the_fastest() {
        // Meteor Lake style: P, E and low-power E.
        let cpu = machine(&[(12, 2, 0, 24), (8, 1, 0, 24), (2, 0, 1, 0)]);
        let plan = plan(&cpu).unwrap();
        assert_eq!(plan.game.len(), 12);
        assert_eq!(plan.background.len(), 10);
    }

    #[test]
    fn uniform_or_single_die_cpus_have_nothing_to_steer() {
        assert_eq!(plan(&machine(&[(16, 0, 0, 32), (16, 0, 16, 32)])), None, "7950X");
        assert_eq!(plan(&machine(&[(16, 0, 0, 96)])), None, "7800X3D");
        assert_eq!(plan(&machine(&[(8, 0, 0, 0), (8, 0, 8, 0)])), None, "sizes unknown");
        assert_eq!(plan(&[]), None);
    }

    #[test]
    fn too_few_fast_cores_or_reserved_sets_are_not_steered_onto() {
        // Two P threads would squeeze a game; GDK asks for three to four cores.
        assert_eq!(plan(&machine(&[(2, 1, 0, 12), (8, 0, 0, 12)])), None);
        let mut cpu = machine(&[(8, 1, 0, 30), (8, 0, 0, 30)]);
        for s in cpu.iter_mut().take(6) {
            s.allocated = true;
        }
        assert_eq!(plan(&cpu), None, "only two usable P sets remain");
    }

    fn candidate(pid: u32, parent: Option<u32>, path: &str) -> Candidate {
        Candidate {
            pid,
            parent,
            executable: Some(path.to_lowercase()),
        }
    }

    #[test]
    fn background_skips_the_game_its_children_the_system_and_this_app() {
        let processes = [
            candidate(4, None, r"c:\windows\system32\ntoskrnl.exe"),
            candidate(100, None, r"c:\games\game.exe"),
            candidate(101, Some(100), r"c:\games\crashhandler.exe"),
            candidate(102, Some(101), r"c:\games\webhelper.exe"),
            candidate(200, None, r"c:\windows\explorer.exe"),
            candidate(300, None, r"c:\program files\discord\discord.exe"),
            candidate(301, Some(300), r"c:\program files\discord\update.exe"),
            candidate(400, None, r"c:\program files\pc tweaker\pc tweaker.exe"),
            Candidate {
                pid: 500,
                parent: None,
                executable: None,
            },
        ];
        let pids = background_pids(&processes, 100, 400, r"c:\windows\");
        assert_eq!(pids, vec![300, 301]);
    }

    #[test]
    fn snapshots_are_validated_and_round_trip_through_the_journal() {
        let good = composite(&[(1234, 133_000_000_000_000_000, vec![256, 257])]);
        assert!(crate::rollback::validate_snapshot(TWEAK_ID, &good).is_ok());
        for bad in [
            composite(&[]),
            composite(&[(0, 1, vec![256])]),
            composite(&[(1, 0, vec![256])]),
            composite(&[(1, 1, vec![])]),
        ] {
            assert!(crate::rollback::validate_snapshot(TWEAK_ID, &bad).is_err());
        }
        assert_eq!(records(good), vec![(1234, 133_000_000_000_000_000, vec![256, 257])]);
    }

    fn fixture() -> (std::path::PathBuf, RollbackStore) {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "pct-steer-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        (dir.clone(), RollbackStore::new(dir))
    }

    #[test]
    fn only_the_owning_session_can_grow_or_restore_the_journal() {
        let (dir, store) = fixture();
        let owner = "gs-1-2-3-4";
        let entry = composite(&[(9, 9, vec![256])]);
        let mut tx = store.transaction().unwrap();
        tx.save_owned_entry(TWEAK_ID, entry.clone(), owner).unwrap();
        let bigger = composite(&[(9, 9, vec![256]), (10, 10, vec![257])]);
        assert!(tx.replace_owned_entry(TWEAK_ID, bigger.clone(), "gs-5-6-7-8").is_err());
        tx.replace_owned_entry(TWEAK_ID, bigger, owner).unwrap();
        drop(tx);
        assert_eq!(session_owner(&store).unwrap().as_deref(), Some(owner));
        // Another token restores nothing; the owner's restore clears it. PIDs 9
        // and 10 are not this test's processes, so there is nothing to undo.
        restore(&store, "gs-5-6-7-8").unwrap();
        assert!(store.is_applied(TWEAK_ID));
        restore(&store, owner).unwrap();
        assert!(!store.is_applied(TWEAK_ID));
        assert_eq!(session_owner(&store).unwrap(), None);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn exit_restores_only_a_session_this_process_started() {
        let (dir, store) = fixture();
        let foreign = format!("gs-{}-2-3-4", std::process::id().wrapping_add(1).max(1));
        store
            .transaction()
            .unwrap()
            .save_owned_entry(TWEAK_ID, composite(&[(9, 9, vec![256])]), &foreign)
            .unwrap();
        restore_owned_by_this_process(&store).unwrap();
        assert!(store.is_applied(TWEAK_ID), "another process's session was restored");
        let _ = std::fs::remove_dir_all(dir);
    }

    /// Real CPU sets on this test process: journal, steer, restore, and the
    /// two refusals (another process instance, sets changed since). It uses
    /// every CPU set, a real non-empty default that restricts nothing, so the
    /// tests running alongside are not squeezed onto one core.
    #[cfg(windows)]
    #[test]
    fn steering_this_process_round_trips_through_the_rollback_store() {
        let all: Vec<u32> = cpu_sets().unwrap().iter().map(|s| s.id).collect();
        assert!(!all.is_empty());
        let own = std::process::id();
        let creation = native::own_creation().unwrap();
        let exe = std::env::current_exe().unwrap();
        let key = crate::game_sessions::executable_key(exe.to_str().unwrap()).unwrap();
        let owner = format!("gs-{own}-2-3-4");
        let (dir, store) = fixture();

        // The session path: this test binary plays the game.
        let plan = Plan {
            kind: PlanKind::Hybrid,
            game: all.clone(),
            background: Vec::new(),
        };
        assert!(native::apply_with_plan(&store, &owner, &plan, own, &key, &[]).unwrap());
        assert_eq!(native::own_cpu_sets().unwrap().len(), all.len());
        restore(&store, &owner).unwrap();
        assert!(native::own_cpu_sets().unwrap().is_empty());
        assert!(!store.is_applied(TWEAK_ID));

        // A PID whose creation time differs is another process: untouched.
        let journal = |creation: u64, sets: Vec<u32>| {
            store
                .transaction()
                .unwrap()
                .save_owned_entry(TWEAK_ID, composite(&[(own, creation, sets)]), &owner)
                .unwrap()
        };
        assert!(native::set_own(&all));
        journal(creation + 1, all.clone());
        restore(&store, &owner).unwrap();
        assert_eq!(native::own_cpu_sets().unwrap().len(), all.len());

        // Sets that changed since they were applied are someone else's now.
        journal(creation, vec![all[0]]);
        restore(&store, &owner).unwrap();
        assert_eq!(native::own_cpu_sets().unwrap().len(), all.len());

        assert!(native::set_own(&[]));
        let _ = std::fs::remove_dir_all(dir);
    }

    /// The field names and enum strings src/types.ts is written against.
    #[test]
    fn the_wire_format_matches_the_typescript_contract() {
        let status = CoreSteeringStatus {
            enabled: true,
            kind: Some(PlanKind::VCache),
            game_cpu_sets: 16,
            background_cpu_sets: 0,
            steered_processes: 1,
        };
        assert_eq!(
            serde_json::to_value(status).unwrap(),
            serde_json::json!({
                "enabled": true,
                "kind": "vCache",
                "gameCpuSets": 16,
                "backgroundCpuSets": 0,
                "steeredProcesses": 1
            })
        );
        assert_eq!(serde_json::to_value(PlanKind::Hybrid).unwrap(), "hybrid");
    }
}
