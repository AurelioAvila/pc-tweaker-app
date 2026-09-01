import { useState } from "react";
import { Strings } from "../i18n";

/** Matches TIP_MAX_QUANTITY on the backend, which clamps to it anyway — this
 *  copy only stops the stepper from offering a number that would be clamped. */
const MAX_COFFEES = 10;

/**
 * The tip entry in the sidebar rail. At rest it is one line, the same size and
 * shape as a navigation row, and quieter than the Pro button below it.
 *
 * Pressing it opens the stepper: "how many coffees" is the whole gesture, and
 * asking after the browser has already opened puts the question on the wrong
 * side of the decision. It stays folded away until asked for, because three
 * permanent controls in the rail would cost attention nobody came here to
 * spend. The motion lives in .coffee-* in App.css.
 */
export function CoffeeCard({ s, onTip }: { s: Strings; onTip: (quantity: number) => void }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);

  return (
    <div className="mb-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`nav-item coffee-row group hover:bg-surface-1/50 flex w-full items-center gap-2.5 rounded-[8px] px-3 py-[7px] text-left text-[13px] transition-colors duration-150 ${
          open ? "text-ink-2" : "text-ink-3 hover:text-ink-2"
        }`}
      >
        {/* The emoji rather than a drawn glyph: the hand-rolled SVG that was
            here read as crooked next to the icon set's own marks, and this is
            the same cup already shown in the count below. */}
        <span aria-hidden="true" className="coffee-mark w-4 shrink-0 text-center text-[13px] leading-none">
          ☕
        </span>
        <span className="truncate">{s.coffee.nav}</span>
        <ChevronDown
          className={`ml-auto h-3 w-3 shrink-0 opacity-50 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Kept mounted so it animates shut as well as open, which is why every
          control inside is `disabled` while closed.

          `inert` and the stylesheet's visibility handling are belt to that
          brace, not the guard itself. The site hit exactly this: its CSS-only
          version leaked a real click through to Stripe Checkout under
          prefers-reduced-motion, because the guard depended on a transition
          finishing. Here the risk is WebView2's version varying across Windows
          installs, so interactivity is gated on component state, where neither
          a stylesheet nor an older webview can reach it. */}
      <div className="coffee-reveal" data-open={open} inert={!open} aria-hidden={!open}>
        <div>
          <div className="flex items-center justify-between gap-1 px-1 pt-1.5">
            <StepperButton
              label={s.coffee.fewer}
              disabled={!open || count <= 1}
              onClick={() => setCount((n) => Math.max(1, n - 1))}
            >
              −
            </StepperButton>
            {/* aria-live so the new count is announced, not just the button
                that changed it. The key remounts the span, which replays the
                pop animation on every press. */}
            <span
              key={count}
              aria-live="polite"
              className="coffee-count type-data text-ink text-[12px] font-semibold"
            >
              {count} ☕
            </span>
            <StepperButton
              label={s.coffee.more}
              disabled={!open || count >= MAX_COFFEES}
              onClick={() => setCount((n) => Math.min(MAX_COFFEES, n + 1))}
            >
              +
            </StepperButton>
          </div>
          <button
            type="button"
            disabled={!open}
            onClick={() => onTip(count)}
            className="border-accent/40 text-ink-2 hover:border-accent hover:bg-accent-soft hover:text-ink mx-1 mt-1.5 mb-1 block w-[calc(100%-0.5rem)] cursor-pointer rounded-[7px] border px-2 py-[5px] text-[11px] font-semibold transition-colors duration-150"
          >
            {s.coffee.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 9.5 12 15.5 18 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      className="border-line-2 text-ink-3 hover:border-accent/40 hover:text-ink active:scale-90 h-[20px] w-[20px] shrink-0 cursor-pointer rounded-[5px] border text-[12px] leading-none transition-all duration-150 disabled:cursor-default disabled:opacity-35 disabled:hover:border-line"
    >
      {children}
    </button>
  );
}
