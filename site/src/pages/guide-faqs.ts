/**
 * Questions rendered at the foot of a guide and mirrored into its FAQPage
 * markup (src/seo.ts). Kept apart from Guides.tsx so seo.ts can read them
 * without importing a React page. check-seo.mjs asserts every question here
 * is visible in the prerendered HTML, so nothing may be listed that the page
 * does not show.
 */
export interface GuideFaq {
  readonly q: string;
  readonly a: string;
}

export const GUIDE_FAQS: Record<string, readonly GuideFaq[]> = {
  "/uninstall-programs-completely": [
    {
      q: "Is it safe to delete a program's folder instead of uninstalling it?",
      a: "No. The folder is only part of what an installer created. Services, drivers, file associations, Start Menu entries and the registry entry Windows lists the program under all stay behind, and the program's own uninstaller is the only thing that knows how to remove them. Uninstall first, then clean what is left.",
    },
    {
      q: "Where do programs leave files after uninstalling?",
      a: "Most often in a folder named after the program under %APPDATA%, %LOCALAPPDATA% or %PROGRAMDATA%, in Start Menu shortcuts, in per-user registry keys under HKEY_CURRENT_USER\\Software, and sometimes in the original install folder when the uninstaller could not remove a file that was in use.",
    },
    {
      q: "Can leftover cleanup be undone?",
      a: "Files and folders are moved to the Recycle Bin, so yes, from Windows itself. Per-user registry keys are deleted outright and are flagged as the one irreversible step before you confirm. Machine-wide registry keys are reported but never removed.",
    },
    {
      q: "Is PC Tweaker Uninstaller free?",
      a: "Single uninstalls, the safety score, the removal brief, the restore-point attempt, the leftover scan and the Removal Ledger are free with no account. Cleaning the leftovers the scan finds and batch removal are Pro, at 9.99 euro per year.",
    },
  ],
  "/turn-off-windows-recall": [
    {
      q: "Is Windows Recall on by default?",
      a: "No. Microsoft documents that saving snapshots is off until you opt in, and Recall only exists on Copilot+ PCs that meet its hardware requirements. If Settings has no Recall & snapshots page, Recall is not installed on your PC.",
    },
    {
      q: "Does the PC Tweaker control delete my existing snapshots?",
      a: "Microsoft states that snapshots previously saved on the device are deleted when the Turn off saving snapshots policy is applied, and that policy is what the Disable Recall control writes. If you want to keep them, export or review them before applying it.",
    },
    {
      q: "Why does the Recall control need administrator rights and Pro?",
      a: "It writes a machine-wide policy key under HKEY_LOCAL_MACHINE, which affects every user on the PC and needs elevation. Machine-wide policy controls are part of Pro; the per-user Settings switch is free and needs no tool at all.",
    },
    {
      q: "Does disabling Recall turn off Copilot or Click to Do?",
      a: "No. Copilot and Click to Do have their own settings and policies. The Recall policy only stops screen snapshots from being saved and indexed.",
    },
  ],
  "/windows-11-optimizer": [
    {
      q: "Is it safe to use a Windows 11 optimizer?",
      a: "It depends entirely on what the tool does and whether you can see it. A tool that applies documented settings one at a time, records the previous value and restores it on request is as safe as changing the setting yourself. A tool that runs a bundle of undisclosed changes behind one button, removes system packages or disables services in bulk is not, because nothing records what it did. PC Tweaker is built the first way; every control names the setting it writes.",
    },
    {
      q: "Will an optimizer make my games run faster?",
      a: "Usually not in frame rate, and anyone promising a specific gain is guessing. What the gaming controls do is remove avoidable interference: Xbox Game Bar background recording, the multimedia network throttle, mouse acceleration, the Sticky Keys shortcut that drops you out of fullscreen. That tends to show up as steadier frame times and fewer interruptions, not a higher number. A game that is limited by the GPU, the CPU or thermals stays limited by them.",
    },
    {
      q: "Do I need to reinstall Windows to get the changes back?",
      a: "No. Every setting PC Tweaker applies records the value it replaced, and the restore control writes that value back. Some changes, such as hardware-accelerated GPU scheduling, keeping the kernel in memory or the long-path limit, take effect after a restart in both directions. Cleanup, uninstall and driver actions are separate operations with their own recovery limits and are not settings.",
    },
    {
      q: "Is PC Tweaker free?",
      a: "Yes. The Free plan needs no account and includes the controls listed on the home page as free; Pro adds the remaining controls and tools. The optimizations described on this page apply the same settings on either plan.",
    },
    {
      q: "Does it work on Windows 10 as well as Windows 11?",
      a: "Yes. Most settings are the same on both. A few are Windows 11 items — Widgets, the Chat button, taskbar alignment, Recall — and are simply absent or inert on Windows 10. A control that is missing on your PC is a hardware, edition or policy limit, not an error.",
    },
  ],
  "/how-to-undo-windows-tweaks": [
    {
      q: "How do I undo a tweak I applied in PC Tweaker?",
      a: "Open the category it belongs to or the Change history, find the tweak and use its restore control. The app writes back the value it recorded when you applied the change, not a generic Windows default. If the description said a restart was needed to apply, a restart is needed to undo as well.",
    },
    {
      q: "I changed the setting myself or with a script. Can PC Tweaker undo it?",
      a: "Only if it recorded the previous value, which it can only have done for changes made through it. For a manual or scripted change, go back to the Windows setting or registry value and put back the value you had, from your own notes or a backup. PC Tweaker cannot reconstruct an unknown original value, and copying a value from another PC is a guess.",
    },
    {
      q: "I restored the setting and the problem is still there. What now?",
      a: "Then the setting was probably not the cause. A successful restore proves the value is back, not that it was responsible. Check whether something else changed at the same time — an update, a driver, another tool — and test one thing at a time. If Windows will not start, use Windows recovery options and your backups rather than further tweaks.",
    },
    {
      q: "Does switching to another profile undo the previous one?",
      a: "No. Gaming, Work and Study are starter selections that add changes; choosing another one does not remove what the first applied. Restore the individual changes you no longer want before assuming the system is back to where it was.",
    },
  ],
};
