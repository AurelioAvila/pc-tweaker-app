import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lifetime-offer.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { parseLifetimeOffer, offerRemainingSeconds, offerClock, previewLifetimeOffer } =
  await import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
  );
const start = Date.parse("2026-09-05T10:00:00Z");
const end = start + 48 * 3600 * 1000;
const active = {
  serverTime: new Date(start).toISOString(),
  id: "launch",
  startsAt: new Date(start).toISOString(),
  endsAt: new Date(end).toISOString(),
  status: "active",
  available: true,
  product: "pctweaker",
  plan: "lifetime",
  checkoutGraceSeconds: 1860,
};
const checks = [
  [
    "accepts the actual active contract",
    () => assert.deepEqual(parseLifetimeOffer(active), active),
  ],
  [
    "accepts unavailable checkout independently of campaign phase",
    () => assert.ok(parseLifetimeOffer({ ...active, available: false })),
  ],
  [
    "rejects another product",
    () => assert.equal(parseLifetimeOffer({ ...active, product: "uninstaller" }), null),
  ],
  [
    "rejects malformed or unbounded deadlines",
    () => {
      assert.equal(parseLifetimeOffer({ ...active, endsAt: "tomorrow" }), null);
      assert.equal(
        parseLifetimeOffer({ ...active, endsAt: new Date(end + 1).toISOString() }),
        null,
      );
    },
  ],
  [
    "no configured campaign has no countdown",
    () => {
      const disabled = { ...active, status: "disabled", id: null, startsAt: null, endsAt: null };
      assert.ok(parseLifetimeOffer(disabled));
      assert.equal(offerRemainingSeconds(disabled, 0), 0);
    },
  ],
  [
    "an active claim at or after the deadline is rejected",
    () => assert.equal(parseLifetimeOffer({ ...active, serverTime: active.endsAt }), null),
  ],
  [
    "the clock expires at the exact deadline and never goes negative",
    () => {
      assert.equal(offerRemainingSeconds(active, 48 * 3600 * 1000 - 1), 1);
      assert.equal(offerRemainingSeconds(active, 48 * 3600 * 1000), 0);
      assert.equal(offerRemainingSeconds(active, 72 * 3600 * 1000), 0);
    },
  ],
  [
    "late responses account for request time immediately",
    () =>
      assert.equal(
        offerRemainingSeconds({ ...active, serverTime: new Date(end - 500).toISOString() }, 1000),
        0,
      ),
  ],
  [
    "scheduled offers cannot claim purchase availability",
    () => {
      const scheduled = {
        ...active,
        status: "scheduled",
        available: false,
        serverTime: new Date(start - 1).toISOString(),
      };
      assert.ok(parseLifetimeOffer(scheduled));
      assert.equal(parseLifetimeOffer({ ...scheduled, available: true }), null);
    },
  ],
  [
    "a preview deadline survives reopening and ends permanently",
    () => {
      assert.equal(
        previewLifetimeOffer(active.endsAt, start).endsAt,
        previewLifetimeOffer(active.endsAt, start + 3600_000).endsAt,
      );
      assert.equal(previewLifetimeOffer(active.endsAt, end).status, "expired");
      assert.equal(previewLifetimeOffer(undefined, start), null);
    },
  ],
  [
    "clock values remain stable at minute and hour boundaries",
    () => {
      assert.deepEqual(offerClock(48 * 3600), ["48", "00", "00"]);
      assert.deepEqual(offerClock(3600), ["01", "00", "00"]);
      assert.deepEqual(offerClock(-1), ["00", "00", "00"]);
    },
  ],
];
for (const [name, check] of checks) {
  check();
  console.log(`PASS ${name}`);
}
console.log(`${checks.length}/${checks.length} Lifetime offer checks passed.`);
