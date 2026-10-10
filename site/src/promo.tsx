import { useEffect, useState } from "react";
import { API_BASE } from "./constants";
// Shared with the desktop app, so both read the server's offer the same way.
import { msUntil, parsePromo, previewPromo, promoPercent, type Promo, type PromoOffer } from "../../src/promo";

/** The live promotion, fetched after hydration: the prerendered page always
 *  carries regular prices, and any failure leaves them in place. */
export function usePromo() {
  const [received, setReceived] = useState<{ promo: Promo; at: number } | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const preview = import.meta.env.DEV ? import.meta.env.VITE_PROMO_PREVIEW : undefined;
    const accept = (promo: Promo | null) => promo && setReceived({ promo, at: performance.now() });
    const controller = new AbortController();
    if (preview) accept(previewPromo(preview, Date.now()));
    else
      fetch(`${API_BASE}/api/offers/promo`, { cache: "no-store", signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => accept(parsePromo(v)))
        .catch(() => {});
    const tick = window.setInterval(() => setNow(performance.now()), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(tick);
    };
  }, []);
  const promo = received?.promo ?? null;
  const elapsed = received ? now - received.at : 0;
  const active =
    promo?.status === "active" &&
    msUntil(promo, promo.startsAt, elapsed) <= 0 &&
    msUntil(promo, promo.endsAt, elapsed) > 0;
  return {
    promo: active ? promo : null,
    offer: (product: string, plan: string): PromoOffer | null =>
      (active && promo?.offers.find((o) => o.product === product && o.plan === plan)) || null,
  };
}

export const euro = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** Struck lowest-30-day price, promotional price and the real percentage. */
export function PromoPrice({ offer, className }: { offer: PromoOffer; className?: string }) {
  return (
    <span className={className}>
      <s className="mr-3 align-middle text-[0.45em] font-medium text-[var(--fg-dim)]">{euro(offer.reference)}</s>
      {euro(offer.price)}
      <span className="font-mono-t text-accent ml-3 align-middle text-[0.3em] tracking-wider">−{promoPercent(offer)}%</span>
    </span>
  );
}

export function promoTerms(offer: PromoOffer) {
  return offer.firstPeriodOnly
    ? `first ${offer.plan === "monthly" ? "month" : "year"}, then ${euro(offer.regular)} / ${offer.plan === "monthly" ? "month" : "year"}`
    : "once · no renewal";
}

/** The deadline in the visitor's own time zone, named so it cannot be misread. */
export function PromoBanner({ promo }: { promo: Promo }) {
  const percent = Math.min(...promo.offers.map(promoPercent));
  const end = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(Date.parse(promo.endsAt) - 60_000),
  );
  const zone = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" })
    .formatToParts(new Date(promo.endsAt))
    .find((p) => p.type === "timeZoneName")?.value;
  return (
    <aside
      className="flex items-start gap-4 rounded-2xl border px-6 py-5"
      style={{ borderColor: "var(--accent-glow)", background: "var(--accent-soft)" }}
      aria-label="Halloween offer"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 h-6 w-6 flex-none" style={{ color: "#f28c28" }}>
        <path d="M12 7.5c-1.6-1-4.4-1.2-6.2.4C3.6 9.8 3.4 14 4.6 16.6c1.3 2.8 4.3 3.6 7.4 2.6 3.1 1 6.1.2 7.4-2.6 1.2-2.6 1-6.8-1.2-8.7-1.8-1.6-4.6-1.4-6.2-.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 7.5c-1.3 2.4-1.3 9.3 0 11.7m0-11.7c1.3 2.4 1.3 9.3 0 11.7M12 7.5c0-1.6.6-3 2-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-[15px] font-semibold text-[var(--fg)]">Halloween offer: {percent}% off</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--fg-dim)]">
          Ends {end}{zone ? ` ${zone}` : ""}. Struck-through prices are the lowest we charged in the 30 days before the offer
          began. Subscription discounts cover the first month or year; renewals are at the regular price. Prices exclude
          VAT, which is added at checkout where applicable.
        </p>
      </div>
    </aside>
  );
}
