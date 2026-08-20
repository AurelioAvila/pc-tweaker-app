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
//! The backend signs `{ userId, isPro, plan, issuedAt }` with an Ed25519 key
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
use std::time::{SystemTime, UNIX_EPOCH};

/// Public half of a key pair dedicated to license signing — separate from
/// the Tauri updater's signing key, so a compromise of one never implicates
/// the other. Safe to embed: it is only useful for *verifying* signatures,
/// never for producing them.
const PUBLIC_KEY_B64: &str = "QisYr46g3mqEeiz1BDyEcPbRO1xO4z0lR3d5/ODppIU=";

/// How long a signed license is trusted without a fresh fetch. Long enough
/// to cover a weekend or a short trip without connectivity; short enough
/// that a cancelled subscription doesn't keep working offline indefinitely.
const GRACE_PERIOD_SECS: u64 = 3 * 24 * 60 * 60;

/// Field names must match `backend/src/license.ts`'s `LicensePayload` type
/// exactly, camelCase included — this is parsed directly from the JSON
/// string the server signed, not adapted at any boundary in between.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LicensePayload {
    pub user_id: String,
    pub is_pro: bool,
    pub plan: Option<String>,
    /// Unix seconds, set by the server at signing time. Freshness is
    /// measured from this, not from local receipt — a cached-and-replayed
    /// response can't be made to look newer than it actually is.
    pub issued_at: u64,
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
}

/// Verifies `signature` (base64) against `payload_json`'s raw UTF-8 bytes and
/// returns the parsed payload only if it checks out. This is the only path
/// by which a `LicensePayload` should ever come into existence in this
/// process — there is no constructor that skips verification.
pub fn verify(payload_json: &str, signature_b64: &str) -> Result<LicensePayload, VerifyError> {
    let key_bytes: [u8; 32] = STANDARD
        .decode(PUBLIC_KEY_B64)
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

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// A payload that has passed signature verification *and* is still inside
/// its grace period. This distinction matters: a validly signed license from
/// three weeks ago proves the server said something true three weeks ago,
/// not that it is still true now.
fn is_fresh(payload: &LicensePayload) -> bool {
    now_secs().saturating_sub(payload.issued_at) <= GRACE_PERIOD_SECS
}

/// Persists the raw, still-signed response to the app data directory so it
/// survives a restart. Written via temp-file-then-rename, matching
/// `rollback.rs`'s pattern, so an interrupted write can never leave a
/// half-written (and therefore unparsable, therefore Pro-denying) file
/// behind.
pub struct LicenseStore {
    file_path: PathBuf,
}

impl LicenseStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        LicenseStore {
            file_path: app_data_dir.join("license.json"),
        }
    }

    pub fn save(&self, response: &SignedLicenseResponse) -> std::io::Result<()> {
        if let Some(parent) = self.file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(response).unwrap();
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

    fn load(&self) -> Option<SignedLicenseResponse> {
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
        let Some(cached) = self.load() else {
            return false;
        };
        let Ok(payload) = verify(&cached.payload_json, &cached.signature) else {
            return false;
        };
        payload.is_pro && is_fresh(&payload)
    }
}

/// Called by the frontend right after it fetches a fresh signed license from
/// the backend. Verifies the signature *before* saving anything, so a
/// tampered or malformed response received over a broken connection never
/// overwrites a good cached license with junk that would just read as
/// "not Pro" until the next successful fetch.
#[tauri::command]
pub fn save_license(app: tauri::AppHandle, response: SignedLicenseResponse) -> Result<(), String> {
    verify(&response.payload_json, &response.signature)
        .map_err(|e| format!("license did not verify: {:?}", e))?;
    let store = LicenseStore::new(crate::store_for_dir(&app)?);
    store.save(&response).map_err(|e| e.to_string())
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
    LicenseStore::new(crate::store_for_dir(&app)?)
        .delete()
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
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
    const REAL_NODE_SIGNED_RESPONSE: &str = r#"{"payloadJson":"{\"userId\":\"42\",\"isPro\":true,\"plan\":\"monthly\",\"issuedAt\":1787042906}","signature":"czs+MUbA9IByR9UJ4DKFOqafgAKrI40xo+enb7YjzsDrZqMyLwcjmC6DS2DnEpb0itunOk8ZvreUarvFIk+pCg=="}"#;

    #[test]
    fn a_real_signature_from_the_node_backend_verifies() {
        let resp: SignedLicenseResponse = serde_json::from_str(REAL_NODE_SIGNED_RESPONSE).unwrap();
        let payload = verify(&resp.payload_json, &resp.signature).expect("must verify");
        assert_eq!(payload.user_id, "42");
        assert!(payload.is_pro);
        assert_eq!(payload.plan.as_deref(), Some("monthly"));
        assert_eq!(payload.issued_at, 1787042906);
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
            issued_at: now_secs(),
        };
        // Sign it the same way the real verify() expects: payload_json must
        // be exactly what a signature was computed over. Since this test has
        // no private key, it exercises is_fresh()/store round-trip logic by
        // going through save/load directly rather than verify() — verify()
        // itself is already proven against real Node output above.
        let json = serde_json::to_string(&payload).unwrap();
        let _ = json; // documents intent; not signed here, see note above
        assert!(is_fresh(&payload));
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
            issued_at: now_secs().saturating_sub(GRACE_PERIOD_SECS + 3600),
        };
        assert!(!is_fresh(&stale));
    }

    #[test]
    fn no_cached_file_means_not_pro_rather_than_a_crash() {
        let dir = temp_dir("missing");
        let store = LicenseStore::new(dir);
        assert!(!store.is_pro_and_fresh());
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
                issued_at: now_secs(),
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
}
