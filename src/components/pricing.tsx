import { useState } from "react";
import { format, Lang, Strings } from "../i18n";
import { money, PRICE_ANNUAL, PRICE_MONTHLY, savingsPercent } from "../lib";
import { CheckIcon } from "./icons";

export function PricingPanel({
  s,
  lang,
  isPro,
  freeTweakCount,
  onChoosePro,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  freeTweakCount: number;
  onChoosePro: (plan: "monthly" | "annual") => void;
}) {
  const [annual, setAnnual] = useState(true);

  const price = annual ? PRICE_ANNUAL : PRICE_MONTHLY;
  const perMonthEquivalent = PRICE_ANNUAL / 12;

  return (
    <div className="animate-card">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-50">{s.pricing.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-3">{s.pricing.subtitle}</p>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="relative inline-flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line">
          <button
            onClick={() => setAnnual(false)}
            className={`relative z-10 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              annual ? "text-ink-3 hover:text-ink-2" : "text-white"
            }`}
            style={!annual ? { backgroundColor: "var(--app-accent)" } : undefined}
          >
            {s.pricing.monthly}
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              annual ? "text-white" : "text-ink-3 hover:text-ink-2"
            }`}
            style={annual ? { backgroundColor: "var(--app-accent)" } : undefined}
          >
            {s.pricing.annual}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                annual ? "bg-white/25 text-white" : "bg-emerald-400/20 text-emerald-300"
              }`}
            >
              {format(s.pricing.saveBadge, { percent: savingsPercent })}
            </span>
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

          <p className="mt-5 text-4xl font-black tracking-tight text-ink">{money(0, lang)}</p>
          <p className="mt-1 text-xs text-ink-3">{s.pricing.freePriceNote}</p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {/* The tweak count is filled in from the real list rather than
                written into the copy: it was hardcoded as "20" and silently
                became a lie the moment new tweaks shipped. */}
            {s.pricing.freeFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-2">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
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
          <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent2),var(--app-accent))] opacity-80" />
          <div className="relative rounded-[15px] bg-[var(--app-bg-b)] p-6">
            <span
              className="absolute -top-3 right-6 rounded-full px-3 py-1 text-[10px] font-black tracking-wide text-slate-900 shadow-lg shadow-black/40"
              style={{ backgroundColor: "var(--app-accent2)" }}
            >
              {s.pricing.mostChosen}
            </span>

            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-ink">{s.pricing.proName}</h3>
              {isPro && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {s.pricing.proCurrent}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-3">{s.pricing.proTagline}</p>

            <div className="mt-5 flex items-end gap-1.5">
              <span className="text-4xl font-black tracking-tight text-slate-50">
                {money(price, lang)}
              </span>
              <span className="pb-1.5 text-sm font-medium text-ink-3">
                {annual ? s.pricing.perYear : s.pricing.perMonth}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {annual
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
                <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-2">
                  <CheckIcon
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: "var(--app-accent2)" }}
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => onChoosePro(annual ? "annual" : "monthly")}
              disabled={isPro}
              className="mt-6 w-full rounded-xl bg-[linear-gradient(to_right,var(--app-accent),var(--app-accent2))] py-3 text-sm font-bold text-slate-900 transition-transform hover:scale-[1.02] disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100"
            >
              {isPro ? s.pricing.proCurrent : s.pricing.proCta}
            </button>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-lg text-center text-xs leading-relaxed text-ink-3">
        {s.pricing.reassurance}
      </p>
    </div>
  );
}
