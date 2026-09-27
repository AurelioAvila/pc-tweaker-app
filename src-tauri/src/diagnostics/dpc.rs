//! DPC and ISR latency, measured by the kernel and attributed to the driver
//! whose routine ran.
//!
//! A private system-logger ETW session (Windows 8 and later) enables the
//! kernel's `DPC` and `INTERRUPT` events. Each event is written when the
//! routine returns and carries the QPC time it started (`InitialTime`), so
//! `TimeStamp - InitialTime` is how long that one DPC or interrupt service
//! routine ran. The session uses the raw QPC clock end to end: without
//! `PROCESS_TRACE_MODE_RAW_TIMESTAMP`, ETW would convert the header stamp to
//! FILETIME and the subtraction would mix two clocks.
//!
//! Durations are judged against Microsoft's driver guidance: "DPCs should not
//! run longer than 100 microseconds and ISRs should not run longer than 25
//! microseconds" (Bug Check 0x133 and debugger Example 15). Crossing those is
//! not a crash; it is the audio crackle and frame-time spike territory that
//! LatencyMon-style tools report.
//!
//! Routine addresses are resolved to drivers with `EnumDeviceDrivers`. Windows
//! 11 24H2 returns zeroed kernel addresses to that API unless SeDebugPrivilege
//! is enabled, so it is enabled first; an administrator's token already holds
//! it. Anything that still cannot be resolved is reported as unattributed
//! rather than guessed.
//!
//! Starting any kernel session requires administrator rights. The command
//! runs the capture in-process when PC Tweaker is already elevated, and
//! otherwise through one UAC prompt to the headless helper, which writes the
//! report to a file and exits. It changes nothing on the system, so the helper
//! skips the restore point every other elevated action creates.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

pub const MIN_SECONDS: u32 = 5;
pub const MAX_SECONDS: u32 = 30;
pub const DPC_LIMIT_US: f64 = 100.0;
pub const ISR_LIMIT_US: f64 = 25.0;
pub const ELEVATED_FLAG: &str = "--elevated-dpc-trace";
const RESULT_FILE: &str = "last_dpc_trace.json";
const WORST_KEPT: usize = 10;
/// A routine further than this above the nearest driver base is not
/// attributed to it. `EnumDeviceDrivers` reports bases but not sizes, and the
/// largest drivers (display drivers) stay well under this.
// ponytail: nearest-base heuristic; ETW Image rundown events carry real sizes if this ever misattributes.
const MAX_DRIVER_SPAN: u64 = 512 << 20;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Dpc,
    Isr,
}

impl Kind {
    fn limit_us(self) -> f64 {
        match self {
            Kind::Dpc => DPC_LIMIT_US,
            Kind::Isr => ISR_LIMIT_US,
        }
    }
}

/// PerfInfo opcodes: ThreadedDPC 66, DPC 68, TimerDPC 69, IoTimer 70; ISR 67,
/// ISR-PASS 95 and ISR-MSI 50. All start with `InitialTime` then `Routine`.
pub fn classify(opcode: u8) -> Option<Kind> {
    match opcode {
        66 | 68 | 69 | 70 => Some(Kind::Dpc),
        50 | 67 | 95 => Some(Kind::Isr),
        _ => None,
    }
}

/// `(InitialTime, Routine)` from an event payload. The layout is packed:
/// `InitialTime` is a u64 at 0 and `Routine` a pointer at 8, whose width the
/// event header states. Anything shorter than that is ignored.
pub fn parse(payload: &[u8], pointer_size: usize) -> Option<(i64, u64)> {
    let initial = i64::from_le_bytes(payload.get(0..8)?.try_into().ok()?);
    let routine = match pointer_size {
        4 => u64::from(u32::from_le_bytes(payload.get(8..12)?.try_into().ok()?)),
        _ => u64::from_le_bytes(payload.get(8..16)?.try_into().ok()?),
    };
    Some((initial, routine))
}

#[derive(Default, Clone, Copy)]
struct RoutineStat {
    count: u64,
    total_ticks: u64,
    max_ticks: u64,
    over_limit: u64,
}

#[derive(Clone, Copy)]
struct Worst {
    kind: Kind,
    routine: u64,
    ticks: u64,
    at_qpc: i64,
}

/// What the ETW callback accumulates: per routine, never per event, so a
/// thirty-second capture at tens of thousands of events a second stays small.
pub struct Tally {
    qpc_hz: i64,
    first_qpc: Option<i64>,
    routines: HashMap<(Kind, u64), RoutineStat>,
    worst: Vec<Worst>,
    /// Events whose start time was after their end time, which only a clock
    /// problem can produce. Counted, not measured.
    skewed: u64,
}

impl Tally {
    pub fn new(qpc_hz: i64) -> Self {
        Tally {
            qpc_hz: qpc_hz.max(1),
            first_qpc: None,
            routines: HashMap::new(),
            worst: Vec::with_capacity(WORST_KEPT + 1),
            skewed: 0,
        }
    }

    fn us(&self, ticks: u64) -> f64 {
        ticks as f64 * 1_000_000.0 / self.qpc_hz as f64
    }

    pub fn record(&mut self, kind: Kind, routine: u64, initial_qpc: i64, end_qpc: i64) {
        let Some(ticks) = end_qpc.checked_sub(initial_qpc).filter(|t| *t >= 0) else {
            self.skewed += 1;
            return;
        };
        let ticks = ticks as u64;
        self.first_qpc = Some(self.first_qpc.map_or(initial_qpc, |f| f.min(initial_qpc)));
        let over = self.us(ticks) > kind.limit_us();
        let stat = self.routines.entry((kind, routine)).or_default();
        stat.count += 1;
        stat.total_ticks = stat.total_ticks.saturating_add(ticks);
        stat.max_ticks = stat.max_ticks.max(ticks);
        stat.over_limit += u64::from(over);
        if self.worst.len() < WORST_KEPT || self.worst.last().is_some_and(|w| ticks > w.ticks) {
            let at = self.worst.partition_point(|w| w.ticks >= ticks);
            self.worst.insert(
                at,
                Worst {
                    kind,
                    routine,
                    ticks,
                    at_qpc: initial_qpc,
                },
            );
            self.worst.truncate(WORST_KEPT);
        }
    }

    pub fn report(&self, seconds: u32, drivers: &[(u64, String)], lost: LostEvents) -> DpcReport {
        let mut sorted: Vec<&(u64, String)> = drivers.iter().filter(|(b, _)| *b != 0).collect();
        sorted.sort_by_key(|(base, _)| *base);
        let name_of = |routine: u64| -> Option<String> {
            let at = sorted.partition_point(|(base, _)| *base <= routine);
            let (base, name) = sorted.get(at.checked_sub(1)?)?;
            (routine - base < MAX_DRIVER_SPAN).then(|| name.clone())
        };
        let mut per_driver: HashMap<Option<String>, DriverLatency> = HashMap::new();
        let mut totals = [KindTotals::new(Kind::Dpc), KindTotals::new(Kind::Isr)];
        for ((kind, routine), stat) in &self.routines {
            let name = name_of(*routine);
            let entry = per_driver.entry(name.clone()).or_insert_with(|| DriverLatency {
                driver: name,
                ..DriverLatency::default()
            });
            let side = match kind {
                Kind::Dpc => &mut entry.dpc,
                Kind::Isr => &mut entry.isr,
            };
            side.add(stat, self.us(stat.max_ticks), self.us(stat.total_ticks));
            let total = &mut totals[usize::from(*kind == Kind::Isr)];
            total.count += stat.count;
            total.over_limit += stat.over_limit;
            total.max_us = total.max_us.max(self.us(stat.max_ticks));
        }
        let mut drivers: Vec<DriverLatency> = per_driver.into_values().collect();
        drivers.sort_by(|a, b| b.severity().total_cmp(&a.severity()));
        let first = self.first_qpc.unwrap_or(0);
        let [dpc, isr] = totals;
        DpcReport {
            seconds,
            dpc,
            isr,
            drivers,
            worst: self
                .worst
                .iter()
                .map(|w| Spike {
                    kind: w.kind,
                    driver: name_of(w.routine),
                    duration_us: self.us(w.ticks),
                    at_ms: self.us(w.at_qpc.saturating_sub(first).max(0) as u64) / 1000.0,
                })
                .collect(),
            events_lost: lost.events,
            buffers_lost: lost.buffers,
            skewed_events: self.skewed,
            drivers_resolved: !sorted.is_empty(),
        }
    }
}

#[derive(Default, Clone, Copy, Debug)]
pub struct LostEvents {
    pub events: u32,
    pub buffers: u32,
}

/// Mirrors `KindTotals` in src/types.ts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KindTotals {
    pub kind: Kind,
    pub count: u64,
    pub max_us: f64,
    /// Routines that ran past `limit_us`.
    pub over_limit: u64,
    pub limit_us: f64,
}

impl KindTotals {
    fn new(kind: Kind) -> Self {
        KindTotals {
            kind,
            count: 0,
            max_us: 0.0,
            over_limit: 0,
            limit_us: kind.limit_us(),
        }
    }
}

/// Mirrors `RoutineTotals` in src/types.ts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct RoutineTotals {
    pub count: u64,
    pub max_us: f64,
    pub total_us: f64,
    pub over_limit: u64,
}

impl RoutineTotals {
    fn add(&mut self, stat: &RoutineStat, max_us: f64, total_us: f64) {
        self.count += stat.count;
        self.max_us = self.max_us.max(max_us);
        self.total_us += total_us;
        self.over_limit += stat.over_limit;
    }
}

/// Mirrors `DriverLatency` in src/types.ts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct DriverLatency {
    /// File name such as `nvlddmkm.sys`; `None` when the address matched no
    /// loaded driver.
    pub driver: Option<String>,
    pub dpc: RoutineTotals,
    pub isr: RoutineTotals,
}

impl DriverLatency {
    /// How far past its own limit this driver's worst routine went.
    fn severity(&self) -> f64 {
        (self.dpc.max_us / DPC_LIMIT_US).max(self.isr.max_us / ISR_LIMIT_US)
    }
}

/// Mirrors `LatencySpike` in src/types.ts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Spike {
    pub kind: Kind,
    pub driver: Option<String>,
    pub duration_us: f64,
    /// Milliseconds after the first event of the capture.
    pub at_ms: f64,
}

/// Mirrors `DpcReport` in src/types.ts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DpcReport {
    pub seconds: u32,
    pub dpc: KindTotals,
    pub isr: KindTotals,
    /// Worst offender first, ranked by how far past its limit it went.
    pub drivers: Vec<DriverLatency>,
    /// The longest single routines of the capture, longest first.
    pub worst: Vec<Spike>,
    /// Events the kernel could not deliver. Non-zero means the maxima are a
    /// lower bound, not the whole story.
    pub events_lost: u32,
    pub buffers_lost: u32,
    pub skewed_events: u64,
    /// False when Windows returned no driver addresses at all, in which case
    /// every routine shows as unattributed.
    pub drivers_resolved: bool,
}

pub fn clamp_seconds(seconds: u32) -> u32 {
    seconds.clamp(MIN_SECONDS, MAX_SECONDS)
}

/// What the helper hands back through `RESULT_FILE`. The helper has no
/// console, so an error that is not written here is an error nobody sees.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum HelperOutcome {
    Report(DpcReport),
    Error(String),
}

/// The helper side of a non-elevated request: capture, write, exit code.
#[cfg(windows)]
pub fn run_elevated(app_data_dir: &Path, seconds: &str) -> i32 {
    let outcome = match seconds
        .parse::<u32>()
        .map_err(|_| "invalid capture length".to_string())
        .and_then(|s| native::capture(clamp_seconds(s)))
    {
        Ok(report) => HelperOutcome::Report(report),
        Err(error) => HelperOutcome::Error(error),
    };
    let code = i32::from(matches!(outcome, HelperOutcome::Error(_)));
    let written = serde_json::to_vec(&outcome)
        .map_err(|e| e.to_string())
        .and_then(|json| {
            std::fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
            std::fs::write(app_data_dir.join(RESULT_FILE), json).map_err(|e| e.to_string())
        });
    if written.is_err() {
        return 1;
    }
    code
}

#[cfg(windows)]
fn capture_via_helper(app_data_dir: &Path, seconds: u32) -> Result<DpcReport, String> {
    let file = app_data_dir.join(RESULT_FILE);
    // A report left from an earlier run must never be mistaken for this one.
    let _ = std::fs::remove_file(&file);
    let launched = crate::elevation::run_elevated_action(ELEVATED_FLAG, &seconds.to_string());
    let outcome = std::fs::read(&file)
        .ok()
        .and_then(|raw| serde_json::from_slice::<HelperOutcome>(&raw).ok());
    let _ = std::fs::remove_file(&file);
    match outcome {
        Some(HelperOutcome::Report(report)) => Ok(report),
        Some(HelperOutcome::Error(error)) => Err(error),
        None => Err(launched
            .err()
            .unwrap_or_else(|| "the latency capture produced no report".to_string())),
    }
}

/// One capture per PC Tweaker process, whichever path it takes: a panel that
/// was closed and reopened must not start a second one beside the first.
static CAPTURING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Captures DPC and ISR execution times for 5 to 30 seconds. Changes nothing;
/// needs administrator rights, asked for once if the app is not elevated.
#[tauri::command]
pub async fn trace_dpc_latency(app: tauri::AppHandle, seconds: u32) -> Result<DpcReport, String> {
    let seconds = clamp_seconds(seconds);
    #[cfg(windows)]
    {
        use std::sync::atomic::Ordering;
        let dir = crate::store_for_dir(&app)?;
        if CAPTURING.swap(true, Ordering::AcqRel) {
            return Err("a latency capture is already running".into());
        }
        let result = tauri::async_runtime::spawn_blocking(move || {
            if crate::elevation::is_elevated() {
                native::capture(seconds)
            } else {
                capture_via_helper(&dir, seconds)
            }
        })
        .await
        .map_err(|e| format!("the latency capture did not finish: {e}"))
        .and_then(|inner| inner);
        CAPTURING.store(false, Ordering::Release);
        result
    }
    #[cfg(not(windows))]
    {
        let _ = (app, seconds);
        Err("not supported on this platform".to_string())
    }
}

#[cfg(windows)]
pub(crate) mod native {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;
    use std::time::Duration;
    use windows_sys::core::GUID;
    use windows_sys::Win32::System::Diagnostics::Etw::*;
    use windows_sys::Win32::System::Performance::QueryPerformanceFrequency;
    use windows_sys::Win32::System::ProcessStatus::{
        K32EnumDeviceDrivers, K32GetDeviceDriverBaseNameW,
    };

    const SESSION_NAME: &str = "PCTweakerDpcLatency";
    /// A GUID of our own for the session: a system logger must not use
    /// SystemTraceControlGuid unless it is the NT Kernel Logger itself.
    const SESSION_GUID: GUID = GUID::from_u128(0x6b0f_2c3a_8e1d_4f57_9a64_3d2b7c1e5f90);
    const ERROR_ACCESS_DENIED: u32 = 5;
    const ERROR_NO_SYSTEM_RESOURCES: u32 = 1450;
    const ERROR_CANCELLED: u32 = 1223;
    /// Held for the whole capture by whichever process runs it (the GUI or
    /// a helper), so two can never share the session name.
    const MUTEX_NAME: &str = "Global\\PCTweakerDpcLatency";

    static RUNNING: AtomicBool = AtomicBool::new(false);

    struct Held(windows_sys::Win32::Foundation::HANDLE);

    impl Drop for Held {
        fn drop(&mut self) {
            // SAFETY: owned mutex handle, released and closed exactly once.
            unsafe {
                windows_sys::Win32::System::Threading::ReleaseMutex(self.0);
                windows_sys::Win32::Foundation::CloseHandle(self.0);
            }
        }
    }

    /// `None` when another process already holds the capture.
    fn take_capture_mutex() -> Result<Option<Held>, String> {
        use windows_sys::Win32::Foundation::{
            CloseHandle, GetLastError, ERROR_ALREADY_EXISTS,
        };
        use windows_sys::Win32::System::Threading::CreateMutexW;
        let name = wide(MUTEX_NAME);
        // SAFETY: default security, initial ownership, nul-terminated name.
        let handle = unsafe { CreateMutexW(std::ptr::null(), 1, name.as_ptr()) };
        if handle.is_null() {
            return Err("could not coordinate the latency capture".into());
        }
        // SAFETY: read straight after the call it describes.
        if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
            // SAFETY: we own this handle but not the mutex; just close it.
            unsafe { CloseHandle(handle) };
            return Ok(None);
        }
        Ok(Some(Held(handle)))
    }

    /// For `RunEvent::Exit`: a capture running inside the GUI must not leave
    /// a kernel session tracing every DPC after the app has gone.
    pub fn abort_if_running() {
        if RUNNING.load(Ordering::Acquire) {
            stop_by_name(&wide(SESSION_NAME));
        }
    }

    #[repr(C)]
    struct TraceProperties {
        props: EVENT_TRACE_PROPERTIES,
        name: [u16; 64],
    }

    impl TraceProperties {
        fn new() -> Box<Self> {
            // SAFETY: EVENT_TRACE_PROPERTIES is integers, a GUID and a handle;
            // all-zero is the documented starting point, and the name buffer
            // is plain u16s.
            let mut me: Box<Self> = Box::new(unsafe { std::mem::zeroed() });
            me.props.Wnode.BufferSize = std::mem::size_of::<Self>() as u32;
            me.props.LoggerNameOffset = std::mem::size_of::<EVENT_TRACE_PROPERTIES>() as u32;
            me
        }
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn same_guid(a: &GUID, b: &GUID) -> bool {
        a.data1 == b.data1 && a.data2 == b.data2 && a.data3 == b.data3 && a.data4 == b.data4
    }

    /// Stops a session with our name, left over if a previous capture was
    /// killed mid-flight. Without this the name stays taken until reboot.
    fn stop_by_name(name: &[u16]) -> LostEvents {
        let mut props = TraceProperties::new();
        // SAFETY: `name` is nul-terminated and `props` is sized as declared.
        unsafe {
            ControlTraceW(
                CONTROLTRACE_HANDLE { Value: 0 },
                name.as_ptr(),
                &mut props.props,
                EVENT_TRACE_CONTROL_STOP,
            )
        };
        LostEvents {
            events: props.props.EventsLost,
            buffers: props.props.RealTimeBuffersLost,
        }
    }

    unsafe extern "system" fn on_event(record: *mut EVENT_RECORD) {
        if record.is_null() {
            return;
        }
        // SAFETY: ETW hands over a record valid for the duration of the call.
        let record = unsafe { &*record };
        let header = &record.EventHeader;
        if !same_guid(&header.ProviderId, &PerfInfoGuid) {
            return;
        }
        let Some(kind) = classify(header.EventDescriptor.Opcode) else {
            return;
        };
        if record.UserData.is_null() || record.UserContext.is_null() {
            return;
        }
        // SAFETY: UserData points at UserDataLength bytes owned by ETW for the
        // duration of the callback; the slice does not outlive it.
        let payload = unsafe {
            std::slice::from_raw_parts(record.UserData as *const u8, record.UserDataLength as usize)
        };
        let flags = u32::from(header.Flags);
        let pointer_size = if flags & EVENT_HEADER_FLAG_32_BIT_HEADER != 0 { 4 } else { 8 };
        let Some((initial, routine)) = parse(payload, pointer_size) else {
            return;
        };
        // SAFETY: UserContext is the `Mutex<Tally>` passed to OpenTraceW,
        // which `capture` keeps alive until ProcessTrace has returned.
        let tally = unsafe { &*(record.UserContext as *const Mutex<Tally>) };
        if let Ok(mut tally) = tally.lock() {
            tally.record(kind, routine, initial, header.TimeStamp);
        }
    }

    /// Loaded kernel modules as (base, file name). Empty when Windows hides
    /// the addresses from this token.
    pub fn loaded_drivers() -> Vec<(u64, String)> {
        // 24H2 zeroes kernel addresses unless SeDebugPrivilege is enabled. It
        // is enabled on an impersonation token of this thread only, never the
        // process token: other threads of an elevated GUI (the session
        // watcher opening processes, for one) must never see it.
        let _scope = DebugPrivilegeOnThisThread::enable();
        enumerate_drivers()
    }

    /// Reverts the thread's impersonation when dropped.
    struct DebugPrivilegeOnThisThread;

    impl DebugPrivilegeOnThisThread {
        fn enable() -> Option<Self> {
            use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, LUID};
            use windows_sys::Win32::Security::{
                AdjustTokenPrivileges, ImpersonateSelf, LookupPrivilegeValueW,
                SecurityImpersonation, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
                TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
            };
            use windows_sys::Win32::System::Threading::{GetCurrentThread, OpenThreadToken};
            // SAFETY: plain call; on success this thread impersonates a copy
            // of the process token until RevertToSelf.
            if unsafe { ImpersonateSelf(SecurityImpersonation) } == 0 {
                return None;
            }
            // From here on the impersonation is undone on every path.
            let scope = DebugPrivilegeOnThisThread;
            let mut token: HANDLE = std::ptr::null_mut();
            // SAFETY: the current-thread pseudo handle and a live out-parameter.
            if unsafe {
                OpenThreadToken(GetCurrentThread(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, 0, &mut token)
            } == 0
            {
                return Some(scope);
            }
            let name = wide("SeDebugPrivilege");
            let mut luid = LUID { LowPart: 0, HighPart: 0 };
            // SAFETY: nul-terminated name and a live out-parameter.
            if unsafe { LookupPrivilegeValueW(std::ptr::null(), name.as_ptr(), &mut luid) } != 0 {
                let privileges = TOKEN_PRIVILEGES {
                    PrivilegeCount: 1,
                    Privileges: [LUID_AND_ATTRIBUTES {
                        Luid: luid,
                        Attributes: SE_PRIVILEGE_ENABLED,
                    }],
                };
                // SAFETY: the thread's own impersonation token and a fully
                // initialised structure. If nothing is granted, the addresses
                // simply stay hidden and the report says so.
                unsafe {
                    AdjustTokenPrivileges(token, 0, &privileges, 0, std::ptr::null_mut(), std::ptr::null_mut())
                };
            }
            // SAFETY: opened above, closed once.
            unsafe { CloseHandle(token) };
            Some(scope)
        }
    }

    impl Drop for DebugPrivilegeOnThisThread {
        fn drop(&mut self) {
            // SAFETY: ends the impersonation begun in `enable`.
            unsafe { windows_sys::Win32::Security::RevertToSelf() };
        }
    }

    fn enumerate_drivers() -> Vec<(u64, String)> {
        let mut bases: Vec<*mut core::ffi::c_void> = vec![std::ptr::null_mut(); 1024];
        loop {
            let mut needed = 0u32;
            let bytes = (bases.len() * std::mem::size_of::<usize>()) as u32;
            // SAFETY: `bases` has room for `bytes` bytes of pointers.
            if unsafe { K32EnumDeviceDrivers(bases.as_mut_ptr(), bytes, &mut needed) } == 0 {
                return Vec::new();
            }
            if needed <= bytes {
                bases.truncate(needed as usize / std::mem::size_of::<usize>());
                break;
            }
            bases.resize(needed as usize / std::mem::size_of::<usize>() + 16, std::ptr::null_mut());
        }
        bases
            .into_iter()
            .filter(|base| !base.is_null())
            .filter_map(|base| {
                let mut name = [0u16; 260];
                // SAFETY: `name` holds 260 u16s, the size passed.
                let len = unsafe {
                    K32GetDeviceDriverBaseNameW(base, name.as_mut_ptr(), name.len() as u32)
                } as usize;
                (len > 0).then(|| (base as u64, String::from_utf16_lossy(&name[..len])))
            })
            .collect()
    }

    pub fn capture(seconds: u32) -> Result<DpcReport, String> {
        if RUNNING.swap(true, Ordering::AcqRel) {
            return Err("a latency capture is already running".into());
        }
        let result = capture_inner(seconds);
        RUNNING.store(false, Ordering::Release);
        result
    }

    fn capture_inner(seconds: u32) -> Result<DpcReport, String> {
        let Some(_held) = take_capture_mutex()? else {
            return Err("a latency capture is already running".into());
        };
        let name = wide(SESSION_NAME);
        // Nobody else holds the mutex, so a session with this name is an
        // orphan from a capture that was killed mid-flight.
        stop_by_name(&name);

        let mut props = TraceProperties::new();
        props.props.Wnode.Flags = WNODE_FLAG_TRACED_GUID;
        props.props.Wnode.ClientContext = 1; // QPC timestamps
        props.props.Wnode.Guid = SESSION_GUID;
        props.props.LogFileMode = EVENT_TRACE_REAL_TIME_MODE | EVENT_TRACE_SYSTEM_LOGGER_MODE;
        props.props.EnableFlags =
            EVENT_TRACE_FLAG_DPC | EVENT_TRACE_FLAG_INTERRUPT | EVENT_TRACE_FLAG_NO_SYSCONFIG;
        // 64 KiB buffers, up to 8 MiB in flight: tens of thousands of events
        // a second on a busy machine, delivered once a second.
        props.props.BufferSize = 64;
        props.props.MinimumBuffers = 32;
        props.props.MaximumBuffers = 128;
        props.props.FlushTimer = 1;

        let mut control = CONTROLTRACE_HANDLE { Value: 0 };
        // SAFETY: `control` is a live local, `name` is nul-terminated and
        // outlives the call, `props` is laid out as StartTrace requires.
        let started = unsafe { StartTraceW(&mut control, name.as_ptr(), &mut props.props) };
        match started {
            0 => {}
            ERROR_ACCESS_DENIED => {
                return Err("measuring DPC latency needs administrator rights".into())
            }
            ERROR_NO_SYSTEM_RESOURCES => {
                return Err("Windows has no free kernel trace session; close LatencyMon, WPR or similar tools and try again".into())
            }
            code => return Err(format!("Windows refused the kernel trace session (error {code})")),
        }

        let mut qpc_hz = 0i64;
        // SAFETY: `qpc_hz` is a live out-parameter.
        unsafe { QueryPerformanceFrequency(&mut qpc_hz) };
        let tally: Box<Mutex<Tally>> = Box::new(Mutex::new(Tally::new(qpc_hz)));

        // SAFETY: all-zero is the documented starting point for this struct.
        let mut logfile: EVENT_TRACE_LOGFILEW = unsafe { std::mem::zeroed() };
        let mut logger_name: Box<[u16]> = name.clone().into_boxed_slice();
        logfile.LoggerName = logger_name.as_mut_ptr();
        logfile.Anonymous1.ProcessTraceMode = PROCESS_TRACE_MODE_REAL_TIME
            | PROCESS_TRACE_MODE_EVENT_RECORD
            | PROCESS_TRACE_MODE_RAW_TIMESTAMP;
        logfile.Anonymous2.EventRecordCallback = Some(on_event);
        logfile.Context = &*tally as *const Mutex<Tally> as *mut core::ffi::c_void;
        // SAFETY: `logfile` is initialised, and the name and context it points
        // at live until after CloseTrace below.
        let trace = unsafe { OpenTraceW(&mut logfile) };
        if trace.Value == u64::MAX {
            stop_by_name(&name);
            return Err("could not attach to the kernel trace session".into());
        }

        let handle = trace.Value;
        let (done_tx, done_rx) = std::sync::mpsc::channel();
        let worker = std::thread::Builder::new()
            .name("dpc-etw".into())
            .spawn(move || {
                // SAFETY: the handle came from OpenTraceW and is closed only
                // after this call has returned or been given time to drain.
                let code = unsafe {
                    ProcessTrace(&PROCESSTRACE_HANDLE { Value: handle }, 1, std::ptr::null(), std::ptr::null())
                };
                let _ = done_tx.send(code);
            });
        let worker = match worker {
            Ok(worker) => worker,
            Err(e) => {
                stop_by_name(&name);
                // SAFETY: the handle is open and nothing is consuming it.
                unsafe { CloseTrace(trace) };
                return Err(format!("could not start the capture thread: {e}"));
            }
        };

        std::thread::sleep(Duration::from_secs(u64::from(seconds)));

        let mut stop = TraceProperties::new();
        // SAFETY: `control` is the live session handle; `stop` is sized for
        // the final statistics the call writes back.
        let stopped = unsafe {
            ControlTraceW(control, std::ptr::null(), &mut stop.props, EVENT_TRACE_CONTROL_STOP)
        };
        let lost = LostEvents {
            events: stop.props.EventsLost,
            buffers: stop.props.RealTimeBuffersLost,
        };
        // Stopping the session ends a real-time ProcessTrace once it has
        // delivered what was already flushed. CloseTrace first would cut
        // that tail off uncounted, so it only comes after, or after a wait.
        let consumed = done_rx.recv_timeout(Duration::from_secs(5)).ok();
        // SAFETY: the consumer handle is closed once; after a timeout this is
        // what releases a ProcessTrace that is still blocked.
        unsafe { CloseTrace(trace) };
        let _ = worker.join();
        drop(logger_name);

        if stopped != 0 {
            return Err(format!("the kernel trace session did not stop cleanly (error {stopped})"));
        }
        if let Some(code) = consumed.filter(|c| *c != 0 && *c != ERROR_CANCELLED) {
            return Err(format!("reading the kernel trace failed (error {code})"));
        }
        let drivers = loaded_drivers();
        let tally = tally.lock().map_err(|_| "the capture state was lost".to_string())?;
        let report = tally.report(seconds, &drivers, lost);
        // Every running Windows machine takes timer interrupts; a capture
        // with none measured nothing and must not read as a clean result.
        if report.dpc.count + report.isr.count == 0 {
            return Err("the kernel delivered no DPC or interrupt events; nothing was measured".into());
        }
        Ok(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HZ: i64 = 10_000_000; // 0.1 us per tick

    fn us(v: f64) -> i64 {
        (v * 10.0) as i64
    }

    #[test]
    fn opcodes_map_to_the_documented_event_types() {
        for dpc in [66, 68, 69, 70] {
            assert_eq!(classify(dpc), Some(Kind::Dpc), "{dpc}");
        }
        for isr in [50, 67, 95] {
            assert_eq!(classify(isr), Some(Kind::Isr), "{isr}");
        }
        for other in [0, 10, 46, 92, 96, 98] {
            assert_eq!(classify(other), None, "{other}");
        }
    }

    #[test]
    fn payloads_parse_for_both_pointer_widths_and_short_ones_are_refused() {
        let mut dpc = Vec::new();
        dpc.extend_from_slice(&1234i64.to_le_bytes());
        dpc.extend_from_slice(&0xffff_f800_da50_13e0u64.to_le_bytes());
        assert_eq!(parse(&dpc, 8), Some((1234, 0xffff_f800_da50_13e0)));
        // ISR carries ReturnValue, Vector and Reserved after the routine.
        let mut isr = dpc.clone();
        isr.extend_from_slice(&[1, 0xaa, 0, 0]);
        assert_eq!(parse(&isr, 8), Some((1234, 0xffff_f800_da50_13e0)));
        let mut narrow = 99i64.to_le_bytes().to_vec();
        narrow.extend_from_slice(&0x8123_4567u32.to_le_bytes());
        assert_eq!(parse(&narrow, 4), Some((99, 0x8123_4567)));
        assert_eq!(parse(&dpc[..15], 8), None);
        assert_eq!(parse(&[], 8), None);
    }

    fn drivers() -> Vec<(u64, String)> {
        vec![
            (0xffff_f800_0000_0000, "ntoskrnl.exe".into()),
            (0xffff_f801_0000_0000, "nvlddmkm.sys".into()),
            (0xffff_f801_2000_0000, "ndis.sys".into()),
            (0, "hidden.sys".into()),
        ]
    }

    #[test]
    fn durations_are_attributed_to_the_driver_that_owns_the_routine() {
        let mut tally = Tally::new(HZ);
        let gpu = 0xffff_f801_0012_3456;
        let net = 0xffff_f801_2000_1000;
        tally.record(Kind::Dpc, gpu, 0, us(40.0));
        tally.record(Kind::Dpc, gpu, us(1000.0), us(1000.0 + 850.0));
        tally.record(Kind::Isr, net, us(2000.0), us(2000.0 + 12.0));
        tally.record(Kind::Isr, net, us(3000.0), us(3000.0 + 30.0));
        let report = tally.report(10, &drivers(), LostEvents::default());

        assert_eq!(report.dpc.count, 2);
        assert_eq!(report.dpc.over_limit, 1);
        assert!((report.dpc.max_us - 850.0).abs() < 0.2);
        assert_eq!(report.isr.count, 2);
        assert_eq!(report.isr.over_limit, 1, "30 us is past the 25 us ISR limit");
        // nvlddmkm is 8.5x its limit; ndis 1.2x. Worst first.
        assert_eq!(report.drivers[0].driver.as_deref(), Some("nvlddmkm.sys"));
        assert_eq!(report.drivers[0].dpc.count, 2);
        assert_eq!(report.drivers[1].driver.as_deref(), Some("ndis.sys"));
        assert!(report.drivers_resolved);
    }

    #[test]
    fn an_address_outside_every_driver_stays_unattributed() {
        let mut tally = Tally::new(HZ);
        tally.record(Kind::Dpc, 0x1000, 0, us(5.0));
        tally.record(Kind::Dpc, 0xffff_f801_2000_0000 + MAX_DRIVER_SPAN, 0, us(5.0));
        let report = tally.report(5, &drivers(), LostEvents::default());
        assert_eq!(report.drivers.len(), 1);
        assert_eq!(report.drivers[0].driver, None);
        assert_eq!(report.drivers[0].dpc.count, 2);
        let hidden = tally.report(5, &[(0, "x.sys".into())], LostEvents::default());
        assert!(!hidden.drivers_resolved);
    }

    #[test]
    fn the_worst_spikes_are_kept_longest_first_with_their_offset() {
        let mut tally = Tally::new(HZ);
        let gpu = 0xffff_f801_0000_1000;
        for i in 0..40 {
            let start = us(f64::from(i) * 1000.0);
            tally.record(Kind::Dpc, gpu, start, start + us(f64::from(i)));
        }
        let report = tally.report(5, &drivers(), LostEvents::default());
        assert_eq!(report.worst.len(), WORST_KEPT);
        assert!((report.worst[0].duration_us - 39.0).abs() < 0.2);
        assert!((report.worst[0].at_ms - 39.0).abs() < 0.01);
        assert!(report
            .worst
            .windows(2)
            .all(|w| w[0].duration_us >= w[1].duration_us));
    }

    #[test]
    fn a_negative_duration_is_counted_as_skew_not_measured() {
        let mut tally = Tally::new(HZ);
        tally.record(Kind::Isr, 0xffff_f801_2000_0000, 500, 100);
        let report = tally.report(5, &drivers(), LostEvents { events: 3, buffers: 1 });
        assert_eq!((report.skewed_events, report.isr.count), (1, 0));
        assert_eq!((report.events_lost, report.buffers_lost), (3, 1));
    }

    #[test]
    fn the_capture_length_is_held_to_five_through_thirty_seconds() {
        assert_eq!(clamp_seconds(0), 5);
        assert_eq!(clamp_seconds(12), 12);
        assert_eq!(clamp_seconds(600), 30);
    }

    /// Runs a real two-second kernel session. Needs an elevated shell:
    /// `cargo test --lib diagnostics::dpc::tests::live -- --ignored --nocapture`
    #[cfg(windows)]
    #[test]
    #[ignore = "starts a real kernel trace session; administrator only"]
    fn live_capture_sees_interrupts_and_names_their_drivers() {
        let report = native::capture(2).expect("capture");
        println!("{}", serde_json::to_string_pretty(&report).unwrap());
        assert!(report.isr.count + report.dpc.count > 0, "no events in two seconds");
        assert!(report.drivers_resolved, "driver addresses were hidden");
        assert!(report.drivers.iter().any(|d| d.driver.is_some()));
    }

    /// The field names and enum strings src/types.ts is written against.
    #[test]
    fn the_wire_format_matches_the_typescript_contract() {
        let mut tally = Tally::new(HZ);
        tally.record(Kind::Isr, 0xffff_f801_2000_0000, 0, us(30.0));
        let report = tally.report(5, &drivers(), LostEvents::default());
        let json = serde_json::to_value(&report).unwrap();
        let mut keys: Vec<_> = json.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        assert_eq!(
            keys,
            ["buffersLost", "dpc", "drivers", "driversResolved", "eventsLost", "isr", "seconds", "skewedEvents", "worst"]
        );
        assert_eq!(json["isr"]["kind"], "isr");
        assert_eq!(json["dpc"]["kind"], "dpc");
        assert!(json["isr"]["limitUs"].is_number() && json["isr"]["overLimit"].is_number());
        assert_eq!(json["drivers"][0]["driver"], "ndis.sys");
        assert!(json["drivers"][0]["isr"]["maxUs"].is_number());
        assert!(json["worst"][0]["durationUs"].is_number() && json["worst"][0]["atMs"].is_number());
        // The helper envelope capture_via_helper parses.
        let ok = serde_json::to_value(HelperOutcome::Report(report)).unwrap();
        assert!(ok["report"].is_object());
        let err = serde_json::to_value(HelperOutcome::Error("x".into())).unwrap();
        assert_eq!(err, serde_json::json!({ "error": "x" }));
    }
}
