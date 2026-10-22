import { DOWNLOAD_EXE } from "../constants";
import { text } from "../i18n/dictionary";
import { Link } from "../router";
import { NewsletterSignup } from "./NewsletterSignup";

const GH = "https://github.com/AurelioAvila/pc-tweaker-app";

interface FootLink {
  readonly label: string;
  readonly href: string;
  readonly reloadDocument?: boolean;
}

const LINK_CLASS =
  "mb-2.5 block text-[13.5px] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]";

function Col({
  title,
  links,
  navigate,
  currentPath,
}: {
  title: string;
  links: readonly FootLink[];
  navigate: (to: string) => void;
  currentPath: string;
}) {
  return (
    <div>
      <h2 className="font-mono-t mb-4 text-[11px] tracking-[0.14em] text-[var(--fg-dim)]">
        {title}
      </h2>
      {links.map((l) =>
        // A leading "/" marks an in-site route, which routes on the client
        // instead of triggering a full reload.
        l.href.startsWith("/") && !l.reloadDocument ? (
          <Link key={l.label} to={l.href} onNavigate={navigate} ariaCurrent={l.href.replace(/\/$/, "") === currentPath ? "page" : undefined} className={LINK_CLASS}>
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

export function Footer({ navigate, currentPath }: { navigate: (to: string) => void; currentPath: string }) {
  return (
    <footer className="border-t border-white/5 px-5 pt-14 pb-10 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap justify-between gap-10">
          <div>
            <div className="font-display mb-2.5 text-[17px] font-bold text-[var(--fg)]">
              PC Tweaker
            </div>
            <p className="max-w-xs text-[13px] text-[var(--fg-dim)]">{text.footer.tagline}</p>
            <p className="mt-3 text-[13px] leading-6 text-[var(--fg-dim)]">Built by <a href="https://github.com/AurelioAvila" className="text-accent underline underline-offset-4">Aurelio Avila</a>.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={GH} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--line-2)] px-4 text-[13px] font-semibold text-[var(--fg)] hover:border-[var(--accent)]">{text.suite.starRepository}</a>
              <a href="https://github.com/AurelioAvila/.github/blob/master/CODE_SIGNING.md" className="inline-flex min-h-11 items-center px-2 text-[13px] text-accent underline underline-offset-4">{text.suite.verifyRelease}</a>
            </div>
            <NewsletterSignup />
          </div>
          <div className="flex flex-wrap gap-14">
            <Col
              navigate={navigate}
              currentPath={currentPath}
              title={text.footer.product}
              links={[
                { label: text.footer.download, href: DOWNLOAD_EXE },
                { label: text.footer.changelog, href: `${GH}/blob/master/CHANGELOG.md` },
                { label: text.footer.source, href: GH },
                { label: "PC Tweaker Uninstaller", href: "/uninstaller/" },
                { label: "Tweaky Driver", href: "/tweaky-driver/", reloadDocument: true },
                { label: text.support.navLabel, href: "/support/" },
                { label: text.footer.contact, href: "/support/" },
                { label: "Facebook", href: "https://www.facebook.com/Pctweaker10" },
              ]}
            />
            <Col
              navigate={navigate}
              currentPath={currentPath}
              title={text.footer.reviews}
              links={[
                {
                  label: "MajorGeeks",
                  href: "https://www.majorgeeks.com/files/details/pc_tweaker.html",
                },
                {
                  label: "Softpedia",
                  href: "https://www.softpedia.com/get/Tweak/System-Tweak/Avila-PC-Tweaker.shtml",
                },
                {
                  label: "Freeware.de",
                  href: "https://freeware.de/tipps-and-tricks/pc-tweaker-041-systemoptimierung-und-leistungssteigerung-fuer-windows-1011",
                },
              ]}
            />
            <Col
              navigate={navigate}
              currentPath={currentPath}
              title="GUIDES"
              links={[
                { label: "Browse all guides", href: "/guides/" },
                { label: "DPC/ISR latency diagnosis", href: "/guides/fix-dpc-isr-latency-windows-11/" },
                { label: "Ryzen X3D core parking", href: "/guides/amd-ryzen-x3d-core-parking-windows-11/" },
                { label: "X3D & Intel Hybrid steering", href: "/guides/amd-x3d-intel-hybrid-core-steering-gaming/" },
                { label: "Privacy and rollback", href: "/guides/windows-11-privacy-telemetry-rollback/" },
                { label: "Undo Windows tweaks", href: "/how-to-undo-windows-tweaks/" },
                { label: "Gaming, Work and Study", href: "/windows-gaming-work-study-profiles/" },
                { label: "System change disclosure", href: "/what-pc-tweaker-changes/" },
                { label: "Windows 11 optimizer", href: "/windows-11-optimizer/" },
                { label: "Gaming performance", href: "/gaming-performance/" },
                { label: "Reversible tweaks", href: "/reversible-windows-tweaks/" },
                { label: "Windows privacy", href: "/windows-privacy-tool/" },
                { label: "Turn off Recall", href: "/turn-off-windows-recall/" },
                { label: "Uninstall completely", href: "/uninstall-programs-completely/" },
              ]}
            />
            <Col
              navigate={navigate}
              currentPath={currentPath}
              title="REFERENCE"
              links={[
                { label: "Windows tweaks explained", href: "/tweaks/" },
                { label: "Processes and services", href: "/database/" },
                { label: "Windows fixes", href: "/fixes/" },
                { label: "Free tools", href: "/tools/" },
              ]}
            />
            <Col
              navigate={navigate}
              currentPath={currentPath}
              title={text.footer.legal}
              links={[
                { label: text.footer.privacy, href: "/privacy/" },
                { label: text.footer.terms, href: "/terms/" },
                { label: text.footer.cookies, href: "/cookies/" },
                { label: text.footer.accessibility, href: "/accessibility/" },
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
