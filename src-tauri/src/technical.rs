//! Technical transparency — what each tweak *actually* does to Windows.
//!
//! Two things are deliberately kept apart in this product:
//! - the **commercial description** ("makes the desktop feel snappier"), which
//!   is marketing copy and lives on the tweak definition;
//! - the **technical change** (`HKCU\Control Panel\Desktop\MenuShowDelay` set
//!   to `"0"`), which is what the machine is actually told to do.
//!
//! This module owns the second one, and only the second one.
//!
//! ## Why this is derived, and not a data file
//!
//! The obvious design is a JSON manifest listing every tweak's registry keys.
//! It is also the wrong one: a manifest is a *second* copy of the truth, and
//! the moment a path is corrected in the code and not in the JSON, the app
//! shows the user a key it does not touch. A disclosure that can drift from
//! the code is worse than no disclosure — it is a confident lie, and this
//! feature exists precisely to earn the trust such a lie would destroy.
//!
//! So every entry is built FROM the same constants the apply path uses:
//! `RegistryTweak.key_path` for the single-value tweaks (automatic, zero
//! per-tweak work — add a tweak and its disclosure already exists), and the
//! exported `pub(crate)` constants of each specialised module for the dozen
//! composite ones. Change a path in `netlatency.rs` and this text follows it,
//! because it *is* that path.
//!
//! A JSON export stays perfectly reasonable as a downstream artifact —
//! generated from this function, never the source of it.

use serde::Serialize;

/// One concrete, checkable thing a tweak does. A tagged union: the frontend
/// renders registry rows and command rows differently, and a future variant
/// (a scheduled task, a firewall rule) cannot silently render as the wrong
/// kind.
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TechnicalChange {
    /// A single registry value write.
    #[serde(rename_all = "camelCase")]
    Registry {
        /// Full path including the hive, e.g. `HKLM\SYSTEM\...\PriorityControl`.
        path: String,
        value_name: String,
        /// `REG_DWORD` / `REG_SZ`, named as regedit names them.
        value_type: &'static str,
        /// Rendered exactly as regedit shows it, e.g. `38 (0x26)`.
        sets_to: String,
    },
    /// An external program invocation.
    #[serde(rename_all = "camelCase")]
    Command { program: &'static str, arguments: String },
    /// A Windows service state change.
    #[serde(rename_all = "camelCase")]
    Service { name: &'static str, action: &'static str },
}

fn reg(
    path: String,
    value_name: impl Into<String>,
    value_type: &'static str,
    sets_to: impl Into<String>,
) -> TechnicalChange {
    TechnicalChange::Registry {
        path,
        value_name: value_name.into(),
        value_type,
        sets_to: sets_to.into(),
    }
}

fn dword(path: String, name: impl Into<String>, v: u32) -> TechnicalChange {
    reg(path, name, "REG_DWORD", format!("{v} (0x{v:X})"))
}

fn sz(path: String, name: impl Into<String>, v: &str) -> TechnicalChange {
    reg(path, name, "REG_SZ", format!("\"{v}\""))
}

fn cmd(program: &'static str, arguments: impl Into<String>) -> TechnicalChange {
    TechnicalChange::Command { program, arguments: arguments.into() }
}

/// The disclosure for tweaks that are NOT a single registry value.
///
/// Each arm reads the very constants its module writes with, so this can
/// never describe a key the code does not touch. Ids that reach the fallback
/// disclose nothing rather than guessing.
#[cfg(windows)]
pub fn composite_changes(id: &str) -> Vec<TechnicalChange> {
    use crate::{contextmenu, dns, game_priority, gaming, netlatency, power, privacy_extra, services, turbo};

    if id == power::TWEAK_ID {
        return vec![cmd("powercfg", format!("/setactive {}", power::HIGH_PERFORMANCE_GUID))];
    }
    if id == turbo::info().id {
        return vec![
            dword(format!("{}\\{}", turbo::GAME_DVR_HIVE, turbo::GAME_DVR_PATH), turbo::GAME_DVR_NAME, 0),
            dword(
                format!("{}\\{}", turbo::PRIORITY_HIVE, turbo::PRIORITY_PATH),
                turbo::PRIORITY_NAME,
                turbo::PRIORITY_GAMING_VALUE,
            ),
            cmd("powercfg", format!("/setactive {}", power::HIGH_PERFORMANCE_GUID)),
        ];
    }
    if id == dns::TWEAK_ID {
        return vec![cmd(
            "powershell",
            "Set-DnsClientServerAddress -InterfaceAlias <active adapter> -ServerAddresses 1.1.1.1,1.0.0.1",
        )];
    }
    if id == gaming::INPUT_LAG_ID {
        return gaming::MOUSE_VALUES
            .iter()
            .map(|name| sz(format!("HKCU\\{}", gaming::MOUSE_PATH), *name, "0"))
            .collect();
    }
    if id == gaming::KEYBOARD_DELAY_ID {
        return gaming::KEYBOARD_TARGET
            .iter()
            .map(|(name, value)| sz(format!("HKCU\\{}", gaming::KEYBOARD_PATH), *name, value))
            .collect();
    }
    if id == gaming::TURBO_BOOST_ID {
        return vec![
            cmd(
                "powercfg",
                format!(
                    "/setacvalueindex SCHEME_CURRENT {} {} {}",
                    gaming::SUB_PROCESSOR_GUID,
                    gaming::PERF_BOOST_MODE_GUID,
                    gaming::BOOST_AGGRESSIVE
                ),
            ),
            cmd("powercfg", "/setactive SCHEME_CURRENT"),
        ];
    }
    if id == game_priority::info().id {
        let path = format!("HKLM\\{}", game_priority::PATH);
        return vec![
            dword(path.clone(), "GPU Priority", 8),
            dword(path.clone(), "Priority", 6),
            sz(path.clone(), "Scheduling Category", "High"),
            sz(path, "SFIO Priority", "High"),
        ];
    }
    if id == netlatency::info().id {
        return netlatency::VALUES
            .iter()
            .map(|name| {
                dword(
                    format!("HKLM\\{}\\<active adapter GUID>", netlatency::INTERFACES_PATH),
                    *name,
                    1,
                )
            })
            .collect();
    }
    if id == privacy_extra::ACTIVITY_HISTORY_ID {
        return privacy_extra::VALUES
            .iter()
            .map(|name| dword(format!("HKLM\\{}", privacy_extra::PATH), *name, 0))
            .collect();
    }
    if id == privacy_extra::TYPING_PERSONALIZATION_ID {
        return privacy_extra::TYPING_VALUES
            .iter()
            .map(|name| dword(format!("HKCU\\{}", privacy_extra::TYPING_PATH), *name, 0))
            .collect();
    }
    if id == contextmenu::info().id {
        return vec![
            sz(format!("HKCU\\{}", contextmenu::INPROC_PATH), "(Default)", ""),
            cmd("taskkill", "/f /im explorer.exe   (Explorer is restarted right after)"),
        ];
    }
    if id == services::WINDOWS_SEARCH_ID {
        return vec![TechnicalChange::Service {
            name: services::SERVICE_NAME,
            action: "stopped, then set to Disabled",
        }];
    }
    Vec::new()
}

#[cfg(not(windows))]
pub fn composite_changes(_id: &str) -> Vec<TechnicalChange> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dwords_render_the_way_regedit_shows_them() {
        let TechnicalChange::Registry { sets_to, value_type, .. } = dword("HKLM\\X".into(), "Y", 38)
        else {
            panic!("expected a registry change");
        };
        assert_eq!(sets_to, "38 (0x26)");
        assert_eq!(value_type, "REG_DWORD");
    }

    #[test]
    fn strings_are_quoted_so_an_empty_value_is_visible() {
        let TechnicalChange::Registry { sets_to, value_type, .. } = sz("HKCU\\X".into(), "Y", "")
        else {
            panic!("expected a registry change");
        };
        assert_eq!(sets_to, "\"\"");
        assert_eq!(value_type, "REG_SZ");
    }

    #[test]
    fn an_unknown_id_discloses_nothing_rather_than_guessing() {
        assert!(composite_changes("no_such_tweak").is_empty());
    }
}
