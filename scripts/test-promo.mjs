import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/promo.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { parsePromo, promoPercent, msUntil } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);

const offer = { product: "pctweaker", plan: "lifetime", currency: "eur", regular: 9900, reference: 9900, price: 7900, percentOff: 20, firstPeriodOnly: false };
const active = {
  serverTime: "2026-11-06T22:59:00.000Z",
  id: "halloween-2026",
  status: "active",
  startsAt: "2026-10-14T22:00:00.000Z",
  endsAt: "2026-11-06T23:00:00.000Z",
  offers: [offer],
};

// A server response becomes a promotion; nothing else does.
assert.equal(parsePromo(active).offers.length, 1);
for (const bad of [null, {}, { ...active, status: "disabled" }, { ...active, endsAt: "soon" }, { ...active, offers: "x" }]) {
  assert.equal(parsePromo(bad), null);
}
// A "discount" that is not below the struck price, or not in euro cents, is never drawn.
for (const broken of [{ price: 9900 }, { price: 9901 }, { reference: 7000 }, { price: 79.0 + 0.5 }, { currency: "usd" }, { regular: 7900 }]) {
  assert.equal(parsePromo({ ...active, offers: [{ ...offer, ...broken }] }).offers.length, 0, JSON.stringify(broken));
}
// A scheduled promotion publishes no prices.
assert.deepEqual(parsePromo({ ...active, status: "scheduled", offers: [offer] }).offers, []);

// The badge is rounded down and computed from the struck price.
assert.equal(promoPercent(offer), 20);
assert.equal(promoPercent({ ...offer, regular: 799, reference: 799, price: 639 }), 20);
assert.equal(promoPercent({ ...offer, reference: 1000, price: 801 }), 19);

// The deadline runs on the server's clock plus elapsed time: one minute left,
// gone after it, whatever the PC's own clock says.
assert.equal(msUntil(active, active.endsAt, 0), 60_000);
assert.ok(msUntil(active, active.endsAt, 60_000) <= 0);
assert.equal(msUntil(active, active.endsAt, -5_000), 60_000, "negative elapsed time cannot extend the offer");

console.log("promo display checks passed");
