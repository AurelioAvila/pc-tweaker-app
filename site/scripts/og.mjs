/**
 * Open Graph cards (1200x630 PNG) for the reference and fix pages, drawn at
 * build time from one SVG template with the site's own fonts.
 *
 * The fonts come from the @fontsource packages the site already ships. resvg
 * reads TrueType but not WOFF, so the .woff files are unpacked here: a WOFF 1
 * file is the same sfnt tables, each zlib-compressed, behind a 44-byte header.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200;
const H = 630;

/** WOFF 1 -> TrueType/OpenType bytes. */
export function woffToSfnt(woff) {
  if (woff.readUInt32BE(0) !== 0x774f4646) throw new Error("not a WOFF 1 file");
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const [tag, offset, compLength, origLength, checksum] = [
      woff.readUInt32BE(o), woff.readUInt32BE(o + 4), woff.readUInt32BE(o + 8), woff.readUInt32BE(o + 12), woff.readUInt32BE(o + 16),
    ];
    const raw = woff.subarray(offset, offset + compLength);
    tables.push({ tag, checksum, data: compLength < origLength ? inflateSync(raw) : Buffer.from(raw) });
  }
  const pow2 = 2 ** Math.floor(Math.log2(numTables));
  const header = Buffer.alloc(12 + 16 * numTables);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(pow2 * 16, 6);
  header.writeUInt16BE(Math.log2(pow2), 8);
  header.writeUInt16BE(numTables * 16 - pow2 * 16, 10);
  let offset = header.length;
  const chunks = [header];
  tables.forEach((t, i) => {
    const r = 12 + i * 16;
    header.writeUInt32BE(t.tag, r);
    header.writeUInt32BE(t.checksum, r + 4);
    header.writeUInt32BE(offset, r + 8);
    header.writeUInt32BE(t.data.length, r + 12);
    const padded = Buffer.alloc((t.data.length + 3) & ~3);
    t.data.copy(padded);
    chunks.push(padded);
    offset += padded.length;
  });
  return Buffer.concat(chunks);
}

const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Greedy word wrap by an average glyph width (em fraction), at most `max` lines. */
export function wrap(text, size, width, max, em = 0.55) {
  const per = Math.max(8, Math.floor(width / (size * em)));
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > per && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

function svg(card, logo) {
  let size = 66;
  let lines = wrap(card.title, size, 1000, 3);
  if (lines.length === 3) { size = 56; lines = wrap(card.title, size, 1000, 3); }
  const titleTop = 250;
  const lh = size * 1.12;
  const detail = wrap(card.detail ?? "", 26, 1000, 2, 0.6);
  const detailTop = titleTop + lines.length * lh + 26;
  const badgeW = card.badge ? Math.round(card.badge.length * 12.4 + 44) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c1c22"/><stop offset="1" stop-color="#121217"/></linearGradient>
    <radialGradient id="glow" cx="1" cy="0" r="0.9"><stop offset="0" stop-color="#ff6a3d" stop-opacity="0.22"/><stop offset="1" stop-color="#ff6a3d" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="#ff6a3d"/>
  <image x="80" y="70" width="56" height="56" xlink:href="data:image/png;base64,${logo}"/>
  <text x="152" y="108" font-family="Space Grotesk" font-weight="700" font-size="30" fill="#f4f4f5">PC Tweaker</text>
  <text x="80" y="200" font-family="JetBrains Mono" font-weight="500" font-size="22" letter-spacing="3" fill="#ff6a3d">${esc(card.eyebrow)}</text>
  ${lines.map((l, i) => `<text x="80" y="${titleTop + i * lh + size * 0.8}" font-family="Space Grotesk" font-weight="700" font-size="${size}" fill="#f4f4f5">${esc(l)}</text>`).join("\n  ")}
  ${detail.map((l, i) => `<text x="80" y="${detailTop + i * 36 + 26}" font-family="Inter" font-weight="400" font-size="26" fill="#9ca3af">${esc(l)}</text>`).join("\n  ")}
  ${card.badge ? `<rect x="80" y="${H - 104}" rx="22" ry="22" width="${badgeW}" height="44" fill="none" stroke="#ff6a3d" stroke-opacity="0.55" stroke-width="2"/>
  <text x="${80 + badgeW / 2}" y="${H - 75}" text-anchor="middle" font-family="Inter" font-weight="500" font-size="21" fill="#f4f4f5">${esc(card.badge)}</text>` : ""}
  <text x="${W - 80}" y="${H - 75}" text-anchor="end" font-family="JetBrains Mono" font-weight="400" font-size="22" fill="#9ca3af">pctweaker.app</text>
</svg>`;
}

async function fonts() {
  const files = [
    "@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff",
    "@fontsource/inter/files/inter-latin-400-normal.woff",
    "@fontsource/inter/files/inter-latin-500-normal.woff",
    "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
    "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff",
  ];
  return Promise.all(files.map(async (f) => woffToSfnt(await readFile(path.join(root, "node_modules", f)))));
}

/** Writes <outDir><path>.png for every card. */
export async function writeOgCards(cards, outDir) {
  const fontBuffers = await fonts();
  const logo = (await readFile(path.join(root, "public", "logo.png"))).toString("base64");
  for (const card of cards) {
    const file = path.join(outDir, `${card.path.slice(1)}.png`);
    await mkdir(path.dirname(file), { recursive: true });
    const png = new Resvg(svg(card, logo), {
      fitTo: { mode: "width", value: W },
      font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: "Inter" },
    }).render().asPng();
    await writeFile(file, png);
  }
  console.log(`Open Graph cards: ${cards.length} written to ${path.relative(root, outDir)}`);
}
