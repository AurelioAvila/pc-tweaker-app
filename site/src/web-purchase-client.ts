/** Account and checkout operations for the website. Bearer tokens only, never cookies
 *  (credentials: "omit"); the caller decides where a token lives. */
export type WebPlan = "monthly" | "annual" | "lifetime";
export type Account = { email: string; emailVerified: boolean; isPro: boolean; plan: string | null; hasBilling: boolean };
/** One product in GET /api/billing/status, reduced to what the account page shows. */
export type ProductStatus = {
  product: string;
  state: "active" | "trialing" | "blocked" | "none";
  plan: string | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  blockedReason: string;
};
/** One installation in GET /api/account/devices (no identifier is ever sent). */
export type AccountPc = { product: string; label: string | null; pro: boolean | null; firstSeen: string; lastSeen: string; current: boolean };
type Transport = typeof fetch;
export class PurchaseError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) { super(message); }
}
export function createPurchaseClient(base: string, transport: Transport = fetch) {
  async function request<T>(path: string, method: "GET" | "POST", body?: unknown, token?: string): Promise<T> {
    let response: Response;
    try {
      response = await transport(`${base}${path}`, {
        method, cache: "no-store", credentials: "omit", redirect: "error",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new PurchaseError("Could not reach the server. Please check your connection and try again."); }
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = result && typeof result === "object" ? result as { error?: unknown; code?: unknown } : {};
      // The service-wide limiter says how long to wait (Retry-After, in seconds).
      const wait = response.status === 429 ? Number(response.headers.get("Retry-After")) : 0;
      const message = Number.isInteger(wait) && wait > 0
        ? `Too many attempts. Try again ${new Intl.RelativeTimeFormat("en").format(wait < 60 ? wait : Math.ceil(wait / 60), wait < 60 ? "second" : "minute")}.`
        : typeof error.error === "string" ? error.error : "We could not complete this request. Please try again.";
      throw new PurchaseError(message, typeof error.code === "string" ? error.code : undefined, response.status);
    }
    if (!result || typeof result !== "object") throw new PurchaseError("The server returned an unexpected response. Please try again.");
    return result as T;
  }
  return {
    async signIn(email: string, password: string) {
      const result = await request<{ token?: unknown }>("/api/auth/login", "POST", { email, password });
      if (typeof result.token !== "string" || !result.token) throw new PurchaseError("Sign-in did not complete. Please try again.");
      return result.token;
    },
    async register(input: { email: string; password: string; firstName: string; lastName: string; dateOfBirth: string }) {
      const result = await request<{ token?: unknown; verificationEmailSent?: unknown }>("/api/auth/register", "POST", { ...input, product: "pctweaker" });
      if (typeof result.token !== "string" || !result.token) throw new PurchaseError("Registration did not complete. Please sign in and try again.");
      return { token: result.token, verificationEmailSent: result.verificationEmailSent === true };
    },
    async account(token: string) {
      const result = await request<Partial<Account>>("/api/account", "GET", undefined, token);
      if (typeof result.email !== "string" || typeof result.emailVerified !== "boolean" || typeof result.isPro !== "boolean" || (result.plan !== null && typeof result.plan !== "string") || typeof result.hasBilling !== "boolean") {
        throw new PurchaseError("We could not verify your account status. Please try again.");
      }
      return result as Account;
    },
    async products(token: string): Promise<ProductStatus[]> {
      const result = await request<{ products?: unknown }>("/api/billing/status", "GET", undefined, token);
      if (!Array.isArray(result.products)) throw new PurchaseError("We could not read your plans. Please try again.");
      const text = (value: unknown) => (typeof value === "string" ? value : null);
      return result.products.flatMap((item): ProductStatus[] => {
        const p = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const state = ["active", "trialing", "blocked", "none"].includes(String(p.state)) ? (p.state as ProductStatus["state"]) : null;
        return typeof p.product === "string" && state
          ? [{ product: p.product, state, plan: text(p.plan), trialEndsAt: text(p.trial_ends_at), periodEnd: text(p.current_period_end), cancelAtPeriodEnd: p.cancel_at_period_end === true, blockedReason: text(p.blocked_reason) ?? "none" }]
          : [];
      });
    },
    async devices(token: string): Promise<AccountPc[]> {
      const result = await request<{ devices?: unknown }>("/api/account/devices", "GET", undefined, token);
      if (!Array.isArray(result.devices)) throw new PurchaseError("We could not read your PCs. Please try again.");
      return result.devices.filter((d): d is AccountPc => !!d && typeof d === "object"
        && typeof (d as AccountPc).product === "string" && typeof (d as AccountPc).lastSeen === "string"
        && ((d as AccountPc).label === null || typeof (d as AccountPc).label === "string"));
    },
    async portal(token: string) {
      const result = await request<{ url?: unknown }>("/api/portal", "POST", { returnTo: "account" }, token);
      let url: URL;
      try { url = new URL(typeof result.url === "string" ? result.url : ""); } catch { throw new PurchaseError("The billing link was invalid. Please contact support."); }
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com" || url.username || url.password || url.port) throw new PurchaseError("The billing link was invalid. Please contact support.");
      return url.href;
    },
    /** Ends every session of the account, in every app and on this page. */
    signOutEverywhere(token: string) { return request<{ ok: boolean }>("/api/auth/logout-all", "POST", {}, token); },
    resendVerification(token: string) { return request<{ ok: boolean }>("/api/auth/resend-verification", "POST", { product: "pctweaker" }, token); },
    forgotPassword(email: string) { return request<{ ok: boolean }>("/api/auth/forgot-password", "POST", { email, product: "pctweaker" }); },
    cancelCheckout(token: string) { return request<{ ok: boolean }>("/api/web-checkout/cancel", "POST", {}, token); },
    async checkout(token: string, plan: WebPlan) {
      if (!["monthly", "annual", "lifetime"].includes(plan)) throw new PurchaseError("Please choose a valid plan.");
      const result = await request<{ url?: unknown }>("/api/web-checkout", "POST", { product: "pctweaker", plan, start_trial: false }, token);
      let url: URL;
      try { url = new URL(typeof result.url === "string" ? result.url : ""); } catch { throw new PurchaseError("The checkout link was invalid. Please contact support."); }
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password || url.port) throw new PurchaseError("The checkout link was invalid. Please contact support.");
      return url.href;
    },
  };
}
