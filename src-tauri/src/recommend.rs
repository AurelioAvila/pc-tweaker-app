//! Turns "is this tweak applied?" into "is this tweak worth applying *here*?".
//!
//! The Scan used to list every unapplied tweak as something to fix. That is
//! the same move the snake-oil cleaners make — inflate a number, let the user
//! assume it means something — and it is actively wrong on some machines:
//! High performance on a laptop costs battery for little gain, and disabling
//! the search index on an NVMe drive trades away Start-menu search for a
//! saving that disk is fast enough to make irrelevant.
//!
//! ## Rules earn their place
//!
//! Every rule below has to be defensible from the hardware alone. Where the
//! honest answer is "it depends on what the user values", the verdict is
//! `Neutral` and the tweak stays available without a recommendation attached —
//! a confident-sounding verdict we can't justify would be worse than none.
//!
//! `reason_key` is a translation key, not a sentence: the UI renders it
//! through the same dictionary as everything else, so advice is localized
//! rather than being the one English string in an Italian window.

use crate::systemprofile::{DiskKind, FormFactor, SystemProfile};
use serde::Serialize;

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Verdict {
    /// Worth applying on this machine.
    Recommended,
    /// Would cost more than it gives here. Never auto-selected by the Scan.
    NotRecommended,
    /// Legitimate either way — a preference, not a performance question.
    Neutral,
    /// The hardware or OS cannot do this at all.
    Unsupported,
}

#[derive(Serialize, Clone, Debug)]
pub struct TweakAdvice {
    pub id: String,
    pub verdict: Verdict,
    /// Translation key explaining the verdict, or `None` when it needs none.
    pub reason_key: Option<String>,
}

/// Windows 10 2004 (build 19041) is where Hardware-accelerated GPU scheduling
/// first shipped. Below that the registry value exists but does nothing.
const HAGS_MIN_BUILD: u32 = 19041;

/// Below this, freeing memory is a real win; above it, Windows' own cache
/// management is a better user of the RAM than an aggressive cleaner is.
const LOW_RAM_BYTES: u64 = 8 * 1024 * 1024 * 1024;

fn build_number(profile: &SystemProfile) -> Option<u32> {
    profile
        .windows_build
        .as_deref()
        .and_then(|b| b.split('.').next())
        .and_then(|b| b.parse::<u32>().ok())
}

/// The verdict for a single tweak on a single machine.
///
/// Unknown hardware always lands on `Neutral`: an `Unknown` disk or form
/// factor means the probe failed, and failing to detect something is not
/// evidence about it.
pub fn advise(id: &str, profile: &SystemProfile) -> TweakAdvice {
    let (verdict, reason_key) = match id {
        // High performance pins the CPU's minimum state up and disables most
        // idle savings. On a desktop that is free; on a laptop it is paid for
        // in battery life and fan noise every minute the machine is on.
        "power_plan_performance" => match profile.form_factor {
            FormFactor::Laptop => (Verdict::NotRecommended, Some("laptop_battery")),
            FormFactor::Desktop => (Verdict::Recommended, None),
            FormFactor::Unknown => (Verdict::Neutral, None),
        },

        // Same trade, more sharply: power throttling exists specifically to
        // save battery on background work.
        "disable_power_throttling" => match profile.form_factor {
            FormFactor::Laptop => (Verdict::NotRecommended, Some("laptop_battery")),
            FormFactor::Desktop => (Verdict::Recommended, None),
            FormFactor::Unknown => (Verdict::Neutral, None),
        },

        // Turning off the index costs Start-menu file search. On a spinning
        // disk that background I/O is genuinely felt, so the trade is worth
        // offering; on NVMe it is noise, and the user just loses search.
        "disable_windows_search_service" => match profile.system_disk {
            DiskKind::Hdd => (Verdict::Recommended, Some("hdd_index_cost")),
            DiskKind::Nvme => (Verdict::NotRecommended, Some("fast_disk_no_gain")),
            DiskKind::Ssd => (Verdict::Neutral, None),
            DiskKind::Unknown => (Verdict::Neutral, None),
        },

        // Needs an OS new enough to have the feature at all.
        "hardware_gpu_scheduling" => match build_number(profile) {
            Some(b) if b < HAGS_MIN_BUILD => (Verdict::Unsupported, Some("needs_win10_2004")),
            Some(_) => (Verdict::Recommended, None),
            None => (Verdict::Neutral, None),
        },

        // Compositor transparency costs GPU time that a weak or integrated
        // adapter would rather spend on the game. With plenty of dedicated
        // VRAM it is not a performance question at all, just taste.
        "disable_transparency" => {
            if has_weak_gpu(profile) {
                (Verdict::Recommended, Some("weak_gpu"))
            } else {
                (Verdict::Neutral, None)
            }
        }

        // Universally a straight win: it is a deliberate delay with nothing
        // behind it but staggering startup I/O, which an SSD does not need.
        "disable_startup_delay" => match profile.system_disk {
            DiskKind::Ssd | DiskKind::Nvme => (Verdict::Recommended, None),
            _ => (Verdict::Neutral, None),
        },

        // Everything else: no hardware-derived opinion. Deliberately not a
        // catch-all "Recommended" — see the module docs.
        _ => (Verdict::Neutral, None),
    };

    TweakAdvice {
        id: id.to_string(),
        verdict,
        reason_key: reason_key.map(|k| k.to_string()),
    }
}

/// True when the machine's best adapter is integrated graphics or has little
/// dedicated memory.
///
/// Deliberately name-based and deliberately conservative: `SystemProfile`
/// already picks the adapter with the most VRAM, so by the time a name like
/// "Intel UHD" or "Radeon(TM) Graphics" wins, there is no discrete GPU to find.
fn has_weak_gpu(profile: &SystemProfile) -> bool {
    let Some(gpu) = profile.gpu.as_deref() else {
        return false;
    };
    let gpu = gpu.to_ascii_lowercase();
    const INTEGRATED_MARKERS: [&str; 5] = [
        "uhd graphics",
        "hd graphics",
        "iris",
        "vega",
        "radeon(tm) graphics",
    ];
    INTEGRATED_MARKERS.iter().any(|m| gpu.contains(m))
}

/// True when this machine has little enough RAM for freeing it to matter.
pub fn ram_is_tight(profile: &SystemProfile) -> bool {
    profile.ram_total_bytes.is_some_and(|r| r <= LOW_RAM_BYTES)
}

/// The tweaks a *performance* scan is allowed to raise.
///
/// This is an explicit allowlist, not a filter over categories, because the
/// question "does this make the machine measurably faster or healthier?" does
/// not line up with which section a tweak is filed under. The previous rule —
/// everything except the UI category — let the Scan report a left-aligned
/// taskbar and a disabled Cortana as "optimizations available", which is
/// exactly the padded issue count this product exists to argue against.
///
/// A tweak earns a place here only if it changes scheduling, background CPU
/// and memory use, disk or network behaviour, or reclaims disk space. Things
/// deliberately left out, and why:
///
/// - Appearance and Explorer preferences (`dark_mode`, `show_hidden_files`,
///   `taskbar_*`, `show_file_extensions`, `disable_transparency`): taste, not
///   speed. `disable_transparency` does cost a weak GPU something, so it stays
///   available and advised in its own section — it just isn't a "problem".
/// - Privacy toggles (`reset_advertising_id`, `disable_telemetry_tasks`,
///   `disable_location_tracking`, `disable_bing_search`, `disable_cortana`,
///   activity history, tailored experiences, feedback): worth doing, and the
///   Privacy section is where a user goes to decide that. Counting them as
///   performance findings would be dishonest about what the number means.
/// - `disable_game_dvr`: genuinely costs CPU/GPU while recording, but it is a
///   gaming preference the user opted into, so it lives in Gaming rather than
///   being flagged as a fault on every machine.
pub fn is_scan_relevant(id: &str) -> bool {
    matches!(
        id,
        // CPU scheduling and foreground responsiveness
        "priority_separation"
            | "system_responsiveness"
            | "disable_power_throttling"
            | "power_plan_performance"
            // Startup and background load
            | "disable_startup_delay"
            | "disable_background_apps"
            // Disk
            | "disable_windows_search_service"
            | "disable_delivery_optimization"
            // Network latency and throughput
            | "network_throttling_index"
            | "network_latency"
            // GPU scheduling
            | "hardware_gpu_scheduling"
    )
}

/// Advice for every id the caller asks about, in the same order.
#[tauri::command]
pub async fn advise_tweaks(
    ids: Vec<String>,
    state: tauri::State<'_, crate::systemprofile::SystemProfileState>,
) -> Result<Vec<TweakAdvice>, String> {
    let profile = crate::systemprofile::system_profile(state).await?;
    Ok(ids.iter().map(|id| advise(id, &profile)).collect())
}

/// The ids a performance scan may report. The UI asks rather than keeping its
/// own copy, so the curation lives in one place next to the reasoning.
#[tauri::command]
pub fn scan_relevant_ids() -> Vec<String> {
    let mut ids: Vec<String> = crate::tweaks::all_tweaks()
        .iter()
        .map(|t| t.id.to_string())
        .filter(|id| is_scan_relevant(id))
        .collect();
    // The non-registry tweaks live outside `all_tweaks`, so add the ones the
    // allowlist names explicitly.
    for id in [
        crate::power::TWEAK_ID,
        crate::netlatency::TWEAK_ID,
        crate::services::WINDOWS_SEARCH_ID,
    ] {
        if is_scan_relevant(id) {
            ids.push(id.to_string());
        }
    }
    ids
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::systemprofile::SystemProfile;

    fn profile() -> SystemProfile {
        SystemProfile {
            windows_version: Some("Windows 11 24H2".into()),
            windows_build: Some("26100.1742".into()),
            cpu: Some("Test CPU".into()),
            cpu_physical_cores: Some(8),
            cpu_logical_cores: Some(16),
            gpu: Some("NVIDIA GeForce RTX 4070".into()),
            ram_total_bytes: Some(32 * 1024 * 1024 * 1024),
            system_disk: DiskKind::Nvme,
            form_factor: FormFactor::Desktop,
            power_plan_guid: Some("381b4222-f694-41f0-9685-ff5bb260df2e".into()),
            power_plan: Some("Balanced".into()),
        }
    }

    #[test]
    fn high_performance_is_advised_against_on_a_laptop() {
        let mut p = profile();
        p.form_factor = FormFactor::Laptop;
        let a = advise("power_plan_performance", &p);
        assert_eq!(a.verdict, Verdict::NotRecommended);
        assert_eq!(a.reason_key.as_deref(), Some("laptop_battery"));

        p.form_factor = FormFactor::Desktop;
        assert_eq!(
            advise("power_plan_performance", &p).verdict,
            Verdict::Recommended
        );
    }

    /// The whole point of the feature: the same tweak gets opposite verdicts
    /// on a spinning disk and on NVMe.
    #[test]
    fn disabling_the_index_depends_on_the_disk() {
        let mut p = profile();
        p.system_disk = DiskKind::Hdd;
        assert_eq!(
            advise("disable_windows_search_service", &p).verdict,
            Verdict::Recommended
        );

        p.system_disk = DiskKind::Nvme;
        assert_eq!(
            advise("disable_windows_search_service", &p).verdict,
            Verdict::NotRecommended
        );
    }

    #[test]
    fn gpu_scheduling_is_unsupported_before_windows_10_2004() {
        let mut p = profile();
        p.windows_build = Some("18363.1500".into());
        let a = advise("hardware_gpu_scheduling", &p);
        assert_eq!(a.verdict, Verdict::Unsupported);
        assert_eq!(a.reason_key.as_deref(), Some("needs_win10_2004"));
    }

    /// A failed probe must never be read as evidence. This is what keeps the
    /// Scan from confidently advising against something on a machine it simply
    /// could not measure.
    #[test]
    fn unknown_hardware_yields_no_opinion() {
        let mut p = profile();
        p.form_factor = FormFactor::Unknown;
        p.system_disk = DiskKind::Unknown;
        p.windows_build = None;

        for id in [
            "power_plan_performance",
            "disable_power_throttling",
            "disable_windows_search_service",
            "hardware_gpu_scheduling",
            "disable_startup_delay",
        ] {
            assert_eq!(
                advise(id, &p).verdict,
                Verdict::Neutral,
                "{} claimed an opinion it cannot support",
                id
            );
        }
    }

    #[test]
    fn integrated_graphics_make_transparency_worth_turning_off() {
        let mut p = profile();
        p.gpu = Some("Intel(R) UHD Graphics 630".into());
        assert_eq!(
            advise("disable_transparency", &p).verdict,
            Verdict::Recommended
        );

        p.gpu = Some("NVIDIA GeForce RTX 4070".into());
        assert_eq!(advise("disable_transparency", &p).verdict, Verdict::Neutral);
    }

    #[test]
    fn tweaks_without_a_hardware_rule_stay_neutral() {
        let p = profile();
        assert_eq!(advise("dark_mode", &p).verdict, Verdict::Neutral);
        assert_eq!(advise("show_hidden_files", &p).verdict, Verdict::Neutral);
    }

    #[test]
    fn ram_pressure_is_measured_not_assumed() {
        let mut p = profile();
        assert!(!ram_is_tight(&p), "32 GB should not read as tight");

        p.ram_total_bytes = Some(8 * 1024 * 1024 * 1024);
        assert!(ram_is_tight(&p));

        p.ram_total_bytes = None;
        assert!(
            !ram_is_tight(&p),
            "an unknown RAM size must not be treated as low"
        );
    }
}

#[cfg(all(test, windows))]
mod live_tests {
    use super::*;

    /// End-to-end against this machine's real profile, so the wiring between
    /// the two modules is exercised rather than only the rule table.
    #[test]
    fn advice_on_real_hardware_matches_what_the_machine_is() {
        let profile = crate::systemprofile::collect_for_tests();

        for id in [
            "power_plan_performance",
            "disable_windows_search_service",
            "hardware_gpu_scheduling",
            "disable_transparency",
        ] {
            let a = advise(id, &profile);
            println!("{:<28} -> {:?} ({:?})", id, a.verdict, a.reason_key);
        }

        // Each assertion is conditional on the probe it depends on having
        // produced a value.
        //
        // The originals hard-coded this dev machine — a desktop, NVMe, discrete
        // GPU — so they failed everywhere else, including CI, where a
        // virtualised disk reports `Unknown`. That is not a defect: reporting
        // `unknown` instead of guessing is what these probes are *supposed* to
        // do, so a test demanding a known value asserted something about the
        // environment rather than about the rules. Gating on the input keeps
        // the rules fully checked wherever the hardware is legible and stays
        // silent where it genuinely isn't.
        if profile.form_factor == crate::systemprofile::FormFactor::Desktop {
            assert_eq!(
                advise("power_plan_performance", &profile).verdict,
                Verdict::Recommended,
                "desktop should be advised to use High performance"
            );
        }
        if profile.system_disk == crate::systemprofile::DiskKind::Nvme {
            assert_eq!(
                advise("disable_windows_search_service", &profile).verdict,
                Verdict::NotRecommended,
                "NVMe should not be advised to give up search indexing"
            );
        }
        if !has_weak_gpu(&profile) {
            assert_eq!(
                advise("disable_transparency", &profile).verdict,
                Verdict::Neutral,
                "a discrete GPU makes transparency a preference, not a fix"
            );
        }
    }
}

#[cfg(test)]
mod scan_scope_tests {
    use super::*;

    /// The Scan must not report taste as a fault. These are the exact items
    /// the maintainer flagged as "not pertinent to a scan" — a regression here
    /// means the issue count has started padding itself again.
    #[test]
    fn appearance_and_privacy_toggles_are_not_scan_findings() {
        for id in [
            "dark_mode",
            "show_hidden_files",
            "taskbar_align_left",
            "hide_taskbar_chat",
            "hide_taskbar_search",
            "hide_taskbar_widgets",
            "show_file_extensions",
            "disable_transparency",
            "disable_window_animations",
            "disable_drag_full_windows",
            "disable_cortana",
            "disable_bing_search",
            "reset_advertising_id",
            "disable_telemetry_tasks",
            "disable_location_tracking",
            "disable_activity_history",
            "disable_tailored_experiences",
            "disable_feedback_requests",
            "disable_game_dvr",
        ] {
            assert!(!is_scan_relevant(id), "{} should not be a scan finding", id);
        }
    }

    /// ...and it must still raise the things that genuinely move the needle.
    #[test]
    fn real_performance_work_is_still_reported() {
        for id in [
            "priority_separation",
            "system_responsiveness",
            "disable_power_throttling",
            "power_plan_performance",
            "disable_startup_delay",
            "disable_background_apps",
            "disable_windows_search_service",
            "disable_delivery_optimization",
            "network_throttling_index",
            "network_latency",
            "hardware_gpu_scheduling",
        ] {
            assert!(is_scan_relevant(id), "{} should be a scan finding", id);
        }
    }

    /// Every allowlisted id must actually exist, or the Scan would silently
    /// look for a tweak that was renamed or removed.
    #[test]
    fn every_scan_id_resolves_to_a_real_tweak() {
        let ids = scan_relevant_ids();
        assert!(!ids.is_empty(), "the scan allowlist resolved to nothing");
        for id in &ids {
            let known = crate::tweaks::find_tweak(id).is_some()
                || matches!(
                    id.as_str(),
                    "power_plan_performance" | "network_latency" | "disable_windows_search_service"
                );
            assert!(known, "scan lists '{}', which no longer exists", id);
        }
    }
}
