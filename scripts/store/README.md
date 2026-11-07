# Microsoft Store listing content

The JSON files in `listing/` describe the Store page. They do not add interface languages to the application or change its Windows package, prices, markets or payment implementation. Japanese, Korean and Simplified Chinese descriptions explicitly explain the six supported interface languages and the English screenshots.

The current gallery is the 1.20.3 interface captured on November 6, 2026: Scan, Audio and Change history. All three images visibly identify fictional sample data and a Pro view. They are interface examples, not real-device measurements. The originals and capture hashes are in [`docs/screenshots`](../../docs/screenshots/README.md).

`Publish-MicrosoftStore.ps1` reads all JSON files dynamically. When using `-Screenshots`, provide a folder for each base language (`de`, `en`, `es`, `fr`, `it`, `ja`, `ko`, `pt`, `zh`), with the three filenames referenced by that locale. The current file mapping is:

| Listing filename | Committed source in `docs/screenshots/` |
|---|---|
| `01-scan-1203.png` | `pc-tweaker-1.20.3-scan-results-sample-data.png` |
| `02-audio-1203.png` | `pc-tweaker-1.20.3-audio-sample-data.png` |
| `03-history-1203.png` | `pc-tweaker-1.20.3-change-history-sample-data.png` |

Use `-ListingOnly` for a metadata-only submission. `-SetLanguages` must be intentional: the files must include every existing language that should remain. Export and compare the current published submission first, and never replace a pending submission or repeat an uncertain attempt. A successful submission still requires Microsoft certification before publication.

Before later releases, check that counts, plan terms, captions and image provenance still match the actual product. Do not relabel older screenshots as a newer interface. Preserve final publisher-signature and timestamp verification for any new binary distribution.
