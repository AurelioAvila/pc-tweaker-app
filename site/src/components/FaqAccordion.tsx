import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { EASE, riseChild, staggerParent, viewportOnce } from "../motion";

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="border-t border-white/5 px-5 py-24 md:px-12">
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
          <span className="text-accent">{text.faq.tag.split(" / ")[0]}</span> /{" "}
          {text.faq.tag.split(" / ")[1]}
        </motion.div>
        <motion.h2
          variants={riseChild}
          className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold tracking-tight text-[var(--fg)]"
        >
          {text.faq.title}
        </motion.h2>

        <motion.div variants={riseChild} className="mt-12 max-w-3xl">
          {text.faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-b border-white/5">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-5 py-6 text-left text-[16.5px] font-semibold text-[var(--fg)]"
                >
                  {item.q}
                  <motion.span
                    animate={{
                      rotate: isOpen ? 45 : 0,
                      color: isOpen ? "var(--accent)" : "var(--fg-dim)",
                    }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="font-mono-t shrink-0 text-[18px]"
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.55, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-6 text-[14.5px] leading-relaxed text-[var(--fg-dim)]">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
}
