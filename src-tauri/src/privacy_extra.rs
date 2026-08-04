use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};

pub const ACTIVITY_HISTORY_ID: &str = "disable_activity_history";

pub struct PrivacyInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn activity_history_info() -> PrivacyInfo {
    PrivacyInfo {
        id: ACTIVITY_HISTORY_ID,
        name: "Disable activity history (Windows Timeline)",
        description: "Stops Windows from recording, storing and sending Microsoft the history of the apps and documents you use, through system policy (HKLM, requires administrator rights).",
        requires_admin: true,
        requires_pro: true,
    }
}

const HIVE: &str = "HKLM";
const PATH: &str = r"SOFTWARE\Policies\Microsoft\Windows\System";
const VALUES: [&str; 3] = ["EnableActivityFeed", "PublishUserActivities", "UploadUserActivities"];

#[cfg(windows)]
pub fn apply_activity_history(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::{hive_from_str, read_value, write_value};

    let hive = hive_from_str(HIVE);
    let mut entries = Vec::new();

    for name in VALUES {
        let original = read_value(hive, PATH, name, &RegValue::Dword(0)).map_err(|e| e.to_string())?;
        entries.push(SnapshotEntry::Registry(RegistrySnapshot {
            hive: HIVE.to_string(),
            path: PATH.to_string(),
            name: name.to_string(),
            original_value: original,
        }));
    }

    store
        .save_entry(ACTIVITY_HISTORY_ID, SnapshotEntry::Composite { entries })
        .map_err(|e| e.to_string())?;

    for name in VALUES {
        write_value(hive, PATH, name, &RegValue::Dword(0))?;
    }

    Ok(())
}

#[cfg(windows)]
pub fn rollback_activity_history(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;

    let entry = store
        .take_entry(ACTIVITY_HISTORY_ID)
        .ok_or_else(|| "nessuno snapshot salvato: il tweak non risulta applicato".to_string())?;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("tipo di snapshot inatteso per la cronologia attività".to_string());
    };

    for e in entries {
        if let SnapshotEntry::Registry(snapshot) = e {
            restore_value(&snapshot)?;
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn apply_activity_history(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}
#[cfg(not(windows))]
pub fn rollback_activity_history(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}
