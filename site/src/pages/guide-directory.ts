export const GUIDE_GROUPS = [
  {
    id: "gaming-drivers",
    title: "Gaming and driver diagnosis",
    description: "Start from the symptom, then isolate one variable at a time.",
    guides: [
      { path: "/guides/fix-dpc-isr-latency-windows-11/", title: "Diagnose DPC and ISR latency", note: "Investigate audio crackles and driver activity with a trace." },
      { path: "/guides/amd-x3d-intel-hybrid-core-steering-gaming/", title: "Check X3D and Intel Hybrid core steering", note: "Separate process placement from power policy and core parking." },
      { path: "/guides/amd-ryzen-x3d-core-parking-windows-11/", title: "Understand Ryzen X3D core parking", note: "Check your CPU topology before changing parking or placement." },
      { path: "/gaming-performance/", title: "Compare gaming performance", note: "Use repeated workloads and frame times to judge a change." },
      { path: "/windows-gaming-work-study-profiles/", title: "Choose Gaming, Work or Study settings", note: "Review a preset for the task and understand its restore limits." },
    ],
  },
  {
    id: "changes-recovery",
    title: "Windows changes and recovery",
    description: "Inspect the operation and the way back before applying it.",
    guides: [
      { path: "/what-pc-tweaker-changes/", title: "See what PC Tweaker changes", note: "Review settings, permissions and operations with different recovery limits." },
      { path: "/how-to-undo-windows-tweaks/", title: "Undo a Windows tweak", note: "Recover the recorded previous value rather than guessing a default." },
      { path: "/reversible-windows-tweaks/", title: "Understand reversible tweaks", note: "Distinguish restoring a setting from recovering deleted data." },
      { path: "/windows-11-optimizer/", title: "Review Windows 11 optimization", note: "Start with a baseline and choose deliberate changes for your workload." },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and telemetry",
    description: "Check the scope of each setting and what it leaves untouched.",
    guides: [
      { path: "/guides/windows-11-privacy-telemetry-rollback/", title: "Inspect privacy settings and rollback", note: "Read the registry values, edition limits and previous state." },
      { path: "/windows-privacy-tool/", title: "Choose Windows privacy controls", note: "Review diagnostic, advertising and tracking settings individually." },
      { path: "/turn-off-windows-recall/", title: "Turn off Windows Recall", note: "Compare the setting, policy and component-removal options." },
    ],
  },
  {
    id: "software-removal",
    title: "Software removal",
    description: "Review the uninstall command and what may remain afterward.",
    guides: [
      { path: "/uninstall-programs-completely/", title: "Uninstall a Windows program and review leftovers", note: "Use the registered uninstaller first, then inspect cleanup and recovery limits." },
      { path: "/uninstaller/guides/armoury-crate/", title: "Uninstall ASUS Armoury Crate completely", note: "Use ASUS's Uninstall Tool, stop the BIOS offering it again, then check what is left." },
      { path: "/uninstaller/guides/riot-vanguard/", title: "Uninstall Riot Vanguard and check its driver", note: "Remove it the way Riot documents, restart, then confirm vgk and vgc are gone." },
      { path: "/uninstaller/guides/mcafee-webadvisor/", title: "Remove McAfee and WebAdvisor", note: "Standard removal, McAfee's MCPR tool if that fails, and the folders and tasks to check." },
      { path: "/uninstaller/guides/onedrive/", title: "Uninstall OneDrive without losing files", note: "Make files local and stop folder backup before you unlink and remove the app." },
      { path: "/uninstaller/guides/microsoft-edge-webview2/", title: "Keep Microsoft Edge WebView2 Runtime", note: "Why it should stay, what breaks without it and how to reinstall it." },
    ],
  },
] as const;

export const DIRECTORY_GUIDES = GUIDE_GROUPS.flatMap((group) => [...group.guides]);
