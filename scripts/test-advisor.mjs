/**
 * Unit tests for the Advisor's choice function. Bundled with esbuild the same
 * way audit-i18n.mjs loads i18n.ts, so the real production code is under
 * test, not a copy.
 *
 * The last case is the guardrail that matters: a security-reducing tweak
 * (e.g. disable_memory_integrity) can NEVER be recommended, because the
 * Advisor only looks inside the scan allowlist — even if an advice record
 * for it somehow said "recommended".
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(root, "..", "src", "components", "intelligence.tsx");

// Bundled to a real file inside the project (not a data: URL) so the bare
// "react" import left external can still resolve against node_modules.
const bundlePath = path.join(root, ".advisor-test-bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: "esm",
  platform: "neutral",
  external: ["react", "react/jsx-runtime", "@tauri-apps/api/core"],
  // lib.ts reads import.meta.env at module top level; give it the same shape
  // Vite would, since this bundle runs under plain Node.
  define: { "import.meta.env.VITE_API_BASE_URL": '""' },
});
let mod;
try {
  mod = await import(pathToFileURL(bundlePath).href);
} finally {
  fs.rmSync(bundlePath, { force: true });
}
const pick = mod.pickTopRecommendation;

const tweak = (id, applied = false) => ({
  id,
  name: id,
  description: "",
  category: "performance",
  hive: "HKCU",
  requires_admin: false,
  requires_pro: false,
  applied,
});
const rec = (id, reason_key = null) => [id, { id, verdict: "recommended", reason_key }];

let failures = 0;
function check(name, got, want) {
  const ok = got === want;
  if (!ok) {
    failures++;
    console.error(`FAIL ${name}: got ${got}, want ${want}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// Picks the recommended, unapplied tweak.
check(
  "picks recommended unapplied",
  pick(
    [tweak("a"), tweak("b")],
    new Set(["a", "b"]),
    Object.fromEntries([rec("b")]),
  )?.id,
  "b",
);

// A hardware-motivated reason beats a bare recommendation.
check(
  "reasoned verdict wins",
  pick(
    [tweak("bare"), tweak("motivated")],
    new Set(["bare", "motivated"]),
    Object.fromEntries([rec("bare"), rec("motivated", "hdd_index_cost")]),
  )?.id,
  "motivated",
);

// Applied tweaks are never re-recommended.
check(
  "applied is skipped",
  pick([tweak("a", true)], new Set(["a"]), Object.fromEntries([rec("a")])),
  null,
);

// Not-recommended / neutral verdicts never surface.
check(
  "non-recommended verdicts never surface",
  pick(
    [tweak("a")],
    new Set(["a"]),
    { a: { id: "a", verdict: "notrecommended", reason_key: null } },
  ),
  null,
);

// GUARDRAIL: outside the scan allowlist means invisible to the Advisor,
// whatever the advice record claims.
check(
  "security tweak outside allowlist can never be advised",
  pick(
    [tweak("disable_memory_integrity")],
    new Set(["priority_separation"]),
    Object.fromEntries([rec("disable_memory_integrity", "weak_gpu")]),
  ),
  null,
);

if (failures > 0) {
  console.error(`\n${failures} advisor test(s) failed.`);
  process.exit(1);
}
console.log("\nadvisor tests passed.");
