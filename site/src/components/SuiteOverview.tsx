import { text } from "../i18n/dictionary";
import { Link } from "../router";

export function SuiteOverview({ navigate }: { navigate: (to: string) => void }) {
  const copy = text.suite;
  const linkClass = "inline-flex min-h-11 items-center text-[14px] font-semibold text-accent underline underline-offset-4 decoration-[var(--line-2)] hover:decoration-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]";
  return (
    <section id="suite" aria-labelledby="suite-title" className="border-t border-[var(--line)] px-5 py-20 md:px-12">
      <div className="mx-auto max-w-7xl">
        <h2 id="suite-title" className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold tracking-tight text-[var(--fg)]">{copy.title}</h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--fg-dim)]">{copy.intro}</p>
        <div className="mt-10">
          {copy.products.map((product) => (
            <article key={product.name} className="grid gap-4 border-t border-[var(--line)] py-7 md:grid-cols-[1fr_1.5fr_1fr] md:items-center md:gap-10">
              <div>
                <h3 className="font-display text-[21px] font-semibold text-[var(--fg)]">{product.name}</h3>
                <p className="mt-2 text-[14px] text-[var(--fg)]">{product.task}</p>
              </div>
              <p className="max-w-xl text-[14.5px] leading-relaxed text-[var(--fg-dim)]">{product.description}</p>
              <div className="space-y-2 md:justify-self-end">
                {product.href.startsWith("/")
                  ? <Link to={product.href} onNavigate={navigate} className={linkClass}>{product.cta}</Link>
                  : <a href={product.href} className={linkClass}>{product.cta}</a>}
                <div className="flex flex-wrap gap-x-4">
                  <a href={product.repository} className={linkClass}>{copy.starRepository}<span className="sr-only">: {product.name}</span></a>
                  <a href="https://github.com/AurelioAvila/.github/blob/master/CODE_SIGNING.md" className={linkClass}>{copy.verifyRelease}<span className="sr-only">: {product.name}</span></a>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="max-w-3xl border-t border-[var(--line)] pt-5 text-[13px] leading-relaxed text-[var(--fg-dim)]">{copy.note}</p>
      </div>
    </section>
  );
}
