//! Conservative, current-user MSIX removal with a durable per-package journal.
use serde::{Deserialize, Serialize};
#[cfg(test)]
use std::cell::Cell;
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct CatalogItem {
    id: &'static str,
    package_name: &'static str,
    publisher_id: &'static str,
    publisher: &'static str,
    name: &'static str,
    description: &'static str,
    impact: &'static str,
    store_url: &'static str,
}

// Each link is a checked Microsoft Store product page. Add an app only after
// verifying its PackageId identity and Store product on supported Windows VMs.
const CATALOG: &[CatalogItem] = &[
    CatalogItem {
        id: "solitaire",
        package_name: "Microsoft.MicrosoftSolitaireCollection",
        publisher_id: "8wekyb3d8bbwe",
        publisher: "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US",
        name: "Microsoft Solitaire Collection",
        description: "Microsoft's Solitaire card games.",
        impact: "The games and local settings leave this account; game progress may not return after reinstalling.",
        store_url: "https://apps.microsoft.com/detail/9wzdncrfhwd2",
    },
    CatalogItem {
        id: "weather",
        package_name: "Microsoft.BingWeather",
        publisher_id: "8wekyb3d8bbwe",
        publisher: "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US",
        name: "MSN Weather",
        description: "Weather forecasts from Microsoft.",
        impact: "Weather app settings and pinned views may need to be set up again.",
        store_url: "https://apps.microsoft.com/detail/9wzdncrfj3q2",
    },
    CatalogItem {
        id: "news",
        package_name: "Microsoft.BingNews",
        publisher_id: "8wekyb3d8bbwe",
        publisher: "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US",
        name: "Microsoft News",
        description: "Microsoft's news reader.",
        impact: "Local news preferences may not return after reinstalling.",
        store_url: "https://apps.microsoft.com/detail/9wzdncrfhvfw",
    },
    CatalogItem {
        id: "copilot",
        package_name: "Microsoft.Copilot",
        publisher_id: "8wekyb3d8bbwe",
        publisher: "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US",
        name: "Microsoft Copilot",
        description: "The consumer Copilot app for Windows.",
        impact: "The Copilot app leaves this account; this does not disable Copilot features inside Microsoft 365 apps.",
        store_url: "https://apps.microsoft.com/detail/xp9cxngppj97xx",
    },
    CatalogItem {
        id: "clipchamp",
        package_name: "Clipchamp.Clipchamp",
        publisher_id: "yxz26nhyzhsrt",
        publisher: "CN=33F0F141-36F3-4EC2-A77D-51B53D0BA0E4",
        name: "Microsoft Clipchamp",
        description: "Video editor included with many Windows installations.",
        impact: "Back up local projects and source media first; reinstalling the app does not restore lost files.",
        store_url: "https://apps.microsoft.com/detail/9p1j8s7ccwwt",
    },
    CatalogItem {
        id: "outlook",
        package_name: "Microsoft.OutlookForWindows",
        publisher_id: "8wekyb3d8bbwe",
        publisher: "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US",
        name: "Outlook for Windows",
        description: "Microsoft's new Outlook mail and calendar app.",
        impact: "Mail and calendar access through this app stops until reinstalled; account settings may need setup again.",
        store_url: "https://apps.microsoft.com/detail/9nrx63209r7b",
    },
];

#[derive(Clone, Debug, PartialEq)]
struct PackageInfo {
    full_name: String,
    name: String,
    publisher_id: String,
    publisher: String,
    store_signed: bool,
    framework: bool,
    resource: bool,
    optional: bool,
    dependencies: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebloatApp {
    pub catalog_id: String,
    pub name: String,
    pub description: String,
    pub impact: String,
    pub package_full_name: Option<String>,
    pub installed: bool,
    pub removable: bool,
    pub reason: Option<String>,
    pub store_url: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RemovalStatus {
    Pending,
    Removed,
    Failed,
    Unknown,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebloatRecord {
    pub catalog_id: String,
    pub package_full_name: String,
    pub publisher_id: String,
    pub scope: String,
    pub status: RemovalStatus,
    pub error: Option<String>,
    pub timestamp: u64,
}

fn catalog_for_package(info: &PackageInfo) -> Option<&'static CatalogItem> {
    CATALOG.iter().find(|item| item.package_name == info.name)
}

fn eligible<'a>(info: &PackageInfo, all: &[PackageInfo]) -> Result<&'a CatalogItem, String> {
    let item = catalog_for_package(info).ok_or("notCatalog")?;
    if info.publisher_id != item.publisher_id
        || !info.publisher.eq_ignore_ascii_case(item.publisher)
        || !info.store_signed
    {
        return Err("publisherMismatch".into());
    }
    if info.framework || info.resource || info.optional {
        return Err("protectedPackage".into());
    }
    if all.iter().any(|other| {
        other.full_name != info.full_name
            && other
                .dependencies
                .iter()
                .any(|dependency| dependency == &info.full_name)
    }) {
        return Err("dependency".into());
    }
    Ok(item)
}

trait PackageSystem {
    fn scan(&self) -> Result<Vec<PackageInfo>, String>;
    fn nonremovable(&self) -> Result<HashMap<String, bool>, String>;
    fn remove(&self, full_name: &str) -> Result<(), String>;
}

struct WindowsPackages;

fn verified_candidate<'a>(
    info: &PackageInfo,
    all: &[PackageInfo],
    flags: &HashMap<String, bool>,
) -> Result<&'a CatalogItem, String> {
    let item = eligible(info, all)?;
    match flags.get(&info.full_name) {
        Some(false) => Ok(item),
        Some(true) => Err("nonRemovable".into()),
        None => Err("unverifiedRemovability".into()),
    }
}

fn inventory(system: &impl PackageSystem) -> Result<Vec<DebloatApp>, String> {
    let packages = system.scan()?;
    let flags = system.nonremovable();
    let mut apps = Vec::new();
    for item in CATALOG {
        let found: Vec<_> = packages
            .iter()
            .filter(|p| p.name == item.package_name)
            .collect();
        if found.is_empty() {
            apps.push(DebloatApp {
                catalog_id: item.id.into(),
                name: item.name.into(),
                description: item.description.into(),
                impact: item.impact.into(),
                package_full_name: None,
                installed: false,
                removable: false,
                reason: None,
                store_url: Some(item.store_url.into()),
            });
        }
        for info in found {
            let verdict = flags
                .as_ref()
                .map_err(|_| "unverifiedRemovability".to_string())
                .and_then(|f| verified_candidate(info, &packages, f).map(|_| ()));
            apps.push(DebloatApp {
                catalog_id: item.id.into(),
                name: item.name.into(),
                description: item.description.into(),
                impact: item.impact.into(),
                package_full_name: Some(info.full_name.clone()),
                installed: true,
                removable: verdict.is_ok(),
                reason: verdict.err(),
                store_url: Some(item.store_url.into()),
            });
        }
    }
    Ok(apps)
}

struct Journal {
    path: PathBuf,
    #[cfg(test)]
    fail_save: bool,
    #[cfg(test)]
    fail_on_save: Cell<Option<usize>>,
    #[cfg(test)]
    save_count: Cell<usize>,
}

impl Journal {
    fn new(dir: &Path) -> Self {
        Self {
            path: dir.join("debloat_history.json"),
            #[cfg(test)]
            fail_save: false,
            #[cfg(test)]
            fail_on_save: Cell::new(None),
            #[cfg(test)]
            save_count: Cell::new(0),
        }
    }

    fn lock(&self) -> Result<File, String> {
        #[cfg(all(windows, not(test)))]
        if !crate::elevation::current_user_session_allowed() {
            return Err("Debloat must run without elevation so its journal stays in the current user's security context".into());
        }
        fs::create_dir_all(self.path.parent().ok_or("Invalid journal path")?)
            .map_err(|e| e.to_string())?;
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(self.path.with_extension("lock"))
            .map_err(|e| e.to_string())?;
        lock.lock()
            .map_err(|e| format!("Could not lock Debloat journal: {e}"))?;
        Ok(lock)
    }

    fn load(&self) -> Result<Vec<DebloatRecord>, String> {
        let bytes = match fs::read(&self.path) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(format!("Could not read Debloat journal: {e}")),
        };
        serde_json::from_slice(&bytes)
            .map_err(|e| format!("Debloat journal is damaged; no changes were made: {e}"))
    }

    fn save(&self, records: &[DebloatRecord]) -> Result<(), String> {
        #[cfg(test)]
        if self.fail_save {
            return Err("simulated journal write failure".into());
        }
        #[cfg(test)]
        {
            self.save_count.set(self.save_count.get() + 1);
            if self.fail_on_save.get() == Some(self.save_count.get()) {
                return Err("simulated journal write failure".into());
            }
        }
        let bytes = serde_json::to_vec_pretty(records).map_err(|e| e.to_string())?;
        fs::create_dir_all(self.path.parent().ok_or("Invalid journal path")?)
            .map_err(|e| e.to_string())?;
        let temp = self.path.with_extension(format!(
            "json.{}.{}.tmp",
            std::process::id(),
            TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        let result = (|| -> io::Result<()> {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            drop(file);
            replace_file(&temp, &self.path)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temp);
        }
        result.map_err(|e| format!("Could not save Debloat journal: {e}"))
    }
}

#[cfg(windows)]
fn replace_file(from: &Path, to: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
    }
    let from: Vec<u16> = from.as_os_str().encode_wide().chain(Some(0)).collect();
    let to: Vec<u16> = to.as_os_str().encode_wide().chain(Some(0)).collect();
    if unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), 0x1 | 0x8) } == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(from: &Path, to: &Path) -> io::Result<()> {
    fs::rename(from, to)?;
    File::open(to.parent().ok_or(io::Error::other("missing parent"))?)?.sync_all()
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn reconcile(system: &impl PackageSystem, journal: &Journal) -> Result<Vec<DebloatRecord>, String> {
    let _lock = journal.lock()?;
    let mut records = journal.load()?;
    if records.iter().any(|r| r.status == RemovalStatus::Pending) {
        let packages = system.scan()?;
        for record in records
            .iter_mut()
            .filter(|r| r.status == RemovalStatus::Pending)
        {
            record.status = if packages
                .iter()
                .any(|p| p.full_name == record.package_full_name)
            {
                RemovalStatus::Unknown
            } else {
                RemovalStatus::Removed
            };
            record.error = Some("Operation was interrupted; current package state was checked without retrying removal".into());
        }
        journal.save(&records)?;
    }
    Ok(records)
}

fn remove_inner(
    system: &impl PackageSystem,
    journal: &Journal,
    full_name: &str,
) -> Result<DebloatRecord, String> {
    let _lock = journal.lock()?;
    let mut records = journal.load()?;
    if records
        .iter()
        .any(|r| r.status == RemovalStatus::Pending && r.package_full_name == full_name)
    {
        return Err("A pending operation must be reconciled before another removal".into());
    }
    let packages = system.scan()?;
    let info = packages
        .iter()
        .find(|p| p.full_name == full_name)
        .ok_or("Package is not installed for the current user")?;
    let flags = system.nonremovable()?;
    let item = verified_candidate(info, &packages, &flags)?;
    let mut record = DebloatRecord {
        catalog_id: item.id.into(),
        package_full_name: info.full_name.clone(),
        publisher_id: info.publisher_id.clone(),
        scope: "currentUser".into(),
        status: RemovalStatus::Pending,
        error: None,
        timestamp: now(),
    };
    records.push(record.clone());
    journal.save(&records)?;

    // Windows can update a package while the confirmation screen is open.
    // The second scan is deliberately after the durable pending write.
    let preflight = (|| {
        let fresh = system.scan()?;
        let same = fresh
            .iter()
            .find(|p| p.full_name == full_name)
            .filter(|p| *p == info)
            .ok_or("Package identity changed before removal")?;
        let flags = system.nonremovable()?;
        verified_candidate(same, &fresh, &flags)?;
        Ok::<(), String>(())
    })();
    let operation = preflight.and_then(|()| system.remove(full_name));
    let observed = system.scan();
    match observed {
        Ok(ref current) if !current.iter().any(|p| p.full_name == full_name) => {
            record.status = RemovalStatus::Removed
        }
        Ok(_) if operation.is_err() => record.status = RemovalStatus::Failed,
        _ => record.status = RemovalStatus::Unknown,
    }
    record.error = operation.err().or_else(|| observed.err()).or_else(|| {
        if record.status == RemovalStatus::Unknown {
            Some("Could not verify removal outcome".into())
        } else {
            None
        }
    });
    *records.last_mut().expect("pending record just appended") = record.clone();
    journal.save(&records)?;
    Ok(record)
}

#[tauri::command(async)]
pub fn list_debloat_apps() -> Result<Vec<DebloatApp>, String> {
    let mut apps = inventory(&WindowsPackages)?;
    #[cfg(windows)]
    if !crate::elevation::current_user_session_allowed() {
        for app in &mut apps {
            if app.removable {
                app.removable = false;
                app.reason = Some("requiresStandardUser".into());
            }
        }
    }
    Ok(apps)
}

#[tauri::command(async)]
pub fn remove_debloat_app(
    app: tauri::AppHandle,
    package_full_name: String,
) -> Result<DebloatRecord, String> {
    remove_inner(
        &WindowsPackages,
        &Journal::new(&crate::store_for_dir(&app)?),
        &package_full_name,
    )
}

#[tauri::command(async)]
pub fn debloat_history(app: tauri::AppHandle) -> Result<Vec<DebloatRecord>, String> {
    reconcile(
        &WindowsPackages,
        &Journal::new(&crate::store_for_dir(&app)?),
    )
}

#[tauri::command(async)]
pub fn debloat_reinstall_link(catalog_id: String) -> Result<String, String> {
    CATALOG
        .iter()
        .find(|item| item.id == catalog_id)
        .map(|item| item.store_url.into())
        .ok_or("Unknown Debloat catalog item".into())
}

pub fn reconcile_on_startup(app: &tauri::AppHandle) {
    let dir = match crate::store_for_dir(app) {
        Ok(dir) => dir,
        Err(error) => {
            eprintln!("Debloat startup reconciliation unavailable: {error}");
            return;
        }
    };
    // A pending entry can require a WinRT scan. Keep app setup responsive;
    // history and removals wait on the same durable journal lock.
    if let Err(error) = std::thread::Builder::new()
        .name("debloat-reconcile".into())
        .spawn(move || {
            if let Err(error) = reconcile(&WindowsPackages, &Journal::new(&dir)) {
                eprintln!("Debloat startup reconciliation failed: {error}");
            }
        })
    {
        eprintln!("Debloat startup reconciliation could not start: {error}");
    }
}

#[cfg(windows)]
mod platform {
    use super::*;
    use windows::core::HSTRING;
    use windows::ApplicationModel::PackageSignatureKind;
    use windows::Management::Deployment::PackageManager;

    pub fn scan() -> Result<Vec<PackageInfo>, String> {
        let manager = PackageManager::new().map_err(|e| format!("Package manager: {e}"))?;
        let packages = manager
            .FindPackagesByUserSecurityId(&HSTRING::new())
            .map_err(|e| format!("Enumerate current-user packages: {e}"))?;
        let mut out = Vec::new();
        for package in packages {
            let id = package.Id().map_err(|e| e.to_string())?;
            let dependencies = package
                .Dependencies()
                .map_err(|e| format!("Read package dependencies: {e}"))?
                .into_iter()
                .map(|dependency| {
                    dependency
                        .Id()
                        .and_then(|id| id.FullName())
                        .map(|s| s.to_string())
                })
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Read dependency identity: {e}"))?;
            out.push(PackageInfo {
                full_name: id.FullName().map_err(|e| e.to_string())?.to_string(),
                name: id.Name().map_err(|e| e.to_string())?.to_string(),
                publisher_id: id.PublisherId().map_err(|e| e.to_string())?.to_string(),
                publisher: id.Publisher().map_err(|e| e.to_string())?.to_string(),
                store_signed: package.SignatureKind().map_err(|e| e.to_string())?
                    == PackageSignatureKind::Store,
                framework: package.IsFramework().map_err(|e| e.to_string())?,
                resource: package.IsResourcePackage().map_err(|e| e.to_string())?,
                optional: package.IsOptional().map_err(|e| e.to_string())?,
                dependencies,
            });
        }
        Ok(out)
    }

    // PackageManager has no NonRemovable property. The read-only, fixed
    // Get-AppxPackage query supplies it; no package name enters command text.
    pub fn nonremovable() -> Result<HashMap<String, bool>, String> {
        let output = crate::system_tools::run("powershell", |command| {
            command.args(["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; @(Get-AppxPackage | Select-Object PackageFullName,NonRemovable) | ConvertTo-Json -Compress"])
                .output()
        }).map_err(|e| format!("Query Windows removability: {e}"))?;
        if !output.status.success() {
            return Err("Windows removability query failed".into());
        }
        let value: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("Invalid Windows removability data: {e}"))?;
        let entries = value.as_array().cloned().unwrap_or_else(|| vec![value]);
        let mut flags = HashMap::new();
        for entry in entries {
            let name = entry
                .get("PackageFullName")
                .and_then(|v| v.as_str())
                .ok_or("Missing package identity in removability data")?;
            let protected = entry
                .get("NonRemovable")
                .and_then(|v| v.as_bool())
                .ok_or("Missing NonRemovable in removability data")?;
            flags.insert(name.to_owned(), protected);
        }
        Ok(flags)
    }

    pub fn remove(full_name: &str) -> Result<(), String> {
        let manager = PackageManager::new().map_err(|e| format!("Package manager: {e}"))?;
        let operation = manager
            .RemovePackageAsync(&HSTRING::from(full_name))
            .map_err(|e| format!("Remove package: {e}"))?;
        let result = operation
            .get()
            .map_err(|e| format!("Remove package: {e}"))?;
        let code = result.ExtendedErrorCode().unwrap_or_default();
        if code.is_err() {
            return Err(result
                .ErrorText()
                .map(|s| s.to_string())
                .unwrap_or_else(|_| format!("Windows refused removal: {code:?}")));
        }
        Ok(())
    }
}

#[cfg(windows)]
impl PackageSystem for WindowsPackages {
    fn scan(&self) -> Result<Vec<PackageInfo>, String> {
        platform::scan()
    }
    fn nonremovable(&self) -> Result<HashMap<String, bool>, String> {
        platform::nonremovable()
    }
    fn remove(&self, full_name: &str) -> Result<(), String> {
        platform::remove(full_name)
    }
}

#[cfg(all(test, windows))]
mod live_tests {
    use super::*;
    use serde_json::{json, Value};
    use std::cell::Cell;

    const WEATHER: &str = "Microsoft.BingWeather";
    const GUEST: &str = "DEBLOAT-QA";
    const HOST: &str = "DESKTOP-1E118SC";

    fn vm_dir() -> PathBuf {
        assert_eq!(
            std::env::var("PC_TWEAKER_DEBLOAT_VM_TEST").as_deref(),
            Ok("I_ACKNOWLEDGE_DISPOSABLE_VM"),
            "explicit disposable-VM opt-in required"
        );
        assert_eq!(
            std::env::var("PC_TWEAKER_DEBLOAT_VM_NAME").as_deref(),
            Ok(GUEST),
            "wrong VM target"
        );
        assert_eq!(
            std::env::var("PC_TWEAKER_DEBLOAT_HOST_NAME").as_deref(),
            Ok(HOST),
            "host identity must be explicit"
        );
        let computer = std::env::var("COMPUTERNAME").expect("COMPUTERNAME");
        assert!(computer.eq_ignore_ascii_case(GUEST) && !computer.eq_ignore_ascii_case(HOST));
        let output = crate::system_tools::run("powershell", |command| {
            command.args(["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; Get-CimInstance Win32_ComputerSystem | Select-Object -First 1 Manufacturer,Model | ConvertTo-Json -Compress"]).output()
        }).expect("query VM hardware");
        assert!(output.status.success(), "VM hardware query failed");
        let hardware: Value = serde_json::from_slice(&output.stdout).expect("VM hardware JSON");
        assert_eq!(hardware["Manufacturer"], "Microsoft Corporation");
        assert_eq!(hardware["Model"], "Virtual Machine");
        assert!(!is_elevated::is_elevated(), "run as standard QAUser");
        let temp = fs::canonicalize(std::env::temp_dir()).expect("guest TEMP");
        let dir = fs::canonicalize(
            std::env::var_os("PC_TWEAKER_DEBLOAT_EVIDENCE_DIR")
                .expect("explicit evidence directory required"),
        )
        .expect("evidence directory must already exist");
        assert!(
            dir.starts_with(&temp) && dir != temp,
            "evidence must be a guest TEMP subdirectory"
        );
        dir
    }

    fn save_evidence(path: &Path, value: &Value) {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .expect("new evidence file");
        file.write_all(&serde_json::to_vec_pretty(value).unwrap())
            .unwrap();
        file.sync_all().unwrap();
    }

    fn packages_json() -> Vec<Value> {
        let output = crate::system_tools::run("powershell", |command| {
            command.args(["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; @(Get-AppxPackage | Select-Object Name,PackageFullName,InstallLocation,NonRemovable,IsFramework,IsResourcePackage,IsOptional) | ConvertTo-Json -Compress -Depth 3"]).output()
        }).expect("read native package inventory");
        assert!(output.status.success(), "native package inventory failed");
        let value: Value = serde_json::from_slice(&output.stdout).expect("package inventory JSON");
        value.as_array().cloned().unwrap_or_else(|| vec![value])
    }

    fn critical(entry: &Value) -> bool {
        let name = entry["Name"].as_str().unwrap_or_default();
        entry["NonRemovable"] == true
            || entry["IsFramework"] == true
            || name.starts_with("Microsoft.WindowsStore")
            || name.starts_with("Microsoft.DesktopAppInstaller")
            || name.starts_with("Microsoft.Windows.ShellExperienceHost")
            || name.starts_with("Microsoft.Windows.StartMenuExperienceHost")
            || name.starts_with("Microsoft.SecHealthUI")
            || name.starts_with("Microsoft.Windows.SecHealthUI")
            || name.starts_with("Microsoft.GamingServices")
            || name.starts_with("Microsoft.Xbox")
    }

    fn snapshot() -> Value {
        let packages = packages_json();
        json!({
            "catalog": inventory(&WindowsPackages).expect("catalog inventory"),
            "weather": packages.iter().filter(|p| p["Name"] == WEATHER).collect::<Vec<_>>(),
            "critical": packages.iter().filter(|p| critical(p)).collect::<Vec<_>>(),
        })
    }

    fn weather_name() -> String {
        let packages = WindowsPackages.scan().expect("native scan");
        let matches: Vec<_> = packages.iter().filter(|p| p.name == WEATHER).collect();
        assert_eq!(
            matches.len(),
            1,
            "exactly one Weather package must be installed"
        );
        let flags = WindowsPackages.nonremovable().expect("removability query");
        verified_candidate(matches[0], &packages, &flags).expect("Weather must be eligible");
        matches[0].full_name.clone()
    }

    fn before_name(dir: &Path) -> String {
        let before: Value = serde_json::from_slice(
            &fs::read(dir.join("before.json")).expect("removal before evidence"),
        )
        .unwrap();
        before["weatherPackageFullName"]
            .as_str()
            .expect("Weather full name")
            .into()
    }

    fn pending(dir: &Path, full_name: &str) -> Journal {
        assert!(
            !dir.join("debloat_history.json").exists(),
            "use a fresh evidence directory"
        );
        let journal = Journal::new(dir);
        journal
            .save(&[DebloatRecord {
                catalog_id: "weather".into(),
                package_full_name: full_name.into(),
                publisher_id: "8wekyb3d8bbwe".into(),
                scope: "currentUser".into(),
                status: RemovalStatus::Pending,
                error: None,
                timestamp: now(),
            }])
            .expect("durable pending record");
        journal
    }

    struct NativeReadOnly;

    impl PackageSystem for NativeReadOnly {
        fn scan(&self) -> Result<Vec<PackageInfo>, String> {
            WindowsPackages.scan()
        }
        fn nonremovable(&self) -> Result<HashMap<String, bool>, String> {
            WindowsPackages.nonremovable()
        }
        fn remove(&self, _: &str) -> Result<(), String> {
            panic!("reconciliation must never retry removal")
        }
    }

    #[test]
    #[ignore = "disposable Hyper-V VM only; seed pending while Weather is installed"]
    fn vm_seed_pending_present() {
        let dir = vm_dir().join("pending-present");
        fs::create_dir_all(&dir).unwrap();
        pending(&dir, &weather_name());
    }

    #[test]
    #[ignore = "disposable Hyper-V VM only; separate process after pending-present seed"]
    fn vm_reconcile_pending_present() {
        let dir = vm_dir().join("pending-present");
        let journal = Journal::new(&dir);
        let records = journal.load().expect("pending journal");
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].status, RemovalStatus::Pending);
        assert!(WindowsPackages
            .scan()
            .unwrap()
            .iter()
            .any(|p| p.full_name == records[0].package_full_name));
        let outcome = reconcile(&NativeReadOnly, &journal).expect("native reconciliation");
        assert_eq!(outcome[0].status, RemovalStatus::Unknown);
        assert_eq!(journal.load().unwrap()[0].status, RemovalStatus::Unknown);
        save_evidence(
            &dir.join("reconciled.json"),
            &json!({"observed": "present", "record": outcome[0]}),
        );
    }

    #[test]
    #[ignore = "destructive current-user Weather removal in disposable Hyper-V VM only"]
    fn vm_remove_weather() {
        let dir = vm_dir();
        let full_name = weather_name();
        let before = snapshot();
        let weather = before["weather"].as_array().unwrap();
        assert_eq!(weather.len(), 1);
        assert_eq!(weather[0]["PackageFullName"], full_name);
        let location = weather[0]["InstallLocation"]
            .as_str()
            .expect("Weather install location");
        let manifest = Path::new(location).join("AppxManifest.xml");
        assert!(manifest.is_file(), "Weather restore manifest must exist");
        save_evidence(
            &dir.join("before.json"),
            &json!({
                "computerName": GUEST,
                "weatherPackageFullName": full_name,
                "weatherManifestPath": manifest,
                "inventory": before,
            }),
        );
        let journal_dir = dir.join("real-removal");
        fs::create_dir_all(&journal_dir).unwrap();
        let journal = Journal::new(&journal_dir);
        assert!(!journal.path.exists(), "use a fresh removal journal");
        let record =
            remove_inner(&WindowsPackages, &journal, &full_name).expect("production removal path");
        let after = snapshot();
        let repeated = if record.status == RemovalStatus::Removed {
            Some(
                remove_inner(&NativeReadOnly, &journal, &full_name)
                    .expect_err("repeated removal must be refused"),
            )
        } else {
            None
        };
        save_evidence(
            &dir.join("after.json"),
            &json!({
                "record": record,
                "durableJournal": journal.load().expect("durable result"),
                "repeatedRemovalRefusal": repeated,
                "inventory": after,
            }),
        );
        assert_eq!(record.status, RemovalStatus::Removed);
        assert!(after["weather"].as_array().unwrap().is_empty());
        let before: Value =
            serde_json::from_slice(&fs::read(dir.join("before.json")).unwrap()).unwrap();
        let prior = before["inventory"]["critical"].as_array().unwrap();
        let current = after["critical"].as_array().unwrap();
        for entry in prior {
            assert!(
                current
                    .iter()
                    .any(|p| p["PackageFullName"] == entry["PackageFullName"]),
                "critical package disappeared: {entry}"
            );
        }
    }

    #[test]
    #[ignore = "disposable Hyper-V VM only; seed pending after real Weather removal"]
    fn vm_seed_pending_absent() {
        let dir = vm_dir();
        let full_name = before_name(&dir);
        assert!(!WindowsPackages
            .scan()
            .unwrap()
            .iter()
            .any(|p| p.full_name == full_name));
        let pending_dir = dir.join("pending-absent");
        fs::create_dir_all(&pending_dir).unwrap();
        pending(&pending_dir, &full_name);
    }

    #[test]
    #[ignore = "disposable Hyper-V VM only; separate process after pending-absent seed"]
    fn vm_reconcile_pending_absent() {
        let dir = vm_dir().join("pending-absent");
        let journal = Journal::new(&dir);
        let records = journal.load().expect("pending journal");
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].status, RemovalStatus::Pending);
        assert!(!WindowsPackages
            .scan()
            .unwrap()
            .iter()
            .any(|p| p.full_name == records[0].package_full_name));
        let outcome = reconcile(&NativeReadOnly, &journal).expect("native reconciliation");
        assert_eq!(outcome[0].status, RemovalStatus::Removed);
        assert_eq!(journal.load().unwrap()[0].status, RemovalStatus::Removed);
        save_evidence(
            &dir.join("reconciled.json"),
            &json!({"observed": "absent", "record": outcome[0]}),
        );
    }

    #[test]
    #[ignore = "read-only host inventory; run explicitly outside the mock suite"]
    fn native_inventory() {
        let apps = inventory(&WindowsPackages).expect("native package and removability inventory");
        assert!(apps.len() >= CATALOG.len());
        for app in apps {
            println!(
                "{}: installed={} removable={} package={:?} reason={:?}",
                app.catalog_id, app.installed, app.removable, app.package_full_name, app.reason
            );
        }
    }

    struct FailingPackages {
        scan_count: Cell<usize>,
        remove_count: Cell<usize>,
        fail_scan_at: usize,
        fail_remove: bool,
    }

    impl FailingPackages {
        fn new(fail_scan_at: usize, fail_remove: bool) -> Self {
            Self {
                scan_count: Cell::new(0),
                remove_count: Cell::new(0),
                fail_scan_at,
                fail_remove,
            }
        }

        fn weather() -> PackageInfo {
            PackageInfo {
                full_name: "Microsoft.BingWeather_1.0.0.0_x64__8wekyb3d8bbwe".into(),
                name: WEATHER.into(),
                publisher_id: "8wekyb3d8bbwe".into(),
                publisher: "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US".into(),
                store_signed: true,
                framework: false,
                resource: false,
                optional: false,
                dependencies: vec![],
            }
        }
    }

    impl PackageSystem for FailingPackages {
        fn scan(&self) -> Result<Vec<PackageInfo>, String> {
            let count = self.scan_count.get() + 1;
            self.scan_count.set(count);
            if count == self.fail_scan_at {
                Err("simulated native scan failure".into())
            } else {
                Ok(vec![Self::weather()])
            }
        }

        fn nonremovable(&self) -> Result<HashMap<String, bool>, String> {
            Ok(HashMap::from([(Self::weather().full_name, false)]))
        }

        fn remove(&self, _: &str) -> Result<(), String> {
            self.remove_count.set(self.remove_count.get() + 1);
            if self.fail_remove {
                Err("simulated native removal refusal".into())
            } else {
                Ok(())
            }
        }
    }

    fn mock_journal() -> Journal {
        let dir = std::env::temp_dir().join(format!(
            "pc-tweaker-debloat-failure-test-{}-{}",
            std::process::id(),
            TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        Journal::new(&dir)
    }

    #[test]
    fn initial_native_scan_failure_does_not_remove() {
        let system = FailingPackages::new(1, false);
        let journal = mock_journal();
        assert!(remove_inner(&system, &journal, &FailingPackages::weather().full_name).is_err());
        assert_eq!(system.remove_count.get(), 0);
        assert!(journal.load().unwrap().is_empty());
    }

    #[test]
    fn native_removal_refusal_records_failed_without_retry() {
        let system = FailingPackages::new(0, true);
        let journal = mock_journal();
        let record =
            remove_inner(&system, &journal, &FailingPackages::weather().full_name).unwrap();
        assert_eq!(record.status, RemovalStatus::Failed);
        assert_eq!(
            record.error.as_deref(),
            Some("simulated native removal refusal")
        );
        assert_eq!(system.remove_count.get(), 1);
        assert_eq!(journal.load().unwrap()[0].status, RemovalStatus::Failed);
    }

    #[test]
    fn scan_failure_after_native_call_records_unknown() {
        let system = FailingPackages::new(3, false);
        let journal = mock_journal();
        let record =
            remove_inner(&system, &journal, &FailingPackages::weather().full_name).unwrap();
        assert_eq!(record.status, RemovalStatus::Unknown);
        assert_eq!(
            record.error.as_deref(),
            Some("simulated native scan failure")
        );
        assert_eq!(system.remove_count.get(), 1);
        assert_eq!(journal.load().unwrap()[0].status, RemovalStatus::Unknown);
    }

    #[test]
    fn corrupt_journal_refuses_native_mutation() {
        let system = FailingPackages::new(0, false);
        let journal = mock_journal();
        fs::create_dir_all(journal.path.parent().unwrap()).unwrap();
        fs::write(&journal.path, b"{corrupt").unwrap();
        let error =
            remove_inner(&system, &journal, &FailingPackages::weather().full_name).unwrap_err();
        assert!(error.contains("journal is damaged"));
        assert_eq!(system.scan_count.get(), 0);
        assert_eq!(system.remove_count.get(), 0);
        assert_eq!(fs::read(&journal.path).unwrap(), b"{corrupt");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};
    use std::collections::VecDeque;

    struct Fake {
        scans: RefCell<VecDeque<Vec<PackageInfo>>>,
        last: RefCell<Vec<PackageInfo>>,
        flags: HashMap<String, bool>,
        removals: Cell<usize>,
    }

    impl Fake {
        fn new(scans: Vec<Vec<PackageInfo>>) -> Self {
            let info = sample();
            Self {
                scans: RefCell::new(scans.into()),
                last: RefCell::new(vec![info.clone()]),
                flags: HashMap::from([(info.full_name, false)]),
                removals: Cell::new(0),
            }
        }
    }

    impl PackageSystem for Fake {
        fn scan(&self) -> Result<Vec<PackageInfo>, String> {
            if let Some(next) = self.scans.borrow_mut().pop_front() {
                *self.last.borrow_mut() = next;
            }
            Ok(self.last.borrow().clone())
        }
        fn nonremovable(&self) -> Result<HashMap<String, bool>, String> {
            Ok(self.flags.clone())
        }
        fn remove(&self, _: &str) -> Result<(), String> {
            self.removals.set(self.removals.get() + 1);
            Ok(())
        }
    }

    fn sample() -> PackageInfo {
        PackageInfo {
            full_name: "Microsoft.BingWeather_1.0.0.0_x64__8wekyb3d8bbwe".into(),
            name: "Microsoft.BingWeather".into(),
            publisher_id: "8wekyb3d8bbwe".into(),
            publisher:
                "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US"
                    .into(),
            store_signed: true,
            framework: false,
            resource: false,
            optional: false,
            dependencies: vec![],
        }
    }

    fn temp_journal() -> Journal {
        static TEST_SEQ: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "pc-tweaker-debloat-test-{}-{}",
            std::process::id(),
            TEST_SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        Journal::new(&dir)
    }

    #[test]
    fn only_exact_curated_unprotected_identity_can_be_removed() {
        let original = sample();
        for changed in [
            PackageInfo {
                name: "Microsoft.WindowsStore".into(),
                ..original.clone()
            },
            PackageInfo {
                publisher_id: "malicious".into(),
                ..original.clone()
            },
            PackageInfo {
                publisher: "CN=Other Publisher".into(),
                ..original.clone()
            },
            PackageInfo {
                store_signed: false,
                ..original.clone()
            },
            PackageInfo {
                framework: true,
                ..original.clone()
            },
            PackageInfo {
                resource: true,
                ..original.clone()
            },
            PackageInfo {
                optional: true,
                ..original.clone()
            },
        ] {
            let fake = Fake::new(vec![vec![changed]]);
            let journal = temp_journal();
            assert!(remove_inner(&fake, &journal, &original.full_name).is_err());
            assert_eq!(fake.removals.get(), 0);
        }
        let mut dependent = original.clone();
        dependent.full_name = "Other.Package_1.0.0.0_x64__publisher".into();
        dependent.dependencies = vec![original.full_name.clone()];
        let fake = Fake::new(vec![vec![original.clone(), dependent]]);
        assert!(remove_inner(&fake, &temp_journal(), &original.full_name).is_err());
        assert_eq!(fake.removals.get(), 0);
        let mut fake = Fake::new(vec![vec![original.clone()]]);
        fake.flags.insert(original.full_name.clone(), true);
        assert!(remove_inner(&fake, &temp_journal(), &original.full_name).is_err());
        assert_eq!(fake.removals.get(), 0);
    }

    #[test]
    fn pending_is_durable_before_remove_and_repeated_removal_is_refused() {
        let info = sample();
        let fake = Fake::new(vec![vec![info.clone()], vec![info.clone()], vec![], vec![]]);
        let journal = temp_journal();
        let result = remove_inner(&fake, &journal, &info.full_name).unwrap();
        assert_eq!(result.status, RemovalStatus::Removed);
        assert_eq!(fake.removals.get(), 1);
        assert_eq!(journal.load().unwrap()[0].status, RemovalStatus::Removed);
        assert!(remove_inner(&fake, &journal, &info.full_name).is_err());
        assert_eq!(fake.removals.get(), 1);
    }

    #[test]
    fn failed_pending_write_never_calls_windows() {
        let info = sample();
        let fake = Fake::new(vec![vec![info.clone()]]);
        let mut journal = temp_journal();
        journal.fail_save = true;
        assert!(remove_inner(&fake, &journal, &info.full_name).is_err());
        assert_eq!(fake.removals.get(), 0);
    }

    #[test]
    fn failed_outcome_write_leaves_pending_for_reconciliation() {
        let info = sample();
        let fake = Fake::new(vec![vec![info.clone()], vec![info.clone()], vec![]]);
        let journal = temp_journal();
        journal.fail_on_save.set(Some(2));
        assert!(remove_inner(&fake, &journal, &info.full_name).is_err());
        assert_eq!(fake.removals.get(), 1);
        assert_eq!(journal.load().unwrap()[0].status, RemovalStatus::Pending);
        journal.fail_on_save.set(None);
        let recovery = Fake::new(vec![vec![]]);
        assert_eq!(
            reconcile(&recovery, &journal).unwrap()[0].status,
            RemovalStatus::Removed
        );
        assert_eq!(recovery.removals.get(), 0);
    }

    #[test]
    fn successful_api_call_with_package_still_present_is_unknown() {
        let info = sample();
        let fake = Fake::new(vec![
            vec![info.clone()],
            vec![info.clone()],
            vec![info.clone()],
        ]);
        let result = remove_inner(&fake, &temp_journal(), &info.full_name).unwrap();
        assert_eq!(result.status, RemovalStatus::Unknown);
        assert_eq!(fake.removals.get(), 1);
    }

    #[test]
    fn journal_lock_serializes_across_handles() {
        use std::sync::mpsc;
        use std::time::Duration;
        let journal = temp_journal();
        let first = journal.lock().unwrap();
        let (sender, receiver) = mpsc::channel();
        let path = journal.path.clone();
        let worker = std::thread::spawn(move || {
            let second = Journal {
                path,
                fail_save: false,
                fail_on_save: Cell::new(None),
                save_count: Cell::new(0),
            };
            let _guard = second.lock().unwrap();
            sender.send(()).unwrap();
        });
        assert!(receiver.recv_timeout(Duration::from_millis(50)).is_err());
        drop(first);
        receiver.recv_timeout(Duration::from_secs(2)).unwrap();
        worker.join().unwrap();
    }

    #[test]
    fn interrupted_pending_is_reconciled_without_retry() {
        let info = sample();
        for (after, expected) in [
            (vec![], RemovalStatus::Removed),
            (vec![info.clone()], RemovalStatus::Unknown),
        ] {
            let journal = temp_journal();
            let record = DebloatRecord {
                catalog_id: "weather".into(),
                package_full_name: info.full_name.clone(),
                publisher_id: info.publisher_id.clone(),
                scope: "currentUser".into(),
                status: RemovalStatus::Pending,
                error: None,
                timestamp: 1,
            };
            journal.save(&[record]).unwrap();
            let fake = Fake::new(vec![after]);
            assert_eq!(reconcile(&fake, &journal).unwrap()[0].status, expected);
            assert_eq!(fake.removals.get(), 0);
        }
    }

    #[test]
    fn identity_change_after_pending_blocks_remove() {
        let info = sample();
        let changed = PackageInfo {
            publisher_id: "malicious".into(),
            ..info.clone()
        };
        let fake = Fake::new(vec![
            vec![info.clone()],
            vec![changed.clone()],
            vec![changed],
        ]);
        let record = remove_inner(&fake, &temp_journal(), &info.full_name).unwrap();
        assert_eq!(record.status, RemovalStatus::Failed);
        assert_eq!(fake.removals.get(), 0);
    }
}

#[cfg(not(windows))]
impl PackageSystem for WindowsPackages {
    fn scan(&self) -> Result<Vec<PackageInfo>, String> {
        Err("Debloat requires Windows".into())
    }
    fn nonremovable(&self) -> Result<HashMap<String, bool>, String> {
        Err("Debloat requires Windows".into())
    }
    fn remove(&self, _: &str) -> Result<(), String> {
        Err("Debloat requires Windows".into())
    }
}
