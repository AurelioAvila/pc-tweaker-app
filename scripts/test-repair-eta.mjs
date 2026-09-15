/**
 * Unit tests for the repair time-left estimate. Bundled with esbuild like
 * test-thermals.mjs, so the production module is what runs.
 *
 * The case that matters: a DISM stall. An estimate that keeps promising the
 * same four minutes while the percentage stands still is the bug this
 * module exists to remove.
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(root, ".repair-eta-test-bundle.mjs");
await build({
  entryPoints: [path.join(root, "..", "src", "components", "repair-eta.ts")],
  bundle: true,
  outfile: bundlePath,
  format: "esm",
  platform: "neutral",
});
let mod;
try {
  mod = await import(pathToFileURL(bundlePath).href);
} finally {
  fs.rmSync(bundlePath, { force: true });
}
const { median, rateRemaining, stepRemaining, smoothTowards, typicalDuration } = mod;

let failures = 0;
function check(name, ok) {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
}

const S = 1000;
const MIN = 60 * S;
// A steady 1% every 6 s from t=0: 10 minutes for the whole step.
const steady = Array.from({ length: 51 }, (_, i) => ({ t: i * 6 * S, p: i }));

check("median of odd and even lists", median([3, 1, 2]) === 2 && median([4, 1, 2, 3]) === 2.5);
check("median of nothing is null", median([]) === null);

const atHalf = rateRemaining(steady, 0, 300 * S);
check("steady rate: 50% at 5 min leaves ~5 min", Math.abs(atHalf - 5 * MIN) < 10 * S);

check(
  "no estimate in the first 20 s",
  rateRemaining(
    [
      { t: 0, p: 0 },
      { t: 10 * S, p: 5 },
    ],
    0,
    15 * S,
  ) === null,
);
check(
  "no estimate below 3%",
  rateRemaining(
    [
      { t: 0, p: 0 },
      { t: 60 * S, p: 2 },
    ],
    0,
    60 * S,
  ) === null,
);

// Same run, then frozen at 50% for four minutes.
const stalledLater = rateRemaining(steady, 0, 540 * S);
check("a stall makes the estimate grow, not freeze", stalledLater > atHalf * 1.5);

// DISM's park: 62% after 5 min, then creeping 0.1% a minute. A recent-window
// rate called that five hours; the step really has minutes left.
const park = [
  ...steady.slice(0, 51),
  { t: 300 * S, p: 62 },
  { t: 360 * S, p: 62.1 },
  { t: 420 * S, p: 62.2 },
];
const parked = rateRemaining(park, 0, 440 * S);
check("the 62% park does not predict hours", parked < 10 * MIN);

// At 2 min and 20% the rate says 8 min left, history (12 min typical) says
// 10. The rate weighs (20%)² = 4%, floored at 10%: 9.8 min.
const early = stepRemaining({
  samples: steady.slice(0, 21),
  stepStartedAt: 0,
  now: 120 * S,
  typicalMs: 12 * MIN,
});
check("early on, history dominates (~9.8 min)", Math.abs(early - 9.8 * MIN) < 5 * S);

const pastHistory = stepRemaining({
  samples: steady,
  stepStartedAt: 0,
  now: 300 * S,
  typicalMs: 4 * MIN,
});
check("past the typical duration, the rate alone decides", Math.abs(pastHistory - atHalf) < 1);

check(
  "done means zero",
  stepRemaining({ samples: [{ t: 0, p: 100 }], stepStartedAt: 0, now: S, typicalMs: null }) === 0,
);

const eased = smoothTowards(100 * S, 200 * S, S);
check("smoothing moves part of the way", eased > 100 * S && eased < 110 * S);
check("smoothing seeds from the first value", smoothTowards(null, 42, S) === 42);

// No localStorage in Node: exactly the first-run case.
check("first run falls back to a typical duration", typicalDuration("restore") === 15 * MIN);
check("an unknown step has no typical duration", typicalDuration("reset_base") === null);

if (failures) {
  console.error(`\n${failures} repair ETA check(s) failed`);
  process.exit(1);
}
console.log("\nrepair ETA checks passed");
