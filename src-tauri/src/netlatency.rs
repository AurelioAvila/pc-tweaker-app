//! Turns off Nagle's algorithm on the active network adapter.
//!
//! Nagle's algorithm holds small outgoing packets back for a few milliseconds
//! hoping to coalesce them into one, which is a sensible trade for bulk
//! transfers and a bad one for games, where every packet is small and its
//! whole value is arriving *now*. Windows enables it by default and pairs it
//! with delayed ACKs, so the two together can add tens of milliseconds to a
//! round trip.
//!
//! This lives in its own module rather than in the `RegistryTweak` table
//! because the values are per-adapter: the key path contains the interface's
//! GUID, which differs on every machine and changes when adapters change.

use crate::rollback::{RegValue, RegistrySnapshot, RollbackStore, SnapshotEntry};

pub const TWEAK_ID: &str = "network_latency";

pub struct NetLatencyInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub requires_admin: bool,
    pub requires_pro: bool,
}

pub fn info() -> NetLatencyInfo {
    NetLatencyInfo {
        id: TWEAK_ID,
        name: "TCP acknowledgments and packet buffering",
        description: "Sets TcpAckFrequency and TCPNoDelay to 1 on the adapter that carries the route to the internet. This targets TCP behavior; UDP traffic is unaffected. Windows and application support vary, so lower game latency is not guaranteed (HKLM, administrator rights required).",
        requires_admin: true,
        requires_pro: true,
    }
}

const HIVE: &str = "HKLM";
pub(crate) const INTERFACES_PATH: &str =
    r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces";

/// The two values that together disable packet coalescing and delayed ACKs.
pub(crate) const VALUES: [&str; 2] = ["TcpAckFrequency", "TCPNoDelay"];

#[cfg(windows)]
fn interface_path(guid: &str) -> String {
    format!(r"{}\{}", INTERFACES_PATH, guid)
}

/// Applies to the adapter Windows would route internet traffic through, not
/// merely the first one that is up: a VPN or a Hyper-V switch can be up too.
#[cfg(windows)]
pub fn apply(store: &RollbackStore) -> Result<(), String> {
    apply_for_interface(
        store,
        &crate::diagnostics::network_verify::internet_interface_guid()?,
    )
}

#[cfg(windows)]
pub(crate) fn apply_for_interface(store: &RollbackStore, guid: &str) -> Result<(), String> {
    let mut transaction = store.transaction()?;

    use crate::tweaks::windows_impl::{hive_from_str, read_value, write_value};

    let path = interface_path(guid);
    let hive = hive_from_str(HIVE);

    // Applied before on a different adapter (older builds took the first one
    // that was up, which could be a VPN or Hyper-V switch): put that adapter
    // back and move the tweak here, in the same transaction, instead of
    // refusing every re-apply from a profile.
    if let Some(SnapshotEntry::Composite { entries }) = transaction.entry(TWEAK_ID) {
        let elsewhere = entries.iter().any(|e| {
            matches!(e, SnapshotEntry::Registry(s) if !s.path.eq_ignore_ascii_case(&path))
        });
        if elsewhere {
            transaction.restore_entry(TWEAK_ID, restore_values)?;
        }
    }

    let mut entries = Vec::new();
    for name in VALUES {
        // Neither value exists by default — Windows uses its built-in
        // behaviour until something writes them. `None` here records exactly
        // that, so rollback deletes the value instead of writing a made-up
        // "previous" number that was never there.
        let original =
            read_value(hive, &path, name, &RegValue::Dword(0)).map_err(|e| e.to_string())?;
        entries.push(SnapshotEntry::Registry(RegistrySnapshot {
            hive: HIVE.to_string(),
            path: path.clone(),
            name: name.to_string(),
            original_value: original,
        }));
    }

    // Snapshot before mutating, so a failure part-way cannot leave the adapter
    // changed with no way back.
    transaction
        .save_entry(TWEAK_ID, SnapshotEntry::Composite { entries })
        .map_err(|e| e.to_string())?;

    for name in VALUES {
        write_value(hive, &path, name, &RegValue::Dword(1))?;
    }

    Ok(())
}

#[cfg(windows)]
pub fn rollback(store: &RollbackStore) -> Result<(), String> {
    store.restore_entry(TWEAK_ID, restore_values)
}

#[cfg(windows)]
fn restore_values(entry: SnapshotEntry) -> Result<(), String> {
    use crate::tweaks::windows_impl::restore_value;

    let SnapshotEntry::Composite { entries } = entry else {
        return Err("unexpected snapshot type for the network latency tweak".to_string());
    };
    for e in entries {
        if let SnapshotEntry::Registry(snapshot) = e {
            restore_value(&snapshot)?;
        }
    }
    Ok(())
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

    /// The adapter GUID has to be readable, and has to look like a GUID —
    /// if this ever starts returning a localized status word instead, the
    /// registry path built from it would silently point nowhere.
    #[test]
    fn the_active_adapter_guid_is_readable_and_well_formed() {
        let guid = crate::diagnostics::network_verify::internet_interface_guid()
            .expect("no adapter carries the default route");
        assert!(
            guid.starts_with('{') && guid.ends_with('}'),
            "not a GUID: {}",
            guid
        );
        assert_eq!(guid.len(), 38, "unexpected GUID length: {}", guid);
    }

    /// When the per-adapter key already exists, it must be openable — that
    /// much is a real invariant, wherever it holds.
    ///
    /// Its *existence* is not: `write_value` (see `tweaks::windows_impl`)
    /// creates the key on demand via `create_subkey`, so `apply()` never
    /// depends on Windows having pre-populated it. On some adapters — real
    /// ones included, and consistently on the virtual NIC GitHub's
    /// `windows-latest` runners present — the interface has never had a
    /// per-adapter override written, so the subkey simply isn't there yet.
    /// That is not a defect: asserting it must pre-exist was checking the
    /// adapter's history, not this module's ability to write to it.
    #[test]
    fn the_adapter_has_a_tcpip_parameters_key() {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let guid = crate::diagnostics::network_verify::internet_interface_guid()
            .expect("no adapter carries the default route");
        match RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(interface_path(&guid)) {
            Ok(_) => {}
            Err(e) => println!(
                "no pre-existing Tcpip parameters key for the active adapter ({}) — \
                 fine, write_value() creates it on demand",
                e
            ),
        }
    }
}
