//! Driver updates through Windows Update.
//!
//! This is the one channel where "download the new drivers" can be done
//! safely. Microsoft matches driver packages to the exact hardware ID, every
//! package is WHQL-signed, and the download/install path is a documented API
//! (the Windows Update Agent COM objects) rather than a scrape of a vendor
//! page that changes shape every quarter. Fetching installers from vendor
//! sites directly was considered and rejected: there is no API that answers
//! "what is current for this device", and installing the wrong display driver
//! is one of the few mistakes a tuning tool can make that leaves someone
//! without a screen.
//!
//! Searching is unprivileged. Downloading and installing are not, so they go
//! through the same one-action elevated relaunch every other admin change
//! uses — the app itself never runs elevated.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct DriverUpdate {
    pub title: String,
    /// Megabytes, as Windows Update reports them. `None` when the catalogue
    /// does not state a size rather than a zero that would read as "free".
    pub size_mb: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpdateSearchResult {
    pub updates: Vec<DriverUpdate>,
    /// Set when the search itself could not run (the service is disabled, the
    /// machine is offline). The UI says so instead of showing "0 updates",
    /// which would be a different and misleading claim.
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct InstallOutcome {
    pub installed: usize,
    pub failed: usize,
    /// Straight from Windows Update's own result, not inferred.
    pub reboot_required: bool,
}

#[cfg(windows)]
mod imp {
    use super::{InstallOutcome, UpdateSearchResult};
    use base64::Engine as _;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    /// The Microsoft Update service id. Asking for it explicitly is what makes
    /// third-party driver packages visible: the default Windows Update
    /// service alone returns only Microsoft's own content on many machines.
    const MICROSOFT_UPDATE_SERVICE: &str = "7971f918-a847-4430-9279-4a52d1efe18d";

    fn run_ps(script: &str) -> Result<String, String> {
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("could not run PowerShell: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !output.status.success() && stdout.is_empty() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        Ok(stdout)
    }

    pub fn search() -> UpdateSearchResult {
        let script = format!(
            "$ErrorActionPreference='Stop'; \
             try {{ \
               $s = New-Object -ComObject Microsoft.Update.Session; \
               $sr = $s.CreateUpdateSearcher(); \
               $sr.ServerSelection = 3; \
               $sr.ServiceID = '{svc}'; \
               $r = $sr.Search(\"IsInstalled=0 and Type='Driver'\"); \
               $rows = @($r.Updates | ForEach-Object {{ [pscustomobject]@{{ \
                 title = $_.Title; \
                 sizeMb = [math]::Round($_.MaxDownloadSize / 1MB, 1) }} }}); \
               [pscustomobject]@{{ updates = @($rows); error = $null }} | ConvertTo-Json -Depth 4 -Compress \
             }} catch {{ \
               [pscustomobject]@{{ updates = @(); error = $_.Exception.Message }} | ConvertTo-Json -Depth 4 -Compress \
             }}",
            svc = MICROSOFT_UPDATE_SERVICE
        );

        match run_ps(&script) {
            Ok(raw) if !raw.is_empty() => match serde_json::from_str::<serde_json::Value>(&raw) {
                Ok(v) => {
                    let error = v
                        .get("error")
                        .and_then(|e| e.as_str())
                        .map(|s| s.to_string());
                    // A single update serialises as an object, several as an
                    // array; both shapes are accepted so one pending driver
                    // isn't reported as none.
                    let rows: Vec<&serde_json::Value> = match v.get("updates") {
                        Some(serde_json::Value::Array(a)) => a.iter().collect(),
                        Some(o @ serde_json::Value::Object(_)) => vec![o],
                        _ => Vec::new(),
                    };
                    UpdateSearchResult {
                        updates: rows
                            .into_iter()
                            .filter_map(|r| {
                                Some(super::DriverUpdate {
                                    title: r.get("title")?.as_str()?.trim().to_string(),
                                    size_mb: r.get("sizeMb").and_then(|s| s.as_f64()),
                                })
                            })
                            .collect(),
                        error,
                    }
                }
                Err(e) => UpdateSearchResult {
                    updates: Vec::new(),
                    error: Some(format!("unexpected update data: {}", e)),
                },
            },
            Ok(_) => UpdateSearchResult {
                updates: Vec::new(),
                error: Some("Windows Update returned nothing".to_string()),
            },
            Err(e) => UpdateSearchResult {
                updates: Vec::new(),
                error: Some(e),
            },
        }
    }

    /// Downloads and installs the pending driver updates whose title is in
    /// `titles`, then reports what Windows Update itself said about needing a
    /// restart. The search is re-run rather than trusting a list of updates
    /// handed across the elevation boundary: an `IUpdate` COM object can't be
    /// serialized, so all that survives the trip is which titles were picked,
    /// and this re-resolves them against Windows Update's own current
    /// results.
    ///
    /// Matching by title has one real failure mode: two distinct pending
    /// updates that happen to share an identical title. `search()` already
    /// hands the frontend that exact title string as the only identifier, so
    /// this is the same identifier both sides agree on - and Windows Update
    /// titles are generated from the driver's own metadata (vendor,
    /// class, model), which makes an exact collision rare enough not to
    /// justify a synthetic id neither side can otherwise verify.
    pub fn install(titles: &[String]) -> Result<InstallOutcome, String> {
        if titles.is_empty() {
            return Ok(InstallOutcome {
                installed: 0,
                failed: 0,
                reboot_required: false,
            });
        }

        // Passed through as base64 so PowerShell never has to parse arbitrary
        // driver titles (quotes, apostrophes, whatever a vendor put in the
        // metadata) as script text.
        let titles_json = serde_json::to_string(titles).map_err(|e| e.to_string())?;
        let titles_b64 = base64::engine::general_purpose::STANDARD.encode(titles_json);

        let script = format!(
            "$ErrorActionPreference='Stop'; \
             $wanted = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{titles_b64}')) | ConvertFrom-Json; \
             $wantedSet = New-Object System.Collections.Generic.HashSet[string]; \
             foreach ($t in $wanted) {{ $null = $wantedSet.Add($t) }} \
             $s = New-Object -ComObject Microsoft.Update.Session; \
             $sr = $s.CreateUpdateSearcher(); \
             $sr.ServerSelection = 3; $sr.ServiceID = '{svc}'; \
             $r = $sr.Search(\"IsInstalled=0 and Type='Driver'\"); \
             $picked = New-Object -ComObject Microsoft.Update.UpdateColl; \
             foreach ($u in $r.Updates) {{ if ($wantedSet.Contains($u.Title)) {{ $null = $picked.Add($u) }} }} \
             if ($picked.Count -eq 0) {{ \
               [pscustomobject]@{{ installed = 0; failed = $wantedSet.Count; reboot = $false }} | ConvertTo-Json -Compress; exit 0 \
             }} \
             $d = $s.CreateUpdateDownloader(); $d.Updates = $picked; $null = $d.Download(); \
             $ready = New-Object -ComObject Microsoft.Update.UpdateColl; \
             foreach ($u in $picked) {{ if ($u.IsDownloaded) {{ $null = $ready.Add($u) }} }} \
             if ($ready.Count -eq 0) {{ \
               [pscustomobject]@{{ installed = 0; failed = $picked.Count; reboot = $false }} | ConvertTo-Json -Compress; exit 0 \
             }} \
             $i = $s.CreateUpdateInstaller(); $i.Updates = $ready; $res = $i.Install(); \
             $ok = 0; $bad = 0; \
             for ($n = 0; $n -lt $ready.Count; $n++) {{ \
               if ($res.GetUpdateResult($n).ResultCode -eq 2) {{ $ok++ }} else {{ $bad++ }} \
             }} \
             $notFound = $picked.Count -lt $wantedSet.Count; \
             [pscustomobject]@{{ installed = $ok; failed = ($bad + [int]$notFound * ($wantedSet.Count - $picked.Count)); reboot = $res.RebootRequired }} | ConvertTo-Json -Compress",
            svc = MICROSOFT_UPDATE_SERVICE,
            titles_b64 = titles_b64
        );

        let raw = run_ps(&script)?;
        let v: serde_json::Value = serde_json::from_str(raw.trim())
            .map_err(|e| format!("unexpected install result: {} ({})", e, raw))?;
        Ok(InstallOutcome {
            installed: v.get("installed").and_then(|x| x.as_u64()).unwrap_or(0) as usize,
            failed: v.get("failed").and_then(|x| x.as_u64()).unwrap_or(0) as usize,
            reboot_required: v.get("reboot").and_then(|x| x.as_bool()).unwrap_or(false),
        })
    }
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn search_driver_updates() -> Result<UpdateSearchResult, String> {
    Ok(imp::search())
}

/// Installing needs administrator rights, so it runs through the elevated
/// relaunch. The outcome is written to a small file the unprivileged app
/// reads back, since the elevated process is a separate short-lived run.
///
/// `titles` is whichever pending updates the user actually selected - never
/// assumed to be "all of them". An `IUpdate` COM object can't cross the
/// elevation boundary, so the title is what both processes agree an update
/// *is*; `imp::install` re-resolves it against a fresh search rather than
/// trusting anything else about it.
#[cfg(windows)]
#[tauri::command(async)]
pub fn install_driver_updates(
    app: tauri::AppHandle,
    titles: Vec<String>,
) -> Result<InstallOutcome, String> {
    if crate::elevation::is_elevated() {
        return imp::install(&titles);
    }
    if titles.is_empty() {
        return Ok(InstallOutcome {
            installed: 0,
            failed: 0,
            reboot_required: false,
        });
    }
    use base64::Engine as _;
    let payload = base64::engine::general_purpose::STANDARD.encode(
        serde_json::to_string(&titles).map_err(|e| e.to_string())?,
    );
    crate::elevation::run_elevated_action("--elevated-driverupdate", &payload)?;
    read_outcome(&app)
}

#[cfg(windows)]
fn outcome_path(dir: &std::path::Path) -> std::path::PathBuf {
    dir.join("driver-update-outcome.json")
}

#[cfg(windows)]
fn read_outcome(app: &tauri::AppHandle) -> Result<InstallOutcome, String> {
    let dir = crate::store_for_dir(app)?;
    let path = outcome_path(&dir);
    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("the elevated install left no result: {}", e))?;
    // Consumed once: a stale file must never be shown as the outcome of a
    // later run that failed before it could write one.
    let _ = std::fs::remove_file(&path);
    serde_json::from_str(&text).map_err(|e| format!("unreadable install result: {}", e))
}

/// Entry point for the elevated relaunch. `payload` is the base64-encoded
/// JSON array of titles built by `install_driver_updates` above - the same
/// encoding `imp::install` itself uses internally, so this only has to
/// decode it once to get plain titles back.
#[cfg(windows)]
pub fn install_elevated(dir: &std::path::Path, payload: &str) -> Result<(), String> {
    use base64::Engine as _;
    let titles: Vec<String> = base64::engine::general_purpose::STANDARD
        .decode(payload)
        .map_err(|e| format!("unreadable driver update payload: {}", e))
        .and_then(|bytes| {
            String::from_utf8(bytes).map_err(|e| format!("driver update payload not utf-8: {}", e))
        })
        .and_then(|json| {
            serde_json::from_str(&json).map_err(|e| format!("driver update payload not json: {}", e))
        })?;
    let outcome = imp::install(&titles)?;
    let json = serde_json::to_string(&outcome).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    std::fs::write(outcome_path(dir), json).map_err(|e| e.to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn search_driver_updates() -> Result<UpdateSearchResult, String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn install_driver_updates(
    _app: tauri::AppHandle,
    _titles: Vec<String>,
) -> Result<InstallOutcome, String> {
    Err("not supported on this platform".to_string())
}
