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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_benchmark_produces_a_usable_score() {
        let r = run_for(300);
        println!("score {} iterations/ms over {} ms", r.score, r.duration_ms);
        assert!(r.score > 0, "score must be positive");
        assert!(r.duration_ms >= 300, "should have run for at least its budget");
    }

    /// Two runs back to back on an unchanged machine must land close together.
    /// If they don't, the workload is too noisy to attribute a difference to a
    /// tweak — which would turn the whole feature into a random number
    /// generator with a confident label on it.
    #[test]
    fn repeated_runs_agree_closely_enough_to_compare() {
        let a = run_for(400).score as f64;
        let b = run_for(400).score as f64;
        let ratio = a.max(b) / a.min(b);
        println!("run-to-run ratio: {:.3}", ratio);
        assert!(
            ratio < 1.25,
            "two runs on an unchanged machine differed by {:.1}% — too noisy to \
             attribute a change to a tweak",
            (ratio - 1.0) * 100.0
        );
    }
}
