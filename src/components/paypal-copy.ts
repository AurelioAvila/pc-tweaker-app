import type { Lang } from "../i18n";

/** Paying with PayPal through Stripe. Shown only for the plans GET
 *  /api/billing/prices lists under `paypal` (PAYPAL_CHECKOUT_ENABLED on the
 *  server): the same total as paying by card from the buyer's country, sold by
 *  us directly rather than through Link (TERMS.md section 2). Shared with the
 *  site, so this file imports nothing at runtime. */
export const PAYPAL_COPY: Record<Lang, { pay: string; fine: string; paid: string }> = {
  en: {
    pay: "Pay with PayPal",
    fine: "PayPal costs the same total as paying by card. A PayPal purchase is sold by us directly, not through Link.",
    paid: "paid with PayPal",
  },
  it: {
    pay: "Paga con PayPal",
    fine: "Con PayPal il totale è lo stesso del pagamento con carta. Un acquisto con PayPal è venduto direttamente da noi, non tramite Link.",
    paid: "pagato con PayPal",
  },
  fr: {
    pay: "Payer avec PayPal",
    fine: "Avec PayPal, le total est le même qu'avec une carte. Un achat par PayPal vous est vendu directement par nous, et non via Link.",
    paid: "payé avec PayPal",
  },
  es: {
    pay: "Pagar con PayPal",
    fine: "Con PayPal, el total es el mismo que pagando con tarjeta. Una compra con PayPal te la vendemos directamente nosotros, no a través de Link.",
    paid: "pagado con PayPal",
  },
  de: {
    pay: "Mit PayPal bezahlen",
    fine: "Mit PayPal zahlst du denselben Gesamtbetrag wie mit Karte. Einen Kauf mit PayPal verkaufen wir dir direkt, nicht über Link.",
    paid: "bezahlt mit PayPal",
  },
  pt: {
    pay: "Pagar com PayPal",
    fine: "Com o PayPal, o total é o mesmo que pagar com cartão. Uma compra com PayPal é-lhe vendida diretamente por nós, não através da Link.",
    paid: "pago com PayPal",
  },
};
