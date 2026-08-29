use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct StartupEntry {
    pub name: String,
    pub command: String,
    /// "HKCU" or "HKLM" — HKLM entries are machine-wide and need admin to change.
    pub scope: String,
    pub enabled: bool,
    pub requires_admin: bool,
    /// True when the command points at an executable that is no longer on
    /// disk. Uninstallers routinely leave their Run value behind, so the list
    /// fills up with entries for software the user removed months ago and
    /// cannot understand why they are still listed.
    ///
    /// The UI drops these rows. That is only safe because the detection fails
    /// open: a command shape the parser cannot read confidently is reported as
    /// present, so the worst case is a dead entry still being listed rather
    /// than a real, running startup item silently vanishing from a screen
    /// whose whole job is to tell you what runs at boot.
    pub orphaned: bool,
}

/// Pulls the executable out of a Run command line, or `None` when the shape
/// isn't one we can read confidently.
///
/// Run values come in several forms: a quoted path with arguments
/// (`"C:\...\app.exe" --silent`), an unquoted path with spaces, a bare
/// `rundll32.exe ...`, and paths built from environment variables. Anything
/// this cannot resolve to a concrete path returns `None`, which callers treat
/// as "present" — the parser is only ever allowed to make a row *more*
/// visible, never to hide one.
pub(crate) fn extract_exe_path(command: &str) -> Option<std::path::PathBuf> {
    let command = command.trim();
    if command.is_empty() {
        return None;
    }

    let candidate = if let Some(rest) = command.strip_prefix('"') {
        // Quoted: everything up to the closing quote is the path, verbatim.
        rest.split('"').next()?.to_string()
    } else if let Some(idx) = command.to_lowercase().find(".exe") {
        // Unquoted: take through the first ".exe", which handles both
        // `C:\Program Files\x\app.exe -flag` and a bare `app.exe`.
        command[..idx + 4].to_string()
    } else {
        return None;
    };

    let expanded = expand_env_vars(&candidate);
    if expanded.trim().is_empty() {
        return None;
    }
    let path = std::path::PathBuf::from(expanded.trim());

    // A bare name like `rundll32.exe` resolves against PATH at boot, not
    // against the current directory. Checking it as a relative path would
    // wrongly call it missing, so leave it alone.
    if path
        .parent()
        .map(|p| p.as_os_str().is_empty())
        .unwrap_or(true)
    {
        return None;
    }
    Some(path)
}

/// Expands `%VAR%` references. An unset variable makes the whole expansion
/// unusable, which surfaces as `None` from the caller rather than as a
/// half-substituted path that would never exist.
fn expand_env_vars(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(start) = rest.find('%') {
        let after = &rest[start + 1..];
        let Some(end) = after.find('%') else {
            out.push_str(rest);
            return out;
        };
        let name = &after[..end];
        let Ok(value) = std::env::var(name) else {
            // Unknown variable: emit something that cannot exist so the
            // caller's `exists()` check fails closed into "unparseable".
            return String::new();
        };
        out.push_str(&rest[..start]);
        out.push_str(&value);
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    out
}

/// Whether the entry points at software that is no longer installed.
///
/// Fails open on purpose: a command we cannot parse, or one naming an
/// executable resolved through PATH, is reported as present.
pub(crate) fn command_is_orphaned(command: &str) -> bool {
    match extract_exe_path(command) {
        Some(path) => !path.exists(),
        None => false,
    }
}

const RUN_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APPROVED_PATH: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

/// Windows records "the user disabled this" in a separate StartupApproved
/// value rather than deleting the Run entry: byte 0 is even when enabled and
/// odd when disabled (bytes 4..12 hold the FILETIME it was disabled at). An
/// absent value means "never touched", i.e. enabled. Same encoding Task
/// Manager's Startup tab reads and writes.
fn enabled_from_bytes(bytes: &[u8]) -> bool {
    bytes.first().map(|b| b % 2 == 0).unwrap_or(true)
}

fn approval_bytes(enabled: bool, now_unix_secs: u64) -> Vec<u8> {
    let mut bytes = vec![0u8; 12];
    bytes[0] = if enabled { 2 } else { 3 };
    if !enabled {
        // Unix epoch -> Windows FILETIME (100ns ticks since 1601-01-01), so
        // Task Manager's "Disabled on ..." column stays truthful.
        let filetime = (now_unix_secs + 11_644_473_600) * 10_000_000;
        bytes[4..12].copy_from_slice(&filetime.to_le_bytes());
    }
    bytes
}

fn now_unix_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// `<scope>|<0|1>|<name>` — the name is taken as the rest of the string so
/// program names containing `|` still round-trip intact.
fn parse_payload(payload: &str) -> Result<(String, bool, String), String> {
    let mut parts = payload.splitn(3, '|');
    let scope = parts.next().unwrap_or_default().to_string();
    let enabled = parts.next().unwrap_or("1") == "1";
    let name = parts.next().unwrap_or_default().to_string();
    if name.is_empty() || scope.is_empty() {
        return Err("invalid startup payload".to_string());
    }
    Ok((scope, enabled, name))
}

fn build_payload(scope: &str, enabled: bool, name: &str) -> String {
    format!("{}|{}|{}", scope, if enabled { 1 } else { 0 }, name)
}

#[cfg(windows)]
mod imp {
    use super::*;
    use winreg::enums::*;
    use winreg::types::FromRegValue;
    use winreg::{RegKey, RegValue};

    fn root_for(scope: &str) -> RegKey {
        match scope {
            "HKLM" => RegKey::predef(HKEY_LOCAL_MACHINE),
            _ => RegKey::predef(HKEY_CURRENT_USER),
        }
    }

    fn is_enabled(scope: &str, name: &str) -> bool {
        let root = root_for(scope);
        let Ok(key) = root.open_subkey(APPROVED_PATH) else {
            return true;
        };
        match key.get_raw_value(name) {
            Ok(v) => enabled_from_bytes(&v.bytes),
            Err(_) => true,
        }
    }

    fn collect(scope: &str, out: &mut Vec<StartupEntry>) {
        let root = root_for(scope);
        let Ok(key) = root.open_subkey(RUN_PATH) else {
            return;
        };
        for item in key.enum_values() {
            let Ok((name, value)) = item else { continue };
            let command = String::from_reg_value(&value).unwrap_or_default();
            if name.is_empty() {
                continue;
            }
            out.push(StartupEntry {
                enabled: is_enabled(scope, &name),
                orphaned: super::command_is_orphaned(&command),
                name,
                command,
                scope: scope.to_string(),
                requires_admin: scope == "HKLM",
            });
        }
    }

    pub fn list() -> Vec<StartupEntry> {
        let mut out = Vec::new();
        collect("HKCU", &mut out);
        collect("HKLM", &mut out);
        out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        out
    }

    pub fn set_enabled(scope: &str, name: &str, enabled: bool) -> Result<(), String> {
        let root = root_for(scope);
        let (key, _) = root
            .create_subkey_with_flags(APPROVED_PATH, KEY_READ | KEY_WRITE)
            .map_err(|e| format!("could not open the startup registry key: {}", e))?;

        let bytes = approval_bytes(enabled, now_unix_secs());
        key.set_raw_value(
            name,
            &RegValue {
                vtype: REG_BINARY,
                bytes,
            },
        )
        .map_err(|e| format!("could not update the startup state: {}", e))
    }
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn list_startup_items() -> Vec<StartupEntry> {
    imp::list()
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn set_startup_enabled(scope: String, name: String, enabled: bool) -> Result<(), String> {
    // Machine-wide entries live under HKLM and need elevation; route them
    // through the same one-shot UAC helper every admin tweak already uses
    // instead of failing with a bare access-denied.
    if scope == "HKLM" && !crate::elevation::is_elevated() {
        // The elevated helper records its own audit entry for this action.
        return crate::elevation::run_elevated_action(
            "--elevated-startup",
            &build_payload(&scope, enabled, &name),
        );
    }
    let result = imp::set_enabled(&scope, &name, enabled);
    crate::audit::record(
        "startup-change",
        &name,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

/// Entry point used by the elevated helper process (see `run_elevated_headless`).
#[cfg(windows)]
pub fn apply_from_payload(payload: &str) -> Result<(), String> {
    let (scope, enabled, name) = parse_payload(payload)?;
    imp::set_enabled(&scope, &name, enabled)
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn list_startup_items() -> Vec<StartupEntry> {
    Vec::new()
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn set_startup_enabled(_scope: String, _name: String, _enabled: bool) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The shapes actually found in a real `Run` key. Getting any of these
    /// wrong means either hiding software that genuinely starts at boot, or
    /// leaving dead entries on screen — the two failure modes this parser
    /// exists to sit between.
    #[test]
    fn the_executable_is_extracted_from_every_command_shape() {
        let quoted = extract_exe_path(r#""C:\Program Files\App\app.exe" --silent"#);
        assert_eq!(
            quoted,
            Some(std::path::PathBuf::from(r"C:\Program Files\App\app.exe"))
        );

        let unquoted_with_args = extract_exe_path(r"C:\Tools\thing.exe /background");
        assert_eq!(
            unquoted_with_args,
            Some(std::path::PathBuf::from(r"C:\Tools\thing.exe"))
        );

        // Spaces without quotes: taking through ".exe" is what makes this work.
        let unquoted_spaces = extract_exe_path(r"C:\Program Files\My App\run.exe -q");
        assert_eq!(
            unquoted_spaces,
            Some(std::path::PathBuf::from(r"C:\Program Files\My App\run.exe"))
        );
    }

    /// Everything here must return `None` so `command_is_orphaned` reports the
    /// entry as present. A false "no longer installed" on a running program is
    /// far worse than leaving a dead row visible.
    #[test]
    fn unreadable_or_path_resolved_commands_are_never_called_orphaned() {
        for command in [
            "rundll32.exe shell32.dll,Control_RunDLL", // resolved via PATH
            "",                                        // empty value
            "   ",                                     // whitespace only
            "some nonsense with no executable at all", // no .exe anywhere
            "%NONEXISTENT_VAR_XYZ%\\app.exe",          // unset variable
        ] {
            assert!(
                !command_is_orphaned(command),
                "command was wrongly reported as orphaned: {:?}",
                command
            );
        }
    }

    #[test]
    fn a_path_that_does_not_exist_is_reported_as_orphaned() {
        assert!(command_is_orphaned(
            r#""C:\Program Files\Definitely Not Installed\ghost.exe" --start"#
        ));
    }

    /// The running test binary is a real file, so it stands in for "installed
    /// software" without depending on anything being present on the machine.
    #[test]
    fn a_path_that_exists_is_not_reported_as_orphaned() {
        let me = std::env::current_exe().expect("current_exe failed");
        assert!(!command_is_orphaned(&format!(
            "\"{}\" --flag",
            me.display()
        )));
    }

    /// These exact byte patterns were read back from this machine's real
    /// registry: Discord enabled as `02 00 ..`, FACEIT/Steam/RiotClient
    /// disabled as `03 00 ..` followed by a FILETIME.
    #[test]
    fn reads_the_same_enabled_state_windows_does() {
        assert!(enabled_from_bytes(&[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        assert!(!enabled_from_bytes(&[
            3, 0, 0, 0, 83, 142, 102, 231, 162, 245, 220, 1
        ]));
        // Some entries use 6/7 instead of 2/3; parity is what decides.
        assert!(enabled_from_bytes(&[6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        assert!(!enabled_from_bytes(&[7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        // Missing/empty value means Windows never recorded a change: enabled.
        assert!(enabled_from_bytes(&[]));
    }

    #[test]
    fn writes_bytes_windows_can_read_back() {
        let on = approval_bytes(true, 1_785_000_000);
        assert_eq!(on.len(), 12);
        assert!(enabled_from_bytes(&on));
        // Enabling must clear the stale "disabled at" timestamp.
        assert_eq!(&on[4..12], &[0u8; 8]);

        let off = approval_bytes(false, 1_785_000_000);
        assert_eq!(off.len(), 12);
        assert!(!enabled_from_bytes(&off));

        // The timestamp must decode back to the instant we passed in.
        let filetime = u64::from_le_bytes(off[4..12].try_into().unwrap());
        assert_eq!(filetime / 10_000_000 - 11_644_473_600, 1_785_000_000);
    }

    #[test]
    fn payload_round_trips_through_the_elevated_helper() {
        for (scope, enabled, name) in [
            ("HKLM", false, "Riot Vanguard"),
            ("HKCU", true, "Discord"),
            // Names are arbitrary user data: spaces and separators must survive.
            ("HKLM", false, "Weird | Name | With Pipes"),
        ] {
            let parsed = parse_payload(&build_payload(scope, enabled, name)).expect("should parse");
            assert_eq!(parsed, (scope.to_string(), enabled, name.to_string()));
        }
    }

    #[test]
    fn rejects_malformed_payloads_instead_of_touching_the_wrong_key() {
        assert!(parse_payload("").is_err());
        assert!(parse_payload("HKLM|0|").is_err());
        assert!(parse_payload("|0|Discord").is_err());
    }
}
