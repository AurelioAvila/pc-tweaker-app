# PC Tweaker 1.7.1

This maintenance release fixes **Watch for Windows updates** on PCs where Windows previously returned an unhelpful “Access is denied” message. The watchdog now uses a universally valid Task Scheduler location, stays at limited privileges when it runs, retries setup through a focused UAC prompt only when required by local policy, and verifies that Windows actually saved the setting.
