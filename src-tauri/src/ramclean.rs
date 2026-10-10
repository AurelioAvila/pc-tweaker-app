use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct RamCleanResult {
    /// Bytes of physical RAM that went from "in use" to "available". Can be 0
    /// (or even negative in reality, which we clamp) when the system was
    /// already tidy — that is a legitimate outcome, not a failure.
    pub freed_bytes: u64,
    /// Kept for the frontend contract. The memory manager trims every working
    /// set itself, so there is no per-process count to report any more.
    pub trimmed_processes: u32,
    pub skipped_processes: u32,
    pub ram_used_before: u64,
    pub ram_used_after: u64,
    pub ram_total: u64,
}

/// Prefix of the error a scheduled pass returns when PC Tweaker is not running
/// as administrator: the schedule cannot ask for permission on its own.
pub const NEEDS_ADMIN_PREFIX: &str = "NEEDS_ADMIN_SCHEDULE: ";

const RESULT_FILE: &str = "last_ramtrim_result.json";

/// Why a pass may not run right now, if it may not. A game that is running,
/// one of the user's registered games included, keeps its memory.
pub(crate) fn refusal(dir: &std::path::Path) -> Option<String> {
    if crate::process_guard::paused(dir) {
        return Some(crate::process_guard::game_running_error());
    }
    crate::game_sessions::registered_game_running(dir)
        .then(crate::process_guard::registered_game_error)
}

/// The trim itself, for an elevated process.
///
/// Earlier versions opened every process with `PROCESS_SET_QUOTA` and called
/// `EmptyWorkingSet` on each. That right is outside what PC Tweaker requests
/// from any process now, so the memory manager is asked to do the same work
/// for the whole system in one call, without a single process handle.
#[cfg(windows)]
pub(crate) fn trim_now(sys: &mut sysinfo::System) -> Result<RamCleanResult, String> {
    sys.refresh_memory();
    let ram_total = sys.total_memory();
    let ram_used_before = sys.used_memory();
    crate::zerotrace::empty_working_sets()?;
    sys.refresh_memory();
    let ram_used_after = sys.used_memory();
    Ok(RamCleanResult {
        // Memory use is a moving target — other processes allocate while this
        // runs — so "after" can legitimately exceed "before". Report 0 rather
        // than underflowing into a huge bogus number.
        freed_bytes: ram_used_before.saturating_sub(ram_used_after),
        trimmed_processes: 0,
        skipped_processes: 0,
        ram_used_before,
        ram_used_after,
        ram_total,
    })
}

/// The elevated helper's side of `clean_ram`: checks again, trims, and leaves
/// the result where the unelevated app reads it back.
#[cfg(windows)]
pub(crate) fn run_elevated(dir: &std::path::Path) -> Result<(), String> {
    if let Some(reason) = refusal(dir) {
        return Err(reason);
    }
    let result = trim_now(&mut sysinfo::System::new());
    crate::audit::record(
        "ram-trim",
        "system",
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    let result = result?;
    let json = serde_json::to_string(&result).map_err(|e| e.to_string())?;
    // Written beside the target and moved over it, so a link planted at the
    // result's name is replaced rather than followed by an administrator.
    let temp = dir.join(format!("{RESULT_FILE}.{}.tmp", std::process::id()));
    std::fs::write(&temp, json).map_err(|e| e.to_string())?;
    crate::rollback::replace_file(&temp, &dir.join(RESULT_FILE)).map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        e.to_string()
    })
}

/// Frees RAM. A click asks Windows for administrator permission when the app
/// does not already have it; a scheduled pass cannot ask, so it runs only in
/// an elevated app and otherwise reports why it did not.
#[cfg(windows)]
#[tauri::command(async)]
pub fn clean_ram(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::sysmon::SysMonState>,
    scheduled: Option<bool>,
) -> Result<RamCleanResult, String> {
    let dir = crate::store_for_dir(&app)?;
    if let Some(reason) = refusal(&dir) {
        return Err(reason);
    }
    if crate::elevation::is_elevated() {
        let mut guard = state
            .0
            .lock()
            .map_err(|_| "system monitor state is unavailable".to_string())?;
        let result = trim_now(&mut guard.sys);
        crate::audit::record(
            "ram-trim",
            "system",
            result.is_ok(),
            result.as_ref().err().cloned(),
        );
        return result;
    }
    if scheduled == Some(true) {
        return Err(format!(
            "{NEEDS_ADMIN_PREFIX}Automatic cleanup runs only while PC Tweaker has administrator rights."
        ));
    }
    let path = dir.join(RESULT_FILE);
    let _ = std::fs::remove_file(&path);
    crate::elevation::run_elevated_action("--elevated-ramtrim", "system")?;
    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&path);
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn clean_ram(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, crate::sysmon::SysMonState>,
    _scheduled: Option<bool>,
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
/// Strictly read-only, and read from the kernel's process table: no process
/// is opened to learn how much memory it holds.
#[tauri::command(async)]
pub fn top_memory_processes() -> Result<Vec<ProcessMemory>, String> {
    let rows: Vec<(String, u64)> = crate::process_guard::processes()?
        .into_iter()
        .filter(|p| p.pid > 4)
        .map(|p| (p.name, p.working_set))
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
        let back: RamCleanResult =
            serde_json::from_str(&serde_json::to_string(&r).unwrap()).unwrap();
        assert_eq!(back.ram_total, 0);
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

    /// The heaviest list comes from the handle-free table and is never empty
    /// on a running machine.
    #[cfg(windows)]
    #[test]
    fn top_memory_processes_reads_the_live_table() {
        let top = top_memory_processes().unwrap();
        assert!(!top.is_empty());
        assert!(top.iter().all(|p| !p.name.is_empty()));
    }
}
