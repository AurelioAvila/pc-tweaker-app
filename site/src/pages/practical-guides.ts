export const PRACTICAL_GUIDES = {
  "/turn-off-windows-recall": {
    eyebrow: "PRIVACY GUIDE",
    title: "How to turn off Windows Recall, and keep it off",
    seoTitle: "How to Turn Off Windows Recall and Keep It Off",
    seoDescription:
      "Recall is opt-in and only exists on Copilot+ PCs, but a policy can stop it being enabled at all. Check the setting, set the policy, remove the component, undo.",
    intro: "Recall saves snapshots of your screen every few seconds and indexes them so you can search what you saw. It is off unless you turn it on, and it only exists on Copilot+ PCs. If you want a guarantee rather than a toggle, there are three layers: the Settings switch, a machine policy, and removing the component itself.",
    sections: [
      { heading: "First, check whether Recall is even on", body: "Open Settings, then Privacy & security, then Recall & snapshots. If the page is missing, your PC is not a Copilot+ PC and Recall is not installed; nothing on this page is running. If the page is there, the Save snapshots switch shows the current state. Microsoft documents that saving snapshots is off by default and needs your explicit opt-in the first time Recall opens, so a PC nobody has opted in on has no snapshots to delete." },
      { heading: "Layer 1: the Settings switch", body: "Turning Save snapshots off stops new snapshots. On the same page you can delete the snapshots already saved, set how much disk space Recall may use and filter apps and websites. This is the right level if you want Recall available later. It is a per-user preference, so another account on the same PC can still opt in, and a future prompt can invite you to turn it back on." },
      { heading: "Layer 2: the policy PC Tweaker sets", body: "The Disable Recall control in the Privacy category writes DisableAIDataAnalysis = 1 under HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsAI. That is the registry form of the Group Policy called Turn off saving snapshots for Recall. With it set, Windows will not save snapshots for any user on the machine, the Save snapshots switch cannot be turned on, and Microsoft states that snapshots previously saved on the device are deleted. It is a machine-wide policy key, so the control needs administrator rights and is part of Pro. PC Tweaker records the previous value, which on a home PC is usually that the key did not exist." },
      { heading: "Layer 3: remove the component", body: "The policy stops snapshots; it does not uninstall Recall. If you want the bits gone, Microsoft's documented route is an elevated PowerShell command: Disable-WindowsOptionalFeature -Online -FeatureName \"Recall\" -Remove, followed by a restart. The same feature appears as Recall under Windows Features (optionalfeatures.exe) when it is present. On managed devices there is a second policy, Allow Recall to be enabled, that removes the component through Group Policy or Intune; on a home edition the PowerShell command is the practical equivalent." },
      { heading: "What these layers do not cover", body: "None of them change Windows diagnostic data, which is a separate setting with its own control in PC Tweaker. Click to Do, the feature that lets you act on text and images on screen, has its own policy and is not switched off by the Recall ones. Browser history, OneDrive and the cloud history of whatever apps you use are untouched; Recall only ever stored its snapshots locally. And on a PC without the Recall & snapshots page, applying the policy is harmless but changes nothing you could notice." },
      { heading: "If you want Recall back", body: "Use the restore control on the Disable Recall tweak and PC Tweaker writes back the recorded previous value, removing the policy if the key was absent before. If you removed the component, reinstall it with Enable-WindowsOptionalFeature -Online -FeatureName \"Recall\" from an elevated PowerShell, restart, then opt in again under Recall & snapshots. Deleted snapshots do not come back: Microsoft says they are removed when the policy is applied, and a restore writes a registry value, not a snapshot store." }
    ],
    related: [
      { to: "/windows-privacy-tool/", label: "the other privacy settings PC Tweaker can change", note: "Diagnostic data, advertising ID, suggestions and feedback requests, each with its own control." },
      { to: "/how-to-undo-windows-tweaks/", label: "how the restore control puts back the recorded value", note: "Why a removed policy key is restored as absent, not as a Windows default." },
      { to: "/what-pc-tweaker-changes/", label: "which keys are machine-wide and need administrator rights", note: "The Recall policy is one of them." }
    ],
    sources: {
      checked: "6 October 2026",
      items: [
        { label: "Microsoft Learn: manage Recall (policies, component removal, snapshot deletion)", url: "https://learn.microsoft.com/en-us/windows/client-management/manage-recall" },
        { label: "Microsoft Support: retrace your steps with Recall (opt-in, Settings path, requirements)", url: "https://support.microsoft.com/en-us/windows/retrace-your-steps-with-recall-aa03f8a0-a78b-4b3e-b0a1-2eb8ac48701c" },
        { label: "PC Tweaker: the disable_recall entry in the tweak catalogue", url: "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/tweaks.rs" }
      ]
    }
  },
  "/how-to-undo-windows-tweaks": {
    eyebrow: "RECOVERY GUIDE",
    title: "How to undo Windows tweaks",
    // Search Console: 85 impressions at position 8.7 and no clicks. The searches
    // around it ("how to remove tweaks from pc", "undo selected tweaks") are
    // people with a problem after a change, so the snippet now starts there.
    seoTitle: "How to Undo Windows Tweaks and Restore Settings",
    seoDescription:
      "Changed a Windows setting and something broke? Find the tweak, restore the value it replaced rather than a generic default, then check the problem is gone.",
    intro: "Start with the setting you changed and the value it had before. A generic Windows default is not necessarily your previous configuration.",
    sections: [
      { heading: "1. Identify the change", body: "Open the category where you applied the tweak, or review Change history. Note the tweak name and when you applied it. If the issue began after several changes, investigate them individually instead of adding another preset." },
      { heading: "2. Restore a supported setting", body: "Use the restore control for that change. Where PC Tweaker recorded an original value, restoration uses that saved state. Read the result and any restart instructions. A successful settings write does not prove that an unrelated application problem is fixed." },
      { heading: "3. Repeat the same task", body: "Reopen the application or repeat the task that behaved differently. Keep other conditions the same. If you changed file-extension visibility, check the same folder in File Explorer. Avoid restoring unrelated settings just to test one change." },
      { heading: "If you changed the setting manually", body: "Return to the Windows setting you used and restore your recorded choice. For file extensions in Windows 11, open File Explorer, choose View, then Show, then File name extensions. Windows 10 exposes File name extensions on the View tab. Registry changes require the correct previous value or an appropriate backup; do not guess a value from another PC." },
      { heading: "What restoration cannot recover", body: "Cleanup, uninstall and update operations have separate recovery limits. A tweak backup is not a backup of your files or your whole system. PC Tweaker cannot reconstruct an unknown original value from another tool. If Windows cannot start, use Windows recovery options and your existing backups." },
      { heading: "Choosing another profile does not undo the first", body: "Gaming, Study and Work starter profiles add selected changes. Switching cards is not a full configuration swap. Restore supported changes explicitly before assuming you have returned to the previous setup." },
      { heading: "If the tweak came from a script or another tool", body: "Most 'debloat' and 'optimizer' scripts write registry values and disable services without recording what was there before, so there is nothing to restore from. Start with what the script's own documentation says it changed. For a registry value, open the key and compare it with a known-good machine of the same Windows version and edition only as a last resort, and note that a value present on one PC may legitimately be absent on another. For a disabled service, Services shows the startup type; the previous type is usually Manual or Automatic and the service's own documentation says which. For removed packages, reinstalling from the Microsoft Store or from Windows features is the only route back, and some removals survive a feature update." },
      { heading: "When a restart is part of the undo", body: "A setting that said 'restart required' when you applied it needs a restart to undo as well. Hardware-accelerated GPU scheduling, keeping the kernel in memory, the long-path limit and the timer-resolution flag are all read at startup, so the restore writes the value immediately but Windows keeps behaving the old way until it reboots. Sign-in and Explorer settings take effect when Explorer reloads, which signing out achieves without a full restart. Judge the result after the restart the description asks for, not before." }
    ],
    related: [
      { to: "/reversible-windows-tweaks/", label: "how a recorded previous value differs from a Windows default", note: "The distinction that decides whether an undo puts you back where you actually were." },
      { to: "/what-pc-tweaker-changes/", label: "which categories can be restored at all", note: "Cleanup, uninstall, driver and repair operations have separate recovery limits." },
      { to: "/windows-gaming-work-study-profiles/", label: "why switching starter profiles does not undo the first", note: "A common reason people think a restore failed when nothing was reversed." }
    ]
  },
  "/windows-gaming-work-study-profiles": {
    eyebrow: "PROFILES WALKTHROUGH",
    title: "Windows gaming, work and study profiles: choose what fits",
    seoTitle: "Windows Gaming, Work and Study Profiles",
    seoDescription:
      "PC Tweaker's Gaming, Study and Work starter profiles are editable and free. Selecting a card only opens the choices; nothing applies until you confirm.",
    intro: "PC Tweaker includes editable Gaming, Study and Work starter profiles in Free. Selecting a card opens a set of choices. Nothing is applied until you choose Apply selected.",
    image: "/guides/work-profile.webp",
    caption: "Actual PC Tweaker capture: review your Work selection before applying it.",
    sections: [
      { heading: "Gaming: decide whether you need Windows clips", body: "The starter selection includes disabling Game DVR and changing mouse pointer acceleration. If you save clips with Windows capture, uncheck the Game DVR option. The pointer setting affects Windows mouse behaviour; games using raw input may ignore it. Sticky Keys prompt changes are optional. This profile does not promise higher FPS." },
      { heading: "Study: fewer Windows prompts, with clear limits", body: "Selected changes target Start suggestions, feedback requests and the taskbar Widgets button. Tailored experiences is optional. This is not a website blocker or notification silencer: configure your browser, messaging apps and Windows notifications separately when needed." },
      { heading: "Work: file visibility and interface preferences", body: "The Work starter selection includes file extensions, startup delay and menu delay. Showing hidden files is optional. Keep file extensions visible to distinguish file types; leave menu timing unchanged if the current behaviour suits you. These changes do not make applications launch instantly." },
      { heading: "Review, apply, verify", body: "Open Profiles, choose a starter card and read each setting. Uncheck anything you do not want. Review the pending count, then choose Apply selected when ready. Entries marked Already applied are already active. Verify the result before moving on to another group of changes." },
      { heading: "Work does not replace Gaming", body: "Starter profiles add selected tweaks to your existing configuration. Switching cards does not reverse earlier changes. Use the individual restore controls for supported settings you want to undo. Free starter profiles are separate from paid automatic game-session features." }
    ],
    related: [
      { to: "/gaming-performance/", label: "what the Gaming selection changes, key by key", note: "Game DVR and mouse acceleration explained, including when to leave them alone." },
      { to: "/windows-privacy-tool/", label: "the privacy settings behind the Study profile", note: "Suggestions, feedback requests and tailored experiences, with what each one really does." },
      { to: "/how-to-undo-windows-tweaks/", label: "how to reverse a profile you have already applied", note: "Because choosing a different card does not undo the selection you applied first." }
    ]
  },
  "/what-pc-tweaker-changes": {
    eyebrow: "SYSTEM CHANGE DISCLOSURE",
    title: "What PC Tweaker changes on your system",
    seoTitle: "What PC Tweaker Changes on Your System",
    seoDescription:
      "Exactly what PC Tweaker touches: per-user settings, machine-wide keys, power plans and maintenance jobs, plus the permissions and recovery path for each.",
    intro: "Controls can change user settings, machine-wide settings and power configuration, or run maintenance operations. Permissions and recovery depend on the action you choose.",
    image: "/guides/gaming-selection.webp",
    caption: "Actual PC Tweaker capture: Game DVR can be left out of a Gaming selection.",
    sections: [
      { heading: "User settings: file extensions", body: "Always show file extensions sets HideFileExt to 0 under HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced. This changes Explorer visibility for the current user. It does not rename or scan files. Seeing invoice.pdf.exe can help you notice its actual extension, but an extension alone cannot establish whether a file is safe." },
      { heading: "Machine-wide changes and administrator access", body: "Some controls target HKEY_LOCAL_MACHINE or Windows system tools and require administrator rights. An Admin label identifies that requirement; it is not a recommendation to enable the setting. Read the description and decide whether the trade-off fits your machine." },
      { heading: "Power settings depend on your hardware", body: "The native power controls edit supported AC values in the active power scheme. Plugged-in and battery settings are distinct. Availability and practical effects depend on hardware, drivers and Windows policy. More aggressive settings can affect power use and thermals." },
      { heading: "Maintenance is different from a reversible setting", body: "Cleanup, repair, uninstall and update actions are not interchangeable with a registry toggle. Deleted files may not be recoverable; repairs and updates have their own recovery mechanisms. Read operation details and preserve important data before maintenance." },
      { heading: "Free features and signed installers", body: "The current release includes 39 Free controls out of 66 in the catalogue, plus editable starter profiles, with no account required. Pro adds 27 controls, paid tools and automatic game sessions. Official Windows installers are digitally signed by Aurelio Avila. Signing identifies the publisher and protects file integrity; it does not guarantee that SmartScreen or antivirus warnings will never appear." },
      { heading: "Inspect the implementation", body: "The source is publicly available at github.com/AurelioAvila/pc-tweaker-app under a proprietary licence. The tweak catalogue and Windows implementations live in src-tauri/src, where each entry records its hive, key path, value name and whether it requires administrator rights. Review the source for the exact release you installed when checking an action." }
    ],
    related: [
      { to: "/reversible-windows-tweaks/", label: "which of these changes can be undone", note: "Setting rollback, change history and the operations that fall outside both." },
      { to: "/windows-privacy-tool/", label: "the privacy keys in detail", note: "Including what reducing Windows diagnostic data does and does not achieve." },
      { to: "/windows-11-optimizer/", label: "how to decide which changes are worth making", note: "Measuring first, and where tuning sits relative to updates, drivers and cooling." }
    ]
  }
};
