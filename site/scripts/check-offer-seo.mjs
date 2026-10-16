import assert from "node:assert/strict";
import { getRouteJsonLd } from "../dist-ssr/entry-server.js";

const regular = getRouteJsonLd("/");
const app = (nodes) => nodes.find((node) => node["@type"] === "SoftwareApplication");
const prices = (route, promo) => app(getRouteJsonLd(route, promo)).offers.map((offer) => offer.price);
const snapshot = JSON.stringify(regular);
const promo = {
  id: "offer-contract-test",
  status: "active",
  serverTime: "2026-10-16T10:00:00.000Z",
  startsAt: "2026-10-10T00:00:00.000Z",
  endsAt: "2026-11-06T23:00:00.000Z",
  offers: [
    { product: "pctweaker", plan: "monthly", price: 399, regular: 799, reference: 799, firstPeriodOnly: true },
    { product: "pctweaker", plan: "annual", price: 2499, regular: 5999, reference: 4999, firstPeriodOnly: true },
    { product: "pctweaker", plan: "lifetime", price: 3999, regular: 9900, reference: 7999, firstPeriodOnly: false },
    { product: "uninstaller", plan: "annual", price: 499, regular: 999, reference: 999, firstPeriodOnly: true },
  ],
};

assert.deepEqual(prices("/", promo), ["0", "3.99", "24.99", "39.99"]);
assert.deepEqual(prices("/uninstaller", promo), ["0", "4.99"]);
const annual = app(getRouteJsonLd("/", promo)).offers.find((offer) => offer.name === "Pro annual");
assert.equal(annual.validThrough, promo.endsAt);
assert.match(annual.description, /59\.99 per year/);
assert.ok(!JSON.stringify(app(getRouteJsonLd("/", promo)).offers).includes("79.99"), "The historical reference is not a payable offer");
for (const inactive of [null, { ...promo, status: "scheduled" }, { ...promo, serverTime: promo.endsAt }, { ...promo, serverTime: "2026-10-09T00:00:00Z" }]) {
  assert.deepEqual(prices("/", inactive), ["0", "7.99", "59.99", "99"]);
}
assert.deepEqual(prices("/", { ...promo, offers: promo.offers.filter((offer) => offer.plan === "annual") }), ["0", "7.99", "24.99", "99"]);
assert.equal(JSON.stringify(regular), snapshot, "Promotions must not mutate regular prices");
assert.equal(app(getRouteJsonLd("/uninstaller", promo)).name, "PC Tweaker Uninstaller");
assert.ok(!app(getRouteJsonLd("/support", promo)), "Support pages must not carry a product offer");
assert.deepEqual(getRouteJsonLd("/missing", promo), []);
console.log("Offer SEO checks passed: regular, active, scheduled, expired, partial offers and route identity.");
