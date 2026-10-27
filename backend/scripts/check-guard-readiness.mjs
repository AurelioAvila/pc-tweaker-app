import Stripe from 'stripe';
import { pathToFileURL } from 'node:url';

/** Read-only preflight for the first guarded rollout. No customer IDs, email,
 * session URLs, or keys are included in its result. A capped or failed scan is
 * incomplete and never reports ready. */
export async function inspectUnreservedSessions(sessions, maxItems = 10000) {
 const counts = { open: 0, completedUnpaid: 0, relevantOpen: 0, relevantUnpaid: 0, unknownProduct: 0 };
 let scanned = 0;
 for (const status of ['open', 'complete']) {
  for await (const session of sessions.list({status,limit:100})) {
   if (++scanned > maxItems) throw new Error('scan_incomplete');
   if (status === 'complete' && session.payment_status !== 'unpaid') continue;
   const product = session.metadata?.product;
   const relevant = product === 'pctweaker' || product === 'uninstaller';
   if (!relevant) counts.unknownProduct++;
   if (status === 'open') { counts.open++; if (relevant) counts.relevantOpen++; }
   else { counts.completedUnpaid++; if (relevant) counts.relevantUnpaid++; }
  }
 }
 return { scanned, counts, safeToActivate: counts.relevantOpen === 0 && counts.relevantUnpaid === 0 && counts.unknownProduct === 0 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const key = process.env.STRIPE_SECRET_KEY;
 if (!key) { console.error('Stripe key is not configured; readiness is not verified.'); process.exitCode=1; }
 else {
  try {
   const stripe = new Stripe(key,{apiVersion:'2025-03-31.basil'});
   const result=await inspectUnreservedSessions(stripe.checkout.sessions);
   console.log(JSON.stringify(result,null,2));
   if (!result.safeToActivate) process.exitCode=2;
  } catch { console.error('Stripe scan incomplete; readiness is not verified.');process.exitCode=1; }
 }
}
