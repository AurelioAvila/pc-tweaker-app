/**
 * Problem-first guides under /fixes/. Each one exists because PC Tweaker has a
 * control or a tool that addresses the problem, and each states the manual
 * route first. Facts were checked against the listed sources on the date
 * given; commands were run on Windows 11 build 26300 where they only read
 * state, and against a scratch registry key where they write.
 */
const CHECKED = "15 October 2026";
const SRC = "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src";

export const FIX_GUIDES = {
  "/fixes/dpc-latency-audio-crackling": {
    eyebrow: "FIX · AUDIO AND LATENCY",
    title: "Audio crackling on Windows: find the driver behind it",
    seoTitle: "Fix Audio Crackling and DPC Latency on Windows",
    seoDescription:
      "Crackles, pops and dropouts usually mean a driver holds the CPU too long. Measure DPC and ISR times, find the driver, then update, roll back or disable it.",
    intro:
      "Crackling, pops and short dropouts under load are rarely the audio app's fault. More often a driver runs too long at high priority, the audio engine misses its deadline and the buffer underruns. The fix is to find which driver, and the only reliable way to find it is to measure.",
    summary: [
      { label: "Limit Microsoft sets for drivers", value: "DPC 100 µs, ISR 25 µs" },
      { label: "Measure by hand", value: "wpr.exe (in System32) + Windows Performance Analyzer" },
      { label: "Measure in PC Tweaker", value: "Hardware, DPC and interrupt latency (Free, read-only)" },
      { label: "Changes to your PC", value: "None until you act on the result" },
      { label: "Admin rights", value: "Yes, for any kernel trace" },
    ],
    sections: [
      {
        heading: "What a DPC or ISR has to do with sound",
        body:
          "When hardware needs attention it raises an interrupt; the driver's interrupt service routine (ISR) runs at once, and the slower part of the work is queued as a deferred procedure call (DPC). While those run, ordinary threads on that core wait, the audio engine included. Microsoft's guidance for driver developers is that a DPC should not run longer than 100 microseconds and an ISR not longer than 25 microseconds. A driver that regularly goes past those limits can delay audio long enough to be heard.",
      },
      {
        heading: "Measure before you change anything",
        body:
          "Reproduce the problem while recording, ideally with the audio playing that crackles. The trace names the driver module whose routines ran longest. dxgkrnl.sys dispatches display interrupts, so time charged to it often belongs to the graphics driver. One long DPC in a minute is not the same as hundreds; look at both the longest time and how often the limit was crossed.",
        points: [
          "Record for 30 to 60 seconds while the crackle happens",
          "Note the driver with the longest DPC or ISR times",
          "Repeat once to make sure it is the same driver",
          "Keep the result: you will compare against it after the fix",
        ],
      },
      {
        heading: "Fix the driver the trace names",
        body:
          "Update that driver from the PC or device maker's site, not only through Windows Update. If the crackling started after a driver update, roll it back in Device Manager (the device's Properties, Driver tab). If the device is one you do not use, such as a second network adapter, disable it in Device Manager and measure again. Then record a second trace in the same conditions: the fix is real only if the numbers moved.",
      },
      {
        heading: "What does not fix it",
        body:
          "No registry value lowers another driver's DPC time, and none of PC Tweaker's controls claims to. Two of them exist for diagnosis only: turning off USB selective suspend and keeping PCIe links active on mains power can rule out device power transitions as a cause of dropouts. Apply one, measure, and restore it if nothing changed.",
      },
    ],
    steps: [
      { title: "Check that the recorder is there", code: "where wpr\nwpr -profiles", shell: "cmd" as const, note: "Run in an administrator Command Prompt. The CPU and Audio profiles are the ones you need." },
      { title: "Start recording, reproduce the crackle, stop", code: "wpr -start CPU -start Audio\nrem reproduce the problem for 30-60 seconds, then:\nwpr -stop %USERPROFILE%\\Desktop\\audio-glitch.etl", shell: "cmd" as const },
      { title: "Read the trace", note: "Open the .etl file in Windows Performance Analyzer (part of the Windows ADK) and look at Computation, DPC/ISR, grouped by module. The longest durations point at the driver." },
    ],
    pctweaker: {
      title: "The same measurement in PC Tweaker",
      body:
        "On the Hardware screen, the DPC and interrupt latency panel records for 5 to 30 seconds and lists each driver's longest DPC and ISR, how many ran past Microsoft's limits, and the total time. It reads the kernel's own events, changes nothing and is part of the free plan; Windows asks for administrator approval once because a kernel trace needs it.",
      links: [{ to: "/tweaks/performance/usb-suspend-diagnostics/", label: "USB wake troubleshooting on mains power" }, { to: "/tweaks/performance/pcie-link-power/", label: "Keep PCIe links active on mains power" }],
    },
    related: [
      { to: "/database/processes/audiodg-exe/", label: "audiodg.exe, the process that runs the audio engine", note: "Why its CPU use usually comes from driver-added effects." },
      { to: "/database/services/audiosrv/", label: "the Windows Audio service", note: "What happens if it is stopped, and why it is not the cause of crackling." },
      { to: "/tools/timer-resolution-calculator/", label: "the timer and buffer latency calculator", note: "The arithmetic behind buffer sizes, polling rates and timer periods." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "Microsoft Learn: Bug Check 0x133 DPC_WATCHDOG_VIOLATION (DPC and ISR limits)", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x133-dpc-watchdog-violation" },
        { label: "Microsoft Learn: CPU analysis with Windows Performance Analyzer (DPCs and ISRs)", url: "https://learn.microsoft.com/en-us/windows-hardware/test/wpt/cpu-analysis" },
        { label: "Microsoft Learn: WPR command-line options", url: "https://learn.microsoft.com/en-us/windows-hardware/test/wpt/wpr-command-line-options" },
        { label: "Microsoft Learn: Audio measures (the audio engine and audiodg.exe)", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/dashboard/audio-measures" },
        { label: "PC Tweaker source code: the DPC and ISR trace (diagnostics/dpc.rs)", url: `${SRC}/diagnostics/dpc.rs` },
      ],
    },
  },
  "/fixes/hardware-accelerated-gpu-scheduling": {
    eyebrow: "FIX · GRAPHICS",
    title: "Hardware-accelerated GPU scheduling: on, off, or test it?",
    seoTitle: "Hardware-Accelerated GPU Scheduling: On or Off?",
    seoDescription:
      "HAGS moves GPU scheduling onto the graphics card. Whether it is on depends on your GPU, driver and Windows setup: how to check it, test it fairly and undo it.",
    intro:
      "Hardware-accelerated GPU scheduling (HAGS) hands most of the work of scheduling GPU jobs to a scheduler on the graphics card instead of the CPU. Microsoft introduced it in the Windows 10 May 2020 update as an option that is off by default and needs a supporting GPU and driver. Whether it helps depends on the game, the GPU and the driver, so the honest answer is to test it.",
    summary: [
      { label: "Where it lives", value: "Settings, System, Display, Graphics" },
      { label: "Registry value PC Tweaker writes", value: "HKLM\\...\\GraphicsDrivers HwSchMode = 2" },
      { label: "Needs", value: "Supporting GPU and driver, then a restart" },
      { label: "Expected effect", value: "Better, worse or unchanged, by game" },
      { label: "PC Tweaker plan", value: "Pro (the Settings switch is free)" },
    ],
    sections: [
      {
        heading: "What it changes",
        body:
          "Without HAGS, Windows' graphics kernel schedules GPU work from the CPU. With it, a dedicated scheduling processor on the GPU takes over most of that job, which can reduce scheduling overhead. Microsoft's DirectX team describes it as addressing the submission overhead and latency of CPU-side scheduling, while Windows keeps control of which applications get priority. It is not presented as a switch that guarantees higher frame rates.",
      },
      {
        heading: "How to test it fairly",
        body:
          "Pick one game and one repeatable scene, such as a built-in benchmark or the same route. Record average frame rate and, more usefully, frame-time consistency with the same capture tool each time. Run three times with HAGS off, restart, run three times with it on. Keep the setting that wins in the games you actually play, and repeat after a major driver update.",
        points: [
          "Same game, scene, settings and capture tool",
          "Three runs per state, restart between states",
          "Judge frame-time consistency, not only averages",
          "Re-test after big GPU driver updates",
        ],
      },
      {
        heading: "If the switch is missing",
        body:
          "Settings only shows the option when the GPU and its driver support it. Updating the graphics driver is the first step. Writing the registry value on an unsupported system does not make the feature available.",
      },
    ],
    steps: [
      { title: "Use Settings (the documented route)", note: "Settings, System, Display, Graphics, then open the default graphics settings and switch Hardware-accelerated GPU scheduling. Restart Windows." },
      { title: "Check what is set now", code: "reg query \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\" /v HwSchMode", shell: "cmd" as const, note: "PC Tweaker's control writes 2. If the value is absent, Windows is using its default." },
    ],
    pctweaker: {
      title: "With PC Tweaker",
      body:
        "The Hardware-accelerated GPU scheduling control in the Gaming category writes HwSchMode = 2, shows that change under Technical details before it runs, and records the previous value so Restore puts it back exactly, including removing it if it was absent.",
      links: [{ to: "/tweaks/gaming/hardware-accelerated-gpu-scheduling/", label: "Hardware-accelerated GPU scheduling" }],
    },
    related: [
      { to: "/tweaks/gaming/hardware-accelerated-gpu-scheduling/", label: "the HAGS control's reference page", note: "The exact value, scope and restore behaviour." },
      { to: "/gaming-performance/", label: "the gaming performance guide", note: "Which Windows settings are worth testing, and how." },
      { to: "/database/processes/dwm-exe/", label: "dwm.exe and what its GPU use means", note: "The process that composes the desktop." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "DirectX Developer Blog: Hardware Accelerated GPU Scheduling", url: "https://devblogs.microsoft.com/directx/hardware-accelerated-gpu-scheduling/" },
        { label: "PC Tweaker source code: the hardware_gpu_scheduling entry (tweaks.rs)", url: `${SRC}/tweaks.rs` },
      ],
    },
  },
  "/fixes/enable-long-paths": {
    eyebrow: "FIX · FILES",
    title: "\"Path too long\" on Windows: enable long paths, and its limits",
    seoTitle: "Fix \"Path Too Long\" Errors: Enable Long Paths",
    seoDescription:
      "Windows limits most paths to 260 characters. Enable Win32 long paths by policy or registry, and learn why it only helps apps that declare longPathAware support.",
    intro:
      "Most Windows APIs stop at MAX_PATH, 260 characters. Since Windows 10 version 1607 a machine-wide switch lifts that limit, up to about 32,767 characters, but Microsoft documents a catch: it only applies to programs whose manifest declares longPathAware. Turn it on, then check whether the program that fails is one of them.",
    summary: [
      { label: "Value", value: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem LongPathsEnabled = 1" },
      { label: "Policy", value: "System, Filesystem, Enable Win32 long paths" },
      { label: "Applies to", value: "Apps that declare longPathAware only" },
      { label: "Admin rights", value: "Yes" },
      { label: "PC Tweaker plan", value: "Free" },
    ],
    sections: [
      {
        heading: "Turn it on",
        body:
          "Use the Group Policy editor on Pro and higher (Computer Configuration, Administrative Templates, System, Filesystem, Enable Win32 long paths) or set the registry value on any edition. Microsoft notes the value is cached per process after its first file call, so restart the program, or Windows, afterwards.",
      },
      {
        heading: "Why it may still fail",
        body:
          "Both conditions must hold: the value is set, and the program's manifest includes longPathAware. Programs that do not declare it keep the old limit. If a tool still fails, check its documentation for its own long-path option, or shorten the path, for example by moving the project closer to the drive root.",
      },
      {
        heading: "Before you turn it off again",
        body:
          "Files created with long paths while the switch was on stay where they are. With the switch off, programs that relied on it may no longer be able to open them, so move or shorten those paths before restoring the old limit.",
      },
    ],
    steps: [
      { title: "Read the current value", code: "reg query \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem\" /v LongPathsEnabled", shell: "cmd" as const },
      { title: "Turn it on (administrator prompt)", code: "reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem\" /v LongPathsEnabled /t REG_DWORD /d 1 /f", shell: "cmd" as const },
      { title: "Turn it off again", code: "reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem\" /v LongPathsEnabled /t REG_DWORD /d 0 /f", shell: "cmd" as const, note: "Write back the value you read first, or delete the value if it was absent." },
    ],
    pctweaker: {
      title: "With PC Tweaker",
      body:
        "The free control \"Enable long paths for compatible apps\" writes the same value after one administrator prompt, and Restore writes back the value it found, or removes it if it was absent.",
      links: [{ to: "/tweaks/maintenance/enable-long-paths/", label: "Enable long paths for compatible apps" }],
    },
    related: [
      { to: "/tweaks/maintenance/enable-long-paths/", label: "the long paths control's reference page", note: "Scope, restore behaviour and the source code." },
      { to: "/reversible-windows-tweaks/", label: "how PC Tweaker records the previous value", note: "Why Restore can remove a value that was absent." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "Microsoft Learn: Maximum Path Length Limitation", url: "https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation" },
        { label: "PC Tweaker source code: the enable_long_paths entry (tweaks.rs)", url: `${SRC}/tweaks.rs` },
      ],
    },
  },
  "/fixes/filter-keys-sticky-keys-shortcut": {
    eyebrow: "FIX · KEYBOARD",
    title: "Stop Sticky Keys and Filter Keys popping up in games",
    seoTitle: "Stop Sticky Keys and Filter Keys Popups",
    seoDescription:
      "Pressing Shift five times opens Sticky Keys; holding right Shift turns on Filter Keys. Turn off just the shortcuts, keep the features, and undo it any time.",
    intro:
      "Two accessibility shortcuts trip up gamers: pressing Shift five times opens the Sticky Keys prompt, and holding the right Shift key for eight seconds turns on Filter Keys. Both are documented flags. You can switch off the shortcuts alone, so the features stay available for anyone who needs them.",
    summary: [
      { label: "Sticky Keys shortcut", value: "Shift pressed five times (SKF_HOTKEYACTIVE)" },
      { label: "Filter Keys shortcut", value: "Right Shift held for 8 s (FKF_HOTKEYACTIVE)" },
      { label: "Scope", value: "The signed-in account" },
      { label: "Admin rights", value: "No" },
      { label: "PC Tweaker plan", value: "Free" },
    ],
    sections: [
      {
        heading: "Turn off the shortcuts in Settings",
        body:
          "Open Settings, Accessibility, Keyboard. Select Sticky keys and turn off \"Keyboard shortcut for Sticky keys\"; then select Filter keys and turn off \"Keyboard shortcut for Filter keys\". Leave the features themselves as they are. Turning the same switches on again undoes it.",
      },
      {
        heading: "What changes, exactly",
        body:
          "Each switch clears one flag: SKF_HOTKEYACTIVE for Sticky Keys, FKF_HOTKEYACTIVE for Filter Keys. Microsoft documents these as the flags that let the user turn the feature on and off from the keyboard. Your timings and other accessibility settings are untouched.",
      },
    ],
    steps: [
      { title: "Check the Sticky Keys flags", code: "reg query \"HKCU\\Control Panel\\Accessibility\\StickyKeys\" /v Flags", shell: "cmd" as const, note: "PC Tweaker writes 506, which is the usual value with the shortcut flag cleared. Set by hand it applies after you sign out and back in; Settings applies it at once." },
    ],
    pctweaker: {
      title: "With PC Tweaker",
      body:
        "Two free controls in the Gaming category do the same: \"Stop the Sticky Keys popup\" writes the flags value, and \"Prevent the Filter Keys shortcut\" clears only the shortcut flag through Windows' own API and saves the previous state. Each is restored on its own.",
      links: [{ to: "/tweaks/gaming/disable-sticky-keys-prompt/", label: "Stop the Sticky Keys popup" }, { to: "/tweaks/gaming/disable-filter-keys-shortcut/", label: "Prevent the Filter Keys shortcut" }],
    },
    related: [
      { to: "/windows-gaming-work-study-profiles/", label: "the Gaming profile", note: "The Sticky Keys control is one of its options, unticked until you choose it." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "Microsoft Learn: STICKYKEYS structure", url: "https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-stickykeys" },
        { label: "Microsoft Learn: FILTERKEYS structure", url: "https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-filterkeys" },
        { label: "PC Tweaker source code: the Filter Keys control (everyday.rs)", url: `${SRC}/everyday.rs` },
      ],
    },
  },
  "/fixes/windows-update-using-bandwidth": {
    eyebrow: "FIX · NETWORK",
    title: "Windows Update eating your bandwidth: limit it, keep updating",
    seoTitle: "Stop Windows Update Hogging Your Bandwidth",
    seoDescription:
      "Delivery Optimization downloads updates and can upload them to other PCs. Turn off sharing, cap background downloads and keep Windows Update running.",
    intro:
      "Windows downloads updates through Delivery Optimization, which can also share pieces of them with other PCs. If downloads or uploads crowd your connection, Windows has two documented levers: stop sharing with other PCs, and cap how fast background downloads may go. Neither stops updates.",
    summary: [
      { label: "Service", value: "Delivery Optimization (DoSvc)" },
      { label: "Stop sharing", value: "DODownloadMode = 0 (HTTP only, no peering)" },
      { label: "Cap downloads", value: "DOMaxBackgroundDownloadBandwidth (KB/s)" },
      { label: "Admin rights", value: "Yes, for the policies" },
      { label: "Windows Update", value: "Keeps working" },
    ],
    sections: [
      {
        heading: "In Settings",
        body:
          "Open Settings, Windows Update, Advanced options, Delivery Optimization. Turn off \"Allow downloads from other devices\" to stop sharing. Under Advanced options on the same page you can limit download and upload bandwidth, as an absolute value or a percentage.",
      },
      {
        heading: "What the policies do",
        body:
          "Microsoft documents download mode 0 as HTTP only with no peering: your PC downloads from Microsoft and shares nothing. The background bandwidth policy caps background downloads in kilobytes per second; 0 lets Windows adjust dynamically. Microsoft also notes the Delivery Optimization service shuts itself down when nothing is being transferred.",
      },
      {
        heading: "What not to do",
        body:
          "Disabling the Delivery Optimization or Windows Update services stops updates rather than slowing them, and leaves security fixes uninstalled. Use the limits, and pause updates from Settings when you need a quiet line for a while.",
      },
    ],
    steps: [
      { title: "Stop sharing with other PCs (administrator prompt)", code: "reg add \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization\" /v DODownloadMode /t REG_DWORD /d 0 /f", shell: "cmd" as const },
      { title: "Cap background downloads at 2,000 KB/s", code: "reg add \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization\" /v DOMaxBackgroundDownloadBandwidth /t REG_DWORD /d 2000 /f", shell: "cmd" as const },
      { title: "Undo both", code: "reg delete \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization\" /v DODownloadMode /f\nreg delete \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization\" /v DOMaxBackgroundDownloadBandwidth /f", shell: "cmd" as const, note: "If either value existed before you started, write that value back instead of deleting it." },
    ],
    pctweaker: {
      title: "With PC Tweaker",
      body:
        "\"Stop sharing Windows updates with strangers\" sets the download mode policy, and \"Windows background download limit\" sets the cap in KB/s from its own screen. Both are Pro, both record the previous value, and both are restored with one click.",
      links: [{ to: "/tweaks/maintenance/disable-delivery-optimization/", label: "Stop sharing Windows updates with strangers" }, { to: "/tweaks/performance/limit-do-background-download/", label: "Windows background download limit" }],
    },
    related: [
      { to: "/database/services/dosvc/", label: "the Delivery Optimization service", note: "What it does and why disabling it is the wrong lever." },
      { to: "/database/services/wuauserv/", label: "the Windows Update service", note: "What stops working if it is disabled." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "Microsoft Learn: DeliveryOptimization Policy CSP", url: "https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-deliveryoptimization" },
        { label: "Microsoft Learn: Delivery Optimization reference", url: "https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization-reference" },
        { label: "Microsoft Learn: Delivery Optimization FAQ", url: "https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization-faq" },
        { label: "PC Tweaker source code: the download limit (download_limit.rs)", url: `${SRC}/download_limit.rs` },
      ],
    },
  },
  "/fixes/turn-off-windows-11-ai-features": {
    eyebrow: "FIX · PRIVACY",
    title: "Turn off the Windows 11 AI features you do not use",
    seoTitle: "Turn Off Windows 11 AI Features You Don't Use",
    seoDescription:
      "Recall, Click to Do, the AI Components Host, the Copilot app and AI tools in Edge, Paint and Notepad: what each one is, how to turn it off and how to undo it.",
    intro:
      "Recent Windows 11 releases add AI features in several places, and each has its own switch. Some exist only on Copilot+ PCs; some are policies Microsoft documents for organisations and that work the same at home. Here is each one, the documented way to turn it off, and what PC Tweaker can do for it.",
    summary: [
      { label: "Recall", value: "Policy DisableAIDataAnalysis (Copilot+ PCs)" },
      { label: "Click to Do", value: "Policy DisableClickToDo" },
      { label: "AI Components Host", value: "Service WSAIFabricSvc, set to Manual" },
      { label: "Copilot app", value: "Uninstall per account" },
      { label: "Edge, Paint, Notepad", value: "Their own policies" },
    ],
    sections: [
      {
        heading: "Recall and Click to Do",
        body:
          "Recall saves snapshots of your screen and only exists on Copilot+ PCs; it is off until you opt in. Microsoft documents the policy \"Turn off saving snapshots for use with Recall\" (DisableAIDataAnalysis) and states that snapshots already saved are deleted when it applies. Click to Do, which analyses what is on screen to suggest actions, has its own policy, DisableClickToDo. Both live under the WindowsAI policies and affect every account.",
      },
      {
        heading: "The Windows AI Components Host service",
        body:
          "On builds that include it, WSAIFabricSvc provides AI component services to apps and Windows features, in Windows' own description. Setting it to Manual stops it starting with Windows while still letting Windows start it on request. Disabled has been reported to leave taskbar and tray icons missing, so Manual is the safer choice.",
      },
      {
        heading: "The Copilot app",
        body:
          "The consumer Copilot app is an ordinary app: uninstall it from Settings, Apps, Installed apps. That removes it for your account; Copilot features inside Microsoft 365 apps are separate.",
      },
      {
        heading: "Edge, Paint and Notepad",
        body:
          "Microsoft Edge has policies for its AI features, documented in the Edge policy reference; which ones apply depends on the type of profile. Paint and Notepad have their own policies for Cocreator, Image Creator, generative fill and Notepad's writing tools. Each app shows that it is managed once a policy is set, which is how Windows labels any policy.",
      },
    ],
    steps: [
      { title: "Turn off Recall snapshots and Click to Do (administrator prompt)", code: "reg add \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsAI\" /v DisableAIDataAnalysis /t REG_DWORD /d 1 /f\nreg add \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsAI\" /v DisableClickToDo /t REG_DWORD /d 1 /f", shell: "cmd" as const },
      { title: "Start the AI Components Host only on demand", code: "sc qc WSAIFabricSvc\nsc stop WSAIFabricSvc\nsc config WSAIFabricSvc start= demand", shell: "cmd" as const, note: "Note the START_TYPE first; restore it with sc config WSAIFabricSvc start= <what you noted>." },
      { title: "Undo the policies", code: "reg delete \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsAI\" /v DisableAIDataAnalysis /f\nreg delete \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsAI\" /v DisableClickToDo /f", shell: "cmd" as const, note: "Deleted Recall snapshots do not come back." },
    ],
    pctweaker: {
      title: "With PC Tweaker",
      body:
        "Each of these is a separate control with its own Restore: Disable Recall, Turn off Click to Do, Start Windows AI Components Host only when needed, Turn off AI features in Microsoft Edge, Paint and Notepad. Controls that do not apply to your PC, because the feature or the edition is missing, are shown as unavailable instead of being applied. The Copilot app is listed in the app's removal screen, which removes it for your account and keeps a journal.",
      links: [{ to: "/tweaks/privacy/disable-recall/", label: "Disable Recall (AI screen snapshots)" }, { to: "/tweaks/privacy/disable-click-to-do/", label: "Turn off Click to Do" }, { to: "/tweaks/privacy/disable-ai-fabric-service/", label: "Start Windows AI Components Host only when needed" }, { to: "/tweaks/privacy/disable-edge-ai/", label: "Turn off AI features in Microsoft Edge" }, { to: "/tweaks/privacy/disable-paint-ai/", label: "Turn off AI features in Paint" }, { to: "/tweaks/privacy/disable-notepad-ai/", label: "Turn off AI features in Notepad" }],
    },
    related: [
      { to: "/turn-off-windows-recall/", label: "the full Recall guide", note: "Settings switch, policy and removing the component, with what each deletes." },
      { to: "/database/services/wsaifabricsvc/", label: "the AI Components Host service entry", note: "Why Manual, not Disabled." },
      { to: "/windows-privacy-tool/", label: "the other privacy settings PC Tweaker covers", note: "Diagnostic data, advertising ID, suggestions." },
      { to: "/tools/debloat-windows-11/", label: "removing the Copilot app and other preinstalled apps", note: "Pick apps, see what each removal costs, and keep the Store link to get it back." },
    ],
    sources: {
      checked: CHECKED,
      items: [
        { label: "Microsoft Learn: Manage Recall", url: "https://learn.microsoft.com/en-us/windows/client-management/manage-recall" },
        { label: "Microsoft Learn: WindowsAI Policy CSP", url: "https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-windowsai" },
        { label: "Microsoft Learn: Microsoft Edge browser policy documentation", url: "https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies" },
        { label: "PC Tweaker source code: the AI Components Host control (services.rs)", url: `${SRC}/services.rs` },
        { label: "PC Tweaker source code: the app removal catalogue (debloat.rs)", url: `${SRC}/debloat.rs` },
      ],
    },
  },
};
