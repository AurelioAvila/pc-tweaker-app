//! Verifies the server-signed Pro entitlement before a Pro tweak runs.
//!
//! ## Why this exists
//!
//! `apply_tweak` used to trust the `requires_pro` flag baked into the
//! compiled tweak list with nothing checking it against the account that is
//! actually running the app. That made "is this allowed" a question the
//! client answered entirely on its own — on the user's own machine, running
//! code the user's own machine executes. A public MIT history made this a
//! standing invitation (see the license change this replaces); closing the
//! MIT grant does nothing for the *current*, officially signed binary, where
//! this is the actual gap.
//!
//! ## How it works
//!
//! The backend signs `{ userId, isPro, plan, product, issuedAt }` with an Ed25519 key
//! it alone holds (`backend/src/license.ts`) and returns the exact JSON
//! string it signed alongside the signature — never a re-serialized copy.
//! This module verifies that signature against the embedded public key,
//! parses the payload only once the signature is confirmed, and treats it as
//! valid for a short grace period from `issued_at`. The app fetches and
//! caches a fresh one after login and periodically thereafter; while
//! offline, the last valid cache keeps working until it ages out.
//!
//! This does not stop someone from forking the source, deleting this check,
//! and building their own private copy — no client-side check can, since the
//! code enforcing it would run on a machine they fully control. What it does
//! stop is the far more common case: the officially distributed, signed
//! binary being driven directly (devtools, a patched IPC call, a future
//! regression of the kind that shipped in 0.4.1) to run a Pro tweak without
//! ever having paid for it.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// Public half of a key pair dedicated to license signing — separate from
/// the Tauri updater's signing key, so a compromise of one never implicates
/// the other. Safe to embed: it is only useful for *verifying* signatures,
/// never for producing them. Key 2 since the 23 Oct 2026 rotation: the app asks
/// the server for it with `?sig=2` and no longer trusts key 1.
const PUBLIC_KEY_B64: &str = "0Cy9wfSUsS/47MQrkgWjlaphga0Rqoho2RPCWMNUSro=";

/// A signed entitlement is valid only for the product that requested it.
/// Keeping this check in the Rust enforcement path prevents an entitlement
/// for another ecosystem app from unlocking PC Tweaker.
const PRODUCT_ID: &str = "pctweaker";

/// How long a signed license is trusted without a fresh fetch. Long enough
/// to cover a weekend or a short trip without connectivity; short enough
/// that a cancelled subscription doesn't keep working offline indefinitely.
const GRACE_PERIOD_SECS: u64 = 3 * 24 * 60 * 60;
/// Lifetime has nothing to lapse; only a refund or dispute revokes it. A
/// month offline keeps a paid-for licence working on a laptop away from a
/// network, while a revoked one still stops at the next refresh.
const LIFETIME_GRACE_PERIOD_SECS: u64 = 30 * 24 * 60 * 60;
/// How far this PC's clock may run behind the server's before a freshly
/// signed licence looks "issued in the future". Five minutes locked Pro out
/// of PCs whose clock had drifted further or whose time zone was set by hand;
/// a day matches the account service's allowance. It cannot extend the
/// offline window: freshness is still measured from the signed `issued_at`.
/// It also bounds the clock offset measured when a licence arrives
/// (`clock_offset`).
const MAX_CLOCK_SKEW_SECS: u64 = 24 * 60 * 60;

/// Field names must match `backend/src/license.ts`'s `LicensePayload` type
/// exactly, camelCase included — this is parsed directly from the JSON
/// string the server signed, not adapted at any boundary in between.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LicensePayload {
    pub user_id: String,
    pub is_pro: bool,
    pub plan: Option<String>,
    /// Older PC Tweaker builds were issued signed payloads before the
    /// multi-product backend added this field. A missing product is therefore
    /// accepted only as the legacy PC Tweaker format. New payloads always
    /// carry a product, and a signed value for any other product is rejected.
    #[serde(default)]
    pub product: Option<String>,
    /// Unix seconds, set by the server at signing time. Freshness is
    /// measured from this, not from local receipt — a cached-and-replayed
    /// response can't be made to look newer than it actually is.
    pub issued_at: u64,
    /// Signed paid-period cutoff. Legacy payloads retain the existing freshness limit.
    #[serde(default)]
    pub expires_at: Option<u64>,
}

/// What the server sends: the exact bytes it signed, plus the signature over
/// those exact bytes. `payload_json` is verified as opaque bytes first and
/// parsed only afterward — see the module docs on why this file never
/// re-serializes a payload to check a signature against it.
/// Also camelCase to match `res.json()`'s literal output from
/// `routes/license.ts` — this struct is deserialized straight from the
/// HTTP response body, not from anything Tauri's IPC layer touches.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SignedLicenseResponse {
    pub payload_json: String,
    pub signature: String,
}

#[derive(Debug, PartialEq)]
pub enum VerifyError {
    BadPublicKey,
    BadSignatureEncoding,
    SignatureInvalid,
    UnparsablePayload,
    WrongProduct,
}

/// Verifies `signature` (base64) against `payload_json`'s raw UTF-8 bytes and
/// returns the parsed payload only if it checks out. This is the only path
/// by which a `LicensePayload` should ever come into existence in this
/// process — there is no constructor that skips verification.
pub fn verify(payload_json: &str, signature_b64: &str) -> Result<LicensePayload, VerifyError> {
    verify_with_public_key(payload_json, signature_b64, PUBLIC_KEY_B64)
}

fn verify_with_public_key(
    payload_json: &str,
    signature_b64: &str,
    public_key_b64: &str,
) -> Result<LicensePayload, VerifyError> {
    let key_bytes: [u8; 32] = STANDARD
        .decode(public_key_b64)
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or(VerifyError::BadPublicKey)?;
    let verifying_key =
        VerifyingKey::from_bytes(&key_bytes).map_err(|_| VerifyError::BadPublicKey)?;

    let sig_bytes: [u8; 64] = STANDARD
        .decode(signature_b64)
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or(VerifyError::BadSignatureEncoding)?;
    let signature = Signature::from_bytes(&sig_bytes);

    verifying_key
        .verify(payload_json.as_bytes(), &signature)
        .map_err(|_| VerifyError::SignatureInvalid)?;

    serde_json::from_str(payload_json).map_err(|_| VerifyError::UnparsablePayload)
}

fn verify_for_pc_tweaker(
    payload_json: &str,
    signature_b64: &str,
) -> Result<LicensePayload, VerifyError> {
    require_pc_tweaker_product(verify(payload_json, signature_b64)?)
}

/// Signature, product and PC binding; freshness is up to the caller.
fn verified_response(
    response: &SignedLicenseResponse,
    public_key_b64: &str,
) -> Option<LicensePayload> {
    let verified =
        verify_with_public_key(&response.payload_json, &response.signature, public_key_b64).ok()?;
    let payload = require_pc_tweaker_product(verified).ok()?;
    bound_to(&response.payload_json, device_hash().as_deref()).then_some(payload)
}

#[cfg(test)]
fn verified_fresh_response(
    response: &SignedLicenseResponse,
    public_key_b64: &str,
) -> Option<LicensePayload> {
    let payload = verified_response(response, public_key_b64)?;
    is_fresh(&payload, 0).then_some(payload)
}

fn require_pc_tweaker_product(payload: LicensePayload) -> Result<LicensePayload, VerifyError> {
    if !is_for_pc_tweaker(&payload) || payload.plan.as_deref() == Some("referral_bonus") {
        return Err(VerifyError::WrongProduct);
    }
    Ok(payload)
}

fn is_for_pc_tweaker(payload: &LicensePayload) -> bool {
    payload.product.as_deref().unwrap_or(PRODUCT_ID) == PRODUCT_ID
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// A payload that has passed signature verification *and* is still inside
/// its grace period. This distinction matters: a validly signed license from
/// three weeks ago proves the server said something true three weeks ago,
/// not that it is still true now. `offset` is the one measured when this
/// licence arrived.
fn is_fresh(payload: &LicensePayload, offset: i64) -> bool {
    // A signed issue time is the server's clock: real time is at least that. Only
    // within the skew a slow PC is allowed, so a server clock that ran ahead can
    // never push this PC's time forward by more than that.
    if payload.issued_at <= clock_now(offset).saturating_add(MAX_CLOCK_SKEW_SECS) {
        observe_server_time(payload.issued_at);
    }
    is_fresh_at(payload, clock_now(offset))
}

/// This PC's clock, never earlier than the clock at start plus the time the
/// process has run, so moving it back while the app is open cannot stretch the
/// offline window. Still this PC's time, not the server's.
fn wall_now() -> u64 {
    static ANCHOR: OnceLock<(u64, Instant)> = OnceLock::new();
    let wall_now = now_secs();
    let (anchor_time, anchor_tick) = ANCHOR.get_or_init(|| (wall_now, Instant::now()));
    wall_now.max(anchor_time.saturating_add(anchor_tick.elapsed().as_secs()))
}

/// The server's clock as far as this PC can tell: its own clock moved by the
/// licence's `offset` (`clock_offset`), never earlier than the server time it
/// has proof of (see `observe_server_time`), which a restart cannot undo
/// either. Every freshness check reads this.
fn clock_now(offset: i64) -> u64 {
    server_now(wall_now(), offset, trusted_now())
}

/// Only this PC's clock takes the offset; the floor is server time already. A
/// floor raised from this PC's own clock would put a PC a day ahead back a day
/// ahead, so nothing but signed server times ever raises it.
fn server_now(wall: u64, offset: i64, floor: u64) -> u64 {
    wall.saturating_add_signed(offset).max(floor)
}

/// Seconds to add to this PC's clock to read the server's: a licence's signed
/// `issued_at` minus this PC's clock when it arrived. A PC whose clock runs a
/// day ahead (a time zone set by hand) otherwise read the last day of a trial
/// or billing period as over, and `save_license` refused the fresh licence.
/// Bounded by the skew allowance: `receivedAt` is not signed, so an edited one,
/// or an old licence saved again, moves the clock by a day at most, never a
/// licence by a month.
fn clock_offset(issued_at: u64, received_at: u64) -> i64 {
    let skew = i128::from(MAX_CLOCK_SKEW_SECS);
    (i128::from(issued_at) - i128::from(received_at)).clamp(-skew, skew) as i64
}

/// Server time this process has proof of: the newest signed `issued_at` it
/// verified, or the floor saved with the cached licence (`seenAt`), plus the
/// time the app has run since (monotonic). It is never ahead of real time, so a
/// PC whose clock runs behind is never locked out by it, and it only grows.
static TRUSTED: Mutex<Option<(u64, Instant)>> = Mutex::new(None);

fn trusted_now() -> u64 {
    TRUSTED
        .lock()
        .ok()
        .and_then(|guard| *guard)
        .map_or(0, |(time, tick)| {
            time.saturating_add(tick.elapsed().as_secs())
        })
}

fn observe_server_time(time: u64) {
    if let Ok(mut guard) = TRUSTED.lock() {
        let current = guard.map_or(0, |(base, tick)| {
            base.saturating_add(tick.elapsed().as_secs())
        });
        if time > current {
            *guard = Some((time, Instant::now()));
        }
    }
}

/// The last moment a licence can be fresh offline. A floor read back from disk
/// is capped here: an edited or damaged `seenAt` can end this licence early,
/// never the next one the server signs.
fn offline_window_end(payload: &LicensePayload) -> u64 {
    payload.issued_at.saturating_add(grace_period(payload))
}

/// Freshness of a cached licence after a restart: the time this PC had already
/// proved when the licence was last checked (`seen_at`) counts even if the
/// clock has been moved back since. Rolling Windows time back to before a
/// subscription's end therefore stops working once the app has seen that end.
fn fresh_after_restart(payload: &LicensePayload, seen_at: Option<u64>, now: u64) -> bool {
    let floor = seen_at.map_or(0, |seen| seen.min(offline_window_end(payload)));
    is_fresh_at(payload, now.max(floor))
}

/// How often a still-running app writes its proven time back to `license.json`.
const FLOOR_WRITE_SECS: u64 = 60;

fn grace_period(payload: &LicensePayload) -> u64 {
    if payload.is_pro && payload.plan.as_deref() == Some("lifetime") {
        LIFETIME_GRACE_PERIOD_SECS
    } else {
        GRACE_PERIOD_SECS
    }
}

fn is_fresh_at(payload: &LicensePayload, now: u64) -> bool {
    payload.issued_at > 0
        && payload.issued_at <= now.saturating_add(MAX_CLOCK_SKEW_SECS)
        && now.saturating_sub(payload.issued_at) <= grace_period(payload)
        && payload.expires_at.is_none_or(|expiry| now < expiry)
}

/// SHA-256 of `pc-tweaker-licence:` and this Windows installation's
/// MachineGuid (lower case). Sent with every licence request; the backend
/// signs it into the licence, so a `license.json` copied to another PC
/// unlocks nothing there. The same value in PC Tweaker and the Uninstaller:
/// it names the PC, not the product. None where the registry cannot be read.
pub(crate) fn device_hash() -> Option<String> {
    static HASH: OnceLock<Option<String>> = OnceLock::new();
    HASH.get_or_init(|| machine_guid().map(|guid| hash_guid(&guid)))
        .clone()
}

fn hash_guid(guid: &str) -> String {
    use sha2::{Digest, Sha256};
    format!(
        "{:x}",
        Sha256::digest(format!(
            "pc-tweaker-licence:{}",
            guid.trim().to_ascii_lowercase()
        ))
    )
}

#[cfg(windows)]
fn machine_guid() -> Option<String> {
    use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY};
    let key = winreg::RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(
            r"SOFTWARE\Microsoft\Cryptography",
            KEY_READ | KEY_WOW64_64KEY,
        )
        .ok()?;
    let guid: String = key.get_value("MachineGuid").ok()?;
    (!guid.trim().is_empty()).then_some(guid)
}
#[cfg(not(windows))]
fn machine_guid() -> Option<String> {
    None
}

/// A licence carrying `deviceHash` must name this PC. One without it is
/// accepted only on a PC whose identity cannot be read: the server issues such
/// a licence to any request without a valid X-Device-Hash, so on a PC that has
/// an identity it would be a licence fetched for no PC in particular, which a
/// copied `license.json` must not be able to use. Read from the exact signed
/// bytes, after the signature check.
fn bound_to(payload_json: &str, this_pc: Option<&str>) -> bool {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Binding {
        #[serde(default)]
        device_hash: Option<String>,
    }
    match serde_json::from_str::<Binding>(payload_json) {
        Ok(Binding { device_hash: None }) => this_pc.is_none(),
        Ok(Binding {
            device_hash: Some(hash),
        }) => this_pc == Some(hash.as_str()),
        Err(_) => false,
    }
}

/// For the licence request header: this PC's hash, or nothing.
#[tauri::command]
pub fn license_device_hash() -> Option<String> {
    device_hash()
}

/// Persists the raw, still-signed response to the app data directory so it
/// survives a restart. Written via temp-file-then-rename, matching
/// `rollback.rs`'s pattern, so an interrupted write can never leave a
/// half-written (and therefore unparsable, therefore Pro-denying) file
/// behind.
pub struct LicenseStore {
    file_path: PathBuf,
}

/// `license.json`: the signed response, verbatim, plus `seenAt`, the server
/// time this PC had proof of when the licence was last checked (see
/// `fresh_after_restart`), and `receivedAt`, this PC's clock when the licence
/// arrived (see `clock_offset`). Older releases read the same file and ignore
/// both; files they wrote lack them and read as they always did.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedLicense {
    #[serde(flatten)]
    response: SignedLicenseResponse,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    seen_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    received_at: Option<u64>,
}

impl CachedLicense {
    /// The offset measured when this licence arrived; none (0) for a file
    /// written before `receivedAt` existed.
    fn offset(&self, payload: &LicensePayload) -> i64 {
        self.received_at
            .map_or(0, |received| clock_offset(payload.issued_at, received))
    }
}

/// One writer at a time: the floor is written back from read paths too.
static STORE_WRITE: Mutex<()> = Mutex::new(());

impl LicenseStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        LicenseStore {
            file_path: app_data_dir.join("license.json"),
        }
    }

    pub fn save(&self, response: &SignedLicenseResponse) -> std::io::Result<()> {
        let seen_at = trusted_now();
        self.write(&CachedLicense {
            response: response.clone(),
            seen_at: (seen_at > 0).then_some(seen_at),
            received_at: Some(now_secs()),
        })
    }

    fn write(&self, cached: &CachedLicense) -> std::io::Result<()> {
        let _guard = STORE_WRITE
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(parent) = self.file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(cached).unwrap();
        let tmp = self
            .file_path
            .with_extension(format!("json.{}.tmp", std::process::id()));
        std::fs::write(&tmp, json)?;
        let result = std::fs::rename(&tmp, &self.file_path);
        if result.is_err() {
            let _ = std::fs::remove_file(&tmp);
        }
        result
    }

    #[cfg(test)]
    fn load(&self) -> Option<SignedLicenseResponse> {
        self.load_cached().map(|cached| cached.response)
    }

    fn load_cached(&self) -> Option<CachedLicense> {
        let text = std::fs::read_to_string(&self.file_path).ok()?;
        serde_json::from_str(&text).ok()
    }

    /// Removes the cached license, if any. Used on logout so a still-fresh
    /// Pro cache from one account can't keep granting Pro tweaks to whoever
    /// signs in next on the same machine. Missing-file is success, not an
    /// error — there is nothing to clear either way.
    pub fn delete(&self) -> std::io::Result<()> {
        match std::fs::remove_file(&self.file_path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e),
        }
    }

    /// The one question this whole module exists to answer: is Pro currently
    /// verified and still fresh? Every failure mode — no cached license, a
    /// corrupt file, a bad signature, an expired grace period, or a license
    /// that was validly signed but says `is_pro: false` — collapses to the
    /// same `false`, on purpose. There is no partial-credit path here.
    pub fn is_pro_and_fresh(&self) -> bool {
        self.verified_fresh_payload()
            .is_some_and(|payload| payload.is_pro)
    }

    /// Native feature gates may inspect the plan only after this accessor
    /// verifies the signature, product binding, and existing offline window.
    /// A plan supplied by the renderer never participates in entitlement.
    pub fn verified_fresh_payload(&self) -> Option<LicensePayload> {
        let cached = self.load_cached()?;
        let payload = verified_response(&cached.response, PUBLIC_KEY_B64)?;
        if let Some(seen) = cached.seen_at {
            observe_server_time(seen.min(offline_window_end(&payload)));
        }
        let offset = cached.offset(&payload);
        let fresh = is_fresh(&payload, offset)
            && fresh_after_restart(&payload, cached.seen_at, clock_now(offset));
        // Keep the proven time on disk while the app runs, so a restart with
        // the clock moved back starts from it. Server time only: `trusted_now`.
        let proven = trusted_now();
        if proven >= cached.seen_at.unwrap_or(0).saturating_add(FLOOR_WRITE_SECS) {
            let _ = self.write(&CachedLicense {
                seen_at: Some(proven),
                ..cached
            });
        }
        fresh.then_some(payload)
    }
}

/// Called by the frontend right after it fetches a fresh signed license from
/// the backend. Verifies the signature *before* saving anything, so a
/// tampered or malformed response received over a broken connection never
/// overwrites a good cached license with junk that would just read as
/// "not Pro" until the next successful fetch.
#[tauri::command]
pub fn save_license(app: tauri::AppHandle, response: SignedLicenseResponse) -> Result<(), String> {
    let payload = verify_for_pc_tweaker(&response.payload_json, &response.signature)
        .map_err(|e| format!("license did not verify: {:?}", e))?;
    // Judged on the server's clock as this very response gives it, so a PC a
    // day ahead does not refuse the licence for the last day of a plan.
    if !is_fresh(&payload, clock_offset(payload.issued_at, now_secs())) {
        return Err("license is expired or its issue time is ahead of this PC's clock".into());
    }
    if !bound_to(&response.payload_json, device_hash().as_deref()) {
        return Err("license was issued to another PC".into());
    }
    let dir = crate::store_for_dir(&app)?;
    LicenseStore::new(dir.clone())
        .save(&response)
        .map_err(|e| e.to_string())?;
    // Pro's Windows Update alert follows the licence (on with Pro, off when
    // it ends). Cheap when nothing changed; never waits on Task Scheduler.
    crate::update_alert::reconcile_in_background(dir);
    Ok(())
}

/// Read-only status for the UI: whether a verified, still-fresh Pro license
/// is cached right now. Never the source of truth `apply_tweak` itself
/// relies on — that re-verifies independently on every call — this is only
/// for showing the user something accurate in the account panel.
#[tauri::command]
pub fn license_status(app: tauri::AppHandle) -> Result<bool, String> {
    let store = LicenseStore::new(crate::store_for_dir(&app)?);
    Ok(store.is_pro_and_fresh())
}

/// Called on logout. Without this, a still-fresh cached Pro license would
/// keep granting Pro tweaks for up to the grace period to whoever signs in
/// next on the same machine — including an anonymous session, or a second
/// account that never paid for anything.
#[tauri::command]
pub fn clear_license(app: tauri::AppHandle) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    crate::referral::clear(&dir)?;
    LicenseStore::new(dir.clone())
        .delete()
        .map_err(|e| e.to_string())?;
    crate::update_alert::reconcile_in_background(dir);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use std::path::PathBuf;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "pc-tweaker-license-test-{}-{}-{}",
            tag,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A real response produced by `backend/src/license.ts` with the private
    /// half of the key pair embedded above — not a value invented on the
    /// Rust side. This is what actually proves the two implementations agree
    /// on wire format, rather than each independently testing itself.
    const REAL_NODE_SIGNED_RESPONSE: &str = r#"{"payloadJson":"{\"userId\":\"42\",\"isPro\":true,\"plan\":\"monthly\",\"issuedAt\":1787042906}","signature":"C9p1XHnjIifxtm1SOJbpoGq0/yMfy87+Y7Y0Xjt7bUiL5FMpigmJm0T+x9z2SDql3VSU2NbK6mWXf2Z7dmkDAw=="}"#;

    /// The same payload signed by the retired key 1 (before the 23 Oct 2026 rotation).
    const KEY1_SIGNED_RESPONSE: &str = r#"{"payloadJson":"{\"userId\":\"42\",\"isPro\":true,\"plan\":\"monthly\",\"issuedAt\":1787042906}","signature":"czs+MUbA9IByR9UJ4DKFOqafgAKrI40xo+enb7YjzsDrZqMyLwcjmC6DS2DnEpb0itunOk8ZvreUarvFIk+pCg=="}"#;

    #[test]
    fn a_licence_signed_by_the_retired_key_1_is_rejected() {
        let resp: SignedLicenseResponse = serde_json::from_str(KEY1_SIGNED_RESPONSE).unwrap();
        assert_eq!(
            verify(&resp.payload_json, &resp.signature),
            Err(VerifyError::SignatureInvalid)
        );
    }

    #[test]
    fn a_legacy_pc_tweaker_payload_without_product_remains_compatible() {
        let resp: SignedLicenseResponse = serde_json::from_str(REAL_NODE_SIGNED_RESPONSE).unwrap();
        let payload = verify_for_pc_tweaker(&resp.payload_json, &resp.signature).unwrap();
        assert_eq!(payload.product, None);
    }

    fn sign_test_payload(payload: &LicensePayload) -> (String, String, String) {
        let signing_key = SigningKey::from_bytes(&[7_u8; 32]);
        let mut value = serde_json::to_value(payload).unwrap();
        if let Some(hash) = device_hash() {
            value["deviceHash"] = serde_json::Value::String(hash);
        }
        let payload_json = value.to_string();
        let signature = signing_key.sign(payload_json.as_bytes());
        (
            payload_json,
            STANDARD.encode(signature.to_bytes()),
            STANDARD.encode(signing_key.verifying_key().to_bytes()),
        )
    }

    #[test]
    fn a_current_product_bound_payload_verifies() {
        let payload = LicensePayload {
            user_id: "42".into(),
            is_pro: true,
            plan: Some("monthly".into()),
            product: Some(PRODUCT_ID.into()),
            issued_at: now_secs(),
            expires_at: None,
        };
        let (json, signature, public_key) = sign_test_payload(&payload);
        assert_eq!(
            verify_with_public_key(&json, &signature, &public_key),
            Ok(payload)
        );
    }

    #[test]
    fn a_fresh_signed_lifetime_payload_exposes_its_plan_only_after_verification() {
        let payload = LicensePayload {
            user_id: "fixture-only".into(),
            is_pro: true,
            plan: Some("lifetime".into()),
            product: Some(PRODUCT_ID.into()),
            issued_at: now_secs(),
            expires_at: None,
        };
        let (payload_json, signature, public_key) = sign_test_payload(&payload);
        let response = SignedLicenseResponse {
            payload_json,
            signature,
        };
        assert_eq!(
            verified_fresh_response(&response, &public_key),
            Some(payload)
        );
        // The same fixture cannot pass the production key used by the store.
        let directory = temp_dir("lifetime-accessor");
        let store = LicenseStore::new(directory);
        store.save(&response).unwrap();
        assert_eq!(store.verified_fresh_payload(), None);
        let mut tampered = response;
        tampered.payload_json.push(' ');
        assert_eq!(verified_fresh_response(&tampered, &public_key), None);
    }

    #[test]
    fn the_verified_payload_accessor_rejects_wrong_product_expired_and_future_signatures() {
        let mut payload = LicensePayload {
            user_id: "fixture-only".into(),
            is_pro: true,
            plan: Some("lifetime".into()),
            product: Some("another-product".into()),
            issued_at: now_secs(),
            expires_at: None,
        };
        for (product, issued_at) in [
            ("another-product", now_secs()),
            (
                PRODUCT_ID,
                now_secs().saturating_sub(LIFETIME_GRACE_PERIOD_SECS + 3600),
            ),
            (
                PRODUCT_ID,
                now_secs().saturating_add(MAX_CLOCK_SKEW_SECS + 3600),
            ),
        ] {
            payload.product = Some(product.into());
            payload.issued_at = issued_at;
            let (payload_json, signature, public_key) = sign_test_payload(&payload);
            assert_eq!(
                verified_fresh_response(
                    &SignedLicenseResponse {
                        payload_json,
                        signature
                    },
                    &public_key
                ),
                None
            );
        }
    }

    #[test]
    fn another_products_valid_payload_cannot_unlock_pc_tweaker() {
        let payload = LicensePayload {
            user_id: "42".into(),
            is_pro: true,
            plan: Some("lifetime".into()),
            product: Some("uninstaller".into()),
            issued_at: now_secs(),
            expires_at: None,
        };
        let (json, signature, public_key) = sign_test_payload(&payload);
        let verified = verify_with_public_key(&json, &signature, &public_key).unwrap();
        assert_eq!(
            require_pc_tweaker_product(verified),
            Err(VerifyError::WrongProduct)
        );
    }

    #[test]
    fn a_single_flipped_byte_in_the_payload_is_rejected() {
        let resp: SignedLicenseResponse = serde_json::from_str(REAL_NODE_SIGNED_RESPONSE).unwrap();
        let tampered = resp
            .payload_json
            .replace("\"isPro\":true", "\"isPro\":false");
        assert_ne!(
            tampered, resp.payload_json,
            "the replace must actually have changed something"
        );
        assert_eq!(
            verify(&tampered, &resp.signature),
            Err(VerifyError::SignatureInvalid)
        );
    }

    #[test]
    fn a_signature_from_a_different_key_is_rejected() {
        let resp: SignedLicenseResponse = serde_json::from_str(REAL_NODE_SIGNED_RESPONSE).unwrap();
        // A syntactically valid but wrong signature (right length, wrong bytes).
        let mut bogus = STANDARD.decode(&resp.signature).unwrap();
        bogus[0] ^= 0xFF;
        let bogus_b64 = STANDARD.encode(bogus);
        assert_eq!(
            verify(&resp.payload_json, &bogus_b64),
            Err(VerifyError::SignatureInvalid)
        );
    }

    #[test]
    fn a_fresh_pro_payload_reads_as_pro() {
        let dir = temp_dir("fresh");
        let store = LicenseStore::new(dir);
        let payload = LicensePayload {
            user_id: "1".into(),
            is_pro: true,
            plan: Some("monthly".into()),
            product: Some(PRODUCT_ID.into()),
            issued_at: now_secs(),
            expires_at: None,
        };
        // Sign it the same way the real verify() expects: payload_json must
        // be exactly what a signature was computed over. Since this test has
        // no private key, it exercises is_fresh()/store round-trip logic by
        // going through save/load directly rather than verify() — verify()
        // itself is already proven against real Node output above.
        let json = serde_json::to_string(&payload).unwrap();
        let _ = json; // documents intent; not signed here, see note above
        assert!(is_fresh(&payload, 0));
        // Round-trip the store itself with an (unsigned-for-this-test)
        // response shape to confirm save/load/file-format plumbing works.
        let resp = SignedLicenseResponse {
            payload_json: serde_json::to_string(&payload).unwrap(),
            signature: "not-checked-in-this-test".into(),
        };
        store.save(&resp).unwrap();
        let loaded = store.load().unwrap();
        assert_eq!(loaded.payload_json, resp.payload_json);
    }

    #[test]
    fn a_payload_older_than_the_grace_period_is_not_fresh() {
        let stale = LicensePayload {
            user_id: "1".into(),
            is_pro: true,
            plan: None,
            product: Some(PRODUCT_ID.into()),
            issued_at: now_secs().saturating_sub(GRACE_PERIOD_SECS + 3600),
            expires_at: None,
        };
        assert!(!is_fresh(&stale, 0));
    }

    #[test]
    fn signed_issue_times_respect_clock_skew_and_expiry_boundaries() {
        let now = 1_800_000_000;
        let mut payload = LicensePayload {
            user_id: "clock-test".into(),
            is_pro: true,
            plan: Some("monthly".into()),
            product: Some(PRODUCT_ID.into()),
            issued_at: now,
            expires_at: None,
        };
        assert!(is_fresh_at(&payload, now));
        assert!(is_fresh_at(&payload, now + GRACE_PERIOD_SECS));
        assert!(!is_fresh_at(&payload, now + GRACE_PERIOD_SECS + 1));
        payload.issued_at = now + MAX_CLOCK_SKEW_SECS;
        assert!(is_fresh_at(&payload, now));
        payload.issued_at += 1;
        assert!(!is_fresh_at(&payload, now));
        payload.issued_at = u64::MAX;
        assert!(!is_fresh_at(&payload, now));
        // Regression: a PC two hours behind the server (a hand-set time zone)
        // must still accept a licence signed a moment ago.
        payload.issued_at = now + 2 * 60 * 60;
        assert!(is_fresh_at(&payload, now));
        payload.issued_at = 0;
        assert!(!is_fresh_at(&payload, now));
    }

    #[test]
    fn no_cached_file_means_not_pro_rather_than_a_crash() {
        let dir = temp_dir("missing");
        let store = LicenseStore::new(dir);
        assert!(!store.is_pro_and_fresh());
    }

    #[test]
    fn paid_period_cuts_off_offline_access_and_renewal_requires_a_new_payload() {
        let now = 1_800_000_000;
        for plan in ["monthly", "annual"] {
            let mut payload = LicensePayload {
                user_id: "expiry-test".into(),
                is_pro: true,
                plan: Some(plan.into()),
                product: Some(PRODUCT_ID.into()),
                issued_at: now,
                expires_at: Some(now + 60),
            };
            assert!(is_fresh_at(&payload, now + 59));
            // Cancellation and unsuccessful renewal do not extend the paid period.
            assert!(!is_fresh_at(&payload, now + 60));
            assert!(!is_fresh_at(&payload, now + 61));
            payload.issued_at = now + 60;
            payload.expires_at = Some(now + 86400);
            assert!(is_fresh_at(&payload, now + 61));
            payload.expires_at = Some(now + GRACE_PERIOD_SECS * 2);
            assert!(!is_fresh_at(&payload, now + 61 + GRACE_PERIOD_SECS));
        }
    }

    #[test]
    fn signed_expiry_is_verified_and_legacy_caches_remain_bounded() {
        let now = now_secs();
        let mut payload = LicensePayload {
            user_id: "signed-expiry".into(),
            is_pro: true,
            plan: Some("annual".into()),
            product: Some(PRODUCT_ID.into()),
            issued_at: now,
            expires_at: Some(now - 1),
        };
        let (payload_json, signature, public_key) = sign_test_payload(&payload);
        let response = SignedLicenseResponse {
            payload_json,
            signature,
        };
        assert_eq!(verified_fresh_response(&response, &public_key), None);
        let tampered = response
            .payload_json
            .replace(&(now - 1).to_string(), &(now + 86400).to_string());
        assert_eq!(
            verify_with_public_key(&tampered, &response.signature, &public_key),
            Err(VerifyError::SignatureInvalid)
        );
        // Caches without a cutoff still need periodic refresh; Lifetime gets a month.
        payload.expires_at = None;
        payload.plan = Some("monthly".into());
        assert!(is_fresh_at(&payload, now));
        assert!(!is_fresh_at(&payload, now + GRACE_PERIOD_SECS + 1));
        payload.plan = Some("lifetime".into());
        assert!(is_fresh_at(&payload, now + LIFETIME_GRACE_PERIOD_SECS));
        assert!(!is_fresh_at(&payload, now + LIFETIME_GRACE_PERIOD_SECS + 1));
        payload.is_pro = false;
        assert!(!is_fresh_at(&payload, now + GRACE_PERIOD_SECS + 1));
    }

    /// After `delete`, a previously fresh cache must no longer read as Pro —
    /// this is what stops a still-valid cache from one account granting Pro
    /// to whoever logs in next on the same machine.
    #[test]
    fn deleting_the_cache_makes_is_pro_and_fresh_false_again() {
        let dir = temp_dir("delete");
        let store = LicenseStore::new(dir);
        let resp = SignedLicenseResponse {
            payload_json: serde_json::to_string(&LicensePayload {
                user_id: "1".into(),
                is_pro: true,
                plan: Some("monthly".into()),
                product: Some(PRODUCT_ID.into()),
                issued_at: now_secs(),
                expires_at: None,
            })
            .unwrap(),
            signature: "irrelevant-for-this-test".into(),
        };
        store.save(&resp).unwrap();
        assert!(
            store.load().is_some(),
            "precondition: something must be cached"
        );

        store.delete().unwrap();
        assert!(store.load().is_none());
        // delete() on an already-empty store must not error.
        store.delete().unwrap();
    }

    #[test]
    fn a_corrupt_cache_file_means_not_pro_rather_than_a_crash() {
        let dir = temp_dir("corrupt");
        let store = LicenseStore::new(dir.clone());
        std::fs::write(dir.join("license.json"), "not json at all").unwrap();
        assert!(!store.is_pro_and_fresh());
    }

    #[test]
    fn a_licence_bound_to_another_pc_unlocks_nothing_here() {
        let here = hash_guid("1B4E28BA-2FA1-11D2-883F-0016D3CCA427");
        assert_eq!(here, hash_guid(" 1b4e28ba-2fa1-11d2-883f-0016d3cca427 "));
        assert_eq!(here.len(), 64);
        let payload = |hash: Option<&str>| {
            let mut value = serde_json::json!({"userId":"42","isPro":true,"plan":"lifetime","product":"pctweaker","issuedAt":1});
            if let Some(hash) = hash {
                value["deviceHash"] = serde_json::Value::String(hash.into());
            }
            value.to_string()
        };
        assert!(bound_to(&payload(Some(&here)), Some(&here)));
        assert!(
            !bound_to(&payload(Some(&hash_guid("another-pc"))), Some(&here)),
            "a copied licence.json"
        );
        assert!(
            !bound_to(&payload(Some(&here)), None),
            "a PC whose identity cannot be read"
        );
        // Codex 1 / Argon 3: the server signs a licence without deviceHash for any
        // request that omits X-Device-Hash; on a PC with an identity it unlocks nothing.
        assert!(
            !bound_to(&payload(None), Some(&here)),
            "an unbound licence on a PC that has an identity"
        );
        assert!(
            bound_to(&payload(None), None),
            "a PC whose identity cannot be read keeps the unbound licence it was issued"
        );
        assert!(!bound_to("not json", Some(&here)));
    }

    /// Codex 5: rolling Windows time back across a restart must not revive a
    /// licence the app has already seen expire.
    #[test]
    fn a_clock_moved_back_across_a_restart_does_not_extend_a_cached_licence() {
        let issued = 1_800_000_000;
        let payload = LicensePayload {
            user_id: "rollback".into(),
            is_pro: true,
            plan: Some("monthly".into()),
            product: Some(PRODUCT_ID.into()),
            issued_at: issued,
            expires_at: Some(issued + 3600),
        };
        // The app ran past the subscription's end and saved that time (seenAt).
        let seen = issued + 7200;
        let rolled_back = issued + 60;
        assert!(
            is_fresh_at(&payload, rolled_back),
            "the freshness check alone believes the moved-back clock"
        );
        assert!(!fresh_after_restart(&payload, Some(seen), rolled_back));
        // Not locked out: a PC two hours behind the server, before the end.
        assert!(fresh_after_restart(
            &payload,
            Some(issued),
            issued - 2 * 3600
        ));
        assert!(fresh_after_restart(&payload, None, issued + 59));
        // A damaged or edited seenAt is capped at this licence's own window.
        let lifetime = LicensePayload {
            plan: Some("lifetime".into()),
            expires_at: None,
            ..payload.clone()
        };
        assert!(fresh_after_restart(&lifetime, Some(u64::MAX), issued));
        assert!(!fresh_after_restart(&payload, Some(u64::MAX), issued));
    }

    #[test]
    fn the_cache_keeps_its_proven_time_and_when_the_licence_arrived() {
        let dir = temp_dir("seen-at");
        let store = LicenseStore::new(dir.clone());
        let response = SignedLicenseResponse {
            payload_json: "{}".into(),
            signature: "fixture".into(),
        };
        store
            .write(&CachedLicense {
                response: response.clone(),
                seen_at: Some(1_800_000_123),
                received_at: Some(1_800_000_000),
            })
            .unwrap();
        let text = std::fs::read_to_string(dir.join("license.json")).unwrap();
        assert!(text.contains("\"seenAt\": 1800000123"), "{text}");
        assert!(text.contains("\"receivedAt\": 1800000000"), "{text}");
        let loaded = store.load_cached().unwrap();
        assert_eq!(loaded.seen_at, Some(1_800_000_123));
        assert_eq!(loaded.received_at, Some(1_800_000_000));
        // A licence saved now records this PC's clock as it arrived.
        store.save(&response).unwrap();
        let saved = store.load_cached().unwrap();
        assert!(saved
            .received_at
            .is_some_and(|at| at.abs_diff(now_secs()) < 60));
    }

    /// An upgrade neither takes Pro away nor gives an old cache more time: a
    /// file without `receivedAt` gets no offset, which is this PC's clock and
    /// the same floor, exactly as before. Its next licence brings the offset.
    #[test]
    fn upgrading_from_each_older_cache_shape() {
        let dir = temp_dir("shapes");
        let store = LicenseStore::new(dir.clone());
        let resp: SignedLicenseResponse = serde_json::from_str(REAL_NODE_SIGNED_RESPONSE).unwrap();
        let payload = verify(&resp.payload_json, &resp.signature).unwrap();
        let file = |extra: serde_json::Value| {
            let mut value: serde_json::Value =
                serde_json::from_str(REAL_NODE_SIGNED_RESPONSE).unwrap();
            value
                .as_object_mut()
                .unwrap()
                .extend(extra.as_object().unwrap().clone());
            std::fs::write(dir.join("license.json"), value.to_string()).unwrap();
            let cached = store.load_cached().unwrap();
            assert_eq!(cached.response.payload_json, resp.payload_json);
            (cached.seen_at, cached.received_at, cached.offset(&payload))
        };
        // 1.18.15 and earlier: the signed response alone.
        assert_eq!(file(serde_json::json!({})), (None, None, 0));
        // 1.18.16 to 1.20.0: plus seenAt.
        assert_eq!(
            file(serde_json::json!({ "seenAt": 1_787_100_000_u64 })),
            (Some(1_787_100_000), None, 0)
        );
        // The build of #175, never released: receivedAt alone.
        let received = payload.issued_at + 3600;
        assert_eq!(
            file(serde_json::json!({ "receivedAt": received })),
            (None, Some(received), -3600)
        );
    }

    /// The floor holds server time only: reading a clock corrected a day
    /// forward, and checking a licence on it, must not lift the floor with it.
    #[test]
    fn reading_the_corrected_clock_never_raises_the_floor() {
        let payload = LicensePayload {
            issued_at: now_secs(),
            expires_at: None,
            ..last_two_days()
        };
        let ahead = MAX_CLOCK_SKEW_SECS as i64;
        assert!(clock_now(ahead) + 5 >= now_secs() + MAX_CLOCK_SKEW_SECS);
        assert!(is_fresh(&payload, ahead));
        // No test shows this process a server time past the real one.
        assert!(trusted_now() <= now_secs() + 60);
    }

    const DAY: u64 = 24 * 60 * 60;
    /// The server's clock when the licence below was signed.
    const SIGNED: u64 = 1_800_000_000;

    /// A plan in its last two days, signed at `SIGNED`.
    fn last_two_days() -> LicensePayload {
        LicensePayload {
            user_id: "clock".into(),
            is_pro: true,
            plan: Some("monthly".into()),
            product: Some(PRODUCT_ID.into()),
            issued_at: SIGNED,
            expires_at: Some(SIGNED + 2 * DAY),
        }
    }

    /// One check on fixed clocks: this PC reads `wall` now and read `received`
    /// when the licence arrived; `floor` is the server time already proven (the
    /// signed issue time plus the time the app has run, or `seenAt`).
    fn pro_on(payload: &LicensePayload, wall: u64, received: u64, floor: u64) -> bool {
        let offset = clock_offset(payload.issued_at, received);
        is_fresh_at(payload, server_now(wall, offset, floor))
    }

    /// QA 15 Oct 2026: with the PC clock a day ahead, the last day of the trial
    /// or a billing period read as Free while the server said Pro.
    #[test]
    fn a_pc_a_day_ahead_keeps_pro_for_the_whole_licence() {
        let payload = last_two_days();
        let received = SIGNED + DAY;
        // The floor (server time) stays under the corrected clock all along.
        for run in [0, DAY, 2 * DAY - 1] {
            assert!(
                pro_on(&payload, received + run, received, SIGNED + run),
                "{run}"
            );
        }
        assert!(!pro_on(
            &payload,
            received + 2 * DAY,
            received,
            SIGNED + 2 * DAY
        ));
        // Before: this PC's own clock ended the plan a day early.
        assert!(!is_fresh_at(&payload, received + DAY));
    }

    #[test]
    fn a_pc_a_day_behind_keeps_pro_for_the_whole_licence_and_no_longer() {
        let payload = last_two_days();
        let received = SIGNED - DAY;
        for run in [0, DAY, 2 * DAY - 1] {
            assert!(
                pro_on(&payload, received + run, received, SIGNED + run),
                "{run}"
            );
        }
        // Offline after a restart, the floor from an earlier run: the plan
        // still ends on time, where this PC's own clock gave it a day more.
        assert!(!pro_on(&payload, received + 2 * DAY, received, SIGNED));
        assert!(is_fresh_at(&payload, received + 2 * DAY));
    }

    #[test]
    fn a_clock_set_back_after_receipt_still_expires_on_schedule() {
        let payload = last_two_days();
        let end = SIGNED + 2 * DAY;
        for received in [SIGNED - DAY, SIGNED, SIGNED + DAY] {
            let offset = clock_offset(SIGNED, received);
            // At the end of the plan, this PC's clock moved back a day and a half.
            let set_back = received + DAY / 2;
            assert!(
                is_fresh_at(&payload, server_now(set_back, offset, 0)),
                "the moved-back clock alone would keep Pro"
            );
            // While the app runs, the floor has reached the end...
            assert!(!pro_on(&payload, set_back, received, end));
            // ...and after a restart, seenAt has.
            assert!(!fresh_after_restart(
                &payload,
                Some(end),
                server_now(set_back, offset, end)
            ));
        }
    }

    #[test]
    fn a_clock_pushed_forward_after_receipt_gains_nothing() {
        let payload = last_two_days();
        // Five days forward a day in: the plan ends early on this PC, never late...
        assert!(!pro_on(&payload, SIGNED + 6 * DAY, SIGNED, SIGNED + DAY));
        // ...and the floor did not follow the clock, so setting it right gives
        // Pro back until the signed end, and not past it.
        assert!(pro_on(&payload, SIGNED + DAY, SIGNED, SIGNED + DAY));
        assert!(!pro_on(
            &payload,
            SIGNED + 2 * DAY,
            SIGNED,
            SIGNED + 2 * DAY
        ));
    }

    #[test]
    fn a_restart_with_seen_at_and_an_offset_gives_the_right_verdict() {
        let payload = last_two_days();
        let received = SIGNED + DAY;
        let offset = clock_offset(SIGNED, received);
        let after_restart = |wall: u64, seen: u64| {
            let floor = seen.min(offline_window_end(&payload));
            fresh_after_restart(&payload, Some(seen), server_now(wall, offset, floor))
        };
        // A day in, last seen an hour earlier: still Pro.
        assert!(after_restart(received + DAY, SIGNED + DAY - 3600));
        // The app saw the end, then the clock went back a day: over.
        assert!(!after_restart(received + DAY, SIGNED + 2 * DAY));
        // Past the end on the corrected clock, whatever seenAt says.
        assert!(!after_restart(received + 2 * DAY, SIGNED));
    }

    /// `receivedAt` is not signed: an offset out of range is bounded to the
    /// skew allowance, so an edited file buys a day at most, never a month.
    #[test]
    fn an_out_of_range_offset_is_bounded_to_a_day() {
        let skew = MAX_CLOCK_SKEW_SECS as i64;
        assert_eq!(clock_offset(SIGNED, SIGNED + 30 * DAY), -skew);
        assert_eq!(clock_offset(SIGNED, 0), skew);
        assert_eq!(clock_offset(SIGNED, u64::MAX), -skew);
        assert_eq!(clock_offset(u64::MAX, 0), skew);
        // A receivedAt edited to a month ahead, offline, seenAt removed: the
        // plan runs at most a day past its signed end.
        let payload = last_two_days();
        let edited = SIGNED + 30 * DAY;
        assert!(pro_on(&payload, SIGNED + 3 * DAY - 1, edited, SIGNED));
        assert!(!pro_on(&payload, SIGNED + 3 * DAY, edited, SIGNED));
        assert!(!pro_on(&payload, SIGNED + 30 * DAY, edited, SIGNED));
    }

    #[cfg(windows)]
    #[test]
    fn this_pc_has_a_stable_licence_identity() {
        let first = device_hash();
        assert!(first.as_deref().is_some_and(|h| h.len() == 64));
        assert_eq!(first, device_hash());
    }
}
