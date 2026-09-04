//! Cache and cookie cleanup for Chrome, Edge, Brave, Vivaldi, Opera and
//! Firefox.
//!
//! Deliberately narrow: this module deletes whole cache folders and whole
//! cookie files, and never opens the browser's own SQLite databases — that
//! is a much larger safety surface than deleting files the browser already
//! knows how to recreate from scratch on next launch.
//!
//! Per-site cookie picking is the one place that trade came out the other
//! way, because wiping the cookie file signs the user out of everything.
//! It lives in `cookies.rs`, which borrows this module's browser table and
//! path detection and takes on the database handling itself.

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct BrowserCleanupInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub running: bool,
    pub cache_bytes: u64,
    pub cookies_bytes: u64,
}

#[derive(Serialize, Clone, Default, Debug)]
pub struct BrowserCleanupResult {
    pub freed_bytes: u64,
}

struct BrowserSpec {
    id: &'static str,
    name: &'static str,
    process_name: &'static str,
}

const BROWSERS: &[BrowserSpec] = &[
    BrowserSpec {
        id: "chrome",
        name: "Google Chrome",
        process_name: "chrome.exe",
    },
    BrowserSpec {
        id: "edge",
        name: "Microsoft Edge",
        process_name: "msedge.exe",
    },
    BrowserSpec {
        id: "brave",
        name: "Brave",
        process_name: "brave.exe",
    },
    BrowserSpec {
        id: "vivaldi",
        name: "Vivaldi",
        process_name: "vivaldi.exe",
    },
    BrowserSpec {
        id: "opera",
        name: "Opera",
        process_name: "opera.exe",
    },
    BrowserSpec {
        id: "opera_gx",
        name: "Opera GX",
        process_name: "opera.exe",
    },
    BrowserSpec {
        id: "firefox",
        name: "Mozilla Firefox",
        process_name: "firefox.exe",
    },
];

/// Every browser this app knows about, as `(id, display name, process
/// name)`. Exposed so `cookies.rs` can iterate the same table rather than
/// keeping a second copy that would drift the first time a browser is added.
pub(crate) fn browser_list() -> impl Iterator<Item = (&'static str, &'static str, &'static str)> {
    BROWSERS.iter().map(|b| (b.id, b.name, b.process_name))
}

fn dir_size(path: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries
        .filter_map(|e| e.ok())
        .map(|e| {
            let meta = match e.metadata() {
                Ok(m) => m,
                Err(_) => return 0,
            };
            if meta.is_dir() {
                dir_size(&e.path())
            } else {
                meta.len()
            }
        })
        .sum()
}

fn file_size(path: &Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

/// The Chromium profile layout, given where the profile lives and where its
/// caches live.
///
/// Those are usually the same folder, but not always: Opera keeps its
/// profile under Roaming and its caches under Local, so the two roots are
/// separate parameters rather than one assumed to serve both.
///
/// Cookies moved into a `Network` subfolder around Chrome 96; both locations
/// are checked since a machine's profile may predate the move.
fn chromium_profile_paths(profile: &Path, cache_root: &Path) -> (Vec<PathBuf>, Vec<PathBuf>) {
    let cache_dirs = vec![
        cache_root.join("Cache"),
        cache_root.join("Cache2").join("entries"),
        cache_root.join("Code Cache"),
    ];
    let cookie_files = vec![
        profile.join("Network").join("Cookies"),
        profile.join("Cookies"),
    ];
    (cache_dirs, cookie_files)
}

/// Chrome, Edge, Brave and Vivaldi share a layout: a `User Data` folder with
/// the profile in `Default`, caches included.
fn chromium_paths(user_data_dir: PathBuf) -> (Vec<PathBuf>, Vec<PathBuf>) {
    let profile = user_data_dir.join("Default");
    chromium_profile_paths(&profile, &profile)
}

fn vivaldi_user_data_dir() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    Some(PathBuf::from(local).join("Vivaldi").join("User Data"))
}

/// Opera is Chromium but files itself differently in two ways that matter:
/// the profile is the edition folder itself rather than a `Default` inside a
/// `User Data`, and it sits under Roaming while the caches sit under Local.
///
/// `edition` is the folder name — "Opera Stable" or "Opera GX Stable".
fn opera_paths(edition: &str) -> Option<(Vec<PathBuf>, Vec<PathBuf>)> {
    let roaming = std::env::var("APPDATA").ok()?;
    let local = std::env::var("LOCALAPPDATA").ok()?;
    let profile = PathBuf::from(roaming).join("Opera Software").join(edition);
    let cache_root = PathBuf::from(local).join("Opera Software").join(edition);
    Some(chromium_profile_paths(&profile, &cache_root))
}

fn chrome_user_data_dir() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    Some(PathBuf::from(local).join("Google").join("Chrome").join("User Data"))
}

/// Brave nests its user data one level deeper than the other two:
/// `BraveSoftware\\Brave-Browser\\User Data`, not `Brave\\User Data`.
fn brave_user_data_dir() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    Some(
        PathBuf::from(local)
            .join("BraveSoftware")
            .join("Brave-Browser")
            .join("User Data"),
    )
}

fn edge_user_data_dir() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    Some(
        PathBuf::from(local)
            .join("Microsoft")
            .join("Edge")
            .join("User Data"),
    )
}

/// Firefox keeps profiles.ini too, but the active profile's `Path=` line is
/// enough to find on-disk data; a full INI parser would be more machinery
/// than this needs.
fn firefox_profile_dir() -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    let profiles_root = PathBuf::from(&appdata).join("Mozilla").join("Firefox").join("Profiles");
    let ini_path = PathBuf::from(&appdata)
        .join("Mozilla")
        .join("Firefox")
        .join("profiles.ini");

    if let Ok(ini) = std::fs::read_to_string(&ini_path) {
        if let Some(path) = parse_firefox_default_profile(&ini) {
            let candidate = profiles_root.join(&path);
            if candidate.is_dir() {
                return Some(candidate);
            }
        }
    }

    // Fall back to whatever release profile exists on disk, in case
    // profiles.ini is missing a Default= line this parser doesn't expect.
    std::fs::read_dir(&profiles_root)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| {
            p.is_dir()
                && p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.ends_with(".default-release") || n.ends_with(".default"))
                    .unwrap_or(false)
        })
}

/// Reads the relative profile path out of `profiles.ini`. Prefers the
/// `[Install...]` section's `Default=` (used since Firefox 67) and falls
/// back to a `[ProfileN]` section marked `Default=1`.
fn parse_firefox_default_profile(ini: &str) -> Option<String> {
    let mut install_default: Option<String> = None;
    let mut profile_default: Option<String> = None;
    let mut in_install = false;
    let mut in_marked_profile = false;
    let mut current_profile_path: Option<String> = None;

    for raw_line in ini.lines() {
        let line = raw_line.trim();
        if line.starts_with('[') {
            if in_marked_profile {
                if let Some(p) = current_profile_path.take() {
                    profile_default.get_or_insert(p);
                }
            }
            in_install = line.starts_with("[Install");
            in_marked_profile = false;
            current_profile_path = None;
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if in_install && key == "Default" {
            install_default = Some(value.to_string());
        } else if key == "Path" {
            current_profile_path = Some(value.to_string());
        } else if key == "Default" && value == "1" {
            in_marked_profile = true;
        }
    }
    if in_marked_profile {
        if let Some(p) = current_profile_path {
            profile_default.get_or_insert(p);
        }
    }

    install_default.or(profile_default)
}

pub(crate) fn is_running(process_name: &str) -> bool {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
    let mut sys = System::new_with_specifics(RefreshKind::new());
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::new());
    sys.processes()
        .values()
        .any(|p| p.name().to_string_lossy().eq_ignore_ascii_case(process_name))
}

pub(crate) fn paths_for(id: &str) -> Option<(Vec<PathBuf>, Vec<PathBuf>)> {
    match id {
        "chrome" => Some(chromium_paths(chrome_user_data_dir()?)),
        "edge" => Some(chromium_paths(edge_user_data_dir()?)),
        "brave" => Some(chromium_paths(brave_user_data_dir()?)),
        "vivaldi" => Some(chromium_paths(vivaldi_user_data_dir()?)),
        "opera" => opera_paths("Opera Stable"),
        "opera_gx" => opera_paths("Opera GX Stable"),
        "firefox" => {
            let profile = firefox_profile_dir()?;
            Some((
                vec![profile.join("cache2")],
                vec![profile.join("cookies.sqlite")],
            ))
        }
        _ => None,
    }
}

/// One row per browser that has a profile on this machine. A browser with
/// no detectable profile (never installed, or installed but never run) is
/// left out rather than shown with everything at zero.
pub fn detect() -> Vec<BrowserCleanupInfo> {
    BROWSERS
        .iter()
        .filter_map(|b| {
            let (cache_dirs, cookie_files) = paths_for(b.id)?;
            if !cache_dirs.iter().chain(cookie_files.iter()).any(|p| p.exists()) {
                return None;
            }
            let cache_bytes = cache_dirs.iter().map(|p| dir_size(p)).sum();
            let cookies_bytes = cookie_files.iter().map(|p| file_size(p)).sum();
            Some(BrowserCleanupInfo {
                id: b.id,
                name: b.name,
                running: is_running(b.process_name),
                cache_bytes,
                cookies_bytes,
            })
        })
        .collect()
}

/// Moves a browser's cache and cookie files to the Recycle Bin. Refuses if
/// the browser is running: deleting files a running Chromium process still
/// has open corrupts its next write rather than simply losing history, so
/// this is checked fresh here rather than trusting a `detect()` result the
/// caller may be holding from moments earlier.
pub fn clear(id: &str) -> Result<BrowserCleanupResult, String> {
    let spec = BROWSERS
        .iter()
        .find(|b| b.id == id)
        .ok_or_else(|| format!("unknown browser: {}", id))?;
    if is_running(spec.process_name) {
        return Err(format!("{} is running - close it first", spec.name));
    }
    let (cache_dirs, cookie_files) = paths_for(id).ok_or_else(|| "no profile found".to_string())?;

    let mut freed = 0u64;
    for dir in cache_dirs {
        if !dir.exists() {
            continue;
        }
        let size = dir_size(&dir);
        if trash::delete(&dir).is_ok() {
            freed += size;
        }
    }
    for file in cookie_files {
        if !file.exists() {
            continue;
        }
        let size = file_size(&file);
        if trash::delete(&file).is_ok() {
            freed += size;
        }
    }
    Ok(BrowserCleanupResult { freed_bytes: freed })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_install_default_profile() {
        let ini = "[Install308046B0AF4A39CB]\nDefault=abc123.default-release\nLocked=1\n\n[Profile0]\nName=default-release\nIsRelative=1\nPath=abc123.default-release\nDefault=1\n";
        assert_eq!(
            parse_firefox_default_profile(ini),
            Some("abc123.default-release".to_string())
        );
    }

    #[test]
    fn falls_back_to_marked_profile_without_install_section() {
        let ini = "[Profile0]\nName=default\nIsRelative=1\nPath=xyz.default\nDefault=1\n";
        assert_eq!(
            parse_firefox_default_profile(ini),
            Some("xyz.default".to_string())
        );
    }

    #[test]
    fn returns_none_for_empty_ini() {
        assert_eq!(parse_firefox_default_profile(""), None);
    }

    #[test]
    fn install_section_wins_over_marked_profile() {
        let ini = "[Install1]\nDefault=install-wins.default-release\n\n[Profile0]\nPath=marked.default\nDefault=1\n";
        assert_eq!(
            parse_firefox_default_profile(ini),
            Some("install-wins.default-release".to_string())
        );
    }

    #[test]
    fn dir_size_sums_nested_files() {
        let tmp = std::env::temp_dir().join(format!("pctweaker-browsercleanup-test-{}", std::process::id()));
        std::fs::create_dir_all(tmp.join("nested")).unwrap();
        std::fs::write(tmp.join("a.bin"), vec![0u8; 10]).unwrap();
        std::fs::write(tmp.join("nested").join("b.bin"), vec![0u8; 20]).unwrap();
        assert_eq!(dir_size(&tmp), 30);
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn dir_size_of_missing_dir_is_zero() {
        let tmp = std::env::temp_dir().join("pctweaker-browsercleanup-does-not-exist");
        assert_eq!(dir_size(&tmp), 0);
    }

    #[test]
    fn clear_rejects_unknown_browser_id() {
        assert!(clear("netscape-navigator").is_err());
    }

    #[test]
    fn is_running_is_false_for_a_name_nothing_uses() {
        assert!(!is_running("pctweaker-browsercleanup-test-sentinel.exe"));
    }


    #[test]
    fn brave_is_offered_and_uses_its_own_folder() {
        // Requested by a user who browses only with Brave, so the cleanup
        // screen was empty for him. Brave is Chromium, so the profile layout
        // is Chrome's — but its user data sits one level deeper, under
        // BraveSoftware\\Brave-Browser, which is the part that is easy to get
        // wrong by pattern-matching on the other two.
        assert!(BROWSERS.iter().any(|b| b.id == "brave" && b.process_name == "brave.exe"));

        let Some(dir) = brave_user_data_dir() else {
            return; // No LOCALAPPDATA: nothing to assert about the path.
        };
        let text = dir.to_string_lossy().replace('\\', "/");
        assert!(text.ends_with("BraveSoftware/Brave-Browser/User Data"), "unexpected path: {text}");
    }

    #[test]
    fn the_chromium_browsers_resolve_without_a_profile_on_disk() {
        // paths_for returns None for two different reasons — an id it does
        // not handle, and a browser whose profile cannot be located — so it
        // cannot prove on its own that a new entry was wired up. What it can
        // prove is that the Chromium three, which need only LOCALAPPDATA,
        // resolve on any machine including this one. Firefox is deliberately
        // not in this list: without an installed profile it returns None,
        // which is correct behaviour and not a missing match arm.
        for id in ["chrome", "edge", "brave"] {
            assert!(
                std::env::var("LOCALAPPDATA").is_err() || paths_for(id).is_some(),
                "{id} is listed but paths_for does not resolve it"
            );
        }
    }

    #[test]
    fn opera_reads_its_profile_and_its_caches_from_different_roots() {
        // The one layout here that is not Chrome's. Opera keeps the profile
        // under Roaming and the caches under Local, and there is no `Default`
        // folder — the edition folder is the profile. Collapsing the two
        // roots, which is what copying the Chrome case would do, would point
        // the cleanup at folders that do not exist and quietly find nothing.
        let (Ok(roaming), Ok(local)) = (std::env::var("APPDATA"), std::env::var("LOCALAPPDATA"))
        else {
            return;
        };
        let (cache_dirs, cookie_files) = opera_paths("Opera Stable").expect("paths");
        assert!(cache_dirs.iter().all(|p| p.starts_with(&local)), "caches belong under Local");
        assert!(cookie_files.iter().all(|p| p.starts_with(&roaming)), "cookies belong under Roaming");
        assert!(
            cookie_files.iter().all(|p| !p.to_string_lossy().contains("Default")),
            "Opera has no Default subfolder"
        );
    }

    #[test]
    fn the_two_opera_editions_never_touch_each_other() {
        // Opera and Opera GX are separate installs with separate profiles,
        // and they share a process name — so the only thing keeping them
        // apart is the folder.
        let (Some((gx_cache, gx_cookies)), Some((op_cache, op_cookies))) =
            (opera_paths("Opera GX Stable"), opera_paths("Opera Stable"))
        else {
            return;
        };
        for gx in gx_cache.iter().chain(gx_cookies.iter()) {
            for op in op_cache.iter().chain(op_cookies.iter()) {
                assert_ne!(gx, op);
            }
        }
    }

    #[test]
    fn every_chromium_browser_lands_in_its_own_vendor_folder() {
        if std::env::var("LOCALAPPDATA").is_err() {
            return;
        }
        let expected = [
            ("chrome", "Google"),
            ("edge", "Microsoft"),
            ("brave", "BraveSoftware"),
            ("vivaldi", "Vivaldi"),
            ("opera", "Opera Software"),
            ("opera_gx", "Opera Software"),
        ];
        for (id, vendor) in expected {
            let (cache_dirs, _) = paths_for(id).expect("paths");
            assert!(
                cache_dirs
                    .iter()
                    .all(|p| p.to_string_lossy().contains(vendor)),
                "{id} should clean inside {vendor}"
            );
        }
    }

    #[test]
    fn an_id_outside_the_table_is_refused() {
        assert!(paths_for("netscape").is_none());
        assert!(paths_for("").is_none());
    }

    #[test]
    fn brave_and_chrome_do_not_share_a_directory() {
        // Cleaning one must never reach into the other's profile.
        if let (Some(brave), Some(chrome)) = (brave_user_data_dir(), chrome_user_data_dir()) {
            assert_ne!(brave, chrome);
            assert!(!brave.starts_with(&chrome));
            assert!(!chrome.starts_with(&brave));
        }
    }
}
