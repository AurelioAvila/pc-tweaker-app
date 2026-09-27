use crate::rollback::{RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "privacy_dns";
pub(crate) const PRIMARY_DNS: &str = "1.1.1.1";
pub(crate) const SECONDARY_DNS: &str = "1.0.0.1";

const LEGACY_MODE_UNKNOWN: &str = "This legacy DNS snapshot does not record automatic versus static configuration. Recovery data was retained for manual review; no settings were changed.";

fn configured_dns(value: Option<&str>) -> Result<(bool, Vec<String>), String> {
    let value = value.unwrap_or("").trim();
    if value.is_empty() {
        return Ok((true, Vec::new()));
    }
    let addresses = value
        .split(|c: char| c == ',' || c == ';' || c.is_whitespace())
        .filter(|v| !v.is_empty())
        .map(|v| {
            v.parse::<std::net::Ipv4Addr>()
                .map(|ip| ip.to_string())
                .map_err(|_| "The adapter has an unsupported DNS configuration".to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    if addresses.is_empty() || addresses.len() > 16 {
        return Err("Invalid DNS configuration".into());
    }
    Ok((false, addresses))
}

/// Where an adapter's static IPv4 DNS servers are set, and how the adapter
/// is found. Production code goes through `WinDns`; unit tests install a fake
/// that writes `NameServer` into the in-memory registry, so the tweak's own
/// read-back verifies it exactly as it verifies Windows.
#[cfg(windows)]
pub(crate) trait DnsServers {
    /// Braced GUID of the adapter that carries the route to the internet.
    fn internet_adapter(&self) -> Result<String, String>;
    /// Braced GUID of the adapter named `alias`. Only snapshots written by
    /// older builds name an adapter that way.
    fn adapter_by_alias(&self, alias: &str) -> Result<String, String>;
    /// Replaces the adapter's static IPv4 servers. An empty list returns the
    /// adapter to automatic (DHCP) DNS.
    fn set_servers(&self, guid: &str, servers: &[String]) -> Result<(), String>;
}

/// The DNS client's own API. `SetInterfaceDnsSettings` only exists from
/// Windows 10 version 2004, so it is looked up at run time: a static import
/// would stop the whole app from starting on an older build.
#[cfg(windows)]
pub(crate) struct WinDns;

#[cfg(windows)]
impl DnsServers for WinDns {
    fn internet_adapter(&self) -> Result<String, String> {
        crate::diagnostics::network_verify::internet_interface_guid()
    }

    fn adapter_by_alias(&self, alias: &str) -> Result<String, String> {
        crate::diagnostics::network_verify::interface_guid_for_alias(alias)
    }

    fn set_servers(&self, guid: &str, servers: &[String]) -> Result<(), String> {
        use windows_sys::core::GUID;
        use windows_sys::Win32::Foundation::FreeLibrary;
        use windows_sys::Win32::NetworkManagement::IpHelper::{
            DNS_INTERFACE_SETTINGS, DNS_INTERFACE_SETTINGS_VERSION1, DNS_SETTING_NAMESERVER,
        };
        use windows_sys::Win32::System::LibraryLoader::{
            GetProcAddress, LoadLibraryExW, LOAD_LIBRARY_SEARCH_SYSTEM32,
        };
        type SetInterfaceDnsSettings =
            unsafe extern "system" fn(GUID, *const DNS_INTERFACE_SETTINGS) -> u32;

        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let interface = parse_guid(guid)?;
        // Comma-separated, as the registry stores it; empty means automatic.
        let mut name_server: Vec<u16> = servers.join(",").encode_utf16().chain(Some(0)).collect();
        // Only the NameServer option is flagged, and every other field is
        // zeroed, as the API requires; IPv4 is the default stack.
        let settings = DNS_INTERFACE_SETTINGS {
            Version: DNS_INTERFACE_SETTINGS_VERSION1,
            Flags: DNS_SETTING_NAMESERVER as u64,
            Domain: std::ptr::null_mut(),
            NameServer: name_server.as_mut_ptr(),
            SearchList: std::ptr::null_mut(),
            RegistrationEnabled: 0,
            RegisterAdapterName: 0,
            EnableLLMNR: 0,
            QueryAdapterName: 0,
            ProfileNameServer: std::ptr::null_mut(),
        };

        let dll: Vec<u16> = "iphlpapi.dll\0".encode_utf16().collect();
        // SAFETY: `dll` is a valid NUL-terminated UTF-16 string that outlives
        // the call.
        let module = unsafe {
            LoadLibraryExW(
                dll.as_ptr(),
                std::ptr::null_mut(),
                LOAD_LIBRARY_SEARCH_SYSTEM32,
            )
        };
        if module.is_null() {
            return Err("the IP Helper library could not be loaded".into());
        }
        // SAFETY: `module` is a live module handle; the name is NUL-terminated.
        let Some(proc) =
            (unsafe { GetProcAddress(module, c"SetInterfaceDnsSettings".as_ptr().cast()) })
        else {
            // SAFETY: `module` came from LoadLibraryExW above.
            unsafe { FreeLibrary(module) };
            return Err("changing DNS servers needs Windows 10 version 2004 or later".into());
        };
        // SAFETY: the signature matches the export documented in netioapi.h.
        let set = unsafe {
            std::mem::transmute::<unsafe extern "system" fn() -> isize, SetInterfaceDnsSettings>(
                proc,
            )
        };
        // SAFETY: `settings` and the `name_server` buffer it points into are
        // live, correctly shaped and unmodified for the duration of the call;
        // the API copies what it needs.
        let code = unsafe { set(interface, &settings) };
        // SAFETY: `module` came from LoadLibraryExW above; `set` is not used
        // after this.
        unsafe { FreeLibrary(module) };
        if code != 0 {
            return Err(format!("Windows refused the DNS change (error {code})"));
        }
        Ok(())
    }
}

/// "{4D36E972-E325-11CE-BFC1-08002BE10318}" as the API's GUID. The string
/// form is the u128 written out in order, which is what `from_u128` reads.
#[cfg(windows)]
fn parse_guid(text: &str) -> Result<windows_sys::core::GUID, String> {
    let hex: String = text.trim_matches(['{', '}']).split('-').collect();
    if !crate::rollback::valid_guid(text) {
        return Err("The network adapter could not be identified".into());
    }
    u128::from_str_radix(&hex, 16)
        .map(windows_sys::core::GUID::from_u128)
        .map_err(|_| "The network adapter could not be identified".to_string())
}

#[cfg(all(windows, test))]
thread_local! {
    static TEST_DNS: std::cell::RefCell<Option<std::rc::Rc<dyn DnsServers>>> =
        const { std::cell::RefCell::new(None) };
}

/// Routes this thread's DNS calls to `dns` (test builds only).
#[cfg(all(windows, test))]
pub(crate) fn set_test_dns(dns: Option<std::rc::Rc<dyn DnsServers>>) {
    TEST_DNS.with(|slot| *slot.borrow_mut() = dns);
}

#[cfg(windows)]
fn with_dns<T>(f: impl FnOnce(&dyn DnsServers) -> T) -> T {
    #[cfg(test)]
    if let Some(dns) = TEST_DNS.with(|slot| slot.borrow().clone()) {
        return f(&*dns);
    }
    f(&WinDns)
}

/// The adapter's IPv4 configuration as `(automatic, static servers)`. The DNS
/// client keeps static servers in `NameServer`; empty or absent is automatic.
#[cfg(windows)]
fn read_dns(guid: &str) -> Result<(bool, Vec<String>), String> {
    use crate::rollback::RegValue;
    use crate::tweaks::{windows_impl, Hive};
    let path = format!(r"{}\{guid}", crate::netlatency::INTERFACES_PATH);
    match windows_impl::read_value(
        Hive::Hklm,
        &path,
        "NameServer",
        &RegValue::Str(String::new()),
    )
    .map_err(|e| e.to_string())?
    {
        None => configured_dns(None),
        Some(RegValue::Str(value)) => configured_dns(Some(&value)),
        Some(RegValue::Dword(_)) => Err("The adapter has an unsupported DNS configuration".into()),
    }
}

/// New snapshots name the adapter by braced GUID; older builds wrote its alias.
#[cfg(windows)]
fn adapter_guid(dns: &dyn DnsServers, interface: &str) -> Result<String, String> {
    if interface.starts_with('{') && crate::rollback::valid_guid(interface) {
        Ok(interface.to_string())
    } else {
        dns.adapter_by_alias(interface)
    }
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;
    let existing = transaction.entry(TWEAK_ID);
    if matches!(
        existing,
        Some(SnapshotEntry::Dns {
            previous_automatic: None,
            ..
        })
    ) {
        return Err(LEGACY_MODE_UNKNOWN.into());
    }

    with_dns(|dns| {
        let guid = dns.internet_adapter()?;
        // A snapshot from an older build names the same adapter by alias.
        // Recording it under that name again keeps its original; a different
        // adapter is refused by save_entry until the old one is restored.
        let interface = match existing {
            Some(SnapshotEntry::Dns { interface, .. })
                if adapter_guid(dns, &interface).as_deref() == Ok(guid.as_str()) =>
            {
                interface
            }
            _ => guid.clone(),
        };
        let (automatic, previous) = read_dns(&guid)?;
        transaction.save_entry(
            TWEAK_ID,
            SnapshotEntry::Dns {
                interface,
                previous_servers: previous,
                previous_automatic: Some(automatic),
            },
        )?;
        let target = vec![PRIMARY_DNS.to_string(), SECONDARY_DNS.to_string()];
        dns.set_servers(&guid, &target)?;
        if read_dns(&guid)? != (false, target) {
            return Err(
                "DNS configuration could not be verified; the snapshot was retained".into(),
            );
        }
        Ok(())
    })
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(TWEAK_ID, |entry| {
        let SnapshotEntry::Dns {
            interface,
            previous_servers,
            previous_automatic,
        } = entry
        else {
            return Err("unexpected snapshot type for DNS".to_string());
        };
        let automatic = previous_automatic.ok_or(LEGACY_MODE_UNKNOWN)?;
        // Automatic snapshots record no servers; writing none is what
        // returns the adapter to DHCP.
        let servers = if automatic {
            Vec::new()
        } else {
            previous_servers
        };

        with_dns(|dns| {
            let guid = adapter_guid(dns, &interface)?;
            dns.set_servers(&guid, &servers)?;
            if read_dns(&guid)? != (automatic, servers) {
                return Err(
                    "Restored DNS configuration could not be verified; recovery data was retained"
                        .into(),
                );
            }
            Ok(())
        })
    })
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::mock_registry::{install, Fixture};
    use crate::rollback::RegValue;
    use crate::tweaks::Hive;
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;

    const ADAPTER: &str = "{4D36E972-E325-11CE-BFC1-08002BE10318}";
    const OTHER_ADAPTER: &str = "{4D36E972-E325-11CE-BFC1-08002BE10319}";

    /// Plays the DNS client: `NameServer` ends up in the installed registry
    /// the way `SetInterfaceDnsSettings` leaves it, comma-separated and empty
    /// for automatic.
    struct FakeDns {
        adapter: RefCell<String>,
        aliases: Vec<(&'static str, &'static str)>,
        /// Reports success without changing anything.
        drop_writes: Cell<bool>,
        deny_writes: Cell<bool>,
        writes: RefCell<Vec<(String, Vec<String>)>>,
    }

    impl DnsServers for FakeDns {
        fn internet_adapter(&self) -> Result<String, String> {
            Ok(self.adapter.borrow().clone())
        }
        fn adapter_by_alias(&self, alias: &str) -> Result<String, String> {
            self.aliases
                .iter()
                .find(|(name, _)| *name == alias)
                .map(|(_, guid)| guid.to_string())
                .ok_or_else(|| format!("no network adapter is named \"{alias}\" any more"))
        }
        fn set_servers(&self, guid: &str, servers: &[String]) -> Result<(), String> {
            if self.deny_writes.get() {
                return Err("Windows refused the DNS change (error 5)".into());
            }
            self.writes
                .borrow_mut()
                .push((guid.to_string(), servers.to_vec()));
            if self.drop_writes.get() {
                return Ok(());
            }
            crate::tweaks::windows_impl::write_value(
                Hive::Hklm,
                &path(guid),
                "NameServer",
                &RegValue::Str(servers.join(",")),
            )
        }
    }

    struct Installed(Rc<FakeDns>);

    impl std::ops::Deref for Installed {
        type Target = FakeDns;
        fn deref(&self) -> &FakeDns {
            &self.0
        }
    }

    impl Drop for Installed {
        fn drop(&mut self) {
            set_test_dns(None);
        }
    }

    fn install_dns() -> Installed {
        let dns = Rc::new(FakeDns {
            adapter: RefCell::new(ADAPTER.into()),
            aliases: vec![("Ethernet", ADAPTER)],
            drop_writes: Cell::new(false),
            deny_writes: Cell::new(false),
            writes: RefCell::default(),
        });
        set_test_dns(Some(dns.clone()));
        Installed(dns)
    }

    fn path(guid: &str) -> String {
        format!(r"{}\{guid}", crate::netlatency::INTERFACES_PATH)
    }

    fn name_server(registry: &crate::mock_registry::MemRegistry, guid: &str) -> Option<String> {
        match registry.get(Hive::Hklm, &path(guid), "NameServer") {
            Some(crate::mock_registry::Stored::Value(RegValue::Str(value))) => Some(value),
            None => None,
            other => panic!("unexpected NameServer: {other:?}"),
        }
    }

    fn seed(registry: &crate::mock_registry::MemRegistry, guid: &str, value: &str) {
        registry.set(
            Hive::Hklm,
            &path(guid),
            "NameServer",
            crate::mock_registry::Stored::Value(RegValue::Str(value.into())),
        );
    }

    fn legacy_entry(automatic: Option<bool>) -> SnapshotEntry {
        SnapshotEntry::Dns {
            interface: "Ethernet".into(),
            previous_servers: vec!["192.168.1.1".into()],
            previous_automatic: automatic,
        }
    }

    #[test]
    fn automatic_is_distinct_from_static_addresses() {
        assert_eq!(configured_dns(None).unwrap(), (true, vec![]));
        assert_eq!(configured_dns(Some(" ")).unwrap(), (true, vec![]));
        assert_eq!(
            configured_dns(Some("1.1.1.1, 1.0.0.1")).unwrap(),
            (false, vec!["1.1.1.1".into(), "1.0.0.1".into()])
        );
        assert!(configured_dns(Some("not-an-address")).is_err());
    }

    #[test]
    fn legacy_snapshots_preserve_unknown_mode() {
        let entry: SnapshotEntry = serde_json::from_str(
            r#"{"kind":"Dns","interface":"Ethernet","previous_servers":["192.168.1.1"]}"#,
        )
        .unwrap();
        assert!(matches!(
            entry,
            SnapshotEntry::Dns {
                previous_automatic: None,
                ..
            }
        ));
    }

    #[test]
    fn an_adapter_guid_parses_the_way_windows_prints_it() {
        let guid = parse_guid(ADAPTER).unwrap();
        assert_eq!(
            (guid.data1, guid.data2, guid.data3),
            (0x4D36E972, 0xE325, 0x11CE)
        );
        assert_eq!(guid.data4, [0xBF, 0xC1, 0x08, 0x00, 0x2B, 0xE1, 0x03, 0x18]);
        assert!(parse_guid("Ethernet").is_err());
    }

    #[test]
    fn static_servers_round_trip_to_the_exact_addresses() {
        let registry = install();
        let dns = install_dns();
        let fixture = Fixture::new();
        seed(&registry, ADAPTER, "192.168.1.1,8.8.4.4");
        let before = registry.dump();
        apply(&fixture.store).unwrap();
        assert_eq!(
            name_server(&registry, ADAPTER).as_deref(),
            Some("1.1.1.1,1.0.0.1")
        );
        assert!(matches!(
            fixture.snapshot(TWEAK_ID),
            Some(SnapshotEntry::Dns { interface, previous_servers, previous_automatic: Some(false) })
                if interface == ADAPTER && previous_servers == ["192.168.1.1", "8.8.4.4"]
        ));
        rollback(&fixture.store).unwrap();
        assert_eq!(registry.dump(), before);
        assert!(!fixture.store.is_applied(TWEAK_ID));
        assert_eq!(dns.writes.borrow().len(), 2);
    }

    /// Absent and empty `NameServer` both mean automatic; rollback asks the
    /// API for automatic DNS, which leaves the value empty.
    #[test]
    fn automatic_dns_round_trips_to_automatic() {
        for original in [None, Some("")] {
            let registry = install();
            let dns = install_dns();
            let fixture = Fixture::new();
            if let Some(value) = original {
                seed(&registry, ADAPTER, value);
            }
            apply(&fixture.store).unwrap();
            assert!(matches!(
                fixture.snapshot(TWEAK_ID),
                Some(SnapshotEntry::Dns { previous_automatic: Some(true), previous_servers, .. })
                    if previous_servers.is_empty()
            ));
            rollback(&fixture.store).unwrap();
            assert_eq!(
                dns.writes.borrow().last().unwrap(),
                &(ADAPTER.to_string(), vec![])
            );
            assert_eq!(name_server(&registry, ADAPTER).as_deref(), Some(""));
            assert!(!fixture.store.is_applied(TWEAK_ID));
        }
    }

    #[test]
    fn reapplying_after_drift_still_restores_the_first_original() {
        let registry = install();
        let _dns = install_dns();
        let fixture = Fixture::new();
        seed(&registry, ADAPTER, "192.168.1.1");
        apply(&fixture.store).unwrap();
        seed(&registry, ADAPTER, "9.9.9.9");
        apply(&fixture.store).unwrap();
        rollback(&fixture.store).unwrap();
        assert_eq!(
            name_server(&registry, ADAPTER).as_deref(),
            Some("192.168.1.1")
        );
    }

    #[test]
    fn a_write_that_does_not_stick_fails_and_keeps_the_journal() {
        let registry = install();
        let dns = install_dns();
        let fixture = Fixture::new();
        seed(&registry, ADAPTER, "192.168.1.1");
        dns.drop_writes.set(true);
        let error = apply(&fixture.store).unwrap_err();
        assert!(error.contains("could not be verified"), "{error}");
        assert!(fixture.store.is_applied(TWEAK_ID));
        assert_eq!(
            name_server(&registry, ADAPTER).as_deref(),
            Some("192.168.1.1")
        );
        // Nothing stuck, so putting the original back verifies at once.
        rollback(&fixture.store).unwrap();
        assert!(!fixture.store.is_applied(TWEAK_ID));

        // A restore that does not stick keeps the journal too.
        dns.drop_writes.set(false);
        apply(&fixture.store).unwrap();
        dns.drop_writes.set(true);
        let error = rollback(&fixture.store).unwrap_err();
        assert!(error.contains("could not be verified"), "{error}");
        assert!(fixture.store.is_applied(TWEAK_ID));
        dns.drop_writes.set(false);
        rollback(&fixture.store).unwrap();
        assert_eq!(
            name_server(&registry, ADAPTER).as_deref(),
            Some("192.168.1.1")
        );
    }

    #[test]
    fn a_failed_restore_keeps_the_journal_for_a_retry() {
        let registry = install();
        let dns = install_dns();
        let fixture = Fixture::new();
        seed(&registry, ADAPTER, "192.168.1.1");
        apply(&fixture.store).unwrap();
        dns.deny_writes.set(true);
        assert!(rollback(&fixture.store).is_err());
        assert!(fixture.store.is_applied(TWEAK_ID));
        dns.deny_writes.set(false);
        rollback(&fixture.store).unwrap();
        assert_eq!(
            name_server(&registry, ADAPTER).as_deref(),
            Some("192.168.1.1")
        );
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn a_different_internet_adapter_is_refused_until_the_first_is_restored() {
        let registry = install();
        let dns = install_dns();
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        *dns.adapter.borrow_mut() = OTHER_ADAPTER.into();
        assert!(apply(&fixture.store).is_err());
        assert_eq!(name_server(&registry, OTHER_ADAPTER), None);
        // Rollback still targets the adapter it changed.
        rollback(&fixture.store).unwrap();
        assert_eq!(name_server(&registry, ADAPTER).as_deref(), Some(""));
    }

    /// Journals written by older builds name the adapter by alias.
    #[test]
    fn legacy_alias_snapshots_roll_back_and_reapply_on_their_adapter() {
        let registry = install();
        let dns = install_dns();
        let fixture = Fixture::new();
        fixture
            .store
            .transaction()
            .unwrap()
            .save_entry(TWEAK_ID, legacy_entry(Some(false)))
            .unwrap();
        // Re-applying on the same adapter keeps the old record and its original.
        apply(&fixture.store).unwrap();
        assert!(matches!(
            fixture.snapshot(TWEAK_ID),
            Some(SnapshotEntry::Dns { interface, .. }) if interface == "Ethernet"
        ));
        rollback(&fixture.store).unwrap();
        assert_eq!(dns.writes.borrow().last().unwrap().0, ADAPTER);
        assert_eq!(
            name_server(&registry, ADAPTER).as_deref(),
            Some("192.168.1.1")
        );
        assert!(!fixture.store.is_applied(TWEAK_ID));

        // An alias that no longer resolves changes nothing and keeps the journal.
        let fixture = Fixture::new();
        let mut entry = legacy_entry(Some(false));
        if let SnapshotEntry::Dns { interface, .. } = &mut entry {
            *interface = "Wi-Fi".into();
        }
        fixture
            .store
            .transaction()
            .unwrap()
            .save_entry(TWEAK_ID, entry)
            .unwrap();
        let writes = dns.writes.borrow().len();
        assert!(rollback(&fixture.store).is_err());
        assert_eq!(dns.writes.borrow().len(), writes);
        assert!(fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn legacy_snapshots_without_a_mode_are_refused_before_any_write() {
        let registry = install();
        let dns = install_dns();
        let fixture = Fixture::new();
        fixture
            .store
            .transaction()
            .unwrap()
            .save_entry(TWEAK_ID, legacy_entry(None))
            .unwrap();
        for result in [apply(&fixture.store), rollback(&fixture.store)] {
            assert!(result.unwrap_err().contains("legacy DNS snapshot"));
        }
        assert!(dns.writes.borrow().is_empty());
        assert!(registry.dump().is_empty());
        assert!(fixture.store.is_applied(TWEAK_ID));
    }

    /// The safety net: with no fake installed, a unit test cannot change the
    /// DNS servers of the machine running it.
    #[test]
    fn unit_tests_cannot_change_real_dns_servers() {
        if std::env::var("PC_TWEAKER_EXPANSION_VM_TEST").as_deref()
            == Ok("I_ACKNOWLEDGE_DISPOSABLE_VM")
        {
            return;
        }
        let error = WinDns
            .set_servers(ADAPTER, &[PRIMARY_DNS.into()])
            .unwrap_err();
        assert!(error.contains("unit tests may not write"), "{error}");
    }
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
