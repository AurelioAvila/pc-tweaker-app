use crate::rollback::{RegistrySnapshot, RollbackStore};
use serde::Serialize;

#[derive(Serialize, Clone, Copy)]
pub enum Category {
    Performance,
    Privacy,
    Ui,
}

#[derive(Serialize, Clone, Copy)]
pub enum Hive {
    Hkcu,
    Hklm,
}

/// A tweak backed by a single DWORD registry value.
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
    pub on_value: u32,
    pub requires_admin: bool,
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
            on_value: 0,
            requires_admin: false,
        },
        RegistryTweak {
            id: "show_hidden_files",
            name: "Mostra file nascosti",
            description: "Mostra i file e le cartelle nascosti in Esplora file (HKCU, nessuna elevazione richiesta).",
            category: Category::Ui,
            hive: Hive::Hkcu,
            key_path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            value_name: "Hidden",
            on_value: 1,
            requires_admin: false,
        },
        RegistryTweak {
            id: "priority_separation",
            name: "Ottimizza priorità processore",
            description: "Regola Win32PrioritySeparation per favorire i servizi in background (HKLM, richiede privilegi di amministratore).",
            category: Category::Performance,
            hive: Hive::Hklm,
            key_path: r"SYSTEM\CurrentControlSet\Control\PriorityControl",
            value_name: "Win32PrioritySeparation",
            on_value: 38,
            requires_admin: true,
        },
    ]
}

pub fn find_tweak(id: &str) -> Option<RegistryTweak> {
    all_tweaks().into_iter().find(|t| t.id == id)
}

#[cfg(windows)]
mod windows_impl {
    use super::*;
    use winreg::enums::*;
    use winreg::RegKey;

    fn root(hive: &Hive) -> RegKey {
        match hive {
            Hive::Hkcu => RegKey::predef(HKEY_CURRENT_USER),
            Hive::Hklm => RegKey::predef(HKEY_LOCAL_MACHINE),
        }
    }

    fn hive_str(hive: &Hive) -> &'static str {
        match hive {
            Hive::Hkcu => "HKCU",
            Hive::Hklm => "HKLM",
        }
    }

    impl RegistryTweak {
        /// Reads the current value (if any) without changing anything.
        pub fn read_current(&self) -> std::io::Result<Option<u32>> {
            let root = root(&self.hive);
            match root.open_subkey(self.key_path) {
                Ok(key) => match key.get_value::<u32, _>(self.value_name) {
                    Ok(v) => Ok(Some(v)),
                    Err(_) => Ok(None),
                },
                Err(_) => Ok(None),
            }
        }

        /// Snapshots the current value, then writes `on_value`.
        pub fn apply(&self, store: &RollbackStore) -> Result<(), String> {
            let original = self.read_current().map_err(|e| e.to_string())?;

            let root = root(&self.hive);
            let (key, _) = root
                .create_subkey(self.key_path)
                .map_err(|e| format!("impossibile aprire {}: {}", self.key_path, e))?;
            key.set_value(self.value_name, &self.on_value)
                .map_err(|e| format!("impossibile scrivere {}: {}", self.value_name, e))?;

            store
                .save_snapshot(
                    self.id,
                    RegistrySnapshot {
                        hive: hive_str(&self.hive).to_string(),
                        path: self.key_path.to_string(),
                        name: self.value_name.to_string(),
                        original_value: original,
                    },
                )
                .map_err(|e| e.to_string())?;

            Ok(())
        }

        /// Restores the value captured before `apply`, or removes it if it
        /// did not exist beforehand.
        pub fn rollback(&self, store: &RollbackStore) -> Result<(), String> {
            let snapshot = store
                .take_snapshot(self.id)
                .ok_or_else(|| "nessuno snapshot salvato: il tweak non risulta applicato".to_string())?;

            let root = root(&self.hive);
            let (key, _) = root
                .create_subkey(&snapshot.path)
                .map_err(|e| format!("impossibile aprire {}: {}", snapshot.path, e))?;

            match snapshot.original_value {
                Some(v) => key
                    .set_value(&snapshot.name, &v)
                    .map_err(|e| format!("impossibile ripristinare {}: {}", snapshot.name, e))?,
                None => {
                    let _ = key.delete_value(&snapshot.name);
                }
            }

            Ok(())
        }
    }
}
