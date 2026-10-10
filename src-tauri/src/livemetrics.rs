//! One reading for the live charts on PC Health.
//!
//! Everything here is a system-wide counter that Windows keeps anyway: the
//! CPU load per logical core (the shared `sysinfo` handle, never its process
//! list), memory from `GetPerformanceInfo`, and disk, network and processor
//! performance from the same performance counters Task Manager reads (PDH).
//! No process is opened or listed, nothing is written, and nothing runs
//! between calls: the page asks once a second while it is on screen and the
//! window is in front, and stops asking otherwise.
//!
//! Rates need two readings, so the first call after the counters are opened
//! returns `None` for disk, network and speed, and the page shows them as
//! loading rather than as zero.

use serde::Serialize;

#[derive(Serialize, Clone, Debug, Default)]
pub struct LiveSample {
    /// Whole-machine CPU load, percent.
    pub cpu: f32,
    /// Load per logical processor, percent, in Windows' order.
    pub cores: Vec<f32>,
    /// Effective processor speed in MHz: the rated clock scaled by Windows'
    /// processor performance counter, the figure Task Manager shows.
    pub cpu_mhz: Option<u32>,
    pub ram_total: u64,
    pub ram_used: u64,
    /// Part of the available memory Windows is using as cache; given back
    /// the moment a program needs it.
    pub ram_cached: Option<u64>,
    pub disk_read_bps: Option<f64>,
    pub disk_write_bps: Option<f64>,
    pub net_down_bps: Option<f64>,
    pub net_up_bps: Option<f64>,
}

/// Adapters whose traffic is already counted on a physical one, or that carry
/// none of the user's own: virtual switches mirror the NIC they sit on.
/// ponytail: name-based, like Task Manager's own grouping; a per-adapter
/// breakdown would need the adapter list, add it if double counting shows up.
pub fn counts_as_traffic(adapter: &str) -> bool {
    let name = adapter.to_ascii_lowercase();
    ![
        "loopback",
        "isatap",
        "teredo",
        "6to4",
        "hyper-v virtual",
        "vethernet",
        "wan miniport",
    ]
    .iter()
    .any(|skip| name.contains(skip))
}

/// The effective speed from the rated clock and the performance percentage,
/// or `None` when either is missing or implausible.
pub fn effective_mhz(rated_mhz: Option<u32>, performance_pct: Option<f64>) -> Option<u32> {
    let rated = rated_mhz.filter(|&m| m > 0)?;
    let pct = performance_pct.filter(|p| p.is_finite() && *p > 0.0 && *p < 400.0)?;
    Some((f64::from(rated) * pct / 100.0).round() as u32)
}

#[cfg(windows)]
mod pdh {
    use std::sync::Mutex;
    use windows_sys::Win32::System::Performance::{
        PdhAddEnglishCounterW, PdhCollectQueryData, PdhGetFormattedCounterArrayW,
        PdhGetFormattedCounterValue, PdhOpenQueryW, PDH_FMT_COUNTERVALUE,
        PDH_FMT_COUNTERVALUE_ITEM_W, PDH_FMT_DOUBLE, PDH_MORE_DATA,
    };

    /// The open query and its counters. Opened on first use and kept, so the
    /// next reading has a previous one to measure a rate against.
    struct Counters {
        query: isize,
        performance: isize,
        disk_read: isize,
        disk_write: isize,
        net_down: isize,
        net_up: isize,
        collected: bool,
    }

    static COUNTERS: Mutex<Option<Counters>> = Mutex::new(None);

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn open() -> Option<Counters> {
        let mut query = 0isize;
        // SAFETY: out-pointer to a local; null data source means live data.
        if unsafe { PdhOpenQueryW(std::ptr::null(), 0, &mut query) } != 0 {
            return None;
        }
        let add = |path: &str| {
            let mut counter = 0isize;
            let path = wide(path);
            // SAFETY: valid query handle, NUL-terminated path, local out-pointer.
            if unsafe { PdhAddEnglishCounterW(query, path.as_ptr(), 0, &mut counter) } == 0 {
                counter
            } else {
                0
            }
        };
        Some(Counters {
            query,
            performance: add(r"\Processor Information(_Total)\% Processor Performance"),
            disk_read: add(r"\PhysicalDisk(_Total)\Disk Read Bytes/sec"),
            disk_write: add(r"\PhysicalDisk(_Total)\Disk Write Bytes/sec"),
            net_down: add(r"\Network Interface(*)\Bytes Received/sec"),
            net_up: add(r"\Network Interface(*)\Bytes Sent/sec"),
            collected: false,
        })
    }

    fn value(counter: isize) -> Option<f64> {
        if counter == 0 {
            return None;
        }
        // SAFETY: zeroed POD out-parameter for a valid counter handle.
        let mut out: PDH_FMT_COUNTERVALUE = unsafe { std::mem::zeroed() };
        let status = unsafe {
            PdhGetFormattedCounterValue(counter, PDH_FMT_DOUBLE, std::ptr::null_mut(), &mut out)
        };
        // SAFETY: PDH_FMT_DOUBLE was requested, so the double member is set.
        if status == 0 && out.CStatus == 0 {
            Some(unsafe { out.Anonymous.doubleValue })
        } else {
            None
        }
    }

    /// Sum over the instances of a wildcard counter that `keep` accepts.
    fn sum(counter: isize, keep: impl Fn(&str) -> bool) -> Option<f64> {
        if counter == 0 {
            return None;
        }
        let (mut bytes, mut count) = (0u32, 0u32);
        // SAFETY: the first call only asks for the buffer size.
        let status = unsafe {
            PdhGetFormattedCounterArrayW(
                counter,
                PDH_FMT_DOUBLE,
                &mut bytes,
                &mut count,
                std::ptr::null_mut(),
            )
        };
        if status != PDH_MORE_DATA || bytes == 0 {
            return None;
        }
        let item = std::mem::size_of::<PDH_FMT_COUNTERVALUE_ITEM_W>();
        let mut buffer = vec![0u64; (bytes as usize).div_ceil(8)];
        let items = buffer.as_mut_ptr().cast::<PDH_FMT_COUNTERVALUE_ITEM_W>();
        // SAFETY: the buffer holds `bytes` bytes, 8-byte aligned, as PDH asked.
        let status = unsafe {
            PdhGetFormattedCounterArrayW(counter, PDH_FMT_DOUBLE, &mut bytes, &mut count, items)
        };
        if status != 0 {
            return None;
        }
        debug_assert!(count as usize * item <= bytes as usize);
        let mut total = 0.0;
        for i in 0..count as usize {
            // SAFETY: PDH wrote `count` items; names point into the same buffer.
            let entry = unsafe { &*items.add(i) };
            let name = unsafe {
                let mut len = 0;
                while *entry.szName.add(len) != 0 {
                    len += 1;
                }
                String::from_utf16_lossy(std::slice::from_raw_parts(entry.szName, len))
            };
            if entry.FmtValue.CStatus == 0 && keep(&name) {
                total += unsafe { entry.FmtValue.Anonymous.doubleValue };
            }
        }
        Some(total)
    }

    /// (performance %, disk read B/s, disk write B/s, net down B/s, net up B/s)
    pub type Rates = (
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
    );

    pub fn read() -> Rates {
        let mut held = COUNTERS.lock().unwrap_or_else(|e| e.into_inner());
        if held.is_none() {
            *held = open();
        }
        let Some(c) = held.as_mut() else {
            return (None, None, None, None, None);
        };
        // SAFETY: valid query handle.
        let ok = unsafe { PdhCollectQueryData(c.query) } == 0;
        let first = !c.collected;
        c.collected = true;
        if !ok || first {
            return (None, None, None, None, None);
        }
        let keep = super::counts_as_traffic;
        (
            value(c.performance),
            value(c.disk_read),
            value(c.disk_write),
            sum(c.net_down, keep),
            sum(c.net_up, keep),
        )
    }
}

/// The processor's performance percentage, read every `every` for `total`
/// on a query of its own (so the live charts' rates are not disturbed).
/// Empty when the counter is unavailable.
#[cfg(windows)]
pub fn sample_performance(total: std::time::Duration, every: std::time::Duration) -> Vec<f64> {
    use windows_sys::Win32::System::Performance::{
        PdhAddEnglishCounterW, PdhCloseQuery, PdhCollectQueryData, PdhGetFormattedCounterValue,
        PdhOpenQueryW, PDH_FMT_COUNTERVALUE, PDH_FMT_DOUBLE,
    };
    let mut query = 0isize;
    let mut counter = 0isize;
    let path: Vec<u16> = r"\Processor Information(_Total)\% Processor Performance"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    // SAFETY: local out-pointers, NUL-terminated path, the query is closed below.
    unsafe {
        if PdhOpenQueryW(std::ptr::null(), 0, &mut query) != 0 {
            return Vec::new();
        }
        if PdhAddEnglishCounterW(query, path.as_ptr(), 0, &mut counter) != 0 {
            PdhCloseQuery(query);
            return Vec::new();
        }
        PdhCollectQueryData(query);
    }
    let started = std::time::Instant::now();
    let mut out = Vec::new();
    while started.elapsed() < total {
        std::thread::sleep(every);
        // SAFETY: valid handles; PDH_FMT_DOUBLE selects the double member.
        unsafe {
            if PdhCollectQueryData(query) != 0 {
                continue;
            }
            let mut value: PDH_FMT_COUNTERVALUE = std::mem::zeroed();
            if PdhGetFormattedCounterValue(
                counter,
                PDH_FMT_DOUBLE,
                std::ptr::null_mut(),
                &mut value,
            ) == 0
                && value.CStatus == 0
            {
                out.push(value.Anonymous.doubleValue);
            }
        }
    }
    // SAFETY: the query was opened above.
    unsafe { PdhCloseQuery(query) };
    out
}

#[cfg(windows)]
fn memory() -> Option<(u64, u64, u64)> {
    use windows_sys::Win32::System::ProcessStatus::{
        K32GetPerformanceInfo, PERFORMANCE_INFORMATION,
    };
    // SAFETY: zeroed POD with its size passed alongside.
    let mut info: PERFORMANCE_INFORMATION = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<PERFORMANCE_INFORMATION>() as u32;
    info.cb = size;
    if unsafe { K32GetPerformanceInfo(&mut info, size) } == 0 {
        return None;
    }
    let page = info.PageSize as u64;
    let total = info.PhysicalTotal as u64 * page;
    let available = info.PhysicalAvailable as u64 * page;
    // The system cache counts the standby list, which is part of "available";
    // never report more cache than there is available memory.
    let cached = (info.SystemCache as u64 * page).min(available);
    Some((total, total.saturating_sub(available), cached))
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn live_sample(
    state: tauri::State<'_, crate::sysmon::SysMonState>,
) -> Result<LiveSample, String> {
    let (cpu, cores) = {
        let mut guard = state
            .0
            .lock()
            .map_err(|_| "system monitor state is unavailable".to_string())?;
        let cpu = guard.cpu_usage();
        let cores = guard.sys.cpus().iter().map(|c| c.cpu_usage()).collect();
        (cpu, cores)
    };
    let (performance, disk_read, disk_write, net_down, net_up) = pdh::read();
    let (ram_total, ram_used, ram_cached) = match memory() {
        Some((total, used, cached)) => (total, used, Some(cached)),
        None => (0, 0, None),
    };
    Ok(LiveSample {
        cpu,
        cores,
        cpu_mhz: effective_mhz(crate::cpuclock::read().map(|c| c.max_mhz), performance),
        ram_total,
        ram_used,
        ram_cached,
        disk_read_bps: disk_read,
        disk_write_bps: disk_write,
        net_down_bps: net_down,
        net_up_bps: net_up,
    })
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn live_sample() -> Result<LiveSample, String> {
    Err("not supported on this platform".to_string())
}

/// One app's share of the machine: every process with the same executable
/// name added together.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ResourceUser {
    pub name: String,
    pub processes: u32,
    /// Share of the whole machine's CPU time since the previous reading.
    pub cpu: f32,
    pub memory: u64,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct ResourceUsers {
    pub cpu: Vec<ResourceUser>,
    pub memory: Vec<ResourceUser>,
}

/// Groups a process table by executable name. CPU shares compare each process
/// with the same process instance (pid and creation time) in `previous`,
/// taken `elapsed` seconds earlier; the idle process is left out.
pub fn group_users(
    previous: Option<(&[crate::process_guard::ProcessInfo], f64)>,
    now: &[crate::process_guard::ProcessInfo],
    logical_cores: usize,
) -> Vec<ResourceUser> {
    use std::collections::HashMap;
    let before: HashMap<(u32, u64), u64> = previous
        .map(|(table, _)| {
            table
                .iter()
                .map(|p| ((p.pid, p.created), p.cpu_time))
                .collect()
        })
        .unwrap_or_default();
    let budget = previous
        .map(|(_, secs)| secs * 1e7 * logical_cores.max(1) as f64)
        .filter(|b| *b > 0.0);
    let mut groups: HashMap<String, ResourceUser> = HashMap::new();
    for p in now.iter().filter(|p| p.pid != 0) {
        let name = p
            .name
            .strip_suffix(".exe")
            .or_else(|| p.name.strip_suffix(".EXE"))
            .unwrap_or(&p.name)
            .to_string();
        let used = before
            .get(&(p.pid, p.created))
            .map_or(0, |&b| p.cpu_time.saturating_sub(b));
        let entry = groups
            .entry(name.to_ascii_lowercase())
            .or_insert(ResourceUser {
                name,
                processes: 0,
                cpu: 0.0,
                memory: 0,
            });
        entry.processes += 1;
        entry.memory += p.working_set;
        if let Some(budget) = budget {
            entry.cpu += (used as f64 / budget * 100.0) as f32;
        }
    }
    groups.into_values().collect()
}

/// The top five by CPU and by memory, from the handle-free process table
/// (process_guard): names, CPU time and working sets only, no process opened.
pub fn top_users(mut users: Vec<ResourceUser>) -> ResourceUsers {
    let mut by_memory = users.clone();
    users.retain(|u| u.cpu >= 0.1);
    users.sort_by(|a, b| b.cpu.total_cmp(&a.cpu));
    users.truncate(5);
    by_memory.sort_by_key(|u| std::cmp::Reverse(u.memory));
    by_memory.truncate(5);
    ResourceUsers {
        cpu: users,
        memory: by_memory,
    }
}

type Snapshot = (Vec<crate::process_guard::ProcessInfo>, std::time::Instant);
static LAST_TABLE: std::sync::Mutex<Option<Snapshot>> = std::sync::Mutex::new(None);

#[tauri::command(async)]
pub fn resource_users() -> Result<ResourceUsers, String> {
    let now = crate::process_guard::processes()?;
    let cores = std::thread::available_parallelism().map_or(1, |n| n.get());
    let mut last = LAST_TABLE.lock().unwrap_or_else(|e| e.into_inner());
    let previous = last
        .as_ref()
        .map(|(table, at)| (table.as_slice(), at.elapsed().as_secs_f64()));
    let users = group_users(previous, &now, cores);
    *last = Some((now, std::time::Instant::now()));
    Ok(top_users(users))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(
        pid: u32,
        name: &str,
        created: u64,
        cpu_time: u64,
        working_set: u64,
    ) -> crate::process_guard::ProcessInfo {
        crate::process_guard::ProcessInfo {
            pid,
            parent: None,
            name: name.into(),
            created,
            session: 1,
            working_set,
            cpu_time,
        }
    }

    #[test]
    fn apps_are_grouped_by_name_and_cpu_follows_the_same_process_instance() {
        let before = [
            p(0, "Idle", 0, 0, 0),
            p(10, "brave.exe", 1, 1_000, 100),
            p(11, "brave.exe", 2, 2_000, 200),
            p(20, "game.exe", 3, 0, 1_000),
            // pid 30 was another process before: its time must not count.
            p(30, "old.exe", 4, 9_000_000, 10),
        ];
        let now = [
            p(0, "Idle", 0, 50_000_000, 0),
            p(10, "brave.exe", 1, 1_000 + 5_000_000, 150),
            p(11, "brave.exe", 2, 2_000 + 5_000_000, 250),
            p(20, "game.exe", 3, 20_000_000, 1_000),
            p(30, "new.exe", 9, 9_500_000, 10),
        ];
        // One second on 4 cores = 4e7 ticks of CPU time.
        let users = group_users(Some((&before, 1.0)), &now, 4);
        let get = |n: &str| users.iter().find(|u| u.name == n).cloned().unwrap();
        assert!(users.iter().all(|u| u.name != "Idle"));
        let brave = get("brave");
        assert_eq!((brave.processes, brave.memory), (2, 400));
        assert!((brave.cpu - 25.0).abs() < 0.01, "{}", brave.cpu);
        assert!((get("game").cpu - 50.0).abs() < 0.01);
        assert_eq!(get("new").cpu, 0.0, "a reused pid starts from zero");
        let top = top_users(users);
        assert_eq!(
            top.cpu.iter().map(|u| u.name.as_str()).collect::<Vec<_>>(),
            ["game", "brave"]
        );
        assert_eq!(top.memory[0].name, "game");
        // Without a previous table, memory is known and CPU is not.
        assert!(group_users(None, &now, 4).iter().all(|u| u.cpu == 0.0));
    }

    #[test]
    fn virtual_and_loopback_adapters_are_not_counted_twice() {
        for name in [
            "Intel[R] Ethernet Controller I225-V",
            "Realtek PCIe 2.5GbE Family Controller",
            "Wi-Fi 6E AX211 160MHz",
        ] {
            assert!(counts_as_traffic(name), "{name}");
        }
        for name in [
            "Hyper-V Virtual Ethernet Adapter",
            "vEthernet (Default Switch)",
            "Software Loopback Interface 1",
            "isatap.{1234}",
            "Teredo Tunneling Pseudo-Interface",
            "WAN Miniport (IP)",
        ] {
            assert!(!counts_as_traffic(name), "{name}");
        }
    }

    #[test]
    fn effective_speed_needs_both_readings_and_a_sane_percentage() {
        assert_eq!(effective_mhz(Some(4200), Some(110.0)), Some(4620));
        assert_eq!(effective_mhz(Some(4200), None), None);
        assert_eq!(effective_mhz(None, Some(100.0)), None);
        assert_eq!(effective_mhz(Some(0), Some(100.0)), None);
        assert_eq!(effective_mhz(Some(4200), Some(f64::NAN)), None);
        assert_eq!(effective_mhz(Some(4200), Some(0.0)), None);
    }

    /// Two real readings a second apart: the counters open without
    /// administrator rights and a sample costs a few milliseconds.
    #[cfg(windows)]
    #[test]
    fn a_reading_is_cheap_and_needs_no_administrator() {
        let _ = pdh::read();
        std::thread::sleep(std::time::Duration::from_millis(1100));
        let started = std::time::Instant::now();
        let rates = pdh::read();
        let mem = memory();
        let elapsed = started.elapsed();
        println!("rates {rates:?} memory {mem:?} in {elapsed:?}");
        let (total, used, cached) = mem.expect("GetPerformanceInfo");
        assert!(total > used && cached <= total);
        assert!(rates.1.is_some() && rates.2.is_some(), "disk counters open");
        assert!(
            elapsed < std::time::Duration::from_millis(250),
            "{elapsed:?}"
        );
    }
}
