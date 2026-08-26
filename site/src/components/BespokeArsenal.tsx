import type { MouseEvent } from "react";
import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { riseChild, staggerParent, viewportOnce } from "../motion";

const SPAN_CLASS: Record<"wide" | "tall" | "std", string> = {
  wide: "md:col-span-4",
  tall: "md:col-span-2 md:row-span-2",
  std: "md:col-span-2",
};

function onCardMove(e: MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

export function BespokeArsenal() {
  return (
    <section id="arsenal" className="border-t border-white/5 px-5 py-24 md:px-12">
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
          <span className="text-accent">{text.arsenal.tag.split(" / ")[0]}</span> /{" "}
          {text.arsenal.tag.split(" / ")[1]}
        </motion.div>
        <motion.h2
          variants={riseChild}
          className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold tracking-tight text-[var(--fg)]"
        >
          {text.arsenal.title}
        </motion.h2>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          {text.arsenal.cards.map((c) => (
            <motion.div
              key={c.tag}
              variants={riseChild}
              onMouseMove={onCardMove}
              className={`card-glow group relative rounded-2xl border border-white/5 bg-[var(--bg-2)]/80 p-8 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-white/15 ${SPAN_CLASS[c.span]}`}
            >
              {c.pro && (
                <span className="bg-accent font-mono-t absolute top-6 right-6 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-[var(--bg)]">
                  PRO
                </span>
              )}
              <div className="font-mono-t text-accent mb-4 text-[10.5px] tracking-[0.16em]">
                {c.tag}
              </div>
              <h3 className="font-display mb-2.5 text-[19px] font-bold tracking-tight text-[var(--fg)]">
                {c.title}
              </h3>
              <p className="text-[13.8px] leading-relaxed text-[var(--fg-dim)]">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
