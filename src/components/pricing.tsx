import { useState } from "react";
import { format, Lang, Strings } from "../i18n";
import {
  LIFETIME_BREAK_EVEN_MONTHS,
  money,
  PRICE_ANNUAL,
  PRICE_LIFETIME,
  PRICE_MONTHLY,
  ProPlan,
  savingsPercent,
} from "../lib";
import { CheckIcon } from "./icons";

export function PricingPanel({
  s,
  lang,
  isPro,
  freeTweakCount,
  onChoosePro,
  onManageBilling,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  freeTweakCount: number;
  onChoosePro: (plan: ProPlan) => void;
  onManageBilling: () => void;
}) {
  // Three plans rather than a monthly/annual boolean. Lifetime is not another
  // billing period — it is a different kind of purchase — but putting it in
  // the same control is what makes it comparable, which is the whole reason
  // to offer it.
  const [plan, setPlan] = useState<ProPlan>("annual");
  const annual = plan === "annual";

  const price =
    plan === "lifetime" ? PRICE_LIFETIME : plan === "annual" ? PRICE_ANNUAL : PRICE_MONTHLY;
  const perMonthEquivalent = PRICE_ANNUAL / 12;

  // One shape for all three, so a fourth would not mean a fourth copy of it.
  const tabClass = (selected: boolean) =>
    `relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
      selected ? "text-white" : "text-ink-3 hover:text-ink-2"
    }`;
  const tabStyle = (selected: boolean) =>
    selected ? { backgroundColor: "var(--app-accent)" } : undefined;

  return (
    <div className="animate-card">
      {/* An ambient wash behind the header rather than a flat heading on the
          page background. It is decorative, so it is aria-hidden and sits
          behind everything at pointer-events: none. */}
      <div className="relative isolate text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-90px] -z-10 h-[280px] w-[560px] -translate-x-1/2 rounded-full opacity-45 blur-[70px]"
          style={{
            background:
              "radial-gradient(closest-side, var(--app-accent2), var(--app-accent) 45%, transparent 75%)",
          }}
        />
        <p className="type-label mb-2 tracking-[0.22em] text-ink-3">{s.pricing.eyebrow}</p>
        <h2 className="text-[34px] font-black leading-[1.1] tracking-[-0.03em] text-slate-50">
          {s.pricing.title}
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-[13.5px] leading-relaxed text-ink-3">
          {s.pricing.subtitle}
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="relative inline-flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line">
          <button
            onClick={() => setPlan("monthly")}
            className={tabClass(plan === "monthly")}
            style={tabStyle(plan === "monthly")}
          >
            {s.pricing.monthly}
          </button>
          <button
            onClick={() => setPlan("annual")}
            className={tabClass(annual)}
            style={tabStyle(annual)}
          >
            {s.pricing.annual}
            {/* Only the annual tab carries a badge. Putting one on lifetime
                too would leave every option shouting, which is the same as
                none of them shouting. */}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                annual ? "bg-white/25 text-white" : "bg-emerald-400/20 text-emerald-300"
              }`}
            >
              {format(s.pricing.saveBadge, { percent: savingsPercent })}
            </span>
          </button>
          <button
            onClick={() => setPlan("lifetime")}
            className={tabClass(plan === "lifetime")}
            style={tabStyle(plan === "lifetime")}
          >
            {s.pricing.lifetime}
          </button>
        </div>
      </div>

      <div className="mt-7 grid items-start gap-4 md:grid-cols-2">
        {/* Free */}
        <div className="rounded-2xl border border-line bg-surface-1 p-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-ink">{s.pricing.freeName}</h3>
            {!isPro && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-ink-2">
                {s.pricing.freeCurrent}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-3">{s.pricing.freeTagline}</p>

          <p className="type-data mt-5 text-[42px] font-black leading-none tracking-[-0.04em] text-ink">
            {money(0, lang)}
          </p>
          <p className="mt-1.5 text-xs text-ink-3">{s.pricing.freePriceNote}</p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {/* The tweak count is filled in from the real list rather than
                written into the copy: it was hardcoded as "20" and silently
                became a lie the moment new tweaks shipped. */}
            {s.pricing.freeFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-2">
                {/* Quiet, in the ink colour rather than a signal green: this
                    column is the baseline, not the offer. */}
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                <span>{format(feature, { count: freeTweakCount })}</span>
              </li>
            ))}
          </ul>

          {/* Only claim they're on Free when they actually are — a Pro user
              seeing "you're on the Free plan" would reasonably think their
              payment didn't go through. */}
          {!isPro && (
            <p className="mt-6 rounded-xl bg-surface-2 py-2.5 text-center text-sm font-medium text-ink-3">
              {s.pricing.freeCta}
            </p>
          )}
        </div>

        {/* Pro */}
        <div className="relative rounded-2xl p-[1.5px]">
          {/* Two layers behind the card: a soft coloured bloom on the page,
              then the gradient hairline itself. The bloom is what stops the
              Pro column reading as "the same card with a nicer border". */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-5 -z-10 rounded-[28px] opacity-35 blur-2xl"
            style={{
              background: "linear-gradient(135deg, var(--app-accent), var(--app-accent2))",
            }}
          />
          <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent2),var(--app-accent))] opacity-90" />

          {/* Only on the annual plan: a badge that labels every option labels
              none of them, and a reader who toggles once sees straight through
              it. Rendered on this wrapper rather than inside the card body,
              which clips its contents — at -top-3 the badge sits outside the
              card edge on purpose and would otherwise be cut in half. */}
          {annual && (
            <span
              className="absolute -top-3 right-6 z-10 rounded-full px-3 py-1 text-[10px] font-black tracking-wide text-slate-900 shadow-lg shadow-black/40"
              style={{ backgroundColor: "var(--app-accent2)" }}
            >
              {s.pricing.mostChosen}
            </span>
          )}
          <div className="relative overflow-hidden rounded-[15px] bg-[var(--app-bg-b)] p-6">
            {/* A faint sheen across the top of the Pro card only. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-[0.14]"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%, var(--app-accent2), transparent 70%)",
              }}
            />
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-ink">{s.pricing.proName}</h3>
              {isPro && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {s.pricing.proCurrent}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-3">{s.pricing.proTagline}</p>

            <div className="mt-5 flex items-end gap-2">
              <span
                className="type-data text-[52px] font-black leading-[0.9] tracking-[-0.045em]"
                style={{
                  backgroundImage: "linear-gradient(135deg, var(--app-accent2), var(--app-accent))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {money(price, lang)}
              </span>
              <span className="pb-2 text-sm font-semibold text-ink-3">
                {plan === "lifetime"
                  ? s.pricing.once
                  : annual
                    ? s.pricing.perYear
                    : s.pricing.perMonth}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {plan === "lifetime"
                ? format(s.pricing.lifetimeDetail, { months: LIFETIME_BREAK_EVEN_MONTHS })
                : annual
                  ? format(s.pricing.annualDetail, {
                      monthly: money(perMonthEquivalent, lang),
                      yearly: money(PRICE_ANNUAL, lang),
                    })
                  : format(s.pricing.annualNudge, { price: money(perMonthEquivalent, lang) })}
            </p>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink-3">
              {s.pricing.everythingInFree}
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {s.pricing.proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-ink">
                  {/* Filled chip, not the same glyph the Free column uses:
                      matching marks on both sides made the two lists read as
                      interchangeable, which is the actual problem a tick on
                      every row creates. */}
                  <span
                    className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                    style={{
                      background: "linear-gradient(135deg, var(--app-accent2), var(--app-accent))",
                    }}
                  >
                    <CheckIcon className="h-3 w-3 text-slate-900" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isPro ? (
              <button
                onClick={onManageBilling}
                className="mt-6 w-full rounded-xl border border-line-2 bg-surface-2 py-3 text-sm font-bold text-ink transition-colors hover:border-line-2 hover:bg-surface-1"
              >
                {s.pricing.manageBilling}
              </button>
            ) : (
              <button
                onClick={() => onChoosePro(plan)}
                className="mt-6 w-full rounded-xl bg-[linear-gradient(to_right,var(--app-accent),var(--app-accent2))] py-3.5 text-[15px] font-black tracking-tight text-slate-900 shadow-[0_10px_30px_-10px_var(--app-accent)] transition hover:-translate-y-px hover:brightness-110"
              >
                {s.pricing.proCta}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-lg text-center text-xs leading-relaxed text-ink-3">
        {s.pricing.reassurance}
      </p>
    </div>
  );
}
