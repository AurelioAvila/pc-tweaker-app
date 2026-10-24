import { invoke } from "@tauri-apps/api/core";
import { API_BASE_URL, readToken } from "./lib";

/** What the server shows an inviter: an aggregate state, and details only for a bonus that is
 *  theirs to use. A friend's plan, payment date and payment status are never sent. */
export type ReferralReward = {
  id: string;
  status: "pending" | "active" | "not_eligible";
  months?: 6 | 12;
  /** Set once activated on a PC; null while the bonus is ready to activate. */
  activatedUntil?: string | null;
  /** SHA-256 of the device key the active bonus is bound to. */
  deviceKeyHash?: string | null;
};
export type ReferralStatus = {
  enabled: boolean;
  rewardsPerYear: number;
  invitationDays: number;
  accountId: string;
  code: string | null;
  rewards: ReferralReward[];
  incoming: { claimed: boolean; expiresAt: string; expired: boolean; locked: boolean } | null;
};

/** Carries the server or client reason, so the panel can say it in the user's language. */
export class ReferralRequestError extends Error {
  constructor(
    readonly code: string,
    readonly minutes?: number,
  ) {
    super(code);
  }
}

/** SHA-256 of the bonus issuer key built into this app, or null for a build without one. Sent
 *  with every referral request: the server offers the programme only to a build whose issuer
 *  matches its signer, so a build that could never verify a bonus never sees the programme. */
let issuer: Promise<string | null> | undefined;
export function referralIssuer(): Promise<string | null> {
  issuer ??= invoke<string | null>("referral_issuer").catch(() => null);
  return issuer;
}

export async function referralRequest<T>(route: string, token: string, body?: unknown): Promise<T> {
  if (!token || token !== readToken()) throw new ReferralRequestError("sign_in_again");
  const issuerHash = await referralIssuer();
  const response = await fetch(`${API_BASE_URL}/api/referrals${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(issuerHash ? { "X-PCT-Referral-Issuer": issuerHash } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (token !== readToken()) throw new ReferralRequestError("session_changed");
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new ReferralRequestError(
      response.status === 429 ? "rate_limited" : (data?.code ?? "generic"),
    );
  }
  return response.json() as Promise<T>;
}

/** The inviter status, or null when the programme cannot be used: a backend without the
 *  referral routes (404), an unreachable server, an error or a malformed answer all mean
 *  "programme off" — no menu entry, no toast and no retry beyond the normal account refresh. */
export async function readReferralStatus(token: string): Promise<ReferralStatus | null> {
  try {
    const data = await referralRequest<Partial<ReferralStatus> | null>("/status", token);
    return data && typeof data.enabled === "boolean" && Array.isArray(data.rewards)
      ? (data as ReferralStatus)
      : null;
  } catch {
    return null;
  }
}

/** The native check (referral.rs) accepts a grant from a PC clock at most one lease (10 min)
 *  ahead of the server, or up to a day behind. Checking first, with margin, means activation
 *  never starts on a PC that would then refuse its own bonus. */
const CLOCK_AHEAD_LIMIT_S = 5 * 60;
const CLOCK_BEHIND_LIMIT_S = 23 * 60 * 60;
export function clockProblem(serverTime: number, localMs = Date.now()) {
  const skew = Math.floor(localMs / 1000) - serverTime;
  if (skew > CLOCK_AHEAD_LIMIT_S)
    return new ReferralRequestError("clock_ahead", Math.ceil(skew / 60));
  if (-skew > CLOCK_BEHIND_LIMIT_S) return new ReferralRequestError("clock_behind");
  return null;
}

/** The server signs; the native layer verifies the issuer, device, account and session. */
export async function activateOrRefreshBonus(
  status: ReferralStatus,
  rewardId: string,
  purpose: "activate" | "license",
  token: string,
): Promise<boolean> {
  if (token !== readToken()) throw new ReferralRequestError("session_changed");
  // A build without a valid issuer could never verify the grant: stop before any server state
  // changes (the server refuses such builds too).
  if (!(await referralIssuer())) throw new ReferralRequestError("update_required");
  await invoke("referral_session", { userId: status.accountId, token });
  const device = await invoke<{ publicKey: string }>("referral_device");
  const challenge = await referralRequest<{ id: string; payload: string; serverTime: number }>(
    "/device/challenge",
    token,
    { rewardId, purpose, publicKey: device.publicKey },
  );
  const clock = clockProblem(challenge.serverTime);
  if (clock) throw clock;
  const signature = await invoke<string>("referral_proof", { payload: challenge.payload });
  const response = await referralRequest<{ payloadJson: string; signature: string }>(
    "/device/proof",
    token,
    { challengeId: challenge.id, signature },
  );
  // From here the server has accepted the proof (an activation has started the bonus):
  // a later problem must not be reported as if nothing happened.
  if (token !== readToken()) throw new ReferralRequestError("session_changed");
  try {
    await invoke("save_referral_license", { response });
  } catch {
    throw new ReferralRequestError("not_verified");
  }
  if (token !== readToken()) {
    await invoke("clear_referral_license");
    throw new ReferralRequestError("session_changed");
  }
  return invoke<boolean>("referral_license_status", { token });
}

/** The server refused to refresh this PC's bonus because it was revoked, put on hold for review
 *  or has ended: its local lease is dropped at once instead of running out. */
export function bonusWithdrawn(error: unknown): boolean {
  return (
    error instanceof ReferralRequestError &&
    (error.code === "bonus_unavailable" || error.code === "bonus_expired")
  );
}

/** The active bonus bound to this PC's device key, if any. Bonuses bound to other PCs are not
 *  tried, so each refresh is one challenge and one proof. */
export async function bonusForThisPc(rewards: ReferralReward[], now = Date.now()) {
  const active = rewards.filter(
    (reward) =>
      reward.status === "active" &&
      reward.activatedUntil &&
      new Date(reward.activatedUntil).getTime() > now,
  );
  if (!active.length) return null;
  const device = await invoke<{ keyHash: string }>("referral_device");
  return active.find((reward) => reward.deviceKeyHash === device.keyHash) ?? null;
}
