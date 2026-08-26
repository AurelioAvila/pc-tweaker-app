//! GPU thermal profiles: power limit plus clock behaviour.
//!
//! Why not a fan curve: NVIDIA ships no fan control in `nvidia-smi` — the
//! option does not exist, on any driver. The tools that do offer a manual fan
//! curve drive `NvAPI_GPU_SetCoolerLevels`, a private, undocumented entry
//! point whose argument layout shifts between driver releases and is only
//! published under NDA. Guessing at it is how a fan ends up pinned at 0% on a
//! card that is heating, so this app does not.
//!
//! What it uses instead are the two levers NVIDIA documents and supports:
//!
//! * **Power limit** (`-pl`) — caps the watts, which is what actually governs
//!   heat and therefore fan speed.
//! * **Clock lock** (`-lgc` / `-rgc`) — pins the core clock instead of letting
//!   it drift with boost heuristics.
//!
//! The second is what makes the three profiles genuinely different on cards
//! whose factory power limit already equals their maximum, which is most
//! locked consumer cards: there is no headroom left in watts, but there is
//! headroom in clocks. Without it "Standard" and "Gaming" would be the same
//! number twice, which is worse than not offering the choice.
//!
//! Everything here is reversible and temporary: both settings reset on reboot
//! unless persistence mode is on, which it is not by default.

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct GpuPowerInfo {
    /// False when there is no NVIDIA card, or when the card reports no
    /// settable limit — in which case the UI offers no profiles at all
    /// rather than buttons that would fail.
    pub supported: bool,
    pub current_w: Option<u32>,
    pub default_w: Option<u32>,
    pub min_w: Option<u32>,
    pub max_w: Option<u32>,
    /// True when default and max coincide. The profiles stay distinct anyway
    /// because Gaming also pins the clock, but the UI still says so.
    pub default_is_max: bool,
    /// Highest core clock the card will accept, which is what the Gaming
    /// profile locks to.
    pub max_clock_mhz: Option<u32>,
    pub current_clock_mhz: Option<u32>,
}

#[cfg(windows)]
mod imp {
    use super::GpuPowerInfo;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    fn parse_u32(field: &str) -> Option<u32> {
        let f = field.trim();
        if f.is_empty() || f.starts_with('[') {
            return None;
        }
        f.parse::<f32>().ok().map(|v| v.round() as u32)
    }

    fn smi(args: &[&str]) -> Option<String> {
        let out = Command::new("nvidia-smi")
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        if !out.status.success() {
            return None;
        }
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }

    pub fn info() -> GpuPowerInfo {
        let unsupported = GpuPowerInfo {
            supported: false,
            current_w: None,
            default_w: None,
            min_w: None,
            max_w: None,
            default_is_max: false,
            max_clock_mhz: None,
            current_clock_mhz: None,
        };

        let line = match smi(&[
            "--query-gpu=power.limit,power.default_limit,power.min_limit,power.max_limit,clocks.max.graphics,clocks.current.graphics",
            "--format=csv,noheader,nounits",
        ]) {
            Some(t) => match t.lines().find(|l| !l.trim().is_empty()) {
                Some(l) => l.to_string(),
                None => return unsupported,
            },
            None => return unsupported,
        };

        let cols: Vec<&str> = line.split(',').map(|c| c.trim()).collect();
        if cols.len() < 6 {
            return unsupported;
        }

        let current_w = parse_u32(cols[0]);
        let default_w = parse_u32(cols[1]);
        let min_w = parse_u32(cols[2]);
        let max_w = parse_u32(cols[3]);

        // A card that will not state its own bounds is a card we will not
        // send a limit to: without min/max there is nothing to clamp against.
        let (min, max) = match (min_w, max_w) {
            (Some(a), Some(b)) if b > a => (a, b),
            _ => return unsupported,
        };

        GpuPowerInfo {
            supported: true,
            current_w,
            default_w,
            min_w: Some(min),
            max_w: Some(max),
            default_is_max: default_w == Some(max),
            max_clock_mhz: parse_u32(cols[4]),
            current_clock_mhz: parse_u32(cols[5]),
        }
    }

    /// Applies a profile: a power limit clamped to the card's own reported
    /// range, and either a locked core clock or the factory clock behaviour.
    ///
    /// The clamp is the whole safety story: every number reaching the command
    /// line is a `u32` bounded by values the driver itself just reported, so
    /// it can be neither out of range nor anything but digits.
    pub fn apply(watts: u32, lock_clock_mhz: Option<u32>) -> Result<(), String> {
        let info = info();
        if !info.supported {
            return Err("this GPU does not expose a settable power limit".to_string());
        }
        let min = info.min_w.unwrap_or(watts);
        let max = info.max_w.unwrap_or(watts);
        let clamped_w = watts.clamp(min, max);

        let run = |args: &[&str]| -> Result<(), String> {
            let out = Command::new("nvidia-smi")
                .args(args)
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| format!("could not run nvidia-smi: {}", e))?;
            if out.status.success() {
                return Ok(());
            }
            let err = String::from_utf8_lossy(&out.stderr);
            let stdout = String::from_utf8_lossy(&out.stdout);
            let detail = if err.trim().is_empty() { stdout } else { err };
            Err(detail.trim().to_string())
        };

        run(&["-i", "0", "-pl", &clamped_w.to_string()])?;

        match lock_clock_mhz {
            Some(mhz) => {
                let ceiling = info.max_clock_mhz.unwrap_or(mhz);
                let target = mhz.min(ceiling);
                // A floor of 0 lets the card still idle down; only the top of
                // the range is pinned, so this raises the ceiling rather than
                // forcing the core to sit at full clock while doing nothing.
                run(&["-i", "0", "-lgc", &format!("0,{}", target)])?;
            }
            None => {
                // Releasing is best-effort: a card with no lock in place
                // answers with an error that means "nothing to undo", and
                // failing the whole profile over that would be wrong.
                let _ = run(&["-i", "0", "-rgc"]);
            }
        }
        Ok(())
    }
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn gpu_power_info() -> Result<GpuPowerInfo, String> {
    Ok(imp::info())
}

/// Applying a profile is an administrator operation, so it goes through the
/// same one-action elevated relaunch every other admin change uses: the app
/// itself never runs elevated.
#[cfg(windows)]
#[tauri::command(async)]
pub fn set_gpu_profile(watts: u32, lock_clock_mhz: Option<u32>) -> Result<(), String> {
    if crate::elevation::is_elevated() {
        return imp::apply(watts, lock_clock_mhz);
    }
    let payload = match lock_clock_mhz {
        Some(mhz) => format!("{}:{}", watts, mhz),
        None => format!("{}:release", watts),
    };
    crate::elevation::run_elevated_action("--elevated-gpupower", &payload)
}

/// Entry point for the elevated relaunch. Payload is `watts:clock`, where
/// clock is either a number or the literal `release`.
#[cfg(windows)]
pub fn apply_elevated(payload: &str) -> Result<(), String> {
    let (w, c) = payload
        .split_once(':')
        .ok_or_else(|| format!("malformed profile payload: {}", payload))?;
    let watts: u32 = w
        .trim()
        .parse()
        .map_err(|_| format!("not a wattage: {}", w))?;
    let lock = if c.trim() == "release" {
        None
    } else {
        Some(
            c.trim()
                .parse::<u32>()
                .map_err(|_| format!("not a clock: {}", c))?,
        )
    };
    imp::apply(watts, lock)
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn gpu_power_info() -> Result<GpuPowerInfo, String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn set_gpu_profile(_watts: u32, _lock_clock_mhz: Option<u32>) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
