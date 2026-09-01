import { useState } from "react";
import cupMark from "../assets/coffee-mark.webp";
import { buyCoffee } from "../api";
import { text } from "../i18n/dictionary";

/** Matches TIP_MAX_QUANTITY on the backend, which clamps to it regardless —
 *  this copy only keeps the stepper from offering a number that gets clamped. */
const MAX_COFFEES = 10;

/**
 * The tip control, sitting beside the hero download button.
 *
 * It is deliberately secondary to that button — outlined, not filled, and a
 * size down — because there is exactly one thing this page is for and it is
 * the download. But it is beside it rather than at the foot of the page,
 * because a tip nobody scrolls to is a tip nobody gives.
 *
 * It owns the CTA row and takes the download button as `children` rather than
 * being dropped in next to it. The stepper is wider than the pill, so a
 * self-contained wrapper would have to be either full-width — pushing the pill
 * onto its own line — or auto-width, making the pill jump lines as it opens.
 * Owning the row keeps the pill beside the button while the stepper unfolds
 * under the whole row.
 *
 * At rest it is one small pill. The stepper unfolds on press: "how many
 * coffees" is the whole gesture, and asking after the browser has already
 * opened puts the question on the wrong side of the decision. Motion lives in
 * .coffee-* in index.css.
 *
 * `id="tip"` is the landing target for GitHub's Sponsor button, wired in
 * .github/FUNDING.yml.
 */
export function CoffeeTip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  return (
    // scroll-mt clears the fixed nav when someone arrives via /#tip.
    <div id="tip" className="scroll-mt-28">
      <div className="flex flex-wrap items-center gap-4">
        {children}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="coffee-pill inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 px-5 py-3 text-[13.5px] font-semibold text-[var(--fg-dim)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--fg)]"
        >
          <img
            src={cupMark}
            alt=""
            // Decorative: the label beside it already says what this is.
            aria-hidden="true"
            width={96}
            height={112}
            className="coffee-mark h-[26px] w-auto shrink-0"
          />
          {text.coffee.pill}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={`h-3 w-3 shrink-0 opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M6 9.5 12 15.5 18 9.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Kept mounted so it animates shut too. What stops the collapsed
          stepper from staying tabbable and clickable is visibility:hidden in
          .coffee-reveal, not `inert`: this site is on React 18, where
          inert={false} renders inert="false" and HTML treats the attribute's
          presence alone as inert — the stepper would never become usable. */}
      <div className="coffee-reveal" data-open={open}>
        <div>
          <div className="flex flex-wrap items-center gap-2.5 pt-4">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1">
              <StepperButton
                label={text.coffee.fewer}
                disabled={count <= 1}
                onClick={() => setCount((n) => Math.max(1, n - 1))}
              >
                −
              </StepperButton>
              {/* aria-live so the new count is announced, not only the button
                  that changed it. The key remounts the span, replaying the pop
                  animation on every press. */}
              <span
                key={count}
                aria-live="polite"
                className="coffee-count font-mono-t min-w-[58px] text-center text-[13.5px] font-bold"
              >
                {count} ☕
              </span>
              <StepperButton
                label={text.coffee.more}
                disabled={count >= MAX_COFFEES}
                onClick={() => setCount((n) => Math.min(MAX_COFFEES, n + 1))}
              >
                +
              </StepperButton>
            </div>

            <button
              type="button"
              disabled={state === "pending"}
              onClick={() => {
                setState("pending");
                buyCoffee(count)
                  .then(({ url }) => {
                    window.location.href = url;
                  })
                  .catch(() => setState("error"));
              }}
              className="border-accent/50 text-accent hover:bg-accent cursor-pointer rounded-xl border px-5 py-2.5 text-[13.5px] font-bold transition-colors hover:text-[var(--bg)] disabled:opacity-60"
            >
              {state === "pending" ? "…" : text.coffee.cta}
            </button>
          </div>

          <p
            role={state === "error" ? "alert" : undefined}
            className="mt-2.5 text-[12px] text-[var(--fg-dim)]"
            style={state === "error" ? { color: "#ff9b9b" } : undefined}
          >
            {state === "error" ? text.coffee.unavailable : text.coffee.caption}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 shrink-0 cursor-pointer rounded-lg text-[15px] leading-none text-[var(--fg-dim)] transition-colors hover:bg-white/5 hover:text-[var(--fg)] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
