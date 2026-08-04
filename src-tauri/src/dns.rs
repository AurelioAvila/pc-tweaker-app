use crate::rollback::{RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "privacy_dns";
const PRIMARY_DNS: &str = "1.1.1.1";
const SECONDARY_DNS: &str = "1.0.0.1";

/// Escapes a value for safe interpolation inside a PowerShell single-quoted
/// string (the only special character there is the quote itself).
fn ps_quote(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(windows)]
fn run_ps(script: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("could not run PowerShell: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(windows)]
fn active_interface_alias() -> Result<String, String> {
    let alias = run_ps(
        "(Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1 -ExpandProperty Name)",
    )?;
    if alias.is_empty() {
        return Err("no active network interface found".to_string());
    }
    Ok(alias)
}

#[cfg(windows)]
fn current_dns_servers(iface: &str) -> Result<Vec<String>, String> {
    let script = format!(
        "(Get-DnsClientServerAddress -InterfaceAlias '{}' -AddressFamily IPv4 -ErrorAction Stop).ServerAddresses -join ','",
        ps_quote(iface)
    );
    let out = run_ps(&script)?;
    Ok(out
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect())
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    let iface = active_interface_alias()?;
    let previous = current_dns_servers(&iface)?;

    let script = format!(
        "Set-DnsClientServerAddress -InterfaceAlias '{}' -ServerAddresses ('{}','{}')",
        ps_quote(&iface),
        PRIMARY_DNS,
        SECONDARY_DNS
    );
    run_ps(&script)?;

    store
        .save_entry(
            TWEAK_ID,
            SnapshotEntry::Dns {
                interface: iface,
                previous_servers: previous,
            },
        )
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    let entry = store
        .take_entry(TWEAK_ID)
        .ok_or_else(|| "no snapshot saved: DNS does not appear to be changed".to_string())?;

    let SnapshotEntry::Dns { interface, previous_servers } = entry else {
        return Err("unexpected snapshot type for DNS".to_string());
    };

    if previous_servers.is_empty() {
        run_ps(&format!(
            "Set-DnsClientServerAddress -InterfaceAlias '{}' -ResetServerAddresses",
            ps_quote(&interface)
        ))
        .map(|_| ())
    } else {
        let joined = previous_servers
            .iter()
            .map(|s| format!("'{}'", ps_quote(s)))
            .collect::<Vec<_>>()
            .join(",");
        run_ps(&format!(
            "Set-DnsClientServerAddress -InterfaceAlias '{}' -ServerAddresses ({})",
            ps_quote(&interface),
            joined
        ))
        .map(|_| ())
    }
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}
