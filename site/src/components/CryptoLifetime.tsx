import { useId } from "react";
import { CRYPTO_COPY, usd } from "../../../src/components/crypto-copy";

/** "Pay with crypto (USDC) ≈ $46.39": the quiet second choice under a Lifetime
 *  button, with the dollar price as its strongest text. Rendered only while
 *  GET /api/billing/prices reports crypto available. */
export function CryptoLifetimeChoice({
  usdCents,
  onChoose,
  disabled = false,
}: {
  usdCents: number;
  onChoose: () => void;
  disabled?: boolean;
}) {
  const copy = CRYPTO_COPY.en;
  const note = useId();
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled}
        onClick={onChoose}
        aria-describedby={note}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/15 px-4 py-3 text-left text-[13.5px] font-semibold text-[var(--fg)] transition-colors hover:border-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
      >
        <span>{copy.lifetime}</span>
        <span className="font-mono-t text-[15px] font-bold whitespace-nowrap">≈ {usd(usdCents, "en-US")}</span>
      </button>
      <p id={note} className="mt-2 text-[12px] leading-relaxed text-[var(--fg-dim)]">
        {copy.lifetimeNote}
      </p>
    </div>
  );
}
