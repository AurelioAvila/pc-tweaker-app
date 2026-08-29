/**
 * Unit tests for the thermal session verdict and the profile wattages.
 * Bundled with esbuild the same way test-advisor.mjs does, so the real
 * production code is under test rather than a copy of it.
 *
 * The case that matters most is the idle one: an idle card runs cool no
 * matter how bad its cooler is, so calling that "better than expected" would
 * be flattery dressed up as a measurement. The verdict is only allowed to
 * praise a card that was actually working.
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(root, "..", "src", "components", "hardware.tsx");

const bundlePath = path.join(root, ".thermals-test-bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: "esm",
  platform: "neutral",
  external: ["react", "react/jsx-runtime", "@tauri-apps/api/core", "@tauri-apps/plugin-opener"],
  define: { "import.meta.env.VITE_API_BASE_URL": '""' },
});
let mod;
try {
  mod = await import(pathToFileURL(bundlePath).href);
} finally {
  fs.rmSync(bundlePath, { force: true });
}
const { judgeSession, modePlan } = mod;

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : ` — got ${actual}, expected ${expected}`}`,
  );
}

/** n samples at a fixed temperature and load. */
function run(n, tempC, loadPct) {
  return Array.from({ length: n }, () => ({ tempC, loadPct }));
}

check("no samples yet is idle", judgeSession([]), "idle");

check("cool but doing nothing is idle, not praise", judgeSession(run(30, 42, 0)), "idle");

check(
  "a brief load spike is not enough to judge",
  judgeSession([...run(30, 45, 0), ...run(3, 55, 90)]),
  "idle",
);

check("cool while genuinely working beats expectations", judgeSession(run(20, 58, 85)), "better");

check("warm while working is simply normal", judgeSession(run(20, 74, 85)), "normal");

check("crossing the throttle threshold is risky", judgeSession(run(20, 86, 85)), "risky");

// A single hot sample still counts: throttling once is the thing worth
// reporting, and averaging it away would hide exactly what the panel is for.
check(
  "one hot sample outweighs an otherwise cool run",
  judgeSession([...run(40, 50, 90), { tempC: 88, loadPct: 90 }]),
  "risky",
);

// Load can be null when a card exposes no utilisation counter. That must read
// as "unknown work", never as "definitely working".
check("null load never counts as working", judgeSession(run(30, 50, null)), "idle");

const info = {
  supported: true,
  current_w: 130,
  default_w: 130,
  min_w: 70,
  max_w: 130,
  default_is_max: true,
  max_clock_mhz: 2145,
  current_clock_mhz: 1530,
};

// The profiles must differ in something the card actually does. On a card
// whose factory limit already equals its maximum — most locked consumer
// cards — watts alone cannot tell Standard and Gaming apart, so the clock
// has to. A build where these two plans are identical is a regression.
const silent = modePlan(info, "silent");
const standard = modePlan(info, "standard");
const gaming = modePlan(info, "gaming");

check("silent caps at 60% of default", silent.watts, 78);
check("standard caps just under the ceiling", standard.watts, 111);
check("gaming asks for the card's own maximum", gaming.watts, 130);

check("silent leaves the clock to the driver", silent.lockClockMhz, null);
check("standard leaves the clock to the driver", standard.lockClockMhz, null);
check("gaming raises the clock ceiling", gaming.lockClockMhz, 2145);

check(
  "standard and gaming are never the same plan",
  standard.watts === gaming.watts && standard.lockClockMhz === gaming.lockClockMhz,
  false,
);

// A card whose floor is above 60% of default must not be sent below its floor.
const narrow = { ...info, min_w: 120 };
check("silent never dips under the card's floor", modePlan(narrow, "silent").watts, 120);

// Without a stated range there is nothing safe to send.
const unknown = { ...info, min_w: null, max_w: null };
check("no range means no plan at all", modePlan(unknown, "silent"), null);

// A card that reports no maximum clock simply gets no lock, rather than a
// lock to some invented number.
const noClock = { ...info, max_clock_mhz: null };
check("no reported clock means no clock lock", modePlan(noClock, "gaming").lockClockMhz, null);

if (failures > 0) {
  console.error(`\n${failures} thermal test(s) failed.`);
  process.exit(1);
}
console.log("\nthermal tests passed.");
