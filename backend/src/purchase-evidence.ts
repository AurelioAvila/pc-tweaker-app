import { createHmac, randomUUID } from "crypto";
import net from "net";
import jwt from "jsonwebtoken";
import type { Request } from "express";
import { getPool } from "./db";
import { fromCloudflare } from "./buyer-country";

/**
 * Evidence for payment disputes (owner decision, 3 Nov 2026; PRIVACY.md
 * "Purchase confirmation and proof of use"):
 * - checkout_consents: the buyer ticked the Terms box on our page before Stripe
 *   (Managed Payments refuses consent_collection/custom_text, so the box is ours);
 * - license_events: dated licence refreshes, the proof that a purchase was used.
 * Both are deleted after 13 months, also for deleted accounts (no foreign key).
 */
export const EVIDENCE_RETENTION_MONTHS = 13;

/** What a ticked box records as terms_version: one value per wording of the box and the
 *  Terms it links, so each evidence row says exactly what was ticked.
 *  - pctweaker "2026-11-01", uninstaller "2026-11-03" (3 Nov 2026): the box with the
 *    immediate-access, withdrawal, refund and renewal sentences; the value was the date of
 *    the linked Terms.
 *  - "2026-11-04" (owner, 4 Nov 2026): one line, "I agree to the Terms and want access now,
 *    ending my 14-day right of withdrawal.", linking the PC Tweaker
 *    Terms of 2026-11-01 or the Uninstaller Terms of 2026-11-03.
 *  - pctweaker "2026-11-04.2" (4 Nov 2026): the same line, linking the PC Tweaker Terms of
 *    2026-11-04, which add the 7-day pass.
 *  - pctweaker "2026-11-06" (6 Nov 2026): the same line, linking the PC Tweaker Terms of
 *    2026-11-06, which add paying with PayPal.
 *  New wording or new linked Terms: a new value here and in the other file (a backend test compares them). */
export const PURCHASE_TERMS_VERSION: Record<string, string> = {
  pctweaker: "2026-11-06",
  uninstaller: "2026-11-04",
};

/** The value before, still accepted for what those Terms already covered (not PayPal)
 *  while pages opened before the site update are about: the row records what was ticked.
 *  Remove once the site sends the new value everywhere. */
export const PREVIOUS_TERMS_VERSION: Record<string, string> = { pctweaker: "2026-11-04.2" };

/** Where an app-started checkout goes first when the box is required. */
export const CONSENT_PAGE = "https://pctweaker.app/checkout/confirm/";

/** The rollout switch (Railway variable). Off: nothing is required and the apps get
 *  Stripe's page directly; a consent the site sends is still recorded. */
export function consentRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CHECKOUT_CONSENT_REQUIRED === "1";
}

/** What the app asked for, carried to the consent page and back. */
export type ConsentIntent = {
  uid: number;
  /** users.token_version when issued: signing out everywhere voids the link. */
  tv: number;
  product: string;
  plan: string;
  /** The app's "Start 3-day trial" / "Subscribe now" choice, when it sent one. */
  trial?: boolean;
  crypto?: boolean;
  paypal?: boolean;
  /** X-Device-Hash of the PC the app runs on (trial once per PC). */
  device?: string;
  /** The account's language, for the page. */
  lang?: string;
};

const INTENT_TTL_SECONDS = 2 * 60 * 60;
// A key of its own: a consent link must never pass requireAuth as a session token.
const intentKey = (secret: string) => createHmac("sha256", secret).update("pctweaker checkout consent intent v1").digest();

export function signConsentIntent(intent: ConsentIntent, secret = process.env.JWT_SECRET): string {
  if (!secret) throw new Error("JWT_SECRET is not configured on the server");
  return jwt.sign(intent, intentKey(secret), { algorithm: "HS256", expiresIn: INTENT_TTL_SECONDS });
}

export function readConsentIntent(token: unknown, secret = process.env.JWT_SECRET): ConsentIntent | null {
  if (!secret || typeof token !== "string" || token.length > 2048) return null;
  try {
    const p = jwt.verify(token, intentKey(secret), { algorithms: ["HS256"] });
    if (typeof p === "string" || !Number.isInteger(p.uid) || !Number.isInteger(p.tv) || typeof p.product !== "string" ||
        typeof p.plan !== "string" || (p.trial !== undefined && typeof p.trial !== "boolean")) return null;
    return {
      uid: p.uid, tv: p.tv, product: p.product, plan: p.plan,
      ...(p.trial !== undefined ? { trial: p.trial } : {}),
      ...(p.crypto === true ? { crypto: true } : {}),
      ...(p.paypal === true ? { paypal: true } : {}),
      ...(typeof p.device === "string" ? { device: p.device } : {}),
      ...(typeof p.lang === "string" ? { lang: p.lang } : {}),
    };
  } catch {
    return null;
  }
}

/** The page URL; the token rides in the fragment, which browsers never send to a server or in a Referer. */
export function consentPageUrl(token: string): string {
  return `${CONSENT_PAGE}#t=${encodeURIComponent(token)}`;
}

/**
 * The buyer's address. api.pctweaker.app is proxied by Cloudflare, so the peer
 * Railway reports (req.ip, client-ip.ts) is a Cloudflare edge; Cloudflare puts
 * the visitor's address in CF-Connecting-IP. That header is believed only when
 * the peer provably is Cloudflare (buyer-country.ts), otherwise the peer is.
 */
export function buyerIp(req: Pick<Request, "ip"> & { get?: Request["get"] }): string | null {
  const peer = req.ip?.replace(/^::ffff:/, "") ?? null;
  const visitor = req.get?.("cf-connecting-ip")?.trim();
  if (visitor && net.isIP(visitor) && fromCloudflare(peer)) return visitor;
  return peer && net.isIP(peer) ? peer : null;
}

/** The browser family only, never the full User-Agent string. */
export function userAgentFamily(ua: unknown): string | null {
  if (typeof ua !== "string" || !ua) return null;
  if (/\bEdgA?\//.test(ua)) return "Edge";
  if (/\bOPR\//.test(ua)) return "Opera";
  if (/\bFirefox\//.test(ua)) return "Firefox";
  if (/\bSamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/\bChrom(e|ium)\//.test(ua)) return "Chrome";
  if (/\bSafari\//.test(ua)) return "Safari";
  return "Other";
}

export async function recordConsent(row: {
  userId: number; product: string; plan: string; termsVersion: string; ip: string | null; userAgentFamily: string | null;
}): Promise<string> {
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO checkout_consents (id, user_id, product, plan, terms_version, ip, user_agent_family)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, row.userId, row.product, row.plan, row.termsVersion, row.ip, row.userAgentFamily],
  );
  return id;
}

/** Stripe's hosted URL carries the session id: /c/pay/cs_live_... */
export function sessionIdFromUrl(url: string | null | undefined): string | null {
  return /\/c\/pay\/(cs_(?:test|live)_[A-Za-z0-9]+)/.exec(url ?? "")?.[1] ?? null;
}

/** Links the consent to the session it opened; best-effort, the row already proves the consent. */
export async function linkConsentSession(consentId: string, sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  await getPool()
    .query("UPDATE checkout_consents SET checkout_session_id = $1 WHERE id = $2 AND checkout_session_id IS NULL", [sessionId, consentId])
    .catch((err) => console.error("could not link the consent to its checkout:", (err as Error).message));
}

/**
 * One dated licence refresh, at most one row per account, product and
 * installation per UTC day. Append-only: nothing updates these rows; only the
 * retention purge deletes them. Country only from Cloudflare (buyer-country.ts
 * requestCountry), never an IP. Never throws: the licence is issued either way.
 */
export async function recordLicenseEvent(userId: number, product: string, installHash: string | null, country: string | null, now = new Date()): Promise<boolean> {
  try {
    const pool = getPool();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const seen = await pool.query(
      `SELECT 1 FROM license_events WHERE user_id = $1 AND product = $2 AND COALESCE(install_hash, '') = $3 AND at >= $4 LIMIT 1`,
      [userId, product, installHash ?? "", day],
    );
    if (seen.rowCount) return false;
    await pool.query("INSERT INTO license_events (user_id, product, install_hash, at, country) VALUES ($1, $2, $3, $4, $5)",
      [userId, product, installHash, now, country]);
    return true;
  } catch {
    return false;
  }
}

/** Daily: both kinds of evidence older than 13 months go (PRIVACY.md). */
export async function purgeOldEvidence(now = new Date()): Promise<void> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - EVIDENCE_RETENTION_MONTHS);
  await getPool().query("DELETE FROM checkout_consents WHERE accepted_at < $1", [cutoff]);
  await getPool().query("DELETE FROM license_events WHERE at < $1", [cutoff]);
}
