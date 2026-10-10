//! In-memory registry and power-policy backends, and the tests that push the
//! tweak catalogue and the rollback store through them.
//!
//! Every registry-backed tweak reaches the registry through
//! `tweaks::windows_impl`, and every AC power-policy tweak through
//! `power_tuning::PowerBackend`. Installing the fakes below at those two seams
//! runs the real apply and rollback code, the real snapshot validation and the
//! real on-disk journal, without administrator rights and without touching the
//! machine. That makes it safe on a GitHub runner, which is an administrator.
//!
//! The tweaks that talk to other parts of Windows (power plans, services, DNS,
//! the TCP stack, Filter Keys, the context-menu key, Delivery Optimization)
//! have seams of their own and are tested next to their modules, on top of the
//! registry fake here. `every_visible_tweak_is_covered_by_a_seam_test_or_is_panel_only`
//! keeps that bookkeeping honest, so a new tweak cannot slip past all of them.

use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::rc::Rc;

use crate::power_tuning::{self, PowerBackend, PowerTweak};
use crate::rollback::{RegValue, RollbackStore, SnapshotEntry};
use crate::tweaks::windows_impl::{hive_str, set_test_backend};
use crate::tweaks::{self, Hive, RegistryBackend};

type Key = (&'static str, String, String);

#[derive(Clone, Debug, PartialEq)]
pub(crate) enum Stored {
    Value(RegValue),
    /// REG_BINARY, REG_MULTI_SZ and friends: present, but not restorable.
    Unsupported,
}

/// A registry that lives in a map. Paths and names compare case-insensitively,
/// as they do in Windows. Keys are implicit: writing a value creates its path.
#[derive(Default)]
pub(crate) struct MemRegistry {
    values: RefCell<BTreeMap<Key, Stored>>,
    /// Keys created on their own. A key also exists when a value or another
    /// key lives under it.
    keys: RefCell<BTreeSet<(&'static str, String)>>,
    /// Writes and deletes fail with "access denied".
    pub deny_writes: Cell<bool>,
    /// Writes and deletes report success but change nothing, the way a policy
    /// or a filter driver can silently override a value.
    pub drop_writes: Cell<bool>,
    /// Successful writes and deletes that changed something.
    pub mutations: Cell<usize>,
    /// Deletes are refused while writes still work: what Windows 11 does to
    /// an administrator under the SYSTEM-owned power scheme keys.
    pub deny_deletes: Cell<bool>,
    /// Once this many changes have succeeded, the next one is refused, once:
    /// a tweak that fails halfway through its writes.
    pub fail_after: Cell<Option<usize>>,
}

fn key(hive: Hive, path: &str, name: &str) -> Key {
    (
        hive_str(&hive),
        path.to_ascii_lowercase(),
        name.to_ascii_lowercase(),
    )
}

impl MemRegistry {
    pub fn set(&self, hive: Hive, path: &str, name: &str, value: Stored) {
        self.values.borrow_mut().insert(key(hive, path, name), value);
    }

    pub fn get(&self, hive: Hive, path: &str, name: &str) -> Option<Stored> {
        self.values.borrow().get(&key(hive, path, name)).cloned()
    }

    pub fn dump(&self) -> BTreeMap<Key, Stored> {
        self.values.borrow().clone()
    }

    /// Keys that exist, explicit or implied by what lives under them.
    pub fn has_key(&self, hive: Hive, path: &str) -> bool {
        let (hive, path) = (hive_str(&hive), path.to_ascii_lowercase());
        let under = |other: &str| other == path || other.starts_with(&format!("{path}\\"));
        self.values.borrow().keys().any(|(h, p, _)| *h == hive && under(p))
            || self.keys.borrow().iter().any(|(h, p)| *h == hive && under(p))
    }

    fn mutate(&self, change: impl FnOnce(&mut BTreeMap<Key, Stored>)) -> std::io::Result<()> {
        // One refusal, then writes work again: the next caller is the undo.
        let tripped = self.fail_after.get().is_some_and(|n| self.mutations.get() >= n);
        if tripped {
            self.fail_after.set(None);
        }
        if self.deny_writes.get() || tripped {
            return Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "access denied",
            ));
        }
        if !self.drop_writes.get() {
            change(&mut self.values.borrow_mut());
            self.mutations.set(self.mutations.get() + 1);
        }
        Ok(())
    }
}

impl RegistryBackend for MemRegistry {
    fn read(&self, hive: Hive, path: &str, name: &str) -> std::io::Result<Option<RegValue>> {
        match self.get(hive, path, name) {
            None => Ok(None),
            Some(Stored::Value(value)) => Ok(Some(value)),
            Some(Stored::Unsupported) => Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "unsupported original registry type; the value was not changed",
            )),
        }
    }

    fn write(&self, hive: Hive, path: &str, name: &str, value: &RegValue) -> std::io::Result<()> {
        let value = value.clone();
        self.mutate(|map| {
            map.insert(key(hive, path, name), Stored::Value(value));
        })
    }

    fn delete(&self, hive: Hive, path: &str, name: &str) -> std::io::Result<()> {
        if self.deny_deletes.get() {
            return Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied"));
        }
        self.mutate(|map| {
            map.remove(&key(hive, path, name));
        })
    }

    fn key_exists(&self, hive: Hive, path: &str) -> std::io::Result<bool> {
        Ok(self.has_key(hive, path))
    }

    fn create_key(&self, hive: Hive, path: &str) -> std::io::Result<()> {
        let entry = (hive_str(&hive), path.to_ascii_lowercase());
        self.mutate(|_| {})?;
        if !self.drop_writes.get() {
            self.keys.borrow_mut().insert(entry);
        }
        Ok(())
    }

    fn delete_tree(&self, hive: Hive, path: &str) -> std::io::Result<()> {
        let (h, prefix) = (hive_str(&hive), path.to_ascii_lowercase());
        let under = move |p: &str| p == prefix || p.starts_with(&format!("{prefix}\\"));
        self.mutate(|map| map.retain(|(vh, vp, _), _| !(*vh == h && under(vp))))?;
        if !self.drop_writes.get() {
            self.keys.borrow_mut().retain(|(kh, kp)| !(*kh == h && under(kp)));
        }
        Ok(())
    }

    /// Lowercase, since that is how the map stores them.
    fn names(&self, hive: Hive, path: &str) -> std::io::Result<Vec<String>> {
        let (h, path) = (hive_str(&hive), path.to_ascii_lowercase());
        let prefix = format!("{path}\\");
        // The first path component below `path`, for anything deeper.
        let child = |p: &str| {
            p.strip_prefix(&prefix)
                .and_then(|rest| rest.split('\\').next())
                .map(str::to_string)
        };
        let mut names = BTreeSet::new();
        for (vh, vp, name) in self.values.borrow().keys() {
            if *vh == h && *vp == path {
                names.insert(name.clone());
            } else if *vh == h {
                names.extend(child(vp));
            }
        }
        for (kh, kp) in self.keys.borrow().iter() {
            if *kh == h {
                names.extend(child(kp));
            }
        }
        Ok(names.into_iter().collect())
    }
}

/// Routes this thread's registry calls to a fresh `MemRegistry` until dropped.
pub(crate) struct Installed(Rc<MemRegistry>);

impl std::ops::Deref for Installed {
    type Target = MemRegistry;
    fn deref(&self) -> &MemRegistry {
        &self.0
    }
}

impl Drop for Installed {
    fn drop(&mut self) {
        set_test_backend(None);
    }
}

impl Installed {
    /// Another handle on the same registry, for a fake that stores into it
    /// (the in-memory power plans in power.rs).
    pub(crate) fn shared(&self) -> Rc<MemRegistry> {
        self.0.clone()
    }
}

pub(crate) fn install() -> Installed {
    let registry = Rc::new(MemRegistry::default());
    set_test_backend(Some(registry.clone()));
    Installed(registry)
}

/// The power-policy half: AC values per (scheme, setting) of one active plan.
pub(crate) struct MemPower {
    pub scheme: String,
    pub values: RefCell<BTreeMap<(String, String), u32>>,
    pub deny_writes: Cell<bool>,
    pub unsupported: Cell<bool>,
}

impl Default for MemPower {
    fn default() -> Self {
        MemPower {
            scheme: "381b4222-f694-41f0-9685-ff5bb260df2e".into(),
            values: RefCell::default(),
            deny_writes: Cell::new(false),
            unsupported: Cell::new(false),
        }
    }
}

impl PowerBackend for MemPower {
    fn active(&self) -> Result<String, String> {
        Ok(self.scheme.clone())
    }
    fn supported(&self, _scheme: &str, _t: &PowerTweak) -> Result<(), String> {
        if self.unsupported.get() {
            return Err("this setting is not available on this machine".into());
        }
        Ok(())
    }
    fn read_value(&self, scheme: &str, t: &PowerTweak) -> Result<u32, String> {
        // An unset override reads as the plan default, which is what
        // PowerReadACValueIndex reports too. 1 is a value every tweak accepts.
        Ok(*self
            .values
            .borrow()
            .get(&(scheme.to_ascii_lowercase(), t.setting.to_string()))
            .unwrap_or(&1))
    }
    fn write_value(&self, scheme: &str, t: &PowerTweak, value: u32) -> Result<(), String> {
        if self.deny_writes.get() {
            return Err("Windows power policy error 5".into());
        }
        self.values
            .borrow_mut()
            .insert((scheme.to_ascii_lowercase(), t.setting.to_string()), value);
        Ok(())
    }
    fn refresh_if_active(&self, _scheme: &str) -> Result<(), String> {
        Ok(())
    }
}

/// A rollback store in its own temporary directory, which doubles as an
/// app-data folder with no licence in it (so: a Free user). Shared with the
/// seam tests that live next to the modules they cover.
pub(crate) struct Fixture {
    pub(crate) dir: PathBuf,
    pub(crate) store: RollbackStore,
}

impl Fixture {
    pub(crate) fn new() -> Self {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "pct-mock-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        Fixture {
            store: RollbackStore::new(dir.clone()),
            dir,
        }
    }

    pub(crate) fn snapshot(&self, id: &str) -> Option<SnapshotEntry> {
        self.store.transaction().unwrap().entry(id)
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// Composite tweaks whose every system write is a registry value.
const REGISTRY_COMPOSITES: [&str; 5] = [
    crate::gaming::INPUT_LAG_ID,
    crate::gaming::KEYBOARD_DELAY_ID,
    crate::game_priority::TWEAK_ID,
    crate::privacy_extra::ACTIVITY_HISTORY_ID,
    crate::privacy_extra::TYPING_PERSONALIZATION_ID,
];

/// Tweaks driven through a seam of their own, with their round-trip tests
/// next to it rather than here.
const COVERED_IN_MODULE: [&str; 11] = [
    crate::power::TWEAK_ID,                           // power::tests (power plans)
    crate::turbo::TWEAK_ID,                           // turbo::tests (registry plus power plans)
    crate::gaming::TURBO_BOOST_ID,                    // gaming::tests (power plans)
    crate::gaming::CORE_PARKING_ID,                   // gaming::tests (power plans)
    crate::services::WINDOWS_SEARCH_ID,               // services::tests (service control manager)
    crate::services::AI_FABRIC_ID,                    // services::tests (service control manager)
    crate::everyday::DISABLE_FILTER_KEYS_SHORTCUT_ID, // everyday::tests (SystemParametersInfo)
    crate::contextmenu::TWEAK_ID,                     // contextmenu::tests (registry keys)
    crate::dns::TWEAK_ID,                             // dns::tests (DNS client settings)
    crate::netshaper::TWEAK_ID,                       // netshaper::tests (NetTCPSetting over WMI)
    crate::download_limit::TWEAK_ID,                  // download_limit::tests (registry plus provider state)
];

/// Visible in the list but configured in their own panels, each with its own
/// recovery journal and tests (ecoqos, monitor_profiles); the apply funnel
/// refuses them, so there is no apply/rollback pair to push through a mock.
const PANEL_ONLY: [&str; 2] = ["ecoqos_rules", "monitor_refresh_profile"];

fn registry_ids() -> Vec<&'static str> {
    let mut ids: Vec<_> = tweaks::all_tweaks()
        .into_iter()
        .map(|t| t.id)
        .filter(|id| *id != "disable_copilot")
        .collect();
    ids.extend(REGISTRY_COMPOSITES);
    ids.extend(crate::settings_tweaks::TWEAKS.iter().map(|t| t.id));
    ids
}

/// The dispatch `apply_by_id_inner` performs, minus the licence gate, so the
/// logic of Pro tweaks is covered too. The gate has its own test below.
fn apply_direct(store: &RollbackStore, id: &str) -> Result<(), String> {
    use crate::everyday;
    match id {
        crate::gaming::INPUT_LAG_ID => crate::gaming::apply_input_lag(store),
        crate::gaming::KEYBOARD_DELAY_ID => crate::gaming::apply_keyboard_delay(store),
        crate::game_priority::TWEAK_ID => crate::game_priority::apply(store),
        crate::privacy_extra::ACTIVITY_HISTORY_ID => {
            crate::privacy_extra::apply_activity_history(store)
        }
        crate::privacy_extra::TYPING_PERSONALIZATION_ID => {
            crate::privacy_extra::apply_typing_personalization(store)
        }
        everyday::DISABLE_RESTART_APPS_ID | everyday::ENABLE_LONG_PATHS_ID => {
            everyday::apply(id, store)
        }
        // The writes themselves; the build and edition gate has its own test.
        _ if crate::settings_tweaks::find(id).is_some() => {
            crate::settings_tweaks::apply_writes(store, crate::settings_tweaks::find(id).unwrap())
        }
        _ => tweaks::find_tweak(id).unwrap().apply(store),
    }
}

fn rollback_direct(store: &RollbackStore, id: &str) -> Result<(), String> {
    crate::rollback_by_id_inner(store, id)
}

/// Every registry value a tweak's snapshot covers.
fn targets(entry: &SnapshotEntry) -> Vec<(Hive, String, String)> {
    match entry {
        SnapshotEntry::Registry(s) => {
            let hive = if s.hive.eq_ignore_ascii_case("HKLM") {
                Hive::Hklm
            } else {
                Hive::Hkcu
            };
            vec![(hive, s.path.clone(), s.name.clone())]
        }
        SnapshotEntry::Composite { entries } => entries.iter().flat_map(targets).collect(),
        other => panic!("not a registry snapshot: {other:?}"),
    }
}

/// A plausible value a user could already have, of the same type the tweak
/// writes but never equal to it.
fn user_value(written: &Stored) -> Stored {
    match written {
        Stored::Value(RegValue::Dword(v)) => Stored::Value(RegValue::Dword(v.wrapping_add(7))),
        Stored::Value(RegValue::Str(s)) => Stored::Value(RegValue::Str(format!("{s}7"))),
        Stored::Unsupported => unreachable!(),
    }
}

/// Applies `id` once on an empty registry and returns what it touched and the
/// values it wrote there.
fn discover(id: &str) -> Vec<((Hive, String, String), Stored)> {
    let registry = install();
    let fixture = Fixture::new();
    apply_direct(&fixture.store, id).unwrap_or_else(|e| panic!("{id}: {e}"));
    let entry = fixture.snapshot(id).unwrap_or_else(|| panic!("{id}: no snapshot"));
    let found: Vec<_> = targets(&entry)
        .into_iter()
        .map(|(hive, path, name)| {
            let written = registry
                .get(hive, &path, &name)
                .unwrap_or_else(|| panic!("{id}: {name} was not written"));
            ((hive, path, name), written)
        })
        .collect();
    assert!(!found.is_empty(), "{id}: touched nothing");
    found
}

#[test]
fn every_registry_tweak_restores_an_absent_original_by_deleting_it() {
    for id in registry_ids() {
        let registry = install();
        let fixture = Fixture::new();
        apply_direct(&fixture.store, id).unwrap_or_else(|e| panic!("{id}: {e}"));
        assert!(fixture.store.is_applied(id), "{id}: journal missing");
        assert!(!registry.dump().is_empty(), "{id}: nothing written");
        rollback_direct(&fixture.store, id).unwrap_or_else(|e| panic!("{id}: {e}"));
        assert!(registry.dump().is_empty(), "{id}: left {:?}", registry.dump());
        assert!(!fixture.store.is_applied(id), "{id}: journal not cleared");
    }
}

#[test]
fn every_registry_tweak_puts_back_the_exact_value_the_user_had() {
    for id in registry_ids() {
        let (registry, fixture, before) = seeded(id);
        apply_direct(&fixture.store, id).unwrap_or_else(|e| panic!("{id}: {e}"));
        assert_ne!(registry.dump(), before, "{id}: nothing changed");
        rollback_direct(&fixture.store, id).unwrap_or_else(|e| panic!("{id}: {e}"));
        assert_eq!(registry.dump(), before, "{id}");
    }
}

#[test]
fn reapplying_after_drift_still_restores_the_first_original() {
    for id in registry_ids() {
        let touched = discover(id);
        let registry = install();
        let fixture = Fixture::new();
        let ((hive, path, name), written) = &touched[0];
        registry.set(*hive, path, name, user_value(written));
        let before = registry.dump();
        apply_direct(&fixture.store, id).unwrap();
        // Something else changes the value while the tweak is applied.
        registry.set(*hive, path, name, user_value(&user_value(written)));
        apply_direct(&fixture.store, id).unwrap_or_else(|e| panic!("{id}: {e}"));
        rollback_direct(&fixture.store, id).unwrap();
        assert_eq!(registry.dump(), before, "{id}");
    }
}

#[test]
fn an_original_of_an_unsupported_type_is_never_snapshotted_or_overwritten() {
    for id in registry_ids() {
        let touched = discover(id);
        let registry = install();
        let fixture = Fixture::new();
        let ((hive, path, name), _) = &touched[0];
        registry.set(*hive, path, name, Stored::Unsupported);
        let before = registry.dump();
        assert!(apply_direct(&fixture.store, id).is_err(), "{id}");
        assert!(!fixture.store.is_applied(id), "{id}: snapshot of an unreadable value");
        assert_eq!(registry.dump(), before, "{id}");
        assert_eq!(registry.mutations.get(), 0, "{id}");
    }
}

/// Seeds every target with a value the user could have had, and returns the
/// fixture along with the registry as it was before the tweak.
fn seeded(id: &str) -> (Installed, Fixture, BTreeMap<Key, Stored>) {
    let touched = discover(id);
    let registry = install();
    for ((hive, path, name), written) in &touched {
        registry.set(*hive, path, name, user_value(written));
    }
    let before = registry.dump();
    (registry, Fixture::new(), before)
}

#[test]
fn a_write_that_does_not_stick_fails_the_apply_and_keeps_the_original() {
    for id in registry_ids() {
        let (registry, fixture, before) = seeded(id);
        registry.drop_writes.set(true);
        let error = apply_direct(&fixture.store, id).unwrap_err();
        assert!(error.contains("verification failed"), "{id}: {error}");
        assert!(fixture.store.is_applied(id), "{id}: recovery data lost");
        assert_eq!(registry.dump(), before, "{id}");
        // Nothing stuck, so putting the originals back verifies at once.
        rollback_direct(&fixture.store, id).unwrap_or_else(|e| panic!("{id}: {e}"));
        assert!(!fixture.store.is_applied(id), "{id}");
    }
}

#[test]
fn a_rollback_that_does_not_stick_keeps_the_journal_for_a_retry() {
    for id in registry_ids() {
        let (registry, fixture, before) = seeded(id);
        apply_direct(&fixture.store, id).unwrap();
        registry.drop_writes.set(true);
        assert!(rollback_direct(&fixture.store, id).is_err(), "{id}");
        assert!(fixture.store.is_applied(id), "{id}: journal dropped on a failed restore");
        registry.drop_writes.set(false);
        rollback_direct(&fixture.store, id).unwrap();
        assert_eq!(registry.dump(), before, "{id}");
        assert!(!fixture.store.is_applied(id), "{id}");
    }
}

#[test]
fn a_denied_write_leaves_the_registry_untouched_and_rollback_available() {
    for id in registry_ids() {
        let registry = install();
        let fixture = Fixture::new();
        registry.deny_writes.set(true);
        assert!(apply_direct(&fixture.store, id).is_err(), "{id}");
        assert!(registry.dump().is_empty(), "{id}");
        assert!(fixture.store.is_applied(id), "{id}");
        registry.deny_writes.set(false);
        rollback_direct(&fixture.store, id).unwrap_or_else(|e| panic!("{id}: {e}"));
        assert!(registry.dump().is_empty(), "{id}");
        assert!(!fixture.store.is_applied(id), "{id}");
    }
}

#[test]
fn overlapping_tweaks_are_refused_before_their_first_write() {
    for (first, second) in [
        ("disable_mouse_acceleration", crate::gaming::INPUT_LAG_ID),
        ("games_gpu_priority", crate::game_priority::TWEAK_ID),
    ] {
        let registry = install();
        let fixture = Fixture::new();
        apply_direct(&fixture.store, first).unwrap();
        let after_first = registry.dump();
        let writes = registry.mutations.get();
        let error = apply_direct(&fixture.store, second).unwrap_err();
        assert!(error.contains("overlaps"), "{second}: {error}");
        assert_eq!(registry.mutations.get(), writes, "{second} wrote before refusing");
        assert_eq!(registry.dump(), after_first);
        assert!(!fixture.store.is_applied(second));
        rollback_direct(&fixture.store, first).unwrap();
        assert!(registry.dump().is_empty(), "{first}");
    }
}

/// The licence gate in the real funnel: a Free user gets every free tweak and
/// round-trips it; every Pro tweak is refused before anything is written.
#[test]
fn the_apply_funnel_lets_free_tweaks_through_and_stops_pro_ones_before_writing() {
    let mut free = 0;
    let mut pro = 0;
    for id in registry_ids() {
        let registry = install();
        let fixture = Fixture::new();
        let result = crate::apply_by_id_inner(&fixture.store, &fixture.dir, id);
        if crate::requires_pro_for(id) {
            pro += 1;
            let error = result.unwrap_err();
            assert!(error.starts_with(crate::PRO_REQUIRED_PREFIX), "{id}: {error}");
            assert_eq!(registry.mutations.get(), 0, "{id} wrote before the gate");
            assert!(!fixture.store.is_applied(id));
        } else {
            free += 1;
            result.unwrap_or_else(|e| panic!("{id}: {e}"));
            crate::rollback_by_id_inner(&fixture.store, id).unwrap();
            assert!(registry.dump().is_empty(), "{id}");
        }
    }
    assert!(free > 0 && pro > 0, "free {free}, pro {pro}");
}

#[test]
fn the_adapter_latency_tweak_round_trips_on_a_given_interface() {
    const GUID: &str = "{4d36e972-e325-11ce-bfc1-08002be10318}";
    let registry = install();
    let fixture = Fixture::new();
    crate::netlatency::apply_for_interface(&fixture.store, GUID).unwrap();
    let path = format!(r"{}\{GUID}", crate::netlatency::INTERFACES_PATH);
    for name in crate::netlatency::VALUES {
        assert_eq!(
            registry.get(Hive::Hklm, &path, name),
            Some(Stored::Value(RegValue::Dword(1)))
        );
    }
    // The internet adapter changed since: the old one is put back and the
    // tweak moves, in one transaction, so a profile re-apply keeps working.
    let other = "{4d36e972-e325-11ce-bfc1-08002be10319}";
    crate::netlatency::apply_for_interface(&fixture.store, other).unwrap();
    let moved = format!(r"{}\{other}", crate::netlatency::INTERFACES_PATH);
    for name in crate::netlatency::VALUES {
        assert_eq!(registry.get(Hive::Hklm, &path, name), None, "old adapter restored");
        assert_eq!(
            registry.get(Hive::Hklm, &moved, name),
            Some(Stored::Value(RegValue::Dword(1)))
        );
    }
    crate::netlatency::rollback(&fixture.store).unwrap();
    assert!(registry.dump().is_empty());
}

#[test]
fn every_power_policy_tweak_round_trips_and_keeps_its_journal_on_failure() {
    for tweak in power_tuning::TWEAKS.iter() {
        let power = MemPower::default();
        let fixture = Fixture::new();
        let key = (power.scheme.clone(), tweak.setting.to_string());
        power.values.borrow_mut().insert(key.clone(), tweak.maximum);
        power_tuning::apply_with(&fixture.store, tweak, &power).unwrap();
        assert_eq!(power.values.borrow()[&key], tweak.value, "{}", tweak.id);
        power.deny_writes.set(true);
        assert!(power_tuning::restore_with(&fixture.store, tweak, &power).is_err());
        assert!(fixture.store.is_applied(tweak.id), "{}", tweak.id);
        power.deny_writes.set(false);
        power_tuning::restore_with(&fixture.store, tweak, &power).unwrap();
        assert_eq!(power.values.borrow()[&key], tweak.maximum, "{}", tweak.id);
        assert!(!fixture.store.is_applied(tweak.id), "{}", tweak.id);

        power.unsupported.set(true);
        assert!(power_tuning::apply_with(&fixture.store, tweak, &power).is_err());
        assert!(!fixture.store.is_applied(tweak.id), "{}", tweak.id);
    }
}

/// The delete-then-verify half of restore: a value that was absent before
/// and will not go away (a policy re-applying it, a filter driver) must keep
/// the journal, whether it lingers as itself or as an unreadable type.
#[test]
fn a_value_that_survives_its_delete_keeps_the_journal() {
    for id in registry_ids() {
        for lingering in [None, Some(Stored::Unsupported)] {
            let registry = install();
            let fixture = Fixture::new();
            apply_direct(&fixture.store, id).unwrap();
            if let Some(value) = &lingering {
                let entry = fixture.snapshot(id).unwrap();
                let (hive, path, name) = targets(&entry).remove(0);
                registry.set(hive, &path, &name, value.clone());
            }
            registry.drop_writes.set(true);
            let error = rollback_direct(&fixture.store, id).unwrap_err();
            assert!(error.contains("still exists"), "{id}: {error}");
            assert!(fixture.store.is_applied(id), "{id}");
            registry.drop_writes.set(false);
            rollback_direct(&fixture.store, id).unwrap();
            assert!(registry.dump().is_empty(), "{id}");
        }
    }
}

/// Keeps the coverage claim honest: everything the UI lists is either pushed
/// through a mock above or named in `OS_ONLY` with the reason it cannot be.
#[test]
fn every_visible_tweak_is_covered_by_a_seam_test_or_is_panel_only() {
    let mut covered: Vec<&str> = registry_ids();
    covered.push(crate::netlatency::TWEAK_ID);
    covered.extend(power_tuning::TWEAKS.iter().map(|t| t.id));
    covered.extend(COVERED_IN_MODULE);
    covered.extend(PANEL_ONLY);
    let mut visible = crate::tests::all_visible_ids();
    visible.sort();
    covered.sort();
    assert_eq!(covered, visible);
}

/// The safety net itself: with no mock installed, a unit test cannot write
/// the real registry even on an administrator's machine.
#[test]
fn unit_tests_cannot_write_the_real_registry() {
    // Skipped only where the guard itself is off: the disposable VM.
    if std::env::var("PC_TWEAKER_EXPANSION_VM_TEST").as_deref() == Ok("I_ACKNOWLEDGE_DISPOSABLE_VM") {
        return;
    }
    use crate::tweaks::windows_impl::WinRegistry;
    let error = WinRegistry
        .write(
            Hive::Hkcu,
            r"Software\PC Tweaker Unit Test",
            "Refused",
            &RegValue::Dword(1),
        )
        .unwrap_err();
    assert_eq!(error.kind(), std::io::ErrorKind::PermissionDenied);
    assert!(WinRegistry
        .delete(Hive::Hkcu, r"Software\PC Tweaker Unit Test", "Refused")
        .is_err());
}

/// A tweak that fails after some of its values were written is undone at
/// once by the apply funnel: the registry is exactly as it was and no journal
/// is left behind.
#[test]
fn a_tweak_that_fails_halfway_is_rolled_back_automatically() {
    let multi: Vec<_> = crate::settings_tweaks::TWEAKS
        .iter()
        .filter(|t| t.writes.len() > 1 && !t.requires_pro)
        .collect();
    assert!(!multi.is_empty(), "test needs a free multi-value tweak");
    for tweak in multi {
        let (registry, fixture, before) = seeded(tweak.id);
        registry.fail_after.set(Some(1));
        let error = crate::apply_or_undo(&fixture.store, &fixture.dir, tweak.id).unwrap_err();
        assert!(error.contains("undone automatically"), "{}: {error}", tweak.id);
        assert_eq!(registry.dump(), before, "{}: not restored", tweak.id);
        assert!(!fixture.store.is_applied(tweak.id), "{}: journal left", tweak.id);
    }
}

/// A tweak that was already applied before a failed re-apply is left exactly
/// as the user had it.
#[test]
fn a_failed_reapply_does_not_undo_what_the_user_already_had() {
    let tweak = crate::settings_tweaks::find("disable_game_bar_captures").unwrap();
    let registry = install();
    let fixture = Fixture::new();
    crate::apply_or_undo(&fixture.store, &fixture.dir, tweak.id).unwrap();
    let applied = registry.dump();
    registry.deny_writes.set(true);
    assert!(crate::apply_or_undo(&fixture.store, &fixture.dir, tweak.id).is_err());
    assert_eq!(registry.dump(), applied);
    assert!(fixture.store.is_applied(tweak.id));
}

/// The dry run reads the live values and changes nothing.
#[test]
fn the_preview_reads_current_values_without_writing() {
    let tweak = crate::settings_tweaks::find("disable_game_bar_captures").unwrap();
    let registry = install();
    registry.set(
        Hive::Hkcu,
        tweak.writes[0].path,
        tweak.writes[0].name,
        Stored::Value(RegValue::Dword(1)),
    );
    let fixture = Fixture::new();
    let preview = crate::preview_for(&fixture.store, tweak.id).unwrap();
    assert_eq!(registry.mutations.get(), 0);
    assert_eq!(preview.rows.len(), tweak.writes.len());
    assert_eq!(preview.rows[0].current.as_deref(), Some("1 (0x1)"));
    assert!(preview.rows[0].changes);
    assert_eq!(preview.rows[1].current, None, "an absent value reads as not set");
    assert!(preview.will_change);
    assert!(!preview.applied);
}
