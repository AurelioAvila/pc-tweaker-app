//! Health Score history and change explanation.
//!
//! The score alone is a photograph. This module is the album: every computed
//! report is appended to a local JSONL file so the next one can answer the
//! question the number itself cannot — *why did it change?*
//!
//! Design contract, same spirit as `health.rs`:
//! - the comparison is a pure function over two stored snapshots, unit-tested
//!   on any platform;
//! - a category is only named as a cause when its score actually moved, and
//!   the reason quotes the factor evidence before and after, so "-4 Startup"
//!   is always backed by "5 apps start with Windows" → "7 apps start with
//!   Windows";
//! - a factor whose *evidence text* drifted but whose points did not move is
//!   NOT a cause. Memory usage reading 61% instead of 58% explains nothing;
//!   claiming it does would be exactly the invented precision this product
//!   refuses to ship;
//! - nothing here leaves the machine.

use crate::health::HealthReport;
use serde::{Deserialize, Serialize};

/// A stored factor. Ids are owned `String`s rather than the `&'static str`
/// the live report uses, because a snapshot read back from disk may name a
/// factor that a newer build no longer defines — and that has to round-trip
/// intact rather than fail to parse.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotFactor {
    pub id: String,
    pub earned: u32,
    pub max: u32,
    pub evidence: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotCategory {
    pub id: String,
    pub score: u32,
    pub factors: Vec<SnapshotFactor>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HealthSnapshot {
    /// Unix seconds.
    pub ts: u64,
    pub overall: u32,
    pub categories: Vec<SnapshotCategory>,
}

impl HealthSnapshot {
    pub fn from_report(report: &HealthReport, ts: u64) -> Self {
        HealthSnapshot {
            ts,
            overall: report.overall,
            categories: report
                .categories
                .iter()
                .map(|c| SnapshotCategory {
                    id: c.id.to_string(),
                    score: c.score,
                    factors: c
                        .factors
                        .iter()
                        .map(|f| SnapshotFactor {
                            id: f.id.to_string(),
                            earned: f.earned,
                            max: f.max,
                            evidence: f.evidence.clone(),
                        })
                        .collect(),
                })
                .collect(),
        }
    }
}

/// One factor that genuinely moved points between two measurements.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FactorChange {
    pub id: String,
    pub delta: i32,
    pub evidence_before: String,
    pub evidence_after: String,
}

/// One category that genuinely moved, with the factors responsible.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CategoryChange {
    pub id: String,
    pub before: u32,
    pub after: u32,
    /// Category-score points, 0-100 scale.
    pub delta: i32,
    /// How much of the OVERALL move this category accounts for. The overall
    /// score is the mean of the categories, so a category swinging 9 points
    /// across 9 categories moves the headline by 1. Reported explicitly
    /// because "+9 Startup" next to "+1 overall" otherwise reads as a bug.
    pub overall_contribution: f64,
    pub reasons: Vec<FactorChange>,
}

/// The answer to "why did my score change?".
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HealthComparison {
    pub previous_ts: u64,
    pub previous_overall: u32,
    pub delta: i32,
    /// Categories that moved, largest absolute move first. Empty when the two
    /// measurements are identical — which the UI reports as "no change", not
    /// as a missing explanation.
    pub categories: Vec<CategoryChange>,
    /// Categories present in exactly one of the two snapshots (an app update
    /// added or removed a category). Named so the arithmetic never silently
    /// disagrees with the list of causes.
    pub structural_change: bool,
}

/// Compares two snapshots. Pure: same pair in, same explanation out.
pub fn compare(previous: &HealthSnapshot, current: &HealthSnapshot) -> HealthComparison {
    let category_count = current.categories.len().max(1) as f64;
    let mut categories: Vec<CategoryChange> = Vec::new();
    let mut structural_change = false;

    for cat in &current.categories {
        let Some(before) = previous.categories.iter().find(|c| c.id == cat.id) else {
            structural_change = true;
            continue;
        };
        if before.score == cat.score {
            continue;
        }

        let mut reasons: Vec<FactorChange> = Vec::new();
        for f in &cat.factors {
            let Some(fb) = before.factors.iter().find(|x| x.id == f.id) else {
                structural_change = true;
                continue;
            };
            // Points moved or nothing to say. Evidence text that drifts while
            // the score holds is noise, not a cause.
            if fb.earned == f.earned {
                continue;
            }
            reasons.push(FactorChange {
                id: f.id.clone(),
                delta: f.earned as i32 - fb.earned as i32,
                evidence_before: fb.evidence.clone(),
                evidence_after: f.evidence.clone(),
            });
        }
        reasons.sort_by_key(|r| -r.delta.abs());

        let delta = cat.score as i32 - before.score as i32;
        categories.push(CategoryChange {
            id: cat.id.clone(),
            before: before.score,
            after: cat.score,
            delta,
            overall_contribution: delta as f64 / category_count,
            reasons,
        });
    }

    if previous.categories.iter().any(|p| !current.categories.iter().any(|c| c.id == p.id)) {
        structural_change = true;
    }

    categories.sort_by_key(|c| -c.delta.abs());

    HealthComparison {
        previous_ts: previous.ts,
        previous_overall: previous.overall,
        delta: current.overall as i32 - previous.overall as i32,
        categories,
        structural_change,
    }
}

// ---------------------------------------------------------------------------
// Local persistence. JSONL, app data dir, capped — nothing leaves the machine.

const MAX_ROWS: usize = 200;

fn history_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("health-history.jsonl"))
}

/// Every stored measurement, oldest first, capped at the most recent
/// `MAX_ROWS`. Unparsable lines (written by a future build) are skipped
/// rather than failing the whole read.
pub fn read_history(app: &tauri::AppHandle) -> Vec<HealthSnapshot> {
    let Ok(path) = history_path(app) else {
        return Vec::new();
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    let mut rows: Vec<HealthSnapshot> = content
        .lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();
    if rows.len() > MAX_ROWS {
        rows.drain(..rows.len() - MAX_ROWS);
    }
    rows
}

pub fn append(app: &tauri::AppHandle, snapshot: &HealthSnapshot) -> Result<(), String> {
    use std::io::Write;
    let path = history_path(app)?;
    let line = serde_json::to_string(snapshot).map_err(|e| e.to_string())?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{line}").map_err(|e| e.to_string())
}

/// The stored history, for the trend view.
#[tauri::command]
pub fn list_health_history(app: tauri::AppHandle) -> Result<Vec<HealthSnapshot>, String> {
    Ok(read_history(&app))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn factor(id: &str, earned: u32, evidence: &str) -> SnapshotFactor {
        SnapshotFactor { id: id.into(), earned, max: 100, evidence: evidence.into() }
    }

    fn snap(ts: u64, overall: u32, cats: Vec<SnapshotCategory>) -> HealthSnapshot {
        HealthSnapshot { ts, overall, categories: cats }
    }

    fn cat(id: &str, score: u32, factors: Vec<SnapshotFactor>) -> SnapshotCategory {
        SnapshotCategory { id: id.into(), score, factors }
    }

    #[test]
    fn identical_snapshots_produce_no_causes() {
        let a = snap(100, 80, vec![cat("startup", 70, vec![factor("start_count", 70, "7 apps")])]);
        let b = snap(200, 80, a.categories.clone());
        let c = compare(&a, &b);
        assert_eq!(c.delta, 0);
        assert!(c.categories.is_empty());
        assert!(!c.structural_change);
    }

    #[test]
    fn a_moved_category_names_the_factor_and_quotes_both_sides() {
        let before = snap(100, 80, vec![cat("startup", 100, vec![factor("start_count", 100, "4 apps start with Windows")])]);
        let after = snap(200, 76, vec![cat("startup", 70, vec![factor("start_count", 70, "7 apps start with Windows")])]);
        let c = compare(&before, &after);
        assert_eq!(c.delta, -4);
        assert_eq!(c.categories.len(), 1);
        let cc = &c.categories[0];
        assert_eq!(cc.id, "startup");
        assert_eq!(cc.delta, -30);
        assert_eq!(cc.reasons.len(), 1);
        assert_eq!(cc.reasons[0].evidence_before, "4 apps start with Windows");
        assert_eq!(cc.reasons[0].evidence_after, "7 apps start with Windows");
    }

    #[test]
    fn evidence_drift_without_a_point_move_is_not_a_cause() {
        // Memory usage reading differently is not an explanation unless it
        // crossed a scoring threshold.
        let before = snap(100, 80, vec![cat("memory", 65, vec![factor("mem_pressure", 25, "58% in use right now")])]);
        let after = snap(200, 80, vec![cat("memory", 65, vec![factor("mem_pressure", 25, "61% in use right now")])]);
        let c = compare(&before, &after);
        assert!(c.categories.is_empty(), "same score must yield no causes");
    }

    #[test]
    fn causes_are_ordered_by_impact_and_carry_overall_contribution() {
        let before = snap(
            100,
            50,
            vec![
                cat("startup", 100, vec![factor("start_count", 100, "4 apps")]),
                cat("privacy", 50, vec![factor("priv_telemetry", 50, "not applied")]),
            ],
        );
        let after = snap(
            200,
            60,
            vec![
                cat("startup", 90, vec![factor("start_count", 90, "5 apps")]),
                cat("privacy", 100, vec![factor("priv_telemetry", 100, "applied")]),
            ],
        );
        let c = compare(&before, &after);
        assert_eq!(c.categories[0].id, "privacy", "largest absolute move leads");
        assert_eq!(c.categories[0].delta, 50);
        // Two categories: half of a 50-point category move lands on the mean.
        assert!((c.categories[0].overall_contribution - 25.0).abs() < 0.001);
        assert_eq!(c.categories[1].delta, -10);
    }

    #[test]
    fn a_category_added_by_an_update_is_flagged_not_blamed() {
        let before = snap(100, 80, vec![cat("startup", 80, vec![factor("start_count", 80, "5 apps")])]);
        let after = snap(
            200,
            85,
            vec![
                cat("startup", 80, vec![factor("start_count", 80, "5 apps")]),
                cat("thermals", 90, vec![factor("thermal_headroom", 90, "cool")]),
            ],
        );
        let c = compare(&before, &after);
        assert!(c.structural_change, "a new category must be disclosed");
        assert!(c.categories.is_empty(), "a category with no history is not a cause");
    }

    #[test]
    fn snapshots_round_trip_through_json() {
        let a = snap(100, 80, vec![cat("startup", 70, vec![factor("start_count", 70, "7 apps")])]);
        let text = serde_json::to_string(&a).unwrap();
        let back: HealthSnapshot = serde_json::from_str(&text).unwrap();
        assert_eq!(a, back);
    }
}
