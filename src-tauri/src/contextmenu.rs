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
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Recorded before creating anything: if the user already had this key for
    // their own reasons, rollback must not delete work that wasn't ours.
    if hkcu.open_subkey(CLSID_PATH).is_ok() {
        return Err(
            "this key already exists on your system — PC Tweaker won't overwrite a shell \
             override it didn't create"
                .to_string(),
        );
    }

    let (key, _) = hkcu
        .create_subkey(INPROC_PATH)
        .map_err(|e| format!("could not create the shell override key: {}", e))?;

    // The default (unnamed) value, deliberately empty: Explorer tries to load
    // a DLL from here, finds nothing, and falls back to the classic menu.
    key.set_value("", &"")
        .map_err(|e| format!("could not write the override: {}", e))?;

    store
        .save_entry(
            TWEAK_ID,
            SnapshotEntry::RegistryKeyCreated {
                hive: HIVE.to_string(),
                path: CLSID_PATH.to_string(),
            },
        )
        .map_err(|e| e.to_string())?;

    restart_explorer();
    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let entry = store
        .take_entry(TWEAK_ID)
        .ok_or_else(|| "no snapshot saved: the tweak does not appear to be applied".to_string())?;

    let SnapshotEntry::RegistryKeyCreated { path, .. } = entry else {
        return Err("unexpected snapshot type for the context menu tweak".to_string());
    };

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    // Deletes the CLSID key and the InprocServer32 subkey under it. Missing
    // is fine — the user may have removed it by hand, and the end state is
    // what we wanted either way.
    match hkcu.delete_subkey_all(&path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(format!("could not remove the shell override: {}", e)),
    }

    restart_explorer();
    Ok(())
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

    let killed = std::process::Command::new("taskkill")
        .args(["/f", "/im", "explorer.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    if killed.is_ok() {
        // Windows normally relaunches Explorer on its own; starting it
        // explicitly covers the configurations where it doesn't, and a second
        // instance is not spawned if one is already back up.
        let _ = std::process::Command::new("explorer.exe")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
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
}
