PC Tweaker 1.18.17 records System Restore points honestly.

- Windows makes at most one System Restore point a day and accepts later requests without creating anything. The change history now shows "Restore point reused (none created)" in that case, with the date of the point Windows kept, instead of counting it as a new restore point.
- A new restore point is recorded only when Windows really made one just before the change; when that cannot be confirmed, the history says so.
- When PC Tweaker itself runs as administrator, administrator tweaks get the same restore point request and history entry as through the administrator prompt.
- The restore point request is closed the way Windows documents, so a new point is finalised.
- Texts that said a restore point is always taken now say that Windows is asked for one.

Windows binaries and installers are digitally signed by Aurelio Avila and timestamped; automatic updates carry a separate updater signature.
