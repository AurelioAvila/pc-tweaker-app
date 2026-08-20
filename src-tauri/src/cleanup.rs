use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
pub struct CleanupInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct CleanupResult {
    pub freed_bytes: u64,
    pub deleted_count: u32,
    pub skipped_count: u32,
}

#[derive(Serialize, Clone)]
pub struct DuplicateGroup {
    pub size: u64,
    pub paths: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct LargeFile {
    pub path: String,
    pub size: u64,
}

const MAX_DUPLICATE_GROUPS: usize = 200;
const MAX_HASHED_FILE_BYTES: u64 = 500 * 1024 * 1024;

pub fn cleanup_targets() -> Vec<CleanupInfo> {
    vec![
        // These strings are only ever shown when the UI has no translation for
        // the id (see `textFor` in App.tsx), so they must be in the app's
        // primary language — English — like every other Rust-side fallback.
        // They used to be Italian, which surfaced as a stray Italian row in an
        // otherwise English list.
        CleanupInfo {
            id: "temp_cleanup",
            name: "Clean temporary files",
            description: "Moves the contents of %TEMP% to the Recycle Bin: you can restore it at any time, nothing is deleted permanently.",
            requires_admin: false,
            requires_pro: false,
        },
        CleanupInfo {
            id: "winupdate_cache_cleanup",
            name: "Clear Windows Update cache",
            description: "Moves already-installed Windows Update packages to the Recycle Bin (requires administrator rights).",
            requires_admin: true,
            requires_pro: true,
        },
    ]
}

fn target_dir(id: &str) -> Option<PathBuf> {
    match id {
        "temp_cleanup" => Some(std::env::temp_dir()),
        "winupdate_cache_cleanup" => {
            let windir = std::env::var("WINDIR").unwrap_or_else(|_| r"C:\Windows".to_string());
            Some(
                PathBuf::from(windir)
                    .join("SoftwareDistribution")
                    .join("Download"),
            )
        }
        _ => None,
    }
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

/// Moves every top-level item inside the target directory to the Recycle
/// Bin (never a permanent delete), skipping anything currently locked/in use.
pub fn run_cleanup(id: &str) -> Result<CleanupResult, String> {
    let dir = target_dir(id).ok_or_else(|| format!("unknown cleanup action: {}", id))?;
    let mut result = CleanupResult::default();

    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Ok(result);
    };

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let size = entry
            .metadata()
            .map(|m| if m.is_dir() { dir_size(&path) } else { m.len() })
            .unwrap_or(0);

        match trash::delete(&path) {
            Ok(()) => {
                result.freed_bytes += size;
                result.deleted_count += 1;
            }
            Err(_) => {
                result.skipped_count += 1;
            }
        }
    }

    Ok(result)
}

fn walk_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            walk_files(&entry.path(), out);
        } else if file_type.is_file() {
            out.push(entry.path());
        }
    }
}

fn hash_file(path: &Path) -> Option<u64> {
    let bytes = std::fs::read(path).ok()?;
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut hasher);
    Some(hasher.finish())
}

/// Scans a folder recursively for byte-identical files (grouped first by
/// size, then by content hash, to avoid hashing everything up front).
pub fn scan_duplicates(root: &str) -> Result<Vec<DuplicateGroup>, String> {
    let root_path = Path::new(root);
    if !root_path.is_dir() {
        return Err("the selected path is not a valid folder".to_string());
    }

    let mut files = Vec::new();
    walk_files(root_path, &mut files);

    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    for path in files {
        if let Ok(meta) = std::fs::metadata(&path) {
            let size = meta.len();
            if size == 0 || size > MAX_HASHED_FILE_BYTES {
                continue;
            }
            by_size.entry(size).or_default().push(path);
        }
    }

    let mut groups = Vec::new();
    for (size, paths) in by_size.into_iter() {
        if paths.len() < 2 {
            continue;
        }
        let mut by_hash: HashMap<u64, Vec<String>> = HashMap::new();
        for path in paths {
            if let Some(hash) = hash_file(&path) {
                by_hash
                    .entry(hash)
                    .or_default()
                    .push(path.to_string_lossy().to_string());
            }
        }
        for (_, group_paths) in by_hash {
            if group_paths.len() > 1 {
                groups.push(DuplicateGroup {
                    size,
                    paths: group_paths,
                });
            }
        }
    }

    groups.sort_by(|a, b| b.size.cmp(&a.size));
    groups.truncate(MAX_DUPLICATE_GROUPS);
    Ok(groups)
}

const MAX_LARGE_FILES: usize = 200;

/// Scans a folder recursively for its biggest files above `min_bytes`,
/// largest first. Shares `walk_files` with the duplicate finder, but skips
/// the content-hashing step entirely — size alone is what matters here, so
/// this stays fast even on folders scan_duplicates would spend a while
/// hashing through.
pub fn scan_large_files(root: &str, min_bytes: u64) -> Result<Vec<LargeFile>, String> {
    let root_path = Path::new(root);
    if !root_path.is_dir() {
        return Err("the selected path is not a valid folder".to_string());
    }

    let mut files = Vec::new();
    walk_files(root_path, &mut files);

    let mut large: Vec<LargeFile> = files
        .into_iter()
        .filter_map(|path| {
            let size = std::fs::metadata(&path).ok()?.len();
            if size < min_bytes {
                return None;
            }
            Some(LargeFile {
                path: path.to_string_lossy().to_string(),
                size,
            })
        })
        .collect();

    large.sort_by(|a, b| b.size.cmp(&a.size));
    large.truncate(MAX_LARGE_FILES);
    Ok(large)
}

/// Directory names that must never be sent to the Recycle Bin, checked
/// case-insensitively against any path component. This command receives
/// whatever list of paths the frontend sends it — normally exactly what
/// scan_duplicates/scan_large_files just found, but nothing on the Rust side
/// actually enforces that boundary. This is the backstop: even a compromised
/// or buggy caller can't walk it into moving Windows itself, or a whole
/// Program Files install, into the trash.
const PROTECTED_DIR_NAMES: &[&str] = &[
    "windows",
    "system32",
    "syswow64",
    "program files",
    "program files (x86)",
    "programdata",
];

fn touches_protected_dir(path: &Path) -> bool {
    path.components().any(|c| {
        c.as_os_str()
            .to_str()
            .map(|s| PROTECTED_DIR_NAMES.contains(&s.to_lowercase().as_str()))
            .unwrap_or(false)
    })
}

/// Moves the given files to the Recycle Bin (never a permanent delete).
/// Refuses anything under a protected system directory, and anything that
/// isn't an existing file (a bare drive or directory root, which trash::delete
/// would otherwise happily recycle whole).
pub fn delete_files(paths: Vec<String>) -> CleanupResult {
    let mut result = CleanupResult::default();
    for p in paths {
        let path = PathBuf::from(&p);
        if touches_protected_dir(&path) || !path.is_file() {
            result.skipped_count += 1;
            continue;
        }
        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        match trash::delete(&path) {
            Ok(()) => {
                result.freed_bytes += size;
                result.deleted_count += 1;
            }
            Err(_) => result.skipped_count += 1,
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "pc-tweaker-cleanup-test-{}-{}-{}",
            tag,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finds_files_at_or_above_the_threshold_largest_first() {
        let dir = temp_dir("large-files");
        fs::write(dir.join("tiny.txt"), vec![0u8; 10]).unwrap();
        fs::write(dir.join("medium.bin"), vec![0u8; 5_000]).unwrap();
        fs::write(dir.join("big.bin"), vec![0u8; 20_000]).unwrap();

        let found = scan_large_files(dir.to_str().unwrap(), 1_000).unwrap();

        assert_eq!(
            found.len(),
            2,
            "the 10-byte file must be excluded by the threshold"
        );
        assert_eq!(
            found[0].size, 20_000,
            "results must be sorted largest first"
        );
        assert_eq!(found[1].size, 5_000);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_invalid_path_is_a_clear_error_not_an_empty_result() {
        let err = scan_large_files(r"Z:\this\path\does\not\exist\at\all", 0).unwrap_err();
        assert!(err.contains("not a valid folder"));
    }

    #[test]
    fn a_folder_with_nothing_over_the_threshold_returns_empty_not_an_error() {
        let dir = temp_dir("no-large-files");
        fs::write(dir.join("small.txt"), vec![0u8; 100]).unwrap();

        let found = scan_large_files(dir.to_str().unwrap(), 1_000_000).unwrap();
        assert!(found.is_empty());

        fs::remove_dir_all(&dir).ok();
    }

    // delete_files trusts whatever list of paths the frontend sends it —
    // normally exactly what a scan just found, but nothing on this side
    // enforces that. These paths are the ones a compromised or buggy caller
    // could actually send: real Windows directories, not scan results.
    #[test]
    fn refuses_to_touch_anything_under_a_protected_system_directory() {
        let result = delete_files(vec![
            r"C:\Windows\System32\drivers\etc\hosts".to_string(),
            r"C:\Program Files\SomeApp\data.bin".to_string(),
            r"C:\ProgramData\SomeApp\cache.db".to_string(),
        ]);

        assert_eq!(result.deleted_count, 0);
        assert_eq!(result.skipped_count, 3);
        assert_eq!(result.freed_bytes, 0);
    }

    #[test]
    fn refuses_a_bare_directory_even_outside_a_protected_path() {
        let dir = temp_dir("delete-non-file");

        let result = delete_files(vec![dir.to_str().unwrap().to_string()]);

        assert_eq!(
            result.deleted_count, 0,
            "a directory must never be recycled as if it were a single file"
        );
        assert_eq!(result.skipped_count, 1);
        assert!(dir.exists(), "the directory itself must be untouched");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn still_deletes_a_real_file_outside_any_protected_directory() {
        let dir = temp_dir("delete-real-file");
        let file = dir.join("junk.tmp");
        fs::write(&file, vec![0u8; 42]).unwrap();

        let result = delete_files(vec![file.to_str().unwrap().to_string()]);

        assert_eq!(result.deleted_count, 1);
        assert_eq!(result.freed_bytes, 42);
        assert!(!file.exists());

        fs::remove_dir_all(&dir).ok();
    }
}
