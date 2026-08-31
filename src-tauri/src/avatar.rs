//! The profile photo, stored as a file next to the app's other state.
//!
//! ## Why this is not localStorage any more
//!
//! It used to live under the `pc-tweaker-avatar` key in the WebView2
//! localStorage, which lost people's photos in three separate ways:
//!
//! - **Quota eviction.** The origin shares one 5 MB budget with the driver
//!   audit cache and the session keys. Chromium may discard a whole
//!   non-persistent origin under disk pressure — the exact condition a PC
//!   optimizer gets used in — and the write path swallowed `QuotaExceededError`
//!   silently, so a photo could fail to save with no visible sign.
//! - **The app's own cleaner.** The LevelDB behind localStorage is a pile of
//!   `.log`/`.ldb` files, which is precisely what the duplicate scanner hunts
//!   for. Pointing a scan at the user profile could recycle this app's storage
//!   engine. (That hole is now closed separately in `cleanup.rs`, but the
//!   photo should not have depended on that fix.)
//! - **Two install channels, two stores.** The MSIX build runs under
//!   AppContainer redirection, so it gets a different localStorage than the
//!   NSIS `.exe` build. Installing from the Store made an existing photo look
//!   deleted when it was still sitting in the other profile.
//!
//! A plain file in `app_data_dir()` has none of those failure modes: it is the
//! same directory the rollback store already trusts with the data needed to
//! undo every tweak, it is not subject to a browser quota, and it is now
//! protected from the cleaner by name.
//!
//! The photo still never leaves the machine — there is deliberately no avatar
//! endpoint on the backend.
//!
//! ## One file per account, not one per machine
//!
//! There used to be a single `avatar.jpg`, which meant the photo belonged to
//! the computer rather than to whoever was signed in. Sign out, register a
//! second account, sign in, and the new account wore the previous person's
//! face. On a shared machine that is someone else's photograph shown under
//! someone else's name.
//!
//! Each account gets its own file instead, named from a hash of its address.
//! The hash is not a secret — anything on this disk is readable by anyone
//! who has the disk — it just keeps email addresses out of directory
//! listings, and gives a filename that is valid on every filesystem.

use std::path::PathBuf;

/// Cap on the stored file. The UI encodes a 128px JPEG at q=0.85, which lands
/// around 8 KB; a megabyte is far above any legitimate result and still small
/// enough that a corrupt or hostile value cannot fill the disk.
const MAX_BYTES: usize = 1024 * 1024;

/// The machine-wide file every version before this one wrote to.
fn legacy_path(app_data_dir: &std::path::Path) -> PathBuf {
    app_data_dir.join("avatar.jpg")
}

/// A short, stable, filesystem-safe name for an account.
///
/// FNV-1a, chosen because it needs no dependency and this is a naming scheme
/// rather than a security boundary. Collisions between two addresses would
/// show one account the other's photo, so it is worth being explicit about
/// the odds: with a 64-bit digest, a machine would need on the order of a
/// billion accounts before that became likely, and these are the accounts
/// signed in on one desktop.
///
/// The address is trimmed and lowercased first, so the same account reached
/// as `Name@Example.com` and `name@example.com` keeps one photo.
fn account_key(email: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in email.trim().to_ascii_lowercase().bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x1000_0000_01b3);
    }
    format!("{:016x}", hash)
}

fn avatar_path(app_data_dir: &std::path::Path, email: &str) -> PathBuf {
    app_data_dir.join(format!("avatar-{}.jpg", account_key(email)))
}

/// Writes the photo. `data_url` is the same `data:image/jpeg;base64,...`
/// string the encoder already produces, so the frontend keeps one format
/// everywhere and only the storage location changed.
pub fn save(app_data_dir: &std::path::Path, email: &str, data_url: &str) -> Result<(), String> {
    let base64 = data_url
        .split_once(";base64,")
        .map(|(_, b)| b)
        .ok_or_else(|| "not a base64 data URL".to_string())?;

    let bytes = decode_base64(base64)?;
    if bytes.len() > MAX_BYTES {
        return Err(format!(
            "photo is {} KB, over the {} KB limit",
            bytes.len() / 1024,
            MAX_BYTES / 1024
        ));
    }

    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("could not create the app data folder: {}", e))?;
    std::fs::write(avatar_path(app_data_dir, email), &bytes)
        .map_err(|e| format!("could not save the photo: {}", e))
}

/// Reads the photo back as a data URL, or `None` when none is stored. A
/// missing file is the ordinary "no photo set" case, not an error.
pub fn read(app_data_dir: &std::path::Path, email: &str) -> Option<String> {
    let bytes = std::fs::read(avatar_path(app_data_dir, email)).ok()?;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return None;
    }
    Some(format!("data:image/jpeg;base64,{}", encode_base64(&bytes)))
}

/// Removes the photo. Succeeds when there was nothing to remove: "make sure
/// there is no photo" is the caller's intent, and it is already satisfied.
pub fn clear(app_data_dir: &std::path::Path, email: &str) -> Result<(), String> {
    match std::fs::remove_file(avatar_path(app_data_dir, email)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("could not remove the photo: {}", e)),
    }
}

/// Hands the old machine-wide photo to the account that is signed in.
///
/// Called on startup, and only then: the app is running as whoever was using
/// it when the update landed, so that account is the photo's owner. Doing
/// this at sign-in instead would hand it to whoever signed in next, which is
/// the bug this whole change exists to fix.
///
/// A no-op once the account already has its own photo, so it cannot overwrite
/// a newer one, and the legacy file is removed either way.
pub fn adopt_legacy(app_data_dir: &std::path::Path, email: &str) {
    let legacy = legacy_path(app_data_dir);
    if !legacy.exists() {
        return;
    }
    let owned = avatar_path(app_data_dir, email);
    if !owned.exists() {
        let _ = std::fs::rename(&legacy, &owned);
    }
    let _ = std::fs::remove_file(&legacy);
}

/// Removes the old machine-wide photo without giving it to anyone.
///
/// Signing out is the moment the next person may not be the last one, so a
/// leftover legacy file must not survive to be adopted by them.
pub fn discard_legacy(app_data_dir: &std::path::Path) {
    let _ = std::fs::remove_file(legacy_path(app_data_dir));
}

const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_base64(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(ALPHABET[(n >> 18) as usize & 63] as char);
        out.push(ALPHABET[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

fn decode_base64(s: &str) -> Result<Vec<u8>, String> {
    let mut lookup = [255u8; 256];
    for (i, c) in ALPHABET.iter().enumerate() {
        lookup[*c as usize] = i as u8;
    }

    // Whitespace can survive a round trip through the webview; padding carries
    // no bits. Both are dropped rather than rejected.
    let clean: Vec<u8> = s
        .bytes()
        .filter(|b| !b.is_ascii_whitespace() && *b != b'=')
        .collect();

    let mut out = Vec::with_capacity(clean.len() / 4 * 3);
    for chunk in clean.chunks(4) {
        let mut n = 0u32;
        for (i, byte) in chunk.iter().enumerate() {
            let v = lookup[*byte as usize];
            if v == 255 {
                return Err("photo data is not valid base64".to_string());
            }
            n |= (v as u32) << (18 - 6 * i);
        }
        out.push((n >> 16) as u8);
        if chunk.len() > 2 {
            out.push((n >> 8) as u8);
        }
        if chunk.len() > 3 {
            out.push(n as u8);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_round_trips_including_both_padding_lengths() {
        // 3, 4 and 5 bytes exercise the no-padding, two-pad and one-pad cases,
        // which is where hand-written base64 usually goes wrong.
        for original in [
            vec![0xFF, 0xD8, 0xFF],
            vec![0xFF, 0xD8, 0xFF, 0xE0],
            vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00],
        ] {
            let encoded = encode_base64(&original);
            let decoded = decode_base64(&encoded).expect("decode failed");
            assert_eq!(decoded, original, "round trip failed for {:?}", original);
        }
    }

    #[test]
    fn a_missing_file_reads_as_no_photo_rather_than_an_error() {
        let dir = std::env::temp_dir().join("pctweaker-avatar-missing-test");
        let _ = std::fs::remove_dir_all(&dir);
        assert!(read(&dir, "a@example.com").is_none());
    }

    #[test]
    fn saving_then_reading_returns_the_same_data_url() {
        let dir = std::env::temp_dir().join("pctweaker-avatar-roundtrip-test");
        let _ = std::fs::remove_dir_all(&dir);
        let url = format!("data:image/jpeg;base64,{}", encode_base64(&[1, 2, 3, 4, 5]));
        save(&dir, "a@example.com", &url).expect("save failed");
        assert_eq!(read(&dir, "a@example.com").as_deref(), Some(url.as_str()));
        clear(&dir, "a@example.com").expect("clear failed");
        assert!(read(&dir, "a@example.com").is_none(), "clear left the photo behind");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn clearing_a_photo_that_was_never_saved_succeeds() {
        let dir = std::env::temp_dir().join("pctweaker-avatar-clear-test");
        let _ = std::fs::remove_dir_all(&dir);
        assert!(clear(&dir, "a@example.com").is_ok());
    }

    #[test]
    fn a_value_that_is_not_a_data_url_is_refused() {
        let dir = std::env::temp_dir().join("pctweaker-avatar-bad-test");
        assert!(save(&dir, "a@example.com", "https://example.com/photo.jpg").is_err());
    }

    fn url_of(bytes: &[u8]) -> String {
        format!("data:image/jpeg;base64,{}", encode_base64(bytes))
    }

    fn fresh(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pctweaker-avatar-{}", tag));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn one_account_never_sees_another_accounts_photo() {
        // The bug this file was reorganised for: sign out, register a second
        // account, sign in, and the new account wore the first one's face.
        let dir = fresh("two-accounts");
        let first = url_of(&[1, 2, 3]);
        save(&dir, "first@example.com", &first).expect("save failed");
        assert!(
            read(&dir, "second@example.com").is_none(),
            "a brand new account inherited someone else's photo"
        );
        assert_eq!(read(&dir, "first@example.com").as_deref(), Some(first.as_str()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn removing_one_accounts_photo_leaves_the_others_alone() {
        let dir = fresh("clear-one");
        let kept = url_of(&[9, 9, 9]);
        save(&dir, "a@example.com", &url_of(&[1])).expect("save failed");
        save(&dir, "b@example.com", &kept).expect("save failed");
        clear(&dir, "a@example.com").expect("clear failed");
        assert!(read(&dir, "a@example.com").is_none());
        assert_eq!(read(&dir, "b@example.com").as_deref(), Some(kept.as_str()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn an_address_is_matched_regardless_of_case_or_stray_spaces() {
        // The sign-in form and the stored session can disagree on both, and
        // a photo that vanishes because of a capital letter reads as lost.
        let dir = fresh("case");
        let url = url_of(&[4, 5, 6]);
        save(&dir, "Name@Example.com", &url).expect("save failed");
        assert_eq!(read(&dir, " name@example.com ").as_deref(), Some(url.as_str()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_old_machine_wide_photo_goes_to_whoever_is_signed_in() {
        let dir = fresh("adopt");
        std::fs::create_dir_all(&dir).unwrap();
        let bytes = [7u8, 7, 7];
        std::fs::write(legacy_path(&dir), bytes).unwrap();
        adopt_legacy(&dir, "owner@example.com");
        assert_eq!(read(&dir, "owner@example.com").as_deref(), Some(url_of(&bytes).as_str()));
        assert!(!legacy_path(&dir).exists(), "the shared file survived the migration");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn adopting_never_overwrites_a_photo_the_account_already_has() {
        let dir = fresh("adopt-keep");
        let mine = url_of(&[1, 1, 1]);
        save(&dir, "owner@example.com", &mine).expect("save failed");
        std::fs::write(legacy_path(&dir), [2u8, 2, 2]).unwrap();
        adopt_legacy(&dir, "owner@example.com");
        assert_eq!(read(&dir, "owner@example.com").as_deref(), Some(mine.as_str()));
        assert!(!legacy_path(&dir).exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn signing_out_destroys_the_old_shared_photo() {
        // Otherwise it survives to be adopted by the next person to sign in,
        // which is exactly the leak being fixed.
        let dir = fresh("discard");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(legacy_path(&dir), [3u8, 3, 3]).unwrap();
        discard_legacy(&dir);
        assert!(!legacy_path(&dir).exists());
        adopt_legacy(&dir, "next@example.com");
        assert!(read(&dir, "next@example.com").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn different_addresses_get_different_files() {
        assert_ne!(account_key("a@example.com"), account_key("b@example.com"));
        assert_eq!(account_key("a@example.com"), account_key("A@Example.com"));
        assert_eq!(account_key("x@y.z").len(), 16);
    }
}
