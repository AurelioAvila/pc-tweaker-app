use crate::rollback::{RollbackStore, SnapshotEntry};

pub const WINDOWS_SEARCH_ID: &str = "disable_windows_search_service";
const SERVICE_NAME: &str = "WSearch";

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
        name: "Disattiva servizio di indicizzazione (Windows Search)",
        description: "Ferma e disattiva il servizio di indicizzazione dei file di Windows, riducendo l'attività su disco in background — utile su SSD piccoli o mentre giochi. La ricerca file nel menu Start diventa più lenta finché non lo riattivi (richiede privilegi di amministratore).",
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
        .map_err(|e| format!("impossibile eseguire sc: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// `sc qc`'s field label is localized ("START_TYPE" in English, "TIPO_AVVIO"
/// in Italian, etc.), but the enum value itself (AUTO_START/DEMAND_START/
/// DISABLED) is always in English regardless of display language — so this
/// matches on the value, the same fix applied earlier to the power-plan
/// tweak's `powercfg` parsing for the same underlying reason.
#[cfg(windows)]
fn read_start_type() -> Result<String, String> {
    let out = run_sc(&["qc", SERVICE_NAME])?;
    for line in out.lines() {
        if line.contains("AUTO_START") || line.contains("DEMAND_START") || line.contains("DISABLED") {
            return Ok(line.trim().to_string());
        }
    }
    Err("impossibile leggere il tipo di avvio del servizio".to_string())
}

#[cfg(windows)]
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
            SnapshotEntry::Service { name: SERVICE_NAME.to_string(), previous_start_type: previous },
        )
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    let entry = store
        .take_entry(WINDOWS_SEARCH_ID)
        .ok_or_else(|| "nessuno snapshot salvato: il servizio non risulta modificato".to_string())?;

    let SnapshotEntry::Service { previous_start_type, .. } = entry else {
        return Err("tipo di snapshot inatteso per il servizio".to_string());
    };

    run_sc(&["config", SERVICE_NAME, "start=", start_type_flag(&previous_start_type)])?;
    run_sc(&["start", SERVICE_NAME])?;
    Ok(())
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}
#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}
