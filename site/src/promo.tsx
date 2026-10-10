import { useEffect, useState } from "react";
import { API_BASE } from "./constants";
import { HalloweenOfferBanner } from "../../src/components/halloween-offer";
// Shared with the desktop app, so both read the server's offer the same way.
import { msUntil, parsePromo, previewPromo, promoPercent, PROMO_LAYOUT_UNTIL, type Promo, type PromoOffer } from "../../src/promo";

/** The live promotion, fetched after hydration: the prerendered page always
 *  carries regular prices, and any failure leaves them in place. */
export function usePromo() {
  const clock = () => ({ perf: performance.now(), wall: Date.now() });
  // undefined until the server has answered once: the panel's room is kept meanwhile.
  const [received, setReceived] = useState<{ promo: Promo; at: ReturnType<typeof clock> } | null | undefined>(undefined);
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const preview = import.meta.env.DEV ? import.meta.env.VITE_PROMO_PREVIEW : undefined;
    const accept = (promo: Promo | null) => setReceived(promo ? { promo, at: clock() } : null);
    let controller = new AbortController();
    const read = () => {
      if (preview) return accept(previewPromo(preview, Date.now()));
      controller.abort();
      controller = new AbortController();
      fetch(`${API_BASE}/api/offers/promo`, { cache: "no-store", signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => accept(parsePromo(v)))
        .catch((e) => e?.name !== "AbortError" && accept(null));
    };
    // A tab left open (or a laptop asleep) through the deadline or a manual stop re-reads on return.
    const onVisible = () => document.visibilityState === "visible" && read();
    read();
    // One-second steps drive the countdown; it is computed from the real deadline, never reset.
    const tick = window.setInterval(() => setNow(clock()), 1000);
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(tick);
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const promo = received?.promo ?? null;
  // Whichever clock advanced more: a wrong or paused clock can only shorten the offer.
  const elapsed = received ? Math.max(now.perf - received.at.perf, now.wall - received.at.wall) : 0;
  const active =
    promo?.status === "active" &&
    msUntil(promo, promo.startsAt, elapsed) <= 0 &&
    msUntil(promo, promo.endsAt, elapsed) > 0;
  return {
    promo: active ? promo : null,
    /** Room for the panel while the first answer is pending, during the offer window only. */
    reserve: received === undefined && now.wall < PROMO_LAYOUT_UNTIL,
    remaining: active && promo ? msUntil(promo, promo.endsAt, elapsed) : 0,
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

const UNITS: [string, string, string, string] = ["Days", "Hours", "Minutes", "Seconds"];
const FINE = "Struck-through prices are our lowest in the 30 days before the offer. Prices exclude VAT.";

/** The deadline in the visitor's own time zone, named so it cannot be misread. */
function endLine(endsAt: string) {
  const end = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(new Date(Date.parse(endsAt) - 60_000));
  const zone = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" })
    .formatToParts(new Date(endsAt))
    .find((p) => p.type === "timeZoneName")?.value;
  return `Ends ${end}${zone ? ` ${zone}` : ""}`;
}

/** Same banner as the desktop app, above the plans. */
export function PromoBanner({ promo, remaining }: { promo: Promo; remaining: number }) {
  return (
    <HalloweenOfferBanner kicker="Halloween offer" heading={endLine(promo.endsAt)} fine={FINE} endsIn="Ends in" units={UNITS} remaining={remaining} />
  );
}

/** An invisible copy of the banner, holding its exact place until the server answers.
 *  Rome time, so the prerendered page and the browser render the same text. */
export function PromoPlaceholder() {
  const end = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Rome" }).format(PROMO_LAYOUT_UNTIL - 60_000);
  return <HalloweenOfferBanner reserved kicker="Halloween offer" heading={`Ends ${end} CET`} fine={FINE} endsIn="Ends in" units={UNITS} remaining={0} />;
}
