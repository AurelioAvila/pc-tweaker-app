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
    updated: "2026-11-02",
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
        "On the Hardware screen, the DPC and interrupt latency panel records for 5 to 30 seconds and lists each driver's longest DPC and ISR, how many ran past Microsoft's limits, and the total time. It reads the kernel's own events, changes nothing and is part of the free plan; Windows asks for administrator approval once because a kernel trace needs it. Since 1.19 the Scan also takes a short timed sample of how many interrupts and DPCs CPU 0 handled compared with your other processors, and flags it when they pile up there. That is a measurement only: PC Tweaker does not move interrupts, and the fix is still the driver the trace names.",
      links: [{ to: "/tweaks/audio/", label: "Audio in PC Tweaker 1.20: your sound devices, fixes and a 10-second Check for crackles" }, { to: "/tweaks/performance/usb-suspend-diagnostics/", label: "USB wake troubleshooting on mains power" }, { to: "/tweaks/performance/pcie-link-power/", label: "Keep PCIe links active on mains power" }],
    },
    related: [
      { to: "/tweaks/audio/", label: "the Audio tweaks in PC Tweaker", note: "Every sound device with its real format, plus fixes for call ducking and Bluetooth volume; the Audio section also has a 10-second Check for crackles." },
      { to: "/fixes/hdmi-audio-cuts-off-start-of-sound-windows-11/", label: "HDMI or USB audio that cuts off the start of sounds", note: "Another audio problem Windows power saving can cause, with the timer to read." },
      { to: "/fixes/bluetooth-headphones-volume-too-low-windows-11/", label: "Bluetooth headphones that are too quiet", note: "Absolute Volume, and how to turn it off." },
      { to: "/fixes/equalizer-apo-not-working-windows-11/", label: "Equalizer APO not working", note: "Four checks if your system-wide equalizer has no effect." },
      { to: "/database/processes/audiodg-exe/", label: "audiodg.exe, the process that runs the audio engine", note: "Why its CPU use usually comes from driver-added effects." },
      { to: "/database/services/audiosrv/", label: "the Windows Audio service", note: "What happens if it is stopped, and why it is not the cause of crackling." },
      { to: "/fixes/check-pcie-link-speed-nvme-gpu/", label: "check the PCIe link of your devices", note: "A device on a narrower link than it supports is another thing the Scan can read." },
      { to: "/tools/timer-resolution-calculator/", label: "the timer and buffer latency calculator", note: "The arithmetic behind buffer sizes, polling rates and timer periods." },
      { to: "/tweaky-driver/", label: "checking the driver the trace points at", note: "Tweaky Driver shows the installed version and any available update for that device, with the package source, before you install anything." },
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
    updated: "2026-11-05",
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
        heading: "When the answer is settled: DLSS Frame Generation",
        body:
          "One case needs no test. NVIDIA's developer documentation lists Windows hardware-accelerated GPU scheduling as a requirement for DLSS Frame Generation, together with a GeForce RTX 40 Series GPU and Windows 10 version 2004 or later. If you use Frame Generation, keep HAGS on. For every other game, test it as below.",
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
      { to: "/fixes/check-resizable-bar-enabled/", label: "check whether Resizable BAR is on", note: "A related graphics setting that lives in the BIOS." },
      { to: "/how-to-undo-windows-tweaks/", label: "how to undo Windows tweaks", note: "Put a changed setting back, with or without PC Tweaker." },
    ],
    sources: {
      checked: "5 November 2026",
      items: [
        { label: "DirectX Developer Blog: Hardware Accelerated GPU Scheduling", url: "https://devblogs.microsoft.com/directx/hardware-accelerated-gpu-scheduling/" },
        { label: "NVIDIA Streamline SDK: DLSS Frame Generation requirements (FAQ)", url: "https://developer.nvidia.com/rtx/streamline/get-started" },
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
    updated: "2026-11-06",
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
      { to: "/fixes/windows-lowers-game-volume-during-calls/", label: "Windows turning the game down during calls", note: "Another Windows default that gets in the way mid-game, and the one setting that stops it." },
    ],
    sources: {
      checked: "6 November 2026",
      items: [
        { label: "Microsoft Support: make your keyboard and other input devices easier to use (Filter keys)", url: "https://support.microsoft.com/en-us/windows/make-your-mouse-keyboard-and-other-input-devices-easier-to-use-10733da7-fa82-88be-0672-f123d4b3dcfe" },
        { label: "Microsoft Support: Windows keyboard shortcuts for accessibility (right Shift for eight seconds)", url: "https://support.microsoft.com/en-us/windows/windows-keyboard-shortcuts-for-accessibility-021bcb62-45c8-e4ef-1e4f-41b8c1fc87fd" },
        { label: "Microsoft Learn: STICKYKEYS structure", url: "https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-stickykeys" },
        { label: "Microsoft Learn: FILTERKEYS structure", url: "https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-filterkeys" },
        { label: "PC Tweaker source code: the Filter Keys control (everyday.rs)", url: `${SRC}/everyday.rs` },
      ],
    },
  },
  "/fixes/windows-update-using-bandwidth": {
    updated: "2026-11-06",
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
      { to: "/database/services/usosvc/", label: "the Update Orchestrator Service", note: "Why Microsoft says not to disable it." },
      { to: "/database/processes/tiworker-exe/", label: "TiWorker.exe, the Windows Modules Installer Worker", note: "Why it is busy during and after updates." },
    ],
    sources: {
      checked: "6 November 2026",
      items: [
        { label: "Microsoft Learn: DeliveryOptimization Policy CSP", url: "https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-deliveryoptimization" },
        { label: "Microsoft Learn: Delivery Optimization reference", url: "https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization-reference" },
        { label: "Microsoft Learn: Delivery Optimization FAQ", url: "https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization-faq" },
        { label: "PC Tweaker source code: the download limit (download_limit.rs)", url: `${SRC}/download_limit.rs` },
      ],
    },
  },
  "/fixes/turn-off-windows-11-ai-features": {
    updated: "2026-11-06",
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
      { to: "https://redaxa.getcertsprint.com/", label: "keeping secrets out of the AI chats you still use", note: "Redaxa finds and redacts personal data and keys in a prompt before you share it." },
    ],
    sources: {
      checked: "6 November 2026",
      items: [
        { label: "Microsoft Learn: Manage Recall", url: "https://learn.microsoft.com/en-us/windows/client-management/manage-recall" },
        { label: "Microsoft Learn: WindowsAI Policy CSP (Click to Do, Copilot and Paint policies)", url: "https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-windowsai" },
        { label: "Microsoft Learn: manage Notepad (DisableAIFeatures)", url: "https://learn.microsoft.com/en-us/windows/client-management/manage-notepad" },
        { label: "Microsoft Learn: Microsoft Edge browser policy documentation", url: "https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies" },
        { label: "PC Tweaker source code: the AI Components Host control (services.rs)", url: `${SRC}/services.rs` },
        { label: "PC Tweaker source code: the app removal catalogue (debloat.rs)", url: `${SRC}/debloat.rs` },
      ],
    },
  },  "/fixes/check-ram-running-at-xmp-expo-speed": {
    eyebrow: "FIX · MEMORY",
    title: "RAM running slower than its rated speed? Check XMP and EXPO",
    seoTitle: "Check If Your RAM Runs at XMP or EXPO Speed",
    seoDescription:
      "New memory often runs at a slower default speed until XMP or EXPO is switched on in the BIOS. How to read the running speed in Windows, compare it and fix it.",
    updated: "2026-11-02",
    intro:
      "Memory sold as DDR5-6000 or DDR4-3600 does not necessarily run at that speed out of the box. Boards start a kit at a standard JEDEC speed and apply the faster profile stored on the module (Intel calls it XMP, AMD calls it EXPO) only once you enable it in the BIOS. Windows can tell you what the modules run at now, so the check takes a minute.",
    summary: [
      { label: "Speed running now", value: "ConfiguredClockSpeed (Win32_PhysicalMemory)" },
      { label: "Speed in the module data", value: "Speed (often the base rating, not the XMP/EXPO one)" },
      { label: "Where the rated speed is printed", value: "Kit label and part number" },
      { label: "Where you fix it", value: "BIOS/UEFI, memory section (XMP, EXPO or DOCP)" },
      { label: "Changes to your PC from the check", value: "None" },
    ],
    sections: [
      {
        heading: "Why a kit runs below its label",
        body:
          "JEDEC publishes the standard speeds that compatible boards support: its DDR4 standard tops out at 3200 MT/s and DDR5 starts at 4800 MT/s. Kits sold above those figures carry an extra profile in the module. Intel states that XMP modules first boot with the default JEDEC settings, and that the XMP profile is then selected in the BIOS. AMD's equivalent is EXPO, and some board makers label the AMD option DOCP. Until the profile is switched on, a DDR5-6000 kit can run at a much lower speed.",
      },
      {
        heading: "Read the speed it runs at",
        body:
          "Task Manager, Performance, Memory has a Speed line. For the module details, ask Windows for the physical memory records. Two fields matter: ConfiguredClockSpeed is the speed the module is configured to run at, and Speed is the speed recorded in the module's own data. Microsoft documents both as coming from the SMBIOS memory device structure. On DDR4 and DDR5 the values are data rates in MT/s, so 3200 means DDR4-3200, not a 3.2 GHz clock, whatever the field name suggests.",
      },
      {
        heading: "Compare it with the rated speed",
        body:
          "The Speed field is not a reliable rating for an XMP or EXPO kit, because on many modules it holds the base speed rather than the profile. On a test PC with a DDR5-6000 kit and the profile on, Speed read 5600 and ConfiguredClockSpeed read 6000. The rated figure is the one on the kit's label or box, usually repeated in the part number (a number such as 6000 or 3600, then the first timing, for example C36 or C16) and in the profile list in the BIOS. If ConfiguredClockSpeed is clearly below that figure, the profile is off.",
      },
      {
        heading: "Switch the profile on",
        body:
          "Restart and open the BIOS/UEFI setup (usually Del or F2 while the PC starts). In the memory or overclocking section, choose XMP on Intel boards, or EXPO or DOCP on AMD boards, and select the first profile. Save, restart and read the speed again in Windows. If the PC fails to boot or becomes unstable, turn the profile off: not every board and processor can run every kit at its rating, and a BIOS update from the board maker is the usual first step.",
        points: [
          "The setting lives in the BIOS; Windows cannot change it",
          "Update the BIOS from the board maker if the profile does not hold",
          "A faster memory speed is not a promise of a higher frame rate; test with your own games",
        ],
      },
    ],
    steps: [
      { title: "List each module's running speed and its recorded speed", code: "Get-CimInstance Win32_PhysicalMemory | Select-Object BankLabel, PartNumber, Speed, ConfiguredClockSpeed | Format-Table -AutoSize", shell: "PowerShell" as const, note: "No administrator rights needed. Read-only." },
      { title: "Read the generation", code: "Get-CimInstance Win32_PhysicalMemory | Select-Object -First 1 SMBIOSMemoryType", shell: "PowerShell" as const, note: "26 means DDR4 and 34 means DDR5." },
      { title: "Compare with the label", note: "Take the speed printed on the kit or in its part number and compare it with ConfiguredClockSpeed. A gap of a few hundred MT/s or more means the profile is not active." },
      { title: "Turn the profile on in the BIOS", note: "Memory or overclocking section: XMP (Intel), EXPO or DOCP (AMD), first profile. Save and restart, then run the first command again." },
    ],
    pctweaker: {
      title: "The same check in PC Tweaker",
      body:
        "The Scan's hardware audit reads the same records and reports \"RAM runs below its rated speed\" when the configured speed is at least 200 MT/s under the rating. It takes the rating from the module data and, for the kit makers that print it in the part number, from the part number, and it says which one it used. It is read-only: PC Tweaker never changes BIOS settings, it shows the steps above.",
      links: [{ to: "/tweaks/maintenance/smart-ram-booster/", label: "Smart RAM booster (a different job: standby memory)" }],
    },
    related: [
      { to: "/fixes/check-pcie-link-speed-nvme-gpu/", label: "check the PCIe link speed of your SSD and graphics card", note: "The other hardware setting that quietly costs speed." },
      { to: "/fixes/check-resizable-bar-enabled/", label: "check whether Resizable BAR is on", note: "Another BIOS setting Windows can only read." },
      { to: "/gaming-performance/", label: "the gaming performance guide", note: "How to test a change fairly before you keep it." },
    ],
    sources: {
      checked: "2 November 2026",
      items: [
        { label: "Microsoft Learn: Win32_PhysicalMemory class (Speed, ConfiguredClockSpeed)", url: "https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-physicalmemory" },
        { label: "Intel: Extreme Memory Profile (XMP)", url: "https://www.intel.com/content/www/us/en/gaming/extreme-memory-profile-xmp.html" },
        { label: "AMD: EXPO memory technology", url: "https://www.amd.com/en/products/processors/technologies/expo.html" },
        { label: "JEDEC: DDR5 SDRAM standard (JESD79-5)", url: "https://www.jedec.org/standards-documents/docs/jesd79-5" },
        { label: "PC Tweaker source code: the hardware audit (hwaudit.rs)", url: `${SRC}/hwaudit.rs` },
      ],
    },
  },
  "/fixes/check-pcie-link-speed-nvme-gpu": {
    eyebrow: "FIX · HARDWARE",
    title: "Is your NVMe SSD or graphics card on a slower PCIe link?",
    seoTitle: "Check PCIe Link Speed of an NVMe SSD or GPU",
    seoDescription:
      "A drive or graphics card can connect with fewer lanes or an older PCIe generation than it supports. Read the current and maximum link in Windows, then fix it.",
    updated: "2026-11-02",
    intro:
      "PCI Express devices negotiate a link with the motherboard: a generation (the speed of each lane) and a width (the number of lanes). A fast NVMe SSD in a slot wired for fewer lanes, or a graphics card that landed at x8 instead of x16, still works but at a lower ceiling. Windows stores both the current and the maximum link of each device, so you can read them without extra software.",
    summary: [
      { label: "Properties to read", value: "DEVPKEY_PciDevice_CurrentLinkSpeed, MaxLinkSpeed, CurrentLinkWidth, MaxLinkWidth" },
      { label: "Speed values", value: "1 = 2.5 GT/s, 2 = 5, 3 = 8, 4 = 16, 5 = 32 GT/s (PCIe generations 1 to 5)" },
      { label: "Graphics cards", value: "Judge the width; the speed drops when idle by design" },
      { label: "NVMe drives", value: "Judge both width and speed" },
      { label: "Admin rights", value: "Not for reading" },
    ],
    sections: [
      {
        heading: "Generation and width: what the numbers mean",
        body:
          "A lane runs at 2.5 GT/s in generation 1, 5 GT/s in generation 2, 8 GT/s in generation 3, 16 GT/s in generation 4 and 32 GT/s in generation 5. From generation 3 the data is encoded at 128 bits per 130, so one lane carries about 0.98 GB/s in generation 3 and about 1.97 GB/s in generation 4, in each direction. Multiply by the width: generation 4 x4, the usual NVMe link, has roughly 7.9 GB/s available, and generation 3 x4 roughly 3.9 GB/s. These are the ceilings of the link, calculated from the transfer rate, not what a given SSD reaches.",
      },
      {
        heading: "Why a link ends up lower",
        body:
          "A motherboard can wire an M.2 slot for fewer lanes or an older generation than the drive supports, or share lanes between slots so that filling one narrows another. The motherboard manual lists which slots do what. A graphics card can fall to x8 when a second device takes lanes, when it is not in the top full-length slot, or when a riser cable or a poor contact limits the link.",
      },
      {
        heading: "A low speed at idle is normal for a graphics card",
        body:
          "Graphics cards lower their link speed when nothing demanding is running, to save power. On a test PC with a generation 3 x16 graphics card, the current speed read 1 (2.5 GT/s) on the idle desktop against a maximum of 3, with the full x16 width. For a graphics card, check the width, and read the speed while a game or a graphics test is running; GPU-Z has a render test for exactly this. NVMe drives keep their negotiated link, so for them both width and speed are meaningful at any time.",
      },
      {
        heading: "Fixing a narrow or slow link",
        body:
          "For a graphics card, make sure it sits in the top full-length slot, check in the manual which other slots or M.2 drives share its lanes, and reseat the card. With a riser cable, confirm it supports the full width. For an SSD, move it to the M.2 slot the manual says is wired to the processor (often the one nearest to it) if that slot has the faster link, and update the BIOS from the board maker. Leave any BIOS option that sets the slot generation on Auto unless the manual says otherwise.",
      },
    ],
    steps: [
      { title: "Read the graphics card's link", code: "$g = Get-PnpDevice -Class Display -PresentOnly | Select-Object -First 1\nGet-PnpDeviceProperty -InstanceId $g.InstanceId -KeyName DEVPKEY_PciDevice_CurrentLinkSpeed, DEVPKEY_PciDevice_MaxLinkSpeed, DEVPKEY_PciDevice_CurrentLinkWidth, DEVPKEY_PciDevice_MaxLinkWidth | Select-Object KeyName, Data", shell: "PowerShell" as const, note: "Read-only. Run it once at idle and once while a game or a GPU test runs, and compare the width first." },
      { title: "Find the NVMe controller", code: "Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match 'NVM Express' } | Select-Object FriendlyName, InstanceId", shell: "PowerShell" as const, note: "Use the InstanceId of the controller (it starts with PCI\\) in place of $g.InstanceId in the first command." },
      { title: "Read the result", note: "Speed: 1 = 2.5 GT/s, 2 = 5 GT/s, 3 = 8 GT/s, 4 = 16 GT/s, 5 = 32 GT/s. Width is the number of lanes. A current width below the maximum (for example 8 against 16), or an NVMe drive whose current speed is below its maximum, means the link is below what the device supports." },
    ],
    pctweaker: {
      title: "The same check in PC Tweaker",
      body:
        "The Scan's hardware audit reads these four properties for every NVMe controller and graphics card. For an SSD it flags a lower width or speed; for a graphics card it flags only a narrower width, because of the idle behaviour above. Each finding names the device and lists the steps to fix it. It is read-only and changes nothing.",
      links: [{ to: "/tweaks/performance/pcie-link-power/", label: "Keep PCIe links active on mains power (a separate power setting)" }],
    },
    related: [
      { to: "/fixes/check-ram-running-at-xmp-expo-speed/", label: "check whether your RAM runs at its rated speed", note: "The most common BIOS setting that is left off." },
      { to: "/fixes/check-resizable-bar-enabled/", label: "check whether Resizable BAR is on", note: "A PCIe feature that also depends on the BIOS." },
      { to: "/fixes/hardware-accelerated-gpu-scheduling/", label: "hardware-accelerated GPU scheduling", note: "A Windows graphics setting to test once the hardware is right." },
    ],
    sources: {
      checked: "2 November 2026",
      items: [
        { label: "Microsoft Learn: NDIS_PCI_DEVICE_CUSTOM_PROPERTIES (current and maximum link speed and width)", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddndis/ns-ntddndis-_ndis_pci_device_custom_properties" },
        { label: "Microsoft Learn: Get-PnpDeviceProperty", url: "https://learn.microsoft.com/en-us/powershell/module/pnpdevice/get-pnpdeviceproperty" },
        { label: "TechPowerUp GPU-Z (bus interface and render test)", url: "https://www.techpowerup.com/gpuz/" },
        { label: "PC Tweaker source code: the hardware audit (hwaudit.rs)", url: `${SRC}/hwaudit.rs` },
      ],
    },
  },
  "/fixes/check-resizable-bar-enabled": {
    eyebrow: "FIX · GRAPHICS",
    title: "Is Resizable BAR on? How to check, and how to turn it on",
    seoTitle: "How to Check If Resizable BAR Is Enabled",
    seoDescription:
      "Resizable BAR lets the CPU use the graphics card's memory more efficiently. Check it in the NVIDIA Control Panel or GPU-Z, then enable it in the BIOS.",
    updated: "2026-11-02",
    intro:
      "Resizable BAR is an optional PCI Express feature that lets the processor access the graphics card's memory more efficiently. It needs support in the graphics card, the motherboard BIOS and the driver, and the BIOS option is usually off until you turn it on. Some games gain from it and others do not, so the point of checking is to know your setup, not to chase a number.",
    summary: [
      { label: "Needs", value: "Supported GPU and driver, CPU and chipset support, BIOS option enabled" },
      { label: "Check on NVIDIA", value: "NVIDIA Control Panel, System Information, Resizable BAR" },
      { label: "Check on any card", value: "GPU-Z, Resizable BAR field" },
      { label: "BIOS options", value: "Above 4G Decoding, then Re-Size BAR Support" },
      { label: "Windows boot mode", value: "UEFI (not CSM/Legacy)" },
    ],
    sections: [
      {
        heading: "What it does",
        body:
          "NVIDIA describes Resizable BAR as an optional PCI Express interface technology that lets assets be requested as needed and sent in full, so the CPU can access the frame buffer more efficiently. Without it the processor reaches the card's memory through a small window, 256 MB on most systems. Games use it differently, so the effect ranges from none to noticeable.",
      },
      {
        heading: "Check it on an NVIDIA card",
        body:
          "Open the NVIDIA Control Panel, choose System Information at the bottom left and look for Resizable BAR on the right. NVIDIA's guidance says a Yes means you are set; if it says no, enable Resizable BAR in the motherboard BIOS and reboot. If the line is missing, your driver version may no longer list it, and GPU-Z reports the state for any vendor's card.",
      },
      {
        heading: "Check it on any card with GPU-Z",
        body:
          "GPU-Z shows a Resizable BAR field on its Graphics Card tab for NVIDIA, AMD and Intel cards and reads Enabled or Disabled. AMD markets the feature as Smart Access Memory and lists the supported processors, motherboards and cards on its page; check that list before you spend time in the BIOS.",
      },
      {
        heading: "Turn it on in the BIOS",
        body:
          "Update the motherboard BIOS first, because support often arrived in a later release. Then, in the BIOS/UEFI, enable Above 4G Decoding, and after it Re-Size BAR Support; the exact names differ between makers and sit under Advanced or PCIe settings. Windows must start in UEFI mode, so the CSM/Legacy option has to be off. NVIDIA noted that some GeForce RTX 30 cards needed a graphics card BIOS (VBIOS) update from the card maker, and that laptop support depends on the manufacturer's model.",
        points: [
          "Enable Above 4G Decoding before Re-Size BAR Support",
          "Turn CSM/Legacy off; Windows needs to boot in UEFI mode",
          "Update the motherboard BIOS and the graphics driver first",
          "Test your own games with it on and off; do not expect a fixed gain",
        ],
      },
    ],
    steps: [
      { title: "NVIDIA: open System Information", note: "NVIDIA Control Panel, then System Information (bottom left). Read the Resizable BAR line on the right." },
      { title: "Any card: open GPU-Z", note: "On the Graphics Card tab, read the Resizable BAR field. It says Enabled or Disabled." },
      { title: "Check that Windows starts in UEFI mode", note: "Press Win+R, run msinfo32 and read BIOS Mode on the System Summary page. It must say UEFI." },
      { title: "Enable it in the BIOS", note: "Turn on Above 4G Decoding, then Re-Size BAR Support, with CSM off. Save, restart and read the state again." },
    ],
    pctweaker: {
      title: "The same check in PC Tweaker",
      body:
        "The Scan's hardware audit reads the largest memory window Windows has given the graphics card. The classic 256 MB window means the feature is off; anything larger means it is on. It is only judged for cards that can use the feature at all (NVIDIA RTX 30 and newer, AMD RX 6000 and newer, Intel Arc); for the others it reports not applicable, and it says \"could not be read\" when Windows does not expose the value. Read-only: it never changes BIOS settings.",
      links: [{ to: "/tweaks/gaming/hardware-accelerated-gpu-scheduling/", label: "Hardware-accelerated GPU scheduling (a Windows setting)" }],
    },
    related: [
      { to: "/fixes/check-pcie-link-speed-nvme-gpu/", label: "check the PCIe link of your graphics card", note: "A narrow link limits the card before Resizable BAR matters." },
      { to: "/fixes/check-ram-running-at-xmp-expo-speed/", label: "check whether your RAM runs at its rated speed", note: "The other BIOS setting worth ten minutes." },
      { to: "/fixes/hardware-accelerated-gpu-scheduling/", label: "hardware-accelerated GPU scheduling: on, off, or test it?", note: "How to test a graphics setting fairly." },
    ],
    sources: {
      checked: "2 November 2026",
      items: [
        { label: "NVIDIA: GeForce RTX 30 Series Resizable BAR support (requirements and how to verify)", url: "https://www.nvidia.com/en-us/geforce/news/geforce-rtx-30-series-resizable-bar-support/" },
        { label: "AMD: Smart Access Memory", url: "https://www.amd.com/en/technologies/smart-access-memory" },
        { label: "TechPowerUp GPU-Z", url: "https://www.techpowerup.com/gpuz/" },
        { label: "PC Tweaker source code: the hardware audit (hwaudit.rs)", url: `${SRC}/hwaudit.rs` },
      ],
    },
  },
  "/fixes/clear-standby-memory-windows-11": {
    eyebrow: "FIX · MEMORY",
    title: "Clear standby memory on Windows 11: what it is, and when it helps",
    seoTitle: "Clear Standby Memory on Windows 11: Worth It?",
    seoDescription:
      "Standby memory is cache Windows can reuse at once, so clearing it rarely speeds anything up. How to read it, empty it with RAMMap, and when it makes sense.",
    updated: "2026-11-02",
    intro:
      "Task Manager shows a large Cached figure, Resource Monitor shows most of your RAM as Standby, and a search suggests emptying it. Standby memory is not wasted memory: it holds data Windows already read, kept so it can be reused without going back to the disk. Emptying it returns the RAM immediately but makes Windows read that data again. It is a tool for a specific case, not a routine.",
    summary: [
      { label: "What standby memory is", value: "Cached pages that can be reused at once" },
      { label: "Counts as Available", value: "Yes: Available is the sum of free, zeroed and standby pages" },
      { label: "Empty it once by hand", value: "RAMMap (Sysinternals), Empty, Empty Standby List" },
      { label: "Admin rights", value: "Yes" },
      { label: "Cost of emptying", value: "Cached files are read from disk again" },
    ],
    sections: [
      {
        heading: "What standby memory is",
        body:
          "Windows keeps lists of physical pages: in use, modified (changed, waiting to be written), standby and free. Standby pages have left a program's working set but still hold valid data, so Windows can recall them without going to disk, or hand them to a program that asks for memory. That is why the Available memory counter is the sum of the zeroed, free and standby lists. A full standby list means the cache is doing its job.",
      },
      {
        heading: "When emptying it is worth trying",
        body:
          "A low Free figure with a high Standby figure is normal, because Windows gives standby pages to programs that need them. The narrow case is a workload that hitches exactly when Free memory runs out and Windows has to repurpose cached pages, where you want to compare with and without a release. Even then, test it: after a purge the files the cache held are read from disk again, so general use can feel slower for a while. We know of no published measurement showing that clearing standby memory improves performance on a typical PC, and this guide does not claim one.",
      },
      {
        heading: "See your own numbers first",
        body:
          "Resource Monitor, Memory tab, splits the memory bar into Hardware Reserved, In Use, Modified, Standby and Free. The PowerShell command below reads the same lists in MB. If Available is several GB there is nothing to gain from a purge. If Available is small and Standby is small too, programs are holding the memory, a purge will not help, and closing programs will.",
      },
      {
        heading: "Empty it once, by hand",
        body:
          "Windows has no setting for this. Microsoft's Sysinternals RAMMap can empty the lists on demand: run it as administrator and choose Empty, then Empty Standby List. It is a one-off: nothing persists, and Windows refills the cache as files are read. Automatic tools exist, but the same trade-off applies, so keep any threshold well below your normal Free figure rather than purging constantly.",
      },
    ],
    steps: [
      { title: "Read free, standby and available memory", code: "Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory | Select-Object AvailableMBytes, @{n='FreeMB';e={[int]($_.FreeAndZeroPageListBytes/1MB)}}, @{n='StandbyMB';e={[int](($_.StandbyCacheCoreBytes+$_.StandbyCacheNormalPriorityBytes+$_.StandbyCacheReserveBytes)/1MB)}}, @{n='ModifiedMB';e={[int]($_.ModifiedPageListBytes/1MB)}}", shell: "PowerShell" as const, note: "Read-only. Standby is the sum of its three priority groups." },
      { title: "Decide", note: "If AvailableMBytes is large, stop: Windows hands out the standby memory when a program asks for it." },
      { title: "Empty the standby list once (only to test)", note: "Download RAMMap from Microsoft, run it as administrator, then choose Empty, Empty Standby List. Compare Free and Standby afterwards. The cache refills as you work." },
    ],
    pctweaker: {
      title: "With PC Tweaker",
      body:
        "The Scan shows free memory next to the standby cache and offers a one-off release when free memory is short while a large cache is held; when releasing is not needed it says so. The Smart RAM booster (Pro) automates the narrow case: it releases the standby cache only when free memory drops below your threshold (1 GB by default), at most once every 5 minutes, never while a full-screen game is in front, and while PC Tweaker is open as administrator. Every release is measured and shown, so you see what it returned instead of guessing.",
      links: [{ to: "/tweaks/maintenance/smart-ram-booster/", label: "Smart RAM booster" }],
    },
    related: [
      { to: "/tweaks/maintenance/smart-ram-booster/", label: "the Smart RAM booster's reference page", note: "The exact rule, the manual equivalent and the verdict." },
      { to: "/fixes/check-ram-running-at-xmp-expo-speed/", label: "check whether your RAM runs at its rated speed", note: "Often a bigger memory question than any cache purge." },
      { to: "/how-to-undo-windows-tweaks/", label: "how to undo Windows tweaks", note: "Put a changed setting back, with or without PC Tweaker." },
    ],
    sources: {
      checked: "2 November 2026",
      items: [
        { label: "Microsoft Learn (archive): Low Available RAM (free, zero and standby lists)", url: "https://learn.microsoft.com/en-us/archive/blogs/perfguide/low-available-ram" },
        { label: "Microsoft Learn: GetNumaAvailableMemoryNodeEx (Available Bytes includes standby pages)", url: "https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getnumaavailablememorynodeex" },
        { label: "Microsoft Learn: RAMMap (Sysinternals)", url: "https://learn.microsoft.com/en-us/sysinternals/downloads/rammap" },
        { label: "PC Tweaker source code: the Smart RAM booster (ramboost.rs)", url: `${SRC}/ramboost.rs` },
      ],
    },
  },
  "/fixes/is-registry-cleaner-safe-windows-11": {
    eyebrow: "FIX · REGISTRY",
    title: "Is a registry cleaner safe on Windows 11? What to know first",
    seoTitle: "Is a Registry Cleaner Safe on Windows 11?",
    seoDescription:
      "Microsoft does not support registry cleaners and none is shown to speed up Windows. What is reasonable to remove, how to back up first and how to restore.",
    updated: "2026-11-02",
    intro:
      "Registry cleaners promise a faster, healthier PC by deleting entries they call invalid. Microsoft's support policy is that it does not support the use of registry cleaning utilities, and that is a fair summary of the risk: a tool that removes entries it only suspects are unused can break a program, a driver or a file association. Most of the registry is not worth cleaning, and the small part that is can be handled with a backup and a way back.",
    summary: [
      { label: "Microsoft's position", value: "Registry cleaning utilities are not supported (KB 2563254)" },
      { label: "Speed gain", value: "None measured; do not expect one" },
      { label: "Always before cleaning", value: "A full backup and a restore point" },
      { label: "Reasonable to remove", value: "Entries whose target file is provably gone" },
      { label: "Not safe to remove", value: "Anything a tool only guesses is unused" },
    ],
    sections: [
      {
        heading: "What a registry cleaner does",
        body:
          "Windows and programs store settings in the registry, and uninstalling something sometimes leaves entries behind. A cleaner scans for keys and values that look unused and deletes them. The risk is in \"look unused\": COM registrations, drivers, shell extensions and file associations are referenced indirectly, and an entry that points at a file on an unplugged drive or a network share is unavailable, not abandoned. Microsoft says it does not support registry cleaners, which is why the usual advice is to leave a PC that works alone.",
      },
      {
        heading: "Will it make Windows faster?",
        body:
          "Leftover entries are tiny, and we know of no published measurement showing that removing them speeds up Windows. If a program is slow or startup takes long, look at startup items, services, drivers and the disk first. Treat a cleaner as housekeeping, not as a speed tool.",
      },
      {
        heading: "What is reasonable to remove",
        body:
          "An entry is reasonable to remove when you can prove it has no purpose: the file it exists to point at is gone, from a fixed internal drive that is present right now. Typical cases are the uninstall entry of a program whose uninstaller and folder are both gone, an App Paths entry for an executable that no longer exists, a startup entry whose command points at a missing file, and a shared DLL count for a file that no longer exists. If you cannot show that, leave the entry alone.",
        points: [
          "Back up before every clean, and create a restore point as well",
          "Never clean entries that point at removable or network drives",
          "Avoid tools that \"fix errors\" or \"optimize\" the whole registry",
          "Do not clean to fix a problem you have not diagnosed",
        ],
      },
      {
        heading: "Back up and restore by hand",
        body:
          "Export the branch you are about to edit to a .reg file and keep a System Restore point. If you remove something by mistake, importing the .reg file puts the entries back. System Protection must be on for the system drive (System Properties, System Protection) for restore points to be created.",
      },
    ],
    steps: [
      { title: "Create a restore point", code: "Checkpoint-Computer -Description \"Before registry cleanup\" -RestorePointType MODIFY_SETTINGS", shell: "PowerShell" as const, note: "Run in an administrator PowerShell. Windows creates a restore point only if none was created in the past 24 hours." },
      { title: "Back up the branch you will edit", code: "reg export \"HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\" \"%USERPROFILE%\\Desktop\\uninstall-backup.reg\"", shell: "cmd" as const, note: "Do the same for any other branch. The file is plain text you can open in Notepad." },
      { title: "Restore it if something broke", code: "reg import \"%USERPROFILE%\\Desktop\\uninstall-backup.reg\"", shell: "cmd" as const, note: "Run in an administrator Command Prompt. It re-creates the exported keys and values." },
    ],
    pctweaker: {
      title: "How PC Tweaker's registry cleaner differs",
      body:
        "PC Tweaker does not walk the whole registry. It knows five kinds of entry and nothing else: uninstall entries, App Paths, cached program names, shared DLL counts and startup entries. An entry counts as orphaned only when the file it points at is missing from a fixed drive that is connected now, so a path on a USB disk or a network share is never treated as proof, and machine-wide startup entries (HKLM Run) are left out on purpose. Every clean writes a full backup first (a restore file plus a standard .reg file you can open), nothing is deleted if the backup cannot be written, and one click restores it. Finding leftovers is free; cleaning is Pro. The app says it plainly: cleaning tidies the registry, it does not make Windows measurably faster.",
      links: [{ to: "/uninstall-programs-completely/", label: "Uninstall programs completely, and review leftovers" }],
    },
    related: [
      { to: "/uninstall-programs-completely/", label: "how to uninstall a program and review what it leaves", note: "The registered uninstaller first, then the leftovers." },
      { to: "/how-to-undo-windows-tweaks/", label: "how to undo Windows tweaks", note: "Recover the recorded previous value rather than guessing a default." },
      { to: "/what-pc-tweaker-changes/", label: "what PC Tweaker changes", note: "Settings, permissions and operations, with their recovery limits." },
    ],
    sources: {
      checked: "2 November 2026",
      items: [
        { label: "Microsoft Support: Microsoft support policy for the use of registry cleaning utilities (KB 2563254)", url: "https://support.microsoft.com/kb/2563254" },
        { label: "Microsoft Learn: reg export", url: "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/reg-export" },
        { label: "Microsoft Learn: reg import", url: "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/reg-import" },
        { label: "Microsoft Learn: Checkpoint-Computer", url: "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/checkpoint-computer" },
        { label: "PC Tweaker source code: the registry cleaner (regclean.rs)", url: `${SRC}/regclean.rs` },
      ],
    },
  },
  "/fixes/bluetooth-headphones-volume-too-low-windows-11": {
    updated: "2026-11-03",
    eyebrow: "FIX · AUDIO AND BLUETOOTH",
    title: "Bluetooth headphones too quiet or volume not working on Windows 11",
    seoTitle: "Bluetooth Volume Too Low on Windows 11: Fix",
    seoDescription:
      "Bluetooth headphones too quiet, or the volume slider jumps or does nothing? Update first, then turn off Absolute Volume with one registry value you can undo.",
    intro:
      "Bluetooth headphones that stay quiet at full volume, a Windows slider that jumps from silent to loud, or volume keys that do nothing are often the same fault: Absolute Volume, a Bluetooth feature that hands the Windows volume slider straight to the headset. Some headsets implement it badly. The fix is to update first and, if that does not help, turn Absolute Volume off for the PC.",
    summary: [
      { label: "What it is", value: "Bluetooth Absolute Volume: the Windows slider sets the headset's own volume" },
      { label: "Registry value", value: "DisableAbsoluteVolume = 1 (DWORD) under HKLM\\SYSTEM\\CurrentControlSet\\Control\\Bluetooth\\Audio\\AVRCP\\CT" },
      { label: "Scope", value: "Every Bluetooth audio device on this PC" },
      { label: "After the change", value: "Reconnect the device or restart Windows; Windows and the headset then keep two separate volumes" },
      { label: "Admin rights", value: "Yes" },
      { label: "PC Tweaker plan", value: "Free" },
    ],
    sections: [
      {
        heading: "Try the harmless things first",
        body:
          "Install pending Windows updates and the Bluetooth and audio drivers from your PC maker, restart, then remove the headphones in Settings, Bluetooth & devices and pair them again. Check the headset's own volume as well: if it sits at a low step, the Windows slider cannot make it louder. Turn off any volume limiter in the headset's companion app.",
      },
      {
        heading: "Why turning Absolute Volume off helps",
        body:
          "With Absolute Volume, the volume you set in Windows is sent to the headset as its own volume. When a headset or its firmware handles that badly, the sound stays too low, the steps are too coarse or the level jumps. With the feature off, Windows lowers the signal it sends and the headset keeps its own level. The trade-off is that there are now two volumes: keep the Windows slider fairly high and adjust the headset, because both being low can make the sound weak.",
        points: [
          "It applies to every Bluetooth audio device on the PC, not only the one that misbehaves",
          "It does not change anything for wired or USB audio",
          "Reconnect the headset or restart Windows afterwards",
          "Set the value back to 0 or delete it to return to the default",
        ],
      },
      {
        heading: "What this does not fix",
        body:
          "If the sound is thin or muffled only while an app uses the headset's microphone, that is a different cause: Windows has switched the headset to its call profile. See the call-mode guide linked below. Crackling is a driver timing problem, not a volume one.",
      },
    ],
    steps: [
      { title: "Read the current setting", code: "reg query \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\Bluetooth\\Audio\\AVRCP\\CT\" /v DisableAbsoluteVolume", shell: "cmd" as const, note: "An error saying the value was not found means Absolute Volume is on, which is the Windows default." },
      { title: "Turn Absolute Volume off", code: "reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\Bluetooth\\Audio\\AVRCP\\CT\" /v DisableAbsoluteVolume /t REG_DWORD /d 1 /f", shell: "cmd" as const, note: "Run it in an administrator Command Prompt, then disconnect and reconnect the headphones or restart Windows. Back up the registry first if you want a copy." },
      { title: "Undo it", code: "reg add \"HKLM\\SYSTEM\\CurrentControlSet\\Control\\Bluetooth\\Audio\\AVRCP\\CT\" /v DisableAbsoluteVolume /t REG_DWORD /d 0 /f", shell: "cmd" as const, note: "Value 0 behaves like the value being absent. Reconnect the headphones again." },
    ],
    pctweaker: {
      title: "The same change in PC Tweaker",
      body:
        "The free control \"Fix Bluetooth volume control\" in the Audio category writes the same value (it needs administrator rights), saves what was there before and puts exactly that back when you restore it. It is never part of Fix all, because it affects every Bluetooth device, and the Scan only mentions it as a hint. The Audio page also shows when a Bluetooth headset has been switched to call mode, the other usual cause of poor Bluetooth sound.",
      links: [{ to: "/tweaks/audio/bt-absolute-volume-off/", label: "Fix Bluetooth volume control" }],
    },
    related: [
      { to: "/fixes/bluetooth-headphones-bad-sound-when-mic-is-on/", label: "Bluetooth headphones sound bad when the microphone is on", note: "The call-profile switch that makes music sound thin while an app listens." },
      { to: "/fixes/windows-lowers-game-volume-during-calls/", label: "Windows lowering your game volume during calls", note: "A separate setting that also makes sound quieter, on purpose." },
      { to: "/fixes/dpc-latency-audio-crackling/", label: "audio crackling and dropouts", note: "When the problem is pops rather than volume." },
      { to: "/database/services/audiosrv/", label: "the Windows Audio service", note: "What it does, and why restarting it is not the same as changing the Bluetooth setting." },
    ],
    sources: {
      checked: "3 November 2026",
      items: [
        { label: "Microsoft Q&A: a Microsoft Community Support answer giving the DisableAbsoluteVolume value", url: "https://learn.microsoft.com/en-us/answers/a/7613696" },
        { label: "PC Tweaker source code: the control and its limits (tweaks.rs)", url: `${SRC}/tweaks.rs` },
        { label: "PC Tweaker source code: the Audio page's reading of your devices (audio.rs)", url: `${SRC}/audio.rs` },
      ],
    },
  },
  "/fixes/windows-lowers-game-volume-during-calls": {
    updated: "2026-11-03",
    eyebrow: "FIX · AUDIO AND CALLS",
    title: "Stop Windows lowering your game or music volume during calls",
    seoTitle: "Stop Windows Lowering Game Volume During Calls",
    seoDescription:
      "Game or music drops when Discord or Teams opens the mic? Set Windows' Communications option to Do nothing and check the app's own attenuation. Easy to undo.",
    intro:
      "You join a voice chat and your game gets quieter, or your music almost disappears while someone talks. Two separate features can do it: Windows' own communications ducking, which lowers every other sound by 80% by default while a call app uses the microphone, and the call app's own attenuation. Turn off Windows' option first, then check the app.",
    summary: [
      { label: "Windows default", value: "Lower other sounds by 80% while communications activity is detected" },
      { label: "Setting", value: "Sound, Communications tab: \"When Windows detects communications activity\"" },
      { label: "Fix", value: "Choose \"Do nothing\"" },
      { label: "Applies", value: "From your next call, for your account" },
      { label: "Admin rights", value: "No" },
      { label: "PC Tweaker plan", value: "Free" },
    ],
    sections: [
      {
        heading: "Turn it off in Windows",
        body:
          "Open Settings, System, Sound, then More sound settings (or press Win+R and run mmsys.cpl). On the Communications tab, set \"When Windows detects communications activity\" to \"Do nothing\" and press OK. Microsoft describes the default as attenuating other audio streams by 80% while a communication stream is open, and the same tab lets you mute them instead or change the level.",
        points: [
          "It takes effect from your next call, not mid-call",
          "It is stored per user, so other accounts on the PC keep their own choice",
          "Your headset volume and Windows volume are not touched",
        ],
      },
      {
        heading: "Then check the call app",
        body:
          "Discord has its own attenuation (User Settings, Voice & Video, Attenuation) that lowers other apps while people speak, and Windows cannot switch it off. Teams, Zoom and game launchers have similar options. If the volume still drops after the Windows change, the app is doing it.",
      },
      {
        heading: "When a game is treated as a call",
        body:
          "Some games open a voice-chat stream that Windows classes as communications, so the rest of your sound ducks even without a call app. Players report this with flight simulators and with games that have built-in voice chat. The Windows setting above stops the effect in that case too. The trade-off is that other apps are no longer lowered when a real call starts.",
      },
    ],
    steps: [
      { title: "Open the Sound dialog", code: "control mmsys.cpl", shell: "cmd" as const, note: "Go to the Communications tab, choose \"Do nothing\" and press OK." },
      { title: "Check what Windows has stored", code: "reg query \"HKCU\\Software\\Microsoft\\Multimedia\\Audio\" /v UserDuckingPreference", shell: "cmd" as const, note: "No value means the Windows default (lower by 80%). 3 means \"Do nothing\". The number is the way the Communications tab stores its choice; Microsoft documents the setting, not the value." },
    ],
    pctweaker: {
      title: "The same change in PC Tweaker",
      body:
        "The free control \"Don't lower my game during calls\" in the Audio category sets that option to \"Do nothing\" for your account, needs no administrator rights and is restored from the value it saved. The Scan shows how Windows is set up on your PC (\"Windows lowers other sounds by 80% during calls\") and links to the control. Apps with their own ducking, such as Discord, keep theirs.",
      links: [{ to: "/tweaks/audio/audio-ducking-off/", label: "Don't lower my game during calls" }],
    },
    related: [
      { to: "/fixes/bluetooth-headphones-bad-sound-when-mic-is-on/", label: "Bluetooth headphones sounding thin during calls", note: "Another thing that changes when an app opens the microphone." },
      { to: "/fixes/bluetooth-headphones-volume-too-low-windows-11/", label: "Bluetooth volume too low", note: "When quiet sound has nothing to do with calls." },
      { to: "/database/processes/audiodg-exe/", label: "audiodg.exe", note: "The Windows audio engine, where the ducking is applied." },
    ],
    sources: {
      checked: "3 November 2026",
      items: [
        { label: "Microsoft Learn: Default Ducking Experience (80% default and the Communications tab options)", url: "https://learn.microsoft.com/en-us/windows/win32/coreaudio/stream-attenuation" },
        { label: "Microsoft Learn: Using the communication device", url: "https://learn.microsoft.com/en-us/windows/win32/coreaudio/using-the-communication-device" },
        { label: "PC Tweaker source code: the control (tweaks.rs)", url: `${SRC}/tweaks.rs` },
      ],
    },
  },
  "/fixes/hdmi-audio-cuts-off-start-of-sound-windows-11": {
    updated: "2026-11-03",
    eyebrow: "FIX · AUDIO AND POWER",
    title: "HDMI or USB audio cuts off the start of sounds on Windows",
    seoTitle: "HDMI Audio Cutting Off the Start of Sounds",
    seoDescription:
      "The first second of a sound is missing after silence? Some audio drivers power the device down when idle. Read the timer, set it to 0 on mains power, undo it.",
    intro:
      "A notification chime that starts half a second late, the first word of a video missing, a pop when sound begins: on HDMI, DisplayPort and some USB audio devices this happens after a short silence. If the driver has an idle timer, Windows switches the audio device off after that silence and has to wake it when sound arrives. This guide shows how to read the timer and, on mains power, stop it.",
    summary: [
      { label: "Symptom", value: "The start of a sound is cut off, or pops, after some seconds of silence" },
      { label: "Cause (when it applies)", value: "The driver's inactivity timer powers the device down" },
      { label: "Value", value: "PerformanceIdleTime (seconds, on mains power) in the driver key's PowerSettings" },
      { label: "Fix", value: "Set it to 0 so the device stays awake on mains power" },
      { label: "Battery", value: "ConservationIdleTime, the battery timer, is left alone" },
      { label: "Admin rights", value: "Yes" },
      { label: "PC Tweaker plan", value: "Pro" },
    ],
    sections: [
      {
        heading: "How the idle timer works",
        body:
          "Windows' audio port driver (PortCls) starts a timer whenever the device is idle. When it runs out, the device is put into a low-power state and woken again on the next access. Microsoft documents the values: PerformanceIdleTime for mains power and ConservationIdleTime for battery, both in seconds, plus IdlePowerState. The default is 0, which means no timer, so a device only has one when its driver's INF file sets it.",
      },
      {
        heading: "Not every cut-off is this",
        body:
          "Many HDMI and DisplayPort devices start late for other reasons: the TV or receiver wakes its own audio path, a graphics driver does not keep the audio stream alive, or an AV receiver mutes briefly on a new stream. Only a timer you can read in the registry is something Windows controls. If the value is 0 or missing for your device, this fix does nothing and the cause is in the driver or the display.",
        points: [
          "Value above 0 on your device: the timer is a plausible cause, worth a test",
          "Value 0 or missing: look at the graphics driver, the TV or receiver, and its own energy settings",
          "Test by playing sound after a few seconds of silence; if the gap is gone, the idle state was the cause",
        ],
      },
      {
        heading: "USB audio devices",
        body:
          "A USB headset or DAC that drops out or reconnects after silence is often switched off by Windows' USB power saving. In Device Manager, open the USB device, then the Power Management tab, and clear \"Allow the computer to turn off this device to save power\" (the tab only shows for some devices). On PCs that use Modern Standby, Microsoft advises against changing this, because it can drain the battery significantly.",
      },
    ],
    steps: [
      { title: "List the timers on this PC", code: "Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e96c-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object {\n  $p = Join-Path $_.PSPath 'PowerSettings'\n  if (Test-Path $p) {\n    $raw = (Get-ItemProperty $p).PerformanceIdleTime\n    $s = if ($raw -is [byte[]]) { [BitConverter]::ToUInt32($raw, 0) } else { $raw }\n    [pscustomobject]@{ Key = $_.PSChildName; Device = (Get-ItemProperty $_.PSPath).DriverDesc; IdleSecondsOnMains = $s }\n  }\n} | Format-Table -AutoSize", shell: "PowerShell" as const, note: "Read-only. A row with a number above 0 is a device that switches off after that many seconds of silence on mains power. Write the Key and the number down: that is your way back." },
      { title: "Keep that device awake on mains power", code: "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e96c-e325-11ce-bfc1-08002be10318}\\0003\\PowerSettings' -Name PerformanceIdleTime -Value ([byte[]](0,0,0,0)) -Type Binary", shell: "PowerShell" as const, note: "Replace 0003 with your Key and run it as administrator. The value is four bytes, so keep it a binary value. Restart Windows, or disable and enable the device in Device Manager, for it to take effect." },
      { title: "Put it back", note: "Write your original number back as four little-endian bytes: 4 seconds is (4,0,0,0), 10 is (10,0,0,0), 300 is (44,1,0,0). A driver reinstall can recreate the value." },
    ],
    pctweaker: {
      title: "The same fix in PC Tweaker",
      body:
        "The Audio page lists a device only when its driver really sets a timer above 0, for example \"Keep HDMI audio awake\", with the number of seconds it switches off after. A Pro fix sets PerformanceIdleTime to 0 after saving the exact bytes that were there, leaves the battery timer and the idle power state alone, and refuses any device that is not a current candidate. Restoring writes the saved bytes back. It needs administrator rights, and a button restarts the audio device so the change applies without restarting Windows. For USB audio, a second Pro fix switches off Windows' permission to power the device down, with the Modern Standby warning shown on PCs that use it.",
      links: [{ to: "/tweaks/audio/", label: "Audio controls" }],
    },
    related: [
      { to: "/fixes/dpc-latency-audio-crackling/", label: "audio crackling and dropouts", note: "When the sound is distorted rather than late." },
      { to: "/fixes/check-pcie-link-speed-nvme-gpu/", label: "checking the PCIe link of your graphics card", note: "HDMI audio comes from the graphics card, so its driver and link matter too." },
      { to: "/database/services/audiosrv/", label: "the Windows Audio service", note: "The service that wakes the device when sound starts." },
      { to: "/tweaky-driver/", label: "checking the graphics or audio driver", note: "Shows the installed version and available updates with the package source." },
    ],
    sources: {
      checked: "3 November 2026",
      items: [
        { label: "Microsoft Learn: Audio Device Class Inactivity Timer Implementation (PerformanceIdleTime, ConservationIdleTime, defaults)", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/audio/audio-device-class-inactivity-timer-implementation" },
        { label: "PC Tweaker source code: the idle-timer fix and its checks (audio.rs)", url: `${SRC}/audio.rs` },
      ],
    },
  },
  "/fixes/equalizer-apo-not-working-windows-11": {
    updated: "2026-11-03",
    eyebrow: "FIX · AUDIO AND EQUALIZER",
    title: "Equalizer APO not working on Windows 11: what to check",
    seoTitle: "Equalizer APO Not Working on Windows 11: Fixes",
    seoDescription:
      "Equalizer APO installed but nothing changes? Check the device is ticked, Windows effects are on, and no driver update gave the device a new ID. Step by step.",
    intro:
      "Equalizer APO is a free, open-source system-wide equalizer. When it stops doing anything, the cause is nearly always one of four things: the device was never selected, Windows has audio effects turned off for it, a driver or Windows update gave the device a new ID, or the app plays around the Windows audio engine. This guide checks them in order of how often they are the answer.",
    summary: [
      { label: "Check 1", value: "The playback device is ticked in Equalizer APO's Device Selector (Configurator)" },
      { label: "Check 2", value: "Audio enhancements are on for that device in Windows" },
      { label: "Check 3", value: "A driver or Windows update has not created a new device ID" },
      { label: "Check 4", value: "The app does not bypass the audio engine (exclusive mode, hardware OpenAL)" },
      { label: "Restart", value: "Needed after installing or changing devices" },
      { label: "Software", value: "Equalizer APO is third-party; PC Tweaker only reads its state" },
    ],
    sections: [
      {
        heading: "1. Is this device selected?",
        body:
          "Equalizer APO installs itself only on the devices you tick in its Device Selector (called the Configurator in older versions and in its documentation). Run DeviceSelector.exe or Configurator.exe from the installation folder, tick the playback device you actually use (and the capture device if you want to process the microphone), then restart Windows. The setup asks for that restart because the audio service has to reload.",
      },
      {
        heading: "2. Are audio effects switched on?",
        body:
          "Equalizer APO runs as an audio effect, so with effects off for a device it does nothing there. In Settings, System, Sound, open the device and check its audio enhancements; on older versions use the Sound control panel, the device's Properties, and look for \"Disable all enhancements\" or \"Enable audio enhancements\". Windows also turns effects off by itself when an effect keeps failing to load.",
      },
      {
        heading: "3. Did the device get a new ID?",
        body:
          "A driver or Windows update can give an audio device a new endpoint ID. Equalizer APO's record for the old ID then points at nothing, and the new device is not selected. Open the Device Selector, tick the device again and restart. Leftover records for devices that no longer exist are harmless.",
      },
      {
        heading: "4. Does the app bypass the engine?",
        body:
          "Equalizer APO processes sound in the shared Windows audio engine. An app that takes the device in exclusive mode, or a game using the vendor's hardware-accelerated OpenAL, talks to the driver directly, so the equalizer never sees it. Turn off exclusive mode in that app's output settings, or in the device's Advanced tab, and test again.",
      },
      {
        heading: "Still nothing?",
        body:
          "In the Device Selector, the troubleshooting options let you clear the \"Use original APO\" boxes, which helps when a driver's own effects conflict. Errors are written to EqualizerAPO.log in the LocalService profile's Temp folder; read it from an administrator Command Prompt.",
      },
    ],
    steps: [
      { title: "Open the Device Selector", code: "\"C:\\Program Files\\EqualizerAPO\\DeviceSelector.exe\"", shell: "cmd" as const, note: "Older versions ship Configurator.exe in the same folder. Tick the playback device in use, then restart Windows." },
      { title: "Read the log", code: "type \"C:\\Windows\\ServiceProfiles\\LocalService\\AppData\\Local\\Temp\\EqualizerAPO.log\"", shell: "cmd" as const, note: "Run it in an administrator Command Prompt." },
    ],
    pctweaker: {
      title: "What PC Tweaker's Audio page shows",
      body:
        "If Equalizer APO is installed, the Audio page shows its version and, for each device, whether it is active, bypassed (it is set up but Windows effects are off) or not active. A device counts as active only when both halves Equalizer APO itself checks are present: its effect registered on the endpoint and its own record for that endpoint. The page also counts records left behind by devices that no longer exist, and a button opens your installed Device Selector, which asks for administrator rights itself. PC Tweaker does not download, install or configure Equalizer APO and is not affiliated with it.",
      links: [{ to: "/tweaks/audio/", label: "Audio controls" }],
    },
    related: [
      { to: "/fixes/dpc-latency-audio-crackling/", label: "audio crackling", note: "If the equalizer works but the sound pops under load." },
      { to: "/database/processes/audiodg-exe/", label: "audiodg.exe", note: "The process where the equalizer runs." },
      { to: "/database/services/audiosrv/", label: "the Windows Audio service", note: "Why a restart is needed after changing devices." },
    ],
    sources: {
      checked: "3 November 2026",
      items: [
        { label: "Equalizer APO documentation (installation, troubleshooting options, log file, OpenAL note)", url: "https://sourceforge.net/p/equalizerapo/wiki/Documentation/" },
        { label: "Equalizer APO project page", url: "https://sourceforge.net/projects/equalizerapo/" },
        { label: "PC Tweaker source code: Equalizer APO health check (audio_eq.rs)", url: `${SRC}/audio_eq.rs` },
      ],
    },
  },
  "/fixes/bluetooth-headphones-bad-sound-when-mic-is-on": {
    updated: "2026-11-03",
    eyebrow: "FIX · AUDIO AND BLUETOOTH",
    title: "Bluetooth headphones sound bad when an app uses the microphone",
    seoTitle: "Bluetooth Headphones Sound Bad When Mic Is On",
    seoDescription:
      "Music turns thin and tinny when Discord or Teams opens your headset mic? Windows switched to the call profile. See which app, and how to get stereo back.",
    intro:
      "Your Bluetooth headphones sound fine until a call or game chat starts, then everything turns thin, mono and low in volume. That is not a fault: a classic Bluetooth headset can play high-quality stereo or carry a microphone, not both at once. When an app opens the headset's microphone, Windows switches to the call profile, and the sound drops to call quality until the microphone is released.",
    summary: [
      { label: "Cause", value: "An app opened the headset's microphone, so Windows uses the call (hands-free) profile" },
      { label: "Symptom", value: "Mono, tinny, quieter playback while the microphone is in use" },
      { label: "Main fix", value: "Use another microphone in that app" },
      { label: "Changes to your PC", value: "None: it is a choice in the app" },
      { label: "Admin rights", value: "No" },
    ],
    sections: [
      {
        heading: "Find which app has the microphone",
        body:
          "In Settings, Privacy & security, Microphone, Windows lists the apps that have used the microphone and when. Apps that listen in the background, such as voice chat, a meeting app left open or a game launcher, are the usual cause. Close it or take away its microphone access and the headset returns to stereo.",
      },
      {
        heading: "Use another microphone",
        body:
          "Keep the headphones for playback and choose a different input in the call app: the PC's built-in microphone, a webcam or a USB microphone. In Discord this is User Settings, Voice & Video, Input Device; in Teams and Zoom it is the audio settings. Set the default input in Settings, System, Sound, Input as well, so apps that use the default do not pick the headset.",
      },
      {
        heading: "If you need the headset microphone",
        body:
          "Then the call quality is the price of the profile, and you can only improve the volume, not the fidelity. Newer headsets and PCs that support Bluetooth LE Audio can do better, but that depends on both devices and their drivers. Update the Bluetooth driver from your PC maker first.",
      },
    ],
    steps: [
      { title: "See who uses the microphone", note: "Settings, Privacy & security, Microphone: the list shows each app's last access." },
      { title: "Choose another input", note: "Settings, System, Sound, Input: pick the built-in or USB microphone as default, then choose the same input inside the call app." },
    ],
    pctweaker: {
      title: "How PC Tweaker shows it",
      body:
        "The Audio page checks every Bluetooth microphone that is in use. When a program has one open, it reports that the headset is in call mode, names the program, and explains that playback has dropped to call quality. A button then opens Windows' Sound settings so you can choose another input. PC Tweaker never changes the microphone or the profile on its own, and the page also tells you if your default microphone is muted or very low.",
      links: [{ to: "/tweaks/audio/", label: "Audio controls" }],
    },
    related: [
      { to: "/fixes/bluetooth-headphones-volume-too-low-windows-11/", label: "Bluetooth volume too low or jumping", note: "The other common Bluetooth audio fault, caused by Absolute Volume." },
      { to: "/fixes/windows-lowers-game-volume-during-calls/", label: "Windows lowering game volume during calls", note: "Another effect of an app opening the microphone." },
      { to: "/fixes/dpc-latency-audio-crackling/", label: "audio crackling", note: "If the sound pops instead of thinning." },
    ],
    sources: {
      checked: "3 November 2026",
      items: [
        { label: "Microsoft Q&A: the sound is bad while using the microphone", url: "https://learn.microsoft.com/en-us/answers/questions/3946429/the-sound-is-bad-while-using-the-microphone" },
        { label: "PC Tweaker source code: call-mode detection (audio.rs)", url: `${SRC}/audio.rs` },
      ],
    },
  },
  "/fixes/check-for-driver-updates-windows-11": {
    updated: "2026-11-03",
    eyebrow: "FIX · DRIVERS",
    title: "Check for driver updates on Windows 11 without a driver updater",
    seoTitle: "Check for Driver Updates on Windows 11, Safely",
    seoDescription:
      "Find real driver updates with Windows Update, Device Manager and your PC maker. Read versions in PowerShell, keep a way back, and see what a checker adds.",
    intro:
      "Most PCs do not need every driver updated, and a newer version or an older date is not a reason by itself. Update a driver when something is wrong, such as a device with an error, a graphics problem in a new game, or a fix the maker documents. This guide shows how to read what you have, where genuine updates come from, and how to keep a way back. Then it explains what Tweaky Driver adds on top.",
    summary: [
      { label: "Safest first stop", value: "Settings, Windows Update, Advanced options, Optional updates, Driver updates" },
      { label: "Read your drivers", value: "Device Manager, or Get-CimInstance Win32_PnPSignedDriver in PowerShell (read-only)" },
      { label: "Find devices with errors", value: "Get-PnpDevice -PresentOnly, filtered on Status" },
      { label: "Best source for graphics, chipset, Wi-Fi", value: "The PC, motherboard or chip maker's page for your exact model" },
      { label: "Way back", value: "Restore point, and Roll Back Driver in the device's Properties" },
      { label: "Tweaky Driver", value: "Inventory and diagnostics free; the same full scan every 10 days on Free, unlimited on Pro" },
    ],
    sections: [
      {
        heading: "Start from a symptom, not a version number",
        body:
          "A driver date says when the package was built, not whether it is wrong for you. Windows' own inbox drivers often carry a date of 21 June 2006 and are correct. Update when a device shows an error, a game or app needs a newer graphics driver, a maker's note names a fix for your problem, or a security advisory covers it. If everything works, a new driver is a risk with no benefit.",
      },
      {
        heading: "Where genuine updates come from",
        body:
          "Windows Update lists driver updates the maker has published for your hardware under Optional updates. Your PC or motherboard maker's support page, for the exact model, is the source for chipset, audio, LAN and Wi-Fi drivers on a branded PC. For graphics, the chip maker (NVIDIA, AMD or Intel) publishes its own packages. Avoid sites that charge for drivers and repackaged driver packs: manufacturers publish drivers free.",
        points: [
          "Match the exact model, Windows version and 64-bit (x64) build",
          "Prefer the PC maker's package over a generic chip-maker one on laptops",
          "Read the release notes: some packages replace several drivers or need a restart",
          "Do not install firmware or BIOS updates because a checker listed them; follow the maker's own instructions",
        ],
      },
      {
        heading: "Make a way back before you install",
        body:
          "Create a restore point first. Windows normally creates one automatically at most once every 24 hours, so a manual request shortly after another one can be skipped. If a new driver misbehaves, open the device in Device Manager, go to the Driver tab and choose Roll Back Driver; the button only works when Windows kept the previous driver. A restore point is not a file backup.",
      },
      {
        heading: "What a driver checker can and cannot know",
        body:
          "A checker can read your hardware IDs and installed versions and compare them with what the sources publish. It cannot know whether a newer package fixes your problem, and no checker covers every device: coverage depends on what manufacturers publish. Treat any tool that claims to update everything, or to speed up your PC, with suspicion.",
      },
    ],
    steps: [
      { title: "List installed drivers with their version, date and maker", code: "Get-CimInstance Win32_PnPSignedDriver | Where-Object DeviceName | Sort-Object DeviceName | Select-Object DeviceName, DriverVersion, DriverDate, Manufacturer, InfName | Format-Table -AutoSize", shell: "PowerShell" as const, note: "Read-only. Add | Out-GridView or | Export-Csv to keep a copy before you change anything." },
      { title: "Show devices Windows reports as having a problem", code: "Get-PnpDevice -PresentOnly | Where-Object { $_.Status -ne 'OK' } | Select-Object Class, FriendlyName, Status, InstanceId | Format-Table -AutoSize", shell: "PowerShell" as const, note: "Some entries are harmless, such as emulated or disconnected devices. A device you use and rely on that shows Error is the one to look into." },
      { title: "List the third-party driver packages in the driver store", code: "pnputil /enum-drivers", shell: "cmd" as const, note: "Run it in an administrator Command Prompt. It shows each package's published name, original INF, provider, version and date." },
      { title: "Check Windows Update's driver offers", note: "Settings, Windows Update, Check for updates, then Advanced options, Optional updates, Driver updates. Tick only the ones that match a problem you have." },
      { title: "Create a restore point, then install", code: "Checkpoint-Computer -Description \"Before driver update\" -RestorePointType MODIFY_SETTINGS", shell: "PowerShell" as const, note: "Run it in an administrator PowerShell. System Protection must be on for the system drive; if Windows created a point in the last 24 hours, it may skip yours." },
    ],
    pctweaker: {
      title: "What Tweaky Driver does",
      body:
        "Tweaky Driver is a separate Windows app in the PC Tweaker suite. This is what its code and documentation state, and nothing more. It reads the device inventory (hardware IDs, installed versions, driver provider, INF and signature details, Windows problem codes) into one searchable list; missing metadata stays \"unknown\" and an old date is not treated as obsolete. A scan then looks for offers from Windows Update through the configured service, matched on connected device IDs and excluding firmware, and, in the full scan, from the Microsoft Update Catalog and from specific manufacturer feeds for hardware they recognize: NVIDIA desktop graphics cards, Intel's Driver & Support Assistant catalog, AMD chipset and graphics for named platforms and MSI motherboards. A catalog search hit is shown as a candidate, not as proof that it applies to your PC, and some packages are download-only. Before anything runs you review the source, versions, size and licence terms in a single-use plan, and downloads and installs are separate steps. Recovery preparation includes OEM INF exports, hash checks and a new Windows restore point where Windows allows one; drivers built into Windows rely on System Restore, and automatic restoration is not offered for most devices, so Roll Back Driver in Device Manager remains your way back. Scheduled scans are opt-in and never download or install on their own. The scan page reports how many devices have a package from an official source, how many have none, and how many could not be checked, because coverage depends on what manufacturers publish. The Free plan includes the same full scan once every 10 days; Pro removes that limit.",
      links: [{ to: "/tweaky-driver/", label: "Tweaky Driver: check Windows drivers and review each update" }],
    },
    related: [
      { to: "/fixes/dpc-latency-audio-crackling/", label: "finding the driver behind audio crackling", note: "Measure first, then update the one driver the trace names." },
      { to: "/fixes/check-pcie-link-speed-nvme-gpu/", label: "checking the PCIe link of your graphics card", note: "A graphics problem is not always a driver problem." },
      { to: "/fixes/hdmi-audio-cuts-off-start-of-sound-windows-11/", label: "HDMI audio that cuts off the start of sounds", note: "A power-saving setting that a driver update does not always change." },
      { to: "/fixes/is-registry-cleaner-safe-windows-11/", label: "whether a registry cleaner is worth running", note: "The other tool category that promises more than it can show." },
    ],
    sources: {
      checked: "3 November 2026",
      items: [
        { label: "Microsoft Learn: Get-CimInstance (Win32_PnPSignedDriver)", url: "https://learn.microsoft.com/en-us/powershell/module/cimcmdlets/get-ciminstance" },
        { label: "Microsoft Learn: PnPUtil command syntax", url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/pnputil-command-syntax" },
        { label: "Microsoft Learn: Checkpoint-Computer (one automatic restore point per 24 hours)", url: "https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/checkpoint-computer" },
        { label: "Tweaky Driver source: Free plan scan limit (free_quota.rs)", url: "https://github.com/AurelioAvila/Tweaky-Driver/blob/master/src-tauri/src/free_quota.rs" },
        { label: "Tweaky Driver source: Intel offers, download-only (intel_updates.rs)", url: "https://github.com/AurelioAvila/Tweaky-Driver/blob/master/src-tauri/src/intel_updates.rs" },
        { label: "Tweaky Driver source: Microsoft Update Catalog discovery (hardware_catalog.rs)", url: "https://github.com/AurelioAvila/Tweaky-Driver/blob/master/src-tauri/src/hardware_catalog.rs" },
        { label: "Tweaky Driver README: capabilities and limits", url: "https://github.com/AurelioAvila/Tweaky-Driver/blob/master/README.md" },
      ],
    },
  },
  "/fixes/remove-program-leftovers-windows-11": {
    updated: "2026-11-03",
    eyebrow: "FIX · UNINSTALL",
    product: "uninstaller" as const,
    title: "Remove program leftovers on Windows 11: files, registry, services and tasks",
    seoTitle: "Remove Program Leftovers on Windows 11 by Hand",
    seoDescription:
      "What an uninstall leaves behind: folders, registry keys, services and scheduled tasks. Read-only checks, backups first, and what the Uninstaller covers.",
    intro:
      "After you uninstall a program, Windows only runs the program's own uninstaller. Whatever that leaves is yours to find: data folders, shortcuts, registry keys, a service that still starts with Windows, a scheduled task that keeps looking for an update. This guide covers all four places, with read-only checks first and a backup before any change, and says exactly which of them PC Tweaker Uninstaller looks at.",
    summary: [
      { label: "Run first", value: "The program's own uninstaller, then restart" },
      { label: "Files", value: "%AppData%, %LocalAppData%, %ProgramData%, the install folder, Start Menu and Desktop shortcuts" },
      { label: "Registry", value: "HKCU\\Software\\<name> (per user); HKLM\\Software\\<name> (machine-wide, handle with care)" },
      { label: "Services and tasks", value: "Win32_Service and Get-ScheduledTask, filtered on the program's name" },
      { label: "Backup before deleting", value: "reg export for keys, Export-ScheduledTask for tasks, Recycle Bin for files" },
      { label: "Uninstaller finds and cleans", value: "Folders, shortcuts and per-user keys matched by exact name; services and tasks are not touched" },
    ],
    sections: [
      {
        heading: "Files: look by the program's name, not the vendor's",
        body:
          "Open %AppData%, %LocalAppData% and %ProgramData% (type each into the Explorer address bar) and look for a folder with the program's name. Check the old install folder under Program Files and the user's Start Menu and Desktop for shortcuts. Do not delete a vendor folder such as JetBrains or Logitech: it holds every product from that vendor, including ones still installed. Delete through Explorer so the Recycle Bin keeps a copy.",
      },
      {
        heading: "Registry: a few keys, with a backup",
        body:
          "A program's own settings usually sit in HKEY_CURRENT_USER\\Software\\<name>, and sometimes in HKEY_LOCAL_MACHINE\\SOFTWARE\\<name>. A machine-wide key can belong to a driver, a shared runtime or another edition of the same product, so check what it contains before deleting it. Export the key to a .reg file first: double-clicking the file brings it back. Also look at the Run key under HKCU or HKLM, \\Software\\Microsoft\\Windows\\CurrentVersion\\Run, for a startup entry that still points at a missing file.",
        points: [
          "Delete a key only when its name is the program's and its files are gone",
          "Never use a bulk \"registry cleaner\" for this: see the guide linked below",
          "A stale entry under Uninstall only makes the program show in Installed apps; remove that single key",
        ],
      },
      {
        heading: "Services: one that still starts with Windows",
        body:
          "A leftover service shows up in services.msc or in the list below with a path to a file that no longer exists. Note its name, stop it, then delete it with sc.exe from an administrator prompt. Only remove a service whose path clearly belongs to the program you removed, and never a Windows or driver service you do not recognize.",
      },
      {
        heading: "Scheduled tasks: updaters and helpers",
        body:
          "Many programs register a task that checks for updates or starts a helper at logon. Open Task Scheduler or use the list below, export the task to XML so you can import it again, then unregister it. A task under \\Microsoft\\Windows\\ belongs to Windows: leave it alone.",
      },
      {
        heading: "When this is not worth doing",
        body:
          "A settings folder is what makes a reinstall pick up where you left off, and a licence file in ProgramData may be what the vendor's activation check reads. If you may reinstall, keep them. Folders are usually small; the reason to clean is a program you will not use again, a service or task that still runs, or a conflict with a newer version.",
      },
    ],
    steps: [
      { title: "Find folders named after the program", code: "$name = 'ProgramName'\n$env:APPDATA, $env:LOCALAPPDATA, $env:ProgramData | ForEach-Object { Get-ChildItem $_ -Directory -Filter \"*$name*\" -ErrorAction SilentlyContinue } | Select-Object FullName, LastWriteTime", shell: "PowerShell" as const, note: "Read-only. Replace ProgramName and keep this window open: the next steps reuse $name. Open each hit in Explorer and decide; delete through Explorer to use the Recycle Bin." },
      { title: "Find services that mention the program", code: "Get-CimInstance Win32_Service | Where-Object { $_.Name -like \"*$name*\" -or $_.PathName -like \"*$name*\" } | Select-Object Name, State, StartMode, PathName | Format-Table -AutoSize", shell: "PowerShell" as const, note: "Read-only. A service whose PathName points at a file that no longer exists is a leftover." },
      { title: "Remove a leftover service", code: "sc.exe stop ServiceName\nsc.exe delete ServiceName", shell: "cmd" as const, note: "Run in an administrator Command Prompt, with the name from the previous step. Restart Windows afterwards if it reports the service is marked for deletion." },
      { title: "Find scheduled tasks that mention the program", code: "Get-ScheduledTask | Where-Object { $_.TaskName -like \"*$name*\" -or $_.TaskPath -like \"*$name*\" } | Select-Object TaskPath, TaskName, State | Format-Table -AutoSize", shell: "PowerShell" as const, note: "Read-only." },
      { title: "Export, then remove a leftover task", code: "Export-ScheduledTask -TaskName 'TaskName' -TaskPath '\\Vendor\\' | Out-File \"$env:USERPROFILE\\Desktop\\TaskName.xml\"\nUnregister-ScheduledTask -TaskName 'TaskName' -TaskPath '\\Vendor\\' -Confirm:$false", shell: "PowerShell" as const, note: "Run in an administrator PowerShell with the TaskName and TaskPath you found. Register-ScheduledTask -Xml (Get-Content file.xml -Raw) -TaskName 'TaskName' brings it back." },
      { title: "Back up, then delete a per-user registry key", code: "reg export \"HKCU\\Software\\ProgramName\" \"%USERPROFILE%\\Desktop\\ProgramName.reg\"\nreg delete \"HKCU\\Software\\ProgramName\" /f", shell: "cmd" as const, note: "Run the second line only after the first succeeded. Double-click the .reg file to restore the key." },
    ],
    pctweaker: {
      title: "What PC Tweaker Uninstaller finds and what it does not",
      body:
        "These are the rules in the Uninstaller's source (version 0.15.0). The app keeps a list of the last 50 programs that disappeared from the installed list, however they were removed, and can scan any of them, or a program you name or whose old folder you give. It offers the install folder Windows recorded if nothing else registered with Windows still lives in or under it and it is not a protected Windows folder, plus the program's folders under %AppData%, %LocalAppData%, %ProgramData% and %LocalAppData%\\Programs, Start Menu and Desktop shortcuts, startup entries, and per-user and machine-wide keys under Software. Only items inside the recorded install folder are pre-selected; items that only match by name are shown, marked, and never pre-selected. Shared locations such as Classes, Policies, Common Files and Package Cache are never offered. Cleaning files, folders and shortcuts is free and sends them to the Recycle Bin. Cleaning registry keys and startup entries needs Uninstaller Pro, and each one is backed up byte for byte first; nothing is deleted unless its backup was saved. Items of all users, in Program Files, ProgramData and HKEY_LOCAL_MACHINE, are cleaned in one administrator step that scans again and changes nothing if anything differs from the preview. Every cleanup can be undone from the Removal Ledger for free, and anything created again in the meantime is never overwritten. The leftover scan does not look for services, scheduled tasks or drivers, so those parts stay manual, as above.",
      links: [{ to: "/uninstaller/", label: "PC Tweaker Uninstaller: review a removal before it runs" }],
    },
    related: [
      { to: "/uninstall-programs-completely/", label: "uninstalling a program completely, from the start", note: "The order of steps, and what to keep on purpose." },
      { to: "/fixes/is-registry-cleaner-safe-windows-11/", label: "whether a registry cleaner is worth running", note: "Microsoft's position, and what is provably safe to remove." },
      { to: "/uninstaller/guides/onedrive/", label: "uninstalling OneDrive without losing files", note: "A removal where what you keep matters more than what you clean." },
      { to: "/uninstaller/guides/mcafee-webadvisor/", label: "removing McAfee and WebAdvisor", note: "A program that leaves services, tasks and folders behind." },
      { to: "/uninstaller/guides/norton-360/", label: "uninstalling Norton 360 completely", note: "The Remover tool, the apps it leaves, and the subscription that keeps running." },
    ],
    sources: {
      checked: "3 November 2026",
      items: [
        { label: "Microsoft Learn: Get-ScheduledTask", url: "https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/get-scheduledtask" },
        { label: "Microsoft Learn: Unregister-ScheduledTask", url: "https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/unregister-scheduledtask" },
        { label: "Microsoft Learn: sc delete", url: "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/sc-delete" },
        { label: "Microsoft Learn: reg export", url: "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/reg-export" },
        { label: "Microsoft Support: uninstall or remove apps and programs in Windows", url: "https://support.microsoft.com/en-us/windows/uninstall-or-remove-apps-and-programs-in-windows-4b55f974-2cc6-2d2b-d092-5905080eaf98" },
        { label: "PC Tweaker Uninstaller source: the leftover rules (residue.rs)", url: "https://github.com/AurelioAvila/pc-tweaker-uninstaller/blob/master/src-tauri/src/residue.rs" },
      ],
    },
  },
};
