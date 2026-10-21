// The desktop UI must not own a console, including local preview builds.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

// ADVAPI32's SystemFunction036 (ring's random source, through getrandom 0.2)
// is a forwarder into CRYPTBASE.DLL, and Windows resolves forwarders by plain
// name, install folder first: a CRYPTBASE.DLL planted next to the exe loaded
// into the elevated helper (seen in a clean VM). Importing CRYPTBASE.DLL
// itself makes it an import of the exe, which /DEPENDENTLOADFLAG (build.rs)
// maps from System32 before any forwarder is resolved. By ordinal, under a
// name of our own: every CRYPTBASE export name is also in the ADVAPI32 import
// libraries, so a by-name import would bind there. Never called.
#[cfg(all(windows, target_env = "msvc"))]
#[link(name = "cryptbase", kind = "raw-dylib")]
extern "system" {
    #[link_ordinal(1)]
    fn pct_cryptbase_import();
}

fn main() {
    // Keeps the CRYPTBASE.DLL import above in the exe.
    #[cfg(all(windows, target_env = "msvc"))]
    std::hint::black_box(pct_cryptbase_import as unsafe extern "system" fn());
    #[cfg(windows)]
    {
        let args: Vec<String> = std::env::args().collect();
        if args.len() == 3 && args[1] == "--monitor-watchdog" {
            tauri_app_lib::monitor_watchdog(&args[2]);
            return;
        }
        // Must list every flag `run_elevated_headless` handles. Four of them
        // (rollback-many, driverupdate, gpupower, diskopt) were missing: those
        // relaunches fell straight through to `run()` and started a second,
        // full GUI running as administrator instead of performing the action
        // headlessly and exiting. Anything added there has to be added here.
        const ELEVATED_ACTIONS: [&str; 22] = [
            "--elevated-download-limit",
            "--elevated-download-restore",
            "--elevated-session-apply",
            "--elevated-session-rollback",
            "--elevated-apply",
            "--elevated-apply-many",
            "--elevated-rollback",
            "--elevated-rollback-many",
            "--elevated-cleanup",
            "--elevated-cleanup-sel",
            "--elevated-startup",
            "--elevated-driverupdate",
            "--elevated-gpupower",
            "--elevated-diskopt",
            "--elevated-securedefrag",
            "--elevated-memorypurge",
            "--elevated-drift-watch",
            "--elevated-repair",
            "--elevated-task",
            "--elevated-dpc-trace",
            "--elevated-ramtrim",
            "--elevated-boot-times",
        ];
        // VM verification builds only (Cargo feature "test-pro", debug profile).
        #[cfg(feature = "test-pro")]
        if args.len() == 3 && (args[1] == "--test-apply" || args[1] == "--test-rollback") {
            std::process::exit(tauri_app_lib::test_pro_cli(&args[1], &args[2]));
        }
        #[cfg(feature = "test-pro")]
        if args.len() == 3 && args[1] == "--test-debloat" {
            std::process::exit(tauri_app_lib::test_pro_debloat_cli(&args[2]));
        }
        // The scheduled watchdog: one argument, no id, no window, no GUI.
        if args.len() == 2 && args[1] == "--check-drift" {
            tauri_app_lib::run_drift_check_headless();
        }
        if args.len() == 2 && args[1] == "--scheduled-temp-cleanup" {
            tauri_app_lib::run_scheduled_temp_cleanup_headless();
        }
        if args.len() == 3 && ELEVATED_ACTIONS.contains(&args[1].as_str()) {
            // Relaunched via UAC to perform exactly one privileged action headlessly.
            tauri_app_lib::run_elevated_headless(&args[1], &args[2]);
        }
    }

    tauri_app_lib::run()
}
