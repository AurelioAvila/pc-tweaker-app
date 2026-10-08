/**
 * Creates a licence code that grants PC Tweaker Pro for a fixed number of
 * months to every verified account that redeems it inside its window.
 *
 *   railway run --service Postgres node scripts/create-licence-code.mjs \
 *     --label "Giveaway of the Day" --months 6 --max 1000 \
 *     --starts 2026-10-22T00:00:00Z --ends 2026-10-23T12:00:00Z
 *
 * Prints the code, grouped for display (PCT-XXXX-XXXX-XXXX). Pass --code to
 * choose it instead. The window is checked by the server on every redemption,
 * so a code that leaks after the giveaway simply stops working.
 */
import { randomInt } from "node:crypto";
import pg from "pg";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const months = Number(args.months);
const starts = new Date(args.starts);
const ends = new Date(args.ends);
const max = args.max === undefined ? null : Number(args.max);
if (!args.label || !Number.isInteger(months) || months < 1 || months > 24 || Number.isNaN(starts.getTime()) || !(ends > starts)
    || (max !== null && (!Number.isInteger(max) || max < 1))) {
  console.error('Usage: --label "..." --months 1-24 --starts <ISO> --ends <ISO> [--max 1000] [--code ABCD1234]');
  process.exit(2);
}
// No 0/O or 1/I: the code is read off a web page and typed by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = (args.code ?? "PCT" + Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""))
  .toUpperCase()
  .replace(/[\s-]+/g, "");
if (!/^[A-Z0-9]{6,32}$/.test(code)) {
  console.error("A code is 6-32 letters and digits.");
  process.exit(2);
}

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: url, ssl: url?.includes("localhost") ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(
    "INSERT INTO licence_codes (code, label, months, max_redemptions, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [code, args.label, months, max, starts, ends],
  );
} finally {
  await client.end();
}
const shown = code.startsWith("PCT") ? "PCT-" + code.slice(3).match(/.{1,4}/g).join("-") : code.match(/.{1,4}/g).join("-");
console.log(`Created ${shown}: ${months} months of Pro, ${max ?? "unlimited"} activations, redeemable ${starts.toISOString()} to ${ends.toISOString()} (${args.label}).`);
