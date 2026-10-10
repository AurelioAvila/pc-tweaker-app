import { build } from "esbuild";
import fs from "node:fs";
const output = new URL(".debloat-model-test-bundle.mjs", import.meta.url);
try {
  await build({
    entryPoints: [new URL("test-debloat-model.ts", import.meta.url).pathname.replace(/^\/(\w:)/, "$1")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: output.pathname.replace(/^\/(\w:)/, "$1"),
  });
  await import(output.href);
} finally {
  fs.rmSync(output, { force: true });
}
