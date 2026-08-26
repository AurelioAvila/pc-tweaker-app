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
            description: "Tunes Win32PrioritySeparation (0x26) so the foreground app gets short, variable CPU time slices with a 3x priority boost - the classic desktop/gaming responsiveness value (HKLM, requires administrator rights).",
            category: Category::Performance,
            hive: Hive::Hklm,
            key_path: r"SYSTEM\CurrentControlSet\Control\PriorityControl",
            value_name: "Win32PrioritySeparation",
            on_value: RegValue::Dword(38),
            requires_admin: true,
            requires_pro: true,
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
            requires_pro: true,
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
            requires_pro: true,
        },
        RegistryTweak {
            id: "keep_kernel_in_ram",
            name: "Keep the kernel and drivers in RAM",
            description: "Windows may page parts of the kernel and driver code out to disk even when memory is plentiful, and paging them back in is a stall you feel as a stutter. This keeps them resident. Worth it on machines with RAM to spare; on a low-memory PC leave it off (HKLM, requires administrator rights).",
            category: Category::Performance,
            hive: Hive::Hklm,
            key_path: r"SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management",
            value_name: "DisablePagingExecutive",
            on_value: RegValue::Dword(1),
            requires_admin: true,
            requires_pro: true,
        },
        RegistryTweak {
            id: "auto_end_frozen_tasks",
            name: "Don't let a frozen app block shutdown",
            description: "When an application stops responding during shutdown, Windows waits and shows the \"This app is preventing shutdown\" screen until someone clicks it. This closes unresponsive apps automatically instead, so a hung program cannot leave the machine sitting powered on (HKCU, no elevation required).",
            category: Category::Manutenzione,
            hive: Hive::Hkcu,
            key_path: r"Control Panel\Desktop",
            value_name: "AutoEndTasks",
            on_value: RegValue::Str("1".to_string()),
            requires_admin: false,
            requires_pro: true,
        },
        RegistryTweak {
            id: "instant_folder_loading",
            name: "Open every folder instantly",
            description: "Explorer inspects a folder's contents to guess whether it is Pictures, Music or Documents, and a folder holding thousands of media files can hang for seconds while it decides. This pins every folder to the general layout so it opens at once (HKCU, no elevation required).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\Bags\AllFolders\Shell",
            value_name: "FolderType",
            on_value: RegValue::Str("NotSpecified".to_string()),
            requires_admin: false,
            requires_pro: true,
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
            requires_pro: false,
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
        RegistryTweak {
            id: "disable_window_animations",
            name: "Instant window animations",
            description: "Removes the slide/fade animation Windows plays every time a window opens, closes or minimizes. The animation is pure waiting time — cutting it makes the desktop respond the moment you click, and frees the GPU work behind it (HKCU, no elevation required).",
            category: Category::Performance,
            hive: Hive::Hkcu,
            key_path: r"Control Panel\Desktop\WindowMetrics",
            // REG_SZ, not a DWORD: this is one of the old User32 settings that
            // predate DWORD conventions and Windows only honours it as a string.
            value_name: "MinAnimate",
            on_value: RegValue::Str("0".to_string()),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_drag_full_windows",
            name: "Lighter window dragging",
            description: "Draws an outline while you drag a window instead of repainting its whole contents every frame. Barely noticeable on a fast GPU, a clear difference on integrated graphics or an older machine (HKCU, no elevation required).",
            category: Category::Performance,
            hive: Hive::Hkcu,
            key_path: r"Control Panel\Desktop",
            value_name: "DragFullWindows",
            on_value: RegValue::Str("0".to_string()),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "mouse_hover_delay",
            name: "Instant mouse hover response",
            description: "Windows waits 400 ms before reacting to the pointer resting on something - taskbar previews, tooltips, menu hovers. This drops that wait to almost nothing, so the interface follows the mouse instead of trailing it (HKCU, no elevation required).",
            category: Category::Performance,
            hive: Hive::Hkcu,
            key_path: r"Control Panel\Mouse",
            value_name: "MouseHoverTime",
            on_value: RegValue::Str("10".to_string()),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_background_apps",
            name: "Stop apps running in the background",
            description: "Stops Store apps from running, refreshing and polling the network while you are not using them. This is real CPU, RAM and battery spent on apps you did not open (HKCU, no elevation required).",
            category: Category::Performance,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications",
            value_name: "GlobalUserDisabled",
            on_value: RegValue::Dword(1),
            requires_admin: false,
            requires_pro: true,
        },
        RegistryTweak {
            id: "disable_delivery_optimization",
            name: "Stop sharing Windows updates with strangers",
            description: "Windows uploads downloaded update files to other PCs over your connection by default. This limits Delivery Optimization to your own machine, which stops that upload eating bandwidth mid-game (HKLM, requires administrator rights).",
            category: Category::Manutenzione,
            hive: Hive::Hklm,
            key_path: r"SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization",
            value_name: "DODownloadMode",
            on_value: RegValue::Dword(0),
            requires_admin: true,
            requires_pro: true,
        },
        RegistryTweak {
            id: "disable_copilot",
            name: "Disable Windows Copilot",
            description: "Removes the Copilot assistant from the taskbar and stops it running in the background. Windows ships it enabled and there is no permanent off switch in Settings — this sets the system policy that turns it off for good (HKCU, no elevation required).",
            category: Category::Privacy,
            hive: Hive::Hkcu,
            key_path: r"Software\Policies\Microsoft\Windows\WindowsCopilot",
            value_name: "TurnOffWindowsCopilot",
            on_value: RegValue::Dword(1),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_suggested_apps",
            name: "Stop Windows installing apps by itself",
            description: "Windows quietly installs \"suggested\" apps and games into your Start menu without asking, on a fresh install and again after big updates. This turns that off, so nothing lands on your machine that you didn't choose (HKCU, no elevation required).",
            category: Category::Privacy,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager",
            value_name: "SilentInstalledAppsEnabled",
            on_value: RegValue::Dword(0),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_mouse_acceleration",
            name: "Disable mouse acceleration",
            description: "Turns off \"Enhance pointer precision\", which makes the cursor travel further when you move the mouse faster. That variable response is exactly what you don't want when aiming: the same physical flick should always cover the same distance on screen (HKCU, no elevation required).",
            category: Category::Gaming,
            hive: Hive::Hkcu,
            key_path: r"Control Panel\Mouse",
            value_name: "MouseSpeed",
            on_value: RegValue::Str(String::from("0")),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_sticky_keys_prompt",
            name: "Stop the Sticky Keys popup",
            description: "Tapping Shift five times normally opens the Sticky Keys dialog — which in a game means an alt-tab out of fullscreen at the worst possible moment, usually mid-fight. This disables the shortcut and its prompt; Sticky Keys itself stays available in Settings (HKCU, no elevation required).",
            category: Category::Gaming,
            hive: Hive::Hkcu,
            key_path: r"Control Panel\Accessibility\StickyKeys",
            value_name: "Flags",
            on_value: RegValue::Str(String::from("506")),
            requires_admin: false,
            requires_pro: false,
        },
        RegistryTweak {
            id: "disable_recall",
            name: "Disable Recall (AI screen snapshots)",
            description: "Recall takes a screenshot of your desktop every few seconds and builds a searchable, AI-indexed history of everything you have looked at — passwords and private messages included, since it captures whatever is on screen. This sets the system policy that stops it analysing or storing anything (HKLM, requires administrator rights).",
            category: Category::Privacy,
            hive: Hive::Hklm,
            key_path: r"SOFTWARE\Policies\Microsoft\Windows\WindowsAI",
            value_name: "DisableAIDataAnalysis",
            on_value: RegValue::Dword(1),
            requires_admin: true,
            requires_pro: true,
        },
        RegistryTweak {
            id: "disable_memory_integrity",
            name: "Disable Memory Integrity (VBS)",
            description: "Memory Integrity runs parts of Windows inside a hardware-virtualised container, which costs CPU on every kernel transition — the reason it is the single biggest free frame-rate gain on most gaming machines. Be clear about the trade: it is a real security feature, and turning it off removes protection against malicious drivers. Worth it on a dedicated gaming PC, not on a work machine. Takes effect after a restart (HKLM, requires administrator rights).",
            category: Category::Gaming,
            hive: Hive::Hklm,
            key_path: r"SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity",
            value_name: "Enabled",
            on_value: RegValue::Dword(0),
            requires_admin: true,
            requires_pro: true,
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
    pub fn read_value(
        hive: Hive,
        path: &str,
        name: &str,
        kind_hint: &RegValue,
    ) -> std::io::Result<Option<RegValue>> {
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
            let entry = store.take_entry(self.id).ok_or_else(|| {
                "no snapshot saved: the tweak does not appear to be applied".to_string()
            })?;

            let SnapshotEntry::Registry(snapshot) = entry else {
                return Err("unexpected snapshot type for a registry tweak".to_string());
            };

            restore_value(&snapshot)
        }
    }
}
