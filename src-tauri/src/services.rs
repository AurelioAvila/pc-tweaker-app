use crate::rollback::{RollbackStore, SnapshotEntry};

pub const WINDOWS_SEARCH_ID: &str = "disable_windows_search_service";
pub(crate) const SERVICE_NAME: &str = "WSearch";

pub struct ServiceInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn windows_search_info() -> ServiceInfo {
    ServiceInfo {
        id: WINDOWS_SEARCH_ID,
        name: "Disable the indexing service (Windows Search)",
        description: "Stops and disables the Windows file indexing service, cutting background disk activity - useful on small SSDs or while gaming. File search in the Start menu gets slower until you turn it back on (requires administrator rights).",
        requires_admin: true,
        requires_pro: true,
    }
}

#[cfg(windows)]
fn run_sc(args: &[&str]) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = std::process::Command::new("sc")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("could not run sc: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// `sc qc`'s field label is localized ("START_TYPE" in English, "TIPO_AVVIO"
/// in Italian, etc.), but the enum value itself (AUTO_START/DEMAND_START/
/// DISABLED) is always in English regardless of display language — so this
/// matches on the value, the same fix applied earlier to the power-plan
/// tweak's `powercfg` parsing for the same underlying reason.
fn parse_start_type(output: &str) -> Result<String, String> {
    for line in output.lines() {
        if line.contains("AUTO_START") || line.contains("DEMAND_START") || line.contains("DISABLED")
        {
            return Ok(line.trim().to_string());
        }
    }
    Err("could not read the service start type".to_string())
}

#[cfg(windows)]
fn read_start_type() -> Result<String, String> {
    parse_start_type(&run_sc(&["qc", SERVICE_NAME])?)
}

fn start_type_flag(start_type: &str) -> &'static str {
    if start_type.contains("AUTO_START") {
        if start_type.contains("DELAYED") {
            "delayed-auto"
        } else {
            "auto"
        }
    } else if start_type.contains("DISABLED") {
        "disabled"
    } else {
        "demand"
    }
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    let previous = read_start_type()?;
    run_sc(&["stop", SERVICE_NAME])?;
    run_sc(&["config", SERVICE_NAME, "start=", "disabled"])?;
    store
        .save_entry(
            WINDOWS_SEARCH_ID,
            SnapshotEntry::Service {
                name: SERVICE_NAME.to_string(),
                previous_start_type: previous,
            },
        )
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    let entry = store.take_entry(WINDOWS_SEARCH_ID).ok_or_else(|| {
        "no snapshot saved: the service does not appear to be changed".to_string()
    })?;

    let SnapshotEntry::Service {
        previous_start_type,
        ..
    } = entry
    else {
        return Err("unexpected snapshot type for the service".to_string());
    };

    run_sc(&[
        "config",
        SERVICE_NAME,
        "start=",
        start_type_flag(&previous_start_type),
    ])?;
    run_sc(&["start", SERVICE_NAME])?;
    Ok(())
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression: `sc qc`'s field label is translated ("TIPO_AVVIO" on this
    /// Italian machine, "START_TYPE" in English) but the enum value never is.
    /// Parsing the label made the tweak fail outright on non-English Windows.
    #[test]
    fn reads_start_type_regardless_of_the_os_language() {
        let italian = "NOME_SERVIZIO: WSearch\n        TIPO                      : 10  WIN32_OWN_PROCESS \n        TIPO_AVVIO                : 2   AUTO_START  (DELAYED)\n        CONTROLLO_ERRORE          : 1   NORMAL\n";
        let english = "SERVICE_NAME: WSearch\n        TYPE               : 10  WIN32_OWN_PROCESS \n        START_TYPE         : 2   AUTO_START  (DELAYED)\n        ERROR_CONTROL      : 1   NORMAL\n";

        for sample in [italian, english] {
            let parsed = parse_start_type(sample).expect("should parse");
            assert!(parsed.contains("AUTO_START"), "got: {}", parsed);
            assert_eq!(start_type_flag(&parsed), "delayed-auto");
        }
    }

    /// Rollback must restore the *exact* previous start type. Collapsing
    /// delayed-auto into plain auto would silently change boot behaviour.
    #[test]
    fn maps_every_start_type_back_to_its_own_sc_flag() {
        assert_eq!(
            start_type_flag("TIPO_AVVIO : 2   AUTO_START  (DELAYED)"),
            "delayed-auto"
        );
        assert_eq!(start_type_flag("START_TYPE : 2   AUTO_START"), "auto");
        assert_eq!(start_type_flag("START_TYPE : 3   DEMAND_START"), "demand");
        assert_eq!(start_type_flag("START_TYPE : 4   DISABLED"), "disabled");
    }

    #[test]
    fn reports_an_error_when_the_start_type_is_missing() {
        assert!(parse_start_type("SERVICE_NAME: WSearch\n  TYPE : 10\n").is_err());
    }
}
