PC Tweaker 1.18.0 "Halloween Update" adds 15 controls, including the Windows AI features, shows exactly what every change will write before it is written, undoes a failed application on its own, asks before re-applying anything a Windows update put back, and turns PC Health into a live dashboard.

- The catalog grows from 66 to 81 controls: 46 Free and 35 Pro.
- Five new controls cover the Windows AI layer: Click to Do (where Windows offers it), the Windows AI Fabric service, and the AI features in Microsoft Edge, Paint and Notepad. Each can be restored from the change ledger.
- Ten further controls: Fast Startup off, Storage Sense off, End task in the taskbar right-click menu (Windows 11 23H2 or later), the drag tray off (Windows 11 24H2 or later), File Explorer opening to This PC, the Recommended section removed from Start (Enterprise and Education editions), Widgets off entirely through policy, automatic installation of manufacturer apps blocked, Windows tips and suggestions off in one switch, and Game Bar captures and background recording off.
- Every card states what it needs (user or machine scope, administrator rights, Windows version and edition) and reports "Not available on this PC" when it does not apply.
- Every tweak opens a "What this changes, exactly" panel listing each value as it is now and as it will be set, for single changes and for batches. Nothing is written until confirmed.
- If an application fails partway, the values already written are restored immediately.
- With "Watch for Windows updates" on, a check at sign-in tells you only when something has actually stopped being in effect. After a cumulative update, the affected tweaks are listed with one checkbox each; untick anything you changed on purpose and re-apply the rest. Nothing is re-applied on its own.
- App priority rules (Pro): pick an app and a priority. PC Tweaker sets it each time the app starts while PC Tweaker is open and puts the old priority back when the rule is removed or PC Tweaker closes. Never above High.
- Weekly temporary file cleanup (Pro): once a week, a few minutes after sign-in, temporary files nobody has touched for a day are moved to the Recycle Bin. It waits while a game is running and never touches memory or open apps.
- "Leave self-managed games alone": while such a game is running, PC Tweaker pauses its per-app adjustments and leaves the game exactly as it is. Priority and background-efficiency rules never touch Windows components.
- PC Health becomes a live dashboard: processor load per core, memory in use, cached and free, disk read and write, network download and upload, graphics load, temperature, fan and video memory, and "What's using resources" grouped by app from Windows' own process list, over 1 or 5 minutes. Missing sensors are reported, not guessed.
- Scan can be paused, resumed or ended. Resume reads only what is still missing; ending early keeps a partial result that names the checks that did not run. Unavailable checks remain unknown, not passed. Scan now runs 13 checks; scheduled startup tasks, optional Windows apps and background-efficiency conflicts are new.
- Duplicate and large-file searches can be stopped.
- Debloat is redesigned: apps grouped by kind with their real size, a "What you lose" popover with app files, your data, package identity and a link to the Microsoft Store page, and a bottom action bar. Nothing is selected for you.
- Turbo Boost shows measured processor load smoothed over about three seconds, the measured clock speeds, the power plan's minimum processor state and the apps using the processor most, plus a fixed 3-second workload to compare work done, average and peak speed in each mode. After Start it shows when Turbo Boost was turned on and whether your power plan already had these settings. Numbers only; results depend on the workload.
- Badges are uniform across Hardware, Startup and tweak cards; spacing is refined throughout.
- A page that fails shows a recovery screen: the rest of PC Tweaker keeps working, nothing on the PC is changed by the error, and the page or the app can be reloaded.
- The window reopens where it belongs, sized and placed correctly.

Windows binaries and installers are digitally signed by Aurelio Avila and timestamped; automatic updates carry a separate updater signature.
