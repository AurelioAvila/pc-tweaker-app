use serde::Serialize;

#[derive(Serialize, Clone, Default)]
pub struct FlushDnsResult {
    pub success: bool,
    pub detail: String,
}

#[cfg(windows)]
mod imp {
    use super::FlushDnsResult;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    /// `ipconfig /flushdns` clears the DNS resolver cache for the current
    /// user session. Unlike most tweaks here it needs no elevation and
    /// nothing to roll back — it is a one-shot action, not a persistent
    /// setting, so it has no place in the rollback store.
    pub fn flush() -> Result<FlushDnsResult, String> {
        let output = Command::new("ipconfig")
            .arg("/flushdns")
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("could not run ipconfig: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = stdout
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .last()
            .unwrap_or("DNS cache flushed.")
            .to_string();

        if !output.status.success() {
            return Err(format!("ipconfig reported an error: {}", detail));
        }

        Ok(FlushDnsResult {
            success: true,
            detail,
        })
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn flush_dns_cache() -> Result<FlushDnsResult, String> {
    imp::flush()
}

#[cfg(not(windows))]
#[tauri::command]
pub fn flush_dns_cache() -> Result<FlushDnsResult, String> {
    Err("not supported on this platform".to_string())
}
