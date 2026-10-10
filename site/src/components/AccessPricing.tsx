import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { riseChild, staggerParent, viewportOnce } from "../motion";
import { DOWNLOAD_EXE } from "../constants";
import { euro, PromoBanner, PromoPlaceholder, PromoPrice, promoTerms, usePromo } from "../promo";

export function AccessPricing() {
  const { free, pro, lifetime } = text.pricing;
  const promo = usePromo();
  const annualOffer = promo.offer("pctweaker", "annual");
  const monthlyOffer = promo.offer("pctweaker", "monthly");
  const lifetimeOffer = promo.offer("pctweaker", "lifetime");

  return (
    <section id="access" className="border-t border-white/5 px-5 py-24 md:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.div
          variants={riseChild}
          className="font-mono-t mb-4 text-[11.5px] tracking-[0.18em] text-[var(--fg-dim)]"
        >
          <span className="text-accent">{text.pricing.tag.split(" / ")[0]}</span> /{" "}
          {text.pricing.tag.split(" / ")[1]}
        </motion.div>
        <motion.h2
          variants={riseChild}
          className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold tracking-tight text-[var(--fg)]"
        >
          {text.pricing.title}
        </motion.h2>

        {(promo.promo || promo.reserve) && (
          <div className="mt-10">
            {promo.promo ? <PromoBanner promo={promo.promo} remaining={promo.remaining} /> : <PromoPlaceholder />}
          </div>
        )}

        {/* Free and Pro are quiet; Lifetime, the plan most buyers choose, carries
            the accent. */}
        <div className={`${promo.promo || promo.reserve ? "mt-6" : "mt-14"} grid items-stretch gap-5 pt-3 md:grid-cols-3`}>
          <motion.div
            variants={riseChild}
            className="flex flex-col rounded-2xl border border-white/5 bg-[var(--bg-2)] p-9"
          >
            <div className="font-mono-t mb-4 text-[12px] tracking-[0.14em] text-[var(--fg-dim)]">
              {free.plan}
            </div>
            <div className="font-display text-[44px] leading-none font-bold text-[var(--fg)]">
              {free.price}
            </div>
            <div className="mt-2 text-[13px] text-[var(--fg-dim)]">{free.per}</div>
            <ul className="my-7 grid flex-1 content-start gap-2.5">
              {free.features.map((f) => (
                <li key={f} className="relative pl-5 text-[14px] text-[var(--fg-dim)]">
                  <span className="text-accent absolute left-0">—</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={DOWNLOAD_EXE}
              className="block rounded-xl border border-white/10 py-3.5 text-center text-[14.5px] font-semibold text-[var(--fg)] transition-colors hover:border-white/25"
            >
              {free.cta}
            </a>
          </motion.div>

          <motion.div
            variants={riseChild}
            className="relative flex flex-col rounded-2xl border border-white/10 bg-[var(--bg-2)] p-9"
          >
            <span
              className="font-mono-t text-accent absolute top-8 right-8 rounded-full border px-3 py-1 text-[10.5px] tracking-wider"
              style={{ borderColor: "var(--accent-glow)" }}
            >
              {annualOffer ? "HALLOWEEN" : pro.save}
            </span>
            <div className="font-mono-t mb-4 text-[12px] tracking-[0.14em] text-[var(--fg-dim)]">
              {pro.plan}
            </div>
            <div className="font-display text-[44px] leading-none font-bold text-[var(--fg)]">
              {annualOffer ? <PromoPrice offer={annualOffer} /> : pro.price}
            </div>
            <div className="mt-2 text-[13px] text-[var(--fg-dim)]">
              {annualOffer
                ? `/ ${promoTerms(annualOffer)}${monthlyOffer ? ` · Monthly: ${euro(monthlyOffer.price)} for the first month, then ${euro(monthlyOffer.regular)}` : ""}`
                : pro.per}
            </div>
            <ul className="my-7 grid flex-1 content-start gap-2.5">
              {pro.features.map((f) => (
                <li key={f} className="relative pl-5 text-[14px] text-[var(--fg-dim)]">
                  <span className="text-accent absolute left-0">—</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={DOWNLOAD_EXE}
              className="block rounded-xl border border-white/20 py-3.5 text-center text-[14.5px] font-semibold text-[var(--fg)] transition-colors hover:border-white/40"
            >
              {pro.cta}
            </a>
          </motion.div>

          <motion.div
            variants={riseChild}
            className="glow-accent relative flex flex-col rounded-2xl border p-9"
            style={{
              borderColor: "var(--accent-glow)",
              background: "linear-gradient(160deg, var(--bg-2) 60%, var(--accent-soft))",
            }}
          >
            <span
              className="font-mono-t bg-accent absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10.5px] font-bold tracking-[0.14em] whitespace-nowrap text-[var(--bg)]"
              style={{ boxShadow: "0 0 0 4px var(--bg), 0 8px 22px -8px var(--accent)" }}
            >
              <span aria-hidden="true">✦</span>
              {lifetime.badge}
            </span>
            <div className="font-mono-t mb-4 text-[12px] tracking-[0.14em] text-[var(--fg-dim)]">
              {lifetime.plan}
            </div>
            <div className="font-display text-[44px] leading-none font-bold text-[var(--fg)]">
              {lifetimeOffer ? <PromoPrice offer={lifetimeOffer} /> : lifetime.price}
            </div>
            <div className="mt-2 text-[13px] text-[var(--fg-dim)]">{lifetime.per}</div>
            <ul className="my-7 grid flex-1 content-start gap-2.5">
              {lifetime.features.map((f) => (
                <li key={f} className="relative pl-5 text-[14px] text-[var(--fg-dim)]">
                  <span className="text-accent absolute left-0">—</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={DOWNLOAD_EXE}
              className="bg-accent block rounded-xl border border-transparent py-3.5 text-center text-[14.5px] font-bold text-[var(--bg)] transition-transform hover:-translate-y-0.5"
            >
              {lifetime.cta}
            </a>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
