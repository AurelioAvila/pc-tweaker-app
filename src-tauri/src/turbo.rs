use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "turbo_gaming";

pub struct TurboInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn info() -> TurboInfo {
    TurboInfo {
        id: TWEAK_ID,
        name: "Turbo Gaming",
        description: "Preset: disables Game DVR, switches the power plan to High performance, and optimizes CPU priority (requires administrator rights).",
        requires_admin: true,
        requires_pro: true,
    }
}

const GAME_DVR_HIVE: &str = "HKCU";
const GAME_DVR_PATH: &str = r"System\GameConfigStore";
const GAME_DVR_NAME: &str = "GameDVR_Enabled";

const PRIORITY_HIVE: &str = "HKLM";
const PRIORITY_PATH: &str = r"SYSTEM\CurrentControlSet\Control\PriorityControl";
const PRIORITY_NAME: &str = "Win32PrioritySeparation";
const PRIORITY_GAMING_VALUE: u32 = 38;

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::{hive_from_str, read_dword, write_dword};

    let game_dvr_original = read_dword(hive_from_str(GAME_DVR_HIVE), GAME_DVR_PATH, GAME_DVR_NAME)
        .map_err(|e| e.to_string())?;
    write_dword(hive_from_str(GAME_DVR_HIVE), GAME_DVR_PATH, GAME_DVR_NAME, 0)?;

    let priority_original = read_dword(hive_from_str(PRIORITY_HIVE), PRIORITY_PATH, PRIORITY_NAME)
        .map_err(|e| e.to_string())?;
    write_dword(
        hive_from_str(PRIORITY_HIVE),
        PRIORITY_PATH,
        PRIORITY_NAME,
        PRIORITY_GAMING_VALUE,
    )?;

    let power_original = crate::power::active_scheme_guid()?;
    crate::power::run_powercfg(&["/setactive", crate::power::HIGH_PERFORMANCE_GUID])?;

    store
        .save_entry(
            TWEAK_ID,
            SnapshotEntry::Composite {
                entries: vec![
                    SnapshotEntry::Registry(RegistrySnapshot {
                        hive: GAME_DVR_HIVE.to_string(),
                        path: GAME_DVR_PATH.to_string(),
                        name: GAME_DVR_NAME.to_string(),
                        original_value: game_dvr_original.map(RegValue::Dword),
                    }),
                    SnapshotEntry::Registry(RegistrySnapshot {
                        hive: PRIORITY_HIVE.to_string(),
                        path: PRIORITY_PATH.to_string(),
                        name: PRIORITY_NAME.to_string(),
                        original_value: priority_original.map(RegValue::Dword),
                    }),
                    SnapshotEntry::PowerScheme {
                        previous_guid: power_original,
                    },
                ],
            },
        )
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;

    let entry = store
        .take_entry(TWEAK_ID)
        .ok_or_else(|| "no saved snapshot: the preset does not appear to be applied".to_string())?;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("unexpected snapshot type for the Turbo Gaming preset".to_string());
    };

    for e in entries {
        match e {
            SnapshotEntry::Registry(snapshot) => restore_value(&snapshot)?,
            SnapshotEntry::PowerScheme { previous_guid } => {
                crate::power::run_powercfg(&["/setactive", &previous_guid])?;
            }
            SnapshotEntry::Composite { .. }
            | SnapshotEntry::Dns { .. }
            | SnapshotEntry::PowerSetting { .. }
            | SnapshotEntry::PowerSettingIndex { .. }
            | SnapshotEntry::RegistryKeyCreated { .. }
            | SnapshotEntry::Service { .. } => {}
        }
    }

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
