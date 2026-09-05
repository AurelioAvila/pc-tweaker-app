//! Swaps the TCP congestion-control algorithm on the Internet template.
//!
//! Windows ships CUBIC, which reacts to packet *loss*: it keeps pushing until
//! a queue somewhere overflows, then halves. On a home line that queue is
//! usually the router's, so the moment anything else in the house starts a
//! download, latency-sensitive traffic sits behind a full buffer — the effect
//! people describe as "my ping spikes when someone streams".
//!
//! BBR2 models the path's bandwidth and round-trip time instead and paces to
//! that, so it fills the pipe without filling the buffer. Microsoft ships it
//! in Windows 11 and Server 2022 as a supported value of the same setting
//! CUBIC uses; nothing here is undocumented or third-party.
//!
//! Why this is not a `RegistryTweak`: the setting is not a registry value.
//! `Set-NetTCPSetting` writes into the TCP stack's own store, and the only
//! honest way to record a previous value for rollback is to read the current
//! provider back before changing it.
//!
//! Deliberately *not* touched here: `TcpAckFrequency` / `TCPNoDelay`, which
//! already have their own tweak (`netlatency`). Writing them from two places
//! would mean two toggles fighting over one pair of values.

use crate::rollback::{RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "tcp_congestion_bbr";

/// The template Windows applies to off-link (internet) destinations. The
/// other templates — Datacenter, Compat, InternetCustom — either do not
/// carry normal home traffic or exist to be overridden per-subnet.
const TEMPLATE: &str = "Internet";
const TARGET_PROVIDER: &str = "BBR2";

pub struct NetShaperInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn info() -> NetShaperInfo {
    NetShaperInfo {
        id: TWEAK_ID,
        name: "Keep latency low when the line is busy (BBR2)",
        description: "Windows uses CUBIC, which speeds up until a buffer somewhere overflows - which is why your ping climbs the moment someone else in the house starts a download. BBR2 measures the line's real bandwidth and round trip instead and paces traffic to fit, so the pipe fills without the queue filling. Microsoft ships BBR2 in Windows 11; this switches the Internet template over to it, and switches back to exactly what was there before (requires administrator rights).",
        requires_admin: true,
        requires_pro: false,
    }
}

#[cfg(windows)]
fn powershell(command: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", command])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("could not run PowerShell: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if err.is_empty() {
            "the TCP setting could not be read or changed".to_string()
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// The provider currently in force, as the stack itself names it.
///
/// Read through the cmdlet rather than `netsh int tcp show supplemental`,
/// whose output is translated: on an Italian install the provider line reads
/// "Provider di controllo congestione", and parsing it by position or by an
/// English label would have picked up whatever happened to sit there.
#[cfg(windows)]
pub fn current_provider() -> Result<String, String> {
    let out = powershell(&format!(
        "(Get-NetTCPSetting -SettingName {} -ErrorAction Stop).CongestionProvider",
        TEMPLATE
    ))?;
    if out.is_empty() {
        return Err(
            "Windows reported no congestion provider for the Internet template".to_string(),
        );
    }
    Ok(out)
}

/// Whether this Windows build accepts BBR2 at all.
///
/// The parameter is a generated enum, so an older build simply does not carry
/// the value — asking the parameter's own type is exact, where comparing
/// Windows build numbers would be a guess about which update added it.
#[cfg(windows)]
pub fn supported() -> bool {
    let probe = "$p = (Get-Command Set-NetTCPSetting).Parameters['CongestionProvider']; \
                 if ($p -and $p.ParameterType.IsEnum -and \
                 ([Enum]::GetNames($p.ParameterType) -contains 'BBR2')) { 'yes' } else { 'no' }";
    matches!(powershell(probe), Ok(v) if v == "yes")
}

#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    let mut transaction = store.transaction()?;

    if !supported() {
        return Err(
            "this Windows build does not offer BBR2 - it arrived with Windows 11".to_string(),
        );
    }

    let previous = current_provider()?;

    // Snapshot before mutating, so a failure part-way cannot leave the stack
    // changed with nothing recorded to change it back to. When the machine is
    // already on BBR2, recording that as the previous value is what makes a
    // later rollback a no-op rather than a silent downgrade to CUBIC the user
    // never chose.
    transaction
        .save_entry(
            TWEAK_ID,
            SnapshotEntry::TcpCongestionProvider {
                setting_name: TEMPLATE.to_string(),
                previous: previous.clone(),
            },
        )
        .map_err(|e| e.to_string())?;

    if previous.eq_ignore_ascii_case(TARGET_PROVIDER) {
        return Ok(());
    }

    set_provider(TEMPLATE, TARGET_PROVIDER)?;
    Ok(())
}

#[cfg(windows)]
fn set_provider(template: &str, provider: &str) -> Result<(), String> {
    powershell(&format!(
        "Set-NetTCPSetting -SettingName {} -CongestionProvider {} -ErrorAction Stop",
        template, provider
    ))
    .map(|_| ())?;
    if !current_provider()?.eq_ignore_ascii_case(provider) {
        return Err(
            "TCP congestion provider could not be verified; the snapshot was retained".into(),
        );
    }
    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(TWEAK_ID, |entry| {
        let SnapshotEntry::TcpCongestionProvider {
            setting_name,
            previous,
        } = entry
        else {
            return Err("unexpected snapshot type for the congestion provider tweak".to_string());
        };

        set_provider(&setting_name, &previous)
    })
}

#[cfg(not(windows))]
pub fn apply(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(not(windows))]
pub fn rollback(_store: &RollbackStore) -> Result<(), String> {
    Err("not supported on this platform".to_string())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// The provider has to come back as one of the stack's own names. If this
    /// ever returned a translated word or an empty string, the value recorded
    /// for rollback would be one the stack cannot be set back to.
    #[test]
    fn the_current_provider_is_a_known_name() {
        let p = current_provider().expect("no congestion provider reported");
        const KNOWN: [&str; 7] = [
            "Default", "NewReno", "CTCP", "DCTCP", "LEDBAT", "CUBIC", "BBR2",
        ];
        assert!(
            KNOWN.iter().any(|k| k.eq_ignore_ascii_case(&p)),
            "unrecognised congestion provider: {}",
            p
        );
    }
}
