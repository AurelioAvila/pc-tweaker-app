import { useEffect, useRef, useState } from "react";
import { format, localeOf, type Lang } from "../i18n";
import { readToken } from "../lib";
import {
  referralRequest,
  activateOrRefreshBonus,
  ReferralRequestError,
  type ReferralStatus,
} from "../referrals";
import { normalizeInvitationCode } from "../referral-code";
import { REFERRAL_COPY } from "./referral-copy";
import "./referrals.css";

const SUPPORT_EMAIL = "support@pctweaker.app";
type Copy = (typeof REFERRAL_COPY)["en"];

const ERRORS: Record<string, keyof Copy["errors"]> = {
  verify_email_first: "verifyEmail",
  referral_unavailable: "unavailable",
  invitation_not_eligible: "notEligible",
  invitation_already_bound: "alreadyBound",
  invalid_invitation: "invalidCode",
  bonus_unavailable: "bonusUnavailable",
  bonus_expired: "bonusExpired",
  clock_ahead: "clockAhead",
  clock_behind: "clockBehind",
  session_changed: "sessionChanged",
  sign_in_again: "signInAgain",
  rate_limited: "rateLimited",
  not_verified: "notVerified",
};
export function referralErrorText(t: Copy, error: unknown) {
  const code = error instanceof ReferralRequestError ? error.code : "";
  const key = Object.prototype.hasOwnProperty.call(ERRORS, code) ? ERRORS[code] : "generic";
  return format(t.errors[key], {
    minutes: error instanceof ReferralRequestError ? (error.minutes ?? 0) : 0,
  });
}

export function ReferralPanel({
  lang,
  lifetime,
  onClose,
  onChanged,
}: {
  lang: Lang;
  /** The account owns Lifetime: it can still invite, but earns no bonus. */
  lifetime: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = REFERRAL_COPY[lang];
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<"invite" | "bonuses" | "redeem">("invite");
  const dialog = useRef<HTMLDialogElement>(null);
  const token = readToken();
  const date = (value: string) => new Date(value).toLocaleDateString(localeOf(lang));
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
          if (alive) setMessage(t.loadFailed);
        });
    return () => {
      alive = false;
    };
  }, [token, t]);
  /** Server-side changes only: reloads the status and the app's bonus state afterwards. */
  async function action(work: (token: string) => Promise<void>) {
    if (busy || !token) return;
    setBusy(true);
    setMessage("");
    try {
      await work(token);
      setStatus(await referralRequest<ReferralStatus>("/status", token));
      onChanged();
    } catch (error) {
      setMessage(referralErrorText(t, error));
    } finally {
      setBusy(false);
    }
  }
  /** Copying changes nothing on the server, so it neither reloads nor refreshes the bonus. */
  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(done);
    } catch {
      setMessage(t.copyFailed);
    }
  }
  const cap = status?.rewardsPerYear ?? 6;
  return (
    <dialog
      ref={dialog}
      className="referral-dialog"
      aria-labelledby="referral-title"
      onCancel={onClose}
    >
      <div className="referral-top">
        <span>{t.eyebrow}</span>
        <button type="button" onClick={onClose} aria-label={t.close}>
          ✕
        </button>
      </div>
      <header>
        <h2 id="referral-title">{t.title}</h2>
        <p>{t.intro}</p>
      </header>
      {!status ? (
        !message && <p>{t.loading}</p>
      ) : !status.enabled ? (
        <div className="referral-notice">
          <strong>{t.closedTitle}</strong>
          <p>{t.closedBody}</p>
        </div>
      ) : (
        <>
          <div className="referral-tabs" role="tablist" aria-label={t.tabsLabel}>
            {(
              [
                ["invite", t.tabInvite],
                ["bonuses", t.tabBonuses],
                ["redeem", t.tabRedeem],
              ] as const
            ).map(([id, label], index, tabs) => (
              <button
                key={id}
                id={`referral-tab-${id}`}
                role="tab"
                type="button"
                aria-selected={view === id}
                aria-controls={`referral-panel-${id}`}
                tabIndex={view === id ? 0 : -1}
                onClick={() => setView(id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : null;
                  if (next === null) return;
                  event.preventDefault();
                  setView(tabs[next][0]);
                  document.getElementById(`referral-tab-${tabs[next][0]}`)?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            id="referral-panel-invite"
            role="tabpanel"
            aria-labelledby="referral-tab-invite"
            hidden={view !== "invite"}
          >
            <div className="referral-benefits">
              {(
                [
                  [t.perkMonthly, 6],
                  [t.perkAnnual, 12],
                  [t.perkLifetime, 12],
                ] as const
              ).map(([label, months]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{format(t.perkMonths, { months })}</strong>
                  <p>{t.perkScope}</p>
                </div>
              ))}
            </div>
            {lifetime && <p className="referral-code-help">{t.lifetimeInviter}</p>}
            <section aria-labelledby="referral-link-title">
              <h3 id="referral-link-title">{t.codeTitle}</h3>
              {status.code ? (
                <>
                  <div className="referral-code-row">
                    <output className="referral-short-code" aria-label={t.codeTitle}>
                      {status.code}
                    </output>
                    <button
                      className="referral-primary"
                      type="button"
                      onClick={() => void copy(status.code!, t.codeCopied)}
                    >
                      {t.copyCode}
                    </button>
                  </div>
                  <div className="referral-link-shortcut">
                    <button
                      className="referral-cancel"
                      type="button"
                      onClick={() =>
                        void copy(`https://pctweaker.app/invite/?ref=${status.code}`, t.linkCopied)
                      }
                    >
                      {t.copyLink}
                    </button>
                  </div>
                  <p className="referral-code-help">{t.codeHelp}</p>
                </>
              ) : (
                <button
                  className="referral-primary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(async (value) => {
                      await referralRequest("/code", value, {});
                      setMessage(t.codeReady);
                    })
                  }
                >
                  {t.generate}
                </button>
              )}
            </section>
          </div>
          <section
            id="referral-panel-bonuses"
            role="tabpanel"
            aria-labelledby="referral-tab-bonuses"
            hidden={view !== "bonuses"}
          >
            <h3 id="referral-rewards-title">{t.bonusesTitle}</h3>
            <p>{t.bonusesBody}</p>
            <p>{format(t.bonusesLimits, { cap })}</p>
            {!status.rewards.length ? (
              <div className="referral-empty">
                <strong>{t.emptyTitle}</strong>
                <p>{t.emptyBody}</p>
              </div>
            ) : (
              <ul className="referral-rewards">
                {status.rewards.map((reward) => {
                  const ready = reward.status === "active" && !reward.activatedUntil;
                  return (
                    <li key={reward.id}>
                      <div>
                        <strong>
                          {reward.status === "active"
                            ? format(t.rewardMonths, { months: reward.months ?? 0 })
                            : t.rewardTitle}
                        </strong>
                        <span>
                          {reward.status === "pending"
                            ? t.statusPending
                            : reward.status === "not_eligible"
                              ? t.statusNotEligible
                              : reward.activatedUntil
                                ? format(t.statusActive, { date: date(reward.activatedUntil) })
                                : t.statusReady}
                        </span>
                      </div>
                      {ready && (
                        <button
                          className="referral-primary"
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmId(reward.id)}
                        >
                          {t.activate}
                        </button>
                      )}
                      {ready && confirmId === reward.id && (
                        <div
                          className="referral-confirmation"
                          role="group"
                          aria-label={t.confirmLabel}
                        >
                          <strong>{format(t.confirmTitle, { months: reward.months ?? 0 })}</strong>
                          <p>{t.confirmBody}</p>
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
                                    throw new ReferralRequestError("not_verified");
                                  setConfirmId(null);
                                  setMessage(t.activated);
                                })
                              }
                            >
                              {t.confirmActivate}
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
                              {t.keepForLater}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {status.rewards.some((reward) => reward.status === "pending") && (
              <p className="referral-code-help">
                {format(t.pendingHelp, { email: SUPPORT_EMAIL })}
              </p>
            )}
          </section>
          <div
            id="referral-panel-redeem"
            role="tabpanel"
            aria-labelledby="referral-tab-redeem"
            hidden={view !== "redeem"}
          >
            <section aria-labelledby="referral-claim-title">
              <h3 id="referral-claim-title">{t.claimTitle}</h3>
              {status.incoming?.expired ? (
                <div className="referral-notice">
                  <strong>{t.expiredTitle}</strong>
                  <p>{t.expiredBody}</p>
                </div>
              ) : status.incoming ? (
                <p>{status.incoming.locked ? t.confirmedLocked : t.confirmedOpen}</p>
              ) : (
                <>
                  <p id="referral-claim-warning" className="referral-code-help">
                    {format(t.claimWarning, { days: status.invitationDays ?? 30 })}
                  </p>
                  <form
                    className="referral-link"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void action(async (value) => {
                        const normalized = normalizeInvitationCode(code);
                        if (!normalized) throw new ReferralRequestError("invalid_invitation");
                        await referralRequest("/claim", value, { code: normalized });
                        setMessage(t.claimed);
                      });
                    }}
                  >
                    <input
                      aria-label={t.codeLabel}
                      aria-describedby="referral-claim-warning"
                      placeholder="K7M4P9R2X6"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      maxLength={32}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      required
                    />
                    <button type="submit" disabled={busy}>
                      {t.claimButton}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
          <details className="referral-terms">
            <summary>{t.rulesTitle}</summary>
            <p>{t.rulesDiscount}</p>
            <p>{format(t.rulesBonus, { cap })}</p>
            <p>{t.rulesVerification}</p>
            <p>{t.rulesDevice}</p>
          </details>
        </>
      )}
      {/* Always present (and empty when idle) so screen readers announce later messages. */}
      <p className="referral-feedback" role="status" aria-live="polite">
        {message}
      </p>
    </dialog>
  );
}
