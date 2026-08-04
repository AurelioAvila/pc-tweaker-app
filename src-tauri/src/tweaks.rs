use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};
use serde::Serialize;

#[derive(Serialize, Clone, Copy)]
pub enum Category {
    Performance,
    Privacy,
    Ui,
    Manutenzione,
    Gaming,
}

#[derive(Serialize, Clone, Copy)]
pub enum Hive {
    Hkcu,
    Hklm,
}

/// A tweak backed by a single registry value (DWORD or string).
/// `on_value` is written when applying; the previous value is snapshotted
/// first so `rollback` can put it back exactly as it was.
pub struct RegistryTweak {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub category: Category,
    pub hive: Hive,
    pub key_path: &'static str,
    pub value_name: &'static str,
    pub on_value: RegValue,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

/// Every `name`/`description` here is English on purpose: the UI only falls
/// back to these when a tweak id has no translation for the active language
/// (see `textFor` in App.tsx), and English is the app's primary language. They
/// used to be Italian, which meant a missing translation surfaced as an
/// Italian row inside an otherwise English list.
pub fn all_tweaks() -> Vec<RegistryTweak> {
    vec![
        RegistryTweak {
            id: "dark_mode",
            name: "Dark mode",
            description: "Turns on the dark theme for apps and the system (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            value_name: "AppsUseLightTheme",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "show_hidden_files",
            name: "Show hidden files",
            description: "Shows hidden files and folders in File Explorer (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            value_name: "Hidden",
            on_value: RegValue::Dword(1),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "priority_separation",
            name: "Optimize CPU priority",
            description: "Tunes Win32PrioritySeparation to favor background services (HKLM, requires administrator rights).",
            category: Category::Performance,
            hive: Hive::Hklm,
            key_path: r"SYSTEM\CurrentControlSet\Control\PriorityControl",
            value_name: "Win32PrioritySeparation",
            on_value: RegValue::Dword(38),
            requires_admin: true,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_game_dvr",
            name: "Disable Xbox Game Bar / Game DVR",
            description: "Turns off Xbox Game Bar's background recording, which uses CPU/GPU while gaming (HKCU, no elevation required).",
            category: Category::Performance,
            hive: Hive::Hkcu,
            key_path: r"System\GameConfigStore",
            value_name: "GameDVR_Enabled",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_telemetry_tasks",
            name: "Reduce diagnostic data collection",
            description: "Sets Windows diagnostic data to the lowest allowed level (HKLM, requires administrator rights).",
            category: Category::Privacy,
            hive: Hive::Hklm,
            key_path: r"SOFTWARE\Policies\Microsoft\Windows\DataCollection",
            value_name: "AllowTelemetry",
            on_value: RegValue::Dword(0),
            requires_admin: true,
            requires_pro: true,
        },
        RegistryTweak {
            id: "reset_advertising_id",
            name: "Disable advertising ID",
            description: "Stops apps from using your advertising ID to profile you (HKCU, no elevation required).",
            category: Category::Privacy,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
            value_name: "Enabled",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_location_tracking",
            name: "Disable location tracking",
            description: "Blocks location access for all apps through system policy (HKLM, requires administrator rights).",
            category: Category::Privacy,
            hive: Hive::Hklm,
            key_path: r"SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors",
            value_name: "DisableLocation",
            on_value: RegValue::Dword(1),
            requires_admin: true,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_bing_search",
            name: "Disable Bing search in the Start menu",
            description: "Stops your Start menu searches from being sent to Bing (HKCU, no elevation required).",
            category: Category::Privacy,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Search",
            value_name: "BingSearchEnabled",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "hardware_gpu_scheduling",
            name: "Hardware-accelerated GPU scheduling",
            description: "Enables Windows Hardware-accelerated GPU Scheduling (HAGS), which can lower input latency in many games (HKLM, requires administrator rights).",
            category: Category::Gaming,
            hive: Hive::Hklm,
            key_path: r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers",
            value_name: "HwSchMode",
            on_value: RegValue::Dword(2),
            requires_admin: true,
            requires_pro: false,
        },
        RegistryTweak {
            id: "network_throttling_index",
            name: "Disable multimedia network throttling",
            description: "Removes the cap Windows puts on network traffic while multimedia apps/games are running (MMCSS NetworkThrottlingIndex), useful against online micro-lag (HKLM, requires administrator rights).",
            category: Category::Gaming,
            hive: Hive::Hklm,
            key_path: r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
            value_name: "NetworkThrottlingIndex",
            on_value: RegValue::Dword(0xffffffff),
            requires_admin: true,
            requires_pro: false,
        },
        RegistryTweak {
            id: "system_responsiveness",
            name: "Maximize responsiveness for foreground apps",
            description: "Zeroes the CPU share Windows reserves for background tasks, leaving more for the foreground app or game (HKLM, requires administrator rights).",
            category: Category::Gaming,
            hive: Hive::Hklm,
            key_path: r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile",
            value_name: "SystemResponsiveness",
            on_value: RegValue::Dword(0),
            requires_admin: true,
            requires_pro: false,
        },
        RegistryTweak {
            id: "taskbar_align_left",
            name: "Align the taskbar to the left",
            description: "Puts taskbar icons back on the left (Windows 10 style) instead of centered (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            value_name: "TaskbarAl",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "hide_taskbar_chat",
            name: "Hide Chat/Teams from the taskbar",
            description: "Removes the Chat (Microsoft Teams) icon from the taskbar (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            value_name: "TaskbarMn",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_start_suggestions",
            name: "Disable Start menu suggestions and recommended apps",
            description: "Stops Windows from showing recommended apps, ads and tips in the Start menu (HKCU, no elevation required).",
            category: Category::Privacy,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
            value_name: "SubscribedContent-338388Enabled",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "hide_taskbar_search",
            name: "Hide the search box from the taskbar",
            description: "Removes the search box/icon from the taskbar for a cleaner bar (search still works from the Windows key) (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Search",
            value_name: "SearchboxTaskbarMode",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_fullscreen_optimizations_global",
            name: "Disable fullscreen optimizations globally",
            description: "Forces DXGI to honor true exclusive fullscreen instead of Windows' emulation, reducing stutter and input lag in many older games (HKCU, no elevation required).",
            category: Category::Gaming,
            hive: Hive::Hkcu,
            key_path: r"System\GameConfigStore",
            value_name: "GameDVR_DXGIHonorFSEWindowsCompatible",
            on_value: RegValue::Dword(1),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_startup_delay",
            name: "Remove the startup app delay",
            description: "Windows deliberately waits about 10 seconds after sign-in before launching your startup programs. This removes that wait (HKCU, no elevation required).",
            category: Category::Performance,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Serialize",
            value_name: "StartupDelayInMSec",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "menu_show_delay",
            name: "Instant menu response",
            description: "Removes the built-in delay before menus open, which makes the whole desktop feel noticeably snappier (HKCU, no elevation required).",
            category: Category::Performance,
            hive: Hive::Hkcu,
            key_path: r"Control Panel\Desktop",
            value_name: "MenuShowDelay",
            on_value: RegValue::Str(String::from("0")),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_power_throttling",
            name: "Disable CPU power throttling",
            description: "Stops Windows from slowing down background processes to save power - useful on laptops where throttling causes stutter during long sessions (HKLM, requires administrator rights).",
            category: Category::Performance,
            hive: Hive::Hklm,
            key_path: r"SYSTEM\CurrentControlSet\Control\Power\PowerThrottling",
            value_name: "PowerThrottlingOff",
            on_value: RegValue::Dword(1),
            requires_admin: true,
            requires_pro: true,
        },
        RegistryTweak {
            id: "games_gpu_priority",
            name: "Raise GPU priority for games",
            description: "Tells the multimedia scheduler to give games the highest GPU priority class, so background apps stop competing for the GPU mid-match (HKLM, requires administrator rights).",
            category: Category::Gaming,
            hive: Hive::Hklm,
            key_path: r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games",
            value_name: "GPU Priority",
            on_value: RegValue::Dword(8),
            requires_admin: true,
            requires_pro: true,
        },
        RegistryTweak {
            id: "disable_tailored_experiences",
            name: "Disable tailored experiences",
            description: "Stops Windows from using your diagnostic data to personalize ads, tips and recommendations (HKCU, no elevation required).",
            category: Category::Privacy,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Privacy",
            value_name: "TailoredExperiencesWithDiagnosticDataEnabled",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_app_launch_tracking",
            name: "Stop tracking which apps you open",
            description: "Windows records how often you launch each program to rank Start menu results. This turns that logging off (HKCU, no elevation required).",
            category: Category::Privacy,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            value_name: "Start_TrackProgs",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_feedback_requests",
            name: "Stop Windows feedback prompts",
            description: "Prevents Windows from interrupting you with 'How likely are you to recommend...' surveys (HKCU, no elevation required).",
            category: Category::Privacy,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Siuf\Rules",
            value_name: "NumberOfSIUFInPeriod",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_cortana",
            name: "Disable Cortana",
            description: "Turns Cortana off through system policy, freeing the background resources it reserves (HKLM, requires administrator rights).",
            category: Category::Privacy,
            hive: Hive::Hklm,
            key_path: r"SOFTWARE\Policies\Microsoft\Windows\Windows Search",
            value_name: "AllowCortana",
            on_value: RegValue::Dword(0),
            requires_admin: true,
            requires_pro: true,
        },
        RegistryTweak {
            id: "show_file_extensions",
            name: "Always show file extensions",
            description: "Reveals the real extension of every file. Worth turning on for safety alone: it exposes files like 'invoice.pdf.exe' that Windows otherwise hides (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            value_name: "HideFileExt",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "hide_taskbar_widgets",
            name: "Hide Widgets from the taskbar",
            description: "Removes the weather/news Widgets button, which loads content in the background even when you never open it (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            value_name: "TaskbarDa",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_transparency",
            name: "Disable transparency effects",
            description: "Turns off the blur/acrylic effects in the taskbar and menus. Small but real GPU saving, and it makes older or integrated-graphics machines feel smoother (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            value_name: "EnableTransparency",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
    ]
}

pub fn find_tweak(id: &str) -> Option<RegistryTweak> {
    all_tweaks().into_iter().find(|t| t.id == id)
}

#[cfg(windows)]
pub mod windows_impl {
    use super::*;
    use winreg::enums::*;
    use winreg::RegKey;

    pub fn root(hive: &Hive) -> RegKey {
        match hive {
            Hive::Hkcu => RegKey::predef(HKEY_CURRENT_USER),
            Hive::Hklm => RegKey::predef(HKEY_LOCAL_MACHINE),
        }
    }

    pub fn hive_str(hive: &Hive) -> &'static str {
        match hive {
            Hive::Hkcu => "HKCU",
            Hive::Hklm => "HKLM",
        }
    }

    pub fn hive_from_str(s: &str) -> Hive {
        match s {
            "HKLM" => Hive::Hklm,
            _ => Hive::Hkcu,
        }
    }

    /// Reads a DWORD value without changing anything. `None` means it is unset.
    pub fn read_dword(hive: Hive, path: &str, name: &str) -> std::io::Result<Option<u32>> {
        let root = root(&hive);
        match root.open_subkey(path) {
            Ok(key) => match key.get_value::<u32, _>(name) {
                Ok(v) => Ok(Some(v)),
                Err(_) => Ok(None),
            },
            Err(_) => Ok(None),
        }
    }

    /// Writes a DWORD value, creating the key if needed.
    pub fn write_dword(hive: Hive, path: &str, name: &str, value: u32) -> Result<(), String> {
        let root = root(&hive);
        let (key, _) = root
            .create_subkey(path)
            .map_err(|e| format!("could not open {}: {}", path, e))?;
        key.set_value(name, &value)
            .map_err(|e| format!("could not write {}: {}", name, e))
    }

    /// Reads a registry value, trying the same type as `kind_hint` (Dword or Str).
    pub fn read_value(hive: Hive, path: &str, name: &str, kind_hint: &RegValue) -> std::io::Result<Option<RegValue>> {
        let root = root(&hive);
        let Ok(key) = root.open_subkey(path) else {
            return Ok(None);
        };
        match kind_hint {
            RegValue::Dword(_) => Ok(key.get_value::<u32, _>(name).ok().map(RegValue::Dword)),
            RegValue::Str(_) => Ok(key.get_value::<String, _>(name).ok().map(RegValue::Str)),
        }
    }

    /// Writes a registry value, creating the key if needed.
    pub fn write_value(hive: Hive, path: &str, name: &str, value: &RegValue) -> Result<(), String> {
        let root = root(&hive);
        let (key, _) = root
            .create_subkey(path)
            .map_err(|e| format!("could not open {}: {}", path, e))?;
        match value {
            RegValue::Dword(v) => key.set_value(name, v),
            RegValue::Str(s) => key.set_value(name, s),
        }
        .map_err(|e| format!("could not write {}: {}", name, e))
    }

    /// Restores (or removes) a value from a previously taken snapshot.
    pub fn restore_value(snapshot: &RegistrySnapshot) -> Result<(), String> {
        let hive = hive_from_str(&snapshot.hive);
        let root = root(&hive);
        let (key, _) = root
            .create_subkey(&snapshot.path)
            .map_err(|e| format!("could not open {}: {}", snapshot.path, e))?;
        match &snapshot.original_value {
            Some(RegValue::Dword(v)) => key
                .set_value(&snapshot.name, v)
                .map_err(|e| format!("could not restore {}: {}", snapshot.name, e))?,
            Some(RegValue::Str(s)) => key
                .set_value(&snapshot.name, s)
                .map_err(|e| format!("could not restore {}: {}", snapshot.name, e))?,
            None => {
                let _ = key.delete_value(&snapshot.name);
            }
        }
        Ok(())
    }

    impl RegistryTweak {
        /// Reads the current value (if any) without changing anything.
        pub fn read_current(&self) -> std::io::Result<Option<RegValue>> {
            read_value(self.hive, self.key_path, self.value_name, &self.on_value)
        }

        /// Snapshots the current value, then writes `on_value`.
        pub fn apply(&self, store: &RollbackStore) -> Result<(), String> {
            let original = self.read_current().map_err(|e| e.to_string())?;
            write_value(self.hive, self.key_path, self.value_name, &self.on_value)?;

            store
                .save_entry(
                    self.id,
                    SnapshotEntry::Registry(RegistrySnapshot {
                        hive: hive_str(&self.hive).to_string(),
                        path: self.key_path.to_string(),
                        name: self.value_name.to_string(),
                        original_value: original,
                    }),
                )
                .map_err(|e| e.to_string())?;

            Ok(())
        }

        /// Restores the value captured before `apply`, or removes it if it
        /// did not exist beforehand.
        pub fn rollback(&self, store: &RollbackStore) -> Result<(), String> {
            let entry = store
                .take_entry(self.id)
                .ok_or_else(|| "no snapshot saved: the tweak does not appear to be applied".to_string())?;

            let SnapshotEntry::Registry(snapshot) = entry else {
                return Err("unexpected snapshot type for a registry tweak".to_string());
            };

            restore_value(&snapshot)
        }
    }
}
