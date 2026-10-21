PC Tweaker 1.18.6 fixes administrator changes to scheduled tasks whose names contain spaces, keeps your Game Sessions list safe when a save is interrupted, and tightens how the administrator helper loads Windows libraries.

- Turning a third-party scheduled task on or off with administrator approval now works when its path contains spaces, such as `\Vendor\Some Task`. The path used to reach the administrator step with doubled backslashes, so Windows could not find the task.
- The Game Sessions list is saved in a single step. An interrupted save, or a file briefly held by antivirus software, can no longer replace your list of games with a single entry.
- The administrator helper loads Windows libraries only from the System32 folder, never from the folder PC Tweaker is installed in.
- Profiles are exported only as .json files on a local drive, the same rule the other exports follow.
- PC Health keeps the last report on screen when a refresh fails, and the account messages shown when you return to the window follow the language you picked.
- The catalog is unchanged: 81 controls, 46 Free and 35 Pro.

Windows binaries and installers are digitally signed by Aurelio Avila and timestamped; automatic updates carry a separate updater signature.
