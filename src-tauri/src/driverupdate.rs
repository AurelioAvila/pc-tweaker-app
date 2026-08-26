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

    /// Downloads and installs every pending driver update, then reports what
    /// Windows Update itself said about needing a restart.
    pub fn install() -> Result<InstallOutcome, String> {
        let script = format!(
            "$ErrorActionPreference='Stop'; \
             $s = New-Object -ComObject Microsoft.Update.Session; \
             $sr = $s.CreateUpdateSearcher(); \
             $sr.ServerSelection = 3; $sr.ServiceID = '{svc}'; \
             $r = $sr.Search(\"IsInstalled=0 and Type='Driver'\"); \
             if ($r.Updates.Count -eq 0) {{ \
               [pscustomobject]@{{ installed = 0; failed = 0; reboot = $false }} | ConvertTo-Json -Compress; exit 0 \
             }} \
             $toGet = New-Object -ComObject Microsoft.Update.UpdateColl; \
             foreach ($u in $r.Updates) {{ $null = $toGet.Add($u) }} \
             $d = $s.CreateUpdateDownloader(); $d.Updates = $toGet; $null = $d.Download(); \
             $ready = New-Object -ComObject Microsoft.Update.UpdateColl; \
             foreach ($u in $r.Updates) {{ if ($u.IsDownloaded) {{ $null = $ready.Add($u) }} }} \
             if ($ready.Count -eq 0) {{ \
               [pscustomobject]@{{ installed = 0; failed = $r.Updates.Count; reboot = $false }} | ConvertTo-Json -Compress; exit 0 \
             }} \
             $i = $s.CreateUpdateInstaller(); $i.Updates = $ready; $res = $i.Install(); \
             $ok = 0; $bad = 0; \
             for ($n = 0; $n -lt $ready.Count; $n++) {{ \
               if ($res.GetUpdateResult($n).ResultCode -eq 2) {{ $ok++ }} else {{ $bad++ }} \
             }} \
             [pscustomobject]@{{ installed = $ok; failed = $bad; reboot = $res.RebootRequired }} | ConvertTo-Json -Compress",
            svc = MICROSOFT_UPDATE_SERVICE
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
#[cfg(windows)]
#[tauri::command(async)]
pub fn install_driver_updates(app: tauri::AppHandle) -> Result<InstallOutcome, String> {
    if crate::elevation::is_elevated() {
        return imp::install();
    }
    crate::elevation::run_elevated_action("--elevated-driverupdate", "all")?;
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

/// Entry point for the elevated relaunch.
#[cfg(windows)]
pub fn install_elevated(dir: &std::path::Path) -> Result<(), String> {
    let outcome = imp::install()?;
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
pub fn install_driver_updates(_app: tauri::AppHandle) -> Result<InstallOutcome, String> {
    Err("not supported on this platform".to_string())
}
