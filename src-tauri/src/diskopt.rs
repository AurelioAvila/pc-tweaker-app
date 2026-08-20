use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct DiskOptResult {
    pub drive: String,
    /// "SSD" or "HDD" when Windows could tell us, "Unknown" otherwise. Shown
    /// to the user so "optimize" doesn't read as a euphemism for a
    /// traditional defrag when it actually ran a TRIM/retrim instead.
    pub media_type: String,
    pub summary: String,
}

#[cfg(windows)]
mod imp {
    use super::DiskOptResult;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    /// Windows' own `defrag /O` picks the right operation for the media type —
    /// a traditional defragmentation on a spinning HDD, or a TRIM/slab
    /// consolidation retrim on an SSD, never a full defrag pass on an SSD
    /// (which would only add wear for essentially no benefit). This is the
    /// same code path Settings > Optimize Drives uses.
    pub fn optimize(drive: &str) -> Result<DiskOptResult, String> {
        let media = crate::diskinfo::media_type_of(drive);

        let output = Command::new("defrag")
            .args([drive, "/O", "/H"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("could not run defrag: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            return Err(format!("defrag reported an error: {}", detail));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        // defrag's own output already ends with a human-readable summary
        // line; take the last non-empty line rather than dumping the whole
        // multi-page report into a toast.
        let summary = stdout
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .last()
            .unwrap_or("Optimization complete.")
            .to_string();

        Ok(DiskOptResult {
            drive: drive.to_string(),
            media_type: media,
            summary,
        })
    }
}

// Not a #[tauri::command] itself: optimizing a drive needs administrator
// rights, so the command exposed to the frontend (in lib.rs) has to check
// elevation and, if needed, relaunch through the same UAC-prompt path every
// other admin action uses — exactly like `run_cleanup` does for admin
// cleanup targets. Calling `defrag` directly from an unelevated process
// would not prompt for UAC on its own; it would just fail.
#[cfg(windows)]
pub fn optimize(drive: &str) -> Result<DiskOptResult, String> {
    imp::optimize(drive)
}

#[cfg(not(windows))]
pub fn optimize(_drive: &str) -> Result<DiskOptResult, String> {
    Err("not supported on this platform".to_string())
}

#[cfg(test)]
mod tests {
    /// A successful run must still produce a non-empty, displayable summary
    /// even when defrag's own stdout was somehow all blank lines — the UI has
    /// nothing sensible to show for an empty string.
    #[test]
    fn falls_back_to_a_readable_summary_when_output_is_blank() {
        let stdout = "\n\n   \n";
        let summary = stdout
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .last()
            .unwrap_or("Optimization complete.")
            .to_string();
        assert_eq!(summary, "Optimization complete.");
    }

    #[test]
    fn picks_the_last_non_empty_line_as_the_summary() {
        let stdout = "Analyzing...\n\nThe operation completed successfully.\n";
        let summary = stdout
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .last()
            .unwrap_or("Optimization complete.")
            .to_string();
        assert_eq!(summary, "The operation completed successfully.");
    }
}
