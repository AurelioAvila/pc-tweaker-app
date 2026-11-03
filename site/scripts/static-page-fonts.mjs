// Static pages under public/ (Tweaky Driver) cannot import fonts.css, and the
// built font files are hashed. After the build, replace the <!--site-fonts-->
// marker with the same preload + @font-face (font-display: swap) the app uses,
// pointing at the hashed files, so the shared header matches every other page.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PAGES = ["tweaky-driver/index.html"];
const FONTS = [
  { family: "Inter", re: /^inter-latin-wght-normal-.*\.woff2$/, weight: "100 900" },
  { family: "Space Grotesk", re: /^space-grotesk-latin-wght-normal-.*\.woff2$/, weight: "300 700" },
];

const files = await readdir(path.join(dist, "assets"));
const found = FONTS.map((f) => ({ ...f, file: files.find((n) => f.re.test(n)) }));
const missing = found.filter((f) => !f.file).map((f) => f.family);
if (missing.length) throw new Error(`Built font files not found: ${missing.join(", ")}`);

const links = found
  .map((f) => `<link rel="preload" as="font" type="font/woff2" href="/assets/${f.file}" crossorigin>`)
  .join("");
const faces = found
  .map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(/assets/${f.file}) format("woff2")}`,
  )
  .join("");
const block = `${links}<style>${faces}</style>`;

for (const page of PAGES) {
  const file = path.join(dist, page);
  const html = await readFile(file, "utf8");
  if (!html.includes("<!--site-fonts-->")) throw new Error(`${page}: <!--site-fonts--> marker missing`);
  await writeFile(file, html.replace("<!--site-fonts-->", block));
}
console.log(`static-page-fonts: ${PAGES.length} page(s) updated`);
