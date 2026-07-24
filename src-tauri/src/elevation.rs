#[cfg(windows)]
pub fn is_elevated() -> bool {
    is_elevated::is_elevated()
}

#[cfg(not(windows))]
pub fn is_elevated() -> bool {
    false
}

/// Re-launches the current executable with a UAC consent prompt, asking it to
/// run a single headless action (`--elevated-apply <id>` or
/// `--elevated-rollback <id>`) and exit. Nothing else about the app runs
/// elevated: only this one action does, and only after the user approves the
/// prompt.
pub fn run_elevated_action(action_flag: &str, tweak_id: &str) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    #[cfg(windows)]
    {
        let status = runas::Command::new(exe)
            .arg(action_flag)
            .arg(tweak_id)
            .gui(true)
            .status()
            .map_err(|e| format!("elevazione annullata o fallita: {}", e))?;

        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "l'azione elevata è terminata con codice {:?}",
                status.code()
            ))
        }
    }

    #[cfg(not(windows))]
    {
        let _ = exe;
        Err("elevazione non ancora implementata su questa piattaforma".to_string())
    }
}
