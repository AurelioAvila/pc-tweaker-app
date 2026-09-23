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
        System::Threading::{
            GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
        },
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
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return false;
        }
        let mut shell_token = std::ptr::null_mut();
        let mut own_token = std::ptr::null_mut();
        let opened_shell = OpenProcessToken(process, TOKEN_QUERY, &mut shell_token) != 0;
        CloseHandle(process);
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
