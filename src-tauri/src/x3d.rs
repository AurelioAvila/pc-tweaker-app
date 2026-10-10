//! Steers a process onto the CPU die that carries the 3D V-Cache.
//!
//! AMD's dual-die X3D parts (7900X3D, 7950X3D, 9950X3D and friends) are not
//! symmetric: one CCD carries the stacked cache and clocks slightly lower, the
//! other clocks higher with an ordinary cache. Games are overwhelmingly
//! cache-bound, so they want the first die — but the Windows scheduler has no
//! idea which is which and will happily spread a game across both, at which
//! point every cross-die access pays an Infinity Fabric round trip.
//!
//! What this module does NOT do, on purpose:
//!
//! * It does not read AMD's private tables or install a driver. The die layout
//!   is derived from `GetLogicalProcessorInformationEx`, a documented Windows
//!   call, by looking at which logical processors share an L3 cache and how
//!   big each of those caches is. The die with strictly more L3 is the one
//!   with the stacked cache; there is no guesswork and no model list to go
//!   stale.
//! * It does not pretend to help on a single-die part. A 7800X3D has one CCD
//!   and every core on it already sees the V-Cache, so there is nothing to
//!   steer and the UI says exactly that rather than offering a placebo switch.
//! * It does not persist. The steering belongs to a running process and dies
//!   with it; claiming otherwise would be a lie the next reboot exposes.
//! * It does not use affinity masks. A die is applied as the process's default
//!   CPU sets, the mechanism Microsoft's game guidance recommends, which needs
//!   only `PROCESS_SET_LIMITED_INFORMATION`. Threads a program pins itself keep
//!   their own choice. Games that manage their own performance are left alone.

use serde::Serialize;

/// One cache-coherent die: the logical processors that share a single L3.
#[derive(Serialize, Clone)]
pub struct Ccd {
    pub index: usize,
    /// Affinity mask for this die, as `SetProcessAffinityMask` wants it.
    pub mask: u64,
    pub logical_count: u32,
    pub l3_bytes: u32,
}

/// Why the aligner is or is not offered on this machine. The frontend shows
/// a different sentence for each, because "we can't help you" and "you don't
/// need help" are not the same message.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum X3dStatus {
    /// Two or more dies, one with strictly more L3: the case this exists for.
    Ready,
    /// One die. Every core already has whatever cache the part has.
    SingleDie,
    /// Several dies, all with the same L3. A plain 7950X, say — real dies,
    /// but no cache asymmetry to align to.
    UniformCache,
    /// The topology could not be read at all.
    Unavailable,
}

#[derive(Serialize)]
pub struct X3dReport {
    pub cpu: String,
    pub ccds: Vec<Ccd>,
    /// Index into `ccds`. `None` unless `status` is `Ready`.
    pub vcache_ccd: Option<usize>,
    pub status: X3dStatus,
}

/// A process the user could plausibly want to steer, with what it is doing now.
#[derive(Serialize)]
pub struct ProcessEntry {
    pub pid: u32,
    pub name: String,
    pub cpu_pct: f32,
    pub memory_bytes: u64,
    /// The logical processors the process is steered to, as a mask, so the UI
    /// can show a process as already aligned instead of offering to do what is
    /// already done. All processors when it has no CPU sets of its own; `None`
    /// when it was not looked at (a game that manages its own performance, or
    /// a moment when such a game is running).
    pub affinity: Option<u64>,
}

#[cfg(windows)]
pub(crate) mod win {
    use super::{Ccd, ProcessEntry, X3dReport, X3dStatus};
    use crate::process_guard::{self, Access};
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_INSUFFICIENT_BUFFER};
    use windows_sys::Win32::System::SystemInformation::{
        GetLogicalProcessorInformationEx, RelationCache, SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX,
    };
    use windows_sys::Win32::System::Threading::{GetProcessDefaultCpuSets, SetProcessDefaultCpuSets};

    /// Reads the L3 cache groups the machine actually reports.
    ///
    /// The call is made twice on purpose: once with a zero-length buffer to
    /// learn the size, then for real. The structures are variable-length and
    /// walked by each record's own `Size` field — indexing them as a fixed
    /// array is the classic way to read this wrong on a machine with a
    /// different cache layout than the one it was tested on.
    pub(crate) fn l3_groups() -> Option<Vec<(u64, u32)>> {
        unsafe {
            let mut len: u32 = 0;
            GetLogicalProcessorInformationEx(RelationCache, std::ptr::null_mut(), &mut len);
            if len == 0 {
                return None;
            }
            let mut buf = vec![0u8; len as usize];
            let ok = GetLogicalProcessorInformationEx(
                RelationCache,
                buf.as_mut_ptr()
                    .cast::<SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX>(),
                &mut len,
            );
            if ok == 0 {
                return None;
            }

            let mut out: Vec<(u64, u32)> = Vec::new();
            let mut offset = 0usize;
            while offset + std::mem::size_of::<u32>() * 2 <= len as usize {
                let rec = buf
                    .as_ptr()
                    .add(offset)
                    .cast::<SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX>();
                let size = (*rec).Size as usize;
                if size == 0 || offset + size > len as usize {
                    break;
                }
                let cache = &(*rec).Anonymous.Cache;
                if cache.Level == 3 {
                    // Consumer desktops have a single processor group, so the
                    // primary GroupMask is the whole story. A machine large
                    // enough to span groups is a server, where this feature
                    // does not apply anyway — better to report nothing than a
                    // mask that silently means "group 0 only".
                    let affinity = cache.Anonymous.GroupMask;
                    if affinity.Group == 0 {
                        out.push((affinity.Mask as u64, cache.CacheSize));
                    }
                }
                offset += size;
            }
            if out.is_empty() {
                None
            } else {
                Some(out)
            }
        }
    }

    fn cpu_name() -> String {
        let mut sys = sysinfo::System::new();
        sys.refresh_cpu_all();
        sys.cpus()
            .first()
            .map(|cpu| cpu.brand().trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Unknown processor".to_string())
    }

    pub fn report() -> X3dReport {
        let cpu = cpu_name();
        let Some(groups) = l3_groups() else {
            return X3dReport {
                cpu,
                ccds: Vec::new(),
                vcache_ccd: None,
                status: X3dStatus::Unavailable,
            };
        };

        let ccds: Vec<Ccd> = groups
            .iter()
            .enumerate()
            .map(|(index, (mask, size))| Ccd {
                index,
                mask: *mask,
                logical_count: mask.count_ones(),
                l3_bytes: *size,
            })
            .collect();

        if ccds.len() < 2 {
            return X3dReport {
                cpu,
                ccds,
                vcache_ccd: None,
                status: X3dStatus::SingleDie,
            };
        }

        // Strictly larger, not merely largest: two identical dies have a
        // "largest" too, and steering to an arbitrary one of them would be
        // motion without effect.
        let largest = ccds.iter().max_by_key(|c| c.l3_bytes).unwrap().l3_bytes;
        let winners: Vec<usize> = ccds
            .iter()
            .filter(|c| c.l3_bytes == largest)
            .map(|c| c.index)
            .collect();

        if winners.len() != 1 {
            return X3dReport {
                cpu,
                ccds,
                vcache_ccd: None,
                status: X3dStatus::UniformCache,
            };
        }

        X3dReport {
            cpu,
            vcache_ccd: Some(winners[0]),
            ccds,
            status: X3dStatus::Ready,
        }
    }

    /// CPU set ids for the logical processors in `mask` (processor group 0,
    /// which is all a consumer desktop has).
    fn sets_for_mask(mask: u64) -> Result<Vec<u32>, String> {
        let sets = crate::engine::dynamic_session::cpu_sets()?;
        Ok(sets
            .iter()
            .filter(|s| s.group == 0 && s.logical_index < 64 && mask & (1u64 << s.logical_index) != 0)
            .map(|s| s.id)
            .collect())
    }

    /// The mask of every logical processor in group 0: what "not steered"
    /// looks like.
    fn all_processors_mask() -> Result<u64, String> {
        let sets = crate::engine::dynamic_session::cpu_sets()?;
        Ok(sets
            .iter()
            .filter(|s| s.group == 0 && s.logical_index < 64)
            .fold(0u64, |mask, s| mask | (1u64 << s.logical_index)))
    }

    fn mask_for_sets(ids: &[u32]) -> Result<u64, String> {
        if ids.is_empty() {
            return all_processors_mask();
        }
        let sets = crate::engine::dynamic_session::cpu_sets()?;
        Ok(sets
            .iter()
            .filter(|s| s.group == 0 && s.logical_index < 64 && ids.contains(&s.id))
            .fold(0u64, |mask, s| mask | (1u64 << s.logical_index)))
    }

    /// The process's default CPU sets, read with query-limited rights.
    fn current_sets(pid: u32) -> Option<Vec<u32>> {
        let process = process_guard::open(pid, Access::Query).ok()?;
        let mut ids = vec![0u32; 64];
        loop {
            let mut required = 0u32;
            // SAFETY: `ids` holds `ids.len()` u32s; the handle is live.
            let ok = unsafe {
                GetProcessDefaultCpuSets(process.raw(), ids.as_mut_ptr(), ids.len() as u32, &mut required)
            };
            if ok != 0 {
                ids.truncate(required as usize);
                return Some(ids);
            }
            // SAFETY: read straight after the failing call.
            if unsafe { GetLastError() } != ERROR_INSUFFICIENT_BUFFER
                || required as usize <= ids.len()
                || required > 1024
            {
                return None;
            }
            ids.resize(required as usize, 0);
        }
    }

    fn affinity_of(pid: u32) -> Option<u64> {
        mask_for_sets(&current_sets(pid)?).ok()
    }

    fn write_sets(pid: u32, ids: &[u32]) -> Result<(), String> {
        let process = process_guard::open(pid, Access::CpuSets)
            .map_err(|e| format!("process {pid} could not be opened: {e}"))?;
        let pointer = if ids.is_empty() { std::ptr::null() } else { ids.as_ptr() };
        // SAFETY: `pointer` is null with a zero count, or `ids` itself.
        if unsafe { SetProcessDefaultCpuSets(process.raw(), pointer, ids.len() as u32) } == 0 {
            return Err(format!(
                "Windows refused to steer process {pid}: {}",
                std::io::Error::last_os_error()
            ));
        }
        Ok(())
    }

    pub fn set_affinity(pid: u32, mask: u64) -> Result<(), String> {
        if mask == 0 {
            return Err(
                "an empty affinity mask would leave the process no core to run on".to_string(),
            );
        }
        let ids = sets_for_mask(mask)?;
        if ids.is_empty() {
            return Err("that mask names no processor on this machine".to_string());
        }
        write_sets(pid, &ids)
    }

    /// Back to every core: the process's default CPU sets are cleared.
    pub fn reset_affinity(pid: u32) -> Result<(), String> {
        write_sets(pid, &[])
    }

    /// Running processes worth offering, busiest first.
    ///
    /// Filtered to things with a real memory footprint and excluding this app
    /// itself: a list of 300 entries where 280 are service hosts is a list
    /// nobody reads. Read from the kernel's process table twice, 300 ms apart,
    /// for the CPU figure: no process is opened to list it. The current
    /// steering is read only for processes the guard allows, and for none
    /// while `paused`.
    pub fn processes(paused: bool) -> Vec<ProcessEntry> {
        let Ok(first) = process_guard::processes() else {
            return Vec::new();
        };
        let started = std::time::Instant::now();
        std::thread::sleep(std::time::Duration::from_millis(300));
        let Ok(second) = process_guard::processes() else {
            return Vec::new();
        };
        let elapsed_100ns = (started.elapsed().as_nanos() / 100).max(1) as f64;
        let cpus = std::thread::available_parallelism().map_or(1, |n| n.get()) as f64;
        let protected = process_guard::current().protected.clone();
        let self_pid = std::process::id();
        let mut list: Vec<ProcessEntry> = second
            .iter()
            .filter(|p| p.pid > 4 && p.pid != self_pid && p.working_set > 64 * 1024 * 1024)
            .map(|p| {
                let before = first
                    .iter()
                    .find(|q| q.pid == p.pid && q.created == p.created)
                    .map_or(p.cpu_time, |q| q.cpu_time);
                let busy = p.cpu_time.saturating_sub(before) as f64;
                let off_limits = paused
                    || protected.contains(&p.pid)
                    || process_guard::is_protected_name(&p.name);
                ProcessEntry {
                    pid: p.pid,
                    name: p.name.clone(),
                    cpu_pct: (busy / elapsed_100ns * 100.0 / cpus).clamp(0.0, 100.0) as f32,
                    memory_bytes: p.working_set,
                    affinity: if off_limits { None } else { affinity_of(p.pid) },
                }
            })
            .collect();

        list.sort_by(|a, b| {
            b.cpu_pct
                .partial_cmp(&a.cpu_pct)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(b.memory_bytes.cmp(&a.memory_bytes))
        });
        list.truncate(20);
        list
    }
}

#[cfg(windows)]
pub use win::{processes, report, reset_affinity, set_affinity};

#[cfg(not(windows))]
pub fn report() -> X3dReport {
    X3dReport {
        cpu: "Unknown processor".to_string(),
        ccds: Vec::new(),
        vcache_ccd: None,
        status: X3dStatus::Unavailable,
    }
}

#[cfg(not(windows))]
pub fn processes(_paused: bool) -> Vec<ProcessEntry> {
    Vec::new()
}

#[cfg(not(windows))]
pub fn set_affinity(_pid: u32, _mask: u64) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn reset_affinity(_pid: u32) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// The topology has to describe this machine's real processors: every die
    /// non-empty, and the dies together covering at least as many logical
    /// processors as Rust can see. A silently truncated walk of the buffer
    /// would show up here as a missing die.
    #[test]
    fn the_reported_dies_cover_the_machine() {
        let r = report();
        assert_ne!(
            r.status,
            X3dStatus::Unavailable,
            "no L3 topology at all on a machine that has one"
        );
        assert!(!r.ccds.is_empty());
        let covered: u32 = r.ccds.iter().map(|c| c.logical_count).sum();
        let seen = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1) as u32;
        assert!(
            covered >= seen,
            "dies cover {} logical processors but the machine has {}",
            covered,
            seen
        );
        for c in &r.ccds {
            assert!(c.mask != 0, "die {} has an empty affinity mask", c.index);
            assert!(c.l3_bytes > 0, "die {} reports no L3", c.index);
        }
    }

    /// `Ready` must imply a die to point at, and everything else must imply
    /// there isn't one. The UI branches on exactly this.
    #[test]
    fn only_a_ready_report_names_a_vcache_die() {
        let r = report();
        match r.status {
            X3dStatus::Ready => assert!(r.vcache_ccd.is_some()),
            _ => assert!(r.vcache_ccd.is_none()),
        }
    }
}

// --- Tauri surface ---------------------------------------------------------

#[tauri::command(async)]
pub fn x3d_report() -> X3dReport {
    report()
}

#[tauri::command(async)]
pub fn x3d_processes(app: tauri::AppHandle) -> Vec<ProcessEntry> {
    let paused = crate::store_for_dir(&app).map_or(true, |dir| crate::process_guard::paused(&dir));
    processes(paused)
}

/// A manual steer is refused for a game that manages its own performance, and
/// for anything at all while such a game is running.
fn may_steer(app: &tauri::AppHandle, pid: u32) -> Result<(), String> {
    let dir = crate::store_for_dir(app)?;
    if crate::process_guard::paused(&dir) {
        return Err(crate::process_guard::game_running_error());
    }
    if crate::process_guard::is_protected_pid(pid)
        || crate::process_guard::image_path(pid)
            .is_some_and(|path| crate::process_guard::is_protected_executable(&path))
    {
        return Err(crate::process_guard::self_managed_error());
    }
    Ok(())
}

/// Pins one process to one die.
///
/// The mask comes from the frontend, but is checked against the topology here
/// rather than trusted: `invoke` is reachable from anywhere in the webview, and
/// a mask naming processors this machine does not have would either fail
/// cryptically or — worse — succeed at pinning a game to nothing useful.
#[tauri::command(async)]
pub fn x3d_align(app: tauri::AppHandle, pid: u32, mask: u64) -> Result<(), String> {
    let r = report();
    if !r.ccds.iter().any(|c| c.mask == mask) {
        return Err("that affinity mask does not match any die on this processor".to_string());
    }
    may_steer(&app, pid)?;
    let result = set_affinity(pid, mask);
    crate::audit::record(
        "x3d-aligned",
        &pid.to_string(),
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

#[tauri::command(async)]
pub fn x3d_reset(app: tauri::AppHandle, pid: u32) -> Result<(), String> {
    may_steer(&app, pid)?;
    let result = reset_affinity(pid);
    crate::audit::record(
        "x3d-reset",
        &pid.to_string(),
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}
