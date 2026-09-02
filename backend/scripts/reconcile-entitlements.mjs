/**
 * Reconciles what the database grants against what Stripe is actually billing.
 *
 *   node scripts/reconcile-entitlements.mjs          # report only
 *   node scripts/reconcile-entitlements.mjs --fix    # repair what it can
 *
 * Needs DATABASE_URL (or DATABASE_PUBLIC_URL) and STRIPE_SECRET_KEY. On
 * Railway the database is only reachable from inside the network on the app
 * service's DATABASE_URL, while the public URL lives on the Postgres service,
 * so from a laptop:
 *
 *   railway run --service Postgres \
 *     env STRIPE_SECRET_KEY=... node scripts/reconcile-entitlements.mjs
 *
 * Read-only without --fix. Exits non-zero while anything is still wrong, so
 * it can be re-run after a repair and believed.
 *
 * The two failures are opposite in kind:
 *   LOCKED OUT   Stripe is billing them, the app says no Pro. They paid and
 *                lost the features. This is the one that must never happen.
 *   SHORT EXPIRY the app ends access before the period Stripe has billed —
 *                how a paid month quietly became three days in Sept 2026.
 *   OVER-GRANTED Pro with nothing billing it. Free software, and with a NULL
 *                expiry it never ends, because isEntitled() grandfathers a
 *                missing date in on purpose.
 *
 * Only SHORT EXPIRY is repaired automatically: extending access to the period
 * the customer already paid for is never the wrong call. Over-granting is
 * reported and left alone — revoking someone's Pro is not a thing a script
 * should decide on its own.
 */
import { Client } from "pg";
import Stripe from "stripe";
import { isEntitled } from "../dist/entitlement.js";

const FIX = process.argv.includes("--fix");
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL or DATABASE_PUBLIC_URL.");
if (!process.env.STRIPE_SECRET_KEY) throw new Error("Set STRIPE_SECRET_KEY.");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const day = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "—");
// A renewal in flight is not drift. Only a shortfall past this is a problem.
const SLACK_MS = 36 * 60 * 60 * 1000;

const periodEnd = (subscription) => {
  const seconds = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
};

async function main() {
  await db.connect();

  const live = [];
  for await (const subscription of stripe.subscriptions.list({ status: "all", limit: 100 })) {
    if (["active", "trialing", "past_due"].includes(subscription.status)) live.push(subscription);
  }

  const { rows: users } = await db.query(
    `SELECT id, email, is_pro, plan, pro_expires_at, stripe_customer_id
       FROM users
      WHERE is_pro = TRUE OR plan IS NOT NULL OR stripe_customer_id IS NOT NULL
      ORDER BY id`,
  );

  const unresolved = [];
  const claimed = new Set();

  console.log(`\n=== PC Tweaker Pro — ${users.length} accounts with a Pro signal ===\n`);
  for (const user of users) {
    const billing = live.find(
      (s) =>
        (s.metadata?.product ?? "pctweaker") === "pctweaker" &&
        (s.metadata?.userId === String(user.id) || s.customer === user.stripe_customer_id),
    );
    if (billing) claimed.add(billing.id);

    const paidUntil = billing ? periodEnd(billing) : null;
    const entitled = isEntitled(user);
    const stored = user.pro_expires_at ? new Date(user.pro_expires_at) : null;

    let problem = null;
    let repair = null;
    if (billing && !entitled) {
      problem = "LOCKED OUT — Stripe is billing them, the app says no Pro";
      repair = paidUntil;
    } else if (billing && user.plan !== "lifetime" && (!stored || stored.getTime() < paidUntil.getTime() - SLACK_MS)) {
      problem = `SHORT EXPIRY — app ends ${day(stored)}, Stripe billed through ${day(paidUntil)}`;
      repair = paidUntil;
    } else if (!billing && entitled && user.plan !== "lifetime") {
      problem = "OVER-GRANTED — Pro with nothing billing it";
    }

    if (problem && repair && FIX) {
      await db.query("UPDATE users SET is_pro = TRUE, pro_expires_at = $2 WHERE id = $1", [user.id, repair]);
      console.log(`  #${user.id} ${user.email}\n      ${problem}\n      FIXED — access now runs to ${day(repair)}`);
    } else if (problem) {
      unresolved.push(`user ${user.id} (${user.email}): ${problem}`);
      console.log(`  #${user.id} ${user.email}\n      ${problem}`);
    } else {
      console.log(
        `  #${String(user.id).padEnd(3)} ${String(user.email).padEnd(32)} ` +
          `plan=${String(user.plan ?? "—").padEnd(9)} until=${day(stored).padEnd(11)} ` +
          `stripe=${day(paidUntil).padEnd(11)} ok`,
      );
    }
  }

  const { rows: ents } = await db.query(
    "SELECT user_id, product, plan, expires_at, stripe_subscription_id FROM entitlements ORDER BY user_id",
  );
  console.log(`\n=== other products — ${ents.length} entitlement rows ===\n`);
  for (const row of ents) {
    const billing = live.find((s) => s.id === row.stripe_subscription_id);
    if (billing) claimed.add(billing.id);
    const paidUntil = billing ? periodEnd(billing) : null;
    const short = billing && (!row.expires_at || new Date(row.expires_at).getTime() < paidUntil.getTime() - SLACK_MS);
    if (short && FIX) {
      await db.query(
        "UPDATE entitlements SET expires_at = $3, updated_at = now() WHERE user_id = $1 AND product = $2",
        [row.user_id, row.product, paidUntil],
      );
      console.log(`  user ${row.user_id} ${row.product}: FIXED — now runs to ${day(paidUntil)}`);
    } else if (short) {
      unresolved.push(`user ${row.user_id} ${row.product}: expiry ${day(row.expires_at)} is short of Stripe's ${day(paidUntil)}`);
      console.log(`  user ${row.user_id} ${row.product}: SHORT EXPIRY (${day(row.expires_at)} vs ${day(paidUntil)})`);
    } else {
      console.log(`  user ${row.user_id} ${row.product} plan=${row.plan ?? "—"} until=${day(row.expires_at)} ok`);
    }
  }
  if (!ents.length) console.log("  (none)");

  // Money arriving with no account attached to it.
  const orphans = live.filter((s) => !claimed.has(s.id));
  console.log(`\n=== live subscriptions: ${live.length}, unclaimed: ${orphans.length} ===\n`);
  for (const subscription of orphans) {
    const customer = await stripe.customers.retrieve(String(subscription.customer));
    const email = customer.deleted ? "(deleted)" : customer.email;
    unresolved.push(`subscription ${subscription.id} (${email}) is billed but matches no account`);
    console.log(`  ${subscription.id} ${email} ${JSON.stringify(subscription.metadata)}`);
  }
  if (!orphans.length) console.log("  (none — every live subscription belongs to an account)");

  console.log("\n=== verdict ===\n");
  if (!unresolved.length) console.log("  Every paying account is entitled, and every expiry matches Stripe.\n");
  else {
    unresolved.forEach((line) => console.log(`  ${line}`));
    console.log(FIX ? "\n  The above need a decision, not a script.\n" : "\n  Re-run with --fix to repair the expiries.\n");
  }

  await db.end();
  process.exit(unresolved.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
