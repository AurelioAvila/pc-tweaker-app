use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

/// A registry value of a supported type. Some Windows settings (mouse
/// acceleration, menu delays, ...) are stored as REG_SZ strings rather than
/// DWORDs, so tweaks need to preserve whichever type they found.
// PartialEq so a live value can be compared with what a tweak writes, which
// is how updatewatch.rs tells "still applied" from "something reverted it".
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
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
    PowerAcSetting {
        scheme_guid: String,
        subgroup_guid: String,
        setting_guid: String,
        original_override: Option<u32>,
    },
    Registry(RegistrySnapshot),
    PowerScheme {
        previous_guid: String,
    },
    Dns {
        interface: String,
        previous_servers: Vec<String>,
        #[serde(default)]
        previous_automatic: Option<bool>,
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
    /// still be inspected; an unidentified original plan requires manual recovery.
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
        /// Absent in older snapshots, which did not record runtime state.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        was_running: Option<bool>,
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

#[derive(Serialize, Deserialize, Default, Clone)]
struct Store {
    snapshots: HashMap<String, SnapshotEntry>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    owners: HashMap<String, String>,
}

pub struct RollbackStore {
    file_path: PathBuf,
}

/// A separate lock file survives atomic replacement of the data file. The OS
/// releases its lock if either the app or elevated helper exits unexpectedly.
/// Keep this guard alive across reading Windows, saving, and applying/restoring.
pub struct RollbackTransaction<'a> {
    store: &'a RollbackStore,
    state: Store,
    _lock: File,
}

impl RollbackStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        RollbackStore {
            file_path: app_data_dir.join("rollback_store.json"),
        }
    }

    fn load(&self) -> Result<Store, String> {
        let raw = match fs::read(&self.file_path) {
            Ok(raw) => raw,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Store::default()),
            Err(e) => return Err(format!("could not read rollback store: {e}")),
        };
        let state: Store = serde_json::from_slice(&raw)
            .map_err(|e| format!("rollback store is damaged; no changes were made: {e}"))?;
        for (id, entry) in &state.snapshots {
            validate_snapshot(id, entry)?;
        }
        if state.owners.iter().any(|(id, owner)| {
            id != crate::turbo::TWEAK_ID
                || !state.snapshots.contains_key(id)
                || crate::game_sessions::validate_owner_token(owner).is_err()
        }) {
            return Err(
                "rollback store has an invalid session ownership record; no changes were made"
                    .into(),
            );
        }
        Ok(state)
    }

    /// Writes via a temp file + rename so an interrupted write can never leave
    /// a half-written (and therefore unparseable) snapshot file behind —
    /// losing that file means losing the ability to undo every applied tweak.
    fn save(&self, store: &Store) -> std::io::Result<()> {
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_vec_pretty(store).map_err(io::Error::other)?;
        // Unique temp name per write: a fixed one would let two writers that
        // aren't covered by the in-process lock (e.g. the elevated helper
        // process) clobber each other's temp file and fail the rename.
        let tmp = self.file_path.with_extension(format!(
            "json.{}.{}.tmp",
            std::process::id(),
            TMP_SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        let result = (|| {
            let mut file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
            file.write_all(&json)?;
            file.sync_all()?;
            drop(file);
            replace_file(&tmp, &self.file_path)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&tmp);
        }
        result
    }

    pub fn is_applied(&self, tweak_id: &str) -> bool {
        // Compatibility for display-only callers. Mutations always open a
        // checked transaction; IPC listings should propagate the checked error.
        self.is_applied_checked(tweak_id).unwrap_or(false)
    }

    pub fn is_applied_checked(&self, tweak_id: &str) -> Result<bool, String> {
        Ok(self.transaction()?.entry(tweak_id).is_some())
    }

    pub fn applied_ids(&self) -> Result<std::collections::HashSet<String>, String> {
        Ok(self
            .transaction()?
            .state
            .snapshots
            .keys()
            .cloned()
            .collect())
    }

    pub fn transaction(&self) -> Result<RollbackTransaction<'_>, String> {
        let parent = self
            .file_path
            .parent()
            .ok_or("invalid rollback store path")?;
        fs::create_dir_all(parent)
            .map_err(|e| format!("could not create rollback directory: {e}"))?;
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(self.file_path.with_extension("lock"))
            .map_err(|e| format!("could not open rollback lock: {e}"))?;
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            match lock.try_lock() {
                Ok(()) => break,
                Err(std::fs::TryLockError::WouldBlock) if Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(20));
                }
                Err(e) => {
                    return Err(format!(
                        "another change is in progress or the rollback lock is unavailable: {e}"
                    ))
                }
            }
        }
        let state = self.load()?;
        Ok(RollbackTransaction {
            store: self,
            state,
            _lock: lock,
        })
    }

    pub fn restore_entry(
        &self,
        tweak_id: &str,
        restore: impl FnOnce(SnapshotEntry) -> Result<(), String>,
    ) -> Result<(), String> {
        self.transaction()?.restore_entry(tweak_id, restore)
    }
}

impl RollbackTransaction<'_> {
    pub fn entry(&self, tweak_id: &str) -> Option<SnapshotEntry> {
        self.state.snapshots.get(tweak_id).cloned()
    }

    pub fn owner(&self, tweak_id: &str) -> Option<&str> {
        self.state.owners.get(tweak_id).map(String::as_str)
    }

    /// Preserve the oldest original. A different target (e.g. a new adapter
    /// or power plan) must be restored first, not silently added without backup.
    pub fn save_entry(&mut self, tweak_id: &str, entry: SnapshotEntry) -> Result<(), String> {
        validate_snapshot(tweak_id, &entry)?;
        self.check_conflicts(tweak_id, &entry)?;
        if let Some(original) = self.state.snapshots.get(tweak_id) {
            if snapshot_targets(original) != snapshot_targets(&entry) {
                return Err("this tweak already has a snapshot for another target; restore it before applying again".into());
            }
            return Ok(());
        }
        let mut next = self.state.clone();
        next.snapshots.insert(tweak_id.to_owned(), entry);
        self.commit(next)
    }

    /// Used by Turbo Gaming so ownership and the original values reach disk
    /// in one commit before a session performs its first system write.
    pub fn save_owned_entry(
        &mut self,
        tweak_id: &str,
        entry: SnapshotEntry,
        owner: &str,
    ) -> Result<(), String> {
        if self.entry(tweak_id).is_some() {
            return Err("the tweak is already owned or applied".into());
        }
        if tweak_id != crate::turbo::TWEAK_ID {
            return Err("only Turbo Gaming supports session ownership".into());
        }
        crate::game_sessions::validate_owner_token(owner)?;
        validate_snapshot(tweak_id, &entry)?;
        self.check_conflicts(tweak_id, &entry)?;
        let mut next = self.state.clone();
        next.snapshots.insert(tweak_id.to_owned(), entry);
        next.owners.insert(tweak_id.to_owned(), owner.to_owned());
        self.commit(next)
    }

    pub fn clear_owner(&mut self, tweak_id: &str) -> Result<(), String> {
        let mut next = self.state.clone();
        if next.owners.remove(tweak_id).is_some() {
            self.commit(next)?;
        }
        Ok(())
    }

    pub fn restore_entry(
        &mut self,
        tweak_id: &str,
        restore: impl FnOnce(SnapshotEntry) -> Result<(), String>,
    ) -> Result<(), String> {
        let entry = self
            .entry(tweak_id)
            .ok_or("no saved snapshot: the tweak does not appear to be applied")?;
        validate_snapshot(tweak_id, &entry)?;
        self.check_conflicts(tweak_id, &entry).map_err(|_| {
            "saved changes overlap this rollback target; review these legacy snapshots together before recovery. All originals were retained".to_string()
        })?;
        restore(entry)?;
        let mut next = self.state.clone();
        next.snapshots.remove(tweak_id);
        next.owners.remove(tweak_id);
        self.commit(next)
    }

    fn commit(&mut self, next: Store) -> Result<(), String> {
        self.store.save(&next).map_err(|e| format!("could not commit rollback store; system changes were not started or recovery data was retained: {e}"))?;
        self.state = next;
        Ok(())
    }

    fn check_conflicts(&self, tweak_id: &str, entry: &SnapshotEntry) -> Result<(), String> {
        let targets = snapshot_targets(entry);
        for (other_id, other_entry) in &self.state.snapshots {
            if other_id != tweak_id
                && snapshot_targets(other_entry)
                    .iter()
                    .any(|target| targets.contains(target))
            {
                return Err(format!("this change overlaps {other_id}; restore that change first so each original remains recoverable"));
            }
        }
        Ok(())
    }
}

#[cfg(windows)]
fn replace_file(from: &std::path::Path, to: &std::path::Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
    }
    let from: Vec<u16> = from.as_os_str().encode_wide().chain(Some(0)).collect();
    let to: Vec<u16> = to.as_os_str().encode_wide().chain(Some(0)).collect();
    // REPLACE_EXISTING | WRITE_THROUGH. Both paths are on the same volume.
    // SAFETY: both pointers refer to live, NUL-terminated UTF-16 paths.
    if unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), 0x1 | 0x8) } == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(from: &std::path::Path, to: &std::path::Path) -> io::Result<()> {
    fs::rename(from, to)?;
    if let Some(parent) = to.parent() {
        File::open(parent)?.sync_all()?;
    }
    Ok(())
}

pub(crate) fn valid_guid(value: &str) -> bool {
    let value = value
        .strip_prefix('{')
        .and_then(|v| v.strip_suffix('}'))
        .unwrap_or(value);
    let parts: Vec<_> = value.split('-').collect();
    parts.len() == 5
        && parts
            .iter()
            .zip([8, 4, 4, 4, 12])
            .all(|(part, len)| part.len() == len && part.bytes().all(|c| c.is_ascii_hexdigit()))
}

fn registry_matches(s: &RegistrySnapshot, hive: &str, path: &str, name: &str) -> bool {
    s.hive.eq_ignore_ascii_case(hive)
        && s.path.eq_ignore_ascii_case(path)
        && s.name.eq_ignore_ascii_case(name)
}

fn registry_bundle(entry: &SnapshotEntry, hive: &str, path: &str, names: &[&str]) -> bool {
    let SnapshotEntry::Composite { entries } = entry else {
        return false;
    };
    entries.len() == names.len() && names.iter().all(|name| {
        entries.iter().filter(|entry| matches!(entry, SnapshotEntry::Registry(s) if registry_matches(s, hive, path, name))).count() == 1
    })
}

fn power_index(entry: &SnapshotEntry, allowed: &[&str]) -> bool {
    matches!(entry, SnapshotEntry::PowerSettingIndex { scheme_guid, subgroup_guid, setting_guid, .. }
        if valid_guid(scheme_guid) && subgroup_guid.eq_ignore_ascii_case(crate::gaming::SUB_PROCESSOR_GUID)
        && allowed.iter().any(|id| setting_guid.eq_ignore_ascii_case(id)))
}

/// Snapshot files are user-writable input, including when an elevated helper
/// consumes them. Only targets compiled into this build may be restored.
pub(crate) fn validate_snapshot(id: &str, entry: &SnapshotEntry) -> Result<(), String> {
    let allowed = if let Some(tweak) = crate::power_tuning::find(id) {
        crate::power_tuning::valid_snapshot(tweak, entry)
    } else if let Some(tweak) = crate::tweaks::find_tweak(id) {
        let hive = match tweak.hive {
            crate::tweaks::Hive::Hkcu => "HKCU",
            crate::tweaks::Hive::Hklm => "HKLM",
        };
        matches!(entry, SnapshotEntry::Registry(s) if registry_matches(s, hive, tweak.key_path, tweak.value_name))
    } else {
        match id {
            crate::gaming::INPUT_LAG_ID => registry_bundle(
                entry,
                "HKCU",
                crate::gaming::MOUSE_PATH,
                &crate::gaming::MOUSE_VALUES,
            ),
            crate::gaming::KEYBOARD_DELAY_ID => registry_bundle(
                entry,
                "HKCU",
                crate::gaming::KEYBOARD_PATH,
                &["KeyboardDelay", "KeyboardSpeed"],
            ),
            crate::game_priority::TWEAK_ID => registry_bundle(
                entry,
                "HKLM",
                crate::game_priority::PATH,
                &[
                    "GPU Priority",
                    "Priority",
                    "Scheduling Category",
                    "SFIO Priority",
                ],
            ),
            crate::privacy_extra::ACTIVITY_HISTORY_ID => registry_bundle(
                entry,
                "HKLM",
                crate::privacy_extra::PATH,
                &crate::privacy_extra::VALUES,
            ),
            crate::privacy_extra::TYPING_PERSONALIZATION_ID => registry_bundle(
                entry,
                "HKCU",
                crate::privacy_extra::TYPING_PATH,
                &crate::privacy_extra::TYPING_VALUES,
            ),
            crate::netlatency::TWEAK_ID => {
                if let SnapshotEntry::Composite { entries } = entry {
                    if let Some(SnapshotEntry::Registry(first)) = entries.first() {
                        let prefix = format!("{}\\", crate::netlatency::INTERFACES_PATH);
                        let guid = first.path.get(prefix.len()..).unwrap_or("");
                        first
                            .path
                            .get(..prefix.len())
                            .is_some_and(|p| p.eq_ignore_ascii_case(&prefix))
                            && valid_guid(guid)
                            && registry_bundle(
                                entry,
                                "HKLM",
                                &first.path,
                                &crate::netlatency::VALUES,
                            )
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            crate::contextmenu::TWEAK_ID => {
                matches!(entry, SnapshotEntry::RegistryKeyCreated { hive, path }
                if hive.eq_ignore_ascii_case("HKCU") && path.eq_ignore_ascii_case(crate::contextmenu::CLSID_PATH))
            }
            crate::power::TWEAK_ID => {
                matches!(entry, SnapshotEntry::PowerScheme { previous_guid } if valid_guid(previous_guid))
            }
            crate::turbo::TWEAK_ID => {
                if let SnapshotEntry::Composite { entries } = entry {
                    entries.len() == 3 && entries.iter().filter(|e| matches!(e, SnapshotEntry::PowerScheme { previous_guid } if valid_guid(previous_guid))).count() == 1
                        && [(crate::turbo::GAME_DVR_HIVE, crate::turbo::GAME_DVR_PATH, crate::turbo::GAME_DVR_NAME),
                            (crate::turbo::PRIORITY_HIVE, crate::turbo::PRIORITY_PATH, crate::turbo::PRIORITY_NAME)].iter().all(|(hive, path, name)| {
                            entries.iter().filter(|e| matches!(e, SnapshotEntry::Registry(s) if registry_matches(s, hive, path, name))).count() == 1
                        })
                } else {
                    false
                }
            }
            crate::gaming::CORE_PARKING_ID => {
                power_index(entry, &[crate::gaming::CORE_PARKING_MIN_GUID])
            }
            crate::gaming::TURBO_BOOST_ID => match entry {
                SnapshotEntry::Composite { entries } => {
                    entries.len() == 2
                        && [
                            crate::gaming::PERF_BOOST_MODE_GUID,
                            crate::gaming::PROC_THROTTLE_MIN_GUID,
                        ]
                        .iter()
                        .all(|guid| {
                            entries.iter().filter(|e| power_index(e, &[*guid])).count() == 1
                        })
                }
                SnapshotEntry::PowerSetting { ac_index, dc_index } => {
                    [ac_index, dc_index].iter().all(|value| {
                        value.parse::<u32>().is_ok()
                            || value
                                .strip_prefix("0x")
                                .is_some_and(|v| u32::from_str_radix(v, 16).is_ok())
                    })
                }
                _ => power_index(entry, &[crate::gaming::PERF_BOOST_MODE_GUID]),
            },
            crate::dns::TWEAK_ID => {
                matches!(entry, SnapshotEntry::Dns { interface, previous_servers, previous_automatic }
                if !interface.is_empty() && interface.len() <= 256 && !interface.contains('\0')
                    && (*previous_automatic != Some(false) || !previous_servers.is_empty())
                    && previous_servers.len() <= 16 && previous_servers.iter().all(|s| s.parse::<std::net::Ipv4Addr>().is_ok()))
            }
            crate::services::WINDOWS_SEARCH_ID => {
                matches!(entry, SnapshotEntry::Service { name, previous_start_type, .. }
                if name == crate::services::SERVICE_NAME && previous_start_type.len() < 256
                    && ["AUTO_START", "DEMAND_START", "DISABLED"].iter().any(|v| previous_start_type.contains(v)))
            }
            crate::netshaper::TWEAK_ID => {
                matches!(entry, SnapshotEntry::TcpCongestionProvider { setting_name, previous }
                if setting_name == "Internet" && ["Default", "NewReno", "CTCP", "DCTCP", "LEDBAT", "CUBIC", "BBR2"].iter().any(|p| previous.eq_ignore_ascii_case(p)))
            }
            _ => false,
        }
    };
    if allowed {
        Ok(())
    } else {
        Err(format!(
            "snapshot for {id} has an unexpected type or target; no changes were made"
        ))
    }
}

fn snapshot_targets(entry: &SnapshotEntry) -> Vec<String> {
    let mut targets = match entry {
        SnapshotEntry::PowerAcSetting {
            scheme_guid,
            subgroup_guid,
            setting_guid,
            ..
        } => {
            vec![format!("power:{scheme_guid}:{subgroup_guid}:{setting_guid}").to_ascii_lowercase()]
        }
        SnapshotEntry::Registry(s) => {
            vec![format!("reg:{}:{}:{}", s.hive, s.path, s.name).to_ascii_lowercase()]
        }
        SnapshotEntry::RegistryKeyCreated { hive, path } => {
            vec![format!("key:{hive}:{path}").to_ascii_lowercase()]
        }
        SnapshotEntry::PowerScheme { .. } => vec!["scheme".into()],
        SnapshotEntry::Dns { interface, .. } => vec![format!("dns:{interface}")],
        SnapshotEntry::PowerSetting { .. } => vec!["legacy-boost".into()],
        SnapshotEntry::PowerSettingIndex {
            scheme_guid,
            subgroup_guid,
            setting_guid,
            ..
        } => {
            vec![format!("power:{scheme_guid}:{subgroup_guid}:{setting_guid}").to_ascii_lowercase()]
        }
        SnapshotEntry::Service { name, .. } => vec![format!("service:{name}")],
        SnapshotEntry::TcpCongestionProvider { setting_name, .. } => {
            vec![format!("tcp:{setting_name}")]
        }
        SnapshotEntry::Composite { entries } => entries.iter().flat_map(snapshot_targets).collect(),
    };
    targets.sort();
    targets
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(PathBuf);
    impl TempDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "pct-rollback-test-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                TMP_SEQ.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
        fn store(&self) -> RollbackStore {
            RollbackStore::new(self.0.clone())
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn sample(index: usize, value: u32) -> (String, SnapshotEntry) {
        let tweak = crate::tweaks::all_tweaks().remove(index);
        let hive = match tweak.hive {
            crate::tweaks::Hive::Hkcu => "HKCU",
            crate::tweaks::Hive::Hklm => "HKLM",
        };
        (
            tweak.id.into(),
            SnapshotEntry::Registry(RegistrySnapshot {
                hive: hive.into(),
                path: tweak.key_path.into(),
                name: tweak.value_name.into(),
                original_value: Some(RegValue::Dword(value)),
            }),
        )
    }
    fn original(entry: SnapshotEntry) -> Option<RegValue> {
        let SnapshotEntry::Registry(snapshot) = entry else {
            panic!("wrong fixture");
        };
        snapshot.original_value
    }
    fn turbo_snapshot() -> SnapshotEntry {
        SnapshotEntry::Composite {
            entries: vec![
                SnapshotEntry::Registry(RegistrySnapshot {
                    hive: crate::turbo::GAME_DVR_HIVE.into(),
                    path: crate::turbo::GAME_DVR_PATH.into(),
                    name: crate::turbo::GAME_DVR_NAME.into(),
                    original_value: None,
                }),
                SnapshotEntry::Registry(RegistrySnapshot {
                    hive: crate::turbo::PRIORITY_HIVE.into(),
                    path: crate::turbo::PRIORITY_PATH.into(),
                    name: crate::turbo::PRIORITY_NAME.into(),
                    original_value: None,
                }),
                SnapshotEntry::PowerScheme {
                    previous_guid: crate::power::HIGH_PERFORMANCE_GUID.into(),
                },
            ],
        }
    }
    #[test]
    fn missing_store_is_empty_but_corruption_fails_closed_without_replacing_it() {
        let temp = TempDir::new();
        let store = temp.store();
        assert!(store.applied_ids().unwrap().is_empty());
        fs::write(&store.file_path, b"{damaged").unwrap();
        assert!(store.transaction().is_err());
        assert!(store.applied_ids().is_err());
        assert_eq!(fs::read(&store.file_path).unwrap(), b"{damaged");
    }
    #[test]
    fn snapshot_is_readable_on_disk_before_the_fake_system_write_and_keeps_oldest_original() {
        let temp = TempDir::new();
        let store = temp.store();
        let (id, entry) = sample(0, 12);
        let mut fake_value = 12;
        {
            let mut tx = store.transaction().unwrap();
            tx.save_entry(&id, entry).unwrap();
            let persisted: Store =
                serde_json::from_slice(&fs::read(&store.file_path).unwrap()).unwrap();
            assert!(persisted.snapshots.contains_key(&id));
            assert_eq!(fake_value, 12);
            fake_value = 0;
        }
        let (_, replacement) = sample(0, 99);
        store
            .transaction()
            .unwrap()
            .save_entry(&id, replacement)
            .unwrap();
        assert_eq!(
            original(store.transaction().unwrap().entry(&id).unwrap()),
            Some(RegValue::Dword(12))
        );
        assert_eq!(fake_value, 0);
    }
    #[test]
    fn failed_snapshot_commit_never_reaches_a_fake_system_write() {
        let temp = TempDir::new();
        let store = temp.store();
        let mut tx = store.transaction().unwrap();
        fs::create_dir(&store.file_path).unwrap();
        let (id, entry) = sample(0, 1);
        let mut writes = 0;
        let result = (|| -> Result<(), String> {
            tx.save_entry(&id, entry)?;
            writes += 1;
            Ok(())
        })();
        assert!(result.is_err());
        assert_eq!(writes, 0);
        assert!(
            tx.entry(&id).is_none(),
            "a failed commit must not poison a reused transaction"
        );
    }
    #[test]
    fn failed_or_partial_restore_keeps_the_original_for_a_successful_retry() {
        let temp = TempDir::new();
        let store = temp.store();
        let (id, entry) = sample(0, 12);
        store.transaction().unwrap().save_entry(&id, entry).unwrap();
        let mut attempts = 0;
        assert!(store
            .restore_entry(&id, |_| {
                attempts += 1;
                Err("fake write denied".into())
            })
            .is_err());
        assert!(store.is_applied_checked(&id).unwrap());
        store
            .restore_entry(&id, |entry| {
                attempts += 1;
                assert_eq!(original(entry), Some(RegValue::Dword(12)));
                Ok(())
            })
            .unwrap();
        assert_eq!(attempts, 2);
        assert!(!store.is_applied_checked(&id).unwrap());
    }
    #[test]
    fn unexpected_target_or_entry_kind_never_reaches_restore() {
        let temp = TempDir::new();
        let store = temp.store();
        let (id, mut entry) = sample(0, 1);
        if let SnapshotEntry::Registry(snapshot) = &mut entry {
            snapshot.path = r"Software\Unrelated".into();
        }
        let state = Store {
            snapshots: [(id.clone(), entry)].into(),
            ..Store::default()
        };
        fs::write(&store.file_path, serde_json::to_vec(&state).unwrap()).unwrap();
        let mut invoked = false;
        assert!(store
            .restore_entry(&id, |_| {
                invoked = true;
                Ok(())
            })
            .is_err());
        assert!(!invoked);
        let (_, mut wrong_hive) = sample(0, 1);
        if let SnapshotEntry::Registry(snapshot) = &mut wrong_hive {
            snapshot.hive = "HKLM".into();
        }
        assert!(validate_snapshot(&id, &wrong_hive).is_err());
        assert!(validate_snapshot(
            &id,
            &SnapshotEntry::PowerScheme {
                previous_guid: crate::power::HIGH_PERFORMANCE_GUID.into()
            }
        )
        .is_err());
    }
    #[test]
    fn legacy_store_and_owned_snapshot_survive_reopen_and_manual_takeover() {
        let temp = TempDir::new();
        let store = temp.store();
        let (id, entry) = sample(0, 12);
        // Existing releases had no owners field.
        fs::write(
            &store.file_path,
            serde_json::to_vec(&serde_json::json!({"snapshots": {id.clone(): entry.clone()}}))
                .unwrap(),
        )
        .unwrap();
        assert!(store.is_applied_checked(&id).unwrap());
        store.restore_entry(&id, |_| Ok(())).unwrap();
        let id = crate::turbo::TWEAK_ID;
        store
            .transaction()
            .unwrap()
            .save_owned_entry(id, turbo_snapshot(), "gs-100-200-300-1")
            .unwrap();
        assert_eq!(
            store.transaction().unwrap().owner(id),
            Some("gs-100-200-300-1")
        );
        store.transaction().unwrap().clear_owner(id).unwrap();
        let tx = store.transaction().unwrap();
        assert_eq!(tx.owner(id), None);
        assert!(tx.entry(id).is_some());
    }
    #[test]
    fn concurrent_transactions_preserve_all_originals() {
        let temp = TempDir::new();
        let handles: Vec<_> = (0..8)
            .map(|i| {
                let dir = temp.0.clone();
                std::thread::spawn(move || {
                    let store = RollbackStore::new(dir);
                    for attempt in 0..12 {
                        let (id, entry) = sample(i, attempt);
                        store.transaction().unwrap().save_entry(&id, entry).unwrap();
                    }
                })
            })
            .collect();
        for handle in handles {
            handle.join().unwrap();
        }
        let store = temp.store();
        let tx = store.transaction().unwrap();
        for i in 0..8 {
            let (id, _) = sample(i, 0);
            assert_eq!(original(tx.entry(&id).unwrap()), Some(RegValue::Dword(0)));
        }
    }
    #[test]
    fn child_process_writer() {
        let Some(dir) = std::env::var_os("PC_TWEAKER_TEST_ROLLBACK_DIR") else {
            return;
        };
        let index: usize = std::env::var("PC_TWEAKER_TEST_ROLLBACK_INDEX")
            .unwrap()
            .parse()
            .unwrap();
        let store = RollbackStore::new(dir.into());
        for attempt in 0..8 {
            let (id, entry) = sample(index, attempt);
            store.transaction().unwrap().save_entry(&id, entry).unwrap();
        }
    }
    #[test]
    fn separate_processes_share_the_same_lock_and_preserve_every_snapshot() {
        let temp = TempDir::new();
        let executable = std::env::current_exe().unwrap();
        let mut children: Vec<_> = (0..4)
            .map(|i| {
                let mut command = std::process::Command::new(&executable);
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    command.creation_flags(0x0800_0000);
                }
                command
                    .args([
                        "--exact",
                        "rollback::tests::child_process_writer",
                        "--nocapture",
                    ])
                    .env("PC_TWEAKER_TEST_ROLLBACK_DIR", &temp.0)
                    .env("PC_TWEAKER_TEST_ROLLBACK_INDEX", i.to_string())
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .spawn()
                    .unwrap()
            })
            .collect();
        for child in &mut children {
            assert!(child.wait().unwrap().success());
        }
        let store = temp.store();
        let tx = store.transaction().unwrap();
        for i in 0..4 {
            let (id, _) = sample(i, 0);
            assert_eq!(original(tx.entry(&id).unwrap()), Some(RegValue::Dword(0)));
        }
    }
    #[test]
    fn commits_leave_no_temporary_data_files() {
        let temp = TempDir::new();
        let store = temp.store();
        let (id, entry) = sample(0, 1);
        store.transaction().unwrap().save_entry(&id, entry).unwrap();
        assert!(fs::read_dir(&temp.0).unwrap().all(|item| !item
            .unwrap()
            .file_name()
            .to_string_lossy()
            .ends_with(".tmp")));
    }

    #[test]
    fn overlapping_tweaks_are_rejected_before_creating_a_second_snapshot() {
        let temp = TempDir::new();
        let store = temp.store();
        let power = SnapshotEntry::PowerScheme {
            previous_guid: crate::power::HIGH_PERFORMANCE_GUID.into(),
        };
        store
            .transaction()
            .unwrap()
            .save_entry(crate::power::TWEAK_ID, power.clone())
            .unwrap();
        let turbo = SnapshotEntry::Composite {
            entries: vec![
                SnapshotEntry::Registry(RegistrySnapshot {
                    hive: crate::turbo::GAME_DVR_HIVE.into(),
                    path: crate::turbo::GAME_DVR_PATH.into(),
                    name: crate::turbo::GAME_DVR_NAME.into(),
                    original_value: None,
                }),
                SnapshotEntry::Registry(RegistrySnapshot {
                    hive: crate::turbo::PRIORITY_HIVE.into(),
                    path: crate::turbo::PRIORITY_PATH.into(),
                    name: crate::turbo::PRIORITY_NAME.into(),
                    original_value: None,
                }),
                power,
            ],
        };
        assert!(store
            .transaction()
            .unwrap()
            .save_owned_entry(crate::turbo::TWEAK_ID, turbo, "gs-100-200-300-1")
            .is_err());
        assert_eq!(store.applied_ids().unwrap().len(), 1);
    }

    #[test]
    fn legacy_overlaps_block_restore_without_running_the_fake_mutation_or_losing_either_original() {
        let temp = TempDir::new();
        let store = temp.store();
        let power = SnapshotEntry::PowerScheme {
            previous_guid: crate::power::HIGH_PERFORMANCE_GUID.into(),
        };
        let turbo = SnapshotEntry::Composite {
            entries: vec![
                SnapshotEntry::Registry(RegistrySnapshot {
                    hive: crate::turbo::GAME_DVR_HIVE.into(),
                    path: crate::turbo::GAME_DVR_PATH.into(),
                    name: crate::turbo::GAME_DVR_NAME.into(),
                    original_value: None,
                }),
                SnapshotEntry::Registry(RegistrySnapshot {
                    hive: crate::turbo::PRIORITY_HIVE.into(),
                    path: crate::turbo::PRIORITY_PATH.into(),
                    name: crate::turbo::PRIORITY_NAME.into(),
                    original_value: None,
                }),
                power.clone(),
            ],
        };
        let state = Store {
            snapshots: [
                (crate::power::TWEAK_ID.into(), power),
                (crate::turbo::TWEAK_ID.into(), turbo),
            ]
            .into(),
            ..Store::default()
        };
        fs::write(&store.file_path, serde_json::to_vec(&state).unwrap()).unwrap();
        let mut writes = 0;
        for id in [crate::power::TWEAK_ID, crate::turbo::TWEAK_ID] {
            assert!(store
                .restore_entry(id, |_| {
                    writes += 1;
                    Ok(())
                })
                .is_err());
        }
        assert_eq!(writes, 0);
        assert_eq!(store.applied_ids().unwrap().len(), 2);
    }

    #[test]
    #[cfg(windows)]
    fn failed_restore_commit_keeps_disk_and_memory_snapshots_retryable() {
        use std::os::windows::fs::OpenOptionsExt;
        let temp = TempDir::new();
        let store = temp.store();
        let (id, entry) = sample(0, 12);
        let mut tx = store.transaction().unwrap();
        tx.save_entry(&id, entry).unwrap();
        // Allow reads/writes but deny replacement of this temporary JSON file.
        let held = OpenOptions::new()
            .read(true)
            .share_mode(0x1 | 0x2)
            .open(&store.file_path)
            .unwrap();
        assert!(tx.restore_entry(&id, |_| Ok(())).is_err());
        assert!(tx.entry(&id).is_some());
        drop(held);
        drop(tx);
        assert!(store.is_applied_checked(&id).unwrap());
        store.restore_entry(&id, |_| Ok(())).unwrap();
        assert!(!store.is_applied_checked(&id).unwrap());
    }

    #[test]
    fn orphaned_malformed_and_unsupported_session_owners_fail_closed() {
        let temp = TempDir::new();
        let store = temp.store();
        for raw in [
            serde_json::json!({"snapshots": {}, "owners": {"turbo_gaming": "gs-100-200-300-1"}}),
            serde_json::json!({"snapshots": {"turbo_gaming": turbo_snapshot()}, "owners": {"turbo_gaming": "malformed"}}),
        ] {
            let bytes = serde_json::to_vec(&raw).unwrap();
            fs::write(&store.file_path, &bytes).unwrap();
            assert!(store.transaction().is_err());
            assert_eq!(fs::read(&store.file_path).unwrap(), bytes);
        }
        fs::remove_file(&store.file_path).unwrap();
        let (id, entry) = sample(0, 1);
        assert!(store
            .transaction()
            .unwrap()
            .save_owned_entry(&id, entry, "gs-100-200-300-1")
            .is_err());
        assert!(store
            .transaction()
            .unwrap()
            .save_owned_entry(crate::turbo::TWEAK_ID, turbo_snapshot(), "bad")
            .is_err());
        assert!(store.applied_ids().unwrap().is_empty());
    }
}
