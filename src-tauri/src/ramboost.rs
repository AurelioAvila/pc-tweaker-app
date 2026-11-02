//! Smart RAM booster: releases the standby cache only when free memory is
//! actually short, never while a full-screen game or presentation is in front.
//!
//! Windows keeps the pages of closed programs on the standby list as a cache.
//! That is good use of RAM until free memory runs out: then every new
//! allocation has to repurpose cached pages first, which is where some games
//! hitch. The booster watches the two lists the memory manager itself keeps
//! (free+zeroed, standby) and purges the standby list at that moment, through
//! the same kernel call the Zero-Trace purge already uses.
//!
//! The switch is an ordinary catalogue tweak (`smart_ram_booster`, one value
//! under PC Tweaker's own key), so it is applied, restored, listed in the
//! history and re-checked like every other one. The purge needs administrator
//! rights and a running PC Tweaker: with the app not elevated the booster says
//! so instead of pretending to run, the same rule as the scheduled RAM trim.

use serde::Serialize;
use std::sync::Mutex;

pub const TWEAK_ID: &str = "smart_ram_booster";
pub const KEY_PATH: &str = r"Software\PC Tweaker\Memory";
pub const VALUE_NAME: &str = "SmartBooster";
const THRESHOLD_VALUE: &str = "SmartBoosterThresholdMB";

/// Below this much free memory the booster acts. ISLC and similar tools use
/// the same order of magnitude; it is configurable within `THRESHOLD_RANGE`.
pub const DEFAULT_THRESHOLD_MB: u64 = 1024;
pub const THRESHOLD_RANGE: (u64, u64) = (256, 8192);
/// A standby list smaller than this is not worth a purge (and its cost).
pub const MIN_STANDBY_MB: u64 = 512;
/// At most one automatic purge in this window: the purge itself costs a few
/// hundred milliseconds of kernel time.
pub const COOLDOWN_SECS: u64 = 300;
const CHECK_EVERY_SECS: u64 = 15;

/// The memory manager's own page lists, in MB. Read without administrator
/// rights; measured, never estimated.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct MemoryLists {
    /// Free and zeroed pages: memory nobody holds, not even as cache.
    pub free_mb: u64,
    /// Cached pages of closed programs, all priorities.
    pub standby_mb: u64,
    /// Changed pages waiting to be written out.
    pub modified_mb: u64,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Skip {
    Disabled,
    PlentyFree,
    SmallCache,
    FullScreen,
    Cooldown,
    NotElevated,
    NotPro,
}

/// Whether to purge now. Pure, so the rule is testable.
pub fn decide(
    lists: MemoryLists,
    threshold_mb: u64,
    fullscreen: bool,
    secs_since_last: Option<u64>,
) -> Result<(), Skip> {
    if lists.free_mb >= threshold_mb {
        return Err(Skip::PlentyFree);
    }
    if lists.standby_mb < MIN_STANDBY_MB {
        return Err(Skip::SmallCache);
    }
    if fullscreen {
        return Err(Skip::FullScreen);
    }
    if secs_since_last.is_some_and(|s| s < COOLDOWN_SECS) {
        return Err(Skip::Cooldown);
    }
    Ok(())
}

pub fn clamp_threshold(mb: u64) -> u64 {
    mb.clamp(THRESHOLD_RANGE.0, THRESHOLD_RANGE.1)
}

/// One purge, measured: free memory just before and just after.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct Boost {
    /// Unix milliseconds.
    pub at: u64,
    pub free_before_mb: u64,
    pub free_after_mb: u64,
    pub automatic: bool,
}

impl Boost {
    pub fn freed_mb(&self) -> u64 {
        self.free_after_mb.saturating_sub(self.free_before_mb)
    }
}

#[derive(Default)]
struct Log {
    last: Option<Boost>,
    /// Automatic boosts since PC Tweaker started, and what they freed.
    count: u32,
    freed_mb: u64,
    last_skip: Option<Skip>,
}

static LOG: Mutex<Log> = Mutex::new(Log {
    last: None,
    count: 0,
    freed_mb: 0,
    last_skip: None,
});

pub fn record(boost: Boost) {
    if let Ok(mut log) = LOG.lock() {
        if boost.automatic {
            log.count += 1;
            log.freed_mb += boost.freed_mb();
        }
        log.last = Some(boost);
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

#[derive(Serialize, Clone, Debug)]
pub struct BoostStatus {
    pub enabled: bool,
    pub threshold_mb: u64,
    /// Automatic boosts can run: PC Tweaker is elevated.
    pub can_run: bool,
    pub lists: Option<MemoryLists>,
    pub total_mb: u64,
    pub last: Option<Boost>,
    pub session_count: u32,
    pub session_freed_mb: u64,
    pub last_skip: Option<Skip>,
}

#[cfg(windows)]
mod native {
    use super::MemoryLists;

    /// `SystemMemoryListInformation`: the same class the purge sets, queried.
    /// Querying needs no privilege.
    const SYSTEM_MEMORY_LIST_INFORMATION: i32 = 80;

    /// `SYSTEM_MEMORY_LIST_INFORMATION`: every field a page count the size of
    /// a pointer, `PageCountByPriority` being the standby list by priority.
    #[repr(C)]
    #[derive(Default)]
    #[allow(dead_code)]
    struct Lists {
        zero: usize,
        free: usize,
        modified: usize,
        modified_no_write: usize,
        bad: usize,
        standby: [usize; 8],
        repurposed: [usize; 8],
        modified_page_file: usize,
    }

    pub fn memory_lists() -> Option<MemoryLists> {
        use windows_sys::Wdk::System::SystemInformation::NtQuerySystemInformation;
        use windows_sys::Win32::System::SystemInformation::{GetSystemInfo, SYSTEM_INFO};
        let mut lists = Lists::default();
        let mut returned = 0u32;
        // SAFETY: the buffer is a live local of exactly the declared size.
        let status = unsafe {
            NtQuerySystemInformation(
                SYSTEM_MEMORY_LIST_INFORMATION,
                (&mut lists as *mut Lists).cast(),
                std::mem::size_of::<Lists>() as u32,
                &mut returned,
            )
        };
        if status < 0 {
            return None;
        }
        // SAFETY: GetSystemInfo fills the struct it is given.
        let page = unsafe {
            let mut info: SYSTEM_INFO = std::mem::zeroed();
            GetSystemInfo(&mut info);
            info.dwPageSize as u64
        };
        let mb = |pages: usize| pages as u64 * page / (1024 * 1024);
        Some(MemoryLists {
            free_mb: mb(lists.zero + lists.free),
            standby_mb: mb(lists.standby.iter().sum()),
            modified_mb: mb(lists.modified + lists.modified_no_write),
        })
    }

    /// A full-screen Direct3D app, a busy full-screen window or presentation
    /// mode is in front: Windows' own "do not disturb" signal.
    pub fn fullscreen_in_front() -> bool {
        use windows_sys::Win32::UI::Shell::{
            SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE,
            QUNS_RUNNING_D3D_FULL_SCREEN,
        };
        let mut state = 0;
        // SAFETY: writes one i32 into a live local.
        let ok = unsafe { SHQueryUserNotificationState(&mut state) } >= 0;
        ok && [
            QUNS_BUSY,
            QUNS_RUNNING_D3D_FULL_SCREEN,
            QUNS_PRESENTATION_MODE,
        ]
        .contains(&state)
    }

    fn key() -> Option<winreg::RegKey> {
        winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER)
            .open_subkey(super::KEY_PATH)
            .ok()
    }

    pub fn enabled() -> bool {
        key().and_then(|k| k.get_value::<u32, _>(super::VALUE_NAME).ok()) == Some(1)
    }

    pub fn threshold_mb() -> u64 {
        key()
            .and_then(|k| k.get_value::<u32, _>(super::THRESHOLD_VALUE).ok())
            .map_or(super::DEFAULT_THRESHOLD_MB, |v| {
                super::clamp_threshold(v as u64)
            })
    }

    pub fn set_threshold_mb(mb: u64) -> Result<u64, String> {
        let mb = super::clamp_threshold(mb);
        let (key, _) = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER)
            .create_subkey(super::KEY_PATH)
            .map_err(|e| e.to_string())?;
        key.set_value(super::THRESHOLD_VALUE, &(mb as u32))
            .map_err(|e| e.to_string())?;
        Ok(mb)
    }
}

#[cfg(windows)]
pub use native::memory_lists;

#[cfg(not(windows))]
pub fn memory_lists() -> Option<MemoryLists> {
    None
}

/// Purges the standby list in this (elevated) process and measures it.
#[cfg(windows)]
pub fn purge_measured(automatic: bool) -> Result<Boost, String> {
    let purge = crate::zerotrace::purge_standby_memory()?;
    let boost = Boost {
        at: now_ms(),
        free_before_mb: purge.free_before_mb,
        free_after_mb: purge.free_after_mb,
        automatic,
    };
    record(boost);
    Ok(boost)
}

/// The background check. One thread for the app's lifetime, idle unless the
/// switch is on; every pass re-reads the switch and the licence.
#[cfg(windows)]
pub fn start(app: tauri::AppHandle) {
    use tauri::Emitter;
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(CHECK_EVERY_SECS));
        let skip = (|| {
            if !native::enabled() {
                return Err(Skip::Disabled);
            }
            let dir = crate::store_for_dir(&app).map_err(|_| Skip::NotPro)?;
            crate::require_pro(&dir).map_err(|_| Skip::NotPro)?;
            if !crate::elevation::is_elevated() {
                return Err(Skip::NotElevated);
            }
            let lists = memory_lists().ok_or(Skip::Disabled)?;
            let since = LOG
                .lock()
                .ok()
                .and_then(|l| l.last.filter(|b| b.automatic))
                .map(|b| now_ms().saturating_sub(b.at) / 1000);
            decide(
                lists,
                native::threshold_mb(),
                native::fullscreen_in_front(),
                since,
            )
        })();
        if let Ok(mut log) = LOG.lock() {
            log.last_skip = skip.err();
        }
        if skip.is_ok() {
            let result = purge_measured(true);
            crate::audit::record(
                "ram-boost",
                "standby",
                result.is_ok(),
                Some(match &result {
                    Ok(b) => format!("{} MB freed", b.freed_mb()),
                    Err(e) => e.clone(),
                }),
            );
            if let Ok(boost) = result {
                let _ = app.emit("ram-boost", boost);
            }
        }
    });
}

#[tauri::command(async)]
pub fn ram_boost_status() -> BoostStatus {
    let log = LOG
        .lock()
        .map(|l| (l.last, l.count, l.freed_mb, l.last_skip))
        .unwrap_or_default();
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    #[cfg(windows)]
    let (enabled, threshold_mb, can_run) = (
        native::enabled(),
        native::threshold_mb(),
        crate::elevation::is_elevated(),
    );
    #[cfg(not(windows))]
    let (enabled, threshold_mb, can_run) = (false, DEFAULT_THRESHOLD_MB, false);
    BoostStatus {
        enabled,
        threshold_mb,
        can_run,
        lists: memory_lists(),
        total_mb: sys.total_memory() / (1024 * 1024),
        last: log.0,
        session_count: log.1,
        session_freed_mb: log.2,
        last_skip: log.3,
    }
}

#[tauri::command(async)]
pub fn set_ram_boost_threshold(mb: u64) -> Result<u64, String> {
    #[cfg(windows)]
    {
        native::set_threshold_mb(mb)
    }
    #[cfg(not(windows))]
    {
        let _ = mb;
        Err("not supported on this platform".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lists(free_mb: u64, standby_mb: u64) -> MemoryLists {
        MemoryLists {
            free_mb,
            standby_mb,
            modified_mb: 0,
        }
    }

    #[test]
    fn boosts_only_when_free_memory_is_short_and_the_cache_is_worth_it() {
        assert_eq!(decide(lists(300, 6000), 1024, false, None), Ok(()));
        assert_eq!(
            decide(lists(2048, 6000), 1024, false, None),
            Err(Skip::PlentyFree)
        );
        assert_eq!(
            decide(lists(1024, 6000), 1024, false, None),
            Err(Skip::PlentyFree)
        );
        assert_eq!(
            decide(lists(300, 200), 1024, false, None),
            Err(Skip::SmallCache)
        );
    }

    #[test]
    fn never_during_a_full_screen_game_and_never_twice_in_the_cooldown() {
        assert_eq!(
            decide(lists(300, 6000), 1024, true, None),
            Err(Skip::FullScreen)
        );
        assert_eq!(
            decide(lists(300, 6000), 1024, false, Some(60)),
            Err(Skip::Cooldown)
        );
        assert_eq!(
            decide(lists(300, 6000), 1024, false, Some(COOLDOWN_SECS)),
            Ok(())
        );
    }

    #[test]
    fn the_threshold_stays_in_a_sane_range() {
        assert_eq!(clamp_threshold(0), 256);
        assert_eq!(clamp_threshold(1024), 1024);
        assert_eq!(clamp_threshold(1 << 20), 8192);
    }

    #[test]
    fn freed_is_measured_and_never_negative() {
        let b = Boost {
            at: 0,
            free_before_mb: 900,
            free_after_mb: 4100,
            automatic: true,
        };
        assert_eq!(b.freed_mb(), 3200);
        let b = Boost {
            free_after_mb: 800,
            ..b
        };
        assert_eq!(b.freed_mb(), 0);
    }

    /// The query needs no privilege and returns plausible numbers.
    #[cfg(windows)]
    #[test]
    fn reads_the_live_lists_without_elevation() {
        let l = memory_lists().expect("memory lists");
        let mut sys = sysinfo::System::new();
        sys.refresh_memory();
        let total = sys.total_memory() / (1024 * 1024);
        assert!(
            l.free_mb + l.standby_mb + l.modified_mb <= total,
            "{l:?} > {total}"
        );
        assert!(l.standby_mb > 0 || l.free_mb > 0);
    }
}
