use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

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
    PowerScheme {
        previous_guid: String,
    },
    Dns {
        interface: String,
        previous_servers: Vec<String>,
    },
    PowerSetting {
        ac_index: String,
        dc_index: String,
    },
    /// A power setting identified by GUID, with the plan's previous AC/DC
    /// indexes. `None` records "this plan had no override and was using the
    /// setting's default", which rollback restores by deleting the value
    /// rather than writing a guessed-at default back.
    ///
    /// Supersedes `PowerSetting`, which stored localized-parse output and no
    /// GUIDs; that variant is kept so snapshots written by older versions can
    /// still be rolled back.
    PowerSettingIndex {
        scheme_guid: String,
        subgroup_guid: String,
        setting_guid: String,
        ac_index: Option<u32>,
        dc_index: Option<u32>,
    },
    Service {
        name: String,
        previous_start_type: String,
    },
    /// A registry key that did not exist until this app created it, recorded
    /// so rollback can delete the whole subtree instead of only clearing a
    /// value inside it.
    ///
    /// `Registry` cannot express this: its rollback path writes the previous
    /// value back, or deletes that one value when there wasn't one — which
    /// would leave behind an empty key. For a tweak whose entire effect comes
    /// from a key merely *existing* (the classic context menu override being
    /// the case in point), leaving the key behind would leave the tweak
    /// half-applied and the rollback silently ineffective.
    RegistryKeyCreated {
        hive: String,
        path: String,
    },
    /// The TCP congestion-control algorithm in force on one supplemental
    /// template, before this app changed it.
    ///
    /// Not expressible as `Registry`: `Set-NetTCPSetting` writes into the TCP
    /// stack's own store, not into a registry value that could be snapshotted
    /// and written back. The previous provider is read from the stack itself
    /// so rollback restores what was actually there — including the case where
    /// it was already BBR2 and rollback must therefore change nothing.
    TcpCongestionProvider {
        setting_name: String,
        previous: String,
    },
    Composite {
        entries: Vec<SnapshotEntry>,
    },
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
        // Unique temp name per write: a fixed one would let two writers that
        // aren't covered by the in-process lock (e.g. the elevated helper
        // process) clobber each other's temp file and fail the rename.
        let tmp = self.file_path.with_extension(format!(
            "json.{}.{}.tmp",
            std::process::id(),
            TMP_SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        fs::write(&tmp, json)?;
        let result = fs::rename(&tmp, &self.file_path);
        if result.is_err() {
            let _ = fs::remove_file(&tmp);
        }
        result
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "pct-test-{}-{}",
            tag,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn dummy(name: &str) -> SnapshotEntry {
        SnapshotEntry::PowerScheme {
            previous_guid: name.to_string(),
        }
    }

    #[test]
    fn saves_and_takes_a_single_entry() {
        let dir = temp_dir("single");
        let store = RollbackStore::new(dir.clone());

        assert!(!store.is_applied("a"));
        store.save_entry("a", dummy("guid-a")).unwrap();
        assert!(store.is_applied("a"));

        match store.take_entry("a") {
            Some(SnapshotEntry::PowerScheme { previous_guid }) => {
                assert_eq!(previous_guid, "guid-a")
            }
            other => panic!("unexpected entry: {:?}", other.is_some()),
        }
        assert!(!store.is_applied("a"));
        assert!(store.take_entry("a").is_none());

        let _ = fs::remove_dir_all(dir);
    }

    /// The regression this guards: concurrent writers used to read-modify-write
    /// the same file with no lock, so one writer's snapshot could be silently
    /// overwritten by another's — leaving a tweak applied with nothing to roll
    /// back to. Without the lock this test loses entries; with it, all survive.
    #[test]
    fn concurrent_writers_never_lose_a_snapshot() {
        let dir = temp_dir("concurrent");
        const THREADS: usize = 8;
        const PER_THREAD: usize = 40;

        let handles: Vec<_> = (0..THREADS)
            .map(|t| {
                let dir = dir.clone();
                std::thread::spawn(move || {
                    let store = RollbackStore::new(dir);
                    for i in 0..PER_THREAD {
                        let id = format!("tweak-{}-{}", t, i);
                        store.save_entry(&id, dummy(&id)).unwrap();
                    }
                })
            })
            .collect();

        for h in handles {
            h.join().expect("writer thread panicked");
        }

        let store = RollbackStore::new(dir.clone());
        for t in 0..THREADS {
            for i in 0..PER_THREAD {
                let id = format!("tweak-{}-{}", t, i);
                assert!(store.is_applied(&id), "lost snapshot {}", id);
            }
        }

        let _ = fs::remove_dir_all(dir);
    }

    /// Mixed apply/rollback traffic is the realistic shape: the Game Sessions
    /// watcher reverts Turbo Gaming while the user toggles something else.
    #[test]
    fn concurrent_save_and_take_leave_a_consistent_file() {
        let dir = temp_dir("mixed");
        let seeded = RollbackStore::new(dir.clone());
        for i in 0..40 {
            seeded
                .save_entry(&format!("victim-{}", i), dummy("v"))
                .unwrap();
        }

        let writer_dir = dir.clone();
        let writer = std::thread::spawn(move || {
            let store = RollbackStore::new(writer_dir);
            for i in 0..40 {
                store
                    .save_entry(&format!("keeper-{}", i), dummy("k"))
                    .unwrap();
            }
        });

        let taker_dir = dir.clone();
        let taker = std::thread::spawn(move || {
            let store = RollbackStore::new(taker_dir);
            for i in 0..40 {
                store.take_entry(&format!("victim-{}", i));
            }
        });

        writer.join().unwrap();
        taker.join().unwrap();

        let store = RollbackStore::new(dir.clone());
        for i in 0..40 {
            assert!(
                store.is_applied(&format!("keeper-{}", i)),
                "lost keeper-{}",
                i
            );
            assert!(
                !store.is_applied(&format!("victim-{}", i)),
                "victim-{} survived",
                i
            );
        }

        let _ = fs::remove_dir_all(dir);
    }

    /// A crash between "write" and "replace" must not leave the app with an
    /// unparseable snapshot file, which would strand every applied tweak.
    #[test]
    fn writes_are_committed_atomically_and_leave_no_temp_file() {
        let dir = temp_dir("atomic");
        let store = RollbackStore::new(dir.clone());
        store.save_entry("a", dummy("guid")).unwrap();

        let leftovers: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|n| n.ends_with(".tmp"))
            .collect();
        assert!(
            leftovers.is_empty(),
            "temp files left behind: {:?}",
            leftovers
        );

        let raw = fs::read_to_string(dir.join("rollback_store.json")).unwrap();
        serde_json::from_str::<Store>(&raw).expect("snapshot file must always parse");

        let _ = fs::remove_dir_all(dir);
    }
}
