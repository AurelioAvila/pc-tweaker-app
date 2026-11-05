/**
 * Questions rendered at the foot of a guide and mirrored into its FAQPage
 * markup (src/seo.ts). Kept apart from Guides.tsx so seo.ts can read them
 * without importing a React page. check-seo.mjs asserts every question here
 * is visible in the prerendered HTML, so nothing may be listed that the page
 * does not show.
 */
import { LINUX_FAQS } from "./linux-guide";

export interface GuideFaq {
  readonly q: string;
  readonly a: string;
}

export const GUIDE_FAQS: Record<string, readonly GuideFaq[]> = {
  "/will-my-games-work-on-linux": LINUX_FAQS,
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
      a: "Yes, from the Removal Ledger, and Undo is always free. Files and folders come back from the Recycle Bin, and registry keys and startup entries come back exactly as they were, from a byte-for-byte backup taken before they were deleted. Anything created again in the meantime is left as it is, never overwritten. The last 10 cleanups can be undone.",
    },
    {
      q: "Is PC Tweaker Uninstaller free?",
      a: "Single uninstalls, the safety score, the removal brief, the restore-point attempt, the leftover scan, cleaning leftover files and folders, Undo and the Removal Ledger are free with no account. Cleaning leftover registry keys and startup entries and batch removal are Pro, at 9.99 euro per year.",
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
      a: "Safety depends on the setting, your device and how you use it. PC Tweaker shows the change and saves previous values for supported tweaks, but that does not remove security, compatibility or recovery risks. Read each control's limits, keep a backup and test one relevant change at a time. Cleanup, uninstall and driver operations have separate recovery limits.",
    },
    {
      q: "Will an optimizer make my games run faster?",
      a: "There is no guaranteed FPS or frame-time improvement. Disabling unwanted background recording or changing an input preference can address a specific problem, but the result depends on your game, hardware, drivers and current settings. Compare repeated runs of the same scene and keep only changes with a useful, repeatable result. Mouse acceleration and shortcut preferences are not evidence of higher rendering performance.",
    },
    {
      q: "Do I need to reinstall Windows to get the changes back?",
      a: "For supported settings with a saved previous state, start with PC Tweaker's restore control and check the result; some changes also need a restart. That route restores recorded settings, not deleted files or a full Windows installation. Cleanup, uninstall and driver actions have separate recovery limits. Use the recovery guide if the change came from another tool or Windows no longer starts normally.",
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
      a: "First check the restore result and complete any required restart. A successful settings write does not establish what caused the problem or recover separate side effects. Repeat the same task, then review other changes made around that time, such as a driver, update or another tool. If Windows will not start, use Windows recovery options and your existing backups rather than applying further tweaks.",
    },
    {
      q: "Can System Restore undo a registry change?",
      a: "Sometimes. Microsoft describes a restore point as a snapshot of system files, installed applications, the Windows registry and system settings, so rolling back to a point made before the change can undo it. It only works if a restore point from before the change exists, and it is not a backup of your documents. A restore point also rolls back everything else that changed since then, so for one known setting, restoring that value is the smaller step.",
    },
    {
      q: "How do I back up a registry key before I change it?",
      a: "Export it first. In a Command Prompt, reg export \"HKCU\\Software\\ExampleKey\" \"%USERPROFILE%\\Desktop\\before.reg\" saves that key to a file, using your own key path. To put it back, double-click the .reg file or run reg import with its path, then restart if the setting needs it. Export only the key you are about to edit, and keep the file until you are sure the change is fine.",
    },
    {
      q: "Does switching to another profile undo the previous one?",
      a: "No. Gaming, Work and Study are starter selections that add changes; choosing another one does not remove what the first applied. Restore the individual changes you no longer want before assuming the system is back to where it was.",
    },
  ],
};
