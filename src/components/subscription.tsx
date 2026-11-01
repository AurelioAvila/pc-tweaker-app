import { useCallback, useEffect, useRef, useState } from "react";
import { format, localeOf, type Lang } from "../i18n";
import { API_BASE_URL, readToken } from "../lib";
import { CANCEL_REASONS, SUBSCRIPTION_COPY, type CancelReason } from "./subscription-copy";
import "./subscription.css";

/** One product's subscription, as GET /api/billing/subscription returns it. */
export type Subscription = {
  product: Product;
  plan: string | null;
  interval: "month" | "year" | null;
  amount: number | null;
  currency: string | null;
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  payment_method: { brand: string; last4: string } | null;
  lifetime: boolean;
  can_cancel: boolean;
  can_resume: boolean;
};
type Product = "pctweaker" | "uninstaller" | "tweaky";
const PRODUCTS: Product[] = ["pctweaker", "uninstaller", "tweaky"];
const NAMES: Record<Product, string> = {
  pctweaker: "PC Tweaker",
  uninstaller: "PC Tweaker Uninstaller",
  tweaky: "Tweaky Driver",
};
type Failure = "offline" | "auth" | "failed";

class RequestError extends Error {
  constructor(readonly kind: Failure) {
    super(kind);
  }
}

async function request(
  path: string,
  body?: { product: Product; reason?: CancelReason; comment?: string },
): Promise<Subscription> {
  const token = readToken();
  if (!token) throw new RequestError("auth");
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/billing/subscription${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RequestError(navigator.onLine ? "failed" : "offline");
  }
  if (res.status === 401) throw new RequestError("auth");
  if (!res.ok) throw new RequestError("failed");
  const data = (await res.json().catch(() => null)) as Subscription | null;
  if (!data || typeof data.status !== "string") throw new RequestError("failed");
  return data;
}

/** One product's subscription, for the Plans page's "Your plan" card. Throws when it
 *  cannot be read; the caller then keeps its fallback. */
export const readSubscription = (product: Product) => request(`?product=${product}`);

type Loaded = { subs: Subscription[] } | { failure: Failure };

/** PC Tweaker's own state is required; a family product that cannot be read is left out. */
async function loadAll(): Promise<Loaded> {
  const [main, ...family] = await Promise.allSettled(
    PRODUCTS.map((product) => request(`?product=${product}`)),
  );
  if (main.status === "rejected")
    return { failure: main.reason instanceof RequestError ? main.reason.kind : "failed" };
  return {
    subs: [
      main.value,
      ...family.flatMap((r) =>
        r.status === "fulfilled" && r.value.status !== "none" ? [r.value] : [],
      ),
    ],
  };
}

/** "Manage subscription" from the account menu: what each product of the
 *  family account costs, when it renews or ends, and the in-app cancel and
 *  resume. Cancelling stops the renewal only; access runs to the end of the
 *  paid period. Card and invoices stay in Stripe's portal. */
export function SubscriptionPanel({
  lang,
  onClose,
  onSeePlans,
  onManageBilling,
  onChanged,
}: {
  lang: Lang;
  onClose: () => void;
  onSeePlans: () => void;
  /** Stripe's billing portal (payment method, invoices). */
  onManageBilling: () => void;
  /** After a cancel or resume, so the rest of the app re-reads the plan. */
  onChanged: () => void;
}) {
  const c = SUBSCRIPTION_COPY[lang];
  const dialog = useRef<HTMLDialogElement>(null);
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  // Cancelling is two steps: an optional reason, then the confirmation.
  const [confirming, setConfirming] = useState<{ product: Product; step: 1 | 2 } | null>(null);
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<Product | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      previous?.focus();
    };
  }, []);

  const show = useCallback((result: Loaded) => {
    if ("failure" in result) setFailure(result.failure);
    else setSubs(result.subs);
  }, []);
  useEffect(() => {
    let alive = true;
    void loadAll().then((result) => alive && show(result));
    return () => {
      alive = false;
    };
  }, [show]);

  const date = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(localeOf(lang), { dateStyle: "long" }).format(new Date(iso)) : "";
  const price = (sub: Subscription) =>
    sub.amount != null && sub.currency
      ? format(sub.interval === "year" ? c.perYear : c.perMonth, {
          price: new Intl.NumberFormat(localeOf(lang), {
            style: "currency",
            currency: sub.currency.toUpperCase(),
          }).format(sub.amount / 100),
        })
      : null;
  const ending = (sub: Subscription) => sub.cancel_at_period_end || sub.cancel_at !== null;
  const endDate = (sub: Subscription) => sub.cancel_at ?? sub.current_period_end;
  const planName = (sub: Subscription) =>
    `${NAMES[sub.product]} ${sub.lifetime ? c.lifetime : "Pro"}`;

  async function act(sub: Subscription, action: "cancel" | "resume") {
    if (busy) return;
    setBusy(sub.product);
    setNotice(null);
    try {
      const feedback =
        action === "cancel" && reason
          ? { reason, ...(comment.trim() ? { comment: comment.trim() } : {}) }
          : {};
      const next = await request(`/${action}`, { product: sub.product, ...feedback });
      setSubs((all) => all?.map((s) => (s.product === next.product ? next : s)) ?? null);
      setConfirming(null);
      setNotice({
        ok: true,
        text:
          action === "cancel"
            ? format(c.cancelled, { plan: planName(next), date: date(endDate(next)) })
            : format(c.resumed, { date: date(next.current_period_end) }),
      });
      onChanged();
    } catch (error) {
      setNotice({
        ok: false,
        text:
          error instanceof RequestError && error.kind !== "failed"
            ? error.kind === "auth"
              ? c.signIn
              : c.offline
            : c.actionFailed,
      });
    } finally {
      setBusy(null);
    }
  }

  function status(sub: Subscription): { text: string; tone: "ok" | "warn" | "bad" | "muted" } {
    if (sub.lifetime) return { text: c.lifetime, tone: "ok" };
    if (sub.status === "included") return { text: c.included, tone: "ok" };
    if (sub.status === "none") return { text: c.none, tone: "muted" };
    if (sub.status === "past_due" || sub.status === "unpaid")
      return { text: c.pastDue, tone: "bad" };
    if (ending(sub)) return { text: c.ending, tone: "warn" };
    if (sub.status === "paused") return { text: c.paused, tone: "warn" };
    return { text: sub.status === "trialing" ? c.trialing : c.active, tone: "ok" };
  }

  function card(sub: Subscription) {
    const st = status(sub);
    const live = !["none", "included", "lifetime"].includes(sub.status) && !sub.lifetime;
    const cost = price(sub);
    const rows: [string, string][] = [];
    if (cost)
      rows.push([c.planLabel, `${sub.interval === "year" ? c.annual : c.monthly} · ${cost}`]);
    if (live && ending(sub)) rows.push([c.accessUntil, date(endDate(sub))]);
    else if (sub.status === "trialing" && sub.trial_end)
      rows.push([c.trialEnds, date(sub.trial_end)]);
    else if (live && sub.current_period_end) rows.push([c.renewsOn, date(sub.current_period_end)]);
    else if (sub.status === "included" && sub.current_period_end)
      rows.push([c.accessUntil, date(sub.current_period_end)]);
    if (sub.payment_method)
      rows.push([
        c.paymentMethod,
        format(c.card, {
          brand:
            sub.payment_method.brand.charAt(0).toUpperCase() + sub.payment_method.brand.slice(1),
          last4: sub.payment_method.last4,
        }),
      ]);
    const note = sub.lifetime
      ? c.lifetimeNote
      : sub.status === "included"
        ? c.includedNote
        : sub.status === "none"
          ? c.freeNote
          : st.tone === "bad"
            ? c.pastDueNote
            : ending(sub)
              ? c.endingNote
              : null;
    const titleId = `sub-${sub.product}`;
    return (
      <section key={sub.product} className="sub-card" aria-labelledby={titleId}>
        <header>
          <h3 id={titleId}>{sub.status === "none" ? NAMES[sub.product] : planName(sub)}</h3>
          <span className="sub-status" data-tone={st.tone}>
            {st.text}
          </span>
        </header>
        {rows.length > 0 && (
          <dl>
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {note && <p className="sub-note">{note}</p>}
        {confirming?.product === sub.product && confirming.step === 1 ? (
          <fieldset className="sub-confirm sub-reasons" aria-describedby={`${titleId}-hint`}>
            <legend>
              <span className="sub-step">{format(c.step, { n: "1" })}</span>
              <strong>{c.reasonTitle}</strong>
            </legend>
            <p id={`${titleId}-hint`}>{c.reasonHint}</p>
            <div className="sub-reason-list">
              {CANCEL_REASONS.map((code, i) => (
                <label key={code} className="sub-reason">
                  <input
                    type="radio"
                    name={`${titleId}-reason`}
                    value={code}
                    checked={reason === code}
                    autoFocus={i === 0}
                    onChange={() => setReason(code)}
                  />
                  <span>{c.reasons[code]}</span>
                </label>
              ))}
            </div>
            {reason && (
              <label className="sub-comment">
                <span>{reason === "other" ? c.otherLabel : c.commentLabel}</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={comment}
                  placeholder={c.commentPlaceholder}
                  onChange={(e) => setComment(e.target.value)}
                />
                <small aria-hidden="true">{comment.length}/500</small>
              </label>
            )}
            <div className="sub-actions">
              <button type="button" className="sub-button" onClick={() => setConfirming(null)}>
                {c.keep}
              </button>
              <button
                type="button"
                className="sub-button sub-button-quiet"
                onClick={() => {
                  setReason(null);
                  setComment("");
                  setConfirming({ product: sub.product, step: 2 });
                }}
              >
                {c.skip}
              </button>
              <button
                type="button"
                className="sub-button sub-button-primary"
                onClick={() => setConfirming({ product: sub.product, step: 2 })}
              >
                {c.next}
              </button>
            </div>
          </fieldset>
        ) : confirming?.product === sub.product ? (
          <div className="sub-confirm" role="group" aria-labelledby={`${titleId}-confirm`}>
            <span className="sub-step">{format(c.step, { n: "2" })}</span>
            <strong id={`${titleId}-confirm`}>{c.confirmTitle}</strong>
            <p>
              {format(sub.status === "trialing" ? c.confirmTrialBody : c.confirmBody, {
                plan: planName(sub),
                date: date(
                  sub.status === "trialing" ? (sub.trial_end ?? endDate(sub)) : endDate(sub),
                ),
              })}
            </p>
            <div className="sub-actions">
              <button
                type="button"
                className="sub-link"
                disabled={busy !== null}
                onClick={() => setConfirming({ product: sub.product, step: 1 })}
              >
                <span aria-hidden="true">←</span> {c.back}
              </button>
              <button
                type="button"
                className="sub-button sub-push"
                autoFocus
                disabled={busy !== null}
                onClick={() => setConfirming(null)}
              >
                {c.keep}
              </button>
              <button
                type="button"
                className="sub-button sub-button-danger"
                disabled={busy !== null}
                aria-busy={busy === sub.product}
                onClick={() => void act(sub, "cancel")}
              >
                {busy === sub.product ? "…" : c.confirmCancel}
              </button>
            </div>
          </div>
        ) : (
          (sub.can_resume || sub.can_cancel || live || sub.status === "none") && (
            <div className="sub-actions">
              {sub.can_resume && (
                <button
                  type="button"
                  className="sub-button sub-button-primary"
                  disabled={busy !== null}
                  aria-busy={busy === sub.product}
                  onClick={() => void act(sub, "resume")}
                >
                  {busy === sub.product ? "…" : c.resume}
                </button>
              )}
              {sub.status === "none" && sub.product === "pctweaker" && (
                <button
                  type="button"
                  className="sub-button sub-button-primary"
                  onClick={() => {
                    onClose();
                    onSeePlans();
                  }}
                >
                  {c.seePlans}
                </button>
              )}
              {live && sub.product !== "tweaky" && (
                <button type="button" className="sub-link" onClick={onManageBilling}>
                  {c.portal} <span aria-hidden="true">↗</span>
                </button>
              )}
              {sub.can_cancel && (
                <button
                  type="button"
                  className="sub-button sub-button-quiet"
                  disabled={busy !== null}
                  onClick={() => {
                    setNotice(null);
                    setReason(null);
                    setComment("");
                    setConfirming({ product: sub.product, step: 1 });
                  }}
                >
                  {c.cancel}
                </button>
              )}
            </div>
          )
        )}
      </section>
    );
  }

  return (
    <dialog ref={dialog} className="sub-dialog" aria-labelledby="sub-title" onCancel={onClose}>
      <div className="sub-top">
        <div>
          <h2 id="sub-title">{c.title}</h2>
          <p>{c.intro}</p>
        </div>
        <button type="button" className="sub-close" onClick={onClose} aria-label={c.close}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {failure ? (
        <div className="sub-state" role="alert">
          <p>{failure === "offline" ? c.offline : failure === "auth" ? c.signIn : c.failed}</p>
          {failure !== "auth" && (
            <button
              type="button"
              className="sub-button"
              onClick={() => {
                setFailure(null);
                setSubs(null);
                void loadAll().then(show);
              }}
            >
              {c.retry}
            </button>
          )}
        </div>
      ) : !subs ? (
        <div className="sub-state" aria-busy="true">
          <span className="sub-spinner" aria-hidden="true" />
          <p>{c.loading}</p>
        </div>
      ) : (
        <>
          {card(subs[0])}
          {subs.length > 1 && (
            <>
              <h4 className="sub-family">{c.family}</h4>
              {subs.slice(1).map(card)}
            </>
          )}
        </>
      )}
      <p className="sub-notice" role="status" data-ok={notice?.ok}>
        {notice?.text}
      </p>
    </dialog>
  );
}
