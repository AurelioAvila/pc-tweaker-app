use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct DiskHealth {
    pub drive: String,
    pub media_type: String,
    /// "Healthy", "Warning", "Unhealthy", or "Unknown" — Windows' own
    /// `HealthStatus` classification (Storage Management's read of the
    /// drive's S.M.A.R.T./reliability counters), not something this app
    /// evaluates itself.
    pub status: String,
}

#[cfg(windows)]
mod imp {
    use super::DiskHealth;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    fn run_ps(script: &str) -> Result<String, String> {
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("could not run PowerShell: {}", e))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    /// The media type comes from `diskinfo::list_drives` (sysinfo, already
    /// polled for the Maintenance drive picker) rather than a second
    /// PowerShell round trip — HealthStatus is the only field Windows
    /// Storage Management exposes that sysinfo doesn't.
    pub fn check(drive: &str) -> Result<DiskHealth, String> {
        let letter = drive.trim_end_matches(':');
        let script = format!(
            "(Get-Partition -DriveLetter '{}' | Get-Disk | Get-PhysicalDisk | Select-Object -First 1 -ExpandProperty HealthStatus)",
            letter
        );
        let status = run_ps(&script)?;

        Ok(DiskHealth {
            drive: drive.to_string(),
            media_type: crate::diskinfo::media_type_of(drive),
            status: if status.is_empty() { "Unknown".to_string() } else { status },
        })
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn disk_health(drive: String) -> Result<DiskHealth, String> {
    // The letter is interpolated into a PowerShell command line below, so it
    // is pinned to a bare "X:" here — anything else is rejected before it
    // can reach the shell.
    let drive = crate::diskinfo::validate_drive(&drive)?;
    imp::check(&drive)
}

#[cfg(not(windows))]
#[tauri::command]
pub fn disk_health(_drive: String) -> Result<DiskHealth, String> {
    Err("not supported on this platform".to_string())
}
