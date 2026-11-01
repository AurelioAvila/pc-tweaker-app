import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createPurchaseClient,
  PurchaseError,
  type Account,
  type AccountPc,
  type ProductStatus,
} from "../web-purchase-client";
import { API_BASE, DOWNLOAD_EXE } from "../constants";
import { euro, PromoDeadline, usePromo } from "../promo";
import { promoPercent } from "../../../src/promo";
import { CryptoLifetimeChoice } from "../components/CryptoLifetime";
import { usePriceList } from "../trial";

/* The signed-in account page: plans, the PCs that use the account, billing.
   Same bearer-token sign-in as the apps and the website checkout, never a
   cookie. The token stays in this tab's sessionStorage so the return from
   Stripe's billing page finds the page still signed in; closing the tab, signing
   out or any 401 removes it. It never goes into a URL. Read-only apart from
   "sign out everywhere": the account has no PC limit to manage. */

const SESSION_KEY = "pctweaker-account-session";
const PRODUCTS: Record<string, string> = { pctweaker: "PC Tweaker", uninstaller: "PC Tweaker Uninstaller" };
/** null = that part could not be read now; the rest of the page still shows. */
type Loaded = { account: Account; products: ProductStatus[] | null; pcs: AccountPc[] | null };

function stored(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function keep(token: string | null) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* Storage blocked: the page still works until it is closed. */
  }
}
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

/** The plan line, named like the app: Free, Pro · Monthly / Annual, Lifetime. */
function planText(p: ProductStatus): { name: string; detail: string; tone: "ok" | "warn" | "dim" } {
  if (p.state === "blocked" && p.blockedReason === "payment_failed")
    return { name: "Payment failed", detail: "Pro is paused until the card is updated in billing.", tone: "warn" };
  if (p.state === "trialing")
    return { name: "Pro · Free trial", detail: p.trialEndsAt ? `Until ${day(p.trialEndsAt)}` : "", tone: "ok" };
  if (p.state !== "active") return { name: "Free", detail: "", tone: "dim" };
  if (p.plan === "lifetime") return { name: "Lifetime", detail: "One payment, no end date", tone: "ok" };
  if (p.plan === "lifetime_bonus") return { name: "Pro", detail: "Included with Lifetime", tone: "ok" };
  const period = p.plan === "monthly" ? " · Monthly" : p.plan === "annual" ? " · Annual" : "";
  const end = p.periodEnd ? (p.cancelAtPeriodEnd ? `Cancelled, Pro until ${day(p.periodEnd)}` : `Until ${day(p.periodEnd)}`) : "";
  return { name: `Pro${period}`, detail: end, tone: "ok" };
}

export function AccountPage() {
  const [client] = useState(() => createPurchaseClient(API_BASE));
  // A live offer only, read from the server like the plans section; none, nothing shows.
  const lifetimeOffer = usePromo().offer("pctweaker", "lifetime");
  // Lifetime in USDC, offered only while the server reports crypto available.
  const cryptoLifetime = usePriceList()?.crypto?.lifetimeUsd ?? null;
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  // Until the stored session has been tried, show neither the form nor the account.
  const [starting, setStarting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmEverywhere, setConfirmEverywhere] = useState(false);
  // After a sign-out the button that was pressed is gone: focus (and scroll to)
  // the message at the top instead of leaving the reader at the footer.
  const notice = useRef<HTMLParagraphElement>(null);
  const focusNotice = useRef(false);
  useEffect(() => {
    if (message && focusNotice.current) notice.current?.focus();
    focusNotice.current = false;
  }, [message]);

  function signOut(note = "") {
    focusNotice.current = Boolean(note);
    keep(null);
    setToken(null);
    setData(null);
    setConfirmEverywhere(false);
    setMessage(note);
  }

  async function load(next: string, quietOnExpiry = false) {
    setBusy(true);
    setMessage("");
    try {
      const account = await client.account(next);
      // A busy or failing read must not throw away a sign-in that worked.
      const [products, pcs] = await Promise.all([
        client.products(next).catch(() => null),
        client.devices(next).catch(() => null),
      ]);
      keep(next);
      setToken(next);
      setData({ account, products, pcs });
    } catch (err) {
      if (err instanceof PurchaseError && err.status === 401)
        signOut(quietOnExpiry ? "" : "Your session has ended. Please sign in again.");
      else setMessage(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
      setStarting(false);
    }
  }

  useEffect(() => {
    const saved = stored();
    if (saved) void load(saved, true);
    else setStarting(false);
    // Runs once: the stored session of this tab, if any.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const next = await client.signIn(String(form.get("email") || ""), String(form.get("password") || ""));
      await load(next);
    } catch (err) {
      setMessage(err instanceof PurchaseError && err.status === 401 ? "The email or password is incorrect." : err instanceof Error ? err.message : "Please try again.");
      setBusy(false);
    }
  }

  async function act(run: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await run();
    } catch (err) {
      if (err instanceof PurchaseError && err.status === 401) signOut("Your session has ended. Please sign in again.");
      else setMessage(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-2 w-full rounded-lg border border-white/20 bg-[var(--bg)] px-4 py-3 text-[var(--fg)] outline-offset-2 focus:outline focus:outline-2 focus:outline-[var(--accent)]";
  const card = "rounded-2xl border border-white/15 bg-[var(--bg-2)] p-5 sm:p-8";
  const secondary =
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-[var(--fg)] hover:border-white/40 disabled:opacity-60";

  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono-t mb-4 text-[11.5px] tracking-[0.18em] text-[var(--fg-dim)]">
          <span className="text-accent">ACCOUNT</span> / PLANS AND PCS
        </p>
        <h1 className="font-display text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.05] font-bold tracking-tight text-[var(--fg)]">
          Your account
        </h1>
        <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-[var(--fg-dim)]">
          The account you use in PC Tweaker, PC Tweaker Uninstaller and Tweaky Driver: your plans, the PCs that use it and your billing.
        </p>

        {message && (
          <p ref={notice} tabIndex={-1} role="status" className="mt-8 rounded-lg border border-white/15 p-4 text-sm text-[var(--fg)] scroll-mt-28">
            {message}
          </p>
        )}

        {starting ? (
          <p className="mt-10 text-sm text-[var(--fg-dim)]" role="status">
            Loading your account…
          </p>
        ) : !data || !token ? (
          <section aria-labelledby="sign-in-heading" className={`mt-10 ${card}`}>
            <h2 id="sign-in-heading" className="text-xl font-bold text-[var(--fg)] sm:text-2xl">
              Sign in
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">
              Use the email and password you use in the apps.
            </p>
            <form onSubmit={signIn} className="mt-6 space-y-5">
              <label className="block text-sm font-semibold text-[var(--fg)]">
                Email address
                <input name="email" type="email" required autoComplete="email" className={input} />
              </label>
              <label className="block text-sm font-semibold text-[var(--fg)]">
                Password
                <input name="password" type="password" required autoComplete="current-password" className={input} />
              </label>
              <button disabled={busy} type="submit" className="bg-accent min-h-11 w-full rounded-xl px-5 py-4 font-bold text-[var(--bg)] disabled:opacity-60">
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--fg-dim)]">
                <button
                  disabled={busy}
                  type="button"
                  className="min-h-11 underline underline-offset-4"
                  onClick={(event) => {
                    const field = event.currentTarget.form?.elements.namedItem("email");
                    const email = field instanceof HTMLInputElement ? field.value.trim() : "";
                    if (!email) return setMessage("Enter your email address first.");
                    void act(async () => {
                      await client.forgotPassword(email);
                      setMessage("If that email is registered, a password reset link has been sent.");
                    });
                  }}
                >
                  Forgot password?
                </button>
                <a href="/#signup" className="inline-flex min-h-11 items-center underline underline-offset-4">
                  No account yet? Create one
                </a>
              </div>
            </form>
          </section>
        ) : (
          <div className="mt-10 space-y-6">
            <section aria-labelledby="account-heading" className={card}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 id="account-heading" className="text-sm font-semibold text-[var(--fg-dim)]">
                    Signed in as
                  </h2>
                  <p className="mt-1 text-lg font-bold break-all text-[var(--fg)]">{data.account.email}</p>
                  <p className={`mt-1 text-sm ${data.account.emailVerified ? "text-emerald-400" : "text-amber-300"}`}>
                    {data.account.emailVerified ? "Email confirmed" : "Email not confirmed yet"}
                  </p>
                </div>
                <button type="button" disabled={busy} className={secondary} onClick={() => signOut("You have signed out of this page.")}>
                  Sign out
                </button>
              </div>
              {!data.account.emailVerified && (
                <button
                  type="button"
                  disabled={busy}
                  className="mt-4 min-h-11 text-sm text-[var(--fg)] underline underline-offset-4"
                  onClick={() =>
                    void act(async () => {
                      await client.resendVerification(token);
                      setMessage("If your email still needs confirming, a new link has been sent.");
                    })
                  }
                >
                  Send the confirmation email again
                </button>
              )}
            </section>

            <section aria-labelledby="plans-heading" className={card}>
              <h2 id="plans-heading" className="text-xl font-bold text-[var(--fg)]">
                Plans
              </h2>
              {data.products === null && (
                <p className="mt-4 text-sm text-amber-300">Your plans could not be loaded. Try again later.</p>
              )}
              <ul className="mt-4 divide-y divide-white/10">
                {(data.products ?? []).map((p) => {
                  const plan = planText(p);
                  return (
                    <li key={p.product} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
                      <span className="font-semibold text-[var(--fg)]">{PRODUCTS[p.product] ?? p.product}</span>
                      <span className="flex flex-col items-end gap-1 text-right">
                        <span className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${plan.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : plan.tone === "warn" ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-white/15 text-[var(--fg-dim)]"}`}>
                          {plan.name}
                        </span>
                        {plan.detail && <span className="text-sm text-[var(--fg-dim)]">{plan.detail}</span>}
                      </span>
                    </li>
                  );
                })}
                <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
                  <span className="font-semibold text-[var(--fg)]">Tweaky Driver</span>
                  <span className="text-sm text-[var(--fg-dim)]">Shown in the Tweaky Driver app</span>
                </li>
              </ul>
              {lifetimeOffer && !data.products?.some((p) => p.product === "pctweaker" && p.state === "active" && p.plan === "lifetime") && (
                <a
                  href="/#access"
                  className="mt-4 flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-[var(--accent-soft)]"
                  style={{ borderColor: "var(--accent-glow)" }}
                >
                  <span className="bg-accent shrink-0 -rotate-3 rounded-lg px-2.5 py-1 text-lg font-extrabold text-[var(--bg)]">
                    −{promoPercent(lifetimeOffer)}%
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[var(--fg)]">
                      PC Tweaker Lifetime for {euro(lifetimeOffer.price)}{" "}
                      <s className="font-normal text-[var(--fg-dim)]">{euro(lifetimeOffer.reference)}</s>
                    </span>
                    <PromoDeadline className="block text-sm text-[var(--fg-dim)]" />
                    <span className="text-accent mt-1 block text-sm font-semibold">See the plans →</span>
                  </span>
                </a>
              )}
              {data.account.hasBilling ? (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="text-sm leading-relaxed text-[var(--fg-dim)]">
                    Change or cancel a subscription, update your card and download invoices on Stripe’s secure billing page.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    className="bg-accent mt-4 min-h-11 rounded-xl px-5 py-3 font-bold text-[var(--bg)] disabled:opacity-60"
                    onClick={() => void act(async () => window.location.assign(await client.portal(token)))}
                  >
                    Manage billing and invoices
                  </button>
                </div>
              ) : (
                <p className="mt-6 border-t border-white/10 pt-6 text-sm leading-relaxed text-[var(--fg-dim)]">
                  No payments on this account yet. <a href="/#access" className="text-[var(--fg)] underline underline-offset-4">See the plans</a> or{" "}
                  <a href={DOWNLOAD_EXE} className="text-[var(--fg)] underline underline-offset-4">download PC Tweaker</a> and start the free trial there.
                </p>
              )}
              {cryptoLifetime && data.products && !data.products.some((p) => p.product === "pctweaker" && p.state === "active" && p.plan === "lifetime") && (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="text-sm leading-relaxed text-[var(--fg-dim)]">PC Tweaker Lifetime: one payment, no renewal.</p>
                  <CryptoLifetimeChoice
                    usdCents={cryptoLifetime}
                    disabled={busy}
                    onChoose={() => void act(async () => window.location.assign(await client.checkout(token, "lifetime", true)))}
                  />
                </div>
              )}
            </section>

            <section aria-labelledby="pcs-heading" className={card}>
              <h2 id="pcs-heading" className="text-xl font-bold text-[var(--fg)]">
                Your PCs
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">
                PCs where the apps used this account in the last 90 days. A PC leaves the list 90 days after it was last used.
              </p>
              {data.pcs === null ? (
                <p className="mt-4 text-sm text-amber-300">Your PCs could not be loaded. Try again later.</p>
              ) : data.pcs.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--fg-dim)]">No PC has used this account in the last 90 days.</p>
              ) : (
                Object.entries(PRODUCTS).map(([product, name]) => {
                  const pcs = data.pcs!.filter((pc) => pc.product === product);
                  return pcs.length ? (
                    <div key={product} className="mt-5">
                      <h3 className="text-sm font-semibold text-[var(--fg)]">{name}</h3>
                      <ul className="mt-2 space-y-2">
                        {pcs.map((pc, i) => (
                          <li key={`${pc.firstSeen}-${i}`} className="rounded-xl border border-white/10 bg-[var(--bg)] px-4 py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                              <span className="min-w-0 break-words text-[var(--fg)]">{pc.label ?? "Windows PC"}</span>
                              {pc.pro !== null && (
                                <span className={`text-sm font-semibold ${pc.pro ? "text-emerald-400" : "text-[var(--fg-dim)]"}`}>
                                  {pc.pro ? "Pro" : "Free"}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-[var(--fg-dim)]">
                              Last used <span className="whitespace-nowrap">{day(pc.lastSeen)}</span> · first seen{" "}
                              <span className="whitespace-nowrap">{day(pc.firstSeen)}</span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null;
                })
              )}
            </section>

            <section aria-labelledby="security-heading" className={card}>
              <h2 id="security-heading" className="text-xl font-bold text-[var(--fg)]">
                Sign out everywhere
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">
                Lost a PC, or sold one? This signs the account out of every app on every PC, and out of this page. Sign in again
                on the PCs you still use. Changing your password in an app does the same and keeps that app signed in.
              </p>
              {confirmEverywhere ? (
                <div className="mt-4 flex flex-wrap gap-3" role="group" aria-label="Confirm signing out everywhere">
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 rounded-xl bg-red-500/90 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                    onClick={() =>
                      void act(async () => {
                        await client.signOutEverywhere(token);
                        signOut("You have been signed out on every PC and on this page.");
                      })
                    }
                  >
                    Yes, sign out everywhere
                  </button>
                  <button type="button" disabled={busy} className={secondary} onClick={() => setConfirmEverywhere(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" disabled={busy} className={`mt-4 ${secondary}`} onClick={() => setConfirmEverywhere(true)}>
                  Sign out everywhere
                </button>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
