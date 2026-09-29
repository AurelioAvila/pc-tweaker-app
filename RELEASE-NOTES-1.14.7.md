PC Tweaker 1.14.7 hardens automatic updates, the private DNS control and account passwords.

- Automatic updates install only an installer whose signed file name matches the offered version, so an older signed installer cannot be replayed as an update.
- The private DNS control validates every value before passing it to Windows.
- New account passwords longer than the 72-byte hashing limit are refused instead of being shortened.
