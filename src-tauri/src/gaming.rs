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
pub(crate) const CORE_PARKING_ALL_UNPARKED: u32 = 100;

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
                ac_effective: inherited(&scheme, CORE_PARKING_MIN_GUID, ac_index, true)?,
                dc_effective: inherited(&scheme, CORE_PARKING_MIN_GUID, dc_index, false)?,
            },
        )
        .map_err(|e| e.to_string())?;

    crate::power::write_setting_index(
        &scheme,
        SUB_PROCESSOR_GUID,
        CORE_PARKING_MIN_GUID,
        true,
        CORE_PARKING_ALL_UNPARKED,
    )?;
    if read_setting_indexes(&scheme, CORE_PARKING_MIN_GUID)?
        != (Some(CORE_PARKING_ALL_UNPARKED), dc_index)
    {
        return Err(
            "core parking configuration could not be verified; the snapshot was retained".into(),
        );
    }
    crate::power::reactivate_current_scheme()
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
            ac_effective,
            dc_effective,
        } => restore_power_index(
            &scheme_guid,
            &subgroup_guid,
            &setting_guid,
            (ac_index, ac_effective),
            (dc_index, dc_effective),
        ),
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
pub(crate) const THROTTLE_MIN_MAX: u32 = 100;

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
    use crate::tweaks::{windows_impl::key_exists, Hive};
    key_exists(Hive::Hklm, &boost_setting_definition_path()).unwrap_or(false)
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
    let path = crate::power::setting_index_path(scheme_guid, SUB_PROCESSOR_GUID, setting_guid);
    use crate::tweaks::{windows_impl::read_dword, Hive};
    Ok((
        read_dword(Hive::Hklm, &path, "ACSettingIndex").map_err(|e| e.to_string())?,
        read_dword(Hive::Hklm, &path, "DCSettingIndex").map_err(|e| e.to_string())?,
    ))
}

/// Boost mode 2 = "Aggressive": let the CPU boost above its rated frequency
/// whenever thermals and power allow.
pub(crate) const BOOST_AGGRESSIVE: u32 = 2;

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
                        ac_effective: inherited(&scheme, PERF_BOOST_MODE_GUID, ac_index, true)?,
                        dc_effective: inherited(&scheme, PERF_BOOST_MODE_GUID, dc_index, false)?,
                    },
                    SnapshotEntry::PowerSettingIndex {
                        scheme_guid: scheme.clone(),
                        subgroup_guid: SUB_PROCESSOR_GUID.to_string(),
                        setting_guid: PROC_THROTTLE_MIN_GUID.to_string(),
                        ac_index: min_ac,
                        dc_index: min_dc,
                        ac_effective: inherited(&scheme, PROC_THROTTLE_MIN_GUID, min_ac, true)?,
                        dc_effective: inherited(&scheme, PROC_THROTTLE_MIN_GUID, min_dc, false)?,
                    },
                ],
            },
        )
        .map_err(|e| e.to_string())?;

    use crate::power::write_setting_index;
    for ac in [true, false] {
        write_setting_index(
            &scheme,
            SUB_PROCESSOR_GUID,
            PERF_BOOST_MODE_GUID,
            ac,
            BOOST_AGGRESSIVE,
        )?;
    }
    // The floor. This is the half the user can actually feel — see the
    // PROC_THROTTLE_MIN_GUID doc comment. AC only: on a laptop this setting on
    // battery would hold every core at its maximum while unplugged, which is a
    // battery-life decision the user did not make by pressing a button
    // labelled Turbo Boost.
    write_setting_index(
        &scheme,
        SUB_PROCESSOR_GUID,
        PROC_THROTTLE_MIN_GUID,
        true,
        THROTTLE_MIN_MAX,
    )?;
    if read_boost_indexes(&scheme)? != (Some(BOOST_AGGRESSIVE), Some(BOOST_AGGRESSIVE))
        || read_setting_indexes(&scheme, PROC_THROTTLE_MIN_GUID)?
            != (Some(THROTTLE_MIN_MAX), min_dc)
    {
        return Err(
            "CPU boost configuration could not be verified; the snapshot was retained".into(),
        );
    }
    crate::power::reactivate_current_scheme()
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
                            ac_effective,
                            dc_effective,
                        } => restore_power_index(
                            &scheme_guid,
                            &subgroup_guid,
                            &setting_guid,
                            (ac_index, ac_effective),
                            (dc_index, dc_effective),
                        ),
                        _ => Err("unexpected snapshot type inside turbo boost".to_string()),
                    };
                    if let Err(e) = result {
                        first_error.get_or_insert(e);
                    }
                }
                crate::power::reactivate_current_scheme()?;
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
                ac_effective,
                dc_effective,
            } => restore_power_index(
                &scheme_guid,
                &subgroup_guid,
                &setting_guid,
                (ac_index, ac_effective),
                (dc_index, dc_effective),
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
/// write some guess at what the default was. Windows 11 lets only SYSTEM
/// delete an override, though; when the delete is refused and the journal
/// recorded the value that was in effect, that value is written back through
/// the power API instead, which leaves the plan behaving exactly as it did.
#[cfg(windows)]
fn restore_power_index(
    scheme_guid: &str,
    subgroup_guid: &str,
    setting_guid: &str,
    ac: (Option<u32>, Option<u32>),
    dc: (Option<u32>, Option<u32>),
) -> Result<(), String> {
    let mut expected = [ac.0, dc.0];
    for (slot, (is_ac, value_name, (index, effective))) in [
        (true, "ACSettingIndex", ac),
        (false, "DCSettingIndex", dc),
    ]
    .into_iter()
    .enumerate()
    {
        match index {
            Some(v) => {
                crate::power::write_setting_index(scheme_guid, subgroup_guid, setting_guid, is_ac, v)?
            }
            None => {
                let path = crate::power::setting_index_path(scheme_guid, subgroup_guid, setting_guid);
                // Nothing to undo where no override exists (this tweak may
                // never have written that half), and nothing may be created.
                if crate::tweaks::windows_impl::read_dword(crate::tweaks::Hive::Hklm, &path, value_name)
                    .map_err(|e| e.to_string())?
                    .is_none()
                {
                    continue;
                }
                let deleted = crate::tweaks::windows_impl::restore_value(&RegistrySnapshot {
                    hive: "HKLM".into(),
                    path,
                    name: value_name.into(),
                    original_value: None,
                });
                match (deleted, effective) {
                    (Ok(()), _) => {}
                    (Err(_), Some(value)) => {
                        crate::power::write_setting_index(
                            scheme_guid,
                            subgroup_guid,
                            setting_guid,
                            is_ac,
                            value,
                        )?;
                        expected[slot] = Some(value);
                    }
                    (Err(error), None) => return Err(error),
                }
            }
        }
    }

    if read_setting_indexes(scheme_guid, setting_guid)? != (expected[0], expected[1]) {
        return Err(
            "power setting restoration could not be verified; the snapshot was retained".into(),
        );
    }
    crate::power::reactivate_current_scheme()
}

/// The value in effect for a setting the plan does not override, recorded so a
/// restore can put it back when Windows refuses to delete the override.
#[cfg(windows)]
fn inherited(
    scheme: &str,
    setting: &str,
    index: Option<u32>,
    ac: bool,
) -> Result<Option<u32>, String> {
    match index {
        Some(_) => Ok(None),
        None => crate::power::read_effective_index(scheme, SUB_PROCESSOR_GUID, setting, ac).map(Some),
    }
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
    use crate::mock_registry::{Fixture, Stored};
    use crate::power::setting_index_path;
    use crate::power::tests::{machine, Machine, BALANCED, POWER_SAVER};
    use crate::tweaks::{Hive, RegistryBackend};

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

    type Action = fn(&RollbackStore) -> Result<(), String>;

    /// A processor-setting tweak and what it must leave behind: the setting,
    /// AC (`true`) or DC, and the index written there, `None` for "untouched".
    struct Case {
        id: &'static str,
        apply: Action,
        rollback: Action,
        slots: &'static [(&'static str, bool, Option<u32>)],
    }

    const CASES: [Case; 2] = [
        Case {
            id: TURBO_BOOST_ID,
            apply: apply_turbo_boost,
            rollback: rollback_turbo_boost,
            slots: &[
                (PERF_BOOST_MODE_GUID, true, Some(BOOST_AGGRESSIVE)),
                (PERF_BOOST_MODE_GUID, false, Some(BOOST_AGGRESSIVE)),
                (PROC_THROTTLE_MIN_GUID, true, Some(THROTTLE_MIN_MAX)),
                (PROC_THROTTLE_MIN_GUID, false, None),
            ],
        },
        Case {
            id: CORE_PARKING_ID,
            apply: apply_core_parking,
            rollback: rollback_core_parking,
            slots: &[
                (CORE_PARKING_MIN_GUID, true, Some(CORE_PARKING_ALL_UNPARKED)),
                (CORE_PARKING_MIN_GUID, false, None),
            ],
        },
    ];

    fn slot_name(ac: bool) -> &'static str {
        if ac {
            "ACSettingIndex"
        } else {
            "DCSettingIndex"
        }
    }

    fn index(machine: &Machine, setting: &str, ac: bool) -> Option<Stored> {
        let path = setting_index_path(BALANCED, SUB_PROCESSOR_GUID, setting);
        machine.registry.get(Hive::Hklm, &path, slot_name(ac))
    }

    /// A machine that defines the boost setting, with Balanced active and its
    /// processor indexes seeded: `ac`/`dc` of `None` leave the plan on the
    /// setting's default, which rollback must restore by deleting again.
    fn seeded(case: &Case, ac: Option<u32>, dc: Option<u32>) -> (Machine, Fixture) {
        let machine = machine();
        machine
            .registry
            .create_key(Hive::Hklm, &boost_setting_definition_path())
            .unwrap();
        for (setting, is_ac, _) in case.slots {
            let path = setting_index_path(BALANCED, SUB_PROCESSOR_GUID, setting);
            if let Some(value) = if *is_ac { ac } else { dc } {
                let value = Stored::Value(RegValue::Dword(value));
                machine
                    .registry
                    .set(Hive::Hklm, &path, slot_name(*is_ac), value);
            }
        }
        (machine, Fixture::new())
    }

    const SEEDS: [(Option<u32>, Option<u32>); 3] =
        [(None, None), (Some(1), Some(0)), (Some(1), None)];

    #[test]
    fn processor_settings_round_trip_to_the_exact_original_indexes() {
        for case in &CASES {
            for (ac, dc) in SEEDS {
                let (machine, fixture) = seeded(case, ac, dc);
                let before = machine.registry.dump();
                (case.apply)(&fixture.store).unwrap_or_else(|e| panic!("{}: {e}", case.id));
                for (setting, is_ac, written) in case.slots {
                    let seed = if *is_ac { ac } else { dc };
                    let expected = written.or(seed).map(|v| Stored::Value(RegValue::Dword(v)));
                    assert_eq!(
                        index(&machine, setting, *is_ac),
                        expected,
                        "{} {setting}",
                        case.id
                    );
                }
                // The plan in use was activated again, so Windows applies it now.
                assert!(machine.plans.activations.get() > 0, "{}", case.id);
                assert_eq!(machine.active(), BALANCED);
                (case.rollback)(&fixture.store).unwrap_or_else(|e| panic!("{}: {e}", case.id));
                assert_eq!(machine.registry.dump(), before, "{} {ac:?}/{dc:?}", case.id);
                assert!(!fixture.store.is_applied(case.id), "{}", case.id);
            }
        }
    }

    #[test]
    fn reapplying_after_drift_still_restores_the_first_original() {
        for case in &CASES {
            let (machine, fixture) = seeded(case, Some(1), Some(0));
            let before = machine.registry.dump();
            (case.apply)(&fixture.store).unwrap();
            let (setting, is_ac, _) = case.slots[0];
            let path = setting_index_path(BALANCED, SUB_PROCESSOR_GUID, setting);
            let drifted = Stored::Value(RegValue::Dword(3));
            machine
                .registry
                .set(Hive::Hklm, &path, slot_name(is_ac), drifted);
            (case.apply)(&fixture.store).unwrap_or_else(|e| panic!("{}: {e}", case.id));
            (case.rollback)(&fixture.store).unwrap();
            assert_eq!(machine.registry.dump(), before, "{}", case.id);
        }
    }

    /// The snapshot belongs to the plan it was taken from. With another plan
    /// active, applying again is refused before any write, and rollback still
    /// restores the original plan's indexes without switching plans.
    #[test]
    fn a_plan_change_between_applies_is_refused_and_the_original_still_restores() {
        for case in &CASES {
            let (machine, fixture) = seeded(case, Some(1), Some(0));
            let before = machine.registry.dump();
            (case.apply)(&fixture.store).unwrap();
            machine.switch_to(POWER_SAVER);
            let writes = machine.registry.mutations.get();
            let error = (case.apply)(&fixture.store).unwrap_err();
            assert!(error.contains("another target"), "{}: {error}", case.id);
            assert_eq!(machine.registry.mutations.get(), writes, "{}", case.id);
            (case.rollback)(&fixture.store).unwrap();
            assert_eq!(machine.registry.dump(), before, "{}", case.id);
            assert_eq!(machine.active(), POWER_SAVER);
        }
    }

    #[test]
    fn a_write_that_does_not_stick_fails_and_keeps_the_journal() {
        for case in &CASES {
            let (machine, fixture) = seeded(case, Some(1), Some(0));
            let before = machine.registry.dump();
            machine.registry.drop_writes.set(true);
            let error = (case.apply)(&fixture.store).unwrap_err();
            assert!(
                error.contains("could not be verified"),
                "{}: {error}",
                case.id
            );
            assert!(fixture.store.is_applied(case.id), "{}", case.id);
            assert_eq!(machine.registry.dump(), before, "{}", case.id);
            machine.registry.drop_writes.set(false);
            (case.rollback)(&fixture.store).unwrap();
            assert_eq!(machine.registry.dump(), before, "{}", case.id);
            assert!(!fixture.store.is_applied(case.id), "{}", case.id);
        }
    }

    #[test]
    fn a_failed_restore_keeps_the_journal_for_a_retry() {
        for case in &CASES {
            for (ac, dc) in SEEDS {
                let (machine, fixture) = seeded(case, ac, dc);
                let before = machine.registry.dump();
                (case.apply)(&fixture.store).unwrap();
                machine.registry.drop_writes.set(true);
                assert!((case.rollback)(&fixture.store).is_err(), "{}", case.id);
                assert!(fixture.store.is_applied(case.id), "{}", case.id);
                machine.registry.drop_writes.set(false);
                (case.rollback)(&fixture.store).unwrap();
                assert_eq!(machine.registry.dump(), before, "{} {ac:?}/{dc:?}", case.id);
                assert!(!fixture.store.is_applied(case.id), "{}", case.id);
            }
        }
    }

    /// A plan deleted while the tweak was on cannot take its values back; the
    /// journal waits until the plan exists again.
    #[test]
    fn a_deleted_plan_keeps_the_journal_until_it_exists_again() {
        for case in &CASES {
            let (machine, fixture) = seeded(case, Some(1), Some(0));
            let before = machine.registry.dump();
            (case.apply)(&fixture.store).unwrap();
            machine.switch_to(POWER_SAVER);
            machine.delete_plan(BALANCED);
            assert!((case.rollback)(&fixture.store).is_err(), "{}", case.id);
            assert!(fixture.store.is_applied(case.id), "{}", case.id);
            machine.recreate_plan(BALANCED);
            (case.rollback)(&fixture.store).unwrap();
            assert_eq!(machine.registry.dump(), before, "{}", case.id);
        }
    }

    #[test]
    fn turbo_boost_is_refused_where_windows_does_not_define_it() {
        let machine = machine();
        let fixture = Fixture::new();
        let error = apply_turbo_boost(&fixture.store).unwrap_err();
        assert!(error.contains("does not expose"), "{error}");
        assert!(!fixture.store.is_applied(TURBO_BOOST_ID));
        assert_eq!(machine.registry.mutations.get(), 0);
        assert_eq!(machine.plans.activations.get(), 0);
    }

    /// Windows 11 lets only SYSTEM delete a plan override. A setting that had
    /// none is then put back by writing the value that was in effect, which
    /// leaves the plan behaving exactly as before; halves the tweak never
    /// wrote are left without an override.
    #[test]
    fn an_inherited_setting_is_restored_through_the_api_when_the_delete_is_refused() {
        let inherited = Some(Stored::Value(RegValue::Dword(crate::power::tests::INHERITED_DEFAULT)));
        for case in &CASES {
            let (machine, fixture) = seeded(case, None, None);
            (case.apply)(&fixture.store).unwrap();
            machine.registry.deny_deletes.set(true);
            (case.rollback)(&fixture.store).unwrap_or_else(|e| panic!("{}: {e}", case.id));
            assert!(!fixture.store.is_applied(case.id), "{}", case.id);
            for (setting, ac, written) in case.slots {
                let expected = if written.is_some() { inherited.clone() } else { None };
                assert_eq!(index(&machine, setting, *ac), expected, "{} {setting} ac={ac}", case.id);
            }
        }
    }

    /// A journal from an older build recorded no value in effect, so a refused
    /// delete keeps it for a retry instead of guessing at a default.
    #[test]
    fn an_older_journal_without_the_value_in_effect_keeps_waiting() {
        let (machine, fixture) = seeded(&CASES[1], None, None);
        let older = SnapshotEntry::PowerSettingIndex {
            scheme_guid: BALANCED.into(),
            subgroup_guid: SUB_PROCESSOR_GUID.into(),
            setting_guid: CORE_PARKING_MIN_GUID.into(),
            ac_index: None,
            dc_index: None,
            ac_effective: None,
            dc_effective: None,
        };
        let path = setting_index_path(BALANCED, SUB_PROCESSOR_GUID, CORE_PARKING_MIN_GUID);
        machine.registry.set(Hive::Hklm, &path, "ACSettingIndex", Stored::Value(RegValue::Dword(100)));
        fixture.store.transaction().unwrap().save_entry(CORE_PARKING_ID, older).unwrap();
        machine.registry.deny_deletes.set(true);
        assert!(rollback_core_parking(&fixture.store).is_err());
        assert!(fixture.store.is_applied(CORE_PARKING_ID));
        machine.registry.deny_deletes.set(false);
        rollback_core_parking(&fixture.store).unwrap();
        assert_eq!(index(&machine, CORE_PARKING_MIN_GUID, true), None);
    }

    /// Journals from older builds: one that recorded boost mode alone is put
    /// back exactly; one that never named its plan is refused untouched.
    #[test]
    fn older_turbo_boost_journals_restore_or_are_refused_as_recorded() {
        let (machine, fixture) = seeded(&CASES[0], Some(2), Some(2));
        let boost_only = SnapshotEntry::PowerSettingIndex {
            scheme_guid: BALANCED.into(),
            subgroup_guid: SUB_PROCESSOR_GUID.into(),
            setting_guid: PERF_BOOST_MODE_GUID.into(),
            ac_index: Some(1),
            dc_index: None,
            ac_effective: None,
            dc_effective: None,
        };
        let mut transaction = fixture.store.transaction().unwrap();
        transaction.save_entry(TURBO_BOOST_ID, boost_only).unwrap();
        drop(transaction);
        rollback_turbo_boost(&fixture.store).unwrap();
        let one = Some(Stored::Value(RegValue::Dword(1)));
        assert_eq!(index(&machine, PERF_BOOST_MODE_GUID, true), one);
        assert_eq!(index(&machine, PERF_BOOST_MODE_GUID, false), None);
        assert!(!fixture.store.is_applied(TURBO_BOOST_ID));

        let legacy = SnapshotEntry::PowerSetting {
            ac_index: "2".into(),
            dc_index: "0x2".into(),
        };
        let mut transaction = fixture.store.transaction().unwrap();
        transaction.save_entry(TURBO_BOOST_ID, legacy).unwrap();
        drop(transaction);
        let before = machine.registry.dump();
        let writes = machine.registry.mutations.get();
        let error = rollback_turbo_boost(&fixture.store).unwrap_err();
        assert!(error.contains("legacy snapshot"), "{error}");
        assert!(fixture.store.is_applied(TURBO_BOOST_ID));
        assert_eq!(machine.registry.dump(), before);
        assert_eq!(machine.registry.mutations.get(), writes);
    }
}
