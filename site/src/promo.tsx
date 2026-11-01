import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { API_BASE } from "./constants";
import { getRouteJsonLd } from "./seo";
import { HalloweenCard, HalloweenStrip } from "../../src/components/halloween-offer";
// Shared with the desktop app, so both read the server's offer the same way.
import { msUntil, parsePromo, previewPromo, promoPercent, PROMO_LAYOUT_UNTIL, type Promo, type PromoOffer } from "../../src/promo";

/** The live promotion, fetched after hydration: the prerendered page always
 *  carries regular prices, and any failure leaves them in place. */
function usePromoState() {
  const clock = () => ({ perf: performance.now(), wall: Date.now() });
  // undefined until the server has answered once: the panel's room is kept meanwhile.
  const [received, setReceived] = useState<{ promo: Promo; at: ReturnType<typeof clock> } | null | undefined>(undefined);
  const [now, setNow] = useState(clock);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
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
    // The first render matches the prerendered page; the deadline check waits for mount.
    reserve: received === undefined && (!mounted || now.wall < PROMO_LAYOUT_UNTIL),
    remaining: active && promo ? msUntil(promo, promo.endsAt, elapsed) : 0,
    offer: (product: string, plan: string): PromoOffer | null =>
      (active && promo?.offers.find((o) => o.product === product && o.plan === plan)) || null,
  };
}

type PromoState = ReturnType<typeof usePromoState>;
const PromoContext = createContext<PromoState | null>(null);

/** One fetch and one clock for the strip, the hero card, the plans and the Uninstaller page. */
export function PromoProvider({ children }: { children: ReactNode }) {
  return <PromoContext.Provider value={usePromoState()}>{children}</PromoContext.Provider>;
}

export function usePromo(): PromoState {
  const v = useContext(PromoContext);
  if (!v) throw new Error("usePromo needs <PromoProvider>");
  return v;
}

export const euro = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** Struck lowest-30-day price with the real percentage as a solid badge, then
 *  the promotional price on its own line, as the card's largest text. */
export function PromoPrice({ offer, className }: { offer: PromoOffer; className?: string }) {
  return (
    <span className={`block ${className ?? ""}`}>
      <span className="mb-3 flex items-center gap-3 font-sans text-[20px] leading-none">
        <s className="font-semibold text-[var(--fg-dim)] decoration-2">{euro(offer.reference)}</s>
        <span className="bg-accent -rotate-3 rounded-lg px-2.5 py-1.5 text-[19px] font-extrabold tracking-tight text-[var(--on-accent)] shadow-[0_8px_22px_-8px_var(--accent)]">
          −{promoPercent(offer)}%
        </span>
      </span>
      <span className="block">{euro(offer.price)}</span>
    </span>
  );
}

/** "Halloween offer · ends 6 Nov, 23:59 CET", in the visitor's own time zone. */
export function PromoDeadline({ className }: { className?: string }) {
  const { promo } = usePromo();
  const copy = useCopy();
  if (!promo) return null;
  const end = new Intl.DateTimeFormat(copy.locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(Date.parse(promo.endsAt) - 60_000));
  return (
    <span className={className}>
      <strong className="text-accent font-bold">{copy.kicker}</strong> · {copy.ends(end)}
    </span>
  );
}

export function promoTerms(offer: PromoOffer) {
  return offer.firstPeriodOnly
    ? `first ${offer.plan === "monthly" ? "month" : "year"}, then ${euro(offer.regular)} / ${offer.plan === "monthly" ? "month" : "year"}`
    : "once · no renewal";
}

/** Copy for the offer pieces. The site itself is English-only today; these follow
 *  <html lang> so a European Portuguese version shows pt-PT without further work. */
const COPY = {
  en: {
    locale: "en-GB",
    kicker: "Halloween offer",
    strip: (pct: number) => `Halloween offer · ${pct}% off`,
    stripShort: (pct: number) => `Halloween · ${pct}% off`,
    endsIn: "Ends in",
    units: ["Days", "Hours", "Minutes", "Seconds"] as [string, string, string, string],
    cta: "See the offer",
    close: "Dismiss the Halloween offer banner",
    tag: "HALLOWEEN",
    lifetime: "Lifetime · one payment",
    firstYear: (then: string) => `First year, then ${then} / year`,
    ends: (d: string) => `Ends ${d}`,
    fine: "Struck-through prices are our lowest in the 30 days before the offer. Prices exclude VAT.",
  },
  pt: {
    locale: "pt-PT",
    kicker: "Oferta de Halloween",
    strip: (pct: number) => `Oferta de Halloween · ${pct}% de desconto`,
    stripShort: (pct: number) => `Halloween · −${pct}%`,
    endsIn: "Termina em",
    units: ["Dias", "Horas", "Minutos", "Segundos"] as [string, string, string, string],
    cta: "Ver a oferta",
    close: "Fechar o aviso da oferta de Halloween",
    tag: "HALLOWEEN",
    lifetime: "Vitalício · pagamento único",
    firstYear: (then: string) => `Primeiro ano, depois ${then} / ano`,
    ends: (d: string) => `Termina a ${d}`,
    fine: "Os preços riscados são os mais baixos dos 30 dias anteriores à oferta. Preços sem IVA.",
  },
};

/** English until mounted, so the prerendered page and first client render match. */
function useCopy() {
  const [lang, setLang] = useState<"en" | "pt">("en");
  useEffect(() => {
    const q = import.meta.env.DEV ? new URLSearchParams(location.search).get("lang") : null;
    const l = (q || document.documentElement.lang || "en").toLowerCase();
    setLang(l.startsWith("pt") ? "pt" : "en");
  }, []);
  return COPY[lang];
}

/** The deadline in the visitor's own time zone, named so it cannot be misread. */
function endLine(endsAt: string, c = COPY.en) {
  const end = new Intl.DateTimeFormat(c.locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(Date.parse(endsAt) - 60_000));
  const zone = new Intl.DateTimeFormat(c.locale, { timeZoneName: "short" })
    .formatToParts(new Date(endsAt))
    .find((p) => p.type === "timeZoneName")?.value;
  return c.ends(`${end}${zone ? ` ${zone}` : ""}`);
}

/** The smallest real discount among PC Tweaker's offers: the headline never claims more. */
function headlinePercent(promo: Promo) {
  const own = promo.offers.filter((o) => o.product === "pctweaker");
  const list = own.length ? own : promo.offers;
  return list.length ? Math.min(...list.map(promoPercent)) : 0;
}

/** Holds a piece's exact room, invisible, while the first answer is pending, so the
 *  page does not jump when the offer arrives. Placeholder text only, never a price. */
function Reserved({ children }: { children: ReactNode }) {
  return (
    <div style={{ visibility: "hidden" }} aria-hidden="true">
      {children}
    </div>
  );
}

/** Top-of-page strip, rendered by the nav; nothing without a live offer. */
export function PromoStrip({ href }: { href: string }) {
  const { promo, remaining, reserve } = usePromo();
  const c = useCopy();
  if (!promo && reserve)
    return (
      <Reserved>
        <div style={{ height: 40 }} />
      </Reserved>
    );
  if (!promo) return null;
  const pct = headlinePercent(promo);
  if (pct < 1) return null;
  return <HalloweenStrip key={promo.id} label={c.strip(pct)} shortLabel={c.stripShort(pct)} endsIn={c.endsIn} units={c.units} remaining={remaining} cta={c.cta} href={href} closeLabel={c.close} storageKey={`pct-hw-strip:${promo.id}`} />;
}

/** Offer card for a page headline: struck reference and promo price, from the server.
 *  Home: PC Tweaker Lifetime. Uninstaller page: its Pro year. */
export function PromoCard({ product = "pctweaker", plan = "lifetime", href = "#access" }: { product?: string; plan?: string; href?: string }) {
  const { promo, offer, reserve } = usePromo();
  const c = useCopy();
  const o = offer(product, plan);
  if (!promo && reserve)
    return (
      <Reserved>
        <HalloweenCard tag=" " plan=" " was="" now=" " pct="" note=" " cta="" href={href} />
      </Reserved>
    );
  if (!promo || !o) return null;
  return (
    <HalloweenCard
      tag={c.tag}
      plan={o.firstPeriodOnly ? c.firstYear(euro(o.regular)) : c.lifetime}
      was={euro(o.reference)}
      now={euro(o.price)}
      pct={`−${promoPercent(o)}%`}
      note={endLine(promo.endsAt, c)}
      cta={c.cta}
      href={href}
    />
  );
}

/** The note that belongs with struck prices, under the plans. While the first answer is
 *  pending it only holds its line, so the plans below do not move. */
export function PromoFine({ className = "" }: { className?: string }) {
  const { promo, reserve } = usePromo();
  const c = useCopy();
  if (!promo && !reserve) return null;
  return (
    <p className={className} style={promo ? undefined : { visibility: "hidden" }} aria-hidden={promo ? undefined : true}>
      {c.fine}
    </p>
  );
}

/** Keep route identity and prices current during client-side navigation,
 *  promotion expiry and offer refreshes, without an extra network request. */
export function RouteStructuredData({ path }: { path: string }) {
  const { promo } = usePromo();
  useEffect(() => {
    document.querySelectorAll('script[data-ld="route"]').forEach((node) => node.remove());
    const scripts = getRouteJsonLd(path, promo).map((payload) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.ld = "route";
      script.textContent = JSON.stringify(payload);
      document.head.appendChild(script);
      return script;
    });
    return () => scripts.forEach((script) => script.remove());
  }, [path, promo]);
  return null;
}
