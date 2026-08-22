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
pub(crate) const PATH: &str = r"SOFTWARE\Policies\Microsoft\Windows\System";
pub(crate) const VALUES: [&str; 3] = [
    "EnableActivityFeed",
    "PublishUserActivities",
    "UploadUserActivities",
];

#[cfg(windows)]
pub fn apply_activity_history(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::{hive_from_str, read_value, write_value};

    let hive = hive_from_str(HIVE);
    let mut entries = Vec::new();

    for name in VALUES {
        let original =
            read_value(hive, PATH, name, &RegValue::Dword(0)).map_err(|e| e.to_string())?;
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
        .ok_or_else(|| "no snapshot saved: the tweak does not appear to be applied".to_string())?;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("unexpected snapshot type for activity history".to_string());
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
    Err("not supported on this platform".to_string())
}
#[cfg(not(windows))]
pub fn rollback_activity_history(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

pub const TYPING_PERSONALIZATION_ID: &str = "disable_typing_personalization";

pub fn typing_personalization_info() -> PrivacyInfo {
    PrivacyInfo {
        id: TYPING_PERSONALIZATION_ID,
        name: "Stop Windows learning how you type",
        description: "Windows builds a personal dictionary from what you type and handwrite — including in password managers, chat windows and search boxes — and syncs it to your Microsoft account to improve its suggestions. This turns off both the text and the handwriting collection (HKCU, no elevation required).",
        requires_admin: false,
        requires_pro: true,
    }
}

/// Both halves of the same setting: Windows collects typed text and inked
/// input through two separate flags, and leaving either one on means the
/// profiling simply continues through the other. They are applied together
/// as one composite snapshot so a rollback restores exactly the pair.
const TYPING_HIVE: &str = "HKCU";
pub(crate) const TYPING_PATH: &str = r"SOFTWARE\Microsoft\InputPersonalization";
pub(crate) const TYPING_VALUES: [&str; 2] = [
    "RestrictImplicitTextCollection",
    "RestrictImplicitInkCollection",
];

#[cfg(windows)]
pub fn apply_typing_personalization(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::{hive_from_str, read_value, write_value};

    let hive = hive_from_str(TYPING_HIVE);
    let mut entries = Vec::new();

    for name in TYPING_VALUES {
        let original =
            read_value(hive, TYPING_PATH, name, &RegValue::Dword(0)).map_err(|e| e.to_string())?;
        entries.push(SnapshotEntry::Registry(RegistrySnapshot {
            hive: TYPING_HIVE.to_string(),
            path: TYPING_PATH.to_string(),
            name: name.to_string(),
            original_value: original,
        }));
    }

    store
        .save_entry(
            TYPING_PERSONALIZATION_ID,
            SnapshotEntry::Composite { entries },
        )
        .map_err(|e| e.to_string())?;

    // 1 means "restrict", i.e. stop collecting — the flag reads the opposite
    // way round to most privacy toggles, which is worth stating plainly here
    // because writing 0 would silently turn collection back *on*.
    for name in TYPING_VALUES {
        write_value(hive, TYPING_PATH, name, &RegValue::Dword(1))?;
    }

    Ok(())
}

#[cfg(windows)]
pub fn rollback_typing_personalization(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;

    let entry = store
        .take_entry(TYPING_PERSONALIZATION_ID)
        .ok_or_else(|| "no snapshot saved: the tweak does not appear to be applied".to_string())?;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("unexpected snapshot type for typing personalization".to_string());
    };

    for e in entries {
        if let SnapshotEntry::Registry(snapshot) = e {
            restore_value(&snapshot)?;
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn apply_typing_personalization(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
#[cfg(not(windows))]
pub fn rollback_typing_personalization(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
