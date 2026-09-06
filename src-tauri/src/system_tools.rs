//! Resolve native tools from Windows-owned directories, never PATH or cwd.
use std::{io, path::PathBuf, process::Command};

fn windows_directory(system: bool) -> io::Result<PathBuf> {
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::System::SystemInformation::{
        GetSystemDirectoryW, GetWindowsDirectoryW,
    };
    let mut buffer = vec![0u16; 32768];
    // SAFETY: both APIs receive a writable buffer and its exact capacity.
    let count = unsafe {
        if system {
            GetSystemDirectoryW(buffer.as_mut_ptr(), buffer.len() as u32)
        } else {
            GetWindowsDirectoryW(buffer.as_mut_ptr(), buffer.len() as u32)
        }
    } as usize;
    if count == 0 {
        return Err(io::Error::last_os_error());
    }
    if count >= buffer.len() {
        return Err(io::Error::other("Windows directory path is too long"));
    }
    let path = PathBuf::from(std::ffi::OsString::from_wide(&buffer[..count]));
    if !path.is_absolute() {
        return Err(io::Error::other(
            "Windows returned a relative system directory",
        ));
    }
    Ok(path)
}

fn tool_path(name: &str) -> io::Result<PathBuf> {
    let relative = match name {
        "powershell" => r"WindowsPowerShell\v1.0\powershell.exe",
        "cmd" => "cmd.exe",
        "sc" => "sc.exe",
        "schtasks" => "schtasks.exe",
        "taskkill" => "taskkill.exe",
        "shutdown" => "shutdown.exe",
        "powercfg" => "powercfg.exe",
        "ipconfig" => "ipconfig.exe",
        "defrag" => "defrag.exe",
        "dism" | "dism.exe" => "dism.exe",
        "sfc" | "sfc.exe" => "sfc.exe",
        "nvidia-smi" => "nvidia-smi.exe",
        "explorer.exe" => return Ok(windows_directory(false)?.join("explorer.exe")),
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Unsupported system tool",
            ))
        }
    };
    let path = windows_directory(true)?.join(relative);
    if name == "nvidia-smi" && !path.is_file() {
        // Older NVIDIA installers use the machine-wide Program Files tree.
        // Read its protected registry value rather than the process environment.
        use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
        let key = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion")?;
        let base: String = key.get_value("ProgramFilesDir")?;
        let base = PathBuf::from(base);
        if !base.is_absolute() {
            return Err(io::Error::other("Invalid Program Files directory"));
        }
        return Ok(base.join(r"NVIDIA Corporation\NVSMI\nvidia-smi.exe"));
    }
    Ok(path)
}

pub fn run<T>(name: &str, action: impl FnOnce(&mut Command) -> io::Result<T>) -> io::Result<T> {
    let path = tool_path(name)?;
    use std::os::windows::process::CommandExt;
    let mut command = Command::new(path);
    command.creation_flags(0x08000000);
    let system = windows_directory(true)?;
    let windows = windows_directory(false)?;
    let powershell = system.join(r"WindowsPowerShell\v1.0");
    let search_path = std::env::join_paths([
        system.clone(),
        windows.clone(),
        system.join("wbem"),
        powershell.clone(),
    ])
    .map_err(io::Error::other)?;
    command
        .env("PATH", search_path)
        .env("SystemRoot", &windows)
        .env("WINDIR", &windows);
    if name == "powershell" {
        command.env("PSModulePath", powershell.join("Modules"));
    }
    // Avoid loading DLLs or resolving nested tools from a user-controlled cwd.
    command.current_dir(windows_directory(true)?);
    if name == "cmd" {
        command.arg("/D");
    } // Disable Command Processor AutoRun.
    action(&mut command)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_arbitrary_programs_and_paths() {
        for name in [
            "..\\cmd.exe",
            "C:\\temp\\cmd.exe",
            "evil",
            "cmd.exe",
            "powershell -Command evil",
        ] {
            assert!(tool_path(name).is_err());
        }
    }
    #[test]
    fn uses_absolute_windows_paths() {
        for name in ["cmd", "powershell", "sc", "sfc", "dism", "explorer.exe"] {
            let path = tool_path(name).unwrap();
            assert!(path.is_absolute());
            assert!(path.is_file(), "missing {}", path.display());
        }
    }
    #[test]
    fn poisoned_child_path_does_not_replace_windows_command() {
        let temp = std::env::temp_dir().join(format!("pct-tool-decoy-{}", std::process::id()));
        std::fs::create_dir_all(&temp).unwrap();
        std::fs::write(temp.join("cmd.exe"), b"not a Windows executable").unwrap();
        let result = run("cmd", |command| {
            assert!(std::path::Path::new(command.get_program()).is_absolute());
            command
                .env("PATH", &temp)
                .args(["/C", "echo", "trusted-tool"])
                .output()
        });
        std::fs::remove_file(temp.join("cmd.exe")).unwrap();
        std::fs::remove_dir(temp).unwrap();
        let output = result.unwrap();
        assert!(output.status.success());
        assert_eq!(
            String::from_utf8_lossy(&output.stdout).trim(),
            "trusted-tool"
        );
    }
}
