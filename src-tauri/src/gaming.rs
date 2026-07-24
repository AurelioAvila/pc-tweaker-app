use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};

pub const INPUT_LAG_ID: &str = "reduce_input_lag";
pub const TURBO_BOOST_ID: &str = "turbo_boost";

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
        name: "Riduci ritardo di input (mouse)",
        description: "Disattiva l'accelerazione del puntatore (\"Migliora precisione puntatore\") per un movimento del mouse 1:1, senza ritardi introdotti dal sistema (HKCU, nessuna elevazione richiesta).",
        requires_admin: false,
        requires_pro: false,
    }
}

pub fn turbo_boost_info() -> GamingInfo {
    GamingInfo {
        id: TURBO_BOOST_ID,
        name: "Turbo Boost processore",
        description: "Imposta la modalità di aumento delle prestazioni del processore su \"Aggressiva\", per sfruttare al massimo il Turbo Boost/Turbo Core durante il gioco (richiede privilegi di amministratore).",
        requires_admin: true,
        requires_pro: false,
    }
}

const MOUSE_HIVE: &str = "HKCU";
const MOUSE_PATH: &str = r"Control Panel\Mouse";
const MOUSE_VALUES: [&str; 3] = ["MouseSpeed", "MouseThreshold1", "MouseThreshold2"];

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
        .ok_or_else(|| "nessuno snapshot salvato: il tweak non risulta applicato".to_string())?;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("tipo di snapshot inatteso per la riduzione del ritardo di input".to_string());
    };

    for e in entries {
        if let SnapshotEntry::Registry(snapshot) = e {
            restore_value(&snapshot)?;
        }
    }
    Ok(())
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
            "questo PC non espone l'impostazione di turbo boost del processore (comune su alcune VM o hardware senza supporto CPPC/boost dinamico)"
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
    Err("non supportato su questa piattaforma".to_string())
}
#[cfg(not(windows))]
pub fn rollback_input_lag(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}
#[cfg(not(windows))]
pub fn apply_turbo_boost(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}
#[cfg(not(windows))]
pub fn rollback_turbo_boost(_store: &RollbackStore) -> Result<(), String> {
    Err("non supportato su questa piattaforma".to_string())
}
