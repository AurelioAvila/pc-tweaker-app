mod audit;
mod avatar;
pub mod baseline;
mod browsercleanup;
mod cleanup;
mod contextmenu;
// Public so examples/crashprobe.rs can install the real hook and panic for
// real: whether a panic actually produces a scrubbed report is the one thing
// a unit test cannot check, because a test that panics is a test that failed.
pub mod crash;
mod cpubench;
mod cpuclock;
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
mod license;
mod netlatency;
mod netmaintenance;
mod netshaper;
mod power;
mod privacy_extra;
mod profiles;
mod ramclean;
mod recommend;
mod restore_point;
mod rollback;
mod securedefrag;
mod services;
mod startup;
mod sysmon;
mod systemprofile;
mod updatewatch;
mod technical;
mod thermals;
mod turbo;
mod tweaks;
mod x3d;
mod zerotrace;

use cleanup::CleanupResult;
use rollback::{RegValue, RollbackStore};
use serde::Serialize;
use tauri::Manager;
use tweaks::{find_tweak, Category, Hive};

// NOT `rename_all = "camelCase"`: the frontend `TweakInfo` type has read
// `requires_admin`/`requires_pro` since the first release, and renaming them
// here would silently blank every badge in the list.
#[derive(Serialize)]
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
        Category::Manutenzione => "manutenzione",
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
 * localStorage — in short, people were losing their photos.
 * ---------------------------------------------------------------- */

#[tauri::command(async)]
fn save_avatar(app: tauri::AppHandle, data_url: String) -> Result<(), String> {
    avatar::save(&store_for_dir(&app)?, &data_url)
}

#[tauri::command(async)]
fn read_avatar(app: tauri::AppHandle) -> Option<String> {
    // A failure to even resolve the data folder is reported the same as "no
    // photo": the caller's only sensible response to either is to show the
    // fallback initial, and an error here would surface as a scary toast on
    // an ordinary first launch.
    avatar::read(&store_for_dir(&app).ok()?)
}

#[tauri::command(async)]
fn clear_avatar(app: tauri::AppHandle) -> Result<(), String> {
    avatar::clear(&store_for_dir(&app)?)
}

#[tauri::command(async)]
fn list_tweaks(app: tauri::AppHandle) -> Result<Vec<TweakInfo>, String> {
    let store = store_for(&app)?;

    let mut list: Vec<TweakInfo> = tweaks::all_tweaks()
        .into_iter()
        .map(|t| TweakInfo {
            applied: store.is_applied(t.id),
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
            }],
        })
        .collect();

    list.push(TweakInfo {
        applied: store.is_applied(power::TWEAK_ID),
        id: power::TWEAK_ID.to_string(),
        name: "High performance (power plan)".to_string(),
        description: "Switches to the Windows \"High performance\" power plan. Useful on desktops or when plugged in; restores the previous plan on rollback.".to_string(),
        category: category_str(&Category::Performance).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: false,
        requires_pro: false,
    });

    let turbo = turbo::info();
    list.push(TweakInfo {
        id: turbo.id.to_string(),
        name: turbo.name.to_string(),
        description: turbo.description.to_string(),
        category: category_str(&Category::Performance).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: turbo.requires_admin,
        requires_pro: turbo.requires_pro,
        applied: store.is_applied(turbo.id),
    });

    list.push(TweakInfo {
        applied: store.is_applied(dns::TWEAK_ID),
        id: dns::TWEAK_ID.to_string(),
        name: "Private DNS (Cloudflare)".to_string(),
        description: "Switches the active network adapter to privacy-focused DNS servers (1.1.1.1), stopping your provider from logging your DNS queries. It does not hide your IP address (that needs a VPN, see below).".to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: true,
        requires_pro: false,
    });

    let input_lag = gaming::input_lag_info();
    list.push(TweakInfo {
        applied: store.is_applied(input_lag.id),
        id: input_lag.id.to_string(),
        name: input_lag.name.to_string(),
        description: input_lag.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: input_lag.requires_admin,
        requires_pro: input_lag.requires_pro,
    });

    let turbo_boost = gaming::turbo_boost_info();
    list.push(TweakInfo {
        applied: store.is_applied(turbo_boost.id),
        id: turbo_boost.id.to_string(),
        name: turbo_boost.name.to_string(),
        description: turbo_boost.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: turbo_boost.requires_admin,
        requires_pro: turbo_boost.requires_pro,
    });

    let games_priority = game_priority::info();
    list.push(TweakInfo {
        applied: store.is_applied(games_priority.id),
        id: games_priority.id.to_string(),
        name: games_priority.name.to_string(),
        description: games_priority.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: games_priority.requires_admin,
        requires_pro: games_priority.requires_pro,
    });

    let keyboard_delay = gaming::keyboard_delay_info();
    list.push(TweakInfo {
        applied: store.is_applied(keyboard_delay.id),
        id: keyboard_delay.id.to_string(),
        name: keyboard_delay.name.to_string(),
        description: keyboard_delay.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: keyboard_delay.requires_admin,
        requires_pro: keyboard_delay.requires_pro,
    });

    let net_latency = netlatency::info();
    list.push(TweakInfo {
        applied: store.is_applied(net_latency.id),
        id: net_latency.id.to_string(),
        name: net_latency.name.to_string(),
        description: net_latency.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: net_latency.requires_admin,
        requires_pro: net_latency.requires_pro,
    });

    let net_shaper = netshaper::info();
    list.push(TweakInfo {
        applied: store.is_applied(net_shaper.id),
        id: net_shaper.id.to_string(),
        name: net_shaper.name.to_string(),
        description: net_shaper.description.to_string(),
        category: category_str(&Category::Gaming).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: net_shaper.requires_admin,
        requires_pro: net_shaper.requires_pro,
    });

    let activity_history = privacy_extra::activity_history_info();
    list.push(TweakInfo {
        applied: store.is_applied(activity_history.id),
        id: activity_history.id.to_string(),
        name: activity_history.name.to_string(),
        description: activity_history.description.to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: activity_history.requires_admin,
        requires_pro: activity_history.requires_pro,
    });

    let typing = privacy_extra::typing_personalization_info();
    list.push(TweakInfo {
        applied: store.is_applied(typing.id),
        id: typing.id.to_string(),
        name: typing.name.to_string(),
        description: typing.description.to_string(),
        category: category_str(&Category::Privacy).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: typing.requires_admin,
        requires_pro: typing.requires_pro,
    });

    let context_menu = contextmenu::info();
    list.push(TweakInfo {
        applied: store.is_applied(context_menu.id),
        id: context_menu.id.to_string(),
        name: context_menu.name.to_string(),
        description: context_menu.description.to_string(),
        category: category_str(&Category::Ui).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: context_menu.requires_admin,
        requires_pro: context_menu.requires_pro,
    });

    let windows_search = services::windows_search_info();
    list.push(TweakInfo {
        applied: store.is_applied(windows_search.id),
        id: windows_search.id.to_string(),
        name: windows_search.name.to_string(),
        description: windows_search.description.to_string(),
        category: category_str(&Category::Manutenzione).to_string(),
        hive: "—".to_string(),
        changes: Vec::new(), // composite: filled by the pass below
        requires_admin: windows_search.requires_admin,
        requires_pro: windows_search.requires_pro,
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

/// Whether a friendly, stable prefix on a returned error means "this failed
/// because the Pro license didn't verify" rather than some other failure —
/// checked by the frontend to show the paywall instead of a generic toast.
pub const PRO_REQUIRED_PREFIX: &str = "PRO_REQUIRED: ";

#[cfg(windows)]
fn requires_pro_for(id: &str) -> bool {
    match id {
        power::TWEAK_ID => false,
        turbo::TWEAK_ID => turbo::info().requires_pro,
        dns::TWEAK_ID => false,
        gaming::INPUT_LAG_ID => gaming::input_lag_info().requires_pro,
        gaming::TURBO_BOOST_ID => gaming::turbo_boost_info().requires_pro,
        gaming::KEYBOARD_DELAY_ID => gaming::keyboard_delay_info().requires_pro,
        netlatency::TWEAK_ID => netlatency::info().requires_pro,
        netshaper::TWEAK_ID => netshaper::info().requires_pro,
        game_priority::TWEAK_ID => game_priority::info().requires_pro,
        privacy_extra::ACTIVITY_HISTORY_ID => privacy_extra::activity_history_info().requires_pro,
        privacy_extra::TYPING_PERSONALIZATION_ID => {
            privacy_extra::typing_personalization_info().requires_pro
        }
        contextmenu::TWEAK_ID => contextmenu::info().requires_pro,
        services::WINDOWS_SEARCH_ID => services::windows_search_info().requires_pro,
        _ => find_tweak(id).map(|t| t.requires_pro).unwrap_or(false),
    }
}

/// This is the single chokepoint every apply path funnels through — the
/// direct GUI call, the batched "fix all", *and* the elevated headless
/// re-entry (`--elevated-apply`), which calls this function directly and
/// would otherwise skip any check placed only in the Tauri command handlers
/// above it. That headless path is reachable by launching the shipped exe
/// with that flag from a terminal, with no GUI involved at all, so gating
/// only the commands would have left it wide open.
///
/// Deliberately not applied to `rollback_by_id`: cancelling a subscription
/// must not strand a tweak the user already paid to have applied — TERMS.md
/// is explicit that cancellation locks *further* Pro use, not what's already
/// on the machine.
#[cfg(windows)]
fn apply_by_id(
    store: &RollbackStore,
    app_data_dir: &std::path::Path,
    id: &str,
) -> Result<(), String> {
    // Single funnel for every apply (direct, batched, and the elevated
    // helper), so this one audit call covers them all exactly once.
    let result = apply_by_id_inner(store, app_data_dir, id);
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
    if requires_pro_for(id)
        && !license::LicenseStore::new(app_data_dir.to_path_buf()).is_pro_and_fresh()
    {
        return Err(format!(
            "{}this tweak requires an active PC Tweaker Pro subscription",
            PRO_REQUIRED_PREFIX
        ));
    }
    match id {
        power::TWEAK_ID => power::apply(store),
        turbo::TWEAK_ID => turbo::apply(store),
        dns::TWEAK_ID => dns::apply(store),
        gaming::INPUT_LAG_ID => gaming::apply_input_lag(store),
        gaming::TURBO_BOOST_ID => gaming::apply_turbo_boost(store),
        gaming::KEYBOARD_DELAY_ID => gaming::apply_keyboard_delay(store),
        netlatency::TWEAK_ID => netlatency::apply(store),
        netshaper::TWEAK_ID => netshaper::apply(store),
        game_priority::TWEAK_ID => game_priority::apply(store),
        privacy_extra::ACTIVITY_HISTORY_ID => privacy_extra::apply_activity_history(store),
        privacy_extra::TYPING_PERSONALIZATION_ID => {
            privacy_extra::apply_typing_personalization(store)
        }
        contextmenu::TWEAK_ID => contextmenu::apply(store),
        services::WINDOWS_SEARCH_ID => services::apply(store),
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
    match id {
        power::TWEAK_ID => power::rollback(store),
        turbo::TWEAK_ID => turbo::rollback(store),
        dns::TWEAK_ID => dns::rollback(store),
        gaming::INPUT_LAG_ID => gaming::rollback_input_lag(store),
        gaming::TURBO_BOOST_ID => gaming::rollback_turbo_boost(store),
        gaming::KEYBOARD_DELAY_ID => gaming::rollback_keyboard_delay(store),
        netlatency::TWEAK_ID => netlatency::rollback(store),
        netshaper::TWEAK_ID => netshaper::rollback(store),
        game_priority::TWEAK_ID => game_priority::rollback(store),
        privacy_extra::ACTIVITY_HISTORY_ID => privacy_extra::rollback_activity_history(store),
        privacy_extra::TYPING_PERSONALIZATION_ID => {
            privacy_extra::rollback_typing_personalization(store)
        }
        contextmenu::TWEAK_ID => contextmenu::rollback(store),
        services::WINDOWS_SEARCH_ID => services::rollback(store),
        _ => {
            let tweak = find_tweak(id).ok_or_else(|| format!("unknown tweak: {}", id))?;
            tweak.rollback(store)
        }
    }
}

#[cfg(windows)]
fn requires_admin_for(id: &str) -> bool {
    match id {
        power::TWEAK_ID => false,
        turbo::TWEAK_ID => turbo::info().requires_admin,
        dns::TWEAK_ID => true,
        gaming::INPUT_LAG_ID => false,
        gaming::TURBO_BOOST_ID => true,
        gaming::KEYBOARD_DELAY_ID => false,
        netlatency::TWEAK_ID => netlatency::info().requires_admin,
        netshaper::TWEAK_ID => netshaper::info().requires_admin,
        game_priority::TWEAK_ID => true,
        privacy_extra::ACTIVITY_HISTORY_ID => true,
        privacy_extra::TYPING_PERSONALIZATION_ID => {
            privacy_extra::typing_personalization_info().requires_admin
        }
        contextmenu::TWEAK_ID => contextmenu::info().requires_admin,
        services::WINDOWS_SEARCH_ID => true,
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

/// Splits a batch into (needs-elevation, can-run-directly). Kept separate so
/// the "every admin tweak ends up in one group, therefore one UAC prompt"
/// guarantee is testable without actually elevating anything.
#[cfg(windows)]
fn split_by_elevation(ids: Vec<String>) -> (Vec<String>, Vec<String>) {
    ids.into_iter().partition(|id| requires_admin_for(id))
}

/// Applies several tweaks at once (the Scan screen's "fix all").
///
/// Applying them one by one would fire a separate UAC prompt for every
/// admin-level tweak — a dozen consecutive prompts for a single click. So the
/// admin ones are collected and handed to a *single* elevated helper run,
/// while the rest are applied in-process. Failures are collected per id
/// instead of aborting, so one bad tweak can't silently swallow the rest.
#[cfg(windows)]
#[tauri::command(async)]
fn apply_tweaks(app: tauri::AppHandle, ids: Vec<String>) -> Result<Vec<String>, String> {
    let dir = store_for_dir(&app)?;
    let store = RollbackStore::new(dir.clone());
    let mut failures = Vec::new();

    let (needs_admin, direct) = split_by_elevation(ids);

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

#[cfg(windows)]
#[tauri::command(async)]
fn run_cleanup(app: tauri::AppHandle, id: String) -> Result<CleanupResult, String> {
    let requires_admin = cleanup::cleanup_targets()
        .into_iter()
        .find(|c| c.id == id)
        .map(|c| c.requires_admin)
        .unwrap_or(false);

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
    let requires_admin = cleanup::cleanup_targets()
        .iter()
        .find(|c| c.id == id)
        .map(|c| c.requires_admin)
        .unwrap_or(false);

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
fn scan_duplicates(root: String) -> Result<Vec<cleanup::DuplicateGroup>, String> {
    cleanup::scan_duplicates(&root)
}

#[tauri::command(async)]
fn delete_files(paths: Vec<String>) -> CleanupResult {
    let requested = paths.len();
    let result = cleanup::delete_files(paths);
    // Counts only — never file paths — so the local log stays free of
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
fn scan_large_files(root: String, min_bytes: u64) -> Result<Vec<cleanup::LargeFile>, String> {
    cleanup::scan_large_files(&root, min_bytes)
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
pub fn run_elevated_headless(action: &str, id: &str) -> ! {
    let dir = dirs_app_data_dir();
    // This process has no window, so a panic here is silent: the user clicks
    // "apply", the UAC prompt closes, and nothing happens with no explanation
    // anywhere. Recording it is the only way that failure is ever seen.
    crash::install(dir.clone(), crash::PROCESS_ELEVATED);
    let store = RollbackStore::new(dir.clone());

    // Safety net first: a System Restore point before any elevated change.
    // Best-effort by design — Windows throttles restore points (one per 24h
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
        "--elevated-apply" => apply_by_id(&store, &dir, id),
        "--elevated-apply-many" => {
            // One prompt, many tweaks: keep going past a failure so a single
            // unsupported tweak doesn't cancel everything else the user asked for.
            let mut failed = Vec::new();
            for one in id.split(',').filter(|s| !s.is_empty()) {
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
            let result = cleanup::run_cleanup(id);
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
            let result = diskinfo::validate_drive(id).and_then(|drive| diskopt::optimize(&drive));
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
            let result = diskinfo::validate_drive(id).and_then(|drive| {
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
            let result = zerotrace::purge_standby_memory();
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
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(base).join("com.aurel.pc-tweaker-app")
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
/// Reads two independent things — the patch level, and the live value of
/// every registry tweak the rollback store says is applied — and records the
/// patch level for next time. Never changes anything: re-applying is a
/// button, because a watchdog that silently re-applied would make system
/// changes at the moment the user least expects them.
#[cfg(windows)]
#[tauri::command(async)]
fn check_update_drift(app: tauri::AppHandle) -> Result<updatewatch::DriftReport, String> {
    let dir = store_for_dir(&app)?;
    let store = RollbackStore::new(dir.clone());

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
        .map(|t| {
            let recorded_applied = store.is_applied(t.id);
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(sysmon::SysMonState::new())
        .manage(fps::FpsState::default())
        .manage(systemprofile::SystemProfileState::new())
        .setup(|app| {
            game_sessions::spawn_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
            systemprofile::system_profile,
            health::health_report,
            healthhistory::list_health_history,
            baseline::run_baseline,
            baseline::list_baselines,
            recommend::advise_tweaks,
            recommend::scan_relevant_ids,
            cpuclock::cpu_clock,
            cpubench::cpu_benchmark,
            profiles::capture_profile,
            profiles::save_profile,
            profiles::list_profiles,
            profiles::delete_profile,
            profiles::export_profile,
            profiles::import_profile,
            profiles::write_profile_file,
            profiles::read_profile_file,
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
            drivers::driver_audit,
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
            netmaintenance::flush_dns_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// Every id the UI can show, gathered from the same places `list_tweaks`
    /// gathers them.
    fn all_visible_ids() -> Vec<String> {
        let mut ids: Vec<String> = tweaks::all_tweaks()
            .iter()
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
                game_priority::TWEAK_ID,
                privacy_extra::ACTIVITY_HISTORY_ID,
                privacy_extra::TYPING_PERSONALIZATION_ID,
                contextmenu::TWEAK_ID,
                services::WINDOWS_SEARCH_ID,
                netlatency::TWEAK_ID,
                netshaper::TWEAK_ID,
            ]
            .iter()
            .map(|s| s.to_string()),
        );
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

    /// The Scan screen's "fix all" must produce at most one elevation request,
    /// no matter how many admin tweaks were selected — the whole point of
    /// batching. This asserts the grouping without actually elevating.
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

    /// The actual security property that matters: with no cached license at
    /// all (a fresh install, or an install that has never signed in), every
    /// Pro-gated id must be refused — not silently allowed because the check
    /// couldn't find anything to compare against. Goes through `apply_by_id`
    /// itself, the real chokepoint every apply path funnels through,
    /// pointed at an empty temp directory so it is guaranteed to find no
    /// cached license, rather than re-testing the license module in
    /// isolation a second time.
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
        let store = RollbackStore::new(dir.clone());

        let result = apply_by_id(&store, &dir, pro_id);
        let err = result.expect_err("a Pro tweak must not silently succeed with no license cached");
        assert!(
            err.starts_with(PRO_REQUIRED_PREFIX),
            "expected a PRO_REQUIRED error for `{}`, got: {}",
            pro_id,
            err
        );
    }

    /// A free tweak must never be blocked by the license check regardless of
    /// license state — the Pro gate is specifically about `requires_pro`
    /// tweaks, not a blanket "no license, nothing works" failure mode.
    #[test]
    /// The catalogue's size and its free/Pro split, pinned.
    ///
    /// These two numbers are quoted on the website, in the Store listing and
    /// in the pricing card, and they have gone stale before: the site claimed
    /// "50 tweaks" for three releases after the count had moved. A test is the
    /// only place that notices, because nothing else reads all three sources
    /// at once. If this fails, the catalogue changed — update the numbers
    /// here, then update every surface listed above to match.
    #[test]
    fn the_catalogue_is_fifty_four_tweaks_nineteen_of_them_pro() {
        let registry = tweaks::all_tweaks();
        let registry_pro = registry.iter().filter(|t| t.requires_pro).count();

        // The composite tweaks, each owning its own Pro flag. Listed by hand
        // because they are built by hand in `list_tweaks`; keeping the two
        // lists side by side is what makes a forgotten entry visible.
        let composite_pro = [
            false,                                                  // power plan
            turbo::info().requires_pro,
            false,                                                  // private DNS
            gaming::input_lag_info().requires_pro,
            gaming::turbo_boost_info().requires_pro,
            game_priority::info().requires_pro,
            gaming::keyboard_delay_info().requires_pro,
            netlatency::info().requires_pro,
            netshaper::info().requires_pro,
            privacy_extra::activity_history_info().requires_pro,
            privacy_extra::typing_personalization_info().requires_pro,
            contextmenu::info().requires_pro,
            services::windows_search_info().requires_pro,
        ];

        let total = registry.len() + composite_pro.len();
        let pro = registry_pro + composite_pro.iter().filter(|p| **p).count();

        assert_eq!(total, 54, "the catalogue no longer has 54 tweaks");
        assert_eq!(pro, 19, "the Pro count moved");
        assert_eq!(total - pro, 35, "the free count moved");

        // The composite list must stay in step with what list_tweaks builds,
        // otherwise the totals above would quietly stop covering everything.
        assert_eq!(
            composite_pro.len(),
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
        let store = RollbackStore::new(dir.clone());

        // Whatever this particular tweak does on the test machine may
        // succeed or fail on its own merits — that's not what's under test.
        // What must never happen is failing *for licensing reasons*.
        if let Err(e) = apply_by_id(&store, &dir, free_id) {
            assert!(
                !e.starts_with(PRO_REQUIRED_PREFIX),
                "free tweak `{}` was blocked by the license check, which should never apply to it",
                free_id
            );
        }
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
    /// forgotten translation doesn't fail loudly — it just leaves one English
    /// row sitting in an otherwise Italian (or French, …) list. That is
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
        "{}this feature requires an active PC Tweaker Pro subscription",
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
/// game at all — without it the panel would swallow every click that landed on
/// it, which in a shooter is the difference between a HUD and a liability. It
/// also means the window needs no close button of its own: it is dismissed
/// from the same switch that opened it.
/// Stops Windows rounding the overlay window.
///
/// Windows 11 rounds the corners of every top-level window, including a
/// borderless transparent one. The panel already draws its own rounded
/// corners, and the two radii do not agree, so each corner was left with a
/// sliver between the system's curve and the panel's — small hard-edged
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
    // attribute expects. Purely cosmetic, so a failure — on a Windows build
    // predating the attribute, for instance — is ignored rather than
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
    // landed on whatever was behind — on the desktop, that dragged the icons
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
/// reaches the game underneath — what an in-game overlay has to do. Off: it
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
