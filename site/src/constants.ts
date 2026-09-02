/** Direct one-click installer download — bypasses the release page entirely.
 *  A "Stable download alias" GitHub Action re-uploads this fixed filename on
 *  every published release, so the URL never needs to change again. */
export const DOWNLOAD_EXE =
  "https://github.com/AurelioAvila/pc-tweaker-app/releases/latest/download/PCTweaker-Setup.exe";

/** The Microsoft Store listing. It has existed and been live all along, and
 *  appeared only inside the JSON-LD `sameAs` array — invisible to a human
 *  reading the page. It matters more than a mirror: it is Microsoft-signed,
 *  so it is the one route with no SmartScreen prompt for somebody who does
 *  not use a terminal, which is exactly the visitor the warning turns away. */
export const MICROSOFT_STORE = "https://apps.microsoft.com/detail/9nh3c6dt1g87";

/** For people who want the .msi, release notes, checksums, or older versions. */
export const RELEASES_PAGE = "https://github.com/AurelioAvila/pc-tweaker-app/releases/latest";

/** Backend that relays the support form and stores reviews. The support
 *  inbox address itself lives only on that server and is never shipped in
 *  this bundle — see backend/src/support-inbox.ts. */
export const API_BASE = "https://api.pctweaker.app";
