import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../constants";
import { createPurchaseClient, PurchaseError } from "../web-purchase-client";
import { PURCHASE_TERMS_VERSION } from "../purchase-terms";
import { CONSENT_COPY, CONSENT_LANGS, PurchaseConsent, type ConsentLang } from "../components/PurchaseConsent";
import { PAYPAL_COPY } from "../../../src/components/paypal-copy";
import { PaypalButton } from "../components/PaypalButton";

/* /checkout/confirm/: the Terms box for a purchase started in an app. The app opens
   this page with a signed link in the fragment (#t=..., never sent to a server or in
   a Referer); ticking the box sends it to POST /api/checkout/confirm, which records
   the consent and answers with Stripe's page. Nothing is charged here. The plan,
   trial and account come from the signed link, never from this page. */

type Product = keyof typeof PURCHASE_TERMS_VERSION;
type Plan = "monthly" | "annual" | "lifetime" | "pass_7d";
type Intent = { link: string; product: Product; plan: Plan; trial: boolean; crypto: boolean; paypal: boolean; lang: ConsentLang };

const TERMS_HREF: Record<Product, string> = {
  pctweaker: "/terms/",
  uninstaller: "https://github.com/AurelioAvila/pc-tweaker-uninstaller/blob/master/TERMS.md",
};
const PRODUCT_NAME: Record<Product, string> = { pctweaker: "PC Tweaker Pro", uninstaller: "PC Tweaker Uninstaller Pro" };

const PAGE: Record<ConsentLang, {
  heading: string; plans: Record<Plan, string>; trial: string; crypto: string; note: string; opening: string;
  missing: string; expired: string; changed: string; failed: string;
}> = {
  en: {
    heading: "Before you pay",
    plans: { monthly: "Pro monthly", annual: "Pro annual", lifetime: "Lifetime", pass_7d: "Pro 7-day pass, one payment, no renewal" },
    trial: "with the 3-day free trial", crypto: "paid in USDC",
    note: "Nothing is charged on this page. Stripe’s secure page shows the final price before you pay.",
    opening: "Opening the secure checkout…",
    missing: "This page opens from the plan screen in the app. Choose a plan there to continue.",
    expired: "This link has expired. Go back to the app and choose the plan again.",
    changed: "The Terms were updated a moment ago. Reload the page to read them.",
    failed: "The checkout could not start. Please try again in a moment.",
  },
  de: {
    heading: "Bevor du bezahlst",
    plans: { monthly: "Pro monatlich", annual: "Pro jährlich", lifetime: "Lifetime", pass_7d: "Pro 7-Tage-Pass, eine Zahlung, keine Verlängerung" },
    trial: "mit der 3-tägigen kostenlosen Testphase", crypto: "bezahlt in USDC",
    note: "Auf dieser Seite wird nichts berechnet. Den Endpreis siehst du auf der sicheren Seite von Stripe, bevor du bezahlst.",
    opening: "Die sichere Kasse wird geöffnet …",
    missing: "Diese Seite öffnet sich über die Tarifauswahl in der App. Wähle dort einen Tarif, um fortzufahren.",
    expired: "Dieser Link ist abgelaufen. Geh zurück zur App und wähle den Tarif erneut.",
    changed: "Die Nutzungsbedingungen wurden gerade aktualisiert. Lade die Seite neu, um sie zu lesen.",
    failed: "Die Kasse konnte nicht geöffnet werden. Versuch es gleich noch einmal.",
  },
  it: {
    heading: "Prima di pagare",
    plans: { monthly: "Pro mensile", annual: "Pro annuale", lifetime: "Lifetime", pass_7d: "Pass Pro 7 giorni, un solo pagamento, nessun rinnovo" },
    trial: "con la prova gratuita di 3 giorni", crypto: "pagato in USDC",
    note: "Questa pagina non addebita nulla. La pagina sicura di Stripe mostra il prezzo finale prima del pagamento.",
    opening: "Apertura del pagamento sicuro…",
    missing: "Questa pagina si apre dalla schermata dei piani nell’app. Scegli lì un piano per continuare.",
    expired: "Questo link è scaduto. Torna nell’app e scegli di nuovo il piano.",
    changed: "I Termini sono appena stati aggiornati. Ricarica la pagina per leggerli.",
    failed: "Non è stato possibile aprire il pagamento. Riprova tra poco.",
  },
  fr: {
    heading: "Avant de payer",
    plans: { monthly: "Pro mensuel", annual: "Pro annuel", lifetime: "Lifetime", pass_7d: "Pass Pro 7 jours, un seul paiement, sans renouvellement" },
    trial: "avec l’essai gratuit de 3 jours", crypto: "payé en USDC",
    note: "Rien n’est débité sur cette page. La page sécurisée de Stripe affiche le prix final avant le paiement.",
    opening: "Ouverture du paiement sécurisé…",
    missing: "Cette page s’ouvre depuis l’écran des offres de l’application. Choisissez-y une offre pour continuer.",
    expired: "Ce lien a expiré. Revenez à l’application et choisissez à nouveau l’offre.",
    changed: "Les Conditions d’utilisation viennent d’être mises à jour. Rechargez la page pour les lire.",
    failed: "Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.",
  },
  es: {
    heading: "Antes de pagar",
    plans: { monthly: "Pro mensual", annual: "Pro anual", lifetime: "Lifetime", pass_7d: "Pase Pro de 7 días, un solo pago, sin renovación" },
    trial: "con la prueba gratuita de 3 días", crypto: "pagado en USDC",
    note: "En esta página no se cobra nada. La página segura de Stripe muestra el precio final antes de pagar.",
    opening: "Abriendo el pago seguro…",
    missing: "Esta página se abre desde la pantalla de planes de la aplicación. Elige allí un plan para continuar.",
    expired: "Este enlace ha caducado. Vuelve a la aplicación y elige el plan de nuevo.",
    changed: "Los Términos se acaban de actualizar. Recarga la página para leerlos.",
    failed: "No se pudo abrir el pago. Inténtalo de nuevo en un momento.",
  },
  pt: {
    heading: "Antes de pagar",
    plans: { monthly: "Pro mensal", annual: "Pro anual", lifetime: "Lifetime", pass_7d: "Passe Pro de 7 dias, um único pagamento, sem renovação" },
    trial: "com o período de avaliação gratuito de 3 dias", crypto: "pago em USDC",
    note: "Nesta página não é cobrado nada. A página segura do Stripe mostra o preço final antes de pagar.",
    opening: "A abrir o pagamento seguro…",
    missing: "Esta página abre a partir do ecrã de planos da aplicação. Escolha aí um plano para continuar.",
    expired: "Esta ligação expirou. Volte à aplicação e escolha o plano novamente.",
    changed: "Os Termos acabaram de ser atualizados. Recarregue a página para os ler.",
    failed: "Não foi possível abrir o pagamento. Tente novamente dentro de momentos.",
  },
};

/** What the signed link says, read only to label the page: the API verifies the
 *  signature and takes the plan from it, so a forged fragment buys nothing. */
function readIntent(hash: string): Intent | null {
  const link = new URLSearchParams(hash.replace(/^#/, "")).get("t");
  if (!link) return null;
  try {
    const part = link.split(".")[1] ?? "";
    const p = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
    if (!(p.product in PURCHASE_TERMS_VERSION) || !["monthly", "annual", "lifetime", "pass_7d"].includes(p.plan)) return null;
    const browser = (typeof navigator === "undefined" ? "en" : navigator.language.slice(0, 2)) as ConsentLang;
    const lang = CONSENT_LANGS.includes(p.lang) ? p.lang : CONSENT_LANGS.includes(browser) ? browser : "en";
    return { link, product: p.product, plan: p.plan, trial: p.trial === true, crypto: p.crypto === true, paypal: p.paypal === true, lang };
  } catch {
    return null;
  }
}

export function ConfirmPurchasePage() {
  // Read after hydration: the prerendered page has no fragment.
  const [intent, setIntent] = useState<Intent | null | undefined>(undefined);
  const [agreed, setAgreed] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const consentBox = useRef<HTMLInputElement>(null);
  const [client] = useState(() => createPurchaseClient(API_BASE));
  useEffect(() => setIntent(readIntent(window.location.hash)), []);

  const lang = intent?.lang ?? "en";
  const t = PAGE[lang];
  async function go() {
    if (!intent) return;
    if (!agreed) {
      setConsentError(true);
      consentBox.current?.focus();
      return;
    }
    setBusy(true);
    setMessage(t.opening);
    try {
      window.location.assign(await client.confirmCheckout(intent.link, PURCHASE_TERMS_VERSION[intent.product]));
    } catch (err) {
      const code = err instanceof PurchaseError ? err.code : undefined;
      setMessage(code === "link_expired" ? t.expired : code === "terms_changed" ? t.changed : err instanceof Error && err.message ? err.message : t.failed);
      setBusy(false);
    }
  }

  return (
    <main id="main-content" lang={lang} className="px-5 pt-32 pb-24 md:px-12">
      <section aria-labelledby="confirm-heading" className="mx-auto max-w-xl rounded-2xl border border-white/15 bg-[var(--bg-2)] p-5 sm:p-10">
        {intent === undefined ? (
          <h1 id="confirm-heading" className="font-display text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-3xl">{PAGE.en.heading}</h1>
        ) : intent === null ? (
          <>
            <h1 id="confirm-heading" className="font-display text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-3xl">{t.heading}</h1>
            <p className="mt-4 text-sm leading-relaxed text-[var(--fg-dim)]">{t.missing}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-[var(--accent)]">{PRODUCT_NAME[intent.product]}</p>
            <h1 id="confirm-heading" className="font-display mt-2 text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-3xl">{t.heading}</h1>
            <p className="mt-4 text-lg font-semibold text-[var(--fg)]">
              {t.plans[intent.plan]}
              {intent.trial && intent.plan !== "lifetime" && intent.plan !== "pass_7d" ? `, ${t.trial}` : ""}
              {intent.crypto ? `, ${t.crypto}` : ""}
              {intent.paypal ? `, ${PAYPAL_COPY[lang].paid}` : ""}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">{t.note}</p>
            <div className="mt-6">
              <PurchaseConsent
                ref={consentBox}
                lang={lang}
                checked={agreed}
                error={consentError}
                termsHref={TERMS_HREF[intent.product]}
                onChange={(checked) => {
                  setAgreed(checked);
                  if (checked) setConsentError(false);
                }}
              />
            </div>
            {intent.paypal ? (
              <PaypalButton label={PAYPAL_COPY[lang].pay} busy={busy} disabled={busy} onClick={() => void go()} className="mt-4" />
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void go()}
                className="bg-accent mt-4 w-full rounded-xl px-5 py-4 font-bold text-[var(--on-accent)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--fg)] disabled:opacity-60"
              >
                {CONSENT_COPY[lang].cta}
              </button>
            )}
            {message && (
              <p role="status" className="mt-4 rounded-lg border border-white/15 p-4 text-sm text-[var(--fg)]">
                {message}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
