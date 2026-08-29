//! PC Health Score — explainable, reproducible, category-separated.
//!
//! Design contract (set by the product owner, enforced here):
//! - every point traces to a FACT the app can show ("12 startup apps",
//!   "power plan: Balanced", "system disk 8% free") — never a magic number;
//! - the same machine state always produces the same score (pure function
//!   over `HealthInputs`, unit-tested on any platform);
//! - a category with no readable evidence reports what it could not read
//!   instead of guessing.
//!
//! Scoring model: each category is a list of factors. A factor has `earned`
//! and `max` points plus an `evidence` sentence. The category score is
//! earned/max scaled to 0-100; the overall is the mean of category scores.
//! Nothing is weighted in secret: the factor list IS the explanation the
//! "Why 84?" view renders.

use serde::Serialize;
use std::collections::HashSet;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HealthFactor {
    pub id: &'static str,
    /// English sentence fragment; the UI translates known ids and falls back
    /// to this text, same convention as tweak names.
    pub label: &'static str,
    pub earned: u32,
    pub max: u32,
    /// The concrete fact this factor was scored from.
    pub evidence: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HealthCategory {
    pub id: &'static str,
    pub score: u32,
    pub factors: Vec<HealthFactor>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HealthReport {
    pub overall: u32,
    pub categories: Vec<HealthCategory>,
}

/// Everything the scorer consumes. Each field is optional or defaulted so a
/// failed probe degrades one factor's evidence, never the whole report.
#[derive(Default, Clone, Debug)]
pub struct HealthInputs {
    pub disk_kind: Option<&'static str>, // "nvme" | "ssd" | "hdd"
    pub is_laptop: Option<bool>,
    pub ram_total_gb: Option<f64>,
    pub power_plan: Option<String>,
    pub free_disk_pct: Option<f64>,
    pub memory_used_pct: Option<f64>,
    pub startup_enabled: Option<usize>,
    /// Tweak ids currently APPLIED on this machine.
    pub applied: HashSet<String>,
    pub defender_realtime: Option<bool>,
    pub uac_enabled: Option<bool>,
    pub smartscreen_enabled: Option<bool>,
    pub restore_points_enabled: Option<bool>,
    pub uptime_days: Option<f64>,
}

fn factor(
    id: &'static str,
    label: &'static str,
    earned: u32,
    max: u32,
    evidence: String,
) -> HealthFactor {
    HealthFactor {
        id,
        label,
        earned: earned.min(max),
        max,
        evidence,
    }
}

fn applied_factor(
    inputs: &HealthInputs,
    id: &'static str,
    label: &'static str,
    tweak: &str,
    points: u32,
) -> HealthFactor {
    let on = inputs.applied.contains(tweak);
    factor(
        id,
        label,
        if on { points } else { 0 },
        points,
        if on {
            "applied".into()
        } else {
            "not applied".into()
        },
    )
}

fn category(id: &'static str, factors: Vec<HealthFactor>) -> HealthCategory {
    let max: u32 = factors.iter().map(|f| f.max).sum();
    let earned: u32 = factors.iter().map(|f| f.earned).sum();
    let score = (earned * 100 + max / 2).checked_div(max).unwrap_or(0);
    HealthCategory { id, score, factors }
}

pub fn score(inputs: &HealthInputs) -> HealthReport {
    let mut categories = Vec::new();

    // ---- Performance ------------------------------------------------------
    {
        // Exact canonical names from systemprofile::plan_name — matching
        // anything looser would silently mis-score OEM plans.
        let plan_name = inputs.power_plan.as_deref();
        let (plan_pts, plan_ev) = match (plan_name, inputs.is_laptop) {
            (Some(p @ ("High performance" | "Ultimate performance")), _) => (30, p.to_string()),
            (Some(p @ "Balanced"), Some(true)) => (
                24,
                format!("{p} — a fair choice on battery-powered hardware"),
            ),
            (Some(p @ "Balanced"), _) => (
                18,
                format!("{p} — High performance unlocks more on a desktop"),
            ),
            (Some(p @ "Power saver"), _) => (5, format!("{p} — actively limits performance")),
            (Some(p), _) => (15, format!("{p} (custom plan — unrated)")),
            (None, _) => (15, "custom or unknown power plan — unrated".into()),
        };
        categories.push(category(
            "performance",
            vec![
                factor(
                    "perf_power_plan",
                    "Power plan favors performance",
                    plan_pts,
                    30,
                    plan_ev,
                ),
                applied_factor(
                    inputs,
                    "perf_responsiveness",
                    "Multimedia scheduler tuned",
                    "system_responsiveness",
                    20,
                ),
                applied_factor(
                    inputs,
                    "perf_throttling",
                    "Power throttling disabled",
                    "disable_power_throttling",
                    20,
                ),
                applied_factor(
                    inputs,
                    "perf_priority",
                    "Foreground priority tuned",
                    "priority_separation",
                    15,
                ),
                applied_factor(
                    inputs,
                    "perf_bg_apps",
                    "Background apps limited",
                    "disable_background_apps",
                    15,
                ),
            ],
        ));
    }

    // ---- Gaming ------------------------------------------------------------
    {
        categories.push(category(
            "gaming",
            vec![
                applied_factor(
                    inputs,
                    "gaming_gpu_sched",
                    "Hardware GPU scheduling on",
                    "hardware_gpu_scheduling",
                    30,
                ),
                applied_factor(
                    inputs,
                    "gaming_dvr",
                    "Game DVR overhead removed",
                    "disable_game_dvr",
                    25,
                ),
                applied_factor(
                    inputs,
                    "gaming_gpu_prio",
                    "Games get GPU priority",
                    "games_gpu_priority",
                    20,
                ),
                applied_factor(
                    inputs,
                    "gaming_net",
                    "Network throttling relaxed",
                    "network_throttling_index",
                    15,
                ),
                applied_factor(
                    inputs,
                    "gaming_fso",
                    "Fullscreen optimizations tamed",
                    "disable_fullscreen_optimizations_global",
                    10,
                ),
            ],
        ));
    }

    // ---- Responsiveness ----------------------------------------------------
    {
        let (up_pts, up_ev) = match inputs.uptime_days {
            Some(d) if d <= 7.0 => (20, format!("uptime {d:.1} days")),
            Some(d) if d <= 21.0 => (
                10,
                format!("uptime {d:.1} days — a restart refreshes memory and updates"),
            ),
            Some(d) => (0, format!("uptime {d:.1} days — restart recommended")),
            None => (10, "uptime unknown".into()),
        };
        categories.push(category(
            "responsiveness",
            vec![
                applied_factor(
                    inputs,
                    "resp_menu_delay",
                    "Menu delay minimized",
                    "menu_show_delay",
                    25,
                ),
                applied_factor(
                    inputs,
                    "resp_hover",
                    "Hover delay minimized",
                    "mouse_hover_delay",
                    15,
                ),
                applied_factor(
                    inputs,
                    "resp_startup_delay",
                    "Startup app delay removed",
                    "disable_startup_delay",
                    20,
                ),
                applied_factor(
                    inputs,
                    "resp_animations",
                    "Window animations trimmed",
                    "disable_window_animations",
                    20,
                ),
                factor("resp_uptime", "Recently restarted", up_pts, 20, up_ev),
            ],
        ));
    }

    // ---- Memory ------------------------------------------------------------
    {
        let (ram_pts, ram_ev) = match inputs.ram_total_gb {
            Some(gb) if gb >= 31.0 => (40, format!("{gb:.0} GB installed")),
            Some(gb) if gb >= 15.0 => (32, format!("{gb:.0} GB installed")),
            Some(gb) if gb >= 7.0 => (
                20,
                format!("{gb:.0} GB installed — 16 GB is today's comfortable floor"),
            ),
            Some(gb) => (
                8,
                format!("{gb:.0} GB installed — upgrading RAM would help more than any tweak"),
            ),
            None => (20, "RAM size unknown".into()),
        };
        let (use_pts, use_ev) = match inputs.memory_used_pct {
            Some(p) if p < 60.0 => (40, format!("{p:.0}% in use right now")),
            Some(p) if p < 80.0 => (25, format!("{p:.0}% in use right now")),
            Some(p) => (
                10,
                format!("{p:.0}% in use right now — close heavy apps or add RAM"),
            ),
            None => (20, "current usage unknown".into()),
        };
        categories.push(category(
            "memory",
            vec![
                factor("mem_installed", "Installed RAM", ram_pts, 40, ram_ev),
                factor(
                    "mem_pressure",
                    "Current memory pressure",
                    use_pts,
                    40,
                    use_ev,
                ),
                applied_factor(
                    inputs,
                    "mem_bg_apps",
                    "Background apps limited",
                    "disable_background_apps",
                    20,
                ),
            ],
        ));
    }

    // ---- Storage -----------------------------------------------------------
    {
        let (kind_pts, kind_ev) = match inputs.disk_kind {
            Some("nvme") => (40, "system disk: NVMe".into()),
            Some("ssd") => (35, "system disk: SSD".into()),
            Some("hdd") => (
                10,
                "system disk: spinning HDD — an SSD is the single biggest upgrade".into(),
            ),
            _ => (20, "system disk type unknown".into()),
        };
        let (free_pts, free_ev) = match inputs.free_disk_pct {
            Some(p) if p >= 25.0 => (60, format!("{p:.0}% free on the system disk")),
            Some(p) if p >= 10.0 => (35, format!("{p:.0}% free on the system disk")),
            Some(p) => (
                10,
                format!("{p:.0}% free — Windows slows down below 10% free"),
            ),
            None => (30, "free space unknown".into()),
        };
        categories.push(category(
            "storage",
            vec![
                factor("sto_kind", "System disk technology", kind_pts, 40, kind_ev),
                factor(
                    "sto_free",
                    "Free space on system disk",
                    free_pts,
                    60,
                    free_ev,
                ),
            ],
        ));
    }

    // ---- Startup -----------------------------------------------------------
    {
        let (pts, ev) = match inputs.startup_enabled {
            Some(n) if n <= 5 => (100, format!("{n} apps start with Windows")),
            Some(n) if n <= 10 => (70, format!("{n} apps start with Windows")),
            Some(n) if n <= 15 => (
                40,
                format!("{n} apps start with Windows — each one delays login"),
            ),
            Some(n) => (15, format!("{n} apps start with Windows — trim this list")),
            None => (50, "startup list unavailable".into()),
        };
        categories.push(category(
            "startup",
            vec![factor("start_count", "Startup app load", pts, 100, ev)],
        ));
    }

    // ---- Maintenance -------------------------------------------------------
    {
        let (rp_pts, rp_ev) = match inputs.restore_points_enabled {
            Some(true) => (50, "System Restore is on — changes stay reversible".into()),
            Some(false) => (0, "System Restore is off — nothing to roll back to".into()),
            None => (25, "System Restore state unknown".into()),
        };
        let (up_pts, up_ev) = match inputs.uptime_days {
            Some(d) if d <= 14.0 => (50, format!("last restart {d:.1} days ago")),
            Some(d) => (
                20,
                format!("last restart {d:.1} days ago — updates may be waiting"),
            ),
            None => (25, "uptime unknown".into()),
        };
        categories.push(category(
            "maintenance",
            vec![
                factor(
                    "maint_restore",
                    "System Restore available",
                    rp_pts,
                    50,
                    rp_ev,
                ),
                factor("maint_restart", "Restarted recently", up_pts, 50, up_ev),
            ],
        ));
    }

    // ---- Privacy -----------------------------------------------------------
    {
        categories.push(category(
            "privacy",
            vec![
                applied_factor(
                    inputs,
                    "priv_telemetry",
                    "Telemetry tasks disabled",
                    "disable_telemetry_tasks",
                    25,
                ),
                applied_factor(
                    inputs,
                    "priv_adid",
                    "Advertising ID reset",
                    "reset_advertising_id",
                    15,
                ),
                applied_factor(
                    inputs,
                    "priv_location",
                    "Location tracking off",
                    "disable_location_tracking",
                    15,
                ),
                applied_factor(
                    inputs,
                    "priv_tailored",
                    "Tailored experiences off",
                    "disable_tailored_experiences",
                    15,
                ),
                applied_factor(
                    inputs,
                    "priv_launch_track",
                    "App-launch tracking off",
                    "disable_app_launch_tracking",
                    15,
                ),
                applied_factor(
                    inputs,
                    "priv_recall",
                    "Windows Recall disabled",
                    "disable_recall",
                    15,
                ),
            ],
        ));
    }

    // ---- Security ----------------------------------------------------------
    {
        let (def_pts, def_ev) = match inputs.defender_realtime {
            Some(true) => (40, "Defender real-time protection is on".into()),
            Some(false) => (0, "Defender real-time protection is OFF".into()),
            None => (
                20,
                "Defender state unreadable (third-party AV may be active)".into(),
            ),
        };
        let (uac_pts, uac_ev) = match inputs.uac_enabled {
            Some(true) => (30, "UAC is on".into()),
            Some(false) => (0, "UAC is disabled — every app runs unchecked".into()),
            None => (15, "UAC state unknown".into()),
        };
        let (ss_pts, ss_ev) = match inputs.smartscreen_enabled {
            Some(true) => (30, "SmartScreen is on".into()),
            Some(false) => (5, "SmartScreen is off".into()),
            None => (15, "SmartScreen state unknown".into()),
        };
        categories.push(category(
            "security",
            vec![
                factor("sec_defender", "Real-time antivirus", def_pts, 40, def_ev),
                factor("sec_uac", "User Account Control", uac_pts, 30, uac_ev),
                factor("sec_smartscreen", "SmartScreen", ss_pts, 30, ss_ev),
            ],
        ));
    }

    let overall = if categories.is_empty() {
        0
    } else {
        (categories.iter().map(|c| c.score).sum::<u32>() + categories.len() as u32 / 2)
            / categories.len() as u32
    };
    HealthReport {
        overall,
        categories,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> HealthInputs {
        HealthInputs::default()
    }

    #[test]
    fn scoring_is_deterministic() {
        let inputs = base();
        let a = score(&inputs);
        let b = score(&inputs);
        assert_eq!(
            serde_json::to_string(&a).unwrap(),
            serde_json::to_string(&b).unwrap()
        );
    }

    #[test]
    fn every_factor_carries_evidence_and_valid_bounds() {
        let mut inputs = base();
        inputs.ram_total_gb = Some(16.0);
        inputs.free_disk_pct = Some(4.0);
        inputs.applied.insert("disable_game_dvr".into());
        let report = score(&inputs);
        for cat in &report.categories {
            assert!(cat.score <= 100, "{} out of range", cat.id);
            for f in &cat.factors {
                assert!(!f.evidence.is_empty(), "{} has no evidence", f.id);
                assert!(f.earned <= f.max, "{} earned > max", f.id);
            }
        }
    }

    #[test]
    fn better_facts_never_lower_a_category() {
        let mut worse = base();
        worse.free_disk_pct = Some(5.0);
        worse.disk_kind = Some("hdd");
        let mut better = worse.clone();
        better.free_disk_pct = Some(40.0);
        better.disk_kind = Some("nvme");
        let s_worse = score(&worse)
            .categories
            .iter()
            .find(|c| c.id == "storage")
            .unwrap()
            .score;
        let s_better = score(&better)
            .categories
            .iter()
            .find(|c| c.id == "storage")
            .unwrap()
            .score;
        assert!(s_better > s_worse);
    }

    #[test]
    fn applying_a_tweak_moves_exactly_its_category() {
        let inputs = base();
        let before = score(&inputs);
        let mut with = base();
        with.applied.insert("disable_telemetry_tasks".into());
        let after = score(&with);
        let cat =
            |r: &HealthReport, id: &str| r.categories.iter().find(|c| c.id == id).unwrap().score;
        assert!(cat(&after, "privacy") > cat(&before, "privacy"));
        assert_eq!(cat(&after, "gaming"), cat(&before, "gaming"));
        assert_eq!(cat(&after, "storage"), cat(&before, "storage"));
    }

    #[test]
    fn security_off_states_cost_real_points() {
        let mut inputs = base();
        inputs.defender_realtime = Some(false);
        inputs.uac_enabled = Some(false);
        let bad = score(&inputs)
            .categories
            .iter()
            .find(|c| c.id == "security")
            .unwrap()
            .score;
        let mut good = base();
        good.defender_realtime = Some(true);
        good.uac_enabled = Some(true);
        good.smartscreen_enabled = Some(true);
        let ok = score(&good)
            .categories
            .iter()
            .find(|c| c.id == "security")
            .unwrap()
            .score;
        assert!(ok >= 90 && bad <= 20, "ok={ok} bad={bad}");
    }

    #[test]
    fn unknown_probes_degrade_gracefully_not_to_zero() {
        let report = score(&base());
        for cat in &report.categories {
            // A machine we know nothing about is "unknown", not "broken":
            // pure-tweak categories may sit at 0, but probe-based ones must not.
            if ["memory", "storage", "security", "maintenance", "startup"].contains(&cat.id) {
                assert!(cat.score > 0, "{} collapsed to 0 on unknown inputs", cat.id);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Input gathering (Windows). Each probe fills its field or leaves it None —
// a failing probe degrades one factor's evidence, never the report.

#[cfg(windows)]
fn reg_values_equal(a: &crate::rollback::RegValue, b: &crate::rollback::RegValue) -> bool {
    use crate::rollback::RegValue;
    match (a, b) {
        (RegValue::Dword(x), RegValue::Dword(y)) => x == y,
        (RegValue::Str(x), RegValue::Str(y)) => x == y,
        _ => false,
    }
}

#[cfg(windows)]
fn applied_tweak_ids() -> HashSet<String> {
    crate::tweaks::all_tweaks()
        .into_iter()
        .filter(|t| matches!(t.read_current(), Ok(Some(ref v)) if reg_values_equal(v, &t.on_value)))
        .map(|t| t.id.to_string())
        .collect()
}

#[cfg(windows)]
fn read_dword(hive: winreg::HKEY, path: &str, name: &str) -> Option<u32> {
    use winreg::RegKey;
    RegKey::predef(hive)
        .open_subkey(path)
        .ok()?
        .get_value::<u32, _>(name)
        .ok()
}

#[cfg(windows)]
fn security_probes(inputs: &mut HealthInputs) {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    // Defender real-time: DisableRealtimeMonitoring=1 means OFF; the value
    // being absent is the healthy default. If Defender's key itself is
    // missing (third-party AV replaced it) we honestly report None.
    let defender_key = r"SOFTWARE\Microsoft\Windows Defender\Real-Time Protection";
    inputs.defender_realtime =
        match winreg::RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(defender_key) {
            Ok(key) => Some(
                key.get_value::<u32, _>("DisableRealtimeMonitoring")
                    .map(|v| v == 0)
                    .unwrap_or(true),
            ),
            Err(_) => None,
        };
    inputs.uac_enabled = read_dword(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System",
        "EnableLUA",
    )
    .map(|v| v == 1);
    // SmartScreen for apps/files: "Off" disables it; missing means default-on.
    inputs.smartscreen_enabled = winreg::RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer")
        .ok()
        .map(|k| {
            k.get_value::<String, _>("SmartScreenEnabled")
                .map(|v| v != "Off")
                .unwrap_or(true)
        });
    // System Restore: RPSessionInterval >= 1 when protection is on for the
    // system drive; the config key missing reads as unknown, not off.
    inputs.restore_points_enabled = read_dword(
        HKEY_LOCAL_MACHINE,
        r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore",
        "RPSessionInterval",
    )
    .map(|v| v >= 1);
}

/// A measurement plus its place in this machine's history: the report itself,
/// when it was taken, and — when there is anything to compare against — what
/// moved since the previous one and why.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HealthResult {
    pub report: HealthReport,
    /// Unix seconds.
    pub ts: u64,
    /// `None` on the very first measurement, when there is honestly nothing
    /// to compare against.
    pub comparison: Option<crate::healthhistory::HealthComparison>,
}

/// Collects every input and scores it. `async` command: the first call may
/// trigger the (cached) PowerShell-backed system profile.
#[cfg(windows)]
#[tauri::command(async)]
pub async fn health_report(
    app: tauri::AppHandle,
    profile_state: tauri::State<'_, crate::systemprofile::SystemProfileState>,
    sysmon_state: tauri::State<'_, crate::sysmon::SysMonState>,
) -> Result<HealthResult, String> {
    let mut inputs = HealthInputs::default();

    if let Ok(profile) = crate::systemprofile::system_profile(profile_state).await {
        inputs.disk_kind = match profile.system_disk {
            crate::systemprofile::DiskKind::Nvme => Some("nvme"),
            crate::systemprofile::DiskKind::Ssd => Some("ssd"),
            crate::systemprofile::DiskKind::Hdd => Some("hdd"),
            crate::systemprofile::DiskKind::Unknown => None,
        };
        inputs.is_laptop = match profile.form_factor {
            crate::systemprofile::FormFactor::Laptop => Some(true),
            crate::systemprofile::FormFactor::Desktop => Some(false),
            _ => None,
        };
        inputs.ram_total_gb = profile
            .ram_total_bytes
            .map(|b| b as f64 / (1024.0 * 1024.0 * 1024.0));
        // Canonical name only: a raw GUID as "evidence" would read as noise,
        // so custom/OEM plans surface through the explicit unrated branch.
        inputs.power_plan = profile.power_plan.clone();
    }

    if let Ok(stats) = crate::sysmon::system_stats(sysmon_state) {
        if stats.ram_total > 0 {
            inputs.memory_used_pct = Some(stats.ram_used as f64 * 100.0 / stats.ram_total as f64);
        }
        if stats.disk_total > 0 {
            inputs.free_disk_pct =
                Some((stats.disk_total - stats.disk_used) as f64 * 100.0 / stats.disk_total as f64);
        }
        inputs.uptime_days = Some(stats.uptime_secs as f64 / 86_400.0);
    }

    inputs.startup_enabled = Some(
        crate::startup::list_startup_items()
            .iter()
            .filter(|s| s.enabled)
            .count(),
    );
    inputs.applied = applied_tweak_ids();
    security_probes(&mut inputs);

    let report = score(&inputs);
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Compare against the previous measurement BEFORE storing this one,
    // otherwise the newest row would be compared against itself.
    let history = crate::healthhistory::read_history(&app);
    let snapshot = crate::healthhistory::HealthSnapshot::from_report(&report, ts);
    let comparison = history
        .last()
        .map(|prev| crate::healthhistory::compare(prev, &snapshot));

    // A history that can't be written costs the user the "why did it change?"
    // answer next time, but the measurement they asked for is still valid —
    // so this is reported to the log, never as a failed scan.
    if let Err(e) = crate::healthhistory::append(&app, &snapshot) {
        eprintln!("health history: could not record this measurement: {e}");
    }

    Ok(HealthResult {
        report,
        ts,
        comparison,
    })
}
