use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct StartupEntry {
    pub name: String,
    pub command: String,
    /// "HKCU" or "HKLM" — HKLM entries are machine-wide and need admin to change.
    pub scope: String,
    pub enabled: bool,
    pub requires_admin: bool,
}

const RUN_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APPROVED_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

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
        return Err("payload di avvio non valido".to_string());
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
            .map_err(|e| format!("impossibile aprire la chiave di avvio: {}", e))?;

        let bytes = approval_bytes(enabled, now_unix_secs());
        key.set_raw_value(name, &RegValue { vtype: REG_BINARY, bytes })
            .map_err(|e| format!("impossibile aggiornare lo stato di avvio: {}", e))
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn list_startup_items() -> Vec<StartupEntry> {
    imp::list()
}

#[cfg(windows)]
#[tauri::command]
pub fn set_startup_enabled(
    scope: String,
    name: String,
    enabled: bool,
) -> Result<(), String> {
    // Machine-wide entries live under HKLM and need elevation; route them
    // through the same one-shot UAC helper every admin tweak already uses
    // instead of failing with a bare access-denied.
    if scope == "HKLM" && !crate::elevation::is_elevated() {
        return crate::elevation::run_elevated_action(
            "--elevated-startup",
            &build_payload(&scope, enabled, &name),
        );
    }
    imp::set_enabled(&scope, &name, enabled)
}

/// Entry point used by the elevated helper process (see `run_elevated_headless`).
#[cfg(windows)]
pub fn apply_from_payload(payload: &str) -> Result<(), String> {
    let (scope, enabled, name) = parse_payload(payload)?;
    imp::set_enabled(&scope, &name, enabled)
}

#[cfg(not(windows))]
#[tauri::command]
pub fn list_startup_items() -> Vec<StartupEntry> {
    Vec::new()
}

#[cfg(not(windows))]
#[tauri::command]
pub fn set_startup_enabled(_scope: String, _name: String, _enabled: bool) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// These exact byte patterns were read back from this machine's real
    /// registry: Discord enabled as `02 00 ..`, FACEIT/Steam/RiotClient
    /// disabled as `03 00 ..` followed by a FILETIME.
    #[test]
    fn reads_the_same_enabled_state_windows_does() {
        assert!(enabled_from_bytes(&[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        assert!(!enabled_from_bytes(&[3, 0, 0, 0, 83, 142, 102, 231, 162, 245, 220, 1]));
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
