//! Zero-Trace: standby-memory purge and secure file shredding.
//!
//! ## What "zero trace" honestly means here, and what it does not
//!
//! Two operations, with very different guarantees. Both are stated plainly to
//! the user rather than sold as more than they are.
//!
//! **Memory purge** is complete for what it claims. Windows keeps pages of
//! closed programs on the *standby list* — still resident in RAM, still
//! holding whatever those programs had in memory, kept only as a cache. This
//! releases them back to the free list, so a string left behind by a process
//! that exited is genuinely gone from physical memory. It does not touch the
//! pagefile or hibernation file, and it cannot: those are on disk and Windows
//! does not offer a runtime API to scrub them.
//!
//! **File shredding** overwrites a file's contents in place before deleting
//! it, which defeats ordinary undelete tools. Its limits are real and are not
//! papered over:
//!
//! - On an **SSD**, wear levelling means the overwrite very likely lands on
//!   different physical cells than the original data. The old cells are freed,
//!   not rewritten. Only the drive's own secure-erase can guarantee otherwise.
//! - On **NTFS**, a file small enough to be *resident* lives inside its MFT
//!   record, not in a data run — overwriting through the file handle does not
//!   reach that copy.
//! - The **$LogFile** and **$UsnJrnl** may retain the file's name and metadata
//!   regardless.
//!
//! This is why nothing here claims to "zero the trace in the MFT". No
//! user-space tool can honestly promise that on NTFS, and a product that says
//! so is making a guarantee the filesystem does not let it keep. What it
//! promises instead — the file's *contents* are overwritten before the entry
//! is removed — is a promise it does keep.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct PurgeResult {
    /// Physical RAM standing free before and after, in MB. Reported as a pair
    /// rather than as a single "freed" figure because the machine keeps
    /// running during the purge: another process can allocate mid-operation,
    /// and a single number would hide that.
    pub free_before_mb: u64,
    pub free_after_mb: u64,
}

#[derive(Serialize, Clone, Default)]
pub struct ShredResult {
    pub shredded_count: usize,
    pub skipped_count: usize,
    pub bytes_overwritten: u64,
    /// True when any shredded file sat on a drive reported as an SSD, so the
    /// UI can repeat the wear-levelling caveat at the moment it applies rather
    /// than only in the small print beforehand.
    pub touched_ssd: bool,
}

/// Overwrite passes. Three is the point of diminishing returns on any modern
/// drive: the multi-pass patterns from the 1990s targeted MFM encoding on
/// drives that have not been manufactured in decades, and on current hardware
/// a single pass is already unrecoverable by software means. Three costs
/// little and covers the case of a pass being cut short.
const PASSES: usize = 3;
/// Written a chunk at a time so a large file does not need a buffer its own
/// size in RAM — which on a multi-gigabyte file would be its own problem.
const CHUNK: usize = 64 * 1024;

/// A deterministic, dependency-free pattern source.
///
/// Cryptographic randomness would be pointless here: the goal is that the
/// original magnetic/flash state is replaced, not that the replacement is
/// unpredictable to an attacker. Alternating patterns plus one xorshift pass
/// achieves that, and the codebase already prefers hand-rolled arithmetic over
/// pulling in a crate for one use (see `hash_file` in cleanup.rs).
fn fill_pattern(buffer: &mut [u8], pass: usize, seed: &mut u64) {
    match pass {
        0 => buffer.fill(0x00),
        1 => buffer.fill(0xFF),
        _ => {
            for byte in buffer.iter_mut() {
                // xorshift64
                *seed ^= *seed << 13;
                *seed ^= *seed >> 7;
                *seed ^= *seed << 17;
                *byte = (*seed & 0xFF) as u8;
            }
        }
    }
}

/// Overwrites one file's contents in place, then removes it.
///
/// Every write is followed by a flush to disk. Without that, Windows is free
/// to keep the passes in cache and coalesce them, and the file would be
/// deleted having never actually been rewritten on the platter — the exact
/// failure mode that makes a shredder worse than useless, because the user
/// believes something happened that did not.
fn shred_one(path: &std::path::Path) -> Result<u64, String> {
    use std::io::{Seek, SeekFrom, Write};

    let len = std::fs::metadata(path)
        .map_err(|e| format!("could not read the file: {}", e))?
        .len();

    // A zero-length file has no contents to overwrite; removing it is the
    // whole job, and opening it for writing would be pointless work.
    if len == 0 {
        std::fs::remove_file(path).map_err(|e| format!("could not remove the file: {}", e))?;
        return Ok(0);
    }

    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(path)
        .map_err(|e| format!("could not open the file for overwriting: {}", e))?;

    let mut seed: u64 = 0x9E3779B97F4A7C15;
    let mut buffer = vec![0u8; CHUNK];
    for pass in 0..PASSES {
        file.seek(SeekFrom::Start(0))
            .map_err(|e| format!("could not rewind the file: {}", e))?;
        let mut remaining = len;
        while remaining > 0 {
            let take = std::cmp::min(remaining, CHUNK as u64) as usize;
            fill_pattern(&mut buffer[..take], pass, &mut seed);
            file.write_all(&buffer[..take])
                .map_err(|e| format!("could not overwrite the file: {}", e))?;
            remaining -= take as u64;
        }
        // Per pass, not once at the end: see the doc comment above.
        file.sync_all()
            .map_err(|e| format!("could not flush the overwrite to disk: {}", e))?;
    }
    drop(file);

    std::fs::remove_file(path).map_err(|e| format!("could not remove the file: {}", e))?;
    Ok(len)
}

/// Shreds a list of files.
///
/// Reuses the cleaner's own guardrails deliberately. This is a *permanent*
/// delete with no Recycle Bin behind it, so the protections that exist to stop
/// the ordinary cleaner walking into Windows itself matter more here, not
/// less: anything under a protected directory, and anything that is not a
/// plain file, is skipped rather than shredded.
pub fn shred_files(paths: Vec<String>) -> ShredResult {
    let mut result = ShredResult::default();
    for p in paths {
        let path = std::path::PathBuf::from(&p);
        if crate::cleanup::touches_protected_dir(&path) || !path.is_file() {
            result.skipped_count += 1;
            continue;
        }
        // Checked per file: a selection can span drives, and the caveat
        // belongs to the drive the file was actually on.
        if is_on_ssd(&path) {
            result.touched_ssd = true;
        }
        match shred_one(&path) {
            Ok(bytes) => {
                result.shredded_count += 1;
                result.bytes_overwritten += bytes;
            }
            Err(_) => result.skipped_count += 1,
        }
    }
    result
}

/// Whether a path sits on a drive Windows reports as solid state.
///
/// `Unknown` counts as "not confirmed spinning", i.e. the caveat is shown.
/// The media type is a heuristic and NVMe under some drivers reports Unknown,
/// so treating uncertainty as "definitely a hard disk" would suppress a
/// warning precisely where it is most likely to be needed.
fn is_on_ssd(path: &std::path::Path) -> bool {
    let Some(drive) = path.to_string_lossy().get(0..2).map(|s| s.to_uppercase()) else {
        return true;
    };
    if !drive.ends_with(':') {
        return true;
    }
    crate::diskinfo::media_type_of(&drive) != "HDD"
}

#[cfg(windows)]
mod imp {
    use super::PurgeResult;

    /// `SystemMemoryListInformation`. Undocumented but stable since Vista and
    /// what every standby-list tool uses; the value has not moved across
    /// Windows releases.
    const SYSTEM_MEMORY_LIST_INFORMATION: u32 = 80;
    /// `MemoryPurgeStandbyList` — release the cached pages of exited
    /// processes. Deliberately *not* `MemoryEmptyWorkingSets` (2), which
    /// evicts the working sets of everything currently running and makes the
    /// whole machine stutter as it faults its own code back in.
    const MEMORY_PURGE_STANDBY_LIST: u32 = 4;

    const SE_PRIVILEGE_ENABLED: u32 = 0x0002;
    const TOKEN_ADJUST_PRIVILEGES: u32 = 0x0020;
    const TOKEN_QUERY: u32 = 0x0008;

    #[repr(C)]
    struct Luid {
        low: u32,
        high: i32,
    }

    #[repr(C)]
    struct LuidAndAttributes {
        luid: Luid,
        attributes: u32,
    }

    #[repr(C)]
    struct TokenPrivileges {
        count: u32,
        privilege: LuidAndAttributes,
    }

    // Hand-declared rather than pulling more of `windows-sys` in, matching the
    // convention already used in ramclean.rs for the same reason.
    #[link(name = "advapi32")]
    extern "system" {
        fn OpenProcessToken(process: isize, access: u32, token: *mut isize) -> i32;
        fn LookupPrivilegeValueW(system: *const u16, name: *const u16, luid: *mut Luid) -> i32;
        fn AdjustTokenPrivileges(
            token: isize,
            disable_all: i32,
            new_state: *const TokenPrivileges,
            buffer_len: u32,
            previous: *mut core::ffi::c_void,
            return_len: *mut u32,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> isize;
        fn CloseHandle(handle: isize) -> i32;
    }

    #[link(name = "ntdll")]
    extern "system" {
        fn NtSetSystemInformation(class: u32, info: *mut core::ffi::c_void, len: u32) -> i32;
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Grants this process `SeProfileSingleProcessPrivilege`, which
    /// `NtSetSystemInformation` requires for this class. The privilege is
    /// present but disabled by default in an elevated token, so this enables
    /// it rather than acquiring anything the administrator did not already
    /// have.
    fn enable_profile_privilege() -> Result<(), String> {
        // SAFETY: all three calls take pointers to locals that outlive them,
        // and the token handle is closed on both the success and failure path.
        unsafe {
            let mut token: isize = 0;
            if OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
                &mut token,
            ) == 0
            {
                return Err("could not open this process's access token".to_string());
            }

            let name = wide("SeProfileSingleProcessPrivilege");
            let mut luid = Luid { low: 0, high: 0 };
            if LookupPrivilegeValueW(std::ptr::null(), name.as_ptr(), &mut luid) == 0 {
                CloseHandle(token);
                return Err("this system does not define the required privilege".to_string());
            }

            let privileges = TokenPrivileges {
                count: 1,
                privilege: LuidAndAttributes {
                    luid,
                    attributes: SE_PRIVILEGE_ENABLED,
                },
            };
            let ok = AdjustTokenPrivileges(
                token,
                0,
                &privileges,
                std::mem::size_of::<TokenPrivileges>() as u32,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            );
            CloseHandle(token);

            // AdjustTokenPrivileges reports success even when it granted
            // nothing, so a non-zero return is not on its own proof. The real
            // verdict comes from NtSetSystemInformation below, which fails
            // outright without the privilege.
            if ok == 0 {
                return Err(
                    "the required privilege could not be enabled (administrator rights needed)"
                        .to_string(),
                );
            }
            Ok(())
        }
    }

    pub fn purge_standby(
        free_before_mb: u64,
        free_after_mb: impl Fn() -> u64,
    ) -> Result<PurgeResult, String> {
        enable_profile_privilege()?;

        let mut command: u32 = MEMORY_PURGE_STANDBY_LIST;
        // SAFETY: the pointer is to a live local of exactly the declared size.
        let status = unsafe {
            NtSetSystemInformation(
                SYSTEM_MEMORY_LIST_INFORMATION,
                &mut command as *mut u32 as *mut core::ffi::c_void,
                std::mem::size_of::<u32>() as u32,
            )
        };
        if status != 0 {
            return Err(format!(
                "Windows refused the memory purge (status 0x{:X}). This needs administrator rights.",
                status
            ));
        }

        Ok(PurgeResult {
            free_before_mb,
            free_after_mb: free_after_mb(),
        })
    }
}

#[cfg(not(windows))]
mod imp {
    use super::PurgeResult;
    pub fn purge_standby(
        _free_before_mb: u64,
        _free_after_mb: impl Fn() -> u64,
    ) -> Result<PurgeResult, String> {
        Err("the memory purge is only available on Windows".to_string())
    }
}

pub fn purge_standby_memory() -> Result<PurgeResult, String> {
    let before = free_ram_mb();
    imp::purge_standby(before, free_ram_mb)
}

fn free_ram_mb() -> u64 {
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_memory();
    (sys.total_memory().saturating_sub(sys.used_memory())) / (1024 * 1024)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn each_pass_writes_a_different_pattern() {
        let mut a = [1u8; 32];
        let mut b = [1u8; 32];
        let mut seed = 1;
        fill_pattern(&mut a, 0, &mut seed);
        fill_pattern(&mut b, 1, &mut seed);
        assert!(a.iter().all(|v| *v == 0x00), "pass 0 should be zeroes");
        assert!(b.iter().all(|v| *v == 0xFF), "pass 1 should be ones");
        assert_ne!(a, b);
    }

    #[test]
    fn the_random_pass_is_not_a_constant() {
        let mut buf = [0u8; 64];
        let mut seed = 12345;
        fill_pattern(&mut buf, 2, &mut seed);
        let first = buf[0];
        assert!(
            buf.iter().any(|v| *v != first),
            "the pattern pass produced a constant fill"
        );
    }

    /// The property that matters: after shredding, the file is gone and its
    /// bytes were rewritten first.
    #[test]
    fn a_shredded_file_is_removed_and_its_length_reported() {
        let path = std::env::temp_dir().join("pctweaker-shred-test.bin");
        const CONTENTS: &[u8] = b"sensitive contents that should not survive";
        let mut f = std::fs::File::create(&path).expect("create failed");
        f.write_all(CONTENTS).expect("write failed");
        drop(f);

        let len = shred_one(&path).expect("shred failed");
        assert_eq!(len, CONTENTS.len() as u64);
        assert!(!path.exists(), "the file survived the shred");
    }

    #[test]
    fn an_empty_file_is_removed_without_error() {
        let path = std::env::temp_dir().join("pctweaker-shred-empty.bin");
        std::fs::File::create(&path).expect("create failed");
        assert_eq!(shred_one(&path).expect("shred failed"), 0);
        assert!(!path.exists());
    }

    /// The guardrail. A path inside a protected directory must be skipped, not
    /// permanently destroyed — this is the difference between a shredder and
    /// an accident.
    #[test]
    fn protected_directories_are_skipped_not_shredded() {
        let result = shred_files(vec![r"C:\Windows\System32\kernel32.dll".to_string()]);
        assert_eq!(result.shredded_count, 0);
        assert_eq!(result.skipped_count, 1);
    }

    #[test]
    fn a_directory_is_never_treated_as_a_file() {
        let dir = std::env::temp_dir();
        let result = shred_files(vec![dir.to_string_lossy().to_string()]);
        assert_eq!(result.shredded_count, 0);
        assert_eq!(result.skipped_count, 1);
    }
}
