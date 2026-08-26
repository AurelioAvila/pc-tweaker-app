import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { riseChild, staggerParent, viewportOnce } from "../motion";
import { DOWNLOAD_EXE } from "../constants";

export function AccessPricing() {
  const { free, pro } = text.pricing;

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

        {/* asymmetric: free is quiet, pro is a piece of élite hardware */}
        <div className="mt-14 grid max-w-4xl items-start gap-5 md:grid-cols-12">
          <motion.div
            variants={riseChild}
            className="rounded-2xl border border-white/5 bg-[var(--bg-2)] p-9 md:col-span-5"
          >
            <div className="font-mono-t mb-4 text-[12px] tracking-[0.14em] text-[var(--fg-dim)]">
              {free.plan}
            </div>
            <div className="font-display text-[44px] leading-none font-bold text-[var(--fg)]">
              {free.price}
              <span className="ml-1 text-[15px] font-medium text-[var(--fg-dim)]">{free.per}</span>
            </div>
            <ul className="my-7 grid gap-2.5">
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
            className="glow-accent relative rounded-2xl border p-10 md:col-span-7"
            style={{
              borderColor: "var(--accent-glow)",
              background: "linear-gradient(160deg, var(--bg-2) 60%, var(--accent-soft))",
            }}
          >
            <span
              className="font-mono-t text-accent absolute top-8 right-8 rounded-full border px-3 py-1 text-[10.5px] tracking-wider"
              style={{ borderColor: "var(--accent-glow)" }}
            >
              {pro.save}
            </span>
            <div className="font-mono-t mb-4 text-[12px] tracking-[0.14em] text-[var(--fg-dim)]">
              {pro.plan}
            </div>
            <div className="font-display text-[56px] leading-none font-bold text-[var(--fg)]">
              {pro.price}
              <span className="ml-1 text-[15px] font-medium text-[var(--fg-dim)]">{pro.per}</span>
            </div>
            <ul className="my-8 grid gap-2.5">
              {pro.features.map((f) => (
                <li key={f} className="relative pl-5 text-[14px] text-[var(--fg-dim)]">
                  <span className="text-accent absolute left-0">—</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={DOWNLOAD_EXE}
              className="bg-accent block rounded-xl py-4 text-center text-[15px] font-bold text-[var(--bg)] transition-transform hover:-translate-y-0.5"
            >
              {pro.cta}
            </a>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
