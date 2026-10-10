#[cfg(windows)]
pub fn is_elevated() -> bool {
    is_elevated::is_elevated()
}

#[cfg(not(windows))]
pub fn is_elevated() -> bool {
    false
}

/// With UAC disabled Windows has no filtered token for an administrator.
/// Permit this case only for the account owning the interactive shell. A
/// Run-as-other-user process must never treat its inventory as the user's.
#[cfg(windows)]
pub fn current_user_session_allowed() -> bool {
    if !is_elevated() {
        return true;
    }
    use windows_sys::Win32::{
        Foundation::CloseHandle,
        Security::{EqualSid, GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER},
        System::Threading::{GetCurrentProcess, OpenProcessToken},
        UI::WindowsAndMessaging::{GetShellWindow, GetWindowThreadProcessId},
    };
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    let uac_disabled = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System")
        .and_then(|key| key.get_value::<u32, _>("EnableLUA"))
        .is_ok_and(|value| value == 0);
    if !uac_disabled {
        return false;
    }
    unsafe {
        let shell = GetShellWindow();
        if shell.is_null() {
            return false;
        }
        let mut pid = 0;
        GetWindowThreadProcessId(shell, &mut pid);
        // Explorer, opened query-limited through the guard like every other
        // process this app looks at.
        let Ok(process) = crate::process_guard::open(pid, crate::process_guard::Access::Query)
        else {
            return false;
        };
        let mut shell_token = std::ptr::null_mut();
        let mut own_token = std::ptr::null_mut();
        let opened_shell = OpenProcessToken(process.raw(), TOKEN_QUERY, &mut shell_token) != 0;
        drop(process);
        if !opened_shell {
            return false;
        }
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut own_token) == 0 {
            CloseHandle(shell_token);
            return false;
        }
        let user = |token| -> Option<Vec<usize>> {
            let mut size = 0;
            GetTokenInformation(token, TokenUser, std::ptr::null_mut(), 0, &mut size);
            if size == 0 || size > 65536 {
                return None;
            }
            let mut buffer = vec![0usize; (size as usize).div_ceil(std::mem::size_of::<usize>())];
            if GetTokenInformation(
                token,
                TokenUser,
                buffer.as_mut_ptr().cast(),
                size,
                &mut size,
            ) == 0
            {
                None
            } else {
                Some(buffer)
            }
        };
        let own = user(own_token);
        let interactive = user(shell_token);
        CloseHandle(own_token);
        CloseHandle(shell_token);
        match (own, interactive) {
            (Some(a), Some(b)) => {
                let a = &*a.as_ptr().cast::<TOKEN_USER>();
                let b = &*b.as_ptr().cast::<TOKEN_USER>();
                EqualSid(a.User.Sid, b.User.Sid) != 0
            }
            _ => false,
        }
    }
}

#[cfg(not(windows))]
pub fn current_user_session_allowed() -> bool {
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
            .map_err(|e| format!("elevation was cancelled or failed: {}", e))?;

        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "the elevated action exited with code {:?}",
                status.code()
            ))
        }
    }

    #[cfg(not(windows))]
    {
        let _ = exe;
        Err("elevation is not implemented on this platform yet".to_string())
    }
}

/// The elevated helper reads and writes the user's app data folder, which any
/// process running as that user can change. A junction or symbolic link in its
/// place would send the administrator's writes to another location, so the
/// helper refuses to run through one. A missing folder is fine: the helper
/// creates it as a plain directory.
pub fn ensure_plain_app_data_dir(dir: &std::path::Path) -> Result<(), String> {
    match std::fs::symlink_metadata(dir) {
        Ok(metadata) if is_link(&metadata) => Err(format!(
            "{} is a link to another location; administrator actions were refused",
            dir.display()
        )),
        Ok(metadata) if !metadata.is_dir() => Err(format!(
            "{} is not a folder; administrator actions were refused",
            dir.display()
        )),
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("could not inspect {}: {}", dir.display(), e)),
    }
}

pub(crate) fn is_link(metadata: &std::fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        // FILE_ATTRIBUTE_REPARSE_POINT covers junctions as well as symbolic links.
        metadata.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    false
}

#[cfg(test)]
mod app_data_dir_tests {
    use super::ensure_plain_app_data_dir;

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("pct-elevation-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn a_missing_or_plain_folder_is_accepted() {
        let dir = temp("plain");
        assert!(ensure_plain_app_data_dir(&dir).is_ok());
        std::fs::create_dir_all(&dir).unwrap();
        assert!(ensure_plain_app_data_dir(&dir).is_ok());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_file_in_place_of_the_folder_is_refused() {
        let dir = temp("file");
        std::fs::write(&dir, b"x").unwrap();
        assert!(ensure_plain_app_data_dir(&dir).is_err());
        std::fs::remove_file(&dir).ok();
    }

    #[cfg(unix)]
    #[test]
    fn a_link_in_place_of_the_folder_is_refused() {
        let target = temp("target");
        let link = temp("link");
        std::fs::create_dir_all(&target).unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();
        assert!(ensure_plain_app_data_dir(&link).is_err());
        std::fs::remove_file(&link).ok();
        std::fs::remove_dir_all(&target).ok();
    }
}
