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
    {
      q: "Which PCs can run Recall?",
      a: "Only Copilot+ PCs. Microsoft lists the requirements as a Copilot+ PC that meets the Secured-core standard, a 40 TOPS NPU, 16 GB of RAM, 8 logical processors and 256 GB of storage with at least 50 GB free to turn Recall on, plus Device Encryption or BitLocker and Windows Hello Enhanced Sign-in Security with at least one biometric sign-in. On any other PC there is no Recall to turn off.",
    },
    {
      q: "How much disk space does Recall use?",
      a: "By default, Microsoft allocates 25 GB to Recall on a 256 GB drive, 75 GB on a 512 GB drive and 150 GB on a drive of 1 TB or more. When that space is full, the oldest snapshots are deleted first, and Recall pauses saving snapshots when the drive has less than 25 GB free. Snapshots are stored and encrypted locally on the PC.",
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
  "/fixes/hardware-accelerated-gpu-scheduling": [
    {
      q: "Does hardware-accelerated GPU scheduling increase FPS?",
      a: "Not as a rule. When Microsoft introduced it, the DirectX team said users should not notice any significant changes: it cuts the overhead of scheduling GPU work, it is not a frame-rate switch. Results differ by game, GPU and driver, so measure one repeatable scene with it off and on, and keep the setting that wins.",
    },
    {
      q: "What happens if I turn HAGS off?",
      a: "After a restart, Windows goes back to scheduling GPU work from the CPU, as it did before the feature existed, and games and apps keep working. The one documented loss is DLSS Frame Generation: NVIDIA lists hardware-accelerated GPU scheduling as a requirement, so keep it on if you use Frame Generation.",
    },
    {
      q: "Is HAGS on by default?",
      a: "Microsoft introduced it as an opt-in option that was off by default. Check your own PC rather than assuming: look in Settings, System, Display, Graphics, or run the reg query command on this page. A HwSchMode value of 2 means it is on; if the value is absent, Windows is using its default.",
    },
    {
      q: "Why is the hardware-accelerated GPU scheduling option missing?",
      a: "Settings only shows it when both the graphics card and its driver support the feature. Microsoft's announcement names recent GPUs with the necessary hardware and a WDDM 2.7 or newer driver. Update the graphics driver from the GPU maker first; writing the registry value on an unsupported system does not make the feature available.",
    },
  ],
  "/uninstaller/guides/armoury-crate": [
    {
      q: "Is it bad to uninstall Armoury Crate?",
      a: "Removing it is supported: ASUS publishes the Armoury Crate Uninstall Tool for exactly this. The exception is ROG laptops, where ASUS does not recommend removing it for good because the laptop will not perform optimally without it. If you use Aura Sync or Aura Creator, keep Aura Service and ROG Live Service, which is ASUS's own note for older versions.",
    },
    {
      q: "Why does Armoury Crate keep coming back after I uninstall it?",
      a: "ASUS documents two triggers. ASUS motherboards have a BIOS option, Download & Install ARMOURY CRATE app, that is enabled by default and offers the download at boot: set it to Disabled under Tool, ASUS Armoury Crate in Advanced Mode. Supported ROG keyboards and mice can also prompt a download when Armoury Crate is missing; answer No to keep it uninstalled.",
    },
    {
      q: "What if the Armoury Crate Uninstall Tool fails?",
      a: "Restart when prompted and run the tool again; ASUS says the second run should succeed. If it fails again, find the log in the tool's folder, named ACUTLog_ followed by the date and time, and send it to ASUS customer service. Leave the remaining entries alone until then rather than removing them by hand.",
    },
    {
      q: "Can I uninstall Armoury Crate from Installed apps instead?",
      a: "ROG advises against it. Armoury Crate is several programs and services, a single entry in Installed apps removes only part of it, and ROG warns that an improper uninstall can cause problems. Use ASUS's Uninstall Tool, which removes them together, then restart.",
    },
  ],
  "/uninstaller/guides/microsoft-edge-webview2": [
    {
      q: "Can I uninstall Microsoft Edge WebView2 Runtime?",
      a: "Not from Settings, and you should keep it. Microsoft preinstalls the Evergreen WebView2 Runtime on every Windows 11 device as part of the operating system, apps built on WebView2 cannot show their interface without it, and Windows hides its Uninstall button: on the PC this guide was checked on, its entry carried NoRemove = 1 and SystemComponent = 1. If it does go missing, the next app that needs it may simply install it again.",
    },
    {
      q: "Is Microsoft Edge WebView2 Runtime a virus?",
      a: "No. It is a Microsoft component that ships with Windows 11. The genuine program file sits in C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application\\<version>\\msedgewebview2.exe and carries a valid Microsoft Corporation signature, which is what Get-AuthenticodeSignature reported on the PC this guide was checked on. A file with that name in another folder, or without a valid Microsoft signature, deserves a closer look.",
    },
    {
      q: "Why is Microsoft Edge WebView2 running in the background?",
      a: "Because an app that uses it is open, and that app is often part of Windows itself. On the PC this guide was checked on, Windows Search (SearchHost.exe) and PC Tweaker were the two apps running it. To see which apps run it on yours, paste this into PowerShell; it needs no administrator rights and changes nothing: Get-CimInstance Win32_Process -Filter \"Name='msedgewebview2.exe'\" | Where-Object CommandLine -NotMatch '--type=' | ForEach-Object { (Get-Process -Id $_.ParentProcessId -ErrorAction SilentlyContinue).Name }",
    },
    {
      q: "Why does WebView2 have so many processes?",
      a: "Each app that uses it runs its own group of processes. Microsoft documents that a WebView2 process group has one browser process, one or more renderer processes and helpers such as the GPU and audio processes, and that apps using different user data folders get separate groups. The PC this guide was checked on had 12 of them for two apps. Every process in a group is tied to the browser process its app started, so the count drops as you close those apps.",
    },
    {
      q: "Is WebView2 part of Microsoft Edge?",
      a: "It is built from Edge but installed separately. Microsoft describes the Runtime as modified Microsoft Edge binaries, fine-tuned and tested for WebView2 apps, and it never appears as a browser, a Start menu entry or a desktop shortcut. On eligible systems Microsoft hard-links the files of Edge and the Runtime when both are on the same version, so the shared files are not stored twice.",
    },
  ],
  "/uninstaller/guides/mcafee-webadvisor": [
    {
      q: "Why can't I uninstall McAfee?",
      a: "When the normal uninstall fails, McAfee's documented fallback is its Consumer Product Removal tool, MCPR. Download a fresh copy before each use, which McAfee asks for so that newer McAfee products are recognised. Run MCPR.exe, accept the licence, type the case-sensitive validation characters and wait: McAfee says it can take 20 minutes or more. When it shows Removal Complete, restart the PC. MCPR does not remove McAfee PC Optimizer, which you uninstall the standard way.",
    },
    {
      q: "Is it safe to uninstall McAfee?",
      a: "Yes, as long as the PC is still protected afterwards. On Windows 10 and 11, Microsoft Defender Antivirus turns itself off while another antivirus is active, and Microsoft documents that it can turn back on automatically once that product is uninstalled or expires. After the restart, open Windows Security, Virus & threat protection, and under Who's protecting me? select Manage providers to check that an antivirus is on. If McAfee came preinstalled and you never activated it, McAfee notes you may need to buy a subscription to reinstall it later.",
    },
    {
      q: "Does uninstalling McAfee cancel my subscription?",
      a: "No. Removing the app leaves your McAfee account and subscription as they are. If you do not want to renew, turn off auto-renewal in your McAfee account.",
    },
    {
      q: "How do I stop McAfee WebAdvisor after uninstalling McAfee?",
      a: "Uninstall WebAdvisor as well: McAfee describes it as a standalone app that can stay installed after LiveSafe or Total Protection is removed. In Settings, Apps, Installed apps, open the three-dot menu next to McAfee WebAdvisor, choose Uninstall, confirm, choose to just uninstall it, select Done and restart. If its extension is still listed in a browser, remove it from that browser's extensions page.",
    },
    {
      q: "Can I delete the McAfee folders that are left behind?",
      a: "No. If C:\\Program Files\\McAfee, C:\\ProgramData\\McAfee or the McAfee folder under your AppData\\Local is still there after MCPR and a restart, McAfee's instruction is not to delete, move, rename or modify it. Note which folders remain and contact McAfee customer service.",
    },
  ],
  "/uninstaller/guides/norton-360": [
    {
      q: "Does uninstalling Norton cancel my subscription?",
      a: "No. Norton states that uninstalling the app does not automatically cancel the subscription. Turn off automatic renewal on your Norton account page. If you bought it through the Apple App Store, Google Play or the Microsoft Store, change it in that store; if a partner such as your internet provider bills you, change it with that partner. Some Norton trials become a paid subscription unless you cancel them before they end.",
    },
    {
      q: "Is it safe to uninstall Norton 360?",
      a: "Yes, as long as something still protects the PC, although Norton itself recommends keeping its app installed. On Windows 10 and 11, Microsoft Defender Antivirus turns itself off while another antivirus is active, and Microsoft documents that it can turn back on automatically once that product is uninstalled or expires. After the restart, open Windows Security, Virus & threat protection, and under Who's protecting me? select Manage providers to check that an antivirus is on.",
    },
    {
      q: "Why won't Norton uninstall?",
      a: "When the uninstall from Programs and Features fails or shows errors, Norton's answer is the Norton 360 Remover. Download it from Norton's support article, run it, choose Remove to uninstall only or Reinstall to get the latest version back, confirm with Uninstall and click Restart Now. If the Remover itself reports errors, click Reboot: the PC restarts in Safe Mode, where you run the tool again.",
    },
    {
      q: "Does the Norton 360 Remover remove Norton Private Browser and Norton VPN?",
      a: "Not Private Browser: Norton states that the Remover does not uninstall it and that its Remove and Reinstall tool cannot be used for it, so remove it from Programs and Features. Its uninstaller deletes your bookmarks, passwords and history unless you untick Also delete your browsing data. Norton VPN has its own entry there as well, and Norton does not say whether it goes with Norton 360, so check the list after the restart.",
    },
  ],
  "/fixes/filter-keys-sticky-keys-shortcut": [
    {
      q: "What is Filter Keys?",
      a: "An accessibility feature that sets the keyboard's sensitivity so it ignores brief or repeated keystrokes, in Microsoft's words. Underneath are three settings Microsoft documents: how long a key must be held before it is accepted (SlowKeys), how long after release a second press of the same key is ignored (BounceKeys), and the repeat rate (RepeatKeys).",
    },
    {
      q: "How do I turn off Filter Keys?",
      a: "Press Windows+U, or open Start, Settings, Accessibility, then select Keyboard and switch Filter keys off. Holding the right Shift key for eight seconds also switches it off, because that one shortcut turns Filter Keys both on and off. To stop it coming back, select Filter keys on the same page and turn off Keyboard shortcut for Filter keys; the feature itself stays available.",
    },
    {
      q: "Why did Filter Keys turn on by itself?",
      a: "Most likely because the right Shift key was held down for eight seconds, which is Windows' shortcut for turning Filter Keys on and off. In a game that uses Shift to sprint or crouch, that is easy to do by accident. Turning off only the shortcut, as this page shows, stops it happening again without removing the feature.",
    },
    {
      q: "Why does my keyboard stop typing when Filter Keys is on?",
      a: "Because Filter Keys can make Windows wait before it accepts a key. With the settings Windows held on the PC this guide was checked on, read through the documented SPI_GETFILTERKEYS call, a key had to be held for 1,000 milliseconds before it was accepted, so ordinary typing produced nothing. Switch Filter Keys off and the keyboard responds normally again.",
    },
  ],
  "/fixes/turn-off-windows-11-ai-features": [
    {
      q: "Can I turn off all AI features in Windows 11 at once?",
      a: "No. There is no single switch: Microsoft documents a separate setting or policy for each feature, which is why this page lists them one by one. Recall snapshots and Click to Do have their own WindowsAI policies, the Copilot app is uninstalled like any other app, Paint and Notepad have their own policies and Edge has its own set. Turning one off leaves the others as they are.",
    },
    {
      q: "How do I turn off Copilot in Windows 11?",
      a: "Uninstall the Copilot app from Settings, Apps, Installed apps; you can install it again later. The older Turn off Windows Copilot policy (TurnOffWindowsCopilot) is deprecated, and Microsoft notes that it is not for the new Copilot experience. Organisations on Windows 11 24H2 and later also have a RemoveMicrosoftCopilotApp policy, which removes the app only when Microsoft 365 Copilot is installed too, the user did not install the app and it has not been opened for 28 days.",
    },
    {
      q: "How do I turn off the AI features in Paint?",
      a: "Set Microsoft's three Paint policies to 1: DisableCocreator, DisableImageCreator and DisableGenerativeFill, under HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Paint. Microsoft lists them for Windows 11 Pro, Enterprise and Education, from version 22H2 build 22621.4870 and version 24H2 build 26100.3360. Each one only turns off that feature; delete the three values to undo it.",
    },
    {
      q: "How do I turn off Copilot in Notepad?",
      a: "Set the DisableAIFeatures value to 1 under HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\WindowsNotepad. That is the registry form Microsoft documents for its DisableAIFeaturesInNotepad policy, on Windows 11 version 22H2 or later with Notepad 11.2503.16.0 or later, and it applies to every user on the PC. Delete the value to get the features back.",
    },
  ],
  "/guides/fix-dpc-isr-latency-windows-11": [
    {
      q: "What is DPC and ISR latency?",
      a: "It is the time drivers spend in two kinds of kernel routine. When a device raises an interrupt, its driver's interrupt service routine (ISR) runs at once and must finish quickly, so it queues a deferred procedure call (DPC) to complete the work shortly afterwards at a lower priority level. Microsoft documents that while a DPC routine runs on a processor, no thread can run on that processor, which is why long ones can hold up audio and game threads.",
    },
    {
      q: "What is a good DPC latency?",
      a: "Microsoft's guidance to driver writers is that a DPC should not run longer than 100 microseconds and an ISR not longer than 25 microseconds. Those are limits per routine, not a score for the whole PC: a trace that crosses them once is a lead to investigate, not proof of an audible glitch. What matters is whether the long routines line up with the moment the problem happens.",
    },
    {
      q: "What causes high DPC latency?",
      a: "A driver whose DPC or ISR routines run too long. Microsoft tells driver writers to keep DPCs brief and hand longer work to worker threads, so a long routine points at a specific driver, and a trace attributes the time to its module, such as a graphics, storage or network driver. The useful next step is to identify that driver and test another version of it against the same workload, not to apply a general tweak.",
    },
    {
      q: "Can DPC latency cause audio crackling or stutter in games?",
      a: "It can. Microsoft documents that while a DPC runs on a processor, every thread on that processor waits, and asks driver writers to keep each DPC under about 100 microseconds so that system responsiveness does not suffer. When a delayed thread is the one feeding the audio device or preparing a frame, that can be heard as a crackle or seen as an uneven frame time. A latency trace is not an FPS benchmark, so measure the symptom and the trace together before changing anything.",
    },
  ],
  "/fixes/windows-update-using-bandwidth": [
    {
      q: "How much bandwidth does Windows Update use?",
      a: "By default, Delivery Optimization, which downloads Windows updates, aims to use no more than 45% of the available bandwidth for a background download and 90% for a download you started yourself, and it measures again every few minutes to adjust to congestion. You can set lower limits in Settings, Windows Update, Advanced options, Delivery Optimization, Advanced options, or with the policy on this page.",
    },
    {
      q: "Does turning off Delivery Optimization stop Windows updates?",
      a: "No. Microsoft states that disabling Delivery Optimization does not prevent content from downloading: download mode 0 only switches off peer-to-peer sharing, and updates keep arriving over HTTP. To stop updates for a while, pause them in Settings, Windows Update. Avoid download mode 100 (Bypass): Microsoft has deprecated it in Windows 11, and it can make some downloads fail with error 0x80d03002.",
    },
    {
      q: "Is it safe to delete Delivery Optimization files?",
      a: "Yes. They are cached download files, and Windows clears the cache by itself after a short time or when it takes up too much space. To free the space now, open Disk Cleanup, tick Delivery Optimization Files, select OK and then Delete Files.",
    },
    {
      q: "Why is Windows using bandwidth when I'm not updating anything?",
      a: "Because Delivery Optimization also downloads for other Microsoft apps and services, such as the Microsoft Store and Microsoft Edge, and they can download in the background. Microsoft notes that closing an app does not necessarily stop its download. Check the apps running in the background, and if your PC is uploading to other PCs, turn off Allow downloads from other devices.",
    },
  ],
  "/fixes/memory-integrity-gaming-windows-11": [
    {
      q: "Does turning off memory integrity improve gaming performance?",
      a: "It can on some PCs, but Microsoft publishes no figure for games. Its documentation says memory integrity works better on Intel Kaby Lake and newer and AMD Zen 2 and newer processors, while older processors emulate the features it needs and see a bigger impact on performance. Measure one repeatable scene with it on and off, restarting in between, before you give up the protection.",
    },
    {
      q: "Is it safe to turn off memory integrity?",
      a: "It is a security trade-off, not a free speed-up. Microsoft describes memory integrity as making it difficult for malicious programs to use low-level drivers to hijack your PC, and turning it off removes that layer for everything you run. Microsoft's own case for turning it off is a driver you need that cannot load: look for an updated driver first, and turn memory integrity back on when you no longer need it off.",
    },
    {
      q: "Why can't I turn memory integrity on?",
      a: "Microsoft documents two common causes: an incompatible driver, and hardware virtualization switched off in the UEFI or BIOS. For a driver, its advice is to ask the device maker for a compatible version, or remove the device or app that uses the incompatible one. For virtualization, turn it on in the firmware settings and try again.",
    },
    {
      q: "Why is the memory integrity switch greyed out?",
      a: "Because memory integrity is being managed outside Windows Security. Microsoft documents that it can be turned on through Group Policy, Intune or App Control, and that an administrator can grey out the switch, which then shows \"This setting is managed by your administrator\". Change it where it was set, or ask whoever manages the PC.",
    },
  ],
  "/fixes/disable-mouse-acceleration-windows-11": [
    {
      q: "Should I turn off Enhance pointer precision for gaming?",
      a: "For aiming, turning it off gives you consistent movement: the same hand movement always covers the same distance on screen. Microsoft presents the setting as making the pointer more accurate when the mouse moves slowly, so you may prefer it on for the desktop or a touchpad. Games that read raw mouse input ignore it either way.",
    },
    {
      q: "Does Enhance pointer precision affect games that use raw input?",
      a: "No. Microsoft's guidance for game developers explains that raw input (WM_INPUT) comes straight from the HID stack with no pointer acceleration applied, while the Windows pointer messages (WM_MOUSEMOVE) have it applied. It still affects the desktop, menus and games that move the Windows pointer.",
    },
    {
      q: "What does Enhance pointer precision do?",
      a: "It turns on Windows' pointer acceleration, so the pointer moves further when you move the mouse quickly than when you move it the same distance slowly. Microsoft describes it as making the pointer more accurate when the mouse is moving slowly. Turn it off in Settings, Bluetooth & devices, Mouse.",
    },
    {
      q: "Is mouse acceleration the same as pointer speed?",
      a: "No. Pointer speed is the separate slider in the same Settings page, a value from 1 to 20 with 10 as the default, while acceleration changes the distance depending on how fast you move. Microsoft documents that Windows applies acceleration first and then scales the result by the pointer speed, so you can turn acceleration off and keep any speed you like.",
    },
  ],
};
