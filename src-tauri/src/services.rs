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
    let code = output.status.code();
    // Stopping an already stopped service and starting one already running
    // are idempotent successes. Other SCM failures must retain the snapshot.
    let already_done = (args.first() == Some(&"stop") && code == Some(1062))
        || (args.first() == Some(&"start") && code == Some(1056));
    if !output.status.success() && !already_done {
        return Err(format!(
            "service command failed: {} {}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
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
fn read_service_state() -> Result<u32, String> {
    use windows_sys::Win32::System::Services::{
        CloseServiceHandle, OpenSCManagerW, OpenServiceW, QueryServiceStatusEx, SC_HANDLE,
        SC_MANAGER_CONNECT, SC_STATUS_PROCESS_INFO, SERVICE_QUERY_STATUS, SERVICE_STATUS_PROCESS,
    };
    struct ServiceHandle(SC_HANDLE);
    impl Drop for ServiceHandle {
        fn drop(&mut self) {
            // SAFETY: this guard owns the non-null SCM handle exactly once.
            unsafe {
                CloseServiceHandle(self.0);
            }
        }
    }
    // SAFETY: null machine/database selects the local active SCM database.
    let manager = unsafe { OpenSCManagerW(std::ptr::null(), std::ptr::null(), SC_MANAGER_CONNECT) };
    if manager.is_null() {
        return Err(format!(
            "could not open the service manager: {}",
            std::io::Error::last_os_error()
        ));
    }
    let manager = ServiceHandle(manager);
    let name: Vec<u16> = SERVICE_NAME.encode_utf16().chain(Some(0)).collect();
    // SAFETY: manager is live and name is NUL-terminated for this call.
    let service = unsafe { OpenServiceW(manager.0, name.as_ptr(), SERVICE_QUERY_STATUS) };
    if service.is_null() {
        return Err(format!(
            "could not inspect Windows Search: {}",
            std::io::Error::last_os_error()
        ));
    }
    let service = ServiceHandle(service);
    let mut status = std::mem::MaybeUninit::<SERVICE_STATUS_PROCESS>::zeroed();
    let mut needed = 0;
    // SAFETY: the output points to a correctly sized/aligned status structure.
    let result = unsafe {
        QueryServiceStatusEx(
            service.0,
            SC_STATUS_PROCESS_INFO,
            status.as_mut_ptr().cast(),
            std::mem::size_of::<SERVICE_STATUS_PROCESS>() as u32,
            &mut needed,
        )
    };
    if result == 0 {
        return Err(format!(
            "could not read Windows Search status: {}",
            std::io::Error::last_os_error()
        ));
    }
    // SAFETY: QueryServiceStatusEx succeeded and initialized the structure.
    Ok(unsafe { status.assume_init() }.dwCurrentState)
}

#[cfg(windows)]
fn captured_running_state(state: u32) -> Result<bool, String> {
    use windows_sys::Win32::System::Services::{SERVICE_RUNNING, SERVICE_STOPPED};
    match state {
        SERVICE_RUNNING => Ok(true),
        SERVICE_STOPPED => Ok(false),
        _ => Err("Windows Search is paused or changing state; wait for it to settle before applying this tweak".into()),
    }
}

#[cfg(windows)]
fn wait_for_service_state(running: bool) -> Result<(), String> {
    use windows_sys::Win32::System::Services::{SERVICE_RUNNING, SERVICE_STOPPED};
    let expected = if running {
        SERVICE_RUNNING
    } else {
        SERVICE_STOPPED
    };
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    loop {
        if read_service_state()? == expected {
            return Ok(());
        }
        if std::time::Instant::now() >= deadline {
            return Err("Windows Search did not reach the requested state; the rollback snapshot was retained".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(125));
    }
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;

    let previous = read_start_type()?;
    let was_running = captured_running_state(read_service_state()?)?;

    transaction
        .save_entry(
            WINDOWS_SEARCH_ID,
            SnapshotEntry::Service {
                name: SERVICE_NAME.to_string(),
                previous_start_type: previous,
                was_running: Some(was_running),
            },
        )
        .map_err(|e| e.to_string())?;
    run_sc(&["stop", SERVICE_NAME])?;
    wait_for_service_state(false)?;
    run_sc(&["config", SERVICE_NAME, "start=", "disabled"])?;
    if start_type_flag(&read_start_type()?) != "disabled" {
        return Err("service startup configuration could not be verified".into());
    }
    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(WINDOWS_SEARCH_ID, |entry| {
        let SnapshotEntry::Service {
            previous_start_type,
            was_running,
            ..
        } = entry
        else {
            return Err("unexpected snapshot type for the service".to_string());
        };

        let previous_flag = start_type_flag(&previous_start_type);
        // Legacy snapshots did not capture runtime state. New snapshots never
        // start a service that the user had deliberately left stopped.
        let should_run = was_running.unwrap_or(previous_flag != "disabled");
        let initial_flag = if should_run && previous_flag == "disabled" {
            "demand"
        } else {
            previous_flag
        };
        run_sc(&["config", SERVICE_NAME, "start=", initial_flag])?;
        run_sc(&[if should_run { "start" } else { "stop" }, SERVICE_NAME])?;
        wait_for_service_state(should_run)?;
        if initial_flag != previous_flag {
            // A running service may have its future startup disabled. Restore
            // that uncommon but valid combination after starting it.
            run_sc(&["config", SERVICE_NAME, "start=", previous_flag])?;
        }
        if start_type_flag(&read_start_type()?) != start_type_flag(&previous_start_type) {
            return Err("the restored service startup configuration could not be verified".into());
        }
        Ok(())
    })
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

    #[cfg(windows)]
    #[test]
    fn only_stable_native_states_can_be_saved_as_running_or_stopped() {
        use windows_sys::Win32::System::Services::{
            SERVICE_PAUSED, SERVICE_RUNNING, SERVICE_START_PENDING, SERVICE_STOPPED,
            SERVICE_STOP_PENDING,
        };
        assert!(captured_running_state(SERVICE_RUNNING).unwrap());
        assert!(!captured_running_state(SERVICE_STOPPED).unwrap());
        for state in [
            SERVICE_START_PENDING,
            SERVICE_STOP_PENDING,
            SERVICE_PAUSED,
            99,
        ] {
            assert!(captured_running_state(state).is_err());
        }
    }

    #[test]
    fn service_snapshot_supports_legacy_and_new_runtime_state_without_guessing() {
        let old = serde_json::json!({"kind":"Service","name":"WSearch","previous_start_type":"3 DEMAND_START"});
        let parsed: SnapshotEntry = serde_json::from_value(old.clone()).unwrap();
        assert!(matches!(
            parsed,
            SnapshotEntry::Service {
                was_running: None,
                ..
            }
        ));
        for running in [false, true] {
            let mut new = old.clone();
            new["was_running"] = serde_json::json!(running);
            assert!(
                matches!(serde_json::from_value::<SnapshotEntry>(new).unwrap(), SnapshotEntry::Service { was_running: Some(value), .. } if value == running)
            );
        }
        let mut invalid = old;
        invalid["was_running"] = serde_json::json!("unknown");
        assert!(serde_json::from_value::<SnapshotEntry>(invalid).is_err());
    }
}
