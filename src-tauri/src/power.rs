use crate::rollback::{RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "power_plan_performance";
pub const HIGH_PERFORMANCE_GUID: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";

/// The power-plan operations this tweak, Turbo Gaming's plan switch and the
/// processor settings in gaming.rs are built from. Production code reaches
/// Windows through `WinPowerPlans`; unit tests install the in-memory plans in
/// `tests` below, the same way the registry seam in tweaks.rs works.
#[cfg(windows)]
pub(crate) trait PowerPlans {
    /// The active scheme as a lowercase GUID, the form powercfg printed.
    fn active(&self) -> Result<String, String>;
    /// Makes `guid` the active scheme. Activating the scheme that is already
    /// active is how Windows applies index changes made to it.
    fn activate(&self, guid: &str) -> Result<(), String>;
    /// The index one setting has in effect in `scheme`: the plan's own
    /// override, or the default it inherits when there is none.
    fn read_index(&self, scheme: &str, subgroup: &str, setting: &str, ac: bool)
        -> Result<u32, String>;
    /// Writes one setting's AC index (`ac`) or DC index in `scheme`.
    fn write_index(
        &self,
        scheme: &str,
        subgroup: &str,
        setting: &str,
        ac: bool,
        value: u32,
    ) -> Result<(), String>;
}

/// The documented power API in powrprof.dll. No process is started, so no
/// output has to be parsed in whatever language Windows is displaying.
#[cfg(windows)]
pub(crate) struct WinPowerPlans;

#[cfg(windows)]
impl PowerPlans for WinPowerPlans {
    fn active(&self) -> Result<String, String> {
        crate::power_tuning::native::active_scheme()
    }

    fn activate(&self, guid: &str) -> Result<(), String> {
        use crate::power_tuning::native::{checked, guid as parse};
        use windows_sys::Win32::System::Power::PowerSetActiveScheme;
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let scheme = parse(guid)?;
        // SAFETY: `scheme` lives on this frame for the whole call and is only
        // read. A null root key selects the system power policy store.
        checked(unsafe { PowerSetActiveScheme(std::ptr::null_mut(), &scheme) })
    }

    fn read_index(&self, scheme: &str, subgroup: &str, setting: &str, ac: bool)
        -> Result<u32, String> {
        use crate::power_tuning::native::{checked, guid as parse};
        use windows_sys::Win32::System::Power::{PowerReadACValueIndex, PowerReadDCValueIndex};
        let (scheme, subgroup, setting) = (parse(scheme)?, parse(subgroup)?, parse(setting)?);
        let mut value = 0u32;
        // SAFETY: the three GUIDs and `value` live on this frame for the whole
        // call; the GUIDs are only read. A null root key selects the system
        // power policy store.
        let code = unsafe {
            if ac {
                PowerReadACValueIndex(std::ptr::null_mut(), &scheme, &subgroup, &setting, &mut value)
            } else {
                PowerReadDCValueIndex(std::ptr::null_mut(), &scheme, &subgroup, &setting, &mut value)
            }
        };
        checked(code)?;
        Ok(value)
    }

    fn write_index(
        &self,
        scheme: &str,
        subgroup: &str,
        setting: &str,
        ac: bool,
        value: u32,
    ) -> Result<(), String> {
        use crate::power_tuning::native::{checked, guid as parse};
        use windows_sys::Win32::System::Power::{PowerWriteACValueIndex, PowerWriteDCValueIndex};
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let (scheme, subgroup, setting) = (parse(scheme)?, parse(subgroup)?, parse(setting)?);
        let write = if ac {
            PowerWriteACValueIndex
        } else {
            PowerWriteDCValueIndex
        };
        // SAFETY: the three GUIDs live on this frame for the whole call and
        // are only read. A null root key selects the system power policy store.
        checked(unsafe { write(std::ptr::null_mut(), &scheme, &subgroup, &setting, value) })
    }
}

#[cfg(all(test, windows))]
thread_local! {
    static TEST_PLANS: std::cell::RefCell<Option<std::rc::Rc<dyn PowerPlans>>> =
        const { std::cell::RefCell::new(None) };
}

/// Routes this thread's power-plan calls to `plans` (test builds only).
/// Thread-local, so tests running in parallel never see each other's state.
#[cfg(all(test, windows))]
pub(crate) fn set_test_plans(plans: Option<std::rc::Rc<dyn PowerPlans>>) {
    TEST_PLANS.with(|slot| *slot.borrow_mut() = plans);
}

#[cfg(windows)]
fn with_plans<T>(f: impl FnOnce(&dyn PowerPlans) -> T) -> T {
    #[cfg(test)]
    if let Some(plans) = TEST_PLANS.with(|slot| slot.borrow().clone()) {
        return f(&*plans);
    }
    f(&WinPowerPlans)
}

#[cfg(windows)]
pub fn active_scheme_guid() -> Result<String, String> {
    with_plans(|plans| plans.active())
}

#[cfg(windows)]
pub(crate) fn activate_scheme(guid: &str) -> Result<(), String> {
    with_plans(|plans| plans.activate(guid))
}

#[cfg(windows)]
pub(crate) fn read_effective_index(
    scheme: &str,
    subgroup: &str,
    setting: &str,
    ac: bool,
) -> Result<u32, String> {
    with_plans(|plans| plans.read_index(scheme, subgroup, setting, ac))
}

#[cfg(windows)]
pub(crate) fn write_setting_index(
    scheme: &str,
    subgroup: &str,
    setting: &str,
    ac: bool,
    value: u32,
) -> Result<(), String> {
    with_plans(|plans| plans.write_index(scheme, subgroup, setting, ac, value))
}

/// Activates the active scheme again, so index changes made to the plan in
/// use take effect now (what `powercfg /setactive scheme_current` did).
#[cfg(windows)]
pub(crate) fn reactivate_current_scheme() -> Result<(), String> {
    activate_scheme(&active_scheme_guid()?)
}

/// Where a plan keeps its own value for one setting, as `ACSettingIndex` and
/// `DCSettingIndex`. A value missing there means the plan uses the default.
#[cfg(windows)]
pub(crate) fn setting_index_path(scheme: &str, subgroup: &str, setting: &str) -> String {
    format!(
        r"SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes\{scheme}\{subgroup}\{setting}"
    )
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
    let mut transaction = store.transaction()?;

    let previous = active_scheme_guid()?;

    transaction
        .save_entry(
            TWEAK_ID,
            SnapshotEntry::PowerScheme {
                previous_guid: previous,
            },
        )
        .map_err(|e| e.to_string())?;
    activate_scheme(HIGH_PERFORMANCE_GUID)?;
    if !active_scheme_guid()?.eq_ignore_ascii_case(HIGH_PERFORMANCE_GUID) {
        return Err("the selected power plan could not be verified".into());
    }
    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(TWEAK_ID, |entry| {
        let SnapshotEntry::PowerScheme { previous_guid } = entry else {
            return Err("unexpected snapshot type for the power plan".to_string());
        };

        activate_scheme(&previous_guid)?;
        if !active_scheme_guid()?.eq_ignore_ascii_case(&previous_guid) {
            return Err("the previous power plan could not be verified".into());
        }
        Ok(())
    })
}

#[cfg(not(windows))]
pub fn is_high_performance_active() -> bool {
    false
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

/// The in-memory power plans, shared with the Turbo Gaming and processor
/// setting tests, and the tests for this tweak.
#[cfg(all(test, windows))]
pub(crate) mod tests {
    use super::*;
    use crate::mock_registry::{install, Fixture, Installed, MemRegistry};
    use crate::rollback::RegValue;
    use crate::tweaks::{Hive, RegistryBackend};
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;

    pub(crate) const BALANCED: &str = "381b4222-f694-41f0-9685-ff5bb260df2e";
    pub(crate) const POWER_SAVER: &str = "a1841308-3541-4fab-bc81-f71556f20b4a";
    /// What a setting with no override in a fake plan reads as in effect.
    pub(crate) const INHERITED_DEFAULT: u32 = 7;

    /// Power plans that live in memory. Index writes land in the installed
    /// `MemRegistry` at `setting_index_path`, exactly where the tweaks read
    /// them back, and that registry's `deny_writes` and `drop_writes` govern
    /// plan switches too, so one switch makes the whole machine refuse or
    /// silently ignore changes.
    pub(crate) struct FakePlans {
        registry: Rc<MemRegistry>,
        active: RefCell<String>,
        known: RefCell<Vec<String>>,
        /// Activations that took effect, re-activating the active plan included.
        pub activations: Cell<usize>,
    }

    impl FakePlans {
        fn exists(&self, scheme: &str) -> Result<(), String> {
            if self
                .known
                .borrow()
                .iter()
                .any(|k| k.eq_ignore_ascii_case(scheme))
            {
                Ok(())
            } else {
                Err("Windows power policy error 2; the power plan does not exist".into())
            }
        }
    }

    impl PowerPlans for FakePlans {
        fn active(&self) -> Result<String, String> {
            Ok(self.active.borrow().clone())
        }

        fn activate(&self, guid: &str) -> Result<(), String> {
            self.exists(guid)?;
            if self.registry.deny_writes.get() {
                return Err("Windows power policy error 5".into());
            }
            if !self.registry.drop_writes.get() {
                *self.active.borrow_mut() = guid.to_ascii_lowercase();
                self.activations.set(self.activations.get() + 1);
            }
            Ok(())
        }

        fn read_index(&self, scheme: &str, subgroup: &str, setting: &str, ac: bool)
            -> Result<u32, String> {
            self.exists(scheme)?;
            let name = if ac {
                "ACSettingIndex"
            } else {
                "DCSettingIndex"
            };
            let path = setting_index_path(scheme, subgroup, setting);
            match self.registry.read(Hive::Hklm, &path, name).map_err(|e| e.to_string())? {
                Some(RegValue::Dword(value)) => Ok(value),
                Some(_) => Err("not a power index".into()),
                None => Ok(INHERITED_DEFAULT),
            }
        }

        fn write_index(
            &self,
            scheme: &str,
            subgroup: &str,
            setting: &str,
            ac: bool,
            value: u32,
        ) -> Result<(), String> {
            self.exists(scheme)?;
            let name = if ac {
                "ACSettingIndex"
            } else {
                "DCSettingIndex"
            };
            let path = setting_index_path(scheme, subgroup, setting);
            self.registry
                .write(Hive::Hklm, &path, name, &RegValue::Dword(value))
                .map_err(|e| e.to_string())
        }
    }

    /// The in-memory registry and power plans, routed to for this thread until
    /// dropped. Balanced, High performance and Power saver exist; Balanced is
    /// active.
    pub(crate) struct Machine {
        pub registry: Installed,
        pub plans: Rc<FakePlans>,
    }

    impl Drop for Machine {
        fn drop(&mut self) {
            set_test_plans(None);
        }
    }

    impl Machine {
        pub fn active(&self) -> String {
            self.plans.active.borrow().clone()
        }

        /// The user switching plans behind the app's back.
        pub fn switch_to(&self, scheme: &str) {
            *self.plans.active.borrow_mut() = scheme.into();
        }

        /// The user deleting a plan.
        pub fn delete_plan(&self, scheme: &str) {
            self.plans
                .known
                .borrow_mut()
                .retain(|k| !k.eq_ignore_ascii_case(scheme));
        }

        pub fn recreate_plan(&self, scheme: &str) {
            self.plans.known.borrow_mut().push(scheme.into());
        }
    }

    pub(crate) fn machine() -> Machine {
        let registry = install();
        let plans = Rc::new(FakePlans {
            registry: registry.shared(),
            active: RefCell::new(BALANCED.into()),
            known: RefCell::new(vec![
                BALANCED.into(),
                HIGH_PERFORMANCE_GUID.into(),
                POWER_SAVER.into(),
            ]),
            activations: Cell::new(0),
        });
        set_test_plans(Some(plans.clone()));
        Machine { registry, plans }
    }

    fn journaled_plan(fixture: &Fixture) -> Option<String> {
        match fixture.snapshot(TWEAK_ID) {
            Some(SnapshotEntry::PowerScheme { previous_guid }) => Some(previous_guid),
            None => None,
            Some(other) => panic!("unexpected snapshot: {other:?}"),
        }
    }

    #[test]
    fn high_performance_round_trips_to_the_exact_original_plan() {
        let machine = machine();
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        assert_eq!(machine.active(), HIGH_PERFORMANCE_GUID);
        assert_eq!(journaled_plan(&fixture).as_deref(), Some(BALANCED));
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.active(), BALANCED);
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn reapplying_after_a_plan_change_still_restores_the_first_original() {
        let machine = machine();
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        machine.switch_to(POWER_SAVER);
        apply(&fixture.store).unwrap();
        assert_eq!(machine.active(), HIGH_PERFORMANCE_GUID);
        assert_eq!(journaled_plan(&fixture).as_deref(), Some(BALANCED));
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.active(), BALANCED);
    }

    #[test]
    fn a_switch_that_does_not_stick_fails_and_keeps_the_journal() {
        let machine = machine();
        let fixture = Fixture::new();
        machine.registry.drop_writes.set(true);
        let error = apply(&fixture.store).unwrap_err();
        assert!(error.contains("could not be verified"), "{error}");
        assert_eq!(journaled_plan(&fixture).as_deref(), Some(BALANCED));
        assert_eq!(machine.active(), BALANCED);
        machine.registry.drop_writes.set(false);
        rollback(&fixture.store).unwrap();
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn a_failed_restore_keeps_the_journal_for_a_retry() {
        let machine = machine();
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        machine.delete_plan(BALANCED);
        assert!(rollback(&fixture.store).is_err());
        assert!(fixture.store.is_applied(TWEAK_ID));
        machine.recreate_plan(BALANCED);
        machine.registry.deny_writes.set(true);
        assert!(rollback(&fixture.store).is_err());
        assert!(fixture.store.is_applied(TWEAK_ID));
        assert_eq!(machine.active(), HIGH_PERFORMANCE_GUID);
        machine.registry.deny_writes.set(false);
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.active(), BALANCED);
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    /// Modern Standby machines often ship without a High performance plan.
    /// The journal is written first, as always, and rolling it back is a
    /// switch to the plan that is still active.
    #[test]
    fn a_machine_without_high_performance_is_refused_and_left_as_it_was() {
        let machine = machine();
        let fixture = Fixture::new();
        machine.delete_plan(HIGH_PERFORMANCE_GUID);
        assert!(apply(&fixture.store).is_err());
        assert_eq!(machine.active(), BALANCED);
        rollback(&fixture.store).unwrap();
        assert_eq!(machine.active(), BALANCED);
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    /// The safety net: with no fake installed, a unit test cannot switch or
    /// edit a real power plan. The GUID names no plan, so even a missing guard
    /// would fail inside Windows rather than change anything.
    #[test]
    fn unit_tests_cannot_change_the_real_power_plans() {
        if std::env::var("PC_TWEAKER_EXPANSION_VM_TEST").as_deref()
            == Ok("I_ACKNOWLEDGE_DISPOSABLE_VM")
        {
            return;
        }
        const NO_SUCH_PLAN: &str = "00000000-0000-0000-0000-00000000c0de";
        let refused = "unit tests may not";
        let error = WinPowerPlans.activate(NO_SUCH_PLAN).unwrap_err();
        assert!(error.contains(refused), "{error}");
        let error = WinPowerPlans
            .write_index(
                NO_SUCH_PLAN,
                crate::gaming::SUB_PROCESSOR_GUID,
                crate::gaming::CORE_PARKING_MIN_GUID,
                true,
                100,
            )
            .unwrap_err();
        assert!(error.contains(refused), "{error}");
    }
}
