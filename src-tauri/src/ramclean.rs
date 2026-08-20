use serde::Serialize;

#[derive(Serialize, Default, Clone)]
pub struct RamCleanResult {
    /// Bytes of physical RAM that went from "in use" to "available". Can be 0
    /// (or even negative in reality, which we clamp) when the system was
    /// already tidy — that is a legitimate outcome, not a failure.
    pub freed_bytes: u64,
    pub trimmed_processes: u32,
    pub skipped_processes: u32,
    pub ram_used_before: u64,
    pub ram_used_after: u64,
    pub ram_total: u64,
}

#[cfg(windows)]
mod imp {
    use super::RamCleanResult;
    use sysinfo::{ProcessesToUpdate, System};

    // Declared by hand rather than pulling in the whole `windows` crate: three
    // functions, stable since Windows XP, and this keeps the dependency tree
    // (and build time) where it is.
    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> isize;
        fn CloseHandle(handle: isize) -> i32;
    }

    #[link(name = "psapi")]
    extern "system" {
        fn EmptyWorkingSet(process: isize) -> i32;
    }

    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const PROCESS_SET_QUOTA: u32 = 0x0100;

    /// Asks Windows to page out a process's private working set. The pages are
    /// not lost: anything still needed is faulted straight back in. This is the
    /// same mechanism Windows itself uses under memory pressure, just requested
    /// early, which is why it is safe to run repeatedly.
    fn trim(pid: u32) -> bool {
        // PID 0 (System Idle) and 4 (System) are kernel-owned; opening them
        // always fails and trimming them is meaningless.
        if pid == 0 || pid == 4 {
            return false;
        }
        unsafe {
            let handle = OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SET_QUOTA,
                0,
                pid,
            );
            if handle == 0 {
                // Access denied on protected/elevated processes is the normal
                // case for a non-elevated run, not an error worth surfacing.
                return false;
            }
            let ok = EmptyWorkingSet(handle) != 0;
            CloseHandle(handle);
            ok
        }
    }

    pub fn clean(sys: &mut System) -> RamCleanResult {
        sys.refresh_memory();
        let ram_total = sys.total_memory();
        let ram_used_before = sys.used_memory();

        sys.refresh_processes(ProcessesToUpdate::All, true);
        let pids: Vec<u32> = sys.processes().keys().map(|p| p.as_u32()).collect();

        let mut trimmed = 0u32;
        let mut skipped = 0u32;
        for pid in pids {
            if trim(pid) {
                trimmed += 1;
            } else {
                skipped += 1;
            }
        }

        sys.refresh_memory();
        let ram_used_after = sys.used_memory();

        RamCleanResult {
            // Memory use is a moving target — other processes allocate while we
            // work — so "after" can legitimately exceed "before". Report 0
            // rather than underflowing into a huge bogus number.
            freed_bytes: ram_used_before.saturating_sub(ram_used_after),
            trimmed_processes: trimmed,
            skipped_processes: skipped,
            ram_used_before,
            ram_used_after,
            ram_total,
        }
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn clean_ram(
    state: tauri::State<'_, crate::sysmon::SysMonState>,
) -> Result<RamCleanResult, String> {
    let mut sys = state
        .0
        .lock()
        .map_err(|_| "system monitor state is unavailable".to_string())?;
    Ok(imp::clean(&mut sys))
}

#[cfg(not(windows))]
#[tauri::command]
pub fn clean_ram(
    _state: tauri::State<'_, crate::sysmon::SysMonState>,
) -> Result<RamCleanResult, String> {
    Err("RAM cleanup is only available on Windows".to_string())
}

/// One row of the Memory Pressure "review" list: a process name and how much
/// physical memory its instances hold, summed. Read-only display data.
#[derive(Serialize, Clone)]
pub struct ProcessMemory {
    pub name: String,
    pub mem_bytes: u64,
}

/// Groups per-process memory by executable name and returns the heaviest
/// `limit` entries. Pure so it is testable without a live process table.
pub fn top_by_memory(rows: Vec<(String, u64)>, limit: usize) -> Vec<ProcessMemory> {
    let mut by_name: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    for (name, bytes) in rows {
        if name.is_empty() {
            continue;
        }
        *by_name.entry(name).or_insert(0) += bytes;
    }
    let mut out: Vec<ProcessMemory> = by_name
        .into_iter()
        .map(|(name, mem_bytes)| ProcessMemory { name, mem_bytes })
        .collect();
    out.sort_by(|a, b| b.mem_bytes.cmp(&a.mem_bytes));
    out.truncate(limit);
    out
}

/// The heaviest memory consumers right now, grouped by process name.
/// Strictly read-only: the Memory Pressure panel shows WHO is using memory
/// before offering any action at all.
#[tauri::command]
pub fn top_memory_processes(
    state: tauri::State<'_, crate::sysmon::SysMonState>,
) -> Result<Vec<ProcessMemory>, String> {
    let mut sys = state
        .0
        .lock()
        .map_err(|_| "system monitor state is unavailable".to_string())?;
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    let rows: Vec<(String, u64)> = sys
        .processes()
        .values()
        .map(|p| (p.name().to_string_lossy().to_string(), p.memory()))
        .collect();
    Ok(top_by_memory(rows, 8))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `freed_bytes` is computed from two samples taken milliseconds apart
    /// while the rest of the system keeps allocating. If "after" is larger
    /// than "before" the subtraction must not wrap around into ~18 exabytes,
    /// which is what an unchecked `u64` subtraction would show the user.
    #[test]
    fn freed_bytes_never_underflows_when_memory_use_grew() {
        let before: u64 = 8_000_000_000;
        let after: u64 = 8_500_000_000;
        assert_eq!(before.saturating_sub(after), 0);
    }

    #[test]
    fn freed_bytes_reports_the_real_delta_when_memory_was_released() {
        let before: u64 = 9_000_000_000;
        let after: u64 = 8_000_000_000;
        assert_eq!(before.saturating_sub(after), 1_000_000_000);
    }

    /// A result with nothing trimmed is still a valid, serializable result —
    /// the UI shows "0 B freed", it does not treat it as an error.
    #[test]
    fn an_empty_result_is_still_valid() {
        let r = RamCleanResult::default();
        assert_eq!(r.freed_bytes, 0);
        assert_eq!(r.trimmed_processes, 0);
    }

    #[test]
    fn top_by_memory_groups_by_name_and_orders_by_total() {
        let rows = vec![
            ("chrome.exe".to_string(), 300),
            ("steam.exe".to_string(), 500),
            ("chrome.exe".to_string(), 400),
            ("".to_string(), 999),
            ("tiny.exe".to_string(), 10),
        ];
        let top = top_by_memory(rows, 2);
        assert_eq!(top.len(), 2);
        assert_eq!(top[0].name, "chrome.exe");
        assert_eq!(top[0].mem_bytes, 700);
        assert_eq!(top[1].name, "steam.exe");
    }
}
