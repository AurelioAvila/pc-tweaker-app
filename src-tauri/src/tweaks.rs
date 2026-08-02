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

pub fn all_tweaks() -> Vec<RegistryTweak> {
    vec![
        RegistryTweak {
            id: "dark_mode",
            name: "Modalità scura",
            description: "Attiva il tema scuro per app e sistema (HKCU, nessuna elevazione richiesta).",
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
            name: "Mostra file nascosti",
            description: "Mostra i file e le cartelle nascosti in Esplora file (HKCU, nessuna elevazione richiesta).",
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
            name: "Ottimizza priorità processore",
            description: "Regola Win32PrioritySeparation per favorire i servizi in background (HKLM, richiede privilegi di amministratore).",
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
            name: "Disattiva Xbox Game Bar / Game DVR",
            description: "Disattiva la registrazione in background di Xbox Game Bar, che consuma CPU/GPU durante il gioco (HKCU, nessuna elevazione richiesta).",
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
            name: "Riduci raccolta dati diagnostici",
            description: "Imposta il livello di diagnostica di Windows al minimo consentito (HKLM, richiede privilegi di amministratore).",
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
            name: "Disattiva ID pubblicità",
            description: "Impedisce alle app di usare il tuo ID pubblicitario per la profilazione (HKCU, nessuna elevazione richiesta).",
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
            name: "Disattiva tracciamento posizione",
            description: "Blocca l'accesso alla posizione geografica per tutte le app tramite policy di sistema (HKLM, richiede privilegi di amministratore).",
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
            name: "Disattiva ricerca Bing nel menu Start",
            description: "Impedisce che le tue ricerche nel menu Start vengano inviate a Bing (HKCU, nessuna elevazione richiesta).",
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
            name: "Pianificazione GPU con accelerazione hardware",
            description: "Attiva la Pianificazione GPU con accelerazione hardware (HAGS) di Windows, che può ridurre la latenza di input in molti giochi (HKLM, richiede privilegi di amministratore).",
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
            name: "Disattiva limitazione di rete multimediale",
            description: "Rimuove il limite che Windows impone al traffico di rete durante l'uso di app multimediali/giochi (MMCSS NetworkThrottlingIndex), utile per ridurre micro-lag online (HKLM, richiede privilegi di amministratore).",
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
            name: "Massimizza reattività per app in primo piano",
            description: "Azzera la quota di CPU riservata da Windows ai task in background, lasciando più risorse all'app/gioco in primo piano (HKLM, richiede privilegi di amministratore).",
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
            name: "Allinea la barra delle applicazioni a sinistra",
            description: "Riporta le icone della taskbar allineate a sinistra (stile Windows 10) invece che al centro (HKCU, nessuna elevazione richiesta).",
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
            name: "Nascondi Chat/Teams dalla barra delle applicazioni",
            description: "Rimuove l'icona Chat (Microsoft Teams) dalla taskbar (HKCU, nessuna elevazione richiesta).",
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
            name: "Disattiva suggerimenti e app consigliate nel menu Start",
            description: "Impedisce a Windows di mostrare app consigliate, annunci e suggerimenti nel menu Start (HKCU, nessuna elevazione richiesta).",
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
            name: "Nascondi la casella di ricerca dalla barra delle applicazioni",
            description: "Rimuove la casella/icona di ricerca dalla taskbar, per una barra più pulita (la ricerca resta comunque disponibile dal tasto Windows) (HKCU, nessuna elevazione richiesta).",
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
            name: "Disattiva ottimizzazioni schermo intero globalmente",
            description: "Forza DXGI a rispettare la vera modalità a schermo intero esclusiva invece della simulazione di Windows, riducendo micro-scatti e input lag in molti giochi più datati (HKCU, nessuna elevazione richiesta).",
            category: Category::Gaming,
            hive: Hive::Hkcu,
            key_path: r"System\GameConfigStore",
            value_name: "GameDVR_DXGIHonorFSEWindowsCompatible",
            on_value: RegValue::Dword(1),
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
            .map_err(|e| format!("impossibile aprire {}: {}", path, e))?;
        key.set_value(name, &value)
            .map_err(|e| format!("impossibile scrivere {}: {}", name, e))
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
            .map_err(|e| format!("impossibile aprire {}: {}", path, e))?;
        match value {
            RegValue::Dword(v) => key.set_value(name, v),
            RegValue::Str(s) => key.set_value(name, s),
        }
        .map_err(|e| format!("impossibile scrivere {}: {}", name, e))
    }

    /// Restores (or removes) a value from a previously taken snapshot.
    pub fn restore_value(snapshot: &RegistrySnapshot) -> Result<(), String> {
        let hive = hive_from_str(&snapshot.hive);
        let root = root(&hive);
        let (key, _) = root
            .create_subkey(&snapshot.path)
            .map_err(|e| format!("impossibile aprire {}: {}", snapshot.path, e))?;
        match &snapshot.original_value {
            Some(RegValue::Dword(v)) => key
                .set_value(&snapshot.name, v)
                .map_err(|e| format!("impossibile ripristinare {}: {}", snapshot.name, e))?,
            Some(RegValue::Str(s)) => key
                .set_value(&snapshot.name, s)
                .map_err(|e| format!("impossibile ripristinare {}: {}", snapshot.name, e))?,
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
                .ok_or_else(|| "nessuno snapshot salvato: il tweak non risulta applicato".to_string())?;

            let SnapshotEntry::Registry(snapshot) = entry else {
                return Err("tipo di snapshot inatteso per un tweak di registro".to_string());
            };

            restore_value(&snapshot)
        }
    }
}
