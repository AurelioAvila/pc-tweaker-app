// Writes dist/llms.txt and dist/llms-full.txt for pctweaker.app after the prerender.
//
// Nothing is typed twice: prices, descriptions and the FAQ are read from the JSON-LD the
// built pages already carry (which prerender.mjs fills from src/lib.ts and the dictionary),
// the control counts from the Rust catalogue test, the languages from src/i18n.ts, and the
// installer hash and signature from site/src/generated/release-trust.json (release-trust.mjs).
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const here = new URL("../", import.meta.url);
const dist = new URL("dist/", here);
const read = (url) => readFile(url, "utf8");
const ORIGIN = "https://pctweaker.app";

const ldBlocks = async (route) =>
  [...(await read(new URL(`${route}index.html`, dist))).matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]));
const find = (blocks, type) => blocks.flatMap((b) => b["@graph"] ?? [b]).find((b) => b["@type"] === type);

const home = await ldBlocks("");
const app = find(home, "SoftwareApplication");
const faq = find(home, "FAQPage");
const uninstaller = find(await ldBlocks("uninstaller/"), "SoftwareApplication");
const tweaky = find(await ldBlocks("tweaky-driver/"), "SoftwareApplication");
for (const [name, v] of Object.entries({ app, faq, uninstaller, tweaky })) assert.ok(v, `no JSON-LD for ${name}`);

const lib = await read(new URL("../src-tauri/src/lib.rs", here));
const total = Number(lib.match(/assert_eq!\(total, (\d+),/)?.[1]);
const pro = Number(lib.match(/assert_eq!\(pro, (\d+),/)?.[1]);
assert.ok(total && pro, "catalogue counts not found");
const languages = [...(await read(new URL("../src/i18n.ts", here))).matchAll(/native: "([^"]+)"/g)].map((m) => m[1]);
const trust = JSON.parse(await read(new URL("src/generated/release-trust.json", here)));

const euro = (v) => `EUR ${v}`;
const offers = (p) => p.offers.map((o) => `- ${o.name}: ${euro(o.price)}. ${o.description ?? ""}`.trim());
const trustLine = (key, label) => {
  const t = trust[key];
  return `- ${label} ${t.version}: SHA-256 ${t.sha256}; Authenticode ${t.signature.status}, signed by ${t.signature.signer}${t.signature.timestamped ? " with a trusted timestamp" : ""}; ${t.releasePage}`;
};

const pages = [...(await read(new URL("sitemap.xml", dist))).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const titleOf = async (url) => (await read(new URL(`${new URL(url).pathname.slice(1)}index.html`, dist))).match(/<title>([^<]+)<\/title>/)[1];
const guideLinks = [];
for (const url of pages) {
  if (/\/(support|privacy|terms|cookies|accessibility|uninstaller|tweaky-driver)\/$/.test(url) || url === `${ORIGIN}/`) continue;
  guideLinks.push(`- [${(await titleOf(url)).replace(/ \| PC Tweaker$/, "")}](${url})`);
}

const core = [
  "# PC Tweaker",
  "",
  `> Windows tools by Aurelio Avila: PC Tweaker (tuning for gaming, privacy and maintenance, with restore tools for supported changes), PC Tweaker Uninstaller (see the risk of an uninstall before it runs) and Tweaky Driver (driver inventory and update review). They run on Windows 10 and 11 and are separate apps with separate plans.`,
  "",
  "## Apps",
  "",
  `- [PC Tweaker](${ORIGIN}/): ${app.description} ${total} controls in the current release (${total - pro} Free, ${pro} Pro). Version ${app.softwareVersion}.`,
  `- [PC Tweaker Uninstaller](${ORIGIN}/uninstaller/): ${uninstaller.description}`,
  `- [Tweaky Driver](${ORIGIN}/tweaky-driver/): ${tweaky.description}`,
  "",
  "## Pricing (EUR, read from the site's structured data)",
  "",
  "PC Tweaker",
  ...offers(app),
  "",
  "PC Tweaker Uninstaller",
  ...offers(uninstaller),
  "",
  "Tweaky Driver",
  ...offers(tweaky),
  "",
  "Prices include VAT where applicable. Checkout runs through Stripe and the final amount and renewal terms are shown before you confirm. Where a Pro trial is offered, its terms are shown before you pay.",
  "",
  "## Facts",
  "",
  "- Platform: Windows 10 and Windows 11, x64.",
  `- App languages: ${languages.join(", ")}. The apps start in English; the language is changed in Settings.`,
  "- Privacy: tweaks, snapshots, rollback data, hardware readings and file scans are processed on your PC. Account, licence, update, payment and support requests contact their own services. No advertising trackers. The controller is Aurelio Avila, a private individual.",
  "- Undo: supported settings store their previous state and can be restored one by one or with Restore All. This is not a full system image, and no FPS gain is promised.",
  "- Support: support@pctweaker.app, or the support page.",
  "",
  "## Verify a download",
  "",
  trustLine("pc-tweaker", "PC Tweaker"),
  trustLine("uninstaller", "PC Tweaker Uninstaller"),
  trustLine("tweaky-driver", "Tweaky Driver"),
  "",
  "Check a file in PowerShell with Get-FileHash <file> -Algorithm SHA256 and Get-AuthenticodeSignature <file>.",
  "",
  "## Install",
  "",
  `- Installer: ${app.downloadUrl}`,
  "- Microsoft Store: https://apps.microsoft.com/detail/9nh3c6dt1g87",
  "- winget: winget install --id AurelioAvila.PCTweaker --exact",
  "- Release notes and source: https://github.com/AurelioAvila/pc-tweaker-app/releases",
  "",
  "## Guides",
  "",
  ...guideLinks,
  "",
  "## Policies",
  "",
  `- [Support](${ORIGIN}/support/)`,
  `- [Privacy Policy](${ORIGIN}/privacy/)`,
  `- [Terms of Service](${ORIGIN}/terms/)`,
  `- [Cookie Policy](${ORIGIN}/cookies/)`,
  `- [Accessibility](${ORIGIN}/accessibility/)`,
  `- [llms-full.txt](${ORIGIN}/llms-full.txt)`,
  "",
];

const full = [
  ...core,
  "## Frequently asked questions (PC Tweaker)",
  "",
  ...faq.mainEntity.flatMap((q) => [`### ${q.name}`, "", q.acceptedAnswer.text, ""]),
];

await writeFile(new URL("llms.txt", dist), core.join("\n"), "utf8");
await writeFile(new URL("llms-full.txt", dist), full.join("\n"), "utf8");
// Tweaky Driver's page is static HTML copied from public/: fill its verify block here.
const t = trust["tweaky-driver"];
const tweakyFile = new URL("tweaky-driver/index.html", dist);
const tweakyHtml = await read(tweakyFile);
assert.ok(tweakyHtml.includes("<!--RELEASE_TRUST-->"), "tweaky-driver page lost its RELEASE_TRUST marker");
await writeFile(
  tweakyFile,
  tweakyHtml.replace(
    "<!--RELEASE_TRUST-->",
    `<details data-release-trust="tweaky-driver" style="max-width:720px;padding:12px 0"><summary style="font-size:16px">Verify this download (v${t.version})</summary><p class="small">TweakyDriver-Setup.exe is the installer of release v${t.version}. SHA-256: <code style="word-break:break-all">${t.sha256}</code>.</p><p class="small">Authenticode signature: ${t.signature.status}, publisher ${t.signature.signer}${t.signature.timestamped ? ", with a trusted timestamp" : ""}. Certificate thumbprint <code style="word-break:break-all">${t.signature.thumbprint}</code>.</p><p class="small">In PowerShell, from the folder you saved it to:</p><pre class="small" style="overflow-x:auto"><code>Get-FileHash .\TweakyDriver-Setup.exe -Algorithm SHA256
Get-AuthenticodeSignature .\TweakyDriver-Setup.exe | Format-List Status, SignerCertificate</code></pre></details>`,
  ),
  "utf8",
);

for (const forbidden of [/illustrative/i, /anti-?cheat/i]) {
  assert.ok(!forbidden.test(full.join("\n")), `llms text contains ${forbidden}`);
}
console.log(`llms.txt (${core.join("\n").length} chars) and llms-full.txt (${full.join("\n").length} chars) written.`);
