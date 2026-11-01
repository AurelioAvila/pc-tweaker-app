import type { Lang } from "../i18n";

/** Paying in USDC through Stripe's "Stablecoins and Crypto" method. Shown only
 *  while GET /api/billing/prices reports crypto available (CRYPTO_CHECKOUT_ENABLED
 *  on the server). Same price as by card: the euro price converted to US
 *  dollars, which is the only currency Stripe charges crypto in. */
export const CRYPTO_COPY: Record<Lang, { lifetime: string; lifetimeNote: string; coffee: string }> =
  {
    en: {
      lifetime: "Pay with crypto (USDC)",
      lifetimeNote:
        "Same price as by card, charged in US dollars and paid in USDC on Stripe's page. Digital purchase: no refunds, as in our Terms.",
      coffee: "or pay ≈ {price} in crypto (USDC)",
    },
    it: {
      lifetime: "Paga in crypto (USDC)",
      lifetimeNote:
        "Stesso prezzo della carta, addebitato in dollari USA e pagato in USDC sulla pagina di Stripe. Acquisto digitale: nessun rimborso, come previsto dai Termini.",
      coffee: "oppure paga ≈ {price} in crypto (USDC)",
    },
    fr: {
      lifetime: "Payer en crypto (USDC)",
      lifetimeNote:
        "Même prix que par carte, facturé en dollars américains et payé en USDC sur la page de Stripe. Achat numérique : aucun remboursement, conformément à nos Conditions.",
      coffee: "ou payer ≈ {price} en crypto (USDC)",
    },
    es: {
      lifetime: "Pagar con cripto (USDC)",
      lifetimeNote:
        "El mismo precio que con tarjeta, cobrado en dólares estadounidenses y pagado en USDC en la página de Stripe. Compra digital: sin reembolsos, según nuestros Términos.",
      coffee: "o pagar ≈ {price} con cripto (USDC)",
    },
    de: {
      lifetime: "Mit Krypto bezahlen (USDC)",
      lifetimeNote:
        "Derselbe Preis wie mit Karte, in US-Dollar berechnet und auf der Stripe-Seite in USDC bezahlt. Digitaler Kauf: keine Erstattung, wie in unseren Nutzungsbedingungen.",
      coffee: "oder ≈ {price} mit Krypto zahlen (USDC)",
    },
    pt: {
      lifetime: "Pagar com cripto (USDC)",
      lifetimeNote:
        "O mesmo preço que com cartão, cobrado em dólares americanos e pago em USDC na página da Stripe. Compra digital: sem reembolsos, conforme os nossos Termos.",
      coffee: "ou pagar ≈ {price} com cripto (USDC)",
    },
  };

/** US cents as "$46.39" in the reader's number format (a BCP 47 locale). */
export function usd(cents: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
  }).format(cents / 100);
}

/** "or pay ≈ $3.48 in crypto (USDC)" for the coffees chosen. Shared with the site,
 *  so this file imports nothing at runtime. */
export function cryptoCoffeeLabel(
  lang: Lang,
  coffees: number,
  usdCentsEach: number,
  locale?: string,
): string {
  return CRYPTO_COPY[lang].coffee.replace("{price}", usd(coffees * usdCentsEach, locale));
}
