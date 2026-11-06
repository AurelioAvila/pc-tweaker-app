import type { Lang } from "../i18n";

/** Paying with PayPal through Stripe. Shown only for the plans GET
 *  /api/billing/prices lists under `paypal` (PAYPAL_CHECKOUT_ENABLED on the
 *  server): the same total as paying by card from the buyer's country, sold by
 *  us directly rather than through Link (TERMS.md section 2). Shared with the
 *  site, so this file imports nothing at runtime. */
export const PAYPAL_COPY: Record<Lang, { pay: string; fine: string; paid: string }> = {
  en: {
    pay: "Pay with PayPal",
    fine: "PayPal costs the same as card. Sold by us directly, not through Link.",
    paid: "paid with PayPal",
  },
  it: {
    pay: "Paga con PayPal",
    fine: "Con PayPal paghi quanto con la carta. Venduto direttamente da noi, non tramite Link.",
    paid: "pagato con PayPal",
  },
  fr: {
    pay: "Payer avec PayPal",
    fine: "Avec PayPal, vous payez le même prix qu'avec une carte. Vendu directement par nous, pas via Link.",
    paid: "payé avec PayPal",
  },
  es: {
    pay: "Pagar con PayPal",
    fine: "Con PayPal pagas lo mismo que con tarjeta. Te lo vendemos directamente, no a través de Link.",
    paid: "pagado con PayPal",
  },
  de: {
    pay: "Mit PayPal bezahlen",
    fine: "Mit PayPal zahlst du dasselbe wie mit Karte. Wir verkaufen dir direkt, nicht über Link.",
    paid: "bezahlt mit PayPal",
  },
  pt: {
    pay: "Pagar com PayPal",
    fine: "Com o PayPal paga o mesmo que com cartão. Vendido diretamente por nós, não através da Link.",
    paid: "pago com PayPal",
  },
};
