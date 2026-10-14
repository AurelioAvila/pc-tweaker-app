import { UNINSTALLER_DOWNLOAD_EXE, UNINSTALLER_RELEASES } from "../constants";
import { euro, PromoCard, PromoFine, usePromo } from "../promo";
import { promoPercent } from "../../../src/promo";

/* The page a buyer actually lands on.
 *
 * It used to open with release-verification and licensing disclosure and
 * never said what the software does, what it costs, or how to buy it — the
 * prices existed only inside the installed application, which is a funnel
 * that cannot convert anybody who has not already installed. Every number and
 * every capability below is taken from the shipping code, not from ambition:
 * prices checked against the live Stripe products, the free/Pro line from the
 * app's Pro gates (leftover cleaning, batch removal, broken entries), the
 * receipt fields from src-tauri/src/ledger.rs, the restore point from
 * src-tauri/src/restore_point.rs. The disclosure that used to be the whole
 * page is still here, below the fold, where disclosure belongs. */

const FREE = [
  "Unlimited single uninstalls, for classic desktop software and Store apps alike",
  "A safety score for every program, with the reasons it arrived at that score spelled out",
  "The removal brief: the exact command that will run and the permissions it will ask for, before it runs",
  "A leftover scan right after every uninstall, so you see what the program left behind",
  "A restore-point attempt before elevated removals, with the outcome recorded in the receipt",
  "The Removal Ledger: a local receipt of what was removed, by what method, with what result and how much space was actually freed",
];

const PRO = [
  "Clean the leftovers the free scan finds — the files, folders and registry keys the program's own uninstaller left behind",
  "Batch removal: queue several programs and let them run in sequence instead of babysitting one dialog at a time",
  "Remove broken entries: programs whose own uninstaller no longer exists, taken off the installed list",
];

/* Real captures of v0.13.0 (Graphite Ember, English) on a clean Windows 11
 * test machine with a dozen common free programs installed. Nothing here is
 * mocked: the rows, verdicts, command and receipt are what the app produced. */
const SHOTS = {
  inventory: {
    src: "/images/pc-tweaker-uninstaller-installed-apps.webp",
    alt: "PC Tweaker Uninstaller showing a list of installed programs sorted by size, with the version, size, install date and a Safe to remove verdict beside each program",
  },
  brief: {
    src: "/images/pc-tweaker-uninstaller-removal-brief.webp",
    alt: "The removal brief for Notepad++: the method, the privileges needed, the space to reclaim, the confidence rating and the exact command that will run, with Cancel and Uninstall buttons",
  },
  ledger: {
    src: "/images/pc-tweaker-uninstaller-removal-ledger.webp",
    alt: "The Removal Ledger listing a completed WinSCP removal with its date, the 99 MB freed and verified, and the restore point outcome, with Export JSON and Open log folder buttons",
  },
} as const;

function Shot({ shot, caption, hero = false }: { shot: { src: string; alt: string }; caption: string; hero?: boolean }) {
  return (
    <figure className={hero ? "mb-14" : ""}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-2)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)]">
        <img
          src={shot.src}
          width={1267}
          height={972}
          alt={shot.alt}
          className="block h-auto w-full"
          {...(hero ? { loading: "eager", fetchpriority: "high" } : { loading: "lazy" })}
        />
      </div>
      <figcaption className="font-mono-t mt-3 text-[11.5px] text-[var(--fg-dim)]">{caption}</figcaption>
    </figure>
  );
}

export function UninstallerPage() {
  const promo = usePromo();
  const uninstallerOffer = promo.offer("uninstaller", "annual");
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-5 pt-36 pb-24 md:px-8">
      <div className="max-w-3xl">
      <p className="font-mono-t mb-5 text-sm tracking-widest text-accent">PC TWEAKER SUITE</p>
      <h1 className="font-display mb-6 text-4xl font-bold text-[var(--fg)] md:text-5xl">
        See what an uninstall will do, before it does it
      </h1>
      <p className="mb-8 text-lg leading-relaxed text-[var(--fg-dim)]">
        PC Tweaker Uninstaller is a Windows application that reads every installed program,
        scores how risky removing it is and shows you the exact command and permissions it
        will use. Before elevated removals, it attempts to create a Windows restore point,
        then records the outcome and what actually happened. Single uninstalls are free, for good.
      </p>

      <div className="mb-12">
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={UNINSTALLER_DOWNLOAD_EXE}
            className="inline-block rounded-xl bg-accent px-6 py-3 font-semibold text-[var(--bg)]"
          >
            Download for Windows — free
          </a>
          <a
            href={UNINSTALLER_RELEASES}
            className="text-[14px] font-medium text-[var(--fg-dim)] underline-offset-4 hover:text-[var(--fg)] hover:underline"
          >
            Installer, MSI, checksums and release notes
          </a>
        </div>
        <PromoCard product="uninstaller" plan="annual" href="#uninstaller-pro" />
      </div>
      </div>

      <Shot
        hero
        shot={SHOTS.inventory}
        caption="PC Tweaker Uninstaller 0.13.0, sorted by size. Sample programs on a clean Windows 11 test PC."
      />

      <div className="max-w-3xl">

      <p className="mb-12 text-[var(--fg-dim)]">
        New to this? Read{" "}
        <a href="/uninstall-programs-completely/" className="text-[var(--fg)] underline underline-offset-4">
          how to completely uninstall a program on Windows
        </a>
        , including where leftovers live and which ones to keep.
      </p>

      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-semibold text-[var(--fg)]">What you get without paying</h2>
        <ul className="space-y-2.5 leading-relaxed text-[var(--fg-dim)]">
          {FREE.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="text-accent">
                —
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      </div>

      <div className="mb-14 grid gap-8 md:grid-cols-2">
        <Shot
          shot={SHOTS.brief}
          caption="The removal brief: the exact command, the permissions and the confidence rating, before anything runs."
        />
        <Shot
          shot={SHOTS.ledger}
          caption="The Removal Ledger: a local receipt with the space actually freed and the restore point outcome."
        />
      </div>

      <div className="max-w-3xl">
      <section id="uninstaller-pro" className="mb-10 scroll-mt-28 rounded-2xl border border-white/10 p-6">
        <h2 className="mb-2 text-2xl font-semibold text-[var(--fg)]">Uninstaller Pro</h2>
        <p className="mb-4 text-lg font-semibold text-accent">
          {uninstallerOffer ? (
            <>
              <s className="mr-2 font-medium text-[var(--fg-dim)]">{euro(uninstallerOffer.reference)}</s>
              {euro(uninstallerOffer.price)} for the first year ({promoPercent(uninstallerOffer)}% off), then{" "}
              {euro(uninstallerOffer.regular)} per year
            </>
          ) : (
            "€9.99 per year"
          )}
        </p>
        {uninstallerOffer && <PromoFine className="-mt-2 mb-4 text-[12.5px] text-[var(--fg-dim)]" />}
        <ul className="mb-5 space-y-2.5 leading-relaxed text-[var(--fg-dim)]">
          {PRO.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="text-accent">
                —
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mb-4 leading-relaxed text-[var(--fg-dim)]">
          Already on a PC Tweaker plan? Uninstaller Pro is <strong>€4.99 per year</strong> on the
          same account. PC Tweaker Lifetime includes 12 months of Uninstaller Pro from your first
          sign-in, existing Lifetime owners included; that bonus does not renew automatically.
        </p>
        <p className="leading-relaxed text-[var(--fg-dim)]">
          Open Plans &amp; pricing in the app&apos;s top bar: sign in or create your free suite
          account there, then choose Go Pro. One account covers both applications. Taxes and the
          final renewal terms are shown at checkout.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-[var(--fg)]">Why the receipt matters</h2>
        <p className="leading-relaxed text-[var(--fg-dim)]">
          Most uninstallers tell you a removal succeeded and leave you to believe it. Every
          removal here appends a local entry recording the program, where it came from, the
          method used, whether it succeeded, the exit code it returned, whether a reboot is
          pending, whether the restore point was created, and the space the removal actually
          freed rather than the space the program claimed to occupy. The ledger stays on your
          machine and exports to a file whenever you ask for it.
        </p>
      </section>

      <section className="mb-10 rounded-2xl border border-white/10 p-6">
        <h2 className="mb-3 text-2xl font-semibold text-[var(--fg)]">Release verification comes first</h2>
        <p className="leading-relaxed text-[var(--fg-dim)]">
          The current Windows installers and application have verified publisher signatures and
          trusted timestamps. The publisher is Aurelio Avila. Download the signed release above.
          Code signing identifies the publisher; it does not guarantee that Windows will
          never display a security warning.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-[var(--fg)]">Understand the limits</h2>
        <p className="leading-relaxed text-[var(--fg-dim)]">
          Review the removal brief and maintain an independent backup. Restore-point creation
          can fail or be skipped; Windows settings, permissions and throttling affect availability.
          Check the recorded outcome before relying on it. Recovery applies only
          to supported operations and is not a guarantee that a removed application, its
          settings or its data can be restored. This is a separate application with its own
          Pro entitlement: a PC Tweaker subscription qualifies for the reduced price, while
          Lifetime includes the 12-month bonus described above.
        </p>
      </section>
      </div>
    </main>
  );
}
