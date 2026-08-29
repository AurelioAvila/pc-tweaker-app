//! Cache and cookie cleanup for Chrome, Edge and Firefox.
//!
//! Deliberately narrow: no extension auditing, no per-site cookie picking.
//! Both would need to read the browser's own SQLite databases, which is a
//! much larger safety surface than deleting files the browser already
//! knows how to recreate from scratch on next launch.

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
        id: "firefox",
        name: "Mozilla Firefox",
        process_name: "firefox.exe",
    },
];

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

/// Chrome and Edge share a profile layout because Edge is Chromium. Cookies
/// moved into a `Network` subfolder around Chrome 96; both locations are
/// checked since a machine's profile may predate the move.
fn chromium_paths(user_data_dir: PathBuf) -> (Vec<PathBuf>, Vec<PathBuf>) {
    let profile = user_data_dir.join("Default");
    let cache_dirs = vec![
        profile.join("Cache"),
        profile.join("Cache2").join("entries"),
        profile.join("Code Cache"),
    ];
    let cookie_files = vec![
        profile.join("Network").join("Cookies"),
        profile.join("Cookies"),
    ];
    (cache_dirs, cookie_files)
}

fn chrome_user_data_dir() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    Some(PathBuf::from(local).join("Google").join("Chrome").join("User Data"))
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

fn is_running(process_name: &str) -> bool {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
    let mut sys = System::new_with_specifics(RefreshKind::new());
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::new());
    sys.processes()
        .values()
        .any(|p| p.name().to_string_lossy().eq_ignore_ascii_case(process_name))
}

fn paths_for(id: &str) -> Option<(Vec<PathBuf>, Vec<PathBuf>)> {
    match id {
        "chrome" => Some(chromium_paths(chrome_user_data_dir()?)),
        "edge" => Some(chromium_paths(edge_user_data_dir()?)),
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
}
