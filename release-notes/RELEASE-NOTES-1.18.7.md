PC Tweaker 1.18.7 makes administrator changes and restores more dependable: no task can hang the app, a deleted power plan no longer blocks a restore, and Explorer restarts politely.

- Every Windows tool PC Tweaker runs now has a time limit, and so does the wait for the administrator helper, so a stuck tool can no longer leave the window waiting forever.
- Restoring the power plan works even if the original plan was deleted: PC Tweaker switches to Balanced instead of failing, and clears the settings it had saved for the deleted plan.
- Explorer is restarted through Windows Restart Manager, so a program that asks to finish first is respected; Explorer is closed by force only if it does not stop in time.
- When another administrator approves the UAC prompt, changes and restore records go to the signed-in user's settings instead of that administrator's.
- Profiles whose names differ only in case or punctuation are saved to separate files, and deleting a profile removes only that profile.
- Signed-in apps now send a random installation identifier with licence refreshes, so the account service can count how many installations an account uses. It is not tied to your hardware and never decides whether your licence works. The privacy policy explains it.
- The catalog is unchanged: 81 controls, 46 Free and 35 Pro.

Windows binaries and installers are digitally signed by Aurelio Avila and timestamped; automatic updates carry a separate updater signature.
