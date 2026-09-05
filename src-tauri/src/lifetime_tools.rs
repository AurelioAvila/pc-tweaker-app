//! Additive Lifetime tools. Both consume saved configuration data; neither
//! applies a tweak, restores a snapshot, or measures system performance.

use crate::license::{LicensePayload, LicenseStore};
use crate::profiles::TweakProfile;
use crate::TweakInfo;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const MAX_PROFILE_BYTES: u64 = 256 * 1024;
const MAX_PROFILE_NAME_BYTES: usize = 1024;
const MAX_PROFILE_IDS: usize = 4096;

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ComparisonRequest {
    pub left_name: String,
    pub right_name: String,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct ProfileComparison {
    pub left_name: String,
    pub right_name: String,
    pub common: Vec<String>,
    pub only_left: Vec<String>,
    pub only_right: Vec<String>,
    // Unknown IDs can contain arbitrary imported text. Count distinct unknown
    // values without copying that text into the UI or a portable report.
    pub unknown_left_count: usize,
    pub unknown_right_count: usize,
}

fn is_lifetime(payload: &LicensePayload) -> bool {
    payload.is_pro && payload.plan.as_deref() == Some("lifetime")
}

fn require_lifetime(app_data: &Path) -> Result<(), String> {
    let allowed = LicenseStore::new(app_data.to_path_buf())
        .verified_fresh_payload()
        .as_ref()
        .is_some_and(is_lifetime);
    if allowed {
        Ok(())
    } else {
        Err("These tools require a verified PC Tweaker Lifetime license. Connect to the internet and refresh your license in Account.".into())
    }
}

fn is_link(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        // Includes junctions as well as symbolic links.
        metadata.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    false
}

/// Match the existing ProfileStore filename mapping, then verify the stored
/// name. A sanitized-name collision must never select a different profile.
fn saved_profile_path(app_data: &Path, name: &str) -> Result<PathBuf, String> {
    if name.trim().is_empty() || name.len() > MAX_PROFILE_NAME_BYTES {
        return Err("Choose a valid saved profile.".into());
    }
    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    Ok(app_data
        .join("profiles")
        .join(format!("{}.json", safe.trim())))
}

fn read_saved_profile(app_data: &Path, name: &str) -> Result<TweakProfile, String> {
    let path = saved_profile_path(app_data, name)?;
    let directory = app_data.join("profiles");
    let directory_metadata = fs::symlink_metadata(&directory).map_err(|_| {
        "The saved profiles folder is unavailable. Save both profiles first.".to_string()
    })?;
    if !directory_metadata.is_dir() || is_link(&directory_metadata) {
        return Err("The saved profiles folder must be a regular local folder.".into());
    }
    let metadata = fs::symlink_metadata(&path).map_err(|_| {
        "A selected saved profile is unavailable. Refresh the profile list.".to_string()
    })?;
    if !metadata.is_file() || is_link(&metadata) {
        return Err("A selected profile is not a regular saved profile file.".into());
    }
    let canonical_directory = directory
        .canonicalize()
        .map_err(|_| "The saved profiles folder could not be resolved.".to_string())?;
    let canonical_path = path
        .canonicalize()
        .map_err(|_| "A selected saved profile could not be resolved.".to_string())?;
    if canonical_path.parent() != Some(canonical_directory.as_path()) {
        return Err("A selected profile is outside the saved profiles folder.".into());
    }

    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // Open the reparse point itself, not its target, and keep another
        // process from rewriting or replacing this file while it is read.
        options.custom_flags(0x0020_0000).share_mode(1);
    }
    let file = options.open(&path).map_err(|_| {
        "A selected profile could not be read. Refresh the profile list.".to_string()
    })?;
    let metadata = file
        .metadata()
        .map_err(|_| "A selected profile could not be inspected.".to_string())?;
    if !metadata.is_file() || is_link(&metadata) || metadata.len() > MAX_PROFILE_BYTES {
        return Err("A selected profile is invalid or exceeds the 256 KB size limit.".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_PROFILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "A selected profile could not be read.".to_string())?;
    if bytes.len() as u64 > MAX_PROFILE_BYTES {
        return Err("A selected profile exceeds the 256 KB size limit.".into());
    }
    let profile: TweakProfile = serde_json::from_slice(&bytes)
        .map_err(|_| "A selected file is not a valid PC Tweaker profile.".to_string())?;
    if profile.format != 1 {
        return Err("A selected profile uses an unsupported format. Save it again with this version of PC Tweaker.".into());
    }
    if profile.name != name {
        return Err(
            "The selected profile name no longer matches its saved file. Refresh the profile list."
                .into(),
        );
    }
    if profile.tweaks.len() > MAX_PROFILE_IDS {
        return Err("A selected profile contains too many tweak entries.".into());
    }
    Ok(profile)
}

fn compare_profiles(
    left: &TweakProfile,
    right: &TweakProfile,
    catalog: &[TweakInfo],
) -> ProfileComparison {
    let known: BTreeSet<&str> = catalog.iter().map(|tweak| tweak.id.as_str()).collect();
    let left_ids: BTreeSet<&str> = left.tweaks.iter().map(String::as_str).collect();
    let right_ids: BTreeSet<&str> = right.tweaks.iter().map(String::as_str).collect();
    let left_known: BTreeSet<&str> = left_ids.intersection(&known).copied().collect();
    let right_known: BTreeSet<&str> = right_ids.intersection(&known).copied().collect();
    ProfileComparison {
        left_name: left.name.clone(),
        right_name: right.name.clone(),
        common: left_known
            .intersection(&right_known)
            .map(|id| (*id).to_string())
            .collect(),
        only_left: left_known
            .difference(&right_known)
            .map(|id| (*id).to_string())
            .collect(),
        only_right: right_known
            .difference(&left_known)
            .map(|id| (*id).to_string())
            .collect(),
        unknown_left_count: left_ids.difference(&known).count(),
        unknown_right_count: right_ids.difference(&known).count(),
    }
}

fn comparison_from_saved(
    app_data: &Path,
    request: &ComparisonRequest,
    catalog: &[TweakInfo],
) -> Result<ProfileComparison, String> {
    if request.left_name == request.right_name {
        return Err("Choose two different saved profiles to compare.".into());
    }
    let left = read_saved_profile(app_data, &request.left_name)?;
    let right = read_saved_profile(app_data, &request.right_name)?;
    Ok(compare_profiles(&left, &right, catalog))
}

#[tauri::command(async)]
pub fn compare_lifetime_profiles(
    app: tauri::AppHandle,
    left_name: String,
    right_name: String,
) -> Result<ProfileComparison, String> {
    let app_data = crate::store_for_dir(&app)?;
    require_lifetime(&app_data)?;
    let catalog = crate::list_tweaks(app)?;
    comparison_from_saved(
        &app_data,
        &ComparisonRequest {
            left_name,
            right_name,
        },
        &catalog,
    )
}

fn markdown_cell(text: &str) -> String {
    let mut escaped = String::new();
    for character in text.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '|' | '\\' | '`' | '*' | '_' | '[' | ']' => {
                escaped.push('\\');
                escaped.push(character);
            }
            '\r' | '\n' | '\t' => escaped.push(' '),
            c if c.is_control() => {}
            c => escaped.push(c),
        }
    }
    escaped
}

fn append_tweak_rows(report: &mut String, tweaks: &[&TweakInfo]) {
    if tweaks.is_empty() {
        report.push_str("None.\n\n");
        return;
    }
    report.push_str("| Tweak | ID | Category |\n| --- | --- | --- |\n");
    for tweak in tweaks {
        report.push_str(&format!(
            "| {} | {} | {} |\n",
            markdown_cell(&tweak.name),
            markdown_cell(&tweak.id),
            markdown_cell(&tweak.category)
        ));
    }
    report.push('\n');
}

fn build_report(catalog: &[TweakInfo], comparison: Option<&ProfileComparison>) -> String {
    let mut recorded: Vec<&TweakInfo> = catalog.iter().filter(|tweak| tweak.applied).collect();
    recorded.sort_by(|a, b| a.id.cmp(&b.id));
    let mut report = format!(
        "# PC Tweaker tuning report\n\nApp version: {}\n\nRecorded tweak entries: {} of {} in this version's catalog.\n\n## Scope\n\nThis is a point-in-time summary of PC Tweaker's saved configuration records. A recorded entry means a recovery snapshot exists; it can also represent an incomplete change awaiting recovery. It does not prove that a change completed, remains active in Windows, or improved performance. This report contains no FPS, frame-time, DPC latency, or before-and-after measurements.\n\n## Recorded settings\n\n",
        env!("CARGO_PKG_VERSION"), recorded.len(), catalog.len()
    );
    append_tweak_rows(&mut report, &recorded);
    if let Some(comparison) = comparison {
        report.push_str("## Saved profile comparison\n\nProfile A and Profile B refer to the two selected saved profiles. Their names are omitted for privacy. This comparison covers tweak IDs only; profiles do not contain the original Windows values or performance measurements.\n\n");
        for (heading, ids) in [
            ("In both profiles", &comparison.common),
            ("Only in Profile A", &comparison.only_left),
            ("Only in Profile B", &comparison.only_right),
        ] {
            report.push_str(&format!("### {heading} ({})\n\n", ids.len()));
            let entries: Vec<&TweakInfo> = ids
                .iter()
                .filter_map(|id| catalog.iter().find(|tweak| &tweak.id == id))
                .collect();
            append_tweak_rows(&mut report, &entries);
        }
        report.push_str(&format!(
            "Unknown IDs omitted: {} from Profile A; {} from Profile B. Counts refer to distinct IDs. Unknown entries cannot be evaluated against this version's catalog.\n\n",
            comparison.unknown_left_count, comparison.unknown_right_count
        ));
    }
    report.push_str("## Privacy\n\nThis report omits account details, license data, hardware identifiers, profile names, local file paths, and original registry or network values. Review it before sharing.\n");
    report
}

fn generate_report(
    app: &tauri::AppHandle,
    app_data: &Path,
    comparison: Option<&ComparisonRequest>,
) -> Result<String, String> {
    let catalog = crate::list_tweaks(app.clone())?;
    let compared = comparison
        .map(|request| comparison_from_saved(app_data, request, &catalog))
        .transpose()?;
    Ok(build_report(&catalog, compared.as_ref()))
}

#[tauri::command(async)]
pub fn preview_lifetime_report(
    app: tauri::AppHandle,
    comparison: Option<ComparisonRequest>,
) -> Result<String, String> {
    let app_data = crate::store_for_dir(&app)?;
    require_lifetime(&app_data)?;
    generate_report(&app, &app_data, comparison.as_ref())
}

/// This function is not an IPC command. Only a path returned by the native
/// save dialog and Markdown generated in this module can reach it.
fn write_new_report(path: &Path, report: &str) -> Result<(), String> {
    if !path.is_absolute()
        || !path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
        || path
            .file_name()
            .and_then(|name| name.to_str())
            .is_none_or(|name| name.contains(':'))
    {
        return Err("Choose a Markdown file with the .md extension.".into());
    }
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                "A file already exists at that location. Choose a new file name.".to_string()
            } else {
                "The report could not be created at the selected location. Choose another folder or file name.".to_string()
            }
        })?;
    let result = file
        .write_all(report.as_bytes())
        .and_then(|_| file.sync_all());
    if result.is_err() {
        // Keep the failed file rather than removing a path another process
        // could replace after this handle closes. The UI never reports success.
        return Err("The report could not be saved completely. A partial file may remain; choose a new file name and try again.".into());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn save_lifetime_report(
    app: tauri::AppHandle,
    comparison: Option<ComparisonRequest>,
) -> Result<bool, String> {
    let app_data = crate::store_for_dir(&app)?;
    require_lifetime(&app_data)?;
    // Validate the current records and profile selection before showing a
    // dialog. Regenerate after selection so the export uses current data.
    generate_report(&app, &app_data, comparison.as_ref())?;
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Save PC Tweaker tuning report")
        .add_filter("Markdown", &["md"])
        .set_file_name("pc-tweaker-tuning-report.md");
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let Some(selection) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    // The account may have signed out or its cached license may have expired
    // while the dialog was open. Never rely on the earlier entitlement check.
    require_lifetime(&app_data)?;
    let path = selection
        .into_path()
        .map_err(|_| "Choose a local Markdown file for this report.".to_string())?;
    let report = generate_report(&app, &app_data, comparison.as_ref())?;
    write_new_report(&path, &report)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::sync::atomic::{AtomicUsize, Ordering};

    struct TempDirectory(PathBuf);

    impl TempDirectory {
        fn new() -> Self {
            static NEXT: AtomicUsize = AtomicUsize::new(0);
            let path = std::env::temp_dir().join(format!(
                "pc-tweaker-lifetime-test-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn profile(name: &str, ids: &[&str]) -> TweakProfile {
        TweakProfile {
            format: 1,
            name: name.into(),
            created_at: "private-saved-time".into(),
            tweaks: ids.iter().map(|id| id.to_string()).collect(),
        }
    }

    fn catalog() -> Vec<TweakInfo> {
        ["alpha", "beta", "gamma"]
            .iter()
            .map(|id| TweakInfo {
                id: id.to_string(),
                name: format!("Tweak {id}"),
                description: "unused description".into(),
                category: "gaming".into(),
                hive: "HKCU".into(),
                requires_admin: false,
                requires_pro: false,
                applied: *id == "beta",
                changes: vec![],
            })
            .collect()
    }

    fn save_fixture(directory: &Path, profile: &TweakProfile) -> PathBuf {
        fs::create_dir_all(directory.join("profiles")).unwrap();
        let path = saved_profile_path(directory, &profile.name).unwrap();
        fs::write(&path, serde_json::to_vec(profile).unwrap()).unwrap();
        path
    }

    #[test]
    fn subscriptions_and_free_accounts_do_not_receive_lifetime_tools() {
        let mut payload = LicensePayload {
            user_id: "not-exported".into(),
            is_pro: true,
            plan: Some("lifetime".into()),
            product: Some("pctweaker".into()),
            issued_at: 1,
        };
        assert!(is_lifetime(&payload));
        for plan in [
            None,
            Some("monthly"),
            Some("yearly"),
            Some("annual"),
            Some("Lifetime"),
            Some("lifetime "),
        ] {
            payload.plan = plan.map(str::to_string);
            assert!(!is_lifetime(&payload));
        }
        payload.plan = Some("lifetime".into());
        payload.is_pro = false;
        assert!(!is_lifetime(&payload));
    }

    #[test]
    fn a_forged_or_missing_cached_lifetime_license_is_denied() {
        let directory = TempDirectory::new();
        assert!(require_lifetime(&directory.0).is_err());
        fs::write(directory.0.join("license.json"), r#"{"payloadJson":"{\"userId\":\"local\",\"isPro\":true,\"plan\":\"lifetime\",\"product\":\"pctweaker\",\"issuedAt\":1800000000}","signature":"forged"}"#).unwrap();
        assert!(require_lifetime(&directory.0).is_err());
    }

    #[test]
    fn comparison_is_sorted_deduplicated_and_omits_unknown_text() {
        let compared = compare_profiles(
            &profile(
                "A",
                &[
                    "beta",
                    "alpha",
                    "alpha",
                    "private-email@example.com",
                    "private-email@example.com",
                ],
            ),
            &profile("B", &["gamma", "beta", "unknown"]),
            &catalog(),
        );
        assert_eq!(compared.common, ["beta"]);
        assert_eq!(compared.only_left, ["alpha"]);
        assert_eq!(compared.only_right, ["gamma"]);
        assert_eq!(compared.unknown_left_count, 1);
        assert_eq!(compared.unknown_right_count, 1);
        assert!(!serde_json::to_string(&compared)
            .unwrap()
            .contains("private-email@example.com"));
    }

    #[test]
    fn empty_profiles_compare_without_inventing_entries() {
        let compared = compare_profiles(&profile("A", &[]), &profile("B", &[]), &catalog());
        assert!(compared.common.is_empty());
        assert!(compared.only_left.is_empty());
        assert!(compared.only_right.is_empty());
        assert_eq!(compared.unknown_left_count, 0);
    }

    #[test]
    fn saved_comparison_reads_only_selected_saved_profiles() {
        let directory = TempDirectory::new();
        save_fixture(&directory.0, &profile("Gaming / 2026", &["alpha", "beta"]));
        save_fixture(&directory.0, &profile("Quiet", &["beta"]));
        let request = ComparisonRequest {
            left_name: "Gaming / 2026".into(),
            right_name: "Quiet".into(),
        };
        let compared = comparison_from_saved(&directory.0, &request, &catalog()).unwrap();
        assert_eq!(compared.common, ["beta"]);
        assert_eq!(compared.only_left, ["alpha"]);
        assert!(read_saved_profile(&directory.0, "Missing").is_err());
        let same = ComparisonRequest {
            left_name: "Quiet".into(),
            right_name: "Quiet".into(),
        };
        assert!(comparison_from_saved(&directory.0, &same, &catalog()).is_err());
    }

    #[test]
    fn traversal_and_filename_collisions_cannot_select_other_files() {
        let directory = TempDirectory::new();
        let path = saved_profile_path(&directory.0, "../../license").unwrap();
        assert_eq!(path.parent(), Some(directory.0.join("profiles").as_path()));
        fs::write(
            directory.0.join("license.json"),
            serde_json::to_vec(&profile("../../license", &["alpha"])).unwrap(),
        )
        .unwrap();
        assert!(read_saved_profile(&directory.0, "../../license").is_err());
        save_fixture(&directory.0, &profile("Gaming/2026", &["alpha"]));
        assert!(read_saved_profile(&directory.0, "Gaming:2026").is_err());
        assert!(saved_profile_path(&directory.0, "").is_err());
        assert!(saved_profile_path(&directory.0, &"a".repeat(MAX_PROFILE_NAME_BYTES + 1)).is_err());
    }

    #[test]
    fn corrupt_oversized_and_unsupported_profiles_are_rejected() {
        let directory = TempDirectory::new();
        let path = save_fixture(&directory.0, &profile("A", &[]));
        fs::write(&path, "not json").unwrap();
        assert!(read_saved_profile(&directory.0, "A").is_err());
        let file = File::create(&path).unwrap();
        file.set_len(MAX_PROFILE_BYTES + 1).unwrap();
        drop(file);
        assert!(read_saved_profile(&directory.0, "A").is_err());
        for format in [0, 2] {
            let mut candidate = profile("A", &[]);
            candidate.format = format;
            save_fixture(&directory.0, &candidate);
            assert!(read_saved_profile(&directory.0, "A").is_err());
        }
        let mut candidate = profile("A", &[]);
        candidate.tweaks = vec!["alpha".into(); MAX_PROFILE_IDS + 1];
        save_fixture(&directory.0, &candidate);
        assert!(read_saved_profile(&directory.0, "A").is_err());
    }

    #[test]
    fn report_uses_recorded_ids_and_omits_profile_and_unknown_private_data() {
        let catalog = catalog();
        let compared = compare_profiles(
            &profile(
                "Person A / private-project",
                &["alpha", "private-token-123"],
            ),
            &profile("Person B / email@example.com", &["beta"]),
            &catalog,
        );
        let report = build_report(&catalog, Some(&compared));
        assert!(report.contains("Recorded tweak entries: 1 of 3"));
        let recorded = report
            .split("## Recorded settings\n\n")
            .nth(1)
            .unwrap()
            .split("## Saved profile comparison")
            .next()
            .unwrap();
        assert!(recorded.contains("Tweak beta"));
        assert!(!recorded.contains("Tweak alpha"));
        for private in [
            "Person A",
            "private-project",
            "Person B",
            "email@example.com",
            "private-token-123",
            "private-saved-time",
            "unused description",
        ] {
            assert!(!report.contains(private), "private value leaked: {private}");
        }
        assert!(report.contains("does not prove that a change completed"));
        assert!(report.contains("no FPS, frame-time, DPC latency"));
    }

    #[test]
    fn an_empty_journal_is_reported_as_zero_without_a_fake_baseline() {
        let mut catalog = catalog();
        for tweak in &mut catalog {
            tweak.applied = false;
        }
        let report = build_report(&catalog, None);
        assert!(report.contains("Recorded tweak entries: 0 of 3"));
        assert!(report.contains("## Recorded settings\n\nNone."));
        assert!(!report.contains("## Saved profile comparison"));
    }

    #[test]
    fn markdown_cells_cannot_inject_html_or_new_table_rows() {
        let escaped = markdown_cell("<script>x</script>|[link](x)\nnext");
        assert!(!escaped.contains('<'));
        assert!(!escaped.contains('\n'));
        assert!(escaped.contains("\\|"));
        assert!(escaped.contains("\\[link\\]"));
    }

    #[test]
    fn export_writes_a_new_markdown_file_and_never_overwrites() {
        let directory = TempDirectory::new();
        let path = directory.0.join("report.md");
        write_new_report(&path, "# First report\n").unwrap();
        let error = write_new_report(&path, "replacement").unwrap_err();
        assert!(error.contains("Choose a new file name"));
        assert_eq!(fs::read_to_string(&path).unwrap(), "# First report\n");
        assert!(write_new_report(&directory.0.join("report.exe"), "x").is_err());
        assert!(write_new_report(&directory.0.join("report.md:stream.md"), "x").is_err());
        assert!(write_new_report(Path::new("relative.md"), "x").is_err());
        assert!(!directory.0.join("report.exe").exists());
    }
}
