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

use std::path::PathBuf;

/// Cap on the stored file. The UI encodes a 128px JPEG at q=0.85, which lands
/// around 8 KB; a megabyte is far above any legitimate result and still small
/// enough that a corrupt or hostile value cannot fill the disk.
const MAX_BYTES: usize = 1024 * 1024;

fn avatar_path(app_data_dir: &std::path::Path) -> PathBuf {
    app_data_dir.join("avatar.jpg")
}

/// Writes the photo. `data_url` is the same `data:image/jpeg;base64,...`
/// string the encoder already produces, so the frontend keeps one format
/// everywhere and only the storage location changed.
pub fn save(app_data_dir: &std::path::Path, data_url: &str) -> Result<(), String> {
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
    std::fs::write(avatar_path(app_data_dir), &bytes)
        .map_err(|e| format!("could not save the photo: {}", e))
}

/// Reads the photo back as a data URL, or `None` when none is stored. A
/// missing file is the ordinary "no photo set" case, not an error.
pub fn read(app_data_dir: &std::path::Path) -> Option<String> {
    let bytes = std::fs::read(avatar_path(app_data_dir)).ok()?;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return None;
    }
    Some(format!("data:image/jpeg;base64,{}", encode_base64(&bytes)))
}

/// Removes the photo. Succeeds when there was nothing to remove: "make sure
/// there is no photo" is the caller's intent, and it is already satisfied.
pub fn clear(app_data_dir: &std::path::Path) -> Result<(), String> {
    match std::fs::remove_file(avatar_path(app_data_dir)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("could not remove the photo: {}", e)),
    }
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
        assert!(read(&dir).is_none());
    }

    #[test]
    fn saving_then_reading_returns_the_same_data_url() {
        let dir = std::env::temp_dir().join("pctweaker-avatar-roundtrip-test");
        let _ = std::fs::remove_dir_all(&dir);
        let url = format!("data:image/jpeg;base64,{}", encode_base64(&[1, 2, 3, 4, 5]));
        save(&dir, &url).expect("save failed");
        assert_eq!(read(&dir).as_deref(), Some(url.as_str()));
        clear(&dir).expect("clear failed");
        assert!(read(&dir).is_none(), "clear left the photo behind");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn clearing_a_photo_that_was_never_saved_succeeds() {
        let dir = std::env::temp_dir().join("pctweaker-avatar-clear-test");
        let _ = std::fs::remove_dir_all(&dir);
        assert!(clear(&dir).is_ok());
    }

    #[test]
    fn a_value_that_is_not_a_data_url_is_refused() {
        let dir = std::env::temp_dir().join("pctweaker-avatar-bad-test");
        assert!(save(&dir, "https://example.com/photo.jpg").is_err());
    }
}
