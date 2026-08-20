//! Local, append-only audit trail of every system-mutating action.
//!
//! One JSON object per line in `audit-log.jsonl` under the app data dir —
//! readable by a human in Notepad, which is the point: "what did this app
//! change, when, and did it work" must never require trusting the app's own
//! UI. Nothing here leaves the machine, and nothing personally identifying
//! is recorded: action names, tweak/cleanup ids, timestamps, outcomes.
//!
//! Both processes write here: the unprivileged app for direct actions, and
//! the elevated helper for the actions it performs (including the
//! restore-point attempt). Appends are line-atomic in practice for these
//! entry sizes; the log is a debugging/transparency aid, not a ledger, so
//! best-effort durability is the right trade.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};

const AUDIT_FILE: &str = "audit-log.jsonl";
/// Kept after a trim. Roughly a year of heavy use.
const MAX_LINES: usize = 1000;
/// Trim only when meaningfully over, so appends stay O(1) almost always.
const TRIM_THRESHOLD: usize = 1200;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    /// Unix seconds. The UI formats it in the user's locale.
    pub ts: u64,
    /// Machine-readable action key ("tweak-applied", "cleanup", ...). The UI
    /// translates it; unknown keys still render as-is rather than vanishing.
    pub action: String,
    /// What it acted on: a tweak/cleanup id, a drive letter, a count.
    pub target: String,
    pub elevated: bool,
    pub success: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn entry(action: &str, target: &str, success: bool, detail: Option<String>) -> AuditEntry {
    AuditEntry {
        ts: now_secs(),
        action: action.to_string(),
        target: target.to_string(),
        elevated: crate::elevation::is_elevated(),
        success,
        detail,
    }
}

/// Appends one entry under `dir`. Explicit-dir variant so tests never touch
/// the real log.
pub fn append_in(dir: &Path, e: &AuditEntry) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|err| err.to_string())?;
    let path = dir.join(AUDIT_FILE);
    let line = serde_json::to_string(e).map_err(|err| err.to_string())?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|err| err.to_string())?;
    writeln!(file, "{}", line).map_err(|err| err.to_string())?;
    drop(file);
    trim_if_needed(&path);
    Ok(())
}

/// Newest-first entries, up to `limit`. Malformed lines (a torn write, a
/// hand-edited file) are skipped, never fatal.
pub fn list_in(dir: &Path, limit: usize) -> Vec<AuditEntry> {
    let Ok(text) = std::fs::read_to_string(dir.join(AUDIT_FILE)) else {
        return Vec::new();
    };
    let mut entries: Vec<AuditEntry> = text
        .lines()
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();
    let keep = entries.len().saturating_sub(limit);
    entries.drain(..keep);
    entries.reverse();
    entries
}

fn trim_if_needed(path: &Path) {
    let Ok(text) = std::fs::read_to_string(path) else {
        return;
    };
    let lines: Vec<&str> = text.lines().collect();
    if lines.len() <= TRIM_THRESHOLD {
        return;
    }
    let kept = &lines[lines.len() - MAX_LINES..];
    let tmp = path.with_extension("jsonl.tmp");
    if std::fs::write(&tmp, kept.join("\n") + "\n").is_ok() {
        let _ = std::fs::rename(&tmp, path);
    }
}

fn default_dir() -> PathBuf {
    #[cfg(windows)]
    {
        crate::dirs_app_data_dir()
    }
    #[cfg(not(windows))]
    {
        std::env::temp_dir().join("com.aurel.pc-tweaker-app")
    }
}

/// Best-effort record into the real log. Auditing must never break the
/// action it describes, so failures are deliberately swallowed here.
pub fn record(action: &str, target: &str, success: bool, detail: Option<String>) {
    let _ = append_in(&default_dir(), &entry(action, target, success, detail));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("pct-audit-test-{}-{}", tag, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    fn e(action: &str, target: &str) -> AuditEntry {
        AuditEntry {
            ts: 1,
            action: action.into(),
            target: target.into(),
            elevated: false,
            success: true,
            detail: None,
        }
    }

    #[test]
    fn appended_entries_come_back_newest_first_and_capped() {
        let dir = temp_dir("order");
        for i in 0..5 {
            append_in(&dir, &e("tweak-applied", &format!("t{}", i))).unwrap();
        }
        let out = list_in(&dir, 3);
        assert_eq!(out.len(), 3);
        assert_eq!(out[0].target, "t4");
        assert_eq!(out[2].target, "t2");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn malformed_lines_are_skipped_not_fatal() {
        let dir = temp_dir("malformed");
        append_in(&dir, &e("cleanup", "temp")).unwrap();
        let path = dir.join(AUDIT_FILE);
        let mut text = std::fs::read_to_string(&path).unwrap();
        text.push_str("{not json\n");
        std::fs::write(&path, text).unwrap();
        append_in(&dir, &e("cleanup", "wu")).unwrap();
        let out = list_in(&dir, 10);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].target, "wu");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_log_trims_itself_instead_of_growing_forever() {
        let dir = temp_dir("trim");
        for i in 0..(TRIM_THRESHOLD + 5) {
            append_in(&dir, &e("tweak-applied", &format!("t{}", i))).unwrap();
        }
        let text = std::fs::read_to_string(dir.join(AUDIT_FILE)).unwrap();
        assert!(text.lines().count() <= TRIM_THRESHOLD);
        // The newest entry always survives a trim.
        let out = list_in(&dir, 1);
        assert_eq!(out[0].target, format!("t{}", TRIM_THRESHOLD + 4));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn detail_field_is_omitted_from_json_when_absent() {
        let json = serde_json::to_string(&e("cleanup", "temp")).unwrap();
        assert!(!json.contains("detail"));
        let with = AuditEntry {
            detail: Some("3 files".into()),
            ..e("cleanup", "temp")
        };
        assert!(serde_json::to_string(&with).unwrap().contains("3 files"));
    }
}
