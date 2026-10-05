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

/// A saved placement is reused only when it lands fully on the current
/// work area; a window last seen on an unplugged second monitor would
/// otherwise open off-screen.
pub fn fits(p: &Placement, work_w: f64, work_h: f64) -> bool {
    p.w >= 400.0
        && p.h >= 300.0
        && p.x >= -8.0
        && p.y >= -8.0
        && p.x + p.w <= work_w + 8.0
        && p.y + p.h <= work_h + 8.0
}

pub fn read(dir: &Path) -> Option<Placement> {
    let text = std::fs::read_to_string(dir.join(FILE)).ok()?;
    serde_json::from_str(&text).ok()
}

fn write(dir: &Path, p: &Placement) {
    if std::fs::create_dir_all(dir).is_ok() {
        if let Ok(text) = serde_json::to_string(p) {
            let _ = std::fs::write(dir.join(FILE), text);
        }
    }
}

/// The primary monitor's work area (screen minus taskbar), logical pixels.
#[cfg(windows)]
fn work_area(scale: f64) -> Option<(f64, f64)> {
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
    ))
}

#[cfg(not(windows))]
fn work_area(_scale: f64) -> Option<(f64, f64)> {
    None
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
    let work = work_area(scale).or_else(|| {
        window
            .current_monitor()
            .ok()
            .flatten()
            .map(|m| {
                let s = m.size().to_logical::<f64>(scale);
                (s.width, s.height - 48.0)
            })
    });
    let Some((ww, wh)) = work else { return };

    match read(&dir).filter(|p| fits(p, ww, wh)) {
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
    if window.label() != "main" || window.is_maximized().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
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
    if p.w < 400.0 || p.h < 300.0 {
        return;
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
    fn a_placement_survives_the_round_trip() {
        let dir = std::env::temp_dir().join(format!("pct-wp-{}", std::process::id()));
        let p = Placement { w: 1200.0, h: 760.0, x: 10.0, y: 20.0 };
        write(&dir, &p);
        assert_eq!(read(&dir), Some(p));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
