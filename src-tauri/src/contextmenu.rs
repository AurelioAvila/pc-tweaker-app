//! Restores the Windows 10 style right-click menu in Windows 11.
//!
//! Windows 11 replaced the full context menu with a short one and buried the
//! rest behind "Show more options" (or Shift+F10). There is no setting for
//! it. The long-standing workaround is to register an empty in-process
//! handler for the CLSID of the new menu, which makes Explorer fail to load
//! it and fall back to the classic one.
//!
//! ## Why this is its own module rather than a `RegistryTweak`
//!
//! The generic registry tweak writes one named value and rolls back by
//! restoring — or deleting — that same value. This tweak's effect does not
//! come from a value at all: it comes from the **key existing** with an empty
//! default. Rolling it back by clearing the default value would leave the key
//! in place, and Explorer would keep using the classic menu — a rollback that
//! reports success while changing nothing. So the whole key has to go, which
//! needs the `RegistryKeyCreated` snapshot variant.

use crate::rollback::{RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "classic_context_menu";

pub struct ContextMenuInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn info() -> ContextMenuInfo {
    ContextMenuInfo {
        id: TWEAK_ID,
        name: "Bring back the full right-click menu",
        description: "Windows 11 hides most of the right-click menu behind \"Show more options\", turning one click into two for things you do all day. This restores the complete Windows 10 menu everywhere in File Explorer and on the desktop. Explorer restarts to apply it, so open windows will flicker once (HKCU, no elevation required).",
        requires_admin: false,
        requires_pro: false,
    }
}

const HIVE: &str = "HKCU";
/// The CLSID of the Windows 11 context menu implementation. Registering it
/// with an empty InprocServer32 is what makes Explorer fall back.
pub(crate) const CLSID_PATH: &str =
    r"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}";
pub(crate) const INPROC_PATH: &str =
    r"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32";

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    use crate::rollback::RegValue;
    use crate::tweaks::{windows_impl as registry, Hive};

    let mut transaction = store.transaction()?;

    // Already journaled as ours: nothing to do while the override is in
    // place. If it is not (a first apply that failed after the journal, or a
    // key someone removed), writing it again repairs it instead of reporting
    // success with the short menu still there.
    if transaction.entry(TWEAK_ID).is_some() {
        let in_place = registry::read_value(Hive::Hkcu, INPROC_PATH, "", &RegValue::Str(String::new()))
            .map_err(|e| format!("could not inspect the shell override: {e}"))?;
        if in_place == Some(RegValue::Str(String::new())) {
            return Ok(());
        }
    } else {
        // Recorded before creating anything: if the user already had this key
        // for their own reasons, rollback must not delete work that wasn't ours.
        match registry::key_exists(Hive::Hkcu, CLSID_PATH) {
            Ok(false) => {}
            Err(e) => return Err(format!("could not inspect the shell override: {e}")),
            Ok(true) => {
                return Err(
                    "this key already exists on your system — PC Tweaker won't overwrite a shell \
                 override it didn't create"
                        .to_string(),
                );
            }
        }

        transaction.save_entry(
            TWEAK_ID,
            SnapshotEntry::RegistryKeyCreated {
                hive: HIVE.to_string(),
                path: CLSID_PATH.to_string(),
            },
        )?;
    }

    registry::create_key(Hive::Hkcu, INPROC_PATH)
        .map_err(|e| format!("could not create the shell override key: {}", e))?;

    // The default (unnamed) value, deliberately empty: Explorer tries to load
    // a DLL from here, finds nothing, and falls back to the classic menu.
    // write_value reads it back, so a write that did not stick fails here.
    registry::write_value(Hive::Hkcu, INPROC_PATH, "", &RegValue::Str(String::new()))
        .map_err(|e| format!("could not write the shell override: {e}"))?;

    restart_explorer();
    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    use crate::tweaks::{windows_impl as registry, Hive};

    store.restore_entry(TWEAK_ID, |entry| {
        let SnapshotEntry::RegistryKeyCreated { path, .. } = entry else {
            return Err("unexpected snapshot type for the context menu tweak".to_string());
        };

        // Deletes the CLSID key and the InprocServer32 subkey under it. Missing
        // is fine — the user may have removed it by hand, and the end state is
        // what we wanted either way.
        registry::delete_tree(Hive::Hkcu, &path)
            .map_err(|e| format!("could not remove the shell override: {}", e))?;
        match registry::key_exists(Hive::Hkcu, &path) {
            Ok(false) => {}
            Err(e) => {
                return Err(format!(
                    "could not verify removal of the shell override: {e}"
                ))
            }
            Ok(true) => {
                return Err("the shell override still exists; the snapshot was retained".into())
            }
        }

        restart_explorer();
        Ok(())
    })
}

/// Explorer reads this override once at startup, so the change is invisible
/// until it restarts. Doing it for the user avoids "nothing happened" being
/// the first impression of a tweak that did in fact work.
///
/// Failure here is deliberately not an error: the registry change is already
/// committed and correct at that point, and it will take effect at the next
/// sign-in regardless. Failing the whole tweak over a cosmetic refresh would
/// leave the user with a scary message about a change that actually landed.
#[cfg(windows)]
fn restart_explorer() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    // Unit tests drive apply and rollback against the in-memory registry;
    // they must never kill the desktop of whoever runs them.
    if cfg!(test) {
        return;
    }

    let killed = crate::system_tools::run("taskkill", |tool| {
        tool.args(["/f", "/im", "explorer.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
    });

    if killed.is_ok() {
        // Windows normally relaunches Explorer on its own; starting it
        // explicitly covers the configurations where it doesn't, and a second
        // instance is not spawned if one is already back up.
        let _ = crate::system_tools::run("explorer.exe", |tool| {
            tool.creation_flags(CREATE_NO_WINDOW).spawn()
        });
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

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::mock_registry::{install, Fixture, MemRegistry, Stored};
    use crate::rollback::RegValue;
    use crate::tweaks::Hive;

    /// The paths must nest correctly: deleting the CLSID key has to take the
    /// InprocServer32 key with it, or rollback would leave the override
    /// half-present. Cheap to assert, and the kind of typo that would only
    /// surface as "the classic menu came back on its own" months later.
    #[test]
    fn the_inproc_key_lives_under_the_clsid_key_that_rollback_deletes() {
        assert!(
            INPROC_PATH.starts_with(CLSID_PATH),
            "InprocServer32 path must be inside the CLSID key that rollback removes"
        );
        assert_ne!(INPROC_PATH, CLSID_PATH);
    }

    /// Guards the one thing that makes this tweak work at all. If the GUID
    /// were ever mistyped, the app would create a meaningless key, report
    /// success, and change nothing the user can see.
    #[test]
    fn the_clsid_is_the_windows_11_context_menu_one() {
        assert!(CLSID_PATH.contains("{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}"));
    }

    fn override_value(registry: &MemRegistry) -> Option<Stored> {
        registry.get(Hive::Hkcu, INPROC_PATH, "")
    }

    #[test]
    fn the_override_round_trips_through_the_funnel() {
        let registry = install();
        let fixture = Fixture::new();
        crate::apply_by_id_inner(&fixture.store, &fixture.dir, TWEAK_ID).unwrap();
        assert_eq!(
            override_value(&registry),
            Some(Stored::Value(RegValue::Str(String::new())))
        );
        assert!(matches!(fixture.snapshot(TWEAK_ID),
            Some(SnapshotEntry::RegistryKeyCreated { hive, path }) if hive == "HKCU" && path == CLSID_PATH));
        crate::rollback_by_id_inner(&fixture.store, TWEAK_ID).unwrap();
        assert!(!registry.has_key(Hive::Hkcu, CLSID_PATH));
        assert!(registry.dump().is_empty());
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    /// Rollback deletes the whole key, so a key that was already there must
    /// never be adopted: that would delete the user's own override later.
    #[test]
    fn a_key_that_already_existed_is_refused_before_any_write() {
        for existing in [INPROC_PATH, CLSID_PATH] {
            let registry = install();
            let fixture = Fixture::new();
            registry.set(
                Hive::Hkcu,
                existing,
                "",
                Stored::Value(RegValue::Str("theirs".into())),
            );
            let before = registry.dump();
            let error = apply(&fixture.store).unwrap_err();
            assert!(error.contains("already exists"), "{error}");
            assert_eq!(registry.mutations.get(), 0);
            assert_eq!(registry.dump(), before);
            assert!(!fixture.store.is_applied(TWEAK_ID));
        }
    }

    #[test]
    fn reapplying_is_idempotent() {
        let registry = install();
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        let (after, writes) = (registry.dump(), registry.mutations.get());
        apply(&fixture.store).unwrap();
        assert_eq!(registry.mutations.get(), writes);
        assert_eq!(registry.dump(), after);
        rollback(&fixture.store).unwrap();
        assert!(!registry.has_key(Hive::Hkcu, CLSID_PATH));
    }

    /// A journal whose key went missing (a failed first apply, or removed by
    /// hand) is repaired by applying again, not reported as done.
    #[test]
    fn reapplying_repairs_a_missing_override() {
        let registry = install();
        let fixture = Fixture::new();
        apply(&fixture.store).unwrap();
        crate::tweaks::RegistryBackend::delete_tree(&*registry, Hive::Hkcu, CLSID_PATH).unwrap();
        apply(&fixture.store).unwrap();
        assert!(registry.has_key(Hive::Hkcu, INPROC_PATH));
        rollback(&fixture.store).unwrap();
        assert!(!registry.has_key(Hive::Hkcu, CLSID_PATH));
    }

    #[test]
    fn a_write_that_does_not_stick_fails_the_apply_and_keeps_the_journal() {
        let registry = install();
        let fixture = Fixture::new();
        registry.drop_writes.set(true);
        let error = apply(&fixture.store).unwrap_err();
        assert!(error.contains("verification failed"), "{error}");
        assert!(fixture.store.is_applied(TWEAK_ID));
        assert!(!registry.has_key(Hive::Hkcu, CLSID_PATH));
        // Nothing was created, so the rollback verifies at once.
        rollback(&fixture.store).unwrap();
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn a_denied_write_keeps_the_journal_and_rolls_back_cleanly() {
        let registry = install();
        let fixture = Fixture::new();
        registry.deny_writes.set(true);
        assert!(apply(&fixture.store).is_err());
        assert!(fixture.store.is_applied(TWEAK_ID));
        assert!(registry.dump().is_empty());
        registry.deny_writes.set(false);
        rollback(&fixture.store).unwrap();
        assert!(!fixture.store.is_applied(TWEAK_ID));
    }

    #[test]
    fn a_failed_removal_keeps_the_journal_for_a_retry() {
        for denied in [true, false] {
            let registry = install();
            let fixture = Fixture::new();
            apply(&fixture.store).unwrap();
            if denied {
                registry.deny_writes.set(true);
            } else {
                registry.drop_writes.set(true);
            }
            let error = rollback(&fixture.store).unwrap_err();
            assert!(denied || error.contains("still exists"), "{error}");
            assert!(fixture.store.is_applied(TWEAK_ID));
            assert!(override_value(&registry).is_some());
            registry.deny_writes.set(false);
            registry.drop_writes.set(false);
            rollback(&fixture.store).unwrap();
            assert!(registry.dump().is_empty());
            assert!(!fixture.store.is_applied(TWEAK_ID));
        }
    }
}
