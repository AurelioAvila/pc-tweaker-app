import { useEffect, useState } from "react";
import { API_BASE } from "./constants";
import { euro, usePromo } from "./promo";
// Shared with the desktop app, so the site and the app read the server alike.
import { parsePriceList, trialOffer, type BillingProduct, type PriceList } from "../../src/trial";
import { TRIAL_COPY } from "../../src/components/trial-copy";

/** The public price list, read after hydration: the prerendered page never
 *  claims a trial, and a failed read simply shows none. */
function usePriceList(): PriceList | null {
  const [prices, setPrices] = useState<PriceList | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/billing/prices`, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => setPrices(parsePriceList(v)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return prices;
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));

/** "Start 3-day free trial in the app. Then €59.99 a year, first charge on
 *  October 17, 2026. Cancel anytime from the billing portal." Only while the
 *  server offers trials, with the server's price and any live offer. */
export function TrialLine({
  product,
  plan,
  className,
}: {
  product: BillingProduct;
  plan: "monthly" | "annual";
  className?: string;
}) {
  const prices = usePriceList();
  const promo = usePromo();
  const offer = promo.offer(product, plan);
  const trial = trialOffer(product, plan, prices, null, offer?.regular);
  if (!trial) return null;
  const t = TRIAL_COPY.en;
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
    new Date(Date.now() + trial.days * 86_400_000),
  );
  const line = fill(
    offer ? (plan === "annual" ? t.thenYearPromo : t.thenMonthPromo) : plan === "annual" ? t.thenYear : t.thenMonth,
    { price: euro(offer ? offer.price : trial.amount), regular: euro(trial.amount), date },
  );
  return (
    <p className={className}>
      <strong className="text-[var(--fg)]">{fill(t.start, { days: trial.days })} in the app.</strong> {line}
    </p>
  );
}
