//! Explicit AC-only power policy experiments. No automatic recommendations.
//! Values and GUIDs come from Windows power policy definitions, not timing hacks.
//! Restoration writes the prior effective AC value through the same API. It
//! leaves an explicit plan value if the original value was inherited. Clearing
//! one inherited override is not exposed by the documented power API; do not
//! alter protected registry ACLs or reset an entire plan to simulate it.
use crate::rollback::{RollbackStore, SnapshotEntry};

pub struct PowerTweak {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub subgroup: &'static str,
    pub setting: &'static str,
    pub value: u32,
    pub maximum: u32,
    pub hybrid: bool,
    pub pro: bool,
}

pub const TWEAKS: [PowerTweak; 5] = [
    PowerTweak { id: "cpu_energy_performance", name: "Favor CPU performance on mains power", description: "Sets the CPU energy-performance preference to 0 on mains power. Requires autonomous CPPC support; firmware and thermal limits still apply. Can increase power use and heat. Battery settings are unchanged. Compare your own workload before keeping this change.", subgroup: crate::gaming::SUB_PROCESSOR_GUID, setting: "36687f9e-e3a5-4dbf-b1dc-15eb381c6863", value: 0, maximum: 100, hybrid: false, pro: false },
    PowerTweak { id: "pcie_link_power", name: "Keep PCIe links active on mains power", description: "Disables PCIe Active State Power Management in the current plan on mains power. A troubleshooting option for devices affected by link power transitions, not a guaranteed latency improvement. Can increase idle power use. Battery settings are unchanged.", subgroup: "501a4d13-42af-4429-9fd1-a8218c268e20", setting: "ee12f906-d277-404b-b6da-e5fa1a576df5", value: 0, maximum: 2, hybrid: false, pro: true },
    PowerTweak { id: "usb_suspend_diagnostics", name: "USB wake troubleshooting on mains power", description: "Temporarily disables USB selective suspend in the current plan on mains power to investigate device wake or disconnect problems. Windows recommends leaving selective suspend enabled normally. Restore after testing; idle power use may increase. Battery settings are unchanged.", subgroup: "2a737441-1930-4402-8d77-b2bebba308a3", setting: "48e6b7a6-50f5-4782-a5d4-53bb8f07e226", value: 0, maximum: 1, hybrid: false, pro: false },
    PowerTweak { id: "hybrid_short_threads", name: "Prefer performance cores for short threads", description: "On a CPU with different efficiency classes, asks Windows to prefer performant cores for short-running threads while plugged in. This is a scheduler preference, not a fixed affinity mask. Automatic scheduling may work better for your workload. Battery settings are unchanged.", subgroup: crate::gaming::SUB_PROCESSOR_GUID, setting: "bae08b81-2d5e-4688-ad6a-13243356654b", value: 2, maximum: 5, hybrid: true, pro: true },
    PowerTweak { id: "hybrid_long_threads", name: "Prefer performance cores for long threads", description: "On a CPU with different efficiency classes, asks Windows to prefer performant cores for long-running threads while plugged in. Other cores remain available; this does not disable E-cores or replace Thread Director. Test throughput and responsiveness before keeping it. Battery settings are unchanged.", subgroup: crate::gaming::SUB_PROCESSOR_GUID, setting: "93b8b6dc-0698-4d1c-9ee4-0644e900c85d", value: 2, maximum: 5, hybrid: true, pro: true },
];

pub fn find(id: &str) -> Option<&'static PowerTweak> {
    TWEAKS.iter().find(|t| t.id == id)
}

pub fn valid_snapshot(t: &PowerTweak, entry: &SnapshotEntry) -> bool {
    matches!(entry, SnapshotEntry::PowerAcSetting { scheme_guid, subgroup_guid, setting_guid, original_value }
        if crate::rollback::valid_guid(scheme_guid) && subgroup_guid.eq_ignore_ascii_case(t.subgroup)
            && setting_guid.eq_ignore_ascii_case(t.setting) && *original_value <= t.maximum)
}

trait PowerBackend {
    fn active(&self) -> Result<String, String>;
    fn supported(&self, scheme: &str, t: &PowerTweak) -> Result<(), String>;
    fn read_value(&self, scheme: &str, t: &PowerTweak) -> Result<u32, String>;
    fn write_value(&self, scheme: &str, t: &PowerTweak, value: u32) -> Result<(), String>;
    fn refresh_if_active(&self, scheme: &str) -> Result<(), String>;
}

fn apply_with(
    store: &RollbackStore,
    t: &PowerTweak,
    api: &impl PowerBackend,
) -> Result<(), String> {
    let mut transaction = store.transaction()?;
    let scheme = api.active()?;
    api.supported(&scheme, t)?;
    let original_value = api.read_value(&scheme, t)?;
    transaction.save_entry(
        t.id,
        SnapshotEntry::PowerAcSetting {
            scheme_guid: scheme.clone(),
            subgroup_guid: t.subgroup.into(),
            setting_guid: t.setting.into(),
            original_value,
        },
    )?;
    api.write_value(&scheme, t, t.value)?;
    if api.read_value(&scheme, t)? != t.value {
        return Err("Power setting verification failed; recovery data was retained".into());
    }
    api.refresh_if_active(&scheme)
}

fn restore_with(
    store: &RollbackStore,
    t: &PowerTweak,
    api: &impl PowerBackend,
) -> Result<(), String> {
    store.restore_entry(t.id, |entry| {
        let SnapshotEntry::PowerAcSetting {
            scheme_guid,
            original_value,
            ..
        } = entry
        else {
            return Err("Unexpected power snapshot".into());
        };
        api.write_value(&scheme_guid, t, original_value)?;
        if api.read_value(&scheme_guid, t)? != original_value {
            return Err(
                "Power restoration could not be verified; recovery data was retained".into(),
            );
        }
        api.refresh_if_active(&scheme_guid)
    })
}

#[cfg(windows)]
mod native {
    use super::*;
    use windows_sys::{
        core::GUID,
        Win32::{Foundation::LocalFree, System::Power::*},
    };
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};

    pub(super) fn guid(value: &str) -> Result<GUID, String> {
        if !crate::rollback::valid_guid(value) {
            return Err("Invalid power policy GUID".into());
        }
        u128::from_str_radix(&value.replace('-', ""), 16)
            .map(GUID::from_u128)
            .map_err(|_| "Invalid GUID".into())
    }
    pub(super) fn checked(code: u32) -> Result<(), String> {
        if code == 0 {
            Ok(())
        } else {
            Err(format!("Windows power policy error {code}; the setting may be unavailable or managed by an administrator"))
        }
    }
    pub(super) struct WindowsPower;
    impl PowerBackend for WindowsPower {
        fn active(&self) -> Result<String, String> {
            let mut ptr = std::ptr::null_mut();
            unsafe {
                checked(PowerGetActiveScheme(std::ptr::null_mut(), &mut ptr))?;
                if ptr.is_null() {
                    return Err("Windows did not return a power scheme".into());
                }
                let g = *ptr;
                LocalFree(ptr.cast());
                Ok(format!(
                    "{:08x}-{:04x}-{:04x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
                    g.data1,
                    g.data2,
                    g.data3,
                    g.data4[0],
                    g.data4[1],
                    g.data4[2],
                    g.data4[3],
                    g.data4[4],
                    g.data4[5],
                    g.data4[6],
                    g.data4[7]
                ))
            }
        }
        fn supported(&self, scheme: &str, t: &PowerTweak) -> Result<(), String> {
            if t.hybrid && !hybrid_cpu()? {
                return Err("This setting requires a CPU with different efficiency classes. No settings were changed.".into());
            }
            let (s, group, setting) = (guid(scheme)?, guid(t.subgroup)?, guid(t.setting)?);
            let mut value = 0;
            unsafe {
                checked(PowerReadACValueIndex(
                    std::ptr::null_mut(),
                    &s,
                    &group,
                    &setting,
                    &mut value,
                ))?;
            }
            if value > t.maximum {
                return Err("Windows returned an unsupported policy value".into());
            }
            Ok(())
        }
        fn read_value(&self, scheme: &str, t: &PowerTweak) -> Result<u32, String> {
            let (s, group, setting) = (guid(scheme)?, guid(t.subgroup)?, guid(t.setting)?);
            let mut value = 0;
            unsafe {
                checked(PowerReadACValueIndex(
                    std::ptr::null_mut(),
                    &s,
                    &group,
                    &setting,
                    &mut value,
                ))?;
            }
            if value > t.maximum {
                return Err("Windows returned an unsupported policy value".into());
            }
            Ok(value)
        }
        fn write_value(&self, scheme: &str, t: &PowerTweak, value: u32) -> Result<(), String> {
            let (s, group, setting) = (guid(scheme)?, guid(t.subgroup)?, guid(t.setting)?);
            // Never recreate a deleted plan. Read-only inspection requires no
            // registry ACL changes; all policy writes go through Windows APIs.
            RegKey::predef(HKEY_LOCAL_MACHINE)
                .open_subkey(format!(
                    r"SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes\{scheme}"
                ))
                .map_err(|_| {
                    "The original power plan no longer exists; recovery data was retained"
                })?;
            if value > t.maximum {
                return Err("Power policy is outside its allowed range".into());
            }
            unsafe {
                checked(PowerWriteACValueIndex(
                    std::ptr::null_mut(),
                    &s,
                    &group,
                    &setting,
                    value,
                ))?;
            }
            if self.read_value(scheme, t)? != value {
                return Err("Windows did not retain the requested power policy".into());
            }
            Ok(())
        }
        fn refresh_if_active(&self, scheme: &str) -> Result<(), String> {
            if self.active()?.eq_ignore_ascii_case(scheme) {
                unsafe {
                    checked(PowerSetActiveScheme(std::ptr::null_mut(), &guid(scheme)?))?;
                }
            }
            Ok(())
        }
    }

    fn hybrid_cpu() -> Result<bool, String> {
        use windows_sys::Win32::System::SystemInformation::{
            CpuSetInformation, GetSystemCpuSetInformation, SYSTEM_CPU_SET_INFORMATION,
        };
        let mut needed = 0;
        unsafe {
            GetSystemCpuSetInformation(
                std::ptr::null_mut(),
                0,
                &mut needed,
                std::ptr::null_mut(),
                0,
            );
        }
        if needed == 0 || needed > 1_048_576 {
            return Err("CPU scheduling topology could not be read".into());
        }
        let mut data = vec![0u64; (needed as usize).div_ceil(8)];
        let capacity = data.len() * 8;
        if unsafe {
            GetSystemCpuSetInformation(
                data.as_mut_ptr().cast(),
                capacity as u32,
                &mut needed,
                std::ptr::null_mut(),
                0,
            )
        } == 0
            || needed as usize > capacity
        {
            return Err("CPU scheduling topology changed; try again".into());
        }
        let mut offset = 0usize;
        let mut classes = std::collections::BTreeSet::new();
        while offset < needed as usize {
            if offset + 8 > needed as usize {
                return Err("Incomplete CPU topology".into());
            }
            let ptr = unsafe { data.as_ptr().cast::<u8>().add(offset) };
            let size = unsafe { std::ptr::read_unaligned(ptr.cast::<u32>()) } as usize;
            if size < std::mem::size_of::<SYSTEM_CPU_SET_INFORMATION>()
                || offset + size > needed as usize
            {
                return Err("Invalid CPU topology record".into());
            }
            let info =
                unsafe { std::ptr::read_unaligned(ptr.cast::<SYSTEM_CPU_SET_INFORMATION>()) };
            if info.Type == CpuSetInformation {
                classes.insert(unsafe { info.Anonymous.CpuSet.EfficiencyClass });
            }
            offset += size;
        }
        Ok(classes.len() > 1)
    }
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore, id: &str) -> Result<(), String> {
    apply_with(
        store,
        find(id).ok_or("Unknown power tweak")?,
        &native::WindowsPower,
    )
}
#[cfg(windows)]
pub fn rollback(store: &RollbackStore, id: &str) -> Result<(), String> {
    restore_with(
        store,
        find(id).ok_or("Unknown power tweak")?,
        &native::WindowsPower,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    struct Fake {
        value: Cell<u32>,
        fail_write: Cell<bool>,
        unsupported: bool,
    }
    const PLAN: &str = "381b4222-f694-41f0-9685-ff5bb260df2e";
    impl PowerBackend for Fake {
        fn active(&self) -> Result<String, String> {
            Ok(PLAN.into())
        }
        fn supported(&self, _: &str, _: &PowerTweak) -> Result<(), String> {
            if self.unsupported {
                Err("unsupported".into())
            } else {
                Ok(())
            }
        }
        fn read_value(&self, _: &str, _: &PowerTweak) -> Result<u32, String> {
            Ok(self.value.get())
        }
        fn write_value(&self, scheme: &str, _: &PowerTweak, v: u32) -> Result<(), String> {
            assert_eq!(scheme, PLAN);
            if self.fail_write.get() {
                return Err("write failed".into());
            }
            self.value.set(v);
            Ok(())
        }
        fn refresh_if_active(&self, _: &str) -> Result<(), String> {
            Ok(())
        }
    }
    fn fixture() -> (std::path::PathBuf, RollbackStore, Fake) {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "pct-power-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        (
            dir.clone(),
            RollbackStore::new(dir),
            Fake {
                value: Cell::new(50),
                fail_write: Cell::new(false),
                unsupported: false,
            },
        )
    }
    #[test]
    fn reapplied_changes_restore_the_first_value() {
        let (d, s, a) = fixture();
        let t = &TWEAKS[0];
        apply_with(&s, t, &a).unwrap();
        apply_with(&s, t, &a).unwrap();
        restore_with(&s, t, &a).unwrap();
        assert_eq!(a.value.get(), 50);
        assert!(!s.is_applied(t.id));
        std::fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn zero_is_restored_as_a_real_policy_value() {
        let (d, s, a) = fixture();
        a.value.set(0);
        apply_with(&s, &TWEAKS[0], &a).unwrap();
        restore_with(&s, &TWEAKS[0], &a).unwrap();
        assert_eq!(a.value.get(), 0);
        std::fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn failed_apply_keeps_original_and_failed_restore_keeps_journal() {
        let (d, s, a) = fixture();
        a.fail_write.set(true);
        assert!(apply_with(&s, &TWEAKS[0], &a).is_err());
        assert!(s.is_applied(TWEAKS[0].id));
        assert!(restore_with(&s, &TWEAKS[0], &a).is_err());
        assert!(s.is_applied(TWEAKS[0].id));
        a.fail_write.set(false);
        restore_with(&s, &TWEAKS[0], &a).unwrap();
        assert_eq!(a.value.get(), 50);
        std::fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn unsupported_hardware_never_writes_a_snapshot() {
        let (d, s, mut a) = fixture();
        a.unsupported = true;
        assert!(apply_with(&s, &TWEAKS[3], &a).is_err());
        assert!(s.applied_ids().unwrap().is_empty());
        assert_eq!(a.value.get(), 50);
        std::fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn forged_target_or_out_of_range_original_is_rejected() {
        let t = &TWEAKS[1];
        let mut e = SnapshotEntry::PowerAcSetting {
            scheme_guid: PLAN.into(),
            subgroup_guid: t.subgroup.into(),
            setting_guid: TWEAKS[0].setting.into(),
            original_value: 0,
        };
        assert!(crate::rollback::validate_snapshot(t.id, &e).is_err());
        if let SnapshotEntry::PowerAcSetting {
            setting_guid,
            original_value,
            ..
        } = &mut e
        {
            *setting_guid = t.setting.into();
            *original_value = 100;
        }
        assert!(crate::rollback::validate_snapshot(t.id, &e).is_err());
    }

    /// Explicit opt-in: modifies only a newly duplicated, INACTIVE plan and
    /// deletes it afterwards. Never switches away from the user's active plan.
    #[cfg(windows)]
    #[test]
    #[ignore = "explicit Windows API integration on a disposable inactive plan"]
    fn inactive_windows_plan_roundtrip() {
        use windows_sys::Win32::{Foundation::LocalFree, System::Power::*};
        let original = native::WindowsPower.active().unwrap();
        let mut duplicated = std::ptr::null_mut();
        unsafe {
            native::checked(PowerDuplicateScheme(
                std::ptr::null_mut(),
                &native::guid(&original).unwrap(),
                &mut duplicated,
            ))
            .unwrap();
        }
        assert!(!duplicated.is_null());
        let g = unsafe { *duplicated };
        unsafe {
            LocalFree(duplicated.cast());
        }
        let clone = format!(
            "{:08x}-{:04x}-{:04x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
            g.data1,
            g.data2,
            g.data3,
            g.data4[0],
            g.data4[1],
            g.data4[2],
            g.data4[3],
            g.data4[4],
            g.data4[5],
            g.data4[6],
            g.data4[7]
        );
        assert_ne!(clone, original);
        struct Disposable(String);
        impl Drop for Disposable {
            fn drop(&mut self) {
                if native::WindowsPower.active().ok().as_deref() != Some(&self.0) {
                    unsafe {
                        let result = PowerDeleteScheme(
                            std::ptr::null_mut(),
                            &native::guid(&self.0).unwrap(),
                        );
                        assert_eq!(result, 0, "Temporary plan cleanup failed");
                    }
                }
            }
        }
        let _cleanup = Disposable(clone.clone());
        struct Inactive(String);
        impl PowerBackend for Inactive {
            fn active(&self) -> Result<String, String> {
                Ok(self.0.clone())
            }
            fn supported(&self, scheme: &str, t: &PowerTweak) -> Result<(), String> {
                // Test policy I/O even on a homogeneous host; production's
                // hybrid topology gate remains enabled in WindowsPower.
                let s = native::guid(scheme)?;
                let mut v = 0;
                unsafe {
                    native::checked(PowerReadACValueIndex(
                        std::ptr::null_mut(),
                        &s,
                        &native::guid(t.subgroup)?,
                        &native::guid(t.setting)?,
                        &mut v,
                    ))
                }
            }
            fn read_value(&self, s: &str, t: &PowerTweak) -> Result<u32, String> {
                native::WindowsPower.read_value(s, t)
            }
            fn write_value(&self, s: &str, t: &PowerTweak, v: u32) -> Result<(), String> {
                assert_eq!(s, self.0);
                assert_ne!(s, native::WindowsPower.active()?);
                native::WindowsPower.write_value(s, t, v)
            }
            fn refresh_if_active(&self, s: &str) -> Result<(), String> {
                assert_ne!(s, native::WindowsPower.active()?);
                native::WindowsPower.refresh_if_active(s)
            }
        }
        let (directory, store, _) = fixture();
        let api = Inactive(clone.clone());
        for t in &TWEAKS {
            let before = api.read_value(&clone, t).unwrap();
            let mut dc_before = 0;
            let mut dc_after = 0;
            unsafe {
                native::checked(PowerReadDCValueIndex(
                    std::ptr::null_mut(),
                    &g,
                    &native::guid(t.subgroup).unwrap(),
                    &native::guid(t.setting).unwrap(),
                    &mut dc_before,
                ))
                .unwrap();
            }
            apply_with(&store, t, &api).unwrap();
            assert_eq!(api.read_value(&clone, t).unwrap(), t.value);
            restore_with(&store, t, &api).unwrap();
            assert_eq!(api.read_value(&clone, t).unwrap(), before);
            unsafe {
                native::checked(PowerReadDCValueIndex(
                    std::ptr::null_mut(),
                    &g,
                    &native::guid(t.subgroup).unwrap(),
                    &native::guid(t.setting).unwrap(),
                    &mut dc_after,
                ))
                .unwrap();
            }
            assert_eq!(dc_before, dc_after, "Battery policy changed for {}", t.id);
            assert_eq!(native::WindowsPower.active().unwrap(), original);
            println!(
                "Verified native AC apply/restore, unchanged DC and active plan: {}",
                t.id
            );
        }
        assert!(store.applied_ids().unwrap().is_empty());
        std::fs::remove_dir_all(directory).unwrap();
    }
}
