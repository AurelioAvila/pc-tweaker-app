use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};

pub const INPUT_LAG_ID: &str = "reduce_input_lag";
pub const TURBO_BOOST_ID: &str = "turbo_boost";
pub const KEYBOARD_DELAY_ID: &str = "reduce_keyboard_delay";
pub const CORE_PARKING_ID: &str = "disable_core_parking";

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
        description: "Sets boost mode to Aggressive on mains power and battery, and minimum processor state to 100% on mains power in the current power plan. Power use and heat may increase. CPU, firmware and thermal limits still apply; higher FPS is not guaranteed (administrator rights required).",
        requires_admin: true,
        requires_pro: false,
    }
}

/// Minimum percentage of cores the scheduler must leave unparked.
///
/// Core parking drops idle cores into a low-power state and wakes them on
/// demand. That is the right trade on a laptop and the wrong one under a
/// game: waking a core is not free, and the core servicing the mouse
/// interrupt is one of the ones Windows is willing to park. Holding the floor
/// at 100% means nothing is ever parked, so nothing ever has to be woken.
pub const CORE_PARKING_MIN_GUID: &str = "0cc5b647-c1df-4637-891a-dec35c318583";

/// Percent of cores kept unparked. 100 is "all of them".
const CORE_PARKING_ALL_UNPARKED: &str = "100";

pub fn core_parking_info() -> GamingInfo {
    GamingInfo {
        id: CORE_PARKING_ID,
        name: "Disable core parking",
        description: "Stops Windows parking idle CPU cores while plugged in, so a core does not have to be woken before it can service input or a sudden burst of work. Applied to the mains profile only — on battery, parking is what it is there for. The plan's previous value is recorded and restored exactly on rollback (requires administrator rights).",
        requires_admin: true,
        requires_pro: true,
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
pub(crate) const MOUSE_PATH: &str = r"Control Panel\Mouse";
pub(crate) const MOUSE_VALUES: [&str; 3] = ["MouseSpeed", "MouseThreshold1", "MouseThreshold2"];

const KEYBOARD_HIVE: &str = "HKCU";
pub(crate) const KEYBOARD_PATH: &str = r"Control Panel\Keyboard";
pub(crate) const KEYBOARD_TARGET: [(&str, &str); 2] =
    [("KeyboardDelay", "0"), ("KeyboardSpeed", "31")];

#[cfg(windows)]
pub fn apply_input_lag(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;

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
    transaction
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

    store.restore_entry(INPUT_LAG_ID, |entry| {
        let SnapshotEntry::Composite { entries } = entry else {
            return Err("unexpected snapshot type for input lag reduction".to_string());
        };

        for e in entries {
            if let SnapshotEntry::Registry(snapshot) = e {
                restore_value(&snapshot)?;
            }
        }
        Ok(())
    })
}

#[cfg(windows)]
pub fn apply_keyboard_delay(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;

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

    transaction
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

    store.restore_entry(KEYBOARD_DELAY_ID, |entry| {
        let SnapshotEntry::Composite { entries } = entry else {
            return Err("unexpected snapshot type for keyboard delay".to_string());
        };

        for e in entries {
            if let SnapshotEntry::Registry(snapshot) = e {
                restore_value(&snapshot)?;
            }
        }
        Ok(())
    })
}

#[cfg(windows)]
pub fn apply_core_parking(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;

    let scheme = crate::power::active_scheme_guid()?;
    let (ac_index, dc_index) = read_setting_indexes(&scheme, CORE_PARKING_MIN_GUID)?;

    // AC only, deliberately. Holding every core awake on battery is a
    // battery-life decision the user did not make by pressing a button
    // labelled "disable core parking".
    transaction
        .save_entry(
            CORE_PARKING_ID,
            SnapshotEntry::PowerSettingIndex {
                scheme_guid: scheme.clone(),
                subgroup_guid: SUB_PROCESSOR_GUID.to_string(),
                setting_guid: CORE_PARKING_MIN_GUID.to_string(),
                ac_index,
                dc_index,
            },
        )
        .map_err(|e| e.to_string())?;

    crate::power::run_powercfg(&[
        "/setacvalueindex",
        &scheme,
        SUB_PROCESSOR_GUID,
        CORE_PARKING_MIN_GUID,
        CORE_PARKING_ALL_UNPARKED,
    ])?;
    if read_setting_indexes(&scheme, CORE_PARKING_MIN_GUID)? != (Some(100), dc_index) {
        return Err(
            "core parking configuration could not be verified; the snapshot was retained".into(),
        );
    }
    crate::power::run_powercfg(&["/setactive", "scheme_current"])?;
    Ok(())
}

#[cfg(windows)]
pub fn rollback_core_parking(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(CORE_PARKING_ID, |entry| match entry {
        SnapshotEntry::PowerSettingIndex {
            scheme_guid,
            subgroup_guid,
            setting_guid,
            ac_index,
            dc_index,
        } => {
            restore_power_index(
                &scheme_guid,
                &subgroup_guid,
                &setting_guid,
                ac_index,
                dc_index,
            )?;
            crate::power::run_powercfg(&["/setactive", "scheme_current"])?;
            Ok(())
        }
        _ => Err("unexpected snapshot type for core parking".to_string()),
    })
}

#[cfg(not(windows))]
pub fn apply_core_parking(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn rollback_core_parking(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn apply_keyboard_delay(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
#[cfg(not(windows))]
pub fn rollback_keyboard_delay(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

/// Processor power subgroup (SUB_PROCESSOR) and the "Processor performance
/// boost mode" setting (PERFBOOSTMODE), by GUID. GUIDs never change with the
/// display language, unlike the aliases and labels `powercfg` prints.
pub const SUB_PROCESSOR_GUID: &str = "54533251-82be-4824-96c1-47b60b740d00";
pub const PERF_BOOST_MODE_GUID: &str = "be337238-0d82-4146-a960-4f3749d470c7";
/// "Minimum processor state" (PROCTHROTTLEMIN).
///
/// Boost mode alone turned out to be close to unobservable on modern CPUs:
/// on anything with CPPC the processor picks its own P-states, so telling
/// Windows to allow aggressive boost changes a ceiling the CPU was already
/// free to reach, and a before/after benchmark came back inside its own
/// noise. Raising the *floor* is the half that actually moves: it stops the
/// cores dropping to their lowest state between bursts of work, which is
/// where the stutter and the slow first frame after a pause come from.
pub const PROC_THROTTLE_MIN_GUID: &str = "893dee8e-2bef-41e0-89c6-b55d0929964c";
/// Percent. 100 pins the floor to the ceiling for as long as the tweak is on.
pub(crate) const THROTTLE_MIN_MAX: &str = "100";

/// Where Windows *defines* a power setting, independent of any power plan.
/// Presence here is the honest test for "does this machine support it".
#[cfg(windows)]
fn boost_setting_definition_path() -> String {
    format!(
        r"SYSTEM\CurrentControlSet\Control\Power\PowerSettings\{}\{}",
        SUB_PROCESSOR_GUID, PERF_BOOST_MODE_GUID
    )
}

/// True when this machine defines the boost setting at all.
///
/// Note this deliberately does not use `powercfg /query`: Windows marks
/// PERFBOOSTMODE hidden (`Attributes = 1`) on a great many consumer systems,
/// and a hidden setting is simply omitted from that command's output. Reading
/// the definition key sees it whether it is hidden or not.
#[cfg(windows)]
fn boost_is_supported() -> bool {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(boost_setting_definition_path())
        .is_ok()
}

/// The plan's current AC/DC boost indexes, or `None` for either one that has
/// no override and is therefore running on the setting's default.
#[cfg(windows)]
fn read_boost_indexes(scheme_guid: &str) -> Result<(Option<u32>, Option<u32>), String> {
    read_setting_indexes(scheme_guid, PERF_BOOST_MODE_GUID)
}

/// The same read for any setting in the processor subgroup, so a second
/// setting doesn't need a second copy of this logic.
#[cfg(windows)]
fn read_setting_indexes(
    scheme_guid: &str,
    setting_guid: &str,
) -> Result<(Option<u32>, Option<u32>), String> {
    let path = format!(
        r"SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes\{}\{}\{}",
        scheme_guid, SUB_PROCESSOR_GUID, setting_guid
    );
    use crate::tweaks::{windows_impl::read_dword, Hive};
    Ok((
        read_dword(Hive::Hklm, &path, "ACSettingIndex").map_err(|e| e.to_string())?,
        read_dword(Hive::Hklm, &path, "DCSettingIndex").map_err(|e| e.to_string())?,
    ))
}

/// Boost mode 2 = "Aggressive": let the CPU boost above its rated frequency
/// whenever thermals and power allow.
pub(crate) const BOOST_AGGRESSIVE: &str = "2";

#[cfg(windows)]
pub fn apply_turbo_boost(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;

    if !boost_is_supported() {
        return Err(
            "this PC does not expose the CPU turbo boost setting (common on some VMs, or on hardware without CPPC/dynamic boost support)"
                .to_string(),
        );
    }

    let scheme = crate::power::active_scheme_guid()?;
    let (ac_index, dc_index) = read_boost_indexes(&scheme)?;
    let (min_ac, min_dc) = read_setting_indexes(&scheme, PROC_THROTTLE_MIN_GUID)?;

    // Writing works even while the setting is hidden, so there is no need to
    // unhide it (which would leave a visible change in Windows' own power UI
    // that the user never asked for and rollback couldn't reasonably undo).
    transaction
        .save_entry(
            TURBO_BOOST_ID,
            SnapshotEntry::Composite {
                entries: vec![
                    SnapshotEntry::PowerSettingIndex {
                        scheme_guid: scheme.clone(),
                        subgroup_guid: SUB_PROCESSOR_GUID.to_string(),
                        setting_guid: PERF_BOOST_MODE_GUID.to_string(),
                        ac_index,
                        dc_index,
                    },
                    SnapshotEntry::PowerSettingIndex {
                        scheme_guid: scheme.clone(),
                        subgroup_guid: SUB_PROCESSOR_GUID.to_string(),
                        setting_guid: PROC_THROTTLE_MIN_GUID.to_string(),
                        ac_index: min_ac,
                        dc_index: min_dc,
                    },
                ],
            },
        )
        .map_err(|e| e.to_string())?;

    crate::power::run_powercfg(&[
        "/setacvalueindex",
        &scheme,
        SUB_PROCESSOR_GUID,
        PERF_BOOST_MODE_GUID,
        BOOST_AGGRESSIVE,
    ])?;
    crate::power::run_powercfg(&[
        "/setdcvalueindex",
        &scheme,
        SUB_PROCESSOR_GUID,
        PERF_BOOST_MODE_GUID,
        BOOST_AGGRESSIVE,
    ])?;
    // The floor. This is the half the user can actually feel — see the
    // PROC_THROTTLE_MIN_GUID doc comment.
    crate::power::run_powercfg(&[
        "/setacvalueindex",
        &scheme,
        SUB_PROCESSOR_GUID,
        PROC_THROTTLE_MIN_GUID,
        THROTTLE_MIN_MAX,
    ])?;
    if read_boost_indexes(&scheme)? != (Some(2), Some(2))
        || read_setting_indexes(&scheme, PROC_THROTTLE_MIN_GUID)? != (Some(100), min_dc)
    {
        return Err(
            "CPU boost configuration could not be verified; the snapshot was retained".into(),
        );
    }
    // AC only. On a laptop this setting on battery would hold every core at
    // its maximum while unplugged, which is a battery-life decision the user
    // did not make by pressing a button labelled Turbo Boost.
    crate::power::run_powercfg(&["/setactive", "scheme_current"])?;
    Ok(())
}

#[cfg(windows)]
pub fn rollback_turbo_boost(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(TURBO_BOOST_ID, |entry| {
        match entry {
            // Current shape: boost mode and the processor floor, restored
            // together. Every entry is attempted even if an earlier one fails, so
            // one setting refusing to restore cannot strand the other in its
            // tweaked state; the first error is reported once both have been
            // tried.
            SnapshotEntry::Composite { entries } => {
                let mut first_error: Option<String> = None;
                for entry in entries {
                    let result = match entry {
                        SnapshotEntry::PowerSettingIndex {
                            scheme_guid,
                            subgroup_guid,
                            setting_guid,
                            ac_index,
                            dc_index,
                        } => restore_power_index(
                            &scheme_guid,
                            &subgroup_guid,
                            &setting_guid,
                            ac_index,
                            dc_index,
                        ),
                        _ => Err("unexpected snapshot type inside turbo boost".to_string()),
                    };
                    if let Err(e) = result {
                        first_error.get_or_insert(e);
                    }
                }
                crate::power::run_powercfg(&["/setactive", "scheme_current"])?;
                match first_error {
                    Some(e) => Err(e),
                    None => Ok(()),
                }
            }

            // Written by builds that only changed boost mode. Still restorable
            // exactly as it was recorded.
            SnapshotEntry::PowerSettingIndex {
                scheme_guid,
                subgroup_guid,
                setting_guid,
                ac_index,
                dc_index,
            } => restore_power_index(
                &scheme_guid,
                &subgroup_guid,
                &setting_guid,
                ac_index,
                dc_index,
            ),

            // Legacy data does not identify the original plan. Never guess
            // that the currently active plan is the right recovery target.
            SnapshotEntry::PowerSetting { .. } => Err(
                "This legacy snapshot does not identify its original power plan. Recovery data was retained for manual review; no settings were changed.".into(),
            ),
            _ => Err("unexpected snapshot type for turbo boost".to_string()),
        }
    })
}

/// Puts a power setting back exactly as it was found.
///
/// `None` means the plan had no override and was inheriting the setting's
/// default, so the honest restore is to delete the value again rather than to
/// write some guess at what the default was.
#[cfg(windows)]
fn restore_power_index(
    scheme_guid: &str,
    subgroup_guid: &str,
    setting_guid: &str,
    ac_index: Option<u32>,
    dc_index: Option<u32>,
) -> Result<(), String> {
    use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_SET_VALUE};
    use winreg::RegKey;

    for (index, flag, value_name) in [
        (ac_index, "/setacvalueindex", "ACSettingIndex"),
        (dc_index, "/setdcvalueindex", "DCSettingIndex"),
    ] {
        match index {
            Some(v) => {
                crate::power::run_powercfg(&[
                    flag,
                    scheme_guid,
                    subgroup_guid,
                    setting_guid,
                    &v.to_string(),
                ])?;
            }
            None => {
                let path = format!(
                    r"SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes\{}\{}\{}",
                    scheme_guid, subgroup_guid, setting_guid
                );
                match RegKey::predef(HKEY_LOCAL_MACHINE)
                    .open_subkey_with_flags(&path, KEY_SET_VALUE)
                {
                    Ok(key) => match key.delete_value(value_name) {
                        Ok(()) => {}
                        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                        Err(e) => return Err(format!("could not remove power override: {e}")),
                    },
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                    Err(e) => return Err(format!("could not open power override: {e}")),
                }
            }
        }
    }

    if read_setting_indexes(scheme_guid, setting_guid)? != (ac_index, dc_index) {
        return Err(
            "power setting restoration could not be verified; the snapshot was retained".into(),
        );
    }
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

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// Regression for the "this PC does not expose the CPU turbo boost
    /// setting" error reported on a Ryzen 7 7800X3D — hardware that very much
    /// does support boost.
    ///
    /// Two independent causes, both of which this asserts against:
    ///   1. The old code parsed `powercfg /query` for the literal labels
    ///      "AC:" and "DC:". On this Italian machine that output reads
    ///      "Indice impostazione alimentazione CA corrente:", so the parse
    ///      never matched on any non-English Windows.
    ///   2. Windows marks PERFBOOSTMODE hidden (`Attributes = 1`) on most
    ///      consumer systems, and `powercfg /query` omits hidden settings
    ///      entirely — so even on English Windows there was nothing to parse.
    ///
    /// Support is now decided by the presence of the setting's definition key,
    /// which is unaffected by both.
    #[test]
    fn boost_support_is_detected_on_hardware_that_has_it() {
        assert!(
            boost_is_supported(),
            "PERFBOOSTMODE definition key not found. On real Windows hardware this \
             key exists whether or not the setting is hidden; if this fails, the \
             detection path regressed rather than the hardware lacking support."
        );
    }

    /// A plan sitting on the setting's default has no override key at all.
    /// That must read as `None` ("inheriting the default"), never as an error
    /// and never as a fabricated index — rollback relies on the distinction to
    /// know whether to rewrite a value or delete it.
    #[test]
    fn a_plan_with_no_override_reads_as_default_not_as_failure() {
        let scheme = crate::power::active_scheme_guid().expect("active scheme");
        let (ac, dc) = read_boost_indexes(&scheme).expect("read power indexes");
        // Either state is legitimate; what matters is that it returned.
        assert!(
            ac.is_none() || ac.unwrap() <= 4,
            "implausible AC boost index: {:?}",
            ac
        );
        assert!(
            dc.is_none() || dc.unwrap() <= 4,
            "implausible DC boost index: {:?}",
            dc
        );
    }
}
