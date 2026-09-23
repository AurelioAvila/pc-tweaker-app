export const PRACTICAL_GUIDES = {
  "/how-to-undo-windows-tweaks": {
    eyebrow: "RECOVERY GUIDE",
    title: "How to undo Windows tweaks",
    seoTitle: "How to Undo Windows Tweaks Safely",
    seoDescription:
      "Undo a Windows tweak properly: identify the change, restore the value that was recorded rather than a generic default, then retest what behaved oddly.",
    intro: "Start with the setting you changed and the value it had before. A generic Windows default is not necessarily your previous configuration.",
    sections: [
      { heading: "1. Identify the change", body: "Open the category where you applied the tweak, or review Change history. Note the tweak name and when you applied it. If the issue began after several changes, investigate them individually instead of adding another preset." },
      { heading: "2. Restore a supported setting", body: "Use the restore control for that change. Where PC Tweaker recorded an original value, restoration uses that saved state. Read the result and any restart instructions. A successful settings write does not prove that an unrelated application problem is fixed." },
      { heading: "3. Repeat the same task", body: "Reopen the application or repeat the task that behaved differently. Keep other conditions the same. If you changed file-extension visibility, check the same folder in File Explorer. Avoid restoring unrelated settings just to test one change." },
      { heading: "If you changed the setting manually", body: "Return to the Windows setting you used and restore your recorded choice. For file extensions in Windows 11, open File Explorer, choose View, then Show, then File name extensions. Windows 10 exposes File name extensions on the View tab. Registry changes require the correct previous value or an appropriate backup; do not guess a value from another PC." },
      { heading: "What restoration cannot recover", body: "Cleanup, uninstall and update operations have separate recovery limits. A tweak backup is not a backup of your files or your whole system. PC Tweaker cannot reconstruct an unknown original value from another tool. If Windows cannot start, use Windows recovery options and your existing backups." },
      { heading: "Choosing another profile does not undo the first", body: "Gaming, Study and Work starter profiles add selected changes. Switching cards is not a full configuration swap. Restore supported changes explicitly before assuming you have returned to the previous setup." }
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
