/** Direct one-click installer download — bypasses the release page entirely.
 *  A "Stable download alias" GitHub Action re-uploads this fixed filename on
 *  every published release, so the URL never needs to change again. */
export const DOWNLOAD_EXE =
  "https://github.com/AurelioAvila/pc-tweaker-app/releases/latest/download/PCTweaker-Setup.exe";

/** For people who want the .msi, release notes, checksums, or older versions. */
export const RELEASES_PAGE = "https://github.com/AurelioAvila/pc-tweaker-app/releases/latest";

/** Backend that relays the support form and stores reviews. The support
 *  inbox address itself lives only on that server and is never shipped in
 *  this bundle — see backend/src/support-inbox.ts. */
export const API_BASE = "https://pc-tweaker-app-production.up.railway.app";
