// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    {
        let args: Vec<String> = std::env::args().collect();
        if args.len() == 3
            && (args[1] == "--elevated-apply"
                || args[1] == "--elevated-apply-many"
                || args[1] == "--elevated-rollback"
                || args[1] == "--elevated-cleanup"
                || args[1] == "--elevated-cleanup-sel"
                || args[1] == "--elevated-startup")
        {
            // Relaunched via UAC to perform exactly one privileged action headlessly.
            tauri_app_lib::run_elevated_headless(&args[1], &args[2]);
        }
    }

    tauri_app_lib::run()
}
