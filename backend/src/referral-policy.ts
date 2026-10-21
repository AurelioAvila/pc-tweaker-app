import { createHash, createPublicKey, randomInt, verify } from "crypto";
import { referralSignerReady } from "./referral-license";

export const REFERRAL_VERSION = "2026-10-20-v1";
export const REFERRAL_PLAN = "referral_bonus";
export const REFERRAL_MONTHS = { monthly: 6, annual: 12, lifetime: 12 } as const;
export type ReferralPlan = keyof typeof REFERRAL_MONTHS;
export const HOLD_MS = 30 * 24 * 60 * 60 * 1000;
export const CHALLENGE_MS = 5 * 60 * 1000;
const INVITATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_PATTERN =
  /^(?:(?=[A-Z2-9]{0,9}[A-Z])(?=[A-Z2-9]{0,9}[2-9])[A-HJ-NP-Z2-9]{10}|[A-Za-z0-9_-]{22})$/;

export function normalizeInvitationCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  if (code.length === 10 && !/^[A-Za-z2-9]{10}$/.test(code)) return null;
  // Existing invitation links remain case-sensitive; new short codes ignore case.
  const normalized = code.length === 10 ? code.toUpperCase() : code;
  return CODE_PATTERN.test(normalized) ? normalized : null;
}

export function createInvitationCode(): string {
  for (;;) {
    const code = Array.from(
      { length: 10 },
      () => INVITATION_ALPHABET[randomInt(INVITATION_ALPHABET.length)],
    ).join("");
    if (/[A-Z]/.test(code) && /[2-9]/.test(code)) return code;
  }
}
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Disabled unless the entire policy and the production adapters are ready. */
export function referralsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.REFERRALS_ENABLED === "true" &&
    env.REFERRALS_POLICY_VERSION === REFERRAL_VERSION &&
    ["direct", "managed"].includes(env.REFERRALS_CHECKOUT_MODEL ?? "") &&
    /^[a-f0-9]{64}$/i.test(env.REFERRALS_HASH_KEY ?? "") &&
    referralSignerReady(env) &&
    /^acct_[A-Za-z0-9]+$/.test(env.REFERRALS_STRIPE_ACCOUNT ?? "")
  );
}

export function isReferralPlan(value: unknown): value is ReferralPlan {
  return typeof value === "string" && Object.hasOwn(REFERRAL_MONTHS, value);
}

export function referralQuote(base: number, offer: number, currency: string) {
  if (
    !Number.isSafeInteger(base) ||
    !Number.isSafeInteger(offer) ||
    offer <= 0 ||
    offer > base ||
    base > 100_000_000 ||
    currency !== "eur"
  )
    throw new Error("Unsupported referral price");
  const referralSaving = Math.round(offer / 10);
  if (referralSaving <= 0 || offer - referralSaving < 50)
    throw new Error("Referral price is too small");
  return {
    base,
    offer,
    referralSaving,
    totalDiscount: base - offer + referralSaving,
    subtotal: offer - referralSaving,
    currency,
  };
}

/** Calendar months, clamped at month end; activation on 31 August is not 3 March. */
export function addCalendarMonths(date: Date, months: number): Date {
  if (![6, 12].includes(months) || !Number.isFinite(date.getTime()))
    throw new Error("Invalid bonus duration");
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

export function deviceKey(publicKey: unknown): { publicKey: string; hash: string } {
  if (typeof publicKey !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(publicKey))
    throw new Error("Invalid device key");
  const bytes = Buffer.from(publicKey, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== publicKey)
    throw new Error("Invalid device key");
  return { publicKey, hash: createHash("sha256").update(bytes).digest("hex") };
}

export function challengePayload(
  userId: number,
  purpose: "activate" | "license",
  grantId: string,
  challengeId: string,
  nonce: string,
  keyHash: string,
): string {
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !UUID_PATTERN.test(grantId) ||
    !UUID_PATTERN.test(challengeId) ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
    !/^[a-f0-9]{64}$/.test(keyHash)
  ) {
    throw new Error("Invalid device challenge");
  }
  return ["pctweaker:referral:v1", userId, purpose, grantId, challengeId, nonce, keyHash].join(
    "\n",
  );
}

export function verifyDeviceProof(publicKey: string, payload: string, signature: unknown): boolean {
  if (typeof signature !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
  try {
    const key = deviceKey(publicKey);
    const spki = Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(key.publicKey, "base64"),
    ]);
    return verify(
      null,
      Buffer.from(payload),
      createPublicKey({ key: spki, format: "der", type: "spki" }),
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}
