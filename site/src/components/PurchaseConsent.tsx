import { forwardRef, useId } from "react";

/* The Terms box before Stripe (owner decisions of 3 and 4 Nov 2026: one line, the Terms and
   immediate access ending the withdrawal right, nothing below it). Managed Payments refuses
   Stripe's own consent fields, so the box is ours; the API records the tick
   (backend/src/purchase-evidence.ts) and creates no checkout without it. */

export type ConsentLang = "en" | "de" | "it" | "fr" | "es" | "pt";
export const CONSENT_LANGS: readonly ConsentLang[] = ["en", "de", "it", "fr", "es", "pt"];

type ConsentCopy = { before: string; terms: string; after: string; error: string; cta: string };
export const CONSENT_COPY: Record<ConsentLang, ConsentCopy> = {
  en: {
    before: "I agree to the ", terms: "Terms",
    after: " and want access now, ending my 14-day right of withdrawal.",
    error: "Tick the box to continue.", cta: "Continue to secure checkout",
  },
  de: {
    before: "Ich stimme den ", terms: "Nutzungsbedingungen",
    after: " zu und möchte sofort Zugang – damit endet mein 14-tägiges Widerrufsrecht.",
    error: "Setz das Häkchen, um fortzufahren.", cta: "Weiter zur sicheren Kasse",
  },
  it: {
    before: "Accetto i ", terms: "Termini",
    after: " e voglio l’accesso subito, rinunciando al diritto di recesso di 14 giorni.",
    error: "Spunta la casella per continuare.", cta: "Continua al pagamento sicuro",
  },
  fr: {
    before: "J’accepte les ", terms: "Conditions d’utilisation",
    after: " et je veux un accès immédiat, ce qui met fin à mon droit de rétractation de 14 jours.",
    error: "Cochez la case pour continuer.", cta: "Continuer vers le paiement sécurisé",
  },
  es: {
    before: "Acepto los ", terms: "Términos",
    after: " y quiero acceder ahora, por lo que pierdo mi derecho de desistimiento de 14 días.",
    error: "Marca la casilla para continuar.", cta: "Continuar al pago seguro",
  },
  pt: {
    before: "Aceito os ", terms: "Termos",
    after: " e quero acesso imediato, o que põe fim ao meu direito de livre resolução de 14 dias.",
    error: "Assinale a caixa para continuar.", cta: "Continuar para o pagamento seguro",
  },
};

/** The bordered box (label tied to the checkbox) and, when it was left unticked,
 *  the error under it. The parent focuses the checkbox through the ref. */
export const PurchaseConsent = forwardRef<HTMLInputElement, {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error: boolean;
  termsHref: string;
  lang?: ConsentLang;
}>(function PurchaseConsent({ checked, onChange, error, termsHref, lang = "en" }, ref) {
  const copy = CONSENT_COPY[lang];
  const errorId = useId();
  return (
    <div>
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-[var(--bg)] p-4 ${error ? "border-[#ff8a80]" : "border-white/15"}`}
      >
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.currentTarget.checked)}
          aria-invalid={error || undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--accent)]"
        />
        <span className="text-sm leading-relaxed text-[var(--fg)]">
          {copy.before}
          <a
            href={termsHref}
            target="_blank"
            rel="noopener"
            className="underline underline-offset-[3px] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {copy.terms}
          </a>
          {copy.after}
        </span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-[13px] text-[#ff8a80]">
          {copy.error}
        </p>
      )}
    </div>
  );
});
