import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { riseChild, staggerParent, viewportOnce } from "../motion";
import { Link } from "../router";

const SPAN_CLASS = { 2: "md:col-span-2", 3: "md:col-span-3" } as const;

export function AudioSpotlight({ navigate }: { navigate: (to: string) => void }) {
  const a = text.audio;
  return (
    <section id="audio" className="border-t border-white/5 px-5 py-24 md:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <div className="mb-14 grid items-end gap-10 md:grid-cols-2">
          <div>
            <motion.div
              variants={riseChild}
              className="font-mono-t mb-4 text-[11.5px] tracking-[0.18em] text-[var(--fg-dim)]"
            >
              <span className="text-accent">{a.tag.split(" / ")[0]}</span> / {a.tag.split(" / ")[1]}
            </motion.div>
            <motion.h2
              variants={riseChild}
              className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-tight font-bold tracking-tight text-[var(--fg)]"
            >
              {a.title}
            </motion.h2>
          </div>
          <motion.p variants={riseChild} className="text-[15px] leading-relaxed text-[var(--fg-dim)]">
            {a.sub}
          </motion.p>
        </div>

        <div className="grid gap-4 md:grid-cols-6">
          {a.cards.map((c) => (
            <motion.div
              key={c.tag}
              variants={riseChild}
              className={`relative rounded-2xl border border-white/5 bg-[var(--bg-2)]/80 p-8 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-white/15 ${SPAN_CLASS[c.span]}`}
            >
              {c.pro && (
                <span className="bg-accent font-mono-t absolute top-6 right-6 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-[var(--on-accent)]">
                  PRO
                </span>
              )}
              <div className="font-mono-t text-accent mb-4 text-[10.5px] tracking-[0.16em]">{c.tag}</div>
              <h3 className="font-display mb-2.5 text-[19px] font-bold tracking-tight text-[var(--fg)]">{c.title}</h3>
              <p className="text-[13.8px] leading-relaxed text-[var(--fg-dim)]">{c.body}</p>
            </motion.div>
          ))}
        </div>

        <motion.div variants={riseChild} className="mt-8 flex flex-wrap gap-x-8 gap-y-1">
          {a.links.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              onNavigate={navigate}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            >
              {l.label}
            </Link>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
