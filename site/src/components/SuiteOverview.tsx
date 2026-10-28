import { text } from "../i18n/dictionary";
import { Link } from "../router";

export function SuiteOverview({ navigate }: { navigate: (to: string) => void }) {
  const copy = text.suite;
  const ctaClass = "group mt-7 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-white/15 px-4 text-[14px] font-semibold text-[var(--fg)] transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]";
  const arrow = <span aria-hidden="true" className="text-accent transition-transform group-hover:translate-x-0.5">→</span>;
  const minorClass = "inline-flex min-h-11 items-center text-[13px] text-[var(--fg-dim)] underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--fg)] hover:decoration-[var(--line-2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]";
  return (
    <section id="suite" aria-labelledby="suite-title" className="border-t border-[var(--line)] px-5 py-20 md:px-12">
      <div className="mx-auto max-w-7xl">
        <h2 id="suite-title" className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold tracking-tight text-[var(--fg)]">{copy.title}</h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--fg-dim)]">{copy.intro}</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {copy.products.map((product) => (
            <article key={product.name} className="flex flex-col rounded-2xl border border-white/10 bg-[var(--bg-2)] p-6 transition-colors hover:border-white/20 md:p-7">
              <div className="flex items-center gap-4">
                <img src={product.icon} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl" />
                <div>
                  <h3 className="font-display text-[19px] font-semibold text-[var(--fg)]">{product.name}</h3>
                  <p className="mt-0.5 text-[13.5px] text-accent">{product.task}</p>
                </div>
              </div>
              <p className="mt-5 flex-1 text-[14.5px] leading-relaxed text-[var(--fg-dim)]">{product.description}</p>
              {product.href.startsWith("/")
                ? <Link to={product.href} onNavigate={navigate} className={ctaClass}>{product.cta}{arrow}</Link>
                : <a href={product.href} className={ctaClass}>{product.cta}{arrow}</a>}
              <div className="mt-2 flex flex-wrap gap-x-5">
                <a href={product.repository} className={minorClass}>{copy.starRepository}<span className="sr-only">: {product.name}</span></a>
                <a href="https://github.com/AurelioAvila/.github/blob/master/CODE_SIGNING.md" className={minorClass}>{copy.verifyRelease}<span className="sr-only">: {product.name}</span></a>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-8 max-w-3xl text-[13px] leading-relaxed text-[var(--fg-dim)]">{copy.note}</p>
      </div>
    </section>
  );
}
