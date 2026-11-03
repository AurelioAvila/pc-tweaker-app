import { forwardRef, useId } from "react";

/* The Terms box before Stripe (owner decision 3 Nov 2026). Managed Payments refuses
   Stripe's own consent fields, so the box is ours; the API records the tick
   (backend/src/purchase-evidence.ts) and creates no checkout without it. */

export type ConsentLang = "en" | "de" | "it" | "fr" | "es" | "pt";
export const CONSENT_LANGS: readonly ConsentLang[] = ["en", "de", "it", "fr", "es", "pt"];

type ConsentCopy = { before: string; terms: string; after: string; renew: string; error: string; cta: string };
export const CONSENT_COPY: Record<ConsentLang, ConsentCopy> = {
  en: {
    before: "I agree to the ",
    terms: "Terms",
    after: ". I ask for immediate access to this digital content and understand that I lose my 14-day right of withdrawal once access starts. Purchases are not refundable, except where Link’s buyer terms or the law require a refund.",
    renew: " Subscriptions renew automatically until you cancel.",
    error: "Tick the box to continue.",
    cta: "Continue to secure checkout",
  },
  de: {
    before: "Ich stimme den ",
    terms: "Nutzungsbedingungen",
    after: " zu. Ich verlange ausdrücklich, dass der Zugang zu diesen digitalen Inhalten sofort beginnt, und mir ist bekannt, dass ich damit mein 14-tägiges Widerrufsrecht verliere. Käufe werden nicht erstattet, außer wenn die Käuferbedingungen von Link oder das Gesetz eine Erstattung vorsehen.",
    renew: " Abos verlängern sich automatisch bis zur Kündigung.",
    error: "Setz das Häkchen, um fortzufahren.",
    cta: "Weiter zur sicheren Kasse",
  },
  it: {
    before: "Accetto i ",
    terms: "Termini",
    after: ". Chiedo di accedere subito a questo contenuto digitale e so che, una volta iniziato l’accesso, perdo il diritto di recesso di 14 giorni. Gli acquisti non sono rimborsabili, salvo quando lo prevedono i termini per gli acquirenti di Link o la legge.",
    renew: " Gli abbonamenti si rinnovano automaticamente finché non li disdici.",
    error: "Spunta la casella per continuare.",
    cta: "Continua al pagamento sicuro",
  },
  fr: {
    before: "J’accepte les ",
    terms: "Conditions d’utilisation",
    after: ". Je demande l’accès immédiat à ce contenu numérique et je reconnais perdre mon droit de rétractation de 14 jours dès que l’accès commence. Les achats ne sont pas remboursables, sauf lorsque les conditions acheteurs de Link ou la loi imposent un remboursement.",
    renew: " Les abonnements se renouvellent automatiquement jusqu’à leur résiliation.",
    error: "Cochez la case pour continuer.",
    cta: "Continuer vers le paiement sécurisé",
  },
  es: {
    before: "Acepto los ",
    terms: "Términos",
    after: ". Solicito el acceso inmediato a este contenido digital y entiendo que pierdo mi derecho de desistimiento de 14 días en cuanto empieza el acceso. Las compras no son reembolsables, salvo cuando las condiciones para compradores de Link o la ley exijan un reembolso.",
    renew: " Las suscripciones se renuevan automáticamente hasta que las canceles.",
    error: "Marca la casilla para continuar.",
    cta: "Continuar al pago seguro",
  },
  pt: {
    before: "Aceito os ",
    terms: "Termos",
    after: ". Peço o acesso imediato a este conteúdo digital e compreendo que perco o meu direito de livre resolução de 14 dias assim que o acesso começa. As compras não são reembolsáveis, exceto quando os termos para compradores do Link ou a lei exigirem um reembolso.",
    renew: " As subscrições renovam-se automaticamente até serem canceladas.",
    error: "Assinale a caixa para continuar.",
    cta: "Continuar para o pagamento seguro",
  },
};

/** The bordered box (label tied to the checkbox) and, when it was left unticked,
 *  the error under it. The parent focuses the checkbox through the ref. */
export const PurchaseConsent = forwardRef<HTMLInputElement, {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error: boolean;
  subscription: boolean;
  termsHref: string;
  lang?: ConsentLang;
}>(function PurchaseConsent({ checked, onChange, error, subscription, termsHref, lang = "en" }, ref) {
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
          {subscription && copy.renew}
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
