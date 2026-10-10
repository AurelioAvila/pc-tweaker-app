mod process_guard;
mod appcache;
mod update_identity;
mod audit;
mod avatar;
pub mod baseline;
mod browsercleanup;
mod cleanup;
mod contextmenu;
mod cookies;
mod debloat;
mod diagnostics {
    pub mod dpc;
    pub mod network_verify;
}
#[cfg(windows)]
mod everyday;
#[cfg(windows)]
mod download_limit;
mod ecoqos;
mod engine {
    pub mod dynamic_session;
}
mod monitor_profiles;
#[cfg(windows)]
mod system_tools;
mod tray;
// Public so examples/crashprobe.rs can install the real hook and panic for
// real: whether a panic actually produces a scrubbed report is the one thing
// a unit test cannot check, because a test that panics is a test that failed.
mod cpubench;
mod cpuclock;
pub mod crash;
mod diskhealth;
mod diskinfo;
mod diskopt;
mod dns;
mod drivers;
mod driverupdate;
mod elevation;
mod game_priority;
mod game_sessions;
mod gaming;
mod gpupower;
pub mod health;
pub mod healthhistory;
mod hud;
// Public so examples/fpsprobe.rs can drive a real trace session: the one
// part of the frame counter that unit tests cannot reach is whether the
// provider yields events on a given machine.
pub mod fps;
mod hud_window;
#[cfg(test)]
mod ipc_commands;
#[cfg(test)]
mod ipc_tests;
#[cfg(all(test, windows))]
#[path = "tests/mock_registry.rs"]
mod mock_registry;
mod license;
mod lifetime_tools;
mod netcheck;
mod netlatency;
mod netmaintenance;
mod netshaper;
mod power;
mod power_tuning;
mod privacy_extra;
mod process_rules;
mod profiles;
mod ramclean;
mod recommend;
mod restore_point;
mod rollback;
mod scheduledtasks;
mod settings_tweaks;
mod securedefrag;
mod services;
mod startup;
mod program_icons;
mod sysmon;
mod livemetrics;
mod sysrepair;
mod systemprofile;
mod technical;
mod thermals;
mod turbo;
mod tweaks;
mod updatewatch;
mod window_state;
mod x3d;
mod zerotrace;

pub fn monitor_watchdog(token: &str) { monitor_profiles::watchdog(token); }

#[tauri::command(async)]
fn download_limit_state(app: tauri::AppHandle) -> Result<download_limit::DownloadLimitState,String> {
    download_limit::state(&store_for(&app)?)
}
#[tauri::command(async)]
fn set_download_limit(app: tauri::AppHandle, kbps: u32) -> Result<download_limit::DownloadLimitState,String> {
    let dir=store_for_dir(&app)?;
    require_pro(&dir)?;
    if !(1..=1_000_000).contains(&kbps) { return Err("Choose a bandwidth between 1 and 1000000 KB/s".into()); }
    if !elevation::is_elevated() {
        elevation::run_elevated_action("--elevated-download-limit",&kbps.to_string())?;
    } else { download_limit::configure(&RollbackStore::new(dir),kbps)?; }
    download_limit_state(app)
}
#[tauri::command(async)]
fn restore_download_limit(app: tauri::AppHandle) -> Result<download_limit::DownloadLimitState,String> {
    if !elevation::is_elevated() {
        elevation::run_elevated_action("--elevated-download-restore","restore")?;
    } else { download_limit::rollback(&store_for(&app)?)?; }
    download_limit_state(app)
}

use cleanup::CleanupResult;
use rollback::{RegValue, RollbackStore};
use serde::Serialize;
use tauri::Manager;
use tweaks::{find_tweak, Category, Hive};

// NOT `rename_all = "camelCase"`: the frontend `TweakInfo` type has read
// `requires_admin`/`requires_pro` since the first release, and renaming them
// here would silently blank every badge in the list.
#[derive(Serialize, Default)]
pub struct TweakInfo {
    id: String,
    name: String,
    description: String,
    category: String,
    hive: String,
    requires_admin: bool,
    requires_pro: bool,
    applied: bool,
    /// Everything this tweak actually does to Windows, in the order it does
    /// it - the registry values it writes, the commands it runs, the services
    /// it touches. Shown behind a "Technical details" disclosure so anyone can
    /// check the claim against regedit instead of trusting the description.
    ///
    /// Empty (never fabricated) when a tweak's mechanism cannot be stated
    /// precisely; see `technical.rs` for why this is derived from the apply
    /// path rather than kept in a parallel data file.
    changes: Vec<technical::TechnicalChange>,
    /// The first Windows build the tweak supports, when it needs a newer one
    /// than Windows 10.
    min_build: Option<u32>,
    /// Supported on Pro, Enterprise and Education only.
    pro_edition: bool,
    /// Supported on Enterprise and Education only.
    enterprise_edition: bool,
    /// Why it cannot be applied on this PC: `windows_version`,
    /// `windows_edition`, `windows_edition_enterprise` or `not_present`. The
    /// frontend translates the code.
    unavailable: Option<&'static str>,
}

fn reg_value_type(v: &RegValue) -> &'static str {
    match v {
        RegValue::Dword(_) => "REG_DWORD",
        RegValue::Str(_) => "REG_SZ",
    }
}

fn reg_value_display(v: &RegValue) -> String {
    match v {
        RegValue::Dword(n) => format!("{n} (0x{n:X})"),
        RegValue::Str(s) => format!("\"{s}\""),
    }
}

fn category_str(c: &Category) -> &'static str {
    match c {
        Category::Performance => "performance",
        Category::Privacy => "privacy",
        Category::Ui => "ui",
        Category::Maintenance => "maintenance",
        Category::Gaming => "gaming",
    }
}

fn hive_str(h: &Hive) -> &'static str {
    match h {
        Hive::Hkcu => "HKCU",
        Hive::Hklm => "HKLM",
    }
}

pub fn store_for_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve the app data folder: {}", e))
}

fn store_for(app: &tauri::AppHandle) -> Result<RollbackStore, String> {
    Ok(RollbackStore::new(store_for_dir(app)?))
}

/* ---------------------------------------------------------------- *
 * Profile photo. See avatar.rs for why this is a file and not
 * localStorage â€” in short, people were losing their photos.
 * ---------------------------------------------------------------- */

/// Every one of these takes the signed-in address, because the photo belongs
/// to an account and not to the computer. Passing an empty one would give
/// every anonymous session a single shared photo, so it is refused outright.
fn require_account(email: &str) -> Result<(), String> {
    if email.trim().is_empty() {
        return Err("a profile photo needs an account to belong to".into());
    }
    Ok(())
}

#[tauri::command(async)]
fn save_avatar(app: tauri::AppHandle, email: String, data_url: String) -> Result<(), String> {
    require_account(&email)?;
    avatar::save(&store_for_dir(&app)?, &email, &data_url)
}

#[tauri::command(async)]
fn read_avatar(app: tauri::AppHandle, email: String) -> Option<String> {
    // A failure to even resolve the data folder is reported the same as "no
    // photo": the caller's only sensible response to either is to show the
    // fallback initial, and an error here would surface as a scary toast on
    // an ordinary first launch.
    if email.trim().is_empty() {
        return None;
    }
    avatar::read(&store_for_dir(&app).ok()?, &email)
}

#[tauri::command(async)]
fn clear_avatar(app: tauri::AppHandle, email: String) -> Result<(), String> {
    require_account(&email)?;
    avatar::clear(&store_for_dir(&app)?, &email)
}

/// Gives the pre-1.6.1 machine-wide photo to the account signed in right now.
#[tauri::command(async)]
fn adopt_legacy_avatar(app: tauri::AppHandle, email: String) -> Result<(), String> {
    require_account(&email)?;
    avatar::adopt_legacy(&store_for_dir(&app)?, &email);
    Ok(())
}

/// Drops that photo on sign-out, so the next account cannot inherit it.
#[tauri::command(async)]
fn discard_legacy_avatar(app: tauri::AppHandle) -> Result<(), String> {
    avatar::discard_legacy(&store_for_dir(&app)?);
    Ok(())
}

/// "Active" means in effect now, not merely recorded. A value Windows or the
/// user put back used to stay "on" (and its starter profile "already
/// applied") while Change history reported it reverted, leaving no way to
/// re-apply it there. Re-applying keeps the oldest snapshot, so the original
/// value stays restorable. An unreadable value keeps the recorded state.
fn in_effect(t: &tweaks::RegistryTweak, recorded: bool) -> bool {
    #[cfg(windows)]
    return recorded && !matches!(t.read_current(), Ok(v) if v.as_ref() != Some(&t.on_value));
    #[cfg(not(windows))]
    {
        let _ = t;
        recorded
    }
}

#[tauri::command(async)]
fn list_tweaks(app: tauri::AppHandle) -> Result<Vec<TweakInfo>, String> {
    tweak_infos(&store_for(&app)?)
}

fn tweak_infos(store: &RollbackStore) -> Result<Vec<TweakInfo>, String> {
    let applied_ids = store.applied_ids()?;

    let mut list: Vec<TweakInfo> = tweaks::all_tweaks()
        .into_iter()
        .filter(|t| t.id != "disable_copilot" || applied_ids.contains(t.id))
        .map(|t| TweakInfo {
            applied: in_effect(&t, applied_ids.contains(t.id)),
            id: t.id.to_string(),
            name: t.name.to_string(),
            description: t.description.to_string(),
            category: category_str(&t.category).to_string(),
            hive: hive_str(&t.hive).to_string(),
            requires_admin: t.requires_admin,
            requires_pro: t.requires_pro,
            // Derived, not authored: every single-value tweak discloses
            // itself the moment it exists, with no per-tweak work.
            changes: vec![technical::TechnicalChange::Registry {
                path: format!("{}\\{}", hive_str(&t.hive), t.key_path),
                value_name: t.value_name.to_string(),
                value_type: reg_value_type(&t.on_value),
                sets_to: reg_value_display(&t.on_value),
            }], ..Default::default() })
        .collect();

    list.push(TweakInfo {
        applied: applied_ids.contains(power::TWEAK_ID),
        id: power::TWEAK_ID.to_string(),
        name: "High performance (power plan)".to_string(),
        description: "Switches to the Windows \"High performance\" power plan. Useful on desktops or when plugged in; restores the previous plan on rollback.".to_string(),
        category: category_str(&Category::Performance).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: false,
        requires_pro: false, ..Default::default() });

    let turbo = turbo::info();
    list.push(TweakInfo {
        id: turbo.id.to_string(),
        name: turbo.name.to_string(),
        description: turbo.description.to_string(),
        category: category_str(&Category::Performance).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: turbo.requires_admin,
        requires_pro: turbo.requires_pro,
        applied: applied_ids.contains(turbo.id), ..Default::default() });

    list.push(TweakInfo {
        applied: applied_ids.contains(dns::TWEAK_ID),
        id: dns::TWEAK_ID.to_string(),
        name: "Private DNS (Cloudflare)".to_string(),
        description: "Switches the active network adapter to privacy-focused DNS servers (1.1.1.1), stopping your provider from logging your DNS queries. It does not hide your IP address (that needs a VPN, see below).".to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: true,
        requires_pro: false, ..Default::default() });

    let input_lag = gaming::input_lag_info();
    list.push(TweakInfo {
        applied: applied_ids.contains(input_lag.id),
        id: input_lag.id.to_string(),
        name: input_lag.name.to_string(),
        description: input_lag.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: input_lag.requires_admin,
        requires_pro: input_lag.requires_pro, ..Default::default() });

    let turbo_boost = gaming::turbo_boost_info();
    list.push(TweakInfo {
        applied: applied_ids.contains(turbo_boost.id),
        id: turbo_boost.id.to_string(),
        name: turbo_boost.name.to_string(),
        description: turbo_boost.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: turbo_boost.requires_admin,
        requires_pro: turbo_boost.requires_pro, ..Default::default() });

    let games_priority = game_priority::info();
    list.push(TweakInfo {
        applied: applied_ids.contains(games_priority.id),
        id: games_priority.id.to_string(),
        name: games_priority.name.to_string(),
        description: games_priority.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: games_priority.requires_admin,
        requires_pro: games_priority.requires_pro, ..Default::default() });

    let core_parking = gaming::core_parking_info();
    list.push(TweakInfo {
        applied: applied_ids.contains(core_parking.id),
        id: core_parking.id.to_string(),
        name: core_parking.name.to_string(),
        description: core_parking.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: core_parking.requires_admin,
        requires_pro: core_parking.requires_pro, ..Default::default() });

    let keyboard_delay = gaming::keyboard_delay_info();
    list.push(TweakInfo {
        applied: applied_ids.contains(keyboard_delay.id),
        id: keyboard_delay.id.to_string(),
        name: keyboard_delay.name.to_string(),
        description: keyboard_delay.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: keyboard_delay.requires_admin,
        requires_pro: keyboard_delay.requires_pro, ..Default::default() });

    let net_latency = netlatency::info();
    list.push(TweakInfo {
        applied: applied_ids.contains(net_latency.id),
        id: net_latency.id.to_string(),
        name: net_latency.name.to_string(),
        description: net_latency.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: net_latency.requires_admin,
        requires_pro: net_latency.requires_pro, ..Default::default() });

    let net_shaper = netshaper::info();
    list.push(TweakInfo {
        applied: applied_ids.contains(net_shaper.id),
        id: net_shaper.id.to_string(),
        name: net_shaper.name.to_string(),
        description: net_shaper.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: net_shaper.requires_admin,
        requires_pro: net_shaper.requires_pro, ..Default::default() });

    let activity_history = privacy_extra::activity_history_info();
    list.push(TweakInfo {
        applied: applied_ids.contains(activity_history.id),
        id: activity_history.id.to_string(),
        name: activity_history.name.to_string(),
        description: activity_history.description.to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: activity_history.requires_admin,
        requires_pro: activity_history.requires_pro, ..Default::default() });

    let typing = privacy_extra::typing_personalization_info();
    list.push(TweakInfo {
        applied: applied_ids.contains(typing.id),
        id: typing.id.to_string(),
        name: typing.name.to_string(),
        description: typing.description.to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: typing.requires_admin,
        requires_pro: typing.requires_pro, ..Default::default() });

    let context_menu = contextmenu::info();
    list.push(TweakInfo {
        applied: applied_ids.contains(context_menu.id),
        id: context_menu.id.to_string(),
        name: context_menu.name.to_string(),
        description: context_menu.description.to_string(),
        category: category_str(&Category::Ui).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: context_menu.requires_admin,
        requires_pro: context_menu.requires_pro, ..Default::default() });

    let windows_search = services::windows_search_info();
    list.push(TweakInfo {
        applied: applied_ids.contains(windows_search.id),
        id: windows_search.id.to_string(),
        name: windows_search.name.to_string(),
        description: windows_search.description.to_string(),
        category: category_str(&Category::Maintenance).to_string(),
        hive: "\u{2014}".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: windows_search.requires_admin,
        requires_pro: windows_search.requires_pro, ..Default::default() });

    for tweak in &power_tuning::TWEAKS {
        list.push(TweakInfo {
            id: tweak.id.into(), name: tweak.name.into(), description: tweak.description.into(),
            category: if tweak.hybrid { "gaming".into() } else { "performance".into() },
            hive: "Windows API".into(), requires_admin: true, requires_pro: tweak.pro,
            applied: applied_ids.contains(tweak.id),
            changes: vec![technical::TechnicalChange::Command {
                program: "PowerWriteACValueIndex",
                arguments: format!("Current plan; subgroup {}; setting {}; AC index {}. Battery policy unchanged. Restore writes the prior effective AC value as an explicit plan value, including when it was inherited. Refresh with PowerSetActiveScheme only if this plan remains active.", tweak.subgroup,tweak.setting,tweak.value),
            }], ..Default::default() });
    }

    list.push(TweakInfo {
        id: everyday::DISABLE_FILTER_KEYS_SHORTCUT_ID.into(), name:"Prevent the Filter Keys shortcut".into(),
        description:"Disables only the right-Shift shortcut for Filter Keys. Existing accessibility settings and timings are preserved.".into(),
        category:"gaming".into(), hive:"Windows API".into(), requires_admin:false, requires_pro:false,
        applied:applied_ids.contains(everyday::DISABLE_FILTER_KEYS_SHORTCUT_ID),
        changes:vec![technical::TechnicalChange::Command{program:"SystemParametersInfoW",arguments:"Read FILTERKEYS; clear FKF_HOTKEYACTIVE only; preserve remaining flags and timings; restore the saved state.".into()}], ..Default::default() });
    for (id,name,description,category,admin) in [
        ("ecoqos_rules","Background app efficiency","Choose apps for EcoQoS while PC Tweaker is running. Foreground apps are restored; global power-throttling policy may block this feature.","performance",false),
        ("limit_do_background_download","Windows background download limit","Configure a Delivery Optimization limit in KB/s. Does not limit other applications or disable Windows Update.","performance",true),
        ("monitor_refresh_profile","Game display refresh profiles","Choose supported refresh rates per game. Preview and restore keep the original resolution and desktop layout.","gaming",false),
    ] {
        list.push(TweakInfo{id:id.into(),name:name.into(),description:description.into(),category:category.into(),hive:"Windows API".into(),requires_admin:admin,requires_pro:true,applied:applied_ids.contains(id),changes:vec![],..Default::default()});
    }

    #[cfg(windows)]
    let (build, edition) = settings_tweaks::machine();
    #[cfg(not(windows))]
    let (build, edition): (Option<u32>, Option<String>) = (None, None);
    for t in &settings_tweaks::TWEAKS {
        let recorded = applied_ids.contains(t.id);
        #[cfg(windows)]
        let applied = recorded && settings_tweaks::in_effect(t).unwrap_or(true);
        #[cfg(not(windows))]
        let applied = recorded;
        list.push(TweakInfo {
            id: t.id.into(),
            name: t.name.into(),
            description: t.description.into(),
            category: category_str(&t.category).into(),
            hive: hive_str(&t.hive).into(),
            requires_admin: t.requires_admin(),
            requires_pro: t.requires_pro,
            applied,
            changes: settings_tweaks::changes(t),
            min_build: (t.min_build > 0).then_some(t.min_build),
            pro_edition: t.edition == settings_tweaks::Edition::ProOrHigher,
            enterprise_edition: t.edition == settings_tweaks::Edition::EnterpriseOrEducation,
            unavailable: settings_tweaks::availability(t, build, edition.as_deref())
                .err()
                .map(|why| why.code()),
        });
    }

    let ai_fabric = services::ai_fabric_info();
    list.push(TweakInfo {
        applied: applied_ids.contains(ai_fabric.id),
        id: ai_fabric.id.to_string(),
        name: ai_fabric.name.to_string(),
        description: ai_fabric.description.to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "\u{2014}".to_string(),
        requires_admin: ai_fabric.requires_admin,
        requires_pro: ai_fabric.requires_pro,
        min_build: Some(settings_tweaks::BUILD_24H2),
        // Present only where the on-device AI features are; never offered
        // where there is nothing to turn off, unless it is already applied.
        unavailable: ai_fabric_unavailable(applied_ids.contains(ai_fabric.id)),
        ..Default::default()
    });

    // One pass, not twelve call sites: anything that arrived with no
    // disclosure asks `technical` for its composite one. A tweak whose
    // mechanism we cannot state precisely keeps an empty list and shows no
    // panel at all, rather than a plausible-looking guess.
    for entry in &mut list {
        if entry.changes.is_empty() {
            entry.changes = technical::composite_changes(&entry.id);
        }
    }

    Ok(list)
}

/// The multi-value settings, for the update watch: each one is in effect only
/// while every one of its values still is.
#[cfg(windows)]
fn settings_drift_states(
    applied_ids: &std::collections::HashSet<String>,
) -> Vec<updatewatch::TweakState> {
    settings_tweaks::TWEAKS
        .iter()
        .map(|t| {
            let recorded_applied = applied_ids.contains(t.id);
            updatewatch::TweakState {
                id: t.id.to_string(),
                recorded_applied,
                live_matches: if recorded_applied {
                    settings_tweaks::in_effect(t)
                } else {
                    None
                },
            }
        })
        .collect()
}

#[cfg(windows)]
fn ai_fabric_unavailable(applied: bool) -> Option<&'static str> {
    (!applied && !services::installed(services::AI_FABRIC_SERVICE)).then_some("not_present")
}

#[cfg(not(windows))]
fn ai_fabric_unavailable(_applied: bool) -> Option<&'static str> {
    Some("not_present")
}

/// One line of a dry run: a change the tweak would make, what is there now
/// and whether applying would change it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRow {
    change: technical::TechnicalChange,
    /// The value as it reads now, the way regedit shows it. `None` when it is
    /// not set, or for a change that is not a registry value.
    current: Option<String>,
    /// False only when the value already is what the tweak would write.
    changes: bool,
}

/// Mirrors `TweakPreview` in src/types.ts.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TweakPreview {
    id: String,
    rows: Vec<PreviewRow>,
    applied: bool,
    will_change: bool,
    requires_admin: bool,
    unavailable: Option<&'static str>,
}

/// Reads a registry change's current value, as regedit renders it.
#[cfg(windows)]
fn current_value(path: &str, name: &str) -> Option<String> {
    let (hive, key) = match path.split_once('\\')? {
        ("HKLM", key) => (Hive::Hklm, key),
        ("HKCU", key) => (Hive::Hkcu, key),
        _ => return None,
    };
    match tweaks::windows_impl::read_value(hive, key, name, &RegValue::Dword(0)) {
        Ok(Some(value)) => Some(reg_value_display(&value)),
        _ => None,
    }
}

#[cfg(not(windows))]
fn current_value(_path: &str, _name: &str) -> Option<String> {
    None
}

/// The dry run behind "Preview": every change a tweak would make, against
/// what the machine has now. Reads only.
pub(crate) fn preview_for(store: &RollbackStore, id: &str) -> Result<TweakPreview, String> {
    let info = tweak_infos(store)?
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("unknown tweak: {id}"))?;
    let rows: Vec<PreviewRow> = info
        .changes
        .into_iter()
        .map(|change| {
            let (current, changes) = match &change {
                technical::TechnicalChange::Registry {
                    path,
                    value_name,
                    sets_to,
                    ..
                } => {
                    let current = current_value(path, value_name);
                    let changes = current.as_deref() != Some(sets_to.as_str());
                    (current, changes)
                }
                _ => (None, true),
            };
            PreviewRow {
                change,
                current,
                changes,
            }
        })
        .collect();
    Ok(TweakPreview {
        id: info.id,
        will_change: rows.iter().any(|r| r.changes),
        rows,
        applied: info.applied,
        requires_admin: info.requires_admin,
        unavailable: info.unavailable,
    })
}

#[tauri::command(async)]
fn preview_tweak(app: tauri::AppHandle, id: String) -> Result<TweakPreview, String> {
    preview_for(&store_for(&app)?, &id)
}

/// Inner errors say the snapshot was kept for a retry. After an automatic
/// undo that is no longer true, so the clause is dropped.
fn without_retention_note(error: &str) -> String {
    let mut text = error.to_string();
    for note in [
        "; the rollback snapshot was retained",
        ", the rollback snapshot was retained",
        "; recovery data was retained",
    ] {
        text = text.replace(note, "");
    }
    text.trim_end_matches('.').to_string()
}

/// Applies a tweak, and when the apply fails after its snapshot was saved (a
/// later value refused, a value that would not stick), puts every original
/// back at once rather than leaving the tweak half applied. A tweak that was
/// already applied before this attempt is left exactly as it was.
#[cfg(windows)]
pub(crate) fn apply_or_undo(
    store: &RollbackStore,
    app_data_dir: &std::path::Path,
    id: &str,
) -> Result<(), String> {
    let was_applied = store.is_applied_checked(id).unwrap_or(true);
    let error = match apply_by_id_inner(store, app_data_dir, id) {
        Ok(()) => return Ok(()),
        Err(error) => error,
    };
    if was_applied || !store.is_applied(id) {
        return Err(error);
    }
    let undone = rollback_by_id_inner(store, id);
    if !cfg!(test) {
        audit::record(
            "tweak-auto-reverted",
            id,
            undone.is_ok(),
            undone.as_ref().err().cloned(),
        );
    }
    Err(match undone {
        Ok(()) => format!(
            "{}. The change was undone automatically, so nothing was left half applied.",
            without_retention_note(&error)
        ),
        Err(undo) => format!("{error}. Undoing it automatically failed too ({undo}); use Restore to try again."),
    })
}

/// Whether a friendly, stable prefix on a returned error means "this failed
/// because the Pro license didn't verify" rather than some other failure â€”
/// checked by the frontend to show the paywall instead of a generic toast.
pub const PRO_REQUIRED_PREFIX: &str = "PRO_REQUIRED: ";

#[cfg(windows)]
fn requires_pro_for(id: &str) -> bool {
    if ["ecoqos_rules","limit_do_background_download","monitor_refresh_profile"].contains(&id) { return true; }
    if let Some(tweak) = power_tuning::find(id) {
        return tweak.pro;
    }
    if let Some(tweak) = settings_tweaks::find(id) {
        return tweak.requires_pro;
    }
    match id {
        power::TWEAK_ID => false,
        turbo::TWEAK_ID => turbo::info().requires_pro,
        dns::TWEAK_ID => false,
        gaming::INPUT_LAG_ID => gaming::input_lag_info().requires_pro,
        gaming::TURBO_BOOST_ID => gaming::turbo_boost_info().requires_pro,
        gaming::KEYBOARD_DELAY_ID => gaming::keyboard_delay_info().requires_pro,
        gaming::CORE_PARKING_ID => gaming::core_parking_info().requires_pro,
        netlatency::TWEAK_ID => netlatency::info().requires_pro,
        netshaper::TWEAK_ID => netshaper::info().requires_pro,
        game_priority::TWEAK_ID => game_priority::info().requires_pro,
        privacy_extra::ACTIVITY_HISTORY_ID => privacy_extra::activity_history_info().requires_pro,
        privacy_extra::TYPING_PERSONALIZATION_ID => {
            privacy_extra::typing_personalization_info().requires_pro
        }
        contextmenu::TWEAK_ID => contextmenu::info().requires_pro,
        services::WINDOWS_SEARCH_ID => services::windows_search_info().requires_pro,
        services::AI_FABRIC_ID => services::ai_fabric_info().requires_pro,
        _ => find_tweak(id).map(|t| t.requires_pro).unwrap_or(false),
    }
}

/// Side-effect-free entitlement decision shared by execution and policy tests.
#[cfg(windows)]
pub(crate) fn require_tweak_entitlement(
    app_data_dir: &std::path::Path,
    id: &str,
) -> Result<(), String> {
    if requires_pro_for(id) {
        require_pro(app_data_dir)?;
    }
    Ok(())
}

/// This is the single chokepoint every apply path funnels through â€” the
/// direct GUI call, the batched "fix all", *and* the elevated headless
/// re-entry (`--elevated-apply`), which calls this function directly and
/// would otherwise skip any check placed only in the Tauri command handlers
/// above it. That headless path is reachable by launching the shipped exe
/// with that flag from a terminal, with no GUI involved at all, so gating
/// only the commands would have left it wide open.
///
/// Deliberately not applied to `rollback_by_id`: cancelling a subscription
/// must not strand a tweak the user already paid to have applied â€” TERMS.md
/// is explicit that cancellation locks *further* Pro use, not what's already
/// on the machine.
#[cfg(windows)]
fn apply_by_id(
    store: &RollbackStore,
    app_data_dir: &std::path::Path,
    id: &str,
) -> Result<(), String> {
    // Read the line before touching it. Without the earlier reading, a
    // failed probe afterwards cannot be told apart from a machine that was
    // offline the whole time, and the guard would revert a good tweak on a
    // PC that never had internet. The same reading is the "before" half of
    // the verification record the UI shows afterwards.
    // A Pro tweak a Free user cannot apply is refused without the wait.
    let before = (netcheck::relevant(id) && require_tweak_entitlement(app_data_dir, id).is_ok())
        .then(diagnostics::network_verify::measure);
    let was_online = before.as_ref().is_some_and(|b| b.online);

    // Single funnel for every apply (direct, batched, and the elevated
    // helper), so this one audit call covers them all exactly once.
    let mut result = apply_or_undo(store, app_data_dir, id);

    if result.is_ok() && netcheck::regressed(was_online) {
        // Reverted through the public funnel so the audit log carries the
        // revert as its own event, rather than an apply that quietly undid
        // itself with nothing to show for it.
        let restored = rollback_by_id(store, id).is_ok();
        result = Err(netcheck::reverted_message(restored));
    }
    // The "after" reading only for a change that was kept, and only when the
    // "before" one had enough replies to compare against.
    if let Some(before) = before.filter(|b| {
        result.is_ok() && diagnostics::network_verify::enough_replies(&b.link)
    }) {
        let after = diagnostics::network_verify::measure();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |d| d.as_millis() as u64);
        let record = diagnostics::network_verify::compare(id, now, before, after);
        diagnostics::network_verify::save(app_data_dir, &record);
    }

    audit::record(
        "tweak-applied",
        id,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

#[cfg(windows)]
fn apply_by_id_inner(
    store: &RollbackStore,
    app_data_dir: &std::path::Path,
    id: &str,
) -> Result<(), String> {
    // Refused for everyone, Pro or not, before the licence is even looked at.
    if ["ecoqos_rules","limit_do_background_download","monitor_refresh_profile"].contains(&id) {
        return Err("Configure this control in its dedicated panel; no default configuration is applied automatically".into());
    }
    require_tweak_entitlement(app_data_dir, id)?;
    if [everyday::DISABLE_RESTART_APPS_ID,everyday::ENABLE_LONG_PATHS_ID,everyday::DISABLE_FILTER_KEYS_SHORTCUT_ID].contains(&id) {
        return everyday::apply(id,store);
    }
    if power_tuning::find(id).is_some() {
        return power_tuning::apply(store, id);
    }
    if let Some(tweak) = settings_tweaks::find(id) {
        return settings_tweaks::apply(store, tweak);
    }
    if let Some(tweak) = services::find(id) {
        return services::apply_service(store, tweak);
    }
    match id {
        power::TWEAK_ID => power::apply(store),
        turbo::TWEAK_ID => turbo::apply(store),
        dns::TWEAK_ID => dns::apply(store),
        gaming::INPUT_LAG_ID => gaming::apply_input_lag(store),
        gaming::TURBO_BOOST_ID => gaming::apply_turbo_boost(store),
        gaming::KEYBOARD_DELAY_ID => gaming::apply_keyboard_delay(store),
        gaming::CORE_PARKING_ID => gaming::apply_core_parking(store),
        netlatency::TWEAK_ID => netlatency::apply(store),
        netshaper::TWEAK_ID => netshaper::apply(store),
        game_priority::TWEAK_ID => game_priority::apply(store),
        privacy_extra::ACTIVITY_HISTORY_ID => privacy_extra::apply_activity_history(store),
        privacy_extra::TYPING_PERSONALIZATION_ID => {
            privacy_extra::apply_typing_personalization(store)
        }
        contextmenu::TWEAK_ID => contextmenu::apply(store),
        _ => {
            let tweak = find_tweak(id).ok_or_else(|| format!("unknown tweak: {}", id))?;
            tweak.apply(store)
        }
    }
}

#[cfg(windows)]
fn rollback_by_id(store: &RollbackStore, id: &str) -> Result<(), String> {
    // Same single-funnel audit as apply_by_id.
    let result = rollback_by_id_inner(store, id);
    audit::record(
        "tweak-reverted",
        id,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

#[cfg(windows)]
fn rollback_by_id_inner(store: &RollbackStore, id: &str) -> Result<(), String> {
    if [everyday::DISABLE_RESTART_APPS_ID,everyday::ENABLE_LONG_PATHS_ID,everyday::DISABLE_FILTER_KEYS_SHORTCUT_ID].contains(&id) {
        return everyday::rollback(id,store);
    }
    if id==download_limit::TWEAK_ID { return download_limit::rollback(store).map(|_|()); }
    if power_tuning::find(id).is_some() {
        return power_tuning::rollback(store, id);
    }
    if let Some(tweak) = settings_tweaks::find(id) {
        return settings_tweaks::rollback(store, tweak);
    }
    if let Some(tweak) = services::find(id) {
        return services::rollback_service(store, tweak);
    }
    match id {
        power::TWEAK_ID => power::rollback(store),
        turbo::TWEAK_ID => turbo::rollback(store),
        dns::TWEAK_ID => dns::rollback(store),
        gaming::INPUT_LAG_ID => gaming::rollback_input_lag(store),
        gaming::TURBO_BOOST_ID => gaming::rollback_turbo_boost(store),
        gaming::KEYBOARD_DELAY_ID => gaming::rollback_keyboard_delay(store),
        gaming::CORE_PARKING_ID => gaming::rollback_core_parking(store),
        netlatency::TWEAK_ID => netlatency::rollback(store),
        netshaper::TWEAK_ID => netshaper::rollback(store),
        game_priority::TWEAK_ID => game_priority::rollback(store),
        privacy_extra::ACTIVITY_HISTORY_ID => privacy_extra::rollback_activity_history(store),
        privacy_extra::TYPING_PERSONALIZATION_ID => {
            privacy_extra::rollback_typing_personalization(store)
        }
        contextmenu::TWEAK_ID => contextmenu::rollback(store),
        _ => {
            let tweak = find_tweak(id).ok_or_else(|| format!("unknown tweak: {}", id))?;
            tweak.rollback(store)
        }
    }
}

#[cfg(windows)]
fn requires_admin_for(id: &str) -> bool {
    if id == download_limit::TWEAK_ID { return true; }
    if power_tuning::find(id).is_some() {
        return true;
    }
    if let Some(tweak) = settings_tweaks::find(id) {
        return tweak.requires_admin();
    }
    if services::find(id).is_some() {
        return true;
    }
    match id {
        power::TWEAK_ID => false,
        turbo::TWEAK_ID => turbo::info().requires_admin,
        dns::TWEAK_ID => true,
        gaming::INPUT_LAG_ID => false,
        gaming::TURBO_BOOST_ID => true,
        gaming::CORE_PARKING_ID => true,
        gaming::KEYBOARD_DELAY_ID => false,
        netlatency::TWEAK_ID => netlatency::info().requires_admin,
        netshaper::TWEAK_ID => netshaper::info().requires_admin,
        game_priority::TWEAK_ID => true,
        privacy_extra::ACTIVITY_HISTORY_ID => true,
        privacy_extra::TYPING_PERSONALIZATION_ID => {
            privacy_extra::typing_personalization_info().requires_admin
        }
        contextmenu::TWEAK_ID => contextmenu::info().requires_admin,
        _ => find_tweak(id).map(|t| t.requires_admin).unwrap_or(false),
    }
}

#[cfg(windows)]
#[tauri::command(async)]
fn apply_tweak(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if requires_admin_for(&id) && !elevation::is_elevated() {
        return elevation::run_elevated_action("--elevated-apply", &id);
    }
    let dir = store_for_dir(&app)?;
    let store = RollbackStore::new(dir.clone());
    apply_by_id(&store, &dir, &id)
}

#[cfg(windows)]
#[tauri::command(async)]
fn rollback_tweak(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if requires_admin_for(&id) && !elevation::is_elevated() {
        return elevation::run_elevated_action("--elevated-rollback", &id);
    }
    let store = store_for(&app)?;
    rollback_by_id(&store, &id)
}

/// Tweaks that only ever apply through their own switch: never in a batch,
/// a profile, a re-apply after an update, or anything else done in bulk.
/// Turning Memory Integrity off is a security trade the user makes once, on
/// purpose, for this machine.
pub(crate) const MANUAL_ONLY_TWEAKS: [&str; 1] = ["disable_memory_integrity"];

/// The ids of a bulk request that a bulk request may apply: never the
/// manual-only ones, and never a setting this PC's Windows build or edition
/// does not support (a profile made on another PC may name one).
pub(crate) fn bulk_applicable(ids: Vec<String>) -> Vec<String> {
    ids.into_iter()
        .filter(|id| !MANUAL_ONLY_TWEAKS.contains(&id.as_str()))
        .filter(|id| fits_this_pc(id))
        .collect()
}

#[cfg(windows)]
fn fits_this_pc(id: &str) -> bool {
    settings_tweaks::find(id).is_none_or(|t| settings_tweaks::available_here(t).is_ok())
}

#[cfg(not(windows))]
fn fits_this_pc(_id: &str) -> bool {
    true
}

/// Splits a batch into (needs-elevation, can-run-directly). Kept separate so
/// the "every admin tweak ends up in one group, therefore one UAC prompt"
/// guarantee is testable without actually elevating anything.
#[cfg(windows)]
fn split_by_elevation(ids: Vec<String>) -> (Vec<String>, Vec<String>) {
    let mut seen = std::collections::HashSet::new();
    ids.into_iter()
        .filter(|id| seen.insert(id.clone()))
        .partition(|id| requires_admin_for(id))
}

/// Applies several tweaks at once (the Scan screen's "fix all").
///
/// Applying them one by one would fire a separate UAC prompt for every
/// admin-level tweak â€” a dozen consecutive prompts for a single click. So the
/// admin ones are collected and handed to a *single* elevated helper run,
/// while the rest are applied in-process. Failures are collected per id
/// instead of aborting, so one bad tweak can't silently swallow the rest.
#[cfg(windows)]
#[tauri::command(async)]
fn apply_tweaks(app: tauri::AppHandle, ids: Vec<String>) -> Result<Vec<String>, String> {
    let dir = store_for_dir(&app)?;
    let store = RollbackStore::new(dir.clone());
    let mut failures = Vec::new();

    let (needs_admin, direct) = split_by_elevation(bulk_applicable(ids));

    for id in &direct {
        if let Err(e) = apply_by_id(&store, &dir, id) {
            failures.push(format!("{}: {}", id, e));
        }
    }

    if !needs_admin.is_empty() {
        if elevation::is_elevated() {
            for id in &needs_admin {
                if let Err(e) = apply_by_id(&store, &dir, id) {
                    failures.push(format!("{}: {}", id, e));
                }
            }
        } else if let Err(e) =
            elevation::run_elevated_action("--elevated-apply-many", &needs_admin.join(","))
        {
            failures.push(e);
        }
    }

    Ok(failures)
}

/// Reverts several tweaks at once ("Restore all"). Same batching rationale as
/// `apply_tweaks`: undoing a dozen admin tweaks must cost one UAC prompt, not
/// one per tweak, or nobody would ever use the button.
#[cfg(windows)]
#[tauri::command(async)]
fn rollback_tweaks(app: tauri::AppHandle, ids: Vec<String>) -> Result<Vec<String>, String> {
    let store = store_for(&app)?;
    let mut failures = Vec::new();

    let (needs_admin, direct) = split_by_elevation(ids);

    for id in &direct {
        if let Err(e) = rollback_by_id(&store, id) {
            failures.push(format!("{}: {}", id, e));
        }
    }

    if !needs_admin.is_empty() {
        if elevation::is_elevated() {
            for id in &needs_admin {
                if let Err(e) = rollback_by_id(&store, id) {
                    failures.push(format!("{}: {}", id, e));
                }
            }
        } else if let Err(e) =
            elevation::run_elevated_action("--elevated-rollback-many", &needs_admin.join(","))
        {
            failures.push(e);
        }
    }

    Ok(failures)
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn apply_tweaks(_app: tauri::AppHandle, _ids: Vec<String>) -> Result<Vec<String>, String> {
    Err("tweaks are currently only supported on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn rollback_tweaks(_app: tauri::AppHandle, _ids: Vec<String>) -> Result<Vec<String>, String> {
    Err("tweaks are currently only supported on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn apply_tweak(_app: tauri::AppHandle, _id: String) -> Result<(), String> {
    Err("tweaks are currently only supported on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn rollback_tweak(_app: tauri::AppHandle, _id: String) -> Result<(), String> {
    Err("tweaks are currently only supported on Windows".to_string())
}

/// True when the app runs from its Microsoft Store package. Store installs are
/// updated by the Store, so the GitHub updater must not offer a second copy.
#[tauri::command]
fn is_store_install() -> bool {
    #[cfg(windows)]
    {
        windows::ApplicationModel::Package::Current().is_ok()
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
fn list_cleanup_targets() -> Vec<cleanup::CleanupInfo> {
    cleanup::cleanup_targets()
}

/// Detects Chrome/Edge/Firefox profiles on this machine and reports cache
/// and cookie sizes. No elevation involved: browser profile data lives
/// under the current user's own AppData, same as the app's own settings.
#[tauri::command(async)]
fn list_browser_cleanup() -> Vec<browsercleanup::BrowserCleanupInfo> {
    browsercleanup::detect()
}

#[tauri::command(async)]
fn run_browser_cleanup(id: String) -> Result<browsercleanup::BrowserCleanupResult, String> {
    let result = browsercleanup::clear(&id);
    audit::record(
        "browser_cleanup",
        &id,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

fn last_cleanup_result_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve the app data folder: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("last_cleanup_result.json"))
}

/// Whether a cleanup needs administrator rights, after its Pro gate. The gate
/// lives here rather than only on the card: `invoke` and the elevated command
/// line both reach the cleanup without passing through the UI.
fn authorize_cleanup(app_data_dir: &std::path::Path, id: &str) -> Result<bool, String> {
    let target = cleanup::target(id).ok_or_else(|| format!("unknown cleanup action: {}", id))?;
    if target.requires_pro {
        require_pro(app_data_dir)?;
    }
    Ok(target.requires_admin)
}

/// The elevated helper only runs the cleanups that need it. Anything else
/// would be an administrator emptying a folder the signed-in user chooses.
fn authorize_elevated_cleanup(app_data_dir: &std::path::Path, id: &str) -> Result<(), String> {
    if authorize_cleanup(app_data_dir, id)? {
        Ok(())
    } else {
        Err("this cleanup does not run as administrator".to_string())
    }
}

#[cfg(windows)]
#[tauri::command(async)]
fn run_cleanup(app: tauri::AppHandle, id: String) -> Result<CleanupResult, String> {
    let requires_admin = authorize_cleanup(&store_for_dir(&app)?, &id)?;

    if requires_admin && !elevation::is_elevated() {
        elevation::run_elevated_action("--elevated-cleanup", &id)?;
        let path = last_cleanup_result_path(&app)?;
        let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&path);
        return serde_json::from_str(&json).map_err(|e| e.to_string());
    }

    let result = cleanup::run_cleanup(&id);
    audit::record(
        "cleanup",
        &id,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

/// Read-only dry run for the cleanup confirmation dialog: exactly what
/// `run_cleanup` would move, with sizes. Takes no action.
#[tauri::command(async)]
fn preview_cleanup(id: String) -> Result<cleanup::CleanupPreview, String> {
    cleanup::preview_cleanup(&id)
}

/// Cleans only the top-level items the user ticked in the preview. Same
/// elevation dance as `run_cleanup`; the selection crosses the UAC boundary
/// as a `|`-joined payload (Windows forbids `|` in file names, and the names
/// are re-validated on the elevated side).
#[cfg(windows)]
#[tauri::command(async)]
fn run_cleanup_selected(
    app: tauri::AppHandle,
    id: String,
    names: Vec<String>,
) -> Result<CleanupResult, String> {
    let requires_admin = authorize_cleanup(&store_for_dir(&app)?, &id)?;

    if requires_admin && !elevation::is_elevated() {
        // Validate before the payload is built, so a bad name fails here
        // with a clear error instead of inside the headless helper.
        for name in &names {
            cleanup::validate_item_name(name)?;
        }
        elevation::run_elevated_action(
            "--elevated-cleanup-sel",
            &cleanup::encode_selected_payload(&id, &names),
        )?;
        let path = last_cleanup_result_path(&app)?;
        let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&path);
        return serde_json::from_str(&json).map_err(|e| e.to_string());
    }

    let count = names.len();
    let result = cleanup::run_cleanup_selected(&id, &names);
    audit::record(
        "cleanup",
        &id,
        result.is_ok(),
        Some(format!("{} selected items", count)),
    );
    result
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn run_cleanup_selected(
    _app: tauri::AppHandle,
    _id: String,
    _names: Vec<String>,
) -> Result<CleanupResult, String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn run_cleanup(_app: tauri::AppHandle, _id: String) -> Result<CleanupResult, String> {
    Err("not supported on this platform".to_string())
}

#[tauri::command(async)]
fn scan_duplicates(
    app: tauri::AppHandle,
    root: String,
) -> Result<Vec<cleanup::DuplicateGroup>, String> {
    // Pro in the UI; the native check is the boundary that holds.
    require_pro(&store_for_dir(&app)?)?;
    let stop = cleanup::folder_scan_stop(cleanup::FolderScan::Duplicates);
    cleanup::scan_duplicates(&root, &stop)
}

/// Stops a running duplicate (`"duplicates"`) or large-file search.
#[tauri::command]
fn cancel_folder_scan(kind: String) {
    cleanup::cancel_folder_scan(if kind == "duplicates" {
        cleanup::FolderScan::Duplicates
    } else {
        cleanup::FolderScan::LargeFiles
    });
}

#[tauri::command(async)]
fn delete_files(paths: Vec<String>) -> CleanupResult {
    let requested = paths.len();
    let result = cleanup::delete_files(paths);
    // Counts only â€” never file paths â€” so the local log stays free of
    // anything resembling personal data.
    audit::record(
        "files-deleted",
        &format!("{} files", requested),
        result.skipped_count == 0,
        Some(format!(
            "{} deleted, {} skipped",
            result.deleted_count, result.skipped_count
        )),
    );
    result
}

#[tauri::command(async)]
fn scan_large_files(
    app: tauri::AppHandle,
    root: String,
    min_bytes: u64,
) -> Result<Vec<cleanup::LargeFile>, String> {
    require_pro(&store_for_dir(&app)?)?;
    let stop = cleanup::folder_scan_stop(cleanup::FolderScan::LargeFiles);
    cleanup::scan_large_files(&root, min_bytes, &stop)
}

fn last_diskopt_result_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve the app data folder: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("last_diskopt_result.json"))
}

/// Same elevation dance as `run_cleanup`: optimizing a drive needs admin
/// rights, so an unelevated app relaunches itself through a single UAC
/// prompt and reads the result back from a file the elevated helper process
/// writes before exiting. The chosen drive letter is the payload passed
/// through the elevated relaunch, same as a tweak id is for `--elevated-apply`.
#[cfg(windows)]
#[tauri::command(async)]
fn optimize_disk(app: tauri::AppHandle, drive: String) -> Result<diskopt::DiskOptResult, String> {
    // Normalized before it crosses the elevation boundary as a CLI argument:
    // this guarantees the elevated child only ever sees a bare "X:", never a
    // defrag flag or anything shell-like.
    let drive = diskinfo::validate_drive(&drive)?;
    // The UI gates this behind Pro, but that gate lives in the frontend and
    // `invoke` is reachable without it. This is the boundary that actually
    // holds.
    require_pro(&store_for_dir(&app)?)?;
    if !elevation::is_elevated() {
        elevation::run_elevated_action("--elevated-diskopt", &drive)?;
        let path = last_diskopt_result_path(&app)?;
        let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&path);
        return serde_json::from_str(&json).map_err(|e| e.to_string());
    }
    let result = diskopt::optimize(&drive);
    audit::record(
        "disk-optimize",
        &drive,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn optimize_disk(_app: tauri::AppHandle, _drive: String) -> Result<diskopt::DiskOptResult, String> {
    Err("not supported on this platform".to_string())
}

/// Called from `main()` when the process was relaunched elevated (via the
/// `runas` UAC prompt) to perform exactly one action headlessly, then exit.
/// This keeps the main app running unprivileged at all times.
#[cfg(windows)]
/// Whether the scheduled watchdog is registered right now.
#[cfg(windows)]
#[tauri::command(async)]
fn drift_watch_enabled() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    crate::system_tools::run("schtasks", |tool| {
        tool.args(["/query", "/tn", updatewatch::TASK_NAME])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
    })
    .map(|o| o.status.success())
    .unwrap_or(false)
}

/// Registers or removes the daily check.
///
/// Daily at logon rather than hourly: the thing being watched for is a
/// Windows cumulative update, which happens on the order of once a month.
/// Polling faster would spend the user's battery to find out the same
/// nothing.
///
#[cfg(windows)]
#[tauri::command(async)]
fn set_drift_watch(enabled: bool) -> Result<bool, String> {
    match configure_drift_watch(enabled) {
        Ok(()) => {}
        Err(direct_error) if !elevation::is_elevated() => {
            // Most PCs allow a per-user logon task without elevation. Some
            // corporate policies do not, so retry only that small operation
            // through UAC while the main application remains unprivileged.
            elevation::run_elevated_action(
                "--elevated-drift-watch",
                if enabled { "enable" } else { "disable" },
            )
            .map_err(|e| format!("{direct_error}; administrator retry failed: {e}"))?;
        }
        Err(e) => return Err(e),
    }

    let actual = drift_watch_enabled();
    if actual != enabled {
        return Err(if enabled {
            "Windows did not retain the update watch task after creating it".to_string()
        } else {
            "Windows did not remove the update watch task".to_string()
        });
    }

    audit::record(
        "update-drift-watch",
        if enabled { "enabled" } else { "disabled" },
        true,
        None,
    );
    Ok(actual)
}

/// Text of `schtasks /xml` output, which Windows may write as UTF-16.
#[cfg(any(windows, test))]
fn task_xml_text(bytes: &[u8]) -> String {
    if bytes.len() >= 2 && bytes.contains(&0) {
        let units: Vec<u16> = bytes.chunks_exact(2).map(|pair| u16::from_le_bytes([pair[0], pair[1]])).collect();
        String::from_utf16_lossy(&units)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}

/// The update watch task stores the path of the program that registered it.
/// Up to 1.16.1 that was `pc-tweaker-app	auri-app.exe`; since the move to the
/// PC Tweaker name it would start a file that no longer exists. When the task
/// is registered and points anywhere but this program, register it again with
/// the same schedule. Nothing happens when the watch is off.
#[cfg(windows)]
fn refresh_drift_watch_target() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let Ok(exe) = std::env::current_exe() else { return };
    let Ok(output) = crate::system_tools::run("schtasks", |tool| {
        tool.args(["/query", "/tn", updatewatch::TASK_NAME, "/xml"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
    }) else {
        return;
    };
    if !output.status.success() {
        return;
    }
    let xml = task_xml_text(&output.stdout).to_lowercase();
    if !xml.contains(&exe.to_string_lossy().to_lowercase()) {
        let _ = configure_drift_watch(true);
    }
}

#[cfg(windows)]
fn configure_drift_watch(enabled: bool) -> Result<(), String> {
    configure_logon_task(updatewatch::TASK_NAME, "--check-drift", "0002:00", enabled)
}

/// Registers (or removes) a task that starts this program with one flag a
/// few minutes after the user signs in, with the user's limited rights.
#[cfg(windows)]
fn configure_logon_task(task: &str, flag: &str, delay: &str, enabled: bool) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let exe = std::env::current_exe()
        .map_err(|e| format!("could not locate the application: {e}"))?
        .to_string_lossy()
        .to_string();

    let args: Vec<String> = if enabled {
        vec![
            "/create".into(),
            "/f".into(),
            "/tn".into(),
            task.into(),
            "/tr".into(),
            format!("\"{exe}\" {flag}"),
            "/sc".into(),
            "onlogon".into(),
            "/delay".into(),
            delay.into(),
            "/rl".into(),
            "LIMITED".into(),
        ]
    } else {
        vec!["/delete".into(), "/f".into(), "/tn".into(), task.into()]
    };

    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let output = crate::system_tools::run("schtasks", |tool| {
        tool.args(&refs).creation_flags(CREATE_NO_WINDOW).output()
    })
    .map_err(|e| format!("could not run schtasks: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Err(if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("Task Scheduler exited with code {:?}", output.status.code())
        })
    }
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn drift_watch_enabled() -> bool {
    false
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn set_drift_watch(_enabled: bool) -> Result<bool, String> {
    Err("the update watchdog is Windows-only".to_string())
}

/// The scheduled temporary-file cleanup: a logon task, at most one pass a
/// week, limited rights, and only files untouched for a day.
pub(crate) const TEMP_CLEANUP_TASK: &str = "PC Tweaker Temp Cleanup";
const TEMP_CLEANUP_STATE: &str = "temp-cleanup-schedule.json";
const TEMP_CLEANUP_EVERY: std::time::Duration = std::time::Duration::from_secs(7 * 24 * 3600);
const TEMP_CLEANUP_MIN_AGE: std::time::Duration = std::time::Duration::from_secs(24 * 3600);

#[cfg(windows)]
fn task_registered(task: &str) -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    crate::system_tools::run("schtasks", |tool| {
        tool.args(["/query", "/tn", task])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
    })
    .map(|o| o.status.success())
    .unwrap_or(false)
}

#[cfg(windows)]
#[tauri::command(async)]
fn scheduled_cleanup_enabled() -> bool {
    task_registered(TEMP_CLEANUP_TASK)
}

/// Turning the weekly cleanup on needs Pro; turning it off never does.
#[cfg(windows)]
#[tauri::command(async)]
fn set_scheduled_cleanup(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    if enabled {
        require_pro(&store_for_dir(&app)?)?;
    }
    configure_logon_task(TEMP_CLEANUP_TASK, "--scheduled-temp-cleanup", "0010:00", enabled)?;
    let actual = task_registered(TEMP_CLEANUP_TASK);
    if actual != enabled {
        return Err("Windows did not keep the scheduled cleanup task".to_string());
    }
    audit::record(
        "temp-cleanup-schedule",
        if enabled { "enabled" } else { "disabled" },
        true,
        None,
    );
    Ok(actual)
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn scheduled_cleanup_enabled() -> bool {
    false
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn set_scheduled_cleanup(_app: tauri::AppHandle, _enabled: bool) -> Result<bool, String> {
    Err("not supported on this platform".to_string())
}

#[derive(Serialize, serde::Deserialize, Default)]
struct TempCleanupState {
    last_run: u64,
}

/// Whether a week has passed since the last pass. Pure.
fn temp_cleanup_due(last_run: u64, now: u64) -> bool {
    now.saturating_sub(last_run) >= TEMP_CLEANUP_EVERY.as_secs()
}

/// The scheduled half: no window, user rights, at most weekly. It waits for
/// another logon while a game is running and never touches memory.
#[cfg(windows)]
pub fn run_scheduled_temp_cleanup_headless() -> ! {
    let dir = dirs_app_data_dir();
    crash::install(dir.clone(), crash::PROCESS_ELEVATED);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let path = dir.join(TEMP_CLEANUP_STATE);
    let state: TempCleanupState = std::fs::read(&path)
        .ok()
        .and_then(|raw| serde_json::from_slice(&raw).ok())
        .unwrap_or_default();
    if require_pro(&dir).is_err() || !temp_cleanup_due(state.last_run, now) {
        std::process::exit(0);
    }
    if process_guard::paused(&dir) || game_sessions::registered_game_running(&dir) {
        audit::record("temp-cleanup-scheduled", "postponed", true, None);
        std::process::exit(0);
    }
    let result = cleanup::run_cleanup_older_than("temp_cleanup", TEMP_CLEANUP_MIN_AGE);
    audit::record(
        "temp-cleanup-scheduled",
        "temp_cleanup",
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    if result.is_ok() {
        if let Ok(json) = serde_json::to_vec(&TempCleanupState { last_run: now }) {
            let _ = std::fs::write(&path, json);
        }
    }
    std::process::exit(0)
}

/// The scheduled half of the update watchdog.
///
/// Runs the same comparison `check_update_drift` does, with no window and no
/// Tauri app, and exits. If anything the user applied is no longer in effect
/// it says so with a toast; if nothing moved it says nothing at all, which is
/// the behaviour that keeps the notification worth reading.
///
/// Exit code 0 either way. This is a watchdog, not a test: a Windows update
/// undoing tweaks is the expected case it exists to report, not a failure of
/// this process.
#[cfg(windows)]
pub fn run_drift_check_headless() -> ! {
    let dir = dirs_app_data_dir();
    crash::install(dir.clone(), crash::PROCESS_ELEVATED);

    let store = RollbackStore::new(dir.clone());
    let applied_ids = match store.applied_ids() {
        Ok(ids) => ids,
        Err(error) => {
            eprintln!("could not read restore state: {}", error);
            std::process::exit(1);
        }
    };
    let Some(current) = updatewatch::current_patch_level() else {
        std::process::exit(0);
    };
    let previous = updatewatch::read_state(&dir).last_seen;

    let states: Vec<updatewatch::TweakState> = tweaks::all_tweaks()
        .iter()
        .filter(|t| !MANUAL_ONLY_TWEAKS.contains(&t.id))
        .map(|t| {
            let recorded_applied = applied_ids.contains(t.id);
            let live_matches = if recorded_applied {
                match t.read_current() {
                    Ok(Some(value)) => Some(value == t.on_value),
                    Ok(None) => Some(false),
                    Err(_) => None,
                }
            } else {
                None
            };
            updatewatch::TweakState {
                id: t.id.to_string(),
                recorded_applied,
                live_matches,
            }
        })
        .collect();

    let mut states = states;
    states.extend(settings_drift_states(&applied_ids));
    let report = updatewatch::build_report(previous, current.clone(), &states);
    let _ = updatewatch::write_state(
        &dir,
        &updatewatch::WatchState {
            last_seen: Some(current),
        },
    );

    if !report.reverted.is_empty() {
        audit::record(
            "update-drift",
            "scheduled",
            true,
            Some(format!("{} tweak(s) reverted", report.reverted.len())),
        );
        let _ = updatewatch::notify(report.reverted.len());
    }

    std::process::exit(0)
}

pub fn run_elevated_headless(action: &str, id: &str) -> ! {
    let dir = dirs_app_data_dir();
    // Checked before anything, including crash reporting, writes to it.
    if let Err(e) = elevation::ensure_plain_app_data_dir(&dir) {
        eprintln!("{e}");
        std::process::exit(1);
    }
    // This process has no window, so a panic here is silent: the user clicks
    // "apply", the UAC prompt closes, and nothing happens with no explanation
    // anywhere. Recording it is the only way that failure is ever seen.
    crash::install(dir.clone(), crash::PROCESS_ELEVATED);
    // A read-only measurement: nothing to protect with a restore point.
    if action == diagnostics::dpc::ELEVATED_FLAG {
        std::process::exit(diagnostics::dpc::run_elevated(&dir, id));
    }
    // A RAM trim changes no setting, so it needs no restore point either.
    if action == "--elevated-ramtrim" {
        let code = match ramclean::run_elevated(&dir) {
            Ok(()) => 0,
            Err(e) => {
                eprintln!("{e}");
                1
            }
        };
        std::process::exit(code);
    }
    let store = RollbackStore::new(dir.clone());

    // Safety net first: a System Restore point before any elevated change.
    // Best-effort by design â€” Windows throttles restore points (one per 24h
    // by default) and System Restore can be disabled entirely, and neither
    // condition may block an action the user asked for. The outcome lands in
    // the audit log either way, so "was I protected?" always has an answer.
    match restore_point::create_restore_point() {
        restore_point::RestorePointOutcome::Created => {
            audit::record("restore-point", "system", true, None);
        }
        restore_point::RestorePointOutcome::Failed { reason } => {
            audit::record("restore-point", "system", false, Some(reason));
        }
        restore_point::RestorePointOutcome::Skipped { .. } => {}
    }

    let result: Result<(), String> = match action {
        "--elevated-download-limit" => require_pro(&dir).and_then(|_| {
            let kbps=id.parse::<u32>().map_err(|_|"Invalid bandwidth".to_string())?;
            download_limit::configure(&store,kbps).map(|_|())
        }),
        "--elevated-download-restore" if id == "restore" => download_limit::rollback(&store).map(|_|()),
        "--elevated-session-apply" => game_sessions::validate_owner_token(id)
            .and_then(|_| require_pro(&dir))
            .and_then(|_| turbo::apply_for_session(&store, id).map(|_| ())),
        "--elevated-session-rollback" => game_sessions::validate_owner_token(id)
            .and_then(|_| turbo::rollback_for_session(&store, id).map(|_| ())),
        "--elevated-apply" => apply_by_id(&store, &dir, id),
        "--elevated-apply-many" => {
            // One prompt, many tweaks: keep going past a failure so a single
            // unsupported tweak doesn't cancel everything else the user asked for.
            let mut failed = Vec::new();
            let batch = bulk_applicable(id.split(',').map(str::to_owned).collect());
            for one in batch.iter().filter(|s| !s.is_empty()) {
                if let Err(e) = apply_by_id(&store, &dir, one) {
                    failed.push(format!("{}: {}", one, e));
                }
            }
            if failed.is_empty() {
                Ok(())
            } else {
                Err(failed.join("; "))
            }
        }
        "--elevated-rollback" => rollback_by_id(&store, id),
        "--elevated-rollback-many" => {
            // Mirror of --elevated-apply-many for "Restore all": one prompt for
            // the whole batch, and one failing tweak must not strand the rest
            // in their applied state.
            let mut failed = Vec::new();
            for one in id.split(',').filter(|s| !s.is_empty()) {
                if let Err(e) = rollback_by_id(&store, one) {
                    failed.push(format!("{}: {}", one, e));
                }
            }
            if failed.is_empty() {
                Ok(())
            } else {
                Err(failed.join("; "))
            }
        }
        "--elevated-driverupdate" => {
            let result = driverupdate::install_elevated(&dir, id);
            audit::record(
                "driver-update",
                "windows-update",
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result
        }
        "--elevated-gpupower" => {
            let result = gpupower::apply_elevated(id);
            audit::record(
                "gpu-power-limit",
                id,
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result
        }
        "--elevated-startup" => {
            let result = startup::apply_from_payload(id);
            audit::record(
                "startup-change",
                id,
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result
        }
        "--elevated-cleanup" => {
            let result =
                authorize_elevated_cleanup(&dir, id).and_then(|_| cleanup::run_cleanup(id));
            audit::record(
                "cleanup",
                id,
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result.and_then(|res| {
                let json = serde_json::to_string(&res).map_err(|e| e.to_string())?;
                std::fs::write(dir.join("last_cleanup_result.json"), json)
                    .map_err(|e| e.to_string())
            })
        }
        "--elevated-cleanup-sel" => {
            // Re-decoded and re-validated on this side: the elevated entry
            // point must not trust that its caller was our own app.
            let result = cleanup::decode_selected_payload(id).and_then(|(cleanup_id, names)| {
                authorize_elevated_cleanup(&dir, &cleanup_id)?;
                let outcome = cleanup::run_cleanup_selected(&cleanup_id, &names);
                audit::record(
                    "cleanup",
                    &cleanup_id,
                    outcome.is_ok(),
                    Some(format!("{} selected items", names.len())),
                );
                outcome
            });
            result.and_then(|res| {
                let json = serde_json::to_string(&res).map_err(|e| e.to_string())?;
                std::fs::write(dir.join("last_cleanup_result.json"), json)
                    .map_err(|e| e.to_string())
            })
        }
        // Re-validated on this side too: the elevated entry point is a plain
        // CLI flag, so it must not trust that its caller was our own app.
        "--elevated-diskopt" => {
            let result = require_pro(&dir)
                .and_then(|_| diskinfo::validate_drive(id))
                .and_then(|drive| diskopt::optimize(&drive));
            audit::record(
                "disk-optimize",
                id,
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result.and_then(|res| {
                let json = serde_json::to_string(&res).map_err(|e| e.to_string())?;
                std::fs::write(dir.join("last_diskopt_result.json"), json)
                    .map_err(|e| e.to_string())
            })
        }
        // Progress is written to a file the unelevated parent polls: this
        // process has no AppHandle, so it cannot emit events itself.
        "--elevated-securedefrag" => {
            let progress_path = defrag_progress_path(&dir);
            let drive = require_pro(&dir).and_then(|_| diskinfo::validate_drive(id));
            let result = drive.and_then(|drive| {
                securedefrag::run(&drive, |p| {
                    if let Ok(json) = serde_json::to_string(&p) {
                        let _ = std::fs::write(&progress_path, json);
                    }
                })
            });
            audit::record(
                "secure-defrag",
                id,
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result.and_then(|res| {
                let json = serde_json::to_string(&res).map_err(|e| e.to_string())?;
                std::fs::write(dir.join("last_diskopt_result.json"), json)
                    .map_err(|e| e.to_string())
            })
        }

        "--elevated-memorypurge" => {
            let result = require_pro(&dir).and_then(|_| zerotrace::purge_standby_memory());
            audit::record(
                "memory-purge",
                id,
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result.and_then(|res| {
                let json = serde_json::to_string(&res).map_err(|e| e.to_string())?;
                std::fs::write(dir.join("last_purge_result.json"), json).map_err(|e| e.to_string())
            })
        }

        // Progress goes to a file the unelevated parent polls, exactly as the
        // secure defrag does â€” this process has no AppHandle to emit from.
        "--elevated-repair" => {
            let progress_path = repair_progress_path(&dir);
            let result = sysrepair::RepairJob::from_id(id).and_then(|job| {
                // Same gate as `run_system_repair`: only the check is free.
                if job != sysrepair::RepairJob::Check {
                    require_pro(&dir)?;
                }
                sysrepair::run(job, |p| {
                    if let Ok(json) = serde_json::to_string(&p) {
                        let _ = std::fs::write(&progress_path, json);
                    }
                })
            });
            audit::record(
                "system-repair",
                id,
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result.and_then(|res| {
                let json = serde_json::to_string(&res).map_err(|e| e.to_string())?;
                std::fs::write(dir.join("last_repair_result.json"), json).map_err(|e| e.to_string())
            })
        }

        // Re-validated on this side: the payload arrives as a bare command-line
        // argument, so the privileged path must not assume our own UI sent it.
        "--elevated-task" => {
            let result = scheduledtasks::apply_from_payload(id);
            audit::record(
                "scheduled-task-change",
                id,
                result.is_ok(),
                result.as_ref().err().cloned(),
            );
            result
        }

        "--elevated-drift-watch" => match id {
            "enable" => configure_drift_watch(true),
            "disable" => configure_drift_watch(false),
            _ => Err("invalid update watch action".to_string()),
        },

        other => Err(format!("unknown action: {}", other)),
    };

    match result {
        Ok(()) => std::process::exit(0),
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    }
}

#[cfg(windows)]
pub(crate) fn dirs_app_data_dir() -> std::path::PathBuf {
    // Mirrors Tauri's own resolution (%APPDATA%/<identifier>) without needing
    // a running AppHandle, since the elevated helper process never builds a UI.
    // The identifier is the one this build was configured with (see build.rs):
    // a fixed name sent a dev build's administrator changes to the installed
    // app's folder, so the dev window never saw them applied.
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(base).join(env!("PCT_APP_IDENTIFIER"))
}

/// Last audit entries, newest first, for the dashboard's history card. The
/// full file stays on disk for anyone who wants the complete record.
#[tauri::command(async)]
fn list_audit_log(app: tauri::AppHandle) -> Result<Vec<audit::AuditEntry>, String> {
    let dir = store_for_dir(&app)?;
    Ok(audit::list_in(&dir, 100))
}

/// Crash reports recorded on this machine, newest first.
///
/// Read from the same folder both processes write to, so a crash in the
/// elevated helper shows up here even though that process never had a window.
/// Whether Windows has undone any applied tweak since the last look.
///
/// Reads two independent things â€” the patch level, and the live value of
/// every registry tweak the rollback store says is applied â€” and records the
/// patch level for next time. Never changes anything: re-applying is a
/// button, because a watchdog that silently re-applied would make system
/// changes at the moment the user least expects them.
#[cfg(windows)]
#[tauri::command(async)]
fn check_update_drift(app: tauri::AppHandle) -> Result<updatewatch::DriftReport, String> {
    let dir = store_for_dir(&app)?;
    let store = RollbackStore::new(dir.clone());
    let applied_ids = store.applied_ids()?;

    let current = updatewatch::current_patch_level()
        .ok_or_else(|| "could not read the Windows patch level".to_string())?;
    let previous = updatewatch::read_state(&dir).last_seen;

    // Only the registry tweaks: those are the ones whose live state can be
    // read back and compared without touching anything. The composite tweaks
    // (power plans, services, network) each answer "am I on" their own way,
    // and guessing a shared shape for them would report drift that is not
    // there.
    let states: Vec<updatewatch::TweakState> = tweaks::all_tweaks()
        .into_iter()
        .filter(|t| !MANUAL_ONLY_TWEAKS.contains(&t.id))
        .map(|t| {
            let recorded_applied = applied_ids.contains(t.id);
            let live_matches = if recorded_applied {
                match t.read_current() {
                    Ok(Some(value)) => Some(value == t.on_value),
                    // The value is gone entirely, which for a tweak that
                    // writes one is as reverted as a wrong value.
                    Ok(None) => Some(false),
                    Err(_) => None,
                }
            } else {
                None
            };
            updatewatch::TweakState {
                id: t.id.to_string(),
                recorded_applied,
                live_matches,
            }
        })
        .collect();

    let mut states = states;
    states.extend(settings_drift_states(&applied_ids));
    let report = updatewatch::build_report(previous, current, &states);

    // Recorded after the comparison, so a failure above leaves the previous
    // baseline intact rather than swallowing an update nobody was told about.
    let _ = updatewatch::write_state(
        &dir,
        &updatewatch::WatchState {
            last_seen: Some(current),
        },
    );

    Ok(report)
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn check_update_drift(_app: tauri::AppHandle) -> Result<updatewatch::DriftReport, String> {
    Err("the update watchdog is Windows-only".to_string())
}

#[tauri::command(async)]
fn list_crash_reports(app: tauri::AppHandle) -> Result<Vec<crash::CrashReport>, String> {
    let dir = store_for_dir(&app)?;
    Ok(crash::list_in(&dir))
}

#[tauri::command(async)]
fn clear_crash_reports(app: tauri::AppHandle) -> Result<(), String> {
    let dir = store_for_dir(&app)?;
    crash::clear_in(&dir)
}

#[tauri::command(async)]
fn clear_audit_log(app: tauri::AppHandle) -> Result<(), String> {
    let dir = store_for_dir(&app)?;
    audit::clear_in(&dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Before anything else: a panic during startup is exactly the one a user
    // cannot describe, because there is no window yet to describe it from.
    crash::install(dirs_app_data_dir(), crash::PROCESS_APP);

    tauri::Builder::default()
        // First, so a second launch exits before it starts a monitor, a game
        // session watcher or a scheduled cleanup of its own. Closing to the
        // tray made this common: the shortcut opened a new copy beside the
        // hidden one. Elevated and headless relaunches exit in main() first.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().default_version_comparator(|current, release| {
            release.version > current
                && update_identity::release_matches(&release.version.to_string(), &release.data)
        }).build())
        .plugin(tauri_plugin_process::init())
        .manage(sysmon::SysMonState::new())
        .manage(fps::FpsState::default())
        .manage(systemprofile::SystemProfileState::new())
        .on_window_event(tray::window_event)
        .setup(|app| {
            window_state::restore(app);
            tray::setup(app)?;
            debloat::reconcile_on_startup(app.handle());
            game_sessions::spawn_watcher(app.handle().clone());
            ecoqos::start(app.handle().clone());
            process_rules::start(app.handle().clone());
            #[cfg(windows)]
            std::thread::spawn(refresh_drift_watch_target);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            debloat::list_debloat_apps,
            debloat::remove_debloat_app,
            debloat::debloat_history,
            debloat::debloat_reinstall_link,
            ecoqos::ecoqos_status,
            ecoqos::ecoqos_add_rule,
            ecoqos::ecoqos_remove_rule,
            ecoqos::ecoqos_set_enabled,
            monitor_profiles::monitor_profiles_state,
            monitor_profiles::monitor_save_rule,
            monitor_profiles::monitor_remove_rule,
            monitor_profiles::monitor_set_enabled,
            monitor_profiles::monitor_preview,
            monitor_profiles::monitor_confirm,
            monitor_profiles::monitor_restore,
            download_limit_state,
            set_download_limit,
            restore_download_limit,
            save_avatar,
            hud::hud_snapshot,
            secure_defrag,
            purge_standby_memory,
            shred_files,
            open_hud_overlay,
            set_hud_click_through,
            set_hud_compact,
            hud_is_compact,
            hud_is_open,
            close_hud_overlay,
            read_avatar,
            clear_avatar,
            adopt_legacy_avatar,
            discard_legacy_avatar,
            systemprofile::system_profile,
            health::health_report,
            healthhistory::list_health_history,
            drift_watch_enabled,
            set_drift_watch,
            baseline::run_baseline,
            baseline::list_baselines,
            recommend::advise_tweaks,
            recommend::scan_relevant_ids,
            cpuclock::cpu_clock,
            cpubench::cpu_benchmark,
            cpubench::boost_probe,
            profiles::capture_profile,
            profiles::save_profile,
            profiles::list_profiles,
            profiles::delete_profile,
            profiles::export_profile,
            profiles::import_profile,
            profiles::write_profile_file,
            profiles::read_profile_file,
            lifetime_tools::compare_lifetime_profiles,
            lifetime_tools::preview_lifetime_report,
            lifetime_tools::save_lifetime_report,
            license::save_license,
            license::license_status,
            license::clear_license,
            list_tweaks,
            apply_tweak,
            apply_tweaks,
            rollback_tweaks,
            rollback_tweak,
            list_cleanup_targets,
            run_cleanup,
            preview_cleanup,
            run_cleanup_selected,
            list_browser_cleanup,
            run_browser_cleanup,
            scan_duplicates,
            cancel_folder_scan,
            delete_files,
            game_sessions::list_game_sessions,
            game_sessions::game_sessions_enabled,
            game_sessions::set_game_sessions_enabled,
            game_sessions::add_game_session,
            game_sessions::remove_game_session,
            startup::list_startup_items,
            startup::set_startup_enabled,
            list_audit_log,
            check_update_drift,
            list_crash_reports,
            clear_crash_reports,
            sysmon::system_stats,
            livemetrics::live_sample,
            livemetrics::resource_users,
            gaming::turbo_boost_already_set,
            fps::imp::start_fps_capture,
            fps::imp::stop_fps_capture,
            fps::imp::fps_status,
            fps::imp::fps_snapshot,
            ramclean::clean_ram,
            ramclean::top_memory_processes,
            scan_large_files,
            optimize_disk,
            diskhealth::disk_health,
            diskinfo::list_drives_cmd,
            thermals::thermal_report,
            thermals::gpu_readings,
            drivers::driver_audit,
            drivers::cancel_scan,
            drivers::discard_scan_session,
            gpupower::gpu_power_info,
            gpupower::set_gpu_profile,
            drivers::open_windows_update,
            drivers::reboot_pending,
            drivers::reboot_now,
            driverupdate::search_driver_updates,
            driverupdate::install_driver_updates,
            x3d::x3d_report,
            x3d::x3d_processes,
            x3d::x3d_align,
            x3d::x3d_reset,
            clear_audit_log,
            run_system_repair,
            appcache::scan_app_caches,
            appcache::clean_app_caches,
            cookies::scan_cookies,
            cookies::clean_cookies,
            cookies::restore_cookies,
            cookies::cookie_whitelist,
            cookies::set_cookie_whitelist,
            scheduledtasks::list_scheduled_tasks,
            scheduledtasks::set_scheduled_task_enabled,
            netmaintenance::flush_dns_cache,
            diagnostics::network_verify::verify_network,
            diagnostics::network_verify::last_network_verification,
            diagnostics::dpc::trace_dpc_latency,
            engine::dynamic_session::core_steering_status,
            game_sessions::set_core_steering,
            preview_tweak,
            scheduled_cleanup_enabled,
            set_scheduled_cleanup,
            process_rules::priority_rules_status,
            process_rules::priority_rules_add,
            process_rules::priority_rules_remove,
            process_rules::priority_rules_set_enabled,
            process_rules::priority_rules_set_priority,
            process_guard::process_guard_status,
            process_guard::set_process_guard,
            process_guard::set_process_guard_hold,
            is_store_install
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Err(error) = ecoqos::stop(app) {
                    eprintln!("EcoQoS recovery remains pending: {error}");
                }
                if let Err(error) = process_rules::stop(app) {
                    eprintln!("priority recovery remains pending: {error}");
                }
                #[cfg(windows)]
                diagnostics::dpc::native::abort_if_running();
                // Background apps must not stay on the E-cores after the
                // app that put them there has gone.
                if let Err(error) = store_for(app).and_then(|store| {
                    engine::dynamic_session::restore_owned_by_this_process(&store)
                }) {
                    eprintln!("core steering recovery remains pending: {error}");
                }
            }
        });
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn task_xml_is_read_in_either_encoding() {
        let text = r"<Command>C:\Apps\PC Tweaker\PC Tweaker.exe</Command>";
        let utf16: Vec<u8> = text.encode_utf16().flat_map(u16::to_le_bytes).collect();
        assert_eq!(task_xml_text(text.as_bytes()), text);
        assert_eq!(task_xml_text(&utf16), text);
    }

    /// Every id the UI can show, gathered from the same places `list_tweaks`
    /// gathers them.
    pub(crate) fn all_visible_ids() -> Vec<String> {
        let mut ids: Vec<String> = tweaks::all_tweaks()
            .iter()
            .filter(|t| t.id != "disable_copilot")
            .map(|t| t.id.to_string())
            .collect();
        ids.extend(
            [
                power::TWEAK_ID,
                turbo::TWEAK_ID,
                dns::TWEAK_ID,
                gaming::INPUT_LAG_ID,
                gaming::TURBO_BOOST_ID,
                gaming::KEYBOARD_DELAY_ID,
                gaming::CORE_PARKING_ID,
                game_priority::TWEAK_ID,
                privacy_extra::ACTIVITY_HISTORY_ID,
                privacy_extra::TYPING_PERSONALIZATION_ID,
                contextmenu::TWEAK_ID,
                services::WINDOWS_SEARCH_ID,
                netlatency::TWEAK_ID,
                netshaper::TWEAK_ID,
                everyday::DISABLE_FILTER_KEYS_SHORTCUT_ID,
                "ecoqos_rules",
                download_limit::TWEAK_ID,
                "monitor_refresh_profile",
            ]
            .iter()
            .map(|s| s.to_string()),
        );
        ids.extend(power_tuning::TWEAKS.iter().map(|t| t.id.to_string()));
        ids.extend(settings_tweaks::TWEAKS.iter().map(|t| t.id.to_string()));
        ids.push(services::AI_FABRIC_ID.to_string());
        ids
    }

    /// Two tweaks sharing an id would silently collide in the rollback store:
    /// applying one would overwrite the other's snapshot and their toggles
    /// would appear linked. Cheap to prevent, nasty to debug.
    #[test]
    fn every_tweak_id_is_unique() {
        let ids = all_visible_ids();
        let mut seen = std::collections::HashSet::new();
        for id in &ids {
            assert!(seen.insert(id.clone()), "duplicate tweak id: {}", id);
        }
    }

    #[test]
    fn expansion_entitlement_and_elevation_routing() {
        let dir = std::env::temp_dir().join(format!("pct-expansion-unlicensed-{}", std::process::id()));
        for id in ["ecoqos_rules", "limit_do_background_download", "monitor_refresh_profile"] {
            assert!(require_tweak_entitlement(&dir,id).unwrap_err().starts_with(PRO_REQUIRED_PREFIX));
        }
        for id in ["disable_restart_apps", "enable_long_paths", "disable_filter_keys_shortcut"] {
            assert!(require_tweak_entitlement(&dir,id).is_ok());
        }
        assert!(requires_admin_for("limit_do_background_download"));
        assert!(requires_admin_for("enable_long_paths"));
        assert!(!requires_admin_for("disable_restart_apps"));
        assert!(!requires_admin_for("disable_filter_keys_shortcut"));
    }

    /// The Scan screen's "fix all" must produce at most one elevation request,
    /// no matter how many admin tweaks were selected â€” the whole point of
    /// batching. This asserts the grouping without actually elevating.
    #[test]
    fn the_scheduled_cleanup_runs_at_most_once_a_week() {
        let week = 7 * 24 * 3600;
        assert!(temp_cleanup_due(0, week));
        assert!(!temp_cleanup_due(1_000, 1_000 + week - 1));
        assert!(temp_cleanup_due(1_000, 1_000 + week));
        // A clock set backwards never makes it run again early.
        assert!(!temp_cleanup_due(5_000, 4_000));
    }

    /// Memory Integrity is turned off only by its own switch: every bulk path
    /// (batch apply, profiles, update re-apply) filters it out, and nothing
    /// else is dropped on the way.
    #[test]
    fn manual_only_tweaks_never_ride_along_in_a_batch() {
        let ids = all_visible_ids();
        assert!(ids.iter().any(|id| id == "disable_memory_integrity"));
        let bulk = bulk_applicable(ids.clone());
        assert!(!bulk.iter().any(|id| id == "disable_memory_integrity"));
        assert_eq!(bulk.len(), ids.len() - 1);
        assert!(MANUAL_ONLY_TWEAKS
            .iter()
            .all(|id| find_tweak(id).is_some_and(|t| t.requires_admin)));
    }

    #[test]
    fn admin_tweaks_collapse_into_one_elevated_batch() {
        let ids = all_visible_ids();
        let expected_admin = ids.iter().filter(|id| requires_admin_for(id)).count();
        assert!(
            expected_admin > 1,
            "test is meaningless without several admin tweaks"
        );

        let (needs_admin, direct) = split_by_elevation(ids.clone());

        assert_eq!(needs_admin.len(), expected_admin);
        assert_eq!(
            needs_admin.len() + direct.len(),
            ids.len(),
            "no tweak may be dropped"
        );
        assert!(direct.iter().all(|id| !requires_admin_for(id)));

        // One payload -> one `run_elevated_action` call -> one UAC prompt.
        let payload = needs_admin.join(",");
        let round_tripped: Vec<&str> = payload.split(',').filter(|s| !s.is_empty()).collect();
        assert_eq!(
            round_tripped, needs_admin,
            "payload must survive the join/split round trip"
        );
    }

    /// Exercise the production entitlement policy without invoking a Windows
    /// adapter. A temporary journal does not isolate actual registry writes.
    #[test]
    fn a_pro_tweak_is_refused_with_no_cached_license() {
        let ids = all_visible_ids();
        let pro_id = ids
            .iter()
            .find(|id| requires_pro_for(id))
            .expect("test is meaningless without at least one Pro-gated tweak");

        let dir = std::env::temp_dir().join(format!(
            "pc-tweaker-license-wiring-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let result = require_tweak_entitlement(&dir, pro_id);
        let err = result.expect_err("a Pro tweak must not silently succeed with no license cached");
        assert!(
            err.starts_with(PRO_REQUIRED_PREFIX),
            "expected a PRO_REQUIRED error for `{}`, got: {}",
            pro_id,
            err
        );
    }

    /// Cleanups: the Pro one is refused without a licence on every path, the
    /// free one stays free, and the elevated helper runs only the admin one.
    #[test]
    fn cleanup_gates_hold_without_a_license() {
        let dir = std::env::temp_dir().join(format!(
            "pc-tweaker-cleanup-gate-test-{}",
            std::process::id()
        ));
        assert_eq!(authorize_cleanup(&dir, "temp_cleanup"), Ok(false));
        let pro = authorize_cleanup(&dir, "winupdate_cache_cleanup").unwrap_err();
        assert!(pro.starts_with(PRO_REQUIRED_PREFIX), "{pro}");
        assert!(authorize_cleanup(&dir, "no_such_cleanup").is_err());
        assert!(authorize_elevated_cleanup(&dir, "temp_cleanup").is_err());
        assert!(authorize_elevated_cleanup(&dir, "winupdate_cache_cleanup")
            .unwrap_err()
            .starts_with(PRO_REQUIRED_PREFIX));
    }

    /// The catalogue's size and its free/Pro split, pinned.
    ///
    /// These two numbers are quoted on the website, in the Store listing and
    /// in the pricing card, and they have gone stale before: the site claimed
    /// "50 tweaks" for three releases after the count had moved. A test is the
    /// only place that notices, because nothing else reads all three sources
    /// at once. If this fails, the catalogue changed â€” update the numbers
    /// here, then update every surface listed above to match.
    #[test]
    fn the_catalogue_is_eighty_one_tweaks_thirty_five_of_them_pro() {
        let registry: Vec<_> = tweaks::all_tweaks().into_iter().filter(|t| t.id != "disable_copilot").collect();
        let registry_pro = registry.iter().filter(|t| t.requires_pro).count();

        // The composite tweaks, each owning its own Pro flag. Listed by hand
        // because they are built by hand in `list_tweaks`; keeping the two
        // lists side by side is what makes a forgotten entry visible.
        let composite_pro = [
            false, // power plan
            turbo::info().requires_pro,
            false, // private DNS
            gaming::input_lag_info().requires_pro,
            gaming::turbo_boost_info().requires_pro,
            game_priority::info().requires_pro,
            gaming::keyboard_delay_info().requires_pro,
            gaming::core_parking_info().requires_pro,
            netlatency::info().requires_pro,
            netshaper::info().requires_pro,
            privacy_extra::activity_history_info().requires_pro,
            privacy_extra::typing_personalization_info().requires_pro,
            contextmenu::info().requires_pro,
            services::windows_search_info().requires_pro,
            services::ai_fabric_info().requires_pro,
            false, // Filter Keys shortcut
            true, // background app EcoQoS
            true, // Delivery Optimization cap
            true, // monitor refresh profiles
        ];

        let settings = &settings_tweaks::TWEAKS;
        let total = registry.len() + composite_pro.len() + power_tuning::TWEAKS.len() + settings.len();
        let pro = registry_pro
            + composite_pro.iter().filter(|p| **p).count()
            + power_tuning::TWEAKS.iter().filter(|t| t.pro).count()
            + settings.iter().filter(|t| t.requires_pro).count();

        assert_eq!(total, 81, "the catalogue no longer has 81 tweaks");
        assert_eq!(pro, 35, "the Pro count moved");
        assert_eq!(total - pro, 46, "the free count moved");

        // The composite list must stay in step with what list_tweaks builds,
        // otherwise the totals above would quietly stop covering everything.
        assert_eq!(
            composite_pro.len() + power_tuning::TWEAKS.len() + settings.len(),
            all_visible_ids().len() - registry.len(),
            "a composite tweak was added or removed without updating this test",
        );
    }

    #[test]
    fn a_free_tweak_is_never_blocked_by_the_license_check() {
        let ids = all_visible_ids();
        let free_id = ids
            .iter()
            .find(|id| !requires_pro_for(id))
            .expect("test is meaningless without at least one free tweak");

        let dir = std::env::temp_dir().join(format!(
            "pc-tweaker-license-wiring-test-free-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        assert!(require_tweak_entitlement(&dir, free_id).is_ok());
        for id in ids.iter().filter(|id| !requires_pro_for(id)) {
            assert!(require_tweak_entitlement(&dir, id).is_ok());
        }
        assert!(
            !dir.exists(),
            "policy checks must not create a system journal"
        );
    }

    #[test]
    fn duplicate_batch_ids_execute_only_once_and_keep_input_order() {
        let ids = all_visible_ids();
        let free = ids.iter().find(|id| !requires_admin_for(id)).unwrap();
        let admin = ids.iter().find(|id| requires_admin_for(id)).unwrap();
        let (elevated, direct) = split_by_elevation(vec![
            free.clone(),
            admin.clone(),
            free.clone(),
            admin.clone(),
        ]);
        assert_eq!(elevated, vec![admin.clone()]);
        assert_eq!(direct, vec![free.clone()]);
    }

    /// No id may contain the separator used to pass the batch to the elevated
    /// helper, or ids would be split into fragments and silently fail there.
    #[test]
    fn no_tweak_id_contains_the_batch_separator() {
        for id in all_visible_ids() {
            assert!(
                !id.contains(','),
                "id `{}` would break the batch payload",
                id
            );
        }
    }

    /// Two registry tweaks pointing at the same hive+key+value would fight each
    /// other: applying the second snapshots the *first one's* new value as if it
    /// were the original, so rolling back would restore the wrong thing. The
    /// ids would differ, so `every_tweak_id_is_unique` would not notice.
    #[test]
    fn no_two_tweaks_write_the_same_registry_value() {
        let mut seen = std::collections::HashSet::new();
        for t in tweaks::all_tweaks() {
            let target = (hive_str(&t.hive), t.key_path, t.value_name);
            assert!(
                seen.insert(target),
                "`{}` writes {}\\{}\\{}, which another tweak already writes",
                t.id,
                hive_str(&t.hive),
                t.key_path,
                t.value_name
            );
        }
    }

    /// The frontend falls back to the English name/description baked into
    /// these Rust structs whenever a tweak id is missing from `s.tweaks`, so a
    /// forgotten translation doesn't fail loudly â€” it just leaves one English
    /// row sitting in an otherwise Italian (or French, â€¦) list. That is
    /// exactly the "some parts aren't translated" symptom users report, and
    /// nothing else catches it, so assert here that every id the UI can show
    /// has an entry in every locale.
    #[test]
    fn every_id_is_translated_in_every_language() {
        let i18n = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/i18n.ts"))
            .expect("could not read src/i18n.ts");

        // One `STRINGS` entry per language; each locale object repeats the
        // same id keys, so a fully translated id appears once per locale.
        let locale_count = i18n.matches("  tweaks: {").count();
        assert!(
            locale_count >= 5,
            "expected at least 5 locales, found {}",
            locale_count
        );

        let mut ids = all_visible_ids();
        ids.extend(cleanup::cleanup_targets().iter().map(|t| t.id.to_string()));

        let mut missing = Vec::new();
        for id in &ids {
            let found = i18n.matches(&format!("\n    {}: {{", id)).count();
            if found < locale_count {
                missing.push(format!(
                    "{} (translated in {}/{} languages)",
                    id, found, locale_count
                ));
            }
        }

        assert!(
            missing.is_empty(),
            "these ids are not translated in every language:\n  {}",
            missing.join("\n  ")
        );
    }
}

/* ================================================================== *
 * Pro features added in the Zero-Trace / Secure Defrag / HUD set.
 *
 * Every command here gates on the signed licence in Rust, not only in
 * the UI. The frontend gate is a courtesy that keeps the paywall
 * pleasant; this one is the actual boundary, because `invoke` is
 * reachable from anything that can talk to the IPC channel.
 * ================================================================== */

/// Shared Pro gate. Returns the `PRO_REQUIRED_PREFIX` error the frontend
/// already knows how to turn into a paywall rather than a red toast.
pub(crate) fn require_pro(app_data_dir: &std::path::Path) -> Result<(), String> {
    if license::LicenseStore::new(app_data_dir.to_path_buf()).is_pro_and_fresh() {
        return Ok(());
    }
    Err(format!(
        "{}this feature requires an active PC Tweaker Pro license",
        PRO_REQUIRED_PREFIX
    ))
}

/// Where the elevated helper leaves defrag progress for the GUI to pick up.
///
/// The elevated child has no `AppHandle` and therefore cannot emit events, so
/// live progress crosses the UAC boundary as a file the parent polls. Same
/// handoff the cleanup and diskopt results already use, just written
/// repeatedly during the run instead of once at the end.
pub(crate) fn defrag_progress_path(dir: &std::path::Path) -> std::path::PathBuf {
    dir.join("defrag_progress.json")
}

#[cfg(windows)]
#[tauri::command(async)]
fn secure_defrag(
    app: tauri::AppHandle,
    drive: String,
) -> Result<securedefrag::DefragOutcome, String> {
    use tauri::Emitter;

    let dir = store_for_dir(&app)?;
    require_pro(&dir)?;
    let drive = diskinfo::validate_drive(&drive)?;

    if !elevation::is_elevated() {
        // Poll the progress file the elevated child writes, re-emitting each
        // update as the event the UI is already listening for. The thread
        // stops when the child exits, which `run_elevated_action` waits for.
        let progress_path = defrag_progress_path(&dir);
        let _ = std::fs::remove_file(&progress_path);
        let watcher_app = app.clone();
        let watch_path = progress_path.clone();
        let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let watcher_stop = stop.clone();
        let watcher = std::thread::spawn(move || {
            let mut last = String::new();
            while !watcher_stop.load(std::sync::atomic::Ordering::Relaxed) {
                if let Ok(json) = std::fs::read_to_string(&watch_path) {
                    if json != last && !json.trim().is_empty() {
                        if let Ok(p) = serde_json::from_str::<securedefrag::DefragProgress>(&json) {
                            let _ = watcher_app.emit("secure-defrag-progress", p);
                        }
                        last = json;
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
        });

        let elevated = elevation::run_elevated_action("--elevated-securedefrag", &drive);
        stop.store(true, std::sync::atomic::Ordering::Relaxed);
        let _ = watcher.join();
        elevated?;

        let path = last_diskopt_result_path(&app)?;
        let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(&progress_path);
        return serde_json::from_str(&json).map_err(|e| e.to_string());
    }

    let emitter = app.clone();
    let result = securedefrag::run(&drive, |p| {
        let _ = emitter.emit("secure-defrag-progress", p);
    });
    audit::record(
        "secure-defrag",
        &drive,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn secure_defrag(
    _app: tauri::AppHandle,
    _drive: String,
) -> Result<securedefrag::DefragOutcome, String> {
    Err("not supported on this platform".to_string())
}

/// Where the elevated helper leaves repair progress for the GUI to pick up.
/// Same handoff as `defrag_progress_path`, and for the same reason: the
/// elevated child has no `AppHandle`, and a DISM RestoreHealth that shows
/// nothing for twenty minutes reads as a hung application.
pub(crate) fn repair_progress_path(dir: &std::path::Path) -> std::path::PathBuf {
    dir.join("repair_progress.json")
}

/// Runs a DISM/SFC job, streaming progress to the UI.
///
/// The read-only check is free â€” it is the honest way to find out whether
/// there is anything to repair â€” while the repairs themselves are Pro.
#[cfg(windows)]
#[tauri::command(async)]
fn run_system_repair(
    app: tauri::AppHandle,
    job: String,
) -> Result<sysrepair::RepairOutcome, String> {
    use tauri::Emitter;

    let dir = store_for_dir(&app)?;
    let parsed = sysrepair::RepairJob::from_id(&job)?;
    if parsed != sysrepair::RepairJob::Check {
        require_pro(&dir)?;
    }
    let _guard = sysrepair::RunGuard::acquire()?;

    if !elevation::is_elevated() {
        // Poll the progress file the elevated child writes, re-emitting each
        // update as the event the UI is already listening for. The thread
        // stops when the child exits, which `run_elevated_action` waits for.
        let progress_path = repair_progress_path(&dir);
        let _ = std::fs::remove_file(&progress_path);
        let watcher_app = app.clone();
        let watch_path = progress_path.clone();
        let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let watcher_stop = stop.clone();
        let watcher = std::thread::spawn(move || {
            let mut last = String::new();
            while !watcher_stop.load(std::sync::atomic::Ordering::Relaxed) {
                if let Ok(json) = std::fs::read_to_string(&watch_path) {
                    if json != last && !json.trim().is_empty() {
                        if let Ok(p) = serde_json::from_str::<sysrepair::RepairProgress>(&json) {
                            let _ = watcher_app.emit("system-repair-progress", p);
                        }
                        last = json;
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
        });

        let elevated = elevation::run_elevated_action("--elevated-repair", parsed.id());
        stop.store(true, std::sync::atomic::Ordering::Relaxed);
        let _ = watcher.join();
        elevated?;

        let path = dir.join("last_repair_result.json");
        let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(&progress_path);
        return serde_json::from_str(&json).map_err(|e| e.to_string());
    }

    let emitter = app.clone();
    let result = sysrepair::run(parsed, |p| {
        let _ = emitter.emit("system-repair-progress", p);
    });
    audit::record(
        "system-repair",
        parsed.id(),
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

#[cfg(not(windows))]
#[tauri::command(async)]
fn run_system_repair(
    _app: tauri::AppHandle,
    _job: String,
) -> Result<sysrepair::RepairOutcome, String> {
    Err("not supported on this platform".to_string())
}

#[tauri::command(async)]
fn purge_standby_memory(app: tauri::AppHandle) -> Result<zerotrace::PurgeResult, String> {
    let dir = store_for_dir(&app)?;
    require_pro(&dir)?;

    if !elevation::is_elevated() {
        elevation::run_elevated_action("--elevated-memorypurge", "standby")?;
        let path = dir.join("last_purge_result.json");
        let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&path);
        return serde_json::from_str(&json).map_err(|e| e.to_string());
    }

    let result = zerotrace::purge_standby_memory();
    audit::record(
        "memory-purge",
        "standby",
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

/// Permanently destroys the given files.
///
/// Unelevated on purpose: a shredder that prompts for administrator rights
/// would invite people to point it at system files, and the guardrails inside
/// `shred_files` refuse those anyway. Anything the signed-in user cannot
/// already delete, this will not delete either.
#[tauri::command(async)]
fn shred_files(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<zerotrace::ShredResult, String> {
    let dir = store_for_dir(&app)?;
    require_pro(&dir)?;

    if paths.is_empty() {
        return Err("no files were selected".to_string());
    }
    // A single mistaken call should not be able to walk an entire drive.
    const MAX_FILES: usize = 500;
    if paths.len() > MAX_FILES {
        return Err(format!(
            "too many files at once: {} selected, {} is the limit",
            paths.len(),
            MAX_FILES
        ));
    }

    let result = zerotrace::shred_files(paths);
    audit::record(
        "secure-shred",
        &format!("{} files", result.shredded_count),
        true,
        None,
    );
    Ok(result)
}

/* ---------------------------------------------------------------- *
 * The in-game HUD window.
 * ---------------------------------------------------------------- */

/// Opens the overlay: a transparent, always-on-top, click-through window.
///
/// Click-through (`set_ignore_cursor_events`) is what makes it usable over a
/// game at all â€” without it the panel would swallow every click that landed on
/// it, which in a shooter is the difference between a HUD and a liability. It
/// also means the window needs no close button of its own: it is dismissed
/// from the same switch that opened it.
/// Stops Windows rounding the overlay window.
///
/// Windows 11 rounds the corners of every top-level window, including a
/// borderless transparent one. The panel already draws its own rounded
/// corners, and the two radii do not agree, so each corner was left with a
/// sliver between the system's curve and the panel's â€” small hard-edged
/// triangles against whatever was behind the overlay. Telling DWM to leave
/// this window square hands the corners back to the panel, which is the only
/// thing that should be shaping them.
#[cfg(windows)]
fn square_off_corners(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
    };
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let preference = DWMWCP_DONOTROUND;
    // SAFETY: a live window handle and a pointer to a local of the size the
    // attribute expects. Purely cosmetic, so a failure â€” on a Windows build
    // predating the attribute, for instance â€” is ignored rather than
    // surfaced: the overlay is entirely usable with rounded corners.
    unsafe {
        DwmSetWindowAttribute(
            hwnd.0 as _,
            DWMWA_WINDOW_CORNER_PREFERENCE as u32,
            std::ptr::addr_of!(preference).cast(),
            std::mem::size_of_val(&preference) as u32,
        );
    }
}

#[cfg(not(windows))]
fn square_off_corners(_window: &tauri::WebviewWindow) {}

#[tauri::command(async)]
fn open_hud_overlay(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    require_pro(&store_for_dir(&app)?)?;

    // Already open: make it visible again rather than building a second one.
    if let Some(existing) = app.get_webview_window("hud") {
        existing.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let dir = store_for_dir(&app)?;
    let placement = hud_window::read_placement(&dir);

    let window = WebviewWindowBuilder::new(&app, "hud", WebviewUrl::App("overlay.html".into()))
        .title("PC Tweaker HUD")
        .inner_size(
            hud_window::size_for(placement.compact).0,
            hud_window::size_for(placement.compact).1,
        )
        .position(placement.x, placement.y)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        // Kept out of the taskbar and the alt-tab list: it is an overlay, not
        // a window the user should have to manage.
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false)
        .build()
        .map_err(|e| format!("could not open the overlay: {}", e))?;

    // Opened interactive on purpose. Click-through is what this window wants
    // while a game is running, but applying it here left the overlay
    // impossible to place: it could not be grabbed, and a click aimed at it
    // landed on whatever was behind â€” on the desktop, that dragged the icons
    // underneath. It is now a mode the user turns on once the overlay sits
    // where they want it, from the same card that opened it.
    square_off_corners(&window);
    remember_position(app.clone(), &window);
    Ok(())
}

/// Persists the overlay's position as the user drags it.
///
/// Saved on move rather than on close because the overlay is usually still
/// open when a game exits or the machine shuts down, and a position that only
/// survived a clean close would be lost exactly when it mattered.
#[cfg(windows)]
fn remember_position(app: tauri::AppHandle, window: &tauri::WebviewWindow) {
    use tauri::{LogicalPosition, WindowEvent};

    let scale = window.scale_factor().unwrap_or(1.0);
    window.on_window_event(move |event| {
        if let WindowEvent::Moved(position) = event {
            let logical: LogicalPosition<f64> = position.to_logical(scale);
            let Ok(dir) = store_for_dir(&app) else { return };
            // A failed write costs the remembered position, nothing else, so
            // it must not interrupt a drag the user is in the middle of.
            // Re-read rather than assume: this closure only knows where the
            // window moved to, and writing a whole placement from that alone
            // would quietly reset the size the user picked.
            let current = hud_window::read_placement(&dir);
            let _ = hud_window::write_placement(
                &dir,
                hud_window::HudPlacement {
                    x: logical.x,
                    y: logical.y,
                    ..current
                },
            );
        }
    });
}

#[cfg(not(windows))]
fn remember_position(_app: tauri::AppHandle, _window: &tauri::WebviewWindow) {}

/// Turns the overlay's click-through mode on or off.
///
/// On: the window stops receiving the mouse entirely, so a click over it
/// reaches the game underneath â€” what an in-game overlay has to do. Off: it
/// can be grabbed and moved again.
/// Switches the overlay between its normal and compact sizes.
///
/// Resizes the window and tells the page, which drops the bars and the
/// process row so the smaller window is not just the same layout clipped.
#[tauri::command(async)]
fn set_hud_compact(app: tauri::AppHandle, compact: bool) -> Result<(), String> {
    use tauri::{Emitter, LogicalSize, Manager};

    let window = app
        .get_webview_window("hud")
        .ok_or_else(|| "the overlay is not open".to_string())?;
    let (w, h) = hud_window::size_for(compact);
    window
        .set_size(LogicalSize::new(w, h))
        .map_err(|e| format!("could not resize the overlay: {}", e))?;
    window
        .emit("hud-compact", compact)
        .map_err(|e| format!("could not tell the overlay its new size: {}", e))?;

    let dir = store_for_dir(&app)?;
    let current = hud_window::read_placement(&dir);
    hud_window::write_placement(&dir, hud_window::HudPlacement { compact, ..current })
}

/// What size the overlay should draw itself at, asked once on load.
///
/// The window is created at the right size already; the page needs the same
/// answer to lay itself out to match.
#[tauri::command(async)]
fn hud_is_open(app: tauri::AppHandle) -> bool {
    use tauri::Manager;
    app.get_webview_window("hud").is_some()
}

#[tauri::command(async)]
fn hud_is_compact(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(hud_window::read_placement(&store_for_dir(&app)?).compact)
}

#[tauri::command(async)]
fn set_hud_click_through(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri::Manager;
    let window = app
        .get_webview_window("hud")
        .ok_or_else(|| "the overlay is not open".to_string())?;
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| format!("could not change the overlay's click-through mode: {}", e))
}

#[tauri::command(async)]
fn close_hud_overlay(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("hud") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
