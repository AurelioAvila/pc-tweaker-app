//! How hardware interrupts and DPCs spread across the processors, sampled
//! for a moment without administrator rights.
//!
//! The kernel counts both per processor (`SystemProcessorPerformanceInformation`
//! for interrupts, `SystemInterruptInformation` for DPCs). Two readings a
//! second and a half apart give the rate on each one. When a large share
//! lands on CPU 0, the processor that already does the most housekeeping is
//! also serving the GPU, network and USB controllers: the pattern
//! LatencyMon-style tools flag. Read-only; moving interrupts is not done here.
//! Which driver they come from needs the DPC/ISR trace (`dpc.rs`).
//!
//! Only the processor group of the calling thread is sampled: on machines with
//! more than 64 logical processors the result covers the first group.

use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct InterruptSample {
    pub seconds: f64,
    pub cpus: usize,
    /// Per second, all processors.
    pub interrupts_per_sec: u64,
    pub dpcs_per_sec: u64,
    /// Share handled by CPU 0, 0.0-1.0.
    pub cpu0_interrupt_share: f64,
    pub cpu0_dpc_share: f64,
    /// CPU 0 takes far more than its share of either.
    pub concentrated: bool,
}

/// Share of the total on the first processor, if the sample is big enough to
/// mean anything.
fn cpu0_share(counts: &[u64]) -> f64 {
    let total: u64 = counts.iter().sum();
    if total == 0 {
        return 0.0;
    }
    counts.first().copied().unwrap_or(0) as f64 / total as f64
}

/// The judgement: at least four processors, enough activity to measure, and
/// CPU 0 above 30% and above three times its fair share.
pub fn judge(interrupts: &[u64], dpcs: &[u64], seconds: f64) -> InterruptSample {
    let cpus = interrupts.len();
    let fair = if cpus > 0 { 1.0 / cpus as f64 } else { 1.0 };
    let rate = |c: &[u64]| (c.iter().sum::<u64>() as f64 / seconds.max(0.1)).round() as u64;
    let heavy = |c: &[u64], floor: u64| {
        let share = cpu0_share(c);
        cpus >= 4 && rate(c) >= floor && share >= 0.30 && share >= 3.0 * fair
    };
    InterruptSample {
        seconds,
        cpus,
        interrupts_per_sec: rate(interrupts),
        dpcs_per_sec: rate(dpcs),
        cpu0_interrupt_share: cpu0_share(interrupts),
        cpu0_dpc_share: cpu0_share(dpcs),
        concentrated: heavy(interrupts, 1000) || heavy(dpcs, 300),
    }
}

#[cfg(windows)]
mod native {
    use windows_sys::Wdk::System::SystemInformation::{
        NtQuerySystemInformation, SystemProcessorPerformanceInformation,
    };

    /// `SystemInterruptInformation`, not named by windows-sys.
    const SYSTEM_INTERRUPT_INFORMATION: i32 = 23;

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    #[allow(dead_code)]
    struct ProcessorPerformance {
        idle: i64,
        kernel: i64,
        user: i64,
        dpc_time: i64,
        interrupt_time: i64,
        interrupt_count: u32,
        _pad: u32,
    }

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    #[allow(dead_code)]
    struct Interrupts {
        context_switches: u32,
        dpc_count: u32,
        dpc_rate: u32,
        time_increment: u32,
        dpc_bypass: u32,
        apc_bypass: u32,
    }

    /// One row per processor of the calling thread's group (at most 64);
    /// the kernel says how many it filled.
    fn query<T: Copy + Default>(class: i32) -> Option<Vec<T>> {
        const GROUP_MAX: usize = 64;
        let cpus = GROUP_MAX;
        let mut rows = vec![T::default(); cpus];
        let mut returned = 0u32;
        // SAFETY: `rows` holds `cpus` entries of the layout the class fills.
        let status = unsafe {
            NtQuerySystemInformation(
                class,
                rows.as_mut_ptr().cast(),
                (std::mem::size_of::<T>() * cpus) as u32,
                &mut returned,
            )
        };
        if status < 0 {
            return None;
        }
        rows.truncate(returned as usize / std::mem::size_of::<T>());
        Some(rows)
    }

    pub fn counts() -> Option<(Vec<u64>, Vec<u64>)> {
        let perf = query::<ProcessorPerformance>(SystemProcessorPerformanceInformation)?;
        let irq = query::<Interrupts>(SYSTEM_INTERRUPT_INFORMATION)?;
        Some((
            perf.iter().map(|p| p.interrupt_count as u64).collect(),
            irq.iter().map(|i| i.dpc_count as u64).collect(),
        ))
    }
}

/// Samples for 1.5 seconds. No elevation, no change.
#[tauri::command(async)]
pub fn interrupt_sample() -> Result<InterruptSample, String> {
    #[cfg(windows)]
    {
        let started = std::time::Instant::now();
        let (i0, d0) = native::counts().ok_or("interrupt counters are unavailable")?;
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let (i1, d1) = native::counts().ok_or("interrupt counters are unavailable")?;
        let seconds = started.elapsed().as_secs_f64();
        let delta = |a: &[u64], b: &[u64]| -> Vec<u64> {
            // Counters are 32-bit and wrap.
            a.iter()
                .zip(b)
                .map(|(x, y)| (*y as u32).wrapping_sub(*x as u32) as u64)
                .collect()
        };
        Ok(judge(&delta(&i0, &i1), &delta(&d0, &d1), seconds))
    }
    #[cfg(not(windows))]
    {
        Err("not supported on this platform".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_even_spread_is_not_concentrated() {
        // The maintainer's 16-thread PC: 7% on CPU 0.
        let even = [
            4383, 6016, 2434, 4836, 4329, 6210, 3804, 4436, 4103, 8219, 2731, 3033, 2011, 1961,
            1671, 1257,
        ];
        let s = judge(&even, &[100; 16], 1.5);
        assert!(!s.concentrated);
        assert!(s.cpu0_interrupt_share < 0.1);
    }

    #[test]
    fn cpu0_doing_most_of_the_work_is_concentrated() {
        let mut heavy = [300u64; 8];
        heavy[0] = 9000;
        assert!(judge(&heavy, &[50; 8], 1.0).concentrated);
        // DPCs alone can be the problem.
        let mut dpcs = [20u64; 8];
        dpcs[0] = 2000;
        assert!(judge(&[1000; 8], &dpcs, 1.0).concentrated);
    }

    #[test]
    fn tiny_samples_and_small_machines_are_not_judged() {
        let mut quiet = [1u64; 8];
        quiet[0] = 100;
        assert!(!judge(&quiet, &[0; 8], 1.0).concentrated);
        assert!(!judge(&[9000, 100], &[0, 0], 1.0).concentrated);
        assert_eq!(judge(&[], &[], 1.0).cpu0_interrupt_share, 0.0);
    }

    #[cfg(windows)]
    #[test]
    fn samples_the_live_counters_without_elevation() {
        let s = interrupt_sample().unwrap();
        assert!(s.cpus >= 1 && s.interrupts_per_sec > 0, "{s:?}");
    }
}
