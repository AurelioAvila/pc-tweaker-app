//! Reversible Delivery Optimization background-download policy (KB/s).
use crate::rollback::{RollbackStore, SnapshotEntry};
use crate::tweaks::{windows_impl as registry, Hive};
use serde::{Deserialize, Serialize};

pub const TWEAK_ID: &str = "limit_do_background_download";
pub const PATH: &str = r"SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization";
pub const VALUE: &str = "DOMaxBackgroundDownloadBandwidth";
const MAX_KBPS: u32 = 1_000_000;
const POLICY_MANAGER: &str =
    r"SOFTWARE\Microsoft\PolicyManager\current\device\DeliveryOptimization";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadLimitState {
    pub supported: bool,
    pub configured_kbps: Option<u32>,
    pub provider: String,
    pub applied: bool,
    pub conflict: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct DoConfig {
    down_back_limit_bps_provider: String,
    down_back_limit_pct_provider: String,
    set_hours_to_limit_download_background_provider: String,
}

fn supported_edition() -> Result<bool, String> {
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    let key = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .map_err(|e| format!("could not read Windows edition: {e}"))?;
    let build: String = key
        .get_value("CurrentBuildNumber")
        .map_err(|e| e.to_string())?;
    let edition: String = key.get_value("EditionID").map_err(|e| e.to_string())?;
    let installation: String = key
        .get_value("InstallationType")
        .map_err(|e| e.to_string())?;
    let supported_name = ["Professional", "Enterprise", "Education", "IoTEnterprise"]
        .iter()
        .any(|prefix| edition.starts_with(prefix));
    Ok(installation == "Client"
        && build.parse::<u32>().map_err(|e| e.to_string())? >= 19_041
        && supported_name)
}

fn config() -> Result<DoConfig, String> {
    const SCRIPT: &str = "$ErrorActionPreference='Stop'; $c=Get-DOConfig -Verbose 4>$null; if ($null -eq $c) { throw 'Delivery Optimization returned no configuration' }; [pscustomobject]@{ DownBackLimitBpsProvider=[string]$c.DownBackLimitBpsProvider; DownBackLimitPctProvider=[string]$c.DownBackLimitPctProvider; SetHoursToLimitDownloadBackgroundProvider=[string]$c.SetHoursToLimitDownloadBackgroundProvider } | ConvertTo-Json -Compress";
    let output = crate::system_tools::run("powershell", |tool| {
        tool.args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
            .output()
    })
    .map_err(|e| format!("could not inspect Delivery Optimization: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "could not inspect Delivery Optimization: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("invalid Delivery Optimization configuration: {e}"))
}

fn managed_name(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    [
        "domaxbackgrounddownloadbandwidth",
        "dopercentagemaxbackgroundbandwidth",
        "dosethourstolimitbackgrounddownloadbandwidth",
        "domaxdownloadbandwidth",
        "dopercentagemaxdownloadbandwidth",
    ]
    .iter()
    .any(|target| name.starts_with(target))
}

fn managed_background_policy() -> Result<bool, String> {
    use std::io::ErrorKind;
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    let key = match RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(POLICY_MANAGER) {
        Ok(key) => key,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(false),
        Err(e) => {
            return Err(format!(
                "could not inspect managed Delivery Optimization policy: {e}"
            ))
        }
    };
    for item in key.enum_values() {
        let (name, _) = item
            .map_err(|e| format!("could not inspect managed Delivery Optimization values: {e}"))?;
        if managed_name(&name) {
            return Ok(true);
        }
    }
    for item in key.enum_keys() {
        let name =
            item.map_err(|e| format!("could not inspect managed Delivery Optimization keys: {e}"))?;
        if managed_name(&name) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn conflict(
    config: &DoConfig,
    applied: bool,
    configured: Option<u32>,
    written: Option<u32>,
    managed: bool,
) -> Option<String> {
    if managed {
        return Some(
            "Delivery Optimization background bandwidth is managed by an organization".into(),
        );
    }
    if config.down_back_limit_pct_provider != "DefaultProvider"
        || config.set_hours_to_limit_download_background_provider != "DefaultProvider"
    {
        return Some("Another background percentage or schedule limit is active; review it before setting an absolute cap".into());
    }
    if applied {
        if configured != written {
            return Some("The Delivery Optimization policy changed outside PC Tweaker; the saved original is retained".into());
        }
        if !["DefaultProvider", "GroupPolicyProvider", "MdmProvider"]
            .contains(&config.down_back_limit_bps_provider.as_str())
        {
            return Some("Delivery Optimization is controlled by another provider".into());
        }
    } else if configured.is_some() || config.down_back_limit_bps_provider != "DefaultProvider" {
        return Some("A Delivery Optimization background limit is already configured by Windows or an administrator".into());
    }
    None
}

pub fn state(store: &RollbackStore) -> Result<DownloadLimitState, String> {
    let supported = supported_edition()?;
    let entry = store.transaction()?.entry(TWEAK_ID);
    let written = match entry {
        Some(SnapshotEntry::DeliveryOptimization { written_kbps, .. }) => Some(written_kbps),
        None => None,
        _ => return Err("unexpected Delivery Optimization snapshot".into()),
    };
    let configured = registry::read_dword(Hive::Hklm, PATH, VALUE).map_err(|e| e.to_string())?;
    if !supported {
        return Ok(DownloadLimitState {
            supported: false, configured_kbps: configured, provider: "Unavailable".into(),
            applied: written.is_some(),
            conflict: Some("This control requires Windows 10 build 19041 or later, Pro, Enterprise, Education or IoT Enterprise".into()),
        });
    }
    let config = config()?;
    let issue = conflict(
        &config,
        written.is_some(),
        configured,
        written,
        managed_background_policy()?,
    );
    Ok(DownloadLimitState {
        supported,
        configured_kbps: configured,
        provider: config.down_back_limit_bps_provider,
        applied: written.is_some(),
        conflict: issue,
    })
}

/// Writes only an otherwise-unset, unmanaged policy. An active cap must be
/// restored before setting a different value, preserving the original journal.
pub fn configure(store: &RollbackStore, kbps: u32) -> Result<DownloadLimitState, String> {
    if !(1..=MAX_KBPS).contains(&kbps) {
        return Err(format!("cap must be 1..={MAX_KBPS} KB/s"));
    }
    if !crate::elevation::is_elevated() {
        return Err("administrator rights are required to configure Delivery Optimization".into());
    }
    let current = state(store)?;
    if !current.supported {
        return Err(current
            .conflict
            .unwrap_or_else(|| "unsupported Windows edition".into()));
    }
    if current.applied {
        return Err("restore the current cap before setting a different value".into());
    }
    if let Some(issue) = current.conflict {
        return Err(issue);
    }
    let mut transaction = store.transaction()?;
    // Recheck under the rollback lock before writing. Existing policy is never overwritten.
    if registry::read_dword(Hive::Hklm, PATH, VALUE)
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("a Delivery Optimization policy appeared during configuration".into());
    }
    let checked = config()?;
    if let Some(issue) = conflict(&checked, false, None, None, managed_background_policy()?) {
        return Err(issue);
    }
    transaction.save_entry(
        TWEAK_ID,
        SnapshotEntry::DeliveryOptimization {
            original_value: None,
            original_provider: checked.down_back_limit_bps_provider,
            original_percent_provider: checked.down_back_limit_pct_provider,
            original_schedule_provider: checked.set_hours_to_limit_download_background_provider,
            written_kbps: kbps,
        },
    )?;
    registry::write_dword(Hive::Hklm, PATH, VALUE, kbps)?;
    drop(transaction);
    state(store)
}

pub fn rollback(store: &RollbackStore) -> Result<DownloadLimitState, String> {
    if !crate::elevation::is_elevated() {
        return Err("administrator rights are required to restore Delivery Optimization".into());
    }
    store.restore_entry(TWEAK_ID, |entry| {
        let SnapshotEntry::DeliveryOptimization { original_value, written_kbps, .. } = entry else {
            return Err("unexpected Delivery Optimization snapshot".into());
        };
        let current = registry::read_dword(Hive::Hklm, PATH, VALUE).map_err(|e| e.to_string())?;
        if current == original_value {
            return Ok(());
        }
        if current != Some(written_kbps) {
            return Err("Delivery Optimization policy changed outside PC Tweaker; original snapshot retained".into());
        }
        let live = config()?;
        if conflict(&live, true, current, Some(written_kbps), managed_background_policy()?).is_some() {
            return Err("Delivery Optimization provider changed; original snapshot retained".into());
        }
        crate::tweaks::windows_impl::restore_value(&crate::rollback::RegistrySnapshot {
            hive: "HKLM".into(), path: PATH.into(), name: VALUE.into(),
            original_value: original_value.map(crate::rollback::RegValue::Dword),
        })
    })?;
    state(store)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unmanaged_cap_only_when_all_background_providers_are_default() {
        let mut config = DoConfig {
            down_back_limit_bps_provider: "DefaultProvider".into(),
            down_back_limit_pct_provider: "DefaultProvider".into(),
            set_hours_to_limit_download_background_provider: "DefaultProvider".into(),
        };
        assert!(conflict(&config, false, None, None, false).is_none());
        config.down_back_limit_pct_provider = "SettingsProvider".into();
        assert!(conflict(&config, false, None, None, false).is_some());
        config.down_back_limit_pct_provider = "DefaultProvider".into();
        assert!(conflict(&config, true, Some(501), Some(500), false).is_some());
        config.down_back_limit_bps_provider = "MdmProvider".into();
        assert!(conflict(&config, true, Some(500), Some(500), false).is_none());
        assert!(conflict(&config, true, Some(500), Some(500), true).is_some());
        assert!(conflict(&config, false, None, None, false).is_some());
        assert!(managed_name("DOMaxBackgroundDownloadBandwidth_ProviderSet"));
        assert!(managed_name(
            "DOSetHoursToLimitBackgroundDownloadBandwidth_From"
        ));
        assert!(!managed_name("DODownloadMode"));

        let journal = SnapshotEntry::DeliveryOptimization {
            original_value: None,
            original_provider: "DefaultProvider".into(),
            original_percent_provider: "DefaultProvider".into(),
            original_schedule_provider: "DefaultProvider".into(),
            written_kbps: 500,
        };
        assert!(crate::rollback::validate_snapshot(TWEAK_ID, &journal).is_ok());
        let forged = SnapshotEntry::DeliveryOptimization {
            original_value: Some(10),
            original_provider: "MdmProvider".into(),
            original_percent_provider: "DefaultProvider".into(),
            original_schedule_provider: "DefaultProvider".into(),
            written_kbps: 500,
        };
        assert!(crate::rollback::validate_snapshot(TWEAK_ID, &forged).is_err());
    }

    #[test]
    #[ignore = "Delivery Optimization policy mutation on disposable DEBLOAT-QA VM only"]
    fn vm_policy_apply_readback_restore() {
        crate::everyday::tests::vm_guard(true);
        let store = RollbackStore::new(
            std::env::temp_dir().join(format!("pct-expansion-do-{}", std::process::id())),
        );
        let before = state(&store).expect("VM DO state");
        assert!(
            before.supported && !before.applied && before.conflict.is_none(),
            "VM DO is already configured: {before:?}"
        );
        let applied = configure(&store, 500);
        if store.is_applied(TWEAK_ID) {
            let restored = rollback(&store).expect("VM DO restore");
            assert!(!restored.applied);
            assert_eq!(registry::read_dword(Hive::Hklm, PATH, VALUE).unwrap(), None);
        }
        let applied = applied.expect("VM DO policy write/readback");
        assert!(applied.applied);
        assert_eq!(applied.configured_kbps, Some(500));
        eprintln!("DO provider after policy write: {}", applied.provider);
    }

    #[test]
    #[ignore = "recover a prior owned DO policy on disposable DEBLOAT-QA VM only"]
    fn vm_recover_prior_owned_policy() {
        crate::everyday::tests::vm_guard(true);
        let name = std::env::var("PC_TWEAKER_EXPANSION_DO_RECOVERY_DIR")
            .expect("set the exact previous VM journal directory name");
        let suffix = name
            .strip_prefix("pct-expansion-do-")
            .expect("unexpected journal name");
        assert!(!suffix.is_empty() && suffix.bytes().all(|b| b.is_ascii_digit()));
        let dir = std::env::temp_dir().join(name);
        assert!(dir.is_dir(), "previous VM journal is missing");
        let store = RollbackStore::new(dir);
        assert!(
            store.is_applied_checked(TWEAK_ID).unwrap(),
            "no owned policy snapshot"
        );
        let restored = rollback(&store).expect("production DO rollback");
        assert!(!restored.applied);
        assert_eq!(registry::read_dword(Hive::Hklm, PATH, VALUE).unwrap(), None);
    }
}
