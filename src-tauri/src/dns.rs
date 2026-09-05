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

fn configured_dns(value: Option<&str>) -> Result<(bool, Vec<String>), String> {
    let value = value.unwrap_or("").trim();
    if value.is_empty() {
        return Ok((true, Vec::new()));
    }
    let addresses = value
        .split(|c: char| c == ',' || c == ';' || c.is_whitespace())
        .filter(|v| !v.is_empty())
        .map(|v| {
            v.parse::<std::net::Ipv4Addr>()
                .map(|ip| ip.to_string())
                .map_err(|_| "The adapter has an unsupported DNS configuration".to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    if addresses.is_empty() || addresses.len() > 16 {
        return Err("Invalid DNS configuration".into());
    }
    Ok((false, addresses))
}

#[cfg(windows)]
fn original_dns(iface: &str) -> Result<(bool, Vec<String>), String> {
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    let guid = run_ps(&format!(
        "(Get-NetAdapter -Name '{}' -ErrorAction Stop).InterfaceGuid.ToString()",
        ps_quote(iface)
    ))?;
    let guid = guid.trim_matches(['{', '}']);
    if !crate::rollback::valid_guid(guid) {
        return Err("The network adapter could not be identified".into());
    }
    let key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(format!(
            r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\{{{guid}}}"
        ))
        .map_err(|e| e.to_string())?;
    let value = match key.get_value::<String, _>("NameServer") {
        Ok(value) => Some(value),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(e.to_string()),
    };
    configured_dns(value.as_deref())
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;
    if matches!(
        transaction.entry(TWEAK_ID),
        Some(SnapshotEntry::Dns {
            previous_automatic: None,
            ..
        })
    ) {
        return Err("This legacy DNS snapshot does not record automatic versus static configuration. Recovery data was retained for manual review; no settings were changed.".into());
    }

    let iface = active_interface_alias()?;
    let (automatic, previous) = original_dns(&iface)?;

    let script = format!(
        "Get-DnsClientServerAddress -InterfaceAlias '{}' -AddressFamily IPv4 -ErrorAction Stop | Set-DnsClientServerAddress -ServerAddresses ('{}','{}') -ErrorAction Stop",
        ps_quote(&iface),
        PRIMARY_DNS,
        SECONDARY_DNS
    );

    transaction
        .save_entry(
            TWEAK_ID,
            SnapshotEntry::Dns {
                interface: iface.clone(),
                previous_servers: previous,
                previous_automatic: Some(automatic),
            },
        )
        .map_err(|e| e.to_string())?;
    run_ps(&script)?;
    if current_dns_servers(&iface)? != [PRIMARY_DNS, SECONDARY_DNS] {
        return Err("DNS configuration could not be verified; the snapshot was retained".into());
    }
    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(TWEAK_ID, |entry| {

    let SnapshotEntry::Dns {
        interface,
        previous_servers,
        previous_automatic,
    } = entry
    else {
        return Err("unexpected snapshot type for DNS".to_string());
    };

    let automatic = previous_automatic.ok_or("This legacy DNS snapshot does not record automatic versus static configuration. Recovery data was retained for manual review; no settings were changed.")?;
    if automatic {
        run_ps(&format!(
            "Get-DnsClientServerAddress -InterfaceAlias '{}' -AddressFamily IPv4 -ErrorAction Stop | Set-DnsClientServerAddress -ResetServerAddresses -ErrorAction Stop",
            ps_quote(&interface)
        ))
        .map(|_| ())?;
    } else {
        let joined = previous_servers
            .iter()
            .map(|s| format!("'{}'", ps_quote(s)))
            .collect::<Vec<_>>()
            .join(",");
        run_ps(&format!(
            "Get-DnsClientServerAddress -InterfaceAlias '{}' -AddressFamily IPv4 -ErrorAction Stop | Set-DnsClientServerAddress -ServerAddresses ({}) -ErrorAction Stop",
            ps_quote(&interface),
            joined
        ))
        .map(|_| ())?;
        if current_dns_servers(&interface)? != previous_servers {
            return Err("restored DNS addresses could not be verified; the snapshot was retained".into());
        }
    }
    if original_dns(&interface)? != (automatic, previous_servers) {
        return Err("Restored DNS mode could not be verified; recovery data was retained".into());
    }
    Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn automatic_is_distinct_from_static_addresses() {
        assert_eq!(configured_dns(None).unwrap(), (true, vec![]));
        assert_eq!(configured_dns(Some(" ")).unwrap(), (true, vec![]));
        assert_eq!(
            configured_dns(Some("1.1.1.1, 1.0.0.1")).unwrap(),
            (false, vec!["1.1.1.1".into(), "1.0.0.1".into()])
        );
        assert!(configured_dns(Some("not-an-address")).is_err());
    }
    #[test]
    fn legacy_snapshots_preserve_unknown_mode() {
        let entry: SnapshotEntry = serde_json::from_str(
            r#"{"kind":"Dns","interface":"Ethernet","previous_servers":["192.168.1.1"]}"#,
        )
        .unwrap();
        assert!(matches!(
            entry,
            SnapshotEntry::Dns {
                previous_automatic: None,
                ..
            }
        ));
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
