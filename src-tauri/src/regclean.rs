//! Registry cleaner: removes registry entries that are *provably* orphaned,
//! from five classes and nowhere else.
//!
//! Classic registry cleaners walk the whole registry and delete anything that
//! looks unused. That is how they break COM registrations, drivers and file
//! associations, for a performance gain nobody has ever measured. This module
//! does the opposite: it only knows five keys, and inside them it only removes
//! an entry when the file the entry exists to point at is gone from a fixed
//! drive that is present right now.
//!
//! | Class        | Where                                          | Orphaned when                                    |
//! |--------------|------------------------------------------------|--------------------------------------------------|
//! | Uninstall    | `...\CurrentVersion\Uninstall\<key>` (HKLM, HKLM 32-bit, HKCU) | its uninstaller *and the folder holding it* are gone, `InstallLocation` and `DisplayIcon` too; never MSI, system components or bundles |
//! | App Paths    | `...\CurrentVersion\App Paths\<name>.exe`      | the executable it registers is gone              |
//! | MUI cache    | HKCU `...\Shell\MuiCache` values               | the executable the cached name belongs to is gone |
//! | Shared DLLs  | HKLM `...\CurrentVersion\SharedDLLs` values    | the counted file is gone                         |
//! | Startup refs | HKCU `...\CurrentVersion\Run` values           | the command is empty, or its executable is gone  |
//!
//! "Gone" is decided by `provably_missing`: an absolute path on a *fixed*
//! drive that is mounted, with no 8.3 short name and no unexpandable
//! variable. A path on a USB disk, a network share or a drive letter that is
//! not there now could simply be unplugged, so it is never treated as proof.
//! HKLM `Run` values are deliberately out of scope: restoring one from a
//! user-writable backup through the administrator helper would let a planted
//! file make a program start for every user.
//!
//! Every clean writes a backup first (a JSON file the restore reads, plus the
//! same entries as a standard `.reg` file anyone can open), and nothing is
//! deleted if the backup cannot be written. The selection is never trusted:
//! a clean re-scans and only removes what the fresh scan still finds orphaned.
//! A restore re-creates entries only inside the five class roots and never
//! overwrites anything that exists again.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Class {
    Uninstall,
    AppPaths,
    MuiCache,
    SharedDlls,
    StartupRun,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, Hash)]
pub enum Hive {
    #[serde(rename = "HKCU")]
    Hkcu,
    #[serde(rename = "HKLM")]
    Hklm,
}

impl Hive {
    fn long_name(self) -> &'static str {
        match self {
            Hive::Hkcu => "HKEY_CURRENT_USER",
            Hive::Hklm => "HKEY_LOCAL_MACHINE",
        }
    }
    fn short(self) -> &'static str {
        match self {
            Hive::Hkcu => "HKCU",
            Hive::Hklm => "HKLM",
        }
    }
}

/// What one item of a class is: a whole subkey of the root, or one value in it.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Unit {
    Key,
    Value,
}

struct Root {
    class: Class,
    hive: Hive,
    path: &'static str,
    unit: Unit,
}

/// The only places this module reads, deletes or restores. Adding a root here
/// is the only way to widen it, which is what keeps a tampered backup from
/// naming anywhere else.
const ROOTS: &[Root] = &[
    Root {
        class: Class::Uninstall,
        hive: Hive::Hklm,
        path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        unit: Unit::Key,
    },
    Root {
        class: Class::Uninstall,
        hive: Hive::Hklm,
        path: r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        unit: Unit::Key,
    },
    Root {
        class: Class::Uninstall,
        hive: Hive::Hkcu,
        path: r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        unit: Unit::Key,
    },
    Root {
        class: Class::AppPaths,
        hive: Hive::Hklm,
        path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
        unit: Unit::Key,
    },
    Root {
        class: Class::AppPaths,
        hive: Hive::Hklm,
        path: r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths",
        unit: Unit::Key,
    },
    Root {
        class: Class::AppPaths,
        hive: Hive::Hkcu,
        path: r"Software\Microsoft\Windows\CurrentVersion\App Paths",
        unit: Unit::Key,
    },
    Root {
        class: Class::MuiCache,
        hive: Hive::Hkcu,
        path: r"Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache",
        unit: Unit::Value,
    },
    Root {
        class: Class::SharedDlls,
        hive: Hive::Hklm,
        path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\SharedDLLs",
        unit: Unit::Value,
    },
    Root {
        class: Class::StartupRun,
        hive: Hive::Hkcu,
        path: r"Software\Microsoft\Windows\CurrentVersion\Run",
        unit: Unit::Value,
    },
];

/// Never touched, whatever a root or a backup says. Belt and braces: no root
/// is under these, and the tests assert that a backup naming one is refused.
const FORBIDDEN: &[&str] = &[
    r"\currentcontrolset\services",
    r"\currentcontrolset\enum",
    r"\controlset00",
    r"\clsid",
    r"\classes\appid",
    r"\classes\typelib",
    r"\classes\interface",
];

fn forbidden(path: &str) -> bool {
    let lower = format!("\\{}", path.to_ascii_lowercase());
    FORBIDDEN.iter().any(|f| lower.contains(f))
}

/// One raw registry value, kept byte for byte so a restore is exact whatever
/// its type.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct RawValue {
    pub name: String,
    pub kind: u32,
    #[serde(with = "b64")]
    pub bytes: Vec<u8>,
}

const REG_SZ: u32 = 1;
const REG_EXPAND_SZ: u32 = 2;
const REG_BINARY: u32 = 3;
const REG_DWORD: u32 = 4;

impl RawValue {
    fn text(&self) -> Option<String> {
        if self.kind != REG_SZ && self.kind != REG_EXPAND_SZ {
            return None;
        }
        let units: Vec<u16> = self
            .bytes
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .take_while(|u| *u != 0)
            .collect();
        Some(String::from_utf16_lossy(&units))
    }
    fn dword(&self) -> Option<u32> {
        (self.kind == REG_DWORD && self.bytes.len() >= 4).then(|| {
            u32::from_le_bytes([self.bytes[0], self.bytes[1], self.bytes[2], self.bytes[3]])
        })
    }
}

mod b64 {
    use base64::Engine as _;
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(bytes: &[u8], s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&base64::engine::general_purpose::STANDARD.encode(bytes))
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<u8>, D::Error> {
        let text = String::deserialize(d)?;
        base64::engine::general_purpose::STANDARD
            .decode(text)
            .map_err(serde::de::Error::custom)
    }
}

/// Registry access, so the rules run against fixtures in the tests.
pub trait Registry {
    fn subkeys(&self, hive: Hive, path: &str) -> Vec<String>;
    fn values(&self, hive: Hive, path: &str) -> Vec<RawValue>;
    fn key_exists(&self, hive: Hive, path: &str) -> bool;
    /// Deletes a key that has no subkeys.
    fn delete_key(&self, hive: Hive, path: &str) -> std::io::Result<()>;
    fn delete_value(&self, hive: Hive, path: &str, name: &str) -> std::io::Result<()>;
    fn create_key(&self, hive: Hive, path: &str) -> std::io::Result<()>;
    fn set_value(&self, hive: Hive, path: &str, value: &RawValue) -> std::io::Result<()>;
}

/// File system facts, for the same reason.
pub trait Disk {
    fn exists(&self, path: &Path) -> bool;
    /// A fixed (non-removable, non-network) drive is mounted at `letter:\`.
    fn fixed_drive(&self, letter: char) -> bool;
}

/// One orphaned entry. `id` is derived from where it lives, so the same entry
/// keeps its id across scans and a selection can be re-matched after a rescan.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Item {
    pub id: String,
    pub class: Class,
    pub hive: Hive,
    pub key: String,
    /// The value removed, or `None` when the whole key is.
    pub value: Option<String>,
    /// What people recognise: the program's name or the file's.
    pub label: String,
    /// The missing file or folder that makes this entry an orphan; empty for
    /// an empty startup command.
    pub missing: String,
}

fn item_id(hive: Hive, key: &str, value: Option<&str>) -> String {
    use sha2::{Digest, Sha256};
    let mut hash = Sha256::new();
    hash.update(hive.short());
    hash.update([0]);
    hash.update(key.to_ascii_lowercase());
    hash.update([0]);
    hash.update(value.unwrap_or("\u{1}").to_ascii_lowercase());
    hash.finalize()[..8]
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// `text` as an absolute local path, or `None` when it is not one this module
/// can reason about (relative, UNC, unexpandable variable, 8.3 short name).
fn local_path(text: &str) -> Option<PathBuf> {
    let text = text.trim().trim_matches('"').trim();
    let expanded = if text.contains('%') {
        crate::startup::expand_env_vars(text)
    } else {
        text.to_string()
    };
    let bytes = expanded.as_bytes();
    if bytes.len() < 4
        || !bytes[0].is_ascii_alphabetic()
        || bytes[1] != b':'
        || bytes[2] != b'\\'
        || expanded.contains('~')
        || expanded.contains("\\..")
        || expanded.contains(['"', '*', '?', '<', '>', '|'])
    {
        return None;
    }
    Some(PathBuf::from(expanded))
}

/// Proven absent: on a fixed drive that is mounted, and not there.
fn provably_missing(path: &Path, disk: &dyn Disk) -> bool {
    let text = path.to_string_lossy();
    let Some(letter) = text.chars().next() else {
        return false;
    };
    // A 32-bit installer writes `System32` for what is really `SysWOW64`,
    // and this 64-bit process sees the other folder: nothing under the
    // Windows folder is judged, and none of it is a removed program's anyway.
    if in_windows_folder(&text) {
        return false;
    }
    disk.fixed_drive(letter.to_ascii_uppercase()) && !disk.exists(path)
}

fn in_windows_folder(path: &str) -> bool {
    let path = path.to_ascii_lowercase();
    let windir = std::env::var("SystemRoot")
        .unwrap_or_else(|_| r"C:\Windows".into())
        .to_ascii_lowercase();
    let windir = windir.trim_end_matches('\\');
    path == windir || path.starts_with(&format!("{windir}\\"))
}

fn missing_local(text: &str, disk: &dyn Disk) -> Option<PathBuf> {
    local_path(text).filter(|p| provably_missing(p, disk))
}

/// The executable of a command line, when it is one we can judge.
fn command_exe(command: &str) -> Option<PathBuf> {
    let exe = crate::startup::extract_exe_path(command)?;
    local_path(&exe.to_string_lossy())
}

fn named<'a>(values: &'a [RawValue], name: &str) -> Option<&'a RawValue> {
    values.iter().find(|v| v.name.eq_ignore_ascii_case(name))
}

fn uninstall_orphan(
    reg: &dyn Registry,
    disk: &dyn Disk,
    hive: Hive,
    key: &str,
    name: &str,
) -> Option<(String, String)> {
    if !reg.subkeys(hive, key).is_empty() {
        return None;
    }
    let values = reg.values(hive, key);
    let text = |n: &str| {
        named(&values, n)
            .and_then(RawValue::text)
            .filter(|s| !s.trim().is_empty())
    };
    let flag = |n: &str| named(&values, n).and_then(RawValue::dword) == Some(1);
    // Windows Installer products, components hidden on purpose and Burn
    // bundles are still tracked elsewhere; their entry is not ours to judge.
    if flag("WindowsInstaller")
        || flag("SystemComponent")
        || named(&values, "BundleCachePath").is_some()
        || named(&values, "BundleUpgradeCode").is_some()
    {
        return None;
    }
    let uninstall = text("UninstallString")?;
    let lower = uninstall.to_ascii_lowercase();
    if lower.contains("msiexec") || lower.contains("package cache") {
        return None;
    }
    let exe = command_exe(&uninstall)?;
    if !provably_missing(&exe, disk) || !provably_missing(exe.parent()?, disk) {
        return None;
    }
    if let Some(location) = text("InstallLocation") {
        // A location we cannot judge is not proof of anything.
        missing_local(&location, disk)?;
    }
    if let Some(icon) = text("DisplayIcon") {
        let icon = icon.split(',').next().unwrap_or_default();
        if local_path(icon).is_some_and(|p| disk.exists(&p)) {
            return None;
        }
    }
    let label = text("DisplayName").unwrap_or_else(|| name.to_string());
    Some((label, exe.to_string_lossy().into_owned()))
}

fn app_path_orphan(
    reg: &dyn Registry,
    disk: &dyn Disk,
    hive: Hive,
    key: &str,
    name: &str,
) -> Option<(String, String)> {
    if !name.to_ascii_lowercase().ends_with(".exe") || !reg.subkeys(hive, key).is_empty() {
        return None;
    }
    let values = reg.values(hive, key);
    let target = named(&values, "").and_then(RawValue::text)?;
    let missing = missing_local(&target, disk)?;
    Some((name.to_string(), missing.to_string_lossy().into_owned()))
}

fn file_label(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string())
}

fn value_orphan(class: Class, value: &RawValue, disk: &dyn Disk) -> Option<(String, String)> {
    match class {
        Class::MuiCache => {
            let path = [".FriendlyAppName", ".ApplicationCompany"]
                .iter()
                .find_map(|suffix| {
                    let lower = value.name.to_ascii_lowercase();
                    lower
                        .ends_with(&suffix.to_ascii_lowercase())
                        .then(|| &value.name[..value.name.len() - suffix.len()])
                })?;
            let missing = missing_local(path, disk)?;
            let label = value
                .text()
                .filter(|t| !t.trim().is_empty())
                .unwrap_or_else(|| file_label(path));
            Some((label, missing.to_string_lossy().into_owned()))
        }
        Class::SharedDlls => {
            let missing = missing_local(&value.name, disk)?;
            Some((
                file_label(&value.name),
                missing.to_string_lossy().into_owned(),
            ))
        }
        Class::StartupRun => {
            if value.name.is_empty() {
                return None;
            }
            let command = value.text()?;
            if command.trim().is_empty() {
                return Some((value.name.clone(), String::new()));
            }
            let exe = command_exe(&command)?;
            provably_missing(&exe, disk)
                .then(|| (value.name.clone(), exe.to_string_lossy().into_owned()))
        }
        Class::Uninstall | Class::AppPaths => None,
    }
}

/// Every orphaned entry in the given hives.
pub fn scan(reg: &dyn Registry, disk: &dyn Disk, hives: &[Hive]) -> Vec<Item> {
    let mut items = Vec::new();
    for root in ROOTS.iter().filter(|r| hives.contains(&r.hive)) {
        match root.unit {
            Unit::Key => {
                for name in reg.subkeys(root.hive, root.path) {
                    if name.is_empty() || name.contains('\\') {
                        continue;
                    }
                    let key = format!(r"{}\{}", root.path, name);
                    let found = match root.class {
                        Class::Uninstall => uninstall_orphan(reg, disk, root.hive, &key, &name),
                        _ => app_path_orphan(reg, disk, root.hive, &key, &name),
                    };
                    if let Some((label, missing)) = found {
                        items.push(Item {
                            id: item_id(root.hive, &key, None),
                            class: root.class,
                            hive: root.hive,
                            key,
                            value: None,
                            label,
                            missing,
                        });
                    }
                }
            }
            Unit::Value => {
                for value in reg.values(root.hive, root.path) {
                    if let Some((label, missing)) = value_orphan(root.class, &value, disk) {
                        items.push(Item {
                            id: item_id(root.hive, root.path, Some(&value.name)),
                            class: root.class,
                            hive: root.hive,
                            key: root.path.to_string(),
                            value: Some(value.name.clone()),
                            label,
                            missing,
                        });
                    }
                }
            }
        }
    }
    items
}

/// Whether an item names a place this module may touch: a value directly in a
/// value root, or a direct subkey of a key root, of the item's own class.
fn allowed(class: Class, hive: Hive, key: &str, value: Option<&str>) -> bool {
    if forbidden(key) || key.contains('\0') || value.is_some_and(|v| v.contains('\0')) {
        return false;
    }
    ROOTS.iter().any(|root| {
        root.class == class
            && root.hive == hive
            && match (root.unit, value) {
                (Unit::Value, Some(_)) => key.eq_ignore_ascii_case(root.path),
                (Unit::Key, None) => {
                    key.get(..root.path.len())
                        .is_some_and(|head| head.eq_ignore_ascii_case(root.path))
                        && key[root.path.len()..]
                            .strip_prefix('\\')
                            .is_some_and(|rest| !rest.is_empty() && !rest.contains('\\'))
                }
                _ => false,
            }
    })
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BackupItem {
    #[serde(flatten)]
    pub item: Item,
    /// Every value of a removed key, or the single removed value.
    pub values: Vec<RawValue>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Backup {
    pub version: u32,
    pub stamp: String,
    pub items: Vec<BackupItem>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct CleanResult {
    pub removed: u32,
    /// Selected entries the fresh scan no longer found orphaned, or that
    /// Windows refused to delete.
    pub skipped: u32,
    /// The backup's id, for the restore button; empty when nothing was removed.
    pub stamp: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct RestoreResult {
    pub restored: u32,
    /// Entries that exist again (never overwritten) or fall outside the roots.
    pub skipped: u32,
}

/// A backup id: a millisecond timestamp, nothing that could name a path.
pub fn valid_stamp(stamp: &str) -> bool {
    (10..=16).contains(&stamp.len()) && stamp.bytes().all(|b| b.is_ascii_digit())
}

fn backup_file(dir: &Path, stamp: &str, hive: Hive, ext: &str) -> PathBuf {
    let tag = match hive {
        Hive::Hkcu => "user",
        Hive::Hklm => "system",
    };
    dir.join(format!("{stamp}-{tag}.{ext}"))
}

/// The same entries in regedit's own format (UTF-16 with a BOM), so a backup
/// can be inspected or merged by hand without PC Tweaker.
pub fn reg_text(backup: &Backup) -> String {
    fn quoted(s: &str) -> String {
        format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
    }
    let mut out = String::from("Windows Registry Editor Version 5.00\r\n");
    for entry in &backup.items {
        out.push_str(&format!(
            "\r\n[{}\\{}]\r\n",
            entry.item.hive.long_name(),
            entry.item.key
        ));
        for value in &entry.values {
            let name = if value.name.is_empty() {
                "@".to_string()
            } else {
                quoted(&value.name)
            };
            let data = match value.kind {
                REG_SZ
                    if value.text().is_some()
                        && !value.text().unwrap_or_default().contains(['\r', '\n']) =>
                {
                    quoted(&value.text().unwrap_or_default())
                }
                REG_DWORD if value.bytes.len() == 4 => {
                    format!("dword:{:08x}", value.dword().unwrap_or(0))
                }
                kind => {
                    let hex = value
                        .bytes
                        .iter()
                        .map(|b| format!("{b:02x}"))
                        .collect::<Vec<_>>()
                        .join(",");
                    if kind == REG_BINARY {
                        format!("hex:{hex}")
                    } else {
                        format!("hex({kind:x}):{hex}")
                    }
                }
            };
            out.push_str(&format!("{name}={data}\r\n"));
        }
    }
    out
}

fn write_backup(dir: &Path, hive: Hive, backup: &Backup) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("could not create the backup folder: {e}"))?;
    let json = serde_json::to_vec_pretty(backup).map_err(|e| e.to_string())?;
    let mut reg: Vec<u8> = vec![0xFF, 0xFE];
    reg.extend(reg_text(backup).encode_utf16().flat_map(u16::to_le_bytes));
    for (ext, bytes) in [("json", json), ("reg", reg)] {
        let path = backup_file(dir, &backup.stamp, hive, ext);
        let temp = path.with_extension(format!("{ext}.tmp"));
        std::fs::write(&temp, bytes)
            .map_err(|e| format!("could not write the registry backup: {e}"))?;
        crate::rollback::replace_file(&temp, &path).map_err(|e| {
            let _ = std::fs::remove_file(&temp);
            format!("could not save the registry backup: {e}")
        })?;
    }
    Ok(())
}

/// Removes the selected entries of one hive that a fresh scan still finds
/// orphaned, after writing their backup. Nothing is removed without one.
pub fn clean(
    reg: &dyn Registry,
    disk: &dyn Disk,
    hive: Hive,
    ids: &[String],
    backup_dir: &Path,
    stamp: &str,
) -> Result<CleanResult, String> {
    if !valid_stamp(stamp) {
        return Err("invalid backup id".into());
    }
    let fresh = scan(reg, disk, &[hive]);
    let chosen: Vec<&Item> = fresh
        .iter()
        .filter(|i| ids.iter().any(|id| *id == i.id))
        .collect();
    let mut result = CleanResult {
        skipped: ids.len().saturating_sub(chosen.len()) as u32,
        ..CleanResult::default()
    };
    if chosen.is_empty() {
        return Ok(result);
    }
    let backup = Backup {
        version: 1,
        stamp: stamp.to_string(),
        items: chosen
            .iter()
            .map(|item| BackupItem {
                item: (*item).clone(),
                values: match &item.value {
                    None => reg.values(hive, &item.key),
                    Some(name) => reg
                        .values(hive, &item.key)
                        .into_iter()
                        .filter(|v| v.name.eq_ignore_ascii_case(name))
                        .collect(),
                },
            })
            .collect(),
    };
    write_backup(backup_dir, hive, &backup)?;
    for item in chosen {
        if !allowed(item.class, item.hive, &item.key, item.value.as_deref()) {
            result.skipped += 1;
            continue;
        }
        let done = match &item.value {
            None => reg.delete_key(hive, &item.key),
            Some(name) => reg.delete_value(hive, &item.key, name),
        };
        if done.is_ok() {
            result.removed += 1;
        } else {
            result.skipped += 1;
        }
    }
    result.stamp = stamp.to_string();
    Ok(result)
}

/// Puts back what a backup removed from one hive. Backup files are
/// user-writable input, including when the administrator helper reads them:
/// only entries inside the class roots are written, and nothing that exists
/// again is overwritten.
pub fn restore(
    reg: &dyn Registry,
    backup_dir: &Path,
    stamp: &str,
    hive: Hive,
) -> Result<RestoreResult, String> {
    if !valid_stamp(stamp) {
        return Err("invalid backup id".into());
    }
    let path = backup_file(backup_dir, stamp, hive, "json");
    let raw = match std::fs::read(&path) {
        Ok(raw) => raw,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(RestoreResult::default()),
        Err(e) => return Err(format!("could not read the registry backup: {e}")),
    };
    let backup: Backup =
        serde_json::from_slice(&raw).map_err(|_| "the registry backup is damaged".to_string())?;
    let mut result = RestoreResult::default();
    for entry in &backup.items {
        let item = &entry.item;
        if item.hive != hive
            || !allowed(item.class, item.hive, &item.key, item.value.as_deref())
            || entry
                .values
                .iter()
                .any(|v| v.name.contains('\0') || v.kind > 11)
        {
            result.skipped += 1;
            continue;
        }
        let written = match &item.value {
            None if reg.key_exists(hive, &item.key) => {
                result.skipped += 1;
                continue;
            }
            None => reg.create_key(hive, &item.key).and_then(|_| {
                entry
                    .values
                    .iter()
                    .try_for_each(|v| reg.set_value(hive, &item.key, v))
            }),
            Some(name) => {
                let value = entry
                    .values
                    .iter()
                    .find(|v| v.name.eq_ignore_ascii_case(name));
                let exists = reg
                    .values(hive, &item.key)
                    .iter()
                    .any(|v| v.name.eq_ignore_ascii_case(name));
                match value {
                    Some(value) if !exists => reg.set_value(hive, &item.key, value),
                    _ => {
                        result.skipped += 1;
                        continue;
                    }
                }
            }
        };
        if written.is_ok() {
            result.restored += 1;
        } else {
            result.skipped += 1;
        }
    }
    Ok(result)
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct BackupInfo {
    pub stamp: String,
    pub items: u32,
}

/// The backups on disk, newest first; the user and system halves of one clean
/// count as one.
pub fn backups(dir: &Path) -> Vec<BackupInfo> {
    let mut found: std::collections::BTreeMap<String, u32> = Default::default();
    for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(stem) = name.strip_suffix(".json") else {
            continue;
        };
        let Some((stamp, _)) = stem.split_once('-') else {
            continue;
        };
        if !valid_stamp(stamp) {
            continue;
        }
        let count = std::fs::read(entry.path())
            .ok()
            .and_then(|raw| serde_json::from_slice::<Backup>(&raw).ok())
            .map_or(0, |b| b.items.len() as u32);
        *found.entry(stamp.to_string()).or_default() += count;
    }
    found
        .into_iter()
        .rev()
        .map(|(stamp, items)| BackupInfo { stamp, items })
        .collect()
}

/// Keeps the newest `keep` backups.
pub fn prune(dir: &Path, keep: usize) {
    let old: Vec<String> = backups(dir)
        .into_iter()
        .skip(keep)
        .map(|b| b.stamp)
        .collect();
    for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if old
            .iter()
            .any(|stamp| name.starts_with(&format!("{stamp}-")))
        {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

pub fn backup_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("registry-backups")
}

#[cfg(windows)]
pub mod live {
    //! The real registry and disk.
    use super::*;
    use winreg::enums::{RegType, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_SET_VALUE};
    use winreg::RegKey;

    pub struct WinRegistry;
    pub struct WinDisk;

    fn hkey(hive: Hive) -> RegKey {
        RegKey::predef(match hive {
            Hive::Hkcu => HKEY_CURRENT_USER,
            Hive::Hklm => HKEY_LOCAL_MACHINE,
        })
    }

    fn kind(raw: u32) -> Option<RegType> {
        use RegType::*;
        Some(match raw {
            0 => REG_NONE,
            1 => REG_SZ,
            2 => REG_EXPAND_SZ,
            3 => REG_BINARY,
            4 => REG_DWORD,
            5 => REG_DWORD_BIG_ENDIAN,
            6 => REG_LINK,
            7 => REG_MULTI_SZ,
            8 => REG_RESOURCE_LIST,
            9 => REG_FULL_RESOURCE_DESCRIPTOR,
            10 => REG_RESOURCE_REQUIREMENTS_LIST,
            11 => REG_QWORD,
            _ => return None,
        })
    }

    impl Registry for WinRegistry {
        fn subkeys(&self, hive: Hive, path: &str) -> Vec<String> {
            hkey(hive)
                .open_subkey_with_flags(path, KEY_READ)
                .map(|k| k.enum_keys().flatten().collect())
                .unwrap_or_default()
        }
        fn values(&self, hive: Hive, path: &str) -> Vec<RawValue> {
            hkey(hive)
                .open_subkey_with_flags(path, KEY_READ)
                .map(|k| {
                    k.enum_values()
                        .flatten()
                        .map(|(name, v)| RawValue {
                            name,
                            kind: v.vtype as u32,
                            bytes: v.bytes,
                        })
                        .collect()
                })
                .unwrap_or_default()
        }
        fn key_exists(&self, hive: Hive, path: &str) -> bool {
            hkey(hive).open_subkey_with_flags(path, KEY_READ).is_ok()
        }
        fn delete_key(&self, hive: Hive, path: &str) -> std::io::Result<()> {
            // Non-recursive on purpose: a key that grew a subkey since the
            // scan is refused by Windows instead of taking it along.
            hkey(hive).delete_subkey(path)
        }
        fn delete_value(&self, hive: Hive, path: &str, name: &str) -> std::io::Result<()> {
            hkey(hive)
                .open_subkey_with_flags(path, KEY_SET_VALUE)?
                .delete_value(name)
        }
        fn create_key(&self, hive: Hive, path: &str) -> std::io::Result<()> {
            hkey(hive).create_subkey(path).map(|_| ())
        }
        fn set_value(&self, hive: Hive, path: &str, value: &RawValue) -> std::io::Result<()> {
            let vtype = kind(value.kind).ok_or(std::io::ErrorKind::InvalidData)?;
            hkey(hive)
                .open_subkey_with_flags(path, KEY_SET_VALUE)?
                .set_raw_value(
                    &value.name,
                    &winreg::RegValue {
                        bytes: value.bytes.clone(),
                        vtype,
                    },
                )
        }
    }

    impl Disk for WinDisk {
        fn exists(&self, path: &Path) -> bool {
            // A path Windows cannot even query (access denied) counts as
            // present: only a clean "not found" is proof of absence.
            match std::fs::symlink_metadata(path) {
                Ok(_) => true,
                Err(e) => {
                    !matches!(e.kind(), std::io::ErrorKind::NotFound) && e.raw_os_error() != Some(3)
                }
            }
        }
        fn fixed_drive(&self, letter: char) -> bool {
            const DRIVE_FIXED: u32 = 3;
            if !letter.is_ascii_alphabetic() {
                return false;
            }
            let root: Vec<u16> = format!("{letter}:\\")
                .encode_utf16()
                .chain(Some(0))
                .collect();
            // SAFETY: a NUL-terminated root path that outlives the call.
            let fixed =
                unsafe { windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(root.as_ptr()) }
                    == DRIVE_FIXED;
            fixed && Path::new(&format!("{letter}:\\")).exists()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::{BTreeMap, HashSet};

    #[derive(Default)]
    struct FakeRegistry {
        /// (hive, lowercase path) -> (real path, values)
        keys: RefCell<BTreeMap<(Hive, String), (String, Vec<RawValue>)>>,
    }

    impl FakeRegistry {
        fn key(&self, hive: Hive, path: &str, values: Vec<RawValue>) {
            // Parents exist too, like in a real hive.
            let mut at = String::new();
            for part in path.split('\\') {
                if !at.is_empty() {
                    at.push('\\');
                }
                at.push_str(part);
                self.keys
                    .borrow_mut()
                    .entry((hive, at.to_ascii_lowercase()))
                    .or_insert_with(|| (at.clone(), Vec::new()));
            }
            self.keys
                .borrow_mut()
                .get_mut(&(hive, path.to_ascii_lowercase()))
                .unwrap()
                .1 = values;
        }
        fn has_key(&self, hive: Hive, path: &str) -> bool {
            self.keys
                .borrow()
                .contains_key(&(hive, path.to_ascii_lowercase()))
        }
        fn value(&self, hive: Hive, path: &str, name: &str) -> Option<RawValue> {
            self.values(hive, path)
                .into_iter()
                .find(|v| v.name.eq_ignore_ascii_case(name))
        }
    }

    impl Registry for FakeRegistry {
        fn subkeys(&self, hive: Hive, path: &str) -> Vec<String> {
            let prefix = format!("{}\\", path.to_ascii_lowercase());
            self.keys
                .borrow()
                .iter()
                .filter(|((h, p), _)| {
                    *h == hive && p.starts_with(&prefix) && !p[prefix.len()..].contains('\\')
                })
                .map(|(_, (real, _))| real.rsplit('\\').next().unwrap().to_string())
                .collect()
        }
        fn values(&self, hive: Hive, path: &str) -> Vec<RawValue> {
            self.keys
                .borrow()
                .get(&(hive, path.to_ascii_lowercase()))
                .map(|(_, v)| v.clone())
                .unwrap_or_default()
        }
        fn key_exists(&self, hive: Hive, path: &str) -> bool {
            self.has_key(hive, path)
        }
        fn delete_key(&self, hive: Hive, path: &str) -> std::io::Result<()> {
            if !self.subkeys(hive, path).is_empty() {
                return Err(std::io::ErrorKind::PermissionDenied.into());
            }
            self.keys
                .borrow_mut()
                .remove(&(hive, path.to_ascii_lowercase()));
            Ok(())
        }
        fn delete_value(&self, hive: Hive, path: &str, name: &str) -> std::io::Result<()> {
            if let Some((_, values)) = self
                .keys
                .borrow_mut()
                .get_mut(&(hive, path.to_ascii_lowercase()))
            {
                values.retain(|v| !v.name.eq_ignore_ascii_case(name));
            }
            Ok(())
        }
        fn create_key(&self, hive: Hive, path: &str) -> std::io::Result<()> {
            if !self.has_key(hive, path) {
                self.key(hive, path, Vec::new());
            }
            Ok(())
        }
        fn set_value(&self, hive: Hive, path: &str, value: &RawValue) -> std::io::Result<()> {
            let mut keys = self.keys.borrow_mut();
            let (_, values) = keys
                .get_mut(&(hive, path.to_ascii_lowercase()))
                .ok_or(std::io::ErrorKind::NotFound)?;
            values.retain(|v| !v.name.eq_ignore_ascii_case(&value.name));
            values.push(value.clone());
            Ok(())
        }
    }

    struct FakeDisk {
        files: HashSet<String>,
        fixed: &'static str,
    }

    impl Disk for FakeDisk {
        fn exists(&self, path: &Path) -> bool {
            let p = path.to_string_lossy().to_ascii_lowercase();
            self.files
                .iter()
                .any(|f| *f == p || f.starts_with(&format!("{p}\\")))
        }
        fn fixed_drive(&self, letter: char) -> bool {
            self.fixed.contains(letter)
        }
    }

    fn sz(name: &str, text: &str) -> RawValue {
        RawValue {
            name: name.into(),
            kind: REG_SZ,
            bytes: text
                .encode_utf16()
                .chain(Some(0))
                .flat_map(u16::to_le_bytes)
                .collect(),
        }
    }
    fn dword(name: &str, v: u32) -> RawValue {
        RawValue {
            name: name.into(),
            kind: REG_DWORD,
            bytes: v.to_le_bytes().to_vec(),
        }
    }

    const UNINSTALL: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
    const UNINSTALL_USER: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
    const APP_PATHS: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths";
    const MUI: &str = r"Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache";
    const SHARED: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\SharedDLLs";
    const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

    /// A machine with one orphan per class, plus every look-alike the rules
    /// must leave alone.
    fn fixture() -> (FakeRegistry, FakeDisk) {
        let reg = FakeRegistry::default();
        let u = |name: &str, values: Vec<RawValue>| {
            reg.key(Hive::Hklm, &format!(r"{UNINSTALL}\{name}"), values)
        };
        // Orphan: uninstaller and its folder gone.
        u(
            "GoneApp",
            vec![
                sz("DisplayName", "Gone App 2.1"),
                sz(
                    "UninstallString",
                    r#""C:\Program Files\GoneApp\uninstall.exe" /S"#,
                ),
                sz("InstallLocation", r"C:\Program Files\GoneApp"),
            ],
        );
        // Installed: uninstaller present.
        u(
            "LiveApp",
            vec![
                sz("DisplayName", "Live App"),
                sz("UninstallString", r"C:\Program Files\LiveApp\unins000.exe"),
            ],
        );
        // Uninstaller gone but its folder is still there: not proof.
        u(
            "BrokenApp",
            vec![sz(
                "UninstallString",
                r"C:\Program Files\BrokenApp\uninst.exe",
            )],
        );
        // MSI product, system component, bundle: never judged.
        u(
            "{11111111-2222-3333-4444-555555555555}",
            vec![
                dword("WindowsInstaller", 1),
                sz("UninstallString", r"C:\Gone\x.exe"),
            ],
        );
        u(
            "Hidden",
            vec![
                dword("SystemComponent", 1),
                sz("UninstallString", r"C:\Gone\x.exe"),
            ],
        );
        u(
            "Bundle",
            vec![
                sz(
                    "BundleCachePath",
                    r"C:\ProgramData\Package Cache\{x}\setup.exe",
                ),
                sz("UninstallString", r#""C:\Gone2\setup.exe" /uninstall"#),
            ],
        );
        u(
            "MsiString",
            vec![sz("UninstallString", r"MsiExec.exe /X{AAAA}")],
        );
        // On a removable drive (E:) or a drive that is not there (Z:): unplugged, maybe.
        u(
            "UsbApp",
            vec![sz("UninstallString", r"E:\Apps\Usb\uninstall.exe")],
        );
        u(
            "ZApp",
            vec![sz("UninstallString", r"Z:\Apps\uninstall.exe")],
        );
        // 8.3 short name and a bare program name: cannot be judged.
        u(
            "ShortName",
            vec![sz("UninstallString", r"C:\PROGRA~1\Short\uninst.exe")],
        );
        u(
            "Bare",
            vec![sz(
                "UninstallString",
                r"rundll32.exe setupapi,InstallHinfSection",
            )],
        );
        // Folder gone but the icon file is still there somewhere: keep.
        u(
            "IconLeft",
            vec![
                sz("UninstallString", r"C:\Gone3\u.exe"),
                sz("DisplayIcon", r"C:\Program Files\Shared\icon.exe,0"),
            ],
        );
        // A subkey makes an Uninstall key unusual: keep.
        u("WithChild", vec![sz("UninstallString", r"C:\Gone4\u.exe")]);
        reg.key(Hive::Hklm, &format!(r"{UNINSTALL}\WithChild\Extra"), vec![]);
        // Per-user orphan.
        reg.key(
            Hive::Hkcu,
            &format!(r"{UNINSTALL_USER}\UserGone"),
            vec![
                sz("DisplayName", "User Gone"),
                sz(
                    "UninstallString",
                    r"C:\Users\me\AppData\Local\UserGone\Update.exe --uninstall",
                ),
            ],
        );

        reg.key(
            Hive::Hklm,
            &format!(r"{APP_PATHS}\gone.exe"),
            vec![sz("", r"C:\Program Files\GoneApp\gone.exe")],
        );
        reg.key(
            Hive::Hklm,
            &format!(r"{APP_PATHS}\live.exe"),
            vec![sz("", r#""C:\Program Files\LiveApp\live.exe""#)],
        );
        reg.key(
            Hive::Hklm,
            &format!(r"{APP_PATHS}\nodefault.exe"),
            vec![sz("Path", r"C:\Gone")],
        );

        reg.key(
            Hive::Hkcu,
            MUI,
            vec![
                sz(
                    r"C:\Program Files\GoneApp\gone.exe.FriendlyAppName",
                    "Gone App",
                ),
                sz(
                    r"C:\Program Files\GoneApp\gone.exe.ApplicationCompany",
                    "Gone Inc.",
                ),
                sz(
                    r"C:\Program Files\LiveApp\live.exe.FriendlyAppName",
                    "Live App",
                ),
                sz("LangID", "x"),
                sz(r"@%SystemRoot%\system32\shell32.dll,-22067", "Shell"),
            ],
        );
        reg.key(
            Hive::Hklm,
            SHARED,
            vec![
                dword(r"C:\Program Files\GoneApp\shared.dll", 1),
                dword(r"C:\Windows\System32\live.dll", 3),
                // A 32-bit DLL a 32-bit installer counted as System32: really in
                // SysWOW64, invisible from here, never judged.
                dword(r"C:\Windows\system32\msvcr71.dll", 1),
            ],
        );
        reg.key(
            Hive::Hkcu,
            RUN,
            vec![
                sz("Empty", "  "),
                sz("GoneTray", r#""C:\Program Files\GoneApp\tray.exe" --min"#),
                sz("LiveTray", r"C:\Program Files\LiveApp\live.exe"),
                sz("Rundll", r"rundll32.exe C:\Gone\x.dll,Start"),
                sz("UsbTray", r"E:\tray.exe"),
            ],
        );

        // Decoys outside every root, which must stay untouched.
        reg.key(
            Hive::Hklm,
            r"SYSTEM\CurrentControlSet\Services\GoneSvc",
            vec![sz("ImagePath", r"C:\Gone\svc.exe")],
        );
        reg.key(
            Hive::Hklm,
            r"SOFTWARE\Classes\CLSID\{0000}\InprocServer32",
            vec![sz("", r"C:\Gone\com.dll")],
        );

        let files = [
            r"c:\program files\liveapp\unins000.exe",
            r"c:\program files\liveapp\live.exe",
            r"c:\program files\brokenapp\readme.txt",
            r"c:\program files\shared\icon.exe",
            r"c:\windows\system32\live.dll",
            r"e:\apps\readme.txt",
        ];
        let disk = FakeDisk {
            files: files.iter().map(|s| s.to_string()).collect(),
            fixed: "C",
        };
        (reg, disk)
    }

    fn labels(items: &[Item]) -> Vec<(Class, String)> {
        let mut out: Vec<_> = items.iter().map(|i| (i.class, i.label.clone())).collect();
        out.sort_by(|a, b| format!("{a:?}").cmp(&format!("{b:?}")));
        out
    }

    #[test]
    fn finds_exactly_the_provable_orphans() {
        let (reg, disk) = fixture();
        let items = scan(&reg, &disk, &[Hive::Hklm, Hive::Hkcu]);
        assert_eq!(
            labels(&items),
            labels(&[
                Item {
                    id: String::new(),
                    class: Class::Uninstall,
                    hive: Hive::Hklm,
                    key: String::new(),
                    value: None,
                    label: "Gone App 2.1".into(),
                    missing: String::new()
                },
                Item {
                    id: String::new(),
                    class: Class::Uninstall,
                    hive: Hive::Hkcu,
                    key: String::new(),
                    value: None,
                    label: "User Gone".into(),
                    missing: String::new()
                },
                Item {
                    id: String::new(),
                    class: Class::AppPaths,
                    hive: Hive::Hklm,
                    key: String::new(),
                    value: None,
                    label: "gone.exe".into(),
                    missing: String::new()
                },
                Item {
                    id: String::new(),
                    class: Class::MuiCache,
                    hive: Hive::Hkcu,
                    key: String::new(),
                    value: None,
                    label: "Gone App".into(),
                    missing: String::new()
                },
                Item {
                    id: String::new(),
                    class: Class::MuiCache,
                    hive: Hive::Hkcu,
                    key: String::new(),
                    value: None,
                    label: "Gone Inc.".into(),
                    missing: String::new()
                },
                Item {
                    id: String::new(),
                    class: Class::SharedDlls,
                    hive: Hive::Hklm,
                    key: String::new(),
                    value: None,
                    label: "shared.dll".into(),
                    missing: String::new()
                },
                Item {
                    id: String::new(),
                    class: Class::StartupRun,
                    hive: Hive::Hkcu,
                    key: String::new(),
                    value: None,
                    label: "Empty".into(),
                    missing: String::new()
                },
                Item {
                    id: String::new(),
                    class: Class::StartupRun,
                    hive: Hive::Hkcu,
                    key: String::new(),
                    value: None,
                    label: "GoneTray".into(),
                    missing: String::new()
                },
            ])
        );
        assert!(items
            .iter()
            .all(|i| allowed(i.class, i.hive, &i.key, i.value.as_deref())));
        assert!(items.iter().all(|i| !forbidden(&i.key)));
        // Ids are stable across scans and unique.
        let again = scan(&reg, &disk, &[Hive::Hklm, Hive::Hkcu]);
        assert_eq!(items, again);
        let ids: HashSet<_> = items.iter().map(|i| &i.id).collect();
        assert_eq!(ids.len(), items.len());
    }

    #[test]
    fn scanning_one_hive_never_reports_the_other() {
        let (reg, disk) = fixture();
        assert!(scan(&reg, &disk, &[Hive::Hkcu])
            .iter()
            .all(|i| i.hive == Hive::Hkcu));
        assert!(scan(&reg, &disk, &[Hive::Hklm])
            .iter()
            .all(|i| i.hive == Hive::Hklm));
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pct-regclean-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn clean_backs_up_first_removes_only_the_selection_and_restores_byte_for_byte() {
        let (reg, disk) = fixture();
        let dir = temp_dir("roundtrip");
        let items = scan(&reg, &disk, &[Hive::Hklm]);
        let gone = items.iter().find(|i| i.label == "Gone App 2.1").unwrap();
        let dll = items.iter().find(|i| i.class == Class::SharedDlls).unwrap();
        let before_key = reg.values(Hive::Hklm, &gone.key);
        let ids = vec![gone.id.clone(), dll.id.clone(), "not-a-real-id".to_string()];

        let result = clean(&reg, &disk, Hive::Hklm, &ids, &dir, "1762000000000").unwrap();
        assert_eq!(
            result,
            CleanResult {
                removed: 2,
                skipped: 1,
                stamp: "1762000000000".into()
            }
        );
        assert!(!reg.has_key(Hive::Hklm, &gone.key));
        assert!(reg
            .value(Hive::Hklm, SHARED, r"C:\Program Files\GoneApp\shared.dll")
            .is_none());
        // Unselected orphans and everything else stay.
        assert!(reg.has_key(Hive::Hklm, &format!(r"{APP_PATHS}\gone.exe")));
        assert!(reg
            .value(Hive::Hklm, SHARED, r"C:\Windows\System32\live.dll")
            .is_some());
        assert!(reg.has_key(Hive::Hklm, r"SYSTEM\CurrentControlSet\Services\GoneSvc"));
        // Both backup files exist; the .reg one is regedit's UTF-16 format.
        let reg_file = std::fs::read(dir.join("1762000000000-system.reg")).unwrap();
        assert_eq!(&reg_file[..2], &[0xFF, 0xFE]);
        assert_eq!(
            backups(&dir),
            vec![BackupInfo {
                stamp: "1762000000000".into(),
                items: 2
            }]
        );

        let restored = restore(&reg, &dir, "1762000000000", Hive::Hklm).unwrap();
        assert_eq!(
            restored,
            RestoreResult {
                restored: 2,
                skipped: 0
            }
        );
        assert_eq!(reg.values(Hive::Hklm, &gone.key), before_key);
        assert_eq!(
            reg.value(Hive::Hklm, SHARED, r"C:\Program Files\GoneApp\shared.dll")
                .unwrap()
                .bytes,
            1u32.to_le_bytes().to_vec()
        );
        // A second restore overwrites nothing.
        assert_eq!(
            restore(&reg, &dir, "1762000000000", Hive::Hklm).unwrap(),
            RestoreResult {
                restored: 0,
                skipped: 2
            }
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn nothing_is_removed_when_the_backup_cannot_be_written() {
        let (reg, disk) = fixture();
        let dir = temp_dir("nobackup");
        std::fs::create_dir_all(dir.parent().unwrap()).unwrap();
        // A file where the backup folder should be.
        std::fs::write(&dir, b"x").unwrap();
        let items = scan(&reg, &disk, &[Hive::Hkcu]);
        let ids: Vec<String> = items.iter().map(|i| i.id.clone()).collect();
        assert!(clean(&reg, &disk, Hive::Hkcu, &ids, &dir, "1762000000001").is_err());
        assert_eq!(scan(&reg, &disk, &[Hive::Hkcu]), items);
        let _ = std::fs::remove_file(&dir);
    }

    #[test]
    fn a_selection_that_is_no_longer_orphaned_is_left_alone() {
        let (reg, mut disk) = fixture();
        let dir = temp_dir("reinstalled");
        let item = scan(&reg, &disk, &[Hive::Hklm])
            .into_iter()
            .find(|i| i.class == Class::AppPaths)
            .unwrap();
        // Reinstalled between the scan and the click.
        disk.files
            .insert(r"c:\program files\goneapp\gone.exe".into());
        let result = clean(
            &reg,
            &disk,
            Hive::Hklm,
            &[item.id.clone()],
            &dir,
            "1762000000002",
        )
        .unwrap();
        assert_eq!(result.removed, 0);
        assert!(reg.has_key(Hive::Hklm, &item.key));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_tampered_backup_cannot_write_outside_the_class_roots_or_overwrite() {
        let (reg, _) = fixture();
        let dir = temp_dir("tampered");
        std::fs::create_dir_all(&dir).unwrap();
        let entry = |class, key: &str, value: Option<&str>| BackupItem {
            item: Item {
                id: "x".into(),
                class,
                hive: Hive::Hklm,
                key: key.into(),
                value: value.map(Into::into),
                label: "x".into(),
                missing: String::new(),
            },
            values: vec![sz(value.unwrap_or("ImagePath"), r"C:\evil.exe")],
        };
        let backup = Backup {
            version: 1,
            stamp: "1762000000003".into(),
            items: vec![
                entry(
                    Class::Uninstall,
                    r"SYSTEM\CurrentControlSet\Services\Evil",
                    None,
                ),
                entry(Class::Uninstall, r"SOFTWARE\Classes\CLSID\{0000}", None),
                entry(Class::AppPaths, &format!(r"{APP_PATHS}\a\b.exe"), None),
                entry(Class::SharedDlls, RUN, Some("Evil")),
                entry(
                    Class::StartupRun,
                    r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
                    Some("Evil"),
                ),
                // In a root, but the value exists: never overwritten.
                entry(
                    Class::SharedDlls,
                    SHARED,
                    Some(r"C:\Windows\System32\live.dll"),
                ),
            ],
        };
        std::fs::write(
            dir.join("1762000000003-system.json"),
            serde_json::to_vec(&backup).unwrap(),
        )
        .unwrap();
        let result = restore(&reg, &dir, "1762000000003", Hive::Hklm).unwrap();
        assert_eq!(
            result,
            RestoreResult {
                restored: 0,
                skipped: 6
            }
        );
        assert!(!reg.has_key(Hive::Hklm, r"SYSTEM\CurrentControlSet\Services\Evil"));
        assert_eq!(
            reg.value(Hive::Hklm, SHARED, r"C:\Windows\System32\live.dll")
                .unwrap()
                .kind,
            REG_DWORD
        );
        // A backup id that could name a path is refused outright.
        assert!(restore(&reg, &dir, r"..\..\x", Hive::Hklm).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_roots_never_reach_protected_places() {
        for root in ROOTS {
            assert!(!forbidden(root.path), "{}", root.path);
            // Only HKCU startup values: an HKLM Run value restored by the
            // administrator helper would start a program for every user.
            if root.class == Class::StartupRun {
                assert_eq!(root.hive, Hive::Hkcu);
            }
        }
        assert!(forbidden(r"SYSTEM\CurrentControlSet\Enum\PCI\x"));
        assert!(forbidden(r"SYSTEM\ControlSet001\Services\x"));
        assert!(forbidden(r"Software\Classes\CLSID\{x}"));
    }

    #[test]
    fn reg_export_is_regedit_format() {
        let backup = Backup {
            version: 1,
            stamp: "1".into(),
            items: vec![BackupItem {
                item: Item {
                    id: "x".into(),
                    class: Class::AppPaths,
                    hive: Hive::Hklm,
                    key: format!(r"{APP_PATHS}\a.exe"),
                    value: None,
                    label: "a.exe".into(),
                    missing: String::new(),
                },
                values: vec![
                    sz("", r#"C:\A "b"\a.exe"#),
                    dword("Flag", 0x2a),
                    RawValue {
                        name: "Path".into(),
                        kind: REG_EXPAND_SZ,
                        bytes: vec![0x41, 0, 0, 0],
                    },
                ],
            }],
        };
        let text = reg_text(&backup);
        assert!(text.starts_with("Windows Registry Editor Version 5.00\r\n"));
        assert!(text.contains(
            r"[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\a.exe]"
        ));
        assert!(text.contains(r#"@="C:\\A \"b\"\\a.exe""#));
        assert!(text.contains("\"Flag\"=dword:0000002a"));
        assert!(text.contains("\"Path\"=hex(2):41,00,00,00"));
    }

    /// Read-only against this machine's registry: whatever it finds lies in
    /// the class roots and points at something really missing.
    #[cfg(windows)]
    #[test]
    fn the_live_scan_only_reports_allowed_and_missing_targets() {
        let items = scan(
            &live::WinRegistry,
            &live::WinDisk,
            &[Hive::Hkcu, Hive::Hklm],
        );
        for item in &items {
            assert!(
                allowed(item.class, item.hive, &item.key, item.value.as_deref()),
                "{item:?}"
            );
            assert!(
                item.missing.is_empty() || !Path::new(&item.missing).exists(),
                "{item:?}"
            );
        }
        println!("live registry scan: {} orphaned entries", items.len());
        for item in items.iter().take(40) {
            println!(
                "  {:?} {:?} {} -> {}",
                item.class, item.hive, item.label, item.missing
            );
        }
    }

    #[test]
    fn prune_keeps_the_newest_backups() {
        let dir = temp_dir("prune");
        std::fs::create_dir_all(&dir).unwrap();
        let empty = |stamp: &str| Backup {
            version: 1,
            stamp: stamp.into(),
            items: vec![],
        };
        for stamp in ["1762000000010", "1762000000011", "1762000000012"] {
            write_backup(&dir, Hive::Hkcu, &empty(stamp)).unwrap();
        }
        prune(&dir, 2);
        let left: Vec<String> = backups(&dir).into_iter().map(|b| b.stamp).collect();
        assert_eq!(left, vec!["1762000000012", "1762000000011"]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
