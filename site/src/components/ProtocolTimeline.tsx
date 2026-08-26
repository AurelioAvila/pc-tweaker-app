import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { EASE, riseChild, staggerParent, viewportOnce } from "../motion";

export function ProtocolTimeline() {
  return (
    <section id="protocol" className="border-t border-white/5 px-5 py-24 md:px-12">
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
          <span className="text-accent">{text.protocol.tag.split(" / ")[0]}</span> /{" "}
          {text.protocol.tag.split(" / ")[1]}
        </motion.div>
        <motion.h2
          variants={riseChild}
          className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold tracking-tight text-[var(--fg)]"
        >
          {text.protocol.title}
        </motion.h2>

        <div className="relative mt-16">
          <div className="absolute top-2 bottom-2 left-[27px] w-px bg-white/5" />
          {text.protocol.steps.map((s, i) => (
            <motion.div
              key={s.mono}
              className="relative grid grid-cols-[56px_1fr] gap-7 pb-14 last:pb-0"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.85, ease: EASE }}
            >
              <motion.div
                className="font-mono-t z-10 grid h-14 w-14 place-items-center rounded-xl border bg-[var(--bg-2)] text-[14px] font-bold"
                initial={{
                  borderColor: "rgba(255,255,255,0.05)",
                  color: "var(--fg-dim)",
                  boxShadow: "none",
                }}
                whileInView={{
                  borderColor: "var(--accent)",
                  color: "var(--accent)",
                  boxShadow: "0 0 28px var(--accent-glow)",
                }}
                viewport={{ once: true, amount: 0.9 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
              >
                {String(i + 1).padStart(2, "0")}
              </motion.div>
              <div>
                <div className="font-mono-t mb-2 text-[11px] tracking-[0.14em] text-[var(--fg-dim)]">
                  {s.mono}
                </div>
                <h3 className="font-display mb-2 text-[20px] font-bold tracking-tight text-[var(--fg)]">
                  {s.title}
                </h3>
                <p className="max-w-2xl text-[14.5px] leading-relaxed text-[var(--fg-dim)]">
                  {s.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
