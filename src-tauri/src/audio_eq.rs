//! Equalizer APO health, read-only (AUDIO-SPEC 6.4). Equalizer APO is a
//! free, open-source third-party program by Jonas Thedering, not part of PC
//! Tweaker: this module only reads where its installer and its Device
//! Selector left their marks, with the same rules as its own
//! `DeviceAPOInfo.cpp`, and can open the user's installed Device Selector on
//! an explicit click. It never downloads, installs or configures anything.

use crate::audio::{Eapo, EqState};
use std::collections::HashSet;

/// Its pre-mix and post-mix APO class ids.
const CLSIDS: [&str; 2] = [
    "{EACD2258-FCAC-4FF4-B36D-419E924A6D79}",
    "{EC1CC9CE-FAED-4822-828A-82A81A6F018F}",
];
/// The FxProperties slots an APO can be registered in.
const FX_SLOTS: [u32; 8] = [1, 2, 5, 6, 7, 13, 14, 15];
const FX_SET: &str = "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}";

/// Whether the endpoint's FxProperties name Equalizer APO in one of the APO
/// slots. `values` pairs each value name with its string(s).
pub fn registered(values: &[(String, Vec<String>)]) -> bool {
    values.iter().any(|(name, strings)| {
        let slot = name
            .split_once(',')
            .filter(|(set, _)| set.eq_ignore_ascii_case(FX_SET))
            .and_then(|(_, pid)| pid.trim().parse::<u32>().ok());
        slot.is_some_and(|pid| FX_SLOTS.contains(&pid))
            && strings
                .iter()
                .any(|s| CLSIDS.iter().any(|c| s.trim().eq_ignore_ascii_case(c)))
    })
}

/// Active needs both halves Equalizer APO itself checks: its CLSID in the
/// endpoint's effects and its own `Child APOs` record for the endpoint.
pub fn eq_state(values: &[(String, Vec<String>)], child_apo: bool, effects_off: bool) -> EqState {
    match (registered(values) && child_apo, effects_off) {
        (false, _) => EqState::None,
        (true, true) => EqState::Bypassed,
        (true, false) => EqState::Active,
    }
}

/// `Child APOs` records whose endpoint no longer exists at all (a driver or
/// Windows update gave the device a new endpoint id). `known` holds every
/// endpoint GUID Windows lists, in lower case, unplugged ones included.
pub fn stale(child_apos: &[String], known: &HashSet<String>) -> u32 {
    child_apos
        .iter()
        .filter(|guid| !known.contains(&guid.to_ascii_lowercase()))
        .count() as u32
}

#[cfg(windows)]
pub use win::*;

#[cfg(windows)]
mod win {
    use super::*;
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    const ROOT: &str = r"SOFTWARE\EqualizerAPO";
    const UNINSTALL: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\EqualizerAPO";

    fn install_path() -> Option<std::path::PathBuf> {
        let path: String = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(ROOT)
            .ok()?
            .get_value("InstallPath")
            .ok()?;
        let path = std::path::PathBuf::from(path);
        path.is_absolute().then_some(path)
    }

    fn selector() -> Option<std::path::PathBuf> {
        Some(install_path()?.join("DeviceSelector.exe")).filter(|p| p.is_file())
    }

    pub fn install() -> Eapo {
        let path = install_path();
        let installed = path.as_ref().is_some_and(|p| p.join("EqualizerAPO.dll").is_file());
        Eapo {
            installed,
            version: installed
                .then(|| {
                    RegKey::predef(HKEY_LOCAL_MACHINE)
                        .open_subkey(UNINSTALL)
                        .ok()?
                        .get_value::<String, _>("DisplayVersion")
                        .ok()
                })
                .flatten()
                .filter(|v| v.len() <= 32 && v.chars().all(|c| c.is_ascii_digit() || c == '.')),
            selector: installed && selector().is_some(),
            stale: 0,
        }
    }

    /// The endpoint GUIDs Equalizer APO has a record for.
    pub fn child_apos() -> Vec<String> {
        RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(format!(r"{ROOT}\Child APOs"))
            .map(|key| {
                key.enum_keys()
                    .filter_map(Result::ok)
                    .filter(|guid| crate::rollback::valid_guid(guid))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Opens the user's own Device Selector, which asks for administrator
    /// rights itself. Only from an explicit click on the Audio page.
    #[tauri::command(async)]
    pub fn open_eapo_device_selector() -> Result<(), String> {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let exe = selector().ok_or("Equalizer APO's Device Selector was not found")?;
        let wide: Vec<u16> = exe.as_os_str().encode_wide().chain(Some(0)).collect();
        let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
        // SAFETY: both strings are NUL-terminated and outlive the call.
        let code = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                verb.as_ptr(),
                wide.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        } as isize;
        if code > 32 {
            Ok(())
        } else {
            Err("Windows could not open Equalizer APO's Device Selector".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fx(pairs: &[(&str, &str)]) -> Vec<(String, Vec<String>)> {
        pairs
            .iter()
            .map(|(n, v)| (n.to_string(), vec![v.to_string()]))
            .collect()
    }

    /// The speakers of the reference PC: Windows' own effects, no EAPO.
    fn stock() -> Vec<(String, Vec<String>)> {
        fx(&[
            ("{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},0", "{00000000-0000-0000-0000-000000000000}"),
            ("{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},5", "{C9453E73-8C5C-4463-9984-AF8BAB2F5447}"),
            ("{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},6", "{13AB3EBD-137E-4903-9D89-60BE8277FD17}"),
            ("{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5", "1"),
        ])
    }

    fn with_eapo(slot: u32) -> Vec<(String, Vec<String>)> {
        let mut values = stock();
        values.push((
            format!("{{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}},{slot}"),
            vec!["{eacd2258-fcac-4ff4-b36d-419e924a6d79}".into()],
        ));
        values
    }

    #[test]
    fn registered_and_recorded_is_active_and_effects_off_is_bypassed() {
        assert_eq!(eq_state(&with_eapo(5), true, false), EqState::Active);
        assert_eq!(eq_state(&with_eapo(14), true, true), EqState::Bypassed);
    }

    #[test]
    fn one_half_alone_or_another_slot_is_not_active() {
        // The reference PC: a Child APOs record, no CLSID on the speakers.
        assert_eq!(eq_state(&stock(), true, true), EqState::None);
        // A CLSID without Equalizer APO's own record.
        assert_eq!(eq_state(&with_eapo(5), false, false), EqState::None);
        // Slot 3 is not an APO slot.
        assert_eq!(eq_state(&with_eapo(3), true, false), EqState::None);
        // Not installed: nothing registered.
        assert_eq!(eq_state(&[], false, false), EqState::None);
        // Post-mix CLSID in a multi-string value.
        let post = vec![(
            "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},6".to_string(),
            vec!["{other}".to_string(), "{EC1CC9CE-FAED-4822-828A-82A81A6F018F}".to_string()],
        )];
        assert!(registered(&post));
    }

    #[test]
    fn a_record_for_a_vanished_endpoint_is_stale() {
        let known: HashSet<String> = ["{7a2e23b2-e340-4ecc-b732-cb49ee6dfd2e}".to_string()].into();
        let records = vec![
            "{2bf10d0f-c57f-45f9-b111-6d103f1b3ebd}".to_string(),
            "{7A2E23B2-E340-4ECC-B732-CB49EE6DFD2E}".to_string(),
        ];
        assert_eq!(stale(&records, &known), 1);
        assert_eq!(stale(&[], &known), 0);
    }
}
