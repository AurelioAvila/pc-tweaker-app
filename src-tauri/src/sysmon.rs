use serde::Serialize;
use std::sync::Mutex;
use sysinfo::System;

/// A single long-lived `System` handle shared by every poll. `sysinfo` derives
/// CPU usage from the delta between two refreshes, so reusing one instance
/// makes the poll interval itself the sampling window — no blocking sleep
/// inside the command, which would tie up a runtime worker on every tick.
pub struct SysMonState(pub Mutex<System>);

impl SysMonState {
    pub fn new() -> Self {
        let mut sys = System::new();
        // Prime the CPU baseline at startup so the first poll from the UI
        // already has a previous sample to diff against and doesn't report 0%.
        sys.refresh_cpu_usage();
        SysMonState(Mutex::new(sys))
    }
}

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub ram_used: u64,
    pub ram_total: u64,
    pub disk_used: u64,
    pub disk_total: u64,
    pub os_name: String,
    pub uptime_secs: u64,
}

#[tauri::command]
pub fn system_stats(state: tauri::State<'_, SysMonState>) -> Result<SystemStats, String> {
    use sysinfo::Disks;

    let mut sys = state
        .0
        .lock()
        .map_err(|_| "stato del monitor di sistema non disponibile".to_string())?;

    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "CPU".to_string());

    // Only report the drive Windows is installed on: summing every mount would
    // fold in external/removable drives and misrepresent "your PC is full".
    let disks = Disks::new_with_refreshed_list();
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    let (disk_total, disk_available) = disks
        .list()
        .iter()
        .find(|d| d.mount_point().to_string_lossy().starts_with(&system_drive))
        .map(|d| (d.total_space(), d.available_space()))
        .unwrap_or((0, 0));

    Ok(SystemStats {
        cpu_usage: sys.global_cpu_usage(),
        cpu_name,
        cpu_cores: sys.cpus().len(),
        ram_used: sys.used_memory(),
        ram_total: sys.total_memory(),
        disk_used: disk_total.saturating_sub(disk_available),
        disk_total,
        os_name: System::long_os_version().unwrap_or_else(|| "Windows".to_string()),
        uptime_secs: System::uptime(),
    })
}
