import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Component copy must pass the same checks as the main translation table.
export async function loadTranslations() {
  const result = await build({
    stdin: {
      contents: `
        import { STRINGS } from './src/i18n';
        import { SCAN_COPY } from './src/components/scan-copy';
        import { ADVANCED_COPY } from './src/components/advanced-copy';
        import { DEBLOAT_COPY, LIBRARY_COPY, EXTRA_IMPACTS } from './src/components/debloat-copy';
        import { PRICING_COPY } from './src/components/pricing-copy';
        import { STARTER_COPY } from './src/components/starter-copy';
        const tables = { componentScan: SCAN_COPY, componentAdvanced: ADVANCED_COPY,
          componentDebloat: DEBLOAT_COPY, componentLibrary: LIBRARY_COPY,
          componentImpacts: EXTRA_IMPACTS, componentPricing: PRICING_COPY,
          componentStarter: STARTER_COPY };
        export const translations = Object.fromEntries(Object.entries(STRINGS).map(([lang, strings]) =>
          [lang, { ...strings, ...Object.fromEntries(Object.entries(tables).map(([key, table]) => [key, table[lang]])) }]));
      `,
      resolveDir: fileURLToPath(new URL("../", import.meta.url)),
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
  });
  return (await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"))).translations;
}
