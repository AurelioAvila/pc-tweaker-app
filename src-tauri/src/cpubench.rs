//! A short, honest CPU benchmark, used to show what enabling boost actually
//! bought on *this* machine.
//!
//! The point is a number the user can believe. Tools in this category animate
//! a bar and assert an improvement; this measures one, and reports it even
//! when the answer is "barely any difference" — which on a machine already
//! running at its ceiling is the truthful answer and the one that earns trust.
//!
//! ## Why the workload is what it is
//!
//! Integer mixing in a tight loop, single-threaded, with the result consumed
//! so the optimiser cannot delete it. It is deliberately not a realistic
//! workload: it is a *repeatable* one. The absolute score is meaningless and
//! is never shown; only the ratio between two runs on the same machine,
//! minutes apart, is reported.

use serde::Serialize;

#[derive(Serialize, Clone, Copy, Debug)]
pub struct BenchResult {
    /// Iterations completed per millisecond. Comparable only against another
    /// run on the same machine — never shown to the user on its own.
    pub score: u64,
    pub duration_ms: u64,
}

/// Runs the fixed workload for roughly `budget_ms`.
///
/// Uses a wall-clock budget rather than a fixed iteration count so a slow
/// machine isn't left grinding for a minute, and checks the clock every 4096
/// iterations so the timing call itself doesn't dominate the measurement.
/// One fixed-budget run for the Baseline Engine: same workload, same rules
/// (only comparable against another run on this machine).
pub fn bench_once() -> BenchResult {
    run_for(1200)
}

fn run_for(budget_ms: u64) -> BenchResult {
    let start = std::time::Instant::now();
    let budget = std::time::Duration::from_millis(budget_ms);

    let mut iterations: u64 = 0;
    let mut acc: u64 = 0x9e3779b97f4a7c15;

    loop {
        for _ in 0..4096 {
            // xorshift-ish mixing: dependent operations, so this measures the
            // core's actual throughput rather than how wide it can go.
            acc ^= acc << 13;
            acc ^= acc >> 7;
            acc ^= acc << 17;
            acc = acc.wrapping_mul(0x2545f4914f6cdd1d).wrapping_add(1);
        }
        iterations += 4096;
        if start.elapsed() >= budget {
            break;
        }
    }

    std::hint::black_box(acc);

    let elapsed = start.elapsed().as_millis().max(1) as u64;
    BenchResult {
        score: iterations / elapsed,
        duration_ms: elapsed,
    }
}

/// One measurement pass.
///
/// `async` so Tauri runs it off the UI thread — this deliberately pegs a core
/// for its whole budget, and doing that on the main thread would freeze the
/// window.
#[tauri::command]
pub async fn cpu_benchmark(budget_ms: Option<u64>) -> Result<BenchResult, String> {
    // Clamped: long enough to be stable, short enough that nobody sits
    // watching a spinner, and bounded so a caller can't pin a core for
    // minutes.
    let budget = budget_ms.unwrap_or(1200).clamp(300, 4000);

    tauri::async_runtime::spawn_blocking(move || run_for(budget))
        .await
        .map_err(|e| format!("benchmark did not finish: {}", e))
}

/// What one repeatable boost test measured: the workload's score, and the
/// processor's effective speed while it ran (rated clock times Windows'
/// performance counter, sampled every quarter second).
#[derive(Serialize, Clone, Debug)]
pub struct BoostProbe {
    pub score: u64,
    pub duration_ms: u64,
    pub avg_mhz: Option<u32>,
    pub peak_mhz: Option<u32>,
    /// The busiest single processor's top speed during the test.
    pub peak_core_mhz: Option<u32>,
}

/// Average and peak of the sampled speeds, or `None` without samples.
pub fn speed_summary(rated_mhz: Option<u32>, samples: &[f64]) -> (Option<u32>, Option<u32>) {
    let speeds: Vec<u32> = samples
        .iter()
        .filter_map(|&p| crate::livemetrics::effective_mhz(rated_mhz, Some(p)))
        .collect();
    if speeds.is_empty() {
        return (None, None);
    }
    let avg = speeds.iter().map(|&m| u64::from(m)).sum::<u64>() / speeds.len() as u64;
    (Some(avg as u32), speeds.iter().copied().max())
}

/// The same fixed workload as [`cpu_benchmark`], for a fixed time, with the
/// speed sampled alongside. Run in each mode, it shows what boost changes:
/// how fast the processor runs under the same load, not how busy it is.
#[tauri::command]
pub async fn boost_probe(seconds: Option<u64>) -> Result<BoostProbe, String> {
    let budget = seconds.unwrap_or(3).clamp(1, 6) * 1000;
    tauri::async_runtime::spawn_blocking(move || {
        let work = std::thread::spawn(move || run_for(budget));
        #[cfg(windows)]
        let (samples, busiest) = crate::livemetrics::sample_performance(
            std::time::Duration::from_millis(budget),
            std::time::Duration::from_millis(250),
        );
        #[cfg(not(windows))]
        let (samples, busiest): (Vec<f64>, Option<f64>) = (Vec::new(), None);
        let bench = work
            .join()
            .map_err(|_| "boost test did not finish".to_string())?;
        let rated = crate::cpuclock::read().map(|c| c.max_mhz);
        let (avg_mhz, peak_mhz) = speed_summary(rated, &samples);
        let peak_core_mhz = crate::livemetrics::effective_mhz(rated, busiest);
        crate::livemetrics::note_peak(peak_core_mhz);
        Ok(BoostProbe {
            score: bench.score,
            duration_ms: bench.duration_ms,
            avg_mhz,
            peak_mhz,
            peak_core_mhz,
        })
    })
    .await
    .map_err(|e| format!("boost test did not finish: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn speed_summary_averages_and_peaks_only_real_samples() {
        assert_eq!(speed_summary(Some(4000), &[]), (None, None));
        assert_eq!(speed_summary(None, &[100.0]), (None, None));
        assert_eq!(
            speed_summary(Some(4000), &[100.0, 110.0, f64::NAN, 120.0]),
            (Some(4400), Some(4800))
        );
    }

    #[test]
    fn the_benchmark_produces_a_usable_score() {
        let r = run_for(300);
        println!("score {} iterations/ms over {} ms", r.score, r.duration_ms);
        assert!(r.score > 0, "score must be positive");
        assert!(
            r.duration_ms >= 300,
            "should have run for at least its budget"
        );
    }

    /// Two runs back to back on an unchanged machine must land close together.
    /// If they don't, the workload is too noisy to attribute a difference to a
    /// tweak — which would turn the whole feature into a random number
    /// generator with a confident label on it.
    ///
    /// A single pair is retried a few times before failing. This is a
    /// dedicated core on a user's machine, but on a shared CI runner a
    /// hypervisor-scheduling blip can transiently steal a slice of one 400ms
    /// window and blow the ratio out (49.8% seen on `windows-latest`) without
    /// the workload itself being any noisier. One clean pair is enough to
    /// show the workload *can* agree with itself; only failing every attempt
    /// means it genuinely can't.
    #[test]
    fn repeated_runs_agree_closely_enough_to_compare() {
        const ATTEMPTS: u32 = 3;
        let mut last_ratio = 0.0;

        for attempt in 1..=ATTEMPTS {
            let a = run_for(400).score as f64;
            let b = run_for(400).score as f64;
            let ratio = a.max(b) / a.min(b);
            println!(
                "attempt {attempt}/{ATTEMPTS}: run-to-run ratio {:.3}",
                ratio
            );
            if ratio < 1.25 {
                return;
            }
            last_ratio = ratio;
        }

        panic!(
            "two runs on an unchanged machine differed by {:.1}% on every one of {} attempts \
             — too noisy to attribute a change to a tweak",
            (last_ratio - 1.0) * 100.0,
            ATTEMPTS
        );
    }
}
