import { useEffect, useRef, useState } from "react";
import { format, Lang, Strings, localeOf } from "../i18n";
import { money, PRICE_ANNUAL, PRICE_LIFETIME, PRICE_MONTHLY, ProPlan } from "../lib";
import { offerClock } from "../lifetime-offer";
import { MOST_CHOSEN, type SoldPlan } from "../most-chosen";
import { promoPercent, PROMO_LAYOUT_UNTIL } from "../promo";
import { HalloweenOfferBanner } from "./halloween-offer";
import { CheckIcon, CrownIcon, LayersIcon, SparkIcon } from "./icons";
import { PLAN_STATE_COPY, PRICING_COPY } from "./pricing-copy";
import { TRIAL_COPY } from "./trial-copy";
import { trialLeft, trialOffer, trialUsed, type BillingStatus, type PriceList } from "../trial";
import { useLifetimeOffer } from "./use-lifetime-offer";
import { usePromo } from "./use-promo";
import "./pricing.css";

export function PricingPanel({
  s,
  lang,
  isPro,
  heldPlan,
  hasBilling,
  prices = null,
  billing = null,
  freeTweakCount,
  onChoosePro,
  onManageBilling,
  onOpenLifetimeTools,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  heldPlan: string | null;
  hasBilling: boolean;
  /** Public prices and the trial switch (GET /api/billing/prices). */
  prices?: PriceList | null;
  /** This account's trial and subscription state (GET /api/billing/status). */
  billing?: BillingStatus | null;
  freeTweakCount: number;
  /** `startTrial` is set only when a trial is on offer: true for the
   *  trial button, false for "Subscribe now". */
  onChoosePro: (plan: ProPlan, startTrial?: boolean) => void | Promise<void>;
  onManageBilling: () => void | Promise<void>;
  onOpenLifetimeTools: () => void;
}) {
  const copy = PRICING_COPY[lang];
  const t = TRIAL_COPY[lang];
  const ps = PLAN_STATE_COPY[lang];
  // Half-minute steps keep the first-charge date and the trial countdown current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const [selectedPeriod, setPeriod] = useState<"monthly" | "annual" | null>(null);
  const period = selectedPeriod ?? (heldPlan === "monthly" ? "monthly" : "annual");
  const [busy, setBusy] = useState<ProPlan | "manage" | null>(null);
  const [busyTrial, setBusyTrial] = useState<boolean | undefined>(undefined);
  const actionPending = useRef(false);
  const campaign = useLifetimeOffer();
  const promo = usePromo();
  const previewing = campaign.preview || promo.preview;
  const ownsLifetime = isPro && heldPlan === "lifetime";
  const annual = period === "annual";
  const mostChosen = (plan: SoldPlan) => MOST_CHOSEN.pctweaker === plan;
  const proOffer = promo.offer("pctweaker", period);
  const lifetimeOffer = promo.offer("pctweaker", "lifetime");
  // The server's price list wins over the figures compiled into the app.
  const listed = (plan: "monthly" | "annual") =>
    (prices?.prices.find((p) => p.product === "pctweaker" && p.plan === plan)?.amount ?? 0) / 100 ||
    (plan === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY);
  const save = Math.round((1 - listed("annual") / (listed("monthly") * 12)) * 100);
  const mine = billing?.products.find((p) => p.product === "pctweaker") ?? null;
  const trial = isPro ? null : trialOffer("pctweaker", period, prices, billing, proOffer?.regular);
  const trialSpent = !isPro && trialUsed("pctweaker", billing);
  const paymentFailed = mine?.state === "blocked" && mine.blockedReason === "payment_failed";
  const longDate = (ms: number) =>
    new Intl.DateTimeFormat(localeOf(lang), { dateStyle: "long" }).format(new Date(ms));
  const trialLine = trial
    ? format(
        proOffer
          ? annual
            ? t.thenYearPromo
            : t.thenMonthPromo
          : annual
            ? t.thenYear
            : t.thenMonth,
        {
          price: money((proOffer ? proOffer.price : trial.amount) / 100, lang),
          regular: money(trial.amount / 100, lang),
          date: longDate(now + trial.days * 86_400_000),
        },
      )
    : null;
  const left =
    isPro && mine?.state === "trialing" && mine.trialEndsAt
      ? trialLeft(mine.trialEndsAt, billing?.trialDays ?? 3, now)
      : null;
  // Lifetime is the top tier; any other active plan (monthly, annual, a bonus
  // or a grant) holds Pro, so Free below it is included in it.
  const holdsPro = isPro && !ownsLifetime;
  const trialDaysLeft =
    left && mine?.trialEndsAt
      ? Math.max(0, Math.ceil((mine.trialEndsAt - now) / 86_400_000))
      : null;
  const trialBadge =
    trialDaysLeft === null
      ? null
      : format(ps.trialBadge, {
          left:
            trialDaysLeft === 0
              ? ps.endsToday
              : trialDaysLeft === 1
                ? ps.oneDayLeft
                : format(ps.daysLeft, { days: trialDaysLeft }),
        });
  const promoOffers = promo.active ? (promo.promo?.offers ?? []) : [];
  const showPromo = !ownsLifetime && promoOffers.length > 0;
  // Until the server answers, an invisible copy of the panel holds its exact
  // place, so the plans never jump when the real one arrives.
  const reservePromo = !ownsLifetime && !showPromo && promo.reserve;
  const promoEnd = showPromo ? promo.promo?.endsAt : new Date(PROMO_LAYOUT_UNTIL).toISOString();
  const promoDate = (iso: string | undefined, offsetMs = 0, timeStyle?: "short") =>
    iso
      ? new Intl.DateTimeFormat(localeOf(lang), { dateStyle: "long", timeStyle }).format(
          new Date(Date.parse(iso) + offsetMs),
        )
      : "";
  const clock = offerClock(campaign.remaining);
  const activeCampaign =
    campaign.offer?.status === "active" && !campaign.expired && campaign.available;
  const deadline = campaign.offer?.endsAt;
  const deadlineText = deadline
    ? new Intl.DateTimeFormat(localeOf(lang), { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(deadline),
      )
    : "";

  async function act(plan: ProPlan | "manage", startTrial?: boolean) {
    if (
      actionPending.current ||
      (plan !== "manage" && previewing) ||
      (plan === "lifetime" && !campaign.available)
    )
      return;
    actionPending.current = true;
    setBusy(plan);
    setBusyTrial(startTrial);
    try {
      await (plan === "manage" ? onManageBilling() : onChoosePro(plan, startTrial));
    } finally {
      actionPending.current = false;
      setBusy(null);
      if (plan === "lifetime") campaign.refresh();
    }
  }

  function included(yes: boolean) {
    return yes ? (
      <span className="pricing-included">
        <CheckIcon className="h-4 w-4" />
        <span className="sr-only">{s.pricing.included}</span>
      </span>
    ) : (
      <span className="pricing-not-included" aria-label={s.toggle.off}>
        —
      </span>
    );
  }

  const rows: [string, boolean, boolean, boolean][] = [
    [copy.essentials, true, true, true],
    [copy.restores, true, true, true],
    [copy.advanced, false, true, true],
    [copy.sessions, false, true, true],
    [copy.profiles, false, false, true],
    [copy.reports, false, false, true],
  ];

  return (
    <section className="pricing-workspace" aria-labelledby="pricing-heading">
      <header className="pricing-heading">
        <p className="pricing-eyebrow">{s.tabs.pricing}</p>
        <h1 id="pricing-heading">{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      <details className="pricing-trust">
        <summary>
          <span aria-hidden="true">
            <CheckIcon className="h-4 w-4" />
          </span>
          {copy.signed}
          <span className="pricing-publisher">Aurelio Avila</span>
        </summary>
        <p>{copy.signature}</p>
        {import.meta.env.DEV && <p>{copy.previewBuild}</p>}
      </details>
      {(!ownsLifetime || campaign.preview) && activeCampaign && !lifetimeOffer && (
        <aside className="pricing-campaign" aria-label={copy.campaign}>
          <div className="pricing-campaign-copy">
            {campaign.preview && <span className="pricing-preview">{copy.preview}</span>}
            <h2>{copy.campaign}</h2>
            <p>{copy.rare}</p>
            <span className="pricing-deadline">
              {copy.ends}: <time dateTime={deadline ?? undefined}>{deadlineText}</time>
            </span>
          </div>
          <div
            className="pricing-clock"
            role="timer"
            aria-live="off"
            aria-label={`${clock[0]} ${copy.hours}, ${clock[1]} ${copy.minutes}, ${clock[2]} ${copy.seconds}`}
          >
            {clock.map((value, index) => (
              <div key={index}>
                <strong>{value}</strong>
                <span>{[copy.hours, copy.minutes, copy.seconds][index]}</span>
              </div>
            ))}
          </div>
        </aside>
      )}
      {(showPromo || reservePromo) && (
        <HalloweenOfferBanner
          kicker={copy.promoTitle}
          badge={promo.preview && <span className="pricing-preview">{copy.preview}</span>}
          heading={
            <>
              {copy.ends}: <time dateTime={promoEnd}>{promoDate(promoEnd, -60_000, "short")}</time>
            </>
          }
          fine={copy.promoReferenceShort}
          endsIn={copy.endsIn}
          units={[copy.days, copy.hours, copy.minutes, copy.seconds]}
          remaining={showPromo ? promo.remaining : 0}
          reserved={reservePromo}
          headingId="pricing-promo-title"
        />
      )}
      {(trial || trialSpent || trialBadge) && (
        <aside
          className="pricing-trial-band"
          data-state={trialBadge ? "running" : trial ? "offer" : "used"}
          aria-labelledby="pricing-trial-band-title"
        >
          <div>
            <h2 id="pricing-trial-band-title">
              {trialBadge ?? (trial ? format(ps.bannerTitle, { days: trial.days }) : t.trialUsed)}
            </h2>
            <p>
              {trialBadge && mine?.trialEndsAt
                ? format(mine.cancelAtPeriodEnd ? t.noCharge : t.firstCharge, {
                    date: longDate(mine.trialEndsAt),
                  })
                : trial
                  ? format(ps.bannerBody, { days: trial.days })
                  : t.used}
            </p>
          </div>
          {trial && !trialBadge && (
            <button
              className="pricing-button pricing-button-trial"
              disabled={busy !== null || previewing}
              aria-busy={busy === period && busyTrial === true}
              onClick={() => void act(period, true)}
            >
              {format(ps.bannerButton, { days: trial.days })}
            </button>
          )}
        </aside>
      )}
      <div className="pricing-plans">
        <article className="pricing-plan">
          <div className="pricing-plan-name">
            <h2>{s.pricing.freeName}</h2>
            {!isPro && <span className="pricing-current">{copy.current}</span>}
          </div>
          <p className="pricing-plan-description">{copy.free}</p>
          <div className="pricing-price">
            <strong>{money(0, lang)}</strong>
          </div>
          <p className="pricing-price-note">{s.pricing.freePriceNote}</p>
          <div className="pricing-plan-footer">
            <span className="pricing-plan-status">
              {isPro ? ps.includedInPlan : s.pricing.freeCta}
            </span>
          </div>
          <ul className="pricing-highlights">
            <li>{format(s.pricing.freeFeatures[0], { count: freeTweakCount })}</li>
            <li>{copy.essentials}</li>
            <li>{copy.restores}</li>
          </ul>
        </article>
        <article
          className="pricing-plan pricing-plan-pro"
          data-most-chosen={mostChosen(period) || undefined}
          aria-describedby={mostChosen(period) ? "pricing-most-chosen" : undefined}
        >
          {mostChosen(period) && (
            <span className="pricing-ribbon" id="pricing-most-chosen">
              <SparkIcon />
              {copy.mostChosen}
            </span>
          )}
          <div className="pricing-plan-name">
            <h2>{s.pricing.proName}</h2>
            {holdsPro && <span className="pricing-current">{trialBadge ?? copy.current}</span>}
          </div>
          <p className="pricing-plan-description">{copy.pro}</p>
          <div
            className="pricing-period"
            role="group"
            aria-label={`${s.pricing.monthly} / ${s.pricing.annual}`}
          >
            <button aria-pressed={!annual} onClick={() => setPeriod("monthly")}>
              {s.pricing.monthly}
            </button>
            <button aria-pressed={annual} onClick={() => setPeriod("annual")}>
              {s.pricing.annual}
            </button>
          </div>
          <div className="pricing-price">
            {proOffer && (
              <s className="pricing-price-before">{money(proOffer.reference / 100, lang)}</s>
            )}
            <strong>{money(proOffer ? proOffer.price / 100 : listed(period), lang)}</strong>
            <span>{annual ? s.pricing.perYear : s.pricing.perMonth}</span>
            {proOffer && <span className="pricing-discount">-{promoPercent(proOffer)}%</span>}
          </div>
          <p className="pricing-price-note">
            {proOffer
              ? format(annual ? copy.firstYear : copy.firstMonth, {
                  price: money(proOffer.regular / 100, lang),
                })
              : annual
                ? format(s.pricing.saveBadge, { percent: save })
                : format(s.pricing.annualNudge, { price: money(listed("annual") / 12, lang) })}
          </p>
          <div className="pricing-plan-footer">
            {!isPro && paymentFailed ? (
              <button
                className="pricing-button pricing-button-secondary"
                disabled={busy !== null}
                aria-busy={busy === "manage"}
                onClick={() => void act("manage")}
              >
                {busy === "manage" ? "…" : t.updatePayment}
              </button>
            ) : !isPro && trial ? (
              <div className="pricing-choice">
                <button
                  className="pricing-button pricing-button-trial"
                  disabled={busy !== null || previewing}
                  aria-busy={busy === period && busyTrial === true}
                  aria-describedby="pricing-trial-line"
                  onClick={() => void act(period, true)}
                >
                  {busy === period && busyTrial === true
                    ? "…"
                    : format(t.start, { days: trial.days })}
                </button>
                <button
                  className="pricing-button pricing-button-secondary"
                  disabled={busy !== null || previewing}
                  aria-busy={busy === period && busyTrial === false}
                  onClick={() => void act(period, false)}
                >
                  {busy === period && busyTrial === false ? "…" : t.subscribeNow}
                </button>
              </div>
            ) : !isPro ? (
              <button
                className="pricing-button pricing-button-secondary"
                disabled={busy !== null || previewing}
                aria-busy={busy === period}
                onClick={() => void act(period)}
              >
                {busy === period ? "…" : trialSpent ? t.subscribe : s.pricing.proCta}
              </button>
            ) : ownsLifetime || !hasBilling ? (
              <span className="pricing-plan-status">
                {ownsLifetime ? ps.includedInPlan : s.pricing.proActiveNoBilling}
              </span>
            ) : (
              <button
                className="pricing-button pricing-button-secondary"
                disabled={busy !== null}
                aria-busy={busy === "manage"}
                onClick={() => void act("manage")}
              >
                {busy === "manage" ? "…" : s.pricing.manageBilling}
              </button>
            )}
          </div>
          {(trialLine || trialSpent || paymentFailed || left) && (
            <div className="pricing-trial" id="pricing-trial-line" role="status">
              {left && mine?.trialEndsAt ? (
                <>
                  <p className="pricing-trial-left">
                    {left.days
                      ? format(t.leftDays, { days: left.days, hours: left.hours })
                      : left.hours
                        ? format(t.leftHours, { hours: left.hours, minutes: left.minutes })
                        : format(t.leftMinutes, { minutes: Math.max(1, left.minutes) })}
                  </p>
                  <span className="pricing-trial-bar" aria-hidden="true">
                    <i style={{ width: `${Math.round(left.used * 100)}%` }} />
                  </span>
                  <p>
                    {format(mine.cancelAtPeriodEnd ? t.noCharge : t.firstCharge, {
                      date: longDate(mine.trialEndsAt),
                    })}
                  </p>
                </>
              ) : paymentFailed ? (
                <p className="pricing-trial-alert">
                  {t.paymentFailed}. {t.paymentFailedHint}
                </p>
              ) : trial ? (
                <>
                  <p>{trialLine}</p>
                  <p className="pricing-trial-alt">
                    {format(t.subscribeNowNote, {
                      price: money((proOffer ? proOffer.price : trial.amount) / 100, lang),
                    })}
                  </p>
                </>
              ) : (
                <p>{t.used}</p>
              )}
            </div>
          )}
          <ul className="pricing-highlights">
            <li>{s.pricing.everythingInFree}</li>
            <li>{copy.advanced}</li>
            <li>{copy.sessions}</li>
          </ul>
        </article>
        <article
          className="pricing-plan pricing-plan-lifetime"
          data-most-chosen={mostChosen("lifetime") || undefined}
          aria-describedby={mostChosen("lifetime") ? "pricing-most-chosen" : undefined}
        >
          {mostChosen("lifetime") && (
            <span className="pricing-ribbon" id="pricing-most-chosen">
              <SparkIcon />
              {copy.mostChosen}
            </span>
          )}
          <div className="pricing-plan-name">
            <h2>
              <CrownIcon className="h-4 w-4" />
              {s.pricing.lifetimeName}
            </h2>
            {ownsLifetime && <span className="pricing-current">{copy.current}</span>}
          </div>
          <p className="pricing-plan-description">{copy.lifetime}</p>
          <span className="pricing-payment-label">{s.pricing.oneTimeBadge}</span>
          <div className="pricing-price">
            {lifetimeOffer && (
              <s className="pricing-price-before">{money(lifetimeOffer.reference / 100, lang)}</s>
            )}
            <strong>
              {money(lifetimeOffer ? lifetimeOffer.price / 100 : PRICE_LIFETIME, lang)}
            </strong>
            <span>{s.pricing.once}</span>
            {lifetimeOffer && (
              <span className="pricing-discount">-{promoPercent(lifetimeOffer)}%</span>
            )}
          </div>
          <p className="pricing-price-note">{copy.perpetual}</p>
          <div className="pricing-plan-footer">
            {ownsLifetime ? (
              <button
                className="pricing-button pricing-button-primary"
                onClick={onOpenLifetimeTools}
              >
                {copy.openTools}
              </button>
            ) : (
              <button
                className="pricing-button pricing-button-primary"
                disabled={busy !== null || !campaign.available || previewing}
                aria-busy={busy === "lifetime"}
                onClick={() => void act("lifetime")}
              >
                {busy === "lifetime"
                  ? "…"
                  : isPro && hasBilling
                    ? s.pricing.switchToLifetime
                    : s.pricing.lifetimeCta}
              </button>
            )}
          </div>
          <ul className="pricing-highlights">
            <li>{s.pricing.everythingInPro}</li>
            <li>{copy.earlyAccess}</li>
            <li>{copy.futureTweaks}</li>
            <li>{copy.prioritySupport}</li>
            <li>{copy.uninstallerBonus}</li>
            <li>{copy.profiles}</li>
            <li>{copy.reports}</li>
          </ul>
        </article>
      </div>
      {!ownsLifetime && (
        <div className="pricing-offer-status" role="status">
          {previewing
            ? copy.previewCheckout
            : campaign.loading
              ? copy.checking
              : campaign.expired
                ? copy.expired
                : campaign.offer?.status === "scheduled"
                  ? copy.scheduled
                  : !campaign.available
                    ? copy.unavailable
                    : null}
          {!previewing && (campaign.failed || (!campaign.available && !campaign.loading)) && (
            <button onClick={campaign.refresh}>{copy.retry}</button>
          )}
        </div>
      )}
      <p className="pricing-checkout-note">{copy.checkout}</p>
      <section className="pricing-comparison" aria-labelledby="pricing-compare-heading">
        <h2 id="pricing-compare-heading">{copy.compare}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{copy.capability}</th>
              <th scope="col">{s.pricing.freeName}</th>
              <th scope="col">{s.pricing.proName}</th>
              <th scope="col">{s.pricing.lifetimeName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, free, pro, life]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{included(free)}</td>
                <td>{included(pro)}</td>
                <td>{included(life)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="pricing-extras" aria-labelledby="pricing-extras-heading">
        <div className="pricing-section-heading">
          <p className="pricing-eyebrow">{s.pricing.lifetimeExclusive}</p>
          <h2 id="pricing-extras-heading">{copy.newExtras}</h2>
        </div>
        <div className="pricing-extra-grid">
          <article>
            <LayersIcon className="h-5 w-5" />
            <span className="pricing-extra-number">01</span>
            <h3>{copy.profiles}</h3>
            <p>{copy.profileDetail}</p>
          </article>
          <article>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M7 3h7l4 4v14H7V3Zm7 0v5h4M10 12h5m-5 4h5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <span className="pricing-extra-number">02</span>
            <h3>{copy.reports}</h3>
            <p>{copy.reportDetail}</p>
          </article>
        </div>
        <p className="pricing-scope-note">{copy.notBenchmark}</p>
        <ul className="pricing-existing-extras">
          {s.pricing.lifetimeFeatures.map((feature) => (
            <li key={feature}>
              <CheckIcon className="h-3.5 w-3.5" />
              {feature}
            </li>
          ))}
        </ul>
      </section>
      <details className="pricing-terms">
        <summary>{copy.terms}</summary>
        <p>
          <strong>
            {s.pricing.monthly} / {s.pricing.annual}:
          </strong>{" "}
          {copy.renewal}
        </p>
        <p>
          <strong>{s.pricing.lifetime}:</strong> {copy.perpetual}
        </p>
        <p>{format(copy.twoYears, { price: money(listed("annual") * 2, lang) })}</p>
        <p>{copy.afterCancel}</p>
        {promoOffers.length > 0 && <p>{copy.promoTerms}</p>}
        {activeCampaign && <p>{copy.mayChange}</p>}
      </details>
    </section>
  );
}
