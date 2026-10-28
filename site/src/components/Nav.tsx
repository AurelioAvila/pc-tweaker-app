import { text } from "../i18n/dictionary";
import { DOWNLOAD_EXE } from "../constants";
import { Link } from "../router";
import { PromoStrip } from "../promo";
import logoUrl from "../assets/favicon.png";

export function Nav({
  navigate,
  onSubpage,
  downloadHref = DOWNLOAD_EXE,
  downloadLabel,
  offerHref,
  currentPath,
}: {
  navigate: (to: string) => void;
  onSubpage: boolean;
  /** Overridden on product pages that are not PC Tweaker itself. */
  downloadHref?: string;
  downloadLabel?: string;
  /** Where the Halloween strip's button goes; the home pricing by default. */
  offerHref?: string;
  currentPath?: string;
}) {
  // Section anchors only resolve on the home page. From /support they need
  // the leading "/" so the browser goes home first instead of hunting for an
  // element that isn't on this page.
  const prefix = onSubpage ? "/" : "";
  const links: readonly { label: string; href: string }[] = [
    { label: text.nav.results, href: `${prefix}#results` },
    { label: text.nav.arsenal, href: `${prefix}#arsenal` },
    { label: text.nav.protocol, href: `${prefix}#protocol` },
    { label: text.nav.access, href: `${prefix}#access` },
    { label: text.nav.faq, href: `${prefix}#faq` },
  ];

  return (
    <nav aria-label="Primary navigation" className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[var(--bg)]/70 backdrop-blur-xl">
      <PromoStrip href={offerHref ?? `${prefix}#access`} />
      <div className="mx-auto flex h-16 max-w-[86rem] items-center justify-between px-5 md:px-12">
        <Link
          to="/"
          onNavigate={navigate}
          className="font-display flex min-h-11 items-center gap-2 text-[15px] whitespace-nowrap font-700 tracking-tight text-[var(--fg)] sm:gap-2.5 sm:text-[17px]"
        >
          <img src={logoUrl} alt="" width="24" height="24" className="h-6 w-6 rounded-md" />
          PC Tweaker
        </Link>
        <div className="flex items-center gap-2 sm:gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden text-[13.5px] font-medium whitespace-nowrap text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] xl:block"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/guides/"
            onNavigate={navigate}
            ariaCurrent={currentPath === "/guides" ? "page" : undefined}
            className="inline-flex min-h-11 items-center text-[13.5px] font-medium whitespace-nowrap text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
          >
            {text.nav.guides}
          </Link>
          <Link
            to="/support/"
            onNavigate={navigate}
            className="hidden text-[13.5px] font-medium whitespace-nowrap text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] xl:block"
          >
            {text.support.navLabel}
          </Link>
          <a
            href={downloadHref}
            className="bg-accent glow-accent-sm inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-[13.5px] whitespace-nowrap font-semibold text-[var(--bg)] transition-transform hover:-translate-y-px sm:px-4.5"
          >
            <span className="sm:hidden">{text.nav.downloadShort}</span>
            <span className="hidden sm:inline">{downloadLabel ?? text.nav.download}</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
