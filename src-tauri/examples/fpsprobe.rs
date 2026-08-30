//! Checks that the frame counter actually sees frames on this machine.
//!
//! Everything about `fps.rs` can be unit tested except the one thing that
//! could quietly be wrong: whether the DXGI provider and the event id it
//! filters on really do yield a present per frame here. That cannot be
//! asserted from a unit test, because it depends on Windows and on there
//! being something on screen that renders. So it is checked by running it.
//!
//! Needs an elevated shell, like the feature itself:
//!
//!     cargo run --release --example fpsprobe
//!
//! It traces for half a minute so there is time to switch to a game and back:
//! a game that is not in the foreground usually stops presenting altogether,
//! which reads here as the game being invisible to the counter when really it
//! was only paused. Anything drawing through Direct3D — a game, a browser,
//! the app's own WebView — should appear with a plausible rate and its own
//! name.
#[cfg(windows)]
fn main() {
    use tauri_app_lib::fps::imp;

    let capture = match imp::Capture::start() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("could not start the trace session: {e}");
            std::process::exit(1);
        }
    };
    println!("tracing for 30 seconds — switch to the game now, it has to be in the foreground");

    // Resolved once, at the end: naming a process needs a pass over the
    // system process list, which has no business running inside the sampling
    // loop it is meant to be observing.
    let mut seen_pids: std::collections::BTreeSet<u32> = std::collections::BTreeSet::new();
    let mut best: std::collections::BTreeMap<u32, (f64, usize)> = std::collections::BTreeMap::new();

    let mut ever_saw_anything = false;
    for second in 1..=30 {
        std::thread::sleep(std::time::Duration::from_secs(1));
        let mut rows = imp::active();
        // Busiest first: on a normal desktop most of these are compositors
        // and browsers ticking over, and the interesting one is whatever is
        // actually rendering.
        rows.sort_by(|a, b| b.1.fps.total_cmp(&a.1.fps));
        if rows.is_empty() {
            println!("[{second}s] nothing presenting");
            continue;
        }
        ever_saw_anything = true;
        for (pid, s) in rows.iter() {
            seen_pids.insert(*pid);
            let slot = best.entry(*pid).or_insert((0.0, 0));
            if s.sample_frames > slot.1 {
                *slot = (s.fps, s.sample_frames);
            }
        }
        for (pid, s) in rows.iter().take(6) {
            let low = s
                .low1_fps
                .map_or_else(|| "-".to_string(), |v| format!("{v:.0}"));
            println!(
                "[{second}s] pid {pid:>6}  {:>7.1} fps  {:>6.2} ms  1% low {low:>5}  ({} frames)",
                s.fps, s.frametime_ms, s.sample_frames
            );
        }
    }

    capture.stop();

    if !seen_pids.is_empty() {
        let mut sys = sysinfo::System::new();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        println!("
-- processes that presented --");
        for pid in &seen_pids {
            let name = sys
                .process(sysinfo::Pid::from_u32(*pid))
                .map_or_else(|| "(exited)".to_string(), |p| p.name().to_string_lossy().to_string());
            let (fps, frames) = best.get(pid).copied().unwrap_or((0.0, 0));
            println!("  pid {pid:>6}  {name:<24} best {fps:>7.1} fps over {frames} frames");
        }
    }

    if ever_saw_anything {
        println!("\nOK: the provider yields present events and the rates are being computed.");
    } else {
        eprintln!(
            "\nFAIL: the session started but no present events arrived. Either the event id \
             filter is wrong for this Windows build, or nothing was rendering."
        );
        std::process::exit(2);
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!("The frame counter is Windows-only.");
}
