//! Frame rate, measured rather than estimated.
//!
//! The overlay has said from the start that it does not report FPS, and the
//! reason was never modesty: a game's frame pacing is not observable from
//! outside the game except through the DXGI present events, which need a
//! privileged ETW session. Sampling GPU load gives utilisation, not pacing,
//! and timing the overlay's own repaints measures the compositor's treatment
//! of the overlay. Either would produce a number that moves convincingly and
//! means nothing, on a screen people use to decide what hardware to buy.
//!
//! So this module runs the trace session properly.
//!
//! ## What is counted
//!
//! One `PresentStart` from `Microsoft-Windows-DXGI`, per process, per frame
//! the application hands to the swap chain. That is *presented* frame rate —
//! the same quantity PresentMon reports and the one every credible overlay
//! shows. Only the event header is read: process id and timestamp. The
//! payload is never decoded, so there is no schema to keep up with and
//! nothing about what the game is doing is examined.
//!
//! ## What this is not
//!
//! Not a hook, not an injection, not a handle into the game. An ETW consumer
//! reads telemetry the operating system emits regardless of who is listening,
//! which is why this approach — rather than the overlay-injection route — is
//! the one used by tools that run alongside anti-cheat.
//!
//! ## Why it needs administrator
//!
//! Starting a real-time ETW session is a privileged operation. Unelevated,
//! `StartTrace` fails with ERROR_ACCESS_DENIED and this module reports that
//! it cannot measure. It never falls back to a plausible-looking figure: the
//! whole point of taking the hard route was to avoid inventing one.

use std::collections::HashMap;
use std::collections::VecDeque;

/// How much history is kept per process.
///
/// The rate itself only needs the last second. The 1% low needs a population
/// big enough for "the worst 1%" to mean anything: at 60 fps five seconds is
/// three hundred frames, so the figure moves with the game rather than with
/// whichever single frame happened to be slowest.
const RETAIN_SECS: f64 = 5.0;

/// The window the headline rate is averaged over.
const RATE_WINDOW_SECS: f64 = 1.0;

/// Below this many frames in the retained window, no 1% low is reported.
///
/// With fewer samples the "worst 1%" is one frame, and one frame is noise —
/// a figure that jumps to half the average because a shader compiled is worse
/// than no figure, because people read it as a property of their hardware.
const MIN_FRAMES_FOR_LOW: usize = 100;

/// A process that has not presented for this long is dropped entirely, so a
/// long session does not accumulate an entry per game that was ever launched.
const STALE_SECS: f64 = 30.0;

#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq)]
pub struct FpsStats {
    /// Presented frames per second over the last [`RATE_WINDOW_SECS`].
    pub fps: f64,
    /// Mean frame interval over the same window, in milliseconds.
    pub frametime_ms: f64,
    /// The 1% low, expressed as a frame rate: the rate implied by the 99th
    /// percentile frame interval. `None` until there are enough frames for it
    /// to mean something.
    pub low1_fps: Option<f64>,
    /// Frames retained for this process, so a caller can tell a settled
    /// reading from one that has only just started.
    pub sample_frames: usize,
}

/// Present timestamps, per process, in QPC ticks.
///
/// Timestamps come from the events themselves rather than from a clock read
/// in the callback. ETW delivers events in buffers, so a callback-side clock
/// would stamp a whole buffer's worth of frames at nearly the same instant
/// and every frame interval would be wrong — which matters most for exactly
/// the figure people care about, the 1% low.
pub struct Frames {
    per_pid: HashMap<u32, VecDeque<i64>>,
    qpc_hz: i64,
}

impl Frames {
    pub fn new(qpc_hz: i64) -> Self {
        Self {
            per_pid: HashMap::new(),
            // A zero frequency would divide by zero in every conversion
            // below. It cannot happen on any supported Windows, but the
            // fallback costs nothing and the alternative is a panic inside an
            // ETW callback, where a panic cannot be caught.
            qpc_hz: if qpc_hz > 0 { qpc_hz } else { 10_000_000 },
        }
    }

    fn ticks(&self, secs: f64) -> i64 {
        (secs * self.qpc_hz as f64) as i64
    }

    /// Records one present. Called from the ETW callback, so it does the least
    /// work that keeps the buffer bounded and nothing else.
    pub fn record(&mut self, pid: u32, qpc: i64) {
        let horizon = self.ticks(RETAIN_SECS);
        let queue = self.per_pid.entry(pid).or_default();
        queue.push_back(qpc);
        while let Some(&oldest) = queue.front() {
            if qpc - oldest > horizon {
                queue.pop_front();
            } else {
                break;
            }
        }
    }

    /// Drops processes that have stopped presenting, so the map does not grow
    /// for the lifetime of the session.
    pub fn prune(&mut self, now_qpc: i64) {
        let stale = self.ticks(STALE_SECS);
        self.per_pid
            .retain(|_, q| q.back().is_some_and(|&last| now_qpc - last <= stale));
    }

    /// Every process with frames on record.
    pub fn measured_pids(&self) -> Vec<u32> {
        self.per_pid.keys().copied().collect()
    }

    /// The reading for one process, or `None` if it has not presented inside
    /// the rate window — a game that is loading, minimised or closed has no
    /// frame rate, and zero would be a claim rather than an absence.
    pub fn stats(&self, pid: u32, now_qpc: i64) -> Option<FpsStats> {
        let queue = self.per_pid.get(&pid)?;
        let window = self.ticks(RATE_WINDOW_SECS);
        let mut recent: Vec<i64> = queue
            .iter()
            .copied()
            .filter(|&t| now_qpc - t <= window)
            .collect();
        // Two presents are needed for one interval; one present is not a rate.
        if recent.len() < 2 {
            return None;
        }
        // Sorted, because arrival order is not timestamp order — see `low1`.
        recent.sort_unstable();

        let span_ticks = recent[recent.len() - 1] - recent[0];
        if span_ticks <= 0 {
            return None;
        }
        let span_secs = span_ticks as f64 / self.qpc_hz as f64;
        // Intervals, not events: N presents bound N-1 intervals, and dividing
        // by N would under-report the rate by a frame every window.
        let intervals = (recent.len() - 1) as f64;
        let fps = intervals / span_secs;

        Some(FpsStats {
            fps,
            frametime_ms: (span_secs * 1000.0) / intervals,
            low1_fps: self.low1(queue),
            sample_frames: queue.len(),
        })
    }

    /// The 1% low: the rate implied by the 99th-percentile frame interval.
    fn low1(&self, queue: &VecDeque<i64>) -> Option<f64> {
        if queue.len() < MIN_FRAMES_FOR_LOW {
            return None;
        }
        // Sorted by timestamp before differencing.
        //
        // ETW delivers events in per-processor buffers and does not order
        // them globally, so a present recorded on one core can arrive after a
        // later present recorded on another. Differencing in arrival order
        // then yields one negative interval and one enormous positive one,
        // straddling the swap — and the 99th percentile lands squarely on the
        // enormous one. That is what made a game averaging a steady 70 fps
        // report a 1% low of 2: not a stutter, an unsorted subtraction.
        //
        // Sorting here rather than inserting in order in `record` on purpose:
        // `record` runs in the ETW callback for every present of every
        // process, and this runs once a second for one process.
        let mut ordered: Vec<i64> = queue.iter().copied().collect();
        ordered.sort_unstable();
        let mut intervals: Vec<i64> = ordered
            .iter()
            .zip(ordered.iter().skip(1))
            .map(|(a, b)| b - a)
            .collect();
        if intervals.is_empty() {
            return None;
        }
        intervals.sort_unstable();
        // Nearest-rank: the value at or above which the worst 1% of frames sit.
        let rank = ((intervals.len() as f64) * 0.99).ceil() as usize;
        let idx = rank.saturating_sub(1).min(intervals.len() - 1);
        let worst = intervals[idx];
        if worst <= 0 {
            return None;
        }
        Some(self.qpc_hz as f64 / worst as f64)
    }
}

#[cfg(windows)]
pub mod imp;

#[cfg(windows)]
pub use imp::FpsState;

#[cfg(not(windows))]
pub mod imp {
    //! The frame counter is Windows-only: it is built on ETW and the DXGI
    //! provider, neither of which exists elsewhere. The commands still exist
    //! so the UI has one shape on every platform.
    use super::FpsStats;

    #[derive(Default)]
    pub struct FpsState;

    #[tauri::command(async)]
    pub fn start_fps_capture(_state: tauri::State<'_, FpsState>) -> Result<(), String> {
        Err("The frame counter is only available on Windows".to_string())
    }

    #[tauri::command(async)]
    pub fn stop_fps_capture(_state: tauri::State<'_, FpsState>) {}

    #[tauri::command(async)]
    pub fn fps_status(_state: tauri::State<'_, FpsState>) -> &'static str {
        "unsupported"
    }

    #[tauri::command(async)]
    pub fn fps_snapshot(_state: tauri::State<'_, FpsState>, _pid: u32) -> Option<FpsStats> {
        None
    }
}

#[cfg(not(windows))]
pub use imp::FpsState;

#[cfg(test)]
mod tests {
    use super::*;

    /// A round frequency, so the arithmetic in the tests reads as time.
    const HZ: i64 = 10_000_000; // one tick = 100ns

    fn ms(n: f64) -> i64 {
        (n * (HZ as f64) / 1000.0) as i64
    }

    /// Feeds `count` presents at a steady interval, starting at `t0`.
    fn steady(f: &mut Frames, pid: u32, t0: i64, interval_ms: f64, count: usize) -> i64 {
        let mut t = t0;
        for _ in 0..count {
            f.record(pid, t);
            t += ms(interval_ms);
        }
        t - ms(interval_ms)
    }

    #[test]
    fn a_steady_sixty_hertz_stream_reads_as_sixty() {
        let mut f = Frames::new(HZ);
        let last = steady(&mut f, 42, 0, 1000.0 / 60.0, 300);
        let s = f.stats(42, last).unwrap();
        assert!(
            (s.fps - 60.0).abs() < 0.5,
            "expected about 60 fps, got {}",
            s.fps
        );
        assert!(
            (s.frametime_ms - 1000.0 / 60.0).abs() < 0.2,
            "frametime should be the reciprocal of the rate, got {}",
            s.frametime_ms
        );
    }

    #[test]
    fn intervals_are_counted_not_events() {
        // Eleven presents one hundred milliseconds apart span one second and
        // bound ten intervals, so the rate is ten — not eleven. Counting
        // events instead of intervals is the classic off-by-one here and it
        // inflates every reading.
        let mut f = Frames::new(HZ);
        let last = steady(&mut f, 1, 0, 100.0, 11);
        let s = f.stats(1, last).unwrap();
        assert!((s.fps - 10.0).abs() < 0.001, "got {}", s.fps);
    }

    #[test]
    fn a_process_that_stopped_presenting_has_no_rate_rather_than_zero() {
        let mut f = Frames::new(HZ);
        let last = steady(&mut f, 7, 0, 16.0, 200);
        // Two seconds later the game is loading and has presented nothing.
        assert!(
            f.stats(7, last + ms(2000.0)).is_none(),
            "an absent rate must be absent, not zero — zero reads as 'your game is broken'"
        );
    }

    #[test]
    fn a_process_that_never_presented_has_no_stats() {
        let f = Frames::new(HZ);
        assert!(f.stats(999, 0).is_none());
    }

    #[test]
    fn a_single_present_is_not_a_rate() {
        let mut f = Frames::new(HZ);
        f.record(3, 0);
        assert!(
            f.stats(3, 0).is_none(),
            "one present bounds no interval, so there is nothing to divide"
        );
    }

    /// Records `fast` frames at 10ms, then `slow` frames at 50ms, and returns
    /// the timestamp of the last one.
    fn with_a_stutter(f: &mut Frames, pid: u32, fast: usize, slow: usize) -> i64 {
        let mut t = 0;
        for _ in 0..fast {
            f.record(pid, t);
            t += ms(10.0);
        }
        for _ in 0..slow {
            f.record(pid, t);
            t += ms(50.0);
        }
        t - ms(50.0)
    }

    #[test]
    fn the_one_percent_low_reports_the_worst_frames_not_the_average() {
        // Ten frames in three hundred at 20 fps: comfortably more than the
        // worst one percent, so the figure must land on them and not on the
        // hundred-fps majority.
        let mut f = Frames::new(HZ);
        let last = with_a_stutter(&mut f, 5, 290, 10);
        let low = f.stats(5, last).unwrap().low1_fps.unwrap();
        assert!(
            (low - 20.0).abs() < 1.0,
            "the 1% low should reflect the 50ms frames, got {low}"
        );
        let mean = f.stats(5, last).unwrap().fps;
        assert!(
            mean > low,
            "and it must sit below the average, or it is measuring the wrong thing"
        );
    }

    #[test]
    fn events_arriving_out_of_order_do_not_invent_a_stutter() {
        // ETW hands events over in per-processor buffers with no global
        // ordering, so a present can arrive after one that happened later.
        // Differenced in arrival order, that single swap fabricates an
        // interval hundreds of milliseconds long and the 1% low collapses —
        // which is exactly what a real 70 fps game reported before this.
        let step = ms(10.0);
        let ideal: Vec<i64> = (0..300_i64).map(|i| i * step).collect();

        // The same frames, with every tenth adjacent pair delivered the wrong
        // way round.
        let mut delivered = ideal.clone();
        for i in (0..delivered.len() - 1).step_by(10) {
            delivered.swap(i, i + 1);
        }

        let mut f = Frames::new(HZ);
        for t in &delivered {
            f.record(4, *t);
        }

        let s = f.stats(4, *ideal.last().unwrap()).unwrap();
        let low = s.low1_fps.unwrap();
        assert!(
            low > 80.0,
            "a steady stream delivered out of order is still steady; got a 1% low of {low}"
        );
        assert!(
            (s.fps - 100.0).abs() < 5.0,
            "and the average must survive it too; got {}",
            s.fps
        );
    }

    #[test]
    fn a_stutter_shorter_than_one_percent_does_not_move_the_one_percent_low() {
        // Two slow frames in three hundred is two thirds of one percent. The
        // 99th percentile is meant to exclude it, and that is not a rounding
        // artefact — it is the whole reason the figure is quoted at the 99th
        // percentile rather than as the single worst frame, which any passing
        // hitch would otherwise dominate.
        let mut f = Frames::new(HZ);
        let last = with_a_stutter(&mut f, 6, 298, 2);
        let low = f.stats(6, last).unwrap().low1_fps.unwrap();
        assert!(
            (low - 100.0).abs() < 1.0,
            "an excursion below one percent should leave the figure at the steady rate, got {low}"
        );
    }

    #[test]
    fn no_one_percent_low_until_there_are_enough_frames_to_mean_one() {
        let mut f = Frames::new(HZ);
        let last = steady(&mut f, 8, 0, 16.0, 30);
        let s = f.stats(8, last).unwrap();
        assert!(
            s.low1_fps.is_none(),
            "with thirty frames the worst 1% is one frame, which is noise"
        );
        assert!(s.fps > 0.0, "the rate itself is still perfectly reportable");
    }

    #[test]
    fn history_is_bounded_so_a_long_session_does_not_grow_without_end() {
        let mut f = Frames::new(HZ);
        // Sixty seconds at 100 fps is six thousand presents; only the retained
        // window should survive.
        let last = steady(&mut f, 11, 0, 10.0, 6000);
        let kept = f.stats(11, last).unwrap().sample_frames;
        assert!(
            kept <= (RETAIN_SECS * 100.0) as usize + 2,
            "kept {kept} frames, which is more than the retention window"
        );
    }

    #[test]
    fn a_process_that_exited_is_forgotten() {
        let mut f = Frames::new(HZ);
        let last = steady(&mut f, 21, 0, 16.0, 100);
        steady(&mut f, 22, 0, 16.0, 100);
        f.prune(last + ms(STALE_SECS * 1000.0 + 1000.0));
        assert!(f.per_pid.is_empty(), "both games are long gone");
    }

    #[test]
    fn a_process_still_presenting_survives_a_prune() {
        let mut f = Frames::new(HZ);
        let last = steady(&mut f, 31, 0, 16.0, 100);
        f.prune(last);
        assert!(f.stats(31, last).is_some(), "it is still running");
    }

    #[test]
    fn a_nonsense_clock_frequency_does_not_divide_by_zero() {
        let mut f = Frames::new(0);
        let hz = f.qpc_hz;
        assert!(hz > 0, "a zero frequency must be replaced, not used");
        f.record(1, 0);
        f.record(1, hz / 60);
        // The point is that this returns rather than panicking inside what is,
        // in production, an ETW callback.
        let _ = f.stats(1, hz / 60);
    }
}
