import { useEffect, useState, type FormEvent } from "react";
import { createPurchaseFlow, type PurchaseStatus } from "../web-purchase-flow";
import { createPurchaseClient, PurchaseError } from "../web-purchase-client";
import { API_BASE, DOWNLOAD_EXE } from "../constants";
import { euro, usePromo } from "../promo";
import { CRYPTO_COPY, usd } from "../../../src/components/crypto-copy";
type Plan = "monthly" | "annual" | "lifetime";
// plan null: the account alone (sign up from the site), with the app download and the plans as next steps.
// cryptoUsd: Lifetime paid in USDC, at this many US cents (from GET /api/billing/prices).
export function WebPurchase({ plan, onClose, demo, onChoosePlan, cryptoUsd = null }: { plan: Plan | null; onClose: () => void; demo: boolean; onChoosePlan?: () => void; cryptoUsd?: number | null }) {
  const crypto = plan === "lifetime" && cryptoUsd !== null;
  const [mode, setMode] = useState<"login" | "register">(plan ? "login" : "register");
  const [status, setStatus] = useState<PurchaseStatus>("signed-out");
  const [message, setMessage] = useState("");
  const [canCancel, setCanCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  // The preview uses only an in-memory fixture. The live client is reachable
  // only through the explicitly enabled, guarded website checkout route.
  const [fixture] = useState(() => {
    if (!demo) {
      const client = createPurchaseClient(API_BASE);
      return { flow: createPurchaseFlow(client, plan ?? undefined), verify: () => {}, forgot: (email: string) => client.forgotPassword(email) };
    }
    let verified = false;
    let previewSubscriber = false;
    const api = {
      signIn: async (email: string) => { verified = true; previewSubscriber = email.toLowerCase() === "subscriber@example.test"; return "preview-token"; },
      register: async () => { verified = false; previewSubscriber = false; return { token: "preview-token", verificationEmailSent: true }; },
      account: async () => ({ email: "preview@example.test", emailVerified: verified, isPro: previewSubscriber, plan: previewSubscriber ? "annual" : null, hasBilling: previewSubscriber }),
      resendVerification: async () => ({ ok: true }),
      checkout: async () => "https://checkout.stripe.com/c/pay/preview",
      cancelCheckout: async () => ({ ok: true }),
    };
    return { flow: createPurchaseFlow(api, plan ?? undefined), verify: () => { verified = true; }, forgot: async (_email: string) => ({ ok: true }) };
  });
  useEffect(() => () => fixture.flow.reset(), [fixture]);
  const promotion = usePromo().offer("pctweaker", plan ?? "annual");
  const label = crypto ? "Lifetime, paid in crypto" : plan === "lifetime" ? "Lifetime" : plan === "annual" ? "Pro annual" : "Pro monthly";
  const terms = plan === "lifetime" ? "One payment. No renewal." : plan === "annual" ? "First year, then renews yearly." : "First month, then renews monthly.";
  const input = "mt-2 w-full rounded-lg border border-white/20 bg-[var(--bg)] px-4 py-3 text-[var(--fg)] outline-offset-2 focus:outline focus:outline-2 focus:outline-[var(--accent)]";
  function showError(error: unknown) {
    if (error instanceof PurchaseError && error.status === 401 && status !== "signed-out") {
      fixture.flow.reset(); setStatus("signed-out"); setMode("login"); setCanCancel(false);
      setMessage("Your session has ended. Please sign in again."); return;
    }
    setMessage(error instanceof Error ? error.message : "Please try again.");
  }
  async function preview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const element = e.currentTarget;
    const form = new FormData(element);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    // The account service enforces the same 8-character minimum.
    if (mode === "register" && password !== String(form.get("confirmPassword") || "")) { setMessage("The passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      if (mode === "login") setStatus(await fixture.flow.signIn(email, password));
      else {
        const result = await fixture.flow.register({ email, password, firstName: String(form.get("firstName") || ""), lastName: String(form.get("lastName") || ""), dateOfBirth: String(form.get("dateOfBirth") || "") });
        setStatus(result.status);
        if (!result.verificationEmailSent) setMessage("The verification email could not be sent. Please retry.");
      }
      element.reset();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function verifyPreview() {
    setBusy(true); setMessage("");
    try { if (demo) fixture.verify(); const next = await fixture.flow.refresh(); setStatus(next); if (next === "verify-email") setMessage("Your email is not verified yet. Open the link in your inbox, then try again."); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  }
  async function checkoutPreview() {
    if (!plan) return;
    setBusy(true); setMessage(""); setCanCancel(false);
    try { const url = await fixture.flow.checkout(plan, crypto); if (demo) setMessage("Preview complete. No checkout page was created and no payment was made."); else window.location.assign(url); }
    catch (err) { showError(err); if (!(err instanceof PurchaseError && err.status === 401)) setCanCancel(err instanceof PurchaseError && err.code === "other_checkout_pending"); }
    finally { setBusy(false); }
  }
  async function cancelPrevious() {
    setBusy(true); setMessage("");
    try { await fixture.flow.cancelCheckout(); setCanCancel(false); setMessage("Previous checkout closed. You can continue with this plan."); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setMessage("");
    try { await fixture.flow.resend(); setMessage(demo ? "Preview: no email was sent." : "If your email still needs verification, a new link has been sent."); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  }
  async function forgot(email: string) {
    if (!email.trim()) { setMessage("Enter your email address first."); return; }
    setBusy(true); setMessage("");
    try { await fixture.forgot(email); setMessage(demo ? "Preview: no reset email was sent." : "If that email is registered, a password reset link has been sent."); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="purchase-heading" className="mt-6 overflow-hidden rounded-2xl border border-white/15 bg-[var(--bg-2)]"><div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    {!plan ? <div className="border-b border-white/10 p-5 sm:p-10 lg:border-r lg:border-b-0"><p className="text-sm font-semibold text-[var(--accent)]">Free account</p><h3 id="purchase-heading" className="mt-2 text-2xl font-bold text-[var(--fg)] sm:mt-3 sm:text-3xl">Your PC Tweaker account</h3>
      <p className="mt-3 text-sm leading-relaxed text-[var(--fg-dim)] sm:mt-5">One account for the app, your plan and your purchases. Creating it costs nothing and needs no payment details.</p>
      <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm sm:mt-9 sm:space-y-4 sm:pt-6 leading-relaxed text-[var(--fg-dim)]"><p><strong className="text-[var(--fg)]">1. Create your account.</strong><span className="hidden sm:inline"><br />Use an email address you can confirm.</span></p><p><strong className="text-[var(--fg)]">2. Confirm your email.</strong><span className="hidden sm:inline"><br />Open the link we send you.</span></p><p><strong className="text-[var(--fg)]">3. Sign in to the app.</strong><span className="hidden sm:inline"><br />Start the free trial there, or choose a plan here whenever you want.</span></p></div></div>
    : <div className="border-b border-white/10 p-5 sm:p-10 lg:border-r lg:border-b-0"><p className="text-sm font-semibold text-[var(--accent)]">Your selected plan</p><h3 id="purchase-heading" className="mt-2 text-2xl font-bold text-[var(--fg)] sm:mt-3 sm:text-3xl">{label}</h3>
      {crypto ? <><p className="mt-5 text-3xl font-bold text-[var(--fg)]">≈ {usd(cryptoUsd ?? 0, "en-US")} <span className="text-base font-normal text-[var(--fg-dim)]">in USDC</span></p><p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">{terms} {CRYPTO_COPY.en.lifetimeNote}</p></> : <>{promotion ? <p className="mt-5 text-3xl font-bold text-[var(--fg)]">{euro(promotion.price)} <span className="text-base font-normal text-[var(--fg-dim)] line-through">{euro(promotion.reference)}</span></p> : <p className="mt-5 text-sm text-[var(--fg-dim)]">Review the current price at checkout.</p>}
      <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">{terms} {promotion && plan !== "lifetime" && `Then ${euro(promotion.regular)} per ${plan === "annual" ? "year" : "month"}.`} Prices exclude VAT.</p></>}
      <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm sm:mt-9 sm:space-y-4 sm:pt-6 leading-relaxed text-[var(--fg-dim)]"><p><strong className="text-[var(--fg)]">1. Sign in or create an account.</strong><br />Your purchase is linked to your PC Tweaker account.</p><p><strong className="text-[var(--fg)]">2. Confirm the final price at checkout.</strong><br />Your payment details are entered on Stripe’s secure page.</p><p><strong className="text-[var(--fg)]">3. Open the app and sign in.</strong><br />Your account is used to activate access after payment.</p></div></div>}
    <div className="p-5 sm:p-10"><div className="flex items-start justify-between gap-4"><div><h4 className="text-xl font-bold sm:text-2xl text-[var(--fg)]">{status === "upgrade" ? "Ready to upgrade" : status === "ready" ? "Account verified" : status === "verify-email" ? "Confirm your email" : mode === "login" ? "Welcome back" : "Create your account"}</h4><p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">{status === "upgrade" || status === "ready" || status === "already-pro" ? (demo ? "Demonstration account." : "Signed in to your PC Tweaker account.") : status === "verify-email" ? "Your account is not active until you open the link we sent you." : mode === "login" ? "Use the account you use in PC Tweaker." : "Use an email address you can verify."}</p></div><button type="button" onClick={onClose} className="text-sm text-[var(--fg-dim)] underline underline-offset-4">Close</button></div>
      {status === "signed-out" && <div className="mt-7 flex gap-6 border-b border-white/10" role="group" aria-label="Account options"><button type="button" aria-pressed={mode === "login"} onClick={() => { setMode("login"); setMessage(""); }} className={`pb-3 text-sm font-semibold ${mode === "login" ? "border-b-2 border-[var(--accent)] text-[var(--fg)]" : "text-[var(--fg-dim)]"}`}>Sign in</button><button type="button" aria-pressed={mode === "register"} onClick={() => { setMode("register"); setMessage(""); }} className={`pb-3 text-sm font-semibold ${mode === "register" ? "border-b-2 border-[var(--accent)] text-[var(--fg)]" : "text-[var(--fg-dim)]"}`}>Create account</button></div>}
      {status === "signed-out" && <form onSubmit={preview} className="mt-6 space-y-5">{mode === "register" && <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-[var(--fg)]">First name<input name="firstName" required autoComplete="given-name" className={input} /></label><label className="text-sm font-semibold text-[var(--fg)]">Last name<input name="lastName" required autoComplete="family-name" className={input} /></label></div>}
      <label className="block text-sm font-semibold text-[var(--fg)]">Email address<input name="email" type="email" required autoComplete="email" className={input} /></label><label className="block text-sm font-semibold text-[var(--fg)]">Password<input name="password" type="password" required minLength={mode === "register" ? 8 : undefined} aria-describedby={mode === "register" ? "password-rule" : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} className={input} />{mode === "register" && <span id="password-rule" className="mt-2 block text-xs font-normal text-[var(--fg-dim)]">At least 8 characters.</span>}</label>{mode === "register" && <label className="block text-sm font-semibold text-[var(--fg)]">Repeat password<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>}{mode === "register" && <label className="block text-sm font-semibold text-[var(--fg)]">Date of birth<input name="dateOfBirth" type="date" required autoComplete="bday" className={input} /></label>}
      {mode === "login" && <button disabled={busy} type="button" onClick={(event) => { const field = event.currentTarget.form?.elements.namedItem("email"); void forgot(field instanceof HTMLInputElement ? field.value : ""); }} className="text-sm text-[var(--fg-dim)] underline underline-offset-4">Forgot password?</button>}
      <button disabled={busy} type="submit" className="bg-accent w-full rounded-xl px-5 py-4 font-bold text-[var(--bg)]">{mode === "login" ? (plan ? "Continue to checkout" : "Sign in") : plan ? "Create account and continue" : "Create account"}</button>{demo && <p className="text-xs leading-relaxed text-[var(--fg-dim)]">Demonstration only. Do not enter real credentials. No data is sent and no purchase is made. To preview an existing subscriber, use subscriber@example.test with any demo password.</p>}</form>}
      {status === "verify-email" && <div className="mt-6 space-y-4 text-sm text-[var(--fg-dim)]"><p>Check your inbox and confirm your email before continuing. {demo && "In this preview no message is sent."}</p><button disabled={busy} type="button" onClick={() => void verifyPreview()} className="bg-accent w-full rounded-xl px-5 py-4 font-bold text-[var(--bg)]">{demo ? "Simulate email verification" : "I verified my email"}</button>{!demo && <button disabled={busy} type="button" onClick={() => void resend()} className="underline underline-offset-4">Send another verification email</button>}</div>}
      {!plan && (status === "ready" || status === "already-pro" || status === "upgrade") && <div className="mt-6 space-y-4 text-sm text-[var(--fg-dim)]"><p>{status === "ready" ? "Your account is ready. Download PC Tweaker and sign in with this email to start your free trial." : "This account already has Pro. Download PC Tweaker and sign in with this email."}</p><a href={DOWNLOAD_EXE} className="bg-accent block w-full rounded-xl px-5 py-4 text-center font-bold text-[var(--bg)]">Download PC Tweaker</a>{status === "ready" && onChoosePlan && <button type="button" onClick={onChoosePlan} className="w-full rounded-xl border border-white/20 px-5 py-4 font-semibold text-[var(--fg)] hover:border-white/40">See the plans</button>}</div>}
      {plan && status === "ready" && <div className="mt-6 space-y-4 text-sm text-[var(--fg-dim)]"><p>{demo ? "Preview account verified." : "Email verified."} Review the final price and terms on the secure checkout page.</p><button disabled={busy} type="button" onClick={() => void checkoutPreview()} className="bg-accent w-full rounded-xl px-5 py-4 font-bold text-[var(--bg)]">{demo ? "Simulate checkout" : "Continue to secure checkout"}</button></div>}
      {plan && status === "upgrade" && <div className="mt-6 space-y-4 text-sm text-[var(--fg-dim)]"><p>Your subscription will be set to stop renewing after your Lifetime payment is confirmed. Review the final price on the secure checkout page.</p><button disabled={busy} type="button" onClick={() => void checkoutPreview()} className="bg-accent w-full rounded-xl px-5 py-4 font-bold text-[var(--bg)]">{demo ? "Simulate checkout" : "Continue to secure checkout"}</button></div>}
      {plan && status === "already-pro" && <p className="mt-6 text-sm text-[var(--fg-dim)]">This account already has Pro. Contact support for help changing plans.</p>}
      {canCancel && <button disabled={busy} type="button" onClick={() => void cancelPrevious()} className="mt-4 text-sm text-[var(--fg)] underline underline-offset-4">Close previous checkout</button>}
      {message && <p role="status" className="mt-4 rounded-lg border border-white/15 p-4 text-sm text-[var(--fg)]">{message}</p>}</div>
  </div></section>;
}
