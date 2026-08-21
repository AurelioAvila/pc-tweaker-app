//! Baseline Engine — quick, repeatable micro-measurements, each tied to
//! something PC Tweaker can actually influence, in the same spirit as
//! `cpubench`: never a synthetic score paraded on its own, only numbers
//! comparable against a previous run on the SAME machine.
//!
//! What is measured and why it is fair game:
//! - **CPU responsiveness** (reused `cpubench` workload): moves with the
//!   power plan, boost mode and power-throttling tweaks.
//! - **Memory touch time**: allocating and writing a fixed buffer moves with
//!   memory pressure — the thing RAM cleaning and background-app tweaks
//!   affect.
//! - **System-disk write + random read**: the responsiveness users actually
//!   feel; moves with free space and background disk activity.
//!
//! Every run is appended to a local JSONL history (app data dir, nothing
//! leaves the machine) so before/after comparisons survive restarts.

use serde::{Deserialize, Serialize};
use std::io::{Read, Seek, SeekFrom, Write};
use std::time::Instant;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BaselineRun {
    /// Unix seconds.
    pub ts: u64,
    /// Iterations/ms from the fixed CPU workload (higher is better).
    pub cpu_score: u64,
    /// Milliseconds to allocate and write-touch 256 MB (lower is better).
    pub memory_touch_ms: u64,
    /// Milliseconds to write a 32 MB temp file (lower is better).
    pub disk_write_ms: u64,
    /// Milliseconds for 200 random 4 KB reads of that file (lower is better).
    pub disk_random_read_ms: u64,
}

fn memory_touch() -> u64 {
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
    start.elapsed().as_millis().max(1) as u64
}

fn disk_bench() -> Result<(u64, u64), String> {
    const SIZE: usize = 32 * 1024 * 1024;
    const READS: u64 = 200;
    let path = std::env::temp_dir().join("pctweaker-baseline.bin");
    let chunk = vec![0xA5u8; 1024 * 1024];

    let write_start = Instant::now();
    {
        let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
        for _ in 0..(SIZE / chunk.len()) {
            file.write_all(&chunk).map_err(|e| e.to_string())?;
        }
        file.sync_all().map_err(|e| e.to_string())?;
    }
    let write_ms = write_start.elapsed().as_millis().max(1) as u64;

    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut page = [0u8; 4096];
    // Deterministic pseudo-random offsets: repeatability beats randomness here.
    let mut state: u64 = 0x1234_5678_9abc_def0;
    let read_start = Instant::now();
    for _ in 0..READS {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        let offset = (state % (SIZE as u64 - 4096)) & !4095;
        file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
        file.read_exact(&mut page).map_err(|e| e.to_string())?;
        std::hint::black_box(&page);
    }
    let read_ms = read_start.elapsed().as_millis().max(1) as u64;

    drop(file);
    let _ = std::fs::remove_file(&path);
    Ok((write_ms, read_ms))
}

fn history_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("baseline-history.jsonl"))
}

/// Runs the full baseline (~3-6 s) and appends it to the local history.
#[tauri::command(async)]
pub async fn run_baseline(app: tauri::AppHandle) -> Result<BaselineRun, String> {
    let run = tauri::async_runtime::spawn_blocking(move || -> Result<BaselineRun, String> {
        let cpu = crate::cpubench::bench_once();
        let memory_touch_ms = memory_touch();
        let (disk_write_ms, disk_random_read_ms) = disk_bench()?;
        Ok(BaselineRun {
            ts: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
            cpu_score: cpu.score,
            memory_touch_ms,
            disk_write_ms,
            disk_random_read_ms,
        })
    })
    .await
    .map_err(|e| format!("baseline task failed: {e}"))??;

    let path = history_path(&app)?;
    let line = serde_json::to_string(&run).map_err(|e| e.to_string())?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{line}").map_err(|e| e.to_string())?;
    Ok(run)
}

/// The stored history, oldest first, capped at the most recent 50 runs.
#[tauri::command]
pub fn list_baselines(app: tauri::AppHandle) -> Result<Vec<BaselineRun>, String> {
    let path = history_path(&app)?;
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Ok(Vec::new());
    };
    let mut runs: Vec<BaselineRun> = content
        .lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();
    if runs.len() > 50 {
        runs.drain(..runs.len() - 50);
    }
    Ok(runs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_touch_returns_a_positive_duration() {
        assert!(memory_touch() >= 1);
    }

    #[test]
    fn disk_bench_measures_and_cleans_up() {
        let (write_ms, read_ms) = disk_bench().expect("disk bench");
        assert!(write_ms >= 1 && read_ms >= 1);
        assert!(!std::env::temp_dir().join("pctweaker-baseline.bin").exists());
    }
}
