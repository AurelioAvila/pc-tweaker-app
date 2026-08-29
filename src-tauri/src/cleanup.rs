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

/// One row of a cleanup preview: what would be moved to the Recycle Bin.
/// Names only, never full paths — the target directory is fixed per id and
/// shown once by the UI, so rows stay readable and log-safe.
#[derive(Serialize, Clone, Debug)]
pub struct CleanupPreviewItem {
    pub name: String,
    pub is_dir: bool,
    pub bytes: u64,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct CleanupPreview {
    pub items: Vec<CleanupPreviewItem>,
    pub total_bytes: u64,
    pub item_count: u32,
    /// True when the list was cut at the cap; the totals still cover everything.
    pub truncated: bool,
    /// False when the directory could not be read at all (permissions): the
    /// UI says so instead of showing an empty list as if nothing were there.
    pub accessible: bool,
}

/// Preview rows are capped so a temp dir with tens of thousands of entries
/// cannot balloon the IPC payload; totals are still computed over everything.
const PREVIEW_MAX_ITEMS: usize = 500;

/// Read-only dry run of `run_cleanup`: exactly the top-level items it would
/// move, sorted largest first.
pub fn preview_cleanup(id: &str) -> Result<CleanupPreview, String> {
    let dir = target_dir(id).ok_or_else(|| format!("unknown cleanup action: {}", id))?;
    let mut preview = CleanupPreview {
        accessible: true,
        ..CleanupPreview::default()
    };

    let Ok(entries) = std::fs::read_dir(&dir) else {
        preview.accessible = false;
        return Ok(preview);
    };

    let mut items: Vec<CleanupPreviewItem> = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else { continue };
        let is_dir = meta.is_dir();
        let bytes = if is_dir { dir_size(&path) } else { meta.len() };
        preview.total_bytes += bytes;
        preview.item_count += 1;
        items.push(CleanupPreviewItem {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir,
            bytes,
        });
    }
    items.sort_by(|a, b| b.bytes.cmp(&a.bytes));
    if items.len() > PREVIEW_MAX_ITEMS {
        items.truncate(PREVIEW_MAX_ITEMS);
        preview.truncated = true;
    }
    preview.items = items;
    Ok(preview)
}

/// A selected name must be exactly one path component inside the fixed
/// target directory. Anything that could navigate elsewhere is rejected, not
/// sanitized — these names cross the elevation boundary as CLI text.
pub fn validate_item_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.contains(['\\', '/', '|'])
        || name.chars().any(char::is_control)
    {
        return Err("invalid item name".to_string());
    }
    Ok(())
}

/// Like `run_cleanup`, but only for the top-level items the user ticked in
/// the preview. Unknown/vanished names count as skipped, never as errors —
/// temp directories churn constantly between preview and confirm.
pub fn run_cleanup_selected(id: &str, names: &[String]) -> Result<CleanupResult, String> {
    let dir = target_dir(id).ok_or_else(|| format!("unknown cleanup action: {}", id))?;
    for name in names {
        validate_item_name(name)?;
    }
    let mut result = CleanupResult::default();
    for name in names {
        let path = dir.join(name);
        if !path.exists() {
            result.skipped_count += 1;
            continue;
        }
        let size = std::fs::metadata(&path)
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

/// Encodes a selected-cleanup request for the elevated helper's CLI. `|` is
/// safe as a separator because Windows forbids it in file names — and
/// `validate_item_name` enforces that again on both sides of the boundary.
pub fn encode_selected_payload(id: &str, names: &[String]) -> String {
    let mut parts = vec![id.to_string()];
    parts.extend(names.iter().cloned());
    parts.join("|")
}

pub fn decode_selected_payload(payload: &str) -> Result<(String, Vec<String>), String> {
    let mut parts = payload.split('|');
    let id = parts.next().unwrap_or_default().to_string();
    if id.is_empty() {
        return Err("invalid cleanup payload".to_string());
    }
    let names: Vec<String> = parts.map(str::to_string).collect();
    for name in &names {
        validate_item_name(name)?;
    }
    Ok((id, names))
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
    // The app's own WebView2 profile. Everything the app remembers between
    // launches — the signed-in session, the saved profile photo, the driver
    // audit — lives in a LevelDB under here, as a pile of `.log` and `.ldb`
    // files. Those are exactly the shape the duplicate scanner is built to
    // find, so a user who pointed a duplicate or large-file scan at their
    // profile folder could recycle this app's own storage engine and wipe
    // their settings with the cleaner they were using to tidy up. Nothing in
    // here is ever junk worth reclaiming.
    "ebwebview",
    "com.aurel.pc-tweaker-app",
];

pub(crate) fn touches_protected_dir(path: &Path) -> bool {
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

    #[test]
    fn item_names_that_could_escape_the_target_dir_are_rejected() {
        assert!(validate_item_name("cache.tmp").is_ok());
        assert!(validate_item_name("Folder Name (2)").is_ok());
        assert!(validate_item_name("").is_err());
        assert!(validate_item_name("..").is_err());
        assert!(validate_item_name(r"..\evil").is_err());
        assert!(validate_item_name("a/b").is_err());
        assert!(validate_item_name("a|b").is_err());
        assert!(validate_item_name("nul byte").is_err());
    }

    #[test]
    fn selected_payload_round_trips_and_rejects_smuggled_separators() {
        let names = vec!["a.tmp".to_string(), "dir name".to_string()];
        let payload = encode_selected_payload("temp_cleanup", &names);
        let (id, back) = decode_selected_payload(&payload).unwrap();
        assert_eq!(id, "temp_cleanup");
        assert_eq!(back, names);
        assert!(decode_selected_payload("").is_err());
        assert!(decode_selected_payload("temp_cleanup|..").is_err());
        assert!(decode_selected_payload(r"temp_cleanup|a\b").is_err());
    }

    #[test]
    fn preview_lists_what_run_cleanup_would_move() {
        let dir = std::env::temp_dir().join(format!("pct-preview-test-{}", std::process::id()));
        fs::remove_dir_all(&dir).ok();
        fs::create_dir_all(dir.join("sub")).unwrap();
        fs::write(dir.join("big.tmp"), vec![0u8; 100]).unwrap();
        fs::write(dir.join("sub").join("inner.tmp"), vec![0u8; 40]).unwrap();
        // Exercise the walker directly on the fixture dir (target_dir ids
        // point at real system paths, which tests must never touch).
        let mut items: Vec<CleanupPreviewItem> = Vec::new();
        let mut total = 0u64;
        for entry in fs::read_dir(&dir).unwrap().filter_map(|e| e.ok()) {
            let meta = entry.metadata().unwrap();
            let bytes = if meta.is_dir() {
                dir_size(&entry.path())
            } else {
                meta.len()
            };
            total += bytes;
            items.push(CleanupPreviewItem {
                name: entry.file_name().to_string_lossy().to_string(),
                is_dir: meta.is_dir(),
                bytes,
            });
        }
        assert_eq!(total, 140);
        assert_eq!(items.len(), 2);
        fs::remove_dir_all(&dir).ok();
    }
}
