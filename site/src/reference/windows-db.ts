import type { Source } from "./catalog";
import { MS } from "./sources";

/**
 * Windows processes and services, one entry per page under /database/.
 *
 * Only entries where every statement has a source made it in. What each field
 * rests on:
 * - `path`, `signer`, `binary`: observed on Windows 11 build 26300 on the date
 *   in catalog.ts with Get-AuthenticodeSignature and the service's registry
 *   key; the page shows the command so a reader can repeat the check.
 * - `purpose`: the Microsoft page in `sources`, paraphrased.
 * - `verdict` and `why`: ours, consistent with what PC Tweaker itself will and
 *   will not touch (process_rules.rs refuses priority rules for anything under
 *   the Windows folder or security software; services.rs changes exactly two
 *   services).
 * - `pcTweaker`: what the app does with it, from the public catalogue.
 * Start types are not listed: Microsoft documents them for Windows Server
 * 2016 only, and a PC's current value may already have been changed.
 */
export type DbVerdict = "leave" | "depends" | "manual-ok";

export const DB_VERDICTS: Record<DbVerdict, { label: string; tone: string }> = {
  leave: { label: "Leave it alone", tone: "warn" },
  depends: { label: "Depends on what you use", tone: "neutral" },
  "manual-ok": { label: "Safe to set to Manual", tone: "good" },
};

export interface DbEntry {
  readonly kind: "process" | "service";
  readonly slug: string;
  readonly name: string;
  readonly displayName: string;
  /** Processes: the executable. Services: the binary the service runs. */
  readonly path: string;
  readonly signer?: string;
  /** Services: the svchost group or executable, as the service key records it. */
  readonly binary?: string;
  readonly account?: string;
  readonly purpose: string;
  readonly verdict: DbVerdict;
  readonly why: string;
  readonly pcTweaker: string;
  /** Catalogue ids of related PC Tweaker controls. */
  readonly tweaks?: readonly string[];
  /** Other database slugs ("services/wsearch"). */
  readonly related?: readonly string[];
  /** Site guides and fixes. */
  readonly guides?: readonly string[];
  /** Microsoft's own rating in its Windows Server 2016 guidance, quoted, where it has one. */
  readonly serverGuidance?: string;
  readonly sources: readonly Source[];
}

const REFUSED =
  "PC Tweaker's priority rules refuse programs in the Windows folder and security software, so the app never changes this process's priority, and no control in the catalogue stops or edits it.";
const UNTOUCHED = "PC Tweaker does not change this service. No control in the catalogue stops it, disables it or edits its start type.";

const BUGCHECK_EF = { label: "Microsoft Learn: Bug Check 0xEF CRITICAL_PROCESS_DIED (built-in critical processes)", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0xef--critical-process-died" };
const BOOT = { label: "Microsoft Learn: Windows startup issues troubleshooting (session manager)", url: "https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/windows-boot-issues-troubleshooting" };
const CSRSS = { label: "Microsoft Learn: Debugging CSRSS", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/debugging-csrss" };
const LSA = { label: "Microsoft Learn: Configure added LSA protection", url: "https://learn.microsoft.com/en-us/windows-server/security/credentials-protection-and-management/configuring-additional-lsa-protection" };
const CREDGUARD = { label: "Microsoft Learn: How Credential Guard works", url: "https://learn.microsoft.com/en-us/windows/security/identity-protection/credential-guard/how-it-works" };
const WINLOGON = { label: "Microsoft Learn: Winlogon and credential providers", url: "https://learn.microsoft.com/en-us/windows/win32/secauthn/winlogon-and-credential-providers" };
const CONSOLE = { label: "Microsoft Learn: Windows console definitions (conhost.exe)", url: "https://learn.microsoft.com/en-us/windows/console/definitions" };
const DWM = { label: "Microsoft Learn: Desktop Window Manager", url: "https://learn.microsoft.com/en-us/windows/win32/dwm/dwm-overview" };
const SVCHOST = { label: "Microsoft Learn: Service host grouping in Windows 10", url: "https://learn.microsoft.com/en-us/windows/application-management/svchost-service-refactoring" };
const EXPLORER = { label: "Microsoft Support: File Explorer in Windows", url: "https://support.microsoft.com/en-us/windows/experience/fileexplorer/file-explorer-in-windows" };
const DEFENDER = { label: "Microsoft Learn: Microsoft Defender Antivirus compatibility with other security products", url: "https://learn.microsoft.com/en-us/defender-endpoint/microsoft-defender-antivirus-compatibility" };
const WEBVIEW = { label: "Microsoft Learn: Distribute your app and the WebView2 Runtime", url: "https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution" };
const WEBVIEW_PROCESS = { label: "Microsoft Learn: Process model for WebView2 apps", url: "https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model" };
const WMI = { label: "Microsoft Learn: Provider Hosting and Security (Wmiprvse.exe)", url: "https://learn.microsoft.com/en-us/windows/win32/wmisdk/provider-hosting-and-security" };
const PCT_SERVICES = { label: "PC Tweaker source code: src-tauri/src/services.rs", url: "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/services.rs" };
const PCT_RULES = { label: "PC Tweaker source code: src-tauri/src/process_rules.rs (programs it refuses)", url: "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/process_rules.rs" };

const SYS32 = "C:\\Windows\\System32";
const MSWIN = "Microsoft Windows";

export const WINDOWS_DB: readonly DbEntry[] = [
  /* ---------------------------- processes ---------------------------- */
  {
    kind: "process", slug: "dwm-exe", name: "dwm.exe", displayName: "Desktop Window Manager",
    path: `${SYS32}\\dwm.exe`, signer: MSWIN,
    purpose: "Composes everything you see. Since Windows Vista, windows no longer draw straight to the screen: their drawing goes to off-screen surfaces in video memory, and the Desktop Window Manager combines them into the desktop image on your display.",
    verdict: "leave",
    why: "It is the desktop itself. Its GPU and memory use reflect what it has to draw; when that looks wrong, the graphics driver is the first thing to update.",
    pcTweaker: `${REFUSED} The transparency and animation controls change what it draws, not the process.`,
    tweaks: ["disable_transparency", "disable_window_animations", "hardware_gpu_scheduling"],
    sources: [DWM, PCT_RULES],
  },
  {
    kind: "process", slug: "explorer-exe", name: "explorer.exe", displayName: "Windows Explorer",
    path: "C:\\Windows\\explorer.exe", signer: MSWIN,
    purpose: "Runs File Explorer and the Windows shell, including the taskbar and the desktop.",
    verdict: "leave",
    why: "Ending it makes the taskbar and desktop disappear until it restarts. Restarting it on purpose is safe and is the usual way to apply shell changes.",
    pcTweaker: "The classic right-click menu control restarts explorer.exe once to apply its change, and says so in its technical details. Nothing else in the catalogue touches the process.",
    tweaks: ["classic_context_menu", "explorer_open_this_pc", "show_file_extensions"],
    sources: [EXPLORER],
  },
  {
    kind: "process", slug: "svchost-exe", name: "svchost.exe", displayName: "Service Host",
    path: `${SYS32}\\svchost.exe`, signer: MSWIN,
    purpose: "A shared host process that loads Windows services from DLLs. On PCs with more than 3.5 GB of RAM, Windows 10 and later run most services in their own svchost.exe instance, which is why you see dozens of them.",
    verdict: "leave",
    why: "Each instance is a different service. To find out which one is busy, look at the Services tab in Task Manager or run tasklist /svc, and judge that service, not svchost.exe.",
    pcTweaker: `${REFUSED} The app changes services only through its two service controls, listed below.`,
    tweaks: ["disable_windows_search_service", "disable_ai_fabric_service"],
    related: ["services/diagtrack", "services/sysmain", "services/dosvc"],
    sources: [SVCHOST, PCT_RULES],
  },
  {
    kind: "process", slug: "lsass-exe", name: "lsass.exe", displayName: "Local Security Authority Process",
    path: `${SYS32}\\lsass.exe`, signer: MSWIN,
    purpose: "The Local Security Authority process. Microsoft describes the LSA as validating users for local and remote sign-ins and enforcing local security policies, and documents an added protection mode that stops other processes from reading its memory or injecting code.",
    verdict: "leave",
    why: "Credentials pass through it. A program asking to read its memory is a warning sign, not a tweak.",
    pcTweaker: REFUSED,
    related: ["processes/lsaiso-exe", "processes/winlogon-exe"],
    sources: [LSA, PCT_RULES],
  },
  {
    kind: "process", slug: "lsaiso-exe", name: "LsaIso.exe", displayName: "Credential Guard and VBS key isolation",
    path: `${SYS32}\\LsaIso.exe`, signer: MSWIN,
    purpose: "The isolated LSA process. With Credential Guard on, secrets that lsass.exe would hold are kept here instead, protected by virtualization-based security and out of reach of the rest of the operating system.",
    verdict: "leave",
    why: "It only runs when virtualization-based protection of credentials is active, and that is the protection it provides.",
    pcTweaker: `${REFUSED} The Memory Integrity control concerns a different VBS feature and does not turn off Credential Guard.`,
    tweaks: ["disable_memory_integrity"],
    related: ["processes/lsass-exe"],
    sources: [CREDGUARD, PCT_RULES],
  },
  {
    kind: "process", slug: "csrss-exe", name: "csrss.exe", displayName: "Client Server Runtime Process",
    path: `${SYS32}\\csrss.exe`, signer: MSWIN,
    purpose: "The user-mode process that controls the underlying layer of the Windows environment. Since Windows 10 it is a protected process.",
    verdict: "leave",
    why: "Microsoft lists it among the built-in critical processes: if it terminates, Windows stops with bug check 0xEF (CRITICAL_PROCESS_DIED).",
    pcTweaker: REFUSED,
    related: ["processes/winlogon-exe", "processes/smss-exe"],
    sources: [CSRSS, BUGCHECK_EF, PCT_RULES],
  },
  {
    kind: "process", slug: "winlogon-exe", name: "winlogon.exe", displayName: "Windows Logon Application",
    path: `${SYS32}\\winlogon.exe`, signer: MSWIN,
    purpose: "Winlogon manages interactive sign-in; Microsoft documents how it works with the credential providers that draw the sign-in screen.",
    verdict: "leave",
    why: "A built-in critical process: Microsoft documents that its termination stops Windows with bug check 0xEF.",
    pcTweaker: REFUSED,
    related: ["processes/csrss-exe", "processes/lsass-exe"],
    sources: [WINLOGON, BUGCHECK_EF, PCT_RULES],
  },
  {
    kind: "process", slug: "smss-exe", name: "smss.exe", displayName: "Windows Session Manager",
    path: `${SYS32}\\smss.exe`, signer: MSWIN,
    purpose: "The session manager. During startup the kernel hands control to it; it initialises the system session and loads the drivers that are not marked to start with the boot loader.",
    verdict: "leave",
    why: "A built-in critical process listed by Microsoft under bug check 0xEF.",
    pcTweaker: REFUSED,
    related: ["processes/csrss-exe", "processes/winlogon-exe"],
    sources: [BOOT, BUGCHECK_EF, PCT_RULES],
  },
  {
    kind: "process", slug: "conhost-exe", name: "conhost.exe", displayName: "Console Window Host",
    path: `${SYS32}\\conhost.exe`, signer: MSWIN,
    purpose: "The Windows Console Host: the server for the console APIs and the classic window for command-line programs. Microsoft also lists it among the built-in critical system processes.",
    verdict: "leave",
    why: "Many instances are normal: every console program gets one, including ones that run without a visible window.",
    pcTweaker: REFUSED,
    sources: [CONSOLE, BUGCHECK_EF, PCT_RULES],
  },
  {
    kind: "process", slug: "searchindexer-exe", name: "SearchIndexer.exe", displayName: "Microsoft Windows Search Indexer",
    path: `${SYS32}\\SearchIndexer.exe`, signer: MSWIN,
    purpose: "The indexer behind the Windows Search service (WSearch). It reads files and mail to build the index that Start and File Explorer search.",
    verdict: "depends",
    why: "Heavy activity right after setup, a big file copy or a rebuild is the index catching up. Microsoft's troubleshooting guide covers rebuilding the index and limiting what it covers before you consider turning indexing off.",
    pcTweaker: "The Pro control \"Disable the indexing service\" stops and disables WSearch, which stops this process, and restores the previous start type and running state on undo.",
    tweaks: ["disable_windows_search_service"],
    related: ["services/wsearch"],
    sources: [MS.searchPerf, PCT_SERVICES],
  },
  {
    kind: "process", slug: "audiodg-exe", name: "audiodg.exe", displayName: "Windows Audio Device Graph Isolation",
    path: `${SYS32}\\audiodg.exe`, signer: MSWIN,
    purpose: "The helper process the Windows audio service (Audiosrv) launches to run the audio engine, including the audio processing objects that sound drivers add. If one of those crashes, audio stops but Windows does not.",
    verdict: "leave",
    why: "Audio effects that sound drivers add run inside it, so when it uses a lot of CPU those are the first thing to check: turn off audio enhancements for the device or update the audio driver. Ending the process just cuts the sound.",
    pcTweaker: `${REFUSED} For crackling audio, PC Tweaker's driver latency trace measures which driver delays the system; see the guide below.`,
    related: ["services/audiosrv"],
    guides: ["/fixes/dpc-latency-audio-crackling/"],
    sources: [MS.audioMeasures, PCT_RULES],
  },
  {
    kind: "process", slug: "msmpeng-exe", name: "MsMpEng.exe", displayName: "Antimalware Service Executable",
    path: "C:\\ProgramData\\Microsoft\\Windows Defender\\Platform\\<version>\\MsMpEng.exe", signer: MSWIN,
    purpose: "The Microsoft Defender Antivirus engine, run by the WinDefend service.",
    verdict: "leave",
    why: "Microsoft warns that disabling, stopping or modifying the Defender services and processes, MsMpEng included, can cause severe instability and leave the PC vulnerable. Use Windows Security settings, such as scheduled scan times or exclusions you can justify, instead.",
    pcTweaker: REFUSED,
    related: ["services/windefend"],
    sources: [DEFENDER, PCT_RULES],
  },
  {
    kind: "process", slug: "msedgewebview2-exe", name: "msedgewebview2.exe", displayName: "Microsoft Edge WebView2 Runtime",
    path: "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\<version>\\msedgewebview2.exe", signer: "Microsoft Corporation",
    purpose: "The WebView2 Runtime that desktop apps use to show web-based interfaces. It uses the same multi-process model as Microsoft Edge, so one app can start several of these processes.",
    verdict: "leave",
    why: "Each app that uses WebView2 starts its own group of processes. Ending them closes or breaks the window of the app that owns them.",
    pcTweaker: "PC Tweaker's own window is built on WebView2, so you will see msedgewebview2.exe processes while the app is open. They close with it.",
    sources: [WEBVIEW, WEBVIEW_PROCESS],
  },
  {
    kind: "process", slug: "wmiprvse-exe", name: "WmiPrvSE.exe", displayName: "WMI Provider Host",
    path: `${SYS32}\\wbem\\WmiPrvSE.exe`, signer: MSWIN,
    purpose: "Hosts WMI providers outside the WMI service, so a failing provider does not take other services down. Several instances, under different accounts, are normal.",
    verdict: "leave",
    why: "Sustained CPU use here means some program keeps querying WMI. Find that program rather than the host.",
    pcTweaker: `${REFUSED} PC Tweaker reads some hardware and network information through WMI, which appears here while it does.`,
    sources: [WMI, PCT_RULES],
  },
  {
    kind: "process", slug: "spoolsv-exe", name: "spoolsv.exe", displayName: "Spooler SubSystem App",
    path: `${SYS32}\\spoolsv.exe`, signer: MSWIN,
    purpose: "The executable of the Print Spooler service, which spools print jobs and handles interaction with printers.",
    verdict: "depends",
    why: "Without it you cannot print or see your printers. If the PC never prints, the service can be set to Manual or Disabled; see the service entry.",
    pcTweaker: REFUSED,
    related: ["services/spooler"],
    sources: [MS.serverServices, PCT_RULES],
  },

  /* ----------------------------- services ----------------------------- */
  {
    kind: "service", slug: "diagtrack", name: "DiagTrack", displayName: "Connected User Experiences and Telemetry",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k utcsvc -p", account: "LocalSystem",
    purpose: "Manages the event-driven collection and transmission of Windows diagnostic and usage data, and features that support connected user experiences.",
    verdict: "depends",
    why: "The supported way to reduce what it sends is the diagnostic data setting, not stopping the service. On Home and Pro the lowest level is Required diagnostic data.",
    pcTweaker: "PC Tweaker does not stop or disable DiagTrack. Its \"Reduce diagnostic data collection\" control sets the AllowTelemetry policy to the lowest level your edition allows instead.",
    serverGuidance: "No guidance",
    tweaks: ["disable_telemetry_tasks"],
    related: ["services/dmwappushservice"],
    sources: [MS.serverServices, MS.diagData],
  },
  {
    kind: "service", slug: "dmwappushservice", name: "dmwappushservice", displayName: "Device Management Wireless Application Protocol (WAP) Push message Routing Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem",
    purpose: "Routes WAP push messages for device management.",
    verdict: "manual-ok",
    why: "Microsoft notes that client devices need it for Intune, mobile device management and similar technologies. A home PC that no organisation manages can leave it on Manual; a work PC should keep it as configured.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable (not needed on Server; required on client devices for Intune and MDM)",
    related: ["services/diagtrack"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "sysmain", name: "SysMain", displayName: "SysMain (formerly Superfetch)",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalSystemNetworkRestricted -p", account: "LocalSystem",
    purpose: "In Microsoft's words, it maintains and improves system performance over time.",
    verdict: "depends",
    why: "Microsoft gives no guidance either way. Stopping it is a common tip, but we know of no published measurement that shows a benefit on a typical PC, so test before and after if you try it.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "wsearch", name: "WSearch", displayName: "Windows Search",
    path: `${SYS32}\\SearchIndexer.exe`, binary: "SearchIndexer.exe /Embedding", account: "LocalSystem",
    purpose: "Provides content indexing, property caching and search results for files, e-mail and other content.",
    verdict: "depends",
    why: "Without it, Start and File Explorer search slowly through files instead of using an index, and programs that rely on the index lose instant search. Rebuilding or narrowing the index is the first step when indexing is the problem.",
    pcTweaker: "The Pro control \"Disable the indexing service (Windows Search)\" stops WSearch and sets it to Disabled. Undo restores the start type and whether it was running.",
    serverGuidance: "Already disabled on Windows Server",
    tweaks: ["disable_windows_search_service"],
    related: ["processes/searchindexer-exe"],
    sources: [MS.serverServices, MS.searchPerf, PCT_SERVICES],
  },
  {
    kind: "service", slug: "wsaifabricsvc", name: "WSAIFabricSvc", displayName: "Windows AI Components Host",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k WSAIFabricSvcGroup -p", account: "LocalService",
    purpose: "In Windows' own words (its service description), it provides AI component services to apps and other Windows services. It exists only on PCs whose Windows build includes those components.",
    verdict: "manual-ok",
    why: "On Manual it no longer starts with Windows, yet Windows can still start it when an app or feature asks. Disabled has been reported to leave taskbar and tray icons missing, which is why Manual is the setting to use.",
    pcTweaker: "The Pro control \"Start Windows AI Components Host only when needed\" stops it and sets it to Manual, and restores the previous start type and running state on undo. It is offered only on PCs that have the service.",
    tweaks: ["disable_ai_fabric_service", "disable_recall", "disable_click_to_do"],
    guides: ["/turn-off-windows-recall/"],
    sources: [PCT_SERVICES],
  },
  {
    kind: "service", slug: "dosvc", name: "DoSvc", displayName: "Delivery Optimization",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k NetworkService -p", account: "NetworkService",
    purpose: "Downloads Windows updates and Store apps, and can share pieces of them with other PCs. Microsoft documents that it shuts down when idle, with no transfers in progress.",
    verdict: "depends",
    why: "Windows Update and the Store use it. To stop uploads or cap bandwidth, use the Delivery Optimization policies rather than disabling the service.",
    pcTweaker: "PC Tweaker does not stop the service. One control sets the download mode policy to HTTP only, with no peering; another caps background download speed.",
    tweaks: ["disable_delivery_optimization", "limit_do_background_download"],
    related: ["services/wuauserv", "services/bits"],
    guides: ["/fixes/windows-update-using-bandwidth/"],
    sources: [MS.doFaq, MS.doRef],
  },
  {
    kind: "service", slug: "wuauserv", name: "wuauserv", displayName: "Windows Update",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem",
    purpose: "Detects, downloads and installs updates for Windows and other programs.",
    verdict: "leave",
    why: "Microsoft notes that disabling it stops Windows Update and the Windows Update Agent API for every program. Use pause and active hours in Settings instead.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/bits", "services/dosvc"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "bits", name: "BITS", displayName: "Background Intelligent Transfer Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem",
    purpose: "Transfers files in the background using idle network bandwidth, for programs that ask it to.",
    verdict: "leave",
    why: "Programs that depend on it, Windows Update among them, can no longer download in the background if it is disabled.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/wuauserv", "services/dosvc"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "windefend", name: "WinDefend", displayName: "Microsoft Defender Antivirus Service",
    path: "C:\\ProgramData\\Microsoft\\Windows Defender\\Platform\\<version>\\MsMpEng.exe", binary: "MsMpEng.exe", account: "LocalSystem",
    purpose: "Helps protect the PC from malware and other potentially unwanted software.",
    verdict: "leave",
    why: "Microsoft warns that disabling, stopping or modifying it can cause severe instability and leave the PC vulnerable. When another antivirus is installed, Microsoft documents that Defender switches to disabled mode automatically.",
    pcTweaker: UNTOUCHED,
    related: ["processes/msmpeng-exe"],
    sources: [DEFENDER, MS.serverServices],
  },
  {
    kind: "service", slug: "spooler", name: "Spooler", displayName: "Print Spooler",
    path: `${SYS32}\\spoolsv.exe`, binary: "spoolsv.exe", account: "LocalSystem",
    purpose: "Spools print jobs and handles interaction with the printer. With it off you cannot print or see your printers.",
    verdict: "depends",
    why: "A PC that never prints, including to PDF printers, can set it to Disabled. Microsoft rates it OK to disable on servers that are not print servers.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable if not a print server or a domain controller",
    related: ["processes/spoolsv-exe"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "xblauthmanager", name: "XblAuthManager", displayName: "Xbox Live Auth Manager",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcsRedirectionGuard -p", account: "LocalSystem",
    purpose: "Provides authentication and authorization for interacting with Xbox services. Microsoft notes that some applications may not work correctly if it is stopped.",
    verdict: "depends",
    why: "Microsoft notes some applications may not work correctly without it; games that sign in with an Xbox account are the likely ones. On Manual it only starts when asked.",
    pcTweaker: "PC Tweaker does not change Xbox services. Its Game Bar controls change Game Bar recording settings, not these services.",
    serverGuidance: "Should be disabled (on Windows Server)",
    tweaks: ["disable_game_dvr", "disable_game_bar_captures"],
    related: ["services/xblgamesave"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "xblgamesave", name: "XblGameSave", displayName: "Xbox Live Game Save",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem",
    purpose: "Syncs save data for games that use Xbox cloud saves. Stopped, game saves no longer upload or download.",
    verdict: "depends",
    why: "Leave it if you play games with Xbox cloud saves; otherwise it stays on Manual and does not run on its own.",
    pcTweaker: "PC Tweaker does not change Xbox services.",
    serverGuidance: "Should be disabled (on Windows Server)",
    related: ["services/xblauthmanager"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "lfsvc", name: "lfsvc", displayName: "Geolocation Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcsRedirectionGuard -p", account: "LocalSystem",
    purpose: "Monitors the PC's location and manages geofences. With it off, apps cannot use location or geofence notifications.",
    verdict: "depends",
    why: "Turning location off in Settings, or by policy, is the supported way to stop apps getting a location; the service then has nothing to report.",
    pcTweaker: "PC Tweaker does not stop the service. Its \"Disable location tracking\" control sets the policy that turns location off for every app.",
    serverGuidance: "OK to disable (breaks apps that rely on it)",
    tweaks: ["disable_location_tracking"],
    sources: [MS.serverServices, MS.connections],
  },
  {
    kind: "service", slug: "wersvc", name: "WerSvc", displayName: "Windows Error Reporting Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k WerSvcGroup", account: "LocalSystem",
    purpose: "Reports errors when programs stop working or respond, delivers existing solutions and generates logs for diagnostic and repair services.",
    verdict: "leave",
    why: "Microsoft recommends not disabling it: the crash data it collects is how Microsoft and software vendors diagnose crash-inducing and security bugs.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "Do not disable",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "mapsbroker", name: "MapsBroker", displayName: "Downloaded Maps Manager",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k NetworkService -p", account: "NetworkService",
    purpose: "Gives apps access to maps downloaded for offline use. Microsoft notes it is started on demand by applications that access downloaded maps.",
    verdict: "manual-ok",
    why: "On Manual, apps that need offline maps can still start it; Disabled breaks them.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable if no apps rely on it",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "eventlog", name: "EventLog", displayName: "Windows Event Log",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalServiceNetworkRestricted -p", account: "LocalService",
    purpose: "Manages events and event logs: logging, querying, subscribing and archiving.",
    verdict: "leave",
    why: "Microsoft notes that stopping it may compromise system security and reliability, and troubleshooting depends on it.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "rpcss", name: "RpcSs", displayName: "Remote Procedure Call (RPC)",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k rpcss -p", account: "NetworkService",
    purpose: "The service control manager for COM and DCOM servers: it handles object activation, exporter resolution and distributed garbage collection.",
    verdict: "leave",
    why: "Microsoft strongly recommends leaving it running; programs that use COM or DCOM stop working without it.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance (Microsoft highly recommends leaving it running)",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "audiosrv", name: "Audiosrv", displayName: "Windows Audio",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalServiceNetworkRestricted -p", account: "LocalService",
    purpose: "Manages audio for Windows programs. It launches audiodg.exe to run the audio engine.",
    verdict: "leave",
    why: "Stopped, audio devices and effects stop working. For crackling or dropouts, measure driver latency first; see the guide below.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable (on Windows Server, where audio is not used)",
    related: ["processes/audiodg-exe"],
    guides: ["/fixes/dpc-latency-audio-crackling/"],
    sources: [MS.serverServices, MS.audioMeasures],
  },
];

export const dbPath = (e: DbEntry) => `/database/${e.kind === "process" ? "processes" : "services"}/${e.slug}`;
export const dbBySlug = (key: string) => WINDOWS_DB.find((e) => `${e.kind === "process" ? "processes" : "services"}/${e.slug}` === key);
