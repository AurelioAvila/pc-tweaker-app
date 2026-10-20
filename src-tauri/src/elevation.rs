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
            .arg(encode_elevated_arg(tweak_id))
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

/// Marks an argument that crossed the UAC relaunch encoded.
const ENCODED_ARG_PREFIX: &str = "b64:";

/// runas 1.x quotes any argument containing a space and doubles every
/// backslash inside the quotes, which Windows' command-line parsing keeps
/// literally: the scheduled task `\Vendor\Some Task` reached the helper as
/// `\\Vendor\\Some Task`. URL-safe base64 is only letters, digits, `-` and `_`,
/// so runas passes it through untouched.
pub(crate) fn encode_elevated_arg(value: &str) -> String {
    use base64::Engine as _;
    format!(
        "{ENCODED_ARG_PREFIX}{}",
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(value)
    )
}

/// The helper's side of `encode_elevated_arg`. A malformed payload is refused
/// rather than guessed at. An unprefixed argument is taken as it is: an app
/// still running from before an update relaunches the new binary that way.
pub fn decode_elevated_arg(arg: &str) -> Result<String, String> {
    use base64::Engine as _;
    let Some(encoded) = arg.strip_prefix(ENCODED_ARG_PREFIX) else {
        return Ok(arg.to_owned());
    };
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(encoded)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .ok_or_else(|| "the elevated action received a malformed argument".to_string())
}

/// The elevated helper is this same executable, installed per user, so the
/// folder it starts from is writable without administrator rights. Any DLL
/// it loads by name afterwards (WMI, COM, `LoadLibrary` of a system library)
/// must come from System32 only, never from a file planted next to the exe.
/// Static imports are covered at link time by /DEPENDENTLOADFLAG (build.rs).
#[cfg(windows)]
pub fn restrict_dll_search_to_system32() {
    use windows_sys::Win32::System::LibraryLoader::{
        SetDefaultDllDirectories, LOAD_LIBRARY_SEARCH_SYSTEM32,
    };
    unsafe {
        SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32);
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
    use super::{decode_elevated_arg, encode_elevated_arg, ensure_plain_app_data_dir};

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("pct-elevation-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn elevated_arguments_survive_the_relaunch_encoding() {
        for value in [
            r"\Vendor\Some Task",
            r"\Adobe Acrobat Update Task",
            "C:\\Program Files\\App\\",
            "say \"hi\" \\\"",
            "Pianificazione è già attiva — 日本語",
            "250:release",
            "",
        ] {
            let encoded = encode_elevated_arg(value);
            assert!(encoded
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, ':' | '-' | '_')));
            assert_eq!(decode_elevated_arg(&encoded).unwrap(), value);
        }
    }

    #[test]
    fn malformed_encoded_arguments_are_refused() {
        for bad in ["b64:!!!", "b64:a", "b64:/w", "b64:_w"] {
            assert!(decode_elevated_arg(bad).is_err(), "{bad}");
        }
        assert_eq!(decode_elevated_arg("tcp-nagle").unwrap(), "tcp-nagle");
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
