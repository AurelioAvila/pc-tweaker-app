// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    {
        let args: Vec<String> = std::env::args().collect();
        // Must list every flag `run_elevated_headless` handles. Four of them
        // (rollback-many, driverupdate, gpupower, diskopt) were missing: those
        // relaunches fell straight through to `run()` and started a second,
        // full GUI running as administrator instead of performing the action
        // headlessly and exiting. Anything added there has to be added here.
        const ELEVATED_ACTIONS: [&str; 13] = [
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
        ];
        // The scheduled watchdog: one argument, no id, no window, no GUI.
        if args.len() == 2 && args[1] == "--check-drift" {
            tauri_app_lib::run_drift_check_headless();
        }
        if args.len() == 3 && ELEVATED_ACTIONS.contains(&args[1].as_str()) {
            // Relaunched via UAC to perform exactly one privileged action headlessly.
            tauri_app_lib::run_elevated_headless(&args[1], &args[2]);
        }
    }

    tauri_app_lib::run()
}
