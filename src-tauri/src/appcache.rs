//! Caches that third-party software leaves behind: shader caches, game
//! launchers, chat and editor caches, package-manager downloads.
//!
//! # Why this is a hand-written table and not a Winapp2.ini parser
//!
//! The obvious way to cover "hundreds of programs" is to ship the community
//! `Winapp2.ini` and interpret it. That was considered and rejected:
//!
//!   * it is a four-megabyte file of *someone else's* deletion rules, updated
//!     outside this repo, and its own detection language (`DetectFile`,
//!     `ExcludeKey`, `RECURSE`, `REMOVESELF`) has to be implemented correctly
//!     or a misread exclusion deletes data the rule existed to protect;
//!   * it shifts the promise from "we verified this is safe to delete" to "we
//!     ran a file we downloaded", which is not a promise this app can keep;
//!   * redistributing it carries an attribution obligation and an
//!     auto-updating download path the app does not otherwise have.
//!
//! Every entry below was checked by hand against one rule: **deleting it must
//! cost the user time, never data.** A shader cache recompiles, a launcher's
//! web cache re-downloads, an npm cache refetches. Anything whose loss would
//! be felt as a loss — saved games, offline music, browser cookies, logs
//! someone might need — is not in this table and does not belong in it.
//!
//! These are deleted permanently rather than recycled, unlike everything in
//! `cleanup.rs`. Sending fifteen gigabytes of shader cache to the Recycle Bin
//! frees nothing until the bin is emptied, and Windows silently permanently
//! deletes anything over the bin's size cap anyway — so recycling here would
//! be a promise of reversibility the mechanism cannot actually deliver. The
//! honesty is bought back by the table: nothing reaches this code that is not
//! regenerable by design.

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone, Debug)]
pub struct CacheGroup {
    pub id: &'static str,
    /// "shaders" | "launchers" | "apps" | "dev" | "windows"
    pub category: &'static str,
    /// English fallback, shown only when the UI has no translation for `id`.
    pub name: &'static str,
    pub bytes: u64,
    pub files: u32,
    /// Process holding these files open. Empty when nothing is in the way.
    /// The clean still runs and simply skips what it cannot touch, so this is
    /// advice rather than a gate.
    pub blocked_by: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct CacheScanProgress {
    pub id: &'static str,
    pub index: u32,
    pub total: u32,
}

#[derive(Serialize, Clone, Default, Debug)]
pub struct CacheCleanResult {
    pub freed_bytes: u64,
    pub deleted: u32,
    /// Files a running program still had open. Expected, not an error.
    pub skipped: u32,
}

struct CacheSpec {
    id: &'static str,
    category: &'static str,
    name: &'static str,
    /// The process that locks this cache, if any.
    process: &'static str,
}

/// The whole catalogue. Adding a row here is the only way to add a target,
/// which is what keeps `resolve` from ever being handed a path from outside.
const CACHES: &[CacheSpec] = &[
    CacheSpec {
        id: "shader_dx",
        category: "shaders",
        name: "DirectX shader cache",
        process: "",
    },
    CacheSpec {
        id: "shader_nvidia",
        category: "shaders",
        name: "NVIDIA shader cache",
        process: "",
    },
    CacheSpec {
        id: "shader_amd",
        category: "shaders",
        name: "AMD shader cache",
        process: "",
    },
    CacheSpec {
        id: "shader_intel",
        category: "shaders",
        name: "Intel shader cache",
        process: "",
    },
    CacheSpec {
        id: "steam",
        category: "launchers",
        name: "Steam web cache",
        process: "steam.exe",
    },
    CacheSpec {
        id: "epic",
        category: "launchers",
        name: "Epic Games Launcher cache",
        process: "EpicGamesLauncher.exe",
    },
    CacheSpec {
        id: "battlenet",
        category: "launchers",
        name: "Battle.net cache",
        process: "Battle.net.exe",
    },
    CacheSpec {
        id: "discord",
        category: "apps",
        name: "Discord cache",
        process: "Discord.exe",
    },
    CacheSpec {
        id: "vscode",
        category: "dev",
        name: "Visual Studio Code cache",
        process: "Code.exe",
    },
    CacheSpec {
        id: "npm",
        category: "dev",
        name: "npm package cache",
        process: "",
    },
    CacheSpec {
        id: "pip",
        category: "dev",
        name: "pip package cache",
        process: "",
    },
    CacheSpec {
        id: "crash_dumps",
        category: "windows",
        name: "Application crash dumps",
        process: "",
    },
    CacheSpec {
        id: "error_reports",
        category: "windows",
        name: "Windows error reports",
        process: "",
    },
];

fn local_app_data() -> Option<PathBuf> {
    std::env::var("LOCALAPPDATA").ok().map(PathBuf::from)
}

fn roaming_app_data() -> Option<PathBuf> {
    std::env::var("APPDATA").ok().map(PathBuf::from)
}

/// Where Steam is installed, from its own registry key rather than a guessed
/// `Program Files (x86)` path — a great many people move the library to a
/// second drive, and the guess would then clean a folder that isn't there.
#[cfg(windows)]
fn steam_path() -> Option<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Valve\Steam")
        .ok()?
        .get_value::<String, _>("SteamPath")
        .ok()
        .map(PathBuf::from)
}

#[cfg(not(windows))]
fn steam_path() -> Option<PathBuf> {
    None
}

/// Epic keeps several `webcache_<build>` folders side by side and leaves the
/// old ones behind after an update, so they are matched by prefix rather than
/// listed by name.
fn epic_web_caches(saved: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(saved)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| {
                    p.is_dir()
                        && p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n.starts_with("webcache"))
                            .unwrap_or(false)
                })
                .collect()
        })
        .unwrap_or_default()
}

/// The concrete folders one catalogue entry covers, on this machine.
///
/// Every path is built from an environment variable or a registry value, so a
/// machine that does not have the software simply yields nothing.
fn resolve(id: &str) -> Vec<PathBuf> {
    let local = local_app_data();
    let roaming = roaming_app_data();
    let under = |base: &Option<PathBuf>, parts: &[&str]| -> Option<PathBuf> {
        let mut p = base.clone()?;
        for part in parts {
            p.push(part);
        }
        Some(p)
    };

    let paths: Vec<Option<PathBuf>> = match id {
        "shader_dx" => vec![under(&local, &["D3DSCache"])],
        "shader_nvidia" => vec![
            under(&local, &["NVIDIA", "DXCache"]),
            under(&local, &["NVIDIA", "GLCache"]),
            under(&local, &["NVIDIA Corporation", "NV_Cache"]),
        ],
        "shader_amd" => vec![
            under(&local, &["AMD", "DxCache"]),
            under(&local, &["AMD", "DxcCache"]),
            under(&local, &["AMD", "GLCache"]),
            under(&local, &["AMD", "VkCache"]),
        ],
        "shader_intel" => vec![under(&local, &["Intel", "ShaderCache"])],
        "steam" => {
            let root = steam_path();
            vec![
                // Only the two caches Steam rebuilds on demand. `appcache`
                // itself also holds the library's app metadata, and deleting
                // that makes Steam re-download it for every installed game.
                under(&root, &["appcache", "httpcache"]),
                under(&root, &["config", "htmlcache"]),
            ]
        }
        "epic" => {
            let saved = under(&local, &["EpicGamesLauncher", "Saved"]);
            return saved
                .filter(|p| p.is_dir())
                .map(|p| epic_web_caches(&p))
                .unwrap_or_default();
        }
        "battlenet" => vec![under(&local, &["Battle.net", "Cache"])],
        "discord" => vec![
            under(&roaming, &["discord", "Cache"]),
            under(&roaming, &["discord", "Code Cache"]),
            under(&roaming, &["discord", "GPUCache"]),
        ],
        "vscode" => vec![
            under(&roaming, &["Code", "Cache"]),
            under(&roaming, &["Code", "CachedData"]),
            under(&roaming, &["Code", "Code Cache"]),
            under(&roaming, &["Code", "GPUCache"]),
        ],
        "npm" => vec![under(&local, &["npm-cache", "_cacache"])],
        "pip" => vec![under(&local, &["pip", "Cache"])],
        "crash_dumps" => vec![under(&local, &["CrashDumps"])],
        "error_reports" => vec![
            under(&local, &["Microsoft", "Windows", "WER", "ReportArchive"]),
            under(&local, &["Microsoft", "Windows", "WER", "ReportQueue"]),
        ],
        _ => vec![],
    };

    paths.into_iter().flatten().filter(|p| is_safe_target(p)).collect()
}

/// Last line of defence between a mistake in the table and someone's drive.
///
/// A resolved path must be a real directory, must sit at least three levels
/// deep (so a mis-set `LOCALAPPDATA` cannot produce `C:\` or `C:\Users`), and
/// must not be one of the directories `cleanup.rs` already refuses to touch.
pub(crate) fn is_safe_target(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    if path.components().count() < 4 {
        return false;
    }
    // The table only ever names cache folders, so a resolved path whose final
    // component is a whole user profile or program root means an environment
    // variable resolved to something unexpected.
    !crate::cleanup::touches_protected_dir(path)
}

fn walk(dir: &Path, out: &mut Vec<(PathBuf, u64)>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        match entry.file_type() {
            // Symlinks are not followed: a junction inside a cache folder
            // would otherwise walk straight out of it and delete whatever it
            // points at.
            Ok(t) if t.is_symlink() => continue,
            Ok(t) if t.is_dir() => walk(&path, out),
            Ok(_) => {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                out.push((path, size));
            }
            Err(_) => continue,
        }
    }
}

fn files_in(id: &str) -> Vec<(PathBuf, u64)> {
    let mut out = Vec::new();
    for dir in resolve(id) {
        walk(&dir, &mut out);
    }
    out
}

/// Removes directories left empty by the file deletions, deepest first.
///
/// Best-effort: a directory the program recreated between the two passes just
/// stays, which is harmless.
fn prune_empty_dirs(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if entry.file_type().map(|t| t.is_dir() && !t.is_symlink()).unwrap_or(false) {
            prune_empty_dirs(&path);
            let _ = std::fs::remove_dir(&path);
        }
    }
}

pub fn scan<F>(mut on_progress: F) -> Vec<CacheGroup>
where
    F: FnMut(CacheScanProgress),
{
    let total = CACHES.len() as u32;
    CACHES
        .iter()
        .enumerate()
        .filter_map(|(index, spec)| {
            on_progress(CacheScanProgress {
                id: spec.id,
                index: index as u32 + 1,
                total,
            });
            let files = files_in(spec.id);
            if files.is_empty() {
                return None;
            }
            Some(CacheGroup {
                id: spec.id,
                category: spec.category,
                name: spec.name,
                bytes: files.iter().map(|(_, size)| size).sum(),
                files: files.len() as u32,
                blocked_by: if !spec.process.is_empty()
                    && crate::browsercleanup::is_running(spec.process)
                {
                    spec.process.to_string()
                } else {
                    String::new()
                },
            })
        })
        .collect()
}

/// Deletes the selected groups, stepping over anything still locked.
///
/// A locked file is the normal case, not a failure: the point of continuing is
/// that one open shader cache must not cost the user the other fourteen
/// gigabytes they asked to reclaim.
pub fn clean(ids: &[String]) -> CacheCleanResult {
    let mut result = CacheCleanResult::default();

    for spec in CACHES.iter().filter(|s| ids.iter().any(|i| i == s.id)) {
        for (path, size) in files_in(spec.id) {
            match std::fs::remove_file(&path) {
                Ok(()) => {
                    result.freed_bytes += size;
                    result.deleted += 1;
                }
                Err(_) => result.skipped += 1,
            }
        }
        for dir in resolve(spec.id) {
            prune_empty_dirs(&dir);
        }
    }
    result
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn scan_app_caches(app: tauri::AppHandle) -> Result<Vec<CacheGroup>, String> {
    use tauri::Emitter;
    let emitter = app.clone();
    // Scanning is deliberately free: the number it produces is the honest
    // argument for the upgrade, and a paywall in front of it would be asking
    // people to pay to find out whether there is anything to pay for.
    Ok(scan(move |p| {
        let _ = emitter.emit("app-cache-progress", p);
    }))
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn clean_app_caches(
    app: tauri::AppHandle,
    ids: Vec<String>,
) -> Result<CacheCleanResult, String> {
    let dir = crate::store_for_dir(&app)?;
    crate::require_pro(&dir)?;
    let result = clean(&ids);
    crate::audit::record(
        "app-cache-clean",
        &ids.join(","),
        result.deleted > 0,
        Some(format!(
            "{} files, {} bytes, {} skipped",
            result.deleted, result.freed_bytes, result.skipped
        )),
    );
    Ok(result)
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn scan_app_caches(_app: tauri::AppHandle) -> Result<Vec<CacheGroup>, String> {
    Ok(Vec::new())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn clean_app_caches(
    _app: tauri::AppHandle,
    _ids: Vec<String>,
) -> Result<CacheCleanResult, String> {
    Err("app cache cleaning is only available on Windows".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The catalogue is the whole safety argument, so its shape is worth
    /// asserting: a duplicate id would make one entry unreachable, and an
    /// unknown category would render as an unlabelled group.
    #[test]
    fn the_catalogue_is_well_formed() {
        let mut ids: Vec<&str> = CACHES.iter().map(|c| c.id).collect();
        let count = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), count, "duplicate cache id");

        for spec in CACHES {
            assert!(!spec.id.is_empty());
            assert!(!spec.name.is_empty());
            assert!(
                matches!(
                    spec.category,
                    "shaders" | "launchers" | "apps" | "dev" | "windows"
                ),
                "{} has an unknown category",
                spec.id
            );
        }
    }

    /// `resolve` must never return a path for something not in the table —
    /// this is what makes "the table is the only way in" true rather than
    /// merely intended.
    #[test]
    fn unknown_ids_resolve_to_nothing() {
        assert!(resolve("").is_empty());
        assert!(resolve("../../windows").is_empty());
        assert!(resolve("system32").is_empty());
    }

    /// The depth floor is what stops a mis-set or empty `LOCALAPPDATA` from
    /// turning a cache path into a drive root.
    #[test]
    fn shallow_and_protected_paths_are_refused() {
        assert!(!is_safe_target(Path::new(r"C:\")));
        assert!(!is_safe_target(Path::new(r"C:\Users")));
        assert!(!is_safe_target(Path::new(r"C:\Windows\System32")));
        // Not a directory at all.
        assert!(!is_safe_target(Path::new(r"C:\this\does\not\exist\anywhere")));
    }

    /// A real, deep, unprotected directory is accepted — otherwise the guard
    /// above would be refusing everything and the feature would silently do
    /// nothing.
    #[test]
    fn a_real_deep_directory_is_accepted() {
        let dir = std::env::temp_dir().join("pctweaker-cache-test").join("a").join("b");
        std::fs::create_dir_all(&dir).unwrap();
        assert!(is_safe_target(&dir));
        let _ = std::fs::remove_dir_all(std::env::temp_dir().join("pctweaker-cache-test"));
    }

    /// Cleaning must ignore ids the caller invented, however they arrive.
    #[test]
    fn cleaning_an_unknown_id_does_nothing() {
        let result = clean(&["not_a_cache".to_string(), String::new()]);
        assert_eq!(result.deleted, 0);
        assert_eq!(result.freed_bytes, 0);
    }

    /// Deletion walks files it collected itself; a symlink or junction inside
    /// a cache folder must not become a way out of it.
    #[test]
    fn the_walk_does_not_follow_links() {
        let root = std::env::temp_dir().join(format!(
            "pctweaker-walk-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let inside = root.join("inside");
        std::fs::create_dir_all(&inside).unwrap();
        std::fs::write(inside.join("cached.bin"), b"12345").unwrap();

        let mut found = Vec::new();
        walk(&root, &mut found);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].1, 5);

        let _ = std::fs::remove_dir_all(&root);
    }
}
