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
}

#[cfg(windows)]
mod imp {
    use super::ForegroundApp;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::Threading::{
        GetPriorityClass, OpenProcess, QueryFullProcessImageNameW, ABOVE_NORMAL_PRIORITY_CLASS,
        BELOW_NORMAL_PRIORITY_CLASS, HIGH_PRIORITY_CLASS, IDLE_PRIORITY_CLASS,
        NORMAL_PRIORITY_CLASS, PROCESS_QUERY_LIMITED_INFORMATION, REALTIME_PRIORITY_CLASS,
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

    pub fn foreground_app() -> Option<ForegroundApp> {
        // SAFETY: every call below is a plain Win32 read. The handle is closed
        // on every path out, including the early returns.
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

            // LIMITED_INFORMATION is the least privilege that still answers
            // both questions, and unlike PROCESS_QUERY_INFORMATION it is
            // granted for processes at a higher integrity level — which most
            // anti-cheat-protected games run at. Asking for more would fail
            // on exactly the processes this HUD exists to report on.
            let handle: HANDLE = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return None;
            }

            let mut buffer = [0u16; 260];
            let mut len: u32 = buffer.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut len);
            let class = GetPriorityClass(handle);
            CloseHandle(handle);

            if ok == 0 || len == 0 {
                return None;
            }
            let full = String::from_utf16_lossy(&buffer[..len as usize]);
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
            Some(ForegroundApp {
                name,
                priority: priority_name(class).to_string(),
            })
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::ForegroundApp;
    pub fn foreground_app() -> Option<ForegroundApp> {
        None
    }
}

/// One HUD frame. Called on a timer by the overlay window.
///
/// Everything is read fresh except the GPU, which comes from the same
/// `nvidia-smi` path the Hardware screen uses — a process spawn per sample, so
/// the overlay polls at a deliberately unhurried interval rather than trying
/// to look like a 60 Hz instrument it has no way of being.
#[tauri::command(async)]
pub fn hud_snapshot(state: tauri::State<'_, crate::sysmon::SysMonState>) -> HudSnapshot {
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
    HudSnapshot {
        cpu_pct,
        ram_used_mb,
        ram_total_mb,
        gpu_pct,
        gpu_temp_c: gpu.and_then(|g| g.temp_c),
        vram_used_mb: gpu.and_then(|g| g.vram_used_mb),
        vram_total_mb: gpu.and_then(|g| g.vram_total_mb),
        bottleneck: bottleneck(cpu_pct, gpu_pct),
        foreground: imp::foreground_app(),
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
