//! Device-driver inventory and age audit.
//!
//! What this reports and what it deliberately does not:
//!
//! Windows knows which driver is *installed* — its version, its date, who
//! signed it. It does not know which driver is *available*: there is no
//! offline index of current vendor releases, and this app makes no network
//! call to build one. So every claim here is about age, stated as a fact with
//! its date attached ("this display driver is 3.4 years old"), and never
//! "an update is available" — a claim the machine has no way to support.
//!
//! Microsoft inbox drivers are counted but kept out of the age list, and the
//! count is returned so the omission is visible rather than silent. Two
//! reasons: they are serviced by Windows Update rather than by a vendor
//! download, and their `DriverDate` is a fixed placeholder (Windows stamps
//! generic class drivers 2006-06-21), so an age audit that included them
//! would confidently announce that a perfectly current USB controller was
//! twenty years out of date.
//!
//! The scan walks every device class the machine actually has, one class per
//! query, so the progress it reports is a real position in real work rather
//! than an animation. That is also why it is not instant: enumerating all of
//! them costs about a second per class.

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct DriverEntry {
    pub device: String,
    pub version: String,
    /// ISO date (YYYY-MM-DD) exactly as Windows recorded it.
    pub date: String,
    pub age_days: i64,
    /// Windows' own device class: DISPLAY, NET, MEDIA, SYSTEM, ...
    pub class: String,
    pub provider: String,
    /// "current" (<2y), "aging" (2-4y) or "stale" (>4y). Age bands only —
    /// see the module note on why this is not an update check.
    pub tier: String,
    /// The vendor's own driver page, when the provider is one we can name
    /// with certainty. `None` rather than a search-engine guess.
    pub vendor_url: Option<String>,
    /// Classes where a stale driver has a felt effect. The list shows these
    /// first; everything else is still scanned, counted and listed behind
    /// "show all", because "scan everything" and "shout about everything"
    /// are different promises.
    pub important: bool,
}

#[derive(Serialize, Clone)]
pub struct DriverAudit {
    pub entries: Vec<DriverEntry>,
    /// Microsoft/inbox drivers seen and left out of the age list.
    pub excluded_inbox: usize,
    /// Every driver the scan looked at, whoever signed it.
    pub total_scanned: usize,
    /// Device classes walked, so the UI can say what "all of them" meant.
    pub classes_scanned: usize,
}

#[derive(Serialize, Clone)]
pub struct ScanProgress {
    pub done: usize,
    pub total: usize,
    /// The class being read right now, for a label that means something.
    pub class: String,
}

/// Bumped by [`cancel_scan`]. A cancellable audit remembers the value it
/// started under and stops, killing its PowerShell, once it changes.
static SCAN_GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Error a cancelled audit returns.
pub const SCAN_CANCELLED: &str = "SCAN_CANCELLED";

/// Stops the scan's driver audit, if one is running. Everything the scan
/// reads is read-only, so there is nothing to undo.
#[tauri::command]
pub fn cancel_scan() {
    SCAN_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
}

/// Whether the generation an audit started under is no longer current.
fn stale(started: Option<u64>) -> bool {
    started.is_some_and(|g| g != SCAN_GENERATION.load(std::sync::atomic::Ordering::SeqCst))
}

/// How far a paused scan's driver inventory got: the classes it is walking
/// and everything read from the first `done` of them. A resumed audit with
/// the same session id carries on from there; the class that was being read
/// when the pause came is read again (reads are idempotent).
#[derive(Clone, Default)]
struct PartialAudit {
    session: String,
    classes: Vec<String>,
    done: usize,
    entries: Vec<DriverEntry>,
    excluded_inbox: usize,
    total_scanned: usize,
}

/// Memory only, and one at a time: a different session forgets the last.
static PARTIAL: std::sync::Mutex<Option<PartialAudit>> = std::sync::Mutex::new(None);

fn save_partial(partial: PartialAudit) {
    *PARTIAL.lock().unwrap_or_else(|e| e.into_inner()) = Some(partial);
}

/// The partial inventory of `session`, if that is what is held. Anything
/// held for another session is dropped.
fn take_partial(session: &str) -> Option<PartialAudit> {
    let mut held = PARTIAL.lock().unwrap_or_else(|e| e.into_inner());
    held.take().filter(|p| p.session == session)
}

/// Forgets a paused scan's partial driver inventory (the scan was ended).
#[tauri::command]
pub fn discard_scan_session(session: String) {
    let mut held = PARTIAL.lock().unwrap_or_else(|e| e.into_inner());
    if held.as_ref().is_some_and(|p| p.session == session) {
        *held = None;
    }
}

#[cfg(windows)]
mod imp {
    use super::{
        save_partial, stale, take_partial, DriverAudit, DriverEntry, PartialAudit, ScanProgress,
        SCAN_CANCELLED,
    };
    use std::os::windows::process::CommandExt;

    use tauri::Emitter;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    /// Classes surfaced first: graphics, network, audio, storage, chipset.
    /// Everything else is still scanned — this only decides what leads.
    const IMPORTANT: &[&str] = &[
        "DISPLAY",
        "NET",
        "MEDIA",
        "HDC",
        "SCSIADAPTER",
        "SYSTEM",
        "BLUETOOTH",
    ];

    fn run_ps(script: &str, scan: Option<u64>) -> Result<String, String> {
        let output = crate::system_tools::run("powershell", |tool| {
            crate::system_tools::output_unless(
                tool.args(["-NoProfile", "-NonInteractive", "-Command", script])
                    .creation_flags(CREATE_NO_WINDOW),
                &|| stale(scan),
            )
        })
        .map_err(|e| format!("could not run PowerShell: {}", e))?
        .ok_or_else(|| SCAN_CANCELLED.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    fn vendor_url(provider: &str) -> Option<String> {
        let p = provider.to_ascii_lowercase();
        if p.contains("nvidia") {
            Some("https://www.nvidia.com/Download/index.aspx".to_string())
        } else if p.contains("advanced micro devices") || p.starts_with("amd") {
            Some("https://www.amd.com/en/support".to_string())
        } else if p.contains("intel") {
            Some("https://www.intel.com/content/www/us/en/download-center/home.html".to_string())
        } else if p.contains("realtek") {
            Some("https://www.realtek.com/en/downloads".to_string())
        } else if p.contains("logitech") {
            Some("https://support.logi.com/hc/en-us/categories/360001464173".to_string())
        } else {
            None
        }
    }

    fn tier_for(age_days: i64) -> &'static str {
        if age_days > 4 * 365 {
            "stale"
        } else if age_days > 2 * 365 {
            "aging"
        } else {
            "current"
        }
    }

    fn class_rank(class: &str) -> u8 {
        match class {
            "DISPLAY" => 0,
            "NET" => 1,
            "MEDIA" => 2,
            "HDC" | "SCSIADAPTER" => 3,
            "BLUETOOTH" => 4,
            "SYSTEM" => 5,
            _ => 6,
        }
    }

    /// Every device class this machine actually has, asked for once so the
    /// scan's total is the real number of steps rather than a guess.
    fn list_classes(scan: Option<u64>) -> Result<Vec<String>, String> {
        let raw = run_ps(
            "(Get-CimInstance Win32_PnPSignedDriver -ErrorAction SilentlyContinue | \
             Select-Object -ExpandProperty DeviceClass -Unique | Where-Object { $_ }) -join ','",
            scan,
        )?;
        let mut classes: Vec<String> = raw
            .split(',')
            .map(|c| c.trim().to_string())
            .filter(|c| !c.is_empty())
            .collect();
        // Lead with the classes people act on, so the early progress steps are
        // also the interesting ones.
        classes.sort_by_key(|c| (class_rank(c), c.clone()));
        Ok(classes)
    }

    /// Reads one class. Returns (vendor rows, inbox count, rows seen).
    fn scan_class(
        class: &str,
        scan: Option<u64>,
    ) -> Result<(Vec<DriverEntry>, usize, usize), String> {
        // The class name is interpolated into a PowerShell filter, so it is
        // pinned to the shape Windows uses for class names before it can get
        // anywhere near the shell.
        if !class
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            return Ok((Vec::new(), 0, 0));
        }

        let script = format!(
            "$d = @(Get-CimInstance Win32_PnPSignedDriver -Filter \"DeviceClass='{class}'\" -ErrorAction SilentlyContinue); \
             $inbox = @($d | Where-Object {{ $_.DriverProviderName -match '^(Microsoft|Standard|Generic|\\(Standard)' }}).Count; \
             $rows = @($d | Where-Object {{ $_.DriverDate -and $_.DeviceName -and $_.DriverProviderName -and \
               $_.DriverProviderName -notmatch '^(Microsoft|Standard|Generic|\\(Standard)' }} | ForEach-Object {{ [pscustomobject]@{{ \
                 device = $_.DeviceName; version = $_.DriverVersion; \
                 date = $_.DriverDate.ToString('yyyy-MM-dd'); \
                 ageDays = [int]((Get-Date) - $_.DriverDate).TotalDays; \
                 class = $_.DeviceClass; provider = $_.DriverProviderName }} }}); \
             [pscustomobject]@{{ inbox = $inbox; seen = $d.Count; rows = @($rows) }} | ConvertTo-Json -Depth 4 -Compress",
            class = class
        );

        let raw = run_ps(&script, scan)?;
        if raw.is_empty() {
            return Ok((Vec::new(), 0, 0));
        }
        let parsed: serde_json::Value =
            serde_json::from_str(&raw).map_err(|e| format!("unexpected driver data: {}", e))?;

        let inbox = parsed.get("inbox").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
        let seen = parsed.get("seen").and_then(|v| v.as_u64()).unwrap_or(0) as usize;

        // A single driver serialises as an object, several as an array. Both
        // shapes are accepted so a class with exactly one third-party driver
        // isn't reported as having none.
        let rows: Vec<&serde_json::Value> = match parsed.get("rows") {
            Some(serde_json::Value::Array(a)) => a.iter().collect(),
            Some(v @ serde_json::Value::Object(_)) => vec![v],
            _ => Vec::new(),
        };

        let entries = rows
            .into_iter()
            .filter_map(|r| {
                let device = r.get("device")?.as_str()?.trim().to_string();
                let provider = r.get("provider")?.as_str()?.trim().to_string();
                let age_days = r.get("ageDays")?.as_i64()?;
                // A negative age means the clock or the stamp is wrong;
                // "-40 days old" would just look broken.
                if age_days < 0 {
                    return None;
                }
                let class_name = r
                    .get("class")
                    .and_then(|v| v.as_str())
                    .unwrap_or(class)
                    .to_string();
                Some(DriverEntry {
                    vendor_url: vendor_url(&provider),
                    tier: tier_for(age_days).to_string(),
                    important: IMPORTANT.contains(&class_name.as_str()),
                    version: r
                        .get("version")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    date: r
                        .get("date")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    class: class_name,
                    age_days,
                    device,
                    provider,
                })
            })
            .collect();

        Ok((entries, inbox, seen))
    }

    /// `scan` is the generation a cancellable audit started under; `None`
    /// runs to the end whatever happens to a scan. With `session`, a stopped
    /// audit keeps what it read and the next call for that session resumes.
    pub fn audit(
        app: &tauri::AppHandle,
        scan: Option<u64>,
        session: Option<&str>,
    ) -> Result<DriverAudit, String> {
        let mut state = match session.and_then(take_partial) {
            Some(partial) => partial,
            None => PartialAudit {
                session: session.unwrap_or_default().to_string(),
                classes: list_classes(scan)?,
                ..Default::default()
            },
        };
        let classes = state.classes.clone();
        let total = classes.len().max(1);
        let paused = |state: PartialAudit, done: usize| {
            if session.is_some() {
                save_partial(PartialAudit { done, ..state });
            }
            Err(SCAN_CANCELLED.to_string())
        };

        for (i, class) in classes.iter().enumerate().skip(state.done) {
            if stale(scan) {
                return paused(state, i);
            }
            let _ = app.emit(
                "driver-scan-progress",
                ScanProgress {
                    done: i,
                    total,
                    class: class.clone(),
                },
            );
            // One unreadable class must not abandon the whole inventory:
            // partial truth beats an error page listing nothing.
            match scan_class(class, scan) {
                Ok((rows, inbox, seen)) => {
                    state.entries.extend(rows);
                    state.excluded_inbox += inbox;
                    state.total_scanned += seen;
                }
                Err(e) if e == SCAN_CANCELLED => return paused(state, i),
                Err(_) => {}
            }
        }
        let PartialAudit {
            mut entries,
            excluded_inbox,
            total_scanned,
            ..
        } = state;

        let _ = app.emit(
            "driver-scan-progress",
            ScanProgress {
                done: total,
                total,
                class: String::new(),
            },
        );

        entries.sort_by(|a, b| {
            b.important
                .cmp(&a.important)
                .then(class_rank(&a.class).cmp(&class_rank(&b.class)))
                .then(b.age_days.cmp(&a.age_days))
        });

        Ok(DriverAudit {
            entries,
            excluded_inbox,
            total_scanned,
            classes_scanned: classes.len(),
        })
    }
}

/// `cancellable` is set by the scan, so that [`cancel_scan`] stops this audit
/// and no other one (the Hardware page runs its own).
#[cfg(windows)]
#[tauri::command(async)]
pub fn driver_audit(
    app: tauri::AppHandle,
    cancellable: Option<bool>,
    session: Option<String>,
) -> Result<DriverAudit, String> {
    let scan = cancellable
        .unwrap_or(false)
        .then(|| SCAN_GENERATION.load(std::sync::atomic::Ordering::SeqCst));
    imp::audit(&app, scan, session.as_deref())
}

/// Opens Windows Update, which is the channel that actually installs drivers.
///
/// The app does not download vendor driver packages itself, and that is a
/// decision rather than a gap: there is no vendor API to ask "what is current
/// for this exact device", the answer would have to be scraped from pages
/// that change, and installing the wrong display driver is one of the few
/// mistakes a tuning tool can make that leaves someone without a screen.
/// Windows Update ships WHQL-signed vendor drivers through a channel built
/// for it, so that is where this sends people.
#[cfg(windows)]
#[tauri::command(async)]
pub fn open_windows_update() -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    crate::system_tools::run("cmd", |tool| {
        tool.args(["/C", "start", "", "ms-settings:windowsupdate"])
            .creation_flags(0x08000000)
            .spawn()
    })
    .map(|_| ())
    .map_err(|e| format!("could not open Windows Update: {}", e))
}

/// Whether Windows itself says a restart is pending. Read from the same
/// places Windows sets, so the prompt only appears when a restart would
/// genuinely finish something rather than as a routine nag.
#[cfg(windows)]
#[tauri::command(async)]
pub fn reboot_pending() -> Result<bool, String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let flags = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired",
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
    ];
    // Deliberately only these two. `PendingFileRenameOperations` looks like a
    // third signal and is not one: any application that queues a file delete
    // writes to it, and it was found here holding nothing but Chrome's own
    // post-update temp files — which would have shown a "Windows needs to
    // restart" prompt on a machine that needed no such thing. A restart
    // prompt that cries wolf is worse than no prompt at all.
    Ok(flags.iter().any(|k| hklm.open_subkey(k).is_ok()))
}

/// Restarts the machine, after the user picked "now" over "later".
#[cfg(windows)]
#[tauri::command(async)]
pub fn reboot_now() -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    // A short delay lets this command return so the UI can close cleanly
    // instead of being killed mid-frame.
    crate::system_tools::run("shutdown", |tool| {
        tool.args(["/r", "/t", "5", "/c", "Restart requested from PC Tweaker"])
            .creation_flags(0x08000000)
            .spawn()
    })
    .map(|_| ())
    .map_err(|e| format!("could not restart: {}", e))
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn driver_audit(
    _app: tauri::AppHandle,
    _cancellable: Option<bool>,
    _session: Option<String>,
) -> Result<DriverAudit, String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn open_windows_update() -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn reboot_pending() -> Result<bool, String> {
    Ok(false)
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn reboot_now() -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancelling_stops_only_audits_started_before_it() {
        let before = SCAN_GENERATION.load(std::sync::atomic::Ordering::SeqCst);
        assert!(!stale(None), "a plain audit is never cancelled");
        assert!(!stale(Some(before)));
        cancel_scan();
        assert!(stale(Some(before)), "the running audit stops");
        assert!(!stale(None));
        // A scan started after the cancel runs normally.
        let after = SCAN_GENERATION.load(std::sync::atomic::Ordering::SeqCst);
        assert!(!stale(Some(after)));
        // Cancelling twice is harmless.
        cancel_scan();
        cancel_scan();
        assert!(stale(Some(after)));
    }

    #[test]
    fn a_paused_inventory_resumes_only_for_its_own_session() {
        let partial = |session: &str, done| PartialAudit {
            session: session.into(),
            classes: vec!["DISPLAY".into(), "NET".into(), "MEDIA".into()],
            done,
            total_scanned: 7,
            ..Default::default()
        };
        save_partial(partial("scan-a", 2));
        let resumed = take_partial("scan-a").expect("held for scan-a");
        assert_eq!((resumed.done, resumed.total_scanned), (2, 7));
        assert!(take_partial("scan-a").is_none(), "taken once");

        // A new scan forgets an old pause instead of mixing the two.
        save_partial(partial("scan-a", 1));
        assert!(take_partial("scan-b").is_none());
        assert!(take_partial("scan-a").is_none());

        // Ending a scan discards its partial inventory, and only its own.
        save_partial(partial("scan-c", 1));
        discard_scan_session("scan-d".into());
        discard_scan_session("scan-c".into());
        assert!(take_partial("scan-c").is_none());
    }
}
