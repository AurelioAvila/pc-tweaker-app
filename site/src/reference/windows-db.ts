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
  /** One sentence for the search snippet; every claim in it is also made, in full, in `why` or `purpose`. */
  readonly answer: string;
  /** A "why is it busy" question, only where the page already explains it. */
  readonly busy?: { readonly q: string; readonly a: string };
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
  /** When path, signer and account were observed, if later than CHECKED in catalog.ts. */
  readonly checked?: string;
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
const COM_SURROGATE = { label: "Microsoft Learn: Run a DLL-based COM object outside the application process (dllhost.exe)", url: "https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/development/run-dll-based-com-object" };
const DLL_SURROGATES = { label: "Microsoft Learn: DLL Surrogates", url: "https://learn.microsoft.com/en-us/windows/win32/com/dll-surrogates" };
const PCT_SERVICES = { label: "PC Tweaker source code: src-tauri/src/services.rs", url: "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/services.rs" };
const PCT_RULES = { label: "PC Tweaker source code: src-tauri/src/process_rules.rs (programs it refuses)", url: "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/process_rules.rs" };
const TSF_64 = { label: "Microsoft Learn: Text Services Framework, 64-bit considerations (dual ctfmon.exe processes)", url: "https://learn.microsoft.com/en-us/windows/win32/tsf/64-bit-platform-considerations" };
const TSF = { label: "Microsoft Learn: Text Services Framework", url: "https://learn.microsoft.com/en-us/windows/win32/tsf/text-services-framework" };
const SEARCH_INDEXING = { label: "Microsoft Learn: Windows Search indexing process overview (protocol host and filter host)", url: "https://learn.microsoft.com/en-us/windows/win32/search/-search-indexing-process-overview" };
const UMDF = { label: "Microsoft Learn: Overview of the UMDF (driver host process and driver manager)", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/wdf/overview-of-the-umdf" };
const UMDF_HOST = { label: "Microsoft Learn: UMDF driver host process (Wudfhost.exe)", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/wdf/umdf-driver-host-process" };
const BG_TASKS = { label: "Microsoft Learn: Support your app with background tasks (backgroundtaskhost.exe)", url: "https://learn.microsoft.com/en-us/windows/uwp/launch-resume/support-your-app-with-background-tasks" };
const UNSECAPP = { label: "Microsoft Learn: Setting security on an asynchronous WMI call (Unsecapp.exe)", url: "https://learn.microsoft.com/en-us/windows/win32/wmisdk/setting-security-on-an-asynchronous-call" };
const RUNDLL32 = { label: "Microsoft Learn: rundll32 command reference", url: "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/rundll32" };
const MSIEXEC = { label: "Microsoft Learn: msiexec command reference", url: "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/msiexec" };
const SMARTSCREEN = { label: "Microsoft Learn: Microsoft Defender SmartScreen overview", url: "https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/" };
const WINSXS = { label: "Microsoft Learn: Clean up the WinSxS folder (StartComponentCleanup)", url: "https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/clean-up-the-winsxs-folder" };
const NOV1 = "1 November 2026";

const SYS32 = "C:\\Windows\\System32";
const MSWIN = "Microsoft Windows";

export const WINDOWS_DB: readonly DbEntry[] = [
  /* ---------------------------- processes ---------------------------- */
  {
    kind: "process", slug: "dwm-exe", name: "dwm.exe", displayName: "Desktop Window Manager",
    path: `${SYS32}\\dwm.exe`, signer: MSWIN,
    purpose: "Composes everything you see. Since Windows Vista, windows no longer draw straight to the screen: their drawing goes to off-screen surfaces in video memory, and the Desktop Window Manager combines them into the desktop image on your display.",
    answer: "It draws your desktop, so leave it running.",
    busy: { q: "Why is dwm.exe using so much GPU or memory?", a: "Its use reflects what it has to draw. When it looks wrong, update the graphics driver first." },
    verdict: "leave",
    why: "It is the desktop itself. Its GPU and memory use reflect what it has to draw; when that looks wrong, the graphics driver is the first thing to update.",
    pcTweaker: `${REFUSED} The transparency and animation controls change what it draws, not the process.`,
    tweaks: ["disable_transparency", "disable_window_animations", "hardware_gpu_scheduling"],
    related: ["services/themes"],
    sources: [DWM, PCT_RULES],
  },
  {
    kind: "process", slug: "explorer-exe", name: "explorer.exe", displayName: "Windows Explorer",
    path: "C:\\Windows\\explorer.exe", signer: MSWIN,
    purpose: "Runs File Explorer and the Windows shell, including the taskbar and the desktop.",
    answer: "Ending it removes the taskbar and desktop until it restarts.",
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
    answer: "Each copy hosts different services, so judge the service, not svchost.",
    busy: { q: "Why is svchost.exe using so much CPU?", a: "Each instance hosts a different service. Look at the Services tab in Task Manager or run tasklist /svc to find which one is busy, then judge that service, not svchost.exe." },
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
    answer: "It handles sign-ins and credentials, so leave it alone.",
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
    answer: "It runs only when Credential Guard is on, so leave it alone.",
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
    answer: "A critical process: ending it stops Windows.",
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
    answer: "A critical process: ending it stops Windows.",
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
    answer: "A critical process: ending it stops Windows.",
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
    answer: "Many copies are normal: every console program gets one.",
    verdict: "leave",
    why: "Many instances are normal: every console program gets one, including ones that run without a visible window.",
    pcTweaker: REFUSED,
    sources: [CONSOLE, BUGCHECK_EF, PCT_RULES],
  },
  // 28 Oct 2026: wininit, services and LogonUI are the critical processes Microsoft names under bug check 0xEF that had no page.
  // Their display names are the file descriptions of the signed binaries (Get-Item ... VersionInfo, build 26300); the purpose
  // claims stop at what Microsoft documents.
  {
    kind: "process", slug: "wininit-exe", name: "wininit.exe", displayName: "Windows Start-Up Application",
    path: `${SYS32}\\wininit.exe`, signer: MSWIN,
    purpose: "The Windows Start-Up Application, as its file description reads. Microsoft names wininit.exe among the built-in critical system processes and refers to Windows Internals for the details of protected critical code such as wininit.",
    answer: "A critical process: ending it stops Windows.",
    verdict: "leave",
    why: "A built-in critical process: if it terminates, Windows stops with bug check 0xEF (CRITICAL_PROCESS_DIED).",
    pcTweaker: REFUSED,
    related: ["processes/services-exe", "processes/lsass-exe", "processes/smss-exe"],
    sources: [BUGCHECK_EF, PCT_RULES],
  },
  {
    kind: "process", slug: "services-exe", name: "services.exe", displayName: "Services and Controller app",
    path: `${SYS32}\\services.exe`, signer: MSWIN,
    purpose: "The Services and Controller app, as its file description reads. Windows services are started, stopped and tracked through the service control manager, which Microsoft describes as starting at boot and keeping the database of installed services; Microsoft names services.exe among the built-in critical processes.",
    answer: "A critical process: ending it stops Windows.",
    busy: { q: "Why is services.exe using so much CPU?", a: "To judge a busy service, look at the service itself in Task Manager's Services tab, not at services.exe." },
    verdict: "leave",
    why: "A built-in critical process: if it terminates, Windows stops with bug check 0xEF. To judge a busy service, look at the service itself in Task Manager's Services tab, not at services.exe.",
    pcTweaker: `${REFUSED} The app changes services only through its two service controls.`,
    related: ["processes/svchost-exe", "processes/wininit-exe"],
    sources: [{ label: "Microsoft Learn: Service control manager", url: "https://learn.microsoft.com/en-us/windows/win32/services/service-control-manager" }, BUGCHECK_EF, PCT_RULES],
  },
  {
    kind: "process", slug: "logonui-exe", name: "LogonUI.exe", displayName: "Windows Logon User Interface Host",
    path: `${SYS32}\\LogonUI.exe`, signer: MSWIN,
    purpose: "The Windows Logon User Interface Host, as its file description reads. Interactive sign-in itself is performed by Winlogon, which Microsoft documents together with the credential providers that customise it. Microsoft names logonui.exe among the built-in critical system processes.",
    answer: "A critical process: ending it stops Windows.",
    verdict: "leave",
    why: "A built-in critical process: its termination stops Windows with bug check 0xEF (CRITICAL_PROCESS_DIED).",
    pcTweaker: REFUSED,
    related: ["processes/winlogon-exe", "processes/lsass-exe"],
    sources: [WINLOGON, BUGCHECK_EF, PCT_RULES],
  },
  {
    kind: "process", slug: "dllhost-exe", name: "dllhost.exe", displayName: "COM Surrogate",
    path: `${SYS32}\\dllhost.exe`, signer: MSWIN,
    purpose: "The default surrogate process of COM. Windows components and apps can load a DLL-based COM object into it instead of their own process, which isolates faults and lets one server answer several clients. Microsoft documents dllhost.exe as the default surrogate that the DCOM service control manager starts.",
    answer: "Several copies are normal; ending one can break a feature.",
    verdict: "leave",
    why: "Several instances are normal: each one hosts COM objects for an app or a Windows feature, and COM ends the process itself once nothing uses those objects. Ending one by hand stops the objects it hosts, so the feature that asked for them can fail.",
    pcTweaker: REFUSED,
    related: ["services/rpcss", "processes/explorer-exe", "processes/rundll32-exe"],
    sources: [COM_SURROGATE, DLL_SURROGATES, PCT_RULES],
  },
  {
    kind: "process", slug: "searchindexer-exe", name: "SearchIndexer.exe", displayName: "Microsoft Windows Search Indexer",
    path: `${SYS32}\\SearchIndexer.exe`, signer: MSWIN,
    purpose: "The indexer behind the Windows Search service (WSearch). It reads files and mail to build the index that Start and File Explorer search.",
    answer: "Heavy use after setup is usually the index catching up.",
    busy: { q: "Why is SearchIndexer.exe so busy?", a: "Heavy activity right after setup, a big file copy or a rebuild is the index catching up. Microsoft's troubleshooting guide covers rebuilding the index and limiting what it covers before you consider turning indexing off." },
    verdict: "depends",
    why: "Heavy activity right after setup, a big file copy or a rebuild is the index catching up. Microsoft's troubleshooting guide covers rebuilding the index and limiting what it covers before you consider turning indexing off.",
    pcTweaker: "The Pro control \"Disable the indexing service\" stops and disables WSearch, which stops this process, and restores the previous start type and running state on undo.",
    tweaks: ["disable_windows_search_service"],
    related: ["services/wsearch", "processes/searchprotocolhost-exe", "processes/searchfilterhost-exe"],
    sources: [MS.searchPerf, PCT_SERVICES],
  },
  {
    kind: "process", slug: "audiodg-exe", name: "audiodg.exe", displayName: "Windows Audio Device Graph Isolation",
    path: `${SYS32}\\audiodg.exe`, signer: MSWIN,
    purpose: "The helper process the Windows audio service (Audiosrv) launches to run the audio engine, including the audio processing objects that sound drivers add. If one of those crashes, audio stops but Windows does not.",
    answer: "High CPU use usually points to audio effects or the driver.",
    busy: { q: "Why is audiodg.exe using so much CPU?", a: "Audio effects that sound drivers add run inside it, so check those first: turn off audio enhancements for the device or update the audio driver." },
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
    answer: "It is Defender's engine, so do not disable it.",
    verdict: "leave",
    why: "Microsoft warns that disabling, stopping or modifying the Defender services and processes, MsMpEng included, can cause severe instability and leave the PC vulnerable. Use Windows Security settings, such as scheduled scan times or exclusions you can justify, instead.",
    pcTweaker: REFUSED,
    related: ["services/windefend", "processes/smartscreen-exe"],
    sources: [DEFENDER, PCT_RULES],
  },
  {
    kind: "process", slug: "msedgewebview2-exe", name: "msedgewebview2.exe", displayName: "Microsoft Edge WebView2 Runtime",
    path: "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\<version>\\msedgewebview2.exe", signer: "Microsoft Corporation",
    purpose: "The WebView2 Runtime that desktop apps use to show web-based interfaces. It uses the same multi-process model as Microsoft Edge, so one app can start several of these processes.",
    answer: "Each app that uses WebView2 starts its own copies.",
    verdict: "leave",
    why: "Each app that uses WebView2 starts its own group of processes. Ending them closes or breaks the window of the app that owns them.",
    pcTweaker: "PC Tweaker's own window is built on WebView2, so you will see msedgewebview2.exe processes while the app is open. They close with it.",
    related: ["processes/backgroundtaskhost-exe"],
    sources: [WEBVIEW, WEBVIEW_PROCESS],
  },
  {
    kind: "process", slug: "wmiprvse-exe", name: "WmiPrvSE.exe", displayName: "WMI Provider Host",
    path: `${SYS32}\\wbem\\WmiPrvSE.exe`, signer: MSWIN,
    purpose: "Hosts WMI providers outside the WMI service, so a failing provider does not take other services down. Several instances, under different accounts, are normal.",
    answer: "Sustained CPU use means a program keeps querying WMI.",
    busy: { q: "Why is WmiPrvSE.exe using so much CPU?", a: "Sustained CPU use means some program keeps querying WMI. Find that program rather than the host." },
    verdict: "leave",
    why: "Sustained CPU use here means some program keeps querying WMI. Find that program rather than the host.",
    pcTweaker: `${REFUSED} PC Tweaker reads some hardware and network information through WMI, which appears here while it does.`,
    related: ["services/winmgmt", "processes/unsecapp-exe"],
    sources: [WMI, PCT_RULES],
  },
  {
    kind: "process", slug: "spoolsv-exe", name: "spoolsv.exe", displayName: "Spooler SubSystem App",
    path: `${SYS32}\\spoolsv.exe`, signer: MSWIN,
    purpose: "The executable of the Print Spooler service, which spools print jobs and handles interaction with printers.",
    answer: "It runs printing; needed to print, optional on a PC that never does.",
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
    answer: "Cut what it sends with the diagnostic data setting, not by stopping it.",
    verdict: "depends",
    why: "The supported way to reduce what it sends is the diagnostic data setting, not stopping the service. On Home and Pro the lowest level is Required diagnostic data.",
    pcTweaker: "PC Tweaker does not stop or disable DiagTrack. Its \"Reduce diagnostic data collection\" control sets the AllowTelemetry policy to the lowest level your edition allows instead.",
    serverGuidance: "No guidance",
    tweaks: ["disable_telemetry_tasks"],
    related: ["services/dmwappushservice", "services/dps"],
    sources: [MS.serverServices, MS.diagData],
  },
  {
    kind: "service", slug: "dmwappushservice", name: "dmwappushservice", displayName: "Device Management Wireless Application Protocol (WAP) Push message Routing Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem",
    purpose: "Routes WAP push messages for device management.",
    answer: "Manual is fine on a home PC; keep it on a managed work PC.",
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
    answer: "No published measurement shows a benefit from stopping it.",
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
    answer: "Turning it off makes file search slower.",
    verdict: "depends",
    why: "Without it, Start and File Explorer search slowly through files instead of using an index, and programs that rely on the index lose instant search. Rebuilding or narrowing the index is the first step when indexing is the problem.",
    pcTweaker: "The Pro control \"Disable the indexing service (Windows Search)\" stops WSearch and sets it to Disabled. Undo restores the start type and whether it was running.",
    serverGuidance: "Already disabled on Windows Server",
    tweaks: ["disable_windows_search_service"],
    related: ["processes/searchindexer-exe", "processes/searchprotocolhost-exe", "processes/searchfilterhost-exe"],
    sources: [MS.serverServices, MS.searchPerf, PCT_SERVICES],
  },
  {
    kind: "service", slug: "wsaifabricsvc", name: "WSAIFabricSvc", displayName: "Windows AI Components Host",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k WSAIFabricSvcGroup -p", account: "LocalService",
    purpose: "In Windows' own words (its service description), it provides AI component services to apps and other Windows services. It exists only on PCs whose Windows build includes those components.",
    answer: "Set it to Manual, not Disabled.",
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
    answer: "Cap its bandwidth with Delivery Optimization settings instead.",
    busy: { q: "Why is DoSvc using my network?", a: "It downloads Windows updates and Store apps and can share pieces of them with other PCs. To stop uploads or cap bandwidth, use the Delivery Optimization policies rather than disabling the service." },
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
    answer: "Disabling it stops Windows Update; pause updates in Settings instead.",
    verdict: "leave",
    why: "Microsoft notes that disabling it stops Windows Update and the Windows Update Agent API for every program. Use pause and active hours in Settings instead.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/bits", "services/dosvc", "services/usosvc", "services/trustedinstaller", "processes/tiworker-exe"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "bits", name: "BITS", displayName: "Background Intelligent Transfer Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem",
    purpose: "Transfers files in the background using idle network bandwidth, for programs that ask it to.",
    answer: "Disabling it stops background downloads, Windows Update included.",
    verdict: "leave",
    why: "Programs that depend on it, Windows Update among them, can no longer download in the background if it is disabled.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/wuauserv", "services/dosvc", "services/usosvc"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "windefend", name: "WinDefend", displayName: "Microsoft Defender Antivirus Service",
    path: "C:\\ProgramData\\Microsoft\\Windows Defender\\Platform\\<version>\\MsMpEng.exe", binary: "MsMpEng.exe", account: "LocalSystem",
    purpose: "Helps protect the PC from malware and other potentially unwanted software.",
    answer: "Do not disable it: Microsoft warns of instability and risk.",
    verdict: "leave",
    why: "Microsoft warns that disabling, stopping or modifying it can cause severe instability and leave the PC vulnerable. When another antivirus is installed, Microsoft documents that Defender switches to disabled mode automatically.",
    pcTweaker: UNTOUCHED,
    related: ["processes/msmpeng-exe", "processes/smartscreen-exe"],
    sources: [DEFENDER, MS.serverServices],
  },
  {
    kind: "service", slug: "spooler", name: "Spooler", displayName: "Print Spooler",
    path: `${SYS32}\\spoolsv.exe`, binary: "spoolsv.exe", account: "LocalSystem",
    purpose: "Spools print jobs and handles interaction with the printer. With it off you cannot print or see your printers.",
    answer: "Disable it only if the PC never prints.",
    verdict: "depends",
    why: "A PC that never prints, including to PDF printers, can set it to Disabled. Microsoft rates it OK to disable on servers that are not print servers.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable if not a print server or a domain controller",
    related: ["processes/spoolsv-exe", "services/stisvc"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "xblauthmanager", name: "XblAuthManager", displayName: "Xbox Live Auth Manager",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcsRedirectionGuard -p", account: "LocalSystem",
    purpose: "Provides authentication and authorization for interacting with Xbox services. Microsoft notes that some applications may not work correctly if it is stopped.",
    answer: "Some games that sign in with Xbox may break without it.",
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
    answer: "Leave it on if you use Xbox cloud saves.",
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
    answer: "Turn location off in Settings instead of stopping it.",
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
    answer: "Microsoft recommends not disabling it.",
    verdict: "leave",
    why: "Microsoft recommends not disabling it: the crash data it collects is how Microsoft and software vendors diagnose crash-inducing and security bugs.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "Do not disable",
    related: ["services/dps"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "mapsbroker", name: "MapsBroker", displayName: "Downloaded Maps Manager",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k NetworkService -p", account: "NetworkService",
    purpose: "Gives apps access to maps downloaded for offline use. Microsoft notes it is started on demand by applications that access downloaded maps.",
    answer: "Manual is fine: it starts only when an app needs offline maps.",
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
    answer: "Stopping it may compromise security and reliability.",
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
    answer: "Microsoft strongly recommends leaving it running.",
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
    answer: "Stopped, audio stops working.",
    verdict: "leave",
    why: "Stopped, audio devices and effects stop working. For crackling or dropouts, measure driver latency first; see the guide below.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable (on Windows Server, where audio is not used)",
    related: ["processes/audiodg-exe"],
    guides: ["/fixes/dpc-latency-audio-crackling/"],
    sources: [MS.serverServices, MS.audioMeasures],
  },
  /* ------------------------------------------------------------------
   * Added 1 Nov 2026 from search demand (Search Console queries and
   * Google autocomplete for "is X safe", "X high CPU", "what is X").
   * Paths, signers and service keys observed on Windows 11 build 26300
   * that day; display names are the English file descriptions or the
   * names Microsoft gives the services. Purpose claims stop at the cited
   * Microsoft page; Windows Server 2016 ratings are quoted as such.
   * ------------------------------------------------------------------ */
  {
    kind: "process", slug: "ctfmon-exe", name: "ctfmon.exe", displayName: "CTF Loader",
    path: `${SYS32}\\ctfmon.exe`, signer: MSWIN, checked: NOV1,
    purpose: "Microsoft documents that ctfmon.exe manages the Text Services Framework on the desktop and provides the language bar. The Text Services Framework is the Windows service that delivers advanced text input and natural language technologies, such as input methods for other languages, to programs.",
    answer: "It runs text input and the language bar, so leave it running.",
    verdict: "leave",
    why: "Ending it can stop input methods, the language switcher and other text services from working in open programs until it starts again. On 64-bit Windows, Microsoft documents that a 32-bit and a 64-bit copy run side by side, each serving text services of its own kind, so two copies are normal.",
    pcTweaker: REFUSED,
    related: ["processes/explorer-exe", "processes/conhost-exe"],
    sources: [TSF_64, TSF, PCT_RULES],
  },
  {
    kind: "process", slug: "searchprotocolhost-exe", name: "SearchProtocolHost.exe", displayName: "Microsoft Windows Search Protocol Host",
    path: `${SYS32}\\SearchProtocolHost.exe`, signer: MSWIN, checked: NOV1,
    purpose: "Part of Windows Search indexing. Microsoft describes the search protocol host as a boxed host process for the protocol handlers that read files, mail and other content for the index. Windows Search usually creates two of them: one in the system security context and one in the user's, so one user's data is never handled in the system context.",
    answer: "It reads files for the Windows Search index.",
    busy: { q: "Why is SearchProtocolHost.exe using CPU or disk?", a: "It works while the indexer gathers content, so it is busy after setup, after a large copy or during an index rebuild. If it never settles, rebuild the index or narrow what it covers, as Microsoft's Windows Search troubleshooting guide describes." },
    verdict: "depends",
    why: "It only works for the indexer, which starts it again when needed, so ending it gains nothing. If indexing itself is the problem, rebuild or narrow the index first; turning off the Windows Search service stops this process with the rest of the indexer.",
    pcTweaker: "The Pro control \"Disable the indexing service\" stops and disables WSearch, which stops the indexer and its host processes, and restores the previous start type and running state on undo. PC Tweaker never changes this process directly.",
    tweaks: ["disable_windows_search_service"],
    related: ["processes/searchfilterhost-exe", "processes/searchindexer-exe", "services/wsearch"],
    sources: [SEARCH_INDEXING, MS.searchPerf, PCT_SERVICES],
  },
  {
    kind: "process", slug: "searchfilterhost-exe", name: "SearchFilterHost.exe", displayName: "Microsoft Windows Search Filter Host",
    path: `${SYS32}\\SearchFilterHost.exe`, signer: MSWIN, checked: NOV1,
    purpose: "Part of Windows Search indexing. Microsoft describes the filter host as a host process for the filters and property handlers that pull text and properties out of each file. Like the protocol host, it keeps those add-ins apart from the rest of the system for security and stability.",
    answer: "It pulls text out of files for the search index.",
    busy: { q: "Why is SearchFilterHost.exe busy?", a: "A filter is reading the content of files the indexer queued, which is heavy work after setup, a large copy or a rebuild. Filters that other programs install also run here. If it never settles, rebuild the index or exclude the folders it keeps reading." },
    verdict: "depends",
    why: "Because filters run in this separate process, a faulty filter cannot take the indexer down with it. Ending the process only interrupts the file being read. If it keeps working on the same content, exclude that location from the index or rebuild the index.",
    pcTweaker: "The Pro control \"Disable the indexing service\" stops and disables WSearch, which stops the indexer and its host processes, and restores the previous state on undo. PC Tweaker never changes this process directly.",
    tweaks: ["disable_windows_search_service"],
    related: ["processes/searchprotocolhost-exe", "processes/searchindexer-exe", "services/wsearch"],
    sources: [SEARCH_INDEXING, MS.searchPerf, PCT_SERVICES],
  },
  {
    kind: "process", slug: "wudfhost-exe", name: "WUDFHost.exe", displayName: "User-mode Driver Framework Host Process",
    path: `${SYS32}\\WUDFHost.exe`, signer: MSWIN, checked: NOV1,
    purpose: "The driver host process of the User-Mode Driver Framework (UMDF). Each instance loads one or more user-mode device drivers, supplied by Microsoft or the device maker, together with the framework DLLs. A driver manager service starts and tracks these processes, and Microsoft notes they usually run under the low-privilege LocalService account.",
    answer: "It hosts user-mode device drivers; several copies are normal.",
    busy: { q: "Why is WUDFHost.exe using CPU or memory?", a: "A device driver loaded inside it is doing the work. Note which device misbehaves, often a sensor, fingerprint reader, phone or USB device, and update or roll back that device's driver in Device Manager." },
    verdict: "leave",
    why: "Ending an instance unloads the drivers inside it, so the devices they run stop working until Windows starts the host again. Several instances are normal, because drivers are spread across separate hosts.",
    pcTweaker: REFUSED,
    related: ["services/wbiosrvc"],
    sources: [UMDF_HOST, UMDF, PCT_RULES],
  },
  {
    kind: "process", slug: "backgroundtaskhost-exe", name: "backgroundTaskHost.exe", displayName: "Background Task Host",
    path: `${SYS32}\\backgroundTaskHost.exe`, signer: MSWIN, checked: NOV1,
    purpose: "Runs the background tasks of Microsoft Store and other packaged apps. Microsoft documents that out-of-process background tasks run in this separate process, so a task that fails cannot bring down the app that registered it.",
    answer: "It runs Store apps' background work; copies come and go.",
    busy: { q: "Why is backgroundTaskHost.exe running?", a: "An app registered a background task, for example to sync, refresh its content or handle a notification, and Windows started it. The command line of the process names the app package." },
    verdict: "depends",
    why: "Ending it stops that app's background task until Windows runs it again. If you do not need Store apps to sync or notify while closed, turn off their background activity; desktop programs are not affected.",
    pcTweaker: "PC Tweaker never changes this process. Its \"Restrict supported background apps\" control sets GlobalUserDisabled for your account, which stops Store apps from running in the background, and undo removes the value.",
    tweaks: ["disable_background_apps"],
    related: ["processes/dllhost-exe", "services/wpnservice"],
    sources: [BG_TASKS, PCT_RULES],
  },
  {
    kind: "process", slug: "unsecapp-exe", name: "unsecapp.exe", displayName: "Sink to receive asynchronous callbacks for WMI client application",
    path: `${SYS32}\\wbem\\unsecapp.exe`, signer: MSWIN, checked: NOV1,
    purpose: "A WMI helper. When a program makes an asynchronous WMI request, WMI can create the callback sink in this separate process, Unsecapp.exe, to receive the results; Microsoft documents how it checks the access of those callbacks.",
    answer: "A WMI helper for programs waiting on WMI results.",
    verdict: "leave",
    why: "It runs on behalf of a program that queries WMI, so that program is what to look at, not unsecapp.exe. Ending it can break the program's WMI request. A copy anywhere other than System32\\wbem deserves a closer look.",
    pcTweaker: REFUSED,
    related: ["processes/wmiprvse-exe", "services/winmgmt"],
    sources: [UNSECAPP, PCT_RULES],
  },
  {
    kind: "process", slug: "rundll32-exe", name: "rundll32.exe", displayName: "Windows host process (Rundll32)",
    path: `${SYS32}\\rundll32.exe`, signer: MSWIN, checked: NOV1,
    purpose: "A host that loads a DLL and runs a function in it. Microsoft's command reference notes it has no settings of its own; what each copy does depends on the DLL and function named in its command line. Windows and many programs use it, so several copies can run at once.",
    answer: "Judge each copy by the DLL in its command line.",
    busy: { q: "How do I see what a rundll32.exe process is running?", a: "Look at its command line: in Task Manager, add the Command line column on the Details tab, or run Get-CimInstance Win32_Process -Filter \"Name='rundll32.exe'\" | Select-Object ProcessId, CommandLine in PowerShell. The DLL it names is what is actually working." },
    verdict: "depends",
    why: "rundll32.exe itself is a Windows file; the DLL it loads may belong to Windows, a driver or any installed program. A copy running a DLL from a temporary or user folder, or one you cannot match to a program, deserves a closer look. Ending a copy stops the job that DLL was doing.",
    pcTweaker: REFUSED,
    related: ["processes/dllhost-exe", "processes/svchost-exe"],
    sources: [RUNDLL32, PCT_RULES],
  },
  {
    kind: "process", slug: "msiexec-exe", name: "msiexec.exe", displayName: "Windows Installer",
    path: `${SYS32}\\msiexec.exe`, signer: MSWIN, checked: NOV1,
    purpose: "Windows Installer. Microsoft documents msiexec as the way to install, modify and perform other operations on Windows Installer (.msi) packages, whether a setup program or the command line starts it.",
    answer: "It installs, repairs or removes a program; let it finish.",
    busy: { q: "Why is msiexec.exe running when I am not installing anything?", a: "A setup, update, repair or uninstall is using Windows Installer, sometimes started by a program's own updater. Its command line shows the package. Let it finish: ending it midway can leave that program half installed." },
    verdict: "leave",
    why: "Ending it in the middle of an installation or removal can leave the program partly installed until you run its setup again. When the job is done, the process exits.",
    pcTweaker: REFUSED,
    related: ["services/trustedinstaller", "processes/rundll32-exe"],
    guides: ["/uninstall-programs-completely/"],
    sources: [MSIEXEC, PCT_RULES],
  },
  {
    kind: "process", slug: "smartscreen-exe", name: "smartscreen.exe", displayName: "Microsoft Defender SmartScreen",
    path: `${SYS32}\\smartscreen.exe`, signer: MSWIN, checked: NOV1,
    purpose: "Microsoft Defender SmartScreen. Microsoft documents that it checks the reputation of websites, downloaded programs and the signatures on files, and warns you when something is reported as phishing or malware or has no established reputation.",
    answer: "Part of Windows security: it warns about unsafe apps.",
    verdict: "leave",
    why: "It is how Windows warns you before running a download with no reputation or one reported as unsafe. Turning it off removes that warning for every file, which is a security decision, not a performance tweak.",
    pcTweaker: REFUSED,
    related: ["processes/msmpeng-exe", "services/windefend"],
    sources: [SMARTSCREEN, PCT_RULES],
  },
  {
    kind: "process", slug: "tiworker-exe", name: "TiWorker.exe", displayName: "Windows Modules Installer Worker",
    path: "C:\\Windows\\WinSxS\\amd64_microsoft-windows-servicingstack_<version>\\TiWorker.exe", signer: MSWIN, checked: NOV1,
    purpose: "The worker of the Windows Modules Installer, as its file description reads. It lives in the servicing stack's folder of the component store (WinSxS). Microsoft documents that the Windows Modules Installer enables installation, modification and removal of Windows updates and optional components.",
    answer: "It installs Windows updates and features; let it finish.",
    busy: { q: "Why is TiWorker.exe using so much CPU or disk?", a: "It does the servicing work of the Windows Modules Installer: installing, changing and removing updates and optional features. Heavy use during and after an update is expected. Let it finish rather than ending it, and keep the PC plugged in until the update completes." },
    verdict: "leave",
    why: "Ending it while it services Windows can leave an update incomplete, and the work starts again later. Microsoft warns against deleting files from the WinSxS folder by hand; to reclaim space, run the component cleanup Microsoft documents (Dism.exe /online /Cleanup-Image /StartComponentCleanup from an elevated prompt) at a time that suits you.",
    pcTweaker: REFUSED,
    related: ["services/trustedinstaller", "services/usosvc", "services/wuauserv"],
    guides: ["/fixes/windows-update-using-bandwidth/"],
    sources: [MS.serverServices, WINSXS, PCT_RULES],
  },

  {
    kind: "service", slug: "usosvc", name: "UsoSvc", displayName: "Update Orchestrator Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem", checked: NOV1,
    purpose: "Manages Windows updates. Microsoft notes that if it is stopped, the device cannot download and install the latest updates, and that Windows Update depends on it.",
    answer: "Do not disable it: Windows stops getting updates.",
    verdict: "leave",
    why: "Microsoft rates it \"Do not disable\": Windows Update, including updates managed through WSUS, depends on it. To keep updates from interrupting you, use pause, active hours and the restart options in Settings.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "Do not disable",
    related: ["services/wuauserv", "services/bits", "processes/tiworker-exe"],
    guides: ["/fixes/windows-update-using-bandwidth/"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "trustedinstaller", name: "TrustedInstaller", displayName: "Windows Modules Installer",
    path: "C:\\Windows\\servicing\\TrustedInstaller.exe", binary: "TrustedInstaller.exe", account: "LocalSystem", checked: NOV1,
    purpose: "Enables installation, modification and removal of Windows updates and optional components. Microsoft notes that if it is disabled, installing or uninstalling Windows updates might fail.",
    answer: "Disabling it can make Windows updates fail to install.",
    verdict: "leave",
    why: "It is set to Manual by default, so Windows starts it only when updates or optional features are installed or removed. Disabling it can make those installs fail.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["processes/tiworker-exe", "services/usosvc", "services/wuauserv"],
    sources: [MS.serverServices, WINSXS],
  },
  {
    kind: "service", slug: "wpnservice", name: "WpnService", displayName: "Windows Push Notifications System Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem", checked: NOV1,
    purpose: "Hosts the notification platform and the connection provider that links the PC to the Windows Push Notification Services (WNS) server, which apps use to receive push notifications.",
    answer: "Apps' push notifications depend on it.",
    verdict: "depends",
    why: "Microsoft rates it OK to disable on Windows Server, noting that live tiles and other features need it. On a PC, apps that receive push notifications rely on it, so the better lever is to turn notifications off per app in Settings.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable (needed for live tiles and other features)",
    related: ["services/cdpsvc", "processes/backgroundtaskhost-exe"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "cdpsvc", name: "CDPSvc", displayName: "Connected Devices Platform Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalService -p", account: "LocalService", checked: NOV1,
    purpose: "Microsoft describes it as used for Connected Devices and Universal Glass scenarios: the platform that lets this PC work with your other devices. A per-user companion, CDPUserSvc, serves the same platform for each signed-in user.",
    answer: "Features that link this PC with your other devices use it.",
    verdict: "depends",
    why: "Microsoft gives no guidance either way. Stopping it can affect features that connect the PC with phones and other devices, and we know of no published measurement showing a speed benefit, so leave it unless you have a specific reason.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/wpnservice"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "dps", name: "DPS", displayName: "Diagnostic Policy Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalServiceNoNetwork -p", account: "LocalService", checked: NOV1,
    purpose: "Enables problem detection, troubleshooting and resolution for Windows components. It uses two helper services, the Diagnostic Service Host and the Diagnostic System Host, to run diagnostics.",
    answer: "Stopped, Windows diagnostics stop working.",
    verdict: "leave",
    why: "Microsoft notes that if it is stopped, diagnostics stop functioning. It is not the service that sends diagnostic data to Microsoft; that is DiagTrack, governed by the diagnostic data setting.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/diagtrack", "services/wersvc"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "iphlpsvc", name: "iphlpsvc", displayName: "IP Helper",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k NetSvcs -p", account: "LocalSystem", checked: NOV1,
    purpose: "Provides tunnel connectivity using IPv6 transition technologies (6to4, ISATAP, Port Proxy and Teredo) and IP-HTTPS.",
    answer: "Needed for IPv6 tunnels, port proxy rules and IP-HTTPS.",
    verdict: "depends",
    why: "Microsoft notes that if it is stopped, the PC loses the connectivity these technologies provide, so port proxy rules (netsh interface portproxy) and IP-HTTPS connections stop working. A home PC that uses none of them can live without it, but there is no measured gain from stopping it.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "ssdpsrv", name: "SSDPSRV", displayName: "SSDP Discovery",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalServiceAndNoImpersonationRedirectionGuard -p", account: "LocalService", checked: NOV1,
    purpose: "Discovers network devices and services that use the Simple Service Discovery Protocol (SSDP), such as Universal Plug and Play (UPnP) devices, and announces SSDP devices and services running on this PC.",
    answer: "Without it the PC cannot discover UPnP devices on the network.",
    verdict: "depends",
    why: "Microsoft notes that if it is stopped, the PC cannot discover SSDP-based devices, and services that depend on it cannot start. It is set to Manual on a default install, so it runs only when something asks for it.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "wbiosrvc", name: "WbioSrvc", displayName: "Windows Biometric Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k WbioSvcGroup", account: "LocalSystem", checked: NOV1,
    purpose: "Gives programs the ability to capture, compare, manipulate and store biometric data without direct access to the biometric hardware or samples.",
    answer: "Needed if you use a fingerprint or face sensor.",
    verdict: "depends",
    why: "Programs reach biometric sensors through it, so leave it alone on a PC with a fingerprint or face sensor you use. It is set to Manual on a default install, so on a PC without one it does not run anyway.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["processes/wudfhost-exe"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "stisvc", name: "stisvc", displayName: "Windows Image Acquisition (WIA)",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k imgsvc", account: "LocalService", checked: NOV1,
    purpose: "Provides image acquisition services for scanners and cameras.",
    answer: "Needed to scan; optional on a PC with no scanner.",
    verdict: "depends",
    why: "Scanners and cameras that use Windows Image Acquisition need it. It is set to Manual on a default install; on a PC that never scans, Microsoft's server guidance rates it OK to disable.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable",
    related: ["services/spooler"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "pcasvc", name: "PcaSvc", displayName: "Program Compatibility Assistant Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalSystemNetworkRestricted -p", account: "LocalSystem", checked: NOV1,
    purpose: "Supports the Program Compatibility Assistant, which monitors programs you install and run and detects known compatibility problems.",
    answer: "Manual is fine; it only watches for compatibility problems.",
    verdict: "manual-ok",
    why: "Microsoft notes that if it is stopped, the Program Compatibility Assistant stops working, and rates it OK to disable on Windows Server. On a PC that runs current software, Manual is enough; keep it as it is if you run older programs.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "OK to disable",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "trkwks", name: "TrkWks", displayName: "Distributed Link Tracking Client",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalSystemNetworkRestricted -p", account: "LocalSystem", checked: NOV1,
    purpose: "Maintains links between NTFS files within a computer or across computers in a network.",
    answer: "It keeps links to moved files working; Manual is fine.",
    verdict: "manual-ok",
    why: "Microsoft gives no guidance either way. Without it, links to NTFS files that were moved may no longer be tracked. It does little work, so there is no reason to go further than Manual.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "fontcache", name: "FontCache", displayName: "Windows Font Cache Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k LocalService -p", account: "LocalService", checked: NOV1,
    purpose: "Optimizes the performance of applications by caching commonly used font data. Applications start it automatically if it is not already running.",
    answer: "Disabling it makes programs slower, Microsoft notes.",
    verdict: "leave",
    why: "Microsoft notes that you can disable it, but that doing so degrades application performance. It exists to make programs faster, so stopping it works against you.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "cryptsvc", name: "CryptSvc", displayName: "Cryptographic Services",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k NetworkService -p", account: "NetworkService", checked: NOV1,
    purpose: "Provides three management services: the catalog database that confirms the signatures of Windows files and allows new programs to be installed, the protected root service for trusted root certificates, and automatic root certificate updates from Windows Update.",
    answer: "Leave it on: signatures, installs and certificates depend on it.",
    verdict: "leave",
    why: "Microsoft notes that if it is stopped, these management services cannot work properly and the services that depend on it cannot start.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/wuauserv", "services/trustedinstaller"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "appxsvc", name: "AppXSvc", displayName: "AppX Deployment Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k wsappx -p", account: "LocalSystem", checked: NOV1,
    purpose: "Provides infrastructure support for deploying Store apps. It starts on demand.",
    answer: "Disabling it stops Store apps from installing or updating.",
    busy: { q: "Why is AppXSvc (wsappx) using CPU or disk?", a: "It deploys Store apps, so it works while apps are installed or updated, including the apps that come with Windows. Heavy use usually follows a Windows update or a round of Store updates, and ends when they finish." },
    verdict: "leave",
    why: "Microsoft notes that if it is disabled, Store apps do not deploy to the system and may not work properly.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/clipsvc", "processes/backgroundtaskhost-exe"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "clipsvc", name: "ClipSVC", displayName: "Client License Service",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k wsappx -p", account: "LocalSystem", checked: NOV1,
    purpose: "Provides infrastructure support for the Microsoft Store. It starts on demand.",
    answer: "Disabling it breaks apps bought from the Microsoft Store.",
    verdict: "leave",
    why: "Microsoft notes that if it is disabled, applications bought using the Microsoft Store do not behave correctly. It only runs when needed, so stopping it gains nothing.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/appxsvc"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "themes", name: "Themes", displayName: "Themes",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem", checked: NOV1,
    purpose: "Provides user experience theme management.",
    answer: "Microsoft says do not disable it.",
    verdict: "leave",
    why: "Microsoft rates it \"Do not disable\", noting that accessibility themes cannot be set while it is disabled. To cut visual effects, turn off transparency and animations instead.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "Do not disable",
    tweaks: ["disable_transparency", "disable_window_animations"],
    related: ["processes/dwm-exe"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "sppsvc", name: "sppsvc", displayName: "Software Protection",
    path: `${SYS32}\\sppsvc.exe`, binary: "sppsvc.exe", account: "NetworkService", checked: NOV1,
    purpose: "Enables the download, installation and enforcement of digital licenses for Windows and Windows applications.",
    answer: "Microsoft strongly recommends not disabling it.",
    verdict: "leave",
    why: "Microsoft notes that if it is disabled, Windows and licensed applications may run in a notification mode, and highly recommends not disabling it.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance (Microsoft highly recommends not disabling it)",
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "schedule", name: "Schedule", displayName: "Task Scheduler",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem", checked: NOV1,
    purpose: "Lets users configure and schedule automated tasks, and hosts several system-critical Windows tasks.",
    answer: "Leave it on: Windows' own critical tasks run through it.",
    verdict: "leave",
    why: "Microsoft notes that if it is stopped or disabled, those tasks no longer run at their scheduled times. To stop one task, disable that task in Task Scheduler instead of the service.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/winmgmt"],
    sources: [MS.serverServices],
  },
  {
    kind: "service", slug: "winmgmt", name: "Winmgmt", displayName: "Windows Management Instrumentation",
    path: `${SYS32}\\svchost.exe`, binary: "svchost.exe -k netsvcs -p", account: "LocalSystem", checked: NOV1,
    purpose: "Provides a common interface and object model to access management information about the operating system, devices, applications and services.",
    answer: "Leave it on: most Windows software stops working without it.",
    busy: { q: "Why is the WMI service using so much CPU?", a: "WMI does work when programs ask it for information, and that work usually shows up in WmiPrvSE.exe. Sustained use means some program keeps querying WMI; find that program rather than the service." },
    verdict: "leave",
    why: "Microsoft notes that if it is stopped, most Windows-based software will not function properly, and services that depend on it cannot start.",
    pcTweaker: `${UNTOUCHED} PC Tweaker reads some hardware and network information through WMI.`,
    serverGuidance: "No guidance",
    related: ["processes/wmiprvse-exe", "processes/unsecapp-exe", "services/wmiapsrv"],
    sources: [MS.serverServices, WMI],
  },
  {
    kind: "service", slug: "wmiapsrv", name: "wmiApSrv", displayName: "WMI Performance Adapter",
    path: `${SYS32}\\wbem\\WmiApSrv.exe`, binary: "WmiApSrv.exe", account: "LocalSystem", checked: NOV1,
    purpose: "Provides performance library information from WMI providers to clients on the network. Microsoft notes that it only runs when Performance Data Helper is activated.",
    answer: "It runs only while a program reads performance data through WMI.",
    verdict: "manual-ok",
    why: "It is set to Manual by default and only runs when a program activates Performance Data Helper, so there is nothing to gain from disabling it, and the program asking for it would lose its data.",
    pcTweaker: UNTOUCHED,
    serverGuidance: "No guidance",
    related: ["services/winmgmt", "processes/wmiprvse-exe"],
    sources: [MS.serverServices],
  },
];

export const dbPath = (e: DbEntry) => `/database/${e.kind === "process" ? "processes" : "services"}/${e.slug}`;
export const dbBySlug = (key: string) => WINDOWS_DB.find((e) => `${e.kind === "process" ? "processes" : "services"}/${e.slug}` === key);
