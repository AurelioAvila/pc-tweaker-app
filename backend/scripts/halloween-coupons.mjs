/**
 * Creates (or checks) the Stripe coupons behind src/promo.ts, one per offer.
 *
 *   npm run build
 *   railway run node scripts/halloween-coupons.mjs            # check only
 *   railway run node scripts/halloween-coupons.mjs --apply    # create missing coupons
 *   railway run node scripts/halloween-coupons.mjs --verify-session
 *
 * Reads STRIPE_SECRET_KEY and the STRIPE_PRICE_* variables from the
 * environment and never prints them. Coupon IDs are fixed, so a rerun creates
 * nothing twice. --verify-session opens one unpaid Checkout per offer with the
 * discount, checks Stripe's totals, and expires it at once: nothing is charged.
 * The printed STRIPE_COUPON_* lines are what the backend needs; coupon IDs
 * are not secrets.
 */
import Stripe from "stripe";
import { PROMO, percentOff } from "../dist/promo.js";
import { LIFETIME_CHECKOUT_GRACE_SECONDS } from "../dist/lifetime-offer.js";

const apply = process.argv.includes("--apply");
const verifySession = process.argv.includes("--verify-session");
const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
const live = /^(sk|rk)_live_/.test(key);
const stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" });
// The server stops discounting at endsAt; a checkout opened just before stays
// payable for the grace period, so the coupon must outlive it slightly.
const redeemBy = Math.floor(Date.parse(PROMO.endsAt) / 1000) + LIFETIME_CHECKOUT_GRACE_SECONDS + 300;
let failed = false;
const fail = (message) => { failed = true; console.error(`FAIL ${message}`); };

console.log(`${live ? "LIVE" : "TEST"} mode, ${apply ? "apply" : "check only"}`);
for (const offer of PROMO.offers) {
  const id = `${PROMO.id}-${offer.product}-${offer.plan}`;
  const priceId = process.env[offer.priceEnv];
  if (!priceId) { fail(`${offer.priceEnv} is not set`); continue; }
  const price = await stripe.prices.retrieve(priceId);
  if (price.unit_amount !== offer.regular || price.currency !== "eur" || price.livemode !== live || !price.active) {
    fail(`${offer.priceEnv} is ${price.unit_amount} ${price.currency}, expected ${offer.regular} eur`);
    continue;
  }
  const wanted = {
    amount_off: offer.regular - offer.price,
    currency: "eur",
    duration: "once",
    redeem_by: redeemBy,
  };
  let coupon = await stripe.coupons.retrieve(id, { expand: ["applies_to"] }).catch((err) => {
    if (err?.code === "resource_missing") return null;
    throw err;
  });
  if (!coupon && apply) {
    coupon = await stripe.coupons.create({
      id,
      ...wanted,
      applies_to: { products: [price.product] },
      name: `Halloween · ${percentOff(offer.reference, offer.price)}% off`,
      metadata: { promo: PROMO.id, product: offer.product, plan: offer.plan },
      expand: ["applies_to"],
    });
    console.log(`created ${id}`);
  }
  if (!coupon) { fail(`${id} does not exist (run with --apply)`); continue; }
  const products = coupon.applies_to?.products ?? [];
  if (Object.entries(wanted).some(([field, value]) => coupon[field] !== value) || !coupon.valid ||
      products.length !== 1 || products[0] !== price.product) {
    fail(`${id} does not match promo.ts; delete it in Stripe only if no backend variable points to it`);
    continue;
  }
  console.log(`ok   ${offer.couponEnv}=${id}  (${offer.regular} -> ${offer.price} cents, redeem by ${new Date(redeemBy * 1000).toISOString()})`);

  if (verifySession) {
    const session = await stripe.checkout.sessions.create({
      mode: offer.plan === "lifetime" ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      discounts: [{ coupon: id }],
      success_url: "https://pctweaker.app/checkout-success",
      cancel_url: "https://pctweaker.app/checkout-cancel",
      expires_at: Math.floor(Date.now() / 1000) + LIFETIME_CHECKOUT_GRACE_SECONDS,
      metadata: { promo_verification: PROMO.id },
    });
    await stripe.checkout.sessions.expire(session.id);
    const discount = session.total_details?.amount_discount;
    if (session.amount_subtotal !== offer.regular || discount !== offer.regular - offer.price) {
      fail(`${id} checkout quoted ${session.amount_subtotal} - ${discount}`);
    } else {
      console.log(`     checkout ${session.id.slice(0, 16)}… quoted ${session.amount_subtotal} - ${discount} = ${offer.price} before tax, expired`);
    }
  }
}
if (failed) process.exitCode = 1;
