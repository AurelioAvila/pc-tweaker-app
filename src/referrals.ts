import { invoke } from "@tauri-apps/api/core";
import { API_BASE_URL, readToken } from "./lib";

export type ReferralReward = {
  id: string;
  months: 6 | 12;
  state: "pending" | "ready" | "active" | "hold" | "revoked";
  eligible_at: string;
  activated_at: string | null;
  expires_at: string | null;
  reason: string | null;
  canGift: boolean;
  gift: { state: "active" | "claimed"; role: "sender" | "recipient"; code?: string } | null;
};
export type ReferralStatus = {
  enabled: boolean;
  accountId: string;
  code: string | null;
  rewards: ReferralReward[];
  incoming: { claimed: boolean; expiresAt: string; locked: boolean } | null;
};

const messages: Record<string, string> = {
  verify_email_first: "Verify your email before using invitations.",
  referral_unavailable: "The referral programme is not available yet.",
  invitation_not_eligible: "This invitation is not eligible for this account.",
  invitation_already_bound: "This account already has a different invitation.",
  invalid_invitation: "Check the invitation code and try again.",
  bonus_unavailable:
    "This bonus is not available on this PC. Refresh its status before trying again.",
  payment_check_required: "A fresh payment check is required. Please try again.",
  gift_unavailable:
    "This gift cannot be redeemed here. Use the verified email specified by its sender, or ask them to check its status.",
  invalid_gift_email: "Enter a valid recipient email address.",
  gift_already_sent: "Cancel the current unclaimed gift before choosing another recipient.",
  choose_paid_plan_for_referral:
    "Choose a paid plan to use this invitation; it cannot be combined with a free trial.",
};
export async function referralRequest<T>(route: string, token: string, body?: unknown): Promise<T> {
  if (!token || token !== readToken()) throw new Error("Please sign in again.");
  const response = await fetch(`${API_BASE_URL}/api/referrals${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (token !== readToken()) throw new Error("Your account session changed. Please try again.");
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new Error(
      messages[data?.code ?? ""] ??
        (response.status === 429
          ? "Please wait before trying again."
          : "The referral request could not be completed. Your paid plan is unchanged."),
    );
  }
  return response.json() as Promise<T>;
}

/** The server signs; the native layer verifies the issuer, device, account and session. */
export async function activateOrRefreshBonus(
  status: ReferralStatus,
  rewardId: string,
  purpose: "activate" | "license",
  token: string,
): Promise<boolean> {
  if (token !== readToken()) return false;
  await invoke("referral_session", { userId: status.accountId, token });
  const device = await invoke<{ publicKey: string }>("referral_device");
  const challenge = await referralRequest<{ id: string; payload: string }>(
    "/device/challenge",
    token,
    {
      rewardId,
      purpose,
      publicKey: device.publicKey,
    },
  );
  const signature = await invoke<string>("referral_proof", { payload: challenge.payload });
  const response = await referralRequest<{ payloadJson: string; signature: string }>(
    "/device/proof",
    token,
    {
      challengeId: challenge.id,
      signature,
    },
  );
  if (token !== readToken()) return false;
  await invoke("save_referral_license", { response });
  if (token !== readToken()) {
    await invoke("clear_referral_license");
    return false;
  }
  return invoke<boolean>("referral_license_status", { token });
}
