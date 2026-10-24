//! Best-effort Windows System Restore point, requested (elevated only) right
//! before an elevated system change executes, and what that request really
//! produced.
//!
//! Design constraints, in order:
//! - **No shell.** `Checkpoint-Computer` would mean launching PowerShell;
//!   this module calls the native `SRSetRestorePointW` API and reads the
//!   points back through WMI instead.
//! - **No hard link-time dependency.** `srclient.dll` does not exist on
//!   Windows editions without System Restore (notably Windows Server), and a
//!   static import would crash the whole app at startup there. The DLL is
//!   loaded dynamically and its absence is just another honest failure.
//! - **"Success" from Windows is not a new restore point.** Windows makes at
//!   most one point per `SystemRestorePointCreationFrequency` (24 hours by
//!   default); inside that window `SRSetRestorePointW` returns success and
//!   creates nothing. So the newest point is read before and after the
//!   request, and only a higher sequence number made during this operation
//!   counts as created. The policy value is never changed to force a point.
//! - **Best effort, honestly reported.** Failure here must never block an
//!   action the user asked for — the caller records the outcome instead.
//!
//! The description written into the restore point is a compile-time constant:
//! no registry-derived text (program names are attacker-influencable) is ever
//! embedded in system state. Same logic as PC Tweaker Uninstaller's module.

/// What the request really produced. `Skipped` is used by callers when the
/// attempt was never made (not elevated, no elevation). Times are Unix
/// seconds.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RestorePointOutcome {
    /// A new point: a higher sequence number than before the request, made
    /// during this operation.
    Created {
        at: u64,
    },
    /// Windows accepted the request and kept its newest existing point.
    Reused {
        at: u64,
    },
    /// Windows accepted the request, but the points could not be read back,
    /// so whether a new one exists is unknown.
    Unverified {
        reason: String,
    },
    Skipped {
        reason: String,
    },
    Failed {
        reason: String,
    },
}

impl RestorePointOutcome {
    /// One English line for the audit log's detail.
    pub fn detail(&self) -> String {
        match self {
            Self::Created { at } => format!("created {}", utc(*at)),
            Self::Reused { at } => format!(
                "not created: Windows reused the restore point from {}",
                utc(*at)
            ),
            Self::Unverified { reason } => format!("not verified: {reason}"),
            Self::Skipped { reason } | Self::Failed { reason } => reason.clone(),
        }
    }
}

/// The newest restore point Windows lists.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Newest {
    pub sequence: u32,
    pub created_at: u64,
}

/// Clock granularity between this process and the System Restore service.
const SLACK_S: u64 = 5;

/// The decision, kept pure so it is tested with recorded readings. `before`
/// and `after` are the newest point listed around the request; `started` and
/// `finished` bound the operation.
pub fn verdict(
    before: Result<Option<Newest>, String>,
    request: Result<(), String>,
    after: Result<Option<Newest>, String>,
    started: u64,
    finished: u64,
) -> RestorePointOutcome {
    if let Err(reason) = request {
        return RestorePointOutcome::Failed { reason };
    }
    let (before, after) = match (before, after) {
        (Ok(before), Ok(after)) => (before, after),
        (Err(e), _) | (_, Err(e)) => {
            return RestorePointOutcome::Unverified {
                reason: format!("the restore points could not be read: {e}"),
            }
        }
    };
    let Some(after) = after else {
        return RestorePointOutcome::Failed {
            reason: "Windows reported success, but lists no restore point.".to_string(),
        };
    };
    let higher = before.is_none_or(|b| after.sequence > b.sequence);
    let during = after.created_at + SLACK_S >= started && after.created_at <= finished + SLACK_S;
    if higher && during {
        RestorePointOutcome::Created {
            at: after.created_at,
        }
    } else {
        RestorePointOutcome::Reused {
            at: after.created_at,
        }
    }
}

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Days since 1970-01-01 for a proleptic Gregorian date (H. Hinnant).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// "2026-10-23 18:28:41 UTC", for the audit detail.
fn utc(ts: u64) -> String {
    let days = (ts / 86_400) as i64;
    let secs = ts % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02} {:02}:{:02}:{:02} UTC",
        secs / 3600,
        secs % 3600 / 60,
        secs % 60
    )
}

fn digits(s: &str, range: std::ops::Range<usize>) -> Option<i64> {
    let part = s.get(range)?;
    if !part.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    part.parse().ok()
}

/// WMI's CIM_DATETIME, "yyyymmddHHMMSS.mmmmmmsUUU" with UUU the offset from
/// UTC in minutes, as Unix seconds.
pub fn parse_cim_datetime(s: &str) -> Option<u64> {
    let b = s.as_bytes();
    if b.len() != 25 || b[14] != b'.' || !matches!(b[21], b'+' | b'-') {
        return None;
    }
    let (y, mo, d) = (digits(s, 0..4)?, digits(s, 4..6)?, digits(s, 6..8)?);
    let (h, mi, se) = (digits(s, 8..10)?, digits(s, 10..12)?, digits(s, 12..14)?);
    let valid = (1..=12).contains(&mo)
        && (1..=31).contains(&d)
        && (0..24).contains(&h)
        && (0..60).contains(&mi)
        && (0..=60).contains(&se);
    if !valid {
        return None;
    }
    let local = days_from_civil(y, mo, d) * 86_400 + h * 3600 + mi * 60 + se;
    let offset = digits(s, 22..25)? * if b[21] == b'-' { -1 } else { 1 };
    u64::try_from(local - offset * 60).ok()
}

#[cfg(windows)]
mod imp {
    use super::Newest;
    use windows::core::{w, IUnknown, Param, BSTR, HRESULT, PCWSTR, VARIANT};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoSetProxyBlanket, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_MULTITHREADED, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL, RPC_C_IMP_LEVEL_IMPERSONATE,
    };
    use windows::Win32::System::Wmi::{
        IEnumWbemClassObject, IWbemLocator, IWbemServices, WbemLocator, WBEM_FLAG_FORWARD_ONLY,
        WBEM_FLAG_RETURN_IMMEDIATELY, WBEM_GENERIC_FLAG_TYPE,
    };
    use windows_sys::Win32::Foundation::{FreeLibrary, BOOL};
    use windows_sys::Win32::System::LibraryLoader::{
        GetProcAddress, LoadLibraryExW, LOAD_LIBRARY_SEARCH_SYSTEM32,
    };

    const BEGIN_SYSTEM_CHANGE: u32 = 100;
    const END_SYSTEM_CHANGE: u32 = 101;
    const APPLICATION_UNINSTALL: u32 = 1;
    /// `ERROR_SERVICE_DISABLED`: System Restore is turned off.
    const SERVICE_DISABLED: u32 = 1058;
    /// `ERROR_DISK_FULL`: System Restore is in standby for lack of space.
    const DISK_FULL: u32 = 112;
    // From rpcdce.h and winerror.h/wbemcli.h.
    const RPC_C_AUTHN_WINNT: u32 = 10;
    const RPC_C_AUTHZ_NONE: u32 = 0;
    const RPC_E_CHANGED_MODE: HRESULT = HRESULT(0x8001_0106_u32 as i32);
    const WBEM_S_TIMEDOUT: HRESULT = HRESULT(0x0004_0004);
    /// A provider that stops answering must not hang the change.
    const TIMEOUT_MS: i32 = 30_000;

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

    /// Asks Windows for a point. `Ok` only means Windows accepted the
    /// request; whether a point was made is read back separately.
    pub fn request() -> Result<(), String> {
        // Fixed, compile-time description — see the module header for why no
        // program name is included.
        const DESCRIPTION: &str = "Before system change (PC Tweaker)";

        let dll_name: Vec<u16> = "srclient.dll\0".encode_utf16().collect();
        // SAFETY: `dll_name` is a valid NUL-terminated UTF-16 string that
        // outlives the call.
        let module = unsafe {
            LoadLibraryExW(
                dll_name.as_ptr(),
                std::ptr::null_mut(),
                LOAD_LIBRARY_SEARCH_SYSTEM32,
            )
        };
        if module.is_null() {
            return Err("System Restore is not available on this Windows edition.".to_string());
        }

        // SAFETY: `module` is a live module handle; the proc name is a valid
        // NUL-terminated ANSI string.
        let proc = unsafe { GetProcAddress(module, c"SRSetRestorePointW".as_ptr() as *const u8) };
        let Some(proc) = proc else {
            // SAFETY: `module` came from LoadLibraryExW above.
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
        if ok != 0 {
            // The documented pairing: close the change the begin call opened,
            // by its sequence number, so Windows finalises the restore point.
            let end = RestorePointInfoW {
                event_type: END_SYSTEM_CHANGE,
                restore_pt_type: 0,
                sequence_number: status.sequence_number,
                description: [0u16; 256],
            };
            let mut end_status = StateMgrStatus {
                status: 0,
                sequence_number: 0,
            };
            // SAFETY: as above, both structs live for the duration of the call.
            unsafe { set_restore_point(&end, &mut end_status) };
        }
        // SAFETY: `module` came from LoadLibraryExW above.
        unsafe { FreeLibrary(module) };

        match (ok != 0, status.status) {
            (true, _) => Ok(()),
            (false, SERVICE_DISABLED) => Err("System Restore is disabled on this system.".into()),
            (false, DISK_FULL) => {
                Err("There is not enough free disk space for a restore point.".into())
            }
            (false, code) => Err(format!(
                "Windows refused to create a restore point (status {code})."
            )),
        }
    }

    /// WMI's own codes (0x8004xxxx) carry no system message.
    fn wmi_failed(e: windows::core::Error) -> String {
        match e.code().0 as u32 {
            0x8004_1003 => "access denied (administrator rights needed)".to_string(),
            code if e.message().is_empty() => format!("WMI error {code:#010x}"),
            code => format!("{} ({code:#010x})", e.message()),
        }
    }

    /// COM on the calling thread for one read. A thread already in a
    /// single-threaded apartment keeps it (RPC_E_CHANGED_MODE): COM works
    /// there too, and that initialisation is not ours to undo.
    struct Com(bool);

    impl Drop for Com {
        fn drop(&mut self) {
            if self.0 {
                // SAFETY: balances the successful CoInitializeEx in `newest`,
                // on the same thread.
                unsafe { CoUninitialize() };
            }
        }
    }

    /// WMI proxies must impersonate the caller; the default blanket only
    /// identifies it. The blanket belongs to one proxy, so it is set on each.
    fn impersonate(proxy: impl Param<IUnknown>) -> Result<(), String> {
        // SAFETY: `proxy` is a live COM proxy; no principal or auth info.
        unsafe {
            CoSetProxyBlanket(
                proxy,
                RPC_C_AUTHN_WINNT,
                RPC_C_AUTHZ_NONE,
                PCWSTR::null(),
                RPC_C_AUTHN_LEVEL_CALL,
                RPC_C_IMP_LEVEL_IMPERSONATE,
                None,
                EOAC_NONE,
            )
        }
        .map_err(wmi_failed)
    }

    /// The highest-numbered point in `ROOT\DEFAULT:SystemRestore`. Needs
    /// administrator rights (a standard token gets access denied).
    pub fn newest() -> Result<Option<Newest>, String> {
        // SAFETY: no reserved pointer; balanced by `Com` when it succeeded.
        let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        let _com = if hr == RPC_E_CHANGED_MODE {
            Com(false)
        } else {
            hr.ok().map_err(wmi_failed)?;
            Com(true)
        };
        // SAFETY: COM is initialised on this thread while `_com` lives, and
        // every interface below is released before it (declared later).
        let services: IWbemServices = unsafe {
            let locator: IWbemLocator =
                CoCreateInstance(&WbemLocator, None, CLSCTX_INPROC_SERVER).map_err(wmi_failed)?;
            locator.ConnectServer(
                &BSTR::from(r"ROOT\DEFAULT"),
                &BSTR::new(),
                &BSTR::new(),
                &BSTR::new(),
                0,
                &BSTR::new(),
                None,
            )
        }
        .map_err(wmi_failed)?;
        impersonate(&services)?;
        // SAFETY: both BSTRs outlive the call.
        let rows: IEnumWbemClassObject = unsafe {
            services.ExecQuery(
                &BSTR::from("WQL"),
                &BSTR::from("SELECT SequenceNumber, CreationTime FROM SystemRestore"),
                WBEM_GENERIC_FLAG_TYPE(WBEM_FLAG_FORWARD_ONLY.0 | WBEM_FLAG_RETURN_IMMEDIATELY.0),
                None,
            )
        }
        .map_err(wmi_failed)?;
        impersonate(&rows)?;

        let mut newest: Option<Newest> = None;
        loop {
            let mut row = [None];
            let mut returned = 0u32;
            // SAFETY: `row` has room for the one object asked for and takes
            // ownership of it; `returned` is a live out-parameter.
            let hr = unsafe { rows.Next(TIMEOUT_MS, &mut row, &mut returned) };
            if hr == WBEM_S_TIMEDOUT {
                return Err("WMI did not answer in time".to_string());
            }
            hr.ok().map_err(wmi_failed)?;
            let [Some(point)] = row else { break };
            if returned == 0 {
                break;
            }
            let mut sequence = VARIANT::new();
            let mut created = VARIANT::new();
            // SAFETY: `point` is a live instance; the VARIANTs are live
            // out-parameters that own what they receive.
            unsafe {
                point
                    .Get(w!("SequenceNumber"), 0, &mut sequence, None, None)
                    .map_err(wmi_failed)?;
                point
                    .Get(w!("CreationTime"), 0, &mut created, None, None)
                    .map_err(wmi_failed)?;
            }
            let sequence = u32::try_from(&sequence)
                .map_err(|_| "a restore point has no sequence number".to_string())?;
            let created_at = BSTR::try_from(&created)
                .ok()
                .and_then(|t| super::parse_cim_datetime(&t.to_string()))
                .ok_or_else(|| "a restore point has an unreadable creation time".to_string())?;
            if newest.is_none_or(|n| sequence > n.sequence) {
                newest = Some(Newest {
                    sequence,
                    created_at,
                });
            }
        }
        Ok(newest)
    }
}

/// Requests a restore point and reports what really happened. Requires
/// elevation; callers that are not elevated should report `Skipped` instead.
pub fn create_restore_point() -> RestorePointOutcome {
    #[cfg(windows)]
    {
        let before = imp::newest();
        let started = now();
        let request = imp::request();
        let after = match &request {
            Ok(()) => imp::newest(),
            Err(_) => Ok(None),
        };
        verdict(before, request, after, started, now())
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

    /// 2026-10-23 18:28:41 UTC: a Windows Update point recorded on the
    /// development PC on 24 Oct 2026.
    const WU: u64 = 1_792_780_121;

    fn point(sequence: u32, created_at: u64) -> Result<Option<Newest>, String> {
        Ok(Some(Newest {
            sequence,
            created_at,
        }))
    }

    #[test]
    fn a_higher_sequence_made_during_the_request_is_created() {
        let start = WU + 86_460;
        let outcome = verdict(
            point(166, WU),
            Ok(()),
            point(167, start + 12),
            start,
            start + 30,
        );
        assert_eq!(outcome, RestorePointOutcome::Created { at: start + 12 });
        let first = verdict(Ok(None), Ok(()), point(1, WU + 3), WU, WU + 20);
        assert_eq!(first, RestorePointOutcome::Created { at: WU + 3 });
    }

    #[test]
    fn success_without_a_new_point_is_reused_never_created() {
        let start = WU + 3600;
        let same = verdict(point(166, WU), Ok(()), point(166, WU), start, start + 2);
        assert_eq!(same, RestorePointOutcome::Reused { at: WU });
        let old = verdict(Ok(None), Ok(()), point(166, WU), start, start + 2);
        assert_eq!(old, RestorePointOutcome::Reused { at: WU });
        let late = verdict(
            point(1, WU),
            Ok(()),
            point(2, start + 600),
            start,
            start + 2,
        );
        assert_eq!(late, RestorePointOutcome::Reused { at: start + 600 });
    }

    #[test]
    fn errors_and_unreadable_points_never_count_as_created() {
        let denied = || Err("Access denied (0x80041003)".to_string());
        assert!(matches!(
            verdict(denied(), Ok(()), point(167, WU), WU, WU + 2),
            RestorePointOutcome::Unverified { .. }
        ));
        assert!(matches!(
            verdict(point(166, WU - 9), Ok(()), denied(), WU, WU + 2),
            RestorePointOutcome::Unverified { .. }
        ));
        assert!(matches!(
            verdict(Ok(None), Ok(()), Ok(None), WU, WU + 2),
            RestorePointOutcome::Failed { .. }
        ));
        assert_eq!(
            verdict(point(166, WU), Err("off".into()), Ok(None), WU, WU + 1),
            RestorePointOutcome::Failed {
                reason: "off".into()
            }
        );
    }

    #[test]
    fn cim_datetimes_parse_with_their_offset() {
        assert_eq!(parse_cim_datetime("20261023182841.996491-000"), Some(WU));
        assert_eq!(parse_cim_datetime("20261023202841.000000+120"), Some(WU));
        assert_eq!(parse_cim_datetime("20261023172841.000000-060"), Some(WU));
        assert_eq!(
            parse_cim_datetime("20000229120000.000000+000"),
            Some(951_825_600)
        );
        for bad in [
            "",
            "20261323182841.996491-000",
            "2026+023182841.996491-000",
            "20261023182841.996491*000",
            "19691231235959.000000+000",
        ] {
            assert_eq!(parse_cim_datetime(bad), None, "{bad}");
        }
    }

    #[test]
    fn details_never_say_created_for_a_reused_point() {
        assert_eq!(
            RestorePointOutcome::Reused { at: WU }.detail(),
            "not created: Windows reused the restore point from 2026-10-23 18:28:41 UTC"
        );
        assert_eq!(
            RestorePointOutcome::Created { at: 951_825_600 }.detail(),
            "created 2000-02-29 12:00:00 UTC"
        );
    }

    #[test]
    fn outcome_serializes_with_a_kind_tag() {
        let json = serde_json::to_value(RestorePointOutcome::Reused { at: WU }).unwrap();
        assert_eq!(json, serde_json::json!({"kind": "reused", "at": WU}));
    }
}
