import { useEffect, useRef, useState } from "react";
import { readToken } from "../lib";
import { referralRequest, activateOrRefreshBonus, type ReferralStatus } from "../referrals";
import "./referrals.css";

export function ReferralPanel({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [giftId, setGiftId] = useState<string | null>(null);
  const [giftCode, setGiftCode] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const token = readToken();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    if (token)
      referralRequest<ReferralStatus>("/status", token)
        .then((data) => {
          if (alive) setStatus(data);
        })
        .catch(() => {
          if (alive)
            setMessage("Invitations are unavailable. Verify your email and try again later.");
        });
    return () => {
      alive = false;
    };
  }, [token]);
  async function action(work: (token: string) => Promise<void>) {
    if (busy || !token) return;
    setBusy(true);
    setMessage("");
    try {
      await work(token);
      setStatus(await referralRequest<ReferralStatus>("/status", token));
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again later.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="referral-dialog"
      aria-labelledby="referral-title"
      lang="en"
      onCancel={onClose}
    >
      <div className="referral-top">
        <span>PC TWEAKER · INVITATIONS</span>
        <button type="button" onClick={onClose} aria-label="Close invitations">
          ✕
        </button>
      </div>
      <header>
        <p className="referral-eyebrow">BETTER TOGETHER</p>
        <h2 id="referral-title">
          Share something useful.
          <br />
          <em>Get more Pro time.</em>
        </h2>
        <p>
          Your friend saves an extra 10% on their first eligible payment. You earn a separate Pro
          bonus for one PC after their purchase is verified.
        </p>
      </header>
      {!status ? (
        <p role="status">{message || "Loading your invitations…"}</p>
      ) : !status.enabled ? (
        <div className="referral-notice">
          <strong>Invitations are not open yet.</strong>
          <p>Your existing plan is unchanged. This programme will appear here when it is ready.</p>
        </div>
      ) : (
        <>
          <div className="referral-benefits">
            <div>
              <span>MONTHLY PURCHASE</span>
              <strong>6 months</strong>
              <p>Pro for one PC</p>
            </div>
            <div>
              <span>ANNUAL PURCHASE</span>
              <strong>12 months</strong>
              <p>Pro for one PC</p>
            </div>
          </div>
          <section aria-labelledby="referral-link-title">
            <h3 id="referral-link-title">Your invitation link</h3>
            <p>
              Share it with someone who could use PC Tweaker. They must confirm the invitation in
              the app before paying.
            </p>
            {status.code ? (
              <div className="referral-link">
                <input
                  aria-label="Your invitation link"
                  readOnly
                  value={`https://pctweaker.app/invite/?ref=${status.code}`}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await navigator.clipboard.writeText(
                        `https://pctweaker.app/invite/?ref=${status.code}`,
                      );
                      setMessage("Invitation link copied.");
                    })
                  }
                >
                  Copy link
                </button>
              </div>
            ) : (
              <button
                className="referral-primary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(async (value) => {
                    await referralRequest("/code", value, {});
                  })
                }
              >
                Create your invitation link
              </button>
            )}
          </section>
          <section aria-labelledby="referral-rewards-title">
            <h3 id="referral-rewards-title">Your Pro bonuses</h3>
            <p>
              Each bonus covers one PC. Activation starts its duration; it does not create a paid
              subscription.
            </p>
            <p>
              Already own Lifetime? Gift each ready, unused bonus to another verified account
              instead.
            </p>
            {!status.rewards.length ? (
              <div className="referral-empty">
                <strong>Your first bonus starts with a genuine recommendation.</strong>
                <p>
                  When a friend completes an eligible purchase, its verification status will appear
                  here.
                </p>
              </div>
            ) : (
              <ul className="referral-rewards">
                {status.rewards.map((reward) => (
                  <li key={reward.id}>
                    <div>
                      <strong>{reward.months} months of Pro</strong>
                      <span>
                        {reward.gift?.role === "sender" && reward.gift.state === "claimed"
                          ? `Gift redeemed · ${reward.state === "revoked" ? "revoked" : reward.state === "hold" ? "awaiting review" : "belongs to its recipient"}`
                          : reward.gift?.state === "active" && reward.state === "ready"
                            ? "Gift reserved · awaiting your recipient"
                            : reward.state === "pending"
                              ? `Verifying · eligible from ${new Date(reward.eligible_at).toLocaleDateString()}`
                              : reward.state === "active"
                                ? `Active · until ${new Date(reward.expires_at!).toLocaleDateString()}`
                                : reward.state === "hold"
                                  ? "Awaiting review"
                                  : reward.state === "ready"
                                    ? "Ready to activate on one PC"
                                    : "Revoked"}
                      </span>
                    </div>
                    {reward.state === "ready" &&
                      !reward.canGift &&
                      !(reward.gift?.role === "sender") && (
                        <button
                          className="referral-primary"
                          disabled={busy}
                          onClick={() => setConfirmId(reward.id)}
                        >
                          Activate on this PC
                        </button>
                      )}
                    {reward.canGift && (
                      <button
                        className="referral-primary"
                        disabled={busy}
                        onClick={() => {
                          setGiftId(reward.id);
                          setConfirmId(null);
                        }}
                      >
                        Gift this bonus
                      </button>
                    )}
                    {giftId === reward.id && reward.canGift && (
                      <GiftForm
                        months={reward.months}
                        busy={busy}
                        onCancel={() => setGiftId(null)}
                        onSubmit={(email) =>
                          void action(async (value) => {
                            await referralRequest(`/rewards/${reward.id}/gift`, value, {
                              recipientEmail: email,
                            });
                            setGiftId(null);
                            setMessage(
                              "Gift reserved. Copy its private link and share it with your recipient.",
                            );
                          })
                        }
                      />
                    )}
                    {reward.gift?.role === "sender" && reward.gift.state === "active" && (
                      <div className="referral-confirmation">
                        <strong>A private gift, for one verified email.</strong>
                        <p>
                          The recipient must sign in with the email you entered. Their timer starts
                          only when they activate it on one PC. You can cancel before redemption; a
                          redeemed gift cannot be transferred again.
                        </p>
                        {reward.gift.code && reward.state === "ready" && (
                          <div className="referral-link">
                            <input
                              readOnly
                              aria-label="Private gift link"
                              value={`https://pctweaker.app/gift/#claim=${reward.gift.code}`}
                            />
                            <button
                              disabled={busy}
                              onClick={() =>
                                void action(async () => {
                                  await navigator.clipboard.writeText(
                                    `https://pctweaker.app/gift/#claim=${reward.gift!.code}`,
                                  );
                                  setMessage("Private gift link copied.");
                                })
                              }
                            >
                              Copy gift link
                            </button>
                          </div>
                        )}
                        <button
                          className="referral-cancel"
                          disabled={busy}
                          onClick={() =>
                            void action(async (value) => {
                              await referralRequest(`/rewards/${reward.id}/gift/cancel`, value, {});
                              setMessage("Unclaimed gift cancelled. Its old link no longer works.");
                            })
                          }
                        >
                          Cancel unclaimed gift
                        </button>
                      </div>
                    )}
                    {confirmId === reward.id &&
                      reward.state === "ready" &&
                      !reward.canGift &&
                      !(reward.gift?.role === "sender") && (
                        <div
                          className="referral-confirmation"
                          role="group"
                          aria-label="Confirm bonus activation"
                        >
                          <strong>Start your {reward.months}-month bonus on this PC?</strong>
                          <p>
                            The timer starts now. The bonus is personal and cannot be moved to
                            another PC automatically. If you already have paid Pro, both periods run
                            alongside each other; leave this bonus ready until you need it.
                          </p>
                          <div>
                            <button
                              className="referral-primary"
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void action(async (value) => {
                                  if (
                                    !(await activateOrRefreshBonus(
                                      status,
                                      reward.id,
                                      "activate",
                                      value,
                                    ))
                                  )
                                    throw new Error("The bonus could not be verified on this PC.");
                                  setConfirmId(null);
                                  setMessage("Bonus activated on this PC.");
                                })
                              }
                            >
                              Confirm activation
                            </button>
                            <button
                              className="referral-cancel"
                              type="button"
                              disabled={busy}
                              onClick={(event) => {
                                setConfirmId(null);
                                event.currentTarget
                                  .closest("li")
                                  ?.querySelector<HTMLButtonElement>("button")
                                  ?.focus();
                              }}
                            >
                              Keep it for later
                            </button>
                          </div>
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="referral-claim-title">
            <h3 id="referral-claim-title">Have an invitation?</h3>
            {status.incoming ? (
              <p>
                Your invitation is confirmed
                {status.incoming.locked
                  ? " and locked to its checkout"
                  : " for your first eligible paid purchase"}
                . Confirm the discount on the payment page before paying.
              </p>
            ) : (
              <form
                className="referral-link"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(async (value) => {
                    await referralRequest("/claim", value, { code: code.trim() });
                    setMessage("Invitation confirmed. Check the final price before paying.");
                  });
                }}
              >
                <input
                  aria-label="Invitation code"
                  placeholder="Paste your invitation code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={22}
                  autoComplete="off"
                  required
                  pattern="[A-Za-z0-9_-]{22}"
                />
                <button type="submit" disabled={busy}>
                  Confirm invitation
                </button>
              </form>
            )}
          </section>
          <section aria-labelledby="referral-gift-title">
            <h3 id="referral-gift-title">Received a Pro gift?</h3>
            <p>
              Sign in with the verified email specified by the sender. Redeeming saves the bonus to
              your account; activation starts its timer. No payment is required.
            </p>
            <form
              className="referral-link"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async (value) => {
                  await referralRequest("/gifts/claim", value, { code: giftCode.trim() });
                  setGiftCode("");
                  setMessage("Gift redeemed. Check its status below before activation.");
                });
              }}
            >
              <input
                aria-label="Gift code"
                placeholder="Paste your private gift code"
                value={giftCode}
                onChange={(event) => setGiftCode(event.target.value)}
                maxLength={43}
                minLength={43}
                pattern="[A-Za-z0-9_-]{43}"
                autoComplete="off"
                required
              />
              <button type="submit" disabled={busy}>
                Redeem gift
              </button>
            </form>
          </section>
          <details className="referral-terms">
            <summary>How eligibility and verification work</summary>
            <p>
              The extra 10% applies to the first eligible positive Stripe payment, after any
              supported offer. Renewals use the ordinary plan terms. Free trials cannot be combined
              with this invitation.
            </p>
            <p>
              A monthly purchase earns 6 months; annual and Lifetime purchases earn 12 months. Each
              reward is limited to one PC. Lifetime owners can gift an unused, verified bonus once
              to another account. The recipient must verify the specified email and cannot gift it
              again. No Lifetime bonus is issued. A refund or dispute can also revoke a gifted
              bonus.
            </p>
            <p>
              Rewards normally wait at least 30 days for payment verification. This is an
              operational hold, not a refund or dispute deadline. Refunds, disputes, repeated payer
              details and self-referrals can hold or revoke a reward. Unclear cases require review.
            </p>
            <p>
              Active bonuses require an internet check at least every 10 minutes. Downloading alone
              does not qualify. Microsoft Store downloads do not automatically transfer the
              invitation: confirm the code here before a supported purchase.
            </p>
          </details>
        </>
      )}
      <p className="referral-feedback" role="status" aria-live="polite">
        {message}
      </p>
    </dialog>
  );
}

function GiftForm({
  months,
  busy,
  onCancel,
  onSubmit,
}: {
  months: number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="referral-confirmation referral-gift-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (email.trim().toLowerCase() !== confirmation.trim().toLowerCase()) {
          setError("The email addresses must match.");
          return;
        }
        setError("");
        onSubmit(email.trim());
      }}
    >
      <strong>Your Lifetime stays yours. Share {months} months of Pro.</strong>
      <p>
        One recipient, one PC. The gift is bound to this verified email. Check it carefully: you can
        cancel before redemption, but cannot take back or transfer a redeemed gift. No email is sent
        automatically.
      </p>
      <label>
        Recipient email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          autoComplete="off"
          required
          autoFocus
        />
      </label>
      <label>
        Confirm recipient email
        <input
          type="email"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          maxLength={254}
          autoComplete="off"
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div>
        <button className="referral-primary" type="submit" disabled={busy}>
          Reserve gift for this email
        </button>
        <button className="referral-cancel" type="button" disabled={busy} onClick={onCancel}>
          Keep it for later
        </button>
      </div>
    </form>
  );
}
