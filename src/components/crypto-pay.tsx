import { localeOf, type Lang } from "../i18n";
import { CRYPTO_COPY, usd } from "./crypto-copy";
import "./crypto-pay.css";

/** The secondary choice under the Lifetime button. */
export function CryptoLifetimeOption({
  lang,
  usdCents,
  disabled,
  busy,
  onPay,
}: {
  lang: Lang;
  usdCents: number;
  disabled: boolean;
  busy: boolean;
  onPay: () => void;
}) {
  const copy = CRYPTO_COPY[lang];
  return (
    <div className="crypto-pay">
      <button
        type="button"
        className="pricing-button pricing-button-secondary crypto-pay-button"
        disabled={disabled}
        aria-busy={busy}
        aria-describedby="crypto-pay-note"
        onClick={onPay}
      >
        {busy ? (
          "…"
        ) : (
          <>
            <span>{copy.lifetime}</span>
            <strong className="crypto-pay-price">≈ {usd(usdCents, localeOf(lang))}</strong>
          </>
        )}
      </button>
      <p className="crypto-pay-note" id="crypto-pay-note">
        {copy.lifetimeNote}
      </p>
    </div>
  );
}
