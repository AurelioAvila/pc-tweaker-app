export const TECHNICAL_GUIDES = {
  "/guides/amd-x3d-intel-hybrid-core-steering-gaming": {
    "eyebrow": "GAME SESSION SCHEDULING",
    "format": "technical",
    "updated": "2026-10-16",
    "title": "Test core steering on AMD X3D and Intel Hybrid",
    "seoTitle": "AMD X3D & Intel Hybrid Core Steering for Gaming",
    "seoDescription": "Understand PC Tweaker Game Sessions on AMD X3D and Intel Hybrid CPUs: supported topology, CPU sets, protected-process limits and automatic restoration.",
    "intro": "Different cores and cache layouts make CPU placement a question to test. Compare the Windows scheduler with one reversible Game Sessions change, using the same game scene and background workload.",
    "sections": [
      {
        "heading": "Keep the scheduler as your baseline",
        "body": "Start with current supported Windows, chipset and graphics drivers, and leave firmware core settings unchanged. Record the game version, power mode, temperatures and the background applications you actually use. Run the same scene several times and compare frame-time consistency as well as average FPS. Intel warns that restricting a game to P-cores does not automatically improve performance. A GPU-bound scene or a game with its own thread scheduling may show no useful difference."
      },
      {
        "heading": "Understand CPU sets before changing placement",
        "body": "PC Tweaker uses Windows process-default CPU sets for session steering. These defaults apply to threads that do not choose their own CPU sets. A restrictive affinity mask still takes precedence, so the feature does not replace a game’s existing hard-affinity choices. It does not disable cores in firmware, change their clock speed or suspend background applications. Keep other affinity tools off during the comparison so the result has one explanation."
      },
      {
        "heading": "Check the detected topology, not the processor name",
        "body": "For AMD X3D, PC Tweaker requires an asymmetric cache layout with exactly one larger L3 domain. The game is directed to that cache domain; background processes are left unchanged. A single-die or uniform-cache processor does not meet that detection rule merely because its name contains X3D. For Intel Hybrid, the game receives CPU sets in the highest reported efficiency class, while eligible background processes receive the remaining classes. Unsupported or insufficient layouts are left alone."
      },
      {
        "heading": "Enable one registered game session",
        "body": "In Game Sessions, register the actual game executable and enable core steering for the test. Activation requires Pro; turning steering off remains available for recovery. Check the detected plan before launching the game, then reproduce the baseline with the same streaming, chat or browser workload. Judge the entire session: a frame-time change is not useful if an encoder, voice call or capture becomes unreliable. Keep the ordinary scheduler configuration if repeated runs do not show a worthwhile result."
      },
      {
        "heading": "Know which background processes are excluded",
        "body": "Intel background steering is limited to the signed-in user’s session. PC Tweaker skips Windows-directory processes, the game’s child processes, processes already carrying CPU sets and processes above normal priority. It also skips processes Windows will not let it access. Protected-game detection pauses steering rather than attempting to defeat protection. These exclusions mean that seeing some work outside the preferred cores is not, by itself, a malfunction. This feature is not an anti-cheat bypass."
      },
      {
        "heading": "Restore the session and check the result",
        "body": "The previous state is journaled before a steering change. Restoration runs when the game exits, steering or the session is disabled, PC Tweaker quits, or the application next starts after a crash. Before clearing CPU sets, recovery checks the process creation identity and that its current sets still match those applied by the session. Another tool’s later changes are left alone. CPU sets also end with the process; a reboot does not make this a permanent CPU policy."
      },
      {
        "heading": "Separate steering from core parking and driver latency",
        "body": "Core parking is a power-management policy; DPC/ISR tracing measures work in interrupt routines. Neither is the same mechanism as process CPU placement. Do not change all three during one benchmark. Keep the baseline, the tested setting and the restore result together, and investigate a driver or thermal problem on its own evidence. No core layout or steering preset guarantees a particular FPS increase."
      }
    ],
    "related": [
      { "to": "/guides/amd-ryzen-x3d-core-parking-windows-11/", "label": "Ryzen X3D: core parking versus process steering", "note": "Understand the separate power policy and manual alignment controls." },
      { "to": "/guides/fix-dpc-isr-latency-windows-11/", "label": "Diagnose DPC and ISR driver latency", "note": "Capture the symptom before treating it as a CPU placement problem." }
    ],
    "sources": {
      "checked": "16 October 2026",
      "items": [
        { "label": "Intel: optimizing threading for gaming performance", "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/optimizing-threading-for-gaming-performance.html" },
        { "label": "Microsoft: CPU sets and process defaults", "url": "https://learn.microsoft.com/en-us/windows/win32/procthread/cpu-sets" },
        { "label": "PC Tweaker: topology rules, exclusions and restoration", "url": "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/engine/dynamic_session.rs" },
        { "label": "PC Tweaker: Game Sessions and recovery access", "url": "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/game_sessions.rs" }
      ]
    }
  },
  "/guides/fix-dpc-isr-latency-windows-11": {
    "eyebrow": "DRIVER DIAGNOSTICS",
    "format": "technical",
    "updated": "2026-10-16",
    "title": "Find the driver behind DPC and ISR latency",
    "seoTitle": "Diagnose DPC/ISR Latency on Windows 11",
    "seoDescription": "Trace DPC and ISR latency on Windows 11, investigate nvlddmkm.sys and dxgkrnl.sys, and compare one driver change at a time before keeping a fix.",
    "intro": "Audio crackles and uneven frame times need a reproducible test before a tweak. Start with the workload that breaks, collect a short trace, then investigate the driver path that overlaps the problem.",
    "sections": [
      {
        "heading": "Record a repeatable symptom",
        "body": "Choose one short task: the same game scene, audio project or video call. Record the audio device, sample rate or buffer setting, display refresh rate, driver versions and whether the PC is plugged in. Note when the crackle or pause happens. A quiet desktop capture is a different workload; it cannot establish that a game-time problem is fixed. Repeat the baseline before changing anything."
      },
      {
        "heading": "Capture DPC/ISR activity while it happens",
        "body": "Windows Performance Recorder captures event traces, and Windows Performance Analyzer lets you inspect them. Both are part of the Windows Performance Toolkit. Select a recording configuration that includes DPC/ISR events, reproduce the short problem and stop the capture. In WPA, inspect the DPC/ISR duration timeline and narrow the interval around the symptom. Compare duration, count and driver attribution together; a busy driver is not necessarily the cause."
      },
      {
        "heading": "Interpret nvlddmkm.sys and dxgkrnl.sys carefully",
        "body": "If nvlddmkm.sys appears, start by identifying the installed NVIDIA display driver and whether the symptom began with that version. dxgkrnl.sys belongs to the Windows graphics kernel subsystem, so its appearance can involve work passing through the graphics stack. Neither filename proves that replacing a particular package will help. Keep the trace and driver version together. Do not delete either file or disable the display device to make a report look cleaner."
      },
      {
        "heading": "Check the driver inventory without changing it",
        "body": "This PowerShell command lists installed signed Plug and Play driver records. It does not update, remove or validate a driver. Match the device and provider with the trace, then use Device Manager or the device maker’s support page to review the relevant package. Driver dates alone are not a reliable ranking of package quality.",
        "code": "Get-CimInstance Win32_PnPSignedDriver |\n  Select-Object DeviceName, DriverProviderName, DriverVersion, DriverDate |\n  Sort-Object DeviceName"
      },
      {
        "heading": "Test one change and retain a route back",
        "body": "For a suspected driver regression, preserve the current package/version and review the vendor’s supported update or rollback route. Change one item, restart when required and repeat the same workload several times. Keep the result only if the symptom and trace improve consistently. If nothing changes, restore the prior configuration before trying another hypothesis. Do not combine a driver change with timer, power-plan and service presets; that hides which intervention mattered."
      },
      {
        "heading": "Use PC Tweaker to collect the short trace",
        "body": "In Hardware, open DPC and interrupt latency. PC Tweaker records a 5–30 second kernel ETW capture and reports driver-attributed durations, counts and events above its reference limits. Administrator rights are needed; this diagnostic does not change settings and has no tweak to roll back. Unresolved events stay unattributed. The 100 microsecond DPC and 25 microsecond ISR reference values come from Microsoft’s driver guidance; crossing them alone does not prove an audible glitch. Use WPA for deeper timeline analysis."
      },
      {
        "heading": "What a latency result does not promise",
        "body": "DPC/ISR execution time is not total input lag, network ping or an FPS benchmark. A short trace can miss an intermittent fault. Audio buffer underruns, USB devices, thermal limits, storage and application scheduling can also deserve investigation. Preserve the baseline and the conditions of the test so a driver vendor or support technician can reproduce what you observed."
      }
    ],
    "related": [
      {
        "to": "/guides/amd-ryzen-x3d-core-parking-windows-11/",
        "label": "Separate X3D scheduling from driver latency",
        "note": "CPU placement is a different question from time spent inside an interrupt routine."
      },
      {
        "to": "/how-to-undo-windows-tweaks/",
        "label": "Restore a setting after an unsuccessful experiment",
        "note": "Use the recorded previous state rather than a generic preset."
      }
    ],
    "sources": {
      "checked": "16 October 2026",
      "items": [
        {
          "label": "Microsoft: CPU analysis and DPC/ISR timelines in WPA",
          "url": "https://learn.microsoft.com/en-us/windows-hardware/test/wpt/cpu-analysis"
        },
        {
          "label": "Microsoft: Windows Performance Recorder",
          "url": "https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-recorder"
        },
        {
          "label": "Microsoft: DPC/ISR duration reference values",
          "url": "https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/example-15--measuring-dpc-isr-time"
        },
        {
          "label": "Microsoft: DirectX graphics kernel subsystem",
          "url": "https://learn.microsoft.com/en-us/windows-hardware/drivers/display/directx-graphics-kernel-subsystem"
        },
        {
          "label": "PC Tweaker: capture duration, attribution and diagnostic implementation",
          "url": "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/diagnostics/dpc.rs"
        }
      ]
    }
  },
  "/guides/amd-ryzen-x3d-core-parking-windows-11": {
    "eyebrow": "CPU SCHEDULING",
    "format": "technical",
    "updated": "2026-10-16",
    "title": "Ryzen X3D: check the topology before changing core parking",
    "seoTitle": "Ryzen X3D Parking and Steering on Windows 11",
    "seoDescription": "Understand Ryzen X3D core parking versus V-Cache steering on Windows 11. Check CPU topology, record the active power plan and compare a reversible test.",
    "intro": "Core parking, process CPU sets and 3D V-Cache placement are different controls. Establish which dies your processor exposes and what the game actually needs before forcing every core awake.",
    "sections": [
      {
        "heading": "Start with the CPU layout",
        "body": "An X3D label is not enough to choose a scheduling rule. On a single-die processor, there is no second die to move a game away from. On a multi-die processor with unequal L3 cache sizes, one die may offer the larger cache while another offers a different frequency trade-off. PC Tweaker reads the topology exposed by Windows and only offers V-Cache alignment when it identifies an asymmetric layout. It does not infer support from the product name."
      },
      {
        "heading": "Keep the platform baseline current",
        "body": "Check the processor and motherboard maker’s supported BIOS and chipset instructions before adding a scheduling override. AMD’s chipset package includes separate PPM provisioning and 3D V-Cache optimizer components; a GPU driver is not a substitute for that package. Keep a record of what is installed. Change platform components separately from process placement, and rerun the same game workload after each change."
      },
      {
        "heading": "Read the parking policy before changing it",
        "body": "The following commands show the active power scheme and its minimum unparked-core setting. They do not change it. CPMinCores is a percentage; a displayed AC value of 0x00000064 means 100%, which disables core parking for that setting. This is policy, not a live measurement of which cores are parked. Record the scheme GUID and both AC and DC values so a later comparison has a real baseline.",
        "code": "powercfg /getactivescheme\npowercfg /query SCHEME_CURRENT SUB_PROCESSOR CPMINCORES"
      },
      {
        "heading": "Do not confuse parking with CPU-set placement",
        "body": "Parking lets Windows manage the set of active processors. A process CPU-set assignment expresses where that process’s eligible threads should run. It does not turn off another die for the whole machine. Windows can also have thread-specific CPU sets or hard affinity restrictions; those can change the effective result. Do not copy another PC’s logical-processor numbers or assume Task Manager’s first half of the graph is the cache-rich die."
      },
      {
        "heading": "Compare one process under the same load",
        "body": "Use the same game build, scene, graphics settings and background workload. Record several baseline runs, then compare a supported placement change using frame-time behavior and the actual task you care about. A higher average FPS in one run can hide worse pacing or ordinary run-to-run variation. A process that benefits from more cores can regress when its eligible processors are narrowed. Leave a setting alone when the difference is inconclusive."
      },
      {
        "heading": "What PC Tweaker changes, and how to undo it",
        "body": "The 3D V-Cache die aligner applies process-default CPU sets to the selected running process. Its reset clears that default assignment; it is not a restoration of an unknown assignment made by another tool. The assignment ends when the process exits. Games that manage their own performance are protected from manual steering. The separate Disable core parking control writes only the active plan’s mains-power setting to 100 and records its prior state for rollback; battery policy is left unchanged. Do not treat those two actions as interchangeable."
      },
      {
        "heading": "Recheck after restoring",
        "body": "Reset the process placement or restart the process, and restore a changed parking setting through its own recorded rollback. Then verify the active power scheme and repeat the original workload. A Windows update, a different power plan or another scheduler utility can change the environment. PC Tweaker does not promise an FPS gain, and it does not replace AMD’s platform driver or the Windows scheduler."
      }
    ],
    "related": [
      {
        "to": "/guides/fix-dpc-isr-latency-windows-11/",
        "label": "Investigate a driver-time spike separately",
        "note": "A DPC/ISR capture answers a different question from process placement."
      },
      {
        "to": "/what-pc-tweaker-changes/",
        "label": "Review settings and recovery limits",
        "note": "A process reset, a saved power policy and a file backup are different mechanisms."
      }
    ],
    "sources": {
      "checked": "16 October 2026",
      "items": [
        {
          "label": "Microsoft: CPMinCores meaning and supported values",
          "url": "https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/options-for-core-parking-cpmincores"
        },
        {
          "label": "Microsoft: CPU sets and interaction with thread affinity",
          "url": "https://learn.microsoft.com/en-us/windows/win32/procthread/cpu-sets"
        },
        {
          "label": "AMD: chipset components, including PPM and V-Cache optimizer",
          "url": "https://www.amd.com/en/resources/support-articles/release-notes/RN-RYZEN-CHIPSET-7-11-26-2142.html"
        },
        {
          "label": "PC Tweaker: topology detection and process CPU-set reset",
          "url": "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/x3d.rs"
        },
        {
          "label": "PC Tweaker: mains-only parking policy and rollback",
          "url": "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/gaming.rs"
        }
      ]
    }
  },
  "/guides/windows-11-privacy-telemetry-rollback": {
    "eyebrow": "PRIVACY AND RECOVERY",
    "format": "technical",
    "updated": "2026-10-16",
    "title": "Windows 11 privacy changes you can inspect and undo",
    "seoTitle": "Windows 11 Privacy, Telemetry and Rollback",
    "seoDescription": "Inspect Windows 11 diagnostic and advertising settings, understand AllowTelemetry limits, and restore the recorded previous value without a debloat preset.",
    "intro": "Choose the data setting you want to change, record its current state and keep a precise route back. A registry value is not a universal telemetry off switch, and a restore point is not a backup of your files.",
    "sections": [
      {
        "heading": "Start in Windows Settings",
        "body": "Open Privacy & security, then Diagnostics & feedback, and review the diagnostic choices Windows exposes on your edition. Review advertising preferences separately. Capture the previous choice before changing it. Settings, a local policy and a policy supplied by an organization can interact; a managed control should be discussed with the administrator rather than worked around by changing permissions or blocking services."
      },
      {
        "heading": "Inspect the diagnostic-data policy",
        "body": "PC Tweaker’s Reduce diagnostic data collection control writes the DWORD AllowTelemetry to 0 in the machine policy key below. It requires administrator rights and Pro. This requests the lowest diagnostic-data level the Windows edition supports. Home and Pro retain Required diagnostic data; supported Enterprise and Education editions have additional policy options. The control does not disable scheduled tasks, despite its internal identifier, and it does not control every Microsoft application’s data collection.",
        "code": "reg query \"HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection\" /v AllowTelemetry"
      },
      {
        "heading": "Inspect the advertising ID separately",
        "body": "The Disable advertising ID control writes Enabled = 0 in the current user’s AdvertisingInfo key. It is a Free, per-user change and does not need administrator rights. This affects that advertising identifier, not browser cookies, all ads, third-party application telemetry or another Windows user’s settings. Read the current value first. If reg query says a key or value cannot be found, record that absence; it is different from finding a DWORD set to zero.",
        "code": "reg query \"HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo\" /v Enabled"
      },
      {
        "heading": "Preserve the original state before a manual edit",
        "body": "For a manual registry change, record the full hive, key, value name, type and previous data, including whether the value existed at all. Registry Editor can export the selected branch as a .reg file. Save that backup somewhere you can find again. Importing an export merges values; it does not automatically remove every value created after the export. Do not import a broad backup from another computer or assume deleting an entire policy branch restores just one preference."
      },
      {
        "heading": "Use the app’s recorded rollback for supported controls",
        "body": "PC Tweaker previews the current and proposed values before applying a setting and records the prior state for supported rollback. Restore that specific control from its category or review Change history, then follow any restart instructions. A value that was originally absent should be restored as absent, rather than replaced with a guessed Windows default. This saved state covers changes PC Tweaker recorded; it cannot reconstruct what another script erased before installation."
      },
      {
        "heading": "Know the limits of restore points and cleanup",
        "body": "A Windows restore point can help recover some system configuration, but its creation can fail or be unavailable and it is not a personal-file backup. Uninstalling software, deleting cached data and removing app packages have separate recovery paths. For privacy work, keep those operations out of the experiment. Back up important files independently and change one setting at a time so a regression can be traced to a particular decision."
      },
      {
        "heading": "Verify the result and keep the choice deliberate",
        "body": "After the requested restart or sign-in, query the same value again and revisit the Windows setting. Check the application or feature whose behavior mattered to you. If the change causes a problem, restore the saved state and repeat that check. Neither a registry write nor a higher privacy score proves that a PC sends no data. Recall, browser history and third-party services require their own separate controls."
      }
    ],
    "related": [
      {
        "to": "/turn-off-windows-recall/",
        "label": "Control Recall snapshots separately",
        "note": "Snapshot saving, the policy and component removal have distinct effects."
      },
      {
        "to": "/how-to-undo-windows-tweaks/",
        "label": "Restore a supported tweak step by step",
        "note": "Use the stored original state and check the result after any required restart."
      }
    ],
    "sources": {
      "checked": "16 October 2026",
      "items": [
        {
          "label": "Microsoft: Windows diagnostic-data settings and scope",
          "url": "https://learn.microsoft.com/en-us/windows/privacy/configure-windows-diagnostic-data-in-your-organization"
        },
        {
          "label": "Microsoft: back up and restore the registry",
          "url": "https://support.microsoft.com/en-us/windows/experience/backup-recovery/how-to-back-up-and-restore-the-registry-in-windows"
        },
        {
          "label": "PC Tweaker: exact diagnostic-data and advertising registry entries",
          "url": "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/tweaks.rs"
        },
        {
          "label": "PC Tweaker: recorded change and recovery behavior",
          "url": "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/rollback.rs"
        }
      ]
    }
  }
} as const;
