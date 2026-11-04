/**
 * Creates (or checks) the Price behind the 7-day Pro pass (src/pass.ts):
 * €4.99 once, on a Product of its own with Lifetime's tax code and tax behaviour.
 *
 *   railway run node scripts/pass-7d-price.mjs            # check only
 *   railway run node scripts/pass-7d-price.mjs --apply    # create what is missing
 *
 * Reads STRIPE_SECRET_KEY and STRIPE_PRICE_LIFETIME from the environment and
 * never prints them. The Product ID and the Price lookup key are fixed, so a
 * rerun creates nothing twice. The printed STRIPE_PRICE_PASS_7D line is what
 * the backend needs; a Price ID is not a secret.
 */
import Stripe from "stripe";

const PRODUCT_ID = "pctweaker_pass_7d";
const LOOKUP_KEY = "pctweaker-pass-7d";
const AMOUNT = 499;
const NAME = "PC Tweaker Pro — 7-day pass";
const DESCRIPTION = "Every PC Tweaker Pro control for 7 days from payment. One payment, no subscription and no renewal.";

const apply = process.argv.includes("--apply");
const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
if (!process.env.STRIPE_PRICE_LIFETIME) throw new Error("STRIPE_PRICE_LIFETIME is not set");
const live = /^(sk|rk)_live_/.test(key);
const stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" });
const fail = (message) => { console.error(`FAIL ${message}`); process.exit(1); };

const lifetime = await stripe.prices.retrieve(process.env.STRIPE_PRICE_LIFETIME, { expand: ["product"] });
const taxCode = lifetime.product.tax_code;
if (!taxCode) fail("the Lifetime product has no tax code to copy");

let product = await stripe.products.retrieve(PRODUCT_ID).catch((err) => {
  if (err?.code === "resource_missing") return null;
  throw err;
});
if (!product && apply) {
  product = await stripe.products.create({
    id: PRODUCT_ID, name: NAME, description: DESCRIPTION, tax_code: taxCode,
    metadata: { product: "pctweaker", plan: "pass_7d" },
  });
  console.log(`created product ${product.id}`);
}
if (!product) fail(`product ${PRODUCT_ID} does not exist (run with --apply)`);
if (!product.active || product.tax_code !== taxCode || product.livemode !== live) {
  fail(`product ${PRODUCT_ID} is inactive or not taxed like Lifetime (${taxCode})`);
}

let price = (await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], limit: 1 })).data[0] ?? null;
if (!price && apply) {
  price = await stripe.prices.create({
    product: PRODUCT_ID,
    currency: "eur",
    unit_amount: AMOUNT,
    lookup_key: LOOKUP_KEY,
    nickname: "7-day pass",
    ...(lifetime.tax_behavior && lifetime.tax_behavior !== "unspecified" ? { tax_behavior: lifetime.tax_behavior } : {}),
    metadata: { product: "pctweaker", plan: "pass_7d" },
  });
  console.log(`created price ${price.id}`);
}
if (!price) fail(`price ${LOOKUP_KEY} does not exist (run with --apply)`);
if (price.unit_amount !== AMOUNT || price.currency !== "eur" || price.recurring || !price.active ||
    price.product !== PRODUCT_ID || price.livemode !== live || price.tax_behavior !== lifetime.tax_behavior) {
  fail(`price ${price.id} does not match this script; never delete a Price a backend variable points to`);
}
console.log(`ok   ${live ? "LIVE" : "TEST"} STRIPE_PRICE_PASS_7D=${price.id}  (${AMOUNT} cents once, ${taxCode}, tax behaviour ${price.tax_behavior})`);
