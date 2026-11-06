import type { ButtonHTMLAttributes } from "react";
import { PaypalText } from "../../../src/components/paypal-mark";

/** PayPal's black button with its white logo (the "black" style of PayPal's own
 *  buttons), as tall and round as the accent button next to it. `label` is the
 *  whole text ("Pay with PayPal"); its word PayPal is drawn as the logo. */
export function PaypalButton({ label, busy, className = "", ...rest }: { label: string; busy: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy}
      className={`flex min-h-[52px] w-full items-center justify-center rounded-xl border border-white/25 bg-black px-5 font-semibold text-white transition-colors hover:border-white/50 hover:bg-[#141414] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--fg)] active:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...rest}
    >
      {busy ? (
        <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:[animation-duration:2s]" />
      ) : (
        <span className="whitespace-nowrap">
          <PaypalText text={label} height="22px" />
        </span>
      )}
    </button>
  );
}
