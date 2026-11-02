//! "Fix all" and "Custom" from the Scan: settings, junk, app caches, registry
//! leftovers and the standby cache in one call, with one administrator prompt
//! at most.
//!
//! Everything a signed-in user can do runs here, in the app; whatever needs
//! administrator rights is handed to the elevated helper in one payload
//! (`--elevated-scan-fix`), which re-checks every gate itself: that entry
//! point is a plain command-line flag and must not trust its caller. Per-user
//! registry entries are never cleaned by the helper, whose HKCU may belong to
//! the administrator who approved the prompt.

use crate::regclean::{self, Hive};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Registry entries per clean; keeps the elevated payload well inside the
/// Windows command-line limit.
pub const MAX_REGISTRY_IDS: usize = 600;
const RESULT_FILE: &str = "last_scan_fix_result.json";
pub const ELEVATED_FLAG: &str = "--elevated-scan-fix";
pub const RESTORE_FLAG: &str = "--elevated-regrestore";
const RESTORE_RESULT_FILE: &str = "last_regrestore_result.json";

#[derive(Deserialize, Serialize, Default, Clone, Debug)]
pub struct ScanFixPlan {
    #[serde(default)]
    pub tweaks: Vec<String>,
    /// Cleanup target ids (`cleanup::cleanup_targets`).
    #[serde(default)]
    pub cleanups: Vec<String>,
    /// App cache group ids (`appcache`).
    #[serde(default)]
    pub app_caches: Vec<String>,
    /// Registry item ids from `registry_scan`.
    #[serde(default)]
    pub registry: Vec<String>,
    /// Release the standby cache.
    #[serde(default)]
    pub purge: bool,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
pub struct Freed {
    pub id: String,
    pub freed_bytes: u64,
    pub deleted: u64,
    pub skipped: u64,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct ScanFixResult {
    pub tweak_errors: Vec<String>,
    pub cleanups: Vec<Freed>,
    pub app_caches: Option<Freed>,
    pub registry: Option<regclean::CleanResult>,
    pub purge: Option<crate::zerotrace::PurgeResult>,
    pub errors: Vec<String>,
}

impl ScanFixResult {
    fn merge(&mut self, other: ScanFixResult) {
        self.tweak_errors.extend(other.tweak_errors);
        self.cleanups.extend(other.cleanups);
        self.app_caches = self.app_caches.take().or(other.app_caches);
        self.registry = merge_clean(self.registry.take(), other.registry);
        self.purge = self.purge.take().or(other.purge);
        self.errors.extend(other.errors);
    }
}

fn merge_clean(
    a: Option<regclean::CleanResult>,
    b: Option<regclean::CleanResult>,
) -> Option<regclean::CleanResult> {
    match (a, b) {
        (Some(a), Some(b)) => Some(regclean::CleanResult {
            removed: a.removed + b.removed,
            // Recomputed from the selection once both halves are in.
            skipped: 0,
            stamp: if a.stamp.is_empty() { b.stamp } else { a.stamp },
        }),
        (a, b) => a.or(b),
    }
}

/// The administrator half, as it crosses the elevation boundary.
#[derive(Serialize, Deserialize, Default, Debug, PartialEq)]
struct ElevatedPlan {
    tweaks: Vec<String>,
    cleanups: Vec<String>,
    registry: Vec<String>,
    stamp: String,
    purge: bool,
}

impl ElevatedPlan {
    fn is_empty(&self) -> bool {
        self.tweaks.is_empty()
            && self.cleanups.is_empty()
            && self.registry.is_empty()
            && !self.purge
    }
}

fn now_stamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis())
        .to_string()
}

fn freed(id: &str, r: &crate::cleanup::CleanupResult) -> Freed {
    Freed {
        id: id.to_string(),
        freed_bytes: r.freed_bytes,
        deleted: r.deleted_count as u64,
        skipped: r.skipped_count as u64,
    }
}

#[cfg(windows)]
fn run_cleanup(id: &str, result: &mut ScanFixResult) {
    let outcome = crate::cleanup::run_cleanup(id);
    crate::audit::record(
        "cleanup",
        id,
        outcome.is_ok(),
        outcome.as_ref().err().cloned(),
    );
    match outcome {
        Ok(r) => result.cleanups.push(freed(id, &r)),
        Err(e) => result.errors.push(e),
    }
}

#[cfg(windows)]
fn clean_registry(
    dir: &Path,
    hive: Hive,
    ids: &[String],
    stamp: &str,
) -> Result<regclean::CleanResult, String> {
    let backups = regclean::backup_dir(dir);
    let result = regclean::clean(
        &regclean::live::WinRegistry,
        &regclean::live::WinDisk,
        hive,
        ids,
        &backups,
        stamp,
    );
    crate::audit::record(
        "registry-clean",
        match hive {
            Hive::Hkcu => "user",
            Hive::Hklm => "system",
        },
        result.is_ok(),
        Some(match &result {
            Ok(r) => format!(
                "{} removed, {} skipped, backup {}",
                r.removed, r.skipped, r.stamp
            ),
            Err(e) => e.clone(),
        }),
    );
    regclean::prune(&backups, 20);
    result
}

/// The helper's side: every gate again, then one result file.
#[cfg(windows)]
fn run_elevated_part(dir: &Path, plan: ElevatedPlan) -> ScanFixResult {
    let store = crate::rollback::RollbackStore::new(dir.to_path_buf());
    let mut result = ScanFixResult::default();
    for id in crate::bulk_applicable(plan.tweaks) {
        if let Err(e) = crate::apply_by_id(&store, dir, &id) {
            result.tweak_errors.push(format!("{id}: {e}"));
        }
    }
    for id in plan.cleanups {
        match crate::authorize_elevated_cleanup(dir, &id) {
            Ok(()) => run_cleanup(&id, &mut result),
            Err(e) => result.errors.push(e),
        }
    }
    if !plan.registry.is_empty() {
        match crate::require_pro(dir)
            .and_then(|_| clean_registry(dir, Hive::Hklm, &plan.registry, &plan.stamp))
        {
            Ok(r) => result.registry = Some(r),
            Err(e) => result.errors.push(e),
        }
    }
    if plan.purge {
        let purge = crate::require_pro(dir).and_then(|_| crate::zerotrace::purge_standby_memory());
        crate::audit::record(
            "memory-purge",
            "scan",
            purge.is_ok(),
            purge.as_ref().err().cloned(),
        );
        match purge {
            Ok(p) => result.purge = Some(p),
            Err(e) => result.errors.push(e),
        }
    }
    result
}

/// `--elevated-scan-fix <json>`: exit code and result file for the app.
#[cfg(windows)]
pub fn run_elevated(dir: &Path, payload: &str) -> Result<(), String> {
    let plan: ElevatedPlan =
        serde_json::from_str(payload).map_err(|_| "invalid scan fix payload".to_string())?;
    if !plan.registry.is_empty() && !regclean::valid_stamp(&plan.stamp) {
        return Err("invalid backup id".into());
    }
    let result = run_elevated_part(dir, plan);
    let json = serde_json::to_string(&result).map_err(|e| e.to_string())?;
    crate::elevation::write_no_follow(dir.join(RESULT_FILE), json).map_err(|e| e.to_string())
}

/// `--elevated-regrestore <stamp>`: the system half of a registry restore.
#[cfg(windows)]
pub fn run_elevated_restore(dir: &Path, stamp: &str) -> Result<(), String> {
    let result = regclean::restore(
        &regclean::live::WinRegistry,
        &regclean::backup_dir(dir),
        stamp,
        Hive::Hklm,
    );
    crate::audit::record(
        "registry-restore",
        "system",
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    let json = serde_json::to_string(&result?).map_err(|e| e.to_string())?;
    crate::elevation::write_no_follow(dir.join(RESTORE_RESULT_FILE), json)
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn fix(dir: &Path, plan: ScanFixPlan) -> ScanFixResult {
    let selected = plan.registry.len().min(MAX_REGISTRY_IDS) as u32;
    let mut result = fix_parts(dir, plan);
    if let Some(registry) = &mut result.registry {
        registry.skipped = selected.saturating_sub(registry.removed);
    }
    result
}

#[cfg(windows)]
fn fix_parts(dir: &Path, plan: ScanFixPlan) -> ScanFixResult {
    let store = crate::rollback::RollbackStore::new(dir.to_path_buf());
    let mut result = ScanFixResult::default();
    let mut elevated = ElevatedPlan {
        stamp: now_stamp(),
        ..ElevatedPlan::default()
    };

    // Settings: the same rules as `apply_tweaks`, recorded as the Scan's.
    if !plan.tweaks.is_empty() {
        let applied = store.applied_ids().unwrap_or_default();
        let ids: Vec<String> = plan
            .tweaks
            .into_iter()
            .filter(|id| !applied.contains(id))
            .collect();
        crate::record_origin(Some("scan".into()), &ids);
        let (needs_admin, direct) = crate::split_by_elevation(crate::bulk_applicable(ids));
        for id in &direct {
            if let Err(e) = crate::apply_by_id(&store, dir, id) {
                result.tweak_errors.push(format!("{id}: {e}"));
            }
        }
        elevated.tweaks = needs_admin;
    }

    for id in plan.cleanups {
        match crate::authorize_cleanup(dir, &id) {
            Ok(true) => elevated.cleanups.push(id),
            Ok(false) => run_cleanup(&id, &mut result),
            Err(e) => result.errors.push(e),
        }
    }

    if !plan.app_caches.is_empty() {
        match crate::require_pro(dir) {
            Ok(()) => {
                let r = crate::appcache::clean(&plan.app_caches);
                crate::audit::record(
                    "app-cache-clean",
                    &plan.app_caches.join(","),
                    r.deleted > 0,
                    Some(format!(
                        "{} files, {} bytes, {} skipped",
                        r.deleted, r.freed_bytes, r.skipped
                    )),
                );
                result.app_caches = Some(Freed {
                    id: "app_caches".into(),
                    freed_bytes: r.freed_bytes,
                    deleted: r.deleted as u64,
                    skipped: r.skipped as u64,
                });
            }
            Err(e) => result.errors.push(e),
        }
    }

    if !plan.registry.is_empty() {
        let ids: Vec<String> = plan.registry.into_iter().take(MAX_REGISTRY_IDS).collect();
        match crate::require_pro(dir) {
            Ok(()) => {
                match clean_registry(dir, Hive::Hkcu, &ids, &elevated.stamp) {
                    Ok(r) => result.registry = Some(r),
                    Err(e) => result.errors.push(e),
                }
                // Reading HKLM needs no rights: only ask for them when one of
                // the selected entries is there.
                let system = regclean::scan(
                    &regclean::live::WinRegistry,
                    &regclean::live::WinDisk,
                    &[Hive::Hklm],
                );
                elevated.registry = ids
                    .into_iter()
                    .filter(|id| system.iter().any(|i| i.id == *id))
                    .collect();
            }
            Err(e) => result.errors.push(e),
        }
    }

    if plan.purge {
        match crate::require_pro(dir) {
            Ok(()) => elevated.purge = true,
            Err(e) => result.errors.push(e),
        }
    }

    if elevated.is_empty() {
        return result;
    }
    if crate::elevation::is_elevated() {
        crate::restore_point_before_change();
        result.merge(run_elevated_part(dir, elevated));
        return result;
    }
    let path = dir.join(RESULT_FILE);
    let _ = std::fs::remove_file(&path);
    let payload = match serde_json::to_string(&elevated) {
        Ok(json) => json,
        Err(e) => {
            result.errors.push(e.to_string());
            return result;
        }
    };
    let launched = crate::elevation::run_elevated_action(ELEVATED_FLAG, &payload);
    match std::fs::read(&path)
        .ok()
        .and_then(|raw| serde_json::from_slice::<ScanFixResult>(&raw).ok())
    {
        Some(part) => result.merge(part),
        None => result.errors.push(
            launched
                .err()
                .unwrap_or_else(|| "the administrator step produced no result".into()),
        ),
    }
    let _ = std::fs::remove_file(&path);
    result
}

/// Applies a Scan selection. Every part re-checks its own gate; the result
/// lists what each part measured (bytes freed, entries removed, memory freed).
#[tauri::command(async)]
pub fn scan_fix(app: tauri::AppHandle, plan: ScanFixPlan) -> Result<ScanFixResult, String> {
    #[cfg(windows)]
    {
        Ok(fix(&crate::store_for_dir(&app)?, plan))
    }
    #[cfg(not(windows))]
    {
        let _ = (app, plan);
        Err("not supported on this platform".into())
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct RegistryScan {
    pub items: Vec<regclean::Item>,
}

/// Orphaned registry entries in both hives. Read-only and free.
#[tauri::command(async)]
pub fn registry_scan() -> Result<RegistryScan, String> {
    #[cfg(windows)]
    {
        Ok(RegistryScan {
            items: regclean::scan(
                &regclean::live::WinRegistry,
                &regclean::live::WinDisk,
                &[Hive::Hkcu, Hive::Hklm],
            ),
        })
    }
    #[cfg(not(windows))]
    {
        Err("not supported on this platform".into())
    }
}

#[tauri::command(async)]
pub fn registry_backups(app: tauri::AppHandle) -> Result<Vec<regclean::BackupInfo>, String> {
    Ok(regclean::backups(&regclean::backup_dir(
        &crate::store_for_dir(&app)?,
    )))
}

/// Puts back everything one clean removed. Free: undoing is never paywalled.
#[tauri::command(async)]
pub fn registry_restore(
    app: tauri::AppHandle,
    stamp: String,
) -> Result<regclean::RestoreResult, String> {
    if !regclean::valid_stamp(&stamp) {
        return Err("invalid backup id".into());
    }
    #[cfg(windows)]
    {
        let dir = crate::store_for_dir(&app)?;
        let backups = regclean::backup_dir(&dir);
        let user = regclean::restore(&regclean::live::WinRegistry, &backups, &stamp, Hive::Hkcu);
        crate::audit::record(
            "registry-restore",
            "user",
            user.is_ok(),
            user.as_ref().err().cloned(),
        );
        let mut total = user?;
        if backups.join(format!("{stamp}-system.json")).exists() {
            let system = if crate::elevation::is_elevated() {
                let r =
                    regclean::restore(&regclean::live::WinRegistry, &backups, &stamp, Hive::Hklm);
                crate::audit::record(
                    "registry-restore",
                    "system",
                    r.is_ok(),
                    r.as_ref().err().cloned(),
                );
                r
            } else {
                let path = dir.join(RESTORE_RESULT_FILE);
                let _ = std::fs::remove_file(&path);
                let launched = crate::elevation::run_elevated_action(RESTORE_FLAG, &stamp);
                let read = std::fs::read(&path)
                    .ok()
                    .and_then(|raw| serde_json::from_slice::<regclean::RestoreResult>(&raw).ok());
                let _ = std::fs::remove_file(&path);
                read.ok_or_else(|| {
                    launched
                        .err()
                        .unwrap_or_else(|| "the administrator step produced no result".into())
                })
            }?;
            total.restored += system.restored;
            total.skipped += system.skipped;
        }
        Ok(total)
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("not supported on this platform".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_elevated_payload_round_trips_and_fits_the_command_line() {
        let plan = ElevatedPlan {
            tweaks: vec!["disable_game_dvr".into()],
            cleanups: vec!["winupdate_cache_cleanup".into()],
            registry: (0..MAX_REGISTRY_IDS).map(|i| format!("{i:016x}")).collect(),
            stamp: "1762000000000".into(),
            purge: true,
        };
        let json = serde_json::to_string(&plan).unwrap();
        let encoded = crate::elevation::encode_elevated_arg(&json);
        // CreateProcess's limit is 32767 characters for the whole line.
        assert!(
            encoded.len() + ELEVATED_FLAG.len() + 300 < 32_767,
            "{}",
            encoded.len()
        );
        assert_eq!(serde_json::from_str::<ElevatedPlan>(&json).unwrap(), plan);
        assert!(ElevatedPlan::default().is_empty());
    }

    #[test]
    fn results_from_both_halves_add_up() {
        let mut a = ScanFixResult {
            registry: Some(regclean::CleanResult {
                removed: 3,
                skipped: 1,
                stamp: "1".into(),
            }),
            cleanups: vec![Freed {
                id: "temp_cleanup".into(),
                freed_bytes: 10,
                deleted: 2,
                skipped: 0,
            }],
            ..ScanFixResult::default()
        };
        a.merge(ScanFixResult {
            registry: Some(regclean::CleanResult {
                removed: 2,
                skipped: 0,
                stamp: "1".into(),
            }),
            cleanups: vec![Freed {
                id: "winupdate_cache_cleanup".into(),
                freed_bytes: 5,
                deleted: 1,
                skipped: 0,
            }],
            purge: Some(crate::zerotrace::PurgeResult {
                free_before_mb: 100,
                free_after_mb: 900,
            }),
            errors: vec!["x".into()],
            ..ScanFixResult::default()
        });
        assert_eq!(a.registry.unwrap().removed, 5);
        assert_eq!(a.cleanups.len(), 2);
        assert_eq!(a.purge.unwrap().free_after_mb, 900);
        assert_eq!(a.errors, vec!["x".to_string()]);
    }
}
