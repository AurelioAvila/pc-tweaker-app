import { UNINSTALLER_DOWNLOAD_EXE, UNINSTALLER_RELEASES } from "../constants";
import { euro, PromoCard, PromoFine, usePromo } from "../promo";
import { TrialLine } from "../trial";
import { promoPercent } from "../../../src/promo";
import { ProductScreenshots } from "../components/ProductScreenshots";

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

export function UninstallerPage() {
  const promo = usePromo();
  const uninstallerOffer = promo.offer("uninstaller", "annual");
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-5 pt-36 pb-24 md:px-8">
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

      <p className="mb-12 text-[var(--fg-dim)]">
        New to this? Read{" "}
        <a href="/uninstall-programs-completely/" className="text-[var(--fg)] underline underline-offset-4">
          how to completely uninstall a program on Windows
        </a>
        , including where leftovers live and which ones to keep.
      </p>

      <ProductScreenshots
        title="Inside the removal workflow"
        note="The version 0.13.3 interface, shown with example programs and a demonstration receipt. This preview cannot read installed software or run Windows commands. Its figures are examples, not measured cleanup results. Open any image to inspect the details."
        items={[
          { src: "/uninstaller/images/inventory-0.13.3.png", title: "Start with the reasons", alt: "Uninstaller 0.13.3 interface preview: three example programs with Safe, Review and Keep guidance", description: "Review the inventory and the reasons behind each removal band. A Keep warning deserves attention before you touch a shared runtime or system component." },
          { src: "/uninstaller/images/removal-brief-0.13.3.png", title: "Read the command before you confirm", alt: "Example removal brief showing the command, administrator permissions, estimated size and restore-point attempt", description: "The brief separates the exact command, permissions and registry size estimate. A restore-point attempt is recorded; its availability and outcome still need checking." },
          { src: "/uninstaller/images/ledger-0.13.3.png", title: "Keep a receipt, including what is unknown", alt: "Demonstration Removal Ledger entry with restore point skipped and no measured space recovered", description: "The ledger keeps the method and outcome together. This example deliberately has no measured freed-space value: a registry estimate is not evidence that those bytes were recovered." },
        ]}
      />

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
        <TrialLine product="uninstaller" plan="annual" className="mb-4 leading-relaxed text-[var(--fg-dim)]" />
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
    </main>
  );
}
