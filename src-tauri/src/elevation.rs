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
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    let uac_disabled = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System")
        .and_then(|key| key.get_value::<u32, _>("EnableLUA"))
        .is_ok_and(|value| value == 0);
    if !uac_disabled {
        return false;
    }
    match (
        identity::own_token(),
        identity::shell_token(windows_sys::Win32::Security::TOKEN_QUERY),
    ) {
        (Some(own), Some(shell)) => identity::same_user(&own, &shell),
        _ => false,
    }
}

#[cfg(not(windows))]
pub fn current_user_session_allowed() -> bool {
    false
}

/// Which account the elevated helper is working for. Over-the-shoulder UAC
/// (a standard user, a parent typing the administrator password) starts the
/// helper as the administrator: its own %APPDATA% is the administrator's, so
/// the licence, the restore records and the results would all be the wrong
/// person's. The helper serves the signed-in user of its session instead,
/// after checking that the process which asked (its parent, the app) runs as
/// that same user. No path ever crosses the command line.
#[cfg(windows)]
pub enum Caller {
    /// Admin Approval Mode: the helper is the signed-in user, elevated.
    SameUser,
    /// Another account approved the prompt: this is the signed-in user's
    /// roaming AppData folder.
    OtherUser(std::path::PathBuf),
}

#[cfg(windows)]
pub fn resolve_caller() -> Result<Caller, String> {
    use windows_sys::Win32::Security::{TOKEN_IMPERSONATE, TOKEN_QUERY};
    let refused = |why: &str| format!("administrator actions were refused: {why}");
    let own = identity::own_token().ok_or_else(|| refused("own account unreadable"))?;
    let shell = identity::shell_token(TOKEN_QUERY | TOKEN_IMPERSONATE)
        .ok_or_else(|| refused("no signed-in user in this session"))?;
    if identity::same_user(&own, &shell) {
        return Ok(Caller::SameUser);
    }
    let parent = identity::parent_token().ok_or_else(|| refused("the requesting app is gone"))?;
    if !identity::same_user(&parent, &shell) {
        return Err(refused("the request did not come from the signed-in user"));
    }
    identity::roaming_app_data(&shell)
        .map(Caller::OtherUser)
        .ok_or_else(|| refused("the signed-in user's AppData folder is unknown"))
}

#[cfg(windows)]
mod identity {
    use windows_sys::Win32::{
        Foundation::{CloseHandle, HANDLE},
        Security::{EqualSid, GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER},
        System::Threading::{GetCurrentProcess, OpenProcessToken},
        UI::WindowsAndMessaging::{GetShellWindow, GetWindowThreadProcessId},
    };

    pub struct Token(HANDLE);
    impl Drop for Token {
        fn drop(&mut self) {
            // SAFETY: the handle came from OpenProcessToken and is closed once.
            unsafe { CloseHandle(self.0) };
        }
    }

    fn token_of(process: HANDLE, access: u32) -> Option<Token> {
        let mut token = std::ptr::null_mut();
        // SAFETY: `process` is a live handle for the duration of the call.
        (unsafe { OpenProcessToken(process, access, &mut token) } != 0).then(|| Token(token))
    }

    pub fn own_token() -> Option<Token> {
        // SAFETY: the pseudo-handle needs no closing.
        token_of(unsafe { GetCurrentProcess() }, TOKEN_QUERY)
    }

    /// The account owning this session's desktop (Explorer's shell window).
    pub fn shell_token(access: u32) -> Option<Token> {
        // SAFETY: plain queries; a null window means no shell.
        let pid = unsafe {
            let shell = GetShellWindow();
            if shell.is_null() {
                return None;
            }
            let mut pid = 0;
            GetWindowThreadProcessId(shell, &mut pid);
            pid
        };
        let process = crate::process_guard::open(pid, crate::process_guard::Access::Query).ok()?;
        token_of(process.raw(), access)
    }

    /// The app that asked for this helper. Windows makes it the parent of an
    /// approved elevation; it waits for the helper, so its PID cannot have
    /// been reused, and a process started after this one is not it.
    pub fn parent_token() -> Option<Token> {
        let processes = crate::process_guard::processes().ok()?;
        let me = processes.iter().find(|p| p.pid == std::process::id())?;
        let parent = processes.iter().find(|p| Some(p.pid) == me.parent)?;
        if parent.created > me.created {
            return None;
        }
        let process =
            crate::process_guard::open(parent.pid, crate::process_guard::Access::Query).ok()?;
        if process.creation() != Some(parent.created) {
            return None;
        }
        token_of(process.raw(), TOKEN_QUERY)
    }

    fn user(token: &Token) -> Option<Vec<usize>> {
        let mut size = 0;
        // SAFETY: the first call only reports the size; the second fills a
        // buffer of at least that size, aligned for TOKEN_USER.
        unsafe {
            GetTokenInformation(token.0, TokenUser, std::ptr::null_mut(), 0, &mut size);
            if size == 0 || size > 65536 {
                return None;
            }
            let mut buffer = vec![0usize; (size as usize).div_ceil(std::mem::size_of::<usize>())];
            (GetTokenInformation(
                token.0,
                TokenUser,
                buffer.as_mut_ptr().cast(),
                size,
                &mut size,
            ) != 0)
                .then_some(buffer)
        }
    }

    pub fn same_user(a: &Token, b: &Token) -> bool {
        match (user(a), user(b)) {
            // SAFETY: both buffers hold a TOKEN_USER filled by Windows.
            (Some(a), Some(b)) => unsafe {
                let a = &*a.as_ptr().cast::<TOKEN_USER>();
                let b = &*b.as_ptr().cast::<TOKEN_USER>();
                EqualSid(a.User.Sid, b.User.Sid) != 0
            },
            _ => false,
        }
    }

    /// FOLDERID_RoamingAppData as that user sees it, redirection included.
    pub fn roaming_app_data(token: &Token) -> Option<std::path::PathBuf> {
        use std::os::windows::ffi::OsStringExt;
        use windows_sys::Win32::System::Com::CoTaskMemFree;
        use windows_sys::Win32::UI::Shell::{
            FOLDERID_RoamingAppData, SHGetKnownFolderPath, KF_FLAG_DONT_VERIFY,
        };
        let mut raw = std::ptr::null_mut();
        // SAFETY: Windows allocates the string; it is copied and freed here.
        unsafe {
            let ok = SHGetKnownFolderPath(
                &FOLDERID_RoamingAppData,
                KF_FLAG_DONT_VERIFY as u32,
                token.0,
                &mut raw,
            ) >= 0;
            let path = (ok && !raw.is_null()).then(|| {
                let len = (0..).take_while(|&i| *raw.add(i) != 0).count();
                std::path::PathBuf::from(std::ffi::OsString::from_wide(std::slice::from_raw_parts(
                    raw, len,
                )))
            });
            CoTaskMemFree(raw.cast());
            path.filter(|p| p.is_absolute())
        }
    }
}

/// Opens a file in the app data folder without following a link planted at
/// its name: the link itself is opened and refused. A process running as the
/// user can create links there, and the elevated helper must never be
/// steered into writing or creating another file as administrator. Nothing is
/// truncated before the check.
pub(crate) fn open_no_follow(
    path: &std::path::Path,
    append: bool,
) -> std::io::Result<std::fs::File> {
    let mut options = std::fs::OpenOptions::new();
    options.create(true);
    if append {
        options.append(true);
    } else {
        options.write(true);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT);
    }
    let file = options.open(path)?;
    if is_link(&file.metadata()?) || !file.metadata()?.is_file() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            format!(
                "{} is a link to another location; it was not written",
                path.display()
            ),
        ));
    }
    Ok(file)
}

/// `std::fs::write` through [`open_no_follow`].
pub(crate) fn write_no_follow(
    path: impl AsRef<std::path::Path>,
    bytes: impl AsRef<[u8]>,
) -> std::io::Result<()> {
    use std::io::Write;
    let mut file = open_no_follow(path.as_ref(), false)?;
    file.set_len(0)?;
    file.write_all(bytes.as_ref())
}

/// Creates the app data folder if needed and keeps it open, without sharing
/// delete access, for as long as the helper runs. A folder that is open that
/// way cannot be renamed or removed, and neither can any folder above it, so
/// it cannot be swapped for a junction between the check and the writes.
/// A link in its place is refused, as before.
pub fn hold_app_data_dir(dir: &std::path::Path) -> Result<std::fs::File, String> {
    ensure_plain_app_data_dir(dir)?;
    std::fs::create_dir_all(dir).map_err(|e| format!("could not create {}: {e}", dir.display()))?;
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::{
            FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ,
            FILE_SHARE_WRITE,
        };
        options
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT);
    }
    let held = options
        .open(dir)
        .map_err(|e| format!("could not open {}: {e}", dir.display()))?;
    let metadata = held.metadata().map_err(|e| e.to_string())?;
    if is_link(&metadata) || !metadata.is_dir() {
        return Err(format!(
            "{} is a link to another location; administrator actions were refused",
            dir.display()
        ));
    }
    Ok(held)
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
        let parameters = format!("{action_flag} {}", encode_elevated_arg(tweak_id));
        let limit = helper_time_limit(action_flag);
        match shell_runas(&exe, &parameters, limit)? {
            Some(0) => Ok(()),
            Some(code) => Err(format!("the elevated action exited with code {code}")),
            None => Err(format!(
                "the elevated action did not finish within {} minutes; it was left running and its result is unknown",
                limit.as_secs() / 60
            )),
        }
    }

    #[cfg(not(windows))]
    {
        let _ = (exe, action_flag, tweak_id);
        Err("elevation is not implemented on this platform yet".to_string())
    }
}

/// How long the app waits for its elevated helper once the prompt is
/// approved. Every tool the helper runs has its own deadline; this one covers
/// what runs in-process (a restore point through WMI, a COM call) so a hung
/// helper cannot leave the window waiting forever. Jobs that legitimately
/// take hours get hours.
pub(crate) fn helper_time_limit(action_flag: &str) -> std::time::Duration {
    match action_flag {
        "--elevated-securedefrag"
        | "--elevated-repair"
        | "--elevated-diskopt"
        | "--elevated-driverupdate" => crate::system_tools::LONG,
        _ => std::time::Duration::from_secs(30 * 60),
    }
}

/// `ShellExecuteExW` with the `runas` verb, waiting at most `limit` for the
/// helper after the prompt was answered. `Ok(None)`: it did not finish in time.
/// It is not ended from here: this app never terminates a process.
#[cfg(windows)]
fn shell_runas(
    exe: &std::path::Path,
    parameters: &str,
    limit: std::time::Duration,
) -> Result<Option<u32>, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::{
        Foundation::{CloseHandle, WAIT_OBJECT_0, WAIT_TIMEOUT},
        System::{
            Com::{CoInitializeEx, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE},
            Threading::{GetExitCodeProcess, WaitForSingleObject},
        },
        UI::{
            Shell::{
                ShellExecuteExW, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
            },
            WindowsAndMessaging::SW_NORMAL,
        },
    };
    let wide = |s: &std::ffi::OsStr| s.encode_wide().chain([0]).collect::<Vec<u16>>();
    let verb = wide("runas".as_ref());
    let file = wide(exe.as_os_str());
    let parameters = wide(parameters.as_ref());
    // SAFETY: the structure is zeroed, sized, and points at buffers that
    // outlive the call; the returned process handle is always closed.
    unsafe {
        CoInitializeEx(
            std::ptr::null(),
            (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
        );
        let mut info: SHELLEXECUTEINFOW = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        info.fMask = SEE_MASK_NOASYNC | SEE_MASK_NOCLOSEPROCESS;
        info.lpVerb = verb.as_ptr();
        info.lpFile = file.as_ptr();
        info.lpParameters = parameters.as_ptr();
        info.nShow = SW_NORMAL;
        if ShellExecuteExW(&mut info) == 0 || info.hProcess.is_null() {
            return Err(format!(
                "elevation was cancelled or failed: {}",
                std::io::Error::last_os_error()
            ));
        }
        let millis = u32::try_from(limit.as_millis()).unwrap_or(u32::MAX - 1);
        let waited = WaitForSingleObject(info.hProcess, millis);
        let result = if waited == WAIT_OBJECT_0 {
            let mut code = 0u32;
            if GetExitCodeProcess(info.hProcess, &mut code) == 0 {
                Err("could not read the elevated action's result".to_string())
            } else {
                Ok(Some(code))
            }
        } else if waited == WAIT_TIMEOUT {
            Ok(None)
        } else {
            Err("could not wait for the elevated action".to_string())
        };
        CloseHandle(info.hProcess);
        result
    }
}

/// Marks an argument that crossed the UAC relaunch encoded.
const ENCODED_ARG_PREFIX: &str = "b64:";

/// Quoting across the UAC relaunch is easy to get wrong (runas 1.x doubled
/// every backslash: the scheduled task `\Vendor\Some Task` reached the helper
/// as `\\Vendor\\Some Task`). URL-safe base64 is only letters, digits, `-` and
/// `_`, so it needs no quoting at all.
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

    #[cfg(windows)]
    fn junction(link: &std::path::Path, target: &std::path::Path) {
        let made = crate::system_tools::run("cmd", |c| {
            crate::system_tools::output_within(
                c.args(["/C", "mklink", "/J"]).arg(link).arg(target),
                crate::system_tools::QUICK,
            )
        })
        .unwrap();
        assert!(made.status.success(), "mklink /J failed");
    }

    #[cfg(windows)]
    #[test]
    fn writes_never_follow_a_junction_planted_at_the_file_name() {
        use super::{open_no_follow, write_no_follow};
        let dir = temp("nofollow");
        let elsewhere = temp("nofollow-target");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::create_dir_all(&elsewhere).unwrap();
        write_no_follow(dir.join("plain.json"), b"one").unwrap();
        write_no_follow(dir.join("plain.json"), b"2").unwrap();
        assert_eq!(std::fs::read(dir.join("plain.json")).unwrap(), b"2");
        let planted = dir.join("last_cleanup_result.json");
        junction(&planted, &elsewhere);
        assert!(write_no_follow(&planted, b"admin bytes").is_err());
        assert!(open_no_follow(&planted, true).is_err());
        assert_eq!(std::fs::read_dir(&elsewhere).unwrap().count(), 0);
        std::fs::remove_dir(&planted).unwrap();
        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&elsewhere).ok();
    }

    #[cfg(windows)]
    #[test]
    fn a_held_folder_cannot_be_swapped_for_a_junction() {
        let parent = temp("held");
        let dir = parent.join("com.example.app");
        let held = super::hold_app_data_dir(&dir).unwrap();
        // Neither the folder nor the folder above it can be moved away.
        assert!(std::fs::rename(&dir, parent.join("moved")).is_err());
        assert!(std::fs::rename(&parent, temp("held-moved")).is_err());
        drop(held);
        std::fs::rename(&dir, parent.join("moved")).unwrap();
        // A junction in its place is refused before anything is held.
        let elsewhere = temp("held-target");
        std::fs::create_dir_all(&elsewhere).unwrap();
        junction(&dir, &elsewhere);
        assert!(super::hold_app_data_dir(&dir).is_err());
        std::fs::remove_dir(&dir).unwrap();
        std::fs::remove_dir_all(&parent).ok();
        std::fs::remove_dir_all(&elsewhere).ok();
    }

    #[cfg(windows)]
    #[test]
    fn the_signed_in_user_is_its_own_caller() {
        // A unit test is not elevated: same account as the desktop, if any.
        let shell = unsafe { windows_sys::Win32::UI::WindowsAndMessaging::GetShellWindow() };
        if !shell.is_null() {
            assert!(matches!(
                super::resolve_caller(),
                Ok(super::Caller::SameUser)
            ));
        }
    }

    #[test]
    fn only_hour_long_jobs_get_hours() {
        use super::helper_time_limit;
        for long in [
            "--elevated-securedefrag",
            "--elevated-repair",
            "--elevated-diskopt",
            "--elevated-driverupdate",
        ] {
            assert_eq!(helper_time_limit(long), crate::system_tools::LONG);
        }
        assert_eq!(
            helper_time_limit("--elevated-apply-many"),
            std::time::Duration::from_secs(1800)
        );
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
