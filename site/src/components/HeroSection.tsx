import { useRef, useState, type MouseEvent } from "react";
import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { ACCENTS, THEME_ORDER, useTheme } from "../theme";
import { EASE, riseChild, staggerParent } from "../motion";
import { DOWNLOAD_EXE } from "../constants";
import { CoffeeTip } from "./CoffeeTip";
import { NewsletterSignup } from "./NewsletterSignup";
import { PromoCard } from "../promo";
import { useCampaignStoreLink } from "../campaign-store";

/* ---------- theme selector: one geometric dot per palette ---------- */
function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  return (
    <details ref={disclosure} className="relative shrink-0" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (disclosure.current) disclosure.current.open = false;
        summary.current?.focus();
      }
    }}>
      <summary ref={summary} className="min-h-11 cursor-pointer rounded-lg border border-[var(--line)] px-3 py-3 text-[12px] text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">
        {text.hero.themeLabel}: {ACCENTS[theme].label}
      </summary>
      <div className="absolute right-0 bottom-full z-30 mb-2 grid grid-cols-6 gap-1 rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-3" role="group" aria-label={text.hero.themeLabel}>
        {THEME_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            aria-label={ACCENTS[t].label}
            aria-pressed={theme === t}
            title={ACCENTS[t].label}
            onClick={() => {
              setTheme(t);
              if (disclosure.current) disclosure.current.open = false;
              summary.current?.focus();
            }}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-transparent hover:border-[var(--line-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            style={{ borderColor: theme === t ? "var(--fg)" : undefined }}
          >
            <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ backgroundColor: ACCENTS[t].hex }} />
          </button>
        ))}
      </div>
    </details>
  );
}

/* ---------- hi-fi fake terminal for the winget command ---------- */
function WingetTerminal() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(text.hero.terminalCmd).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="ring-accent-soft overflow-hidden rounded-xl border border-white/5 bg-[var(--bg-2)]/90 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--line)]" />
          <span className="bg-accent h-2.5 w-2.5 rounded-full" />
        </div>
        <span className="font-mono-t text-[10.5px] tracking-wider text-[var(--fg-dim)]">
          {text.hero.terminalTitle}
        </span>
        <button
          onClick={copy}
          className="font-mono-t text-accent cursor-pointer text-[10.5px] font-bold tracking-[0.14em] transition-opacity hover:opacity-70"
        >
          {copied ? text.hero.copied : text.hero.copy}
        </button>
      </div>
      <div className="font-mono-t px-4 py-4 text-[13px] leading-relaxed">
        <div className="text-[var(--fg-dim)]">{text.hero.terminalHint}</div>
        <div className="mt-1 text-[var(--fg)]">
          <span className="text-accent">$ </span>
          {text.hero.terminalCmd}
          <span className="caret ml-1.5" />
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const storeLink = useCampaignStoreLink("pct-website");
  const btnRef = useRef<HTMLAnchorElement>(null);

  /* magnetic CTA — follows the cursor inside its hit-area */
  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.35;
    const y = (e.clientY - r.top - r.height / 2) * 0.35;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  const onLeave = () => {
    const el = btnRef.current;
    if (el) el.style.transform = "translate(0,0)";
  };

  return (
    <header className="overflow-hidden px-5 pt-28 pb-24 md:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        variants={staggerParent}
        // Rendered visible from the first byte: the prerendered hero is the LCP element, and an
        // opacity:0 entrance kept it blank until the JS bundle had loaded (~3.6 s FCP on mobile).
        initial={false}
        animate="show"
      >
        <motion.div
          variants={riseChild}
          className="mb-8 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="font-mono-t text-accent flex items-center gap-3 text-[12px] tracking-[0.18em]">
            <span className="bg-accent inline-block h-px w-9" />
            {text.hero.eyebrow}
          </div>
        </motion.div>

        {/* Copy and download on the left, the real app on the right: a visitor
            sees what they are downloading before deciding to. */}
        <div className="grid gap-12 md:grid-cols-12 md:items-start">
          <motion.div variants={riseChild} className="md:col-span-6">
            <h1 className="font-display text-[clamp(2.6rem,5.2vw,4.6rem)] leading-[0.98] font-bold tracking-[-0.03em] text-[var(--fg)]">
              {text.hero.title1}
              <br />
              {text.hero.title2}
              <br />
              <span className="text-accent">{text.hero.title3}</span>
            </h1>
            <p className="mt-8 max-w-md text-[16.5px] leading-relaxed text-[var(--fg-dim)]">
              <strong className="font-semibold text-[var(--fg)]">{text.hero.subBold}</strong>
              {text.hero.sub}
            </p>

            {/* CoffeeTip owns this row so the tip pill can sit beside the
                download button while its stepper unfolds under both. */}
            <div className="mt-9">
              <CoffeeTip>
                <motion.a
                  ref={btnRef}
                  href={DOWNLOAD_EXE}
                  onMouseMove={onMove}
                  onMouseLeave={onLeave}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="bg-accent glow-accent inline-flex items-center gap-2.5 rounded-xl px-8 py-4 text-[15px] font-bold text-[var(--bg)] transition-transform duration-300 will-change-transform"
                >
                  {text.hero.cta}
                  <span className="font-mono-t text-[12px]">↓</span>
                </motion.a>
              </CoffeeTip>
              <a href="#access" className="mt-2 inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fg)] underline decoration-[var(--line-2)] underline-offset-4 hover:decoration-[var(--accent)]">
                {text.hero.comparePlans}
              </a>
            </div>

            {/* Keep publisher and recovery information close to the download. */}
            <p className="mt-3 max-w-md text-[12.5px] leading-relaxed text-[var(--fg-dim)]">
              {text.hero.safetyNote}
            </p>

            <PromoCard />

            {/* Social traffic lands on phones, where an .exe is a dead end. */}
            <div className="md:hidden">
              <NewsletterSignup source="site-mobile" copy={text.sendToPc} />
            </div>

            <div className="mt-6 max-w-md">
              <WingetTerminal />
            </div>

            <div className="mt-9 flex flex-wrap gap-5">
              {text.hero.badges.map((b) => (
                <a
                  key={b.label}
                  href={
                    b.href.startsWith("https://apps.microsoft.com/detail/9nh3c6dt1g87")
                      ? storeLink
                      : b.href
                  }
                  target="_blank"
                  rel="noopener"
                  className="font-mono-t flex items-center gap-2 text-[12.5px] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
                >
                  <span className="bg-accent h-1.5 w-1.5 rounded-full" />
                  {b.label}
                </a>
              ))}
            </div>
          </motion.div>
          <motion.figure variants={riseChild} className="md:col-span-6 md:mt-4">
            <div className="ring-accent-soft overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-2)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)]">
              <img
                src="/images/app-overview-20261011.webp"
                width={1264}
                height={800}
                alt={text.hero.screenshotAlt}
                className="block h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-[var(--fg-dim)]">
              <span>{text.hero.screenshotCaption}</span>
              <ThemeSelector />
            </figcaption>
          </motion.figure>
        </div>
      </motion.div>
    </header>
  );
}
