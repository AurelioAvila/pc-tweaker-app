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

#[cfg(test)]
mod tests {
    use super::*;

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
