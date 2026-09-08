const REPOSITORY = "https://github.com/AurelioAvila/pc-tweaker-uninstaller";

export function UninstallerPage() {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-5 pt-36 pb-24 md:px-8">
      <p className="font-mono-t mb-5 text-sm tracking-widest text-accent">PC TWEAKER SUITE</p>
      <h1 className="font-display mb-6 text-4xl font-bold text-[var(--fg)] md:text-5xl">
        PC Tweaker Uninstaller
      </h1>
      <p className="mb-10 text-lg leading-relaxed text-[var(--fg-dim)]">
        A separate Windows application for reviewing installed software and managing removals.
        Inspect the proposed removal method and permissions before proceeding, then keep a
        local record of the result.
      </p>
      <section className="mb-10 rounded-2xl border border-white/10 p-6">
        <h2 className="mb-3 text-2xl font-semibold text-[var(--fg)]">Release verification comes first</h2>
        <p className="leading-relaxed text-[var(--fg-dim)]">
          Version 0.8.3 has verified publisher signatures and trusted timestamps on the
          Windows installers and application. The publisher is Aurelio Avila. Download the
          signed release below; historical version 0.8.2 remains unsigned.
          Code signing identifies the publisher; it does not guarantee that Windows will
          never display a security warning.
        </p>
      </section>
      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-[var(--fg)]">Understand the limits</h2>
        <p className="leading-relaxed text-[var(--fg-dim)]">
          Review the removal brief and maintain an independent backup. Recovery applies only
          to supported operations and is not a guarantee that a removed application, its
          settings or its data can be restored. This is a separate product: sharing a suite
          account does not mean that a PC Tweaker license unlocks Uninstaller.
        </p>
      </section>
      <a href={`${REPOSITORY}/releases/tag/v0.8.3`} className="inline-block rounded-xl bg-accent px-6 py-3 font-semibold text-[var(--bg)]">
        Download signed version 0.8.3
      </a>
    </main>
  );
}
