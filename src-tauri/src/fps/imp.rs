//! The Windows half of the frame counter: a real-time ETW consumer for the
//! DXGI provider's present events. See the module documentation in `fps.rs`
//! for why this is the only honest way to get the number.

use super::{Frames, FpsStats};
use serde::Serialize;
use std::sync::{Mutex, OnceLock};
use std::thread::JoinHandle;
use windows_sys::core::GUID;
use windows_sys::Win32::Foundation::{ERROR_ACCESS_DENIED, ERROR_SUCCESS};
use windows_sys::Win32::System::Diagnostics::Etw::{
    CloseTrace, ControlTraceW, EnableTraceEx2, OpenTraceW, ProcessTrace, StartTraceW,
    CONTROLTRACE_HANDLE, EVENT_RECORD, EVENT_TRACE_CONTROL_STOP, EVENT_TRACE_LOGFILEW,
    EVENT_TRACE_PROPERTIES, EVENT_TRACE_REAL_TIME_MODE, PROCESSTRACE_HANDLE,
    PROCESS_TRACE_MODE_EVENT_RECORD, PROCESS_TRACE_MODE_REAL_TIME, WNODE_FLAG_TRACED_GUID,
};
use windows_sys::Win32::System::Performance::QueryPerformanceFrequency;

/// `Microsoft-Windows-DXGI`. Every Direct3D application that presents through
/// a swap chain — which is every game — emits from this provider.
const DXGI_PROVIDER: GUID = GUID::from_u128(0xca11_c036_0102_4a2d_a6ad_f03c_fed5_d3c9);

/// `Present_Start` in the DXGI manifest: one per frame handed to the swap
/// chain. `Present_Stop` (43) would count the same frames on completion; the
/// start edge is used because it is the moment the application considers the
/// frame done, which is what a frame rate is meant to describe.
///
/// Not a number taken on faith. `wevtutil gp Microsoft-Windows-DXGI /ge:true`
/// reports event 42 as opcode 1 (Start) on task 9 (Present), and a live trace
/// against a WebGL page delivered exactly as many 42s as 43s while the rate
/// computed from them matched the frame interval to two decimal places. The
/// check is repeatable: see `examples/fpsprobe.rs`.
const DXGI_PRESENT_START: u16 = 42;

/// `Microsoft-Windows-D3D9`.
///
/// DXGI alone covers Direct3D 10 and later, which is every modern game and
/// nothing else. A Direct3D 9 title presents through
/// `IDirect3DDevice9::Present`, which never touches a DXGI swap chain and so
/// emits nothing the DXGI provider can see — the frame counter simply
/// reported no rate for it, with no way to tell that apart from "not a game".
/// Plenty of the games people run a tweaker for are exactly this old.
/// PresentMon consumes this provider for the same reason.
const D3D9_PROVIDER: GUID = GUID::from_u128(0x783a_ca0a_790e_4d7f_8451_aa85_0511_c6b9);

/// Event 1, opcode 1 (Start) on task 1 (Present), per the same manifest dump
/// that settled the DXGI id.
const D3D9_PRESENT_START: u16 = 1;

/// The session name. Fixed rather than generated so that a previous run that
/// was killed before it could stop its session leaves something this one can
/// find and clear, instead of an orphan session per crash — ETW sessions
/// outlive the process that created them and the system allows only a limited
/// number of them.
const SESSION_NAME: &str = "PCTweakerFrameCounter";

/// `EVENT_TRACE_PROPERTIES` is a variable-length structure: the API expects
/// the logger name to follow it in the same allocation, addressed by a byte
/// offset. Expressing that as a `repr(C)` struct with the name inline is the
/// same layout with none of the pointer arithmetic.
#[repr(C)]
struct TraceProperties {
    props: EVENT_TRACE_PROPERTIES,
    name: [u16; 64],
}

impl TraceProperties {
    fn new() -> Self {
        // SAFETY: EVENT_TRACE_PROPERTIES is a plain C structure of integers
        // and a GUID, for which an all-zero bit pattern is the documented
        // starting point — the API requires callers to zero it and fill in
        // only the fields they set.
        let mut me: Self = unsafe { std::mem::zeroed() };
        me.props.Wnode.BufferSize = std::mem::size_of::<Self>() as u32;
        me.props.Wnode.Flags = WNODE_FLAG_TRACED_GUID;
        // 1 = QueryPerformanceCounter. The alternative, system time, is
        // capped at the timer tick and would quantise frame intervals to
        // roughly 15ms — which is to say, to nonsense at any playable rate.
        me.props.Wnode.ClientContext = 1;
        me.props.LogFileMode = EVENT_TRACE_REAL_TIME_MODE;
        // Flush every second so a stopped game's last frames are delivered
        // promptly rather than sitting in a buffer until it fills.
        me.props.FlushTimer = 1;
        me.props.LoggerNameOffset = std::mem::size_of::<EVENT_TRACE_PROPERTIES>() as u32;

        for (slot, unit) in me.name.iter_mut().zip(SESSION_NAME.encode_utf16()) {
            *slot = unit;
        }
        me
    }

    fn as_mut_ptr(&mut self) -> *mut EVENT_TRACE_PROPERTIES {
        std::ptr::addr_of_mut!(self.props)
    }
}

fn session_name_wide() -> Vec<u16> {
    SESSION_NAME.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Where the callback puts what it sees.
///
/// A `static` because ETW callbacks are bare C function pointers with no
/// context parameter that survives the trace handle, so there is nowhere else
/// for the consumer to reach the buffer from.
static FRAMES: OnceLock<Mutex<Frames>> = OnceLock::new();


fn frames() -> &'static Mutex<Frames> {
    FRAMES.get_or_init(|| Mutex::new(Frames::new(qpc_frequency())))
}

fn qpc_frequency() -> i64 {
    let mut hz = 0i64;
    // SAFETY: writes a single i64 through a valid pointer. Documented never
    // to fail on Windows XP or later; the return value is checked anyway so
    // that a zero cannot reach the arithmetic.
    let ok = unsafe { QueryPerformanceFrequency(&mut hz) };
    if ok == 0 {
        0
    } else {
        hz
    }
}

fn qpc_now() -> i64 {
    let mut now = 0i64;
    // SAFETY: as above.
    unsafe {
        windows_sys::Win32::System::Performance::QueryPerformanceCounter(&mut now);
    }
    now
}

/// `windows_sys`' GUID is a plain data structure with no `PartialEq`, so the
/// comparison is spelled out.
fn same_guid(a: &GUID, b: &GUID) -> bool {
    a.data1 == b.data1 && a.data2 == b.data2 && a.data3 == b.data3 && a.data4 == b.data4
}

/// Whether an event is one application handing one finished frame to the
/// display, from either graphics API this session listens to.
///
/// A process emits one or the other, never both: a Direct3D 9 title presents
/// through the D3D9 runtime and a Direct3D 10-or-later one through a DXGI
/// swap chain. Accepting both providers therefore widens what can be measured
/// without any risk of counting a frame twice.
fn is_present_start(provider: &GUID, id: u16) -> bool {
    (id == DXGI_PRESENT_START && same_guid(provider, &DXGI_PROVIDER))
        || (id == D3D9_PRESENT_START && same_guid(provider, &D3D9_PROVIDER))
}

/// The ETW consumer callback.
///
/// Runs on the trace-processing thread for every event in the session, so it
/// does the least possible work: two comparisons on the header and a push.
/// It must never panic — a panic across an FFI boundary is undefined
/// behaviour — which is why nothing here can fail: the lock is only ever held
/// by short non-panicking sections, and a poisoned lock is skipped rather
/// than unwrapped.
unsafe extern "system" fn on_event(record: *mut EVENT_RECORD) {
    if record.is_null() {
        return;
    }
    // SAFETY: ETW hands the callback a valid record for the duration of the
    // call. Only the header is read, and only integer fields of it.
    let header = unsafe { (*record).EventHeader };
    if !is_present_start(&header.ProviderId, header.EventDescriptor.Id) {
        return;
    }
    if let Ok(mut frames) = frames().lock() {
        frames.record(header.ProcessId, header.TimeStamp);
    }
}

/// A running trace session.
///
/// Deliberately independent of Tauri: starting and stopping a trace has
/// nothing to do with the IPC layer, and keeping it separate is what lets the
/// session be exercised without a running app — which matters here more than
/// usual, because the one thing unit tests cannot cover is whether the
/// provider and event id actually yield events on a real machine.
pub struct Capture {
    control: CONTROLTRACE_HANDLE,
    trace: PROCESSTRACE_HANDLE,
    worker: Option<JoinHandle<()>>,
    /// The session name the consumer was opened with.
    ///
    /// Owned here because `EVENT_TRACE_LOGFILEW.LoggerName` is a borrowed
    /// pointer that the trace keeps using for as long as it is open — and
    /// `ProcessTrace` runs on another thread, long after `start` has returned.
    /// Held in a local `Vec`, this was a dangling pointer the moment the
    /// session actually began, which is why the consumer delivered nothing.
    _name: Box<[u16]>,
}

#[derive(Default)]
pub struct FpsState(Mutex<Option<Capture>>);

#[derive(Serialize)]
pub struct CaptureStatus {
    pub running: bool,
    /// So the UI can explain the requirement before the user clicks, rather
    /// than presenting an access-denied error as if something went wrong.
    pub elevated: bool,
}

/// Clears a session left behind by a previous run that did not stop cleanly.
///
/// Not an error path: on a first launch there is nothing to stop, and the
/// failure that returns is exactly the one that means "there was no session",
/// which is the desired state.
fn stop_orphan_session() {
    let mut props = TraceProperties::new();
    let name = session_name_wide();
    // SAFETY: both pointers are to live local allocations, and the properties
    // block is sized and offset as the API requires.
    unsafe {
        ControlTraceW(
            CONTROLTRACE_HANDLE { Value: 0 },
            name.as_ptr(),
            props.as_mut_ptr(),
            EVENT_TRACE_CONTROL_STOP,
        );
    }
}

impl Capture {
    pub fn start() -> Result<Self, String> {
    stop_orphan_session();

    let mut props = TraceProperties::new();
    let name = session_name_wide();
    let mut control = CONTROLTRACE_HANDLE { Value: 0 };

    // SAFETY: `control` is a live local, `name` is nul-terminated and lives
    // past the call, and `props` is laid out as StartTrace requires.
    let started = unsafe { StartTraceW(&mut control, name.as_ptr(), props.as_mut_ptr()) };
    if started != ERROR_SUCCESS {
        return Err(if started == ERROR_ACCESS_DENIED {
            // Deliberately the whole explanation: "access denied" on its own
            // invites the reader to think something is broken.
            "Measuring frame rate needs a system trace session, which Windows only grants to an administrator. Restart PC Tweaker as administrator to use it.".to_string()
        } else {
            format!("Windows refused to start the trace session (error {started}).")
        });
    }

    for (provider, label) in [(&DXGI_PROVIDER, "DXGI"), (&D3D9_PROVIDER, "Direct3D 9")] {
        // SAFETY: `control` is the handle StartTrace just returned. A null
        // parameter block means "no filters", which is what is wanted here.
        let enabled = unsafe {
            EnableTraceEx2(
                control,
                provider,
                // EVENT_CONTROL_CODE_ENABLE_PROVIDER
                1,
                // TRACE_LEVEL_VERBOSE. The present events sit below
                // informational on some Windows builds, and asking for more
                // than is emitted costs nothing.
                5,
                // Every keyword: each provider's whole volume is roughly two
                // events per presented frame, so there is nothing to gain by
                // narrowing it and a real risk of excluding the events on a
                // build where the keyword differs.
                0,
                0,
                0,
                std::ptr::null(),
            )
        };
        if enabled != ERROR_SUCCESS {
            // SAFETY: stopping the session just created, with its own name.
            unsafe {
                ControlTraceW(control, name.as_ptr(), props.as_mut_ptr(), EVENT_TRACE_CONTROL_STOP);
            }
            return Err(format!(
                "Windows refused to enable the {label} provider (error {enabled})."
            ));
        }
    }

    // SAFETY: zeroed is the documented starting point for this structure too.
    let mut logfile: EVENT_TRACE_LOGFILEW = unsafe { std::mem::zeroed() };
    let mut name_owned: Box<[u16]> = session_name_wide().into_boxed_slice();
    logfile.LoggerName = name_owned.as_mut_ptr();
    logfile.Anonymous1.ProcessTraceMode = PROCESS_TRACE_MODE_REAL_TIME | PROCESS_TRACE_MODE_EVENT_RECORD;
    logfile.Anonymous2.EventRecordCallback = Some(on_event);

    // SAFETY: `logfile` is fully initialised above and outlives the call.
    let trace = unsafe { OpenTraceW(&mut logfile) };
    // OpenTrace reports failure as an all-ones handle rather than zero.
    if trace.Value == u64::MAX {
        // SAFETY: as above.
        unsafe {
            ControlTraceW(control, name.as_ptr(), props.as_mut_ptr(), EVENT_TRACE_CONTROL_STOP);
        }
        return Err("Windows refused to open the trace session for reading.".to_string());
    }

    // ProcessTrace blocks until the session is stopped, so it gets its own
    // thread. Stopping the session is what makes it return.
    //
    // Its result comes back over a channel because the failure that matters
    // is the immediate one: a consumer that cannot attach returns at once,
    // and without this the session would look started while delivering
    // nothing at all — which is precisely how the first version of this
    // failed, silently.
    let (tx, rx) = std::sync::mpsc::channel::<u32>();
    let worker = std::thread::Builder::new()
        .name("fps-etw".to_string())
        .spawn(move || {
            // SAFETY: `trace` is the handle OpenTrace returned and is not
            // closed until this call has returned.
            let code = unsafe { ProcessTrace(&trace, 1, std::ptr::null(), std::ptr::null()) };
            let _ = tx.send(code);
        })
        .map_err(|e| format!("could not start the trace reader: {e}"))?;

    // A healthy consumer blocks here for the life of the session, so nothing
    // arriving is the good case.
    if let Ok(code) = rx.recv_timeout(std::time::Duration::from_millis(250)) {
        let _ = worker.join();
        // SAFETY: stopping the session just created, with its own name.
        unsafe {
            ControlTraceW(control, name.as_ptr(), props.as_mut_ptr(), EVENT_TRACE_CONTROL_STOP);
            CloseTrace(trace);
        }
        return Err(format!("the trace reader stopped immediately (error {code})."));
    }

    // Force the buffer into existence now, so its clock frequency is read on
    // this thread rather than inside the first callback.
    let _ = frames();

        Ok(Self {
            control,
            trace,
            worker: Some(worker),
            _name: name_owned,
        })
    }

    pub fn stop(mut self) {
        let mut props = TraceProperties::new();
        let name = session_name_wide();
        // SAFETY: the handle and name are the ones this session was started
        // with, and both outlive the call.
        unsafe {
            ControlTraceW(
                self.control,
                name.as_ptr(),
                props.as_mut_ptr(),
                EVENT_TRACE_CONTROL_STOP,
            );
            // Returns ERROR_CTX_CLOSE_PENDING while ProcessTrace is still
            // draining, which is expected and is what releases that thread.
            CloseTrace(self.trace);
        }
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

/// The reading for one process, whether or not a Tauri app is involved.
pub fn reading(pid: u32) -> Option<FpsStats> {
    let now = qpc_now();
    let mut frames = frames().lock().ok()?;
    frames.prune(now);
    frames.stats(pid, now)
}

/// Every process currently presenting, with its reading. Used by the overlay
/// to name what it is measuring, and by the probe in `examples/` to check that
/// the provider yields anything at all on a given machine.
pub fn active() -> Vec<(u32, FpsStats)> {
    let now = qpc_now();
    let Ok(mut frames) = frames().lock() else {
        return Vec::new();
    };
    frames.prune(now);
    frames.measured_pids()
        .into_iter()
        .filter_map(|pid| frames.stats(pid, now).map(|s| (pid, s)))
        .collect()
}

#[tauri::command(async)]
pub fn start_fps_capture(
    app: tauri::AppHandle,
    state: tauri::State<'_, FpsState>,
) -> Result<(), String> {
    // Gated here and not only in the card that offers it. The card does check,
    // but a UI check is a courtesy to the user, not a control: commands are
    // reachable over IPC regardless of what the interface chose to render.
    // Every other paid feature is enforced at this boundary — the overlay
    // window itself included — and the frame counter was the one that was not.
    crate::require_pro(&crate::store_for_dir(&app)?)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "the frame counter is unavailable".to_string())?;
    if guard.is_some() {
        return Ok(());
    }
    *guard = Some(Capture::start()?);
    Ok(())
}

#[tauri::command(async)]
pub fn stop_fps_capture(state: tauri::State<'_, FpsState>) {
    let Ok(mut guard) = state.0.lock() else {
        return;
    };
    if let Some(session) = guard.take() {
        session.stop();
    }
}

#[tauri::command(async)]
pub fn fps_status(state: tauri::State<'_, FpsState>) -> CaptureStatus {
    CaptureStatus {
        running: state.0.lock().map(|g| g.is_some()).unwrap_or(false),
        elevated: crate::elevation::is_elevated(),
    }
}

#[tauri::command(async)]
pub fn fps_snapshot(state: tauri::State<'_, FpsState>, pid: u32) -> Option<FpsStats> {
    // No reading at all when nothing is being captured, rather than the last
    // one the buffer happens to still hold.
    if !state.0.lock().map(|g| g.is_some()).unwrap_or(false) {
        return None;
    }
    reading(pid)
}
