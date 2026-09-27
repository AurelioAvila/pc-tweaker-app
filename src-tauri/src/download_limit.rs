//! Reversible Delivery Optimization background-download policy (KB/s).
use crate::rollback::{RegValue, RollbackStore, SnapshotEntry};
use crate::tweaks::{windows_impl as registry, Hive};
use serde::{Deserialize, Serialize};

pub const TWEAK_ID: &str = "limit_do_background_download";
pub const PATH: &str = r"SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization";
pub const VALUE: &str = "DOMaxBackgroundDownloadBandwidth";
const MAX_KBPS: u32 = 1_000_000;
const POLICY_MANAGER: &str =
    r"SOFTWARE\Microsoft\PolicyManager\current\device\DeliveryOptimization";
const VERSION_PATH: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadLimitState {
    pub supported: bool,
    pub configured_kbps: Option<u32>,
    pub provider: String,
    pub applied: bool,
    pub conflict: Option<String>,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "PascalCase")]
pub(crate) struct DoConfig {
    down_back_limit_bps_provider: String,
    down_back_limit_pct_provider: String,
    set_hours_to_limit_download_background_provider: String,
}

/// Everything besides the policy value that decides whether the cap may be
/// written or taken back.
pub(crate) struct Environment {
    /// The provider behind each background limit, or `None` on an edition or
    /// build that ignores the policy (Get-DOConfig is not asked there).
    pub config: Option<DoConfig>,
    /// An MDM or other management channel sets background bandwidth.
    pub managed: bool,
}

/// The system reads this control depends on. Production uses
/// `WinEnvironment`; unit tests install a fake with `set_test_environment`,
/// the same way `tweaks::windows_impl` swaps the registry.
pub(crate) trait DoEnvironment {
    fn elevated(&self) -> bool;
    fn read(&self) -> Result<Environment, String>;
}

/// The real machine. It only reads: the one system write, the policy value,
/// goes through the registry seam.
struct WinEnvironment;

impl DoEnvironment for WinEnvironment {
    fn elevated(&self) -> bool {
        crate::elevation::is_elevated()
    }

    fn read(&self) -> Result<Environment, String> {
        let supported = supported_edition()?;
        let managed = managed_background_policy()?;
        let config = if supported { Some(config()?) } else { None };
        Ok(Environment { config, managed })
    }
}

#[cfg(test)]
thread_local! {
    static TEST_ENVIRONMENT: std::cell::RefCell<Option<std::rc::Rc<dyn DoEnvironment>>> =
        const { std::cell::RefCell::new(None) };
}

/// Routes this thread's environment reads to `environment` (test builds only).
#[cfg(test)]
pub(crate) fn set_test_environment(environment: Option<std::rc::Rc<dyn DoEnvironment>>) {
    TEST_ENVIRONMENT.with(|slot| *slot.borrow_mut() = environment);
}

fn with_environment<T>(f: impl FnOnce(&dyn DoEnvironment) -> T) -> T {
    #[cfg(test)]
    if let Some(environment) = TEST_ENVIRONMENT.with(|slot| slot.borrow().clone()) {
        return f(&*environment);
    }
    f(&WinEnvironment)
}

fn supported_edition() -> Result<bool, String> {
    let text = |name: &str| {
        match registry::read_value(Hive::Hklm, VERSION_PATH, name, &RegValue::Str(String::new())) {
            Ok(Some(RegValue::Str(value))) => Ok(value),
            Ok(_) => Err(format!("could not read Windows edition: {name} is missing or not text")),
            Err(e) => Err(format!("could not read Windows edition: {e}")),
        }
    };
    let build = text("CurrentBuildNumber")?;
    let edition = text("EditionID")?;
    let installation = text("InstallationType")?;
    let supported_name = ["Professional", "Enterprise", "Education", "IoTEnterprise"]
        .iter()
        .any(|prefix| edition.starts_with(prefix));
    Ok(installation == "Client"
        && build.parse::<u32>().map_err(|e| e.to_string())? >= 19_041
        && supported_name)
}

/// Delivery Optimization has no documented native API for the provider behind
/// each limit, so this still asks its own cmdlet, the documented way to read it.
fn config() -> Result<DoConfig, String> {
    const SCRIPT: &str = "$ErrorActionPreference='Stop'; $c=Get-DOConfig -Verbose 4>$null; if ($null -eq $c) { throw 'Delivery Optimization returned no configuration' }; [pscustomobject]@{ DownBackLimitBpsProvider=[string]$c.DownBackLimitBpsProvider; DownBackLimitPctProvider=[string]$c.DownBackLimitPctProvider; SetHoursToLimitDownloadBackgroundProvider=[string]$c.SetHoursToLimitDownloadBackgroundProvider } | ConvertTo-Json -Compress";
    let output = crate::system_tools::run("powershell", |tool| {
        tool.args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
            .output()
    })
    .map_err(|e| format!("could not inspect Delivery Optimization: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "could not inspect Delivery Optimization: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("invalid Delivery Optimization configuration: {e}"))
}

fn managed_name(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    [
        "domaxbackgrounddownloadbandwidth",
        "dopercentagemaxbackgroundbandwidth",
        "dosethourstolimitbackgrounddownloadbandwidth",
        "domaxdownloadbandwidth",
        "dopercentagemaxdownloadbandwidth",
    ]
    .iter()
    .any(|target| name.starts_with(target))
}

fn managed_background_policy() -> Result<bool, String> {
    let names = registry::names(Hive::Hklm, POLICY_MANAGER)
        .map_err(|e| format!("could not inspect managed Delivery Optimization policy: {e}"))?;
    Ok(names.iter().any(|name| managed_name(name)))
}

fn conflict(
    config: &DoConfig,
    applied: bool,
    configured: Option<u32>,
    written: Option<u32>,
    managed: bool,
) -> Option<String> {
    if managed {
        return Some(
            "Delivery Optimization background bandwidth is managed by an organization".into(),
        );
    }
    if config.down_back_limit_pct_provider != "DefaultProvider"
        || config.set_hours_to_limit_download_background_provider != "DefaultProvider"
    {
        return Some("Another background percentage or schedule limit is active; review it before setting an absolute cap".into());
    }
    if applied {
        if configured != written {
            return Some("The Delivery Optimization policy changed outside PC Tweaker; the saved original is retained".into());
        }
        if !["DefaultProvider", "GroupPolicyProvider", "MdmProvider"]
            .contains(&config.down_back_limit_bps_provider.as_str())
        {
            return Some("Delivery Optimization is controlled by another provider".into());
        }
    } else if configured.is_some() || config.down_back_limit_bps_provider != "DefaultProvider" {
        return Some("A Delivery Optimization background limit is already configured by Windows or an administrator".into());
    }
    None
}

pub fn state(store: &RollbackStore) -> Result<DownloadLimitState, String> {
    let entry = store.transaction()?.entry(TWEAK_ID);
    let written = match entry {
        Some(SnapshotEntry::DeliveryOptimization { written_kbps, .. }) => Some(written_kbps),
        None => None,
        _ => return Err("unexpected Delivery Optimization snapshot".into()),
    };
    let configured = registry::read_dword(Hive::Hklm, PATH, VALUE).map_err(|e| e.to_string())?;
    let environment = with_environment(|e| e.read())?;
    let Some(config) = environment.config else {
        return Ok(DownloadLimitState {
            supported: false, configured_kbps: configured, provider: "Unavailable".into(),
            applied: written.is_some(),
            conflict: Some("This control requires Windows 10 build 19041 or later, Pro, Enterprise, Education or IoT Enterprise".into()),
        });
    };
    let issue = conflict(
        &config,
        written.is_some(),
        configured,
        written,
        environment.managed,
    );
    Ok(DownloadLimitState {
        supported: true,
        configured_kbps: configured,
        provider: config.down_back_limit_bps_provider,
        applied: written.is_some(),
        conflict: issue,
    })
}

/// Writes only an otherwise-unset, unmanaged policy. An active cap must be
/// restored before setting a different value, preserving the original journal.
pub fn configure(store: &RollbackStore, kbps: u32) -> Result<DownloadLimitState, String> {
    if !(1..=MAX_KBPS).contains(&kbps) {
        return Err(format!("cap must be 1..={MAX_KBPS} KB/s"));
    }
    if !with_environment(|e| e.elevated()) {
        return Err("administrator rights are required to configure Delivery Optimization".into());
    }
    let current = state(store)?;
    if !current.supported {
        return Err(current
            .conflict
            .unwrap_or_else(|| "unsupported Windows edition".into()));
    }
    if current.applied {
        return Err("restore the current cap before setting a different value".into());
    }
    if let Some(issue) = current.conflict {
        return Err(issue);
    }
    let mut transaction = store.transaction()?;
    // Recheck under the rollback lock before writing. Existing policy is never overwritten.
    if registry::read_dword(Hive::Hklm, PATH, VALUE)
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("a Delivery Optimization policy appeared during configuration".into());
    }
    let environment = with_environment(|e| e.read())?;
    let Some(checked) = environment.config else {
        return Err("unsupported Windows edition".into());
    };
    if let Some(issue) = conflict(&checked, false, None, None, environment.managed) {
        return Err(issue);
    }
    transaction.save_entry(
        TWEAK_ID,
        SnapshotEntry::DeliveryOptimization {
            original_value: None,
            original_provider: checked.down_back_limit_bps_provider,
            original_percent_provider: checked.down_back_limit_pct_provider,
            original_schedule_provider: checked.set_hours_to_limit_download_background_provider,
            written_kbps: kbps,
        },
    )?;
    registry::write_dword(Hive::Hklm, PATH, VALUE, kbps)?;
    drop(transaction);
    state(store)
}

pub fn rollback(store: &RollbackStore) -> Result<DownloadLimitState, String> {
    if !with_environment(|e| e.elevated()) {
        return Err("administrator rights are required to restore Delivery Optimization".into());
    }
    store.restore_entry(TWEAK_ID, |entry| {
        let SnapshotEntry::DeliveryOptimization { original_value, written_kbps, .. } = entry else {
            return Err("unexpected Delivery Optimization snapshot".into());
        };
        let current = registry::read_dword(Hive::Hklm, PATH, VALUE).map_err(|e| e.to_string())?;
        if current == original_value {
            return Ok(());
        }
        if current != Some(written_kbps) {
            return Err("Delivery Optimization policy changed outside PC Tweaker; original snapshot retained".into());
        }
        let live = with_environment(|e| e.read())?;
        let changed = match &live.config {
            Some(config) => {
                conflict(config, true, current, Some(written_kbps), live.managed).is_some()
            }
            // An edition that ignores the policy has no provider to compare:
            // only the value PC Tweaker wrote, checked above, is removed.
            None => live.managed,
        };
        if changed {
            return Err("Delivery Optimization provider changed; original snapshot retained".into());
        }
        registry::restore_value(&crate::rollback::RegistrySnapshot {
            hive: "HKLM".into(), path: PATH.into(), name: VALUE.into(),
            original_value: original_value.map(crate::rollback::RegValue::Dword),
        })
    })?;
    state(store)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::mock_registry::{install, Installed, Stored};
    use crate::tweaks::RegistryBackend;
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;

    fn defaults() -> DoConfig {
        DoConfig {
            down_back_limit_bps_provider: "DefaultProvider".into(),
            down_back_limit_pct_provider: "DefaultProvider".into(),
            set_hours_to_limit_download_background_provider: "DefaultProvider".into(),
        }
    }

    /// What Windows reports around the policy, set per test.
    struct FakeEnvironment {
        elevated: Cell<bool>,
        config: RefCell<Option<DoConfig>>,
        managed: Cell<bool>,
        /// How often the environment was read (Get-DOConfig in production).
        reads: Cell<usize>,
    }

    impl DoEnvironment for FakeEnvironment {
        fn elevated(&self) -> bool {
            self.elevated.get()
        }
        fn read(&self) -> Result<Environment, String> {
            self.reads.set(self.reads.get() + 1);
            Ok(Environment {
                config: self.config.borrow().clone(),
                managed: self.managed.get(),
            })
        }
    }

    /// A supported, unmanaged, elevated machine with an empty in-memory
    /// registry and a journal in its own temporary directory.
    struct Machine {
        registry: Installed,
        environment: Rc<FakeEnvironment>,
        dir: std::path::PathBuf,
        store: RollbackStore,
    }

    impl Machine {
        fn new() -> Self {
            static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let dir = std::env::temp_dir().join(format!(
                "pct-do-seam-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            ));
            let environment = Rc::new(FakeEnvironment {
                elevated: Cell::new(true),
                config: RefCell::new(Some(defaults())),
                managed: Cell::new(false),
                reads: Cell::new(0),
            });
            set_test_environment(Some(environment.clone()));
            Machine {
                registry: install(),
                environment,
                store: RollbackStore::new(dir.clone()),
                dir,
            }
        }

        fn policy(&self) -> Option<Stored> {
            self.registry.get(Hive::Hklm, PATH, VALUE)
        }

        fn journal(&self) -> Option<serde_json::Value> {
            let entry = self.store.transaction().unwrap().entry(TWEAK_ID)?;
            Some(serde_json::to_value(entry).unwrap())
        }

        fn provider(&self, set: impl FnOnce(&mut DoConfig)) {
            set(self.environment.config.borrow_mut().as_mut().unwrap());
        }
    }

    impl Drop for Machine {
        fn drop(&mut self) {
            set_test_environment(None);
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    const CAP: Option<Stored> = Some(Stored::Value(RegValue::Dword(500)));

    #[test]
    fn a_cap_round_trips_to_the_exact_registry_it_found() {
        let m = Machine::new();
        // A neighbouring policy the cap must neither take nor leave behind.
        m.registry.set(Hive::Hklm, PATH, "DODownloadMode", Stored::Value(RegValue::Dword(1)));
        let before = m.registry.dump();
        let applied = configure(&m.store, 500).unwrap();
        assert!(applied.supported && applied.applied && applied.conflict.is_none(), "{applied:?}");
        assert_eq!(applied.configured_kbps, Some(500));
        assert_eq!(m.policy(), CAP);
        let journal = m.journal().unwrap();
        assert_eq!(journal["original_value"], serde_json::Value::Null);
        assert_eq!(journal["written_kbps"], 500);
        // Windows reports the policy as its provider once it is in force.
        m.provider(|c| c.down_back_limit_bps_provider = "GroupPolicyProvider".into());
        let restored = rollback(&m.store).unwrap();
        assert!(!restored.applied && restored.configured_kbps.is_none(), "{restored:?}");
        assert_eq!(m.registry.dump(), before);
        assert!(m.journal().is_none());
    }

    #[test]
    fn configuring_again_is_refused_and_keeps_the_first_original() {
        let m = Machine::new();
        configure(&m.store, 500).unwrap();
        let journal = m.journal();
        let error = configure(&m.store, 800).unwrap_err();
        assert!(error.contains("restore the current cap"), "{error}");
        assert_eq!(m.policy(), CAP);
        assert_eq!(m.journal(), journal);
        rollback(&m.store).unwrap();
        assert!(m.registry.dump().is_empty());
    }

    /// Each reason not to write is reported by `state` and refused by
    /// `configure` before the journal or the registry is touched.
    #[test]
    fn every_conflict_is_refused_before_anything_is_written() {
        type Setup = fn(&Machine);
        let cases: [(&str, Setup); 5] = [
            ("already configured", |m| {
                m.registry.set(Hive::Hklm, PATH, VALUE, Stored::Value(RegValue::Dword(300)))
            }),
            ("already configured", |m| {
                m.provider(|c| c.down_back_limit_bps_provider = "MdmProvider".into())
            }),
            ("percentage or schedule", |m| {
                m.provider(|c| c.down_back_limit_pct_provider = "SettingsProvider".into())
            }),
            ("percentage or schedule", |m| {
                m.provider(|c| {
                    c.set_hours_to_limit_download_background_provider = "GroupPolicyProvider".into()
                })
            }),
            ("managed by an organization", |m| m.environment.managed.set(true)),
        ];
        for (expected, setup) in cases {
            let m = Machine::new();
            setup(&m);
            let before = m.registry.dump();
            let reported = state(&m.store).unwrap().conflict.unwrap_or_default();
            assert!(reported.contains(expected), "{expected}: {reported}");
            let error = configure(&m.store, 500).unwrap_err();
            assert!(error.contains(expected), "{expected}: {error}");
            assert!(m.journal().is_none(), "{expected}");
            assert_eq!(m.registry.dump(), before, "{expected}");
            assert_eq!(m.registry.mutations.get(), 0, "{expected}");
        }
    }

    #[test]
    fn an_unsupported_edition_is_reported_and_refused() {
        let m = Machine::new();
        *m.environment.config.borrow_mut() = None;
        let reported = state(&m.store).unwrap();
        assert!(!reported.supported && !reported.applied, "{reported:?}");
        assert!(reported.conflict.unwrap().contains("19041"));
        assert!(configure(&m.store, 500).unwrap_err().contains("19041"));
        assert!(m.journal().is_none());
        assert_eq!(m.registry.mutations.get(), 0);
    }

    #[test]
    fn a_standard_user_is_refused_before_anything_is_read_or_written() {
        let m = Machine::new();
        m.environment.elevated.set(false);
        assert!(configure(&m.store, 500).unwrap_err().contains("administrator"));
        assert!(m.journal().is_none());
        assert_eq!(m.environment.reads.get(), 0, "read before the elevation check");
        m.environment.elevated.set(true);
        configure(&m.store, 500).unwrap();
        m.environment.elevated.set(false);
        let reads = m.environment.reads.get();
        assert!(rollback(&m.store).unwrap_err().contains("administrator"));
        assert_eq!(m.environment.reads.get(), reads, "read before the elevation check");
        assert_eq!(m.policy(), CAP);
        assert!(m.journal().is_some());
    }

    #[test]
    fn a_cap_outside_the_accepted_range_is_refused() {
        let m = Machine::new();
        for kbps in [0, MAX_KBPS + 1] {
            assert!(configure(&m.store, kbps).is_err(), "{kbps}");
        }
        assert!(m.journal().is_none());
        assert_eq!(m.registry.mutations.get(), 0);
    }

    #[test]
    fn a_write_that_does_not_stick_fails_and_keeps_the_journal() {
        let m = Machine::new();
        m.registry.drop_writes.set(true);
        let error = configure(&m.store, 500).unwrap_err();
        assert!(error.contains("verification failed"), "{error}");
        assert!(m.journal().is_some(), "recovery data lost");
        assert_eq!(m.policy(), None);
        // Nothing stuck, so the restore finds the original already in place.
        m.registry.drop_writes.set(false);
        rollback(&m.store).unwrap();
        assert!(m.journal().is_none());
        assert_eq!(m.registry.mutations.get(), 0);
    }

    #[test]
    fn a_restore_that_does_not_stick_keeps_the_journal_for_a_retry() {
        let m = Machine::new();
        configure(&m.store, 500).unwrap();
        m.registry.drop_writes.set(true);
        let error = rollback(&m.store).unwrap_err();
        assert!(error.contains("still exists"), "{error}");
        assert!(m.journal().is_some());
        m.registry.drop_writes.set(false);
        m.registry.deny_writes.set(true);
        assert!(rollback(&m.store).is_err());
        assert!(m.journal().is_some());
        m.registry.deny_writes.set(false);
        rollback(&m.store).unwrap();
        assert!(m.registry.dump().is_empty());
        assert!(m.journal().is_none());
    }

    /// A value or provider that moved since the cap was written is left
    /// alone, and the original stays on disk.
    #[test]
    fn a_restore_refuses_a_policy_that_changed_under_it() {
        type Drift = fn(&Machine);
        let cases: [(&str, Drift); 3] = [
            ("changed outside PC Tweaker", |m| {
                m.registry.set(Hive::Hklm, PATH, VALUE, Stored::Value(RegValue::Dword(700)))
            }),
            ("provider changed", |m| {
                m.provider(|c| c.down_back_limit_bps_provider = "SettingsProvider".into())
            }),
            ("provider changed", |m| m.environment.managed.set(true)),
        ];
        for (expected, drift) in cases {
            let m = Machine::new();
            configure(&m.store, 500).unwrap();
            let journal = m.journal();
            drift(&m);
            let before = m.registry.dump();
            let error = rollback(&m.store).unwrap_err();
            assert!(error.contains(expected), "{expected}: {error}");
            assert_eq!(m.journal(), journal, "{expected}");
            assert_eq!(m.registry.dump(), before, "{expected}");
        }
    }

    #[test]
    fn a_cap_someone_else_removed_restores_without_writing() {
        let m = Machine::new();
        configure(&m.store, 500).unwrap();
        m.registry.delete(Hive::Hklm, PATH, VALUE).unwrap();
        let writes = m.registry.mutations.get();
        // Absent is the original, so there is nothing to put back.
        rollback(&m.store).unwrap();
        assert_eq!(m.registry.mutations.get(), writes);
        assert!(m.journal().is_none());
    }

    /// An edition that stops honouring the policy still lets the value PC
    /// Tweaker wrote come back out.
    #[test]
    fn an_edition_that_stopped_honouring_the_policy_can_still_restore() {
        let m = Machine::new();
        configure(&m.store, 500).unwrap();
        *m.environment.config.borrow_mut() = None;
        let restored = rollback(&m.store).unwrap();
        assert!(!restored.supported && !restored.applied);
        assert_eq!(m.policy(), None);
    }

    /// Restore All reaches the panel's journal through the shared funnel,
    /// and the generic apply path never writes a default cap.
    #[test]
    fn the_shared_funnel_restores_it_and_never_applies_it() {
        let m = Machine::new();
        let refused = crate::apply_by_id_inner(&m.store, &m.dir, TWEAK_ID).unwrap_err();
        // The panel-only refusal itself, not the licence gate behind it.
        assert!(refused.contains("dedicated panel"), "{refused}");
        assert!(!refused.starts_with(crate::PRO_REQUIRED_PREFIX));
        assert!(m.journal().is_none());
        assert_eq!(m.registry.mutations.get(), 0);
        configure(&m.store, 500).unwrap();
        crate::rollback_by_id_inner(&m.store, TWEAK_ID).unwrap();
        assert!(m.registry.dump().is_empty());
        assert!(m.journal().is_none());
    }

    /// The real reader's registry half, on the in-memory registry. An
    /// unsupported edition returns before Get-DOConfig would be asked.
    #[test]
    fn the_real_reader_takes_edition_and_management_from_the_registry() {
        let registry = install();
        let edition = |build: &str, edition: &str, installation: &str| {
            for (name, value) in [
                ("CurrentBuildNumber", build),
                ("EditionID", edition),
                ("InstallationType", installation),
            ] {
                registry.set(Hive::Hklm, VERSION_PATH, name, Stored::Value(RegValue::Str(value.into())));
            }
            supported_edition().unwrap()
        };
        assert!(supported_edition().is_err(), "a missing edition is an error, not a no");
        assert!(edition("19041", "Professional", "Client"));
        assert!(edition("26200", "EnterpriseS", "Client"));
        assert!(edition("22631", "IoTEnterprise", "Client"));
        assert!(!edition("18363", "Professional", "Client"));
        assert!(!edition("26200", "Core", "Client"));
        assert!(!edition("26100", "ServerStandard", "Server"));

        assert!(!managed_background_policy().unwrap());
        registry.set(Hive::Hklm, POLICY_MANAGER, "DODownloadMode", Stored::Value(RegValue::Dword(1)));
        assert!(!managed_background_policy().unwrap());
        registry.create_key(Hive::Hklm, &format!(r"{POLICY_MANAGER}\DOPercentageMaxBackgroundBandwidth")).unwrap();
        assert!(managed_background_policy().unwrap(), "a subkey counts");
        registry.delete_tree(Hive::Hklm, POLICY_MANAGER).unwrap();
        registry.set(
            Hive::Hklm,
            POLICY_MANAGER,
            "DOMaxBackgroundDownloadBandwidth_ProviderSet",
            Stored::Value(RegValue::Dword(1)),
        );
        let environment = WinEnvironment.read().unwrap();
        assert!(environment.managed && environment.config.is_none());
    }

    #[test]
    fn unmanaged_cap_only_when_all_background_providers_are_default() {
        let mut config = DoConfig {
            down_back_limit_bps_provider: "DefaultProvider".into(),
            down_back_limit_pct_provider: "DefaultProvider".into(),
            set_hours_to_limit_download_background_provider: "DefaultProvider".into(),
        };
        assert!(conflict(&config, false, None, None, false).is_none());
        config.down_back_limit_pct_provider = "SettingsProvider".into();
        assert!(conflict(&config, false, None, None, false).is_some());
        config.down_back_limit_pct_provider = "DefaultProvider".into();
        assert!(conflict(&config, true, Some(501), Some(500), false).is_some());
        config.down_back_limit_bps_provider = "MdmProvider".into();
        assert!(conflict(&config, true, Some(500), Some(500), false).is_none());
        assert!(conflict(&config, true, Some(500), Some(500), true).is_some());
        assert!(conflict(&config, false, None, None, false).is_some());
        assert!(managed_name("DOMaxBackgroundDownloadBandwidth_ProviderSet"));
        assert!(managed_name(
            "DOSetHoursToLimitBackgroundDownloadBandwidth_From"
        ));
        assert!(!managed_name("DODownloadMode"));

        let journal = SnapshotEntry::DeliveryOptimization {
            original_value: None,
            original_provider: "DefaultProvider".into(),
            original_percent_provider: "DefaultProvider".into(),
            original_schedule_provider: "DefaultProvider".into(),
            written_kbps: 500,
        };
        assert!(crate::rollback::validate_snapshot(TWEAK_ID, &journal).is_ok());
        let forged = SnapshotEntry::DeliveryOptimization {
            original_value: Some(10),
            original_provider: "MdmProvider".into(),
            original_percent_provider: "DefaultProvider".into(),
            original_schedule_provider: "DefaultProvider".into(),
            written_kbps: 500,
        };
        assert!(crate::rollback::validate_snapshot(TWEAK_ID, &forged).is_err());
    }

    #[test]
    #[ignore = "Delivery Optimization policy mutation on disposable DEBLOAT-QA VM only"]
    fn vm_policy_apply_readback_restore() {
        crate::everyday::tests::vm_guard(true);
        let store = RollbackStore::new(
            std::env::temp_dir().join(format!("pct-expansion-do-{}", std::process::id())),
        );
        let before = state(&store).expect("VM DO state");
        assert!(
            before.supported && !before.applied && before.conflict.is_none(),
            "VM DO is already configured: {before:?}"
        );
        let applied = configure(&store, 500);
        if store.is_applied(TWEAK_ID) {
            let restored = rollback(&store).expect("VM DO restore");
            assert!(!restored.applied);
            assert_eq!(registry::read_dword(Hive::Hklm, PATH, VALUE).unwrap(), None);
        }
        let applied = applied.expect("VM DO policy write/readback");
        assert!(applied.applied);
        assert_eq!(applied.configured_kbps, Some(500));
        eprintln!("DO provider after policy write: {}", applied.provider);
    }

    #[test]
    #[ignore = "recover a prior owned DO policy on disposable DEBLOAT-QA VM only"]
    fn vm_recover_prior_owned_policy() {
        crate::everyday::tests::vm_guard(true);
        let name = std::env::var("PC_TWEAKER_EXPANSION_DO_RECOVERY_DIR")
            .expect("set the exact previous VM journal directory name");
        let suffix = name
            .strip_prefix("pct-expansion-do-")
            .expect("unexpected journal name");
        assert!(!suffix.is_empty() && suffix.bytes().all(|b| b.is_ascii_digit()));
        let dir = std::env::temp_dir().join(name);
        assert!(dir.is_dir(), "previous VM journal is missing");
        let store = RollbackStore::new(dir);
        assert!(
            store.is_applied_checked(TWEAK_ID).unwrap(),
            "no owned policy snapshot"
        );
        let restored = rollback(&store).expect("production DO rollback");
        assert!(!restored.applied);
        assert_eq!(registry::read_dword(Hive::Hklm, PATH, VALUE).unwrap(), None);
    }
}
