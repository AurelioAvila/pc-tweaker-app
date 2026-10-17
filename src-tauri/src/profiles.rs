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

/// `deny_unknown_fields`: the shape has never changed since format 1, so an
/// extra field means the file is something else, and a future shape bumps
/// `format` (checked before this struct is parsed).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct TweakProfile {
    /// Format marker, not the app version — an old profile stays loadable.
    pub format: u32,
    pub name: String,
    /// Seconds since the epoch (see `now_iso`), for showing "saved on ...".
    /// Empty only for a starter profile, which is never read from a file.
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
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        self.dir.join(format!("{}.json", safe.trim()))
    }
}

/// Every tweak id a profile can carry: the switches `list_tweaks` shows,
/// except the three controls configured in their own panels, which
/// `apply_tweaks` refuses by id. The allowlist an import is checked against.
///
/// This list once stopped growing with the catalogue, so saved profiles
/// silently left out the 1.18.0 controls, power tuning, core parking, the
/// TCP congestion provider and the AI Components Host. A test now compares
/// it with the catalogue.
fn known_tweak_ids() -> Vec<String> {
    let mut ids: Vec<String> = crate::tweaks::all_tweaks()
        .iter()
        .filter(|t| t.id != "disable_copilot")
        .map(|t| t.id.to_string())
        .collect();
    ids.extend(
        [
            crate::power::TWEAK_ID,
            crate::turbo::TWEAK_ID,
            crate::gaming::INPUT_LAG_ID,
            crate::gaming::TURBO_BOOST_ID,
            crate::gaming::KEYBOARD_DELAY_ID,
            crate::gaming::CORE_PARKING_ID,
            crate::game_priority::TWEAK_ID,
            crate::privacy_extra::ACTIVITY_HISTORY_ID,
            crate::privacy_extra::TYPING_PERSONALIZATION_ID,
            crate::contextmenu::TWEAK_ID,
            crate::services::WINDOWS_SEARCH_ID,
            crate::services::AI_FABRIC_ID,
            crate::netlatency::TWEAK_ID,
            crate::netshaper::TWEAK_ID,
            crate::dns::TWEAK_ID,
            "disable_filter_keys_shortcut",
        ]
        .iter()
        .map(|s| s.to_string()),
    );
    ids.extend(crate::power_tuning::TWEAKS.iter().map(|t| t.id.to_string()));
    ids.extend(crate::settings_tweaks::TWEAKS.iter().map(|t| t.id.to_string()));
    ids
}

/// The most ids a file may name. The catalogue has fewer than a hundred, so
/// a longer list is not a profile.
const MAX_IDS: usize = 256;
const MAX_NAME_CHARS: usize = 40;
const MAX_FILE_BYTES: usize = 64 * 1024;
const NOT_A_PROFILE: &str = "this file isn't a PC Tweaker profile";

/// Checks a parsed file field by field and keeps only the ids this build can
/// apply, each once. Everything is checked before the user sees anything: a
/// name the app could not have written, a date that is not one, or an
/// oversized list means the file was not made by PC Tweaker.
fn validate(parsed: TweakProfile) -> Result<LoadedProfile, String> {
    let name = parsed.name.trim().to_string();
    let name_ok = !name.is_empty()
        && name.chars().count() <= MAX_NAME_CHARS
        && !name.chars().any(char::is_control);
    // Written by `now_iso` as seconds since the epoch. An empty date is how
    // the starter profiles are told apart in the history, so a file cannot
    // borrow it.
    let date_ok = (1..=20).contains(&parsed.created_at.len())
        && parsed.created_at.bytes().all(|b| b.is_ascii_digit());
    if parsed.format == 0 || !name_ok || !date_ok || parsed.tweaks.len() > MAX_IDS {
        return Err(NOT_A_PROFILE.to_string());
    }
    let known = known_tweak_ids();
    let (mut tweaks, mut unknown) = (Vec::new(), Vec::new());
    for id in parsed.tweaks {
        let list = if known.contains(&id) {
            &mut tweaks
        } else {
            &mut unknown
        };
        if !list.contains(&id) {
            list.push(id);
        }
    }
    Ok(LoadedProfile {
        profile: TweakProfile {
            format: parsed.format,
            name,
            created_at: parsed.created_at,
            tweaks,
        },
        unknown,
    })
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
#[tauri::command(async)]
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

#[tauri::command(async)]
pub fn save_profile(profile: TweakProfile, app: tauri::AppHandle) -> Result<(), String> {
    let profiles = ProfileStore::new(crate::store_for_dir(&app)?);
    if profile.name.trim().is_empty() {
        return Err("a profile needs a name".to_string());
    }
    fs::create_dir_all(&profiles.dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    fs::write(profiles.file_for(&profile.name), json).map_err(|e| e.to_string())
}

#[tauri::command(async)]
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

#[tauri::command(async)]
pub fn delete_profile(name: String, app: tauri::AppHandle) -> Result<(), String> {
    let profiles = ProfileStore::new(crate::store_for_dir(&app)?);
    let path = profiles.file_for(&name);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Serializes a profile for writing to a file the user picks.
#[tauri::command(async)]
pub fn export_profile(profile: TweakProfile) -> Result<String, String> {
    serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())
}

/// Parses a profile file, keeping only ids this build recognises.
///
/// Deliberately returns the profile rather than applying it — see the module
/// docs on why importing must never be the same action as running.
#[tauri::command(async)]
pub fn import_profile(contents: String) -> Result<LoadedProfile, String> {
    if contents.len() > MAX_FILE_BYTES {
        return Err(NOT_A_PROFILE.to_string());
    }
    let value: serde_json::Value =
        serde_json::from_str(&contents).map_err(|_| NOT_A_PROFILE.to_string())?;
    // The format first, so a newer file is reported as newer rather than as
    // not a profile because of a field this build does not know.
    if value
        .get("format")
        .and_then(serde_json::Value::as_u64)
        .is_some_and(|f| f > u64::from(PROFILE_FORMAT))
    {
        return Err("this profile was made by a newer version of PC Tweaker".to_string());
    }
    validate(serde_json::from_value(value).map_err(|_| NOT_A_PROFILE.to_string())?)
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
        assert_eq!(
            loaded.profile.tweaks,
            vec!["priority_separation".to_string()]
        );
        assert_eq!(
            loaded.unknown.len(),
            3,
            "unknown ids must be reported, not silently kept"
        );
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

    fn file(fields: serde_json::Value) -> String {
        let mut base = serde_json::json!({
            "format": 1,
            "name": "Gaming",
            "created_at": "1700000000",
            "tweaks": ["priority_separation"],
        });
        for (k, v) in fields.as_object().unwrap() {
            base[k] = v.clone();
        }
        base.to_string()
    }

    #[test]
    fn a_file_the_app_could_not_have_written_is_refused() {
        for bad in [
            serde_json::json!({ "format": 0 }),
            serde_json::json!({ "name": "   " }),
            serde_json::json!({ "name": "line\nbreak" }),
            serde_json::json!({ "name": "x".repeat(MAX_NAME_CHARS + 1) }),
            serde_json::json!({ "created_at": "" }),
            serde_json::json!({ "created_at": "2026-10-15" }),
            serde_json::json!({ "tweaks": vec!["priority_separation"; MAX_IDS + 1] }),
            serde_json::json!({ "run": "powershell -c whatever" }),
        ] {
            assert!(import_profile(file(bad.clone())).is_err(), "accepted {bad}");
        }
        assert!(import_profile(" ".repeat(MAX_FILE_BYTES + 1)).is_err());
        // The longest name the app's own field allows still imports.
        let longest = serde_json::json!({ "name": "é".repeat(MAX_NAME_CHARS) });
        assert!(import_profile(file(longest)).is_ok());
    }

    #[test]
    fn a_repeated_id_is_kept_once_and_the_name_is_trimmed() {
        let loaded = import_profile(file(serde_json::json!({
            "name": "  Gaming  ",
            "tweaks": ["priority_separation", "nope", "priority_separation", "nope"],
        })))
        .unwrap();
        assert_eq!(loaded.profile.name, "Gaming");
        assert_eq!(loaded.profile.tweaks, vec!["priority_separation"]);
        assert_eq!(loaded.unknown, vec!["nope"]);
    }

    /// A profile carries every switch the catalogue shows, so saving one and
    /// loading it on another PC loses nothing. The three controls set up in
    /// their own panels are the exception: `apply_tweaks` refuses them by id.
    #[cfg(windows)]
    #[test]
    fn a_profile_can_carry_every_switch_in_the_catalogue() {
        let panel_only = ["ecoqos_rules", "limit_do_background_download", "monitor_refresh_profile"];
        let mut expected: Vec<String> = crate::tests::all_visible_ids()
            .into_iter()
            .filter(|id| !panel_only.contains(&id.as_str()))
            .collect();
        let mut known = known_tweak_ids();
        expected.sort();
        known.sort();
        assert_eq!(known, expected);
    }

    #[cfg(windows)]
    #[test]
    fn profile_files_are_local_json_files_only() {
        let p = TweakProfile {
            format: PROFILE_FORMAT,
            name: "Gaming".into(),
            created_at: "1700000000".into(),
            tweaks: vec!["priority_separation".into()],
        };
        let dir = std::env::temp_dir().join(format!("pct-profile-files-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let bat = dir.join("evil.bat");
        assert!(write_profile_file(bat.to_string_lossy().into(), p.clone()).is_err());
        assert!(!bat.exists());
        assert!(write_profile_file(r"\\server\share\p.json".into(), p.clone()).is_err());

        let json = dir.join("Gaming.pctweaker.json");
        write_profile_file(json.to_string_lossy().into(), p.clone()).unwrap();
        let loaded = read_profile_file(json.to_string_lossy().into()).unwrap();
        assert_eq!(loaded.profile.tweaks, p.tweaks);

        let txt = dir.join("p.txt");
        fs::copy(&json, &txt).unwrap();
        assert!(read_profile_file(txt.to_string_lossy().into()).is_err());
        let big = dir.join("big.json");
        fs::write(&big, " ".repeat(MAX_FILE_BYTES + 10)).unwrap();
        assert!(read_profile_file(big.to_string_lossy().into()).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    /// Profile names reach the filesystem, so they must not be able to walk
    /// out of the profiles directory.
    #[test]
    fn profile_names_cannot_escape_the_profiles_directory() {
        let store = ProfileStore::new(PathBuf::from("C:\\app-data"));
        for hostile in [
            "../../evil",
            "..\\..\\evil",
            "C:\\Windows\\System32\\evil",
            "a/b/c",
        ] {
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
/// always serializes a `TweakProfile`, and only to a .json file on a local
/// drive outside the app's own data folder (the same rule as the Debloat list
/// and the history export). A renderer bug or a hostile page that reached
/// this could otherwise put a name it chose inside a .bat or .cmd file: JSON
/// escaping means nothing to cmd.exe.
#[tauri::command(async)]
pub fn write_profile_file(path: String, profile: TweakProfile) -> Result<(), String> {
    let target = crate::baseline::local_file(&path, &["json"])
        .ok_or("a profile can only be saved as a .json file on a local drive")?;
    let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    fs::write(target, json).map_err(|e| format!("could not write the file: {}", e))
}

/// Reads and validates a profile from a path the user picked.
///
/// A local .json file only, never a share, device or pipe, and never more
/// than the size limit read into memory: the limit is enforced on the read
/// itself, so a file that grows after it was measured changes nothing.
#[tauri::command(async)]
pub fn read_profile_file(path: String) -> Result<LoadedProfile, String> {
    use std::io::Read;
    let target = crate::baseline::local_file(&path, &["json"])
        .ok_or("a profile can only be read from a .json file on a local drive")?;
    let file = fs::File::open(&target).map_err(|e| format!("could not open the file: {}", e))?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err(NOT_A_PROFILE.to_string());
    }
    let mut contents = String::new();
    file.take(MAX_FILE_BYTES as u64 + 1)
        .read_to_string(&mut contents)
        .map_err(|_| NOT_A_PROFILE.to_string())?;
    import_profile(contents)
}
