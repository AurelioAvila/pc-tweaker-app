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

    /// Windows records "user disabled this startup item" in a separate
    /// StartupApproved key rather than deleting the Run entry — byte 0 is
    /// 2 when enabled and 3 when disabled (the remaining bytes are a
    /// timestamp). Absent entirely means "never touched", i.e. enabled.
    /// This is exactly the mechanism Task Manager's Startup tab uses, so
    /// toggling here stays consistent with what Windows itself shows.
    fn is_enabled(scope: &str, name: &str) -> bool {
        let root = root_for(scope);
        let Ok(key) = root.open_subkey(APPROVED_PATH) else {
            return true;
        };
        match key.get_raw_value(name) {
            Ok(v) => v.bytes.first().map(|b| b % 2 == 0).unwrap_or(true),
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

        let mut bytes = vec![0u8; 12];
        bytes[0] = if enabled { 2 } else { 3 };
        if !enabled {
            // Windows stores the moment it was disabled here; writing a real
            // timestamp keeps Task Manager's "Disabled on ..." column honest.
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            // Unix epoch -> Windows FILETIME (100ns ticks since 1601-01-01).
            let filetime = (now + 11_644_473_600) * 10_000_000;
            bytes[4..12].copy_from_slice(&filetime.to_le_bytes());
        }

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
        let payload = format!("{}|{}|{}", scope, if enabled { 1 } else { 0 }, name);
        return crate::elevation::run_elevated_action("--elevated-startup", &payload);
    }
    imp::set_enabled(&scope, &name, enabled)
}

/// Entry point used by the elevated helper process (see `run_elevated_headless`).
#[cfg(windows)]
pub fn apply_from_payload(payload: &str) -> Result<(), String> {
    let mut parts = payload.splitn(3, '|');
    let scope = parts.next().unwrap_or_default();
    let enabled = parts.next().unwrap_or("1") == "1";
    let name = parts.next().unwrap_or_default();
    if name.is_empty() {
        return Err("payload di avvio non valido".to_string());
    }
    imp::set_enabled(scope, name, enabled)
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
