import { useState } from "react";
import { buyCoffee } from "../api";
import { text } from "../i18n/dictionary";
import { usePriceList } from "../trial";
import { euro } from "../promo";
import { cryptoCoffeeLabel } from "../../../src/components/crypto-copy";

/** Matches TIP_MAX_QUANTITY on the backend, which clamps to it regardless —
 *  this copy only keeps the stepper from offering a number that gets clamped. */
const MAX_COFFEES = 10;

/** The coffee Price on Stripe (STRIPE_PRICE_COFFEE) in cents, net like every
 *  price on the site. Shown beside the count so nobody meets the total for the
 *  first time on Checkout, which may show it converted to their own currency. */
const COFFEE_CENTS = 100;

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
  // One coffee in US cents while the server offers crypto; otherwise no crypto choice.
  const cryptoUsd = usePriceList()?.crypto?.coffeeUsd ?? null;
  const tip = (crypto: boolean) => {
    setState("pending");
    buyCoffee(count, crypto)
      .then(({ url }) => {
        window.location.href = url;
      })
      .catch(() => setState("error"));
  };

  return (
    // scroll-mt clears the fixed nav when someone arrives via /#tip.
    <div id="tip" className="scroll-mt-28">
      <div className="flex flex-wrap items-center gap-3 min-[420px]:gap-4">
        {children}

        <div className="flex items-center rounded-xl border border-white/15 transition-colors focus-within:border-[var(--accent)]/50 hover:border-[var(--accent)]/40">
          <StepperButton
            label={text.coffee.fewer}
            disabled={count <= 1}
            onClick={() => setCount((n) => Math.max(1, n - 1))}
          >
            −
          </StepperButton>
          {/* aria-live so the new count and its total are announced, not only
              the button that changed it. Count and total share one line in a
              fixed-width slot with tabular figures, so 9 -> 10 does not move
              the buttons. The key remounts the span, replaying the pop. */}
          <span
            key={count}
            aria-live="polite"
            className="coffee-count font-mono-t w-[80px] shrink-0 text-center text-[13px] font-bold whitespace-nowrap tabular-nums"
          >
            {count} ☕ · {euro(count * COFFEE_CENTS)}
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
            onClick={() => tip(false)}
            aria-label={text.coffee.pill}
            className="coffee-pill inline-flex cursor-pointer items-center rounded-r-xl px-3 py-3 min-[420px]:px-3.5 text-[13.5px] font-semibold text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] disabled:opacity-60"
          >
            {state === "pending" ? (
              "…"
            ) : (
              <>
                <span className="min-[420px]:hidden">{text.coffee.pillShort}</span>
                <span className="hidden min-[420px]:inline">{text.coffee.pill}</span>
              </>
            )}
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
      {cryptoUsd && (
        <button
          type="button"
          disabled={state === "pending"}
          onClick={() => tip(true)}
          className="mt-1.5 cursor-pointer text-[12.5px] text-[var(--fg-dim)] underline decoration-white/25 underline-offset-4 transition-colors hover:text-[var(--fg)] disabled:opacity-60"
        >
          {cryptoCoffeeLabel("en", count, cryptoUsd, "en-US")}
        </button>
      )}
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
      className="h-11 w-7 shrink-0 min-[420px]:w-8 cursor-pointer text-[15px] leading-none text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}
