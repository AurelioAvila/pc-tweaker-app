//! The Pro "Windows Update alert".
//!
//! A scheduled task wakes when Windows Update reports an installed update and
//! at sign-in, runs the same read-only check the window runs on open
//! (`updatewatch::check`), and shows one notification when an update left
//! settings the user applied changed. Its Restore button opens the app on the
//! alert dialog; nothing is ever re-applied from here.
//!
//! The task exists only while Pro is active and the user has not switched the
//! alert off. The app reconciles that on start and whenever the licence
//! changes, the task removes itself when it finds Pro gone, and the installer
//! removes it on uninstall (windows/installer-hooks.nsh for the setup,
//! windows/uninstall-cleanup.wxs for the MSI).

use std::path::{Path, PathBuf};

/// Plainly named at the scheduler root, like the other two tasks.
pub const TASK_NAME: &str = "PC Tweaker Windows Update alert";
/// The argument the task starts the app with (main.rs).
pub const FLAG: &str = "--update-alert";
/// The per-user URL scheme the notification opens. Registered only while the
/// alert is on; it starts the app with no arguments and nothing else.
pub const PROTOCOL: &str = "pctweaker-alert";
/// Present when the user switched the alert off.
const OFF_FILE: &str = "update-alert-off";
/// The window's language, for the notification text (`set_tray_language`).
const LANGUAGE_FILE: &str = "ui-language";

/// Event 19 ("Installation Successful") as WindowsUpdateClient writes it: to
/// the System log. Checked on Windows 11 build 26300 on 2 Nov 2026, where the
/// WindowsUpdateClient/Operational channel only carried events 26, 31 and 41.
/// Defender definition and Store updates write it too, so the check runs a few
/// times a day; it reads the registry and exits in a fraction of a second.
const EVENT_QUERY: &str =
    "*[System[Provider[@Name='Microsoft-Windows-WindowsUpdateClient'] and EventID=19]]";

fn xml_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// The task definition. Two triggers: the update event (a cumulative update
/// that needs a restart reverts settings during that restart, so the event
/// alone could come too early) and sign-in. Limited rights, the user's own
/// session, battery allowed, one instance, two minutes at most.
pub fn task_xml(exe: &str, user: &str) -> String {
    // The subscription is XML inside an XML element: escaped twice.
    let subscription = xml_escape(&format!(
        "<QueryList><Query Id=\"0\" Path=\"System\"><Select Path=\"System\">{}</Select></Query></QueryList>",
        xml_escape(EVENT_QUERY)
    ));
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>PC Tweaker</Author>
    <Description>Tells you when a Windows update has changed settings you applied with PC Tweaker. Reads only; it never changes a setting. Turn it off in PC Tweaker, History.</Description>
  </RegistrationInfo>
  <Triggers>
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>{subscription}</Subscription>
      <Delay>PT1M</Delay>
    </EventTrigger>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>{user}</UserId>
      <Delay>PT1M</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT2M</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{exe}</Command>
      <Arguments>{FLAG}</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        user = xml_escape(user),
        exe = xml_escape(exe),
    )
}

/// The notification text in the window's language (en, it, fr, es, de, pt).
pub struct Texts {
    pub title_one: &'static str,
    pub title_many: &'static str,
    pub body: &'static str,
    pub restore_one: &'static str,
    pub restore_many: &'static str,
    pub not_now: &'static str,
    pub drift_one: &'static str,
    pub drift_many: &'static str,
    pub drift_body: &'static str,
}

pub fn texts(language: &str) -> Texts {
    match language.get(..2).unwrap_or("") {
        "it" => Texts {
            title_one: "Un aggiornamento di Windows ha cambiato 1 delle tue impostazioni",
            title_many: "Un aggiornamento di Windows ha cambiato {count} delle tue impostazioni",
            body: "Non sono più come le avevi scelte con PC Tweaker. Puoi ripristinarle con un clic.",
            restore_one: "Ripristina",
            restore_many: "Ripristina {count}",
            not_now: "Non ora",
            drift_one: "1 impostazione applicata non è più attiva",
            drift_many: "{count} impostazioni applicate non sono più attive",
            drift_body: "Apri PC Tweaker per applicarle di nuovo.",
        },
        "fr" => Texts {
            title_one: "Une mise à jour de Windows a modifié 1 de vos réglages",
            title_many: "Une mise à jour de Windows a modifié {count} de vos réglages",
            body: "Ils ne sont plus tels que vous les aviez choisis dans PC Tweaker. Vous pouvez les rétablir en un clic.",
            restore_one: "Rétablir",
            restore_many: "Rétablir ({count})",
            not_now: "Plus tard",
            drift_one: "1 réglage appliqué n'est plus actif",
            drift_many: "{count} réglages appliqués ne sont plus actifs",
            drift_body: "Ouvrez PC Tweaker pour les appliquer de nouveau.",
        },
        "es" => Texts {
            title_one: "Una actualización de Windows cambió 1 de tus ajustes",
            title_many: "Una actualización de Windows cambió {count} de tus ajustes",
            body: "Ya no están como los elegiste en PC Tweaker. Puedes restaurarlos con un clic.",
            restore_one: "Restaurar",
            restore_many: "Restaurar {count}",
            not_now: "Ahora no",
            drift_one: "1 ajuste aplicado ya no está activo",
            drift_many: "{count} ajustes aplicados ya no están activos",
            drift_body: "Abre PC Tweaker para volver a aplicarlos.",
        },
        "de" => Texts {
            title_one: "Ein Windows-Update hat 1 deiner Einstellungen geändert",
            title_many: "Ein Windows-Update hat {count} deiner Einstellungen geändert",
            body: "Diese Einstellungen sind nicht mehr so, wie du sie mit PC Tweaker gewählt hast. Du kannst sie mit einem Klick wiederherstellen.",
            restore_one: "Wiederherstellen",
            restore_many: "{count} wiederherstellen",
            not_now: "Nicht jetzt",
            drift_one: "1 angewendete Einstellung ist nicht mehr aktiv",
            drift_many: "{count} angewendete Einstellungen sind nicht mehr aktiv",
            drift_body: "Öffne PC Tweaker, um sie erneut anzuwenden.",
        },
        "pt" => Texts {
            title_one: "Uma atualização do Windows alterou 1 das suas definições",
            title_many: "Uma atualização do Windows alterou {count} das suas definições",
            body: "Já não estão como as escolheu no PC Tweaker. Pode repô-las com um clique.",
            restore_one: "Repor",
            restore_many: "Repor {count}",
            not_now: "Agora não",
            drift_one: "1 definição aplicada já não está ativa",
            drift_many: "{count} definições aplicadas já não estão ativas",
            drift_body: "Abra o PC Tweaker para as aplicar novamente.",
        },
        _ => Texts {
            title_one: "A Windows update changed 1 of your settings",
            title_many: "A Windows update changed {count} of your settings",
            body: "They are no longer the way you set them in PC Tweaker. Restore them in one click.",
            restore_one: "Restore",
            restore_many: "Restore {count}",
            not_now: "Not now",
            drift_one: "1 applied setting is no longer in effect",
            drift_many: "{count} applied settings are no longer in effect",
            drift_body: "Open PC Tweaker to apply them again.",
        },
    }
}

fn counted(template: &str, count: usize) -> String {
    template.replace("{count}", &count.to_string())
}

/// The window's language as last reported, English when never reported.
pub fn language(dir: &Path) -> String {
    std::fs::read_to_string(dir.join(LANGUAGE_FILE))
        .ok()
        .map(|l| l.trim().chars().take(8).collect())
        .unwrap_or_default()
}

/// Remembers the window's language for the notifications, only when it changed.
pub fn save_language(dir: &Path, language: &str) {
    let language: String = language
        .chars()
        .filter(char::is_ascii_alphabetic)
        .take(8)
        .collect();
    if self::language(dir) != language && std::fs::create_dir_all(dir).is_ok() {
        let _ = std::fs::write(dir.join(LANGUAGE_FILE), language);
    }
}

/// Whether the task should exist: Pro, and not switched off.
pub fn wanted(dir: &Path) -> bool {
    crate::require_pro(dir).is_ok() && !dir.join(OFF_FILE).exists()
}

// ---------------------------------------------------------------------------
// Windows: the task, the URL scheme and the notification.

/// What the task and the scheme were last set to by this process, so the
/// licence refresh on every window focus costs nothing when nothing changed.
#[cfg(windows)]
static KNOWN: std::sync::Mutex<Option<bool>> = std::sync::Mutex::new(None);

#[cfg(windows)]
fn schtasks(args: &[&str]) -> Result<std::process::Output, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    crate::system_tools::run("schtasks", |tool| {
        tool.args(args).creation_flags(CREATE_NO_WINDOW);
        crate::system_tools::output_within(tool, crate::system_tools::QUICK)
    })
    .map_err(|e| format!("could not run schtasks: {e}"))
}

#[cfg(windows)]
fn failure(output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        format!("Task Scheduler exited with code {:?}", output.status.code())
    } else {
        stderr
    }
}

/// Whether the task is registered right now.
#[cfg(windows)]
pub fn registered() -> bool {
    schtasks(&["/query", "/tn", TASK_NAME]).is_ok_and(|o| o.status.success())
}

#[cfg(windows)]
fn register_protocol(exe: &str) -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    let root = winreg::RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = root
        .create_subkey(format!(r"Software\Classes\{PROTOCOL}"))
        .map_err(|e| e.to_string())?;
    key.set_value("", &"URL:PC Tweaker Windows Update alert")
        .and_then(|_| key.set_value("URL Protocol", &""))
        .map_err(|e| e.to_string())?;
    let (icon, _) = key
        .create_subkey("DefaultIcon")
        .map_err(|e| e.to_string())?;
    icon.set_value("", &format!("\"{exe}\",0"))
        .map_err(|e| e.to_string())?;
    // No "%1": the link carries nothing the app reads. Opening it only starts
    // (or brings forward) the app, which then shows the alert by itself.
    let (command, _) = key
        .create_subkey(r"shell\open\command")
        .map_err(|e| e.to_string())?;
    command
        .set_value("", &format!("\"{exe}\""))
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn remove_protocol() {
    use winreg::enums::HKEY_CURRENT_USER;
    let _ = winreg::RegKey::predef(HKEY_CURRENT_USER)
        .delete_subkey_all(format!(r"Software\Classes\{PROTOCOL}"));
}

/// Creates or removes the task and its URL scheme. Creating writes the task
/// definition next to the app's data for the moment `schtasks` reads it.
#[cfg(windows)]
fn apply(dir: &Path, on: bool) -> Result<(), String> {
    if !on {
        remove_protocol();
        let output = schtasks(&["/delete", "/f", "/tn", TASK_NAME])?;
        // "Not found" is the state that was asked for.
        return if output.status.success() || !registered() {
            Ok(())
        } else {
            Err(failure(&output))
        };
    }
    let exe = std::env::current_exe()
        .map_err(|e| format!("could not locate the application: {e}"))?
        .to_string_lossy()
        .into_owned();
    create_task(dir, TASK_NAME, &exe)?;
    register_protocol(&exe)
}

/// Registers `name` from `task_xml`, for the signed-in user. The definition
/// is written next to the app's data for the moment `schtasks` reads it.
#[cfg(windows)]
fn create_task(dir: &Path, name: &str, exe: &str) -> Result<(), String> {
    let user = match (std::env::var("USERDOMAIN"), std::env::var("USERNAME")) {
        (Ok(domain), Ok(user)) if !domain.is_empty() => format!("{domain}\\{user}"),
        (_, Ok(user)) => user,
        _ => return Err("could not read the signed-in user's name".into()),
    };
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let file: PathBuf = dir.join(format!("update-alert-task-{}.xml", std::process::id()));
    // Task Scheduler reads UTF-16 with a byte-order mark.
    let mut bytes = vec![0xFF, 0xFE];
    bytes.extend(
        task_xml(exe, &user)
            .encode_utf16()
            .flat_map(u16::to_le_bytes),
    );
    std::fs::write(&file, bytes).map_err(|e| e.to_string())?;
    let path = file.to_string_lossy().into_owned();
    let result = schtasks(&["/create", "/f", "/tn", name, "/xml", &path]);
    let _ = std::fs::remove_file(&file);
    let output = result?;
    if output.status.success() {
        Ok(())
    } else {
        Err(failure(&output))
    }
}

/// Brings the task in line with `wanted`. Cheap when nothing changed since
/// this process last looked. Returns whether the alert is on now.
#[cfg(windows)]
pub fn reconcile(dir: &Path) -> Result<bool, String> {
    let want = wanted(dir);
    let mut known = KNOWN.lock().unwrap_or_else(|p| p.into_inner());
    let first = known.is_none();
    let current = known.unwrap_or_else(registered);
    if current != want {
        apply(dir, want)?;
        crate::audit::record(
            "update-alert",
            if want { "enabled" } else { "disabled" },
            true,
            None,
        );
    } else if want && first {
        // Once per run: the app may have been updated into another folder,
        // and the task and the scheme must start this program.
        apply(dir, true)?;
    }
    *known = Some(want);
    Ok(want)
}

#[cfg(not(windows))]
pub fn reconcile(_dir: &Path) -> Result<bool, String> {
    Ok(false)
}

/// For the licence paths, which must never wait on Task Scheduler.
pub fn reconcile_in_background(dir: PathBuf) {
    std::thread::spawn(move || {
        let _ = reconcile(&dir);
    });
}

/// One notification. The AppID has to be one Windows already knows, or the
/// toast is dropped with no error at all: both real identities are asked for
/// by name (Store package first, then the desktop bundle's shortcut), and if
/// neither is registered (a portable copy, a dev build) nothing is sent. The
/// alert in the window says the same thing the next time it opens.
///
/// With `buttons` (Pro alert): Restore and the body open the app through
/// `PROTOCOL`; Not now only closes the notification.
#[cfg(windows)]
pub fn notify(title: &str, body: &str, buttons: Option<(&str, &str)>) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let xml = toast_xml(title, body, buttons);
    // A single-quoted here-string takes the XML literally; it can only end at
    // a line that starts with '@, which escaped XML never contains.
    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] > $null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType=WindowsRuntime] > $null
$known = @(Get-StartApps | Select-Object -ExpandProperty AppID)
$appId = $null
foreach ($c in @('AurelioAvila.PCTweaker_27nraqq9g21x0!App', 'com.aurel.pc-tweaker-app')) {{
  if ($known -contains $c) {{ $appId = $c; break }}
}}
if (-not $appId) {{ exit 3 }}
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml(@'
{xml}
'@)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
"#
    );
    let output = crate::system_tools::run("powershell", |tool| {
        tool.args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW);
        crate::system_tools::output_within(tool, crate::system_tools::QUICK)
    })
    .map_err(|e| format!("could not run PowerShell: {e}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// The notification's XML. Protocol activation is the one kind Windows
/// honours for a desktop app without a COM activator: the button and the body
/// open `PROTOCOL`, which starts the app (or brings it forward).
pub fn toast_xml(title: &str, body: &str, buttons: Option<(&str, &str)>) -> String {
    let link = format!("{PROTOCOL}:");
    let (launch, actions) = match buttons {
        Some((restore, not_now)) => (
            format!(r#" launch="{link}" activationType="protocol""#),
            format!(
                r#"<actions><action content="{}" activationType="protocol" arguments="{link}"/><action content="{}" activationType="system" arguments="dismiss"/></actions>"#,
                xml_escape(restore),
                xml_escape(not_now)
            ),
        ),
        None => (String::new(), String::new()),
    };
    format!(
        r#"<toast{launch}><visual><binding template="ToastGeneric"><text>{}</text><text>{}</text></binding></visual>{actions}</toast>"#,
        xml_escape(title),
        xml_escape(body)
    )
}

/// The alert's notification for `count` settings.
#[cfg(windows)]
pub fn notify_alert(dir: &Path, count: usize) -> Result<(), String> {
    let t = texts(&language(dir));
    let title = counted(
        if count == 1 {
            t.title_one
        } else {
            t.title_many
        },
        count,
    );
    let restore = counted(
        if count == 1 {
            t.restore_one
        } else {
            t.restore_many
        },
        count,
    );
    notify(&title, t.body, Some((&restore, t.not_now)))
}

/// The free sign-in check's notification: no buttons, the window does the rest.
#[cfg(windows)]
pub fn notify_drift(dir: &Path, count: usize, after_update: bool) -> Result<(), String> {
    let t = texts(&language(dir));
    let title = if after_update {
        counted(
            if count == 1 {
                t.title_one
            } else {
                t.title_many
            },
            count,
        )
    } else {
        counted(
            if count == 1 {
                t.drift_one
            } else {
                t.drift_many
            },
            count,
        )
    };
    notify(&title, t.drift_body, None)
}

// ---------------------------------------------------------------------------
// Commands.

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertStatus {
    /// The task is registered.
    pub on: bool,
    /// The user has not switched it off (it turns on again with Pro).
    pub chosen: bool,
}

#[tauri::command(async)]
pub fn update_alert_status(app: tauri::AppHandle) -> Result<AlertStatus, String> {
    let dir = crate::store_for_dir(&app)?;
    Ok(AlertStatus {
        on: reconcile(&dir)?,
        chosen: !dir.join(OFF_FILE).exists(),
    })
}

/// Switching on needs Pro; switching off never does.
#[tauri::command(async)]
pub fn set_update_alert(app: tauri::AppHandle, enabled: bool) -> Result<AlertStatus, String> {
    let dir = crate::store_for_dir(&app)?;
    if enabled {
        crate::require_pro(&dir)?;
        match std::fs::remove_file(dir.join(OFF_FILE)) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
    } else {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        std::fs::write(dir.join(OFF_FILE), b"off").map_err(|e| e.to_string())?;
    }
    let on = reconcile(&dir)?;
    if on != enabled {
        return Err("Windows did not keep the update alert task".into());
    }
    Ok(AlertStatus {
        on,
        chosen: enabled,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_task_definition_escapes_everything_it_embeds() {
        let xml = task_xml(r"C:\Apps & Tools\PC Tweaker.exe", "PC<1>\\o'neil");
        assert!(xml.contains(r"<Command>C:\Apps &amp; Tools\PC Tweaker.exe</Command>"));
        assert!(xml.contains("<UserId>PC&lt;1&gt;\\o&apos;neil</UserId>"));
        assert!(xml.contains(&format!("<Arguments>{FLAG}</Arguments>")));
        // The query is escaped twice: once as a query, once as element text.
        assert!(xml.contains("Provider[@Name=&amp;apos;Microsoft-Windows-WindowsUpdateClient&amp;apos;] and EventID=19"));
        assert!(xml.contains("&lt;Select Path=&quot;System&quot;&gt;"));
        assert!(!xml.contains("<QueryList>"));
    }

    #[test]
    fn the_task_is_light_and_never_elevated() {
        let xml = task_xml("C:\\x.exe", "u");
        for needle in [
            "<RunLevel>LeastPrivilege</RunLevel>",
            "<LogonType>InteractiveToken</LogonType>",
            "<ExecutionTimeLimit>PT2M</ExecutionTimeLimit>",
            "<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>",
            "<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>",
            "<EventTrigger>",
            "<LogonTrigger>",
        ] {
            assert!(xml.contains(needle), "{needle}");
        }
        assert!(!xml.contains("HighestAvailable"));
        assert!(!TASK_NAME.contains(['\\', '/']));
    }

    #[test]
    fn every_language_counts_and_falls_back_to_english() {
        for lang in ["en", "it", "fr", "es", "de", "pt", "pt-PT"] {
            let t = texts(lang);
            for many in [t.title_many, t.restore_many, t.drift_many] {
                assert!(many.contains("{count}"), "{lang}: {many}");
            }
            for one in [t.title_one, t.drift_one] {
                assert!(
                    one.contains('1') && !one.contains("{count}"),
                    "{lang}: {one}"
                );
            }
            assert!(!t.body.is_empty() && !t.not_now.is_empty());
        }
        assert_eq!(texts("").not_now, "Not now");
        assert_eq!(texts("zz").not_now, "Not now");
        assert_eq!(
            counted(texts("en").title_many, 3),
            "A Windows update changed 3 of your settings"
        );
    }

    #[test]
    fn the_language_file_holds_a_short_code_only() {
        let dir = std::env::temp_dir().join(format!("pct-alert-lang-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(language(&dir), "");
        save_language(&dir, "de");
        assert_eq!(language(&dir), "de");
        save_language(&dir, "../../evil\nfile");
        assert_eq!(language(&dir), "evilfile");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn the_uninstaller_removes_every_task_and_the_scheme() {
        let hooks = include_str!("../windows/installer-hooks.nsh");
        for name in [
            TASK_NAME,
            crate::updatewatch::TASK_NAME,
            crate::TEMP_CLEANUP_TASK,
        ] {
            assert!(
                hooks.contains(&format!("PCT_DELETE_TASK \"{name}\"")),
                "{name}"
            );
        }
        assert!(hooks.contains(&format!(
            r#"DeleteRegKey HKCU "Software\Classes\{PROTOCOL}""#
        )));
        assert!(hooks.contains("${If} $UpdateMode <> 1"));
        // The MSI does the same through its WiX fragment, linked from tauri.conf.json.
        let wix = include_str!("../windows/uninstall-cleanup.wxs");
        for name in [
            TASK_NAME,
            crate::updatewatch::TASK_NAME,
            crate::TEMP_CLEANUP_TASK,
        ] {
            assert!(
                wix.contains(&format!("/TN &quot;{name}&quot;")),
                "{name}"
            );
        }
        assert!(wix.contains(&format!(
            r#"Key="Software\Classes\{PROTOCOL}" Action="removeOnUninstall""#
        )));
        assert_eq!(wix.matches("REMOVE~=\"ALL\" AND NOT UPGRADINGPRODUCTCODE").count(), 3);
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let msi = &conf["bundle"]["windows"]["wix"];
        assert_eq!(msi["fragmentPaths"][0], "./windows/uninstall-cleanup.wxs");
        assert_eq!(msi["componentGroupRefs"][0], "PctUninstallCleanup");
    }

    #[test]
    fn the_notification_opens_the_app_and_never_breaks_its_script() {
        let xml = toast_xml("A & B's <title>", "Body", Some(("Restore 3", "Not now")));
        assert!(xml.starts_with(r#"<toast launch="pctweaker-alert:" activationType="protocol">"#));
        assert!(xml.contains("<text>A &amp; B&apos;s &lt;title&gt;</text>"));
        assert!(xml.contains(r#"<action content="Restore 3" activationType="protocol" arguments="pctweaker-alert:"/>"#));
        assert!(xml.contains(r#"activationType="system" arguments="dismiss""#));
        // The PowerShell here-string ends only at a line starting with '@.
        assert!(!xml.contains('\n'));
        let plain = toast_xml("t", "b", None);
        assert!(!plain.contains("actions") && !plain.contains("launch"));
    }

    /// Run by hand (`cargo test -- --ignored task_scheduler`): registers the
    /// real definition under a test name, reads it back and deletes it.
    #[cfg(windows)]
    #[test]
    #[ignore = "creates a temporary scheduled task for the signed-in user"]
    fn task_scheduler_accepts_the_definition() {
        let name = "PC Tweaker test task - safe to delete";
        let dir = std::env::temp_dir().join(format!("pct-alert-task-{}", std::process::id()));
        create_task(&dir, name, r"C:\Windows\System32\cmd.exe").expect("schtasks /create /xml");
        let xml = schtasks(&["/query", "/tn", name, "/xml"]).expect("schtasks /query");
        let text = crate::task_xml_text(&xml.stdout);
        let _ = schtasks(&["/delete", "/f", "/tn", name]);
        let _ = std::fs::remove_dir_all(&dir);
        for needle in [
            "EventID=19",
            "Microsoft-Windows-WindowsUpdateClient",
            "<LogonTrigger>",
            "<LogonType>InteractiveToken</LogonType>",
            "<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>",
            FLAG,
        ] {
            assert!(text.contains(needle), "{needle} in\n{text}");
        }
        // Windows leaves the default (limited rights) out of what it stores.
        assert!(!text.contains("HighestAvailable"), "{text}");
    }

    #[test]
    fn no_licence_means_no_task() {
        let dir = std::env::temp_dir().join(format!("pct-alert-pro-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        #[cfg(not(feature = "test-pro"))]
        assert!(!wanted(&dir));
        std::fs::remove_dir_all(&dir).ok();
    }
}
