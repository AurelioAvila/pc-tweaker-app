use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};

pub const INPUT_LAG_ID: &str = "reduce_input_lag";
pub const TURBO_BOOST_ID: &str = "turbo_boost";
pub const KEYBOARD_DELAY_ID: &str = "reduce_keyboard_delay";

pub struct GamingInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn input_lag_info() -> GamingInfo {
    GamingInfo {
        id: INPUT_LAG_ID,
        name: "Reduce input lag (mouse)",
        description: "Turns off pointer acceleration (\"Enhance pointer precision\") for true 1:1 mouse movement, with no delay added by the system (HKCU, no elevation required).",
        requires_admin: false,
        requires_pro: false,
    }
}

pub fn turbo_boost_info() -> GamingInfo {
    GamingInfo {
        id: TURBO_BOOST_ID,
        name: "CPU Turbo Boost",
        description: "Sets the processor performance boost mode to \"Aggressive\", to get the most out of Turbo Boost/Turbo Core while gaming (requires administrator rights).",
        requires_admin: true,
        requires_pro: false,
    }
}

pub fn keyboard_delay_info() -> GamingInfo {
    GamingInfo {
        id: KEYBOARD_DELAY_ID,
        name: "Reduce input lag (keyboard)",
        description: "Zeroes the delay before a held key starts repeating and maximizes its repeat rate, for a more immediate response in game (HKCU, no elevation required).",
        requires_admin: false,
        requires_pro: false,
    }
}

const MOUSE_HIVE: &str = "HKCU";
const MOUSE_PATH: &str = r"Control Panel\Mouse";
const MOUSE_VALUES: [&str; 3] = ["MouseSpeed", "MouseThreshold1", "MouseThreshold2"];

const KEYBOARD_HIVE: &str = "HKCU";
const KEYBOARD_PATH: &str = r"Control Panel\Keyboard";
const KEYBOARD_TARGET: [(&str, &str); 2] = [("KeyboardDelay", "0"), ("KeyboardSpeed", "31")];

#[cfg(windows)]
pub fn apply_input_lag(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::{hive_from_str, read_value, write_value};

    let hive = hive_from_str(MOUSE_HIVE);
    let mut entries = Vec::new();

    for name in MOUSE_VALUES {
        let original = read_value(hive, MOUSE_PATH, name, &RegValue::Str(String::new()))
            .map_err(|e| e.to_string())?;
        entries.push(SnapshotEntry::Registry(RegistrySnapshot {
            hive: MOUSE_HIVE.to_string(),
            path: MOUSE_PATH.to_string(),
            name: name.to_string(),
            original_value: original,
        }));
    }

    // Snapshot everything before mutating anything, so a failure here never
    // leaves the registry changed without a way back.
    store
        .save_entry(INPUT_LAG_ID, SnapshotEntry::Composite { entries })
        .map_err(|e| e.to_string())?;

    for name in MOUSE_VALUES {
        write_value(hive, MOUSE_PATH, name, &RegValue::Str("0".to_string()))?;
    }

    Ok(())
}

#[cfg(windows)]
pub fn rollback_input_lag(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;

    let entry = store
        .take_entry(INPUT_LAG_ID)
        .ok_or_else(|| "no snapshot saved: the tweak does not appear to be applied".to_string())?;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("unexpected snapshot type for input lag reduction".to_string());
    };

    for e in entries {
        if let SnapshotEntry::Registry(snapshot) = e {
            restore_value(&snapshot)?;
        }
    }
    Ok(())
}

#[cfg(windows)]
pub fn apply_keyboard_delay(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::{hive_from_str, read_value, write_value};

    let hive = hive_from_str(KEYBOARD_HIVE);
    let mut entries = Vec::new();

    for (name, _) in KEYBOARD_TARGET {
        let original = read_value(hive, KEYBOARD_PATH, name, &RegValue::Str(String::new()))
            .map_err(|e| e.to_string())?;
        entries.push(SnapshotEntry::Registry(RegistrySnapshot {
            hive: KEYBOARD_HIVE.to_string(),
            path: KEYBOARD_PATH.to_string(),
            name: name.to_string(),
            original_value: original,
        }));
    }

    store
        .save_entry(KEYBOARD_DELAY_ID, SnapshotEntry::Composite { entries })
        .map_err(|e| e.to_string())?;

    for (name, value) in KEYBOARD_TARGET {
        write_value(hive, KEYBOARD_PATH, name, &RegValue::Str(value.to_string()))?;
    }

    Ok(())
}

#[cfg(windows)]
pub fn rollback_keyboard_delay(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;

    let entry = store
        .take_entry(KEYBOARD_DELAY_ID)
        .ok_or_else(|| "no snapshot saved: the tweak does not appear to be applied".to_string())?;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("unexpected snapshot type for keyboard delay".to_string());
    };

    for e in entries {
        if let SnapshotEntry::Registry(snapshot) = e {
            restore_value(&snapshot)?;
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn apply_keyboard_delay(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
#[cfg(not(windows))]
pub fn rollback_keyboard_delay(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

fn parse_ac_dc_index(output: &str) -> Result<(String, String), String> {
    let mut ac = None;
    let mut dc = None;
    for line in output.lines() {
        if let Some(idx) = line.find("0x") {
            if line.contains("AC:") {
                ac = Some(line[idx..].trim().to_string());
            } else if line.contains("DC:") {
                dc = Some(line[idx..].trim().to_string());
            }
        }
    }
    match (ac, dc) {
        (Some(a), Some(d)) => Ok((a, d)),
        _ => Err(
            "this PC does not expose the CPU turbo boost setting (common on some VMs or hardware without CPPC/dynamic boost support)"
                .to_string(),
        ),
    }
}

#[cfg(windows)]
pub fn apply_turbo_boost(store: &RollbackStore) -> Result<(), String> {
    let output = crate::power::run_powercfg(&["/query", "scheme_current", "sub_processor", "perfboostmode"])?;
    let (ac_index, dc_index) = parse_ac_dc_index(&output)?;

    crate::power::run_powercfg(&["/setacvalueindex", "scheme_current", "sub_processor", "perfboostmode", "2"])?;
    crate::power::run_powercfg(&["/setdcvalueindex", "scheme_current", "sub_processor", "perfboostmode", "2"])?;
    crate::power::run_powercfg(&["/setactive", "scheme_current"])?;

    store
        .save_entry(TURBO_BOOST_ID, SnapshotEntry::PowerSetting { ac_index, dc_index })
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn rollback_turbo_boost(store: &RollbackStore) -> Result<(), String> {
    let entry = store
        .take_entry(TURBO_BOOST_ID)
        .ok_or_else(|| "nessuno snapshot salvato: il turbo boost non risulta modificato".to_string())?;

    let SnapshotEntry::PowerSetting { ac_index, dc_index } = entry else {
        return Err("tipo di snapshot inatteso per il turbo boost".to_string());
    };

    crate::power::run_powercfg(&["/setacvalueindex", "scheme_current", "sub_processor", "perfboostmode", &ac_index])?;
    crate::power::run_powercfg(&["/setdcvalueindex", "scheme_current", "sub_processor", "perfboostmode", &dc_index])?;
    crate::power::run_powercfg(&["/setactive", "scheme_current"])?;
    Ok(())
}

#[cfg(not(windows))]
pub fn apply_input_lag(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
#[cfg(not(windows))]
pub fn rollback_input_lag(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
#[cfg(not(windows))]
pub fn apply_turbo_boost(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
#[cfg(not(windows))]
pub fn rollback_turbo_boost(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
