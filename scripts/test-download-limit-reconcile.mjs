import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const { outputFiles } = await build({
  entryPoints: [
    fileURLToPath(new URL("../src/components/download-limit-reconcile.ts", import.meta.url)),
  ],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { reconcileDownloadState } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

let shown = null;
const applied = { configuredKbps: 512, applied: true };
await reconcileDownloadState(
  async () => applied,
  (state) => {
    shown = state;
  },
);
assert.equal(shown, applied, "a successful readback exposes the applied cap for Restore");

await reconcileDownloadState(
  async () => {
    throw Error("IPC failed");
  },
  (state) => {
    shown = state;
  },
);
assert.equal(shown, null, "an unreadable state cannot leave a stale action enabled");
