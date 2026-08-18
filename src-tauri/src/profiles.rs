//! Saved tweak configurations: keep your setup, restore it in one click, and
//! hand it to someone else.
//!
//! ## The security shape of this feature
//!
//! An imported profile is a list of tweak *ids*, never a script and never
//! registry paths. Every id is checked against the tweaks this build actually
//! ships (`known_tweak_ids`) and anything unrecognised is dropped with the
//! user told how many were dropped. That is what keeps "a friend sent me his
//! config" from becoming "a stranger's file wrote arbitrary keys as
//! administrator": the worst a hostile file can do is name tweaks this app
//! already offers, which the user still has to review and approve.
//!
//! Importing therefore never applies anything. It loads the list into the UI,
//! where the same review-and-confirm path as everywhere else applies. A
//! profile that silently ran on open would be a remote-configuration channel
//! with a friendly name.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Bumped only if the on-disk shape changes incompatibly, so a future build
/// can tell an old file from a corrupt one.
const PROFILE_FORMAT: u32 = 1;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TweakProfile {
    /// Format marker, not the app version — an old profile stays loadable.
    pub format: u32,
    pub name: String,
    /// ISO-8601, for showing "saved on ..." without a second field.
    pub created_at: String,
    /// Ids of the tweaks that were applied when this was saved.
    pub tweaks: Vec<String>,
}

/// The result of reading a profile, including anything discarded.
#[derive(Serialize, Clone, Debug)]
pub struct LoadedProfile {
    pub profile: TweakProfile,
    /// Ids the file named that this build doesn't recognise. Surfaced rather
    /// than swallowed: a user importing a friend's config deserves to know
    /// part of it won't apply, instead of wondering later why their machine
    /// doesn't match.
    pub unknown: Vec<String>,
}

pub struct ProfileStore {
    dir: PathBuf,
}

impl ProfileStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        ProfileStore {
            dir: app_data_dir.join("profiles"),
        }
    }

    /// Profile names become file names, so they cannot be allowed to steer the
    /// path. Everything outside a small safe set is replaced rather than
    /// rejected, so a user naming a profile "Gaming / 2026" still gets a
    /// profile instead of an error.
    fn file_for(&self, name: &str) -> PathBuf {
        let safe: String = name
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' })
            .collect();
        self.dir.join(format!("{}.json", safe.trim()))
    }
}

/// Every tweak id this build knows about. The allowlist an import is checked
/// against.
fn known_tweak_ids() -> Vec<String> {
    let mut ids: Vec<String> = crate::tweaks::all_tweaks().iter().map(|t| t.id.to_string()).collect();
    ids.extend(
        [
            crate::power::TWEAK_ID,
            crate::turbo::TWEAK_ID,
            crate::gaming::INPUT_LAG_ID,
            crate::gaming::TURBO_BOOST_ID,
            crate::gaming::KEYBOARD_DELAY_ID,
            crate::game_priority::TWEAK_ID,
            crate::privacy_extra::ACTIVITY_HISTORY_ID,
            crate::privacy_extra::TYPING_PERSONALIZATION_ID,
            crate::contextmenu::TWEAK_ID,
            crate::services::WINDOWS_SEARCH_ID,
            crate::netlatency::TWEAK_ID,
            crate::dns::TWEAK_ID,
        ]
        .iter()
        .map(|s| s.to_string()),
    );
    ids
}

/// Splits a candidate list into ids this build can apply and ids it can't.
fn partition_known(ids: Vec<String>) -> (Vec<String>, Vec<String>) {
    let known = known_tweak_ids();
    ids.into_iter().partition(|id| known.contains(id))
}

fn now_iso() -> String {
    // Seconds since the epoch is enough to render a date in the UI, and avoids
    // pulling in a date crate for one field.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs)
}

/// Builds a profile from whatever is applied right now.
#[tauri::command]
pub fn capture_profile(name: String, app: tauri::AppHandle) -> Result<TweakProfile, String> {
    let store = crate::rollback::RollbackStore::new(crate::store_for_dir(&app)?);
    let applied: Vec<String> = known_tweak_ids()
        .into_iter()
        .filter(|id| store.is_applied(id))
        .collect();

    Ok(TweakProfile {
        format: PROFILE_FORMAT,
        name: name.trim().to_string(),
        created_at: now_iso(),
        tweaks: applied,
    })
}

#[tauri::command]
pub fn save_profile(profile: TweakProfile, app: tauri::AppHandle) -> Result<(), String> {
    let profiles = ProfileStore::new(crate::store_for_dir(&app)?);
    if profile.name.trim().is_empty() {
        return Err("a profile needs a name".to_string());
    }
    fs::create_dir_all(&profiles.dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    fs::write(profiles.file_for(&profile.name), json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_profiles(app: tauri::AppHandle) -> Result<Vec<TweakProfile>, String> {
    let profiles = ProfileStore::new(crate::store_for_dir(&app)?);
    let Ok(entries) = fs::read_dir(&profiles.dir) else {
        // No directory yet simply means no profiles, not a failure.
        return Ok(Vec::new());
    };

    let mut out: Vec<TweakProfile> = entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
        .filter_map(|e| fs::read_to_string(e.path()).ok())
        .filter_map(|text| serde_json::from_str::<TweakProfile>(&text).ok())
        .collect();

    // Newest first: the profile you just saved should be the one on top.
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

#[tauri::command]
pub fn delete_profile(name: String, app: tauri::AppHandle) -> Result<(), String> {
    let profiles = ProfileStore::new(crate::store_for_dir(&app)?);
    let path = profiles.file_for(&name);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Serializes a profile for writing to a file the user picks.
#[tauri::command]
pub fn export_profile(profile: TweakProfile) -> Result<String, String> {
    serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())
}

/// Parses a profile file, keeping only ids this build recognises.
///
/// Deliberately returns the profile rather than applying it — see the module
/// docs on why importing must never be the same action as running.
#[tauri::command]
pub fn import_profile(contents: String) -> Result<LoadedProfile, String> {
    let parsed: TweakProfile = serde_json::from_str(&contents)
        .map_err(|_| "this file isn't a PC Tweaker profile".to_string())?;

    if parsed.format > PROFILE_FORMAT {
        return Err("this profile was made by a newer version of PC Tweaker".to_string());
    }

    let (tweaks, unknown) = partition_known(parsed.tweaks);
    Ok(LoadedProfile {
        profile: TweakProfile { tweaks, ..parsed },
        unknown,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_profile_round_trips_through_json() {
        let p = TweakProfile {
            format: PROFILE_FORMAT,
            name: "Gaming".into(),
            created_at: "1700000000".into(),
            tweaks: vec!["priority_separation".into(), "disable_startup_delay".into()],
        };
        let json = export_profile(p.clone()).unwrap();
        let loaded = import_profile(json).unwrap();
        assert_eq!(loaded.profile.tweaks, p.tweaks);
        assert!(loaded.unknown.is_empty());
    }

    /// The core safety property: a file can only ever name tweaks this build
    /// already ships. Anything else is dropped and reported, never executed.
    #[test]
    fn unknown_ids_from_an_imported_file_are_dropped_and_reported() {
        let hostile = serde_json::json!({
            "format": 1,
            "name": "Totally normal",
            "created_at": "1700000000",
            "tweaks": [
                "priority_separation",
                "rm -rf /",
                "../../etc/passwd",
                "some_tweak_that_does_not_exist",
            ],
        })
        .to_string();

        let loaded = import_profile(hostile).unwrap();
        assert_eq!(loaded.profile.tweaks, vec!["priority_separation".to_string()]);
        assert_eq!(loaded.unknown.len(), 3, "unknown ids must be reported, not silently kept");
    }

    #[test]
    fn a_file_that_is_not_a_profile_is_refused() {
        assert!(import_profile("{}".into()).is_err());
        assert!(import_profile("not json at all".into()).is_err());
    }

    #[test]
    fn a_newer_format_is_refused_rather_than_half_understood() {
        let future = serde_json::json!({
            "format": PROFILE_FORMAT + 1,
            "name": "From the future",
            "created_at": "1700000000",
            "tweaks": [],
        })
        .to_string();
        assert!(import_profile(future).is_err());
    }

    /// Profile names reach the filesystem, so they must not be able to walk
    /// out of the profiles directory.
    #[test]
    fn profile_names_cannot_escape_the_profiles_directory() {
        let store = ProfileStore::new(PathBuf::from("C:\\app-data"));
        for hostile in ["../../evil", "..\\..\\evil", "C:\\Windows\\System32\\evil", "a/b/c"] {
            let path = store.file_for(hostile);
            assert_eq!(
                path.parent(),
                Some(store.dir.as_path()),
                "name {:?} escaped to {:?}",
                hostile,
                path
            );
        }
    }
}

/// Writes a profile to a path the user picked in a save dialog.
///
/// Deliberately not a general "write this text to that path" command: it
/// always serializes a `TweakProfile`, so even if a renderer bug or a hostile
/// page reached this, the worst it can produce is a profile JSON file — not an
/// arbitrary payload at an arbitrary location.
#[tauri::command]
pub fn write_profile_file(path: String, profile: TweakProfile) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("could not write the file: {}", e))
}

/// Reads and validates a profile from a path the user picked.
///
/// Size-capped before parsing: a profile is a few hundred bytes, so anything
/// large is either not a profile or is trying to make the parser work hard.
#[tauri::command]
pub fn read_profile_file(path: String) -> Result<LoadedProfile, String> {
    const MAX_BYTES: u64 = 256 * 1024;

    let meta = fs::metadata(&path).map_err(|e| format!("could not open the file: {}", e))?;
    if meta.len() > MAX_BYTES {
        return Err("that file is too large to be a PC Tweaker profile".to_string());
    }

    let contents = fs::read_to_string(&path).map_err(|e| format!("could not read the file: {}", e))?;
    import_profile(contents)
}
