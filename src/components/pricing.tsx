import { useRef, useState } from "react";
import { format, Lang, Strings } from "../i18n";
import {
  money,
  PRICE_ANNUAL,
  PRICE_LIFETIME,
  PRICE_MONTHLY,
  ProPlan,
  savingsPercent,
} from "../lib";
import { offerClock } from "../lifetime-offer";
import { CheckIcon, CrownIcon, LayersIcon } from "./icons";
import { PRICING_COPY } from "./pricing-copy";
import { useLifetimeOffer } from "./use-lifetime-offer";
import "./pricing.css";

export function PricingPanel({
  s,
  lang,
  isPro,
  heldPlan,
  hasBilling,
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
  freeTweakCount: number;
  onChoosePro: (plan: ProPlan) => void | Promise<void>;
  onManageBilling: () => void | Promise<void>;
  onOpenLifetimeTools: () => void;
}) {
  const copy = PRICING_COPY[lang];
  const [selectedPeriod, setPeriod] = useState<"monthly" | "annual" | null>(null);
  const period = selectedPeriod ?? (heldPlan === "monthly" ? "monthly" : "annual");
  const [busy, setBusy] = useState<ProPlan | "manage" | null>(null);
  const actionPending = useRef(false);
  const campaign = useLifetimeOffer();
  const ownsLifetime = isPro && heldPlan === "lifetime";
  const annual = period === "annual";
  const clock = offerClock(campaign.remaining);
  const activeCampaign =
    campaign.offer?.status === "active" && !campaign.expired && campaign.available;
  const deadline = campaign.offer?.endsAt;
  const deadlineText = deadline
    ? new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(deadline),
      )
    : "";

  async function act(plan: ProPlan | "manage") {
    if (
      actionPending.current ||
      (plan !== "manage" && campaign.preview) ||
      (plan === "lifetime" && !campaign.available)
    )
      return;
    actionPending.current = true;
    setBusy(plan);
    try {
      await (plan === "manage" ? onManageBilling() : onChoosePro(plan));
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
      {(!ownsLifetime || campaign.preview) && activeCampaign && (
        <aside className="pricing-campaign" aria-label={copy.campaign}>
          <div className="pricing-campaign-copy">
            {campaign.preview && <span className="pricing-preview">{copy.preview}</span>}
            <h2>{copy.campaign}</h2>
            <p>{copy.mayChange}</p>
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
          <ul className="pricing-highlights">
            <li>{format(s.pricing.freeFeatures[0], { count: freeTweakCount })}</li>
            <li>{copy.essentials}</li>
            <li>{copy.restores}</li>
          </ul>
          <div className="pricing-plan-footer">
            <span className="pricing-plan-status">
              {isPro ? s.pricing.included : s.pricing.freeCta}
            </span>
          </div>
        </article>
        <article className="pricing-plan pricing-plan-pro">
          <div className="pricing-plan-name">
            <h2>{s.pricing.proName}</h2>
            {isPro && heldPlan === period && (
              <span className="pricing-current">{copy.current}</span>
            )}
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
            <strong>{money(annual ? PRICE_ANNUAL : PRICE_MONTHLY, lang)}</strong>
            <span>{annual ? s.pricing.perYear : s.pricing.perMonth}</span>
          </div>
          <p className="pricing-price-note">
            {annual
              ? format(s.pricing.saveBadge, { percent: savingsPercent })
              : format(s.pricing.annualNudge, { price: money(PRICE_ANNUAL / 12, lang) })}
          </p>
          <ul className="pricing-highlights">
            <li>{s.pricing.everythingInFree}</li>
            <li>{copy.advanced}</li>
            <li>{copy.sessions}</li>
          </ul>
          <div className="pricing-plan-footer">
            {!isPro ? (
              <button
                className="pricing-button pricing-button-secondary"
                disabled={busy !== null || campaign.preview}
                aria-busy={busy === period}
                onClick={() => void act(period)}
              >
                {busy === period ? "…" : s.pricing.proCta}
              </button>
            ) : ownsLifetime || !hasBilling ? (
              <span className="pricing-plan-status">
                {ownsLifetime ? s.pricing.lifetimeOwned : s.pricing.proActiveNoBilling}
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
        </article>
        <article className="pricing-plan pricing-plan-lifetime">
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
            <strong>{money(PRICE_LIFETIME, lang)}</strong>
            <span>{s.pricing.once}</span>
          </div>
          <p className="pricing-price-note">{copy.perpetual}</p>
          <ul className="pricing-highlights">
            <li>{s.pricing.everythingInPro}</li>
            <li>{copy.profiles}</li>
            <li>{copy.reports}</li>
          </ul>
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
                disabled={busy !== null || !campaign.available || campaign.preview}
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
        </article>
      </div>
      {!ownsLifetime && (
        <div className="pricing-offer-status" role="status">
          {campaign.preview
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
          {!campaign.preview && (campaign.failed || (!campaign.available && !campaign.loading)) && (
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
        <p>{format(copy.twoYears, { price: money(PRICE_ANNUAL * 2, lang) })}</p>
        <p>{copy.afterCancel}</p>
        {activeCampaign && <p>{copy.mayChange}</p>}
      </details>
    </section>
  );
}
