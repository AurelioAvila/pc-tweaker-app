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
//! * It does not persist. Affinity belongs to a running process and dies with
//!   it; claiming otherwise would be a lie the next reboot exposes.

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
    /// Current affinity mask, so the UI can show a process as already aligned
    /// instead of offering to do what is already done.
    pub affinity: Option<u64>,
}

#[cfg(windows)]
mod win {
    use super::{Ccd, ProcessEntry, X3dReport, X3dStatus};
    use std::os::windows::process::CommandExt;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::SystemInformation::{
        GetLogicalProcessorInformationEx, RelationCache, SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX,
    };
    use windows_sys::Win32::System::Threading::{
        GetProcessAffinityMask, OpenProcess, SetProcessAffinityMask, PROCESS_QUERY_INFORMATION,
        PROCESS_SET_INFORMATION,
    };

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    /// Reads the L3 cache groups the machine actually reports.
    ///
    /// The call is made twice on purpose: once with a zero-length buffer to
    /// learn the size, then for real. The structures are variable-length and
    /// walked by each record's own `Size` field — indexing them as a fixed
    /// array is the classic way to read this wrong on a machine with a
    /// different cache layout than the one it was tested on.
    fn l3_groups() -> Option<Vec<(u64, u32)>> {
        unsafe {
            let mut len: u32 = 0;
            GetLogicalProcessorInformationEx(RelationCache, std::ptr::null_mut(), &mut len);
            if len == 0 {
                return None;
            }
            let mut buf = vec![0u8; len as usize];
            let ok = GetLogicalProcessorInformationEx(
                RelationCache,
                buf.as_mut_ptr().cast::<SYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX>(),
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
        std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
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

    struct OwnedHandle(HANDLE);

    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }

    fn open(pid: u32, access: u32) -> Result<OwnedHandle, String> {
        let h = unsafe { OpenProcess(access, 0, pid) };
        if h.is_null() {
            // Almost always an elevated or protected process being asked about
            // by a non-elevated app. Say which, rather than a bare error code.
            return Err(format!(
                "process {} could not be opened - it is likely running with higher privileges than this app",
                pid
            ));
        }
        Ok(OwnedHandle(h))
    }

    fn affinity_of(pid: u32) -> Option<u64> {
        let h = open(pid, PROCESS_QUERY_INFORMATION).ok()?;
        let mut process_mask: usize = 0;
        let mut system_mask: usize = 0;
        let ok = unsafe { GetProcessAffinityMask(h.0, &mut process_mask, &mut system_mask) };
        if ok == 0 {
            None
        } else {
            Some(process_mask as u64)
        }
    }

    /// The system's own mask: what "all cores" means on this machine, which is
    /// what resetting has to restore. Hard-coding `u64::MAX` would set bits for
    /// processors that do not exist and fail.
    fn system_mask() -> Result<u64, String> {
        let h = open(std::process::id(), PROCESS_QUERY_INFORMATION)?;
        let mut process_mask: usize = 0;
        let mut system_mask: usize = 0;
        let ok = unsafe { GetProcessAffinityMask(h.0, &mut process_mask, &mut system_mask) };
        if ok == 0 {
            return Err("Windows did not report a system affinity mask".to_string());
        }
        Ok(system_mask as u64)
    }

    pub fn set_affinity(pid: u32, mask: u64) -> Result<(), String> {
        if mask == 0 {
            return Err("an empty affinity mask would leave the process no core to run on".to_string());
        }
        let h = open(pid, PROCESS_QUERY_INFORMATION | PROCESS_SET_INFORMATION)?;
        let ok = unsafe { SetProcessAffinityMask(h.0, mask as usize) };
        if ok == 0 {
            return Err(format!("Windows refused the affinity change for process {}", pid));
        }
        Ok(())
    }

    pub fn reset_affinity(pid: u32) -> Result<(), String> {
        set_affinity(pid, system_mask()?)
    }

    /// Running processes worth offering, busiest first.
    ///
    /// Filtered to things with a real memory footprint and excluding this app
    /// itself: a list of 300 entries where 280 are service hosts is a list
    /// nobody reads.
    pub fn processes() -> Vec<ProcessEntry> {
        use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

        let mut sys = System::new_with_specifics(
            RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
        );
        // sysinfo reports CPU as a delta between refreshes, so a single
        // snapshot would report 0% for everything.
        std::thread::sleep(std::time::Duration::from_millis(300));
        sys.refresh_processes(ProcessesToUpdate::All, true);

        let self_pid = std::process::id();
        let mut list: Vec<ProcessEntry> = sys
            .processes()
            .iter()
            .filter(|(pid, p)| pid.as_u32() != self_pid && p.memory() > 64 * 1024 * 1024)
            .map(|(pid, p)| ProcessEntry {
                pid: pid.as_u32(),
                name: p.name().to_string_lossy().into_owned(),
                cpu_pct: p.cpu_usage(),
                memory_bytes: p.memory(),
                affinity: affinity_of(pid.as_u32()),
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
pub fn processes() -> Vec<ProcessEntry> {
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
        let seen = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1) as u32;
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
pub fn x3d_processes() -> Vec<ProcessEntry> {
    processes()
}

/// Pins one process to one die.
///
/// The mask comes from the frontend, but is checked against the topology here
/// rather than trusted: `invoke` is reachable from anywhere in the webview, and
/// a mask naming processors this machine does not have would either fail
/// cryptically or — worse — succeed at pinning a game to nothing useful.
#[tauri::command(async)]
pub fn x3d_align(pid: u32, mask: u64) -> Result<(), String> {
    let r = report();
    if !r.ccds.iter().any(|c| c.mask == mask) {
        return Err("that affinity mask does not match any die on this processor".to_string());
    }
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
pub fn x3d_reset(pid: u32) -> Result<(), String> {
    let result = reset_affinity(pid);
    crate::audit::record(
        "x3d-reset",
        &pid.to_string(),
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}
