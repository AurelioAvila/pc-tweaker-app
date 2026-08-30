//! Where the overlay sits, and whether it takes the mouse.
//!
//! The overlay used to be created click-through and stay that way for its
//! whole life. That is right for the thing it was built for — a panel over a
//! borderless game must not swallow a click meant for the game — but it made
//! the window impossible to place: it could not be grabbed, and a click aimed
//! at it went to whatever was behind, which on the desktop meant dragging the
//! icons underneath it. An overlay you cannot move and that rearranges your
//! desktop when you try is worse than one that occasionally needs a lock.
//!
//! So the two concerns are separated. The window is interactive by default,
//! so it can be dragged where the user wants it, and click-through is a mode
//! they turn on from the card that opened it — before starting the game, when
//! the position is already right. The position is remembered, because being
//! asked to place it again on every launch would defeat the point.

use serde::{Deserialize, Serialize};
use std::path::Path;

/// Where the overlay opens the first time, before anyone has moved it.
const DEFAULT_X: f64 = 24.0;
const DEFAULT_Y: f64 = 24.0;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct HudPlacement {
    pub x: f64,
    pub y: f64,
    /// Compact hides the bars and the process row and shrinks the window to
    /// the numbers alone. Defaults to false through serde so a placement file
    /// written before this existed still loads.
    #[serde(default)]
    pub compact: bool,
}

impl Default for HudPlacement {
    fn default() -> Self {
        Self {
            x: DEFAULT_X,
            y: DEFAULT_Y,
            compact: false,
        }
    }
}

/// The size each mode's window opens at, in logical pixels.
///
/// A starting guess, not the answer. The page measures the panel once it has
/// laid out and sizes the window to match, because the content is not a fixed
/// width: the readings change width as they change, and a translated label or
/// a longer foreground process name changes it more. These values exist only
/// so the window opens near its final size instead of visibly snapping to it.
///
/// The compact guess used to be 286, which was narrow enough to cut the last
/// metric in half — the panel filled the window then, so whatever did not fit
/// was simply clipped. That is what measuring replaced. These are the sizes
/// the panel measures at with the frame counter off, which is how it opens;
/// turning the counter on adds a row and the window follows.
pub const NORMAL_SIZE: (f64, f64) = (398.0, 84.0);
pub const COMPACT_SIZE: (f64, f64) = (399.0, 36.0);

pub fn size_for(compact: bool) -> (f64, f64) {
    if compact {
        COMPACT_SIZE
    } else {
        NORMAL_SIZE
    }
}

fn placement_path(app_data_dir: &Path) -> std::path::PathBuf {
    app_data_dir.join("hud_placement.json")
}

/// Reads the remembered position, falling back to the default corner.
///
/// A missing or unreadable file is not an error worth surfacing: the overlay
/// opening in the corner is a complete answer to "we do not know where you
/// last put it".
pub fn read_placement(app_data_dir: &Path) -> HudPlacement {
    std::fs::read_to_string(placement_path(app_data_dir))
        .ok()
        .and_then(|raw| serde_json::from_str::<HudPlacement>(&raw).ok())
        .map(sanitise)
        .unwrap_or_default()
}

pub fn write_placement(app_data_dir: &Path, placement: HudPlacement) -> Result<(), String> {
    std::fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&sanitise(placement)).map_err(|e| e.to_string())?;
    std::fs::write(placement_path(app_data_dir), json).map_err(|e| e.to_string())
}

/// Keeps a stored position usable.
///
/// Two things can put the overlay somewhere unreachable: a monitor that is no
/// longer attached, which leaves coordinates far outside any screen, and a
/// non-finite value from a corrupted file. Either would open the window where
/// it cannot be seen or grabbed, and the user's only clue would be that the
/// overlay "stopped working". Out-of-range values fall back to the corner
/// rather than being trusted.
fn sanitise(p: HudPlacement) -> HudPlacement {
    // Deliberately generous: multi-monitor setups legitimately use large and
    // negative coordinates, so this rejects the absurd, not the unusual.
    const LIMIT: f64 = 32_000.0;
    if !p.x.is_finite() || !p.y.is_finite() || p.x.abs() > LIMIT || p.y.abs() > LIMIT {
        // Only the coordinates are suspect; the chosen size is still the
        // user's and survives being moved back to the corner.
        return HudPlacement {
            compact: p.compact,
            ..HudPlacement::default()
        };
    }
    p
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("pctweaker-hud-{}-{}", tag, std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn an_unplaced_overlay_opens_in_the_default_corner() {
        let dir = temp_dir("unset");
        std::fs::remove_file(placement_path(&dir)).ok();
        assert_eq!(read_placement(&dir), HudPlacement::default());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_position_survives_a_round_trip() {
        let dir = temp_dir("roundtrip");
        let placed = HudPlacement { x: 1280.0, y: 720.0, compact: false };
        write_placement(&dir, placed).unwrap();
        assert_eq!(read_placement(&dir), placed);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_negative_position_is_kept_because_a_second_monitor_can_be_left_of_the_first() {
        let dir = temp_dir("negative");
        let placed = HudPlacement { x: -1900.0, y: 40.0, compact: true };
        write_placement(&dir, placed).unwrap();
        assert_eq!(read_placement(&dir), placed);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_position_from_a_monitor_that_is_gone_falls_back_to_the_corner() {
        let dir = temp_dir("faraway");
        write_placement(&dir, HudPlacement { x: 99_000.0, y: 12.0, compact: false }).unwrap();
        assert_eq!(read_placement(&dir), HudPlacement::default());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_placement_written_before_compact_existed_still_loads() {
        // Users upgrading from 1.4.1 have a file with only x and y in it;
        // failing to parse it would silently move their overlay back to the
        // corner on first launch.
        let dir = temp_dir("legacy");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(placement_path(&dir), r#"{"x":800.0,"y":600.0}"#).unwrap();
        let read = read_placement(&dir);
        assert_eq!(read.x, 800.0);
        assert_eq!(read.y, 600.0);
        assert!(!read.compact, "an unspecified size means the normal one");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_far_away_position_keeps_the_chosen_size() {
        let out_of_reach = HudPlacement {
            x: 99_000.0,
            y: 0.0,
            compact: true,
        };
        assert!(sanitise(out_of_reach).compact, "the size was the user's choice, not the monitor's");
    }

    #[test]
    fn a_corrupted_file_does_not_hide_the_overlay() {
        let dir = temp_dir("corrupt");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(placement_path(&dir), "{ this is not json").unwrap();
        assert_eq!(read_placement(&dir), HudPlacement::default());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_non_finite_coordinate_is_refused() {
        assert_eq!(
            sanitise(HudPlacement {
                x: f64::NAN,
                y: 10.0,
                compact: false
            }),
            HudPlacement::default()
        );
        assert_eq!(
            sanitise(HudPlacement {
                x: 10.0,
                y: f64::INFINITY,
                compact: false
            }),
            HudPlacement::default()
        );
    }
}
