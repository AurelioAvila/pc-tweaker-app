import { Link } from "../router";
import { GUIDE_GROUPS } from "./guide-directory";
import { GuideBreadcrumbs } from "../components/GuideBreadcrumbs";

export function GuideDirectory({ navigate }: { navigate: (to: string) => void }) {
  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12">
      <div className="mx-auto max-w-5xl">
        <GuideBreadcrumbs path="/guides" navigate={navigate} />
        <h1 className="font-display text-4xl leading-[1.08] font-bold tracking-[-0.03em] text-[var(--fg)] md:text-6xl">
          PC Tweaker guides
        </h1>
        <p className="mt-6 max-w-[65ch] text-lg leading-8 text-[var(--fg-dim)]">
          Start with the symptom or the task. Diagnose a problem, inspect a change and understand what you can restore before applying anything.
        </p>
        <nav aria-label="Guide topics" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-y border-[var(--line)] py-4">
          {GUIDE_GROUPS.map((group) => (
            <a key={group.id} href={`#${group.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline decoration-[var(--line-2)] underline-offset-4 hover:decoration-[var(--accent)]">
              {group.title}
            </a>
          ))}
        </nav>
        <div>
          {GUIDE_GROUPS.map((group) => (
            <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="grid min-w-0 scroll-mt-32 gap-6 border-b border-[var(--line)] py-10 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-12 md:py-12">
              <div>
                <h2 id={`${group.id}-title`} className="font-display text-2xl leading-tight font-semibold text-[var(--fg)]">{group.title}</h2>
                <p className="mt-3 max-w-[40ch] text-sm leading-6 text-[var(--fg-dim)]">{group.description}</p>
              </div>
              <ul className="min-w-0 space-y-5">
                {group.guides.map((guide) => (
                  <li key={guide.path}>
                    <h3>
                      <Link to={guide.path} onNavigate={navigate} className="inline-flex min-h-11 items-center py-1 text-lg leading-7 font-medium text-accent underline decoration-[var(--line-2)] underline-offset-4 hover:decoration-[var(--accent)]">
                        {guide.title}
                      </Link>
                    </h3>
                    <p className="mt-1 max-w-[65ch] text-sm leading-6 text-[var(--fg-dim)]">{guide.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <section className="mt-12 flex flex-wrap items-center justify-between gap-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--fg)]">Need help with a specific change?</h2>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[var(--fg-dim)]">Include the setting, the symptom and what happened when you tried to restore it.</p>
          </div>
          <Link to="/support/" onNavigate={navigate} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--line-2)] px-5 text-sm font-semibold text-[var(--fg)] hover:border-[var(--accent)]">Get support</Link>
        </section>
      </div>
    </main>
  );
}
