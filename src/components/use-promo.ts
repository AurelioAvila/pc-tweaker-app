import { useEffect, useState } from "react";
import { API_BASE_URL } from "../lib";
import { msUntil, parsePromo, previewPromo, Promo, PromoOffer, PROMO_LAYOUT_UNTIL } from "../promo";

/** The current promotion, re-read every five minutes and on focus. It hides
 *  itself at the deadline even if the server cannot be reached; any failure
 *  simply shows regular prices. */
type Clock = { perf: number; wall: number };
const clock = (): Clock => ({ perf: performance.now(), wall: Date.now() });
type Received = { promo: Promo; at: Clock } | null;
// The last answer outlives the Plans tab, so reopening it does not flash or jump.
let lastReceived: Received | undefined;

export function usePromo() {
  const preview = import.meta.env.DEV ? import.meta.env.VITE_PROMO_PREVIEW : undefined;
  const [received, setReceived] = useState<Received | undefined>(() => lastReceived);
  const [now, setNow] = useState(clock);

  useEffect(() => {
    let disposed = false;
    async function read() {
      let promo: Promo | null = null;
      try {
        if (preview) promo = previewPromo(preview, Date.now());
        else {
          const response = await fetch(`${API_BASE_URL}/api/offers/promo`, {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          });
          if (response.ok) promo = parsePromo(await response.json());
        }
      } catch {
        promo = null;
      }
      lastReceived = promo ? { promo, at: clock() } : null;
      if (!disposed) setReceived(lastReceived);
    }
    void read();
    const refresh = window.setInterval(() => void read(), 5 * 60_000);
    // One-second steps drive the visible countdown; it is computed, never reset.
    const tick = window.setInterval(() => setNow(clock()), 1000);
    window.addEventListener("focus", read);
    return () => {
      disposed = true;
      window.clearInterval(refresh);
      window.clearInterval(tick);
      window.removeEventListener("focus", read);
    };
  }, [preview]);

  const promo = received?.promo ?? null;
  // Whichever clock advanced more: a paused (sleep) or wrong clock can only shorten the offer.
  const elapsed = received ? Math.max(now.perf - received.at.perf, now.wall - received.at.wall) : 0;
  const live = Boolean(promo && msUntil(promo, promo.endsAt, elapsed) > 0);
  const started = Boolean(live && promo && msUntil(promo, promo.startsAt, elapsed) <= 0);
  const active = started && promo?.status === "active";
  return {
    promo: live ? promo : null,
    /** No answer yet during the offer window: keep the panel's room. */
    reserve: received === undefined && now.wall < PROMO_LAYOUT_UNTIL,
    active,
    /** Milliseconds to the real deadline, on the server's clock. */
    remaining: promo ? Math.max(0, msUntil(promo, promo.endsAt, elapsed)) : 0,
    preview: Boolean(preview),
    offer(product: string, plan: string): PromoOffer | null {
      return (
        (active && promo?.offers.find((o) => o.product === product && o.plan === plan)) || null
      );
    },
  };
}
