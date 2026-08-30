use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use sysinfo::System;

/// The shortest window a CPU reading is allowed to be measured over.
///
/// `sysinfo` derives CPU usage from the delta between two refreshes of the
/// same `System`, so the window is "since whoever refreshed last" — and this
/// handle is shared by every poller in the app: the title bar, the dashboard,
/// the monitor page, the command palette, the Turbo Boost gauge and the game
/// overlay, each on its own interval. When two of those ticks landed a few
/// milliseconds apart, the second one measured a few milliseconds of wall
/// clock, and over a window that short a core that happened to be running
/// reads as fully busy: the gauge showed 100% while the title bar, sampled a
/// moment earlier over a proper interval, showed 13%.
///
/// Sampling no more often than this makes the window a property of the
/// sampler rather than an accident of call ordering. It is `sysinfo`'s own
/// documented floor for a meaningful reading, and it is far shorter than any
/// interval the UI polls on, so no caller sees a figure it would consider
/// stale.
const MIN_CPU_WINDOW: Duration = sysinfo::MINIMUM_CPU_UPDATE_INTERVAL;

pub struct SysMon {
    /// The long-lived handle. Memory, disk and process refreshes have no delta
    /// semantics and stay direct; only CPU goes through [`SysMon::cpu_usage`].
    pub sys: System,
    last_cpu: f32,
    last_cpu_at: Instant,
}

impl SysMon {
    /// CPU load, measured over a window of at least [`MIN_CPU_WINDOW`].
    ///
    /// Callers that tick faster than that get the most recent real reading
    /// back rather than a fresh one taken over a meaningless window.
    pub fn cpu_usage(&mut self) -> f32 {
        if self.last_cpu_at.elapsed() >= MIN_CPU_WINDOW {
            self.sys.refresh_cpu_usage();
            self.last_cpu = self.sys.global_cpu_usage();
            self.last_cpu_at = Instant::now();
        }
        self.last_cpu
    }
}

/// A single long-lived `System` handle shared by every poll, with the CPU
/// sampling window held to a sane minimum. See [`MIN_CPU_WINDOW`].
pub struct SysMonState(pub Mutex<SysMon>);

impl SysMonState {
    pub fn new() -> Self {
        let mut sys = System::new();
        // Prime the CPU baseline at startup so the first poll from the UI
        // already has a previous sample to diff against and doesn't report 0%.
        sys.refresh_cpu_usage();
        SysMonState(Mutex::new(SysMon {
            sys,
            last_cpu: 0.0,
            // Dated back far enough that the first caller takes a real
            // reading instead of being served the 0.0 placeholder.
            last_cpu_at: Instant::now() - MIN_CPU_WINDOW,
        }))
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

/// CPU load and memory, without the disk work `system_stats` does.
///
/// The overlay samples several times a second while a game is running, and
/// enumerating every mounted volume on each of those ticks is exactly the kind
/// of cost a HUD that advertises itself as low-overhead has no business
/// paying. Returns `(cpu_pct, ram_used_mb, ram_total_mb)`; a poisoned lock
/// reports zeroes rather than failing, because a dropped HUD frame is not
/// worth an error path.
pub fn cpu_and_memory(state: &tauri::State<'_, SysMonState>) -> (f32, u64, u64) {
    let Ok(mut guard) = state.0.lock() else {
        return (0.0, 0, 0);
    };
    let cpu = guard.cpu_usage();
    guard.sys.refresh_memory();
    const MB: u64 = 1024 * 1024;
    (
        cpu,
        guard.sys.used_memory() / MB,
        guard.sys.total_memory() / MB,
    )
}

#[tauri::command(async)]
pub fn system_stats(state: tauri::State<'_, SysMonState>) -> Result<SystemStats, String> {
    use sysinfo::Disks;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "system monitor state is unavailable".to_string())?;

    let cpu_usage = guard.cpu_usage();
    guard.sys.refresh_memory();
    let sys = &mut guard.sys;

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
        cpu_usage,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn sampler() -> SysMon {
        let mut sys = System::new();
        sys.refresh_cpu_usage();
        SysMon {
            sys,
            last_cpu: 0.0,
            last_cpu_at: Instant::now() - MIN_CPU_WINDOW,
        }
    }

    #[test]
    fn the_first_reading_is_taken_rather_than_served_from_the_placeholder() {
        let mut s = sampler();
        let before = s.last_cpu_at;
        let _ = s.cpu_usage();
        assert!(
            s.last_cpu_at > before,
            "a state fresh from new() must sample, or the whole app shows 0% until the second tick"
        );
    }

    #[test]
    fn a_second_caller_arriving_immediately_does_not_reopen_the_window() {
        // This is the bug this cache exists for: two pollers ticking a few
        // milliseconds apart used to make the second one measure a few
        // milliseconds of wall clock, which reads as ~100%.
        let mut s = sampler();
        let first = s.cpu_usage();
        let sampled_at = s.last_cpu_at;

        let second = s.cpu_usage();
        assert_eq!(
            second, first,
            "a caller inside the window gets the last real reading, not a new one"
        );
        assert_eq!(
            s.last_cpu_at, sampled_at,
            "and no refresh happened, so the next real window still starts from the first sample"
        );
    }

    #[test]
    fn the_window_reopens_once_it_has_elapsed() {
        let mut s = sampler();
        let _ = s.cpu_usage();
        let sampled_at = s.last_cpu_at;

        std::thread::sleep(MIN_CPU_WINDOW + Duration::from_millis(20));
        let _ = s.cpu_usage();
        assert!(
            s.last_cpu_at > sampled_at,
            "past the window a caller must get a genuinely fresh reading"
        );
    }

    #[test]
    fn a_reading_is_always_a_percentage() {
        let mut s = sampler();
        std::thread::sleep(MIN_CPU_WINDOW + Duration::from_millis(20));
        let v = s.cpu_usage();
        assert!(
            (0.0..=100.0).contains(&v),
            "cpu_usage returned {v}, which the gauge would render as a nonsense angle"
        );
    }
}
