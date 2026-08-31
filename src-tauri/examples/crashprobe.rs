//! Proves the panic hook actually writes a scrubbed report.
//!
//! The hook cannot be unit tested: it runs during a panic, in a process on
//! its way down, and a test harness that panics is a test harness that
//! failed. So this binary installs the hook exactly as the app does, panics
//! on purpose in a child process, and the parent reads the file back.
//!
//!     cargo run --release --example crashprobe
//!
//! Checks two things that matter and that no unit test can reach: that a real
//! panic produces a report at all, and that the account name in the panic
//! text does not survive into the file the user is invited to paste in public.
fn main() {
    let dir = std::env::temp_dir().join("pctweaker-crashprobe");

    if std::env::args().any(|a| a == "--panic-now") {
        tauri_app_lib::crash::install(dir, tauri_app_lib::crash::PROCESS_ELEVATED);
        let user = std::env::var("USERNAME").unwrap_or_default();
        // A path-shaped message, because that is how a real panic leaks a
        // name: formatted from a filesystem error, not written deliberately.
        panic!("deliberate probe panic reading C:\\Users\\{user}\\secret.json");
    }

    let _ = std::fs::remove_dir_all(&dir);
    let exe = std::env::current_exe().expect("current exe");
    let status = std::process::Command::new(exe)
        .arg("--panic-now")
        .status()
        .expect("spawn the child that panics");
    println!("child exited: {status}");

    let reports = tauri_app_lib::crash::list_in(&dir);
    println!("reports recorded: {}", reports.len());
    for r in &reports {
        println!("  process={}  location={}", r.process, r.location);
        println!("  message={}", r.message);
    }

    if reports.is_empty() {
        eprintln!("\nFAIL: a real panic produced no report.");
        std::process::exit(1);
    }

    let user = std::env::var("USERNAME").unwrap_or_default();
    if !user.is_empty() {
        for r in &reports {
            if r.message.to_lowercase().contains(&user.to_lowercase()) {
                eprintln!("\nFAIL: the account name survived into the report.");
                std::process::exit(2);
            }
        }
    }

    println!("\nOK: the panic was recorded and the account name was scrubbed.");
}
