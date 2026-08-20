//! The processor's rated clock, for the Turbo Boost panel.
//!
//! ## This deliberately does not report a *live* clock
//!
//! The original plan was a needle tracking the real frequency, so the user
//! could watch the CPU climb past base when boost engaged. Two sources were
//! measured and both turned out to be unusable for that:
//!
//! - `sysinfo` returned 4201 MHz on every sample on the maintainer's 7800X3D
//!   — the rated base clock, never the current one.
//! - `CallNtPowerInformation`'s `CurrentMhz` returned the same constant, even
//!   with the plan's minimum processor state at 5% so the CPU was free to
//!   drop. On processors that manage their own P-states (CPPC, i.e. anything
//!   recent from AMD or Intel) Windows is no longer the one choosing the
//!   frequency, so what it reports is nominal rather than measured.
//!
//! `Win32_PerfFormattedData_Counters_ProcessorInformation` *is* genuinely
//! live, but reading it means a WMI round trip several times a second, which
//! is far too heavy to drive a gauge.
//!
//! So this exposes only `max_mhz`, which is a fact worth showing, and the
//! gauge is driven by CPU load — a number this app already samples and which
//! is unambiguously live. Publishing a nominal frequency as if it were a
//! live reading would be exactly the dressed-up-constant that the rest of this
//! codebase refuses to ship.

use serde::Serialize;

#[derive(Serialize, Clone, Copy, Debug, Default)]
pub struct CpuClock {
    /// The processor's rated maximum, in MHz. A fact, not a live reading —
    /// see the module docs for why no live figure is exposed here.
    pub max_mhz: u32,
}

#[cfg(windows)]
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct ProcessorPowerInformation {
    number: u32,
    max_mhz: u32,
    current_mhz: u32,
    mhz_limit: u32,
    max_idle_state: u32,
    current_idle_state: u32,
}

#[cfg(windows)]
extern "system" {
    /// `POWER_INFORMATION_LEVEL::ProcessorInformation` is 11. Declared by hand
    /// rather than pulling in the whole `windows` crate for one call.
    fn CallNtPowerInformation(
        information_level: i32,
        input_buffer: *mut core::ffi::c_void,
        input_buffer_length: u32,
        output_buffer: *mut core::ffi::c_void,
        output_buffer_length: u32,
    ) -> i32;
}

#[cfg(windows)]
const PROCESSOR_INFORMATION: i32 = 11;

/// Reads the current clock, or `None` when the call fails or reports nothing
/// usable. Callers show nothing rather than a zero.
#[cfg(windows)]
pub fn read() -> Option<CpuClock> {
    let count = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let mut buffer = vec![ProcessorPowerInformation::default(); count];
    let bytes = std::mem::size_of::<ProcessorPowerInformation>() * count;

    // SAFETY: the buffer is exactly `count` structs long and `bytes` describes
    // it correctly; the callee only writes within that length. A non-zero
    // return means it wrote nothing, which is handled below.
    let status = unsafe {
        CallNtPowerInformation(
            PROCESSOR_INFORMATION,
            std::ptr::null_mut(),
            0,
            buffer.as_mut_ptr() as *mut core::ffi::c_void,
            bytes as u32,
        )
    };
    if status != 0 {
        return None;
    }

    // Averaged across cores: individual cores park and boost independently, so
    // a single core's reading jitters in a way that looks like noise rather
    // than like the machine's state.
    let live: Vec<&ProcessorPowerInformation> =
        buffer.iter().filter(|p| p.current_mhz > 0).collect();
    if live.is_empty() {
        return None;
    }

    let max = live.iter().map(|p| p.max_mhz).max().unwrap_or(0);
    if max == 0 {
        return None;
    }

    Some(CpuClock { max_mhz: max })
}

#[cfg(not(windows))]
pub fn read() -> Option<CpuClock> {
    None
}

#[tauri::command]
pub fn cpu_clock() -> Option<CpuClock> {
    read()
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn the_rated_clock_is_readable_and_plausible() {
        let clock = read().expect("CallNtPowerInformation returned nothing");
        println!("rated max: {} MHz", clock.max_mhz);
        assert!(
            clock.max_mhz > 500 && clock.max_mhz < 12_000,
            "implausible rated clock: {} MHz",
            clock.max_mhz
        );
    }

    /// Guards the decision recorded in the module docs. Both frequency sources
    /// tried here report a nominal constant on CPPC processors, so a
    /// `current_mhz` field would put a fixed number on screen labelled as
    /// live. If someone adds one back, this fails and sends them to the docs.
    #[test]
    fn no_live_frequency_field_is_exposed() {
        let json = serde_json::to_string(&read().unwrap_or_default()).unwrap();
        assert!(
            !json.contains("current_mhz"),
            "CpuClock gained a live-looking frequency field: {}. Windows reports a              nominal value on CPPC hardware — drive the gauge from CPU load instead.",
            json
        );
    }
}
