//! The Audio section (1.20, AUDIO-SPEC.md): what Windows does with the sound,
//! read through the documented Core Audio APIs, and the two per-device fixes
//! that go through the rollback journal:
//!
//! - T3 `audio_idle:<device>`: PortCls's inactivity timer on mains power
//!   (`PowerSettings\PerformanceIdleTime`, 4 bytes, seconds). Offered only
//!   when the driver's INF set it to something other than 0, and only ever
//!   set to 0. The battery timer and the idle power state are never touched.
//! - T4 `audio_power:<device>`: the Device Manager "Allow the computer to turn
//!   off this device to save power" switch of a USB audio device, through WMI
//!   `MSPower_DeviceEnable`, the same channel Device Manager uses.
//!
//! Both are Pro and need administrator rights. An apply re-reads this PC and
//! refuses any device that is not a current candidate, so the elevated helper
//! cannot be pointed at an arbitrary device or registry key.

use crate::rollback::SnapshotEntry;
use serde::Serialize;

pub const IDLE_PREFIX: &str = "audio_idle:";
pub const POWER_PREFIX: &str = "audio_power:";
/// The device setup class of sound, video and game controllers (MEDIA).
pub const AUDIO_CLASS_GUID: &str = "{4d36e96c-e325-11ce-bfc1-08002be10318}";
pub const IDLE_VALUE: &str = "PerformanceIdleTime";
/// The helper flag of the explicit device restart.
pub const RESTART_FLAG: &str = "--elevated-audio-restart";

/* ---------------- what the frontend reads (src/types.ts AudioStatus) ------ */

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Flow {
    Render,
    Capture,
}

/// From `PKEY_AudioEndpoint_FormFactor`.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Speakers,
    Headphones,
    Headset,
    Microphone,
    Hdmi,
    Spdif,
    Line,
    Other,
}

impl Kind {
    fn from_form_factor(value: u32) -> Self {
        match value {
            1 => Kind::Speakers,
            2 => Kind::Line,
            3 => Kind::Headphones,
            4 => Kind::Microphone,
            5 | 6 => Kind::Headset,
            8 => Kind::Spdif,
            9 => Kind::Hdmi,
            _ => Kind::Other,
        }
    }
}

/// How the device is connected, from the endpoint's enumerator.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Bus {
    Bluetooth,
    Usb,
    Internal,
    Other,
}

impl Bus {
    fn from_enumerator(name: &str) -> Self {
        let name = name.to_ascii_uppercase();
        if name.starts_with("BTH") {
            Bus::Bluetooth
        } else if name == "USB" {
            Bus::Usb
        } else if name == "HDAUDIO" || name == "INTELAUDIO" || name == "ACPI" {
            Bus::Internal
        } else {
            Bus::Other
        }
    }
}

/// Equalizer APO on one endpoint (audio_eq.rs).
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum EqState {
    #[default]
    None,
    Active,
    /// Registered, but Windows has effects turned off on the device.
    Bypassed,
}

/// The engine's shared-mode format (`PKEY_AudioEngine_DeviceFormat`).
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Format {
    pub rate: u32,
    /// Valid bits per sample (24 in a 32-bit container reads as 24).
    pub bits: u16,
    pub channels: u16,
    pub float: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Endpoint {
    /// The endpoint id, for the `ms-settings:sound-properties` deep link.
    pub id: String,
    pub name: String,
    pub flow: Flow,
    /// The default device (console role).
    pub default: bool,
    /// The default communications device.
    pub comms: bool,
    pub kind: Kind,
    pub bus: Bus,
    pub format: Option<Format>,
    /// `Disable_SysFx` = 1. `None` when the endpoint store could not be read.
    pub effects_off: Option<bool>,
    /// Spatial sound on (render only). `None` when Windows did not say.
    pub spatial: Option<bool>,
    pub eq: EqState,
}

/// A3: a Bluetooth microphone in use switches the headset to call mode.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CallMode {
    pub device: String,
    pub process: String,
}

/// A9: the default microphone.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Mic {
    pub name: String,
    pub muted: bool,
    /// 0-100, as the Sound settings slider shows it.
    pub level: u8,
}

/// T3 candidate (or an applied one).
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct IdleTimer {
    /// The tweak id: `audio_idle:<device instance id>`.
    pub id: String,
    pub name: String,
    /// Seconds of silence before Windows powers the device down on mains
    /// power, as read now. 0 once applied.
    pub seconds: u32,
    pub applied: bool,
}

/// T4 candidate (or an applied one).
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UsbPower {
    /// The tweak id: `audio_power:<device instance id>`.
    pub id: String,
    pub name: String,
    /// Windows may turn the device off to save power.
    pub may_power_down: bool,
    pub applied: bool,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Eapo {
    pub installed: bool,
    pub version: Option<String>,
    /// Its Device Selector is where it is turned on per device.
    pub selector: bool,
    /// Registrations left behind by endpoints that no longer exist.
    pub stale: u32,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatus {
    pub endpoints: Vec<Endpoint>,
    pub call_mode: Vec<CallMode>,
    pub mic: Option<Mic>,
    pub idle: Vec<IdleTimer>,
    pub usb_power: Vec<UsbPower>,
    /// Any Bluetooth audio device known to Windows, connected or not (T2).
    pub bluetooth: bool,
    /// Modern Standby PC: T4 stays opt-in, with Microsoft's battery warning.
    pub modern_standby: bool,
    /// T1's `UserDuckingPreference`; `None` is the Windows default (80%).
    pub ducking: Option<u32>,
    pub eapo: Eapo,
}

/* ---------------- pure parts, unit tested on every platform -------------- */

/// A `WAVEFORMATEX` or `WAVEFORMATEXTENSIBLE`, as the VT_BLOB holds it.
pub fn parse_format(blob: &[u8]) -> Option<Format> {
    let u16_at = |at: usize| blob.get(at..at + 2).map(|b| u16::from_le_bytes([b[0], b[1]]));
    let u32_at = |at: usize| {
        blob.get(at..at + 4)
            .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    };
    let tag = u16_at(0)?;
    let channels = u16_at(2)?;
    let rate = u32_at(4)?;
    let container = u16_at(14)?;
    let (bits, float) = match tag {
        1 => (container, false),
        3 => (container, true),
        0xFFFE => {
            // cbSize >= 22: valid bits, channel mask, then the sub-format GUID,
            // whose first field is the plain format tag (1 PCM, 3 float).
            if u16_at(16)? < 22 {
                return None;
            }
            let valid = u16_at(18).filter(|v| *v != 0).unwrap_or(container);
            match u32_at(24)? {
                1 => (valid, false),
                3 => (valid, true),
                _ => return None,
            }
        }
        _ => return None,
    };
    ((1..=32).contains(&channels) && (1..=1_536_000).contains(&rate) && bits > 0).then_some(
        Format {
            rate,
            bits,
            channels,
            float,
        },
    )
}

/// A device instance id as Windows writes them: at most 200 printable ASCII
/// characters with a backslash between enumerator and instance. Commas never
/// occur, which keeps comma-joined helper batches unambiguous; quotes are
/// refused so an id can be put in a WQL literal.
pub fn valid_instance_id(id: &str) -> bool {
    (3..=200).contains(&id.len())
        && id.contains('\\')
        && id.bytes().all(|b| b.is_ascii_graphic() && !matches!(b, b',' | b'\'' | b'"'))
}

/// `SYSTEM\CurrentControlSet\Control\Class\{audio class}\NNNN\PowerSettings`:
/// the driver key of an audio device, and nothing else.
pub fn idle_key_path(driver_key: &str) -> Option<String> {
    let (class, index) = driver_key.split_once('\\')?;
    (class.eq_ignore_ascii_case(AUDIO_CLASS_GUID)
        && index.len() == 4
        && index.bytes().all(|b| b.is_ascii_digit()))
    .then(|| format!(r"SYSTEM\CurrentControlSet\Control\Class\{AUDIO_CLASS_GUID}\{index}\PowerSettings"))
}

pub fn valid_idle_snapshot(device: &str, entry: &SnapshotEntry) -> bool {
    valid_instance_id(device)
        && matches!(entry, SnapshotEntry::RegistryBinary { hive, path, name, original }
            if hive == "HKLM"
                && name == IDLE_VALUE
                && original.as_ref().is_none_or(|bytes| bytes.len() == 4)
                && path.strip_prefix(r"SYSTEM\CurrentControlSet\Control\Class\")
                    .and_then(|rest| rest.strip_suffix(r"\PowerSettings"))
                    .and_then(idle_key_path)
                    .is_some_and(|canonical| canonical == *path))
}

pub fn valid_power_snapshot(device: &str, entry: &SnapshotEntry) -> bool {
    valid_instance_id(device)
        && matches!(entry, SnapshotEntry::DevicePowerEnable { instance_name, .. }
            if instance_name.eq_ignore_ascii_case(&format!("{device}_0")))
}

/// Seconds from the 4 little-endian bytes PortCls reads.
pub fn idle_seconds(bytes: &[u8]) -> Option<u32> {
    <[u8; 4]>::try_from(bytes).ok().map(u32::from_le_bytes)
}

/// The endpoint's devnode from `{b3f8fa53-0004-438e-9003-51a46e139bfc},2`,
/// which reads `{1}.HDAUDIO\FUNC_01&...`.
fn devnode_of(value: &str) -> Option<String> {
    let id = match value.strip_prefix('{') {
        Some(rest) => rest.split_once("}.")?.1,
        None => value,
    };
    valid_instance_id(id).then(|| id.to_string())
}

/// The registry GUID of an endpoint id, `{0.0.0.00000000}.{guid}`.
fn endpoint_guid(id: &str) -> Option<&str> {
    id.rsplit_once('.')
        .map(|(_, guid)| guid)
        .filter(|g| crate::rollback::valid_guid(g))
}

/// The Settings page to open: Sound, or one device's own page (Learn,
/// "Launch the Windows Settings app"). Only an endpoint id of the shape
/// Windows uses, `{0.0.<0|1>.00000000}.{guid}`, reaches the shell.
pub fn settings_uri(endpoint: Option<&str>) -> Option<String> {
    let Some(id) = endpoint else {
        return Some("ms-settings:sound".into());
    };
    let guid = id
        .strip_prefix("{0.0.0.00000000}.")
        .or_else(|| id.strip_prefix("{0.0.1.00000000}."))?;
    crate::rollback::valid_guid(guid)
        .then(|| format!("ms-settings:sound-properties?endpointId={id}"))
}

/// A USB ancestor whose power switch belongs to the audio device: never a
/// hub, a controller or anything off the USB bus.
fn usb_function(instance: &str) -> bool {
    let upper = instance.to_ascii_uppercase();
    upper.starts_with(r"USB\VID_") || upper.starts_with(r"USB\VID&")
}

#[cfg(windows)]
pub use win::*;

#[cfg(windows)]
mod win {
    use super::*;
    use crate::rollback::{RollbackStore, SnapshotEntry};
    use std::collections::{HashMap, HashSet};
    use windows::core::{Interface, BSTR, GUID, PROPVARIANT, PWSTR, VARIANT};
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eCapture, eCommunications, eConsole, eRender, EDataFlow, IAudioSessionControl2,
        IAudioSessionManager2, IMMDevice, IMMDeviceEnumerator, IMMEndpoint, ISpatialAudioClient,
        MMDeviceEnumerator, AudioSessionStateActive, DEVICE_STATE, DEVICE_STATE_ACTIVE, DEVICE_STATEMASK_ALL,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL, STGM_READ};
    use windows::Win32::UI::Shell::PropertiesSystem::{IPropertyStore, PROPERTYKEY};
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_QUERY_VALUE, KEY_SET_VALUE};
    use winreg::RegKey;

    const fn key(fmtid: u128, pid: u32) -> PROPERTYKEY {
        PROPERTYKEY {
            fmtid: GUID::from_u128(fmtid),
            pid,
        }
    }
    const FRIENDLY_NAME: PROPERTYKEY = key(0xa45c254e_df1c_4efd_8020_67d146a850e0, 14);
    const ENUMERATOR: PROPERTYKEY = key(0xa45c254e_df1c_4efd_8020_67d146a850e0, 24);
    const FORM_FACTOR: PROPERTYKEY = key(0x1da5d803_d492_4edd_8c23_e0c0ffee7f0e, 0);
    const DEVICE_FORMAT: PROPERTYKEY = key(0xf19f064d_082c_4e27_bc73_6882a1bb8e4c, 0);
    /// The devnode behind the endpoint, `{1}.<device instance id>`.
    const DEVNODE: PROPERTYKEY = key(0xb3f8fa53_0004_438e_9003_51a46e139bfc, 2);

    const MMDEVICES: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio";
    const DISABLE_SYSFX: &str = "{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5";
    const DUCKING_PATH: &str = r"Software\Microsoft\Multimedia\Audio";
    const VT_BLOB: u16 = 65;

    fn failed(e: windows::core::Error) -> String {
        format!("Windows audio could not be read: {}", e.message())
    }

    fn string(store: &IPropertyStore, key: &PROPERTYKEY) -> Option<String> {
        // SAFETY: `store` is live; `key` outlives the call.
        let value = unsafe { store.GetValue(key) }.ok()?;
        BSTR::try_from(&value)
            .ok()
            .map(|s| s.to_string())
            .filter(|s| !s.is_empty())
    }

    fn number(store: &IPropertyStore, key: &PROPERTYKEY) -> Option<u32> {
        // SAFETY: as above.
        let value = unsafe { store.GetValue(key) }.ok()?;
        u32::try_from(&value).ok()
    }

    fn blob(value: &PROPVARIANT) -> Option<Vec<u8>> {
        let raw = value.as_raw();
        // SAFETY: the union is read as a BLOB only when the tag says it is
        // one; the bytes are copied while `value` is alive.
        unsafe {
            if raw.Anonymous.Anonymous.vt != VT_BLOB {
                return None;
            }
            let blob = raw.Anonymous.Anonymous.Anonymous.blob;
            if blob.pBlobData.is_null() || blob.cbSize == 0 || blob.cbSize > 4096 {
                return None;
            }
            Some(std::slice::from_raw_parts(blob.pBlobData, blob.cbSize as usize).to_vec())
        }
    }

    fn id_of(device: &IMMDevice) -> Option<String> {
        // SAFETY: GetId hands over a CoTaskMem string, freed after copying.
        unsafe {
            let raw: PWSTR = device.GetId().ok()?;
            let id = raw.to_string().ok();
            CoTaskMemFree(Some(raw.0 as *const _));
            id
        }
    }

    fn default_id(enumerator: &IMMDeviceEnumerator, flow: EDataFlow, comms: bool) -> Option<String> {
        let role = if comms { eCommunications } else { eConsole };
        // SAFETY: `enumerator` is live.
        let device = unsafe { enumerator.GetDefaultAudioEndpoint(flow, role) }.ok()?;
        id_of(&device)
    }

    /// One endpoint as the registry and the property store describe it.
    struct Raw {
        id: String,
        name: String,
        flow: Flow,
        active: bool,
        kind: Kind,
        bus: Bus,
        format: Option<Format>,
        devnode: Option<String>,
        device: IMMDevice,
    }

    fn read_raw(device: IMMDevice) -> Option<Raw> {
        let id = id_of(&device)?;
        // SAFETY: `device` is live for every call below.
        let (store, state, flow) = unsafe {
            let store = device.OpenPropertyStore(STGM_READ).ok()?;
            let state = device.GetState().ok()?;
            let flow = device.cast::<IMMEndpoint>().ok()?.GetDataFlow().ok()?;
            (store, state, flow)
        };
        // SAFETY: `store` is live.
        let format = unsafe { store.GetValue(&DEVICE_FORMAT) }
            .ok()
            .as_ref()
            .and_then(blob)
            .and_then(|bytes| parse_format(&bytes));
        Some(Raw {
            name: string(&store, &FRIENDLY_NAME).unwrap_or_else(|| "Audio device".into()),
            flow: if flow == eCapture { Flow::Capture } else { Flow::Render },
            active: state == DEVICE_STATE_ACTIVE,
            kind: Kind::from_form_factor(number(&store, &FORM_FACTOR).unwrap_or(10)),
            bus: string(&store, &ENUMERATOR).map_or(Bus::Other, |e| Bus::from_enumerator(&e)),
            format,
            devnode: string(&store, &DEVNODE).and_then(|v| devnode_of(&v)),
            id,
            device,
        })
    }

    fn hklm() -> RegKey {
        RegKey::predef(HKEY_LOCAL_MACHINE)
    }

    fn endpoint_key(flow: Flow, guid: &str) -> String {
        let folder = if flow == Flow::Capture { "Capture" } else { "Render" };
        format!(r"{MMDEVICES}\{folder}\{guid}")
    }

    /// `Disable_SysFx`, a REG_DWORD in the endpoint's FxProperties.
    fn effects_off(flow: Flow, guid: &str) -> Option<bool> {
        let fx = hklm()
            .open_subkey(format!(r"{}\FxProperties", endpoint_key(flow, guid)))
            .ok();
        let Some(fx) = fx else {
            // No effects store at all: nothing is turned off.
            return Some(false);
        };
        match fx.get_value::<u32, _>(DISABLE_SYSFX) {
            Ok(v) => Some(v == 1),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Some(false),
            Err(_) => None,
        }
    }

    /// Every string the endpoint's FxProperties hold, by value name.
    fn fx_strings(flow: Flow, guid: &str) -> Vec<(String, Vec<String>)> {
        let Ok(fx) = hklm().open_subkey(format!(r"{}\FxProperties", endpoint_key(flow, guid)))
        else {
            return Vec::new();
        };
        fx.enum_values()
            .filter_map(Result::ok)
            .filter_map(|(name, _)| {
                let strings = fx
                    .get_value::<Vec<String>, _>(&name)
                    .or_else(|_| fx.get_value::<String, _>(&name).map(|s| vec![s]))
                    .ok()?;
                Some((name, strings))
            })
            .collect()
    }

    fn spatial_on(device: &IMMDevice) -> Option<bool> {
        // SAFETY: `device` is live; no activation parameters.
        let client: ISpatialAudioClient = unsafe { device.Activate(CLSCTX_ALL, None) }.ok()?;
        // SAFETY: `client` is live.
        unsafe { client.GetMaxDynamicObjectCount() }.ok().map(|n| n > 0)
    }

    fn mic_of(raw: &Raw) -> Option<Mic> {
        // SAFETY: `raw.device` is live; no activation parameters.
        let volume: IAudioEndpointVolume = unsafe { raw.device.Activate(CLSCTX_ALL, None) }.ok()?;
        // SAFETY: `volume` is live.
        let (muted, level) = unsafe {
            (
                volume.GetMute().ok()?.as_bool(),
                volume.GetMasterVolumeLevelScalar().ok()?,
            )
        };
        Some(Mic {
            name: raw.name.clone(),
            muted,
            level: (level.clamp(0.0, 1.0) * 100.0).round() as u8,
        })
    }

    /// The processes with an active session on a capture endpoint.
    fn capture_users(device: &IMMDevice) -> Vec<u32> {
        let mut pids = Vec::new();
        // SAFETY: `device` and every interface obtained from it are live for
        // the calls made on them.
        unsafe {
            let Ok(manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) else {
                return pids;
            };
            let Ok(sessions) = manager.GetSessionEnumerator() else {
                return pids;
            };
            for i in 0..sessions.GetCount().unwrap_or(0) {
                let Ok(session) = sessions.GetSession(i) else { continue };
                if session.GetState().ok() != Some(AudioSessionStateActive) {
                    continue;
                }
                let Ok(session) = session.cast::<IAudioSessionControl2>() else { continue };
                // S_OK means "this is the system sounds session".
                if session.IsSystemSoundsSession().0 == 0 {
                    continue;
                }
                if let Ok(pid) = session.GetProcessId() {
                    if pid != 0 {
                        pids.push(pid);
                    }
                }
            }
        }
        pids
    }

    /// COM for one call on this thread (see netshaper.rs for the rules).
    fn com() -> Result<crate::netshaper::wmi::Com, String> {
        crate::netshaper::wmi::Com::init()
    }

    /// Everything the Audio page and the Scan show. Read-only.
    pub fn status(store: &RollbackStore) -> Result<AudioStatus, String> {
        let _com = com()?;
        // SAFETY: COM is initialised on this thread for the whole function.
        let enumerator: IMMDeviceEnumerator =
            unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }.map_err(failed)?;
        let collection = unsafe { enumerator.EnumAudioEndpoints(windows::Win32::Media::Audio::eAll, DEVICE_STATE(DEVICE_STATEMASK_ALL)) }
            .map_err(failed)?;
        let mut raws = Vec::new();
        // SAFETY: `collection` is live.
        for i in 0..unsafe { collection.GetCount() }.map_err(failed)? {
            if let Some(raw) = unsafe { collection.Item(i) }.ok().and_then(read_raw) {
                raws.push(raw);
            }
        }
        let defaults = [
            default_id(&enumerator, eRender, false),
            default_id(&enumerator, eCapture, false),
        ];
        let comms = [
            default_id(&enumerator, eRender, true),
            default_id(&enumerator, eCapture, true),
        ];
        let child_apos = crate::audio_eq::child_apos();
        let processes: HashMap<u32, String> = crate::process_guard::processes()
            .unwrap_or_default()
            .into_iter()
            .map(|p| (p.pid, p.name))
            .collect();

        let mut status = AudioStatus {
            bluetooth: raws.iter().any(|r| r.bus == Bus::Bluetooth),
            modern_standby: modern_standby(),
            ducking: hkcu_dword(DUCKING_PATH, "UserDuckingPreference"),
            eapo: crate::audio_eq::install(),
            ..AudioStatus::default()
        };
        let known: HashSet<String> = raws
            .iter()
            .filter_map(|r| endpoint_guid(&r.id).map(str::to_ascii_lowercase))
            .collect();
        status.eapo.stale = crate::audio_eq::stale(&child_apos, &known);

        for raw in raws.iter().filter(|r| r.active) {
            let guid = endpoint_guid(&raw.id);
            let effects_off = guid.and_then(|g| effects_off(raw.flow, g));
            let eq = match guid {
                Some(g) if status.eapo.installed => crate::audio_eq::eq_state(
                    &fx_strings(raw.flow, g),
                    child_apos.iter().any(|c| c.eq_ignore_ascii_case(g)),
                    effects_off == Some(true),
                ),
                _ => EqState::None,
            };
            let slot = usize::from(raw.flow == Flow::Capture);
            status.endpoints.push(Endpoint {
                id: raw.id.clone(),
                name: raw.name.clone(),
                flow: raw.flow,
                default: defaults[slot].as_deref() == Some(&raw.id),
                comms: comms[slot].as_deref() == Some(&raw.id),
                kind: raw.kind,
                bus: raw.bus,
                format: raw.format.clone(),
                effects_off,
                spatial: (raw.flow == Flow::Render)
                    .then(|| spatial_on(&raw.device))
                    .flatten(),
                eq,
            });
            if raw.flow == Flow::Capture && raw.bus == Bus::Bluetooth {
                for pid in capture_users(&raw.device) {
                    if let Some(name) = processes.get(&pid) {
                        status.call_mode.push(CallMode {
                            device: raw.name.clone(),
                            process: name.clone(),
                        });
                    }
                }
            }
            if raw.flow == Flow::Capture && defaults[1].as_deref() == Some(&raw.id) {
                status.mic = mic_of(raw);
            }
        }
        status.call_mode.dedup_by(|a, b| a.device == b.device && a.process == b.process);

        let applied = store.applied_ids()?;
        status.idle = idle_timers(&raws, &applied);
        status.usb_power = usb_power(&raws, &applied);
        Ok(status)
    }

    fn hkcu_dword(path: &str, name: &str) -> Option<u32> {
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(path)
            .ok()?
            .get_value::<u32, _>(name)
            .ok()
    }

    pub fn modern_standby() -> bool {
        use windows_sys::Win32::System::Power::{GetPwrCapabilities, SYSTEM_POWER_CAPABILITIES};
        // SAFETY: a zeroed struct the call fills in.
        unsafe {
            let mut caps: SYSTEM_POWER_CAPABILITIES = std::mem::zeroed();
            GetPwrCapabilities(&mut caps) != 0 && caps.AoAc != 0
        }
    }

    /* ---------------- devnodes (cfgmgr32) ---------------- */

    mod cm {
        use windows_sys::Win32::Devices::DeviceAndDriverInstallation::{
            CM_Get_DevNode_Registry_PropertyW, CM_Get_Device_IDW, CM_Get_Parent,
            CM_Locate_DevNodeW, CM_DRP_DEVICEDESC, CM_DRP_DRIVER, CM_DRP_FRIENDLYNAME,
            CM_LOCATE_DEVNODE_NORMAL, CR_SUCCESS,
        };

        fn wide(s: &str) -> Vec<u16> {
            s.encode_utf16().chain(Some(0)).collect()
        }

        fn utf16(buffer: &[u16]) -> String {
            let end = buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len());
            String::from_utf16_lossy(&buffer[..end])
        }

        pub fn locate(instance: &str) -> Option<u32> {
            let id = wide(instance);
            let mut node = 0u32;
            // SAFETY: `id` is NUL-terminated and outlives the call.
            (unsafe { CM_Locate_DevNodeW(&mut node, id.as_ptr(), CM_LOCATE_DEVNODE_NORMAL) }
                == CR_SUCCESS)
                .then_some(node)
        }

        pub fn parent(node: u32) -> Option<u32> {
            let mut up = 0u32;
            // SAFETY: plain out-parameter.
            (unsafe { CM_Get_Parent(&mut up, node, 0) } == CR_SUCCESS).then_some(up)
        }

        pub fn instance_id(node: u32) -> Option<String> {
            let mut buffer = [0u16; 201];
            // SAFETY: the length passed is the buffer's.
            (unsafe { CM_Get_Device_IDW(node, buffer.as_mut_ptr(), buffer.len() as u32, 0) }
                == CR_SUCCESS)
                .then(|| utf16(&buffer))
        }

        fn property(node: u32, which: u32) -> Option<String> {
            let mut buffer = [0u16; 512];
            let mut bytes = (buffer.len() * 2) as u32;
            // SAFETY: `bytes` is the buffer's size in bytes.
            let ok = unsafe {
                CM_Get_DevNode_Registry_PropertyW(
                    node,
                    which,
                    std::ptr::null_mut(),
                    buffer.as_mut_ptr().cast(),
                    &mut bytes,
                    0,
                )
            } == CR_SUCCESS;
            ok.then(|| utf16(&buffer)).filter(|s| !s.is_empty())
        }

        /// `{class guid}\NNNN`, the driver key under Control\Class.
        pub fn driver_key(node: u32) -> Option<String> {
            property(node, CM_DRP_DRIVER)
        }

        pub fn name(node: u32) -> Option<String> {
            property(node, CM_DRP_FRIENDLYNAME).or_else(|| property(node, CM_DRP_DEVICEDESC))
        }
    }

    /* ---------------- T3: PortCls idle timer ---------------- */

    struct IdleTarget {
        device: String,
        name: String,
        path: String,
        bytes: Option<Vec<u8>>,
    }

    fn read_binary(path: &str) -> Option<Vec<u8>> {
        let key = hklm().open_subkey_with_flags(path, KEY_QUERY_VALUE).ok()?;
        let value = key.get_raw_value(IDLE_VALUE).ok()?;
        (value.vtype == winreg::enums::REG_BINARY).then_some(value.bytes)
    }

    fn idle_target(device: &str) -> Option<IdleTarget> {
        let node = cm::locate(device)?;
        let path = idle_key_path(&cm::driver_key(node)?)?;
        Some(IdleTarget {
            device: device.to_string(),
            name: cm::name(node).unwrap_or_else(|| device.to_string()),
            bytes: read_binary(&path),
            path,
        })
    }

    fn devnodes(raws: &[Raw]) -> Vec<&str> {
        let mut seen = HashSet::new();
        raws.iter()
            .filter(|r| r.active)
            .filter_map(|r| r.devnode.as_deref())
            .filter(|d| seen.insert(d.to_ascii_lowercase()))
            .collect()
    }

    fn idle_timers(raws: &[Raw], applied: &HashSet<String>) -> Vec<IdleTimer> {
        let mut out: Vec<IdleTimer> = devnodes(raws)
            .into_iter()
            .filter_map(idle_target)
            .filter_map(|t| {
                let id = format!("{IDLE_PREFIX}{}", t.device);
                let seconds = t.bytes.as_deref().and_then(idle_seconds)?;
                let applied = applied.contains(&id);
                (seconds > 0 || applied).then_some(IdleTimer {
                    id,
                    name: t.name,
                    seconds,
                    applied,
                })
            })
            .collect();
        // Applied on a device that is not in use right now: still listed, so
        // it can be restored.
        for id in applied.iter().filter(|id| id.starts_with(IDLE_PREFIX)) {
            if !out.iter().any(|t| t.id == *id) {
                let device = &id[IDLE_PREFIX.len()..];
                let target = idle_target(device);
                out.push(IdleTimer {
                    id: id.clone(),
                    name: target.as_ref().map_or_else(|| device.to_string(), |t| t.name.clone()),
                    seconds: target
                        .and_then(|t| t.bytes.as_deref().and_then(idle_seconds))
                        .unwrap_or(0),
                    applied: true,
                });
            }
        }
        out
    }

    /// The live value of an applied T3, for the update check: still 0.
    pub fn idle_still_off(device: &str) -> Option<bool> {
        let target = idle_target(device)?;
        Some(target.bytes.as_deref().and_then(idle_seconds) == Some(0))
    }

    fn require_device(id: &str, prefix: &str) -> Result<String, String> {
        id.strip_prefix(prefix)
            .filter(|d| valid_instance_id(d))
            .map(str::to_string)
            .ok_or_else(|| format!("not an audio device: {id}"))
    }

    pub fn apply_idle(store: &RollbackStore, id: &str) -> Result<(), String> {
        let device = require_device(id, IDLE_PREFIX)?;
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let target = idle_target(&device)
            .ok_or("this audio device is no longer present; nothing was changed")?;
        let bytes = target
            .bytes
            .clone()
            .ok_or("this audio device's driver has no idle timer to turn off; nothing was changed")?;
        if idle_seconds(&bytes).is_none() {
            return Err("the idle timer has an unexpected size; nothing was changed".into());
        }
        let mut transaction = store.transaction()?;
        transaction.save_entry(
            id,
            SnapshotEntry::RegistryBinary {
                hive: "HKLM".into(),
                path: target.path.clone(),
                name: IDLE_VALUE.into(),
                original: Some(bytes),
            },
        )?;
        write_binary(&target.path, Some(&[0, 0, 0, 0]))
    }

    pub fn rollback_idle(store: &RollbackStore, id: &str) -> Result<(), String> {
        store.restore_entry(id, |entry| {
            let SnapshotEntry::RegistryBinary { path, original, .. } = entry else {
                return Err("unexpected snapshot type for an audio idle timer".into());
            };
            // A driver reinstall removes the key with everything in it:
            // nothing of ours is left to undo.
            if hklm().open_subkey_with_flags(&path, KEY_QUERY_VALUE).is_err() {
                return Ok(());
            }
            write_binary(&path, original.as_deref())
        })
    }

    /// Writes (or with `None` deletes) the value and reads it back.
    fn write_binary(path: &str, bytes: Option<&[u8]>) -> Result<(), String> {
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let key = hklm()
            .open_subkey_with_flags(path, KEY_QUERY_VALUE | KEY_SET_VALUE)
            .map_err(|e| format!("could not open the audio driver settings: {e}"))?;
        let result = match bytes {
            Some(bytes) => key.set_raw_value(
                IDLE_VALUE,
                &winreg::RegValue {
                    vtype: winreg::enums::REG_BINARY,
                    bytes: bytes.to_vec(),
                },
            ),
            None => match key.delete_value(IDLE_VALUE) {
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                other => other,
            },
        };
        result.map_err(|e| format!("could not change the audio idle timer: {e}"))?;
        if read_binary(path).as_deref() != bytes {
            return Err("the audio idle timer did not keep the new value; the rollback snapshot was retained".into());
        }
        Ok(())
    }

    /// DIF_PROPERTYCHANGE / DICS_PROPCHANGE: the restart Device Manager does
    /// when a device's settings change, so PortCls reads the timer again.
    /// Only for an audio-class device; sound stops for a moment.
    pub fn restart_device(device: &str) -> Result<(), String> {
        use windows_sys::Win32::Devices::DeviceAndDriverInstallation::{
            SetupDiCallClassInstaller, SetupDiCreateDeviceInfoList, SetupDiDestroyDeviceInfoList,
            SetupDiOpenDeviceInfoW, SetupDiSetClassInstallParamsW, DICS_FLAG_GLOBAL,
            DICS_PROPCHANGE, DIF_PROPERTYCHANGE, SP_CLASSINSTALL_HEADER, SP_DEVINFO_DATA,
            SP_PROPCHANGE_PARAMS,
        };
        if !valid_instance_id(device) {
            return Err("not an audio device".into());
        }
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let node = cm::locate(device).ok_or("this audio device is no longer present")?;
        if cm::driver_key(node).and_then(|k| idle_key_path(&k)).is_none() {
            return Err("only an audio device can be restarted here".into());
        }
        let id: Vec<u16> = device.encode_utf16().chain(Some(0)).collect();
        // SAFETY: every struct carries its own size; the list is destroyed on
        // every path after it was created.
        unsafe {
            let set = SetupDiCreateDeviceInfoList(std::ptr::null(), std::ptr::null_mut());
            if set == -1 {
                return Err("Windows could not open the device list".into());
            }
            let mut data: SP_DEVINFO_DATA = std::mem::zeroed();
            data.cbSize = std::mem::size_of::<SP_DEVINFO_DATA>() as u32;
            let params = SP_PROPCHANGE_PARAMS {
                ClassInstallHeader: SP_CLASSINSTALL_HEADER {
                    cbSize: std::mem::size_of::<SP_CLASSINSTALL_HEADER>() as u32,
                    InstallFunction: DIF_PROPERTYCHANGE,
                },
                StateChange: DICS_PROPCHANGE,
                Scope: DICS_FLAG_GLOBAL,
                HwProfile: 0,
            };
            let ok = SetupDiOpenDeviceInfoW(set, id.as_ptr(), std::ptr::null_mut(), 0, &mut data) != 0
                && SetupDiSetClassInstallParamsW(
                    set,
                    &data,
                    &params.ClassInstallHeader,
                    std::mem::size_of::<SP_PROPCHANGE_PARAMS>() as u32,
                ) != 0
                && SetupDiCallClassInstaller(DIF_PROPERTYCHANGE, set, &data) != 0;
            let error = std::io::Error::last_os_error();
            SetupDiDestroyDeviceInfoList(set);
            if ok {
                Ok(())
            } else {
                Err(format!("Windows could not restart the audio device: {error}"))
            }
        }
    }

    /* ---------------- T4: USB power management (WMI) ---------------- */

    /// `MSPower_DeviceEnable` instances, by lower-cased instance name.
    fn power_switches() -> HashMap<String, bool> {
        let Ok(session) = crate::netshaper::wmi::Session::connect(r"ROOT\WMI") else {
            return HashMap::new();
        };
        session
            .rows("SELECT InstanceName, Enable FROM MSPower_DeviceEnable")
            .unwrap_or_default()
            .into_iter()
            .filter_map(|row| {
                let name = session_string(&row, "InstanceName")?;
                let enable = session_bool(&row, "Enable")?;
                Some((name.to_ascii_lowercase(), enable))
            })
            .collect()
    }

    fn get(row: &windows::Win32::System::Wmi::IWbemClassObject, name: &str) -> Option<VARIANT> {
        let wide: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
        let mut value = VARIANT::new();
        // SAFETY: `row` is live; `value` is a live out-parameter.
        unsafe { row.Get(windows::core::PCWSTR(wide.as_ptr()), 0, &mut value, None, None) }.ok()?;
        Some(value)
    }

    fn session_string(row: &windows::Win32::System::Wmi::IWbemClassObject, name: &str) -> Option<String> {
        BSTR::try_from(&get(row, name)?).ok().map(|s| s.to_string())
    }

    fn session_bool(row: &windows::Win32::System::Wmi::IWbemClassObject, name: &str) -> Option<bool> {
        bool::try_from(&get(row, name)?).ok()
    }

    /// The device that owns the switch: the endpoint's devnode or its first
    /// USB ancestor that has one.
    fn power_owner(devnode: &str, switches: &HashMap<String, bool>) -> Option<(String, bool)> {
        let mut node = cm::locate(devnode)?;
        for _ in 0..8 {
            let id = cm::instance_id(node)?;
            if !usb_function(&id) {
                return None;
            }
            if let Some(enabled) = switches.get(&format!("{id}_0").to_ascii_lowercase()) {
                return Some((id, *enabled));
            }
            node = cm::parent(node)?;
        }
        None
    }

    fn usb_power(raws: &[Raw], applied: &HashSet<String>) -> Vec<UsbPower> {
        let usb: Vec<&Raw> = raws.iter().filter(|r| r.active && r.bus == Bus::Usb).collect();
        let has_applied = applied.iter().any(|id| id.starts_with(POWER_PREFIX));
        if usb.is_empty() && !has_applied {
            return Vec::new();
        }
        let switches = power_switches();
        let mut out: Vec<UsbPower> = Vec::new();
        for raw in usb {
            let Some((device, enabled)) = raw.devnode.as_deref().and_then(|d| power_owner(d, &switches)) else {
                continue;
            };
            let id = format!("{POWER_PREFIX}{device}");
            if out.iter().any(|p| p.id.eq_ignore_ascii_case(&id)) {
                continue;
            }
            let applied = applied.contains(&id);
            if enabled || applied {
                out.push(UsbPower {
                    name: raw.name.clone(),
                    may_power_down: enabled,
                    applied,
                    id,
                });
            }
        }
        for id in applied.iter().filter(|id| id.starts_with(POWER_PREFIX)) {
            if !out.iter().any(|p| p.id == *id) {
                let device = &id[POWER_PREFIX.len()..];
                out.push(UsbPower {
                    id: id.clone(),
                    name: cm::locate(device).and_then(cm::name).unwrap_or_else(|| device.to_string()),
                    may_power_down: switches
                        .get(&format!("{device}_0").to_ascii_lowercase())
                        .copied()
                        .unwrap_or(false),
                    applied: true,
                });
            }
        }
        out
    }

    /// Current state of one switch; `None` when the device is not connected.
    pub fn power_enabled(device: &str) -> Option<bool> {
        let _com = com().ok()?;
        power_switches()
            .get(&format!("{device}_0").to_ascii_lowercase())
            .copied()
    }

    fn set_power(instance_name: &str, enable: bool) -> Result<(), String> {
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let device = instance_name
            .strip_suffix("_0")
            .filter(|d| valid_instance_id(d))
            .ok_or("not a device power switch")?;
        let session = crate::netshaper::wmi::Session::connect(r"ROOT\WMI")?;
        let literal = format!("{device}_0").replace('\\', r"\\");
        session
            .update_bool(
                &format!("SELECT * FROM MSPower_DeviceEnable WHERE InstanceName = '{literal}'"),
                "Enable",
                enable,
            )
            .map_err(|e| format!("Windows could not change the device's power setting ({e})"))?;
        let now = power_switches().get(&instance_name.to_ascii_lowercase()).copied();
        if now != Some(enable) {
            return Err("the device's power setting did not change; the rollback snapshot was retained".into());
        }
        Ok(())
    }

    pub fn apply_power(store: &RollbackStore, id: &str) -> Result<(), String> {
        let device = require_device(id, POWER_PREFIX)?;
        crate::tweaks::windows_impl::refuse_in_unit_tests().map_err(|e| e.to_string())?;
        let _com = com()?;
        // Only a device the Audio page offers: a USB audio device's own switch.
        let raws = endpoints_for_apply()?;
        let switches = power_switches();
        let owner = raws
            .iter()
            .filter(|r| r.active && r.bus == Bus::Usb)
            .filter_map(|r| r.devnode.as_deref().and_then(|d| power_owner(d, &switches)))
            .find(|(owner, _)| owner.eq_ignore_ascii_case(&device))
            .ok_or("this USB audio device is not connected or has no power setting; nothing was changed")?;
        let instance_name = format!("{}_0", owner.0);
        let mut transaction = store.transaction()?;
        transaction.save_entry(
            id,
            SnapshotEntry::DevicePowerEnable {
                instance_name: instance_name.clone(),
                original: owner.1,
            },
        )?;
        set_power(&instance_name, false)
    }

    pub fn rollback_power(store: &RollbackStore, id: &str) -> Result<(), String> {
        let _com = com()?;
        store.restore_entry(id, |entry| {
            let SnapshotEntry::DevicePowerEnable { instance_name, original } = entry else {
                return Err("unexpected snapshot type for a device power setting".into());
            };
            if !power_switches().contains_key(&instance_name.to_ascii_lowercase()) {
                return Err("connect this USB audio device, then restore again".into());
            }
            set_power(&instance_name, original)
        })
    }

    fn endpoints_for_apply() -> Result<Vec<Raw>, String> {
        // SAFETY: the caller holds COM for this thread.
        let enumerator: IMMDeviceEnumerator =
            unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }.map_err(failed)?;
        let collection = unsafe { enumerator.EnumAudioEndpoints(windows::Win32::Media::Audio::eAll, DEVICE_STATE_ACTIVE) }
            .map_err(failed)?;
        let mut raws = Vec::new();
        for i in 0..unsafe { collection.GetCount() }.map_err(failed)? {
            if let Some(raw) = unsafe { collection.Item(i) }.ok().and_then(read_raw) {
                raws.push(raw);
            }
        }
        Ok(raws)
    }

    /// The friendly name of an applied device for lists and the history.
    pub fn device_name(id: &str) -> Option<String> {
        let device = id
            .strip_prefix(IDLE_PREFIX)
            .or_else(|| id.strip_prefix(POWER_PREFIX))?;
        cm::locate(device).and_then(cm::name)
    }

    /// Whether an applied per-device change still holds (updatewatch.rs).
    pub fn still_applied(id: &str) -> Option<bool> {
        if let Some(device) = id.strip_prefix(IDLE_PREFIX) {
            idle_still_off(device)
        } else if let Some(device) = id.strip_prefix(POWER_PREFIX) {
            power_enabled(device).map(|enabled| !enabled)
        } else {
            None
        }
    }

    #[tauri::command]
    pub async fn audio_status(app: tauri::AppHandle) -> Result<AudioStatus, String> {
        let dir = crate::store_for_dir(&app)?;
        tauri::async_runtime::spawn_blocking(move || status(&RollbackStore::new(dir)))
            .await
            .map_err(|e| format!("the audio check stopped unexpectedly: {e}"))?
    }

    /// Restarts one audio device (T3 takes effect at once). Needs
    /// administrator rights: through the helper, one UAC prompt. Part of the
    /// Pro T3 fix, so it is refused without Pro like the fix itself.
    #[tauri::command(async)]
    pub fn restart_audio_device(app: tauri::AppHandle, id: String) -> Result<(), String> {
        let device = id
            .strip_prefix(IDLE_PREFIX)
            .filter(|d| valid_instance_id(d))
            .ok_or("not an audio device")?;
        crate::require_tweak_entitlement(&crate::store_for_dir(&app)?, &id)?;
        if !crate::elevation::is_elevated() {
            return crate::elevation::run_elevated_action(RESTART_FLAG, device);
        }
        restart_device(device)
    }

    /// Opens Windows' Sound settings, or one device's page, on a click.
    #[tauri::command(async)]
    pub fn open_sound_settings(endpoint: Option<String>) -> Result<(), String> {
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let uri = settings_uri(endpoint.as_deref()).ok_or("not an audio device")?;
        let wide: Vec<u16> = uri.encode_utf16().chain(Some(0)).collect();
        let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
        // SAFETY: both strings are NUL-terminated and outlive the call.
        let code = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                verb.as_ptr(),
                wide.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        } as isize;
        if code > 32 {
            Ok(())
        } else {
            Err("Windows could not open Sound settings".into())
        }
    }

    #[cfg(test)]
    mod probe {
        /// Read-only: lists this PC's audio as the page would show it.
        /// `cargo test audio_probe -- --ignored --nocapture`
        #[test]
        #[ignore]
        fn audio_probe_reads_this_pc() {
            let dir = std::env::temp_dir().join(format!("pct-audio-probe-{}", std::process::id()));
            let status = super::status(&super::RollbackStore::new(dir.clone())).unwrap();
            let _ = std::fs::remove_dir_all(&dir);
            println!("{}", serde_json::to_string_pretty(&status).unwrap());
            assert!(!status.endpoints.is_empty());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn only_a_real_endpoint_id_reaches_the_settings_link() {
        assert_eq!(settings_uri(None).as_deref(), Some("ms-settings:sound"));
        let id = "{0.0.0.00000000}.{7a2e23b2-e340-4ecc-b732-cb49ee6dfd2e}";
        assert_eq!(
            settings_uri(Some(id)),
            Some(format!("ms-settings:sound-properties?endpointId={id}"))
        );
        assert!(settings_uri(Some("{0.0.1.00000000}.{7a2e23b2-e340-4ecc-b732-cb49ee6dfd2e}")).is_some());
        for bad in [
            "",
            "{0.0.2.00000000}.{7a2e23b2-e340-4ecc-b732-cb49ee6dfd2e}",
            "{0.0.0.00000000}.{7a2e23b2-e340-4ecc-b732-cb49ee6dfd2e}&x",
            "{0.0.0.00000000}.calc.exe",
            "ms-settings:privacy",
        ] {
            assert_eq!(settings_uri(Some(bad)), None, "{bad}");
        }
    }

    #[test]
    fn the_three_formats_read_on_the_reference_pc_parse() {
        let speakers = hex("feff020080bb000000dc05000800200016001800030000000100000000001000800000aa00389b71");
        let hdmi = hex("feff020080bb000000ee02000400100016001000030000000100000000001000800000aa00389b71");
        let mic = hex("feff020044ac000010b102000400100016001000030000000100000000001000800000aa00389b71");
        let f = |rate, bits| Format { rate, bits, channels: 2, float: false };
        assert_eq!(parse_format(&speakers), Some(f(48_000, 24)));
        assert_eq!(parse_format(&hdmi), Some(f(48_000, 16)));
        assert_eq!(parse_format(&mic), Some(f(44_100, 16)));
    }

    #[test]
    fn plain_pcm_and_float_formats_parse_and_garbage_does_not() {
        // WAVEFORMATEX: PCM, 1 ch, 22050 Hz, 16-bit, no extension.
        let pcm = hex("01000100225600004404010002001000");
        assert_eq!(
            parse_format(&pcm),
            Some(Format { rate: 22_050, bits: 16, channels: 1, float: false })
        );
        // Extensible with the IEEE float sub-format.
        let float = hex("feff020080bb000000dc05000800200016002000030000000300000000001000800000aa00389b71");
        assert_eq!(
            parse_format(&float),
            Some(Format { rate: 48_000, bits: 32, channels: 2, float: true })
        );
        assert_eq!(parse_format(&[]), None);
        assert_eq!(parse_format(&hex("feff0200")), None);
        // Extensible with a too-small extension, or an unknown sub-format.
        assert_eq!(parse_format(&hex("feff020080bb000000dc0500080020000000")), None);
        let ac3 = hex("feff020080bb000000dc05000800200016001800030000009220000000001000800000aa00389b71");
        assert_eq!(parse_format(&ac3), None);
        // Zero channels.
        assert_eq!(parse_format(&hex("01000000225600004404010002001000")), None);
    }

    #[test]
    fn instance_ids_are_checked_before_they_reach_the_registry_or_wmi() {
        assert!(valid_instance_id(r"HDAUDIO\FUNC_01&VEN_10DE&DEV_0099&SUBSYS_14583FC8&REV_1001\5&11B5B86D&0&0001"));
        assert!(valid_instance_id(r"USB\VID_328F&PID_0121&MI_02\9&8010EF&0&0002"));
        for bad in ["", "USB", "no-backslash", r"USB\a,b", r"USB\a'b", r"USB\a b", "USB\\a\u{0}"] {
            assert!(!valid_instance_id(bad), "{bad}");
        }
        assert!(!valid_instance_id(&format!(r"USB\{}", "a".repeat(200))));
    }

    #[test]
    fn the_idle_timer_path_is_the_audio_class_driver_key_only() {
        assert_eq!(
            idle_key_path(r"{4d36e96c-e325-11ce-bfc1-08002be10318}\0003").as_deref(),
            Some(r"SYSTEM\CurrentControlSet\Control\Class\{4d36e96c-e325-11ce-bfc1-08002be10318}\0003\PowerSettings")
        );
        assert!(idle_key_path(r"{4D36E96C-E325-11CE-BFC1-08002BE10318}\0012").is_some());
        for bad in [
            r"{4d36e972-e325-11ce-bfc1-08002be10318}\0003",
            r"{4d36e96c-e325-11ce-bfc1-08002be10318}\003",
            r"{4d36e96c-e325-11ce-bfc1-08002be10318}\00a3",
            r"{4d36e96c-e325-11ce-bfc1-08002be10318}\0003\..",
            r"{4d36e96c-e325-11ce-bfc1-08002be10318}",
        ] {
            assert!(idle_key_path(bad).is_none(), "{bad}");
        }
        assert_eq!(idle_seconds(&[4, 0, 0, 0]), Some(4));
        assert_eq!(idle_seconds(&[0x0a, 0, 0, 0]), Some(10));
        assert_eq!(idle_seconds(&[1, 0, 0]), None);
    }

    #[test]
    fn devnodes_and_endpoint_guids_are_read_from_their_properties() {
        assert_eq!(
            devnode_of(r"{1}.USB\VID_328F&PID_0121&MI_02\9&8010EF&0&0002").as_deref(),
            Some(r"USB\VID_328F&PID_0121&MI_02\9&8010EF&0&0002")
        );
        assert_eq!(devnode_of("{1}.nothing"), None);
        assert_eq!(
            endpoint_guid("{0.0.0.00000000}.{7a2e23b2-e340-4ecc-b732-cb49ee6dfd2e}"),
            Some("{7a2e23b2-e340-4ecc-b732-cb49ee6dfd2e}")
        );
        assert_eq!(endpoint_guid("garbage"), None);
        assert!(usb_function(r"USB\VID_3554&PID_F510&MI_00\9&30dc13b6&0&0000"));
        assert!(!usb_function(r"USB\ROOT_HUB30\5&1837e51b&0&0"));
        assert!(!usb_function(r"PCI\VEN_1022&DEV_15B6\4&37231990&0&0341"));
        assert_eq!(Bus::from_enumerator("BTHENUM"), Bus::Bluetooth);
        assert_eq!(Bus::from_enumerator("BTHHFENUM"), Bus::Bluetooth);
        assert_eq!(Bus::from_enumerator("usb"), Bus::Usb);
        assert_eq!(Bus::from_enumerator("HDAUDIO"), Bus::Internal);
        assert_eq!(Kind::from_form_factor(9), Kind::Hdmi);
        assert_eq!(Kind::from_form_factor(42), Kind::Other);
    }
}
