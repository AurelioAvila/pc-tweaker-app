import { localeOf } from "./i18n";
import type { ProductPlan } from "./types";

export type PlanWords = {
  freeName: string;
  proName: string;
  planLifetime: string;
  planAnnual: string;
  planMonthly: string;
  planBonus: string;
  planUntil: string;
};

/** One product's plan in the account menu, named like the plans on the
 *  pricing screen: Free without a purchase, Pro with its billing period, or
 *  Lifetime. A dated plan also says the day it runs until. */
export function productPlanLabel(
  p: ProductPlan,
  words: PlanWords,
  lang: string,
): { label: string; until: string | null } {
  if (!p.active) return { label: words.freeName, until: null };
  if (p.plan === "lifetime") return { label: words.planLifetime, until: null };
  const period =
    p.plan === "monthly" ? words.planMonthly : p.plan === "annual" ? words.planAnnual : null;
  const label =
    p.plan === "lifetime_bonus"
      ? words.planBonus
      : period
        ? `${words.proName} · ${period}`
        : words.proName;
  const end = p.expiresAt ? new Date(p.expiresAt) : null;
  if (!end || !Number.isFinite(end.getTime())) return { label, until: null };
  const locale = localeOf(lang) ?? lang;
  const text = words.planUntil.replace(
    "{date}",
    end.toLocaleDateString(locale, { dateStyle: "medium" }),
  );
  return { label, until: text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) };
}
