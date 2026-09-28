//! Read icons from registered local applications; never execute their code.
use base64::{engine::general_purpose::STANDARD, Engine};

fn local_path(raw: &str) -> Option<std::path::PathBuf> {
    let p = std::path::PathBuf::from(raw);
    let b = raw.as_bytes();
    // No UNC/network shares, device paths, relative names or alternate streams.
    if b.len() < 4
        || !b[0].is_ascii_alphabetic()
        || b[1] != b':'
        || !matches!(b[2], b'\\' | b'/')
        || raw[2..].contains(':')
        || raw.contains('\0')
    {
        return None;
    }
    p.is_file().then_some(p)
}

#[cfg(windows)]
pub(crate) fn extract(raw: &str) -> Option<String> {
    use windows_sys::Win32::{
        Graphics::Gdi::*,
        UI::{Shell::ExtractIconExW, WindowsAndMessaging::*},
    };
    let (path, index) = match raw.rsplit_once(',') {
        Some((p, i)) if i.trim().parse::<i32>().is_ok() => (p, i.trim().parse().ok()?),
        _ => (raw, 0),
    };
    let path = local_path(path.trim().trim_matches('"'))?;
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    if !matches!(extension.as_str(), "exe" | "dll" | "ico") {
        return None;
    }
    let wide: Vec<u16> = path
        .to_string_lossy()
        .encode_utf16()
        .chain(Some(0))
        .collect();
    unsafe {
        let mut icon = std::ptr::null_mut();
        if ExtractIconExW(wide.as_ptr(), index, &mut icon, std::ptr::null_mut(), 1) == 0
            || icon.is_null()
        {
            return None;
        }
        let mut info: ICONINFO = std::mem::zeroed();
        if GetIconInfo(icon, &mut info) == 0 {
            DestroyIcon(icon);
            return None;
        }
        let mut bitmap: BITMAP = std::mem::zeroed();
        let valid = !info.hbmColor.is_null()
            && GetObjectW(
                info.hbmColor,
                std::mem::size_of::<BITMAP>() as i32,
                &mut bitmap as *mut _ as _,
            ) != 0;
        let result = (|| {
            if !valid
                || bitmap.bmWidth <= 0
                || bitmap.bmHeight <= 0
                || bitmap.bmWidth > 256
                || bitmap.bmHeight > 256
            {
                return None;
            }
            let (w, h) = (bitmap.bmWidth as u32, bitmap.bmHeight as u32);
            let mut bi: BITMAPINFO = std::mem::zeroed();
            bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bi.bmiHeader.biWidth = w as i32;
            bi.bmiHeader.biHeight = -(h as i32);
            bi.bmiHeader.biPlanes = 1;
            bi.bmiHeader.biBitCount = 32;
            bi.bmiHeader.biCompression = BI_RGB;
            let dc = CreateCompatibleDC(std::ptr::null_mut());
            if dc.is_null() {
                return None;
            }
            let mut pixels = vec![0u8; (w * h * 4) as usize];
            let rows = GetDIBits(
                dc,
                info.hbmColor,
                0,
                h,
                pixels.as_mut_ptr() as _,
                &mut bi,
                DIB_RGB_COLORS,
            );
            DeleteDC(dc);
            if rows != h as i32 {
                return None;
            }
            let alpha = pixels.as_chunks::<4>().0.iter().any(|p| p[3] != 0);
            for p in pixels.as_chunks_mut::<4>().0 {
                p.swap(0, 2);
                if !alpha {
                    p[3] = 255;
                }
            }
            let mut bytes = Vec::new();
            {
                let mut encoder = png::Encoder::new(&mut bytes, w, h);
                encoder.set_color(png::ColorType::Rgba);
                encoder.set_depth(png::BitDepth::Eight);
                encoder
                    .write_header()
                    .ok()?
                    .write_image_data(&pixels)
                    .ok()?;
            }
            Some(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
        })();
        if !info.hbmColor.is_null() {
            DeleteObject(info.hbmColor);
        }
        if !info.hbmMask.is_null() {
            DeleteObject(info.hbmMask);
        }
        DestroyIcon(icon);
        result
    }
}

#[cfg(not(windows))]
pub(crate) fn extract(_: &str) -> Option<String> {
    None
}

pub(crate) fn from_command(command: &str) -> Option<String> {
    let path = crate::startup::extract_exe_path(command).or_else(|| {
        // Scheduler actions may name a Windows executable without its directory.
        // Only use System32, never search the working directory or an arbitrary PATH.
        let name = command.trim().trim_matches('"');
        if !name.to_ascii_lowercase().ends_with(".exe")
            || name.contains(['/', '\\', ':', '\0', '"'])
        {
            return None;
        }
        let system = std::path::PathBuf::from(std::env::var_os("WINDIR")?)
            .join("System32")
            .join(name);
        local_path(system.to_str()?)
    })?;
    // Squirrel registers Update.exe, but --processStart names the actual app.
    if path
        .file_name()?
        .to_str()?
        .eq_ignore_ascii_case("update.exe")
    {
        if let Some(name) = process_start_name(command) {
            let mut versions: Vec<_> = std::fs::read_dir(path.parent()?)
                .ok()?
                .filter_map(Result::ok)
                .filter_map(|entry| {
                    let name = entry.file_name();
                    let version = name
                        .to_str()?
                        .strip_prefix("app-")?
                        .split('.')
                        .map(str::parse::<u32>)
                        .collect::<Result<Vec<_>, _>>()
                        .ok()?;
                    Some((version, entry.path()))
                })
                .collect();
            versions.sort_by(|a, b| b.0.cmp(&a.0));
            for (_, directory) in versions {
                if let Some(icon) = directory.join(name).to_str().and_then(extract) {
                    return Some(icon);
                }
            }
        }
    }
    extract(path.to_str()?)
}

fn process_start_name(command: &str) -> Option<&str> {
    let (_, tail) = command.split_once(" --processStart ")?;
    let tail = tail.trim_start();
    let name = if let Some(quoted) = tail.strip_prefix('"') {
        quoted.split_once('"')?.0
    } else {
        tail.split_whitespace().next()?
    };
    (name.to_ascii_lowercase().ends_with(".exe")
        && !name.contains(['/', '\\', ':', '\0'])
        && name.len() > 4)
        .then_some(name)
}

#[cfg(windows)]
pub(crate) fn from_shortcut(raw: &str) -> Option<String> {
    use windows::{
        core::{Interface, HSTRING},
        Win32::{System::Com::*, UI::Shell::*},
    };
    let path = local_path(raw)?;
    if !path.extension()?.eq_ignore_ascii_case("lnk") {
        return None;
    }
    // Read metadata only: never Resolve(), launch the target or contact a share.
    unsafe {
        let initialized = CoInitializeEx(None, COINIT_MULTITHREADED).is_ok();
        let result = (|| {
            let link: IShellLinkW =
                CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let file: IPersistFile = link.cast().ok()?;
            file.Load(&HSTRING::from(raw), STGM_READ).ok()?;
            let mut buffer = [0u16; 32768];
            let mut index = 0;
            if link.GetIconLocation(&mut buffer, &mut index).is_ok() {
                let icon =
                    String::from_utf16_lossy(&buffer[..buffer.iter().position(|c| *c == 0)?]);
                if !icon.is_empty() {
                    let icon = crate::startup::expand_env_vars(&icon);
                    if let Some(data) = extract(&format!("{icon},{index}")) {
                        return Some(data);
                    }
                }
            }
            buffer.fill(0);
            link.GetPath(&mut buffer, std::ptr::null_mut(), SLGP_RAWPATH.0 as u32)
                .ok()?;
            let target = String::from_utf16_lossy(&buffer[..buffer.iter().position(|c| *c == 0)?]);
            extract(&crate::startup::expand_env_vars(&target))
        })();
        if initialized {
            CoUninitialize();
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn updater_target_is_only_a_filename() {
        assert_eq!(
            process_start_name(r#""C:\Discord\Update.exe" --processStart Discord.exe"#),
            Some("Discord.exe")
        );
        assert_eq!(
            process_start_name(r#""C:\App\Update.exe" --processStart "An App.exe" --arg"#),
            Some("An App.exe")
        );
        for target in [
            r"..\app.exe",
            r"C:\app.exe",
            "https://host/app.exe",
            "app.exe:stream",
            "app.dll",
        ] {
            assert!(process_start_name(&format!("Update.exe --processStart {target}")).is_none());
        }
    }

    #[cfg(windows)]
    #[test]
    #[ignore = "Read-only inspection of this machine's installed startup items"]
    fn inspect_installed_startup_icons() {
        for item in crate::startup::list_startup_items()
            .into_iter()
            .filter(|i| !i.orphaned)
        {
            println!(
                "{}: {}",
                item.name,
                if item.icon_data_url.is_some() {
                    "icon loaded"
                } else {
                    "no local icon"
                }
            );
        }
        for item in crate::scheduledtasks::list_scheduled_tasks() {
            println!(
                "task {}: {}",
                item.name,
                if item.icon_data_url.is_some() {
                    "icon loaded"
                } else {
                    "no local icon"
                }
            );
        }
    }
    #[test]
    fn rejects_nonlocal_sources() {
        for path in [
            r"\\server\share\app.exe",
            r"\\?\C:\app.exe",
            "app.exe",
            "https://example.com/app.exe",
            r"C:\app.exe:stream",
            "C:\\bad\0.exe",
        ] {
            assert!(local_path(path).is_none(), "{path}");
        }
        assert!(from_command("powershell.exe -Command anything").is_none());
    }
    #[cfg(windows)]
    #[test]
    fn reads_local_executable_as_png() {
        let path = std::path::PathBuf::from(std::env::var_os("WINDIR").unwrap())
            .join("System32/notepad.exe");
        let data = extract(path.to_str().unwrap()).expect("Windows notepad icon");
        let bytes = STANDARD
            .decode(data.strip_prefix("data:image/png;base64,").unwrap())
            .unwrap();
        assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
        let decoder = png::Decoder::new(std::io::Cursor::new(bytes));
        let reader = decoder.read_info().unwrap();
        assert!(reader.info().width >= 16 && reader.info().width <= 256);
    }
}
