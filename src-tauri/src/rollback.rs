use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

/// A registry value of a supported type. Some Windows settings (mouse
/// acceleration, menu delays, ...) are stored as REG_SZ strings rather than
/// DWORDs, so tweaks need to preserve whichever type they found.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum RegValue {
    Dword(u32),
    Str(String),
}

/// A snapshot of a single registry value, taken right before a tweak is applied.
/// `None` means the value did not exist beforehand, so rollback must delete it.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RegistrySnapshot {
    pub hive: String,
    pub path: String,
    pub name: String,
    pub original_value: Option<RegValue>,
}

/// Any of the reversible actions a tweak can take. Cleanup-style actions
/// (deleting/trashing files) are intentionally not represented here: they are
/// one-shot and irreversible by nature, and are surfaced to the user as such.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind")]
pub enum SnapshotEntry {
    Registry(RegistrySnapshot),
    PowerScheme { previous_guid: String },
    Dns { interface: String, previous_servers: Vec<String> },
    PowerSetting { ac_index: String, dc_index: String },
    Service { name: String, previous_start_type: String },
    Composite { entries: Vec<SnapshotEntry> },
}

#[derive(Serialize, Deserialize, Default)]
struct Store {
    snapshots: HashMap<String, SnapshotEntry>,
}

pub struct RollbackStore {
    file_path: PathBuf,
}

/// Serializes every read-modify-write of the snapshot file.
///
/// Each entry is written by loading the whole file, changing one key and
/// writing it back — so two overlapping callers would make the last writer
/// silently drop the other's snapshot, leaving a tweak applied with no way
/// back. That's not hypothetical here: the Game Sessions watcher thread
/// applies and reverts Turbo Gaming in the background while the user can be
/// toggling something else in the UI at the same instant. Cross-process is
/// already safe because the elevated helper runs to completion while the
/// parent blocks on it.
fn store_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
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

    /// Writes via a temp file + rename so an interrupted write can never leave
    /// a half-written (and therefore unparseable) snapshot file behind —
    /// losing that file means losing the ability to undo every applied tweak.
    fn save(&self, store: &Store) -> std::io::Result<()> {
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(store).unwrap();
        let tmp = self.file_path.with_extension("json.tmp");
        fs::write(&tmp, json)?;
        fs::rename(&tmp, &self.file_path)
    }

    pub fn is_applied(&self, tweak_id: &str) -> bool {
        let _guard = store_lock().lock().unwrap_or_else(|e| e.into_inner());
        self.load().snapshots.contains_key(tweak_id)
    }

    pub fn save_entry(&self, tweak_id: &str, entry: SnapshotEntry) -> std::io::Result<()> {
        let _guard = store_lock().lock().unwrap_or_else(|e| e.into_inner());
        let mut store = self.load();
        store.snapshots.insert(tweak_id.to_string(), entry);
        self.save(&store)
    }

    pub fn take_entry(&self, tweak_id: &str) -> Option<SnapshotEntry> {
        let _guard = store_lock().lock().unwrap_or_else(|e| e.into_inner());
        let mut store = self.load();
        let entry = store.snapshots.remove(tweak_id);
        if entry.is_some() {
            let _ = self.save(&store);
        }
        entry
    }
}
