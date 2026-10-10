//! Telemetry for the in-game overlay.
//!
//! ## What this deliberately does not report
//!
//! It does not report frame time, frame rate, or "latency spikes", and the
//! overlay must never invent them.
//!
//! A game's frame time is the interval between its calls into the presentation
//! chain. The only way to observe that from outside the game is to consume the
//! `Microsoft-Windows-DXGI` / `D3D9` ETW providers the way PresentMon does —
//! an event-tracing session that needs its own kernel-level plumbing and a
//! privileged consumer. Nothing available to this process can see it: sampling
//! GPU utilisation gives load, not pacing, and timing the overlay's own
//! repaints measures the compositor's behaviour for the overlay window, not
//! the game's frames. Both would be a number that moves plausibly while
//! meaning nothing about the thing the label claims.
//!
//! So the HUD shows what can genuinely be measured — and every field here is
//! read from a real source:
//!
//! * CPU and GPU utilisation, GPU temperature, VRAM and RAM, all from the same
//!   sources the Hardware screen already uses.
//! * The foreground process, and the scheduling priority Windows has actually
//!   given it.
//! * A bottleneck reading derived from the two utilisation figures.

use serde::Serialize;

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Bottleneck {
    /// GPU pinned while the CPU has headroom: the card is the limit.
    Gpu,
    /// The mirror image — a CPU-bound frame budget.
    Cpu,
    /// Both high. Nothing to hand off; this is a balanced load, not a fault.
    Balanced,
    /// Neither part is working hard enough for the question to mean anything.
    /// Reported rather than defaulting to "balanced", which would read as a
    /// verdict on a machine that is sitting idle.
    Idle,
}

/// Above this a part is considered saturated.
const SATURATED_PCT: f32 = 85.0;
/// Below this it has real headroom left.
const HEADROOM_PCT: f32 = 60.0;
/// Under this on both parts there is no meaningful load to judge.
const IDLE_PCT: f32 = 25.0;

/// Which part is holding the frame back.
///
/// The rule is the standard one and it is deliberately conservative: a verdict
/// is only given when one part is saturated *and* the other demonstrably is
/// not. A single high number on its own is not evidence of a bottleneck — a
/// CPU at 90% with a GPU at 88% is a machine working hard, not a machine with
/// a problem, and telling the user to go buy a processor on that basis would
/// be worse than saying nothing.
pub fn bottleneck(cpu_pct: f32, gpu_pct: Option<f32>) -> Bottleneck {
    let Some(gpu) = gpu_pct else {
        // With no GPU reading there is nothing to compare against. Refusing to
        // guess is the only honest answer.
        return Bottleneck::Idle;
    };
    if cpu_pct < IDLE_PCT && gpu < IDLE_PCT {
        return Bottleneck::Idle;
    }
    if gpu >= SATURATED_PCT && cpu_pct < HEADROOM_PCT {
        return Bottleneck::Gpu;
    }
    if cpu_pct >= SATURATED_PCT && gpu < HEADROOM_PCT {
        return Bottleneck::Cpu;
    }
    Bottleneck::Balanced
}

#[derive(Serialize, Clone)]
pub struct ForegroundApp {
    pub name: String,
    /// Needed to attribute frames to this process: the frame counter records
    /// presents per process id, and the id is the only thing that ties the
    /// two together — two copies of the same executable are two rates.
    pub pid: u32,
    /// Windows' own scheduling class for the process — "High", "Above normal",
    /// "Normal", and so on. This is the real value read back from the running
    /// process, not the value some tweak asked for, so it stays honest when a
    /// game overrides it or a tweak failed to take effect.
    pub priority: String,
}

#[derive(Serialize, Clone)]
pub struct HudSnapshot {
    pub cpu_pct: f32,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub gpu_pct: Option<f32>,
    pub gpu_temp_c: Option<f32>,
    pub vram_used_mb: Option<u64>,
    pub vram_total_mb: Option<u64>,
    pub bottleneck: Bottleneck,
    /// `None` when the foreground window belongs to no readable process (the
    /// desktop, a secure prompt, or a window that closed between the two
    /// calls). The HUD shows a dash rather than a stale name.
    pub foreground: Option<ForegroundApp>,
    /// The foreground process's frame rate, when the counter is running and
    /// that process is actually presenting. `None` covers three different
    /// situations on purpose — the counter is off, the foreground window is
    /// not a game, or the game is loading and has drawn nothing — because in
    /// all three the honest overlay shows no number rather than a zero.
    pub fps: Option<crate::fps::FpsStats>,
}

#[cfg(windows)]
mod imp {
    use super::ForegroundApp;
    use crate::process_guard::{self, Access};
    use windows_sys::Win32::System::Threading::{
        GetPriorityClass, ABOVE_NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS,
        HIGH_PRIORITY_CLASS, IDLE_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS, REALTIME_PRIORITY_CLASS,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };

    fn priority_name(class: u32) -> &'static str {
        match class {
            REALTIME_PRIORITY_CLASS => "Realtime",
            HIGH_PRIORITY_CLASS => "High",
            ABOVE_NORMAL_PRIORITY_CLASS => "Above normal",
            NORMAL_PRIORITY_CLASS => "Normal",
            BELOW_NORMAL_PRIORITY_CLASS => "Below normal",
            IDLE_PRIORITY_CLASS => "Low",
            // A class Windows added later, or a failed read. Naming it
            // "Normal" would be a guess; the raw value at least cannot mislead.
            _ => "Unknown",
        }
    }

    /// Which process owns the foreground window.
    ///
    /// Deliberately separate from [`describe`], and deliberately handle-free.
    /// `GetWindowThreadProcessId` answers this from the window alone, whereas
    /// naming the process needs `OpenProcess` — and that is exactly what a
    /// protected game's driver refuses for the game it is protecting. While the
    /// two were one function, a protected game failed the handle step and took
    /// the process id down with it, so the frame counter had nothing to
    /// attribute frames to and reported no rate at all inside precisely the
    /// games it was built for.
    pub fn foreground_pid() -> Option<u32> {
        // SAFETY: two plain Win32 reads, neither of which opens anything.
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 {
                return None;
            }
            Some(pid)
        }
    }

    /// The process's name and, when allowed, its scheduling class.
    ///
    /// The name comes from the kernel's process table by PID: no handle is
    /// opened to learn it, so a protected game is named like any other window.
    /// The priority needs a handle, so it is read only when `read_priority` is
    /// true and the guard does not protect the process; otherwise it is left
    /// empty and the overlay shows the name alone.
    pub fn describe(pid: u32, read_priority: bool) -> Option<ForegroundApp> {
        let full = process_guard::image_path(pid)?;
        // Just the executable name: the full path would leak the user's
        // folder layout onto a screen they may well be streaming.
        let name = full
            .rsplit(['\\', '/'])
            .next()
            .unwrap_or(&full)
            .trim_end_matches(".exe")
            .to_string();
        if name.is_empty() {
            return None;
        }
        let priority = if read_priority && !process_guard::is_protected_executable(&full) {
            process_guard::open(pid, Access::Query)
                .ok()
                // SAFETY: the handle is open with query-limited rights.
                .map(|process| priority_name(unsafe { GetPriorityClass(process.raw()) }))
                .unwrap_or("")
        } else {
            ""
        };
        Some(ForegroundApp {
            name,
            pid,
            priority: priority.to_string(),
        })
    }
}

#[cfg(not(windows))]
mod imp {
    use super::ForegroundApp;
    pub fn foreground_pid() -> Option<u32> {
        None
    }
    pub fn describe(_pid: u32, _read_priority: bool) -> Option<ForegroundApp> {
        None
    }
}

#[cfg(windows)]
fn fps_for(pid: u32) -> Option<crate::fps::FpsStats> {
    crate::fps::imp::reading(pid)
}

#[cfg(not(windows))]
fn fps_for(_pid: u32) -> Option<crate::fps::FpsStats> {
    None
}

/// One HUD frame. Called on a timer by the overlay window.
///
/// Everything is read fresh except the GPU, which comes from the same
/// `nvidia-smi` path the Hardware screen uses — a process spawn per sample, so
/// the overlay polls at a deliberately unhurried interval rather than trying
/// to look like a 60 Hz instrument it has no way of being.
#[tauri::command(async)]
pub fn hud_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::sysmon::SysMonState>,
) -> HudSnapshot {
    let (cpu_pct, ram_used_mb, ram_total_mb) = crate::sysmon::cpu_and_memory(&state);
    // `thermal_report` is the platform-agnostic entry point; on a machine with
    // no NVIDIA card it simply returns an empty GPU list, which the fields
    // below turn into `None` rather than into zeroes.
    let thermals = crate::thermals::thermal_report().unwrap_or(crate::thermals::ThermalReport {
        cpu_temp_c: None,
        cpu_source: "unavailable".to_string(),
        gpus: Vec::new(),
        gpu_source: "none".to_string(),
    });
    let gpu = thermals.gpus.first();

    let gpu_pct = gpu.and_then(|g| g.utilization_pct);
    // The id first, then the description — never the other way round. A game
    // that will not be described is still a game whose frames were counted.
    let pid = imp::foreground_pid();
    // While a game that manages its own performance runs, no process handle
    // is opened for the overlay at all.
    let read_priority =
        crate::store_for_dir(&app).is_ok_and(|dir| !crate::process_guard::paused(&dir));
    let foreground = pid.and_then(|pid| imp::describe(pid, read_priority));
    let fps = pid.and_then(fps_for);
    HudSnapshot {
        cpu_pct,
        ram_used_mb,
        ram_total_mb,
        gpu_pct,
        gpu_temp_c: gpu.and_then(|g| g.temp_c),
        vram_used_mb: gpu.and_then(|g| g.vram_used_mb),
        vram_total_mb: gpu.and_then(|g| g.vram_total_mb),
        bottleneck: bottleneck(cpu_pct, gpu_pct),
        foreground,
        fps,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_saturated_gpu_beside_an_idle_cpu_is_a_gpu_bottleneck() {
        assert_eq!(bottleneck(35.0, Some(97.0)), Bottleneck::Gpu);
    }

    #[test]
    fn a_saturated_cpu_beside_a_coasting_gpu_is_a_cpu_bottleneck() {
        assert_eq!(bottleneck(96.0, Some(40.0)), Bottleneck::Cpu);
    }

    /// The case that keeps this honest. Both parts working hard is a machine
    /// being used well, and calling it a bottleneck would send someone
    /// shopping for hardware that would not help.
    #[test]
    fn both_parts_working_hard_is_balanced_not_a_bottleneck() {
        assert_eq!(bottleneck(90.0, Some(92.0)), Bottleneck::Balanced);
        assert_eq!(bottleneck(88.0, Some(86.0)), Bottleneck::Balanced);
    }

    #[test]
    fn an_idle_machine_gets_no_verdict() {
        assert_eq!(bottleneck(4.0, Some(2.0)), Bottleneck::Idle);
    }

    /// With no GPU figure there is nothing to compare, so no verdict is given
    /// rather than one inferred from the CPU alone.
    #[test]
    fn no_gpu_reading_means_no_verdict() {
        assert_eq!(bottleneck(99.0, None), Bottleneck::Idle);
    }
}
