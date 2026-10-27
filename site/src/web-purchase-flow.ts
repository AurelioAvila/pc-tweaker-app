import type { Account, WebPlan } from "./web-purchase-client";

type PurchaseApi = {
  signIn(email: string, password: string): Promise<string>;
  register(input: { email: string; password: string; firstName: string; lastName: string; dateOfBirth: string }): Promise<{ token: string; verificationEmailSent: boolean }>;
  account(token: string): Promise<Account>;
  resendVerification(token: string): Promise<{ ok: boolean }>;
  checkout(token: string, plan: WebPlan): Promise<string>;
  cancelCheckout(token: string): Promise<{ ok: boolean }>;
};
export type PurchaseStatus = "signed-out" | "verify-email" | "already-pro" | "upgrade" | "ready";
export function purchaseStatus(account: Account, selectedPlan?: WebPlan): PurchaseStatus {
  if (!account.emailVerified) return "verify-email";
  if (account.isPro && selectedPlan === "lifetime" && (account.plan === "monthly" || account.plan === "annual")) return "upgrade";
  if (account.isPro) return "already-pro";
  return "ready";
}
export function createPurchaseFlow(api: PurchaseApi, selectedPlan?: WebPlan) {
  let token: string | null = null;
  let account: Account | null = null;
  let generation = 0;
  let busy = false;
  async function exclusive<T>(fn: (version: number) => Promise<T>): Promise<T> {
    if (busy) throw new Error("A request is already in progress.");
    busy = true;
    const version = generation;
    try { return await fn(version); } finally { busy = false; }
  }
  function current(version: number) { if (generation !== version) throw new Error("This session has ended. Please sign in again."); }
  function requireToken() { if (!token) throw new Error("Please sign in first."); return token; }
  async function read(version: number) {
    const value = await api.account(requireToken());
    current(version); account = value; return purchaseStatus(value, selectedPlan);
  }
  return {
    reset() { generation++; token = null; account = null; },
    async signIn(email: string, password: string) {
      return exclusive(async version => { const value = await api.signIn(email, password); current(version); token = value; return read(version); });
    },
    async register(input: { email: string; password: string; firstName: string; lastName: string; dateOfBirth: string }) {
      return exclusive(async version => { const result = await api.register(input); current(version); token = result.token; const status = await read(version); return { status, verificationEmailSent: result.verificationEmailSent }; });
    },
    async refresh() { return exclusive(version => read(version)); },
    async resend() { return exclusive(async version => { const result = await api.resendVerification(requireToken()); current(version); return result; }); },
    async cancelCheckout() { return exclusive(async version => { const result = await api.cancelCheckout(requireToken()); current(version); if (result.ok !== true) throw new Error("Could not close the previous checkout."); return result; }); },
    async checkout(plan: WebPlan) {
      return exclusive(async version => {
        const status = await read(version);
        if ((status !== "ready" && !(status === "upgrade" && plan === "lifetime")) || !account) throw new Error(status === "verify-email" ? "Verify your email before continuing." : "This account already has Pro. Contact support for help changing plans.");
        const result = await api.checkout(requireToken(), plan); current(version); return result;
      });
    },
  };
}
