use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// A snapshot of a single registry value, taken right before a tweak is applied.
/// `None` means the value did not exist beforehand, so rollback must delete it.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RegistrySnapshot {
    pub hive: String,
    pub path: String,
    pub name: String,
    pub original_value: Option<u32>,
}

#[derive(Serialize, Deserialize, Default)]
struct Store {
    snapshots: HashMap<String, RegistrySnapshot>,
}

pub struct RollbackStore {
    file_path: PathBuf,
}

impl RollbackStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        RollbackStore {
            file_path: app_data_dir.join("rollback_store.json"),
        }
    }

    fn load(&self) -> Store {
        fs::read_to_string(&self.file_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    fn save(&self, store: &Store) -> std::io::Result<()> {
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(store).unwrap();
        fs::write(&self.file_path, json)
    }

    pub fn is_applied(&self, tweak_id: &str) -> bool {
        self.load().snapshots.contains_key(tweak_id)
    }

    pub fn save_snapshot(&self, tweak_id: &str, snapshot: RegistrySnapshot) -> std::io::Result<()> {
        let mut store = self.load();
        store.snapshots.insert(tweak_id.to_string(), snapshot);
        self.save(&store)
    }

    pub fn take_snapshot(&self, tweak_id: &str) -> Option<RegistrySnapshot> {
        let mut store = self.load();
        let snapshot = store.snapshots.remove(tweak_id);
        if snapshot.is_some() {
            let _ = self.save(&store);
        }
        snapshot
    }
}
