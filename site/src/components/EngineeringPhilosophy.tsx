import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { riseChild, staggerParent, viewportOnce } from "../motion";

const KIND_CLASS: Record<"comment" | "plain" | "strong" | "accent", string> = {
  comment: "text-[var(--line-2)]",
  plain: "text-[var(--fg-dim)]",
  strong: "text-[var(--fg)] font-bold",
  accent: "text-accent",
};

export function EngineeringPhilosophy() {
  return (
    <section className="border-t border-white/5 bg-[var(--bg-2)] px-5 py-28 md:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.div variants={riseChild} className="font-mono-t mb-10 text-[11.5px] tracking-[0.18em] text-[var(--fg-dim)]">
          <span className="text-accent">{text.philosophy.tag.split(" / ")[0]}</span> / {text.philosophy.tag.split(" / ")[1]}
        </motion.div>

        <div className="font-mono-t text-[clamp(1.05rem,2.4vw,1.7rem)] leading-[1.55] font-medium tracking-tight">
          {text.philosophy.lines.map((line, i) =>
            line.text === "" ? (
              <div key={i} className="h-6" />
            ) : (
              <motion.div key={i} variants={riseChild} className={KIND_CLASS[line.kind]}>
                {line.text}
              </motion.div>
            ),
          )}
        </div>
      </motion.div>
    </section>
  );
}
