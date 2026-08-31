//! Crash reports, kept on this machine.
//!
//! Until now a panic left no trace a user could act on. In the main window
//! that at least looks like something — the window disappears. In the
//! elevated helper it looks like nothing at all: that process has no UI, so a
//! panic there means the user clicks "apply", waits, and is told nothing,
//! with no way to know whether the tweak ran, half-ran, or died. Those are
//! precisely the failures worth hearing about, and precisely the ones that
//! never reach us.
//!
//! ## Nothing is sent anywhere
//!
//! Same rule as `audit.rs`, for the same reason: this is a local file the
//! user can read in Notepad, and the app's own promise is that it does not
//! phone home. The report is shown in the app with a button that copies it to
//! the clipboard, so sharing it is an action the user takes deliberately —
//! into Discord, an issue, an email — rather than something that happens to
//! them. An opt-in upload would still be an upload, and the diagnostic value
//! here comes from the user choosing to hand it over, not from collecting it.
//!
//! ## What a report contains
//!
//! Timestamp, app version, which of the two processes died, the panic
//! message, the source location, the thread name. No machine name, no
//! account name, no environment dump — and the message is scrubbed of the
//! user's profile path before it is written, because a panic formatted from
//! a filesystem error carries `C:\Users\<name>\...` in its text.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const CRASH_FILE: &str = "crash-log.jsonl";
/// Kept after a trim. A crash is rare and each report is small; twenty is
/// plenty to see a pattern ("it dies every time on this one tweak") without
/// the file ever mattering for disk space.
const MAX_LINES: usize = 20;
/// Trim only when meaningfully over, so appends stay O(1) almost always.
const TRIM_THRESHOLD: usize = 30;

/// Which binary died. Both are this same executable: the app builds a UI, the
/// helper is the elevated re-entry that performs one action and exits.
pub const PROCESS_APP: &str = "app";
pub const PROCESS_ELEVATED: &str = "elevated";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrashReport {
    /// Unix seconds. The UI formats it in the user's locale.
    pub ts: u64,
    /// The version that crashed — not the version reading the report. After
    /// an update the two differ, and "it crashed on the old build" is the
    /// first thing worth knowing.
    pub version: String,
    /// [`PROCESS_APP`] or [`PROCESS_ELEVATED`].
    pub process: String,
    pub message: String,
    /// Source file and line, from the panic itself. A compile-time path into
    /// this project, so it identifies the code without describing the user's
    /// disk.
    pub location: String,
    pub thread: String,
}

/// Builds a report from the pieces a panic hook can extract.
///
/// Separate from the hook so it can be tested: a `PanicHookInfo` cannot be
/// constructed outside a real panic, but everything that decides what ends up
/// in the file is here.
pub fn build(
    process: &str,
    raw_message: &str,
    location: &str,
    thread: &str,
    ts: u64,
    version: &str,
) -> CrashReport {
    CrashReport {
        ts,
        version: version.to_string(),
        process: process.to_string(),
        message: scrub(raw_message),
        location: location.to_string(),
        thread: thread.to_string(),
    }
}

/// Removes the two things that identify a person from free-form panic text.
///
/// Reads the environment, so it follows whoever is running. The pure form is
/// [`scrub_with`], which is what the tests exercise.
fn scrub(text: &str) -> String {
    scrub_with(
        text,
        std::env::var("USERPROFILE").ok().as_deref(),
        std::env::var("USERNAME").ok().as_deref(),
    )
}

/// Replaces the user's profile path and account name with placeholders.
///
/// The profile path goes first and the bare account name second, because the
/// path contains the name: replacing the name first would leave a mangled
/// path that no longer matches. Both comparisons are case-insensitive, since
/// Windows paths are, and a panic message may well carry a different casing
/// than the environment variable does.
///
/// Deliberately blunt. Over-scrubbing costs a slightly less readable report;
/// under-scrubbing writes someone's name into a file they are about to paste
/// into a public issue tracker.
pub fn scrub_with(text: &str, user_profile: Option<&str>, username: Option<&str>) -> String {
    let mut out = text.to_string();
    if let Some(profile) = user_profile {
        // An empty variable would otherwise match at every position and
        // interleave the placeholder through the whole message.
        if !profile.is_empty() {
            out = replace_ignoring_case(&out, profile, "%USERPROFILE%");
        }
    }
    if let Some(name) = username {
        if !name.is_empty() {
            out = replace_ignoring_case(&out, name, "<user>");
        }
    }
    out
}

/// `str::replace` with a case-insensitive needle.
///
/// Works on the lowercased copy only to find byte offsets, and slices the
/// original at those offsets so the untouched parts keep their original case.
/// Both strings are lowercased with the same function, so offsets line up for
/// the ASCII paths and names this is used on.
fn replace_ignoring_case(haystack: &str, needle: &str, replacement: &str) -> String {
    let hay_lower = haystack.to_lowercase();
    let needle_lower = needle.to_lowercase();
    // A lowercased ASCII string keeps its byte length, but a non-ASCII one
    // may not, and then the offsets below would not line up with the
    // original. Falling back to the exact-case replace is worse than nothing
    // only in the rare non-ASCII case, and never wrong.
    if hay_lower.len() != haystack.len() || needle_lower.len() != needle.len() {
        return haystack.replace(needle, replacement);
    }

    let mut out = String::with_capacity(haystack.len());
    let mut cursor = 0usize;
    while let Some(found) = hay_lower[cursor..].find(&needle_lower) {
        let start = cursor + found;
        out.push_str(&haystack[cursor..start]);
        out.push_str(replacement);
        cursor = start + needle_lower.len();
    }
    out.push_str(&haystack[cursor..]);
    out
}

/// Installs the panic hook for this process.
///
/// The previous hook is kept and called afterwards, so the standard message
/// still reaches stderr — losing that would make `tauri dev` worse in
/// exchange for a file nobody reads during development.
///
/// Nothing in here may panic: a panic inside a panic hook aborts the process
/// immediately, turning a recoverable report into a hard crash with no
/// output at all. Every step is therefore infallible or ignored.
pub fn install(dir: PathBuf, process: &'static str) {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| (*s).to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            // A panic value that is neither is possible via `panic_any`.
            // Nothing here does that, but the hook must not care.
            .unwrap_or_else(|| "panic with a non-text payload".to_string());

        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".to_string());

        let thread = std::thread::current()
            .name()
            .unwrap_or("unnamed")
            .to_string();

        let report = build(
            process,
            &message,
            &location,
            &thread,
            now_secs(),
            env!("CARGO_PKG_VERSION"),
        );
        let _ = append_in(&dir, &report);

        previous(info);
    }));
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn append_in(dir: &Path, report: &CrashReport) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join(CRASH_FILE);
    let line = serde_json::to_string(report).map_err(|e| e.to_string())?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{}", line).map_err(|e| e.to_string())?;
    drop(file);
    trim_if_needed(&path);
    Ok(())
}

/// Reports newest first. A malformed line is skipped rather than failing the
/// read: a half-written line from a process that died mid-append must not
/// hide the reports written before it.
pub fn list_in(dir: &Path) -> Vec<CrashReport> {
    let Ok(text) = std::fs::read_to_string(dir.join(CRASH_FILE)) else {
        return Vec::new();
    };
    let mut reports: Vec<CrashReport> = text
        .lines()
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();
    reports.reverse();
    reports
}

/// Removes the file entirely, for the "I have read these" action.
pub fn clear_in(dir: &Path) -> Result<(), String> {
    let path = dir.join(CRASH_FILE);
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        // Already gone is the desired state, not a failure.
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pctweaker-crash-{}-{}", tag, std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let _ = std::fs::remove_file(dir.join(CRASH_FILE));
        dir
    }

    fn report(message: &str) -> CrashReport {
        build(PROCESS_APP, message, "src/x.rs:1", "main", 100, "1.5.0")
    }

    #[test]
    fn the_profile_path_never_reaches_the_file() {
        let scrubbed = scrub_with(
            r"failed to read C:\Users\aurelio\AppData\Roaming\thing.json",
            Some(r"C:\Users\aurelio"),
            Some("aurelio"),
        );
        assert!(
            !scrubbed.contains("aurelio"),
            "the account name survived scrubbing: {scrubbed}"
        );
        assert!(scrubbed.contains("%USERPROFILE%"));
        assert!(
            scrubbed.contains("AppData"),
            "only the identifying prefix should go, not the rest of the path"
        );
    }

    #[test]
    fn scrubbing_ignores_the_casing_windows_does_not_care_about() {
        // The panic text and the environment variable routinely disagree on
        // case, because one comes from a formatted path and the other from
        // however Windows recorded it at account creation.
        let scrubbed = scrub_with(
            r"cannot open c:\users\Aurelio\file",
            Some(r"C:\Users\aurelio"),
            Some("aurelio"),
        );
        assert!(
            scrubbed.contains("%USERPROFILE%"),
            "a different casing must still match: {scrubbed}"
        );
        assert!(!scrubbed.to_lowercase().contains("aurelio"));
    }

    #[test]
    fn the_bare_account_name_goes_too() {
        // The name shows up without the full path often enough — a user
        // directory referenced relatively, a service account in an error.
        let scrubbed = scrub_with("access denied for aurelio", Some(r"C:\Users\aurelio"), Some("aurelio"));
        assert_eq!(scrubbed, "access denied for <user>");
    }

    #[test]
    fn an_empty_environment_variable_does_not_shred_the_message() {
        // `str::replace` with an empty needle inserts the replacement between
        // every character, which would turn a report into noise.
        let scrubbed = scrub_with("a normal message", Some(""), Some(""));
        assert_eq!(scrubbed, "a normal message");
    }

    #[test]
    fn a_message_with_nothing_identifying_passes_through_untouched() {
        let scrubbed = scrub_with(
            "called `Option::unwrap()` on a `None` value",
            Some(r"C:\Users\aurelio"),
            Some("aurelio"),
        );
        assert_eq!(scrubbed, "called `Option::unwrap()` on a `None` value");
    }

    #[test]
    fn every_occurrence_goes_not_just_the_first() {
        let scrubbed = scrub_with(
            r"copy C:\Users\bob\a to C:\Users\bob\b",
            Some(r"C:\Users\bob"),
            Some("bob"),
        );
        assert_eq!(scrubbed, r"copy %USERPROFILE%\a to %USERPROFILE%\b");
    }

    #[test]
    fn a_report_records_which_process_died() {
        // The elevated helper is the one whose crashes are invisible today,
        // so telling the two apart is the whole point of the field.
        let r = build(PROCESS_ELEVATED, "boom", "src/t.rs:9", "main", 42, "1.5.0");
        assert_eq!(r.process, PROCESS_ELEVATED);
        assert_eq!(r.version, "1.5.0");
        assert_eq!(r.location, "src/t.rs:9");
    }

    #[test]
    fn reports_come_back_newest_first() {
        let dir = temp_dir("order");
        append_in(&dir, &report("first")).unwrap();
        append_in(&dir, &report("second")).unwrap();
        let all = list_in(&dir);
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].message, "second", "the newest crash is the one being investigated");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn no_file_means_no_reports_rather_than_an_error() {
        let dir = temp_dir("empty");
        assert!(list_in(&dir).is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_half_written_line_does_not_hide_the_reports_before_it() {
        // A process that dies mid-append leaves a truncated last line. The
        // reports already on disk are the ones worth reading.
        let dir = temp_dir("torn");
        append_in(&dir, &report("complete")).unwrap();
        let mut f = std::fs::OpenOptions::new()
            .append(true)
            .open(dir.join(CRASH_FILE))
            .unwrap();
        writeln!(f, "{{\"ts\":123,\"vers").unwrap();
        drop(f);

        let all = list_in(&dir);
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].message, "complete");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_log_trims_itself_instead_of_growing_forever() {
        let dir = temp_dir("trim");
        for i in 0..(TRIM_THRESHOLD + 5) {
            append_in(&dir, &report(&format!("crash {i}"))).unwrap();
        }
        let all = list_in(&dir);
        assert!(
            all.len() <= TRIM_THRESHOLD,
            "kept {} reports, past the trim threshold",
            all.len()
        );
        assert_eq!(
            all[0].message,
            format!("crash {}", TRIM_THRESHOLD + 4),
            "trimming must drop the oldest, never the newest"
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn clearing_an_absent_log_is_not_an_error() {
        let dir = temp_dir("clear");
        assert!(clear_in(&dir).is_ok());
        append_in(&dir, &report("x")).unwrap();
        assert!(clear_in(&dir).is_ok());
        assert!(list_in(&dir).is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }
}
