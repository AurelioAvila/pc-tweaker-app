//! Secure Defragmentation: the right operation for the media, with live
//! progress and a restore point behind it.
//!
//! ## Why "secure" is not decoration here
//!
//! Three things separate this from calling `defrag` and hoping:
//!
//! 1. **It never runs a defragmentation pass on solid-state storage.** A full
//!    defrag on an SSD rewrites the entire drive to reorder blocks the
//!    controller does not lay out that way anyway — pure write wear for no
//!    gain. On an SSD this issues a retrim instead, which is the operation
//!    that actually helps.
//! 2. **Uncertainty is treated as an SSD.** `sysinfo` reports `Unknown` for a
//!    fair number of NVMe drives and every virtual volume. Guessing "spinning
//!    disk" on an unknown drive risks the wear case above on exactly the
//!    hardware most likely to be misreported, so the safe operation wins.
//! 3. **A System Restore point is taken first**, on the same principle as
//!    every other elevated change in this app.
//!
//! ## Progress
//!
//! `defrag` prints its percentage as it goes when given `/V`, so progress is
//! read from the process's own output rather than estimated on a timer. The
//! percentage is extracted by scanning for a `NN%` token, not by matching the
//! surrounding sentence: that text is localised, and a parser keyed to English
//! would silently report nothing on this machine, which runs Italian.

use serde::{Deserialize, Serialize};

/// Which half of the run a progress update belongs to.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Analyze,
    Optimize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DefragProgress {
    pub phase: Phase,
    pub drive: String,
    /// 0-100, or `None` while `defrag` is working through a stage it does not
    /// report a percentage for. The UI shows an indeterminate bar then rather
    /// than freezing at a stale number or inventing movement.
    pub percent: Option<u32>,
    /// The most recent non-empty line, verbatim and in the system's own
    /// language. Passing Windows' words through is more honest than mapping
    /// them onto a stage name of our own that might not match what it is
    /// actually doing.
    pub line: String,
    pub done: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DefragOutcome {
    pub drive: String,
    pub media_type: String,
    /// "defrag" or "retrim" — which operation was actually performed, so the
    /// result can never imply a defragmentation that deliberately did not
    /// happen.
    pub operation: String,
    pub summary: String,
    /// What `defrag /A` reported before anything was changed: fragmentation
    /// percentage, free space, and so on, in Windows' own words.
    ///
    /// This exists because of a real gap in the feature. On an SSD the
    /// optimisation itself is a retrim — it finishes in seconds and only
    /// concerns free blocks, which is correct and is all that helps flash
    /// storage, but it leaves the user with a progress bar that flashed past
    /// and no idea what was examined. The analysis pass is genuine work with
    /// a genuine result, and reporting it is what makes the run legible.
    pub analysis: Vec<String>,
}

/// Extracts a percentage from one line of `defrag` output.
///
/// Deliberately locale-blind: it looks for digits immediately followed by `%`
/// anywhere in the line. Windows localises the surrounding text, so anchoring
/// on words like "complete" would work only on an English install.
pub fn parse_percent(line: &str) -> Option<u32> {
    let bytes = line.as_bytes();
    let idx = line.find('%')?;
    // Walk back over the digits directly before the sign.
    let mut start = idx;
    while start > 0 && bytes[start - 1].is_ascii_digit() {
        start -= 1;
    }
    if start == idx {
        return None;
    }
    line[start..idx].parse::<u32>().ok().filter(|p| *p <= 100)
}

/// Which operation is safe for this media type.
///
/// See the module docs for why `Unknown` maps to the SSD path.
pub fn operation_for(media_type: &str) -> &'static str {
    if media_type == "HDD" {
        "defrag"
    } else {
        "retrim"
    }
}

/// The `defrag` arguments for an operation.
///
/// `/H` runs at normal rather than low priority — the user is watching a
/// progress bar, so the work should not be starved behind everything else on
/// the machine. `/V` is what makes the percentages appear at all.
fn args_for(drive: &str, operation: &str) -> Vec<String> {
    let mut args = vec![drive.to_string()];
    if operation == "retrim" {
        args.push("/L".to_string());
    } else {
        args.push("/D".to_string());
    }
    args.push("/H".to_string());
    args.push("/V".to_string());
    args
}

/// The analysis pass. Read-only: `/A` changes nothing, it reports what the
/// volume looks like right now.
fn analyze_args(drive: &str) -> Vec<String> {
    vec![drive.to_string(), "/A".to_string(), "/V".to_string()]
}

#[cfg(windows)]
pub fn run<F>(drive: &str, mut on_progress: F) -> Result<DefragOutcome, String>
where
    F: FnMut(DefragProgress),
{
    // Validated again here, not only at the command boundary: this string is
    // about to become a process argument, and this function is reachable from
    // the elevated helper, which must not trust its caller.
    crate::diskinfo::validate_drive(drive)?;

    let media_type = crate::diskinfo::media_type_of(drive);
    let operation = operation_for(&media_type);

    // Phase one: analysis. On an SSD this is the part that takes real time and
    // produces something worth reading — the optimisation that follows is a
    // retrim measured in seconds. Running it first also means the report
    // describes the volume as it was, before anything was touched.
    let analysis = run_phase(drive, analyze_args(drive), Phase::Analyze, &mut on_progress)?;

    // Phase two: the operation itself.
    let lines = run_phase(
        drive,
        args_for(drive, operation),
        Phase::Optimize,
        &mut on_progress,
    )?;
    let last_line = lines.last().cloned().unwrap_or_default();

    on_progress(DefragProgress {
        phase: Phase::Optimize,
        drive: drive.to_string(),
        percent: Some(100),
        line: last_line.clone(),
        done: true,
    });

    Ok(DefragOutcome {
        drive: drive.to_string(),
        media_type,
        operation: operation.to_string(),
        summary: if last_line.is_empty() {
            "Optimization complete.".to_string()
        } else {
            last_line
        },
        analysis,
    })
}

/// Runs one `defrag` invocation, streaming its output as progress and
/// returning the lines it produced.
///
/// Shared by both phases so the carriage-return handling, the locale-blind
/// percentage parsing and the error reporting exist once rather than twice.
#[cfg(windows)]
fn run_phase<F>(
    drive: &str,
    args: Vec<String>,
    phase: Phase,
    on_progress: &mut F,
) -> Result<Vec<String>, String>
where
    F: FnMut(DefragProgress),
{
    use std::io::BufReader;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut child = Command::new("defrag")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start defrag: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "defrag produced no output stream".to_string())?;

    let mut lines: Vec<String> = Vec::new();
    let mut reader = BufReader::new(stdout);
    let mut chunk: Vec<u8> = Vec::new();
    loop {
        chunk.clear();
        let read = read_until_either(&mut reader, &mut chunk)
            .map_err(|e| format!("could not read defrag output: {}", e))?;
        if read == 0 {
            break;
        }
        let text = String::from_utf8_lossy(&chunk).trim().to_string();
        if text.is_empty() {
            continue;
        }
        on_progress(DefragProgress {
            phase,
            drive: drive.to_string(),
            percent: parse_percent(&text),
            line: text.clone(),
            done: false,
        });
        lines.push(text);
    }

    let status = child
        .wait()
        .map_err(|e| format!("defrag did not exit cleanly: {}", e))?;
    if !status.success() {
        let detail = lines.last().cloned().unwrap_or_default();
        return Err(format!("defrag reported an error: {}", detail));
    }
    Ok(lines)
}

/// Reads up to the next `\n` **or** `\r`.
///
/// `BufRead::read_until` only takes one delimiter, and `defrag` uses carriage
/// returns to redraw its percentage on one line. Stopping at either is what
/// makes the progress arrive while the work is happening instead of in one
/// burst at the end.
#[cfg(windows)]
fn read_until_either<R: std::io::BufRead>(
    reader: &mut R,
    out: &mut Vec<u8>,
) -> std::io::Result<usize> {
    let mut total = 0;
    loop {
        let available = match reader.fill_buf() {
            Ok(b) => b,
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        };
        if available.is_empty() {
            return Ok(total);
        }
        match available.iter().position(|b| *b == b'\n' || *b == b'\r') {
            Some(i) => {
                out.extend_from_slice(&available[..i]);
                reader.consume(i + 1);
                return Ok(total + i + 1);
            }
            None => {
                let len = available.len();
                out.extend_from_slice(available);
                reader.consume(len);
                total += len;
            }
        }
    }
}

#[cfg(not(windows))]
pub fn run<F>(_drive: &str, _on_progress: F) -> Result<DefragOutcome, String>
where
    F: FnMut(DefragProgress),
{
    Err("disk optimization is only available on Windows".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The parser has to work on this machine, which is Italian. Anchoring on
    /// English words is the bug this test exists to prevent.
    #[test]
    fn the_percentage_is_read_regardless_of_language() {
        assert_eq!(parse_percent("Pass 1: 42% complete..."), Some(42));
        assert_eq!(parse_percent("Passaggio 1: 42% completato..."), Some(42));
        assert_eq!(parse_percent("Durchlauf 1: 7% abgeschlossen"), Some(7));
        assert_eq!(parse_percent("100%"), Some(100));
        assert_eq!(parse_percent("  0% "), Some(0));
    }

    #[test]
    fn a_line_with_no_percentage_reports_none() {
        assert_eq!(parse_percent("Analyzing the volume"), None);
        assert_eq!(parse_percent(""), None);
        // A stray sign with no number before it is not a percentage.
        assert_eq!(parse_percent("discount of %"), None);
    }

    /// Guards against a nonsense reading driving the bar past full.
    #[test]
    fn an_implausible_percentage_is_rejected() {
        assert_eq!(parse_percent("progress: 4200%"), None);
    }

    /// The safety rule. Anything not confirmed as a spinning disk must get the
    /// retrim, never a defragmentation pass.
    #[test]
    fn only_a_confirmed_hard_disk_gets_a_defragmentation_pass() {
        assert_eq!(operation_for("HDD"), "defrag");
        assert_eq!(operation_for("SSD"), "retrim");
        assert_eq!(operation_for("Unknown"), "retrim");
        assert_eq!(operation_for(""), "retrim");
    }

    #[test]
    fn the_arguments_match_the_chosen_operation() {
        let ssd = args_for("C:", "retrim");
        assert!(ssd.contains(&"/L".to_string()), "retrim must pass /L");
        assert!(
            !ssd.contains(&"/D".to_string()),
            "retrim must not defragment"
        );

        let hdd = args_for("D:", "defrag");
        assert!(hdd.contains(&"/D".to_string()), "defrag must pass /D");
        assert!(!hdd.contains(&"/L".to_string()));

        // Verbose is what produces the percentages at all.
        assert!(ssd.contains(&"/V".to_string()));
        assert!(hdd.contains(&"/V".to_string()));
    }
}
