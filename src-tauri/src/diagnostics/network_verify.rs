//! What the network looks like from this machine, measured the same way before
//! and after a TCP tweak, plus the same measurement on demand.
//!
//! Two views, both read from the kernel rather than inferred:
//!
//! - **Link:** 32 ICMP echoes to 1.1.1.1 through `IcmpSendEcho`. Round-trip
//!   times are timed around the call with the high-resolution clock, because
//!   the reply's own `RoundTripTime` is in whole milliseconds. That adds a few
//!   tens of microseconds of local overhead to every sample, the same before
//!   and after. Jitter applies the RFC 3550 smoothing (section 6.4.1,
//!   J += (|D| - J) / 16) to the difference between consecutive round trips.
//!   The RFC defines D over one-way transit with sender timestamps, which ICMP
//!   does not carry, so this is an adaptation of the estimator, not the RTP
//!   metric. It starts at zero, so over 32 samples it reaches about 86% of a
//!   steady jitter: a floor, not the long-run figure.
//! - **TCP:** one live connection to 1.1.1.1:443, read with `getsockopt`
//!   (`SO_RCVBUF`, `SO_SNDBUF`, `TCP_NODELAY`) and `SIO_TCP_INFO` (the stack's
//!   own RTT estimate, MSS, windows and receive buffer). `SO_RCVBUF` is the
//!   fixed per-socket reservation and does not move with receive-window
//!   autotuning; `TCP_INFO.RcvBuf` does. Neither is ever set here, because
//!   setting `SO_RCVBUF` turns autotuning off for that socket.
//!
//! What this deliberately does not claim. ICMP is not TCP, and none of the TCP
//! tweaks here changes how an idle line answers a ping, so a before/after
//! difference is never credited to the tweak. The comparison says "no
//! measurable change" unless a Mann-Whitney U test puts the shift below
//! p = 0.01, the shift is at least 1 ms and the rank test and the medians
//! agree on its direction; then it says the *line* changed between the two
//! readings (a download starting, Wi-Fi changing rate). Echoes 20 ms apart are
//! not independent, so that p-value is a screening threshold, not a result to
//! quote. The socket options show what a new connection actually starts with,
//! which is how to see, for example, that a registry value did not turn Nagle
//! off for ordinary sockets.

use serde::{Deserialize, Serialize};
use std::net::Ipv4Addr;
use std::path::Path;
use std::time::Duration;

const TARGET: Ipv4Addr = Ipv4Addr::new(1, 1, 1, 1);
const ECHOES: usize = 32;
const GAP: Duration = Duration::from_millis(20);
const ECHO_TIMEOUT_MS: u32 = 1000;
/// A stalled line must not hold an apply up: give up after this many losses
/// in a row, or once the whole series has taken this long.
const MAX_CONSECUTIVE_LOSSES: usize = 3;
const SERIES_DEADLINE: Duration = Duration::from_secs(5);
/// Fewer successful replies than this on either side and nothing is compared.
const MIN_REPLIES: usize = 8;
const SIGNIFICANCE: f64 = 0.01;
const PRACTICAL_MS: f64 = 1.0;
const RESULT_FILE: &str = "last_network_verification.json";

/// Mirrors `LinkQuality` in src/types.ts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LinkQuality {
    pub target: String,
    pub sent: u32,
    pub received: u32,
    /// Successful round trips in microseconds, in the order they were taken.
    pub samples_us: Vec<u32>,
    pub min_ms: Option<f64>,
    pub median_ms: Option<f64>,
    pub max_ms: Option<f64>,
    /// RFC 3550 smoothing over consecutive round-trip differences.
    pub jitter_ms: Option<f64>,
}

/// Mirrors `TcpView` in src/types.ts. `None` means Windows did not report it.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TcpView {
    pub so_rcvbuf: Option<u32>,
    pub so_sndbuf: Option<u32>,
    /// `TCP_NODELAY` on a socket nobody configured: false means Nagle is on.
    pub nodelay: Option<bool>,
    /// From `SIO_TCP_INFO` (Windows 10 1703 and later).
    pub rtt_us: Option<u32>,
    pub min_rtt_us: Option<u32>,
    pub mss: Option<u32>,
    pub rcv_wnd: Option<u32>,
    pub snd_wnd: Option<u32>,
    /// The autotuned receive buffer, as opposed to `so_rcvbuf`.
    pub rcv_buf: Option<u32>,
}

/// Mirrors `NetworkSnapshot` in src/types.ts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSnapshot {
    pub online: bool,
    pub link: LinkQuality,
    pub tcp: Option<TcpView>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Verdict {
    NoMeasurableChange,
    /// The round trips moved clearly between the two readings. Ping does not
    /// go through TCP settings, so this is the line, not the tweak.
    LineChanged,
    /// Too few replies on one side to compare anything.
    Inconclusive,
}

/// Mirrors `NetworkVerification` in src/types.ts.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkVerification {
    pub tweak_id: String,
    /// Unix time in milliseconds when the "after" reading finished.
    #[serde(default)]
    pub measured_at: u64,
    pub before: NetworkSnapshot,
    pub after: NetworkSnapshot,
    pub latency: Verdict,
    /// After minus before, in milliseconds. Negative is faster.
    pub median_delta_ms: Option<f64>,
    /// Two-sided Mann-Whitney U p-value for the two RTT samples.
    pub p_value: Option<f64>,
}

pub fn summarize(target: Ipv4Addr, samples: &[Option<u32>]) -> LinkQuality {
    let received: Vec<u32> = samples.iter().flatten().copied().collect();
    let mut sorted = received.clone();
    sorted.sort_unstable();
    let ms = |us: u32| f64::from(us) / 1000.0;
    LinkQuality {
        target: target.to_string(),
        sent: samples.len() as u32,
        received: received.len() as u32,
        min_ms: sorted.first().map(|v| ms(*v)),
        median_ms: median(&sorted.iter().map(|v| ms(*v)).collect::<Vec<_>>()),
        max_ms: sorted.last().map(|v| ms(*v)),
        jitter_ms: rfc3550_jitter(&received).map(|j| j / 1000.0),
        samples_us: received,
    }
}

/// RFC 3550 6.4.1: J(i) = J(i-1) + (|D(i-1,i)| - J(i-1)) / 16, with D taken
/// as the difference between consecutive round-trip times.
pub fn rfc3550_jitter(samples: &[u32]) -> Option<f64> {
    if samples.len() < 2 {
        return None;
    }
    Some(samples.windows(2).fold(0.0, |j, pair| {
        let d = (f64::from(pair[1]) - f64::from(pair[0])).abs();
        j + (d - j) / 16.0
    }))
}

fn median(sorted: &[f64]) -> Option<f64> {
    let n = sorted.len();
    match n {
        0 => None,
        _ if n % 2 == 1 => Some(sorted[n / 2]),
        _ => Some((sorted[n / 2 - 1] + sorted[n / 2]) / 2.0),
    }
}

/// Two-sided p-value of the Mann-Whitney U test, normal approximation with
/// tie and continuity correction, plus which way the ranks lean: positive
/// when `b` tends to be the larger sample. Adequate from about eight a side.
pub fn mann_whitney(a: &[f64], b: &[f64]) -> Option<(f64, f64)> {
    let (n1, n2) = (a.len() as f64, b.len() as f64);
    if a.is_empty() || b.is_empty() {
        return None;
    }
    let mut all: Vec<(f64, bool)> = a
        .iter()
        .map(|v| (*v, true))
        .chain(b.iter().map(|v| (*v, false)))
        .collect();
    all.sort_by(|x, y| x.0.total_cmp(&y.0));
    let n = all.len();
    let (mut rank_a, mut ties) = (0.0, 0.0);
    let mut i = 0;
    while i < n {
        let mut j = i;
        while j + 1 < n && all[j + 1].0 == all[i].0 {
            j += 1;
        }
        let average = (i + j) as f64 / 2.0 + 1.0;
        let t = (j - i + 1) as f64;
        ties += t * t * t - t;
        rank_a += all[i..=j].iter().filter(|x| x.1).count() as f64 * average;
        i = j + 1;
    }
    let u = rank_a - n1 * (n1 + 1.0) / 2.0;
    let total = n1 + n2;
    let variance = n1 * n2 / 12.0 * ((total + 1.0) - ties / (total * (total - 1.0)));
    let lean = n1 * n2 / 2.0 - u;
    if variance <= 0.0 {
        return Some((1.0, 0.0));
    }
    let z = (lean.abs() - 0.5).max(0.0) / variance.sqrt();
    Some((erfc(z / std::f64::consts::SQRT_2).min(1.0), lean))
}

/// Complementary error function, Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
fn erfc(x: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.327_591_1 * x.abs());
    let poly = t
        * (0.254_829_592
            + t * (-0.284_496_736 + t * (1.421_413_741 + t * (-1.453_152_027 + t * 1.061_405_429))));
    let value = poly * (-x * x).exp();
    if x >= 0.0 {
        value
    } else {
        2.0 - value
    }
}

pub fn enough_replies(link: &LinkQuality) -> bool {
    link.samples_us.len() >= MIN_REPLIES
}

pub fn compare(
    tweak_id: &str,
    measured_at: u64,
    before: NetworkSnapshot,
    after: NetworkSnapshot,
) -> NetworkVerification {
    let ms = |l: &LinkQuality| -> Vec<f64> {
        l.samples_us.iter().map(|v| f64::from(*v) / 1000.0).collect()
    };
    let (a, b) = (ms(&before.link), ms(&after.link));
    let enough = enough_replies(&before.link) && enough_replies(&after.link);
    let test = if enough { mann_whitney(&a, &b) } else { None };
    let median_delta_ms = match (after.link.median_ms, before.link.median_ms) {
        (Some(after), Some(before)) if enough => Some(after - before),
        _ => None,
    };
    let latency = match (test, median_delta_ms) {
        // Significant, large enough to matter, and the ranks lean the same
        // way as the medians moved. Bimodal Wi-Fi samples can make those two
        // disagree, and then nothing is claimed.
        (Some((p, lean)), Some(delta))
            if p < SIGNIFICANCE && delta.abs() >= PRACTICAL_MS && (lean > 0.0) == (delta > 0.0) =>
        {
            Verdict::LineChanged
        }
        (Some(_), Some(_)) => Verdict::NoMeasurableChange,
        _ => Verdict::Inconclusive,
    };
    NetworkVerification {
        tweak_id: tweak_id.to_string(),
        measured_at,
        before,
        after,
        latency,
        median_delta_ms,
        p_value: test.map(|(p, _)| p),
    }
}

pub fn save(app_data_dir: &Path, verification: &NetworkVerification) {
    // Diagnostic output only: a failed write loses a report, never a setting.
    if let Ok(json) = serde_json::to_vec_pretty(verification) {
        let _ = std::fs::create_dir_all(app_data_dir);
        let _ = std::fs::write(app_data_dir.join(RESULT_FILE), json);
    }
}

fn load(app_data_dir: &Path) -> Option<NetworkVerification> {
    let raw = std::fs::read(app_data_dir.join(RESULT_FILE)).ok()?;
    serde_json::from_slice(&raw).ok()
}

/// A full measurement: about a second of echoes plus one TCP connection.
#[cfg(windows)]
pub fn measure() -> NetworkSnapshot {
    let tcp = native::tcp_view(TARGET);
    NetworkSnapshot {
        // The TCP connection answers "online" for free; the netcheck probes
        // (with their DNS fallback) only run when 1.1.1.1 is unreachable.
        online: tcp.is_some() || crate::netcheck::online(),
        link: summarize(TARGET, &native::echo_series(TARGET)),
        tcp,
    }
}

#[cfg(not(windows))]
pub fn measure() -> NetworkSnapshot {
    NetworkSnapshot {
        online: false,
        link: summarize(TARGET, &[]),
        tcp: None,
    }
}

#[cfg(windows)]
pub use native::internet_interface_guid;

/// The same measurement the apply funnel takes, on demand.
#[tauri::command]
pub async fn verify_network() -> Result<NetworkSnapshot, String> {
    tauri::async_runtime::spawn_blocking(measure)
        .await
        .map_err(|e| format!("the network check did not finish: {e}"))
}

/// The before/after record of the most recent TCP tweak, if there is one. The
/// elevated helper writes it, so it is read from disk rather than returned.
#[tauri::command(async)]
pub fn last_network_verification(
    app: tauri::AppHandle,
) -> Result<Option<NetworkVerification>, String> {
    Ok(load(&crate::store_for_dir(&app)?))
}

#[cfg(windows)]
mod native {
    use super::*;
    use std::mem::{size_of, zeroed};
    use std::os::windows::io::AsRawSocket;
    use std::time::Instant;
    use windows_sys::core::GUID;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        ConvertInterfaceIndexToLuid, ConvertInterfaceLuidToGuid, GetBestInterfaceEx,
        IcmpCloseHandle, IcmpCreateFile, IcmpSendEcho, ICMP_ECHO_REPLY, IP_SUCCESS,
    };
    use windows_sys::Win32::NetworkManagement::Ndis::NET_LUID_LH;
    use windows_sys::Win32::Networking::WinSock::{
        getsockopt, WSAIoctl, AF_INET, SIO_TCP_INFO, SOCKADDR, SOCKADDR_IN, SOCKET, SOL_SOCKET,
        SO_RCVBUF, SO_SNDBUF, TCP_INFO_v0,
    };

    /// GUID of the adapter Windows would use to reach the internet, formatted
    /// the way `Get-NetAdapter` prints it (the registry compares it
    /// case-insensitively).
    pub fn internet_interface_guid() -> Result<String, String> {
        // SAFETY: SOCKADDR_IN is plain integers; all-zero is a valid value.
        let mut destination: SOCKADDR_IN = unsafe { zeroed() };
        destination.sin_family = AF_INET;
        destination.sin_addr.S_un.S_addr = u32::from_ne_bytes(TARGET.octets());
        let mut index = 0u32;
        // SAFETY: `destination` is a live, initialised AF_INET address and
        // `index` a live out-parameter; both outlive the call.
        let code = unsafe {
            GetBestInterfaceEx(
                &destination as *const SOCKADDR_IN as *const SOCKADDR,
                &mut index,
            )
        };
        if code != 0 {
            return Err(format!(
                "no network adapter has a route to the internet (error {code})"
            ));
        }
        // SAFETY: plain-integer union and struct; zero is valid for both.
        let mut luid: NET_LUID_LH = unsafe { zeroed() };
        let mut guid: GUID = unsafe { zeroed() };
        // SAFETY: both out-pointers refer to live locals of the right type.
        let code = unsafe { ConvertInterfaceIndexToLuid(index, &mut luid) };
        if code != 0 {
            return Err(format!("could not identify the network adapter (error {code})"));
        }
        // SAFETY: as above; `luid` was filled in by the previous call.
        let code = unsafe { ConvertInterfaceLuidToGuid(&luid, &mut guid) };
        if code != 0 {
            return Err(format!("could not identify the network adapter (error {code})"));
        }
        let d = guid.data4;
        Ok(format!(
            "{{{:08X}-{:04X}-{:04X}-{:02X}{:02X}-{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}}}",
            guid.data1, guid.data2, guid.data3, d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7]
        ))
    }

    struct Icmp(HANDLE);

    impl Drop for Icmp {
        fn drop(&mut self) {
            // SAFETY: the handle came from IcmpCreateFile and is closed once.
            unsafe { IcmpCloseHandle(self.0) };
        }
    }

    /// Up to `ECHOES` round trips, `None` for each one that got no valid
    /// reply. Stops after three losses in a row or five seconds in all: a
    /// stalled or offline line must not hold an apply up for half a minute.
    pub fn echo_series(target: Ipv4Addr) -> Vec<Option<u32>> {
        // SAFETY: no arguments; the result is checked before use.
        let handle = unsafe { IcmpCreateFile() };
        if handle.is_null() || handle as isize == -1 {
            return Vec::new();
        }
        let icmp = Icmp(handle);
        let address = u32::from_ne_bytes(target.octets());
        let payload = [0x50u8; 32];
        // u64 storage keeps the reply 8-byte aligned. 256 bytes covers the
        // documented minimum: the reply structure, the echoed payload, 8 bytes
        // for an ICMP error and room for an IO_STATUS_BLOCK.
        let mut reply = [0u64; 32];
        let mut samples = Vec::with_capacity(ECHOES);
        let series = Instant::now();
        for i in 0..ECHOES {
            if i > 0 {
                std::thread::sleep(GAP);
            }
            if series.elapsed() > SERIES_DEADLINE {
                break;
            }
            let started = Instant::now();
            // SAFETY: the handle is open, `payload` and `reply` are live
            // buffers of the sizes passed, and no options are supplied.
            let count = unsafe {
                IcmpSendEcho(
                    icmp.0,
                    address,
                    payload.as_ptr().cast(),
                    payload.len() as u16,
                    std::ptr::null(),
                    reply.as_mut_ptr().cast(),
                    size_of::<[u64; 32]>() as u32,
                    ECHO_TIMEOUT_MS,
                )
            };
            let elapsed = started.elapsed();
            let ok = count > 0 && {
                // SAFETY: a non-zero count means Windows wrote at least one
                // ICMP_ECHO_REPLY at the start of `reply`, which is aligned
                // and larger than the structure.
                let first: ICMP_ECHO_REPLY = unsafe { std::ptr::read(reply.as_ptr().cast()) };
                first.Status == IP_SUCCESS
            };
            samples.push(ok.then(|| elapsed.as_micros().min(u128::from(u32::MAX)) as u32));
            if samples.len() >= MAX_CONSECUTIVE_LOSSES
                && samples[samples.len() - MAX_CONSECUTIVE_LOSSES..]
                    .iter()
                    .all(Option::is_none)
            {
                break;
            }
        }
        samples
    }

    fn int_option(socket: SOCKET, name: i32) -> Option<u32> {
        let mut value = 0i32;
        let mut length = size_of::<i32>() as i32;
        // SAFETY: `socket` is open for the duration of the call and `value` is
        // a live i32 whose size is passed in `length`.
        let code = unsafe {
            getsockopt(
                socket,
                SOL_SOCKET,
                name,
                (&mut value as *mut i32).cast(),
                &mut length,
            )
        };
        (code == 0 && value >= 0).then_some(value as u32)
    }

    pub fn tcp_view(target: Ipv4Addr) -> Option<TcpView> {
        let stream = std::net::TcpStream::connect_timeout(
            &std::net::SocketAddr::from((target, 443)),
            Duration::from_secs(2),
        )
        .ok()?;
        let socket = stream.as_raw_socket() as SOCKET;
        let mut view = TcpView {
            so_rcvbuf: int_option(socket, SO_RCVBUF),
            so_sndbuf: int_option(socket, SO_SNDBUF),
            nodelay: stream.nodelay().ok(),
            ..TcpView::default()
        };
        let version = 0u32;
        // SAFETY: TCP_INFO_v0 is plain integers; zero is a valid value.
        let mut info: TCP_INFO_v0 = unsafe { zeroed() };
        let mut returned = 0u32;
        // SAFETY: synchronous call (no OVERLAPPED, no completion routine) on
        // an open socket; input and output point at live values of the sizes
        // passed.
        let code = unsafe {
            WSAIoctl(
                socket,
                SIO_TCP_INFO,
                (&version as *const u32).cast(),
                size_of::<u32>() as u32,
                (&mut info as *mut TCP_INFO_v0).cast(),
                size_of::<TCP_INFO_v0>() as u32,
                &mut returned,
                std::ptr::null_mut(),
                None,
            )
        };
        if code == 0 && returned as usize >= size_of::<TCP_INFO_v0>() {
            view.rtt_us = Some(info.RttUs);
            view.min_rtt_us = Some(info.MinRttUs);
            view.mss = Some(info.Mss);
            view.rcv_wnd = Some(info.RcvWnd);
            view.snd_wnd = Some(info.SndWnd);
            view.rcv_buf = Some(info.RcvBuf);
        }
        Some(view)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn link(samples_ms: &[f64]) -> LinkQuality {
        let samples: Vec<Option<u32>> = samples_ms
            .iter()
            .map(|ms| Some((ms * 1000.0) as u32))
            .collect();
        summarize(TARGET, &samples)
    }

    fn snapshot(samples_ms: &[f64]) -> NetworkSnapshot {
        NetworkSnapshot {
            online: true,
            link: link(samples_ms),
            tcp: None,
        }
    }

    #[test]
    fn jitter_follows_the_rfc_3550_recurrence() {
        assert_eq!(rfc3550_jitter(&[5000]), None);
        assert_eq!(rfc3550_jitter(&[5000, 5000, 5000]), Some(0.0));
        // One step of 1600 us: J = 0 + (1600 - 0) / 16 = 100.
        assert_eq!(rfc3550_jitter(&[1000, 2600]), Some(100.0));
        // Second step of 0: J = 100 + (0 - 100) / 16 = 93.75.
        assert_eq!(rfc3550_jitter(&[1000, 2600, 2600]), Some(93.75));
    }

    #[test]
    fn a_summary_counts_losses_and_ignores_them_in_the_statistics() {
        let quality = summarize(TARGET, &[Some(10_000), None, Some(30_000), Some(20_000)]);
        assert_eq!((quality.sent, quality.received), (4, 3));
        assert_eq!(quality.min_ms, Some(10.0));
        assert_eq!(quality.median_ms, Some(20.0));
        assert_eq!(quality.max_ms, Some(30.0));
        assert_eq!(quality.samples_us, vec![10_000, 30_000, 20_000]);
        let empty = summarize(TARGET, &[None, None]);
        assert_eq!((empty.median_ms, empty.jitter_ms), (None, None));
    }

    #[test]
    fn mann_whitney_matches_a_textbook_case_and_handles_ties() {
        // Fully separated samples of 8: U = 0, so z = (32 - 0.5) / sqrt(8*8*17/12)
        // = 3.309 and the two-sided p is about 0.00094.
        let a: Vec<f64> = (1..=8).map(f64::from).collect();
        let b: Vec<f64> = (9..=16).map(f64::from).collect();
        let (p, lean) = mann_whitney(&a, &b).unwrap();
        assert!((p - 0.000_94).abs() < 0.000_05, "{p}");
        assert!(lean > 0.0, "b is the larger sample");
        assert!(mann_whitney(&b, &a).unwrap().1 < 0.0);
        // Identical samples carry no evidence at all.
        assert_eq!(mann_whitney(&[5.0; 10], &[5.0; 10]), Some((1.0, 0.0)));
        assert!(mann_whitney(&a, &a).unwrap().0 > 0.9);
        assert_eq!(mann_whitney(&[], &a), None);
    }

    #[test]
    fn noise_is_reported_as_no_measurable_change() {
        let before: Vec<f64> = (0..32).map(|i| 20.0 + f64::from(i % 5) * 0.3).collect();
        let after: Vec<f64> = (0..32).map(|i| 20.1 + f64::from(i % 5) * 0.3).collect();
        let verdict = compare("network_latency", 1, snapshot(&before), snapshot(&after));
        assert_eq!(verdict.latency, Verdict::NoMeasurableChange);
    }

    #[test]
    fn a_large_significant_shift_is_called_a_change_in_the_line_either_way() {
        let slow: Vec<f64> = (0..32).map(|i| 30.0 + f64::from(i % 4)).collect();
        let fast: Vec<f64> = (0..32).map(|i| 20.0 + f64::from(i % 4)).collect();
        let faster = compare("x", 1, snapshot(&slow), snapshot(&fast));
        assert_eq!(faster.latency, Verdict::LineChanged);
        assert!(faster.median_delta_ms.unwrap() < -9.0);
        let slower = compare("x", 1, snapshot(&fast), snapshot(&slow));
        assert_eq!(slower.latency, Verdict::LineChanged);
        assert!(slower.median_delta_ms.unwrap() > 9.0);
    }

    #[test]
    fn ranks_and_medians_that_disagree_claim_nothing() {
        // Bimodal Wi-Fi: the median drops by 5 ms while the ranks say the
        // later sample is slower (p about 0.0009).
        let before: Vec<f64> = [vec![10.0; 16], vec![30.0; 16]].concat();
        let after: Vec<f64> = [vec![15.0; 17], vec![40.0; 15]].concat();
        let verdict = compare("x", 1, snapshot(&before), snapshot(&after));
        assert!(verdict.p_value.unwrap() < SIGNIFICANCE);
        assert!(verdict.median_delta_ms.unwrap() < -1.0);
        assert_eq!(verdict.latency, Verdict::NoMeasurableChange);
    }

    #[test]
    fn a_significant_but_sub_millisecond_shift_is_not_called_a_change() {
        let before: Vec<f64> = (0..32).map(|i| 10.0 + f64::from(i) * 0.001).collect();
        let after: Vec<f64> = (0..32).map(|i| 10.5 + f64::from(i) * 0.001).collect();
        let verdict = compare("x", 1, snapshot(&before), snapshot(&after));
        assert!(verdict.p_value.unwrap() < SIGNIFICANCE);
        assert_eq!(verdict.latency, Verdict::NoMeasurableChange);
    }

    #[test]
    fn too_few_replies_on_either_side_are_inconclusive() {
        let full: Vec<f64> = vec![20.0; 32];
        let sparse: Vec<f64> = vec![20.0; MIN_REPLIES - 1];
        let verdict = compare("x", 1, snapshot(&full), snapshot(&sparse));
        assert_eq!(verdict.latency, Verdict::Inconclusive);
        assert_eq!((verdict.p_value, verdict.median_delta_ms), (None, None));
    }

    /// Real echoes and a real connection: `cargo test --lib
    /// network_verify::tests::live -- --ignored --nocapture`. Needs internet.
    #[cfg(windows)]
    #[test]
    #[ignore = "sends ICMP echoes and opens a TCP connection to 1.1.1.1"]
    fn live_measurement_reads_the_link_and_the_tcp_stack() {
        let snapshot = measure();
        println!("{}", serde_json::to_string_pretty(&snapshot).unwrap());
        assert!(snapshot.online);
        assert!(snapshot.link.received >= MIN_REPLIES as u32);
        let tcp = snapshot.tcp.expect("no TCP view");
        assert!(tcp.rtt_us.is_some() && tcp.so_rcvbuf.is_some() && tcp.nodelay.is_some());
        let guid = internet_interface_guid().unwrap();
        assert!(crate::rollback::valid_guid(&guid), "{guid}");
    }

    #[test]
    fn a_verification_survives_the_trip_through_disk() {
        let dir = std::env::temp_dir().join(format!("pct-netverify-{}", std::process::id()));
        let record = compare("tcp_congestion_bbr", 7, snapshot(&[20.0; 9]), snapshot(&[21.0; 9]));
        save(&dir, &record);
        assert_eq!(load(&dir), Some(record));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The field names and enum strings src/types.ts is written against.
    #[test]
    fn the_wire_format_matches_the_typescript_contract() {
        let mut before = snapshot(&[20.0; 9]);
        before.tcp = Some(TcpView::default());
        let record = compare("network_latency", 42, before, snapshot(&[20.0; 9]));
        let json = serde_json::to_value(&record).unwrap();
        let mut keys: Vec<_> = json.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        assert_eq!(keys, ["after", "before", "latency", "measuredAt", "medianDeltaMs", "pValue", "tweakId"]);
        assert_eq!(json["latency"], "noMeasurableChange");
        assert_eq!(serde_json::to_value(Verdict::LineChanged).unwrap(), "lineChanged");
        assert_eq!(serde_json::to_value(Verdict::Inconclusive).unwrap(), "inconclusive");
        for key in ["online", "link", "tcp"] {
            assert!(json["before"].get(key).is_some(), "{key}");
        }
        for key in ["target", "sent", "received", "samplesUs", "minMs", "medianMs", "maxMs", "jitterMs"] {
            assert!(json["before"]["link"].get(key).is_some(), "{key}");
        }
        for key in ["soRcvbuf", "soSndbuf", "nodelay", "rttUs", "minRttUs", "mss", "rcvWnd", "sndWnd", "rcvBuf"] {
            assert!(json["before"]["tcp"].get(key).is_some(), "{key}");
        }
    }
}
