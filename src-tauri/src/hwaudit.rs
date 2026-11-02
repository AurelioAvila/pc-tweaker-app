//! Hardware audit: settings in the firmware or the slot that cost speed and
//! that no Windows tweak can change. Read-only: it detects and explains, and
//! the fix (a BIOS option, another slot) stays with the user.
//!
//! - **Memory speed.** `Win32_PhysicalMemory.ConfiguredClockSpeed` is what the
//!   modules run at. Their rating comes from SMBIOS (`Speed`, usually the
//!   JEDEC base the BIOS falls back to) or, for the common enthusiast kits,
//!   from the part number, where the vendors print the XMP/EXPO speed. Running
//!   below the rating almost always means XMP/EXPO is off in the BIOS.
//! - **PCIe links.** `DEVPKEY_PciDevice_{Current,Max}Link{Speed,Width}` of the
//!   NVMe controllers and the GPUs. A GPU lowers its link *speed* when idle by
//!   design, so for GPUs only the *width* is judged; an NVMe drive keeps its
//!   negotiated link, so both count.
//! - **Resizable BAR.** The largest memory window the GPU has been given: the
//!   classic 256 MB aperture means it is off, anything larger means it is on.
//!   Only judged for GPUs that support it at all; otherwise "not applicable".
//!
//! One PowerShell process reads CIM, numeric properties only (plus model names
//! and part numbers, which are not localized). Nothing identifying is kept: no
//! serial numbers, no device instance paths in the result.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct MemoryAudit {
    /// MT/s the modules run at now (slowest module).
    pub configured_mts: u32,
    /// The best rating found, MT/s.
    pub rated_mts: u32,
    /// Where `rated_mts` comes from: "module" (SMBIOS) or "part_number".
    pub rated_source: &'static str,
    pub part_number: String,
    /// "DDR4", "DDR5", ... when SMBIOS says.
    pub generation: Option<&'static str>,
    pub modules: u32,
    /// Running at least 200 MT/s below the rating.
    pub below_rated: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct PcieLink {
    /// "nvme" or "gpu".
    pub kind: &'static str,
    pub name: String,
    pub current_gen: u32,
    pub max_gen: u32,
    pub current_width: u32,
    pub max_width: u32,
    /// The part of the link that is judged is below the device's maximum.
    pub below_max: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ReBar {
    pub gpu: String,
    /// "on", "off", "not_supported" (this GPU cannot use it) or "unknown".
    pub state: &'static str,
    pub largest_window_mb: u64,
}

#[derive(Serialize, Clone, Debug, PartialEq, Default)]
pub struct HardwareAudit {
    pub memory: Option<MemoryAudit>,
    pub links: Vec<PcieLink>,
    pub rebar: Vec<ReBar>,
}

/// Standard DDR4/DDR5 data rates, to tell a speed from other digits in a part
/// number ("F5-6000J3038F16G": 6000 is a speed, 3038 is the timings).
const DATA_RATES: &[u32] = &[
    2133, 2400, 2666, 2800, 2933, 3000, 3200, 3333, 3466, 3600, 3733, 3800, 3866, 4000, 4133, 4266,
    4400, 4600, 4800, 5000, 5200, 5600, 6000, 6200, 6400, 6600, 6800, 7000, 7200, 7400, 7600, 7800,
    8000, 8200, 8400,
];

/// The rated speed printed in a module's part number, for the vendors that
/// print it. `None` for OEM parts (they run at their JEDEC rating anyway).
pub fn rated_from_part(part: &str) -> Option<u32> {
    let p = part.trim().to_ascii_uppercase();
    let b = p.as_bytes();
    let two = |i: usize| -> Option<u32> {
        let s = p.get(i..i + 2)?;
        s.bytes()
            .all(|c| c.is_ascii_digit())
            .then(|| s.parse::<u32>().ok())
            .flatten()
    };
    // Kingston FURY: KF<generation><speed / 100>C..., e.g. KF432C16, KF560C36.
    if p.starts_with("KF") && b.len() > 5 && matches!(b[2], b'3'..=b'5') && b[5] == b'C' {
        if let Some(n) = two(3) {
            return Some(n * 100).filter(|v| DATA_RATES.contains(v));
        }
    }
    // Crucial: ...G<speed / 100>C..., e.g. BL8G32C16U4B, CP16G60C36U5B.
    if p.starts_with("BL") || p.starts_with("CP") || p.starts_with("CT") {
        for i in 0..b.len().saturating_sub(3) {
            if b[i] == b'G' && b.get(i + 3) == Some(&b'C') {
                if let Some(n) = two(i + 1)
                    .map(|n| n * 100)
                    .filter(|v| DATA_RATES.contains(v))
                {
                    return Some(n);
                }
            }
        }
    }
    // Everyone else prints it whole: F4-3600C16, CMK16GX4M2B3200C16, KHX3200C16.
    p.split(|c: char| !c.is_ascii_digit())
        .filter(|run| run.len() == 4)
        .filter_map(|run| run.parse::<u32>().ok())
        .filter(|v| DATA_RATES.contains(v))
        .max()
}

#[derive(Deserialize, Debug, Clone, Default)]
pub struct RawModule {
    #[serde(default)]
    pub speed: u32,
    #[serde(default)]
    pub configured: u32,
    #[serde(default)]
    pub part: String,
    #[serde(default, rename = "type")]
    pub kind: u32,
}

pub fn memory_audit(modules: &[RawModule]) -> Option<MemoryAudit> {
    let configured = modules
        .iter()
        .map(|m| m.configured)
        .filter(|v| *v > 0)
        .min()?;
    let module_rated = modules.iter().map(|m| m.speed).max().unwrap_or(0);
    let (part_rated, part_number) = modules
        .iter()
        .filter_map(|m| rated_from_part(&m.part).map(|r| (r, m.part.trim().to_string())))
        .max_by_key(|(r, _)| *r)
        .unwrap_or_default();
    let (rated, source) = if part_rated > module_rated {
        (part_rated, "part_number")
    } else {
        (module_rated, "module")
    };
    // Older SMBIOS tables report the clock (MHz) instead of the data rate:
    // half the rating is a unit mismatch, not a slow module.
    let below = rated > 0 && configured + 200 <= rated && configured * 2 != rated;
    Some(MemoryAudit {
        configured_mts: configured,
        rated_mts: rated.max(configured),
        rated_source: source,
        part_number,
        generation: match modules.first().map(|m| m.kind) {
            Some(24) => Some("DDR3"),
            Some(26) => Some("DDR4"),
            Some(34) => Some("DDR5"),
            _ => None,
        },
        modules: modules.len() as u32,
        below_rated: below,
    })
}

#[derive(Deserialize, Debug, Clone, Default)]
pub struct RawPci {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub disk: Option<String>,
    #[serde(default)]
    pub base: u32,
    #[serde(default)]
    pub sub: u32,
    #[serde(default)]
    pub cur_speed: u32,
    #[serde(default)]
    pub max_speed: u32,
    #[serde(default)]
    pub cur_width: u32,
    #[serde(default)]
    pub max_width: u32,
    #[serde(default)]
    pub largest_bar: u64,
}

pub fn link_audit(device: &RawPci) -> Option<PcieLink> {
    let kind = match (device.base, device.sub) {
        (1, 8) => "nvme",
        (3, _) => "gpu",
        _ => return None,
    };
    if device.max_speed == 0 || device.max_width == 0 || device.cur_width == 0 {
        return None;
    }
    let narrow = device.cur_width < device.max_width;
    let slow = device.cur_speed > 0 && device.cur_speed < device.max_speed;
    Some(PcieLink {
        kind,
        name: device
            .disk
            .clone()
            .filter(|d| !d.trim().is_empty())
            .unwrap_or_else(|| device.name.clone()),
        current_gen: device.cur_speed,
        max_gen: device.max_speed,
        current_width: device.cur_width,
        max_width: device.max_width,
        below_max: if kind == "gpu" {
            narrow
        } else {
            narrow || slow
        },
    })
}

/// GPUs that can use Resizable BAR at all (NVIDIA RTX 30 and newer, AMD RX
/// 6000 and newer, Intel Arc discrete cards).
fn rebar_capable(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    ["rtx 30", "rtx 40", "rtx 50", "rx 6", "rx 7", "rx 9"]
        .iter()
        .any(|m| n.contains(m))
        || ["arc(tm) a", "arc(tm) b", "arc a", "arc b"]
            .iter()
            .any(|m| {
                n.split(m)
                    .nth(1)
                    .is_some_and(|rest| rest.starts_with(|c: char| c.is_ascii_digit()))
            })
}

pub fn rebar_audit(device: &RawPci) -> Option<ReBar> {
    if device.base != 3 {
        return None;
    }
    const APERTURE: u64 = 256 << 20;
    let mb = device.largest_bar >> 20;
    let state = if device.largest_bar > APERTURE {
        "on"
    } else if !rebar_capable(&device.name) {
        "not_supported"
    } else if device.largest_bar == APERTURE {
        "off"
    } else {
        "unknown"
    };
    Some(ReBar {
        gpu: device.name.clone(),
        state,
        largest_window_mb: mb,
    })
}

#[derive(Deserialize, Default)]
struct Raw {
    #[serde(default)]
    ram: Vec<RawModule>,
    #[serde(default)]
    pci: Vec<RawPci>,
}

pub fn audit_from_json(json: &str) -> HardwareAudit {
    let raw: Raw = serde_json::from_str(json.trim()).unwrap_or_default();
    HardwareAudit {
        memory: memory_audit(&raw.ram),
        links: raw.pci.iter().filter_map(link_audit).collect(),
        rebar: raw.pci.iter().filter_map(rebar_audit).collect(),
    }
}

#[cfg(windows)]
const SCRIPT: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
$keys = @('DEVPKEY_PciDevice_CurrentLinkSpeed','DEVPKEY_PciDevice_MaxLinkSpeed','DEVPKEY_PciDevice_CurrentLinkWidth','DEVPKEY_PciDevice_MaxLinkWidth','DEVPKEY_PciDevice_BaseClass','DEVPKEY_PciDevice_SubClass','DEVPKEY_Device_Children')
$ram = @(Get-CimInstance Win32_PhysicalMemory | ForEach-Object { [pscustomobject]@{ speed = [int]$_.Speed; configured = [int]$_.ConfiguredClockSpeed; part = [string]$_.PartNumber; type = [int]$_.SMBIOSMemoryType } })
$pci = @()
foreach ($e in Get-CimInstance Win32_PnPEntity -Filter "PNPClass = 'Display' OR PNPClass = 'SCSIAdapter'") {
  if (-not ([string]$e.PNPDeviceID).StartsWith('PCI\')) { continue }
  $props = (Invoke-CimMethod -InputObject $e -MethodName GetDeviceProperties -Arguments @{ devicePropertyKeys = $keys }).deviceProperties
  $v = @{}; $children = @()
  foreach ($p in $props) {
    if ($p.Type -eq 0) { continue }
    if ($p.KeyName -eq 'DEVPKEY_Device_Children') { $children = @($p.Data) } else { $v[$p.KeyName -replace 'DEVPKEY_PciDevice_',''] = [int]$p.Data }
  }
  if ($v.BaseClass -ne 3 -and -not ($v.BaseClass -eq 1 -and $v.SubClass -eq 8)) { continue }
  $disk = $null
  if ($v.BaseClass -eq 1) { foreach ($c in $children) { $d = Get-CimInstance Win32_PnPEntity -Filter ("PNPDeviceID = '" + ($c -replace '\\','\\' -replace "'","\'") + "'"); if ($d) { $disk = [string]$d.Name; break } } }
  $bars = @(Get-CimAssociatedInstance -InputObject $e -ResultClassName Win32_DeviceMemoryAddress | ForEach-Object { [uint64]$_.EndingAddress - [uint64]$_.StartingAddress + 1 })
  $pci += [pscustomobject]@{ name = [string]$e.Name; disk = $disk; base = $v.BaseClass; sub = $v.SubClass; cur_speed = $v.CurrentLinkSpeed; max_speed = $v.MaxLinkSpeed; cur_width = $v.CurrentLinkWidth; max_width = $v.MaxLinkWidth; largest_bar = [uint64](($bars | Measure-Object -Maximum).Maximum) }
}
[pscustomobject]@{ ram = $ram; pci = $pci } | ConvertTo-Json -Compress -Depth 4
"#;

/// Reads the memory modules and PCIe devices. Read-only, no elevation.
#[tauri::command(async)]
pub fn hardware_audit() -> Result<HardwareAudit, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let output = crate::system_tools::run("powershell", |tool| {
            tool.args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
                .creation_flags(CREATE_NO_WINDOW);
            crate::system_tools::output_within(tool, crate::system_tools::QUICK)
        })
        .map_err(|e| format!("the hardware audit could not run: {e}"))?;
        Ok(audit_from_json(&String::from_utf8_lossy(&output.stdout)))
    }
    #[cfg(not(windows))]
    {
        Err("not supported on this platform".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_rated_speed_from_common_part_numbers() {
        for (part, speed) in [
            ("F4-3600C16D-16GVKC", Some(3600)),
            ("F5-6000J3038F16G", Some(6000)),
            ("CMK16GX4M2B3200C16", Some(3200)),
            ("CMK32GX5M2B6000C36", Some(6000)),
            ("KF432C16BB/8", Some(3200)),
            ("KF560C36BBE-16", Some(6000)),
            ("KHX3200C16D4/8GX", Some(3200)),
            ("BL8G32C16U4B.M8FE1", Some(3200)),
            ("CP16G60C36U5B.M8D1            ", Some(6000)),
            ("TF3D48G3200HC16F01", Some(3200)),
            // OEM parts carry no speed in plain digits.
            ("M378A1K43CB2-CTD", None),
            ("HMA81GU6CJR8N-VK", None),
            ("MTA8ATF1G64AZ-3G2E1", None),
            ("", None),
        ] {
            assert_eq!(rated_from_part(part), speed, "{part}");
        }
    }

    fn module(speed: u32, configured: u32, part: &str) -> RawModule {
        RawModule {
            speed,
            configured,
            part: part.into(),
            kind: 26,
        }
    }

    #[test]
    fn flags_memory_running_below_its_rating() {
        // XMP off: SMBIOS says 2133 (JEDEC), the kit is a 3600 one.
        let a = memory_audit(&vec![module(2133, 2133, "F4-3600C16D-16GVKC"); 2]).unwrap();
        assert!(a.below_rated);
        assert_eq!(
            (a.configured_mts, a.rated_mts, a.rated_source),
            (2133, 3600, "part_number")
        );
        assert_eq!(a.generation, Some("DDR4"));
        // XMP on (the maintainer's PC: EXPO 6000 above a 5600 SMBIOS rating).
        let b = memory_audit(&vec![
            RawModule {
                speed: 5600,
                configured: 6000,
                part: "CP16G60C36U5B.M8D1".into(),
                kind: 34
            };
            2
        ])
        .unwrap();
        assert!(!b.below_rated);
        assert_eq!(b.rated_mts, 6000);
        // The BIOS's own rating above the configured speed.
        assert!(
            memory_audit(&[module(3200, 2400, "M378A1K43CB2-CTD")])
                .unwrap()
                .below_rated
        );
        // MHz instead of MT/s in an old table: not a finding.
        assert!(!memory_audit(&[module(3200, 1600, "")]).unwrap().below_rated);
        // A 133 MT/s difference is rounding, not XMP.
        assert!(!memory_audit(&[module(2666, 2533, "")]).unwrap().below_rated);
        // Nothing configured reported: no claim at all.
        assert_eq!(memory_audit(&[module(3200, 0, "")]), None);
        assert_eq!(memory_audit(&[]), None);
    }

    fn pci(base: u32, sub: u32, cur: (u32, u32), max: (u32, u32)) -> RawPci {
        RawPci {
            name: "dev".into(),
            base,
            sub,
            cur_speed: cur.0,
            cur_width: cur.1,
            max_speed: max.0,
            max_width: max.1,
            ..RawPci::default()
        }
    }

    #[test]
    fn judges_gpu_width_only_and_nvme_speed_and_width() {
        // The maintainer's GTX 1660 at idle: Gen1 of Gen3, x16 of x16 — fine.
        assert!(!link_audit(&pci(3, 0, (1, 16), (3, 16))).unwrap().below_max);
        assert!(link_audit(&pci(3, 0, (4, 8), (4, 16))).unwrap().below_max);
        assert!(link_audit(&pci(1, 8, (3, 4), (4, 4))).unwrap().below_max);
        assert!(link_audit(&pci(1, 8, (4, 2), (4, 4))).unwrap().below_max);
        assert!(!link_audit(&pci(1, 8, (4, 4), (4, 4))).unwrap().below_max);
        // Other controllers and missing data are not judged.
        assert_eq!(link_audit(&pci(1, 6, (3, 1), (3, 4))), None);
        assert_eq!(link_audit(&pci(1, 8, (0, 0), (0, 0))), None);
        // The drive's model name is shown instead of the controller's.
        let named = RawPci {
            disk: Some("Samsung SSD 990 PRO 2TB".into()),
            ..pci(1, 8, (4, 4), (4, 4))
        };
        assert_eq!(link_audit(&named).unwrap().name, "Samsung SSD 990 PRO 2TB");
    }

    #[test]
    fn resizable_bar_is_judged_only_where_it_applies() {
        let gpu = |name: &str, bar: u64| RawPci {
            name: name.into(),
            base: 3,
            largest_bar: bar,
            ..RawPci::default()
        };
        assert_eq!(
            rebar_audit(&gpu("NVIDIA GeForce RTX 3060", 256 << 20))
                .unwrap()
                .state,
            "off"
        );
        assert_eq!(
            rebar_audit(&gpu("NVIDIA GeForce RTX 4070", 16 << 30))
                .unwrap()
                .state,
            "on"
        );
        assert_eq!(
            rebar_audit(&gpu("AMD Radeon RX 6700 XT", 256 << 20))
                .unwrap()
                .state,
            "off"
        );
        assert_eq!(
            rebar_audit(&gpu("Intel(R) Arc(TM) A770 Graphics", 256 << 20))
                .unwrap()
                .state,
            "off"
        );
        // The maintainer's GTX 1660 and an integrated Arc: cannot use it.
        assert_eq!(
            rebar_audit(&gpu("NVIDIA GeForce GTX 1660", 256 << 20))
                .unwrap()
                .state,
            "not_supported"
        );
        assert_eq!(
            rebar_audit(&gpu("Intel(R) Arc(TM) Graphics", 256 << 20))
                .unwrap()
                .state,
            "not_supported"
        );
        assert_eq!(
            rebar_audit(&gpu("NVIDIA GeForce RTX 3080", 0))
                .unwrap()
                .state,
            "unknown"
        );
        assert_eq!(rebar_audit(&pci(1, 8, (4, 4), (4, 4))), None);
    }

    #[test]
    fn parses_the_script_output() {
        let audit = audit_from_json(
            r#"{"ram":[{"speed":5600,"configured":6000,"part":"CP16G60C36U5B.M8D1","type":34}],"pci":[{"name":"NVIDIA GeForce GTX 1660","base":3,"sub":0,"cur_speed":1,"max_speed":3,"cur_width":16,"max_width":16,"largest_bar":268435456},{"name":"Standard NVM Express Controller","disk":null,"base":1,"sub":8,"cur_speed":4,"max_speed":4,"cur_width":4,"max_width":4,"largest_bar":1048576}]}"#,
        );
        assert_eq!(audit.links.len(), 2);
        assert_eq!(audit.rebar.len(), 1);
        assert!(!audit.memory.unwrap().below_rated);
        assert_eq!(audit_from_json("not json"), HardwareAudit::default());
    }
}
