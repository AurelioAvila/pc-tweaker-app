PC Tweaker 1.13.1 adds a connection check to the two tweaks that change how Windows handles TCP connections: acknowledgment timing and the congestion provider. The line is tested before the change and again afterwards. If it stopped responding, the setting is put back exactly as it was and the attempt is reported as failed, so a lost connection is never left for you to trace back to the tweak that caused it. The check opens a TCP connection to 1.1.1.1, or to github.com if that is unreachable, and sends nothing about you or your device.

Select all in Quick Scan no longer ticks the changes the scan advises against on your hardware. Those remain available individually, under their own heading, with the reason shown. Deselect all continues to clear every box.

These tweaks can still suit one line and not another, and neither check measures speed: congestion control only shows itself on a loaded connection, and an idle measurement would move by noise alone. Every change remains reversible from the same place.

Windows application and installer signatures are verified before distribution. Code signing identifies the publisher; Windows may still show reputation warnings.
