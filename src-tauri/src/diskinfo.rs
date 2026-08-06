use serde::Serialize;
use sysinfo::{Disks, DiskKind};

#[derive(Serialize, Clone)]
pub struct DriveInfo {
    /// Drive letter without trailing separator, e.g. "C:".
    pub letter: String,
    pub media_type: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub is_system: bool,
}

/// Accepts only a bare drive designator ("C" or "C:") and returns it
/// normalized to "C:". Everything that touches a drive string downstream
/// interpolates it into a PowerShell command line or passes it to defrag as
/// an argument — both entry points are reachable from the webview via
/// `invoke`, so the string must be pinned to this exact shape *here* rather
/// than trusting the UI to only send values from `list_drives`.
pub fn validate_drive(drive: &str) -> Result<String, String> {
    let letter = drive.strip_suffix(':').unwrap_or(drive);
    let mut chars = letter.chars();
    match (chars.next(), chars.next()) {
        (Some(c), None) if c.is_ascii_alphabetic() => Ok(format!("{}:", c.to_ascii_uppercase())),
        _ => Err(format!("invalid drive designator: {:?}", drive)),
    }
}

fn disk_kind_str(kind: DiskKind) -> String {
    match kind {
        DiskKind::HDD => "HDD".to_string(),
        DiskKind::SSD => "SSD".to_string(),
        DiskKind::Unknown(_) => "Unknown".to_string(),
    }
}

/// Every fixed (non-removable) drive with a letter — network shares and
/// removable media (USB sticks, SD cards) are excluded, since neither
/// "optimize" nor a health check make sense for them, and defrag itself
/// would refuse a network path.
pub fn list_drives() -> Vec<DriveInfo> {
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    let disks = Disks::new_with_refreshed_list();

    let mut drives: Vec<DriveInfo> = disks
        .list()
        .iter()
        .filter(|d| !d.is_removable())
        .filter_map(|d| {
            let mount = d.mount_point().to_string_lossy().to_string();
            // Windows mount points look like "C:\\" — keep just the letter+colon.
            let letter = mount.trim_end_matches(['\\', '/']).to_string();
            if !letter.ends_with(':') {
                return None;
            }
            Some(DriveInfo {
                is_system: letter.eq_ignore_ascii_case(&system_drive),
                letter,
                media_type: disk_kind_str(d.kind()),
                total_bytes: d.total_space(),
                free_bytes: d.available_space(),
            })
        })
        .collect();

    // System drive first, then alphabetical — the one people care about by
    // default should never require scrolling a dropdown to find.
    drives.sort_by(|a, b| b.is_system.cmp(&a.is_system).then(a.letter.cmp(&b.letter)));
    drives
}

#[tauri::command]
pub fn list_drives_cmd() -> Vec<DriveInfo> {
    list_drives()
}

/// Shared by diskopt and diskhealth so both report the same media type for
/// the same drive without each shelling out or re-deriving it independently.
pub fn media_type_of(drive: &str) -> String {
    list_drives()
        .into_iter()
        .find(|d| d.letter.eq_ignore_ascii_case(drive))
        .map(|d| d.media_type)
        .unwrap_or_else(|| "Unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_letter_is_well_formed() {
        for d in list_drives() {
            assert!(d.letter.ends_with(':'), "malformed drive letter: {}", d.letter);
            assert_eq!(d.letter.len(), 2, "expected e.g. \"C:\", got: {}", d.letter);
        }
    }

    #[test]
    fn drive_validation_accepts_only_bare_designators() {
        assert_eq!(validate_drive("C:"), Ok("C:".to_string()));
        assert_eq!(validate_drive("c"), Ok("C:".to_string()));
        assert_eq!(validate_drive("d:"), Ok("D:".to_string()));
        // Everything below reaches either a PowerShell command line or the
        // elevated defrag helper if it gets through, so it must not.
        assert!(validate_drive("").is_err());
        assert!(validate_drive("CC:").is_err());
        assert!(validate_drive("C:\\").is_err());
        assert!(validate_drive("/L").is_err());
        assert!(validate_drive("C'; Remove-Item x; '").is_err());
        assert!(validate_drive("è:").is_err());
    }

    #[test]
    fn the_system_drive_is_always_present_and_sorted_first() {
        let drives = list_drives();
        assert!(!drives.is_empty(), "expected at least the system drive");
        assert!(drives[0].is_system, "the system drive must sort first");
        assert!(drives.iter().any(|d| d.is_system), "the system drive must be in the list");
    }
}
