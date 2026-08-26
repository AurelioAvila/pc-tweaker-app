# PC Tweaker 1.3.0

A new Hardware screen, two new free tweaks, and a redesigned window.

## New: Hardware

- Live temperatures, load, VRAM, fan and power draw read straight from the
  card's own sensors. Where a sensor does not exist, the app says so instead
  of showing a number nobody can verify.
- A session watch that only calls a result once the card has actually done
  some work — an idle card runs cool regardless, and saying "better than
  expected" about that would prove nothing.
- Three real thermal profiles (Silent / Standard / Gaming), each with the
  watt figure the card itself reports, and a one-click way back to stock.
- A full driver inventory: every device class on the machine, with real
  progress while it runs, and the age of each driver. The result stays put
  when you switch screens instead of rescanning behind your back.
- Driver updates through Windows Update — the channel that ships signed
  vendor drivers matched to your exact hardware id — with the pending list,
  its download size, and a restart prompt only when Windows says one is
  needed.

## New tweaks (both free)

- **Keep latency low when the line is busy (BBR2).** Windows uses CUBIC,
  which speeds up until a buffer somewhere overflows — which is why your
  ping climbs the moment someone else in the house starts a download. BBR2
  measures the line's real bandwidth and round trip and paces traffic to
  fit. Switches back to exactly what was there before.
- **3D V-Cache die aligner.** On a two-die Ryzen X3D only one die carries the
  stacked cache, and Windows spreads a game across both. This finds the right
  die from the processor's own cache map and pins a chosen process to it. On
  a single-die processor it says there is nothing to align, rather than
  offering a switch that would do nothing.

## Redesigned window

- The window now draws its own title bar, with the count of applied
  optimisations and live CPU and RAM.
- Cards, switches and icons rebuilt with real depth: lit edges, contact
  shadows and backlit modules, on all fourteen themes.
- Three more Pro tweaks, one each in Performance, Maintenance and UI.

## Fixed

- The automatic RAM cleanup could quietly stop keeping to its schedule: a
  minimised window, a sleeping machine or background-timer throttling all
  stretched the interval, and on waking the timer started over. It now
  measures against a deadline, runs a pass that came due while you were away
  as soon as the app is awake, and shows you when the next one is and what
  the last one freed.
- The Hardware screen opens without the extra beat it used to take.
- The history of applied changes can now be cleared.
- "Bring back the full right-click menu" is no longer a Pro feature.
