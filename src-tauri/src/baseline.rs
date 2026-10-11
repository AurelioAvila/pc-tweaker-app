//! Before & After — repeatable measurements of things PC Tweaker can actually
//! influence, compared only against another run on the SAME machine.
//!
//! What is measured and why it is fair game:
//! - **Timed tests, seven repetitions or more** (median reported): the `cpubench`
//!   workload (power plan, boost, power throttling), allocating and touching
//!   256 MB (memory pressure), writing 16 MB to the system disk and reading
//!   4 KB blocks back past the file cache (free space, background disk
//!   activity), and starting the Windows command processor (background load,
//!   real-time scanning).
//! - **Readings taken once**: processes running, apps starting with Windows,
//!   memory in use and free space on the system drive. These are counts, not
//!   estimates; they move with debloat, startup, service and cleanup changes.
//!
//! The comparison is deliberately conservative. A timed test is called
//! better or worse only when an exact rank test puts the two sets of
//! repetitions apart (p < 0.01), the medians moved at least 5% and both agree
//! on the direction. Anything else is "no significant change": a difference
//! inside the normal run-to-run variation is never reported as a result.
//!
//! Every run is appended to a local JSONL history (app data dir, nothing
//! leaves the machine) so a comparison survives restarts.

use serde::{Deserialize, Serialize};
use std::io::{Read, Seek, SeekFrom, Write};
use std::time::Instant;

/// Repetitions per timed test. Seven a side is the smallest count at which
/// the exact rank test can reach p < 0.01 with a little overlap allowed.
pub const REPEATS: usize = 7;
const LAUNCH_REPEATS: usize = 11;
const SIGNIFICANCE: f64 = 0.01;
const MIN_SAMPLES: usize = 5;
const HISTORY_CAP: usize = 50;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Before,
    After,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Metric {
    pub id: String,
    /// One value per repetition for a timed test, one value for a reading.
    pub samples: Vec<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BaselineRun {
    /// Unix seconds.
    pub ts: u64,
    // The four single-shot figures every run has carried since 1.1.0. Older
    // rows have nothing else and are kept readable, but never compared: one
    // shot per test cannot tell a change from noise.
    pub cpu_score: u64,
    pub memory_touch_ms: u64,
    pub disk_write_ms: u64,
    pub disk_random_read_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<Role>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub metrics: Vec<Metric>,
    /// When Windows last started, Unix seconds, so a restart between two
    /// measurements is never mistaken for the effect of a tweak.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub boot_ts: Option<u64>,
}

impl BaselineRun {
    fn metric(&self, id: &str) -> Option<&[f64]> {
        self.metrics
            .iter()
            .find(|m| m.id == id)
            .map(|m| m.samples.as_slice())
    }
}

/// How one metric is judged. Readings have no spread of their own, so a
/// change needs to clear a fixed floor instead of a test.
struct Spec {
    higher_is_better: bool,
    timed: bool,
    min_relative: f64,
    min_absolute: f64,
    min_samples: usize,
    alpha: f64,
}

fn spec(id: &str) -> Option<Spec> {
    let timed = |higher_is_better| Spec {
        higher_is_better,
        timed: true,
        min_relative: 0.05,
        min_absolute: 0.0,
        min_samples: MIN_SAMPLES,
        alpha: SIGNIFICANCE,
    };
    let reading = |higher_is_better, min_relative, min_absolute| Spec {
        higher_is_better,
        timed: false,
        min_relative,
        min_absolute,
        min_samples: 1,
        alpha: SIGNIFICANCE,
    };
    Some(match id {
        "cpu" => timed(true),
        "memory_touch_ms" | "disk_write_ms" | "disk_read_us" | "launch_ms" => timed(false),
        // Restarts are few and each one is a single sample, so the bar is
        // the conventional p < 0.05 with four a side (complete separation
        // gives p = 0.029), plus at least one second and 5%.
        "boot_ms" => Spec {
            min_absolute: 1000.0,
            min_samples: 4,
            alpha: 0.05,
            ..timed(false)
        },
        // A handful of processes come and go on their own (updaters, the
        // search indexer), so three or 3% is the floor.
        "processes" => reading(false, 0.03, 3.0),
        "startup_apps" => reading(false, 0.0, 1.0),
        "memory_used_mb" => reading(false, 0.05, 250.0),
        "disk_free_mb" => reading(true, 0.0, 100.0),
        _ => return None,
    })
}

// ---------------------------------------------------------------------------
// Measurements

fn memory_touch() -> f64 {
    const SIZE: usize = 256 * 1024 * 1024;
    const PAGE: usize = 4096;
    let start = Instant::now();
    let mut buffer = vec![0u8; SIZE];
    let mut index = 0usize;
    while index < SIZE {
        buffer[index] = (index as u8).wrapping_add(1);
        index += PAGE;
    }
    std::hint::black_box(&buffer);
    start.elapsed().as_secs_f64() * 1000.0
}

/// Writes 16 MB to a fresh temp file and flushes it, then reads 64 random
/// 4 KB blocks with the file cache bypassed, so the reads reach the disk
/// rather than memory the write just filled. Returns (write ms, µs per read).
fn disk_round() -> Result<(f64, f64), String> {
    const SIZE: usize = 16 * 1024 * 1024;
    const BLOCK: usize = 4096;
    const READS: u32 = 64;
    // A fresh name, created exclusively: a fixed name in %TEMP% could already
    // exist as a link, and writing through it would overwrite its target.
    let path = std::env::temp_dir().join(format!(
        "pctweaker-baseline-{}-{}.bin",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |d| d.as_nanos())
    ));
    let result = (|| {
        let chunk = vec![0xA5u8; 1024 * 1024];
        let write_start = Instant::now();
        {
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .map_err(|e| e.to_string())?;
            for _ in 0..(SIZE / chunk.len()) {
                file.write_all(&chunk).map_err(|e| e.to_string())?;
            }
            file.sync_all().map_err(|e| e.to_string())?;
        }
        let write_ms = write_start.elapsed().as_secs_f64() * 1000.0;

        let mut options = std::fs::OpenOptions::new();
        options.read(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.custom_flags(windows_sys::Win32::Storage::FileSystem::FILE_FLAG_NO_BUFFERING);
        }
        let mut file = options.open(&path).map_err(|e| e.to_string())?;
        // Unbuffered reads need a sector-aligned buffer: take an aligned
        // 4 KB window out of a slightly larger allocation.
        let mut raw = vec![0u8; BLOCK * 2];
        let offset = raw.as_ptr().align_offset(BLOCK);
        if offset >= BLOCK {
            return Err("could not align the read buffer".into());
        }
        let page = &mut raw[offset..offset + BLOCK];
        // Deterministic pseudo-random offsets: repeatability beats randomness.
        let mut state: u64 = 0x1234_5678_9abc_def0;
        let read_start = Instant::now();
        for _ in 0..READS {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            let at = (state % (SIZE - BLOCK) as u64) & !(BLOCK as u64 - 1);
            file.seek(SeekFrom::Start(at)).map_err(|e| e.to_string())?;
            file.read_exact(page).map_err(|e| e.to_string())?;
            std::hint::black_box(&page);
        }
        let read_us = read_start.elapsed().as_secs_f64() * 1_000_000.0 / f64::from(READS);
        Ok((write_ms, read_us))
    })();
    let _ = std::fs::remove_file(&path);
    result
}

/// Time to start the Windows command processor and have it exit: process
/// creation, image load and any real-time scanning on the way.
#[cfg(windows)]
fn launch_ms() -> Option<f64> {
    use std::process::Stdio;
    crate::system_tools::run("cmd", |command| {
        command
            .args(["/C", "exit"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let start = Instant::now();
        let status = command.status()?;
        Ok(status
            .success()
            .then(|| start.elapsed().as_secs_f64() * 1000.0))
    })
    .ok()
    .flatten()
}

#[cfg(not(windows))]
fn launch_ms() -> Option<f64> {
    None
}

/// Processes, startup apps, memory in use and free space, read before any
/// timed test runs so the tests' own allocations and processes are not in
/// them.
fn readings() -> Vec<Metric> {
    let mut out = Vec::new();
    let mut push = |id: &str, value: Option<f64>| {
        if let Some(v) = value {
            out.push(Metric {
                id: id.into(),
                samples: vec![v],
            });
        }
    };
    push(
        "processes",
        crate::process_guard::processes()
            .ok()
            .map(|p| p.len() as f64),
    );
    push(
        "startup_apps",
        crate::startup::enabled_count().map(|n| n as f64),
    );
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    push(
        "memory_used_mb",
        (sys.total_memory() > 0).then(|| (sys.used_memory() / (1024 * 1024)) as f64),
    );
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    let disks = sysinfo::Disks::new_with_refreshed_list();
    push(
        "disk_free_mb",
        disks
            .list()
            .iter()
            .find(|d| d.mount_point().to_string_lossy().starts_with(&system_drive))
            .map(|d| (d.available_space() / (1024 * 1024)) as f64),
    );
    out
}

/// Benchmark files an earlier run could not delete because PC Tweaker was
/// closed mid-test. Only this app's own names, only plain files (never a link
/// someone planted under that name), and never the files of this process.
fn remove_stale_files() {
    let own = format!("pctweaker-baseline-{}-", std::process::id());
    let Ok(entries) = std::fs::read_dir(std::env::temp_dir()) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with("pctweaker-baseline-")
            && name.ends_with(".bin")
            && !name.starts_with(&own)
            && entry.file_type().is_ok_and(|t| t.is_file())
        {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

fn measure() -> Vec<Metric> {
    remove_stale_files();
    let mut metrics = readings();
    let mut timed = |id: &str, count: usize, f: &mut dyn FnMut() -> Option<f64>| {
        let samples: Vec<f64> = (0..count).filter_map(|_| f()).collect();
        if !samples.is_empty() {
            metrics.push(Metric {
                id: id.into(),
                samples,
            });
        }
    };
    // A program start takes tens of milliseconds and varies the most, so it
    // gets more repetitions for the same few hundred milliseconds of waiting.
    timed("launch_ms", LAUNCH_REPEATS, &mut launch_ms);
    timed("cpu", REPEATS, &mut || {
        Some(crate::cpubench::bench(300).score as f64)
    });
    timed("memory_touch_ms", REPEATS, &mut || Some(memory_touch()));
    // A full or read-only temp drive loses the two disk tests, not the run:
    // the comparison simply has no disk rows.
    let disk: Vec<(f64, f64)> = (0..REPEATS).map_while(|_| disk_round().ok()).collect();
    if !disk.is_empty() {
        metrics.push(Metric {
            id: "disk_write_ms".into(),
            samples: disk.iter().map(|d| d.0).collect(),
        });
        metrics.push(Metric {
            id: "disk_read_us".into(),
            samples: disk.iter().map(|d| d.1).collect(),
        });
    }
    metrics
}

// ---------------------------------------------------------------------------
// Statistics. Pure functions, tested on any platform.

fn median(values: &[f64]) -> f64 {
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let n = sorted.len();
    match n {
        0 => f64::NAN,
        _ if n % 2 == 1 => sorted[n / 2],
        _ => (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0,
    }
}

/// Median absolute deviation as a percentage of the median: half of the
/// repetitions landed within this far of the middle value.
fn spread_pct(values: &[f64]) -> Option<f64> {
    if values.len() < 2 {
        return None;
    }
    let m = median(values);
    if m == 0.0 {
        return None;
    }
    let deviations: Vec<f64> = values.iter().map(|v| (v - m).abs()).collect();
    Some(median(&deviations) / m.abs() * 100.0)
}

/// Exact two-sided p-value of the rank-sum (Mann-Whitney) test over every
/// way the pooled values could have been split, ties as mid-ranks. Also
/// returns which way the ranks lean: positive when `b` tends to be larger.
/// Exact rather than the normal approximation, which is poor at seven a side.
pub fn rank_sum_test(a: &[f64], b: &[f64]) -> Option<(f64, f64)> {
    if a.is_empty() || b.is_empty() {
        return None;
    }
    let mut all: Vec<(f64, bool)> = a
        .iter()
        .map(|v| (*v, true))
        .chain(b.iter().map(|v| (*v, false)))
        .collect();
    all.sort_by(|x, y| x.0.total_cmp(&y.0));
    // Doubled mid-ranks keep everything in integers.
    let n = all.len();
    let mut ranks = vec![0usize; n];
    let mut i = 0;
    while i < n {
        let mut j = i;
        while j + 1 < n && all[j + 1].0 == all[i].0 {
            j += 1;
        }
        for r in &mut ranks[i..=j] {
            *r = i + j + 2;
        }
        i = j + 1;
    }
    let k = a.len();
    let observed: usize = (0..n).filter(|&i| all[i].1).map(|i| ranks[i]).sum();
    let expected = k * (n + 1);
    let max_sum: usize = ranks.iter().sum();
    // ways[c][s]: subsets of c items whose doubled ranks sum to s.
    let mut ways = vec![vec![0f64; max_sum + 1]; k + 1];
    ways[0][0] = 1.0;
    for (seen, &r) in ranks.iter().enumerate() {
        for c in (1..=k.min(seen + 1)).rev() {
            for s in (r..=max_sum).rev() {
                ways[c][s] += ways[c - 1][s - r];
            }
        }
    }
    let total: f64 = ways[k].iter().sum();
    let distance = observed.abs_diff(expected);
    let extreme: f64 = ways[k]
        .iter()
        .enumerate()
        .filter(|(s, _)| s.abs_diff(expected) >= distance)
        .map(|(_, w)| w)
        .sum();
    let lean = expected as f64 - observed as f64;
    Some(((extreme / total).min(1.0), lean))
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Verdict {
    Better,
    Worse,
    Same,
    /// Too few repetitions on one side to say anything.
    Inconclusive,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MetricChange {
    pub id: String,
    pub before: f64,
    pub after: f64,
    pub before_samples: usize,
    pub after_samples: usize,
    pub before_spread_pct: Option<f64>,
    pub after_spread_pct: Option<f64>,
    pub change_pct: Option<f64>,
    pub p_value: Option<f64>,
    pub verdict: Verdict,
    /// After-measurements since the "before" that reach the same verdict as
    /// the latest one, out of `after_runs`. A result that holds up when
    /// measured again is worth more than one that appeared once.
    pub confirmed: u32,
    pub after_runs: u32,
}

/// One metric, before against after. `None` when either side lacks it.
pub fn judge(id: &str, before: &[f64], after: &[f64]) -> Option<(Verdict, Option<f64>)> {
    let spec = spec(id)?;
    if before.is_empty() || after.is_empty() {
        return None;
    }
    let (b, a) = (median(before), median(after));
    let improved = |delta: f64| (delta > 0.0) == spec.higher_is_better;
    if !spec.timed {
        let delta = a - b;
        let floor = spec.min_absolute.max(spec.min_relative * b.abs());
        let verdict = if delta.abs() >= floor && delta != 0.0 {
            if improved(delta) {
                Verdict::Better
            } else {
                Verdict::Worse
            }
        } else {
            Verdict::Same
        };
        return Some((verdict, None));
    }
    if before.len() < spec.min_samples || after.len() < spec.min_samples || b == 0.0 {
        return Some((Verdict::Inconclusive, None));
    }
    let (p, lean) = rank_sum_test(before, after)?;
    let delta = a - b;
    let verdict = if p < spec.alpha
        && (delta / b).abs() >= spec.min_relative
        && delta.abs() >= spec.min_absolute
        && (lean > 0.0) == (delta > 0.0)
    {
        if improved(delta) {
            Verdict::Better
        } else {
            Verdict::Worse
        }
    } else {
        Verdict::Same
    };
    Some((verdict, Some(p)))
}

/// One metric's before/after summary and verdict, for a single comparison.
pub fn change_of(id: &str, before: &[f64], after: &[f64], runs: u32) -> Option<MetricChange> {
    let (verdict, p_value) = judge(id, before, after)?;
    let (b, a) = (median(before), median(after));
    let timed = spec(id).is_some_and(|s| s.timed);
    Some(MetricChange {
        id: id.to_string(),
        before: b,
        after: a,
        before_samples: before.len(),
        after_samples: after.len(),
        before_spread_pct: timed.then(|| spread_pct(before)).flatten(),
        after_spread_pct: timed.then(|| spread_pct(after)).flatten(),
        change_pct: (b != 0.0).then(|| (a - b) / b.abs() * 100.0),
        p_value,
        verdict,
        confirmed: u32::from(matches!(verdict, Verdict::Better | Verdict::Worse)) * runs,
        after_runs: runs,
    })
}

/// The latest "before" and everything measured after it, compared metric by
/// metric against the newest "after".
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BeforeAfter {
    pub before: Option<BaselineRun>,
    pub after: Option<BaselineRun>,
    pub after_runs: u32,
    pub changes: Vec<MetricChange>,
    /// Windows restarted between the two measurements. A restart alone
    /// lowers memory in use and running processes and changes cold-start
    /// timings, so the screen says so next to the results.
    pub restarted_between: bool,
}

/// Two boot times further apart than this are two different boots; closer
/// is the clock reading the same boot twice.
const SAME_BOOT_SLACK_S: u64 = 120;

fn restarted(before: &BaselineRun, after: &BaselineRun) -> bool {
    matches!((before.boot_ts, after.boot_ts), (Some(b), Some(a)) if a.abs_diff(b) > SAME_BOOT_SLACK_S)
}

pub fn before_after_of(runs: &[BaselineRun]) -> BeforeAfter {
    let detailed = |r: &&BaselineRun| !r.metrics.is_empty();
    let Some(start) = runs
        .iter()
        .rposition(|r| r.role == Some(Role::Before) && !r.metrics.is_empty())
    else {
        return BeforeAfter {
            before: None,
            after: None,
            after_runs: 0,
            changes: Vec::new(),
            restarted_between: false,
        };
    };
    let before = &runs[start];
    let afters: Vec<&BaselineRun> = runs[start + 1..].iter().filter(detailed).collect();
    let Some(after) = afters.last() else {
        return BeforeAfter {
            before: Some(before.clone()),
            after: None,
            after_runs: 0,
            changes: Vec::new(),
            restarted_between: false,
        };
    };
    let changes = before
        .metrics
        .iter()
        .filter_map(|m| {
            let mut change = change_of(&m.id, &m.samples, after.metric(&m.id)?, 1)?;
            change.after_runs = afters.len() as u32;
            change.confirmed = afters
                .iter()
                .filter(|r| {
                    r.metric(&m.id)
                        .and_then(|s| judge(&m.id, &m.samples, s))
                        .is_some_and(|(v, _)| v == change.verdict)
                })
                .count() as u32;
            Some(change)
        })
        .collect();
    BeforeAfter {
        before: Some(before.clone()),
        after: Some((*after).clone()),
        after_runs: afters.len() as u32,
        changes,
        restarted_between: restarted(before, after),
    }
}

// ---------------------------------------------------------------------------
// Persistence and commands.

fn history_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("baseline-history.jsonl"))
}

fn read_runs(app: &tauri::AppHandle) -> Result<Vec<BaselineRun>, String> {
    let path = history_path(app)?;
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Ok(Vec::new());
    };
    let runs: Vec<BaselineRun> = content
        .lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();
    Ok(recent(runs))
}

/// The last `HISTORY_CAP` runs, always including the latest "before": many
/// "after" measurements must not push the starting point out of view.
fn recent(mut runs: Vec<BaselineRun>) -> Vec<BaselineRun> {
    let start = runs.len().saturating_sub(HISTORY_CAP);
    let before = runs
        .iter()
        .rposition(|r| r.role == Some(Role::Before) && !r.metrics.is_empty());
    match before {
        Some(b) if b < start => {
            let mut kept = vec![runs[b].clone()];
            kept.extend(runs.drain(start + 1..));
            kept
        }
        _ => runs.split_off(start),
    }
}

static MEASURING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Releases the one-measurement-at-a-time flag on every exit path.
struct Measuring;

impl Drop for Measuring {
    fn drop(&mut self) {
        MEASURING.store(false, std::sync::atomic::Ordering::Release);
    }
}

/// Runs every test (about 10 s) and appends the result to the local history.
/// `role` says whether this is the "before" a later comparison starts from.
#[tauri::command(async)]
pub async fn run_baseline(app: tauri::AppHandle, role: Role) -> Result<BeforeAfter, String> {
    // Two runs at once would each measure the other's load.
    if MEASURING.swap(true, std::sync::atomic::Ordering::AcqRel) {
        return Err("a measurement is already running".into());
    }
    let _measuring = Measuring;
    let metrics = tauri::async_runtime::spawn_blocking(measure)
        .await
        .map_err(|e| format!("baseline task failed: {e}"))?;
    let pick = |id: &str| {
        metrics
            .iter()
            .find(|m| m.id == id)
            .map_or(0, |m| median(&m.samples).round() as u64)
    };
    let run = BaselineRun {
        ts: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        cpu_score: pick("cpu"),
        memory_touch_ms: pick("memory_touch_ms"),
        disk_write_ms: pick("disk_write_ms"),
        disk_random_read_ms: pick("disk_read_us") * 64 / 1000,
        role: Some(role),
        metrics,
        boot_ts: Some(sysinfo::System::boot_time()).filter(|t| *t > 0),
    };

    let path = history_path(&app)?;
    let line = serde_json::to_string(&run).map_err(|e| e.to_string())?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{line}").map_err(|e| e.to_string())?;
    drop(file);
    let runs = read_runs(&app)?;
    compact(&path, &runs);
    Ok(before_after_of(&runs))
}

/// Keeps the history file from growing without end: once it holds four
/// times what is read, it is rewritten with only what is read, through a
/// temporary file so an interruption never leaves half a history.
fn compact(path: &std::path::Path, kept: &[BaselineRun]) {
    let lines = std::fs::read_to_string(path).map_or(0, |c| c.lines().count());
    if lines <= HISTORY_CAP * 4 {
        return;
    }
    let text: String = kept
        .iter()
        .filter_map(|r| serde_json::to_string(r).ok())
        .map(|l| l + "\n")
        .collect();
    let temp = path.with_extension("jsonl.tmp");
    if std::fs::write(&temp, text).is_err() || std::fs::rename(&temp, path).is_err() {
        let _ = std::fs::remove_file(&temp);
    }
}

/// The current comparison, without measuring anything. Async so the file
/// read never runs on the window's thread.
#[tauri::command(async)]
pub fn before_after(app: tauri::AppHandle) -> Result<BeforeAfter, String> {
    Ok(before_after_of(&read_runs(&app)?))
}

/// Writes the exported report image to the path the user picked in the save
/// dialog. Only a PNG is accepted, by extension and by content.
#[tauri::command(async)]
pub fn save_report_png(path: String, data_base64: String) -> Result<(), String> {
    use base64::Engine;
    const MAX_BYTES: usize = 20 * 1024 * 1024;
    let target = std::path::PathBuf::from(&path);
    let is_png = target
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("png"));
    // A local drive path only: no network share (which would send this
    // user's credentials to it), no device path, no alternate data stream.
    let bytes_of_path = path.as_bytes();
    let local_drive = bytes_of_path.len() > 3
        && bytes_of_path[0].is_ascii_alphabetic()
        && bytes_of_path[1] == b':'
        && (bytes_of_path[2] == b'\\' || bytes_of_path[2] == b'/')
        && !path[2..].contains(':');
    if !is_png || !target.is_absolute() || !local_drive {
        return Err("the report can only be saved as a .png file on a local drive".into());
    }
    if data_base64.len() > MAX_BYTES / 3 * 4 + 4 {
        return Err("the report image is too large".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|_| "the report image could not be read".to_string())?;
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("the report image is not a PNG".into());
    }
    std::fs::write(&target, bytes).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(ts: u64, role: Option<Role>, metrics: &[(&str, &[f64])]) -> BaselineRun {
        BaselineRun {
            ts,
            cpu_score: 0,
            memory_touch_ms: 0,
            disk_write_ms: 0,
            disk_random_read_ms: 0,
            role,
            metrics: metrics
                .iter()
                .map(|(id, s)| Metric {
                    id: (*id).into(),
                    samples: s.to_vec(),
                })
                .collect(),
            boot_ts: None,
        }
    }

    #[test]
    fn memory_touch_returns_a_positive_duration() {
        assert!(memory_touch() > 0.0);
    }

    #[test]
    fn disk_round_measures_and_cleans_up() {
        let (write_ms, read_us) = disk_round().expect("disk round");
        assert!(write_ms > 0.0 && read_us > 0.0);
        let prefix = format!("pctweaker-baseline-{}-", std::process::id());
        let leftover = std::fs::read_dir(std::env::temp_dir())
            .unwrap()
            .filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().starts_with(&prefix));
        assert!(!leftover, "the benchmark file was left behind");
    }

    #[test]
    fn the_exact_test_matches_hand_computed_cases() {
        // Complete separation, three a side: 2 of C(6,3) = 20 splits.
        let (p, lean) = rank_sum_test(&[1.0, 2.0, 3.0], &[4.0, 5.0, 6.0]).unwrap();
        assert!((p - 0.1).abs() < 1e-12, "{p}");
        assert!(lean > 0.0, "b is larger");
        // Seven a side, complete separation: 2 of C(14,7) = 3432.
        let a: Vec<f64> = (0..7).map(f64::from).collect();
        let b: Vec<f64> = (10..17).map(f64::from).collect();
        let (p, lean) = rank_sum_test(&b, &a).unwrap();
        assert!((p - 2.0 / 3432.0).abs() < 1e-12, "{p}");
        assert!(lean < 0.0);
        // Identical values everywhere: nothing to tell apart.
        let (p, _) = rank_sum_test(&[5.0; 7], &[5.0; 7]).unwrap();
        assert!((p - 1.0).abs() < 1e-12);
        assert!(rank_sum_test(&[], &[1.0]).is_none());
    }

    #[test]
    fn noise_is_no_significant_change() {
        let before = [100.0, 104.0, 98.0, 101.0, 103.0, 97.0, 102.0];
        let after = [99.0, 103.0, 101.0, 98.0, 104.0, 100.0, 97.0];
        assert_eq!(
            judge("launch_ms", &before, &after).unwrap().0,
            Verdict::Same
        );
    }

    #[test]
    fn a_clear_shift_is_better_or_worse_by_the_metric_direction() {
        let slow = [40.0, 41.0, 42.0, 40.5, 41.5, 43.0, 39.5];
        let fast = [30.0, 31.0, 29.5, 30.5, 32.0, 31.5, 30.2];
        assert_eq!(judge("launch_ms", &slow, &fast).unwrap().0, Verdict::Better);
        assert_eq!(judge("launch_ms", &fast, &slow).unwrap().0, Verdict::Worse);
        // For the CPU work rate, higher is the good direction.
        assert_eq!(judge("cpu", &fast, &slow).unwrap().0, Verdict::Better);
    }

    #[test]
    fn a_significant_shift_under_five_percent_is_not_claimed() {
        let before = [100.0, 100.5, 101.0, 100.2, 100.8, 100.4, 100.6];
        let after = [97.0, 97.5, 98.0, 97.2, 97.8, 97.4, 97.6];
        let (verdict, p) = judge("disk_write_ms", &before, &after).unwrap();
        assert!(p.unwrap() < SIGNIFICANCE);
        assert_eq!(verdict, Verdict::Same);
    }

    #[test]
    fn too_few_repetitions_are_inconclusive() {
        let (verdict, p) = judge("cpu", &[1.0, 2.0], &[9.0, 9.0, 9.0, 9.0, 9.0]).unwrap();
        assert_eq!((verdict, p), (Verdict::Inconclusive, None));
    }

    #[test]
    fn readings_need_to_clear_their_floor() {
        assert_eq!(
            judge("processes", &[200.0], &[198.0]).unwrap().0,
            Verdict::Same
        );
        assert_eq!(
            judge("processes", &[200.0], &[190.0]).unwrap().0,
            Verdict::Better
        );
        assert_eq!(
            judge("startup_apps", &[9.0], &[7.0]).unwrap().0,
            Verdict::Better
        );
        assert_eq!(
            judge("startup_apps", &[7.0], &[7.0]).unwrap().0,
            Verdict::Same
        );
        assert_eq!(
            judge("memory_used_mb", &[8000.0], &[7900.0]).unwrap().0,
            Verdict::Same
        );
        assert_eq!(
            judge("memory_used_mb", &[8000.0], &[9000.0]).unwrap().0,
            Verdict::Worse
        );
        assert_eq!(
            judge("disk_free_mb", &[50_000.0], &[52_400.0]).unwrap().0,
            Verdict::Better
        );
        assert!(judge("unknown", &[1.0], &[2.0]).is_none());
    }

    #[test]
    fn spread_is_the_median_absolute_deviation_in_percent() {
        let s = spread_pct(&[90.0, 95.0, 100.0, 105.0, 110.0]).unwrap();
        assert!((s - 5.0).abs() < 1e-9, "{s}");
        assert_eq!(spread_pct(&[1.0]), None);
    }

    #[test]
    fn the_comparison_starts_from_the_latest_before_and_counts_confirmations() {
        let slow: &[f64] = &[40.0, 41.0, 42.0, 40.5, 41.5, 43.0, 39.5];
        let fast: &[f64] = &[30.0, 31.0, 29.5, 30.5, 32.0, 31.5, 30.2];
        let runs = vec![
            // An old single-shot row and an older "before" are both ignored.
            run(1, None, &[]),
            run(2, Some(Role::Before), &[("launch_ms", fast)]),
            run(
                3,
                Some(Role::Before),
                &[("launch_ms", slow), ("startup_apps", &[9.0])],
            ),
            run(
                4,
                Some(Role::After),
                &[("launch_ms", slow), ("startup_apps", &[8.0])],
            ),
            run(
                5,
                Some(Role::After),
                &[("launch_ms", fast), ("startup_apps", &[8.0])],
            ),
        ];
        let result = before_after_of(&runs);
        assert_eq!(result.before.as_ref().unwrap().ts, 3);
        assert_eq!(result.after.as_ref().unwrap().ts, 5);
        assert_eq!(result.after_runs, 2);
        let launch = result.changes.iter().find(|c| c.id == "launch_ms").unwrap();
        assert_eq!(launch.verdict, Verdict::Better);
        assert_eq!((launch.confirmed, launch.after_runs), (1, 2));
        assert!(launch.change_pct.unwrap() < -20.0);
        assert!(launch.before_spread_pct.is_some());
        let startup = result
            .changes
            .iter()
            .find(|c| c.id == "startup_apps")
            .unwrap();
        assert_eq!((startup.verdict, startup.confirmed), (Verdict::Better, 2));
        assert_eq!(startup.before_spread_pct, None);
    }

    /// Many "after" runs never push the "before" out of the window.
    #[test]
    fn the_latest_before_survives_the_history_cap() {
        let mut runs = vec![run(1, Some(Role::Before), &[("cpu", &[1.0])])];
        runs.extend((2..80).map(|ts| run(ts, Some(Role::After), &[("cpu", &[1.0])])));
        let kept = recent(runs);
        assert_eq!(kept.len(), HISTORY_CAP);
        assert_eq!(kept[0].ts, 1, "the before is kept");
        assert_eq!(kept.last().unwrap().ts, 79);
        assert_eq!(before_after_of(&kept).before.unwrap().ts, 1);
        let short = recent(vec![run(5, Some(Role::Before), &[("cpu", &[1.0])])]);
        assert_eq!(short.len(), 1);
    }

    /// The method's honesty, simulated: with nothing changed, a timed test is
    /// almost never called better or worse, even with noisy runs and the odd
    /// spike; a real 20% change is almost always found.
    #[test]
    fn identical_conditions_are_called_the_same_and_real_changes_are_found() {
        let mut state: u64 = 0x9e37_79b9_7f4a_7c15;
        let mut uniform = move || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            (state >> 11) as f64 / (1u64 << 53) as f64
        };
        let mut series = |n: usize, centre: f64| -> Vec<f64> {
            (0..n)
                .map(|_| {
                    let noise = 1.0 + (uniform() - 0.5) * 0.3; // +-15%
                    let spike = if uniform() < 0.05 { 3.0 } else { 1.0 }; // background hiccup
                    centre * noise * spike
                })
                .collect()
        };
        const TRIALS: usize = 2000;
        let mut false_claims = 0;
        let mut found = 0;
        for _ in 0..TRIALS {
            let before = series(LAUNCH_REPEATS, 40.0);
            if judge("launch_ms", &before, &series(LAUNCH_REPEATS, 40.0))
                .unwrap()
                .0
                != Verdict::Same
            {
                false_claims += 1;
            }
            if judge("launch_ms", &before, &series(LAUNCH_REPEATS, 32.0))
                .unwrap()
                .0
                == Verdict::Better
            {
                found += 1;
            }
        }
        let false_rate = false_claims as f64 / TRIALS as f64;
        let power = found as f64 / TRIALS as f64;
        println!("false claims {false_rate:.4}, real 20% change found {power:.3}");
        // The exact test runs at the 1% level, so about 1% is the design; twice
        // that would mean the method claims changes that are not there.
        assert!(false_rate < 0.02, "{false_rate}");
        assert!(power > 0.85, "{power}");
    }

    #[test]
    fn stale_benchmark_files_from_other_runs_are_removed() {
        let other = std::env::temp_dir().join("pctweaker-baseline-999999999-1.bin");
        std::fs::write(&other, b"left behind").unwrap();
        remove_stale_files();
        assert!(!other.exists());
    }

    #[test]
    fn a_restart_between_the_measurements_is_reported() {
        let mut before = run(1, Some(Role::Before), &[("processes", &[300.0])]);
        let mut after = run(2, Some(Role::After), &[("processes", &[250.0])]);
        before.boot_ts = Some(1_000);
        after.boot_ts = Some(1_060);
        assert!(!before_after_of(&[before.clone(), after.clone()]).restarted_between);
        after.boot_ts = Some(9_000);
        assert!(before_after_of(&[before.clone(), after.clone()]).restarted_between);
        after.boot_ts = None;
        assert!(
            !before_after_of(&[before, after]).restarted_between,
            "unknown is not a restart"
        );
    }

    #[test]
    fn the_history_file_is_compacted_once_it_grows() {
        let dir = std::env::temp_dir().join(format!("pct-compact-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("baseline-history.jsonl");
        let all: Vec<BaselineRun> = (0..(HISTORY_CAP * 4 + 5) as u64)
            .map(|ts| run(ts, Some(Role::After), &[("cpu", &[1.0])]))
            .collect();
        let text: String = all
            .iter()
            .map(|r| serde_json::to_string(r).unwrap() + "\n")
            .collect();
        std::fs::write(&path, text).unwrap();
        let kept = recent(all);
        compact(&path, &kept);
        let lines = std::fs::read_to_string(&path).unwrap().lines().count();
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(lines, HISTORY_CAP);
    }

    #[test]
    fn no_before_or_no_after_yields_no_changes() {
        assert!(before_after_of(&[]).before.is_none());
        let only_before = before_after_of(&[run(1, Some(Role::Before), &[("cpu", &[1.0])])]);
        assert!(only_before.before.is_some() && only_before.after.is_none());
        assert!(only_before.changes.is_empty());
    }

    #[test]
    fn rows_written_by_older_versions_still_parse() {
        let old =
            r#"{"ts":1,"cpuScore":10,"memoryTouchMs":2,"diskWriteMs":3,"diskRandomReadMs":4}"#;
        let parsed: BaselineRun = serde_json::from_str(old).unwrap();
        assert!(parsed.role.is_none() && parsed.metrics.is_empty());
        let new = serde_json::to_string(&run(2, Some(Role::After), &[("cpu", &[1.0])])).unwrap();
        assert!(new.contains(r#""role":"after""#), "{new}");
    }

    #[test]
    fn the_report_is_only_written_as_a_png() {
        use base64::Engine;
        let dir = std::env::temp_dir();
        let png = base64::engine::general_purpose::STANDARD.encode(b"\x89PNG\r\n\x1a\nrest");
        let target = dir.join(format!("pct-report-{}.png", std::process::id()));
        save_report_png(target.to_string_lossy().into(), png.clone()).unwrap();
        std::fs::remove_file(&target).unwrap();
        let not_png = base64::engine::general_purpose::STANDARD.encode(b"MZ executable");
        assert!(save_report_png(target.to_string_lossy().into(), not_png).is_err());
        let exe = dir.join("pct-report.exe");
        assert!(save_report_png(exe.to_string_lossy().into(), png.clone()).is_err());
        assert!(save_report_png("relative.png".into(), png.clone()).is_err());
        assert!(save_report_png(r"\\server\share\r.png".into(), png.clone()).is_err());
        assert!(save_report_png(r"\\?\C:\r.png".into(), png.clone()).is_err());
        assert!(save_report_png(r"C:\a.txt:s.png".into(), png).is_err());
        assert!(!exe.exists() && !target.exists());
    }
}
