//! Windows component-store and system-file repair: DISM and SFC, streamed.
//!
//! Both tools are long-running (RestoreHealth routinely takes 20+ minutes),
//! both need administrator rights, and both report progress by rewriting one
//! line with backspaces rather than by printing new ones. So this module does
//! three things a plain `Command::output()` call cannot: it reads raw bytes
//! instead of lines, it survives `sfc.exe` writing UTF-16, and it crosses the
//! UAC boundary through the same progress-file handoff `secure_defrag`
//! already uses (an elevated child has no `AppHandle` and cannot emit events).

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};

/// The jobs the UI can ask for. An enum rather than free strings because this
/// value arrives from the frontend *and* re-enters the process as a
/// command-line argument on the elevated relaunch — two boundaries the
/// elevated entry point must not trust.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RepairJob {
    /// Read-only integrity check. Changes nothing.
    Check,
    /// DISM /RestoreHealth followed by sfc /scannow — in that order, because
    /// SFC repairs system files *from* the component store, so running it
    /// first against a corrupt store just fails slowly.
    Repair,
    /// Shrinks WinSxS by removing superseded component versions.
    ComponentCleanup,
}

impl RepairJob {
    pub fn from_id(id: &str) -> Result<Self, String> {
        match id {
            "check" => Ok(Self::Check),
            "repair" => Ok(Self::Repair),
            "component_cleanup" => Ok(Self::ComponentCleanup),
            other => Err(format!("unknown repair job: {}", other)),
        }
    }

    pub fn id(self) -> &'static str {
        match self {
            Self::Check => "check",
            Self::Repair => "repair",
            Self::ComponentCleanup => "component_cleanup",
        }
    }
}

/// One live update. `percent` is progress *within the current step*, which is
/// the only percentage either tool reports — a single bar across a two-step
/// repair would have to invent the weighting between them.
///
/// Carries no output text on purpose. DISM draws its progress as
/// `[=====      ] 40.0%`, and forwarding that to the UI put a row of ASCII
/// equals signs on screen where a progress bar belonged. The percentage is the
/// only part of that line worth anything; the sentences worth reading are
/// already kept in each step's `tail`.
#[derive(Serialize, Deserialize, Clone)]
pub struct RepairProgress {
    pub step: String,
    pub step_index: u32,
    pub step_total: u32,
    pub percent: f32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct StepOutcome {
    pub step: String,
    pub exit_code: i32,
    /// The tail of the step's output. Bounded — DISM prints thousands of
    /// progress redraws and none of them are worth keeping.
    pub tail: String,
}

/// The structured verdict.
///
/// `Healthy` / `Repairable` / `Repaired` / `Unrepairable` are only ever set
/// from DISM output, which is forced to English with `/English` and is
/// therefore safe to match on. `Completed` is the honest fallback for
/// everything else, including a localised `sfc` summary this will not pretend
/// to understand.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum RepairStatus {
    Healthy,
    /// Corruption found by a read-only check: repairable, not yet repaired.
    Repairable,
    Repaired,
    Unrepairable,
    Completed,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RepairOutcome {
    pub status: RepairStatus,
    pub steps: Vec<StepOutcome>,
}

/// One repair at a time, process-wide. DISM refuses to run concurrently with
/// itself anyway, but it does so with an opaque error *after* the user has
/// already sat through a UAC prompt.
static RUNNING: AtomicBool = AtomicBool::new(false);

pub struct RunGuard;

impl RunGuard {
    pub fn acquire() -> Result<Self, String> {
        if RUNNING.swap(true, Ordering::SeqCst) {
            return Err("a system repair is already running".to_string());
        }
        Ok(RunGuard)
    }
}

impl Drop for RunGuard {
    fn drop(&mut self) {
        RUNNING.store(false, Ordering::SeqCst);
    }
}

/// Turns a chunk of captured bytes into text.
///
/// `sfc.exe` writes UTF-16LE when its output is redirected to a pipe, while
/// DISM writes 8-bit text. Dropping NUL bytes collapses the UTF-16 case onto
/// the same ASCII the UTF-8 path produces, which is all that is needed: every
/// token this module reads (digits, `%`, and DISM's `/English` sentences) is
/// ASCII. Stripping first also means a chunk boundary landing mid-code-unit
/// costs at most one character instead of desynchronising the whole stream.
pub(crate) fn decode_chunk(bytes: &[u8]) -> String {
    let stripped: Vec<u8> = bytes.iter().copied().filter(|b| *b != 0).collect();
    String::from_utf8_lossy(&stripped).into_owned()
}

/// The percentage on a progress line, if there is one.
///
/// Handles both shapes these tools emit — DISM's `[=====      ] 40.0%` and
/// SFC's `Verification 40% complete.` — by scanning back from the `%` over
/// digits and a decimal separator, which stays correct in locales that match
/// neither sentence.
pub(crate) fn percent_in(line: &str) -> Option<f32> {
    let bytes = line.as_bytes();
    let pos = line.rfind('%')?;
    let mut start = pos;
    while start > 0 {
        let c = bytes[start - 1];
        if c.is_ascii_digit() || c == b'.' || c == b',' {
            start -= 1;
        } else {
            break;
        }
    }
    if start == pos {
        return None;
    }
    line[start..pos].replace(',', ".").parse::<f32>().ok()
}

/// DISM's verdict, read from output forced to English with `/English`.
///
/// Returns `None` when nothing matched, which the caller reports as
/// `Completed` rather than guessing: a wrong "your Windows is healthy" is
/// worse than an honest "finished, here is the log".
pub(crate) fn dism_verdict(tail: &str) -> Option<RepairStatus> {
    let t = tail.to_lowercase();
    // Ordered most-specific first: DISM prints per-stage lines as well as a
    // summary, and the repairable sentence also contains the word
    // "corruption", so a loose match on that word would win over the truth.
    if t.contains("could not be repaired") || t.contains("could not repair") {
        return Some(RepairStatus::Unrepairable);
    }
    if t.contains("the restore operation completed successfully")
        || t.contains("corruption was repaired")
    {
        return Some(RepairStatus::Repaired);
    }
    if t.contains("no component store corruption detected") {
        return Some(RepairStatus::Healthy);
    }
    if t.contains("the component store is repairable") {
        return Some(RepairStatus::Repairable);
    }
    None
}

/// Best-effort refinement from SFC's summary, used only to make a verdict
/// *worse* or to record a repair the store-level check could not see. SFC has
/// no `/English` switch, so on a localised Windows none of these match and the
/// DISM verdict stands untouched.
pub(crate) fn sfc_downgrade(tail: &str, current: RepairStatus) -> RepairStatus {
    let t = tail.to_lowercase();
    if t.contains("unable to fix") {
        return RepairStatus::Unrepairable;
    }
    if t.contains("successfully repaired")
        && matches!(current, RepairStatus::Healthy | RepairStatus::Completed)
    {
        return RepairStatus::Repaired;
    }
    current
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::io::Read;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    /// How many trailing output lines each step keeps for the log view.
    const TAIL_LINES: usize = 40;

    /// `/English` forces DISM to print in English whatever the system display
    /// language is, which is what makes `dism_verdict` safe to match on.
    /// Without it the same install reports its result in six different
    /// languages and every one of them reads as "no verdict".
    const DISM_BASE: [&str; 3] = ["/English", "/Online", "/Cleanup-Image"];

    /// Runs one tool, feeding every redrawn progress line to `on_progress` as
    /// it arrives and returning the exit code plus a bounded tail.
    ///
    /// Reads raw bytes rather than `BufRead::lines()` on purpose: DISM draws
    /// its progress bar by rewriting one line with `\r` and `\x08`, so a
    /// line-oriented reader shows nothing at all until the step finishes.
    fn run_tool<F>(program: &str, args: &[&str], mut on_progress: F) -> Result<(i32, String), String>
    where
        F: FnMut(f32),
    {
        let mut child = Command::new(program)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .stdin(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("could not start {}: {}", program, e))?;

        let mut stdout = child
            .stdout
            .take()
            .ok_or_else(|| format!("{} produced no output stream", program))?;

        let mut pending = String::new();
        let mut tail: std::collections::VecDeque<String> = std::collections::VecDeque::new();
        let mut buf = [0u8; 4096];

        loop {
            let read = stdout
                .read(&mut buf)
                .map_err(|e| format!("could not read {} output: {}", program, e))?;
            if read == 0 {
                break;
            }
            pending.push_str(&decode_chunk(&buf[..read]));

            // Any of the three means "this line has finished being drawn".
            while let Some(idx) = pending.find(['\r', '\n', '\u{8}']) {
                let raw: String = pending.drain(..=idx).collect();
                let line = raw.trim_matches(['\r', '\n', '\u{8}', ' ']).to_string();
                if line.is_empty() {
                    continue;
                }
                // A line either carries a percentage or it carries prose;
                // never both. Emitting on the prose lines too was what made
                // the bar snap back to zero between every redraw, because
                // "no percentage here" arrived as 0%.
                match percent_in(&line) {
                    Some(pct) => on_progress(pct),
                    None => {
                        tail.push_back(line);
                        if tail.len() > TAIL_LINES {
                            tail.pop_front();
                        }
                    }
                }
            }
        }

        // The last line often arrives without a trailing terminator, and for a
        // check that line *is* the verdict, so it must reach the tail.
        let leftover = pending.trim().to_string();
        if !leftover.is_empty() {
            match percent_in(&leftover) {
                Some(pct) => on_progress(pct),
                None => {
                    tail.push_back(leftover);
                    if tail.len() > TAIL_LINES {
                        tail.pop_front();
                    }
                }
            }
        }

        let status = child
            .wait()
            .map_err(|e| format!("{} did not exit cleanly: {}", program, e))?;
        Ok((
            status.code().unwrap_or(-1),
            tail.into_iter().collect::<Vec<_>>().join("\n"),
        ))
    }

    pub fn run<F>(job: RepairJob, mut on_progress: F) -> Result<RepairOutcome, String>
    where
        F: FnMut(RepairProgress),
    {
        let steps: Vec<(&'static str, &'static str, &'static str)> = match job {
            RepairJob::Check => vec![("scan", "dism.exe", "/ScanHealth")],
            RepairJob::Repair => vec![
                ("restore", "dism.exe", "/RestoreHealth"),
                ("sfc", "sfc.exe", "/scannow"),
            ],
            // Deliberately without /ResetBase: that variant permanently
            // discards the ability to uninstall every update already on the
            // machine, which is not a call a cleanup button gets to make on
            // the user's behalf.
            RepairJob::ComponentCleanup => vec![("cleanup", "dism.exe", "/StartComponentCleanup")],
        };

        let total = steps.len() as u32;
        let mut outcomes = Vec::new();
        let mut status = RepairStatus::Completed;

        for (index, (step, program, arg)) in steps.into_iter().enumerate() {
            let full: Vec<&str> = if program == "dism.exe" {
                DISM_BASE.iter().copied().chain(std::iter::once(arg)).collect()
            } else {
                vec![arg]
            };

            let step_index = index as u32 + 1;
            // Announced before the tool has printed anything: DISM spends its
            // first half-minute silent, and a UI still naming the previous
            // step through that gap is simply wrong about what is happening.
            on_progress(RepairProgress {
                step: step.to_string(),
                step_index,
                step_total: total,
                percent: 0.0,
            });
            let (code, tail) = run_tool(program, &full, |pct| {
                on_progress(RepairProgress {
                    step: step.to_string(),
                    step_index,
                    step_total: total,
                    percent: pct.clamp(0.0, 100.0),
                });
            })?;

            if program == "dism.exe" {
                if let Some(v) = dism_verdict(&tail) {
                    status = v;
                }
            } else {
                status = sfc_downgrade(&tail, status);
            }

            outcomes.push(StepOutcome {
                step: step.to_string(),
                exit_code: code,
                tail,
            });

            // A failed RestoreHealth leaves the component store wherever it
            // got to; running SFC against it next would spend another twenty
            // minutes to report the same corruption. Stop and say so.
            if code != 0 && step == "restore" {
                if status == RepairStatus::Completed {
                    status = RepairStatus::Unrepairable;
                }
                break;
            }
        }

        Ok(RepairOutcome {
            status,
            steps: outcomes,
        })
    }
}

#[cfg(windows)]
pub use imp::run;

#[cfg(not(windows))]
pub fn run<F>(_job: RepairJob, _on_progress: F) -> Result<RepairOutcome, String>
where
    F: FnMut(RepairProgress),
{
    Err("system repair is only available on Windows".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Both shapes these tools actually print. Getting either wrong leaves the
    /// bar at zero for twenty minutes while the repair really is running.
    #[test]
    fn reads_percentages_from_both_tools() {
        assert_eq!(percent_in("[=====      ] 40.0%"), Some(40.0));
        assert_eq!(percent_in("Verification 25% complete."), Some(25.0));
        assert_eq!(percent_in("[====100.0%====]"), Some(100.0));
        // Some locales print a decimal comma even in otherwise English output.
        assert_eq!(percent_in("[==  ] 12,5%"), Some(12.5));
    }

    #[test]
    fn ignores_lines_without_a_real_percentage() {
        assert_eq!(
            percent_in("Deployment Image Servicing and Management tool"),
            None
        );
        assert_eq!(percent_in(""), None);
        // A bare `%` with no digits touching it is not progress.
        assert_eq!(percent_in("100 % done"), None);
    }

    /// sfc.exe writes UTF-16LE into a pipe. Without the NUL strip every line
    /// arrives as `V\0e\0r\0i\0f\0y\0` and no percentage ever matches.
    #[test]
    fn decodes_utf16_output_from_sfc() {
        let utf16: Vec<u8> = "Verification 30% complete."
            .encode_utf16()
            .flat_map(|u| u.to_le_bytes())
            .collect();
        assert_eq!(decode_chunk(&utf16), "Verification 30% complete.");
        assert_eq!(percent_in(&decode_chunk(&utf16)), Some(30.0));
    }

    #[test]
    fn decodes_plain_ascii_unchanged() {
        assert_eq!(decode_chunk(b"[==   ] 20.0%"), "[==   ] 20.0%");
    }

    /// The verdict drives what the user is told to do next, so "repairable"
    /// must never be read as "healthy" just because both sentences mention
    /// the component store.
    #[test]
    fn reads_dism_verdicts() {
        assert_eq!(
            dism_verdict("No component store corruption detected.\nThe operation completed successfully."),
            Some(RepairStatus::Healthy)
        );
        assert_eq!(
            dism_verdict("The component store is repairable.\nThe operation completed successfully."),
            Some(RepairStatus::Repairable)
        );
        assert_eq!(
            dism_verdict("The restore operation completed successfully."),
            Some(RepairStatus::Repaired)
        );
        assert_eq!(
            dism_verdict("Error: 0x800f081f\nThe source files could not be repaired."),
            Some(RepairStatus::Unrepairable)
        );
    }

    /// A localised run matches none of the sentences, and that has to surface
    /// as "no verdict" rather than as an accidental clean bill of health.
    #[test]
    fn localised_dism_output_yields_no_verdict() {
        assert_eq!(dism_verdict("Nessun danneggiamento rilevato."), None);
        assert_eq!(dism_verdict(""), None);
    }

    #[test]
    fn sfc_only_ever_worsens_or_confirms() {
        assert_eq!(
            sfc_downgrade("found corrupt files but was unable to fix some", RepairStatus::Healthy),
            RepairStatus::Unrepairable
        );
        assert_eq!(
            sfc_downgrade("found corrupt files and successfully repaired them", RepairStatus::Healthy),
            RepairStatus::Repaired
        );
        // A localised summary leaves the DISM verdict exactly as it was.
        assert_eq!(
            sfc_downgrade("non ha rilevato violazioni", RepairStatus::Healthy),
            RepairStatus::Healthy
        );
        // Never upgrades a real failure into a success.
        assert_eq!(
            sfc_downgrade("successfully repaired them", RepairStatus::Unrepairable),
            RepairStatus::Unrepairable
        );
    }

    #[test]
    fn job_ids_round_trip() {
        for id in ["check", "repair", "component_cleanup"] {
            assert_eq!(RepairJob::from_id(id).unwrap().id(), id);
        }
        assert!(RepairJob::from_id("reset_base").is_err());
        assert!(RepairJob::from_id("").is_err());
    }

    /// The guard is what stops a second UAC prompt turning into two DISM runs
    /// fighting over the same component store.
    #[test]
    fn only_one_repair_runs_at_a_time() {
        let first = RunGuard::acquire().expect("first acquire");
        assert!(RunGuard::acquire().is_err());
        drop(first);
        assert!(RunGuard::acquire().is_ok());
    }
}
