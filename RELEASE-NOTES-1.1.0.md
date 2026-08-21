# PC Tweaker 1.1.0 — The Health Update

Your PC finally gets a number — and, unlike every other "score" out there, this one can prove itself.

## PC Health Score

A new **PC Health** view scores your machine across nine categories — Performance, Gaming, Responsiveness, Memory, Storage, Startup, Maintenance, Privacy, Security — and rolls them into one overall number on a segmented speedometer.

What makes it different:

- **Explainable, all the way down.** Press *Show more* on any category and you see the exact factors behind it: earned/max points and the concrete fact each was scored from — "32 GB installed", "14 apps start with Windows", "Defender real-time protection is on". The factor list IS the calculation. No hidden weights, no magic number.
- **Nothing runs behind your back.** The score is computed only when you press the button, entirely on this PC. No background analysis, no data leaves your machine.
- **Reproducible.** The same machine state always produces the same score. Every threshold has a written rationale in the code.
- **Honest about the unknown.** A value that can't be read says so ("Defender state unreadable — third-party AV may be active") instead of guessing.

Applying a tweak visibly moves its category — the score doubles as a map of what's left to optimize.

## Baseline Engine

Measure before you change, measure after, and see the difference in numbers:

- **CPU** — the same fixed workload behind the Turbo benchmark
- **Memory** — a 256 MB write-touch pass
- **System disk** — a 32 MB write plus 200 random 4 KB reads, deterministic offsets

Every run is saved locally; the last run is compared to the previous one with direction-aware deltas. By design these are *repeatable measurements tied to things PC Tweaker can influence* — not synthetic benchmark theater. Absolute values are only ever compared against your own machine.

## Precision notes

While building the score we audited every input path. Among the fixes: the *Ultimate performance* power plan was being compared against the wrong casing and would have been scored as a non-performance plan; Balanced on a laptop now earns its own fair rating ("a fair choice on battery-powered hardware") instead of the desktop judgment.

Delivered automatically to every 1.0.0 install via the built-in updater.
