//! Tweaks made of several registry values that belong together: a Windows
//! setting or policy that only does what it says when all of its values are
//! written, and is only honest to undo when all of them are put back.
//!
//! Each one is declared once, as data, and everything else is derived from
//! that declaration: the snapshot shape, its validation, the technical
//! disclosure, the dry-run preview, "is it still in effect", and the Windows
//! builds and editions it supports. A tweak never mixes hives, so a user-level
//! setting is never written from an administrator's elevated helper.
//!
//! Every value here is a REG_DWORD. Sources: Microsoft's Policy CSP and Edge
//! policy reference for the policies, and the value Windows itself writes for
//! the Settings switches.

use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};
use crate::tweaks::{Category, Hive};

pub struct Write {
    pub path: &'static str,
    pub name: &'static str,
    pub value: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Edition {
    Any,
    /// Pro, Enterprise or Education (and their IoT/Workstation variants):
    /// the editions Microsoft documents the policy for. Home is refused.
    ProOrHigher,
}

pub struct SettingsTweak {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub category: Category,
    pub hive: Hive,
    pub writes: &'static [Write],
    pub requires_pro: bool,
    /// The first Windows build the setting exists on; 0 for any.
    pub min_build: u32,
    pub edition: Edition,
}

impl SettingsTweak {
    /// An HKLM value always needs an administrator; an HKCU one never does.
    pub fn requires_admin(&self) -> bool {
        self.hive == Hive::Hklm
    }

    fn hive_name(&self) -> &'static str {
        match self.hive {
            Hive::Hkcu => "HKCU",
            Hive::Hklm => "HKLM",
        }
    }
}

const ADVANCED: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
const CDM: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager";
const EDGE: &str = r"SOFTWARE\Policies\Microsoft\Edge";
const PAINT: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Paint";

/// Windows 11 builds the catalogue refers to.
pub const BUILD_WIN11: u32 = 22000;
pub const BUILD_22H2: u32 = 22621;
pub const BUILD_23H2: u32 = 22631;
pub const BUILD_24H2: u32 = 26100;

pub static TWEAKS: [SettingsTweak; 14] = [
    SettingsTweak {
        id: "disable_click_to_do",
        name: "Turn off Click to Do",
        description: "Sets the Windows policy that removes Click to Do, the feature that takes a screenshot of your screen and analyzes it to suggest actions. Its entry points disappear for every account on this PC. Settings will show it as managed by your organization, which is how Windows labels policies.",
        category: Category::Privacy,
        hive: Hive::Hklm,
        writes: &[Write { path: r"SOFTWARE\Policies\Microsoft\Windows\WindowsAI", name: "DisableClickToDo", value: 1 }],
        requires_pro: true,
        min_build: BUILD_24H2,
        edition: Edition::ProOrHigher,
    },
    SettingsTweak {
        id: "disable_edge_ai",
        name: "Turn off AI features in Microsoft Edge",
        description: "Sets Microsoft Edge policies that hide the sidebar, stop Edge from downloading its on-device AI model, and turn off AI history search, AI-generated themes and Copilot's access to page content. Some of these controls apply only to work or school profiles. Edge picks them up without a restart; edge://policy lists them. Edge will show that it is managed by your organization, which is how it labels policies.",
        category: Category::Privacy,
        hive: Hive::Hklm,
        writes: &[
            Write { path: EDGE, name: "HubsSidebarEnabled", value: 0 },
            Write { path: EDGE, name: "GenAILocalFoundationalModelSettings", value: 1 },
            Write { path: EDGE, name: "EdgeHistoryAISearchEnabled", value: 0 },
            Write { path: EDGE, name: "AIGenThemesEnabled", value: 0 },
            Write { path: EDGE, name: "CopilotPageContext", value: 0 },
            Write { path: EDGE, name: "ComposeInlineEnabled", value: 0 },
        ],
        requires_pro: true,
        min_build: 0,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "disable_paint_ai",
        name: "Turn off AI features in Paint",
        description: "Sets the Windows policies that turn off Cocreator, Image Creator and generative fill in Paint. Everything else in Paint works as before.",
        category: Category::Privacy,
        hive: Hive::Hklm,
        writes: &[
            Write { path: PAINT, name: "DisableCocreator", value: 1 },
            Write { path: PAINT, name: "DisableImageCreator", value: 1 },
            Write { path: PAINT, name: "DisableGenerativeFill", value: 1 },
        ],
        requires_pro: false,
        min_build: BUILD_22H2,
        edition: Edition::ProOrHigher,
    },
    SettingsTweak {
        id: "disable_notepad_ai",
        name: "Turn off AI features in Notepad",
        description: "Sets the Notepad policy that turns off its Copilot writing tools (rewrite, summarize, write). Close and reopen Notepad to see the change.",
        category: Category::Privacy,
        hive: Hive::Hklm,
        writes: &[Write { path: r"SOFTWARE\Policies\WindowsNotepad", name: "DisableAIFeatures", value: 1 }],
        requires_pro: false,
        min_build: BUILD_22H2,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "disable_fast_startup",
        name: "Turn off Fast Startup",
        description: "Makes Shut down a real shutdown instead of a partial hibernation. Windows starts a few seconds slower from cold, but drivers and updates load fresh every time, and dual-boot setups no longer find the Windows drive locked.",
        category: Category::Maintenance,
        hive: Hive::Hklm,
        writes: &[Write { path: r"SYSTEM\CurrentControlSet\Control\Session Manager\Power", name: "HiberbootEnabled", value: 0 }],
        requires_pro: true,
        min_build: 0,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "disable_storage_sense",
        name: "Turn off Storage Sense",
        description: "Stops Windows from deleting temporary files, emptying the Recycle Bin and moving OneDrive files online on its own schedule. You decide what gets cleaned and when.",
        category: Category::Maintenance,
        hive: Hive::Hkcu,
        writes: &[Write { path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy", name: "01", value: 0 }],
        requires_pro: false,
        min_build: 0,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "taskbar_end_task",
        name: "Add End task to the taskbar",
        description: "Adds End task to the right-click menu of apps on the taskbar, so a frozen app can be closed without opening Task Manager.",
        category: Category::Ui,
        hive: Hive::Hkcu,
        writes: &[Write { path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced\TaskbarDeveloperSettings", name: "TaskbarEndTask", value: 1 }],
        requires_pro: false,
        min_build: BUILD_23H2,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "disable_drag_tray",
        name: "Turn off the drag tray",
        description: "Stops the sharing tray from sliding down from the top of the screen every time you drag a file, so ordinary drag and drop works without it getting in the way.",
        category: Category::Ui,
        hive: Hive::Hkcu,
        writes: &[Write { path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\CDP", name: "DragTrayEnabled", value: 0 }],
        requires_pro: false,
        min_build: BUILD_24H2,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "explorer_open_this_pc",
        name: "Open File Explorer to This PC",
        description: "File Explorer opens on This PC, with your drives and folders, instead of Home and its recent files.",
        category: Category::Ui,
        hive: Hive::Hkcu,
        writes: &[Write { path: ADVANCED, name: "LaunchTo", value: 1 }],
        requires_pro: false,
        min_build: 0,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "block_oem_device_apps",
        name: "Stop device makers' apps from installing themselves",
        description: "Stops Windows from downloading manufacturers' apps and custom icons for the devices you plug in, which is how some mouse, keyboard and motherboard utilities arrive without being asked for. Drivers still install as usual.",
        category: Category::Maintenance,
        hive: Hive::Hklm,
        writes: &[Write { path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Device Metadata", name: "PreventDeviceMetadataFromNetwork", value: 1 }],
        requires_pro: true,
        min_build: 0,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "disable_windows_suggestions",
        name: "Turn off Windows tips and suggestions",
        description: "One switch for the prompts Windows adds on its own: tips and suggestions, the welcome screen after updates, suggestions in Settings, \"finish setting up your device\", suggested notifications, Start menu recommendations and account notices, and sync provider ads in File Explorer.",
        category: Category::Privacy,
        hive: Hive::Hkcu,
        writes: &[
            Write { path: CDM, name: "SubscribedContent-338389Enabled", value: 0 },
            Write { path: CDM, name: "SubscribedContent-310093Enabled", value: 0 },
            Write { path: CDM, name: "SubscribedContent-353694Enabled", value: 0 },
            Write { path: CDM, name: "SubscribedContent-353696Enabled", value: 0 },
            Write { path: CDM, name: "SoftLandingEnabled", value: 0 },
            Write { path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\UserProfileEngagement", name: "ScoobeSystemSettingEnabled", value: 0 },
            Write { path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Notifications\Settings\Windows.SystemToast.Suggested", name: "Enabled", value: 0 },
            Write { path: ADVANCED, name: "ShowSyncProviderNotifications", value: 0 },
            Write { path: ADVANCED, name: "Start_IrisRecommendations", value: 0 },
            Write { path: ADVANCED, name: "Start_AccountNotifications", value: 0 },
        ],
        requires_pro: true,
        min_build: 0,
        edition: Edition::Any,
    },
    SettingsTweak {
        id: "disable_widgets",
        name: "Turn off Widgets entirely",
        description: "Sets the Windows policy that turns off the Widgets board itself, not just its taskbar button, so its news feed stops loading in the background. Settings will show it as managed by your organization, which is how Windows labels policies.",
        category: Category::Ui,
        hive: Hive::Hklm,
        writes: &[Write { path: r"SOFTWARE\Policies\Microsoft\Dsh", name: "AllowNewsAndInterests", value: 0 }],
        requires_pro: true,
        min_build: BUILD_WIN11,
        edition: Edition::ProOrHigher,
    },
    SettingsTweak {
        id: "hide_start_recommended",
        name: "Remove Recommended from the Start menu",
        description: "Sets the Windows policy that removes the Recommended section from Start, giving your pinned apps the space to themselves. Settings will show it as managed by your organization, which is how Windows labels policies.",
        category: Category::Ui,
        hive: Hive::Hklm,
        writes: &[Write { path: r"SOFTWARE\Policies\Microsoft\Windows\Explorer", name: "HideRecommendedSection", value: 1 }],
        requires_pro: true,
        min_build: BUILD_22H2,
        edition: Edition::ProOrHigher,
    },
    SettingsTweak {
        id: "disable_game_bar_captures",
        name: "Turn off Game Bar captures",
        description: "Turns off Game Bar's capture feature and its background recording, which keeps a rolling video of your last few minutes of play. Complements the Game Bar / Game DVR switch.",
        category: Category::Gaming,
        hive: Hive::Hkcu,
        writes: &[
            Write { path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR", name: "AppCaptureEnabled", value: 0 },
            Write { path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR", name: "HistoricalCaptureEnabled", value: 0 },
        ],
        requires_pro: false,
        min_build: 0,
        edition: Edition::Any,
    },
];

pub fn find(id: &str) -> Option<&'static SettingsTweak> {
    TWEAKS.iter().find(|t| t.id == id)
}

/// Why a tweak cannot be applied on this PC. The code is what the frontend
/// translates; the text is the English fallback.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Unavailable {
    WindowsVersion,
    WindowsEdition,
}

impl Unavailable {
    pub fn code(self) -> &'static str {
        match self {
            Unavailable::WindowsVersion => "windows_version",
            Unavailable::WindowsEdition => "windows_edition",
        }
    }

    pub fn message(self) -> &'static str {
        match self {
            Unavailable::WindowsVersion => "This setting needs a newer version of Windows.",
            Unavailable::WindowsEdition => {
                "This setting needs Windows Pro, Enterprise or Education."
            }
        }
    }
}

/// Home editions report an EditionID beginning with "Core" (Core,
/// CoreSingleLanguage, CoreCountrySpecific, CoreN).
fn is_home_edition(edition_id: &str) -> bool {
    edition_id.to_ascii_lowercase().starts_with("core")
}

/// Pure: whether `tweak` fits a machine with this build and edition. Unknown
/// facts do not block, so a read failure never strands a supported machine.
pub fn availability(
    tweak: &SettingsTweak,
    build: Option<u32>,
    edition_id: Option<&str>,
) -> Result<(), Unavailable> {
    if build.is_some_and(|b| b < tweak.min_build) {
        return Err(Unavailable::WindowsVersion);
    }
    if tweak.edition == Edition::ProOrHigher && edition_id.is_some_and(is_home_edition) {
        return Err(Unavailable::WindowsEdition);
    }
    Ok(())
}

const VERSION_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";

/// This machine's build and edition, read through the same registry seam the
/// tweaks use (so unit tests see the in-memory registry, not the host).
#[cfg(windows)]
pub fn machine() -> (Option<u32>, Option<String>) {
    use crate::tweaks::windows_impl::read_value;
    let text =
        |name: &str| match read_value(Hive::Hklm, VERSION_KEY, name, &RegValue::Str(String::new()))
        {
            Ok(Some(RegValue::Str(s))) => Some(s),
            _ => None,
        };
    (
        text("CurrentBuild").and_then(|b| b.trim().parse().ok()),
        text("EditionID"),
    )
}

#[cfg(windows)]
pub fn available_here(tweak: &SettingsTweak) -> Result<(), Unavailable> {
    let (build, edition) = machine();
    availability(tweak, build, edition.as_deref())
}

/// Every value written as the tweak defines it.
#[cfg(windows)]
pub fn in_effect(tweak: &SettingsTweak) -> Option<bool> {
    use crate::tweaks::windows_impl::read_value;
    let mut all = true;
    for w in tweak.writes {
        match read_value(tweak.hive, w.path, w.name, &RegValue::Dword(0)) {
            Ok(Some(RegValue::Dword(v))) => all &= v == w.value,
            Ok(_) => all = false,
            Err(_) => return None,
        }
    }
    Some(all)
}

/// Snapshots every value, then writes them. Checks the build and edition
/// first; nothing is saved or written on a machine the setting does not fit.
#[cfg(windows)]
pub fn apply(store: &RollbackStore, tweak: &SettingsTweak) -> Result<(), String> {
    available_here(tweak).map_err(|why| why.message().to_string())?;
    apply_writes(store, tweak)
}

#[cfg(windows)]
pub(crate) fn apply_writes(store: &RollbackStore, tweak: &SettingsTweak) -> Result<(), String> {
    use crate::tweaks::windows_impl::{read_value, write_value};
    let mut transaction = store.transaction()?;
    let mut entries = Vec::new();
    for w in tweak.writes {
        let original = read_value(tweak.hive, w.path, w.name, &RegValue::Dword(0))
            .map_err(|e| e.to_string())?;
        entries.push(SnapshotEntry::Registry(RegistrySnapshot {
            hive: tweak.hive_name().to_string(),
            path: w.path.to_string(),
            name: w.name.to_string(),
            original_value: original,
        }));
    }
    transaction.save_entry(tweak.id, SnapshotEntry::Composite { entries })?;
    for w in tweak.writes {
        write_value(tweak.hive, w.path, w.name, &RegValue::Dword(w.value))?;
    }
    Ok(())
}

/// Puts every value back. Each one gets its turn even if an earlier one
/// fails; the journal is kept until all of them succeed.
#[cfg(windows)]
pub fn rollback(store: &RollbackStore, tweak: &SettingsTweak) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;
    store.restore_entry(tweak.id, |entry| {
        let SnapshotEntry::Composite { entries } = entry else {
            return Err("unexpected snapshot type for this setting".to_string());
        };
        let mut first_error = None;
        for e in entries {
            if let SnapshotEntry::Registry(snapshot) = e {
                if let Err(error) = restore_value(&snapshot) {
                    first_error.get_or_insert(error);
                }
            }
        }
        first_error.map_or(Ok(()), Err)
    })
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore, _tweak: &SettingsTweak) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore, _tweak: &SettingsTweak) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

/// A snapshot is accepted only if it covers exactly this tweak's values, each
/// once, in its own hive. Snapshot files are user-writable input.
pub fn valid_snapshot(tweak: &SettingsTweak, entry: &SnapshotEntry) -> bool {
    let SnapshotEntry::Composite { entries } = entry else {
        return false;
    };
    entries.len() == tweak.writes.len()
        && tweak.writes.iter().all(|w| {
            entries
                .iter()
                .filter(|e| {
                    matches!(e, SnapshotEntry::Registry(s)
                        if s.hive.eq_ignore_ascii_case(tweak.hive_name())
                            && s.path.eq_ignore_ascii_case(w.path)
                            && s.name.eq_ignore_ascii_case(w.name))
                })
                .count()
                == 1
        })
}

/// What the tweak writes, for the technical disclosure and the preview.
pub fn changes(tweak: &SettingsTweak) -> Vec<crate::technical::TechnicalChange> {
    tweak
        .writes
        .iter()
        .map(|w| crate::technical::TechnicalChange::Registry {
            path: format!("{}\\{}", tweak.hive_name(), w.path),
            value_name: w.name.to_string(),
            value_type: "REG_DWORD",
            sets_to: format!("{} (0x{:X})", w.value, w.value),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn ids_are_unique_and_new_to_the_catalogue() {
        let mut seen = HashSet::new();
        for t in &TWEAKS {
            assert!(seen.insert(t.id), "{} declared twice", t.id);
            assert!(
                crate::tweaks::find_tweak(t.id).is_none(),
                "{} clashes with a registry tweak",
                t.id
            );
            assert!(!t.writes.is_empty(), "{}", t.id);
            assert!(!t.description.is_empty() && !t.name.is_empty());
        }
    }

    #[test]
    fn no_value_is_written_twice_or_by_another_tweak() {
        let mut targets = HashSet::new();
        for t in &TWEAKS {
            for w in t.writes {
                assert!(
                    targets.insert((
                        t.hive_name(),
                        w.path.to_ascii_lowercase(),
                        w.name.to_ascii_lowercase()
                    )),
                    "{}: {} written twice",
                    t.id,
                    w.name
                );
            }
        }
        for t in crate::tweaks::all_tweaks() {
            let hive = match t.hive {
                Hive::Hkcu => "HKCU",
                Hive::Hklm => "HKLM",
            };
            assert!(
                !targets.contains(&(
                    hive,
                    t.key_path.to_ascii_lowercase(),
                    t.value_name.to_ascii_lowercase()
                )),
                "{} overlaps a settings tweak",
                t.id
            );
        }
    }

    #[test]
    fn builds_and_editions_are_checked_and_unknowns_do_not_block() {
        let click = find("disable_click_to_do").unwrap();
        assert_eq!(
            availability(click, Some(22631), Some("Professional")),
            Err(Unavailable::WindowsVersion)
        );
        assert_eq!(
            availability(click, Some(26100), Some("Core")),
            Err(Unavailable::WindowsEdition)
        );
        assert_eq!(
            availability(click, Some(26100), Some("CoreSingleLanguage")),
            Err(Unavailable::WindowsEdition)
        );
        assert_eq!(
            availability(click, Some(26200), Some("Professional")),
            Ok(())
        );
        assert_eq!(availability(click, Some(26200), Some("Enterprise")), Ok(()));
        assert_eq!(availability(click, None, None), Ok(()));
        let explorer = find("explorer_open_this_pc").unwrap();
        assert_eq!(availability(explorer, Some(19045), Some("Core")), Ok(()));
        assert_eq!(
            availability(find("taskbar_end_task").unwrap(), Some(22621), Some("Core")),
            Err(Unavailable::WindowsVersion)
        );
    }

    #[test]
    fn snapshots_must_cover_exactly_the_declared_values() {
        let t = find("disable_paint_ai").unwrap();
        let snap = |names: &[&str], hive: &str| SnapshotEntry::Composite {
            entries: names
                .iter()
                .map(|n| {
                    SnapshotEntry::Registry(RegistrySnapshot {
                        hive: hive.into(),
                        path: PAINT.into(),
                        name: (*n).into(),
                        original_value: None,
                    })
                })
                .collect(),
        };
        let all = [
            "DisableCocreator",
            "DisableImageCreator",
            "DisableGenerativeFill",
        ];
        assert!(valid_snapshot(t, &snap(&all, "HKLM")));
        assert!(!valid_snapshot(t, &snap(&all, "HKCU")), "wrong hive");
        assert!(
            !valid_snapshot(t, &snap(&all[..2], "HKLM")),
            "missing value"
        );
        assert!(!valid_snapshot(
            t,
            &snap(
                &[
                    "DisableCocreator",
                    "DisableCocreator",
                    "DisableGenerativeFill"
                ],
                "HKLM"
            )
        ));
        assert!(crate::rollback::validate_snapshot(t.id, &snap(&all, "HKLM")).is_ok());
    }
}
