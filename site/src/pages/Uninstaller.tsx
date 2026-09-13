import { DOWNLOAD_EXE, UNINSTALLER_DOWNLOAD_EXE, UNINSTALLER_RELEASES } from "../constants";

/* The page a buyer actually lands on.
 *
 * It used to open with release-verification and licensing disclosure and
 * never said what the software does, what it costs, or how to buy it — the
 * prices existed only inside the installed application, which is a funnel
 * that cannot convert anybody who has not already installed. Every number and
 * every capability below is taken from the shipping code, not from ambition:
 * prices from the Uninstaller's own src/i18n.ts, the free/Pro line from the
 * two Pro gates in that file (leftover cleaning and batch removal), the
 * receipt fields from src-tauri/src/ledger.rs, the restore point from
 * src-tauri/src/restore_point.rs. The disclosure that used to be the whole
 * page is still here, below the fold, where disclosure belongs. */

const FREE = [
  "Unlimited single uninstalls, for classic desktop software and Store apps alike",
  "A safety score for every program, with the reasons it arrived at that score spelled out",
  "The removal brief: the exact command that will run and the permissions it will ask for, before it runs",
  "A Windows restore point taken before the removal is attempted",
  "The Removal Ledger: a local receipt of what was removed, by what method, with what result and how much space was actually freed",
];

const PRO = [
  "Clean the leftovers the free scan finds — the files, folders and registry keys the program's own uninstaller left behind",
  "Batch removal: queue several programs and let them run in sequence instead of babysitting one dialog at a time",
];

export function UninstallerPage() {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-5 pt-36 pb-24 md:px-8">
      <p className="font-mono-t mb-5 text-sm tracking-widest text-accent">PC TWEAKER SUITE</p>
      <h1 className="font-display mb-6 text-4xl font-bold text-[var(--fg)] md:text-5xl">
        See what an uninstall will do, before it does it
      </h1>
      <p className="mb-8 text-lg leading-relaxed text-[var(--fg-dim)]">
        PC Tweaker Uninstaller is a Windows application that reads every installed program,
        scores how risky removing it is and shows you the exact command and permissions it
        will use. It takes a restore point first, then writes a receipt of what actually
        happened. Single uninstalls are free, for good.
      </p>

      <div className="mb-12 flex flex-wrap items-center gap-4">
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

      <section className="mb-10 rounded-2xl border border-white/10 p-6">
        <h2 className="mb-2 text-2xl font-semibold text-[var(--fg)]">Uninstaller Pro</h2>
        <p className="mb-4 text-lg font-semibold text-accent">
          €13.99 per year, or €3.99 per month
        </p>
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
          Pro is bought inside the application, under the account menu, using a PC Tweaker suite
          account. If you do not have one yet, install{" "}
          <a
            href={DOWNLOAD_EXE}
            className="text-accent underline-offset-4 hover:underline"
          >
            PC Tweaker
          </a>{" "}
          — it is free and it is where the account is created. One account covers both
          applications.
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
          Version 0.10.0 has verified publisher signatures and trusted timestamps on the
          Windows installers and application. The publisher is Aurelio Avila. Download the
          signed release above; historical version 0.8.2 remains unsigned.
          Code signing identifies the publisher; it does not guarantee that Windows will
          never display a security warning.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-[var(--fg)]">Understand the limits</h2>
        <p className="leading-relaxed text-[var(--fg-dim)]">
          Review the removal brief and maintain an independent backup. Recovery applies only
          to supported operations and is not a guarantee that a removed application, its
          settings or its data can be restored. This is a separate application with its own
          Pro entitlement: a PC Tweaker subscription does not unlock it by itself, it only
          sets the price.
        </p>
      </section>
    </main>
  );
}
