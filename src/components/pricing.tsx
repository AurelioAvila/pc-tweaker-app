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
import { CheckIcon, CrownIcon } from "./icons";

/* Design notes for anyone tempted to add another gradient here.
 *
 * This screen used to carry five of them on one card — the border, the bloom
 * behind it, the price text, a filled chip on every feature row, and the
 * button. Everything glowed, so nothing led, and the whole thing had the
 * even, decorated look of a page assembled from defaults rather than designed.
 *
 * Two remain, and each earns it: the hairline frame, which is what separates
 * the paid column from the free one at a glance, and the CTA, which is the one
 * thing on the screen you are meant to press. Everything else now gets its
 * hierarchy from size, weight and space — the price is simply large and solid,
 * feature rows are separated by hairlines rather than decorated with chips,
 * and the lifetime extras sit behind a left rule instead of wearing badges.
 */

/** One feature row. Deliberately not a filled chip: a coloured circle on every
 *  row of a list where everything is included is decoration pretending to be
 *  information, and it is the single strongest tell of a generated layout.
 *  A thin mark, one weight quieter than the text it sits beside, does the same
 *  scanning job without competing with it. */
function Feature({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "muted" | "accent" | "gold";
}) {
  const markClass =
    tone === "muted"
      ? "text-ink-3/70"
      : tone === "gold"
        ? "text-amber-300"
        : "text-[var(--app-accent2)]";
  return (
    <li className="flex items-start gap-3 py-2.5 text-[13.5px] leading-relaxed">
      <CheckIcon className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${markClass}`} />
      <span className="text-ink-2">{children}</span>
    </li>
  );
}

export function PricingPanel({
  s,
  lang,
  isPro,
  heldPlan,
  hasBilling,
  freeTweakCount,
  onChoosePro,
  onManageBilling,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  /** The plan this account's Pro came from, or null when it was granted. */
  heldPlan: string | null;
  /** Whether Stripe has a customer for this account. */
  hasBilling: boolean;
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
  const lifetime = plan === "lifetime";
  const ownsLifetime = heldPlan === "lifetime";

  const perMonthEquivalent = PRICE_ANNUAL / 12;

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg-b)]";

  // One shape for all three, so a fourth would not mean a fourth copy of it.
  const tabClass = (selected: boolean) =>
    `relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${focusRing} ${
      selected ? "text-white" : "text-ink-3 hover:text-ink-2"
    }`;
  const tabStyle = (selected: boolean) =>
    selected ? { backgroundColor: "var(--app-accent)" } : undefined;

  /** The hairline frame and the light behind it. Shared by the Pro column and
   *  the lifetime card so the paid option is recognisably the same object
   *  whichever tab you arrived from. */
  const premiumFrame = (children: React.ReactNode, wide = false) => (
    <div className="relative rounded-2xl p-px">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -z-10 rounded-[26px] blur-2xl ${
          wide ? "-inset-6 opacity-25" : "-inset-4 opacity-20"
        }`}
        style={{ background: "linear-gradient(135deg, var(--app-accent), var(--app-accent2))" }}
      />
      <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(140deg,var(--app-accent),var(--app-accent2)_55%,var(--app-accent))] opacity-80" />
      {children}
    </div>
  );

  /** The one gradient that survives besides the frame, because it is the one
   *  thing on the screen the user is meant to press. */
  const buyButton = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`w-full rounded-xl bg-[linear-gradient(to_right,var(--app-accent),var(--app-accent2))] py-3.5 text-[15px] font-bold tracking-tight text-slate-900 shadow-[0_10px_30px_-12px_var(--app-accent)] transition hover:-translate-y-px hover:brightness-110 ${focusRing}`}
    >
      {label}
    </button>
  );

  /** Price, unit, and the line under it — the same block on all three plans so
   *  switching tabs moves numbers, not layout. */
  const priceBlock = (
    amount: number,
    unit: string,
    note: string,
    { big = false, muted = false }: { big?: boolean; muted?: boolean } = {},
  ) => (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`type-data font-black leading-[0.85] tracking-[-0.045em] ${
            muted ? "text-ink-2" : "text-ink"
          } ${big ? "text-[64px]" : "text-[54px]"}`}
        >
          {money(amount, lang)}
        </span>
        <span className="pb-1.5 text-[13px] font-medium text-ink-3">{unit}</span>
      </div>
      <p className="mt-2.5 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-3">{note}</p>
    </div>
  );

  /** Rows separated by hairlines rather than floating in a gap. The rule is
   *  what turns a stack of sentences into a list you can read down. */
  const featureList = (children: React.ReactNode) => (
    <ul className="divide-y divide-line/60">{children}</ul>
  );

  return (
    <div className="animate-card">
      <div className="relative isolate text-center">
        {/* Decorative, so aria-hidden and behind everything at
            pointer-events: none. Dimmed from what it was: a wash strong enough
            to read as a graphic competes with the heading it sits behind. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-90px] -z-10 h-[260px] w-[520px] -translate-x-1/2 rounded-full opacity-25 blur-[80px]"
          style={{
            background:
              "radial-gradient(closest-side, var(--app-accent2), var(--app-accent) 45%, transparent 75%)",
          }}
        />
        <p className="type-label mb-2 tracking-[0.22em] text-ink-3">{s.pricing.eyebrow}</p>
        <h2 className="text-[36px] font-black leading-[1.05] tracking-[-0.035em] text-slate-50">
          {s.pricing.title}
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-3">
          {s.pricing.subtitle}
        </p>
      </div>

      <div className="mt-7 flex justify-center">
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
            className={tabClass(lifetime)}
            style={tabStyle(lifetime)}
          >
            <CrownIcon className={`h-3.5 w-3.5 ${lifetime ? "text-white" : "text-amber-300/70"}`} />
            {s.pricing.lifetime}
          </button>
        </div>
      </div>

      {lifetime ? (
        /* One card, not two.
         *
         * The lifetime tab used to render the same Free-versus-Pro pair as the
         * subscription tabs, so the plan the user had just asked to see was
         * labelled "Pro", sat beside a Free column nobody arrived here for,
         * and never said what it uniquely gives you. */
        <div className="mt-8">
          {premiumFrame(
            <div className="relative overflow-hidden rounded-[15px] bg-[var(--app-bg-b)] p-7">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <CrownIcon className="h-5 w-5 shrink-0 text-amber-300" />
                    <h3 className="text-[22px] font-black tracking-[-0.02em] text-ink">
                      {s.pricing.lifetimeName}
                    </h3>
                    {ownsLifetime && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-400/30">
                        {s.pricing.proCurrent}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-3">
                    {s.pricing.lifetimeTagline}
                  </p>
                </div>
                <span className="type-label shrink-0 rounded-full border border-line px-3 py-1 text-[10px] tracking-[0.14em] text-ink-3">
                  {s.pricing.oneTimeBadge}
                </span>
              </div>

              <div className="mt-7">
                {priceBlock(
                  PRICE_LIFETIME,
                  s.pricing.once,
                  format(s.pricing.lifetimeDetail, { months: LIFETIME_BREAK_EVEN_MONTHS }),
                  { big: true },
                )}
              </div>

              <div className="mt-7 grid gap-x-10 gap-y-7 border-t border-line pt-6 md:grid-cols-2">
                <div>
                  <p className="type-label text-ink-3">{s.pricing.everythingInPro}</p>
                  <div className="mt-1">
                    {featureList(
                      s.pricing.proFeatures.map((feature) => (
                        <Feature key={feature} tone="accent">
                          {feature}
                        </Feature>
                      )),
                    )}
                  </div>
                </div>

                {/* The half that justifies buying outright rather than
                    subscribing, set apart by a rule and a warmer mark instead
                    of a badge on every row. A left rule is a quieter device
                    than a chip and it groups the block as one idea, which is
                    what the reader actually needs to take away. */}
                <div className="border-l-2 border-amber-400/40 pl-5">
                  <p className="type-label flex items-center gap-1.5 text-amber-300">
                    <CrownIcon className="h-3 w-3" />
                    {s.pricing.lifetimeExclusive}
                  </p>
                  <div className="mt-1">
                    {featureList(
                      s.pricing.lifetimeFeatures.map((feature) => (
                        <Feature key={feature} tone="gold">
                          {feature}
                        </Feature>
                      )),
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-7">
                {ownsLifetime ? (
                  <p className="w-full rounded-xl border border-line bg-surface-2 py-3 text-center text-sm font-bold text-ink">
                    {s.pricing.lifetimeOwned}
                  </p>
                ) : (
                  /* "Switch" only makes sense to someone with a subscription
                     to switch away from. An account with no billing history —
                     Pro granted by hand, or no Pro at all — is simply buying. */
                  buyButton(
                    isPro && hasBilling ? s.pricing.switchToLifetime : s.pricing.lifetimeCta,
                    () => onChoosePro("lifetime"),
                  )
                )}
              </div>
            </div>,
            true,
          )}
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-5 md:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl border border-line bg-surface-1 p-7">
            <div className="flex items-center gap-2.5">
              <h3 className="text-[22px] font-black tracking-[-0.02em] text-ink-2">
                {s.pricing.freeName}
              </h3>
              {!isPro && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-ink-2">
                  {s.pricing.freeCurrent}
                </span>
              )}
            </div>
            <p className="mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-3">
              {s.pricing.freeTagline}
            </p>

            {/* Same vertical offset as the Pro card's price, so the two prices
                and the two feature lists line up across the gap. Comparing is
                the entire job of putting them side by side. */}
            <div className="mt-7">
              {priceBlock(0, "", s.pricing.freePriceNote, { muted: true })}
            </div>

            <div className="mt-7 border-t border-line pt-4">
              <p className="type-label text-ink-3">{s.pricing.included}</p>
              <div className="mt-1">
                {featureList(
                  /* The tweak count is filled in from the real list rather
                     than written into the copy: it was hardcoded as "20" and
                     silently became a lie the moment new tweaks shipped. */
                  s.pricing.freeFeatures.map((feature) => (
                    <Feature key={feature} tone="muted">
                      {format(feature, { count: freeTweakCount })}
                    </Feature>
                  )),
                )}
              </div>
            </div>

            {/* Only claim they're on Free when they actually are — a Pro user
                seeing "you're on the Free plan" would reasonably think their
                payment didn't go through. */}
            {!isPro && (
              <p className="mt-7 rounded-xl bg-surface-2 py-3 text-center text-sm font-medium text-ink-3">
                {s.pricing.freeCta}
              </p>
            )}
          </div>

          {/* Pro */}
          {premiumFrame(
            <>
              {/* Only on the annual plan: a badge that labels every option
                  labels none of them. Rendered on this wrapper rather than
                  inside the card body, which clips its contents — at -top-3
                  the badge sits outside the card edge on purpose and would
                  otherwise be cut in half. */}
              {annual && (
                <span
                  className="absolute -top-3 right-6 z-10 rounded-full px-3 py-1 text-[10px] font-black tracking-wide text-slate-900 shadow-lg shadow-black/40"
                  style={{ backgroundColor: "var(--app-accent2)" }}
                >
                  {s.pricing.mostChosen}
                </span>
              )}
              <div className="relative overflow-hidden rounded-[15px] bg-[var(--app-bg-b)] p-7">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[22px] font-black tracking-[-0.02em] text-ink">
                    {s.pricing.proName}
                  </h3>
                  {isPro && (
                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-400/30">
                      {s.pricing.proCurrent}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-3">
                  {s.pricing.proTagline}
                </p>

                <div className="mt-7">
                  {priceBlock(
                    annual ? PRICE_ANNUAL : PRICE_MONTHLY,
                    annual ? s.pricing.perYear : s.pricing.perMonth,
                    annual
                      ? format(s.pricing.annualDetail, {
                          monthly: money(perMonthEquivalent, lang),
                          yearly: money(PRICE_ANNUAL, lang),
                        })
                      : format(s.pricing.annualNudge, {
                          price: money(perMonthEquivalent, lang),
                        }),
                  )}
                </div>

                <div className="mt-7 border-t border-line pt-4">
                  <p className="type-label text-ink-3">{s.pricing.everythingInFree}</p>
                  <div className="mt-1">
                    {featureList(
                      s.pricing.proFeatures.map((feature) => (
                        <Feature key={feature} tone="accent">
                          {feature}
                        </Feature>
                      )),
                    )}
                  </div>
                </div>

                {/* Three different Pro accounts end up here and only one of
                    them has anything to manage. A lifetime purchase has no
                    subscription to change, and Pro granted by hand has no
                    Stripe customer at all — both used to be shown a button
                    whose only possible outcome was an error message. The
                    lifetime upsell that used to live here has moved to the
                    lifetime tab, where it now has a card of its own. */}
                <div className="mt-7">
                  {!isPro ? (
                    buyButton(s.pricing.proCta, () => onChoosePro(plan))
                  ) : ownsLifetime || !hasBilling ? (
                    <p className="w-full rounded-xl border border-line bg-surface-2 py-3 text-center text-sm font-bold text-ink">
                      {ownsLifetime ? s.pricing.lifetimeOwned : s.pricing.proActiveNoBilling}
                    </p>
                  ) : (
                    <button
                      onClick={onManageBilling}
                      className={`w-full rounded-xl border border-line bg-surface-2 py-3 text-sm font-bold text-ink transition-colors hover:bg-surface-1 ${focusRing}`}
                    >
                      {s.pricing.manageBilling}
                    </button>
                  )}
                </div>
              </div>
            </>,
          )}
        </div>
      )}

      <p className="mx-auto mt-7 max-w-[58ch] text-center text-[12.5px] leading-relaxed text-ink-3">
        {s.pricing.reassurance}
      </p>
    </div>
  );
}
