type Preview = { src: string; title: string; description: string; alt: string };

export function ProductScreenshots({ title, note, items }: { title: string; note: string; items: readonly Preview[] }) {
  return <section className="mb-14" aria-labelledby="product-preview-title">
    <p className="font-mono-t mb-3 text-xs tracking-widest text-accent">INTERFACE PREVIEW · EXAMPLE DATA</p>
    <h2 id="product-preview-title" className="font-display mb-4 scroll-mt-28 text-3xl font-semibold text-[var(--fg)]">{title}</h2>
    <p className="mb-7 leading-relaxed text-[var(--fg-dim)]">{note}</p>
    <div className="space-y-4">
      {items.map((item, index) => <details key={item.src} open={index === 0} className="rounded-xl border border-white/15">
        <summary className="cursor-pointer rounded-xl p-4 text-lg font-semibold text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"><span className="font-mono-t mr-3 text-sm text-accent">0{index + 1}</span>{item.title}</summary>
        <figure className="px-4 pb-5">
        <a href={item.src} target="_blank" rel="noopener" className="block rounded-xl border border-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]" aria-label={`Open full-size interface preview: ${item.title}`}>
          <img src={item.src} alt={item.alt} width="1365" height="900" loading="lazy" decoding="async" className="h-auto w-full rounded-xl" />
        </a>
        <figcaption className="pt-4">
          <p className="leading-relaxed text-[var(--fg-dim)]">{item.description}</p>
          <a href={item.src} target="_blank" rel="noopener" className="mt-2 inline-block text-sm text-accent underline underline-offset-4">Open full-size preview</a>
        </figcaption>
        </figure>
      </details>)}
    </div>
  </section>;
}
