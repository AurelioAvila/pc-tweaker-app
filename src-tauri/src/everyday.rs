//! Small, reversible Windows controls that do not require a separate settings UI.
use crate::rollback::{
    FilterKeysSnapshot, RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry,
};
use crate::tweaks::{windows_impl as registry, Hive};

pub const DISABLE_RESTART_APPS_ID: &str = "disable_restart_apps";
pub const ENABLE_LONG_PATHS_ID: &str = "enable_long_paths";
pub const DISABLE_FILTER_KEYS_SHORTCUT_ID: &str = "disable_filter_keys_shortcut";

const RESTART_PATH: &str = r"Software\Microsoft\Windows NT\CurrentVersion\Winlogon";
const LONG_PATH: &str = r"SYSTEM\CurrentControlSet\Control\FileSystem";
const HOTKEY_ACTIVE: u32 = 0x0000_0004;
const SPI_GETFILTERKEYS: u32 = 0x0032;
const SPI_SETFILTERKEYS: u32 = 0x0033;
const SPIF_UPDATEINIFILE: u32 = 0x0001;
const SPIF_SENDCHANGE: u32 = 0x0002;

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
struct FilterKeys {
    cb_size: u32,
    flags: u32,
    wait_ms: u32,
    delay_ms: u32,
    repeat_ms: u32,
    bounce_ms: u32,
}

#[link(name = "user32")]
extern "system" {
    fn SystemParametersInfoW(action: u32, param: u32, data: *mut FilterKeys, flags: u32) -> i32;
}

impl From<FilterKeys> for FilterKeysSnapshot {
    fn from(value: FilterKeys) -> Self {
        Self {
            flags: value.flags,
            wait_ms: value.wait_ms,
            delay_ms: value.delay_ms,
            repeat_ms: value.repeat_ms,
            bounce_ms: value.bounce_ms,
        }
    }
}

impl From<&FilterKeysSnapshot> for FilterKeys {
    fn from(value: &FilterKeysSnapshot) -> Self {
        Self {
            cb_size: std::mem::size_of::<Self>() as u32,
            flags: value.flags,
            wait_ms: value.wait_ms,
            delay_ms: value.delay_ms,
            repeat_ms: value.repeat_ms,
            bounce_ms: value.bounce_ms,
        }
    }
}

fn without_hotkey(mut value: FilterKeys) -> FilterKeys {
    value.flags &= !HOTKEY_ACTIVE;
    value
}

fn can_restore(original: FilterKeys, current: FilterKeys) -> bool {
    current == original || current == without_hotkey(original)
}

fn read_filter_keys() -> Result<FilterKeys, String> {
    let mut value = FilterKeys {
        cb_size: std::mem::size_of::<FilterKeys>() as u32,
        ..Default::default()
    };
    // SAFETY: `value` has the documented FILTERKEYS layout and remains writable for the call.
    if unsafe { SystemParametersInfoW(SPI_GETFILTERKEYS, value.cb_size, &mut value, 0) } == 0 {
        return Err(format!(
            "could not read Filter Keys: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(value)
}

fn write_filter_keys(value: FilterKeys) -> Result<(), String> {
    let mut value = value;
    // SAFETY: `value` has the documented FILTERKEYS layout and remains live for the call.
    if unsafe {
        SystemParametersInfoW(
            SPI_SETFILTERKEYS,
            value.cb_size,
            &mut value,
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
        )
    } == 0
    {
        return Err(format!(
            "could not set Filter Keys: {}",
            std::io::Error::last_os_error()
        ));
    }
    if read_filter_keys()? != value {
        return Err("Filter Keys verification failed; rollback snapshot was retained".into());
    }
    Ok(())
}

fn registry_target(id: &str) -> Result<(Hive, &'static str, &'static str, u32), String> {
    match id {
        DISABLE_RESTART_APPS_ID => Ok((Hive::Hkcu, RESTART_PATH, "RestartApps", 0)),
        ENABLE_LONG_PATHS_ID => Ok((Hive::Hklm, LONG_PATH, "LongPathsEnabled", 1)),
        _ => Err("unknown everyday tweak".into()),
    }
}

pub fn effective(id: &str) -> Result<bool, String> {
    if id == DISABLE_FILTER_KEYS_SHORTCUT_ID {
        return Ok(read_filter_keys()?.flags & HOTKEY_ACTIVE == 0);
    }
    let (hive, path, name, desired) = registry_target(id)?;
    Ok(registry::read_dword(hive, path, name).map_err(|e| e.to_string())? == Some(desired))
}

pub fn apply(id: &str, store: &RollbackStore) -> Result<(), String> {
    if id == DISABLE_FILTER_KEYS_SHORTCUT_ID {
        let mut transaction = store.transaction()?;
        let original = read_filter_keys()?;
        if let Some(SnapshotEntry::FilterKeys { original: saved }) = transaction.entry(id) {
            let expected = without_hotkey(FilterKeys::from(&saved));
            return if original == expected {
                Ok(())
            } else if original == FilterKeys::from(&saved) {
                write_filter_keys(expected)
            } else {
                Err("Filter Keys changed since application; restore or review it first".into())
            };
        }
        transaction.save_entry(
            id,
            SnapshotEntry::FilterKeys {
                original: original.into(),
            },
        )?;
        return write_filter_keys(without_hotkey(original));
    }
    let (hive, path, name, desired) = registry_target(id)?;
    let mut transaction = store.transaction()?;
    let original =
        registry::read_value(hive, path, name, &RegValue::Dword(0)).map_err(|e| e.to_string())?;
    transaction.save_entry(
        id,
        SnapshotEntry::Registry(RegistrySnapshot {
            hive: registry::hive_str(&hive).into(),
            path: path.into(),
            name: name.into(),
            original_value: original,
        }),
    )?;
    registry::write_dword(hive, path, name, desired)?;
    if !effective(id)? {
        return Err(
            "Windows did not report the requested setting; rollback snapshot was retained".into(),
        );
    }
    Ok(())
}

pub fn rollback(id: &str, store: &RollbackStore) -> Result<(), String> {
    if id == DISABLE_FILTER_KEYS_SHORTCUT_ID {
        return store.restore_entry(id, |entry| {
            let SnapshotEntry::FilterKeys { original } = entry else {
                return Err("unexpected Filter Keys snapshot".into());
            };
            let expected = without_hotkey(FilterKeys::from(&original));
            let current = read_filter_keys()?;
            if !can_restore(FilterKeys::from(&original), current) {
                return Err(
                    "Filter Keys changed since application; original snapshot retained for review"
                        .into(),
                );
            }
            if current == FilterKeys::from(&original) {
                return Ok(());
            }
            debug_assert_eq!(current, expected);
            write_filter_keys(FilterKeys::from(&original))
        });
    }
    registry_target(id)?;
    store.restore_entry(id, |entry| {
        let SnapshotEntry::Registry(snapshot) = entry else {
            return Err("unexpected registry snapshot".into());
        };
        registry::restore_value(&snapshot)
    })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub(crate) fn vm_guard(admin: bool) {
        assert_eq!(
            std::env::var("PC_TWEAKER_EXPANSION_VM_TEST").as_deref(),
            Ok("I_ACKNOWLEDGE_DISPOSABLE_VM")
        );
        assert_eq!(
            std::env::var("PC_TWEAKER_EXPANSION_VM_NAME").as_deref(),
            Ok("DEBLOAT-QA")
        );
        assert_eq!(std::env::var("COMPUTERNAME").as_deref(), Ok("DEBLOAT-QA"));
        assert_eq!(crate::elevation::is_elevated(), admin);
        let output = crate::system_tools::run("powershell", |tool| {
            tool.args(["-NoProfile", "-NonInteractive", "-Command", "$c=Get-CimInstance Win32_ComputerSystem; [pscustomobject]@{Manufacturer=$c.Manufacturer;Model=$c.Model} | ConvertTo-Json -Compress"]).output()
        }).expect("VM hardware query");
        assert!(output.status.success(), "VM hardware query failed");
        let hardware: serde_json::Value =
            serde_json::from_slice(&output.stdout).expect("VM hardware JSON");
        assert_eq!(hardware["Manufacturer"], "Microsoft Corporation");
        assert_eq!(hardware["Model"], "Virtual Machine");
    }

    fn vm_store(name: &str) -> RollbackStore {
        let dir = std::env::temp_dir().join(format!("pct-expansion-{name}-{}", std::process::id()));
        RollbackStore::new(dir)
    }

    #[test]
    fn filter_keys_round_trip_preserves_accessibility_configuration() {
        let original = FilterKeys {
            cb_size: 24,
            flags: 0x77,
            wait_ms: 100,
            delay_ms: 200,
            repeat_ms: 300,
            bounce_ms: 0,
        };
        let snapshot = FilterKeysSnapshot::from(original);
        let changed = without_hotkey(FilterKeys::from(&snapshot));
        assert_eq!(changed.flags, 0x73);
        assert_eq!(changed.wait_ms, original.wait_ms);
        assert_eq!(changed.delay_ms, original.delay_ms);
        assert_eq!(changed.repeat_ms, original.repeat_ms);
        assert_eq!(changed.bounce_ms, original.bounce_ms);
        assert_eq!(FilterKeys::from(&snapshot), original);
        let mut outside_change = changed;
        outside_change.repeat_ms += 1;
        assert!(can_restore(original, changed));
        assert!(can_restore(original, original));
        assert!(!can_restore(original, outside_change));
    }

    #[test]
    #[ignore = "current-user settings on disposable DEBLOAT-QA VM only"]
    fn vm_current_user_controls_apply_and_restore() {
        vm_guard(false);
        let store = vm_store("user");
        let old_restart =
            registry::read_value(Hive::Hkcu, RESTART_PATH, "RestartApps", &RegValue::Dword(0))
                .unwrap();
        let old_filter = read_filter_keys().unwrap();
        for id in [DISABLE_RESTART_APPS_ID, DISABLE_FILTER_KEYS_SHORTCUT_ID] {
            let applied = apply(id, &store).and_then(|_| effective(id));
            if store.is_applied(id) {
                rollback(id, &store).expect("VM restore");
            }
            assert!(applied.expect("VM apply/readback"), "{id}");
        }
        assert_eq!(
            registry::read_value(Hive::Hkcu, RESTART_PATH, "RestartApps", &RegValue::Dword(0))
                .unwrap(),
            old_restart
        );
        assert_eq!(read_filter_keys().unwrap(), old_filter);
    }

    #[test]
    #[ignore = "machine-wide policy on disposable DEBLOAT-QA VM only"]
    fn vm_long_paths_policy_apply_and_restore() {
        vm_guard(true);
        let store = vm_store("admin");
        let old = registry::read_value(
            Hive::Hklm,
            LONG_PATH,
            "LongPathsEnabled",
            &RegValue::Dword(0),
        )
        .unwrap();
        let applied =
            apply(ENABLE_LONG_PATHS_ID, &store).and_then(|_| effective(ENABLE_LONG_PATHS_ID));
        if store.is_applied(ENABLE_LONG_PATHS_ID) {
            rollback(ENABLE_LONG_PATHS_ID, &store).expect("VM restore");
        }
        assert!(applied.expect("VM apply/readback"));
        assert_eq!(
            registry::read_value(
                Hive::Hklm,
                LONG_PATH,
                "LongPathsEnabled",
                &RegValue::Dword(0)
            )
            .unwrap(),
            old
        );
    }
}
