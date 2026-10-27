/** Checkout account operations. Tokens are held only by the caller, in memory. */
export type WebPlan = "monthly" | "annual" | "lifetime";
export type Account = { email: string; emailVerified: boolean; isPro: boolean; plan: string | null; hasBilling: boolean };
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
      throw new PurchaseError(typeof error.error === "string" ? error.error : "We could not complete this request. Please try again.", typeof error.code === "string" ? error.code : undefined, response.status);
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
