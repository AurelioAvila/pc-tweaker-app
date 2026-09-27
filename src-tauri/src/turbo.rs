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

pub(crate) const GAME_DVR_HIVE: &str = "HKCU";
pub(crate) const GAME_DVR_PATH: &str = r"System\GameConfigStore";
pub(crate) const GAME_DVR_NAME: &str = "GameDVR_Enabled";

pub(crate) const PRIORITY_HIVE: &str = "HKLM";
pub(crate) const PRIORITY_PATH: &str = r"SYSTEM\CurrentControlSet\Control\PriorityControl";
pub(crate) const PRIORITY_NAME: &str = "Win32PrioritySeparation";
pub(crate) const PRIORITY_GAMING_VALUE: u32 = 38;

#[cfg(windows)]
fn apply_with_owner(store: &RollbackStore, owner: Option<&str>) -> Result<bool, String> {
    use crate::tweaks::windows_impl::{hive_from_str, read_value, write_dword};
    let mut transaction = store.transaction()?;
    if owner.is_some() && transaction.entry(TWEAK_ID).is_some() {
        return Ok(false);
    }
    let game_dvr_original = read_value(
        hive_from_str(GAME_DVR_HIVE),
        GAME_DVR_PATH,
        GAME_DVR_NAME,
        &RegValue::Dword(0),
    )
    .map_err(|e| e.to_string())?;
    let priority_original = read_value(
        hive_from_str(PRIORITY_HIVE),
        PRIORITY_PATH,
        PRIORITY_NAME,
        &RegValue::Dword(0),
    )
    .map_err(|e| e.to_string())?;
    let power_original = crate::power::active_scheme_guid()?;
    let snapshot = SnapshotEntry::Composite {
        entries: vec![
            SnapshotEntry::Registry(RegistrySnapshot {
                hive: GAME_DVR_HIVE.into(),
                path: GAME_DVR_PATH.into(),
                name: GAME_DVR_NAME.into(),
                original_value: game_dvr_original,
            }),
            SnapshotEntry::Registry(RegistrySnapshot {
                hive: PRIORITY_HIVE.into(),
                path: PRIORITY_PATH.into(),
                name: PRIORITY_NAME.into(),
                original_value: priority_original,
            }),
            SnapshotEntry::PowerScheme {
                previous_guid: power_original,
            },
        ],
    };
    if let Some(owner) = owner {
        transaction.save_owned_entry(TWEAK_ID, snapshot, owner)?;
    } else {
        transaction.save_entry(TWEAK_ID, snapshot)?;
        // A manual apply takes responsibility for the preset. A later game
        // exit must not undo that explicit choice, even if values were equal.
        transaction.clear_owner(TWEAK_ID)?;
    }
    write_dword(
        hive_from_str(GAME_DVR_HIVE),
        GAME_DVR_PATH,
        GAME_DVR_NAME,
        0,
    )?;
    write_dword(
        hive_from_str(PRIORITY_HIVE),
        PRIORITY_PATH,
        PRIORITY_NAME,
        PRIORITY_GAMING_VALUE,
    )?;
    crate::power::activate_scheme(crate::power::HIGH_PERFORMANCE_GUID)?;
    if !crate::power::active_scheme_guid()?
        .eq_ignore_ascii_case(crate::power::HIGH_PERFORMANCE_GUID)
    {
        return Err("the power plan did not change; the preset snapshot was retained".into());
    }
    Ok(true)
}

#[cfg(windows)]
fn restore_preset(entry: SnapshotEntry) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;
    let SnapshotEntry::Composite { entries } = entry else {
        return Err("unexpected snapshot type for Turbo Gaming".into());
    };
    let mut first_error = None;
    // Attempt every restore, retaining the entire original on any failure.
    // Repeating an already restored value is safe after a partial attempt.
    for entry in entries.into_iter().rev() {
        let result = match entry {
            SnapshotEntry::Registry(snapshot) => restore_value(&snapshot),
            SnapshotEntry::PowerScheme { previous_guid } => (|| {
                crate::power::activate_scheme(&previous_guid)?;
                if !crate::power::active_scheme_guid()?.eq_ignore_ascii_case(&previous_guid) {
                    return Err("the previous power plan could not be verified".into());
                }
                Ok(())
            })(),
            _ => Err("unexpected entry inside Turbo Gaming snapshot".into()),
        };
        if let Err(e) = result {
            first_error.get_or_insert(e);
        }
    }
    first_error.map_or(Ok(()), Err)
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    apply_with_owner(store, None).map(|_| ())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(TWEAK_ID, restore_preset)
}

#[cfg(windows)]
pub fn apply_for_session(store: &RollbackStore, owner: &str) -> Result<bool, String> {
    apply_with_owner(store, Some(owner))
}

#[cfg(windows)]
pub fn rollback_for_session(store: &RollbackStore, owner: &str) -> Result<bool, String> {
    let mut transaction = store.transaction()?;
    if transaction.owner(TWEAK_ID) != Some(owner) || transaction.entry(TWEAK_ID).is_none() {
        return Ok(false);
    }
    transaction.restore_entry(TWEAK_ID, restore_preset)?;
    Ok(true)
}

pub fn session_owner(store: &RollbackStore) -> Result<Option<String>, String> {
    Ok(store.transaction()?.owner(TWEAK_ID).map(str::to_owned))
}

pub fn is_owned_by_session(store: &RollbackStore, owner: &str) -> Result<bool, String> {
    Ok(session_owner(store)?.as_deref() == Some(owner))
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::mock_registry::{Fixture, Stored};
    use crate::power::tests::{machine, Machine, BALANCED, POWER_SAVER};
    use crate::power::HIGH_PERFORMANCE_GUID;
    use crate::tweaks::Hive;

    const OWNER: &str = "gs-4242-1-2-3";
    const OTHER_OWNER: &str = "gs-4243-1-2-3";

    /// Game DVR on, as most people have it, and no priority value at all, so
    /// the round trip has to write one back and delete the other.
    fn seeded() -> (Machine, Fixture) {
        let machine = machine();
        machine.registry.set(
            Hive::Hkcu,
            GAME_DVR_PATH,
            GAME_DVR_NAME,
            Stored::Value(RegValue::Dword(1)),
        );
        (machine, Fixture::new())
    }

    fn preset_is_on(machine: &Machine) -> bool {
        machine
            .registry
            .get(Hive::Hkcu, GAME_DVR_PATH, GAME_DVR_NAME)
            == Some(Stored::Value(RegValue::Dword(0)))
            && machine
                .registry
                .get(Hive::Hklm, PRIORITY_PATH, PRIORITY_NAME)
                == Some(Stored::Value(RegValue::Dword(PRIORITY_GAMING_VALUE)))
            && machine.active() == HIGH_PERFORMANCE_GUID
    }

    #[test]
    fn the_preset_round_trips_to_the_exact_original() {
        let (machine, fixture) = seeded();
        let before = machine.registry.dump();
        apply(&fixture.store).unwrap();
        assert!(preset_is_on(&machine));
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.registry.dump(), before);
        assert_eq!(machine.active(), BALANCED);
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn reapplying_after_drift_still_restores_the_first_original() {
        let (machine, fixture) = seeded();
        let before = machine.registry.dump();
        apply(&fixture.store).unwrap();
        machine.registry.set(
            Hive::Hkcu,
            GAME_DVR_PATH,
            GAME_DVR_NAME,
            Stored::Value(RegValue::Dword(7)),
        );
        machine.switch_to(POWER_SAVER);
        apply(&fixture.store).unwrap();
        assert!(preset_is_on(&machine));
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.registry.dump(), before);
        assert_eq!(machine.active(), BALANCED);
    }

    #[test]
    fn a_write_that_does_not_stick_fails_and_keeps_the_journal() {
        let (machine, fixture) = seeded();
        let before = machine.registry.dump();
        machine.registry.drop_writes.set(true);
        let error = apply(&fixture.store).unwrap_err();
        assert!(error.contains("verification failed"), "{error}");
        assert!(fixture.store.is_applied(TWEAK_ID));
        assert_eq!(machine.registry.dump(), before);
        assert_eq!(machine.active(), BALANCED);
        machine.registry.drop_writes.set(false);
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.registry.dump(), before);
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    /// The registry half is already written when the plan switch fails, so
    /// the journal must survive for rollback to undo it.
    #[test]
    fn a_plan_switch_that_fails_keeps_the_journal_for_the_registry_half() {
        let (machine, fixture) = seeded();
        let before = machine.registry.dump();
        machine.delete_plan(HIGH_PERFORMANCE_GUID);
        assert!(apply(&fixture.store).is_err());
        assert!(fixture.store.is_applied(TWEAK_ID));
        assert_ne!(machine.registry.dump(), before);
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.registry.dump(), before);
        assert_eq!(machine.active(), BALANCED);
    }

    #[test]
    fn a_failed_restore_keeps_the_journal_but_still_restores_what_it_can() {
        let (machine, fixture) = seeded();
        let before = machine.registry.dump();
        apply(&fixture.store).unwrap();
        machine.delete_plan(BALANCED);
        assert!(rollback(&fixture.store).is_err());
        assert!(fixture.store.is_applied(TWEAK_ID));
        // Every part is attempted, so the registry half is back already.
        assert_eq!(machine.registry.dump(), before);
        machine.recreate_plan(BALANCED);
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.active(), BALANCED);
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn a_session_only_undoes_what_it_applied_itself() {
        let (machine, fixture) = seeded();
        let before = machine.registry.dump();
        assert!(apply_for_session(&fixture.store, OWNER).unwrap());
        assert!(preset_is_on(&machine));
        assert!(is_owned_by_session(&fixture.store, OWNER).unwrap());
        // A repeated start, or another session's exit, changes nothing.
        let writes = machine.registry.mutations.get();
        let switches = machine.plans.activations.get();
        assert!(!apply_for_session(&fixture.store, OWNER).unwrap());
        assert!(!rollback_for_session(&fixture.store, OTHER_OWNER).unwrap());
        assert_eq!(machine.registry.mutations.get(), writes);
        assert_eq!(machine.plans.activations.get(), switches);
        assert!(rollback_for_session(&fixture.store, OWNER).unwrap());
        assert_eq!(machine.registry.dump(), before);
        assert_eq!(machine.active(), BALANCED);
        assert_eq!(session_owner(&fixture.store).unwrap(), None);
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn a_session_never_undoes_a_manual_apply() {
        let (machine, fixture) = seeded();
        let before = machine.registry.dump();
        // Applied by hand first: a session neither takes it over nor undoes it.
        apply(&fixture.store).unwrap();
        assert!(!apply_for_session(&fixture.store, OWNER).unwrap());
        assert!(!rollback_for_session(&fixture.store, OWNER).unwrap());
        assert!(preset_is_on(&machine));
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.registry.dump(), before);

        // Applied by a session, then by hand: the manual apply takes it over,
        // keeps the session's originals, and the session's exit leaves it on.
        apply_for_session(&fixture.store, OWNER).unwrap();
        apply(&fixture.store).unwrap();
        assert_eq!(session_owner(&fixture.store).unwrap(), None);
        assert!(!rollback_for_session(&fixture.store, OWNER).unwrap());
        assert!(preset_is_on(&machine));
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.registry.dump(), before);
        assert_eq!(machine.active(), BALANCED);
    }
}
