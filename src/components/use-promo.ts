import { useEffect, useState } from "react";
import { API_BASE_URL } from "../lib";
import { msUntil, parsePromo, previewPromo, Promo, PromoOffer } from "../promo";

/** The current promotion, re-read every five minutes and on focus. It hides
 *  itself at the deadline even if the server cannot be reached; any failure
 *  simply shows regular prices. */
export function usePromo() {
  const preview = import.meta.env.DEV ? import.meta.env.VITE_PROMO_PREVIEW : undefined;
  const [received, setReceived] = useState<{ promo: Promo; at: number } | null>(null);
  const [now, setNow] = useState(() => performance.now());

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
      if (!disposed) setReceived(promo ? { promo, at: performance.now() } : null);
    }
    void read();
    const refresh = window.setInterval(() => void read(), 5 * 60_000);
    const tick = window.setInterval(() => setNow(performance.now()), 15_000);
    window.addEventListener("focus", read);
    return () => {
      disposed = true;
      window.clearInterval(refresh);
      window.clearInterval(tick);
      window.removeEventListener("focus", read);
    };
  }, [preview]);

  const promo = received?.promo ?? null;
  const elapsed = received ? now - received.at : 0;
  const live = Boolean(promo && msUntil(promo, promo.endsAt, elapsed) > 0);
  const started = Boolean(live && promo && msUntil(promo, promo.startsAt, elapsed) <= 0);
  const active = started && promo?.status === "active";
  return {
    promo: live ? promo : null,
    active,
    /** Known start, no prices yet: the only thing shown is the date. */
    upcoming: live && !started,
    preview: Boolean(preview),
    offer(product: string, plan: string): PromoOffer | null {
      return (
        (active && promo?.offers.find((o) => o.product === product && o.plan === plan)) || null
      );
    },
  };
}
