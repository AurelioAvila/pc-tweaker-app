import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { Link } from "../router";
import { riseChild, staggerParent, viewportOnce } from "../motion";

export function PerformanceMetrics({ navigate }: { navigate: (to: string) => void }) {
  return (
    <section id="results" className="border-t border-white/5 px-5 py-24 md:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <div className="mb-16 grid items-end gap-10 md:grid-cols-2">
          <div>
            <motion.div
              variants={riseChild}
              className="font-mono-t mb-4 text-[11.5px] tracking-[0.18em] text-[var(--fg-dim)]"
            >
              <span className="text-accent">{text.metrics.tag.split(" / ")[0]}</span> /{" "}
              {text.metrics.tag.split(" / ")[1]}
            </motion.div>
            <motion.h2
              variants={riseChild}
              className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-tight font-bold tracking-tight text-[var(--fg)]"
            >
              {text.metrics.title}
            </motion.h2>
          </div>
          <motion.p
            variants={riseChild}
            className="text-[15px] leading-relaxed text-[var(--fg-dim)]"
          >
            {text.metrics.sub}
          </motion.p>
        </div>

        {/* stat strip */}
        <motion.div
          variants={riseChild}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/5 bg-white/5 md:grid-cols-4"
        >
          {text.metrics.stats.map((s) => (
            <div key={s.label} className="bg-[var(--bg)] px-7 py-9">
              <div className="font-mono-t text-[clamp(2rem,3.6vw,3rem)] leading-none font-bold text-[var(--fg)] tabular-nums">
                <span>{s.value}</span>
                <span className="text-accent ml-0.5 text-[0.45em]">{s.unit}</span>
              </div>
              <div className="font-mono-t mt-3 text-[12px] tracking-wide text-[var(--fg-dim)]">
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Comparison notes stay useful without implying a measured result. */}
        <motion.div
          variants={riseChild}
          className="mt-14 min-w-0 rounded-2xl bg-[var(--bg-2)] p-5 md:p-9"
        >
          <h3 id="comparison-title" className="font-display scroll-mt-32 text-2xl leading-tight font-semibold text-[var(--fg)]">{text.metrics.comparisonTitle}</h3>
          <p className="mt-3 max-w-[70ch] text-[15px] leading-7 text-[var(--fg-dim)]">{text.metrics.comparisonIntro}</p>
          <table aria-labelledby="comparison-title" className="mt-7 w-full table-fixed border-collapse text-left text-sm leading-6">
            <thead>
              <tr className="border-b border-[var(--line-2)] text-[var(--fg)]">
                <th scope="col" className="w-[35%] py-3 pr-3 font-semibold md:w-1/4">{text.metrics.comparisonField}</th>
                <th scope="col" className="py-3 font-semibold">{text.metrics.comparisonRecord}</th>
              </tr>
            </thead>
            <tbody>
              {text.metrics.comparisonRows.map((row) => (
                <tr key={row.label} className="border-b border-[var(--line)] align-top">
                  <th scope="row" className="py-4 pr-3 font-medium text-[var(--fg)]">{row.label}</th>
                  <td className="py-4 text-[var(--fg-dim)]">{row.record}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 max-w-[75ch] text-sm leading-7 text-[var(--fg-dim)]">{text.metrics.comparisonNote}</p>
          <nav aria-label="Comparison and recovery guides" className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
            {text.metrics.comparisonLinks.map((link) => (
              <Link key={link.href} to={link.href} onNavigate={navigate} className="inline-flex min-h-11 items-center py-2 text-sm font-semibold text-accent underline decoration-[var(--line-2)] underline-offset-4 hover:decoration-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">{link.label}</Link>
            ))}
          </nav>
        </motion.div>
      </motion.div>
    </section>
  );
}
