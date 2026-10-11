//! Startup times as Windows records them itself.
//!
//! After every boot the Diagnostic Policy Service writes event 100 to the
//! Microsoft-Windows-Diagnostics-Performance/Operational log. Its `BootTime`
//! field is the whole boot in milliseconds, `MainPathBootTime` the part up to
//! the sign-in screen and `BootPostBootTime` the time from sign-in until the
//! desktop settles. These are Windows' own measurements; nothing here times a
//! boot or estimates one.
//!
//! The log is readable by administrators only, so a non-elevated PC Tweaker
//! asks once through the headless helper, which writes what it read to a file
//! and exits. Records are kept in the app data folder, so the history grows
//! past the log's own retention and is shown without asking again.

use serde::{Deserialize, Serialize};
use std::path::Path;

pub const ELEVATED_FLAG: &str = "--elevated-boot-times";
const RESULT_FILE: &str = "last_boot_times.json";
const HISTORY_FILE: &str = "boot-history.json";
const HISTORY_CAP: usize = 200;

/// Mirrors `BootRecord` in src/components/before-after.tsx.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BootRecord {
    /// When Windows logged the boot, Unix seconds.
    pub ts: u64,
    pub boot_ms: u64,
    pub main_path_ms: Option<u64>,
    pub post_boot_ms: Option<u64>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum HelperOutcome {
    Records(Vec<BootRecord>),
    Error(String),
}

/// Days since 1970-01-01 for a proleptic Gregorian date (H. Hinnant's
/// `days_from_civil`).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// `2026-10-11T07:12:33.1234567Z` to Unix seconds. Event times are UTC.
fn parse_system_time(text: &str) -> Option<u64> {
    let num = |range: std::ops::Range<usize>| text.get(range)?.parse::<i64>().ok();
    if text.get(4..5) != Some("-") || text.get(10..11) != Some("T") {
        return None;
    }
    let (y, mo, d) = (num(0..4)?, num(5..7)?, num(8..10)?);
    let (h, mi, s) = (num(11..13)?, num(14..16)?, num(17..19)?);
    if !(1..=12).contains(&mo) || !(1..=31).contains(&d) || h > 23 || mi > 59 || s > 60 {
        return None;
    }
    u64::try_from(days_from_civil(y, mo, d) * 86_400 + h * 3600 + mi * 60 + s).ok()
}

/// The value of `<Data Name='name'>value</Data>`, either quote style.
fn data_field(event: &str, name: &str) -> Option<u64> {
    for quote in ['\'', '"'] {
        let key = format!("Name={quote}{name}{quote}>");
        if let Some(start) = event.find(&key) {
            let rest = &event[start + key.len()..];
            return rest[..rest.find('<')?].trim().parse().ok();
        }
    }
    None
}

fn attribute(event: &str, tag: &str, name: &str) -> Option<String> {
    let at = event.find(&format!("<{tag} "))?;
    let rest = &event[at..];
    let rest = &rest[..rest.find('>')?];
    for quote in ['\'', '"'] {
        let key = format!("{name}={quote}");
        if let Some(start) = rest.find(&key) {
            let value = &rest[start + key.len()..];
            return Some(value[..value.find(quote)?].to_string());
        }
    }
    None
}

/// Every event-100 record in `wevtutil qe … /f:xml` output. Events missing a
/// time or a total boot time are skipped, never guessed.
pub fn parse_events(xml: &str) -> Vec<BootRecord> {
    xml.split("<Event ")
        .skip(1)
        .filter_map(|event| {
            let ts = parse_system_time(&attribute(event, "TimeCreated", "SystemTime")?)?;
            let boot_ms = data_field(event, "BootTime")?;
            (boot_ms > 0).then(|| BootRecord {
                ts,
                boot_ms,
                main_path_ms: data_field(event, "MainPathBootTime"),
                post_boot_ms: data_field(event, "BootPostBootTime"),
            })
        })
        .collect()
}

#[cfg(windows)]
fn read_log() -> Result<Vec<BootRecord>, String> {
    let output = crate::system_tools::run("wevtutil", |tool| {
        tool.args([
            "qe",
            "Microsoft-Windows-Diagnostics-Performance/Operational",
            "/q:*[System[(EventID=100)]]",
            "/c:100",
            "/rd:true",
            "/f:xml",
        ])
        .output()
    })
    .map_err(|e| format!("could not run wevtutil: {e}"))?;
    if !output.status.success() {
        return Err("Windows did not allow reading its boot performance log".into());
    }
    Ok(parse_events(&String::from_utf8_lossy(&output.stdout)))
}

/// The helper side of a non-elevated request: read, write, exit code.
#[cfg(windows)]
pub fn run_elevated(app_data_dir: &Path) -> i32 {
    let outcome = match read_log() {
        Ok(records) => HelperOutcome::Records(records),
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
fn read_fresh(app_data_dir: &Path) -> Result<Vec<BootRecord>, String> {
    if crate::elevation::is_elevated() {
        return read_log();
    }
    let file = app_data_dir.join(RESULT_FILE);
    // A file left from an earlier run must never be mistaken for this one.
    let _ = std::fs::remove_file(&file);
    let launched = crate::elevation::run_elevated_action(ELEVATED_FLAG, "read");
    let outcome = std::fs::read(&file)
        .ok()
        .and_then(|raw| serde_json::from_slice::<HelperOutcome>(&raw).ok());
    let _ = std::fs::remove_file(&file);
    match outcome {
        Some(HelperOutcome::Records(records)) => Ok(records),
        Some(HelperOutcome::Error(error)) => Err(error),
        None => Err(launched
            .err()
            .unwrap_or_else(|| "the boot log read produced no result".to_string())),
    }
}

fn load(app_data_dir: &Path) -> Vec<BootRecord> {
    std::fs::read(app_data_dir.join(HISTORY_FILE))
        .ok()
        .and_then(|raw| serde_json::from_slice(&raw).ok())
        .unwrap_or_default()
}

/// Known records plus new ones, one per timestamp, oldest first, capped.
pub fn merge(mut known: Vec<BootRecord>, fresh: Vec<BootRecord>) -> Vec<BootRecord> {
    for record in fresh {
        if !known.iter().any(|k| k.ts == record.ts) {
            known.push(record);
        }
    }
    known.sort_by_key(|r| r.ts);
    if known.len() > HISTORY_CAP {
        known.drain(..known.len() - HISTORY_CAP);
    }
    known
}

/// Mirrors `BootReport` in src/components/before-after.tsx.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BootReport {
    pub records: Vec<BootRecord>,
    /// Startup time before against after the given "before" measurement,
    /// when there are enough restarts on both sides to judge.
    pub change: Option<crate::baseline::MetricChange>,
}

pub fn report(records: Vec<BootRecord>, before_ts: Option<u64>) -> BootReport {
    let change = before_ts.and_then(|split| {
        let side = |after: bool| -> Vec<f64> {
            records
                .iter()
                .filter(|r| (r.ts > split) == after)
                .map(|r| r.boot_ms as f64)
                .collect()
        };
        crate::baseline::change_of("boot_ms", &side(false), &side(true), 1)
    });
    BootReport { records, change }
}

/// Stored startup times, read again from Windows (one administrator prompt)
/// when `refresh` is set.
#[tauri::command(async)]
pub async fn boot_times(
    app: tauri::AppHandle,
    refresh: bool,
    before_ts: Option<u64>,
) -> Result<BootReport, String> {
    let dir = crate::store_for_dir(&app)?;
    let known = load(&dir);
    if !refresh {
        return Ok(report(known, before_ts));
    }
    #[cfg(windows)]
    {
        let fresh_dir = dir.clone();
        let fresh = tauri::async_runtime::spawn_blocking(move || read_fresh(&fresh_dir))
            .await
            .map_err(|e| format!("the boot log read did not finish: {e}"))??;
        let merged = merge(known, fresh);
        let json = serde_json::to_vec(&merged).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        std::fs::write(dir.join(HISTORY_FILE), json).map_err(|e| e.to_string())?;
        Ok(report(merged, before_ts))
    }
    #[cfg(not(windows))]
    {
        Err("not supported on this platform".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "<Event xmlns='http://schemas.microsoft.com/win/2004/08/events/event'><System><Provider Name='Microsoft-Windows-Diagnostics-Performance'/><EventID>100</EventID><TimeCreated SystemTime='2026-10-11T07:12:33.1234567Z'/></System><EventData><Data Name='BootTsVersion'>2</Data><Data Name='BootTime'>34857</Data><Data Name='MainPathBootTime'>12657</Data><Data Name='BootPostBootTime'>22200</Data></EventData></Event><Event xmlns='x'><System><TimeCreated SystemTime=\"2026-10-10T23:59:59.0Z\"/></System><EventData><Data Name=\"BootTime\">20500</Data></EventData></Event><Event xmlns='x'><System><TimeCreated SystemTime='garbage'/></System><EventData><Data Name='BootTime'>1</Data></EventData></Event>";

    #[test]
    fn events_parse_with_either_quote_style_and_bad_ones_are_skipped() {
        let records = parse_events(SAMPLE);
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].boot_ms, 34_857);
        assert_eq!(records[0].main_path_ms, Some(12_657));
        assert_eq!(records[0].post_boot_ms, Some(22_200));
        assert_eq!(records[1].boot_ms, 20_500);
        assert_eq!(records[1].main_path_ms, None);
    }

    #[test]
    fn event_times_convert_to_unix_seconds() {
        assert_eq!(parse_system_time("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(parse_system_time("2000-03-01T00:00:00Z"), Some(951_868_800));
        assert_eq!(parse_system_time("2026-10-11T07:12:33.1234567Z"), Some(1_791_702_753));
        assert_eq!(parse_system_time("2026-13-11T07:12:33Z"), None);
        assert_eq!(parse_system_time("not a time"), None);
    }

    #[test]
    fn merging_keeps_one_record_per_boot_in_order() {
        let r = |ts| BootRecord {
            ts,
            boot_ms: 1000,
            main_path_ms: None,
            post_boot_ms: None,
        };
        let merged = merge(vec![r(5), r(1)], vec![r(3), r(5)]);
        assert_eq!(merged.iter().map(|r| r.ts).collect::<Vec<_>>(), [1, 3, 5]);
    }

    #[test]
    fn restarts_on_each_side_of_the_before_measurement_are_compared() {
        let r = |ts, ms| BootRecord {
            ts,
            boot_ms: ms,
            main_path_ms: None,
            post_boot_ms: None,
        };
        let slow = [30_000, 31_000, 32_000, 30_500];
        let fast = [22_000, 21_000, 23_000, 22_500];
        let mut records: Vec<BootRecord> =
            slow.iter().enumerate().map(|(i, ms)| r(i as u64, *ms)).collect();
        records.extend(fast.iter().enumerate().map(|(i, ms)| r(100 + i as u64, *ms)));
        let change = report(records.clone(), Some(50)).change.unwrap();
        assert_eq!(change.verdict, crate::baseline::Verdict::Better);
        assert_eq!((change.before_samples, change.after_samples), (4, 4));
        // Three after: not enough to judge, and said so.
        let few = report(records[..7].to_vec(), Some(50)).change.unwrap();
        assert_eq!(few.verdict, crate::baseline::Verdict::Inconclusive);
        assert!(report(records, None).change.is_none());
    }
}
