//! Where the main window opens, and how big.
//!
//! Two jobs. First launch: size the window to the screen instead of a fixed
//! 1000x700, which on a 1920x1080 desktop covered a third of the display and
//! made the app look smaller than it is, while a 1366x768 laptop still gets a
//! window that fits. Every launch after that: reopen where the user left it,
//! which the app never did before.
//!
//! All numbers here are logical pixels; the window converts for DPI.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize};

const FILE: &str = "window-placement.json";
const MIN: (f64, f64) = (1000.0, 700.0);
const MAX: (f64, f64) = (1280.0, 820.0);
/// Share of the work area the window takes when there is room.
const SHARE: f64 = 0.75;
/// Breathing room so the default never touches the taskbar or an edge.
const MARGIN: f64 = 24.0;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct Placement {
    pub w: f64,
    pub h: f64,
    pub x: f64,
    pub y: f64,
}

/// The size for a screen we have not seen before.
///
/// 75% of the work area, kept between 1000x700 and 1280x820, and never
/// larger than the work area minus a margin: on 1920x1080 that is 1280x774,
/// on 1366x768 it is 1024x700.
pub fn default_size(work_w: f64, work_h: f64) -> (f64, f64) {
    let fit = |want: f64, min: f64, max: f64, avail: f64| {
        want.clamp(min, max).min((avail - MARGIN).max(min.min(avail))).floor()
    };
    (
        fit(work_w * SHARE, MIN.0, MAX.0, work_w),
        fit(work_h * SHARE, MIN.1, MAX.1, work_h),
    )
}

/// The window's own minimum size (tauri.conf.json `minWidth`/`minHeight`).
const SMALLEST: (f64, f64) = (820.0, 600.0);

/// Whether a placement is a Windows Snap layout rather than a size the user
/// chose: full work-area height and flush with the left or right edge, the
/// way a half or a quarter-column snap lands. Windows reports the snapped
/// rectangle as the window's position, so remembering it reopened the app
/// glued to one half of the screen with its title bar under the top edge.
pub fn snapped(p: &Placement, work_w: f64, work_h: f64) -> bool {
    let full_height = p.y <= 8.0 && p.h >= work_h - 16.0;
    let at_side = p.x <= 8.0 || p.x + p.w >= work_w - 8.0;
    full_height && at_side
}

/// A saved placement is reused only when it lands fully on the current
/// work area; a window last seen on an unplugged second monitor would
/// otherwise open off-screen.
///
/// Nor when it covers the whole work area. That is a maximized window
/// recorded as a normal size (a frameless window can report a resize before
/// it reports being maximized), and reusing it opens the app full-screen
/// but not maximized, so Restore has no smaller size to go back to. Nor
/// when it is a snapped layout or smaller than the window's minimum size.
pub fn fits(p: &Placement, work_w: f64, work_h: f64) -> bool {
    [p.w, p.h, p.x, p.y].iter().all(|v| v.is_finite())
        && p.w >= SMALLEST.0
        && p.h >= SMALLEST.1
        && !snapped(p, work_w, work_h)
        && p.x >= -8.0
        && p.y >= -8.0
        && p.x + p.w <= work_w + 8.0
        && p.y + p.h <= work_h + 8.0
        && !(p.w >= work_w - 16.0 && p.h >= work_h - 16.0)
}

pub fn read(dir: &Path) -> Option<Placement> {
    let text = std::fs::read_to_string(dir.join(FILE)).ok()?;
    serde_json::from_str(&text).ok()
}

/// Written to a temporary file and renamed over the old one, so a process
/// killed mid-write leaves the previous placement, not half a file.
fn write(dir: &Path, p: &Placement) {
    if std::fs::create_dir_all(dir).is_ok() {
        if let Ok(text) = serde_json::to_string(p) {
            let temp = dir.join(format!("{FILE}.{}.tmp", std::process::id()));
            if std::fs::write(&temp, text).is_err() || std::fs::rename(&temp, dir.join(FILE)).is_err() {
                let _ = std::fs::remove_file(&temp);
            }
        }
    }
}

/// The primary monitor's work area (screen minus taskbar), logical pixels:
/// (width, height, left, top). The origin is not 0,0 when the taskbar sits on
/// the left or at the top.
#[cfg(windows)]
fn work_rect(scale: f64) -> Option<(f64, f64, f64, f64)> {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETWORKAREA};
    let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
    // SAFETY: SPI_GETWORKAREA fills the RECT we own; no other pointers.
    let ok = unsafe { SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut r as *mut RECT as *mut _, 0) };
    if ok == 0 || scale <= 0.0 {
        return None;
    }
    Some((
        f64::from(r.right - r.left) / scale,
        f64::from(r.bottom - r.top) / scale,
        f64::from(r.left) / scale,
        f64::from(r.top) / scale,
    ))
}

#[cfg(not(windows))]
fn work_rect(_scale: f64) -> Option<(f64, f64, f64, f64)> {
    None
}

/// A placement in work-area coordinates, so the checks below can assume the
/// work area starts at 0,0.
fn relative(p: &Placement, left: f64, top: f64) -> Placement {
    Placement { x: p.x - left, y: p.y - top, ..*p }
}

/// Windows' own word on whether the window is in a Snap layout, for the
/// shapes the geometry check cannot see (thirds, quarters).
///
/// Looked up at run time: user32 exports IsWindowArranged only from Windows 10
/// 1903, and a load-time import would stop the whole executable (the window,
/// the elevated helper and the scheduled tasks) from starting on older builds.
#[cfg(windows)]
fn arranged(window: &tauri::Window) -> bool {
    use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
    type IsWindowArranged = unsafe extern "system" fn(*mut core::ffi::c_void) -> i32;
    static ENTRY: std::sync::OnceLock<Option<IsWindowArranged>> = std::sync::OnceLock::new();
    let entry = *ENTRY.get_or_init(|| {
        let name: Vec<u16> = "user32.dll\0".encode_utf16().collect();
        // SAFETY: NUL-terminated name; user32 stays loaded for the life of a
        // GUI process, so the handle needs no release.
        let user32 = unsafe { GetModuleHandleW(name.as_ptr()) };
        if user32.is_null() {
            return None;
        }
        // SAFETY: a live module and a NUL-terminated name; the address is
        // reinterpreted with the documented signature BOOL(HWND).
        unsafe { GetProcAddress(user32, c"IsWindowArranged".as_ptr().cast()) }
            .map(|f| unsafe { std::mem::transmute::<_, IsWindowArranged>(f) })
    });
    let Some(is_arranged) = entry else {
        return false;
    };
    window
        .hwnd()
        // SAFETY: a live window handle owned by this process.
        .is_ok_and(|hwnd| unsafe { is_arranged(hwnd.0 as _) } != 0)
}

#[cfg(not(windows))]
fn arranged(_window: &tauri::Window) -> bool {
    false
}

/// Throttles the saves that a drag produces dozens of times a second.
pub struct Saver {
    dir: PathBuf,
    last: Mutex<(Option<Placement>, Instant)>,
}

impl Saver {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir, last: Mutex::new((None, Instant::now())) }
    }
}

/// Called from setup, before the first paint.
pub fn restore(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else { return };
    let dir = match app.path().app_data_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let work = work_rect(scale).or_else(|| {
        window
            .current_monitor()
            .ok()
            .flatten()
            .map(|m| {
                let s = m.size().to_logical::<f64>(scale);
                (s.width, s.height - 48.0, 0.0, 0.0)
            })
    });
    let Some((ww, wh, left, top)) = work else { return };

    match read(&dir).filter(|p| fits(&relative(p, left, top), ww, wh)) {
        Some(p) => {
            let _ = window.set_size(LogicalSize::new(p.w, p.h));
            let _ = window.set_position(LogicalPosition::new(p.x, p.y));
        }
        None => {
            let (w, h) = default_size(ww, wh);
            let _ = window.set_size(LogicalSize::new(w, h));
            let _ = window.center();
        }
    }
    app.manage(Saver::new(dir));
}

/// Called from the window event hook on every move and resize.
pub fn remember(window: &tauri::Window, size: Option<PhysicalSize<u32>>, pos: Option<PhysicalPosition<i32>>) {
    if window.label() != "main"
        || window.is_maximized().unwrap_or(false)
        || window.is_minimized().unwrap_or(false)
        || arranged(window)
    {
        return;
    }
    let Some(saver) = window.app_handle().try_state::<Saver>() else { return };
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = size.or_else(|| window.inner_size().ok());
    let pos = pos.or_else(|| window.outer_position().ok());
    let (Some(size), Some(pos)) = (size, pos) else { return };
    let size = size.to_logical::<f64>(scale);
    let pos = pos.to_logical::<f64>(scale);
    let p = Placement { w: size.width, h: size.height, x: pos.x, y: pos.y };
    if p.w < SMALLEST.0 || p.h < SMALLEST.1 {
        return;
    }
    // A full-screen size is a maximize caught mid-transition; keep the last
    // real size instead of overwriting it.
    if let Some((ww, wh, left, top)) = work_rect(scale) {
        if !fits(&relative(&p, left, top), ww, wh) {
            return;
        }
    }
    let Ok(mut last) = saver.last.lock() else { return };
    if last.0 == Some(p) || last.1.elapsed() < Duration::from_millis(400) && last.0.is_some() {
        return;
    }
    *last = (Some(p), Instant::now());
    write(&saver.dir, &p);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_full_hd_desktop_gets_the_large_window() {
        assert_eq!(default_size(1920.0, 1032.0), (1280.0, 774.0));
    }

    #[test]
    fn a_small_laptop_keeps_the_old_size() {
        assert_eq!(default_size(1366.0, 728.0), (1024.0, 700.0));
    }

    #[test]
    fn a_4k_screen_does_not_grow_past_the_cap() {
        assert_eq!(default_size(3840.0, 2112.0), (1280.0, 820.0));
    }

    #[test]
    fn a_placement_off_the_current_screen_is_not_reused() {
        let on = Placement { w: 1100.0, h: 720.0, x: 200.0, y: 100.0 };
        let off = Placement { x: 2000.0, ..on };
        assert!(fits(&on, 1920.0, 1032.0));
        assert!(!fits(&off, 1920.0, 1032.0));
    }

    #[test]
    fn a_maximized_size_saved_as_normal_is_not_reused() {
        // The placement found on a 1920x1080 desktop that kept reopening
        // PC Tweaker full-screen with no way back to its normal size.
        let full = Placement { w: 1920.0, h: 1030.0, x: -7.0, y: 0.0 };
        assert!(!fits(&full, 1920.0, 1032.0));
        let large = Placement { w: 1600.0, h: 900.0, x: 100.0, y: 50.0 };
        assert!(fits(&large, 1920.0, 1032.0));
    }

    #[test]
    fn a_snapped_or_too_small_placement_is_not_reused() {
        // The placement found after the dev window reopened glued to the left
        // half of a 1920x1080 desktop (work area 1920x1032).
        let left_half = Placement { w: 984.0, h: 1023.0, x: 0.0, y: 0.0 };
        assert!(snapped(&left_half, 1920.0, 1032.0));
        assert!(!fits(&left_half, 1920.0, 1032.0));
        let right_half = Placement { w: 968.0, h: 1032.0, x: 952.0, y: 0.0 };
        assert!(!fits(&right_half, 1920.0, 1032.0));
        // A tall window the user placed away from the edges is fine.
        let tall = Placement { w: 1000.0, h: 1000.0, x: 300.0, y: 10.0 };
        assert!(fits(&tall, 1920.0, 1032.0));
        // With the taskbar on the left (work area starting at x=48), a left
        // half snap is caught once the placement is made relative to it.
        let after_taskbar = Placement { w: 936.0, h: 1080.0, x: 48.0, y: 0.0 };
        assert!(fits(&after_taskbar, 1872.0, 1080.0), "absolute: looks placed");
        assert!(!fits(&relative(&after_taskbar, 48.0, 0.0), 1872.0, 1080.0));
        // Below the window's own minimum, or not a number: not reused.
        assert!(!fits(&Placement { w: 700.0, h: 640.0, x: 100.0, y: 100.0 }, 1920.0, 1032.0));
        assert!(!fits(&Placement { w: f64::NAN, h: 700.0, x: 0.0, y: 0.0 }, 1920.0, 1032.0));
    }

    #[test]
    fn a_half_written_file_is_ignored_and_writes_replace_whole_files() {
        let dir = std::env::temp_dir().join(format!("pct-wp-cut-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(FILE), "{\"w\":1200.0,\"h\":7").unwrap();
        assert_eq!(read(&dir), None);
        let p = Placement { w: 1200.0, h: 760.0, x: 10.0, y: 20.0 };
        write(&dir, &p);
        assert_eq!(read(&dir), Some(p));
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 1, "no temporary file left");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_placement_survives_the_round_trip() {
        let dir = std::env::temp_dir().join(format!("pct-wp-{}", std::process::id()));
        let p = Placement { w: 1200.0, h: 760.0, x: 10.0, y: 20.0 };
        write(&dir, &p);
        assert_eq!(read(&dir), Some(p));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn snap_detection_is_looked_up_at_run_time() {
        // A load-time import would keep the app from starting before 1903.
        let source = include_str!("window_state.rs");
        assert!(!source.contains(concat!("WindowsAndMessaging::", "IsWindowArranged")));
    }
}
