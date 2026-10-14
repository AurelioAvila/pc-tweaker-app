/**
 * The one place that decides which plan wears the "Most chosen" badge. The app
 * (Plans & pricing) and the website pricing section both read it; change the
 * plan here and every surface follows. Remove a product's entry and it shows
 * no badge at all.
 *
 * "Most chosen" is a claim about purchases, so it only goes on the plan that
 * actually sold most. Evidence: paid, non-refunded Stripe Checkout sessions in
 * live mode on 2026-10-14, free grants and the "Buy me a coffee" tip excluded
 * (first purchase 2026-08-24, so last 90 days = all time):
 *
 *   PC Tweaker   Lifetime 7 · Pro monthly 6 · Pro annual 3
 *   Uninstaller  Pro annual 1 (no other paid plan exists)
 *   Tweaky       none yet
 *
 * Lifetime is the best-selling single plan. Counted as one "Pro" tier, monthly
 * plus annual would be 9 against 7, so re-check before the next change. The
 * Uninstaller and Tweaky Driver have too few purchases to claim anything and
 * keep their "Recommended" label.
 */
export type SoldPlan = "monthly" | "annual" | "lifetime";

export const MOST_CHOSEN: Readonly<Partial<Record<"pctweaker", SoldPlan>>> = {
  pctweaker: "lifetime",
};
