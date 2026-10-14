PC Tweaker 1.18.4 looks for updates on its own download server as well as on GitHub, and the tweak preview reads correctly when a single value changes.

- Updates are checked at dl.pctweaker.app first and on GitHub second. Both serve the same signed installer, and the app verifies its signature before installing. Any other address, a version older than the one installed, or a file signed for a different version is refused.
- The tweak preview said "changes 1 of 1 values" for a tweak that sets a single value. It now reads "Applying this changes the value.", in all six languages.
- The catalog is unchanged: 81 controls, 46 Free and 35 Pro.

Windows binaries and installers are digitally signed by Aurelio Avila and timestamped; automatic updates carry a separate updater signature.
