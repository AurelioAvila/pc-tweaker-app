use crate::rollback::{RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "power_plan_performance";
pub const HIGH_PERFORMANCE_GUID: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";

#[cfg(windows)]
pub fn run_powercfg(args: &[&str]) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = std::process::Command::new("powercfg")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("impossibile eseguire powercfg: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "powercfg ha restituito un errore: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// `true` for a token shaped like a GUID (8-4-4-4-12 hex groups). `powercfg`'s
/// output label before the GUID is localized ("GUID:" in English, "GUID
/// combinazione risparmio energia:" in Italian, etc.) so matching on the
/// label text breaks on non-English Windows — the GUID's own shape doesn't
/// change with the display language, so that's what this looks for instead.
fn looks_like_guid(s: &str) -> bool {
    let parts: Vec<&str> = s.split('-').collect();
    parts.len() == 5
        && [8, 4, 4, 4, 12]
            .iter()
            .zip(parts.iter())
            .all(|(len, part)| part.len() == *len && part.chars().all(|c| c.is_ascii_hexdigit()))
}

#[cfg(windows)]
pub fn active_scheme_guid() -> Result<String, String> {
    let stdout = run_powercfg(&["/getactivescheme"])?;
    stdout
        .split_whitespace()
        .find(|tok| looks_like_guid(tok))
        .map(|s| s.to_string())
        .ok_or_else(|| "impossibile leggere il piano di alimentazione attivo".to_string())
}

#[cfg(windows)]
#[allow(dead_code)]
pub fn is_high_performance_active() -> bool {
    active_scheme_guid()
        .map(|g| g.eq_ignore_ascii_case(HIGH_PERFORMANCE_GUID))
        .unwrap_or(false)
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    let previous = active_scheme_guid()?;
    run_powercfg(&["/setactive", HIGH_PERFORMANCE_GUID])?;
    store
        .save_entry(
            TWEAK_ID,
            SnapshotEntry::PowerScheme {
                previous_guid: previous,
            },
        )
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    let entry = store
        .take_entry(TWEAK_ID)
        .ok_or_else(|| "nessuno snapshot salvato: il piano non risulta modificato".to_string())?;

    let SnapshotEntry::PowerScheme { previous_guid } = entry else {
        return Err("tipo di snapshot inatteso per il piano di alimentazione".to_string());
    };

    run_powercfg(&["/setactive", &previous_guid]).map(|_| ())
}

#[cfg(not(windows))]
pub fn is_high_performance_active() -> bool {
    false
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}

#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression: this used to parse for the literal label "GUID:", which
    /// only exists on English Windows — on this Italian machine the same
    /// command prints "GUID combinazione risparmio energia:" and the tweak
    /// silently failed. Match the GUID's shape, never the localized label.
    #[test]
    fn finds_the_guid_regardless_of_the_os_language() {
        let samples = [
            // English
            "Power Scheme GUID: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (High performance)",
            // Italian (real output captured from this machine)
            "GUID combinazione risparmio energia: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (Prestazioni elevate)",
            // German
            "GUID des Energieschemas: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (Höchstleistung)",
            // French
            "GUID du mode d'alimentation : 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (Performances élevées)",
        ];
        for sample in samples {
            let found = sample.split_whitespace().find(|t| looks_like_guid(t));
            assert_eq!(found, Some(HIGH_PERFORMANCE_GUID), "failed on: {}", sample);
        }
    }

    #[test]
    fn rejects_things_that_only_look_like_guids() {
        assert!(!looks_like_guid("GUID:"));
        assert!(!looks_like_guid("8c5e7fda-e8bf-4a96-9a85"));
        assert!(!looks_like_guid("8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c-extra"));
        assert!(!looks_like_guid("zzzzzzzz-e8bf-4a96-9a85-a6e23a8c635c"));
        assert!(!looks_like_guid(""));
    }
}
