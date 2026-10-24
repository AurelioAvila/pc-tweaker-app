import type { Step } from "../components/ReferenceBlocks";

/**
 * Removal guides under /uninstaller/guides/: one per program people search
 * how to remove, vendor route first. Every path, service name and command was
 * checked against the sources listed on its page on the date below, or read
 * from a Windows 11 PC (build 26300) where the guide says so. Details that
 * could not be verified were left out rather than guessed.
 *
 * What the app does is described from the shipping source of
 * pc-tweaker-uninstaller: confidence.rs (Safe/Review/Keep bands), residue.rs
 * (leftover scan), relations.rs (publisher siblings), restore_point.rs.
 */
const CHECKED = "24 October 2026";
const DATE = "2026-10-24";
const SRC = "https://github.com/AurelioAvila/pc-tweaker-uninstaller/blob/master/src-tauri/src";

export interface RemovalCheck {
  readonly check: string;
  readonly meaning: string;
  readonly reversible: string;
}

export interface Leftovers {
  readonly heading: string;
  readonly body: string;
  /** Read-only commands: they list things, they change nothing. */
  readonly code: string;
  readonly act: readonly string[];
  readonly keep: readonly string[];
}

const SYSTEM_PROTECTION = { label: "Microsoft Support: System Protection (what restore points contain, off by default)", url: "https://support.microsoft.com/en-us/windows/experience/backup-recovery/system-protection" };
const RESTORE_API = { label: "Microsoft Learn: SRSetRestorePointW (the 24-hour rule for app-requested restore points)", url: "https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw" };
const RESIDUE = { label: "PC Tweaker Uninstaller source: the leftover scan (residue.rs)", url: `${SRC}/residue.rs` };
const CONFIDENCE = { label: "PC Tweaker Uninstaller source: the Safe, Review and Keep rules (confidence.rs)", url: `${SRC}/confidence.rs` };

const restorePoint = (specific: string) => ({
  heading: "What a restore point does and does not cover",
  body:
    "Microsoft describes restore points as snapshots of system files, installed applications, the Windows registry and system settings, taken without affecting personal data. That also means a restore point is not a backup of your files. System Protection is not enabled by default, so on a PC where nobody switched it on, a request for a restore point fails; you turn it on under Create a restore point, Configure. And when an app asks for a restore point while one made in the previous 24 hours already exists, Windows skips the new one and still reports success. " +
    specific,
});

const RECEIPT_NOTE =
  "Before an elevated removal it asks Windows for a restore point and records the outcome in the Removal Ledger. Because of the 24-hour rule above, Windows sometimes keeps an earlier point instead of making a new one. From version 0.13.8 the receipt says created only when it has verified a new point, and otherwise says that Windows reused the one from a given date; earlier versions could report created in that case.";

export const UNINSTALLER_GUIDES = {
  "/uninstaller/guides/armoury-crate": {
    product: "uninstaller" as const,
    eyebrow: "REMOVAL GUIDE · ASUS ARMOURY CRATE",
    title: "How to completely uninstall ASUS Armoury Crate",
    seoTitle: "Completely Uninstall ASUS Armoury Crate",
    seoDescription:
      "Remove Armoury Crate with ASUS's own Uninstall Tool, stop the BIOS offering to reinstall it, then check for services, Store apps and folders it can leave.",
    intro:
      "Use ASUS's Armoury Crate Uninstall Tool rather than a single entry in Installed apps. Armoury Crate is several programs and services, ASUS's tool removes them together, and ROG advises against removing it through Windows' Add or Remove Programs because an improper uninstall can cause problems. Restart afterwards, run the tool a second time if it reports a failure, and on ASUS motherboards switch off the BIOS option that offers to download it again. On ROG laptops ASUS does not recommend removing it for good, because the laptop will not perform optimally without it.",
    published: DATE,
    updated: DATE,
    checks: [
      { check: "Armoury Crate Uninstall Tool finished, then a restart", meaning: "ASUS's supported way to remove the Armoury Crate apps and services together", reversible: "Yes: reinstall Armoury Crate from ASUS's support site" },
      { check: "BIOS: Tool, ASUS Armoury Crate, Download & Install ARMOURY CRATE app set to Disabled", meaning: "The motherboard stops offering to download Armoury Crate at boot", reversible: "Yes: set it back to Enabled" },
      { check: "No Armoury Crate, ASUS Framework Service, Aura Service or ROG Live Service entry in Installed apps", meaning: "The separate components ASUS lists for older versions are gone too", reversible: "Yes, by reinstalling" },
      { check: "The service and Store-app checks below return nothing named Armoury", meaning: "No Armoury Crate service or Microsoft Store package is still registered", reversible: "Read-only check" },
      { check: "A ROG keyboard or mouse prompts a download", meaning: "ASUS documents that supported accessories can offer Armoury Crate when it is not installed", reversible: "Answer No to keep it uninstalled" },
    ],
    method: {
      heading: "The official way: ASUS's Uninstall Tool",
      intro:
        "This is the route ASUS documents for removing all Armoury Crate apps and services. There is no Armoury Crate package in winget's community repository (checked 24 October 2026).",
      steps: [
        { title: "Download the Uninstall Tool", note: "Open the Armoury Crate support page linked from ASUS's Armoury Crate FAQ, go to Driver & Utility, select the operating system (ASUS's FAQ uses Windows 10 64-bit) and download Armoury Crate Uninstall Tool. If it is not in the first entries, expand the list (Show all or Show more)." },
        { title: "Run it, then restart", note: "Unzip Armoury_Crate_Uninstall_Tool.zip, double-click Armoury Crate Uninstall Tool.exe and let it finish. ASUS says to restart the system to complete the uninstallation." },
        { title: "If it reports a failure", note: "Restart when prompted and run the tool again; ASUS says the second run should succeed. If it fails again, the tool's folder contains a log named ACUTLog_ followed by the date and time. Send that file to ASUS customer service." },
        { title: "Stop the motherboard offering it again", note: "On ASUS motherboards, press Del or F2 at power-on, switch to Advanced Mode with F7 if the board opens in EZ Mode, open Tool, then ASUS Armoury Crate, and set Download & Install ARMOURY CRATE app to Disabled. It is enabled by default." },
      ] satisfies readonly Step[],
    },
    leftovers: {
      heading: "What can stay behind, and what to keep",
      body:
        "A clean run of the tool should leave little. Older versions (ASUS names 1.4.1 and 2.1.9) installed separate entries that ASUS lists as Armoury Crate Service or Armoury Crate Lite Service, ASUS Framework Service, Aura Service and ROG Live Service, and parts of Armoury Crate come from the Microsoft Store. These read-only PowerShell commands show whether anything with those names is still registered or on disk. A service with ASUS in its name is not necessarily Armoury Crate's.",
      code: [
        "Get-Service -DisplayName '*Armoury*', '*ASUS*', '*Aura*', '*ROG Live*' |",
        "  Format-Table Name, DisplayName, Status",
        "Get-AppxPackage -Name '*Armoury*' | Format-Table Name, Version",
        "Get-ChildItem $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData, $env:LOCALAPPDATA `",
        "  -Directory -Filter '*Armoury*' -ErrorAction SilentlyContinue",
      ].join("\n"),
      act: [
        "An Armoury Crate entry still in Installed apps after the tool and a restart: run the tool again before removing anything by hand.",
        "A folder named after Armoury Crate in Program Files, ProgramData or AppData after a successful run and a restart.",
      ],
      keep: [
        "ASUS drivers and other ASUS software you still use, such as MyASUS or a chipset or audio driver package: they are separate programs.",
        "Aura Service and ROG Live Service, if you want to keep Aura Sync or Aura Creator. That is ASUS's own note for older versions.",
        "Machine-wide registry keys from ASUS: a vendor's keys can be shared by its other software, so leave them unless ASUS says otherwise.",
      ],
    },
    sections: [
      restorePoint("For Armoury Crate in particular, the BIOS option above is a firmware setting on the motherboard, outside anything a Windows restore point records."),
      {
        heading: "How PC Tweaker Uninstaller helps",
        body:
          "It lists the Armoury Crate entries it can read, classic desktop programs and Microsoft Store apps in one list, and for each one says how many other programs from the same publisher are installed, so you see the whole ASUS set before touching one entry. Its brief shows the exact command each entry registered and whether it needs administrator rights. Entries whose names mark them as drivers or chipset packages are rated Keep. It does not replace ASUS's tool: it runs each entry's own uninstaller, one at a time or queued with Pro batch removal. Its leftover scan only matches folders and per-user registry keys named exactly after the program, so a shared ASUS folder is never offered, and it does not inspect services, drivers or scheduled tasks. " +
          RECEIPT_NOTE,
      },
    ],
    related: [
      { to: "/uninstall-programs-completely/", label: "how to completely uninstall any Windows program", note: "The general order: registered uninstaller first, then leftovers, then what to keep." },
      { to: "/uninstaller/guides/mcafee-webadvisor/", label: "removing McAfee and WebAdvisor", note: "Another vendor whose removal tool is the fallback when the normal route fails." },
      { to: "/uninstaller/", label: "what PC Tweaker Uninstaller shows before a removal runs", note: "The rating, the command and the permissions, before anything changes." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "ASUS Support: Armoury Crate FAQ (Uninstall Tool, failed uninstalls, older versions)", url: "https://www.asus.com/us/support/faq/1041654/" },
        { label: "ASUS Support: how to disable automatic download of Armoury Crate (BIOS option)", url: "https://www.asus.com/support/faq/1043788/" },
        { label: "ROG: how to cleanly uninstall and reinstall Armoury Crate", url: "https://rog.asus.com/articles/guides/how-to-cleanly-uninstall-and-reinstall-armoury-crate/" },
        SYSTEM_PROTECTION,
        RESTORE_API,
        CONFIDENCE,
        RESIDUE,
      ],
    },
  },

  "/uninstaller/guides/mcafee-webadvisor": {
    product: "uninstaller" as const,
    eyebrow: "REMOVAL GUIDE · MCAFEE AND WEBADVISOR",
    title: "How to remove McAfee and WebAdvisor, and check leftover tasks",
    seoTitle: "Remove McAfee, WebAdvisor and Leftover Tasks",
    seoDescription:
      "Uninstall McAfee and the separate WebAdvisor app, use McAfee's MCPR tool if the normal route fails, then check the folders, services and tasks it can leave.",
    intro:
      "Uninstall the McAfee app the normal Windows way and restart. WebAdvisor is a standalone app that McAfee says can stay installed after LiveSafe or Total Protection is removed, so uninstall it as well. If the normal route fails, McAfee's own Consumer Product Removal tool (MCPR) is the supported fallback. If McAfee folders remain afterwards, McAfee asks you not to delete them by hand. Uninstalling also does not cancel a paid McAfee subscription.",
    published: DATE,
    updated: DATE,
    checks: [
      { check: "The McAfee app is gone from Installed apps after a restart", meaning: "The standard removal finished", reversible: "Yes: reinstall from your McAfee account" },
      { check: "McAfee WebAdvisor is gone from Installed apps", meaning: "The standalone WebAdvisor app is removed too", reversible: "Yes, reinstallable" },
      { check: "MCPR shows Removal Complete", meaning: "The fallback tool finished; restart to complete it", reversible: "Yes, by reinstalling" },
      { check: "No C:\\Program Files\\McAfee, C:\\ProgramData\\McAfee or %LOCALAPPDATA%\\McAfee", meaning: "McAfee's own completion check", reversible: "If one remains: do not delete it, contact McAfee" },
      { check: "No scheduled task with McAfee in its name or folder", meaning: "Nothing is set to start McAfee software later", reversible: "Disabling a task is undone with Enable-ScheduledTask" },
      { check: "Auto-renewal in your McAfee account", meaning: "Removing the app does not cancel the subscription", reversible: "Managed in the account, not on the PC" },
    ],
    method: {
      heading: "The official way: standard removal, then MCPR if needed",
      intro:
        "McAfee documents two routes. Try the standard one first; MCPR is for when it fails. If McAfee came preinstalled and you never activated the included subscription, McAfee notes you may need to buy one if you reinstall later.",
      steps: [
        { title: "Uninstall the McAfee app", note: "On Windows 11, open Start, All apps, find McAfee, right-click it and choose Uninstall (or use Settings, Apps, Installed apps). Follow the prompts, then restart the PC to complete the removal." },
        { title: "Uninstall WebAdvisor separately", note: "In Settings, Apps, Installed apps, find McAfee WebAdvisor, open the three-dot menu and choose Uninstall. Confirm, choose to just uninstall it when McAfee offers to keep it, select Done and restart. If a WebAdvisor extension is still listed in a browser, remove it from that browser's extensions page." },
        { title: "If the standard route fails: MCPR", note: "Download MCPR from McAfee's MCPR article each time you use it; McAfee updates it so that newer products are recognised. Run MCPR.exe, accept the licence, type the validation characters exactly as shown and wait: McAfee says it can take 20 minutes or more. When it shows Removal Complete, restart. MCPR does not remove McAfee PC Optimizer. The same tool is in winget as McAfee.MCPR (McAfee Software Removal, published by McAfee, LLC)." },
      ] satisfies readonly Step[],
    },
    leftovers: {
      heading: "Leftover folders, services and scheduled tasks",
      body:
        "McAfee names three folders to check after a removal: C:\\Program Files\\McAfee, C:\\ProgramData\\McAfee and C:\\Users\\<you>\\AppData\\Local\\McAfee. If any of them is still there, McAfee's instruction is not to delete, move, rename or modify it, but to note which ones remain and contact McAfee customer service. These read-only PowerShell commands check those folders and list any service or scheduled task that still carries McAfee's name.",
      code: [
        "Test-Path \"$env:ProgramFiles\\McAfee\", \"$env:ProgramData\\McAfee\", \"$env:LOCALAPPDATA\\McAfee\"",
        "Get-Service -DisplayName '*McAfee*' | Format-Table Name, DisplayName, Status",
        "Get-ScheduledTask |",
        "  Where-Object { $_.TaskName -match 'McAfee' -or $_.TaskPath -match 'McAfee' } |",
        "  Format-Table TaskPath, TaskName, State",
      ].join("\n"),
      act: [
        "A WebAdvisor extension still listed in a browser: remove it from that browser's extensions page.",
        "A scheduled task that still starts McAfee software after the app, WebAdvisor and MCPR have finished and the PC has restarted: disable it with Disable-ScheduledTask -TaskPath <path> -TaskName <name> rather than deleting it (Enable-ScheduledTask undoes it), and mention it to McAfee support with any folders.",
      ],
      keep: [
        "The three McAfee folders above, if they remain: McAfee asks you not to delete them by hand.",
        "Your McAfee account and subscription: uninstalling does not touch them. Turn off auto-renewal in the account if you do not want to renew.",
      ],
    },
    sections: [
      restorePoint("For McAfee, a restore point is no substitute for MCPR when the standard removal fails: McAfee's documented fallback is the tool, followed by a restart."),
      {
        heading: "How PC Tweaker Uninstaller helps",
        body:
          "It lists the McAfee app and McAfee WebAdvisor as separate entries and says how many other programs from the same publisher are installed, which is how a WebAdvisor left behind shows up. Before anything runs, the brief shows the command each entry registered, and the Removal Ledger records the method and the result. Its leftover scan matches only folders named exactly after the program, so a shared McAfee folder under ProgramData is not offered; given McAfee's instruction, that is the right outcome. It does not list services or scheduled tasks, and it does not replace MCPR when the registered uninstaller fails. " +
          RECEIPT_NOTE,
      },
    ],
    related: [
      { to: "/uninstall-programs-completely/", label: "how to completely uninstall any Windows program", note: "The general order, and what to do when an uninstaller fails." },
      { to: "/uninstaller/guides/onedrive/", label: "uninstalling OneDrive without losing files", note: "When the data matters more than the app." },
      { to: "/uninstaller/", label: "what PC Tweaker Uninstaller shows before a removal runs", note: "The rating, the command and the permissions, before anything changes." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "McAfee Support: uninstall McAfee from a Windows PC (standard removal, leftover folders)", url: "https://www.mcafee.com/support/s/article/000001616?language=en_US" },
        { label: "McAfee Support: uninstall McAfee from a Windows PC using the MCPR tool", url: "https://www.mcafee.com/support/s/article/000002766?language=en_US" },
        { label: "McAfee Support: uninstall McAfee WebAdvisor from a Windows PC", url: "https://www.mcafee.com/support/s/article/000001669?language=en_US" },
        { label: "Microsoft Learn: Get-ScheduledTask", url: "https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/get-scheduledtask" },
        { label: "Microsoft Learn: Disable-ScheduledTask", url: "https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/disable-scheduledtask" },
        SYSTEM_PROTECTION,
        RESTORE_API,
        RESIDUE,
      ],
    },
  },

  "/uninstaller/guides/microsoft-edge-webview2": {
    product: "uninstaller" as const,
    eyebrow: "KEEP GUIDE · MICROSOFT EDGE WEBVIEW2",
    title: "Can I uninstall WebView2? Why to keep the Runtime",
    seoTitle: "Can I Uninstall WebView2? Why to Keep It",
    seoDescription:
      "WebView2 Runtime ships with Windows 11 and draws the windows of apps built on it. What breaks without it, why Windows hides Uninstall and how to reinstall it.",
    intro:
      "Keep it. The Microsoft Edge WebView2 Runtime is not a second browser: it is the shared web engine that apps built on WebView2 draw their interface with, and Microsoft preinstalls it on every Windows 11 device as part of the operating system. Apps that depend on it stop working without it, and Microsoft tells app developers to install the Runtime when it is missing, so the next setup of such an app may simply put it back. Most of its disk use is shared with Edge: on eligible systems Microsoft hard-links the two when they are on the same version.",
    published: DATE,
    updated: DATE,
    checks: [
      { check: "Microsoft Edge WebView2 Runtime, publisher Microsoft Corporation", meaning: "The shared Evergreen Runtime that WebView2 apps use", reversible: "Keep it" },
      { check: "No Uninstall button, or the entry is hidden in Control Panel", meaning: "On the Windows 11 PC this guide was checked on, its uninstall entry carries NoRemove = 1 and SystemComponent = 1", reversible: "Intended by Microsoft" },
      { check: "A pv value under EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}", meaning: "Microsoft's documented test that the Runtime is installed, with its version", reversible: "Read-only check" },
      { check: "An app opens a blank window or asks for WebView2", meaning: "The Runtime is missing or damaged", reversible: "Yes: reinstall the Runtime" },
      { check: "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application", meaning: "Where the per-machine Runtime lived on the test PC, one folder per version", reversible: "Leave it to Microsoft's updater" },
    ],
    method: {
      heading: "Why to keep it, and how to check or restore it",
      intro:
        "Microsoft compares the Runtime to Visual C++ or the .NET Runtime: a redistributable that apps rely on, which does not appear as a browser, a Start menu entry or a desktop shortcut. Without it, apps built on WebView2 cannot show their interface. The app framework PC Tweaker is built with, Tauri, documents that such an app will not work if the Runtime is missing, and Microsoft lists WebView2 among the Teams client's system requirements. Windows itself signals that this is not a casual removal: on the Windows 11 PC this guide was checked on (24 October 2026), the Runtime's entry was marked as a system component with removal disabled.",
      steps: [
        { title: "Check that it is installed (read-only)", code: "reg query \"HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}\" /v pv\nreg query \"HKCU\\Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}\" /v pv", shell: "cmd" as const, note: "Microsoft's documented check on 64-bit Windows. The first key is a per-machine install, the second a per-user one; at least one must hold a version greater than 0.0.0.0 for WebView2 apps to work. A not found error on one of them is normal." },
        { title: "If an app says WebView2 is missing, reinstall it", code: "winget install --id Microsoft.EdgeWebView2Runtime --exact", shell: "PowerShell" as const, note: "Or download the Evergreen Bootstrapper from Microsoft's WebView2 page. Microsoft documents that running the installer from an elevated prompt installs the Runtime per-machine, and otherwise per-user." },
        { title: "Leave the updates to Microsoft", note: "The Evergreen Runtime updates itself with the same security fixes as Edge Stable. An app picks up a new version the next time it restarts. Microsoft also notes that disabling Edge updates does not stop the Runtime from updating, unless an administrator turns that off separately." },
      ] satisfies readonly Step[],
    },
    leftovers: {
      heading: "What is on disk, and what to leave",
      body:
        "There is nothing to clean up here. Removing files from the Runtime's folder by hand breaks every WebView2 app at once, and Microsoft's updater manages the version folders. The Runtime is shared: one installation serves every app that uses the Evergreen Runtime on the PC. These read-only commands show what is there.",
      code: [
        "Get-ChildItem \"${env:ProgramFiles(x86)}\\Microsoft\\EdgeWebView\\Application\" -Directory | Format-Table Name",
        "Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Microsoft EdgeWebView' |",
        "  Format-List DisplayName, DisplayVersion, NoRemove, SystemComponent",
      ].join("\n"),
      act: [
        "An app you no longer want: uninstall that app. That removes the program that used the Runtime, not the Runtime itself.",
      ],
      keep: [
        "The Microsoft Edge WebView2 Runtime and its EdgeWebView folder.",
        "Microsoft Edge Update, which keeps the Runtime patched: the version check above reads its registry keys.",
      ],
    },
    sections: [
      restorePoint("If the Runtime was removed anyway and an app broke, reinstalling the Runtime is quicker and more targeted than a System Restore, which would also roll back everything else changed since the restore point."),
      {
        heading: "How PC Tweaker Uninstaller treats it",
        body:
          "It rates Microsoft Edge WebView2 Runtime as Keep: shared runtimes are a Keep reason in its rules, and when Windows marks the entry as a system component, that is a second reason. System components only appear after you choose Show hidden, so the Runtime is not in the default list. PC Tweaker Uninstaller is itself built with Tauri, like PC Tweaker, so removing the Runtime would also stop it from opening. " +
          RECEIPT_NOTE,
      },
    ],
    related: [
      { to: "/uninstall-programs-completely/", label: "what to leave alone when you uninstall programs", note: "Shared runtimes, settings folders and licence files." },
      { to: "/uninstaller/guides/onedrive/", label: "uninstalling OneDrive without losing files", note: "A Microsoft component you can remove, with the steps that keep your data." },
      { to: "/uninstaller/", label: "how PC Tweaker Uninstaller rates shared runtimes", note: "Safe, Review and Keep, with the reasons for each." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "Microsoft Learn: Evergreen vs. Fixed Version of the WebView2 Runtime (preinstalled on Windows 11)", url: "https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version" },
        { label: "Microsoft Learn: distribute your app and the WebView2 Runtime (detection keys, per-machine installs, updates)", url: "https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution" },
        { label: "Microsoft Edge Developer: download the WebView2 Runtime", url: "https://developer.microsoft.com/microsoft-edge/webview2/" },
        { label: "Microsoft Learn: ARPSYSTEMCOMPONENT property", url: "https://learn.microsoft.com/en-us/windows/win32/msi/arpsystemcomponent" },
        { label: "Microsoft Learn: ARPNOREMOVE property", url: "https://learn.microsoft.com/en-us/windows/win32/msi/arpnoremove" },
        { label: "Tauri: Windows installer and the WebView2 Runtime", url: "https://v2.tauri.app/distribute/windows-installer/" },
        { label: "Microsoft Learn: system requirements for the Teams client (WebView2)", url: "https://learn.microsoft.com/en-us/microsoftteams/teams-client-system-requirements" },
        SYSTEM_PROTECTION,
        CONFIDENCE,
      ],
    },
  },

  "/uninstaller/guides/onedrive": {
    product: "uninstaller" as const,
    eyebrow: "REMOVAL GUIDE · MICROSOFT ONEDRIVE",
    title: "How to uninstall OneDrive on Windows 11 without losing your files",
    seoTitle: "Uninstall OneDrive Without Losing Your Files",
    seoDescription:
      "Before you uninstall OneDrive on Windows 11, download online-only files, stop folder backup with the right option and unlink the PC. Then remove the app safely.",
    intro:
      "Microsoft states that you won't lose files or data by unlinking or uninstalling OneDrive, and that you can always reach your files on OneDrive.com. Two things can still leave you without a local copy: online-only files, which are placeholders until they are downloaded, and Desktop, Documents or Pictures folders that OneDrive backs up. So download what you need first, switch folder backup off with the option that keeps the files on your PC, unlink the PC, and only then uninstall the app from Settings.",
    published: DATE,
    updated: DATE,
    checks: [
      { check: "Files you need show the green circle with a white check mark", meaning: "Always keep on this device: the file is on the PC, not only online", reversible: "Yes: Free up space makes it online-only again" },
      { check: "Sync and backup, Manage backup: every folder switched off", meaning: "Desktop, Documents and Pictures are no longer backed up by OneDrive", reversible: "Yes: switch backup on again" },
      { check: "Account, Unlink this PC done", meaning: "OneDrive stops syncing this PC; Microsoft says no files are lost", reversible: "Yes: sign in again" },
      { check: "Microsoft OneDrive gone from Installed apps", meaning: "The sync app is removed", reversible: "Yes: winget install --id Microsoft.OneDrive" },
      { check: "Your files open with the network disconnected", meaning: "They really are local copies", reversible: "Read-only check" },
    ],
    method: {
      heading: "The safe order: files first, app last",
      intro:
        "Microsoft documents each step below, but not what happens to online-only placeholders when you unlink or uninstall, so the safe order is to make the files local first. The two OneDrive settings pages are reached from the OneDrive cloud icon in the notification area, then Help & Settings, then Settings.",
      steps: [
        { title: "Make the files you need local", note: "In File Explorer, right-click the OneDrive folder, or the folders you need, and choose Always keep on this device. Wait until they show the green circle with the white check mark. A blue cloud means online-only, and Microsoft notes that online-only files cannot be opened without an internet connection." },
        { title: "Switch off folder backup", note: "In OneDrive settings, open Sync and backup, then Manage backup, and switch off each backed-up folder. Microsoft offers two choices: Keep the files only in OneDrive, removing them from your computer, or Keep the files only on my PC, removing them from OneDrive. To keep the files on this PC, choose the second; if you also want them online, copy them somewhere outside OneDrive first. If OneDrive says some files couldn't be moved, download them with Always keep on this device and try again." },
        { title: "Unlink this PC", note: "In OneDrive settings, open Account, select Unlink this PC, then Unlink account." },
        { title: "Uninstall the app", note: "Open Settings, Apps, Installed apps, find Microsoft OneDrive and choose Uninstall. To reinstall it later, use winget install --id Microsoft.OneDrive or download it from Microsoft." },
      ] satisfies readonly Step[],
    },
    leftovers: {
      heading: "What stays on the PC, and what is yours",
      body:
        "Microsoft documents that the default OneDrive app installs per user, under %LOCALAPPDATA%, and that per-machine installs go under Program Files; Settings removes either. Your OneDrive folder and its files are your data, not a leftover. These read-only commands confirm the app is gone and list any OneDrive scheduled task still registered.",
      code: [
        "winget list --name OneDrive",
        "Get-ScheduledTask -TaskName 'OneDrive*' -ErrorAction SilentlyContinue | Format-Table TaskName, State",
      ].join("\n"),
      act: [
        "A OneDrive scheduled task still listed after the uninstall and a restart: disable it with Disable-ScheduledTask rather than deleting it, so Enable-ScheduledTask can undo the change.",
      ],
      keep: [
        "Your OneDrive folder and everything in it: those are your files.",
        "Your files on OneDrive.com: unlinking and uninstalling do not touch them.",
        "Desktop, Documents and Pictures after backup is off: check they open before you delete anything in OneDrive online.",
      ],
    },
    sections: [
      restorePoint("For OneDrive this matters twice: a restore point does not contain the files in your OneDrive folder, so it cannot bring back a file that was never downloaded; the order above is what protects them."),
      {
        heading: "How PC Tweaker Uninstaller helps",
        body:
          "It shows Microsoft OneDrive with the exact command it will run, and marks it as a per-user install where Windows registered it that way. A per-user removal normally runs without administrator rights, so no restore point is attempted and the receipt records it as skipped. Its leftover scan looks at folders and shortcuts named exactly after the program in AppData, ProgramData, the Start menu and on the Desktop. It never offers your user profile or its Desktop, Documents, Downloads, Pictures, Music or Videos folders, and your OneDrive folder is not among the places it looks. Files it does remove go to the Recycle Bin. " +
          RECEIPT_NOTE,
      },
    ],
    related: [
      { to: "/uninstaller/guides/microsoft-edge-webview2/", label: "why Microsoft Edge WebView2 Runtime should stay", note: "The Microsoft component to keep, and what breaks without it." },
      { to: "/uninstall-programs-completely/", label: "how to completely uninstall any Windows program", note: "Where leftovers live, and which ones to keep." },
      { to: "/uninstaller/", label: "what PC Tweaker Uninstaller shows before a removal runs", note: "The rating, the command and the permissions, before anything changes." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "Microsoft Support: turn off, disable or uninstall OneDrive", url: "https://support.microsoft.com/en-us/office/turn-off-disable-or-uninstall-onedrive-f32a17ce-3336-40fe-9c38-6efb09f944b0" },
        { label: "Microsoft Support: OneDrive Files On-Demand for Windows (online-only and always-available files)", url: "https://support.microsoft.com/en-us/office/save-disk-space-with-onedrive-files-on-demand-for-windows-0e6860d3-d9f3-4971-b321-7092438fb38e" },
        { label: "Microsoft Support: back up your folders with OneDrive (stopping folder backup)", url: "https://support.microsoft.com/en-us/office/back-up-your-folders-with-onedrive-d61a7930-a6fb-4b95-b28a-6552e77c3057" },
        { label: "Microsoft Learn: install the OneDrive sync app per-machine (per-user and per-machine locations)", url: "https://learn.microsoft.com/en-us/sharepoint/per-machine-installation" },
        { label: "Microsoft Support: uninstall or remove apps and programs in Windows", url: "https://support.microsoft.com/en-us/windows/uninstall-or-remove-apps-and-programs-in-windows-4b55f974-2cc6-2d2b-d092-5905080eaf98" },
        SYSTEM_PROTECTION,
        RESTORE_API,
        RESIDUE,
      ],
    },
  },
};
