//! Refresh-only display profiles. Dynamic changes never rewrite the desktop's
//! saved configuration. A separate instance restores after preview timeout or
//! parent death, even when the WebView/main process is no longer responsive.
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Serialize, Deserialize)]
pub struct Rule {
    path: String,
    name: String,
    display_id: String,
    hz: u32,
}
#[derive(Clone, Serialize)]
pub struct Display {
    id: String,
    name: String,
    current_hz: u32,
    frequencies: Vec<u32>,
    supported: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct Mode {
    width: u32,
    height: u32,
    bits: u32,
    hz: u32,
    x: i32,
    y: i32,
    orientation: u32,
    flags: u32,
}
#[derive(Clone, Serialize, Deserialize)]
struct Active {
    token: String,
    owner: u32,
    owner_start: u64,
    display_id: String,
    before: Mode,
    target: Mode,
    deadline: Option<u64>,
    ready: bool,
    applied: bool,
    game: Option<String>,
}
#[derive(Default, Serialize, Deserialize)]
struct Store {
    enabled: bool,
    rules: Vec<Rule>,
    active: Option<Active>,
    error: Option<String>,
    #[serde(default)]
    suppressed: Vec<String>,
}
#[derive(Serialize)]
pub struct State {
    displays: Vec<Display>,
    rules: Vec<Rule>,
    enabled: bool,
    active: Option<String>,
    pending_confirmation: bool,
    deadline_ms: Option<u64>,
    error: Option<String>,
}
fn millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn lock(dir: &Path) -> Result<File, String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let f = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(dir.join("monitor_profiles.lock"))
        .map_err(|e| e.to_string())?;
    f.lock().map_err(|e| e.to_string())?;
    Ok(f)
}
fn load(dir: &Path) -> Result<Store, String> {
    let path = dir.join("monitor_profiles.json");
    match fs::read(path) {
        Ok(bytes) if bytes.len() <= 1_000_000 => serde_json::from_slice(&bytes)
            .map_err(|e| format!("Monitor recovery data is damaged: {e}")),
        Ok(_) => Err("Monitor recovery data is too large".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Store::default()),
        Err(e) => Err(e.to_string()),
    }
}
fn save(dir: &Path, s: &Store) -> Result<(), String> {
    let path = dir.join("monitor_profiles.json");
    let tmp = dir.join(format!("monitor_profiles.{}.tmp", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut f = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&tmp)?;
        f.write_all(&serde_json::to_vec(s).map_err(std::io::Error::other)?)?;
        f.sync_all()?;
        drop(f);
        crate::rollback::replace_file(&tmp, &path)
    })();
    result.map_err(|e| e.to_string())
}
fn path_key(path: &str) -> Result<String, String> {
    if path.len() > 32768
        || !Path::new(path).is_absolute()
        || !path.to_ascii_lowercase().ends_with(".exe")
    {
        return Err("Choose an existing executable".into());
    }
    let p = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !p.is_file() {
        return Err("Choose an executable file".into());
    }
    let text = p.to_string_lossy().to_lowercase();
    let text = text.strip_prefix(r"\\?\").unwrap_or(&text);
    if text.as_bytes().get(1) != Some(&b':') {
        return Err("Choose a local executable".into());
    }
    Ok(text.to_string())
}
fn snapshot(dir: &Path) -> Result<State, String> {
    let _lock = lock(dir)?;
    let s = load(dir)?;
    Ok(State {
        displays: native::displays()?,
        rules: s.rules,
        enabled: s.enabled,
        active: s.active.as_ref().map(|a| a.display_id.clone()),
        pending_confirmation: s.active.as_ref().is_some_and(|a| a.deadline.is_some()),
        deadline_ms: s.active.as_ref().and_then(|a| a.deadline),
        error: s.error,
    })
}
#[tauri::command(async)]
pub fn monitor_profiles_state(app: tauri::AppHandle) -> Result<State, String> {
    snapshot(&crate::store_for_dir(&app)?)
}
#[tauri::command(async)]
pub fn monitor_save_rule(
    app: tauri::AppHandle,
    path: String,
    display_id: String,
    hz: u32,
) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    crate::require_pro(&dir)?;
    let path = path_key(&path)?;
    native::target(&display_id, hz)?;
    let _lock = lock(&dir)?;
    let mut s = load(&dir)?;
    if native::current(&display_id)?.hz != hz {
        return Err("Preview and confirm this frequency before saving a game profile".into());
    }
    if let Some(active) = &s.active {
        if active.deadline.is_some()
            || active.game.is_some()
            || active.display_id != display_id
            || active.target.hz != hz
        {
            return Err("Confirm this display preview before saving a game profile".into());
        }
        restore(&dir, &mut s)?;
    }
    let name = Path::new(&path)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    s.rules.retain(|r| r.path != path);
    s.rules.push(Rule {
        path,
        name,
        display_id,
        hz,
    });
    s.error = None;
    save(&dir, &s)
}
#[tauri::command(async)]
pub fn monitor_remove_rule(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    let _lock = lock(&dir)?;
    let mut s = load(&dir)?;
    if s.active
        .as_ref()
        .is_some_and(|a| a.game.as_ref() == Some(&path))
    {
        restore(&dir, &mut s)?;
    }
    s.rules.retain(|r| r.path != path);
    save(&dir, &s)
}
#[tauri::command(async)]
pub fn monitor_set_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    if enabled {
        crate::require_pro(&dir)?;
    }
    let _lock = lock(&dir)?;
    let mut s = load(&dir)?;
    if !enabled {
        restore(&dir, &mut s)?;
    }
    s.enabled = enabled;
    save(&dir, &s)
}
fn restore(dir: &Path, s: &mut Store) -> Result<(), String> {
    if let Some(a) = s.active.as_ref() {
        // A user/game/topology change takes ownership away from us.
        if let Ok(current) = native::current(&a.display_id) {
            if current == a.target && current != a.before {
                native::set(&a.display_id, &a.before)?;
            }
        } else {
            return Err("Monitor unavailable; reconnect it and restore the pending change".into());
        }
    }
    s.active = None;
    save(dir, s)
}
#[tauri::command(async)]
pub fn monitor_restore(app: tauri::AppHandle) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    let _lock = lock(&dir)?;
    let mut s = load(&dir)?;
    suppress_active_game(&mut s);
    restore(&dir, &mut s)
}
fn suppress_active_game(s: &mut Store) {
    if let Some(path) = s.active.as_ref().and_then(|a| a.game.clone()) {
        if !s.suppressed.contains(&path) {
            s.suppressed.push(path);
        }
    }
}
#[tauri::command(async)]
pub fn monitor_confirm(app: tauri::AppHandle) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    crate::require_pro(&dir)?;
    let _lock = lock(&dir)?;
    let mut s = load(&dir)?;
    let a = s.active.as_mut().ok_or("No preview is active")?;
    if a.deadline.is_none_or(|d| d <= millis()) || !a.applied {
        return Err("The preview has expired".into());
    }
    if native::current(&a.display_id)? != a.target {
        return Err("The display mode changed outside this preview".into());
    }
    a.deadline = None;
    save(&dir, &s)
}
#[tauri::command(async)]
pub fn monitor_preview(app: tauri::AppHandle, display_id: String, hz: u32) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    crate::require_pro(&dir)?;
    begin(&dir, &display_id, hz, None)
}
fn begin(dir: &Path, id: &str, hz: u32, game: Option<String>) -> Result<(), String> {
    let token = format!("{}-{}", std::process::id(), millis());
    {
        let _lock = lock(dir)?;
        let mut s = load(dir)?;
        if s.active.is_some() {
            return Err("Restore the previous display change first".into());
        }
        let before = native::current(id)?;
        let target = native::target(id, hz)?;
        if before == target {
            return Ok(());
        }
        s.active = Some(Active {
            token: token.clone(),
            owner: std::process::id(),
            owner_start: native::process_start(std::process::id())
                .ok_or("Could not identify preview owner")?,
            display_id: id.into(),
            before,
            target,
            deadline: Some(millis() + 15_000),
            ready: false,
            applied: false,
            game,
        });
        s.error = None;
        save(dir, &s)?;
    }
    let launched = native::spawn_guard(&token);
    if launched.is_err() {
        let _lock = lock(dir)?;
        let mut s = load(dir)?;
        restore(dir, &mut s)?;
        return launched;
    }
    for _ in 0..60 {
        std::thread::sleep(Duration::from_millis(50));
        let _lock = lock(dir)?;
        let mut s = load(dir)?;
        let a = s
            .active
            .as_mut()
            .filter(|a| a.token == token)
            .ok_or("Preview cancelled")?;
        if !a.ready {
            continue;
        }
        if native::current(id)? != a.before {
            restore(dir, &mut s)?;
            return Err("Display configuration changed; scan again".into());
        }
        if let Err(e) = native::set(id, &a.target) {
            let _ = restore(dir, &mut s);
            return Err(e);
        }
        a.applied = true;
        if a.game.is_some() {
            a.deadline = None;
        }
        save(dir, &s)?;
        return Ok(());
    }
    let _lock = lock(dir)?;
    let mut s = load(dir)?;
    restore(dir, &mut s)?;
    Err("Display recovery helper did not start; no change applied".into())
}
/// Called by the existing process watcher, before its Turbo-specific logic.
pub fn tick(dir: &Path, paths: &[String]) {
    let result = (|| -> Result<(), String> {
        let next;
        {
            let _lock = lock(dir)?;
            let mut s = load(dir)?;
            let old_suppressed = s.suppressed.len();
            s.suppressed.retain(|p| paths.contains(p));
            if old_suppressed != s.suppressed.len() {
                save(dir, &s)?;
            }
            if let Some(a) = s.active.as_ref() {
                if a.applied
                    && native::current(&a.display_id).is_ok_and(|current| current != a.target)
                {
                    suppress_active_game(&mut s);
                    restore(dir, &mut s)?;
                } else if a.game.as_ref().is_some_and(|p| !paths.contains(p))
                    || (a.game.is_some() && (!s.enabled || crate::require_pro(dir).is_err()))
                {
                    restore(dir, &mut s)?;
                } else {
                    return Ok(());
                }
            }
            next = if s.enabled && crate::require_pro(dir).is_ok() {
                s.rules
                    .iter()
                    .find(|r| paths.contains(&r.path) && !s.suppressed.contains(&r.path))
                    .cloned()
            } else {
                None
            };
        }
        if let Some(r) = next {
            begin(dir, &r.display_id, r.hz, Some(r.path))?;
        }
        Ok(())
    })();
    if let Err(e) = result {
        if let Ok(_lock) = lock(dir) {
            if let Ok(mut s) = load(dir) {
                s.error = Some(e);
                let _ = save(dir, &s);
            }
        }
    }
}
pub fn watchdog(token: &str) {
    if token.len() > 80 || !token.bytes().all(|b| b.is_ascii_digit() || b == b'-') {
        return;
    }
    let dir = crate::dirs_app_data_dir();
    loop {
        let result = (|| -> Result<bool, String> {
            let _lock = lock(&dir)?;
            let mut s = load(&dir)?;
            let Some(a) = s.active.as_mut().filter(|a| a.token == token) else {
                return Ok(false);
            };
            if !a.ready {
                a.ready = true;
                save(&dir, &s)?;
                return Ok(true);
            }
            if expired(a, millis(), native::process_start(a.owner)) {
                if let Err(e) = restore(&dir, &mut s) {
                    s.error = Some(e);
                    save(&dir, &s)?;
                }
                return Ok(s.active.is_some());
            }
            Ok(true)
        })();
        if !matches!(result, Ok(true)) {
            break;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}
fn expired(a: &Active, now: u64, owner_start: Option<u64>) -> bool {
    owner_start != Some(a.owner_start) || a.deadline.is_some_and(|d| now >= d)
}

#[cfg(windows)]
mod native {
    use super::*;
    use windows_sys::Win32::{
        Foundation::{CloseHandle, FILETIME},
        Graphics::Gdi::*,
        System::Threading::{GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
        UI::WindowsAndMessaging::{
            GetSystemMetrics, EDD_GET_DEVICE_INTERFACE_NAME, SM_REMOTESESSION,
        },
    };
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }
    fn text(s: &[u16]) -> String {
        String::from_utf16_lossy(&s[..s.iter().position(|c| *c == 0).unwrap_or(s.len())])
    }
    fn devmode() -> DEVMODEW {
        unsafe {
            let mut d: DEVMODEW = std::mem::zeroed();
            d.dmSize = std::mem::size_of::<DEVMODEW>() as u16;
            d
        }
    }
    fn mode(d: &DEVMODEW) -> Mode {
        unsafe {
            Mode {
                width: d.dmPelsWidth,
                height: d.dmPelsHeight,
                bits: d.dmBitsPerPel,
                hz: d.dmDisplayFrequency,
                x: d.Anonymous1.Anonymous2.dmPosition.x,
                y: d.Anonymous1.Anonymous2.dmPosition.y,
                orientation: d.Anonymous1.Anonymous2.dmDisplayOrientation,
                flags: d.Anonymous2.dmDisplayFlags,
            }
        }
    }
    fn adapters() -> Result<Vec<(String, String, String)>, String> {
        if unsafe { GetSystemMetrics(SM_REMOTESESSION) } != 0 {
            return Err("Refresh profiles are unavailable over Remote Desktop".into());
        }
        let mut out = vec![];
        for i in 0..64 {
            unsafe {
                let mut a: DISPLAY_DEVICEW = std::mem::zeroed();
                a.cb = std::mem::size_of::<DISPLAY_DEVICEW>() as u32;
                if EnumDisplayDevicesW(std::ptr::null(), i, &mut a, 0) == 0 {
                    break;
                }
                if a.StateFlags & DISPLAY_DEVICE_ATTACHED_TO_DESKTOP == 0
                    || a.StateFlags & DISPLAY_DEVICE_MIRRORING_DRIVER != 0
                {
                    continue;
                }
                let mut monitors = vec![];
                for j in 0..16 {
                    let mut m: DISPLAY_DEVICEW = std::mem::zeroed();
                    m.cb = a.cb;
                    if EnumDisplayDevicesW(
                        a.DeviceName.as_ptr(),
                        j,
                        &mut m,
                        EDD_GET_DEVICE_INTERFACE_NAME,
                    ) == 0
                    {
                        break;
                    }
                    if m.StateFlags & DISPLAY_DEVICE_ACTIVE != 0 {
                        monitors.push(m)
                    }
                }
                // Clone topologies cannot be changed as one independent monitor.
                if monitors.len() != 1 {
                    continue;
                }
                let m = &monitors[0];
                let id = text(&m.DeviceID);
                if id.is_empty() {
                    continue;
                }
                out.push((id, text(&a.DeviceName), text(&m.DeviceString)));
            }
        }
        Ok(out)
    }
    fn device(id: &str) -> Result<String, String> {
        adapters()?
            .into_iter()
            .find(|(key, _, _)| key == id)
            .map(|(_, d, _)| d)
            .ok_or("Monitor is unavailable or mirrored".into())
    }
    fn raw_current(device: &str) -> Result<DEVMODEW, String> {
        let mut d = devmode();
        if unsafe { EnumDisplaySettingsW(wide(device).as_ptr(), ENUM_CURRENT_SETTINGS, &mut d) }
            == 0
        {
            Err("Could not read display mode".into())
        } else {
            Ok(d)
        }
    }
    pub fn current(id: &str) -> Result<Mode, String> {
        Ok(mode(&raw_current(&device(id)?)?))
    }
    fn same_except_hz(a: &Mode, b: &Mode) -> bool {
        let mut c = a.clone();
        c.hz = b.hz;
        c == *b
    }
    fn choices(device: &str, current: &Mode) -> Vec<u32> {
        let mut frequencies = vec![];
        for i in 0..4096 {
            let mut d = devmode();
            if unsafe { EnumDisplaySettingsW(wide(device).as_ptr(), i, &mut d) } == 0 {
                break;
            }
            let mut candidate = mode(&d);
            candidate.x = current.x;
            candidate.y = current.y;
            if same_except_hz(&candidate, current) && candidate.hz > 1 {
                frequencies.push(candidate.hz)
            }
        }
        frequencies.sort_unstable();
        frequencies.dedup();
        frequencies
    }
    pub fn displays() -> Result<Vec<Display>, String> {
        adapters()?
            .into_iter()
            .map(|(id, device, name)| {
                let current = mode(&raw_current(&device)?);
                let frequencies = choices(&device, &current);
                Ok(Display {
                    id,
                    name,
                    current_hz: current.hz,
                    supported: frequencies.len() > 1,
                    frequencies,
                })
            })
            .collect()
    }
    pub fn target(id: &str, hz: u32) -> Result<Mode, String> {
        let d = device(id)?;
        let mut m = mode(&raw_current(&d)?);
        if hz < 2 || !choices(&d, &m).contains(&hz) {
            return Err("Choose a supported frequency at the current resolution".into());
        }
        m.hz = hz;
        Ok(m)
    }
    pub fn set(id: &str, wanted: &Mode) -> Result<(), String> {
        let device = device(id)?;
        let mut d = raw_current(&device)?;
        if !same_except_hz(&mode(&d), wanted) || !choices(&device, &mode(&d)).contains(&wanted.hz) {
            return Err(
                "Display topology or supported modes changed; no restore was forced".into(),
            );
        }
        d.dmDisplayFrequency = wanted.hz;
        d.dmFields = DM_DISPLAYFREQUENCY;
        let name = wide(&device);
        if unsafe {
            ChangeDisplaySettingsExW(
                name.as_ptr(),
                &d,
                std::ptr::null_mut(),
                CDS_TEST,
                std::ptr::null(),
            )
        } != DISP_CHANGE_SUCCESSFUL
        {
            return Err("Windows rejected this display mode".into());
        }
        let result = unsafe {
            ChangeDisplaySettingsExW(name.as_ptr(), &d, std::ptr::null_mut(), 0, std::ptr::null())
        };
        if result != DISP_CHANGE_SUCCESSFUL {
            return Err(format!("Display change failed ({result})"));
        }
        if &mode(&raw_current(&device)?) != wanted {
            return Err("Display mode verification failed; recovery retained".into());
        }
        Ok(())
    }
    pub fn process_start(pid: u32) -> Option<u64> {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return None;
            }
            let mut c: FILETIME = std::mem::zeroed();
            let mut e = c;
            let mut k = c;
            let mut u = c;
            let ok = GetProcessTimes(h, &mut c, &mut e, &mut k, &mut u) != 0;
            CloseHandle(h);
            ok.then_some(((c.dwHighDateTime as u64) << 32) | c.dwLowDateTime as u64)
        }
    }
    pub fn spawn_guard(token: &str) -> Result<(), String> {
        use std::os::windows::process::CommandExt;
        std::process::Command::new(std::env::current_exe().map_err(|e| e.to_string())?)
            .args(["--monitor-watchdog", token])
            .creation_flags(0x08000000)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "read-only interactive desktop diagnostic"]
    fn native_inventory_and_session_read_only() {
        let displays = native::displays().expect("native display enumeration");
        println!(
            "session_allowed={} displays={}",
            crate::elevation::current_user_session_allowed(),
            serde_json::to_string(&displays).unwrap()
        );
        for display in displays {
            let current = native::current(&display.id).unwrap();
            assert_eq!(current.hz, display.current_hz);
            for hz in display.frequencies {
                let target = native::target(&display.id, hz).unwrap();
                assert_eq!(
                    (current.width, current.height, current.x, current.y),
                    (target.width, target.height, target.x, target.y)
                );
            }
        }
    }
    fn active() -> Active {
        let m = Mode {
            width: 1920,
            height: 1080,
            bits: 32,
            hz: 60,
            x: 0,
            y: 0,
            orientation: 0,
            flags: 0,
        };
        Active {
            token: "1-2".into(),
            owner: 1,
            owner_start: 10,
            display_id: "screen".into(),
            before: m.clone(),
            target: m,
            deadline: Some(100),
            ready: true,
            applied: true,
            game: None,
        }
    }
    #[test]
    fn recovery_triggers_on_timeout_death_and_pid_reuse() {
        let a = active();
        assert!(!expired(&a, 99, Some(10)));
        assert!(expired(&a, 100, Some(10)));
        assert!(expired(&a, 50, None));
        assert!(expired(&a, 50, Some(11)));
    }
    #[test]
    fn confirmed_change_still_recovers_when_owner_dies() {
        let mut a = active();
        a.deadline = None;
        assert!(!expired(&a, 1000, Some(10)));
        assert!(expired(&a, 1000, None));
    }
    #[test]
    fn manual_restore_suppresses_only_the_active_game() {
        let mut s = Store::default();
        let mut a = active();
        a.game = Some("c:\\game.exe".into());
        s.active = Some(a);
        suppress_active_game(&mut s);
        suppress_active_game(&mut s);
        assert_eq!(s.suppressed, vec!["c:\\game.exe"]);
        s.active = None;
        suppress_active_game(&mut s);
        assert_eq!(s.suppressed.len(), 1);
    }
    #[test]
    fn corrupt_config_is_not_replaced_by_defaults() {
        let dir = std::env::temp_dir().join(format!("pct-monitor-test-{}", millis()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("monitor_profiles.json"), b"bad").unwrap();
        assert!(load(&dir).is_err());
    }
}
