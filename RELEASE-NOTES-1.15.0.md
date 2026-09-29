PC Tweaker 1.15.0 adds a kernel latency trace that names the driver behind DPC and ISR stalls, core steering for Game Sessions and a before-and-after network check, and moves power, DNS and service controls to native Windows APIs.

- Adds a DPC and ISR latency trace to Diagnostics. A 5 to 30 second kernel capture measures how long each driver routine holds a processor and names the driver responsible. Results follow Microsoft's 100 µs and 25 µs guidance, only stalls over one millisecond are marked red, and durations are shown in milliseconds. Without administrator rights the capture asks for approval once; it changes nothing, so no restore point is created.
- Game Sessions can steer a registered game to the V-Cache die on AMD X3D processors or to the performance cores on Intel hybrid processors. On hybrid processors other apps in your session move to the efficiency cores, except Windows components, the game's own processes, apps with their own CPU sets and apps raised above normal priority. Nothing is suspended. Every change is recorded first and undone when the game exits, when steering is turned off, when PC Tweaker quits, or at the next launch after a crash.
- Adds a network check: 32 pings with jitter, plus a reading of one live TCP connection, taken before and after the two TCP tweaks and on demand. A difference is reported as a change in the line, never as the effect of a tweak. Latency tweaks now target the adapter that carries the internet route.
- Power plan, CPU turbo boost, core parking, DNS, BBR2 and Windows Search controls use native Windows APIs instead of powercfg, sc.exe and PowerShell.
- Turbo boost and core parking now restore on Windows 11 when Windows refuses to delete a plan override: the previously effective value is written back, and battery settings you changed meanwhile are kept.
- Dates, times, numbers and sizes follow the app's language instead of the Windows display language.
- Re-applying the classic context menu repairs a missing key.

Windows application and installer signatures are verified before distribution. Code signing identifies the publisher; Windows may still show reputation warnings.
