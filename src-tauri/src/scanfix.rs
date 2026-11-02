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
/// The helper's steps, one JSON line each, for the window's progress view.
const PROGRESS_FILE: &str = "last_scan_fix_progress.jsonl";
/// Window event carrying a [`Step`] of a running fix (Scan, Safe optimize).
pub const PROGRESS_EVENT: &str = "fix-progress";

/// One step of a running fix, for the progress ring: first the plan (every
/// step, in the order it will run), then each step starting and finishing
/// with what it measured. Steps: `restore_point`, `system_settings`,
/// `system_junk`, `system_registry`, `memory` (administrator part, first),
/// then `settings`, `junk`, `caches`, `registry` (the signed-in user's).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
pub struct Step {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub plan: Vec<String>,
    #[serde(default)]
    pub step: String,
    #[serde(default)]
    pub done: bool,
    /// The step could not do (all of) its work.
    #[serde(default)]
    pub failed: bool,
    /// Bytes freed (junk, caches) or memory released (memory).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bytes: Option<u64>,
    /// Settings applied or registry entries removed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub restore_point: Option<crate::restore_point::RestorePointOutcome>,
}

impl Step {
    pub fn plan(steps: &[&str]) -> Step {
        Step {
            plan: steps.iter().map(|s| s.to_string()).collect(),
            ..Step::default()
        }
    }
    pub fn start(step: &str) -> Step {
        Step {
            step: step.into(),
            ..Step::default()
        }
    }
    pub fn done(step: &str) -> Step {
        Step {
            step: step.into(),
            done: true,
            ..Step::default()
        }
    }
}

/// Where the steps go: the window (an event) or, in the elevated helper, the
/// progress file the app forwards.
pub type Report<'a> = &'a (dyn Fn(Step) + Sync);

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
    /// The restore point taken before the administrator part, when there was one.
    #[serde(default)]
    pub restore_point: Option<crate::restore_point::RestorePointOutcome>,
    pub tweak_errors: Vec<String>,
    pub cleanups: Vec<Freed>,
    pub app_caches: Option<Freed>,
    pub registry: Option<regclean::CleanResult>,
    pub purge: Option<crate::zerotrace::PurgeResult>,
    pub errors: Vec<String>,
}

impl ScanFixResult {
    fn merge(&mut self, other: ScanFixResult) {
        self.restore_point = self.restore_point.take().or(other.restore_point);
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

/// Settings applied in this process, with the step's line.
#[cfg(windows)]
fn apply_settings(
    store: &crate::rollback::RollbackStore,
    dir: &Path,
    ids: &[String],
    step: &str,
    result: &mut ScanFixResult,
    report: Report,
) {
    if ids.is_empty() {
        return;
    }
    report(Step::start(step));
    let before = result.tweak_errors.len();
    for id in ids {
        if let Err(e) = crate::apply_by_id(store, dir, id) {
            result.tweak_errors.push(format!("{id}: {e}"));
        }
    }
    let failed = result.tweak_errors.len() - before;
    report(Step {
        count: Some((ids.len() - failed) as u64),
        failed: failed > 0,
        ..Step::done(step)
    });
}

/// Cleanups of one side, with the step's line (bytes freed).
#[cfg(windows)]
fn clean_junk(ids: &[String], step: &str, result: &mut ScanFixResult, report: Report) {
    if ids.is_empty() {
        return;
    }
    report(Step::start(step));
    let (cleaned, errors) = (result.cleanups.len(), result.errors.len());
    for id in ids {
        run_cleanup(id, result);
    }
    report(Step {
        bytes: Some(
            result.cleanups[cleaned..]
                .iter()
                .map(|f| f.freed_bytes)
                .sum(),
        ),
        failed: result.errors.len() > errors,
        ..Step::done(step)
    });
}

/// One hive's registry clean, with the step's line (entries removed).
#[cfg(windows)]
fn clean_registry_step(
    dir: &Path,
    hive: Hive,
    ids: &[String],
    stamp: &str,
    step: &str,
    result: &mut ScanFixResult,
    report: Report,
) {
    report(Step::start(step));
    let outcome = crate::require_pro(dir).and_then(|_| clean_registry(dir, hive, ids, stamp));
    report(Step {
        count: outcome.as_ref().ok().map(|r| u64::from(r.removed)),
        failed: outcome.is_err(),
        ..Step::done(step)
    });
    match outcome {
        Ok(r) => result.registry = merge_clean(result.registry.take(), Some(r)),
        Err(e) => result.errors.push(e),
    }
}

/// The helper's side: every gate again, then one result file.
#[cfg(windows)]
fn run_elevated_part(dir: &Path, plan: ElevatedPlan, report: Report) -> ScanFixResult {
    let store = crate::rollback::RollbackStore::new(dir.to_path_buf());
    let mut result = ScanFixResult::default();
    let tweaks = crate::bulk_applicable(plan.tweaks);
    apply_settings(&store, dir, &tweaks, "system_settings", &mut result, report);
    let mut cleanups = Vec::new();
    for id in plan.cleanups {
        match crate::authorize_elevated_cleanup(dir, &id) {
            Ok(()) => cleanups.push(id),
            Err(e) => result.errors.push(e),
        }
    }
    clean_junk(&cleanups, "system_junk", &mut result, report);
    if !plan.registry.is_empty() {
        clean_registry_step(
            dir,
            Hive::Hklm,
            &plan.registry,
            &plan.stamp,
            "system_registry",
            &mut result,
            report,
        );
    }
    if plan.purge {
        report(Step::start("memory"));
        let purge = crate::require_pro(dir).and_then(|_| crate::zerotrace::purge_standby_memory());
        crate::audit::record(
            "memory-purge",
            "scan",
            purge.is_ok(),
            purge.as_ref().err().cloned(),
        );
        report(Step {
            bytes: purge
                .as_ref()
                .ok()
                .map(|p| (p.free_after_mb.saturating_sub(p.free_before_mb) as u64) * 1024 * 1024),
            failed: purge.is_err(),
            ..Step::done("memory")
        });
        match purge {
            Ok(p) => result.purge = Some(p),
            Err(e) => result.errors.push(e),
        }
    }
    result
}

/// `--elevated-scan-fix <json>`: exit code and result file for the app. The
/// helper took `restore_point` before anything else.
#[cfg(windows)]
pub fn run_elevated(
    dir: &Path,
    payload: &str,
    restore_point: crate::restore_point::RestorePointOutcome,
) -> Result<(), String> {
    let plan: ElevatedPlan =
        serde_json::from_str(payload).map_err(|_| "invalid scan fix payload".to_string())?;
    if !plan.registry.is_empty() && !regclean::valid_stamp(&plan.stamp) {
        return Err("invalid backup id".into());
    }
    // The app forwards these lines to the window while this process runs.
    let lines = std::sync::Mutex::new(String::new());
    let report = |step: Step| {
        let Ok(mut lines) = lines.lock() else { return };
        lines.push_str(&serde_json::to_string(&step).unwrap_or_default());
        lines.push('\n');
        let _ = crate::elevation::write_no_follow(dir.join(PROGRESS_FILE), lines.as_bytes());
    };
    report(Step {
        failed: matches!(
            restore_point,
            crate::restore_point::RestorePointOutcome::Failed { .. }
        ),
        restore_point: Some(restore_point.clone()),
        ..Step::done("restore_point")
    });
    let mut result = run_elevated_part(dir, plan, &report);
    result.restore_point = Some(restore_point);
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
fn fix(dir: &Path, plan: ScanFixPlan, report: Report) -> ScanFixResult {
    let selected = plan.registry.len().min(MAX_REGISTRY_IDS) as u32;
    let mut result = fix_parts(dir, plan, report);
    if let Some(registry) = &mut result.registry {
        registry.skipped = selected.saturating_sub(registry.removed);
    }
    result
}

/// Reads the helper's progress lines (complete ones only).
#[cfg(windows)]
fn read_progress(path: &Path) -> Vec<Step> {
    std::fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .map_while(|line| serde_json::from_str::<Step>(line).ok())
        .collect()
}

/// Runs the administrator part in the helper and forwards its steps to the
/// window while it runs. Steps it never finished (the prompt was declined,
/// the helper failed) are reported as failed.
#[cfg(windows)]
fn run_helper(
    dir: &Path,
    elevated: &ElevatedPlan,
    steps: &[&str],
    result: &mut ScanFixResult,
    report: Report,
) {
    use std::sync::atomic::{AtomicBool, Ordering};
    let path = dir.join(RESULT_FILE);
    let progress = dir.join(PROGRESS_FILE);
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_file(&progress);
    let payload = match serde_json::to_string(elevated) {
        Ok(json) => json,
        Err(e) => {
            result.errors.push(e.to_string());
            return;
        }
    };
    // The prompt, then the restore point: both happen before the helper's
    // first line.
    report(Step::start("restore_point"));
    let stop = AtomicBool::new(false);
    let (launched, finished) = std::thread::scope(|scope| {
        let forwarder = scope.spawn(|| {
            let mut sent = 0;
            let mut finished = Vec::new();
            loop {
                let last = stop.load(Ordering::Acquire);
                let lines = read_progress(&progress);
                for step in lines.iter().skip(sent) {
                    if step.done {
                        finished.push(step.step.clone());
                    }
                    report(step.clone());
                }
                sent = sent.max(lines.len());
                if last {
                    return finished;
                }
                std::thread::sleep(std::time::Duration::from_millis(150));
            }
        });
        let launched = crate::elevation::run_elevated_action(ELEVATED_FLAG, &payload);
        stop.store(true, Ordering::Release);
        (launched, forwarder.join().unwrap_or_default())
    });
    let _ = std::fs::remove_file(&progress);
    // The restore point included: no line at all means the prompt was declined.
    for step in std::iter::once("restore_point")
        .chain(steps.iter().copied())
        .filter(|s| !finished.iter().any(|f| f == s))
    {
        report(Step {
            failed: true,
            ..Step::done(step)
        });
    }
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
}

/// Decides what runs where before anything changes, announces the steps,
/// then runs the administrator part first (its restore point comes before
/// any change) and the signed-in user's part after it.
#[cfg(windows)]
fn fix_parts(dir: &Path, plan: ScanFixPlan, report: Report) -> ScanFixResult {
    let store = crate::rollback::RollbackStore::new(dir.to_path_buf());
    let mut result = ScanFixResult::default();
    let mut elevated = ElevatedPlan {
        stamp: now_stamp(),
        ..ElevatedPlan::default()
    };

    // Settings: the same rules as `apply_tweaks`, recorded as the Scan's.
    let mut tweaks = Vec::new();
    if !plan.tweaks.is_empty() {
        let applied = store.applied_ids().unwrap_or_default();
        let ids: Vec<String> = plan
            .tweaks
            .into_iter()
            .filter(|id| !applied.contains(id))
            .collect();
        crate::record_origin(Some("scan".into()), &ids);
        let (needs_admin, direct) = crate::split_by_elevation(crate::bulk_applicable(ids));
        tweaks = direct;
        elevated.tweaks = needs_admin;
    }

    let mut cleanups = Vec::new();
    for id in plan.cleanups {
        match crate::authorize_cleanup(dir, &id) {
            Ok(true) => elevated.cleanups.push(id),
            Ok(false) => cleanups.push(id),
            Err(e) => result.errors.push(e),
        }
    }

    let mut caches = Vec::new();
    if !plan.app_caches.is_empty() {
        match crate::require_pro(dir) {
            Ok(()) => caches = plan.app_caches,
            Err(e) => result.errors.push(e),
        }
    }

    let mut registry = Vec::new();
    if !plan.registry.is_empty() {
        let ids: Vec<String> = plan.registry.into_iter().take(MAX_REGISTRY_IDS).collect();
        match crate::require_pro(dir) {
            Ok(()) => {
                // Ids are per hive. Reading HKLM needs no rights: only ask
                // for them when one of the selected entries is there.
                let system = regclean::scan(
                    &regclean::live::WinRegistry,
                    &regclean::live::WinDisk,
                    &[Hive::Hklm],
                );
                (elevated.registry, registry) = ids
                    .into_iter()
                    .partition(|id| system.iter().any(|i| i.id == *id));
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

    let system_steps: Vec<&str> = [
        ("system_settings", !elevated.tweaks.is_empty()),
        ("system_junk", !elevated.cleanups.is_empty()),
        ("system_registry", !elevated.registry.is_empty()),
        ("memory", elevated.purge),
    ]
    .into_iter()
    .filter_map(|(step, on)| on.then_some(step))
    .collect();
    let user_steps = [
        ("settings", !tweaks.is_empty()),
        ("junk", !cleanups.is_empty()),
        ("caches", !caches.is_empty()),
        ("registry", !registry.is_empty()),
    ]
    .into_iter()
    .filter_map(|(step, on)| on.then_some(step));
    let restore = (!elevated.is_empty()).then_some("restore_point");
    report(Step::plan(
        &restore
            .into_iter()
            .chain(system_steps.iter().copied())
            .chain(user_steps)
            .collect::<Vec<_>>(),
    ));

    // Registry backups of both hives share one stamp.
    let stamp = elevated.stamp.clone();
    if !elevated.is_empty() {
        if crate::elevation::is_elevated() {
            report(Step::start("restore_point"));
            let point = crate::restore_point_before_change();
            report(Step {
                failed: matches!(
                    point,
                    crate::restore_point::RestorePointOutcome::Failed { .. }
                ),
                restore_point: Some(point.clone()),
                ..Step::done("restore_point")
            });
            result.restore_point = Some(point);
            let part = run_elevated_part(dir, elevated, report);
            result.merge(part);
        } else {
            run_helper(dir, &elevated, &system_steps, &mut result, report);
        }
    }

    apply_settings(&store, dir, &tweaks, "settings", &mut result, report);
    clean_junk(&cleanups, "junk", &mut result, report);
    if !caches.is_empty() {
        report(Step::start("caches"));
        let r = crate::appcache::clean(&caches);
        crate::audit::record(
            "app-cache-clean",
            &caches.join(","),
            r.deleted > 0,
            Some(format!(
                "{} files, {} bytes, {} skipped",
                r.deleted, r.freed_bytes, r.skipped
            )),
        );
        report(Step {
            bytes: Some(r.freed_bytes),
            ..Step::done("caches")
        });
        result.app_caches = Some(Freed {
            id: "app_caches".into(),
            freed_bytes: r.freed_bytes,
            deleted: r.deleted as u64,
            skipped: r.skipped as u64,
        });
    }
    if !registry.is_empty() {
        clean_registry_step(
            dir,
            Hive::Hkcu,
            &registry,
            &stamp,
            "registry",
            &mut result,
            report,
        );
    }
    result
}

/// Applies a Scan selection. Every part re-checks its own gate; the result
/// lists what each part measured (bytes freed, entries removed, memory freed).
#[tauri::command(async)]
pub fn scan_fix(app: tauri::AppHandle, plan: ScanFixPlan) -> Result<ScanFixResult, String> {
    #[cfg(windows)]
    {
        use tauri::Emitter;
        let report = |step: Step| {
            let _ = app.emit(PROGRESS_EVENT, step);
        };
        Ok(fix(&crate::store_for_dir(&app)?, plan, &report))
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

    #[cfg(windows)]
    #[test]
    fn progress_lines_are_read_whole_and_a_torn_last_line_waits() {
        let dir = std::env::temp_dir().join(format!("pct-progress-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(PROGRESS_FILE);
        let done = Step {
            bytes: Some(42),
            ..Step::done("system_junk")
        };
        let mut text =
            serde_json::to_string(&Step::plan(&["restore_point", "system_junk"])).unwrap();
        text.push('\n');
        text.push_str(&serde_json::to_string(&done).unwrap());
        text.push('\n');
        text.push_str("{\"step\":\"mem");
        std::fs::write(&path, &text).unwrap();
        let read = read_progress(&path);
        assert_eq!(read.len(), 2);
        assert_eq!(read[0].plan, vec!["restore_point", "system_junk"]);
        assert_eq!(read[1], done);
        // The window's shape: no empty plan, no absent numbers.
        let json = serde_json::to_value(Step::start("memory")).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "step": "memory", "done": false, "failed": false })
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

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
