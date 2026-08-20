//! Best-effort Windows System Restore point creation, called (elevated only)
//! right before an elevated system change executes.
//!
//! Design constraints, in order:
//! - **No shell.** `Checkpoint-Computer` would mean launching PowerShell;
//!   this module calls the native `SRSetRestorePointW` API instead.
//! - **No hard link-time dependency.** `srclient.dll` does not exist on
//!   Windows editions without System Restore (notably Windows Server), and a
//!   static import would crash the whole app at startup there. The DLL is
//!   loaded dynamically and its absence is just another honest failure.
//! - **Best effort, honestly reported.** Windows throttles restore points
//!   (one per 24h by default) and System Restore can be disabled entirely.
//!   Failure here must never block an action the user asked for — the
//!   caller surfaces the outcome in the report instead.
//!
//! The description written into the restore point is a compile-time constant:
//! no registry-derived text (program names are attacker-influencable) is ever
//! embedded in system state.

/// Outcome shown to the user in the action report. `Skipped` is used by
/// callers when the attempt was never made (not elevated, no elevation).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RestorePointOutcome {
    Created,
    Skipped { reason: String },
    Failed { reason: String },
}

#[cfg(windows)]
mod imp {
    use windows_sys::core::PCWSTR;
    use windows_sys::Win32::Foundation::{FreeLibrary, BOOL};
    use windows_sys::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

    const BEGIN_SYSTEM_CHANGE: u32 = 100;
    const APPLICATION_UNINSTALL: u32 = 1;
    /// `ERROR_SERVICE_DISABLED`: System Restore is turned off.
    const SERVICE_DISABLED: u32 = 1058;

    /// Mirrors `RESTOREPOINTINFOW` from sr.h. `#[repr(C)]` matches the SDK
    /// layout: the i64 lands at its natural 8-byte offset.
    #[repr(C)]
    struct RestorePointInfoW {
        event_type: u32,
        restore_pt_type: u32,
        sequence_number: i64,
        description: [u16; 256],
    }

    /// Mirrors `STATEMGRSTATUS` from sr.h.
    #[repr(C)]
    struct StateMgrStatus {
        status: u32,
        sequence_number: i64,
    }

    type SrSetRestorePointW =
        unsafe extern "system" fn(*const RestorePointInfoW, *mut StateMgrStatus) -> BOOL;

    pub fn create() -> Result<(), String> {
        // Fixed, compile-time description — see the module header for why no
        // program name is included.
        const DESCRIPTION: &str = "Before system change (PC Tweaker)";

        let dll_name: Vec<u16> = "srclient.dll\0".encode_utf16().collect();
        // SAFETY: `dll_name` is a valid NUL-terminated UTF-16 string that
        // outlives the call.
        let module = unsafe { LoadLibraryW(dll_name.as_ptr() as PCWSTR) };
        if module.is_null() {
            return Err("System Restore is not available on this Windows edition.".to_string());
        }

        // SAFETY: `module` is a live module handle; the proc name is a valid
        // NUL-terminated ANSI string.
        let proc = unsafe { GetProcAddress(module, c"SRSetRestorePointW".as_ptr() as *const u8) };
        let Some(proc) = proc else {
            // SAFETY: `module` came from LoadLibraryW above.
            unsafe { FreeLibrary(module) };
            return Err("SRSetRestorePointW was not found in srclient.dll.".to_string());
        };
        // SAFETY: the signature below matches the documented export.
        let set_restore_point = unsafe {
            std::mem::transmute::<unsafe extern "system" fn() -> isize, SrSetRestorePointW>(proc)
        };

        let mut description = [0u16; 256];
        for (slot, unit) in description
            .iter_mut()
            .zip(DESCRIPTION.encode_utf16().take(255))
        {
            *slot = unit;
        }

        let info = RestorePointInfoW {
            event_type: BEGIN_SYSTEM_CHANGE,
            restore_pt_type: APPLICATION_UNINSTALL,
            sequence_number: 0,
            description,
        };
        let mut status = StateMgrStatus {
            status: 0,
            sequence_number: 0,
        };

        // SAFETY: both pointers reference live, correctly-shaped structs for
        // the duration of the call.
        let ok = unsafe { set_restore_point(&info, &mut status) };
        // SAFETY: `module` came from LoadLibraryW above.
        unsafe { FreeLibrary(module) };

        if ok != 0 {
            Ok(())
        } else if status.status == SERVICE_DISABLED {
            Err("System Restore is disabled on this system.".to_string())
        } else {
            Err(format!(
                "Windows refused to create a restore point (status {}).",
                status.status
            ))
        }
    }
}

/// Attempts to create a restore point. Requires elevation; callers that are
/// not elevated should report `Skipped` instead of calling this.
pub fn create_restore_point() -> RestorePointOutcome {
    #[cfg(windows)]
    {
        match imp::create() {
            Ok(()) => RestorePointOutcome::Created,
            Err(reason) => RestorePointOutcome::Failed { reason },
        }
    }
    #[cfg(not(windows))]
    {
        RestorePointOutcome::Failed {
            reason: "System Restore only exists on Windows.".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn outcome_serializes_with_a_kind_tag_for_the_ui() {
        let json = serde_json::to_value(RestorePointOutcome::Skipped {
            reason: "not elevated".to_string(),
        })
        .unwrap();
        assert_eq!(json["kind"], "skipped");
        assert_eq!(json["reason"], "not elevated");

        let created = serde_json::to_value(RestorePointOutcome::Created).unwrap();
        assert_eq!(created["kind"], "created");
    }

    #[test]
    fn outcome_round_trips_through_the_report_file_format() {
        let original = RestorePointOutcome::Failed {
            reason: "System Restore is disabled on this system.".to_string(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let back: RestorePointOutcome = serde_json::from_str(&json).unwrap();
        assert_eq!(back, original);
    }
}
