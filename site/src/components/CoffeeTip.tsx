import { useState } from "react";
import cupMark from "../assets/coffee-mark.webp";
import { buyCoffee } from "../api";
import { text } from "../i18n/dictionary";

/** Matches TIP_MAX_QUANTITY on the backend, which clamps to it regardless —
 *  this copy only keeps the stepper from offering a number that gets clamped. */
const MAX_COFFEES = 10;

/**
 * The tip control, sitting beside the hero download button: outlined rather
 * than filled and a size down, because there is exactly one thing this page is
 * for and it is the download — but next to it rather than at the foot of the
 * page, because a tip nobody scrolls to is a tip nobody gives.
 *
 * The count sits inline with the label, in one control, and pressing the label
 * opens Checkout. There is no fold-away panel and no separate confirm button:
 * that arrangement had a hidden CTA in it, and a hidden CTA is a thing that
 * can be clicked by accident — it was, under prefers-reduced-motion, and it
 * opened a real Stripe Checkout. Nothing here is hidden, so nothing here can
 * leak. Losing the "fuel the next release" line is a fair price.
 *
 * `id="tip"` is the landing target for GitHub's Sponsor button, wired in
 * .github/FUNDING.yml.
 */
export function CoffeeTip({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(1);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  return (
    // scroll-mt clears the fixed nav when someone arrives via /#tip.
    <div id="tip" className="scroll-mt-28">
      <div className="flex flex-wrap items-center gap-4">
        {children}

        <div className="flex items-center rounded-xl border border-white/15 transition-colors focus-within:border-[var(--accent)]/50 hover:border-[var(--accent)]/40">
          <StepperButton
            label={text.coffee.fewer}
            disabled={count <= 1}
            onClick={() => setCount((n) => Math.max(1, n - 1))}
          >
            −
          </StepperButton>
          {/* aria-live so the new count is announced, not only the button that
              changed it. The key remounts the span, replaying the pop
              animation on every press. */}
          <span
            key={count}
            aria-live="polite"
            className="coffee-count font-mono-t min-w-[42px] text-center text-[14px] font-bold"
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

          <span aria-hidden="true" className="h-7 w-px bg-white/12" />

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
            className="coffee-pill inline-flex cursor-pointer items-center gap-2 rounded-r-xl px-4 py-3 text-[13.5px] font-semibold text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] disabled:opacity-60"
          >
            <img
              src={cupMark}
              alt=""
              // Decorative: the label beside it already says what this is.
              aria-hidden="true"
              width={96}
              height={112}
              className="coffee-mark h-[24px] w-auto shrink-0"
            />
            {state === "pending" ? "…" : text.coffee.pill}
          </button>
        </div>
      </div>

      <p
        role={state === "error" ? "alert" : undefined}
        className="mt-3 text-[12px] text-[var(--fg-dim)]"
        style={state === "error" ? { color: "#ff9b9b" } : undefined}
      >
        {state === "error" ? text.coffee.unavailable : text.coffee.caption}
      </p>
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
      className="h-11 w-8 shrink-0 cursor-pointer text-[15px] leading-none text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}
