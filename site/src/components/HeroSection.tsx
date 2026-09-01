import { useRef, useState, type MouseEvent } from "react";
import { motion } from "framer-motion";
import { text } from "../i18n/dictionary";
import { ACCENTS, THEME_ORDER, useTheme } from "../theme";
import { EASE, riseChild, staggerParent } from "../motion";
import { DOWNLOAD_EXE } from "../constants";
import { CoffeeTip } from "./CoffeeTip";

/* ---------- theme selector: one geometric dot per palette ---------- */
function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono-t text-[10px] tracking-[0.2em] text-[var(--fg-dim)]">
        {text.hero.themeLabel}
      </span>
      <div className="flex flex-wrap items-center gap-2.5">
        {THEME_ORDER.map((t) => (
          <button
            key={t}
            aria-label={ACCENTS[t].label}
            title={ACCENTS[t].label}
            onClick={() => setTheme(t)}
            className="h-3.5 w-3.5 rounded-full border transition-all duration-300"
            style={{
              backgroundColor: ACCENTS[t].hex,
              borderColor: theme === t ? "var(--fg)" : "transparent",
              transform: theme === t ? "scale(1.35)" : "scale(1)",
              boxShadow: theme === t ? `0 0 14px ${ACCENTS[t].glow}` : "none",
            }}
          />
        ))}
      </div>
    </div>
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
        <div className="text-[var(--line-2)]">{text.hero.terminalHint}</div>
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
    <header className="overflow-hidden px-5 pt-36 pb-24 md:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        variants={staggerParent}
        initial="hidden"
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
          <ThemeSelector />
        </motion.div>

        <motion.h1
          variants={riseChild}
          className="font-display text-[clamp(3rem,8.5vw,7rem)] leading-[0.98] font-bold tracking-[-0.03em] text-[var(--fg)]"
        >
          {text.hero.title1}
          <br />
          {text.hero.title2}
          <br />
          <span className="text-accent">{text.hero.title3}</span>
        </motion.h1>

        {/* asymmetric lower row: deliberate void left, payload right */}
        <div className="mt-14 grid gap-12 md:grid-cols-12">
          <div className="hidden md:col-span-5 md:block" aria-hidden />
          <motion.div variants={riseChild} className="md:col-span-7 lg:col-span-6">
            <p className="max-w-md text-[16.5px] leading-relaxed text-[var(--fg-dim)]">
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
            </div>

            {/* Honest friction disclosure, not hidden in an FAQ: the
                installer isn't code-signed yet, so SmartScreen can interrupt
                the very first click someone makes on this page. Saying so
                up front, right where the click happens, costs us nothing and
                is worth more than a surprise warning would. */}
            <p className="mt-3 max-w-md text-[12.5px] leading-relaxed text-[var(--fg-dim)]">
              {text.hero.safetyNote}
            </p>

            <div className="mt-6 max-w-md">
              <WingetTerminal />
            </div>

            <div className="mt-9 flex flex-wrap gap-5">
              {text.hero.badges.map((b) => (
                <a
                  key={b.label}
                  href={b.href}
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
        </div>
      </motion.div>
    </header>
  );
}
