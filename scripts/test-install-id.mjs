import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/installId.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { installId, INSTALL_ID_KEY } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);

const memory = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), map };
};

// Generated once, then stable.
const store = memory();
const first = installId(store);
assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(installId(store), first);
assert.equal(store.map.get(INSTALL_ID_KEY), first);

// A tampered value is replaced, not sent.
store.map.set(INSTALL_ID_KEY, "C:\Users\name");
const replaced = installId(store);
assert.notEqual(replaced, "C:\Users\name");
assert.match(replaced, /^[0-9a-f-]{36}$/);

// No storage: nothing is sent.
assert.equal(installId({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} }), null);
console.log("install id: ok");
