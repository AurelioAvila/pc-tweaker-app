import type { Copy } from "./copy";

export type TrialMailKind = "trial_started" | "trial_ending" | "trial_rejected";

export type TrialMailInput = {
  product: string;
  firstName: string;
  plan: string | null;
  /** The trial's last day, already formatted in the reader's language. */
  trialEndsOn: string | null;
  /** The first charge after the trial as Stripe previews it (coupon and tax included), e.g. "€3.99". */
  chargeLabel: string | null;
  /** The regular renewal price, e.g. "€7.99 / month". */
  renewLabel: string | null;
};

/**
 * The trial messages. Null means the template is not written yet: delivery
 * then fails and is retried, so nothing provisional ever reaches a customer.
 */
export function trialMail(
  _kind: TrialMailKind,
  _input: TrialMailInput,
  _c: Copy,
): { subject: string; html: string; text: string } | null {
  return null;
}
