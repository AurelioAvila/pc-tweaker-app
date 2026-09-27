//! Swaps the TCP congestion-control algorithm on the Internet template.
//!
//! Windows ships CUBIC, which reacts to packet *loss*: it keeps pushing until
//! a queue somewhere overflows, then halves. On a home line that queue is
//! usually the router's, so the moment anything else in the house starts a
//! download, latency-sensitive traffic sits behind a full buffer — the effect
//! people describe as "my ping spikes when someone streams".
//!
//! BBR2 models the path's bandwidth and round-trip time instead and paces to
//! that, so it fills the pipe without filling the buffer. Microsoft ships it
//! in Windows 11 and Server 2022 as a supported value of the same setting
//! CUBIC uses; nothing here is undocumented or third-party.
//!
//! Why this is not a `RegistryTweak`: the setting is not a registry value.
//! It lives in the TCP stack's own store, reached through the WMI class
//! `MSFT_NetTCPSetting` (the one `Set-NetTCPSetting` drives), and the only
//! honest way to record a previous value for rollback is to read the current
//! provider back before changing it.
//!
//! Deliberately *not* touched here: `TcpAckFrequency` / `TCPNoDelay`, which
//! already have their own tweak (`netlatency`). Writing them from two places
//! would mean two toggles fighting over one pair of values.

use crate::rollback::{RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "tcp_congestion_bbr";

/// The template Windows applies to off-link (internet) destinations. The
/// other templates — Datacenter, Compat, InternetCustom — either do not
/// carry normal home traffic or exist to be overridden per-subnet.
const TEMPLATE: &str = "Internet";
const TARGET_PROVIDER: &str = "BBR2";

pub struct NetShaperInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn info() -> NetShaperInfo {
    NetShaperInfo {
        id: TWEAK_ID,
        name: "Keep latency low when the line is busy (BBR2)",
        description: "Windows uses CUBIC, which speeds up until a buffer somewhere overflows - which is why your ping climbs the moment someone else in the house starts a download. BBR2 measures the line's real bandwidth and round trip instead and paces traffic to fit, so the pipe fills without the queue filling. Microsoft ships BBR2 in Windows 11; this switches the Internet template over to it, and switches back to exactly what was there before (requires administrator rights).",
        requires_admin: true,
        requires_pro: false,
    }
}

/// The TCP stack's supplemental templates. Production code goes through
/// `WinTcp`; unit tests install an in-memory fake.
#[cfg(windows)]
pub(crate) trait TcpTemplates {
    /// The provider in force on `template`, named as the stack names it
    /// ("CUBIC"), never translated.
    fn provider(&self, template: &str) -> Result<String, String>;
    fn set_provider(&self, template: &str, provider: &str) -> Result<(), String>;
    /// Whether this Windows build knows `provider` at all.
    fn supports(&self, provider: &str) -> Result<bool, String>;
}

#[cfg(all(windows, test))]
thread_local! {
    static TEST_TEMPLATES: std::cell::RefCell<Option<std::rc::Rc<dyn TcpTemplates>>> =
        const { std::cell::RefCell::new(None) };
}

/// Routes this thread's TCP template calls to `templates` (test builds only).
#[cfg(all(windows, test))]
pub(crate) fn set_test_templates(templates: Option<std::rc::Rc<dyn TcpTemplates>>) {
    TEST_TEMPLATES.with(|slot| *slot.borrow_mut() = templates);
}

#[cfg(windows)]
fn with_templates<T>(f: impl FnOnce(&dyn TcpTemplates) -> T) -> T {
    #[cfg(test)]
    if let Some(templates) = TEST_TEMPLATES.with(|slot| slot.borrow().clone()) {
        return f(&*templates);
    }
    f(&wmi::WinTcp)
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;

    with_templates(|tcp| {
        if !tcp.supports(TARGET_PROVIDER)? {
            return Err(
                "this Windows build does not offer BBR2 - it arrived with Windows 11".to_string(),
            );
        }

        let previous = tcp.provider(TEMPLATE)?;

        // Snapshot before mutating, so a failure part-way cannot leave the stack
        // changed with nothing recorded to change it back to. When the machine is
        // already on BBR2, recording that as the previous value is what makes a
        // later rollback a no-op rather than a silent downgrade to CUBIC the user
        // never chose.
        transaction.save_entry(
            TWEAK_ID,
            SnapshotEntry::TcpCongestionProvider {
                setting_name: TEMPLATE.to_string(),
                previous: previous.clone(),
            },
        )?;

        if previous.eq_ignore_ascii_case(TARGET_PROVIDER) {
            return Ok(());
        }

        set_verified(tcp, TEMPLATE, TARGET_PROVIDER)
    })
}

#[cfg(windows)]
fn set_verified(tcp: &dyn TcpTemplates, template: &str, provider: &str) -> Result<(), String> {
    tcp.set_provider(template, provider)?;
    if !tcp.provider(template)?.eq_ignore_ascii_case(provider) {
        return Err(
            "TCP congestion provider could not be verified; the snapshot was retained".into(),
        );
    }
    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(TWEAK_ID, |entry| {
        let SnapshotEntry::TcpCongestionProvider {
            setting_name,
            previous,
        } = entry
        else {
            return Err("unexpected snapshot type for the congestion provider tweak".to_string());
        };

        with_templates(|tcp| {
            // Already as recorded (an apply that never took effect): nothing
            // to write, whatever the provider accepts.
            if tcp.provider(&setting_name)?.eq_ignore_ascii_case(&previous) {
                return Ok(());
            }
            set_verified(tcp, &setting_name, &previous)
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

/// `ROOT\StandardCimv2:MSFT_NetTCPSetting`, one instance per template.
///
/// Provider names come from the class's own `ValueMap`/`Values` qualifiers,
/// so a build that knows BBR2 says so itself, and a name is never guessed
/// from a Windows version. `Values` is an amended (localizable) qualifier:
/// the connection asks for the English locale so the names always match the
/// ones snapshots store.
#[cfg(windows)]
mod wmi {
    use super::TcpTemplates;
    use windows::core::{w, IUnknown, Param, BSTR, HRESULT, PCWSTR, VARIANT};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoSetProxyBlanket, CoTaskMemFree, CoUninitialize,
        CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL,
        RPC_C_IMP_LEVEL_IMPERSONATE,
    };
    use windows::Win32::System::Variant::{VariantGetElementCount, VariantGetStringElem};
    use windows::Win32::System::Wmi::{
        IEnumWbemClassObject, IWbemClassObject, IWbemLocator, IWbemServices, WbemLocator,
        WBEM_FLAG_FORWARD_ONLY, WBEM_FLAG_KEYS_ONLY, WBEM_FLAG_RETURN_IMMEDIATELY,
        WBEM_FLAG_UPDATE_ONLY, WBEM_FLAG_USE_AMENDED_QUALIFIERS, WBEM_GENERIC_FLAG_TYPE,
    };

    // From rpcdce.h and winerror.h: three integers are not worth two more
    // features of the windows crate.
    const RPC_C_AUTHN_WINNT: u32 = 10;
    const RPC_C_AUTHZ_NONE: u32 = 0;
    const RPC_E_CHANGED_MODE: HRESULT = HRESULT(0x8001_0106_u32 as i32);

    const CLASS: &str = "MSFT_NetTCPSetting";
    const PROPERTY: PCWSTR = w!("CongestionProvider");
    /// A provider that stops answering must not hang a tweak forever.
    const TIMEOUT_MS: i32 = 30_000;

    pub(crate) struct WinTcp;

    impl TcpTemplates for WinTcp {
        fn provider(&self, template: &str) -> Result<String, String> {
            let session = Session::open()?;
            let instance = session.template(template)?;
            let mut value = VARIANT::new();
            // SAFETY: `value` is a live, empty VARIANT the call fills in.
            unsafe { instance.Get(PROPERTY, 0, &mut value, None, None) }.map_err(failed)?;
            let number = u32::try_from(&value).map_err(|_| {
                format!("Windows reported no congestion provider for the {template} template")
            })?;
            session
                .providers()?
                .into_iter()
                .find(|(n, _)| *n == number)
                .map(|(_, name)| name)
                .ok_or_else(|| {
                    format!("Windows reported an unknown congestion provider ({number})")
                })
        }

        fn set_provider(&self, template: &str, provider: &str) -> Result<(), String> {
            crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
            let session = Session::open()?;
            let number = session
                .providers()?
                .into_iter()
                .find(|(_, name)| name.eq_ignore_ascii_case(provider))
                .and_then(|(n, _)| u8::try_from(n).ok())
                .ok_or_else(|| format!("this Windows build does not offer {provider}"))?;
            // First the key-only instance (only the provider changes); if the
            // provider rejects or ignores that shape, the whole instance as
            // read, with the provider replaced, the way a CIM modify sends it.
            // Whichever one Windows then reports is what the caller verifies.
            let put = |instance: &IWbemClassObject| {
                // SAFETY: `instance` is a live instance of the class.
                unsafe {
                    session.services.PutInstance(
                        instance,
                        WBEM_GENERIC_FLAG_TYPE(WBEM_FLAG_UPDATE_ONLY.0),
                        None,
                        None,
                    )
                }
                .map_err(failed)
            };
            let first = put(&session.update(template, number)?);
            if first.is_ok() && self.provider(template)?.eq_ignore_ascii_case(provider) {
                return Ok(());
            }
            let full = session.template(template)?;
            // SAFETY: `full` is a live instance; the VARIANT outlives the call.
            unsafe { full.Put(PROPERTY, 0, &VARIANT::from(number), 0) }.map_err(failed)?;
            put(&full).or(first)
        }

        fn supports(&self, provider: &str) -> Result<bool, String> {
            Ok(Session::open()?
                .providers()?
                .iter()
                .any(|(_, name)| name.eq_ignore_ascii_case(provider)))
        }
    }

    fn failed(e: windows::core::Error) -> String {
        format!(
            "the TCP setting could not be read or changed: {}",
            e.message()
        )
    }

    /// COM on the calling thread for one operation. A thread already in a
    /// single-threaded apartment keeps it (RPC_E_CHANGED_MODE): COM works
    /// there too, and that initialisation is not ours to undo. S_FALSE means
    /// already initialised in this mode, which still needs balancing.
    struct Com(bool);

    impl Com {
        fn init() -> Result<Self, String> {
            // SAFETY: no reserved pointer; balanced in Drop when it succeeded.
            let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
            if hr == RPC_E_CHANGED_MODE {
                return Ok(Com(false));
            }
            hr.ok().map_err(failed)?;
            Ok(Com(true))
        }
    }

    impl Drop for Com {
        fn drop(&mut self) {
            if self.0 {
                // SAFETY: balances the successful CoInitializeEx above, on the
                // same thread: a Com never leaves the call that created it.
                unsafe { CoUninitialize() };
            }
        }
    }

    /// Fields drop in order: the services proxy is released before COM.
    struct Session {
        services: IWbemServices,
        _com: Com,
    }

    /// Calls on a WMI proxy impersonate the caller; the default blanket only
    /// identifies it, which the TCP provider refuses. The blanket belongs to
    /// one interface proxy, so it is set on the interface actually called.
    fn impersonate(proxy: impl Param<IUnknown>) -> Result<(), String> {
        // SAFETY: `proxy` is a live COM proxy; no principal name or auth info
        // is passed.
        unsafe {
            CoSetProxyBlanket(
                proxy,
                RPC_C_AUTHN_WINNT,
                RPC_C_AUTHZ_NONE,
                PCWSTR::null(),
                RPC_C_AUTHN_LEVEL_CALL,
                RPC_C_IMP_LEVEL_IMPERSONATE,
                None,
                EOAC_NONE,
            )
        }
        .map_err(failed)
    }

    impl Session {
        fn open() -> Result<Self, String> {
            let com = Com::init()?;
            // SAFETY: COM is initialised on this thread for as long as `com`
            // lives, and the locator is released before it.
            let services = unsafe {
                let locator: IWbemLocator =
                    CoCreateInstance(&WbemLocator, None, CLSCTX_INPROC_SERVER).map_err(failed)?;
                locator.ConnectServer(
                    &BSTR::from(r"ROOT\StandardCimv2"),
                    &BSTR::new(),
                    &BSTR::new(),
                    &BSTR::from("MS_409"),
                    0,
                    &BSTR::new(),
                    None,
                )
            }
            .map_err(failed)?;
            impersonate(&services)?;
            Ok(Session {
                services,
                _com: com,
            })
        }

        fn class(&self, flags: WBEM_GENERIC_FLAG_TYPE) -> Result<IWbemClassObject, String> {
            let mut class = None;
            // SAFETY: `class` is a live out-parameter that takes ownership of
            // the returned object.
            unsafe {
                self.services
                    .GetObject(&BSTR::from(CLASS), flags, None, Some(&mut class), None)
            }
            .map_err(failed)?;
            class.ok_or_else(|| format!("{CLASS} is not available on this Windows build"))
        }

        /// Provider numbers and names, paired from the property's qualifiers.
        fn providers(&self) -> Result<Vec<(u32, String)>, String> {
            let class = self.class(WBEM_FLAG_USE_AMENDED_QUALIFIERS)?;
            // SAFETY: `class` is live; each VARIANT is a live out-parameter.
            let (numbers, names) = unsafe {
                let qualifiers = class.GetPropertyQualifierSet(PROPERTY).map_err(failed)?;
                let mut numbers = VARIANT::new();
                let mut names = VARIANT::new();
                qualifiers
                    .Get(w!("ValueMap"), 0, &mut numbers, std::ptr::null_mut())
                    .map_err(failed)?;
                qualifiers
                    .Get(w!("Values"), 0, &mut names, std::ptr::null_mut())
                    .map_err(failed)?;
                (numbers, names)
            };
            let (numbers, names) = (strings(&numbers)?, strings(&names)?);
            if numbers.is_empty() || numbers.len() != names.len() {
                return Err("Windows describes its congestion providers inconsistently".into());
            }
            numbers
                .iter()
                .zip(names)
                .map(|(n, name)| {
                    n.parse()
                        .map(|n| (n, name))
                        .map_err(|_| format!("unexpected congestion provider number {n}"))
                })
                .collect()
        }

        /// The one instance for `template`.
        fn template(&self, template: &str) -> Result<IWbemClassObject, String> {
            // Template names come from this module or from a validated
            // snapshot; refusing anything else keeps the query a constant.
            if template.is_empty() || !template.chars().all(|c| c.is_ascii_alphanumeric()) {
                return Err(format!("invalid TCP template name: {template}"));
            }
            let query = format!("SELECT * FROM {CLASS} WHERE SettingName = '{template}'");
            // SAFETY: both BSTRs outlive the call.
            let rows: IEnumWbemClassObject = unsafe {
                self.services.ExecQuery(
                    &BSTR::from("WQL"),
                    &BSTR::from(query),
                    WBEM_GENERIC_FLAG_TYPE(
                        WBEM_FLAG_FORWARD_ONLY.0 | WBEM_FLAG_RETURN_IMMEDIATELY.0,
                    ),
                    None,
                )
            }
            .map_err(failed)?;
            impersonate(&rows)?;
            let mut row = [None];
            let mut returned = 0u32;
            // SAFETY: `row` has room for exactly the one object asked for and
            // takes ownership of it; `returned` is a live out-parameter.
            unsafe { rows.Next(TIMEOUT_MS, &mut row, &mut returned) }
                .ok()
                .map_err(failed)?;
            let [instance] = row;
            instance
                .filter(|_| returned == 1)
                .ok_or_else(|| format!("Windows has no {template} TCP template"))
        }

        /// A fresh instance carrying only `template`'s keys and the new
        /// provider. Every other property stays NULL, which the provider
        /// reads as "leave as it is"; writing the whole instance back would
        /// also resubmit read-only and template-locked properties.
        fn update(&self, template: &str, provider: u8) -> Result<IWbemClassObject, String> {
            let current = self.template(template)?;
            // Fetched without amended qualifiers: an instance spawned from an
            // amended class could not be written back.
            let class = self.class(WBEM_GENERIC_FLAG_TYPE(0))?;
            // SAFETY (this block): `current`, `class` and `update` are live
            // objects; every out-parameter is a live local that owns what it
            // receives, and `name` outlives the Put that reads it.
            unsafe {
                let update = class.SpawnInstance(0).map_err(failed)?;
                current
                    .BeginEnumeration(WBEM_FLAG_KEYS_ONLY.0)
                    .map_err(failed)?;
                loop {
                    let mut name = BSTR::new();
                    let mut value = VARIANT::new();
                    current
                        .Next(
                            0,
                            &mut name,
                            &mut value,
                            std::ptr::null_mut(),
                            std::ptr::null_mut(),
                        )
                        .map_err(failed)?;
                    // WBEM_S_NO_MORE_DATA is a success code with no name.
                    if name.is_empty() {
                        break;
                    }
                    update
                        .Put(PCWSTR(name.as_ptr()), 0, &value, 0)
                        .map_err(failed)?;
                }
                current.EndEnumeration().map_err(failed)?;
                // SettingName is not a key, but it is how the template is
                // named everywhere else; carry it along.
                let mut setting_name = VARIANT::new();
                current
                    .Get(w!("SettingName"), 0, &mut setting_name, None, None)
                    .map_err(failed)?;
                update
                    .Put(w!("SettingName"), 0, &setting_name, 0)
                    .map_err(failed)?;
                update
                    .Put(PROPERTY, 0, &VARIANT::from(provider), 0)
                    .map_err(failed)?;
                Ok(update)
            }
        }
    }

    /// The strings of a VT_ARRAY | VT_BSTR qualifier value.
    fn strings(value: &VARIANT) -> Result<Vec<String>, String> {
        // SAFETY: `value` is a live, initialised VARIANT.
        let count = unsafe { VariantGetElementCount(value) };
        (0..count)
            .map(|i| {
                // SAFETY: `i` is below the element count. The returned string
                // is allocated with CoTaskMemAlloc, NUL-terminated, copied
                // once and then freed exactly once.
                unsafe {
                    let text = VariantGetStringElem(value, i).map_err(failed)?;
                    let copy = text.to_string().map_err(|e| e.to_string());
                    CoTaskMemFree(Some(text.0 as *const _));
                    copy
                }
            })
            .collect()
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::mock_registry::Fixture;
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;

    /// One template's provider, the way the TCP stack keeps it.
    struct FakeTcp {
        provider: RefCell<String>,
        known: &'static [&'static str],
        /// Reports success without changing anything.
        drop_writes: Cell<bool>,
        deny_writes: Cell<bool>,
        writes: Cell<usize>,
    }

    impl TcpTemplates for FakeTcp {
        fn provider(&self, template: &str) -> Result<String, String> {
            assert_eq!(template, TEMPLATE);
            Ok(self.provider.borrow().clone())
        }
        fn set_provider(&self, template: &str, provider: &str) -> Result<(), String> {
            assert_eq!(template, TEMPLATE);
            if self.deny_writes.get() {
                return Err("the TCP setting could not be read or changed: Access denied".into());
            }
            self.writes.set(self.writes.get() + 1);
            if !self.drop_writes.get() {
                *self.provider.borrow_mut() = provider.to_string();
            }
            Ok(())
        }
        fn supports(&self, provider: &str) -> Result<bool, String> {
            Ok(self.known.iter().any(|k| k.eq_ignore_ascii_case(provider)))
        }
    }

    struct Installed(Rc<FakeTcp>);

    impl std::ops::Deref for Installed {
        type Target = FakeTcp;
        fn deref(&self) -> &FakeTcp {
            &self.0
        }
    }

    impl Drop for Installed {
        fn drop(&mut self) {
            set_test_templates(None);
        }
    }

    const WINDOWS_11: &[&str] = &[
        "Default", "NewReno", "CTCP", "DCTCP", "LEDBAT", "CUBIC", "BBR2",
    ];

    fn install(provider: &str) -> Installed {
        install_on(provider, WINDOWS_11)
    }

    fn install_on(provider: &str, known: &'static [&'static str]) -> Installed {
        let tcp = Rc::new(FakeTcp {
            provider: RefCell::new(provider.into()),
            known,
            drop_writes: Cell::new(false),
            deny_writes: Cell::new(false),
            writes: Cell::new(0),
        });
        set_test_templates(Some(tcp.clone()));
        Installed(tcp)
    }

    #[test]
    fn bbr2_round_trips_to_the_exact_previous_provider() {
        for original in ["CUBIC", "NewReno", "Default"] {
            let tcp = install(original);
            let fixture = Fixture::new();
            apply(&fixture.store).unwrap();
            assert_eq!(*tcp.provider.borrow(), "BBR2");
            assert!(matches!(
                fixture.snapshot(TWEAK_ID),
                Some(SnapshotEntry::TcpCongestionProvider { setting_name, previous })
                    if setting_name == TEMPLATE && previous == original
            ));
            rollback(&fixture.store).unwrap();
            assert_eq!(*tcp.provider.borrow(), original);
            assert!(!fixture.store.is_applied(TWEAK_ID));
        }
    }

    /// Already on BBR2: nothing is written, and rollback leaves it there.
    #[test]
    fn a_machine_already_on_bbr2_stays_on_it() {
        let tcp = install("BBR2");
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        assert_eq!(tcp.writes.get(), 0);
        rollback(&fixture.store).unwrap();
        assert_eq!(*tcp.provider.borrow(), "BBR2");
    }

    #[test]
    fn reapplying_after_drift_still_restores_the_first_original() {
        let tcp = install("CUBIC");
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        *tcp.provider.borrow_mut() = "NewReno".into();
        apply(&fixture.store).unwrap();
        assert_eq!(*tcp.provider.borrow(), "BBR2");
        rollback(&fixture.store).unwrap();
        assert_eq!(*tcp.provider.borrow(), "CUBIC");
    }

    #[test]
    fn a_write_that_does_not_stick_fails_and_keeps_the_journal() {
        let tcp = install("CUBIC");
        let fixture = Fixture::new();
        tcp.drop_writes.set(true);
        let error = apply(&fixture.store).unwrap_err();
        assert!(error.contains("could not be verified"), "{error}");
        assert!(fixture.store.is_applied(TWEAK_ID));
        assert_eq!(*tcp.provider.borrow(), "CUBIC");
        // Nothing stuck, so putting the original back verifies at once.
        rollback(&fixture.store).unwrap();
        assert!(!fixture.store.is_applied(TWEAK_ID));

        // A restore that does not stick keeps the journal too.
        tcp.drop_writes.set(false);
        apply(&fixture.store).unwrap();
        tcp.drop_writes.set(true);
        assert!(rollback(&fixture.store)
            .unwrap_err()
            .contains("could not be verified"));
        assert!(fixture.store.is_applied(TWEAK_ID));
        tcp.drop_writes.set(false);
        rollback(&fixture.store).unwrap();
        assert_eq!(*tcp.provider.borrow(), "CUBIC");
    }

    #[test]
    fn a_failed_restore_keeps_the_journal_for_a_retry() {
        let tcp = install("CUBIC");
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        tcp.deny_writes.set(true);
        assert!(rollback(&fixture.store).is_err());
        assert!(fixture.store.is_applied(TWEAK_ID));
        tcp.deny_writes.set(false);
        rollback(&fixture.store).unwrap();
        assert_eq!(*tcp.provider.borrow(), "CUBIC");
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    /// A build without BBR2 (Windows 10) is refused before anything is
    /// recorded or written.
    #[test]
    fn a_build_without_bbr2_is_refused_before_the_snapshot() {
        let tcp = install_on("CUBIC", &WINDOWS_11[..6]);
        let fixture = Fixture::new();
        assert!(apply(&fixture.store)
            .unwrap_err()
            .contains("does not offer BBR2"));
        assert!(!fixture.store.is_applied(TWEAK_ID));
        assert_eq!(tcp.writes.get(), 0);
    }

    /// A provider name the snapshot validator does not know is refused
    /// before the first write, rather than recorded as unrestorable.
    #[test]
    fn an_unknown_previous_provider_is_refused_before_writing() {
        let tcp = install("BBRv3");
        let fixture = Fixture::new();
        assert!(apply(&fixture.store).is_err());
        assert!(!fixture.store.is_applied(TWEAK_ID));
        assert_eq!(tcp.writes.get(), 0);
    }

    /// The safety net: with no fake installed, a unit test cannot change the
    /// congestion provider of the machine running it.
    #[test]
    fn unit_tests_cannot_change_the_real_tcp_stack() {
        if std::env::var("PC_TWEAKER_EXPANSION_VM_TEST").as_deref()
            == Ok("I_ACKNOWLEDGE_DISPOSABLE_VM")
        {
            return;
        }
        let error = wmi::WinTcp
            .set_provider(TEMPLATE, TARGET_PROVIDER)
            .unwrap_err();
        assert!(error.contains("unit tests may not write"), "{error}");
    }

    /// Read-only, against this machine: the provider has to come back as one
    /// of the stack's own names, one a snapshot may record. If this ever
    /// returned a translated word or an empty string, the value recorded for
    /// rollback would be one the stack cannot be set back to.
    #[test]
    fn the_current_provider_is_a_name_a_snapshot_accepts() {
        let previous = wmi::WinTcp
            .provider(TEMPLATE)
            .expect("no congestion provider reported");
        let entry = SnapshotEntry::TcpCongestionProvider {
            setting_name: TEMPLATE.into(),
            previous: previous.clone(),
        };
        assert!(
            crate::rollback::validate_snapshot(TWEAK_ID, &entry).is_ok(),
            "unrecognised congestion provider: {previous}"
        );
        assert!(wmi::WinTcp.supports(&previous).unwrap());
    }
}
