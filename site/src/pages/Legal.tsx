import type { ReactNode } from "react";
// Vite inlines these at build time (?raw), so the site always ships the same
// legal text as the repo root — no hand-maintained copy to drift out of sync.
// (backend/legal/ keeps its own copies for the Railway-served versions; see
// the note there.)
import privacyMd from "../../../PRIVACY.md?raw";
import termsMd from "../../../TERMS.md?raw";
import { Link } from "../router";

/* ============================================================
   LEGAL & INFO PAGES
   Privacy and Terms render the repo's own markdown through a
   deliberately tiny converter (headings, bullets, bold, code) —
   these documents are plain enough that pulling in a markdown
   library would cost more than the pages themselves.
   ============================================================ */

/** Inline **bold** and `code`, escaping nothing because the source is our own
 *  repo-committed markdown, not user input. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--fg)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="font-mono-t rounded bg-white/5 px-1.5 py-0.5 text-[13px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key++} className="mb-5 list-disc space-y-2 pl-6 text-[15px] leading-relaxed text-[var(--fg-dim)]">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  // Paragraphs are separated by blank lines; consecutive non-bullet lines
  // within a block are joined, matching how markdown renders soft wraps.
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={key++} className="mb-5 text-[15px] leading-relaxed text-[var(--fg-dim)]">
        {inline(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  };

  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    const trimmed = line.trimStart();
    if (line.startsWith("  ") && bullets.length > 0 && trimmed !== "") {
      bullets[bullets.length - 1] += ` ${trimmed}`;
    } else if (line.startsWith("# ")) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h1 key={key++} className="font-display mb-3 text-[32px] font-bold text-[var(--fg)]">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h2 key={key++} className="font-display mt-10 mb-4 text-[21px] font-bold text-[var(--fg)]">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("- ")) {
      flushParagraph();
      bullets.push(line.slice(2));
    } else if (line === "") {
      flushBullets();
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }
  flushBullets();
  flushParagraph();
  return <>{blocks}</>;
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12">
      <div className="mx-auto max-w-3xl">{children}</div>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <PageShell>
      <Markdown source={privacyMd} />
    </PageShell>
  );
}

export function TermsPage() {
  return (
    <PageShell>
      <Markdown source={termsMd} />
    </PageShell>
  );
}

/** True as of 2026-08: the site sets no cookies at all — verify against
 *  document.cookie before ever adding one, and update this page if that
 *  changes. Theme choice lives in localStorage (see theme.tsx), which is
 *  disclosed here for completeness even though it isn't a cookie. */
export function CookiesPage() {
  return (
    <PageShell>
      <h1 className="font-display mb-3 text-[32px] font-bold text-[var(--fg)]">Cookie Policy</h1>
      <p className="mb-5 text-[15px] leading-relaxed text-[var(--fg-dim)]">
        This website sets <strong className="font-semibold text-[var(--fg)]">no cookies</strong> — not
        for analytics, not for advertising, not for anything else. There is no tracking script on any
        page, and fonts and images are served from this domain, so visiting the site sends no data to
        third parties.
      </p>
      <p className="mb-5 text-[15px] leading-relaxed text-[var(--fg-dim)]">
        The only thing stored in your browser is your color-theme preference, kept in{" "}
        <code className="font-mono-t rounded bg-white/5 px-1.5 py-0.5 text-[13px]">localStorage</code>{" "}
        on your own device if you pick a theme. It never leaves your browser and you can clear it at
        any time from your browser settings.
      </p>
      <p className="text-[15px] leading-relaxed text-[var(--fg-dim)]">
        Because nothing here requires consent under the ePrivacy directive or the GDPR, the site shows
        no cookie banner — there is nothing to accept or refuse.
      </p>
    </PageShell>
  );
}

export function AccessibilityPage() {
  return (
    <PageShell>
      <h1 className="font-display mb-3 text-[32px] font-bold text-[var(--fg)]">Accessibility</h1>
      <p className="mb-5 text-[15px] leading-relaxed text-[var(--fg-dim)]">
        This site aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 level AA:
        semantic landmarks, a skip-to-content link, alt text on images, labeled form fields,
        keyboard-operable controls, and zoom that is never disabled.
      </p>
      <p className="text-[15px] leading-relaxed text-[var(--fg-dim)]">
        If anything here is hard to use with a keyboard, a screen reader, or any other assistive
        technology, please report it through the support form — accessibility problems are treated as
        bugs, not suggestions.
      </p>
    </PageShell>
  );
}

export function NotFoundPage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <PageShell>
      <p className="font-mono-t text-accent mb-4 text-[12px] tracking-[0.18em]">404</p>
      <h1 className="font-display mb-3 text-[32px] font-bold text-[var(--fg)]">
        This page doesn&rsquo;t exist
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-[var(--fg-dim)]">
        The address may be mistyped, or the page may have moved.
      </p>
      <Link
        to="/"
        onNavigate={navigate}
        className="bg-accent glow-accent-sm inline-block rounded-xl px-7 py-3.5 text-[14.5px] font-bold text-[var(--bg)]"
      >
        Back to the homepage
      </Link>
    </PageShell>
  );
}
