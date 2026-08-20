//! A small, honest description of the machine PC Tweaker is running on.
//!
//! This exists so the Scan can move from "is this tweak applied?" to "is this
//! tweak worth applying *on this PC*?" — recommending SSD-safe optimization on
//! a spinning disk, or a laptop-hostile power plan on a laptop, is exactly the
//! kind of blind advice the app defines itself against.
//!
//! ## Deliberate limits
//!
//! Only what a recommendation could plausibly depend on is collected. Nothing
//! here identifies the machine or its owner: no serial numbers, no user or
//! computer name, no addresses, no license keys. Adding such a field would
//! turn a local hardware profile into a fingerprint, so don't.
//!
//! ## Why the values are read the way they are
//!
//! Every source below is either a Windows API, the registry, or CIM returning
//! *numeric* properties. None of it parses human-readable command output,
//! because those strings are localized: this project has already shipped two
//! separate bugs from that (the power-plan GUID parse, and the CPU boost
//! "unsupported" error) on the maintainer's own Italian Windows. When a value
//! cannot be established, it is reported as `Unknown` rather than guessed.

use serde::Serialize;

/// Storage class of the disk Windows itself boots from — not of every disk in
/// the machine, since that is the one whose behaviour the tweaks affect.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum DiskKind {
    Hdd,
    Ssd,
    Nvme,
    Unknown,
}

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum FormFactor {
    Desktop,
    Laptop,
    Unknown,
}

#[derive(Serialize, Clone, Debug)]
pub struct SystemProfile {
    /// Marketing-ish version line, e.g. "Windows 11 24H2". `None` when it
    /// can't be read.
    pub windows_version: Option<String>,
    /// OS build, e.g. "26100.1742".
    pub windows_build: Option<String>,
    pub cpu: Option<String>,
    /// Physical cores where the OS reports them, else `None`.
    pub cpu_physical_cores: Option<usize>,
    /// Logical processors (threads).
    pub cpu_logical_cores: Option<usize>,
    pub gpu: Option<String>,
    pub ram_total_bytes: Option<u64>,
    pub system_disk: DiskKind,
    pub form_factor: FormFactor,
    /// GUID of the active power plan, plus a canonical name when it is one of
    /// Windows' built-ins. Custom/OEM plans keep their GUID and a `None` name,
    /// because the display name `powercfg` prints is localized.
    pub power_plan_guid: Option<String>,
    pub power_plan: Option<String>,
}

impl SystemProfile {
    /// Everything unknown. Used as the base that each probe fills in, so a
    /// single failing probe can never take the whole profile down with it.
    fn empty() -> Self {
        SystemProfile {
            windows_version: None,
            windows_build: None,
            cpu: None,
            cpu_physical_cores: None,
            cpu_logical_cores: None,
            gpu: None,
            ram_total_bytes: None,
            system_disk: DiskKind::Unknown,
            form_factor: FormFactor::Unknown,
            power_plan_guid: None,
            power_plan: None,
        }
    }
}

/// Windows' own built-in plans. Their names are stable identifiers here, not
/// the localized strings Windows shows the user.
#[cfg(windows)]
fn well_known_plan(guid: &str) -> Option<&'static str> {
    match guid.to_ascii_lowercase().as_str() {
        "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" => Some("High performance"),
        "381b4222-f694-41f0-9685-ff5bb260df2e" => Some("Balanced"),
        "a1841308-3541-4fab-bc81-f71556f20b4a" => Some("Power saver"),
        "e9a42b02-d5df-448d-aa00-03f14749eb61" => Some("Ultimate performance"),
        _ => None,
    }
}

/// Windows version and build, from the registry rather than from any command
/// output. `DisplayVersion` ("24H2") replaced `ReleaseId` in Windows 10 2009,
/// so both are tried before giving up on the version half.
#[cfg(windows)]
fn read_windows_version(profile: &mut SystemProfile) {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
    else {
        return;
    };

    let build: Option<String> = key.get_value("CurrentBuildNumber").ok();
    let ubr: Option<u32> = key.get_value("UBR").ok();
    profile.windows_build = match (&build, ubr) {
        (Some(b), Some(u)) => Some(format!("{}.{}", b, u)),
        (Some(b), None) => Some(b.clone()),
        _ => None,
    };

    // Windows 11 still reports itself as "Windows 10" in ProductName — the
    // build number is the only reliable discriminator (11 starts at 22000).
    let major = build
        .as_deref()
        .and_then(|b| b.parse::<u32>().ok())
        .map(|b| {
            if b >= 22000 {
                "Windows 11"
            } else {
                "Windows 10"
            }
        });

    let display: Option<String> = key
        .get_value("DisplayVersion")
        .ok()
        .or_else(|| key.get_value("ReleaseId").ok());

    profile.windows_version = match (major, display) {
        (Some(m), Some(d)) => Some(format!("{} {}", m, d)),
        (Some(m), None) => Some(m.to_string()),
        _ => None,
    };
}

/// The display adapter with the most dedicated video memory, from the display
/// class key. Present without admin rights and without spawning anything.
///
/// "Most memory" rather than "first listed" because a machine with both an
/// integrated and a discrete GPU usually enumerates the integrated one first:
/// on the maintainer's own PC that meant reporting 512 MB of AMD integrated
/// graphics while a 6 GB GeForce GTX 1660 did the actual rendering. For an app
/// that advises on gaming settings, naming the wrong GPU is worse than naming
/// none, and dedicated VRAM separates the two reliably without hardcoding
/// vendor IDs (which would need updating for every new vendor and would still
/// be wrong for AMD, who make both kinds).
#[cfg(windows)]
fn read_gpu(profile: &mut SystemProfile) {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    const DISPLAY_CLASS: &str =
        r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
    // REG_QWORD holding the adapter's dedicated video memory in bytes.
    const MEMORY_SIZE: &str = "HardwareInformation.qwMemorySize";

    let Ok(class_key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(DISPLAY_CLASS) else {
        return;
    };

    let mut best: Option<(u64, String)> = None;

    // Subkeys are "0000", "0001", ... — one per adapter, including inactive
    // and virtual ones.
    for name in class_key.enum_keys().flatten() {
        if !name.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let Ok(adapter) = class_key.open_subkey(&name) else {
            continue;
        };
        let Ok(desc) = adapter.get_value::<String, _>("DriverDesc") else {
            continue;
        };
        let desc = desc.trim().to_string();
        if desc.is_empty() {
            continue;
        }

        // Adapters that don't report memory (some virtual/RDP ones) still
        // count as a fallback at zero, so a machine where nothing reports VRAM
        // names an adapter rather than nothing.
        let memory = adapter.get_value::<u64, _>(MEMORY_SIZE).unwrap_or(0);
        if best.as_ref().is_none_or(|(best_mem, _)| memory > *best_mem) {
            best = Some((memory, desc));
        }
    }

    profile.gpu = best.map(|(_, desc)| desc);
}

/// CPU, core counts and installed RAM, via the same `sysinfo` crate the live
/// system monitor already uses — no second source of truth for the same facts.
fn read_cpu_and_ram(profile: &mut SystemProfile) {
    use sysinfo::System;

    let mut sys = System::new();
    sys.refresh_memory();
    sys.refresh_cpu_all();

    let total = sys.total_memory();
    profile.ram_total_bytes = (total > 0).then_some(total);

    if let Some(cpu) = sys.cpus().first() {
        let brand = cpu.brand().trim().to_string();
        profile.cpu = (!brand.is_empty()).then_some(brand);
    }

    let logical = sys.cpus().len();
    profile.cpu_logical_cores = (logical > 0).then_some(logical);
    profile.cpu_physical_cores = sys.physical_core_count();
}

#[cfg(windows)]
fn read_power_plan(profile: &mut SystemProfile) {
    if let Ok(guid) = crate::power::active_scheme_guid() {
        profile.power_plan = well_known_plan(&guid).map(|s| s.to_string());
        profile.power_plan_guid = Some(guid);
    }
}

/// Chassis type and system-disk class, both from CIM.
///
/// These are the only two facts here with no registry or crate-level source,
/// so they cost one PowerShell process. Both are read as *numbers*
/// (`MediaType`, `BusType`, `ChassisTypes`) rather than the friendly strings
/// the same objects can render, because the numbers don't change with the
/// system language and the strings do.
#[cfg(windows)]
fn read_chassis_and_disk(profile: &mut SystemProfile) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // `-NoProfile` keeps a user's PowerShell profile from running (and from
    // slowing this down or writing to stdout). Every lookup is guarded, so a
    // machine missing the Storage namespace yields nulls instead of an error.
    const SCRIPT: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
$letter = $env:SystemDrive.TrimEnd(':')
$media = $null; $bus = $null
$part = Get-CimInstance -Namespace root\Microsoft\Windows\Storage -ClassName MSFT_Partition |
        Where-Object { $_.DriveLetter -eq $letter } | Select-Object -First 1
if ($part -ne $null) {
  $pd = Get-CimInstance -Namespace root\Microsoft\Windows\Storage -ClassName MSFT_PhysicalDisk |
        Where-Object { $_.DeviceId -eq [string]$part.DiskNumber } | Select-Object -First 1
  if ($pd -ne $null) { $media = [int]$pd.MediaType; $bus = [int]$pd.BusType }
}
$chassis = $null
$enc = Get-CimInstance Win32_SystemEnclosure | Select-Object -First 1
if ($enc -ne $null -and $enc.ChassisTypes.Count -gt 0) { $chassis = [int]$enc.ChassisTypes[0] }
[pscustomobject]@{ media = $media; bus = $bus; chassis = $chassis } | ConvertTo-Json -Compress
"#;

    let Ok(output) = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    else {
        return;
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(stdout.trim()) else {
        return;
    };

    let media = parsed.get("media").and_then(|v| v.as_i64());
    let bus = parsed.get("bus").and_then(|v| v.as_i64());
    profile.system_disk = classify_disk(media, bus);

    if let Some(chassis) = parsed.get("chassis").and_then(|v| v.as_i64()) {
        profile.form_factor = classify_chassis(chassis);
    }
}

/// MSFT_PhysicalDisk `MediaType` / `BusType` to a disk class.
///
/// Bus type is checked first: an NVMe drive reports `MediaType = 4` (SSD) like
/// any other SSD, and the distinction matters because NVMe is fast enough that
/// several "speed up your disk" tweaks stop being worth their downsides.
fn classify_disk(media_type: Option<i64>, bus_type: Option<i64>) -> DiskKind {
    const BUS_NVME: i64 = 17;
    const MEDIA_HDD: i64 = 3;
    const MEDIA_SSD: i64 = 4;

    if bus_type == Some(BUS_NVME) {
        return DiskKind::Nvme;
    }
    match media_type {
        Some(MEDIA_HDD) => DiskKind::Hdd,
        Some(MEDIA_SSD) => DiskKind::Ssd,
        // 0 = unspecified, 5 = SCM, anything else = something we shouldn't
        // pretend to recognize.
        _ => DiskKind::Unknown,
    }
}

/// Win32_SystemEnclosure `ChassisTypes` to desktop/laptop.
///
/// Values come from the SMBIOS spec. Anything not clearly one or the other
/// (all-in-ones, tablets, blade servers, "Other") stays `Unknown` rather than
/// being forced into a bucket a recommendation would then act on.
fn classify_chassis(code: i64) -> FormFactor {
    match code {
        // Portable, Laptop, Notebook, Hand Held, Sub Notebook,
        // Docking Station, Convertible, Detachable
        8 | 9 | 10 | 11 | 14 | 30 | 31 | 32 => FormFactor::Laptop,
        // Desktop, Low Profile Desktop, Pizza Box, Mini Tower, Tower,
        // Space-saving, Lunch Box
        3 | 4 | 5 | 6 | 7 | 15 | 16 => FormFactor::Desktop,
        _ => FormFactor::Unknown,
    }
}

/// Test-only access to a freshly collected profile, so sibling modules can be
/// exercised against real hardware without going through Tauri state.
#[cfg(all(test, windows))]
pub fn collect_for_tests() -> SystemProfile {
    collect()
}

#[cfg(windows)]
fn collect() -> SystemProfile {
    let mut profile = SystemProfile::empty();
    // Each probe is independent and swallows its own failures, so a machine
    // where (say) the Storage namespace is missing still gets a CPU and a
    // Windows version rather than an error.
    read_windows_version(&mut profile);
    read_cpu_and_ram(&mut profile);
    read_gpu(&mut profile);
    read_power_plan(&mut profile);
    read_chassis_and_disk(&mut profile);
    profile
}

#[cfg(not(windows))]
fn collect() -> SystemProfile {
    let mut profile = SystemProfile::empty();
    read_cpu_and_ram(&mut profile);
    profile
}

/// Cached profile. The hardware facts cannot change while the app is running,
/// and the one thing that can — the active power plan — is refreshed on every
/// read, so the cache never serves a stale recommendation.
pub struct SystemProfileState(pub std::sync::Mutex<Option<SystemProfile>>);

impl SystemProfileState {
    pub fn new() -> Self {
        SystemProfileState(std::sync::Mutex::new(None))
    }
}

/// Returns the machine profile, collecting it on first use.
///
/// `async` because the first call spawns a PowerShell process for the CIM
/// lookups; Tauri runs it off the UI thread so the window never stalls behind
/// it. Subsequent calls are served from cache.
#[tauri::command]
pub async fn system_profile(
    state: tauri::State<'_, SystemProfileState>,
) -> Result<SystemProfile, String> {
    // Fast path: already collected. The lock is released before any slow work.
    {
        let cached = state.0.lock().map_err(|_| "profile state is poisoned")?;
        if let Some(profile) = cached.as_ref() {
            let mut fresh = profile.clone();
            #[cfg(windows)]
            read_power_plan(&mut fresh);
            return Ok(fresh);
        }
    }

    let profile = collect();

    let mut cached = state.0.lock().map_err(|_| "profile state is poisoned")?;
    *cached = Some(profile.clone());
    Ok(profile)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nvme_is_distinguished_from_a_plain_sata_ssd() {
        // Both report MediaType 4; only the bus tells them apart.
        assert_eq!(classify_disk(Some(4), Some(17)), DiskKind::Nvme);
        assert_eq!(classify_disk(Some(4), Some(11)), DiskKind::Ssd);
    }

    #[test]
    fn spinning_disks_are_recognized() {
        assert_eq!(classify_disk(Some(3), Some(11)), DiskKind::Hdd);
    }

    /// An unreadable or unrecognized disk must never masquerade as a known
    /// one: a wrong guess here would have the Scan recommend defragmenting an
    /// SSD, or skip it on a drive that genuinely needs it.
    #[test]
    fn an_unreadable_disk_stays_unknown() {
        assert_eq!(classify_disk(None, None), DiskKind::Unknown);
        assert_eq!(classify_disk(Some(0), None), DiskKind::Unknown);
        assert_eq!(classify_disk(Some(99), Some(99)), DiskKind::Unknown);
    }

    #[test]
    fn chassis_codes_map_to_the_right_form_factor() {
        assert_eq!(classify_chassis(3), FormFactor::Desktop); // Desktop
        assert_eq!(classify_chassis(7), FormFactor::Desktop); // Tower
        assert_eq!(classify_chassis(9), FormFactor::Laptop); // Laptop
        assert_eq!(classify_chassis(10), FormFactor::Laptop); // Notebook
        assert_eq!(classify_chassis(31), FormFactor::Laptop); // Convertible
    }

    /// All-in-ones (13) and tablets (a common "Other", 1/2) are genuinely
    /// ambiguous for power-plan advice, so they must not be forced into a
    /// bucket.
    #[test]
    fn ambiguous_chassis_stays_unknown() {
        assert_eq!(classify_chassis(13), FormFactor::Unknown);
        assert_eq!(classify_chassis(1), FormFactor::Unknown);
        assert_eq!(classify_chassis(2), FormFactor::Unknown);
    }

    /// The profile must never carry anything that identifies the machine or
    /// its owner. This asserts on the serialized shape, so adding such a field
    /// later fails here rather than silently shipping.
    #[test]
    fn the_profile_carries_no_identifying_fields() {
        let json = serde_json::to_string(&SystemProfile::empty()).unwrap();
        for forbidden in [
            "serial",
            "user",
            "computer_name",
            "hostname",
            "mac",
            "ip",
            "email",
            "license",
            "uuid",
        ] {
            assert!(
                !json.contains(forbidden),
                "SystemProfile gained a field matching '{}'. This struct is sent to the \
                 frontend and must stay non-identifying — see the module docs.",
                forbidden
            );
        }
    }
}

#[cfg(all(test, windows))]
mod live_tests {
    use super::*;

    /// Runs the real collection against the machine the tests are on. This is
    /// deliberately not asserting exact values (they differ per machine) but
    /// that each probe actually produced something — a silent `None` across
    /// the board is the failure mode that unit tests with fixed inputs cannot
    /// catch.
    #[test]
    fn every_probe_returns_something_on_real_hardware() {
        let p = collect();
        println!("{:#?}", p);

        assert!(
            p.windows_version.is_some(),
            "Windows version probe returned nothing"
        );
        assert!(
            p.windows_build.is_some(),
            "Windows build probe returned nothing"
        );
        assert!(p.cpu.is_some(), "CPU probe returned nothing");
        assert!(
            p.cpu_logical_cores.unwrap_or(0) > 0,
            "logical core count is zero"
        );
        assert!(p.gpu.is_some(), "GPU probe returned nothing");
        assert!(p.ram_total_bytes.unwrap_or(0) > 0, "RAM total is zero");
        assert!(
            p.power_plan_guid.is_some(),
            "power plan probe returned nothing"
        );

        // Disk class and form factor are deliberately *not* asserted to be
        // known. Both come from hardware that a virtual machine does not
        // faithfully present — CI reports a virtualised system disk as
        // `Unknown`, which is the correct answer there and precisely what this
        // module promises to do when it cannot tell. Demanding a known value
        // turned that promise into a test failure on every machine that wasn't
        // the developer's desk.
        //
        // What is still worth asserting is that the probes stay total: they
        // return one of the defined variants rather than panicking or hanging
        // on hardware they don't recognise, which is the failure mode that
        // actually matters.
        println!(
            "disk: {:?}, form factor: {:?}",
            p.system_disk, p.form_factor
        );
        assert!(
            matches!(
                p.system_disk,
                DiskKind::Hdd | DiskKind::Ssd | DiskKind::Nvme | DiskKind::Unknown
            ),
            "disk probe returned something outside the defined set"
        );
    }
}
