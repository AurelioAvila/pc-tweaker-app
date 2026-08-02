use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "games_task_priority";

pub struct GamingInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn info() -> GamingInfo {
    GamingInfo {
        id: TWEAK_ID,
        name: "Priorità massima ai giochi (multimedia scheduler)",
        description: "Dice allo scheduler multimediale di Windows (MMCSS) di trattare i giochi come i processi a più alta priorità del sistema, davanti a qualunque task in background (HKLM, richiede privilegi di amministratore).",
        requires_admin: true,
        requires_pro: true,
    }
}

const HIVE: &str = "HKLM";
const PATH: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games";

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::{hive_from_str, read_value, write_value};

    let hive = hive_from_str(HIVE);
    let targets: [(&str, RegValue); 4] = [
        ("GPU Priority", RegValue::Dword(8)),
        ("Priority", RegValue::Dword(6)),
        ("Scheduling Category", RegValue::Str("High".to_string())),
        ("SFIO Priority", RegValue::Str("High".to_string())),
    ];

    let mut entries = Vec::new();
    for (name, hint) in &targets {
        let original = read_value(hive, PATH, name, hint).map_err(|e| e.to_string())?;
        entries.push(SnapshotEntry::Registry(RegistrySnapshot {
            hive: HIVE.to_string(),
            path: PATH.to_string(),
            name: name.to_string(),
            original_value: original,
        }));
    }

    // Snapshot everything before mutating anything, so a failure partway
    // through never leaves some values changed without a way back.
    store
        .save_entry(TWEAK_ID, SnapshotEntry::Composite { entries })
        .map_err(|e| e.to_string())?;

    for (name, value) in &targets {
        write_value(hive, PATH, name, value)?;
    }

    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;

    let entry = store
        .take_entry(TWEAK_ID)
        .ok_or_else(|| "nessuno snapshot salvato: il tweak non risulta applicato".to_string())?;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("tipo di snapshot inatteso per la priorità dei giochi".to_string());
    };

    for e in entries {
        if let SnapshotEntry::Registry(snapshot) = e {
            restore_value(&snapshot)?;
        }
    }
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
