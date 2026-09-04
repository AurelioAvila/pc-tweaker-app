//! Third-party scheduled tasks that run at logon or boot.
//!
//! This is the half of "what starts with my PC" that Task Manager's Startup
//! tab does not show. Software updaters have almost entirely moved out of the
//! `Run` key and into the Task Scheduler precisely because nothing surfaces
//! them there, so a machine whose Startup tab looks clean can still be waking
//! four updaters and a telemetry uploader at every logon.
//!
//! Two rules keep this from becoming a way to break Windows:
//!   * anything under `\Microsoft\` is not listed at all — those tasks are the
//!     operating system servicing itself, and a list you can disable things
//!     from is not the place to put them;
//!   * a task's state is read from its XML definition rather than from
//!     `schtasks`' printed status, which is translated into the display
//!     language. Matching "Ready" would report every non-English machine's
//!     tasks as disabled.

use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct TaskEntry {
    /// Full scheduler path, e.g. `\Adobe Acrobat Update Task`. Also the id
    /// used to toggle it.
    pub path: String,
    /// Leaf name, for display.
    pub name: String,
    /// The executable the task runs, empty when the action is not a plain
    /// `Exec` (a COM handler, say) and cannot be stated honestly.
    pub command: String,
    pub author: String,
    pub enabled: bool,
    /// "logon" or "boot" — the only two kinds listed. A task on a daily
    /// schedule is not a startup item and does not belong on this screen.
    pub trigger: String,
    /// Machine-scope tasks need administrator rights to change.
    pub requires_admin: bool,
}

/// Splits one line of `schtasks /fo CSV` output.
///
/// Task names routinely contain commas and the occasional quote, so a naive
/// `split(',')` shreds them into fields that then match nothing when passed
/// back to `/tn`.
pub(crate) fn split_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '"' if in_quotes && chars.peek() == Some(&'"') => {
                // Doubled quote inside a quoted field is one literal quote.
                current.push('"');
                chars.next();
            }
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => fields.push(std::mem::take(&mut current)),
            _ => current.push(c),
        }
    }
    fields.push(current);
    fields
}

/// Whether this task belongs on a "what starts with my PC" screen.
///
/// Everything Windows ships lives under `\Microsoft\`, and the leading
/// backslash is present on some builds and absent on others, so it is
/// normalised away before the comparison rather than matched twice.
pub(crate) fn is_third_party(path: &str) -> bool {
    let normalised = path.trim().trim_start_matches('\\');
    if normalised.is_empty() {
        return false;
    }
    if normalised.to_lowercase().starts_with("microsoft\\") {
        return false;
    }
    // Our own watchdog. Listing it here would invite the user to disable the
    // thing that tells them a Windows update reverted their tweaks.
    normalised != crate::updatewatch::TASK_NAME
}

/// Pulls the text of the first `<tag>` inside `xml`.
///
/// A four-tag reader rather than an XML crate: the input is a document
/// Windows generated from a fixed schema, and the alternative is a new
/// dependency to read four elements out of it.
pub(crate) fn tag_text(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    let raw = xml[start..end].trim();
    if raw.is_empty() {
        return None;
    }
    Some(
        raw.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'"),
    )
}

/// The text between `<section>` and `</section>`, so a tag that appears in
/// several places can be read from the right one.
pub(crate) fn section<'a>(xml: &'a str, name: &str) -> Option<&'a str> {
    let open = format!("<{}>", name);
    let close = format!("</{}>", name);
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    Some(&xml[start..end])
}

/// Reads a task's XML definition into an entry, or `None` when the task is
/// not a startup item.
///
/// The enabled flag is deliberately read from `<Settings>` and not from the
/// first `<Enabled>` in the document: every trigger carries one of its own,
/// and a disabled task with an enabled trigger would otherwise read as
/// running at every logon.
pub(crate) fn parse_task(path: &str, xml: &str) -> Option<TaskEntry> {
    let triggers = section(xml, "Triggers").unwrap_or("");
    let trigger = if triggers.contains("<LogonTrigger") {
        "logon"
    } else if triggers.contains("<BootTrigger") {
        "boot"
    } else {
        return None;
    };

    let settings = section(xml, "Settings").unwrap_or("");
    // An absent `<Enabled>` in Settings means the schema default, which is
    // enabled — the same reading Task Scheduler itself applies.
    let enabled = tag_text(settings, "Enabled")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(true);

    let command = section(xml, "Actions")
        .and_then(|a| tag_text(a, "Command"))
        .unwrap_or_default();
    let author = section(xml, "RegistrationInfo")
        .and_then(|r| tag_text(r, "Author"))
        .unwrap_or_default();

    // `S-1-5-18` is LocalSystem; a task running as it is machine scope and
    // cannot be changed without elevation.
    let requires_admin = xml.contains("S-1-5-18")
        || xml.contains("<RunLevel>HighestAvailable</RunLevel>")
        || xml.contains("S-1-5-32-544");

    let name = path
        .trim_end_matches('\\')
        .rsplit('\\')
        .next()
        .unwrap_or(path)
        .to_string();

    Some(TaskEntry {
        path: path.to_string(),
        name,
        command,
        author,
        enabled,
        trigger: trigger.to_string(),
        requires_admin,
    })
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    /// Upper bound on how many task definitions are fetched.
    ///
    /// Each one is a process spawn, and a machine with a thousand third-party
    /// tasks is a machine with a different problem. The list is sorted by the
    /// scheduler before this cap applies, so it truncates consistently rather
    /// than at random.
    const MAX_TASKS: usize = 150;

    /// Runs `schtasks`.
    ///
    /// `tolerate_partial` is for queries only: a machine with a task this
    /// user cannot read makes the whole query exit non-zero while still
    /// printing every task it *could* read, and throwing that away would show
    /// an empty list on exactly the machines that most need one. A *change*
    /// gets the strict reading — reporting "disabled" for a call that was
    /// denied is the one failure this screen must never have.
    fn schtasks(args: &[&str], tolerate_partial: bool) -> Result<Vec<u8>, String> {
        let output = Command::new("schtasks")
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("could not run schtasks: {}", e))?;

        let ok = output.status.success() || (tolerate_partial && !output.stdout.is_empty());
        if !ok {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let out = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Err(if !err.is_empty() {
                err
            } else if !out.is_empty() {
                out
            } else {
                format!("Task Scheduler exited with code {:?}", output.status.code())
            });
        }
        Ok(output.stdout)
    }

    /// Every task path on the machine, third-party ones only.
    fn candidate_paths() -> Result<Vec<String>, String> {
        // `/nh` drops the header row, which would otherwise arrive as a task
        // literally named "TaskName".
        let raw = schtasks(&["/query", "/fo", "CSV", "/nh"], true)?;
        let text = crate::sysrepair::decode_chunk(&raw);

        let mut paths: Vec<String> = text
            .lines()
            .filter_map(|line| {
                let fields = split_csv_line(line.trim());
                let path = fields.first()?.trim().to_string();
                if path.is_empty() || path.eq_ignore_ascii_case("TaskName") {
                    return None;
                }
                is_third_party(&path).then_some(path)
            })
            .collect();
        // The scheduler lists one row per trigger, so a task with a logon and
        // a daily trigger arrives twice.
        paths.sort();
        paths.dedup();
        paths.truncate(MAX_TASKS);
        Ok(paths)
    }

    pub fn list() -> Vec<TaskEntry> {
        let Ok(paths) = candidate_paths() else {
            return Vec::new();
        };
        let mut entries: Vec<TaskEntry> = paths
            .iter()
            .filter_map(|path| {
                // `/xml` is a Unicode dump, hence the shared decoder.
                let raw = schtasks(&["/query", "/tn", path, "/xml"], true).ok()?;
                parse_task(path, &crate::sysrepair::decode_chunk(&raw))
            })
            .collect();
        entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        entries
    }

    pub fn set_enabled(path: &str, enabled: bool) -> Result<(), String> {
        schtasks(
            &[
                "/change",
                "/tn",
                path,
                if enabled { "/enable" } else { "/disable" },
            ],
            false,
        )
        .map(|_| ())
    }
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn list_scheduled_tasks() -> Vec<TaskEntry> {
    imp::list()
}

/// `<path>|<0|1>` — the path is taken as the tail so task names containing a
/// pipe still round-trip through the elevated relaunch intact.
pub fn build_task_payload(path: &str, enabled: bool) -> String {
    format!("{}|{}", if enabled { 1 } else { 0 }, path)
}

pub fn parse_task_payload(payload: &str) -> Result<(String, bool), String> {
    let (flag, path) = payload
        .split_once('|')
        .ok_or_else(|| "invalid scheduled task payload".to_string())?;
    if path.is_empty() {
        return Err("invalid scheduled task payload".to_string());
    }
    // Re-checked on the elevated side too: this payload arrives as a plain
    // command-line argument, so the privileged entry point must not assume
    // its own UI produced it.
    if !is_third_party(path) {
        return Err("that task is managed by Windows".to_string());
    }
    Ok((path.to_string(), flag == "1"))
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn set_scheduled_task_enabled(path: String, enabled: bool) -> Result<(), String> {
    if !is_third_party(&path) {
        return Err("that task is managed by Windows".to_string());
    }
    let result = if crate::elevation::is_elevated() {
        imp::set_enabled(&path, enabled)
    } else {
        match imp::set_enabled(&path, enabled) {
            // Per-user tasks change without elevation; machine-scope ones do
            // not. Try first and only spend a UAC prompt on the ones that
            // actually need it, the same way the update watch does.
            Ok(()) => Ok(()),
            Err(direct) => crate::elevation::run_elevated_action(
                "--elevated-task",
                &build_task_payload(&path, enabled),
            )
            .map_err(|e| format!("{}; administrator retry failed: {}", direct, e)),
        }
    };
    crate::audit::record(
        "scheduled-task-change",
        &path,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

/// Entry point used by the elevated helper process.
#[cfg(windows)]
pub fn apply_from_payload(payload: &str) -> Result<(), String> {
    let (path, enabled) = parse_task_payload(payload)?;
    imp::set_enabled(&path, enabled)
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn list_scheduled_tasks() -> Vec<TaskEntry> {
    Vec::new()
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn set_scheduled_task_enabled(_path: String, _enabled: bool) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Real task names from a normal machine. A name that survives the round
    /// trip wrong is a name `/tn` will not find, so the toggle silently does
    /// nothing.
    #[test]
    fn splits_quoted_csv_fields() {
        assert_eq!(
            split_csv_line(r#""\Adobe Acrobat Update Task","04/09/2026 10:00:00","Ready""#),
            vec!["\\Adobe Acrobat Update Task", "04/09/2026 10:00:00", "Ready"]
        );
        // A comma inside the name must not become a field separator.
        assert_eq!(
            split_csv_line(r#""\Vendor, Inc. Updater","N/A","Ready""#)[0],
            "\\Vendor, Inc. Updater"
        );
        // A doubled quote is one literal quote.
        assert_eq!(split_csv_line(r#""He said ""hi""","x""#)[0], r#"He said "hi""#);
        assert_eq!(split_csv_line("")[0], "");
    }

    /// The whole safety story of this screen is that Windows' own tasks never
    /// appear on it.
    #[test]
    fn windows_own_tasks_are_never_listed() {
        assert!(!is_third_party(r"\Microsoft\Windows\UpdateOrchestrator\Reboot"));
        assert!(!is_third_party(r"Microsoft\Windows\Defrag\ScheduledDefrag"));
        // Case is not a way around it.
        assert!(!is_third_party(r"\microsoft\Windows\Foo"));
        assert!(!is_third_party(""));
        assert!(!is_third_party("   "));
    }

    #[test]
    fn third_party_tasks_are_listed() {
        assert!(is_third_party(r"\Adobe Acrobat Update Task"));
        assert!(is_third_party(r"\GoogleUpdateTaskMachineUA"));
        assert!(is_third_party(r"\NVIDIA\NvTmRep"));
        // A vendor whose name merely begins with "Microsoft" is still theirs;
        // only the `Microsoft\` folder is Windows'.
        assert!(is_third_party(r"\MicrosoftEdgeUpdateTaskMachineCore"));
    }

    /// Disabling our own drift watch from here would let the user switch off
    /// the thing that reports a Windows update undoing their tweaks.
    #[test]
    fn our_own_watchdog_is_hidden() {
        assert!(!is_third_party(crate::updatewatch::TASK_NAME));
        assert!(!is_third_party(&format!(
            "\\{}",
            crate::updatewatch::TASK_NAME
        )));
    }

    const SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2">
  <RegistrationInfo><Author>Adobe Systems</Author><URI>\Adobe Update</URI></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled></LogonTrigger></Triggers>
  <Principals><Principal><UserId>S-1-5-18</UserId></Principal></Principals>
  <Settings><Enabled>false</Enabled><Hidden>false</Hidden></Settings>
  <Actions><Exec><Command>C:\Program Files\Adobe\update.exe</Command></Exec></Actions>
</Task>"#;

    /// Every trigger carries its own `<Enabled>`. Reading the first one in the
    /// document would report this disabled task as running at every logon.
    #[test]
    fn reads_state_from_settings_not_from_the_trigger() {
        let task = parse_task(r"\Adobe Update", SAMPLE).expect("parsed");
        assert!(!task.enabled);
        assert_eq!(task.trigger, "logon");
        assert_eq!(task.name, "Adobe Update");
        assert_eq!(task.author, "Adobe Systems");
        assert_eq!(task.command, r"C:\Program Files\Adobe\update.exe");
        assert!(task.requires_admin);
    }

    #[test]
    fn defaults_to_enabled_when_settings_omits_the_flag() {
        let xml = r#"<Task><Triggers><BootTrigger/></Triggers><Settings><Hidden>false</Hidden></Settings></Task>"#;
        let task = parse_task(r"\X", xml).expect("parsed");
        assert!(task.enabled);
        assert_eq!(task.trigger, "boot");
        assert!(!task.requires_admin);
    }

    /// A task on a daily or idle schedule is not a startup item, and putting
    /// it on this screen would make the list mean nothing.
    #[test]
    fn non_startup_triggers_are_skipped() {
        let xml = r#"<Task><Triggers><CalendarTrigger><Enabled>true</Enabled></CalendarTrigger></Triggers><Settings><Enabled>true</Enabled></Settings></Task>"#;
        assert!(parse_task(r"\Daily", xml).is_none());
        assert!(parse_task(r"\NoTriggers", "<Task></Task>").is_none());
    }

    #[test]
    fn unescapes_xml_entities_in_paths() {
        let xml = r#"<Task><Triggers><LogonTrigger/></Triggers><Settings><Enabled>true</Enabled></Settings><Actions><Exec><Command>C:\a &amp; b\run.exe</Command></Exec></Actions></Task>"#;
        assert_eq!(parse_task(r"\X", xml).unwrap().command, r"C:\a & b\run.exe");
    }

    #[test]
    fn payload_round_trips_names_containing_a_pipe() {
        let path = r"\Vendor|Updater";
        let payload = build_task_payload(path, false);
        assert_eq!(parse_task_payload(&payload).unwrap(), (path.to_string(), false));
        assert_eq!(
            parse_task_payload(&build_task_payload(path, true)).unwrap(),
            (path.to_string(), true)
        );
    }

    /// The elevated entry point takes this string straight off the command
    /// line, so it has to refuse a Windows task even if the UI never sends one.
    #[test]
    fn payload_refuses_windows_tasks_and_junk() {
        assert!(parse_task_payload(r"1|\Microsoft\Windows\Defrag\ScheduledDefrag").is_err());
        assert!(parse_task_payload("1|").is_err());
        assert!(parse_task_payload("nonsense").is_err());
    }
}
