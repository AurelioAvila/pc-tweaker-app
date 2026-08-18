import { text } from "../i18n/dictionary";
import { DOWNLOAD_EXE } from "../constants";
import { Link } from "../router";
import logoUrl from "../assets/favicon.png";

export function Nav({
  navigate,
  onSupportPage,
}: {
  navigate: (to: string) => void;
  onSupportPage: boolean;
}) {
  // Section anchors only resolve on the home page. From /support they need
  // the leading "/" so the browser goes home first instead of hunting for an
  // element that isn't on this page.
  const prefix = onSupportPage ? "/" : "";
  const links: readonly { label: string; href: string }[] = [
    { label: text.nav.results, href: `${prefix}#results` },
    { label: text.nav.arsenal, href: `${prefix}#arsenal` },
    { label: text.nav.protocol, href: `${prefix}#protocol` },
    { label: text.nav.access, href: `${prefix}#access` },
    { label: text.nav.faq, href: `${prefix}#faq` },
  ];

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[var(--bg)]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-12">
        <Link
          to="/"
          onNavigate={navigate}
          className="font-display flex items-center gap-2.5 text-[17px] font-700 tracking-tight text-[var(--fg)]"
        >
          <img src={logoUrl} alt="" className="h-6 w-6 rounded-md" />
          PC Tweaker
        </Link>
        <div className="flex items-center gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden text-[13.5px] font-medium text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] md:block"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/support"
            onNavigate={navigate}
            className="hidden text-[13.5px] font-medium text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] md:block"
          >
            {text.support.navLabel}
          </Link>
          <a
            href={DOWNLOAD_EXE}
            className="bg-accent glow-accent-sm rounded-lg px-4.5 py-2 text-[13.5px] font-semibold text-[var(--bg)] transition-transform hover:-translate-y-px"
          >
            {text.nav.download}
          </a>
        </div>
      </div>
    </nav>
  );
}
