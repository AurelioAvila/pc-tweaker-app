import { text } from "../i18n/dictionary";
import { Link } from "../router";

const GH = "https://github.com/AurelioAvila/pc-tweaker-app";

interface FootLink {
  readonly label: string;
  readonly href: string;
}

const LINK_CLASS =
  "mb-2.5 block text-[13.5px] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]";

function Col({
  title,
  links,
  navigate,
}: {
  title: string;
  links: readonly FootLink[];
  navigate: (to: string) => void;
}) {
  return (
    <div>
      <h4 className="font-mono-t mb-4 text-[11px] tracking-[0.14em] text-[var(--fg-dim)]">{title}</h4>
      {links.map((l) =>
        // A leading "/" marks an in-site route, which routes on the client
        // instead of triggering a full reload.
        l.href.startsWith("/") ? (
          <Link key={l.label} to={l.href} onNavigate={navigate} className={LINK_CLASS}>
            {l.label}
          </Link>
        ) : (
          <a key={l.label} href={l.href} className={LINK_CLASS}>
            {l.label}
          </a>
        ),
      )}
    </div>
  );
}

export function Footer({ navigate }: { navigate: (to: string) => void }) {
  return (
    <footer className="border-t border-white/5 px-5 pt-14 pb-10 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap justify-between gap-10">
          <div>
            <div className="font-display mb-2.5 text-[17px] font-bold text-[var(--fg)]">PC Tweaker</div>
            <p className="max-w-xs text-[13px] text-[var(--fg-dim)]">{text.footer.tagline}</p>
          </div>
          <div className="flex flex-wrap gap-14">
            <Col
              navigate={navigate}
              title={text.footer.product}
              links={[
                { label: text.footer.download, href: `${GH}/releases/latest` },
                { label: text.footer.changelog, href: `${GH}/blob/master/CHANGELOG.md` },
                { label: text.footer.source, href: GH },
                { label: text.support.navLabel, href: "/support" },
              ]}
            />
            <Col
              navigate={navigate}
              title={text.footer.reviews}
              links={[
                { label: "MajorGeeks", href: "https://www.majorgeeks.com/files/details/pc_tweaker.html" },
                { label: "Softpedia", href: "https://www.softpedia.com/get/Tweak/System-Tweak/Avila-PC-Tweaker.shtml" },
                { label: "AlternativeTo", href: "https://alternativeto.net/software/pc-tweaker/about/" },
              ]}
            />
            <Col
              navigate={navigate}
              title={text.footer.legal}
              links={[
                { label: text.footer.privacy, href: `${GH}/blob/master/PRIVACY.md` },
                { label: text.footer.terms, href: `${GH}/blob/master/TERMS.md` },
                { label: text.footer.license, href: `${GH}/blob/master/LICENSE` },
              ]}
            />
          </div>
        </div>
        <div className="font-mono-t mt-12 flex flex-wrap justify-between gap-3 border-t border-white/5 pt-6 text-[12px] text-[var(--fg-dim)]">
          <span>{text.footer.copyright}</span>
          <span className="text-accent">{text.footer.motto}</span>
        </div>
      </div>
    </footer>
  );
}
