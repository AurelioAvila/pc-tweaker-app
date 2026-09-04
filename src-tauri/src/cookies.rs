//! Selective cookie cleaning: drop tracking cookies, keep the ones holding a
//! sign-in.
//!
//! `browsercleanup.rs` deliberately refused to open the browsers' SQLite
//! databases, on the grounds that deleting whole files the browser can
//! recreate is a smaller safety surface than editing them. That is still true
//! of *caches*, and this module leaves those alone. It is not true of
//! cookies: deleting the whole file signs the user out of everything they
//! own, which is why the existing button gets clicked once and then never
//! again. Reading the database is the only way to tell a session cookie from
//! an ad network's, so the trade is worth making here and only here.
//!
//! Two safety rules make it honest:
//!   * cleaning requires the browser to be closed (writing to a database a
//!     running Chromium holds open corrupts its next write), while *scanning*
//!     works on a copy and therefore works live;
//!   * the database is copied to the app folder before a single row is
//!     deleted, so the whole operation is one file-copy away from undone.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Sites whose cookies are kept unless the user says otherwise.
///
/// The bar for being on this list is "signing out of it would be experienced
/// as damage": account providers, things people stay logged into for months,
/// and payment sites. It is deliberately not a list of "good" companies —
/// the same firms' ad domains (doubleclick.net, google-analytics.com) are
/// absent and get cleaned like any other tracker.
pub const DEFAULT_WHITELIST: &[&str] = &[
    "google.com",
    "youtube.com",
    "gmail.com",
    "microsoft.com",
    "live.com",
    "office.com",
    "apple.com",
    "icloud.com",
    "github.com",
    "gitlab.com",
    "stackoverflow.com",
    "reddit.com",
    "discord.com",
    "twitch.tv",
    "x.com",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "whatsapp.com",
    "linkedin.com",
    "amazon.com",
    "amazon.it",
    "ebay.com",
    "paypal.com",
    "stripe.com",
    "netflix.com",
    "spotify.com",
    "steampowered.com",
    "epicgames.com",
    "dropbox.com",
    "notion.so",
    "slack.com",
    "zoom.us",
    "openai.com",
    "claude.ai",
    "anthropic.com",
    "cloudflare.com",
    "wikipedia.org",
];

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DomainCount {
    pub host: String,
    pub count: u32,
}

#[derive(Serialize, Clone, Debug)]
pub struct CookieScan {
    pub id: String,
    pub name: String,
    /// Cleaning is refused while true; the counts above are still accurate,
    /// because the scan reads a copy.
    pub running: bool,
    pub total: u32,
    pub protected: u32,
    pub removable: u32,
    /// The busiest removable hosts, so the user can see what is about to go
    /// instead of trusting a number.
    pub top_removable: Vec<DomainCount>,
}

#[derive(Serialize, Clone, Default, Debug)]
pub struct CookieCleanResult {
    pub removed: u32,
    pub kept: u32,
    pub cleaned: Vec<String>,
    /// Browsers left untouched because they were open.
    pub skipped_running: Vec<String>,
}

/// Whether a cookie host is covered by the whitelist.
///
/// Cookie hosts arrive in both shapes browsers store them in — `github.com`
/// and `.github.com` — and a whitelist entry has to cover the site's
/// subdomains, since the sign-in cookie usually lives on one
/// (`accounts.google.com`). Suffix matching is anchored on a dot so that
/// whitelisting `google.com` cannot be tricked into protecting
/// `notgoogle.com` or `google.com.tracker.net`.
pub fn host_is_protected(host: &str, whitelist: &[String]) -> bool {
    let host = host.trim().trim_start_matches('.').to_lowercase();
    if host.is_empty() {
        return false;
    }
    whitelist.iter().any(|entry| {
        let entry = entry.trim().trim_start_matches('.').to_lowercase();
        if entry.is_empty() {
            return false;
        }
        host == entry || host.ends_with(&format!(".{}", entry))
    })
}

fn whitelist_path(dir: &Path) -> PathBuf {
    dir.join("cookie_whitelist.json")
}

/// The user's whitelist, or the defaults when they have never edited it.
///
/// A missing file means "never customised" and yields the defaults; an
/// *empty* saved list is a deliberate choice and is honoured as-is, which is
/// why this cannot just treat "no entries" as "use defaults".
pub fn load_whitelist(dir: &Path) -> Vec<String> {
    match std::fs::read_to_string(whitelist_path(dir)) {
        Ok(json) => serde_json::from_str::<Vec<String>>(&json)
            .unwrap_or_else(|_| DEFAULT_WHITELIST.iter().map(|s| s.to_string()).collect()),
        Err(_) => DEFAULT_WHITELIST.iter().map(|s| s.to_string()).collect(),
    }
}

pub fn save_whitelist(dir: &Path, entries: &[String]) -> Result<(), String> {
    // Normalised on the way in so the same site typed three ways
    // (`GitHub.com`, `.github.com`, ` github.com `) is stored once.
    let mut cleaned: Vec<String> = entries
        .iter()
        .map(|e| e.trim().trim_start_matches('.').to_lowercase())
        .filter(|e| !e.is_empty() && e.contains('.'))
        .collect();
    cleaned.sort();
    cleaned.dedup();

    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&cleaned).map_err(|e| e.to_string())?;
    std::fs::write(whitelist_path(dir), json).map_err(|e| e.to_string())
}

/// Chromium and Firefox disagree on both the table and the column; everything
/// else about the operation is identical.
fn schema_for(browser_id: &str) -> (&'static str, &'static str) {
    if browser_id == "firefox" {
        ("moz_cookies", "host")
    } else {
        ("cookies", "host_key")
    }
}

fn backups_dir(dir: &Path) -> PathBuf {
    dir.join("cookie_backups")
}

#[cfg(windows)]
mod imp {
    use super::*;
    use rusqlite::Connection;

    /// How many backups to keep per browser. Enough to undo a mistake noticed
    /// a couple of cleans later, few enough that the app folder does not grow
    /// without bound.
    const KEEP_BACKUPS: usize = 3;

    /// The cookie database for a browser, or `None` when it has no profile.
    fn cookie_db(browser_id: &str) -> Option<PathBuf> {
        let (_, cookie_files) = crate::browsercleanup::paths_for(browser_id)?;
        cookie_files.into_iter().find(|p| p.is_file())
    }

    /// Copies the database somewhere private so it can be read while the
    /// browser holds the original open.
    ///
    /// The `-wal` and `-shm` companions come along because SQLite resolves
    /// them by the main file's name: leaving them behind would read a
    /// database missing every write still sitting in the write-ahead log,
    /// which is exactly the cookies from the current browsing session.
    fn copy_for_read(db: &Path) -> Result<(tempdir::TempHandle, PathBuf), String> {
        let handle = tempdir::TempHandle::new()?;
        let name = db
            .file_name()
            .ok_or_else(|| "cookie database has no file name".to_string())?;
        let target = handle.path().join(name);
        std::fs::copy(db, &target).map_err(|e| format!("could not read the cookies: {}", e))?;

        for suffix in ["-wal", "-shm"] {
            let mut companion = db.as_os_str().to_os_string();
            companion.push(suffix);
            let companion = PathBuf::from(companion);
            if companion.is_file() {
                let mut dest = target.as_os_str().to_os_string();
                dest.push(suffix);
                let _ = std::fs::copy(&companion, PathBuf::from(dest));
            }
        }
        Ok((handle, target))
    }

    /// Every cookie host in the database with how many cookies it has set.
    fn host_counts(db: &Path, browser_id: &str) -> Result<Vec<DomainCount>, String> {
        let (table, column) = schema_for(browser_id);
        let conn = Connection::open(db).map_err(|e| format!("could not open the cookies: {}", e))?;
        let sql = format!(
            "SELECT {col}, COUNT(*) FROM {tbl} GROUP BY {col}",
            col = column,
            tbl = table
        );
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("unexpected cookie database layout: {}", e))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DomainCount {
                    host: row.get::<_, String>(0)?,
                    count: row.get::<_, i64>(1)?.max(0) as u32,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    pub fn scan(whitelist: &[String]) -> Vec<CookieScan> {
        crate::browsercleanup::browser_list()
            .filter_map(|(id, name, process)| {
                let db = cookie_db(id)?;
                let (_guard, copy) = copy_for_read(&db).ok()?;
                let counts = host_counts(&copy, id).ok()?;

                let mut removable_hosts: Vec<DomainCount> = Vec::new();
                let (mut total, mut protected) = (0u32, 0u32);
                for entry in counts {
                    total += entry.count;
                    if host_is_protected(&entry.host, whitelist) {
                        protected += entry.count;
                    } else {
                        removable_hosts.push(entry);
                    }
                }
                removable_hosts.sort_by(|a, b| b.count.cmp(&a.count).then(a.host.cmp(&b.host)));
                let removable = total - protected;
                removable_hosts.truncate(20);

                Some(CookieScan {
                    id: id.to_string(),
                    name: name.to_string(),
                    running: crate::browsercleanup::is_running(process),
                    total,
                    protected,
                    removable,
                    top_removable: removable_hosts,
                })
            })
            .collect()
    }

    /// Copies the live database aside before anything is deleted, and prunes
    /// older copies for the same browser.
    fn back_up(dir: &Path, browser_id: &str, db: &Path) -> Result<PathBuf, String> {
        let backups = backups_dir(dir);
        std::fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let target = backups.join(format!("{}-{}.db", browser_id, stamp));
        std::fs::copy(db, &target)
            .map_err(|e| format!("could not back up the cookies before cleaning: {}", e))?;

        let prefix = format!("{}-", browser_id);
        let mut mine: Vec<PathBuf> = std::fs::read_dir(&backups)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n.starts_with(&prefix))
                            .unwrap_or(false)
                    })
                    .collect()
            })
            .unwrap_or_default();
        mine.sort();
        while mine.len() > KEEP_BACKUPS {
            let _ = std::fs::remove_file(mine.remove(0));
        }
        Ok(target)
    }

    pub fn clean(dir: &Path, browser_ids: &[String], whitelist: &[String]) -> CookieCleanResult {
        let mut result = CookieCleanResult::default();

        for (id, _name, process) in crate::browsercleanup::browser_list() {
            if !browser_ids.iter().any(|b| b == id) {
                continue;
            }
            // Checked here rather than trusting the scan the caller is holding:
            // the user may well have reopened the browser while reading it.
            if crate::browsercleanup::is_running(process) {
                result.skipped_running.push(id.to_string());
                continue;
            }
            let Some(db) = cookie_db(id) else { continue };
            if back_up(dir, id, &db).is_err() {
                // No backup means no delete. A cleaner that cannot be undone
                // is not the product this app claims to be.
                continue;
            }

            let Ok(counts) = host_counts(&db, id) else {
                continue;
            };
            let doomed: Vec<String> = counts
                .iter()
                .filter(|c| !host_is_protected(&c.host, whitelist))
                .map(|c| c.host.clone())
                .collect();
            let kept: u32 = counts
                .iter()
                .filter(|c| host_is_protected(&c.host, whitelist))
                .map(|c| c.count)
                .sum();
            if doomed.is_empty() {
                result.kept += kept;
                result.cleaned.push(id.to_string());
                continue;
            }

            match delete_hosts(&db, id, &doomed) {
                Ok(removed) => {
                    result.removed += removed;
                    result.kept += kept;
                    result.cleaned.push(id.to_string());
                }
                Err(_) => continue,
            }
        }
        result
    }

    /// Deletes by exact host, in chunks.
    ///
    /// The hosts are bound as parameters rather than interpolated: they come
    /// out of a file any website can write into, so building this SQL by
    /// string concatenation would let a crafted cookie domain rewrite the
    /// statement.
    fn delete_hosts(db: &Path, browser_id: &str, hosts: &[String]) -> Result<u32, String> {
        let (table, column) = schema_for(browser_id);
        let mut conn =
            Connection::open(db).map_err(|e| format!("could not open the cookies: {}", e))?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        let mut removed = 0u32;

        for chunk in hosts.chunks(400) {
            let placeholders = vec!["?"; chunk.len()].join(",");
            let sql = format!(
                "DELETE FROM {tbl} WHERE {col} IN ({ph})",
                tbl = table,
                col = column,
                ph = placeholders
            );
            let params = rusqlite::params_from_iter(chunk.iter());
            removed += tx.execute(&sql, params).map_err(|e| e.to_string())? as u32;
        }
        tx.commit().map_err(|e| e.to_string())?;
        // Without this the file keeps every deleted page as free space, so a
        // cleaner sold on "reclaim space" would reclaim none of it.
        let _ = conn.execute_batch("VACUUM");
        Ok(removed)
    }

    /// Puts back the most recent backup for one browser.
    pub fn restore(dir: &Path, browser_id: &str) -> Result<(), String> {
        for (id, _name, process) in crate::browsercleanup::browser_list() {
            if id != browser_id {
                continue;
            }
            if crate::browsercleanup::is_running(process) {
                return Err(format!("close {} first", id));
            }
            let db = cookie_db(id).ok_or_else(|| "no cookie database found".to_string())?;
            let prefix = format!("{}-", browser_id);
            let mut mine: Vec<PathBuf> = std::fs::read_dir(backups_dir(dir))
                .map_err(|_| "there is no backup to restore".to_string())?
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| {
                    p.file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n.starts_with(&prefix))
                        .unwrap_or(false)
                })
                .collect();
            mine.sort();
            let newest = mine.pop().ok_or_else(|| "there is no backup to restore".to_string())?;

            // The write-ahead log belongs to the database being replaced, and
            // leaving it in place would let SQLite replay the deletes back
            // over the restored file.
            for suffix in ["-wal", "-shm"] {
                let mut companion = db.as_os_str().to_os_string();
                companion.push(suffix);
                let _ = std::fs::remove_file(PathBuf::from(companion));
            }
            return std::fs::copy(&newest, &db)
                .map(|_| ())
                .map_err(|e| format!("could not restore the cookies: {}", e));
        }
        Err(format!("unknown browser: {}", browser_id))
    }

    /// A scratch directory that deletes itself.
    ///
    /// Hand-rolled rather than pulling in a crate: it is nine lines, and the
    /// copies it holds are someone's cookie database, so "cleaned up even if
    /// the read fails" is worth owning explicitly.
    pub mod tempdir {
        use std::path::{Path, PathBuf};

        pub struct TempHandle(PathBuf);

        impl TempHandle {
            pub fn new() -> Result<Self, String> {
                let stamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos())
                    .unwrap_or(0);
                let dir = std::env::temp_dir().join(format!("pctweaker-cookies-{}", stamp));
                std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
                Ok(Self(dir))
            }

            pub fn path(&self) -> &Path {
                &self.0
            }
        }

        impl Drop for TempHandle {
            fn drop(&mut self) {
                let _ = std::fs::remove_dir_all(&self.0);
            }
        }
    }
}

/* ---------------------------------------------------------------- *
 * Tauri commands
 * ---------------------------------------------------------------- */

#[cfg(windows)]
#[tauri::command(async)]
pub fn cookie_whitelist(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    Ok(load_whitelist(&crate::store_for_dir(&app)?))
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn set_cookie_whitelist(app: tauri::AppHandle, entries: Vec<String>) -> Result<(), String> {
    save_whitelist(&crate::store_for_dir(&app)?, &entries)
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn scan_cookies(app: tauri::AppHandle) -> Result<Vec<CookieScan>, String> {
    let dir = crate::store_for_dir(&app)?;
    crate::require_pro(&dir)?;
    Ok(imp::scan(&load_whitelist(&dir)))
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn clean_cookies(
    app: tauri::AppHandle,
    browsers: Vec<String>,
) -> Result<CookieCleanResult, String> {
    let dir = crate::store_for_dir(&app)?;
    crate::require_pro(&dir)?;
    let result = imp::clean(&dir, &browsers, &load_whitelist(&dir));
    crate::audit::record(
        "cookie-clean",
        &browsers.join(","),
        !result.cleaned.is_empty(),
        Some(format!("{} removed, {} kept", result.removed, result.kept)),
    );
    Ok(result)
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn restore_cookies(app: tauri::AppHandle, browser: String) -> Result<(), String> {
    let dir = crate::store_for_dir(&app)?;
    let result = imp::restore(&dir, &browser);
    crate::audit::record(
        "cookie-restore",
        &browser,
        result.is_ok(),
        result.as_ref().err().cloned(),
    );
    result
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn cookie_whitelist(_app: tauri::AppHandle) -> Result<Vec<String>, String> {
    Ok(Vec::new())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn set_cookie_whitelist(_app: tauri::AppHandle, _entries: Vec<String>) -> Result<(), String> {
    Err("cookie cleaning is only available on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn scan_cookies(_app: tauri::AppHandle) -> Result<Vec<CookieScan>, String> {
    Ok(Vec::new())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn clean_cookies(
    _app: tauri::AppHandle,
    _browsers: Vec<String>,
) -> Result<CookieCleanResult, String> {
    Err("cookie cleaning is only available on Windows".to_string())
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn restore_cookies(_app: tauri::AppHandle, _browser: String) -> Result<(), String> {
    Err("cookie cleaning is only available on Windows".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn list(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    /// The sign-in cookie usually sits on a subdomain, so a whitelist that
    /// only matched the bare domain would sign the user out of the exact
    /// sites it was written to protect.
    #[test]
    fn protects_the_site_and_its_subdomains() {
        let wl = list(&["google.com"]);
        assert!(host_is_protected("google.com", &wl));
        assert!(host_is_protected(".google.com", &wl));
        assert!(host_is_protected("accounts.google.com", &wl));
        assert!(host_is_protected(".mail.google.com", &wl));
        assert!(host_is_protected("GOOGLE.COM", &wl));
    }

    /// Suffix matching anchored on a dot. Without the anchor, whitelisting
    /// `google.com` would also protect anything a tracker chose to call
    /// itself, which is how a whitelist quietly stops meaning anything.
    #[test]
    fn does_not_protect_lookalike_domains() {
        let wl = list(&["google.com"]);
        assert!(!host_is_protected("notgoogle.com", &wl));
        assert!(!host_is_protected("google.com.tracker.net", &wl));
        assert!(!host_is_protected("evilgoogle.com", &wl));
        assert!(!host_is_protected("doubleclick.net", &wl));
        assert!(!host_is_protected("", &wl));
    }

    #[test]
    fn an_empty_whitelist_protects_nothing() {
        assert!(!host_is_protected("google.com", &[]));
        assert!(!host_is_protected("google.com", &list(&["", "  "])));
    }

    #[test]
    fn saved_whitelist_is_normalised_and_deduped() {
        let dir = std::env::temp_dir().join(format!(
            "pctweaker-wl-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        save_whitelist(&dir, &list(&[" GitHub.com ", ".github.com", "github.com", "junk", ""]))
            .unwrap();
        assert_eq!(load_whitelist(&dir), list(&["github.com"]));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A missing file means "never customised" and must yield the defaults,
    /// while a deliberately emptied list has to survive a restart as empty.
    #[test]
    fn defaults_apply_only_when_nothing_was_saved() {
        let base = std::env::temp_dir().join(format!(
            "pctweaker-wl-default-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        assert_eq!(load_whitelist(&base).len(), DEFAULT_WHITELIST.len());
        save_whitelist(&base, &[]).unwrap();
        assert!(load_whitelist(&base).is_empty());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn firefox_and_chromium_use_their_own_tables() {
        assert_eq!(schema_for("firefox"), ("moz_cookies", "host"));
        assert_eq!(schema_for("chrome"), ("cookies", "host_key"));
        assert_eq!(schema_for("opera_gx"), ("cookies", "host_key"));
    }

    /// The shipped list is what most users will ever run with, so a typo in
    /// it silently signs someone out of their bank.
    #[test]
    fn default_whitelist_entries_are_well_formed() {
        for entry in DEFAULT_WHITELIST {
            assert!(entry.contains('.'), "{} is not a domain", entry);
            assert!(!entry.starts_with('.'), "{} has a stray leading dot", entry);
            assert_eq!(*entry, entry.to_lowercase(), "{} is not lowercase", entry);
        }
    }
}
