//! Device-bound bonus grants use a separate issuer key and storage from purchased Pro.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

// A build with no provisioned bonus issuer key cannot accept any bonus grant.
const ISSUER: &str = match option_env!("PCT_REFERRAL_PUBLIC_KEY") {
    Some(key) => key,
    None => "",
};
const LEASE_SECS: u64 = 10 * 60;
static DEVICE_LOCK: Mutex<()> = Mutex::new(());
static STATE_LOCK: Mutex<()> = Mutex::new(());
static CLOCK: std::sync::OnceLock<(u64, Instant)> = std::sync::OnceLock::new();

fn now() -> u64 {
    let wall = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|t| t.as_secs())
        .unwrap_or(0);
    let (start, tick) = CLOCK.get_or_init(|| (wall, Instant::now()));
    wall.max(start.saturating_add(tick.elapsed().as_secs()))
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(windows)]
fn protect(bytes: &[u8], encrypt: bool, machine: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_LOCAL_MACHINE,
        CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes
            .len()
            .try_into()
            .map_err(|_| "Protected data too large")?,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    let result = unsafe {
        if encrypt {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN
                    | if machine {
                        CRYPTPROTECT_LOCAL_MACHINE
                    } else {
                        0
                    },
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if result == 0 {
        return Err("Windows could not protect or unlock the referral identity".into());
    }
    let copied =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData as *mut std::ffi::c_void);
    }
    Ok(copied)
}
#[cfg(not(windows))]
fn protect(_bytes: &[u8], _encrypt: bool, _machine: bool) -> Result<Vec<u8>, String> {
    Err("Referral device identity requires Windows".into())
}

fn read_protected(file: &Path) -> Result<Vec<u8>, String> {
    let bytes = std::fs::read(file).map_err(|e| e.to_string())?;
    if bytes.len() > 65536 {
        return Err("Invalid protected identity".into());
    }
    // Outer protection binds the file to this PC; the inner layer also requires this Windows user.
    let inner = protect(&bytes, false, true)?;
    protect(&inner, false, false)
}
fn write_protected(file: &Path, bytes: &[u8], create_only: bool) -> Result<(), String> {
    let parent = file.parent().ok_or("Invalid private storage")?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut suffix = [0u8; 16];
    getrandom::getrandom(&mut suffix).map_err(|_| "Random generator unavailable")?;
    let temp = file.with_extension(format!("{}.tmp", hash(&suffix)));
    let encrypted = protect(&protect(bytes, true, false)?, true, true)?;
    use std::io::Write;
    let mut output = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|e| e.to_string())?;
    let result = (|| {
        output.write_all(&encrypted)?;
        output.sync_all()?;
        drop(output);
        if create_only {
            std::fs::hard_link(&temp, file)
        } else {
            std::fs::rename(&temp, file)
        }
    })();
    let _ = std::fs::remove_file(&temp);
    result.map_err(|e| e.to_string())
}
fn key(dir: &Path, create: bool) -> Result<SigningKey, String> {
    let _guard = DEVICE_LOCK
        .lock()
        .map_err(|_| "Identity storage unavailable")?;
    let file = dir.join("referral-device.dpapi");
    if !file.try_exists().map_err(|e| e.to_string())? {
        if !create {
            return Err("Referral device identity is missing".into());
        }
        let mut seed = [0u8; 32];
        getrandom::getrandom(&mut seed).map_err(|_| "Random generator unavailable")?;
        // Publish a complete protected file without overwriting an identity created by another process.
        if let Err(error) = write_protected(&file, &seed, true) {
            if !file.try_exists().unwrap_or(false) {
                return Err(error);
            }
        }
    }
    let seed: [u8; 32] = read_protected(&file)?
        .try_into()
        .map_err(|_| "Corrupt referral device identity")?;
    Ok(SigningKey::from_bytes(&seed))
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Session {
    user_id: String,
    session_hash: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    public_key: String,
    key_hash: String,
}

#[tauri::command]
pub fn referral_device(app: tauri::AppHandle) -> Result<Device, String> {
    let signing = key(&crate::store_for_dir(&app)?, true)?;
    let bytes = signing.verifying_key().to_bytes();
    Ok(Device {
        public_key: STANDARD.encode(bytes),
        key_hash: hash(&bytes),
    })
}
#[tauri::command]
pub fn referral_session(
    app: tauri::AppHandle,
    user_id: String,
    token: String,
) -> Result<(), String> {
    let _guard = STATE_LOCK
        .lock()
        .map_err(|_| "Session storage unavailable")?;
    if user_id.parse::<u64>().ok().is_none_or(|id| id == 0)
        || token.len() < 20
        || token.len() > 8192
    {
        return Err("Invalid account session".into());
    }
    let session = Session {
        user_id,
        session_hash: hash(token.as_bytes()),
    };
    write_protected(
        &crate::store_for_dir(&app)?.join("referral-session.dpapi"),
        &serde_json::to_vec(&session).map_err(|e| e.to_string())?,
        false,
    )
}

fn uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
}
fn validate_challenge(payload: &str, session: &Session, key_hash: &str) -> bool {
    let lines: Vec<_> = payload.split('\n').collect();
    payload.len() <= 512
        && lines.len() == 7
        && lines[0] == "pctweaker:referral:v1"
        && lines[1] == session.user_id
        && ["activate", "license"].contains(&lines[2])
        && uuid(lines[3])
        && uuid(lines[4])
        && lines[5].len() == 43
        && lines[5]
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        && lines[6] == key_hash
}
#[tauri::command]
pub fn referral_proof(app: tauri::AppHandle, payload: String) -> Result<String, String> {
    let dir = crate::store_for_dir(&app)?;
    let signing = key(&dir, false)?;
    let session: Session =
        serde_json::from_slice(&read_protected(&dir.join("referral-session.dpapi"))?)
            .map_err(|_| "Invalid referral session")?;
    if !validate_challenge(
        &payload,
        &session,
        &hash(&signing.verifying_key().to_bytes()),
    ) {
        return Err("Invalid referral challenge".into());
    }
    Ok(STANDARD.encode(signing.sign(payload.as_bytes()).to_bytes()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Bonus {
    user_id: String,
    is_pro: bool,
    plan: String,
    product: String,
    schema_version: u8,
    grant_id: String,
    device_key_hash: String,
    session_hash: String,
    issued_at: u64,
    expires_at: u64,
}
fn verified(
    response: &crate::license::SignedLicenseResponse,
    issuer: &str,
    session: &Session,
    key_hash: &str,
    time: u64,
) -> Option<Bonus> {
    let public: [u8; 32] = STANDARD.decode(issuer).ok()?.try_into().ok()?;
    let signature: [u8; 64] = STANDARD.decode(&response.signature).ok()?.try_into().ok()?;
    VerifyingKey::from_bytes(&public)
        .ok()?
        .verify_strict(
            response.payload_json.as_bytes(),
            &Signature::from_bytes(&signature),
        )
        .ok()?;
    let bonus: Bonus = serde_json::from_str(&response.payload_json).ok()?;
    (bonus.schema_version == 2
        && bonus.is_pro
        && bonus.plan == "referral_bonus"
        && bonus.product == "pctweaker"
        && uuid(&bonus.grant_id)
        && bonus.user_id == session.user_id
        && bonus.session_hash == session.session_hash
        && bonus.device_key_hash == key_hash
        && bonus.issued_at > 0
        && bonus.issued_at <= time.saturating_add(60)
        && time.saturating_sub(bonus.issued_at) <= LEASE_SECS
        && time < bonus.expires_at)
        .then_some(bonus)
}
fn stored(dir: &Path) -> Option<Bonus> {
    let signing = key(dir, false).ok()?;
    let session: Session =
        serde_json::from_slice(&read_protected(&dir.join("referral-session.dpapi")).ok()?).ok()?;
    let response =
        serde_json::from_slice(&read_protected(&dir.join("referral-license.dpapi")).ok()?).ok()?;
    verified(
        &response,
        ISSUER,
        &session,
        &hash(&signing.verifying_key().to_bytes()),
        now(),
    )
}
pub fn is_active(dir: &Path) -> bool {
    stored(dir).is_some()
}

#[tauri::command]
pub fn save_referral_license(
    app: tauri::AppHandle,
    response: crate::license::SignedLicenseResponse,
) -> Result<(), String> {
    let _guard = STATE_LOCK
        .lock()
        .map_err(|_| "Session storage unavailable")?;
    let dir = crate::store_for_dir(&app)?;
    let signing = key(&dir, false)?;
    let session: Session =
        serde_json::from_slice(&read_protected(&dir.join("referral-session.dpapi"))?)
            .map_err(|_| "Invalid referral session")?;
    if verified(
        &response,
        ISSUER,
        &session,
        &hash(&signing.verifying_key().to_bytes()),
        now(),
    )
    .is_none()
    {
        return Err("Bonus licence did not verify for this PC and session".into());
    }
    let bytes = serde_json::to_vec(&response).map_err(|e| e.to_string())?;
    // A separate store: a bonus can never replace or extend a purchased licence.
    write_protected(&dir.join("referral-license.dpapi"), &bytes, false)?;
    // Keep all grant material protected at rest, including its account/session bindings.
    Ok(())
}
#[tauri::command]
pub fn referral_license_status(app: tauri::AppHandle, token: String) -> Result<bool, String> {
    let dir = crate::store_for_dir(&app)?;
    let session: Session = match read_protected(&dir.join("referral-session.dpapi"))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
    {
        Some(session) => session,
        None => return Ok(false),
    };
    Ok(session.session_hash == hash(token.as_bytes()) && is_active(&dir))
}
pub fn clear(dir: &Path) -> Result<(), String> {
    let _guard = STATE_LOCK
        .lock()
        .map_err(|_| "Session storage unavailable")?;
    for name in ["referral-session.dpapi", "referral-license.dpapi"] {
        match std::fs::remove_file(dir.join(name)) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}
#[tauri::command]
pub fn clear_referral_license(app: tauri::AppHandle) -> Result<(), String> {
    clear(&crate::store_for_dir(&app)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (
        crate::license::SignedLicenseResponse,
        String,
        Session,
        String,
    ) {
        let issuer = SigningKey::from_bytes(&[51; 32]);
        let device_hash = hash(&[10; 32]);
        let session = Session {
            user_id: "42".into(),
            session_hash: hash(b"test session only"),
        };
        let payload = serde_json::json!({"userId":"42","isPro":true,"plan":"referral_bonus","product":"pctweaker","schemaVersion":2,
            "grantId":"94f237d4-21ca-4403-a0c4-af70f1cd2541","deviceKeyHash":device_hash,"sessionHash":session.session_hash,
            "issuedAt":1000,"expiresAt":100000});
        let payload_json = payload.to_string();
        let signature = STANDARD.encode(issuer.sign(payload_json.as_bytes()).to_bytes());
        (
            crate::license::SignedLicenseResponse {
                payload_json,
                signature,
            },
            STANDARD.encode(issuer.verifying_key().to_bytes()),
            session,
            device_hash,
        )
    }
    #[test]
    fn bonus_requires_device_session_signature_and_short_freshness() {
        let (response, issuer, session, device) = fixture();
        assert!(verified(&response, &issuer, &session, &device, 1100).is_some());
        assert!(verified(&response, &issuer, &session, &hash(b"other PC"), 1100).is_none());
        let wrong = Session {
            user_id: "43".into(),
            session_hash: session.session_hash.clone(),
        };
        assert!(verified(&response, &issuer, &wrong, &device, 1100).is_none());
        let wrong = Session {
            user_id: "42".into(),
            session_hash: hash(b"other session"),
        };
        assert!(verified(&response, &issuer, &wrong, &device, 1100).is_none());
        assert!(verified(&response, &issuer, &session, &device, 1601).is_none());
        assert!(verified(&response, &issuer, &session, &device, 939).is_none());
        assert!(verified(&response, "", &session, &device, 1100).is_none());
        let mut tampered = response;
        tampered.payload_json = tampered.payload_json.replace("42", "43");
        assert!(verified(&tampered, &issuer, &session, &device, 1100).is_none());
    }
    #[test]
    fn device_key_only_signs_the_referral_protocol_for_the_current_account() {
        let session = Session {
            user_id: "42".into(),
            session_hash: hash(b"test"),
        };
        let device = hash(b"device");
        let payload=format!("pctweaker:referral:v1\n42\nactivate\n94f237d4-21ca-4403-a0c4-af70f1cd2541\n94f237d4-21ca-4403-a0c4-af70f1cd2542\n{}\n{}","a".repeat(43),device);
        assert!(validate_challenge(&payload, &session, &device));
        assert!(!validate_challenge(
            &payload.replace("\n42\n", "\n43\n"),
            &session,
            &device
        ));
        assert!(!validate_challenge(
            &payload.replace("activate", "transfer"),
            &session,
            &device
        ));
        assert!(!validate_challenge(
            &format!("{payload}\n"),
            &session,
            &device
        ));
    }
    #[cfg(windows)]
    #[test]
    fn protected_identity_survives_reloads_and_corruption_fails_closed() {
        let dir = std::env::temp_dir().join(format!(
            "pct-referral-native-test-{}-{}",
            std::process::id(),
            now()
        ));
        let first = key(&dir, true).unwrap().verifying_key();
        assert_eq!(first, key(&dir, false).unwrap().verifying_key());
        std::fs::write(dir.join("referral-device.dpapi"), b"corrupt").unwrap();
        assert!(key(&dir, true).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
