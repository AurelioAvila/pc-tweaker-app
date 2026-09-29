# PC Tweaker 1.3.1

A patch release: bug fixes plus a new language, no new tweak or feature
surface.

## Fixed

- The profile-photo picker could silently fail to load an image — the
  app's Content-Security-Policy was blocking `blob:` URLs used to preview
  the picked photo. Picking a photo now works reliably.
- The avatar photo could render off-center instead of properly cropped
  and centered.

## New

- Full Portuguese localization — the 6th supported language.

## Driver panel

- The last driver scan now persists across app restarts (stored locally),
  so reopening the panel doesn't pay for a full re-scan of every device
  class again unless you ask for one.
- Driver installs are now selective: each driver has its own checkbox, so
  you can install just the ones you want instead of all-or-nothing.
- The "Windows Update" check is now labeled and described on its own,
  distinct from the vendor-specific drivers listed above it, since it
  isn't tied to any one of them.

---

No changes to the tweak catalog in this release.
