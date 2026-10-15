# Proposal: opening a profile from a web link (not implemented)

Status: proposal only. PC Tweaker registers no URL scheme today, and nothing on
pctweaker.app may suggest one exists. The Profile Builder on the site
(`/tools/profile-builder/`) downloads a `.pctweaker.json` file that the user
imports with Profiles > Import from file, which loads it for review and applies
nothing.

## What was asked

A link such as `pctweaker://import-profile?data=...` on the website that opens
the app with a profile already loaded.

## What it would take

- Register a URL scheme for the installed app (Tauri's deep-link plugin, plus
  the registry entries the NSIS and MSI installers would write, plus the
  Microsoft Store package manifest declaring the protocol).
- Route the incoming URL to the running single instance, which already
  receives arguments from a second launch.
- Decode the payload into the existing profile structure and hand it to the
  same review screen the file import uses.

## Security analysis

A registered scheme turns every web page, email and chat message into
something that can start PC Tweaker with input the user did not type. That is
the property to design against.

1. **Remote configuration channel.** If a link could apply anything, any page
   could change Windows settings on a visitor's PC, some of them
   administrator-level (policies under HKLM, services, power plans). The only
   acceptable design is the one the file import already has: the link fills the
   review screen and nothing runs until the user confirms in the app. Even so,
   a page could repeatedly pop the app with a misleading profile name such as
   "Recommended by Microsoft"; names would need to be shown as untrusted text
   with the source ("from a web link") and rate-limited.
2. **Payload parsing.** URL payloads arrive percent-encoded and size-unbounded.
   The parser must apply the same limits the file import enforces (format
   check first, known ids only, deduplicated, bounded count and size, name
   length and character rules) before anything reaches the UI. Unknown fields
   must be refused, not ignored.
3. **Argument injection.** On Windows a protocol handler is invoked as a
   command line. The registered command must pass the URL as a single quoted
   argument (`"...\PC Tweaker.exe" "%1"`) and the app must treat it as data,
   never as flags; otherwise a crafted link could inject switches such as the
   app's `--elevated-*` helper flags. Those helper flags would also need an
   explicit check that they never arrive through the protocol path.
4. **Elevation.** The protocol path must never trigger UAC by itself. Any
   administrator change still goes through the normal confirmation and the
   single elevated batch.
5. **Phishing surface.** A recognisable `pctweaker://` link gives lookalike
   sites a convincing call to action ("click to optimise"). The download-a-file
   flow has the same risk but makes the user open the app and choose Import,
   which is a deliberate step.
6. **Store and installer drift.** The protocol must be registered identically
   by the NSIS, MSI and Store packages, and removed on uninstall, or old
   registrations would point at missing or outdated executables.

## Recommendation

Do not add the scheme now. The file flow already gives the user the same
outcome with a deliberate step and the validation that exists today. If it is
added later, it should be limited to "open the review screen with this list",
carry ids only, reuse the file import's validation unchanged, quote `%1`, reject
helper flags on that path, and ship with tests for oversized, malformed,
unknown-field and flag-injection payloads.
