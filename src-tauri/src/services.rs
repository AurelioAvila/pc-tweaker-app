use crate::rollback::{RollbackStore, SnapshotEntry};

pub const WINDOWS_SEARCH_ID: &str = "disable_windows_search_service";
pub(crate) const SERVICE_NAME: &str = "WSearch";

pub struct ServiceInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn windows_search_info() -> ServiceInfo {
    ServiceInfo {
        id: WINDOWS_SEARCH_ID,
        name: "Disable the indexing service (Windows Search)",
        description: "Stops and disables the Windows file indexing service, cutting background disk activity - useful on small SSDs or while gaming. File search in the Start menu gets slower until you turn it back on (requires administrator rights).",
        requires_admin: true,
        requires_pro: true,
    }
}

/// The start types this tweak captures and puts back. Delayed-auto is its own
/// type: collapsing it into plain auto would silently change boot behaviour.
#[cfg(windows)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum StartType {
    Auto,
    DelayedAuto,
    Demand,
    Disabled,
}

#[cfg(windows)]
impl StartType {
    /// The text saved in the snapshot: the words `sc qc` prints, which is
    /// what older builds saved and what `validate_snapshot` checks for.
    fn snapshot_text(self) -> &'static str {
        match self {
            StartType::Auto => "AUTO_START",
            StartType::DelayedAuto => "AUTO_START (DELAYED)",
            StartType::Demand => "DEMAND_START",
            StartType::Disabled => "DISABLED",
        }
    }

    /// Reads a saved start type, including the whole `sc qc` line older
    /// builds stored. That line's label is localized ("START_TYPE" in
    /// English, "TIPO_AVVIO" in Italian) but the value never is, so this
    /// matches on the value.
    fn from_snapshot(text: &str) -> Self {
        if text.contains("AUTO_START") {
            if text.contains("DELAYED") {
                StartType::DelayedAuto
            } else {
                StartType::Auto
            }
        } else if text.contains("DISABLED") {
            StartType::Disabled
        } else {
            StartType::Demand
        }
    }
}

/// Windows Search in the service control manager. Production code reaches it
/// through `WinServices`; unit tests install a fake with `set_test_services`,
/// the same seam `tweaks::windows_impl` gives the registry.
#[cfg(windows)]
pub(crate) trait ServiceControl {
    fn start_type(&self) -> Result<StartType, String>;
    /// Also sets the delayed flag, either way, when the type is automatic.
    fn set_start_type(&self, start_type: StartType) -> Result<(), String>;
    /// `dwCurrentState` as QueryServiceStatusEx reports it.
    fn state(&self) -> Result<u32, String>;
    /// Asks the service to stop. Already stopped is success.
    fn stop(&self) -> Result<(), String>;
    /// Already running is success.
    fn start(&self) -> Result<(), String>;
}

#[cfg(windows)]
struct ScHandle(windows_sys::Win32::System::Services::SC_HANDLE);

#[cfg(windows)]
impl Drop for ScHandle {
    fn drop(&mut self) {
        // SAFETY: this guard owns the non-null SCM handle exactly once.
        unsafe {
            windows_sys::Win32::System::Services::CloseServiceHandle(self.0);
        }
    }
}

/// Windows Search opened for `access`. The service handle is declared first so
/// it is closed before the manager handle it came from.
#[cfg(windows)]
struct OpenService {
    service: ScHandle,
    _manager: ScHandle,
}

#[cfg(windows)]
fn open_service(access: u32) -> Result<OpenService, String> {
    use windows_sys::Win32::System::Services::{OpenSCManagerW, OpenServiceW, SC_MANAGER_CONNECT};
    // SAFETY: null machine/database selects the local active SCM database.
    let manager = unsafe { OpenSCManagerW(std::ptr::null(), std::ptr::null(), SC_MANAGER_CONNECT) };
    if manager.is_null() {
        return Err(format!(
            "could not open the service manager: {}",
            std::io::Error::last_os_error()
        ));
    }
    let manager = ScHandle(manager);
    let name: Vec<u16> = SERVICE_NAME.encode_utf16().chain(Some(0)).collect();
    // SAFETY: manager is live and name is NUL-terminated for this call.
    let service = unsafe { OpenServiceW(manager.0, name.as_ptr(), access) };
    if service.is_null() {
        return Err(format!(
            "could not open Windows Search: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(OpenService {
        service: ScHandle(service),
        _manager: manager,
    })
}

/// The real service control manager. Every change first refuses to run inside
/// a unit test, the way the real registry does.
#[cfg(windows)]
pub(crate) struct WinServices;

#[cfg(windows)]
impl ServiceControl for WinServices {
    fn start_type(&self) -> Result<StartType, String> {
        use windows_sys::Win32::System::Services::{
            QueryServiceConfig2W, QueryServiceConfigW, QUERY_SERVICE_CONFIGW, SERVICE_AUTO_START,
            SERVICE_CONFIG_DELAYED_AUTO_START_INFO, SERVICE_DELAYED_AUTO_START_INFO,
            SERVICE_DEMAND_START, SERVICE_DISABLED, SERVICE_QUERY_CONFIG,
        };
        let opened = open_service(SERVICE_QUERY_CONFIG)?;
        // 8 KiB is the documented maximum for the structure and its strings;
        // u64 storage keeps its pointer fields aligned.
        let mut buffer = vec![0u64; 8 * 1024 / 8];
        let mut needed = 0;
        // SAFETY: the buffer is writable, aligned for QUERY_SERVICE_CONFIGW,
        // passed with its real size in bytes, and outlives the call.
        let read = unsafe {
            QueryServiceConfigW(
                opened.service.0,
                buffer.as_mut_ptr().cast(),
                (buffer.len() * 8) as u32,
                &mut needed,
            )
        };
        if read == 0 {
            return Err(format!(
                "could not read the Windows Search start type: {}",
                std::io::Error::last_os_error()
            ));
        }
        // SAFETY: the call succeeded, so the buffer starts with an initialized
        // QUERY_SERVICE_CONFIGW.
        let start_type = unsafe { (*buffer.as_ptr().cast::<QUERY_SERVICE_CONFIGW>()).dwStartType };
        match start_type {
            SERVICE_AUTO_START => {}
            SERVICE_DEMAND_START => return Ok(StartType::Demand),
            SERVICE_DISABLED => return Ok(StartType::Disabled),
            other => {
                return Err(format!(
                    "Windows Search has an unexpected start type ({other})"
                ))
            }
        }
        let mut delayed = SERVICE_DELAYED_AUTO_START_INFO {
            fDelayedAutostart: 0,
        };
        // SAFETY: `delayed` is the fixed-size structure this info level fills,
        // passed with its real size, and outlives the call.
        let read = unsafe {
            QueryServiceConfig2W(
                opened.service.0,
                SERVICE_CONFIG_DELAYED_AUTO_START_INFO,
                (&mut delayed as *mut SERVICE_DELAYED_AUTO_START_INFO).cast(),
                std::mem::size_of::<SERVICE_DELAYED_AUTO_START_INFO>() as u32,
                &mut needed,
            )
        };
        if read == 0 {
            return Err(format!(
                "could not read the Windows Search start delay: {}",
                std::io::Error::last_os_error()
            ));
        }
        Ok(if delayed.fDelayedAutostart != 0 {
            StartType::DelayedAuto
        } else {
            StartType::Auto
        })
    }

    fn set_start_type(&self, start_type: StartType) -> Result<(), String> {
        use windows_sys::Win32::System::Services::{
            ChangeServiceConfig2W, ChangeServiceConfigW, SERVICE_AUTO_START, SERVICE_CHANGE_CONFIG,
            SERVICE_CONFIG_DELAYED_AUTO_START_INFO, SERVICE_DELAYED_AUTO_START_INFO,
            SERVICE_DEMAND_START, SERVICE_DISABLED, SERVICE_NO_CHANGE,
        };
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let native = match start_type {
            StartType::Auto | StartType::DelayedAuto => SERVICE_AUTO_START,
            StartType::Demand => SERVICE_DEMAND_START,
            StartType::Disabled => SERVICE_DISABLED,
        };
        let opened = open_service(SERVICE_CHANGE_CONFIG)?;
        let null = std::ptr::null();
        // SAFETY: the handle is live; SERVICE_NO_CHANGE and null pointers leave
        // every other part of the configuration as it is.
        let changed = unsafe {
            ChangeServiceConfigW(
                opened.service.0,
                SERVICE_NO_CHANGE,
                native,
                SERVICE_NO_CHANGE,
                null,
                null,
                std::ptr::null_mut(),
                null,
                null,
                null,
                null,
            )
        };
        if changed == 0 {
            return Err(format!(
                "could not change the Windows Search start type: {}",
                std::io::Error::last_os_error()
            ));
        }
        if native == SERVICE_AUTO_START {
            // Written for plain auto too, so it cannot inherit an old delay.
            let info = SERVICE_DELAYED_AUTO_START_INFO {
                fDelayedAutostart: (start_type == StartType::DelayedAuto).into(),
            };
            // SAFETY: `info` is the structure this info level reads and lives
            // for the call.
            let changed = unsafe {
                ChangeServiceConfig2W(
                    opened.service.0,
                    SERVICE_CONFIG_DELAYED_AUTO_START_INFO,
                    (&info as *const SERVICE_DELAYED_AUTO_START_INFO).cast(),
                )
            };
            if changed == 0 {
                return Err(format!(
                    "could not change the Windows Search start delay: {}",
                    std::io::Error::last_os_error()
                ));
            }
        }
        Ok(())
    }

    fn state(&self) -> Result<u32, String> {
        use windows_sys::Win32::System::Services::{
            QueryServiceStatusEx, SC_STATUS_PROCESS_INFO, SERVICE_QUERY_STATUS,
            SERVICE_STATUS_PROCESS,
        };
        let opened = open_service(SERVICE_QUERY_STATUS)?;
        let mut status = std::mem::MaybeUninit::<SERVICE_STATUS_PROCESS>::zeroed();
        let mut needed = 0;
        // SAFETY: the output points to a correctly sized/aligned status structure.
        let result = unsafe {
            QueryServiceStatusEx(
                opened.service.0,
                SC_STATUS_PROCESS_INFO,
                status.as_mut_ptr().cast(),
                std::mem::size_of::<SERVICE_STATUS_PROCESS>() as u32,
                &mut needed,
            )
        };
        if result == 0 {
            return Err(format!(
                "could not read Windows Search status: {}",
                std::io::Error::last_os_error()
            ));
        }
        // SAFETY: QueryServiceStatusEx succeeded and initialized the structure.
        Ok(unsafe { status.assume_init() }.dwCurrentState)
    }

    fn stop(&self) -> Result<(), String> {
        use windows_sys::Win32::Foundation::ERROR_SERVICE_NOT_ACTIVE;
        use windows_sys::Win32::System::Services::{
            ControlService, SERVICE_CONTROL_STOP, SERVICE_STATUS, SERVICE_STOP,
        };
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let opened = open_service(SERVICE_STOP)?;
        let mut status = std::mem::MaybeUninit::<SERVICE_STATUS>::zeroed();
        // SAFETY: the handle is live and `status` is a writable SERVICE_STATUS.
        let stopped =
            unsafe { ControlService(opened.service.0, SERVICE_CONTROL_STOP, status.as_mut_ptr()) };
        if stopped == 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(ERROR_SERVICE_NOT_ACTIVE as i32) {
                return Err(format!("could not stop Windows Search: {error}"));
            }
        }
        Ok(())
    }

    fn start(&self) -> Result<(), String> {
        use windows_sys::Win32::Foundation::ERROR_SERVICE_ALREADY_RUNNING;
        use windows_sys::Win32::System::Services::{StartServiceW, SERVICE_START};
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let opened = open_service(SERVICE_START)?;
        // SAFETY: the handle is live; no arguments means a count of 0 and a
        // null vector.
        if unsafe { StartServiceW(opened.service.0, 0, std::ptr::null()) } == 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(ERROR_SERVICE_ALREADY_RUNNING as i32) {
                return Err(format!("could not start Windows Search: {error}"));
            }
        }
        Ok(())
    }
}

#[cfg(all(test, windows))]
thread_local! {
    static TEST_SERVICES: std::cell::RefCell<Option<std::rc::Rc<dyn ServiceControl>>> =
        const { std::cell::RefCell::new(None) };
}

/// Routes this thread's service calls to `backend` (test builds only).
#[cfg(all(test, windows))]
pub(crate) fn set_test_services(backend: Option<std::rc::Rc<dyn ServiceControl>>) {
    TEST_SERVICES.with(|slot| *slot.borrow_mut() = backend);
}

#[cfg(windows)]
fn with_services<T>(f: impl FnOnce(&dyn ServiceControl) -> T) -> T {
    #[cfg(test)]
    if let Some(backend) = TEST_SERVICES.with(|slot| slot.borrow().clone()) {
        return f(&*backend);
    }
    f(&WinServices)
}

#[cfg(windows)]
fn captured_running_state(state: u32) -> Result<bool, String> {
    use windows_sys::Win32::System::Services::{SERVICE_RUNNING, SERVICE_STOPPED};
    match state {
        SERVICE_RUNNING => Ok(true),
        SERVICE_STOPPED => Ok(false),
        _ => Err("Windows Search is paused or changing state; wait for it to settle before applying this tweak".into()),
    }
}

#[cfg(windows)]
fn wait_for_service_state(scm: &dyn ServiceControl, running: bool) -> Result<(), String> {
    use windows_sys::Win32::System::Services::{SERVICE_RUNNING, SERVICE_STOPPED};
    let expected = if running {
        SERVICE_RUNNING
    } else {
        SERVICE_STOPPED
    };
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    loop {
        if scm.state()? == expected {
            return Ok(());
        }
        if std::time::Instant::now() >= deadline {
            return Err("Windows Search did not reach the requested state; the rollback snapshot was retained".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(125));
    }
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    with_services(|scm| {
        let mut transaction = store.transaction()?;

        let previous = scm.start_type()?;
        let was_running = captured_running_state(scm.state()?)?;

        transaction.save_entry(
            WINDOWS_SEARCH_ID,
            SnapshotEntry::Service {
                name: SERVICE_NAME.to_string(),
                previous_start_type: previous.snapshot_text().to_string(),
                was_running: Some(was_running),
            },
        )?;
        scm.stop()?;
        wait_for_service_state(scm, false)?;
        scm.set_start_type(StartType::Disabled)?;
        if scm.start_type()? != StartType::Disabled {
            return Err("service startup configuration could not be verified".into());
        }
        Ok(())
    })
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(WINDOWS_SEARCH_ID, |entry| {
        let SnapshotEntry::Service {
            previous_start_type,
            was_running,
            ..
        } = entry
        else {
            return Err("unexpected snapshot type for the service".to_string());
        };

        with_services(|scm| {
            let previous = StartType::from_snapshot(&previous_start_type);
            // Legacy snapshots did not capture runtime state. New snapshots
            // never start a service that the user had deliberately left stopped.
            let should_run = was_running.unwrap_or(previous != StartType::Disabled);
            let initial = if should_run && previous == StartType::Disabled {
                StartType::Demand
            } else {
                previous
            };
            scm.set_start_type(initial)?;
            if should_run {
                scm.start()?;
            } else {
                scm.stop()?;
            }
            wait_for_service_state(scm, should_run)?;
            if initial != previous {
                // A running service may have its future startup disabled.
                // Restore that uncommon but valid combination after starting it.
                scm.set_start_type(previous)?;
            }
            if scm.start_type()? != previous {
                return Err(
                    "the restored service startup configuration could not be verified".into(),
                );
            }
            Ok(())
        })
    })
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
    use crate::mock_registry::Fixture;
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;
    use windows_sys::Win32::System::Services::{
        SERVICE_PAUSED, SERVICE_RUNNING, SERVICE_START_PENDING, SERVICE_STOPPED,
        SERVICE_STOP_PENDING,
    };

    const ALL: [StartType; 4] = [
        StartType::Auto,
        StartType::DelayedAuto,
        StartType::Demand,
        StartType::Disabled,
    ];

    /// Windows Search as the SCM keeps it, with the one SCM rule that matters
    /// here: a disabled service cannot be started.
    struct FakeScm {
        start_type: Cell<StartType>,
        running: Cell<bool>,
        /// A state other than running or stopped, such as a pending transition.
        stuck_in: Cell<Option<u32>>,
        /// Start type changes report success but change nothing.
        drop_config: Cell<bool>,
        /// Every change fails with "access denied".
        deny: Cell<bool>,
        /// The changes that were accepted, in order.
        log: RefCell<Vec<String>>,
    }

    impl FakeScm {
        fn change(&self, what: String) -> Result<(), String> {
            if self.deny.get() {
                return Err("access denied".into());
            }
            self.log.borrow_mut().push(what);
            Ok(())
        }
    }

    impl ServiceControl for FakeScm {
        fn start_type(&self) -> Result<StartType, String> {
            Ok(self.start_type.get())
        }
        fn set_start_type(&self, start_type: StartType) -> Result<(), String> {
            self.change(format!("config {start_type:?}"))?;
            if !self.drop_config.get() {
                self.start_type.set(start_type);
            }
            Ok(())
        }
        fn state(&self) -> Result<u32, String> {
            Ok(self.stuck_in.get().unwrap_or(if self.running.get() {
                SERVICE_RUNNING
            } else {
                SERVICE_STOPPED
            }))
        }
        fn stop(&self) -> Result<(), String> {
            self.change("stop".into())?;
            self.running.set(false);
            Ok(())
        }
        fn start(&self) -> Result<(), String> {
            if self.start_type.get() == StartType::Disabled {
                return Err("the service is disabled (1058)".into());
            }
            self.change("start".into())?;
            self.running.set(true);
            Ok(())
        }
    }

    /// Routes this thread's service calls to a fake until dropped.
    struct Installed(Rc<FakeScm>);

    impl std::ops::Deref for Installed {
        type Target = FakeScm;
        fn deref(&self) -> &FakeScm {
            &self.0
        }
    }

    impl Drop for Installed {
        fn drop(&mut self) {
            set_test_services(None);
        }
    }

    fn install(start_type: StartType, running: bool) -> Installed {
        let scm = Rc::new(FakeScm {
            start_type: Cell::new(start_type),
            running: Cell::new(running),
            stuck_in: Cell::new(None),
            drop_config: Cell::new(false),
            deny: Cell::new(false),
            log: RefCell::default(),
        });
        set_test_services(Some(scm.clone()));
        Installed(scm)
    }

    fn saved(fixture: &Fixture) -> (String, Option<bool>) {
        match fixture.snapshot(WINDOWS_SEARCH_ID) {
            Some(SnapshotEntry::Service {
                previous_start_type,
                was_running,
                ..
            }) => (previous_start_type, was_running),
            other => panic!("unexpected snapshot: {other:?}"),
        }
    }

    #[test]
    fn every_start_type_and_running_state_round_trips_exactly() {
        for start_type in ALL {
            for running in [false, true] {
                let scm = install(start_type, running);
                let fixture = Fixture::new();
                apply(&fixture.store).unwrap_or_else(|e| panic!("{start_type:?}: {e}"));
                assert_eq!(scm.start_type.get(), StartType::Disabled);
                assert!(!scm.running.get());
                assert_eq!(
                    saved(&fixture),
                    (start_type.snapshot_text().to_string(), Some(running))
                );
                crate::rollback_by_id_inner(&fixture.store, WINDOWS_SEARCH_ID)
                    .unwrap_or_else(|e| panic!("{start_type:?}: {e}"));
                assert_eq!(scm.start_type.get(), start_type);
                assert_eq!(scm.running.get(), running, "{start_type:?}");
                assert!(!fixture.store.is_applied(WINDOWS_SEARCH_ID));
            }
        }
    }

    /// A disabled service cannot be started, so a disabled-but-running
    /// original is put back as demand, started, then disabled again.
    #[test]
    fn a_disabled_service_that_was_running_is_started_before_being_disabled_again() {
        let scm = install(StartType::Disabled, true);
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        scm.log.borrow_mut().clear();
        rollback(&fixture.store).unwrap();
        assert_eq!(
            *scm.log.borrow(),
            ["config Demand", "start", "config Disabled"]
        );
        assert!(scm.running.get());
        assert_eq!(scm.start_type.get(), StartType::Disabled);
    }

    #[test]
    fn reapplying_after_drift_keeps_the_oldest_original() {
        let scm = install(StartType::DelayedAuto, true);
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        // Something else turns the service back on while the tweak is applied.
        scm.start_type.set(StartType::Demand);
        scm.running.set(true);
        apply(&fixture.store).unwrap();
        assert_eq!(scm.start_type.get(), StartType::Disabled);
        assert_eq!(
            saved(&fixture),
            ("AUTO_START (DELAYED)".to_string(), Some(true))
        );
        rollback(&fixture.store).unwrap();
        assert_eq!(scm.start_type.get(), StartType::DelayedAuto);
        assert!(scm.running.get());
    }

    #[test]
    fn a_start_type_that_does_not_stick_fails_the_apply_and_keeps_the_journal() {
        let scm = install(StartType::Auto, true);
        let fixture = Fixture::new();
        scm.drop_config.set(true);
        let error = apply(&fixture.store).unwrap_err();
        assert!(error.contains("could not be verified"), "{error}");
        assert!(fixture.store.is_applied(WINDOWS_SEARCH_ID));
        // Only the stop landed; restoring starts it again and the untouched
        // start type verifies at once.
        rollback(&fixture.store).unwrap();
        assert_eq!(scm.start_type.get(), StartType::Auto);
        assert!(scm.running.get());
        assert!(!fixture.store.is_applied(WINDOWS_SEARCH_ID));
    }

    #[test]
    fn a_failed_restore_keeps_the_journal_for_a_retry() {
        for denied in [true, false] {
            let scm = install(StartType::Demand, true);
            let fixture = Fixture::new();
            apply(&fixture.store).unwrap();
            if denied {
                scm.deny.set(true);
            } else {
                scm.drop_config.set(true);
            }
            assert!(rollback(&fixture.store).is_err(), "denied {denied}");
            assert!(fixture.store.is_applied(WINDOWS_SEARCH_ID));
            assert_eq!(scm.start_type.get(), StartType::Disabled);
            scm.deny.set(false);
            scm.drop_config.set(false);
            rollback(&fixture.store).unwrap();
            assert_eq!(scm.start_type.get(), StartType::Demand);
            assert!(scm.running.get());
            assert!(!fixture.store.is_applied(WINDOWS_SEARCH_ID));
        }
    }

    #[test]
    fn a_denied_stop_keeps_the_journal_and_changes_nothing_else() {
        let scm = install(StartType::Auto, true);
        let fixture = Fixture::new();
        scm.deny.set(true);
        assert!(apply(&fixture.store).is_err());
        assert!(fixture.store.is_applied(WINDOWS_SEARCH_ID));
        assert_eq!(scm.start_type.get(), StartType::Auto);
        assert!(scm.running.get());
        scm.deny.set(false);
        rollback(&fixture.store).unwrap();
        assert_eq!(scm.start_type.get(), StartType::Auto);
        assert!(scm.running.get());
    }

    #[test]
    fn a_service_between_states_is_refused_before_anything_is_saved() {
        for state in [SERVICE_START_PENDING, SERVICE_STOP_PENDING, SERVICE_PAUSED] {
            let scm = install(StartType::Auto, true);
            let fixture = Fixture::new();
            scm.stuck_in.set(Some(state));
            assert!(apply(&fixture.store).is_err());
            assert!(!fixture.store.is_applied(WINDOWS_SEARCH_ID));
            assert!(scm.log.borrow().is_empty());
        }
    }

    /// Older builds saved the whole `sc qc` line, label and all, and no
    /// running state. Those journals must still restore exactly.
    #[test]
    fn legacy_sc_qc_snapshots_still_restore() {
        for (text, expected) in [
            (
                "TIPO_AVVIO                : 2   AUTO_START  (DELAYED)",
                StartType::DelayedAuto,
            ),
            ("START_TYPE         : 2   AUTO_START", StartType::Auto),
            ("START_TYPE         : 3   DEMAND_START", StartType::Demand),
            ("START_TYPE         : 4   DISABLED", StartType::Disabled),
        ] {
            let scm = install(StartType::Disabled, false);
            let fixture = Fixture::new();
            fixture
                .store
                .transaction()
                .unwrap()
                .save_entry(
                    WINDOWS_SEARCH_ID,
                    SnapshotEntry::Service {
                        name: SERVICE_NAME.into(),
                        previous_start_type: text.into(),
                        was_running: None,
                    },
                )
                .unwrap();
            rollback(&fixture.store).unwrap_or_else(|e| panic!("{text}: {e}"));
            assert_eq!(scm.start_type.get(), expected, "{text}");
            assert_eq!(scm.running.get(), expected != StartType::Disabled, "{text}");
        }
    }

    #[test]
    fn new_snapshot_text_reads_back_as_itself_and_passes_validation() {
        for start_type in ALL {
            let text = start_type.snapshot_text();
            assert_eq!(StartType::from_snapshot(text), start_type);
            let entry = SnapshotEntry::Service {
                name: SERVICE_NAME.into(),
                previous_start_type: text.into(),
                was_running: Some(true),
            };
            crate::rollback::validate_snapshot(WINDOWS_SEARCH_ID, &entry).unwrap();
        }
    }

    /// The safety net: with no fake installed, a unit test cannot change a
    /// real service even on an administrator's machine.
    #[test]
    fn unit_tests_cannot_change_real_services() {
        // Skipped only where the guard itself is off: the disposable VM.
        if std::env::var("PC_TWEAKER_EXPANSION_VM_TEST").as_deref()
            == Ok("I_ACKNOWLEDGE_DISPOSABLE_VM")
        {
            return;
        }
        for result in [
            WinServices.set_start_type(StartType::Disabled),
            WinServices.stop(),
            WinServices.start(),
        ] {
            assert!(result.unwrap_err().contains("unit tests"));
        }
    }

    #[test]
    fn only_stable_native_states_can_be_saved_as_running_or_stopped() {
        assert!(captured_running_state(SERVICE_RUNNING).unwrap());
        assert!(!captured_running_state(SERVICE_STOPPED).unwrap());
        for state in [
            SERVICE_START_PENDING,
            SERVICE_STOP_PENDING,
            SERVICE_PAUSED,
            99,
        ] {
            assert!(captured_running_state(state).is_err());
        }
    }

    #[test]
    fn service_snapshot_supports_legacy_and_new_runtime_state_without_guessing() {
        let old = serde_json::json!({"kind":"Service","name":"WSearch","previous_start_type":"3 DEMAND_START"});
        let parsed: SnapshotEntry = serde_json::from_value(old.clone()).unwrap();
        assert!(matches!(
            parsed,
            SnapshotEntry::Service {
                was_running: None,
                ..
            }
        ));
        for running in [false, true] {
            let mut new = old.clone();
            new["was_running"] = serde_json::json!(running);
            assert!(
                matches!(serde_json::from_value::<SnapshotEntry>(new).unwrap(), SnapshotEntry::Service { was_running: Some(value), .. } if value == running)
            );
        }
        let mut invalid = old;
        invalid["was_running"] = serde_json::json!("unknown");
        assert!(serde_json::from_value::<SnapshotEntry>(invalid).is_err());
    }
}
