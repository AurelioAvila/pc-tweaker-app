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
            Some(PathBuf::from(windir).join("SoftwareDistribution").join("Download"))
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
    let dir = target_dir(id).ok_or_else(|| format!("azione di pulizia sconosciuta: {}", id))?;
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
        return Err("il percorso selezionato non è una cartella valida".to_string());
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

/// Moves the given files to the Recycle Bin (never a permanent delete).
pub fn delete_files(paths: Vec<String>) -> CleanupResult {
    let mut result = CleanupResult::default();
    for p in paths {
        let path = PathBuf::from(&p);
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
