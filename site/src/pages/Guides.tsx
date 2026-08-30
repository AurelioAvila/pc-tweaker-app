import { DOWNLOAD_EXE } from "../constants";
import { Link } from "../router";

interface Guide {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly {
    readonly heading: string;
    readonly body: string;
    readonly points?: readonly string[];
  }[];
}

export const GUIDES: Record<string, Guide> = {
  "/windows-11-optimizer": {
    eyebrow: "WINDOWS 11 OPTIMIZATION",
    title: "Optimize Windows 11 without losing control",
    intro:
      "PC Tweaker applies documented, reversible Windows adjustments while preserving a clear record of what changed and how to restore it.",
    sections: [
      {
        heading: "A safer alternative to one-click optimization",
        body:
          "Generic optimizers often combine unrelated changes behind a single button. PC Tweaker keeps adjustments visible, categorized and individually reversible so you can improve the system without treating Windows as a black box.",
        points: [
          "Review each optimization before applying it",
          "Restore supported changes through automatic rollback",
          "Use live hardware information to make informed decisions",
          "Keep privacy, maintenance and performance controls separate",
        ],
      },
      {
        heading: "Built for modern Windows systems",
        body:
          "The application supports Windows 10 and Windows 11 and is designed around current system behavior, permissions and recovery expectations. It does not promise impossible performance gains or replace proper hardware, driver and security maintenance.",
      },
    ],
  },
  "/gaming-performance": {
    eyebrow: "GAMING PERFORMANCE",
    title: "Tune Windows for more consistent gaming performance",
    intro:
      "Reduce avoidable background overhead, inspect system conditions and apply gaming-focused changes without surrendering the ability to roll them back.",
    sections: [
      {
        heading: "Consistency matters more than a synthetic promise",
        body:
          "PC Tweaker focuses on transparent system configuration rather than guaranteed FPS claims. The goal is to remove avoidable friction while keeping thermals, drivers, hardware limits and game-specific settings in perspective.",
        points: [
          "Gaming-oriented Windows adjustments",
          "Live CPU, memory and system monitoring",
          "Driver update visibility",
          "Independent rollback for supported changes",
        ],
      },
      {
        heading: "Know what changed",
        body:
          "Every supported optimization is presented as an explicit action. That makes it easier to test a configuration, measure the result and reverse the change if it does not help your specific PC or workload.",
      },
    ],
  },
  "/reversible-windows-tweaks": {
    eyebrow: "REVERSIBLE TWEAKS",
    title: "Windows tweaks with a recovery path",
    intro:
      "Optimization should not mean guessing how to undo a registry, service or system-setting change weeks later.",
    sections: [
      {
        heading: "Rollback is part of the feature",
        body:
          "PC Tweaker treats recovery as a core requirement. Supported changes preserve the information needed to restore their previous state instead of relying on generic reset instructions after something goes wrong.",
        points: [
          "Apply supported tweaks individually",
          "Keep changes understandable and auditable",
          "Reverse a change without searching for the original value",
          "Avoid scripts that bundle unrelated modifications",
        ],
      },
      {
        heading: "Transparent by design",
        body:
          "The project is publicly inspectable, and the interface explains what each available action targets. This makes PC Tweaker suitable for users who want convenience without giving up visibility into their system.",
      },
    ],
  },
  "/windows-privacy-tool": {
    eyebrow: "WINDOWS PRIVACY",
    title: "Review Windows privacy settings without blind debloating",
    intro:
      "Adjust supported privacy-related Windows behavior while keeping each action separate, understandable and reversible.",
    sections: [
      {
        heading: "Privacy controls without destructive presets",
        body:
          "Aggressive debloat scripts can disable dependencies or remove components a user still needs. PC Tweaker favors explicit settings and recovery over irreversible package removal and blanket service disabling.",
        points: [
          "Separate privacy choices from performance changes",
          "Review the purpose of each supported action",
          "Restore supported settings when requirements change",
          "Avoid advertising trackers on the PC Tweaker website",
        ],
      },
      {
        heading: "Privacy is more than a toggle",
        body:
          "No optimizer can replace account security, operating-system updates or informed application permissions. PC Tweaker provides focused controls while keeping those wider security responsibilities clear.",
      },
    ],
  },
};

export function GuidePage({ path, navigate }: { path: string; navigate: (to: string) => void }) {
  const guide = GUIDES[path];
  if (!guide) return null;

  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12">
      <article className="mx-auto max-w-4xl">
        <p className="font-mono-t text-accent mb-5 text-[12px] tracking-[0.15em]">
          {guide.eyebrow}
        </p>
        <h1 className="font-display max-w-3xl text-4xl leading-[1.08] font-bold tracking-[-0.03em] text-[var(--fg)] md:text-6xl">
          {guide.title}
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--fg-dim)]">{guide.intro}</p>

        <div className="mt-14 space-y-8">
          {guide.sections.map((section) => (
            <section key={section.heading} className="rounded-2xl bg-[var(--surface)] p-7 md:p-9">
              <h2 className="font-display text-2xl font-bold text-[var(--fg)]">{section.heading}</h2>
              <p className="mt-4 max-w-3xl leading-7 text-[var(--fg-dim)]">{section.body}</p>
              {section.points && (
                <ul className="mt-6 grid gap-3 text-[15px] text-[var(--fg)] md:grid-cols-2">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span className="text-accent" aria-hidden="true">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <section className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-white/10 pt-9">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--fg)]">Try PC Tweaker</h2>
            <p className="mt-2 text-[14px] text-[var(--fg-dim)]">
              Free download for Windows 10 and Windows 11.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/" onNavigate={navigate} className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-[var(--fg)]">
              Explore all features
            </Link>
            <a href={DOWNLOAD_EXE} className="bg-accent rounded-lg px-5 py-3 text-sm font-semibold text-[var(--bg)]">
              Download PC Tweaker
            </a>
          </div>
        </section>
      </article>
    </main>
  );
}
