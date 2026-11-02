//! Notices when Windows has undone the user's work.
//!
//! A cumulative update does not just patch binaries. It reinstalls apps the
//! user removed, re-enables services they turned off, and rewrites registry
//! values they deliberately changed. The person finds out weeks later, if at
//! all — the tweak screen still says "applied", because that is what they
//! asked for, and nothing had ever gone back to check whether it was still
//! true.
//!
//! ## What is actually proven here
//!
//! Two independent facts, and a correlation between them — stated as a
//! correlation, never dressed up as a cause:
//!
//! 1. **The patch level changed.** Read from `CurrentBuild` and `UBR` under
//!    `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion`. UBR is the Update
//!    Build Revision and increments with every cumulative update, so the pair
//!    identifies the patch level exactly.
//!
//!    The obvious candidate — `WindowsUpdate\Auto Update\Results\Install\
//!    LastSuccessTime` — was tried first and rejected: it is absent on
//!    current Windows (verified on 26200.9168, where the whole `Results` key
//!    does not exist). Reading a value that is simply missing would have
//!    meant a watchdog that silently never fires.
//!
//! 2. **Tweaks recorded as applied no longer match the system.** For every
//!    registry tweak the rollback store says is applied, the live value is
//!    read back and compared with what the tweak writes. A mismatch means
//!    something reverted it.
//!
//! The app can prove both. It cannot prove the second was caused by the
//! first — the user may have changed the value themselves, or another tool
//! may have. So the report says what it saw, and the wording in the UI does
//! the same. Claiming "Windows Update reverted this" when a colleague's
//! script did it would be exactly the kind of confident, unfalsifiable
//! number this codebase avoids elsewhere.
//!
//! ## It never fixes anything on its own
//!
//! Re-applying is a button. A watchdog that silently re-applied would be
//! making system changes nobody asked for at the moment they were least
//! expecting them, which is the opposite of what the rollback engine exists
//! to guarantee.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const STATE_FILE: &str = "update-watch.json";

/// Windows' patch level: the build number and its update revision.
///
/// `26200.9168` — the pair that a cumulative update moves and nothing else
/// does.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct PatchLevel {
    pub build: u32,
    pub ubr: u32,
}

impl PatchLevel {
    pub fn label(&self) -> String {
        format!("{}.{}", self.build, self.ubr)
    }
}

/// What the last check saw, so the next one can tell whether anything moved.
/// Every field after `last_seen` arrived in 1.19; older files read as none.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct WatchState {
    pub last_seen: Option<PatchLevel>,
    /// A patch-level change the user has not dealt with yet: what the app
    /// may call "after a Windows update". Kept across checks, because the
    /// scheduled task usually sees the update first and the window opens
    /// later.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending: Option<PendingUpdate>,
    /// The reverted ids the last notification named, so the same drift is
    /// announced once, not at every check.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notified: Vec<String>,
}

/// One unacknowledged patch-level change. Times are Unix seconds.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct PendingUpdate {
    pub from: PatchLevel,
    pub to: PatchLevel,
    pub at: u64,
    /// "Not now" in the alert: the History card still lists the settings,
    /// the window stops asking until the next update.
    #[serde(default)]
    pub dismissed: bool,
}

/// An update that reverted nothing within this long is not blamed for a
/// change that appears later.
pub const PENDING_FOR_S: u64 = 7 * 24 * 3600;

/// One tweak's two answers: what the user asked for, and what the system says.
#[derive(Clone, Debug, PartialEq)]
pub struct TweakState {
    pub id: String,
    /// The rollback store has a snapshot for it, so the user applied it.
    pub recorded_applied: bool,
    /// The live registry value still matches what the tweak writes.
    ///
    /// `None` when the value could not be read at all. Unreadable is not the
    /// same as reverted — a permissions error or a key that moved between
    /// Windows versions would otherwise be reported to the user as "Windows
    /// undid your tweak", which is a claim the app cannot support.
    pub live_matches: Option<bool>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DriftReport {
    /// Whether the patch level moved since the last check (`build_report`),
    /// or, from `check`, since a change the user has not dealt with yet.
    /// `false` on the very first run, when there is nothing to compare
    /// against.
    pub windows_updated: bool,
    /// `None` on the first run.
    pub previous_patch: Option<String>,
    pub current_patch: String,
    /// Ids recorded as applied whose live value no longer matches.
    pub reverted: Vec<String>,
    /// When the update was first seen, Unix seconds (`check` only).
    pub updated_at: Option<u64>,
    /// The window should ask about these now: an update the user has not
    /// answered and settings it left changed.
    pub alert: bool,
}

/// Which tweaks stopped being in effect.
///
/// Only ones the user actually applied, and only ones whose live value could
/// be read and definitely disagrees. Everything uncertain is left out: a
/// report that cries wolf about an unreadable key trains people to ignore it.
pub fn reverted_ids(states: &[TweakState]) -> Vec<String> {
    states
        .iter()
        .filter(|s| s.recorded_applied && s.live_matches == Some(false))
        .map(|s| s.id.clone())
        .collect()
}

/// Whether the patch level moved.
///
/// Deliberately any change rather than an increase. A build number normally
/// only goes up, but it also moves on a rollback of a bad update, and that is
/// exactly a moment when tweaks get reverted — treating it as "no update"
/// would miss the case the user most needs to hear about.
pub fn patch_level_changed(previous: Option<PatchLevel>, current: PatchLevel) -> bool {
    match previous {
        None => false,
        Some(before) => before != current,
    }
}

/// Assembles the report from the two independent readings.
pub fn build_report(
    previous: Option<PatchLevel>,
    current: PatchLevel,
    states: &[TweakState],
) -> DriftReport {
    DriftReport {
        windows_updated: patch_level_changed(previous, current),
        previous_patch: previous.map(|p| p.label()),
        current_patch: current.label(),
        reverted: reverted_ids(states),
        updated_at: None,
        alert: false,
    }
}

/// One check: the report and the state to store after it. Pure.
///
/// A patch-level change opens a pending update; it stays open while it is
/// unanswered, and closes once nothing it could be blamed for is left and a
/// week has passed. "After a Windows update" is a statement about time,
/// never a claim about cause: see the module notes.
pub fn check(
    state: &WatchState,
    current: PatchLevel,
    states: &[TweakState],
    now: u64,
) -> (DriftReport, WatchState) {
    let mut report = build_report(state.last_seen, current, states);
    let mut pending = state.pending;
    if report.windows_updated {
        pending = Some(PendingUpdate {
            // Two updates in a row before anyone looked: still one alert,
            // from the level the user last saw.
            from: pending.map_or_else(|| state.last_seen.unwrap_or(current), |p| p.from),
            to: current,
            at: now,
            dismissed: false,
        });
    } else if report.reverted.is_empty()
        && pending.is_some_and(|p| now.saturating_sub(p.at) >= PENDING_FOR_S)
    {
        pending = None;
    }
    if let Some(p) = pending {
        report.windows_updated = true;
        report.previous_patch = Some(p.from.label());
        report.updated_at = Some(p.at);
        report.alert = !p.dismissed && !report.reverted.is_empty();
    }
    // Forget what was announced once it is back in effect, so it is
    // announced again if it drifts again.
    let notified = state
        .notified
        .iter()
        .filter(|id| report.reverted.contains(id))
        .cloned()
        .collect();
    let next = WatchState {
        last_seen: Some(current),
        pending,
        notified,
    };
    (report, next)
}

/// Whether a notification would tell the user something new: a reverted
/// setting the last one did not name.
pub fn should_notify(notified: &[String], reverted: &[String]) -> bool {
    reverted.iter().any(|id| !notified.contains(id))
}

/// "Not now", or the settings were put back: the window stops asking about
/// this update. A later update opens a new one.
pub fn dismiss(state: &WatchState) -> WatchState {
    let mut next = state.clone();
    if let Some(p) = next.pending.as_mut() {
        p.dismissed = true;
    }
    next
}

fn state_path(dir: &Path) -> PathBuf {
    dir.join(STATE_FILE)
}

/// A missing or unreadable state file reads as "never checked", which makes
/// the next check record a baseline instead of reporting a phantom update.
pub fn read_state(dir: &Path) -> WatchState {
    std::fs::read_to_string(state_path(dir))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn write_state(dir: &Path, state: &WatchState) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(state).map_err(|e| e.to_string())?;
    std::fs::write(state_path(dir), json).map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn current_patch_level() -> Option<PatchLevel> {
    use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion", KEY_READ)
        .ok()?;

    // CurrentBuild is a string ("26200") even though it holds a number, and
    // UBR is a DWORD. Reading each as the type it actually is, rather than
    // assuming, is what stops this returning None on every machine.
    let build: String = key.get_value("CurrentBuild").ok()?;
    let build: u32 = build.trim().parse().ok()?;
    let ubr: u32 = key.get_value("UBR").ok()?;

    Some(PatchLevel { build, ubr })
}

#[cfg(not(windows))]
pub fn current_patch_level() -> Option<PatchLevel> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "pctweaker-updatewatch-{}-{}",
            tag,
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let _ = std::fs::remove_file(state_path(&dir));
        dir
    }

    fn state(id: &str, applied: bool, matches: Option<bool>) -> TweakState {
        TweakState {
            id: id.to_string(),
            recorded_applied: applied,
            live_matches: matches,
        }
    }

    #[test]
    fn the_first_run_reports_no_update() {
        // Nothing to compare against yet. Reporting an update here would
        // greet every new install with "Windows changed your settings".
        let now = PatchLevel {
            build: 26200,
            ubr: 9168,
        };
        assert!(!patch_level_changed(None, now));
    }

    #[test]
    fn a_new_revision_of_the_same_build_counts() {
        // The common case: a monthly cumulative update moves UBR only.
        let before = PatchLevel {
            build: 26200,
            ubr: 9100,
        };
        let after = PatchLevel {
            build: 26200,
            ubr: 9168,
        };
        assert!(patch_level_changed(Some(before), after));
    }

    #[test]
    fn an_unchanged_patch_level_is_not_an_update() {
        let same = PatchLevel {
            build: 26200,
            ubr: 9168,
        };
        assert!(!patch_level_changed(Some(same), same));
    }

    #[test]
    fn a_rolled_back_update_still_counts_as_a_change() {
        // Windows uninstalling a bad update is precisely when tweaks get
        // reverted, so treating a decrease as "nothing happened" would miss
        // the case that matters most.
        let before = PatchLevel {
            build: 26200,
            ubr: 9168,
        };
        let after = PatchLevel {
            build: 26200,
            ubr: 9100,
        };
        assert!(patch_level_changed(Some(before), after));
    }

    #[test]
    fn only_tweaks_the_user_applied_can_be_reverted() {
        // A tweak that was never applied and does not match is just a tweak
        // that is off. Reporting it would be reporting the default state of
        // the machine as damage.
        let states = vec![state("never_applied", false, Some(false))];
        assert!(reverted_ids(&states).is_empty());
    }

    #[test]
    fn an_applied_tweak_that_no_longer_matches_is_reported() {
        let states = vec![state("dark_mode", true, Some(false))];
        assert_eq!(reverted_ids(&states), vec!["dark_mode".to_string()]);
    }

    #[test]
    fn an_applied_tweak_that_still_matches_is_left_alone() {
        let states = vec![state("dark_mode", true, Some(true))];
        assert!(reverted_ids(&states).is_empty());
    }

    #[test]
    fn an_unreadable_value_is_never_reported_as_reverted() {
        // Unreadable is not reverted. A permissions error or a key that moved
        // between Windows versions would otherwise be shown to the user as
        // "Windows undid your tweak" — a claim the app cannot support.
        let states = vec![state("some_tweak", true, None)];
        assert!(reverted_ids(&states).is_empty());
    }

    #[test]
    fn the_report_carries_both_readings_independently() {
        // Drift is reported whether or not an update was detected: the user
        // wants to know their tweak stopped working even if the cause was
        // something else entirely.
        let states = vec![state("a", true, Some(false)), state("b", true, Some(true))];
        let report = build_report(
            Some(PatchLevel {
                build: 26200,
                ubr: 9100,
            }),
            PatchLevel {
                build: 26200,
                ubr: 9168,
            },
            &states,
        );
        assert!(report.windows_updated);
        assert_eq!(report.previous_patch.as_deref(), Some("26200.9100"));
        assert_eq!(report.current_patch, "26200.9168");
        assert_eq!(report.reverted, vec!["a".to_string()]);
    }

    #[test]
    fn drift_without_an_update_is_still_drift() {
        let states = vec![state("a", true, Some(false))];
        let same = PatchLevel {
            build: 26200,
            ubr: 9168,
        };
        let report = build_report(Some(same), same, &states);
        assert!(!report.windows_updated, "nothing patched the machine");
        assert_eq!(
            report.reverted,
            vec!["a".to_string()],
            "but the tweak is still off"
        );
    }

    #[test]
    fn the_state_survives_a_round_trip() {
        let dir = temp_dir("roundtrip");
        let state = WatchState {
            last_seen: Some(NEW),
            pending: Some(PendingUpdate {
                from: OLD,
                to: NEW,
                at: T,
                dismissed: true,
            }),
            notified: vec!["dark_mode".into()],
        };
        write_state(&dir, &state).unwrap();
        assert_eq!(read_state(&dir), state);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_state_file_from_before_1_19_still_reads() {
        let dir = temp_dir("legacy");
        std::fs::write(
            state_path(&dir),
            r#"{"last_seen":{"build":26200,"ubr":9168}}"#,
        )
        .unwrap();
        let state = read_state(&dir);
        assert_eq!(state.last_seen, Some(NEW));
        assert!(state.pending.is_none() && state.notified.is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }

    const OLD: PatchLevel = PatchLevel {
        build: 26200,
        ubr: 9100,
    };
    const NEW: PatchLevel = PatchLevel {
        build: 26200,
        ubr: 9168,
    };
    const T: u64 = 1_800_000_000;

    fn seen(level: PatchLevel) -> WatchState {
        WatchState {
            last_seen: Some(level),
            ..Default::default()
        }
    }

    #[test]
    fn an_update_that_reverted_settings_alerts_until_it_is_answered() {
        let reverted = vec![state("dark_mode", true, Some(false))];
        let (report, next) = check(&seen(OLD), NEW, &reverted, T);
        assert!(report.alert && report.windows_updated);
        assert_eq!(report.previous_patch.as_deref(), Some("26200.9100"));
        assert_eq!(report.updated_at, Some(T));
        // The window opens an hour later: the task already stored the new
        // level, and the alert is still due.
        let (later, next) = check(&next, NEW, &reverted, T + 3600);
        assert!(later.alert && later.windows_updated);
        assert_eq!(later.previous_patch.as_deref(), Some("26200.9100"));
        // "Not now": no more asking; the History card keeps its wording.
        let (after, _) = check(&dismiss(&next), NEW, &reverted, T + 7200);
        assert!(!after.alert && after.windows_updated);
        assert_eq!(after.reverted, vec!["dark_mode".to_string()]);
    }

    #[test]
    fn drift_without_an_update_never_raises_the_alert() {
        let reverted = vec![state("dark_mode", true, Some(false))];
        let (report, next) = check(&seen(NEW), NEW, &reverted, T);
        assert!(!report.alert && !report.windows_updated);
        assert!(next.pending.is_none());
        // The very first check has nothing to compare against either.
        let (first, _) = check(&WatchState::default(), NEW, &reverted, T);
        assert!(!first.alert && !first.windows_updated);
    }

    #[test]
    fn an_update_with_nothing_reverted_waits_a_week_then_is_forgotten() {
        let fine = vec![state("dark_mode", true, Some(true))];
        let (report, next) = check(&seen(OLD), NEW, &fine, T);
        assert!(!report.alert && report.windows_updated);
        // Settings put back after the first sign-in still count as the update's.
        let drifted = vec![state("dark_mode", true, Some(false))];
        let (soon, _) = check(&next, NEW, &drifted, T + 3600);
        assert!(soon.alert);
        let (week, gone) = check(&next, NEW, &fine, T + PENDING_FOR_S);
        assert!(!week.windows_updated && gone.pending.is_none());
    }

    #[test]
    fn two_updates_before_anyone_looked_are_one_alert_from_the_first_level() {
        let reverted = vec![state("dark_mode", true, Some(false))];
        let (_, next) = check(&seen(OLD), NEW, &reverted, T);
        let newer = PatchLevel {
            build: 26200,
            ubr: 9200,
        };
        let (report, next) = check(&next, newer, &reverted, T + 60);
        assert_eq!(report.previous_patch.as_deref(), Some("26200.9100"));
        assert_eq!(report.current_patch, "26200.9200");
        assert!(report.alert && !next.pending.unwrap().dismissed);
    }

    #[test]
    fn the_same_drift_is_notified_once_and_again_only_when_it_returns() {
        let reverted = vec!["a".to_string(), "b".to_string()];
        assert!(should_notify(&[], &reverted));
        assert!(!should_notify(&reverted, &reverted));
        assert!(!should_notify(&reverted, &["a".to_string()]));
        assert!(should_notify(&["a".to_string()], &reverted));
        assert!(!should_notify(&[], &[]));
        // Settings back in effect leave the list, so a later drift is news again.
        let mut s = seen(NEW);
        s.notified = reverted.clone();
        let states = [state("a", true, Some(true)), state("b", true, Some(false))];
        let (_, next) = check(&s, NEW, &states, T);
        assert_eq!(next.notified, vec!["b".to_string()]);
    }

    #[test]
    fn no_state_file_means_never_checked() {
        let dir = temp_dir("absent");
        assert!(read_state(&dir).last_seen.is_none());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_corrupt_state_file_does_not_invent_an_update() {
        // Falling back to "never checked" records a fresh baseline. Falling
        // back to some default patch level would fire the watchdog against a
        // number nobody ever observed.
        let dir = temp_dir("corrupt");
        std::fs::write(state_path(&dir), "{ not json").unwrap();
        assert!(read_state(&dir).last_seen.is_none());
        std::fs::remove_dir_all(&dir).ok();
    }
}

/// The name the scheduled task carries in Task Scheduler.
///
/// Visible on purpose. A background task a user cannot find and cannot read
/// is the thing this product exists not to be, so it is named plainly at the
/// scheduler root.
// Keep the task at the scheduler root. `schtasks` cannot create a missing
// folder from a task path, and managed Windows installations may report that
// failure as the misleading "Access is denied".
pub const TASK_NAME: &str = "PC Tweaker Update drift watch";

#[cfg(test)]
mod task_name_tests {
    use super::TASK_NAME;

    #[test]
    fn scheduled_task_does_not_depend_on_a_preexisting_folder() {
        assert!(!TASK_NAME.contains(['\\', '/']));
    }
}
