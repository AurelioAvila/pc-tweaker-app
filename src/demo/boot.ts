// Browser demo for reviewing the app without Windows: a pretend backend
// (backend.ts) behind a fake Tauri IPC, and canned answers from the account
// server. Runs only in the Vite dev server with ?demo=pro or ?demo=free, and
// in `npm run build:demo` (Pro unless ?demo=free). A production build folds
// the condition at the bottom to false: this file's code goes and backend.ts
// is never emitted.
//
// Imported first by main.tsx and on purpose importing nothing of the app:
// lib.ts asks the IPC for the version as soon as it loads, so the fake IPC
// must exist before any app module runs. Hence the storage keys repeated
// from lib.ts.
const TOKEN_KEY = "pc-tweaker-token";
const EMAIL_KEY = "pc-tweaker-email";
const API_HOST = "api.pctweaker.app";

type Plan = "pro" | "free";

function installDemo(plan: Plan) {
  const pro = plan === "pro";
  // The account: Pro is a signed-in subscriber, Free a visitor with the
  // trial on offer. Only this origin's storage is touched.
  try {
    if (pro) {
      localStorage.setItem(TOKEN_KEY, "demo-token");
      localStorage.setItem(EMAIL_KEY, "demo@pctweaker.app");
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
    }
  } catch {
    /* Storage blocked: the app then starts signed out. */
  }

  // The IPC, as @tauri-apps/api expects it.
  const callbacks = new Map<number, (data: unknown) => void>();
  const listeners = new Map<string, Set<number>>();
  let next = 1;
  const emit = (event: string, payload: unknown) => {
    for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, id, payload });
  };
  const backend = import("./backend").then((m) => m.demoBackend(emit, pro));
  // Typed loosely on purpose: this is a stand-in, not the real bridge.
  const internals = {
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { windowLabel: "main", label: "main" },
    },
    transformCallback: (callback: (data: unknown) => void) => {
      const id = next++;
      callbacks.set(id, callback);
      return id;
    },
    unregisterCallback: (id: number) => callbacks.delete(id),
    convertFileSrc: (path: string) => path,
    invoke: async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "plugin:event|listen") {
        const handler = args?.handler as number;
        const event = String(args?.event);
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)?.add(handler);
        return handler;
      }
      if (cmd === "plugin:event|unlisten") {
        listeners.get(String(args?.event))?.delete(args?.eventId as number);
        return null;
      }
      return (await backend)(cmd, args);
    },
  };
  const eventInternals = {
    unregisterListener: (event: string, id: number) => {
      listeners.get(event)?.delete(id);
      callbacks.delete(id);
    },
  };
  Object.assign(window, {
    __TAURI_INTERNALS__: internals,
    __TAURI_EVENT_PLUGIN_INTERNALS__: eventInternals,
  });

  // The account server, answered here; nothing leaves the browser.
  const realFetch = window.fetch.bind(window);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin === location.origin) return realFetch(input, init);
    if (url.host === API_HOST) {
      // Signing in or up works with any address; the account stays what the
      // Free / Pro switch says.
      if (url.pathname === "/api/auth/login" || url.pathname === "/api/auth/register")
        return json(200, { token: "demo-token", verificationEmailSent: false });
      if (url.pathname.startsWith("/api/auth/")) return json(200, { ok: true });
      if (url.pathname.startsWith("/api/billing/subscription")) {
        const product = url.searchParams.get("product") ?? "pctweaker";
        const mine = pro && product === "pctweaker";
        return json(200, {
          product,
          plan: mine ? "annual" : null,
          interval: mine ? "year" : null,
          amount: mine ? 5999 : null,
          currency: "eur",
          status: mine ? "active" : "none",
          trial_end: null,
          current_period_end: mine ? new Date(Date.now() + 240 * 86_400_000).toISOString() : null,
          cancel_at_period_end: false,
          cancel_at: null,
          payment_method: mine ? { brand: "visa", last4: "4242" } : null,
          lifetime: false,
          can_cancel: mine,
          can_resume: false,
        });
      }
      switch (url.pathname) {
        case "/api/billing/prices":
          return json(200, {
            trial_enabled: true,
            trial_days: 3,
            currency: "eur",
            prices: [
              { product: "pctweaker", plan: "monthly", amount: 799 },
              { product: "pctweaker", plan: "annual", amount: 5999 },
            ],
          });
        case "/api/account":
          return json(200, {
            email: "demo@pctweaker.app",
            isPro: pro,
            emailVerified: true,
            plan: pro ? "annual" : null,
            hasBilling: pro,
          });
        case "/api/entitlements":
          return json(200, {
            products: pro ? [{ product: "pctweaker", active: true, plan: "annual" }] : [],
          });
        case "/api/billing/status": {
          const year = new Date(Date.now() + 240 * 86_400_000).toISOString();
          return json(200, {
            products: [
              pro
                ? {
                    product: "pctweaker",
                    state: "active",
                    plan: "annual",
                    current_period_end: year,
                  }
                : { product: "pctweaker", state: "none", can_start_trial: true },
            ],
          });
        }
        // Checkout, billing portal, tips: a link the demo's opener ignores.
        case "/api/checkout":
        case "/api/checkout/crypto":
        case "/api/portal":
        case "/api/tip":
          return json(200, { url: "https://pctweaker.app/" });
        case "/api/account/devices":
          return json(200, {
            devices: [
              {
                product: "pctweaker",
                label: "Windows 11 Pro · AMD Ryzen 7 7700X",
                pro,
                firstSeen: "2026-09-14T18:20:00Z",
                lastSeen: new Date().toISOString(),
                current: true,
              },
            ],
          });
      }
      return json(404, {});
    }
    throw new TypeError("Offline in the demo");
  };

  // The only visible trace: a small switch between the two accounts.
  const bar = document.createElement("nav");
  bar.setAttribute("aria-label", "Demo");
  bar.style.cssText =
    "position:fixed;right:10px;bottom:10px;z-index:2147483647;display:flex;align-items:center;gap:2px;" +
    "padding:3px;border-radius:999px;background:rgb(0 0 0 / 62%);color:#fff;font:600 11px/1 system-ui,sans-serif;" +
    "box-shadow:0 4px 14px rgb(0 0 0 / 30%);opacity:.82;user-select:none;backdrop-filter:blur(6px)";
  const label = document.createElement("span");
  label.textContent = "Demo";
  label.style.cssText = "padding:5px 8px 5px 9px;opacity:.75";
  bar.append(label);
  for (const option of ["free", "pro"] as const) {
    const link = document.createElement("a");
    link.textContent = option === "pro" ? "Pro" : "Free";
    link.href = `?demo=${option}`;
    if (option === plan) link.setAttribute("aria-current", "page");
    link.style.cssText =
      "padding:5px 10px;border-radius:999px;color:inherit;text-decoration:none;" +
      (option === plan ? "background:#fff;color:#111" : "");
    bar.append(link);
  }
  document.body.append(bar);
}

if (import.meta.env.DEV || import.meta.env.MODE === "demo") {
  const asked = new URLSearchParams(location.search).get("demo");
  const plan: Plan | null =
    asked === "pro" || asked === "free" ? asked : import.meta.env.MODE === "demo" ? "pro" : null;
  if (plan) installDemo(plan);
}
