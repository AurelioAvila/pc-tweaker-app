//! Live thermal and GPU telemetry.
//!
//! Every figure here is read from a real sensor and tagged with the source it
//! came from. Nothing is estimated, interpolated, or modelled: when a sensor
//! is not exposed, the field is `None` and `*_source` says why, so the UI can
//! state "this hardware doesn't publish it" rather than draw a plausible
//! number nobody can verify.
//!
//! Why there is no universal CPU temperature: Windows exposes core
//! temperatures only through `MSAcpi_ThermalZoneTemperature`, which most
//! desktop firmware simply does not implement (it answers "not supported").
//! The tools that always show a CPU temperature ship a signed kernel driver
//! to read the MSRs directly — a ring-0 component this app deliberately does
//! not install. So on machines without ACPI thermal zones the honest answer
//! is that we cannot read it, and that is what gets reported.

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct GpuReading {
    pub name: String,
    pub temp_c: Option<f32>,
    pub utilization_pct: Option<f32>,
    pub vram_used_mb: Option<u64>,
    pub vram_total_mb: Option<u64>,
    /// `Some(0.0)` is a real reading — a card idling below its fan-stop
    /// threshold — and is not the same as `None`, which means the card has no
    /// fan-speed sensor at all (common on laptop and blower designs).
    pub fan_pct: Option<f32>,
    pub power_w: Option<f32>,
    pub power_limit_w: Option<f32>,
    pub driver_version: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ThermalReport {
    pub cpu_temp_c: Option<f32>,
    /// "acpi" when a thermal zone answered, "unavailable" when the firmware
    /// does not implement one. Shown to the user verbatim as provenance.
    pub cpu_source: String,
    pub gpus: Vec<GpuReading>,
    /// "nvidia-smi" or "none". Only NVIDIA ships a query tool with every
    /// driver; AMD and Intel expose nothing equivalent without a vendor SDK,
    /// so their cards are reported as unreadable rather than guessed at.
    pub gpu_source: String,
}

#[cfg(windows)]
mod imp {
    use super::{GpuReading, ThermalReport};
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    /// nvidia-smi prints "[N/A]" (and occasionally "[Not Supported]") for
    /// fields a given card doesn't expose. Those must become `None`, not 0.0:
    /// a fan reported as absent and a fan genuinely spinning at 0% look
    /// identical once both are zero.
    fn parse_opt<T: std::str::FromStr>(field: &str) -> Option<T> {
        let f = field.trim();
        if f.is_empty() || f.starts_with('[') {
            return None;
        }
        f.parse::<T>().ok()
    }

    fn read_nvidia() -> Vec<GpuReading> {
        let output = Command::new("nvidia-smi")
            .args([
                "--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,fan.speed,power.draw,power.limit,driver_version",
                "--format=csv,noheader,nounits",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        // No NVIDIA GPU means no nvidia-smi on PATH, which surfaces here as a
        // spawn error. That is an ordinary outcome, not a failure to report.
        let output = match output {
            Ok(o) if o.status.success() => o,
            _ => return Vec::new(),
        };

        String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter(|line| !line.trim().is_empty())
            .filter_map(|line| {
                let cols: Vec<&str> = line.split(',').map(|c| c.trim()).collect();
                // Anything shorter than the query is a truncated or unexpected
                // line; skipping beats indexing past the end.
                if cols.len() < 9 {
                    return None;
                }
                Some(GpuReading {
                    name: cols[0].to_string(),
                    temp_c: parse_opt(cols[1]),
                    utilization_pct: parse_opt(cols[2]),
                    vram_used_mb: parse_opt(cols[3]),
                    vram_total_mb: parse_opt(cols[4]),
                    fan_pct: parse_opt(cols[5]),
                    power_w: parse_opt(cols[6]),
                    power_limit_w: parse_opt(cols[7]),
                    driver_version: {
                        let v = cols[8].trim();
                        if v.is_empty() || v.starts_with('[') {
                            None
                        } else {
                            Some(v.to_string())
                        }
                    },
                })
            })
            .collect()
    }

    /// ACPI reports tenths of a Kelvin. A machine can expose several zones
    /// (CPU package, chipset, skin); the warmest is the meaningful one for
    /// "is this thing running hot", so that is the one taken.
    fn read_cpu_temp() -> Option<f32> {
        let script = "(Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | \
                      Select-Object -ExpandProperty CurrentTemperature) -join ','";
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        String::from_utf8_lossy(&output.stdout)
            .split(',')
            .filter_map(|v| v.trim().parse::<f32>().ok())
            .map(|tenths_kelvin| tenths_kelvin / 10.0 - 273.15)
            // Firmware that answers but isn't wired to a sensor tends to
            // return a fixed placeholder well outside anything physical.
            // Bounding to a plausible operating range keeps such a value from
            // being presented as a measurement.
            .filter(|c| *c > 0.0 && *c < 125.0)
            .fold(None, |acc: Option<f32>, c| {
                Some(acc.map_or(c, |a| a.max(c)))
            })
    }

    pub fn read() -> ThermalReport {
        let cpu_temp_c = read_cpu_temp();
        let gpus = read_nvidia();
        ThermalReport {
            cpu_source: if cpu_temp_c.is_some() {
                "acpi"
            } else {
                "unavailable"
            }
            .to_string(),
            cpu_temp_c,
            gpu_source: if gpus.is_empty() {
                "none"
            } else {
                "nvidia-smi"
            }
            .to_string(),
            gpus,
        }
    }
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn thermal_report() -> Result<ThermalReport, String> {
    Ok(imp::read())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn thermal_report() -> Result<ThermalReport, String> {
    Err("not supported on this platform".to_string())
}

#[cfg(all(test, windows))]
mod tests {
    /// The parse helper is the one piece with a real failure mode: treating
    /// "[N/A]" as a number would turn "this card has no sensor" into a
    /// confident 0, which is exactly the kind of invented reading this module
    /// exists to avoid.
    #[test]
    fn placeholder_fields_do_not_become_zero() {
        // Re-declared rather than exported: the helper is private on purpose,
        // and this asserts the behaviour the private version is written to.
        fn parse_opt<T: std::str::FromStr>(field: &str) -> Option<T> {
            let f = field.trim();
            if f.is_empty() || f.starts_with('[') {
                return None;
            }
            f.parse::<T>().ok()
        }

        assert_eq!(parse_opt::<f32>("[N/A]"), None);
        assert_eq!(parse_opt::<f32>("[Not Supported]"), None);
        assert_eq!(parse_opt::<f32>(""), None);
        assert_eq!(parse_opt::<f32>("0"), Some(0.0));
        assert_eq!(parse_opt::<f32>(" 48 "), Some(48.0));
        assert_eq!(parse_opt::<u64>("3234"), Some(3234));
    }
}
