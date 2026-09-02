//! No spawned process may flash a console window.
//!
//! This application shells out constantly — powershell, defrag, sc, powercfg,
//! ipconfig, nvidia-smi, taskkill — and on Windows every one of those opens a
//! console window unless the spawn asks it not to. On a consumer desktop tool
//! that reads as a black box blinking on screen while the app works: not a
//! crash, not an error, just something that makes a tweaking utility look
//! exactly like the malware people are afraid it is.
//!
//! Every one of the current spawn sites gets this right. That is the problem
//! this test exists for. The flag is repeated by hand in twenty modules, each
//! declaring its own `const CREATE_NO_WINDOW`, so the invariant is held by
//! nothing but the discipline of whoever writes the next one — and the next
//! one is a single missing line in a builder chain that compiles, runs, does
//! the right thing on the developer's machine if they never look at the
//! screen, and ships.
//!
//! The check reads the source rather than the behaviour because the behaviour
//! only shows up on Windows, in a release build, to somebody watching. A
//! shared helper would be the stronger fix — one place to get right instead of
//! twenty-three — but that is a change to twenty working modules, and this
//! catches the omission either way.
//!
//!   cargo test --test console_windows

use std::path::{Path, PathBuf};

/// `runas` is the elevation path. It exists to raise a UAC prompt, which is a
/// window the user is supposed to see, and `runas::Command` has no
/// `creation_flags` to set in the first place.
const EXEMPT: &str = "runas::";

/// A builder chain longer than this is not a chain, it is a parse failure.
const MAX_STATEMENT_LINES: usize = 16;

/// Guards against this test passing because it found nothing: a moved
/// directory, a renamed module, or a switch to some other spawn API would
/// otherwise leave a green tick over an empty list. Well under the count
/// today, so ordinary deletions do not trip it.
const MINIMUM_EXPECTED_SITES: usize = 15;

fn rust_files(dir: &Path, into: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            rust_files(&path, into);
        } else if path.extension().is_some_and(|ext| ext == "rs") {
            into.push(path);
        }
    }
}

#[test]
fn every_spawned_process_is_told_not_to_open_a_console() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    rust_files(&root, &mut files);
    files.sort();

    let mut sites = 0usize;
    let mut unguarded = Vec::new();

    for file in &files {
        let Ok(source) = std::fs::read_to_string(file) else {
            continue;
        };
        let lines: Vec<&str> = source.lines().collect();

        for (index, line) in lines.iter().enumerate() {
            if !line.contains("Command::new") || line.contains(EXEMPT) {
                continue;
            }
            sites += 1;

            // The whole builder chain, which is where the flag goes — not
            // just the line that names the program.
            let mut statement = String::new();
            for next in lines.iter().skip(index).take(MAX_STATEMENT_LINES) {
                statement.push_str(next);
                statement.push('\n');
                if next.trim_end().ends_with(';') {
                    break;
                }
            }

            if !statement.contains("creation_flags") {
                let name = file
                    .strip_prefix(&root)
                    .unwrap_or(file)
                    .to_string_lossy()
                    .replace('\\', "/");
                unguarded.push(format!(
                    "src/{name}:{}  {}",
                    index + 1,
                    line.trim()
                ));
            }
        }
    }

    assert!(
        sites >= MINIMUM_EXPECTED_SITES,
        "only found {sites} spawn sites under {} — this check is looking in the wrong place, \
         or the code stopped using std::process::Command",
        root.display()
    );

    assert!(
        unguarded.is_empty(),
        "{} spawn site(s) would flash a console window. Add \
         `.creation_flags(CREATE_NO_WINDOW)` to the builder chain \
         (`const CREATE_NO_WINDOW: u32 = 0x0800_0000;`, with \
         `use std::os::windows::process::CommandExt;`):\n  {}",
        unguarded.len(),
        unguarded.join("\n  ")
    );
}
