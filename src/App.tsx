import { orderSectionTweaks } from "./feature-order";
import { installId } from "./installId";
import { TweakyDriverPromoCard } from "./components/tweaky-driver-promo";
import { NetworkCheckPanel } from "./components/diagnostics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { STRINGS, Lang, detectInitialLang, format, localeOf } from "./i18n";
import { ThemeName, detectInitialTheme } from "./theme";
import {
  API_BASE_URL,
  FEATURE_INTELLIGENCE,
  ProPlan,
  RAM_AUTO_STORAGE_KEY,
  adoptLegacyAvatar,
  clearSession,
  discardLegacyAvatar,
  formatBytes,
  friendlyError,
  installationId,
  readStoredEmail,
  readToken,
  adoptRenewedToken,
  storeSession,
  TOKEN_KEY,
  storedRamAutoMinutes,
  textFor,
} from "./lib";
import {
  AuthState,
  CleanupInfo,
  CleanupResult,
  Section,
  Toast,
  TweakInfo,
  type ProductPlan,
} from "./types";
import {
  GemIcon,
  HistoryIcon,
  LayersIcon,
  MagnifierIcon,
  RadarIcon,
  RocketIcon,
  UndoIcon,
  HeartPulseIcon,
  ThermometerIcon,
} from "./components/icons";
import { Badge, BillingNotice, PaywallModal, Toggle, UpdateBanner } from "./components/ui";
import { TRIAL_COPY } from "./components/trial-copy";
import {
  billingChanges,
  planSnapshot,
  nextTrialEnd,
  parseBillingStatus,
  parsePriceList,
  trialEntry,
  type BillingChange,
  type PriceList,
} from "./trial";
import {
  BrowserCleanupCard,
  CleanupCard,
  ScheduledCleanupCard,
  CleanupConfirmModal,
  DiskToolsSection,
  DnsFlushCard,
  DuplicateFinder,
  IpMaskCard,
  LargeFileFinder,
  PasswordBreachCheck,
  RedaxaPromoCard,
  UninstallerPromoCard,
} from "./components/maintenance";
import { AccountMenu } from "./components/account";
import { ReferralPanel } from "./components/referrals";
import {
  readReferralStatus,
  activateOrRefreshBonus,
  bonusForThisPc,
  bonusWithdrawn,
} from "./referrals";
import { TweakIcon } from "./components/tweak-icon";
import { TechnicalDetails, TechnicalToggle } from "./components/technical";
import { GameSessionsPanel, TurboBoostPanel } from "./components/gaming";
import { X3dPanel } from "./components/x3d";
import { ScanPanel } from "./components/scan";
import { HealthPanel } from "./components/health";
import { BeforeAfterPanel } from "./components/before-after";
import { SystemRepairCard } from "./components/repair";
import { LiveDashboard } from "./components/live-dashboard";
import { PageBoundary } from "./components/page-boundary";
import { AppCacheCard, CookieCleanerCard } from "./components/cleaners";
import { HardwarePanel } from "./components/hardware";
import { RamCleaner, SystemMonitor, useScheduledRamClean } from "./components/monitor";
import { CrashReportsCard, DriftWatchToggle, UpdateDriftCard } from "./components/intelligence";
import { ChangeHistory } from "./components/change-history";
import { usePulseSamples } from "./components/command";
import { ScheduledTaskManager, StartupManager } from "./components/startup";
import { ProfilesPanel } from "./components/profiles";
import { PricingPanel } from "./components/pricing";
import { PRICING_COPY } from "./components/pricing-copy";
import { GamingHudCard, ZeroTraceCard } from "./components/pro";
import { TitleBar, titleTrial } from "./components/titlebar";
import { CATEGORY_STYLE } from "./categories";
import { OverviewPanel } from "./components/overview";
import { WorkspaceSidebar } from "./components/workspace-sidebar";
import { DebloatPanel } from "./components/debloat";
import { AdvancedControlCard } from "./components/advanced-controls";
import { CONFIGURABLE_TWEAK_IDS, buildName, isCurrentCatalogTweak } from "./catalog";
import "./App.css";
import "./desktop-refresh.css";
import "./family-polish.css";

/** Carries the backend's machine-readable reason alongside its message. */
class CheckoutError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** This PC's licence identity (license.rs device_hash) as a request header, or nothing on a
 *  PC whose identity cannot be read. */
async function deviceHeader(): Promise<Record<string, string>> {
  const device = await invoke<string | null>("license_device_hash").catch(() => null);
  return device ? { "X-Device-Hash": device } : {};
}

function App() {
  // Dev builds only: VITE_START_LANG opens in a chosen language for review,
  // the way VITE_START_SECTION opens a chosen page.
  const [lang, setLangState] = useState<Lang>(
    () => (import.meta.env.DEV && (import.meta.env.VITE_START_LANG as Lang)) || detectInitialLang(),
  );
  const s = STRINGS[lang];

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("pc-tweaker-lang", l);
  }

  const [theme, setThemeState] = useState<ThemeName>(() => detectInitialTheme());

  function setTheme(t: ThemeName) {
    setThemeState(t);
    localStorage.setItem("pc-tweaker-theme", t);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Dates and numbers follow the app's language, not the Windows display
  // language: an English UI on an Italian PC must not print "27/9/2026".
  useEffect(() => {
    // European Portuguese only (owner decision, 11 Oct 2026): dates and
    // numbers use the pt-PT conventions, not the Brazilian ones.
    document.documentElement.lang = localeOf(lang) ?? "en";
    // The notification-area menu speaks the window's language.
    void invoke("set_tray_language", { language: lang }).catch(() => {});
  }, [lang]);

  const [auth, setAuth] = useState<AuthState>(() => {
    const email = readStoredEmail();
    const token = readToken();
    // isPro/emailVerified start false and are corrected by refreshAccount()
    // below as soon as it resolves — avoids briefly trusting a stale/forged
    // local value.
    return email && token
      ? {
          status: "authenticated",
          email,
          isPro: false,
          emailVerified: false,
          plan: null,
          hasBilling: false,
        }
      : { status: "anonymous" };
  });

  const isProUnlocked =
    auth.status === "authenticated" && (auth.isPro || auth.bonusActive === true);
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralAvailable, setReferralAvailable] = useState(false);
  const billing = auth.status === "authenticated" ? auth.billing : undefined;
  const [billingNotice, setBillingNotice] = useState<BillingChange | null>(null);
  // Public plan prices and the trial switch: the plans print a renewal price
  // from here or not at all.
  const [prices, setPrices] = useState<PriceList | null>(null);
  useEffect(() => {
    async function loadPrices() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/billing/prices`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) setPrices(parsePriceList(await res.json()));
      } catch {
        // Offline: no trial line rather than a guessed price.
      }
    }
    void loadPrices();
    const id = window.setInterval(() => void loadPrices(), 60 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  // The plan someone clicked before being stopped by sign-in or an
  // unconfirmed inbox. Without it they had to find the pricing panel again
  // and click a third time; now checkout reopens on its own once the account
  // can pay. Expires so a stale click never opens Stripe hours later.
  const pendingPlan = useRef<{ plan: ProPlan; startTrial?: boolean; until: number } | null>(null);
  function rememberPlan(plan: ProPlan, startTrial?: boolean) {
    pendingPlan.current = { plan, startTrial, until: Date.now() + 60 * 60 * 1000 };
  }

  // Re-reads Pro status from the backend. Called on mount (if already logged
  // in), right after login/register, and when the window regains focus —
  // that last one is what picks up a Stripe payment completed in the system
  // browser, since there's no deep link back into the app yet.
  async function refreshAccount() {
    if (!API_BASE_URL) return;
    const token = readToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/account`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        // Token expired or was invalidated server-side: reflect that in the
        // UI instead of silently keeping a stale "logged in" state forever.
        logout();
        return;
      }
      if (!res.ok) {
        pushToast("error", s.toasts.accountRefreshFailed);
        return;
      }
      if (readToken() !== token) return;
      adoptRenewedToken(res);
      const data = (await res.json()) as {
        email: string;
        isPro: boolean;
        emailVerified: boolean;
        plan?: string | null;
        hasBilling?: boolean;
      };
      setAuth({
        status: "authenticated",
        email: data.email,
        isPro: data.isPro,
        emailVerified: data.emailVerified,
        // Optional so a client that is newer than the deployed backend
        // degrades to hiding the billing button rather than showing one
        // that cannot work.
        plan: data.plan ?? null,
        hasBilling: data.hasBilling ?? false,
      });
      // Fire-and-forget: refreshLicense() has its own error handling and
      // must never block the UI's account status on a signing hiccup.
      void refreshLicense();
      void refreshReferralSession();
      const refreshedToken = readToken();
      if (refreshedToken) {
        void refreshProducts(refreshedToken);
        void refreshBilling(refreshedToken, data.email);
      }
      const pending = pendingPlan.current;
      if (pending && (data.isPro || pending.until < Date.now())) {
        pendingPlan.current = null;
      } else if (pending && data.emailVerified) {
        pendingPlan.current = null;
        startCheckout(pending.plan, pending.startTrial).catch((e) =>
          pushToast("error", String(e instanceof Error ? e.message : e)),
        );
      }
    } catch {
      // Network hiccup: keep whatever Pro status we already had rather than
      // dropping the user back to Free on a transient failure — but say so,
      // since a silent failure here is indistinguishable from actually
      // having lost Pro access (see: the account that looked like it had
      // reverted to Free while the server still reported it as Pro).
      pushToast("error", s.toasts.accountRefreshFailed);
    }
  }

  /** Every product's plan on the family account, so the account menu can say
   *  "Uninstaller · Lifetime" instead of a single Pro/Free flag. Informational
   *  only; enforcement stays in the signed licence. */
  async function refreshProducts(token: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/entitlements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { products?: ProductPlan[] };
      const products = (data.products ?? []).filter(
        (p) => p.product === "pctweaker" || p.product === "uninstaller",
      );
      setAuth((current) =>
        current.status === "authenticated" && readToken() === token
          ? { ...current, products }
          : current,
      );
    } catch {
      // Offline: the menu keeps the single Pro/Free line it already shows.
    }
  }

  /** Trial and subscription state for the plans, the account menu and the
   *  one notice shown on return when Pro stopped or a trial became a
   *  subscription. A backend without the route leaves everything as before. */
  async function refreshBilling(token: string, email: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/status`, {
        // The PC id: a PC that already had the free trial is not offered it again.
        headers: { Authorization: `Bearer ${token}`, ...(await deviceHeader()) },
      });
      if (!res.ok) return;
      const billing = parseBillingStatus(await res.json());
      if (!billing || readToken() !== token) return;
      setAuth((current) =>
        current.status === "authenticated" ? { ...current, billing } : current,
      );
      const key = `pc-tweaker-plan-seen:${email.toLowerCase()}`;
      let seen: Record<string, string> | null = null;
      try {
        seen = JSON.parse(localStorage.getItem(key) ?? "null") as Record<string, string> | null;
        localStorage.setItem(key, JSON.stringify(planSnapshot(billing)));
      } catch {
        // Unreadable or blocked storage: no notice is better than a wrong one.
      }
      const change = billingChanges(seen, billing).find((c) => c.product === "pctweaker");
      if (change?.kind === "converted") pushToast("success", TRIAL_COPY[lang].converted, 8000);
      else if (change) setBillingNotice(change);
    } catch {
      // Offline: the plans keep their last answer.
    }
  }

  /**
   * Fetches a freshly signed Pro entitlement and hands it to the Rust side,
   * which is what `apply_tweak` actually checks before running a Pro tweak —
   * this UI's `isPro` flag on its own was never enough, since nothing
   * stopped a Pro-gated tweak from being invoked directly, bypassing this
   * screen entirely. See `src-tauri/src/license.rs`.
   *
   * Called every time `refreshAccount` succeeds, which already covers
   * mount, focus, and right after login — so this never needs its own
   * separate trigger wiring.
   */
  async function refreshLicense() {
    if (!API_BASE_URL) return;
    const token = readToken();
    if (!token) return;
    try {
      const install = installId();
      // sig=2: the rotated signing key, the only one license.rs trusts. The backend
      // signs this PC's hash into the licence (license.rs).
      const res = await fetch(`${API_BASE_URL}/api/license?sig=2`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(install ? { "X-Install-Id": install } : {}),
          ...(await deviceHeader()),
        },
      });
      if (!res.ok) return;
      const response = (await res.json()) as { payloadJson: string; signature: string };
      await invoke("save_license", { response });
    } catch {
      // Offline, or the backend's signer isn't configured: whatever was
      // cached before keeps working until its grace period runs out. No
      // toast — this runs silently in the background on every focus event
      // and a real subscriber should never see noise from it.
    }
  }

  // Bonus refresh: one challenge and one proof against stored server state, only while a bonus
  // is active on this PC, every 5 minutes inside the 10-minute signed lease, plus on sign-in and
  // window focus (at most once a minute). Nothing is polled while the programme is off or no
  // bonus is active; failures with a lease still running back off up to 30 minutes.
  const referralTimer = useRef<number | undefined>(undefined);
  const referralFailures = useRef(0);
  const referralLast = useRef(0);
  async function refreshReferralSession(force = false) {
    if (!force && Date.now() - referralLast.current < 60_000) return;
    referralLast.current = Date.now();
    window.clearTimeout(referralTimer.current);
    const token = readToken();
    if (!token) return;
    let active = false;
    let next: number | null = null;
    const status = await readReferralStatus(token);
    if (readToken() !== token) return;
    // Only an explicit, well-formed "enabled" shows the menu entry; anything else is "off".
    setReferralAvailable(status?.enabled === true);
    try {
      if (!status) throw new Error("Referral status unavailable");
      const reward = await bonusForThisPc(status.rewards);
      if (reward) {
        active = await activateOrRefreshBonus(status, reward.id, "license", token);
        next = 5 * 60_000;
      } else await invoke("clear_referral_license");
      referralFailures.current = 0;
    } catch (error) {
      // The server withdrew or ended this bonus: drop its lease now instead of letting it run.
      if (bonusWithdrawn(error)) await invoke("clear_referral_license").catch(() => {});
      // Any other failed refresh keeps only the native layer's remaining signed lease.
      active = await invoke<boolean>("referral_license_status", { token }).catch(() => false);
      referralFailures.current += 1;
      if (active) next = Math.min(30, 5 * 2 ** (referralFailures.current - 1)) * 60_000;
    }
    if (readToken() !== token) return;
    setAuth((current) =>
      current.status === "authenticated" ? { ...current, bonusActive: active } : current,
    );
    if (next !== null)
      referralTimer.current = window.setTimeout(() => void refreshReferralRef.current(true), next);
  }
  const refreshReferralRef = useRef(refreshReferralSession);
  useEffect(() => {
    refreshReferralRef.current = refreshReferralSession;
  });
  useEffect(() => () => window.clearTimeout(referralTimer.current), []);

  // The server can hold every runtime adjustment to other apps for everyone
  // (off by default). Read at start and hourly; an unreachable server
  // changes nothing, so the last answer stands.
  useEffect(() => {
    async function readHold() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/flags`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const flags = (await res.json()) as { processGuardHold?: unknown };
        if (typeof flags.processGuardHold === "boolean") {
          await invoke("set_process_guard_hold", { hold: flags.processGuardHold });
        }
      } catch {
        // Offline or unreachable: keep the last known state.
      }
    }
    void readHold();
    const id = window.setInterval(() => void readHold(), 60 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  const refreshAccountRef = useRef(refreshAccount);
  useEffect(() => {
    refreshAccountRef.current = refreshAccount;
  });

  useEffect(() => {
    refreshAccount();
    // Before this version the profile photo belonged to the computer rather
    // than to an account. Whoever is signed in as the app starts is the one
    // who was using it when the update landed, so the old photo is theirs.
    // Doing this at sign-in instead would hand it to the next account.
    const signedInAs = readStoredEmail();
    if (signedInAs) void adoptLegacyAvatar(signedInAs);
    // The listener outlives this render: call the latest refreshAccount so
    // its toasts follow the current language.
    function onFocus() {
      refreshAccountRef.current();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Look again just after a trial ends: Pro stops there unless the first
  // payment went through, and the licence on disk expires at that second.
  useEffect(() => {
    const end = nextTrialEnd(billing ?? null, Date.now());
    if (end === null) return;
    const id = window.setTimeout(
      () => refreshAccount(),
      Math.min(end - Date.now() + 15_000, 2_000_000_000),
    );
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing]);

  function logout() {
    window.clearTimeout(referralTimer.current);
    referralLast.current = 0;
    setReferralOpen(false);
    setReferralAvailable(false);
    clearSession();
    setAuth({ status: "anonymous" });
    // Without this, a still-fresh cached Pro license would keep unlocking
    // Pro tweaks for whoever uses the app next on this machine, for up to
    // its grace period — including an anonymous session.
    void invoke("clear_license").catch(() => {});
    // Same reasoning for the photo: a machine-wide leftover from before
    // per-account storage must not survive to be inherited by whoever signs
    // in next. Each account's own photo is untouched and waiting for them.
    void discardLegacyAvatar();
  }

  /** A message in the app's language for a failed account request. The
   *  server's own error text is English and was shown verbatim, including a
   *  bare "HTTP 429" when the rate limiter answered. */
  function accountFailure(status: number): Error {
    return new Error(
      status === 401
        ? s.auth.errorCredentials
        : status === 409
          ? s.auth.errorAlreadyRegistered
          : status === 429
            ? s.auth.errorRateLimited
            : status >= 500
              ? s.auth.errorServer
              : s.auth.errorInvalid,
    );
  }

  /** fetch() for the account routes: an unreachable server is a translated
   *  message too, not the browser's "Failed to fetch". */
  async function accountFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch {
      throw new Error(s.auth.errorNetwork);
    }
  }

  async function authenticate(
    mode: "login" | "register",
    email: string,
    password: string,
    registerDetails?: { firstName: string; lastName: string; dateOfBirth: string },
    remember = true,
  ) {
    if (!API_BASE_URL) {
      throw new Error(s.auth.backendNotConfigured);
    }
    const res = await accountFetch(`${API_BASE_URL}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The language mail is written in, and this installation's id, so a
      // sign-in from somewhere new can be reported without anything personal.
      body: JSON.stringify({
        email,
        password,
        ...registerDetails,
        locale: lang,
        deviceId: installationId(),
      }),
    });
    if (!res.ok) throw accountFailure(res.status);
    const data = (await res.json()) as { token: string; verificationEmailSent?: boolean };
    // A new login must not inherit a previous account's signed caches, even if
    // an earlier asynchronous logout was interrupted.
    await invoke("clear_license");
    // "Remember me" decides *where* the session lives, not just whether we
    // prefill an address: sessionStorage is cleared when the app closes, so
    // unticking it genuinely means "don't keep me signed in on this machine"
    // rather than being a cosmetic checkbox.
    storeSession(data.token, email, remember);
    setAuth({
      status: "authenticated",
      email,
      isPro: false,
      emailVerified: false,
      plan: null,
      hasBilling: false,
    });
    if (mode === "register" && data.verificationEmailSent) {
      pushToast("success", format(s.auth.checkInboxAfterSignup, { email }), 12000);
    }
    await refreshAccount();
  }

  async function resendVerification() {
    if (!API_BASE_URL) throw new Error(s.auth.backendNotConfigured);
    const token = readToken();
    if (!token) throw new Error(s.auth.loginRequiredForCheckout);
    const res = await accountFetch(`${API_BASE_URL}/api/auth/resend-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ locale: lang }),
    });
    if (!res.ok) throw accountFailure(res.status);
  }

  async function forgotPassword(email: string) {
    if (!API_BASE_URL) throw new Error(s.auth.backendNotConfigured);
    const res = await accountFetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale: lang }),
    });
    if (!res.ok) throw accountFailure(res.status);
  }

  /** Needs the current password; this session continues with the token the
   *  server returns, every other one ends. */
  async function changePassword(currentPassword: string, newPassword: string) {
    if (!API_BASE_URL) throw new Error(s.auth.backendNotConfigured);
    const token = readToken();
    const email = readStoredEmail();
    if (!token || !email) throw new Error(s.auth.loginRequiredForCheckout);
    const res = await accountFetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, locale: lang }),
    });
    if (res.status === 401) throw new Error(s.auth.errorCurrentPassword);
    if (!res.ok) throw accountFailure(res.status);
    const data = (await res.json()) as { token: string };
    storeSession(data.token, email, localStorage.getItem(TOKEN_KEY) !== null);
  }

  /** Nothing changes until the link sent to the new address is confirmed. */
  async function changeEmail(password: string, newEmail: string) {
    if (!API_BASE_URL) throw new Error(s.auth.backendNotConfigured);
    const token = readToken();
    if (!token) throw new Error(s.auth.loginRequiredForCheckout);
    const res = await accountFetch(`${API_BASE_URL}/api/auth/change-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password, newEmail, locale: lang }),
    });
    if (res.status === 401) throw new Error(s.auth.errorCurrentPassword);
    if (!res.ok) throw accountFailure(res.status);
  }

  // Opens real Stripe Checkout in the system browser (Checkout can't run
  // inside the app's webview). Throws with a clear reason when the backend
  // isn't configured or the user isn't logged in yet, instead of pretending
  // to charge anything.
  /** `startTrial` (trial button vs "Subscribe now") is sent only when a
   *  trial is on offer; the server still decides whether one applies. */
  async function startCheckout(plan: ProPlan = "annual", startTrial?: boolean) {
    if (import.meta.env.DEV && import.meta.env.VITE_LIFETIME_PREVIEW_ENDS_AT) {
      throw new Error(PRICING_COPY[lang].previewCheckout);
    }
    if (!API_BASE_URL) {
      throw new Error(s.auth.backendNotConfigured);
    }
    const token = readToken();
    if (!token) {
      throw new Error(s.auth.loginRequiredForCheckout);
    }
    const res = await fetch(`${API_BASE_URL}/api/checkout`, {
      method: "POST",
      // The PC id: the free trial is once per PC as well as per account (backend trial.ts).
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(await deviceHeader()),
      },
      body: JSON.stringify(startTrial === undefined ? { plan } : { plan, start_trial: startTrial }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string; code?: string });
      throw new CheckoutError(body.error || `HTTP ${res.status}`, body.code);
    }
    const data = (await res.json()) as { url: string };
    await openUrl(data.url);
  }

  // A one-off tip. No login required — it isn't tied to an account and
  // unlocks nothing, so there's nothing to gate behind sign-in. The count is
  // sent, but the backend clamps it; this side is convenience, not the limit.
  async function buyCoffee(quantity: number) {
    if (!API_BASE_URL) {
      throw new Error(s.auth.backendNotConfigured);
    }
    const res = await fetch(`${API_BASE_URL}/api/tip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { url: string };
    await openUrl(data.url);
  }

  async function openBillingPortal() {
    if (!API_BASE_URL) {
      throw new Error(s.auth.backendNotConfigured);
    }
    const token = readToken();
    if (!token) {
      throw new Error(s.auth.loginRequiredForCheckout);
    }
    const res = await fetch(`${API_BASE_URL}/api/portal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { url: string };
    await openUrl(data.url);
  }

  const CATEGORIES: { key: Section; label: string; icon: React.ReactElement }[] = [
    {
      key: "overview",
      label: s.tabs.overview,
      icon: <HeartPulseIcon className="h-[18px] w-[18px]" />,
    },
    { key: "scan", label: s.tabs.scan, icon: <RadarIcon className="h-[18px] w-[18px]" /> },
    { key: "health", label: s.tabs.health, icon: <HeartPulseIcon className="h-[18px] w-[18px]" /> },
    {
      key: "hardware",
      label: s.tabs.hardware,
      icon: <ThermometerIcon className="h-[18px] w-[18px]" />,
    },
    { key: "performance", label: s.tabs.performance, icon: CATEGORY_STYLE.performance.icon },
    { key: "gaming", label: s.tabs.gaming, icon: CATEGORY_STYLE.gaming.icon },
    { key: "privacy", label: s.tabs.privacy, icon: CATEGORY_STYLE.privacy.icon },
    { key: "startup", label: s.tabs.startup, icon: <RocketIcon className="h-[18px] w-[18px]" /> },
    { key: "debloat", label: "Debloat", icon: <LayersIcon className="h-[18px] w-[18px]" /> },
    { key: "ui", label: s.tabs.ui, icon: CATEGORY_STYLE.ui.icon },
    { key: "maintenance", label: s.tabs.maintenance, icon: CATEGORY_STYLE.maintenance.icon },
    { key: "profiles", label: s.tabs.profiles, icon: <LayersIcon className="h-[18px] w-[18px]" /> },
    { key: "ledger", label: s.tabs.ledger, icon: <HistoryIcon className="h-[18px] w-[18px]" /> },
    { key: "pricing", label: s.tabs.pricing, icon: <GemIcon className="h-[18px] w-[18px]" /> },
  ];

  const [tweaks, setTweaks] = useState<TweakInfo[]>([]);
  const [cleanupTargets, setCleanupTargets] = useState<CleanupInfo[]>([]);
  // Dev builds only: VITE_START_SECTION opens a chosen page for review.
  const [filter, setFilterState] = useState<Section>(
    () => (import.meta.env.DEV && (import.meta.env.VITE_START_SECTION as Section)) || "scan",
  );
  const scanApplying = useRef(false);
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  /**
   * Picking a section always clears an active search.
   *
   * While `searching` is true every section panel is suppressed (see the
   * `&& !searching` guards below) and the list shows matches from every
   * section instead. That meant clicking a sidebar entry with text still in
   * the search box changed nothing on screen — the app looked frozen rather
   * than filtered. Navigating is an explicit "show me this section", so it
   * wins over a leftover query.
   */
  const setFilter = useCallback((section: Section) => {
    if (scanApplying.current) return;
    setFilterState(section);
    setQuery("");
    contentRef.current?.scrollTo({ top: 0 });
  }, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  /** Id of the tweak whose exact registry write is currently disclosed. */
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState<CleanupInfo | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Owned here rather than inside RamCleaner so the schedule keeps running
  // when the user navigates away from the Scan screen.
  const [ramAutoMinutes, setRamAutoMinutes] = useState<number>(storedRamAutoMinutes);
  // Command Center bridge: the Pulse asks for scans and mirrors the panel.
  const pulseSamples = usePulseSamples();
  const toastSeq = useRef(0);

  const autoClean = useScheduledRamClean(ramAutoMinutes);

  function chooseRamAuto(minutes: number) {
    setRamAutoMinutes(minutes);
    localStorage.setItem(RAM_AUTO_STORAGE_KEY, String(minutes));
  }

  async function refresh() {
    const [list, cleanup] = await Promise.all([
      invoke<TweakInfo[]>("list_tweaks"),
      invoke<CleanupInfo[]>("list_cleanup_targets"),
    ]);
    setTweaks(list);
    setCleanupTargets(cleanup);
  }

  useEffect(() => {
    refresh().catch((e) => pushToast("error", String(e)));
  }, []);

  function pushToast(kind: Toast["kind"], message: string, ms = 4000) {
    // Every user-visible error funnels through here, which makes it the one
    // honest hook for opt-in error reporting: what gets reported is exactly
    // what the user saw, never more.
    if (kind === "error") reportError(message);
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, ms);
  }

  async function toggle(tweak: TweakInfo) {
    const text = textFor(s.tweaks, tweak.id, tweak.name, tweak.description);
    // Turning an applied Pro tweak off is a restore, and restores never
    // need Pro: a trial or subscription that ended must not strand a change.
    if (tweak.requires_pro && !isProUnlocked && !tweak.applied) {
      setPaywallFeature(text.name);
      return;
    }
    setBusyId(tweak.id);
    try {
      if (tweak.applied) {
        await invoke("rollback_tweak", { id: tweak.id });
        pushToast("success", format(s.toasts.rolledBack, { name: text.name }));
      } else {
        await invoke("apply_tweak", { id: tweak.id });
        pushToast("success", format(s.toasts.applied, { name: text.name }));
      }
      await refresh();
    } catch (e) {
      // The Rust side re-verifies Pro independently of this screen's own
      // gate above — see license.rs. In normal use that gate already stops
      // a non-Pro user from getting here, so the only realistic way to hit
      // this is a genuine subscriber whose cached proof of that went stale
      // from being offline past the grace period. Rust's raw error message
      // ("requires an active subscription") would be misleading for them —
      // they have one — so this is worded around reconnecting instead.
      const message = String(e);
      if (message.startsWith("PRO_REQUIRED: ")) {
        pushToast("error", s.toasts.licenseNeedsRefresh);
      } else {
        pushToast("error", friendlyError(message, s));
      }
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Turns off every applied tweak in one action. Goes through the batched
   * `rollback_tweaks` command so the whole restore costs a single UAC prompt
   * instead of one per admin-level tweak, and reports per-tweak failures
   * rather than stopping at the first one.
   */
  async function restoreAll() {
    const appliedIds = tweaks
      .filter((t) => t.applied && !CONFIGURABLE_TWEAK_IDS.has(t.id))
      .map((t) => t.id);
    setConfirmRestore(false);
    if (appliedIds.length === 0) {
      pushToast("error", s.restore.nothingToast);
      return;
    }
    setRestoring(true);
    try {
      const failures = await invoke<string[]>("rollback_tweaks", { ids: appliedIds });
      failures.forEach((f) => pushToast("error", friendlyError(f, s)));
      await refresh();
      // From what is still in effect, not from the failure list: a cancelled
      // administrator prompt is one failure for every elevated tweak.
      const after = await invoke<TweakInfo[]>("list_tweaks");
      const restored = appliedIds.filter(
        (id) => !after.some((t) => t.id === id && t.applied),
      ).length;
      if (restored > 0) pushToast("success", format(s.restore.doneToast, { count: restored }));
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setRestoring(false);
    }
  }

  async function runCleanup(info: CleanupInfo) {
    setBusyId(info.id);
    setConfirmCleanup(null);
    try {
      const result = await invoke<CleanupResult>("run_cleanup", { id: info.id });
      const base = format(s.cleanupResultToast, {
        deleted: result.deleted_count,
        freed: formatBytes(result.freed_bytes),
      });
      const suffix =
        result.skipped_count > 0
          ? format(s.cleanupResultToastSkipped, { skipped: result.skipped_count })
          : ".";
      pushToast("success", base + suffix);
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusyId(null);
    }
  }

  /** Cleans only the preview items the user left ticked. Same result/toast
   *  shape as the full cleanup — from the user's side it's the same action,
   *  just scoped. */
  async function runCleanupSelected(info: CleanupInfo, names: string[]) {
    setBusyId(info.id);
    setConfirmCleanup(null);
    try {
      const result = await invoke<CleanupResult>("run_cleanup_selected", {
        id: info.id,
        names,
      });
      const base = format(s.cleanupResultToast, {
        deleted: result.deleted_count,
        freed: formatBytes(result.freed_bytes),
      });
      const suffix =
        result.skipped_count > 0
          ? format(s.cleanupResultToastSkipped, { skipped: result.skipped_count })
          : ".";
      pushToast("success", base + suffix);
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusyId(null);
    }
  }

  const searching = query.trim().length > 0;

  const visibleTweaks = useMemo(() => {
    // Turbo Boost is deliberately excluded: it has its own dedicated card on
    // the Gaming screen, so listing it again would show two controls for it.
    const base = tweaks.filter((t) => t.id !== "turbo_boost");

    // While searching, ignore the selected section and look everywhere —
    // otherwise the user has to already know which category a tweak lives in,
    // which is exactly what the search is there to avoid.
    if (searching) {
      const needle = query.trim().toLowerCase();
      return base.filter((t) => {
        const text = textFor(s.tweaks, t.id, t.name, t.description);
        return (
          text.name.toLowerCase().includes(needle) ||
          text.description.toLowerCase().includes(needle)
        );
      });
    }

    if (
      filter === "overview" ||
      filter === "scan" ||
      filter === "health" ||
      filter === "hardware" ||
      filter === "startup" ||
      filter === "pricing" ||
      filter === "profiles"
    )
      return [];

    const inCategory = base.filter((t) => t.category === filter);

    return orderSectionTweaks(inCategory, filter);
  }, [tweaks, filter, query, searching, s]);

  const showCleanup = filter === "maintenance" && !searching;
  const showPrivacyExtras = filter === "privacy" && !searching;
  const showGamingExtras = filter === "gaming" && !searching;
  const showOverview = filter === "overview" && !searching;
  const showScan = filter === "scan" && !searching;
  const showHealth = filter === "health" && !searching;
  const showHardware = filter === "hardware" && !searching;
  const showStartup = filter === "startup" && !searching;
  const showPricing = filter === "pricing" && !searching;
  const showProfiles = filter === "profiles" && !searching;
  const showLedger = FEATURE_INTELLIGENCE && filter === "ledger" && !searching;
  const turboBoostApplied = tweaks.find((t) => t.id === "turbo_boost")?.applied ?? false;
  const catalogTweaks = tweaks.filter((t) => isCurrentCatalogTweak(t.id));
  const appliedCount = catalogTweaks.filter(
    (t) => t.applied && !CONFIGURABLE_TWEAK_IDS.has(t.id),
  ).length;
  const restorableCount = tweaks.filter(
    (t) => t.applied && !CONFIGURABLE_TWEAK_IDS.has(t.id),
  ).length;
  // What the pricing page can honestly promise a Free user.
  const freeTweakCount = catalogTweaks.filter((t) => !t.requires_pro).length;
  // The free trial in the main window and at locked points (owner, 23 Oct
  // 2026): one rule everywhere, never shown to a paying account.
  const trial = trialEntry(
    "pctweaker",
    auth.status === "authenticated",
    isProUnlocked,
    prices,
    billing,
  );
  const trialDays = trial?.kind === "offer" ? trial.days : null;

  const currentLabel = CATEGORIES.find((c) => c.key === filter)?.label ?? "";

  // The title bar shows the machine as it is right now, from the same samples
  // the monitor draws. Before the first sample lands both are null, and the
  // bar leaves the meters out rather than drawing a 0% that would read as an
  // idle machine.
  const latestPulse = pulseSamples.length > 0 ? pulseSamples[pulseSamples.length - 1] : null;
  const ramPct =
    latestPulse && latestPulse.ramTotal > 0
      ? (latestPulse.ramUsed / latestPulse.ramTotal) * 100
      : null;

  return (
    <div className="desktop-refresh bg-app text-ink flex h-screen flex-col overflow-hidden [font-family:var(--font-app)]">
      {/* The window is frameless, so the app draws its own chrome. */}
      <TitleBar
        s={s}
        appliedCount={appliedCount}
        totalCount={catalogTweaks.length}
        cpuPct={latestPulse ? latestPulse.cpu : null}
        ramPct={ramPct}
        trial={titleTrial(lang, trial, Date.now())}
        onOpenPlans={() => setFilter("pricing")}
      />

      <main className="flex min-h-0 flex-1">
        {/* Control Room shell: an opaque raised band for navigation, separated
          from the content floor by a hairline — depth from luminance and
          borders, never blur or shadows. */}
        <WorkspaceSidebar
          s={s}
          items={CATEGORIES}
          active={filter}
          isPro={isProUnlocked}
          showHistory={FEATURE_INTELLIGENCE}
          onNavigate={setFilter}
          onTip={async (quantity) => {
            try {
              await buyCoffee(quantity);
            } catch (e) {
              pushToast("error", String(e instanceof Error ? e.message : e));
            }
          }}
        />

        <div
          ref={contentRef}
          className="workspace-content app-field min-w-0 flex-1 overflow-y-auto px-8 py-7"
        >
          <div className={`workspace-page ${showPricing ? "workspace-pricing-page" : ""}`}>
            <header
              className={`workspace-header border-line flex items-start justify-between gap-4 ${filter === "debloat" ? "mb-2" : "mb-6 border-b pb-4"}`}
            >
              {/* The pricing screen leads with its own hero title, so
                the section heading would just be a duplicate above it. */}
              <div className="min-w-0">
                {!showPricing && filter !== "debloat" && (
                  <h1 className="type-page page-title">{currentLabel}</h1>
                )}
                {/* Overview and Startup provide their own counts. */}
                {!showOverview &&
                  !showScan &&
                  !showStartup &&
                  !showPricing &&
                  filter !== "debloat" && (
                    <div className="mt-1 flex items-center gap-3">
                      <p className="text-ink-3 type-data text-[12.5px]">
                        {format(s.appliedCount, {
                          applied: appliedCount,
                          total: catalogTweaks.length,
                        })}
                      </p>
                      {/* Restore supported settings from their saved values. */}
                      {restorableCount > 0 && (
                        <button
                          onClick={() => setConfirmRestore(true)}
                          disabled={restoring}
                          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2 transition-colors hover:border-line-2 hover:bg-surface-hover hover:text-white disabled:cursor-wait disabled:opacity-60"
                        >
                          <UndoIcon className="h-3.5 w-3.5" />
                          {restoring ? s.restore.running : s.restore.button}
                        </button>
                      )}
                    </div>
                  )}
              </div>
              {!showPricing && filter !== "debloat" && (
                <div className="relative ml-auto w-56 shrink-0">
                  <MagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                  <input
                    value={query}
                    onChange={(e) => {
                      if (!scanApplying.current) setQuery(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                    aria-label={s.search.placeholder}
                    placeholder={s.search.placeholder}
                    className="w-full rounded-xl border border-line bg-surface-2 py-2 pl-9 pr-8 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-line-2 focus:bg-surface-hover"
                  />
                  {searching && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label={s.search.clear}
                      className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-hover hover:text-ink-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              <AccountMenu
                s={s}
                lang={lang}
                setLang={setLang}
                theme={theme}
                setTheme={setTheme}
                auth={auth}
                onReferrals={referralAvailable ? () => setReferralOpen(true) : undefined}
                open={accountMenuOpen}
                onOpenChange={setAccountMenuOpen}
                onAuthenticate={authenticate}
                onLogout={logout}
                onResendVerification={resendVerification}
                onForgotPassword={forgotPassword}
                onChangePassword={changePassword}
                onChangeEmail={changeEmail}
                onUpgrade={() => setPaywallFeature(s.menu.planPro)}
                onViewPlan={() => setFilter("pricing")}
                onManageBilling={() =>
                  openBillingPortal().catch((e) =>
                    pushToast("error", String(e instanceof Error ? e.message : e)),
                  )
                }
                pushToast={pushToast}
              />
              {referralOpen && auth.status === "authenticated" && (
                <ReferralPanel
                  lang={lang}
                  lifetime={auth.isPro && auth.plan === "lifetime"}
                  onClose={() => setReferralOpen(false)}
                  onChanged={() => void refreshReferralSession(true)}
                />
              )}
            </header>

            <div hidden={!showScan} className="workspace-view workspace-scan-view">
              <PageBoundary s={s} resetKey="scan">
                <div id="scan-results">
                  <ScanPanel
                    s={s}
                    lang={lang}
                    isPro={isProUnlocked}
                    onFixed={refresh}
                    pushToast={pushToast}
                    onNavigate={setFilter}
                    trialDays={trialDays}
                    onBusyChange={(busy) => {
                      scanApplying.current = busy;
                    }}
                  />
                  <TweakyDriverPromoCard s={s} />
                </div>
              </PageBoundary>
            </div>

            <div key={filter} className="workspace-view">
              <PageBoundary s={s} resetKey={filter}>
                {showOverview && (
                  <OverviewPanel
                    s={s}
                    lang={lang}
                    tweaks={tweaks}
                    samples={pulseSamples}
                    onNavigate={setFilter}
                  />
                )}

                {showCleanup && (
                  <>
                    <RamCleaner
                      s={s}
                      samples={pulseSamples}
                      autoMinutes={ramAutoMinutes}
                      onChangeAuto={chooseRamAuto}
                      auto={autoClean}
                      pushToast={pushToast}
                    />
                    <ul className="maintenance-drive-tools">
                      <DiskToolsSection
                        s={s}
                        isPro={isProUnlocked}
                        onRequirePro={() => setPaywallFeature(s.diskOptimize.title)}
                        onToast={pushToast}
                      />
                    </ul>
                    <SystemMonitor s={s} />
                  </>
                )}

                {showHardware && (
                  <HardwarePanel
                    s={s}
                    isPro={isProUnlocked}
                    onRequirePro={() => setPaywallFeature(s.driverBooster.title)}
                    pushToast={pushToast}
                  />
                )}

                {showHealth && <LiveDashboard s={s} lang={lang} onNavigate={setFilter} />}
                {showHealth && (
                  <BeforeAfterPanel s={s} lang={lang} tweaks={tweaks} pushToast={pushToast} />
                )}
                {showHealth && (
                  <SystemRepairCard
                    s={s}
                    isPro={isProUnlocked}
                    onRequirePro={() => setPaywallFeature(s.systemRepair.title)}
                    pushToast={pushToast}
                  />
                )}

                {showHealth && (
                  <HealthPanel
                    title={s.healthPanel.title}
                    subtitle={s.healthPanel.subtitle}
                    refreshLabel={s.healthPanel.refresh}
                    computeLabel={s.healthPanel.compute}
                    computingLabel={s.healthPanel.computing}
                    idleHint={s.healthPanel.idleHint}
                    showMore={s.healthPanel.showMore}
                    showLess={s.healthPanel.showLess}
                    stages={[
                      s.healthPanel.stageProfile,
                      s.healthPanel.stageTweaks,
                      s.healthPanel.stageSecurity,
                      s.healthPanel.stageScoring,
                    ]}
                    verdicts={{
                      excellent: s.healthPanel.verdictExcellent,
                      good: s.healthPanel.verdictGood,
                      fair: s.healthPanel.verdictFair,
                      needsWork: s.healthPanel.verdictNeedsWork,
                    }}
                    change={{
                      sinceLast: s.healthPanel.changeSinceLast,
                      noChange: s.healthPanel.changeNone,
                      firstRun: s.healthPanel.changeFirstRun,
                      whyTitle: s.healthPanel.changeWhyTitle,
                      contributes: s.healthPanel.changeContributes,
                      structural: s.healthPanel.changeStructural,
                      trend: s.healthPanel.changeTrend,
                    }}
                    categoryLabels={s.healthPanel.categories}
                  />
                )}

                {showLedger && (
                  <>
                    {/* Above the ledger: a crash is the one thing on this screen
                  that needs acting on, and it renders nothing at all when
                  there are no reports. */}
                    {/* Above the crash card: a reverted tweak is something the
                  user can act on right now, and it renders nothing when
                  nothing drifted. */}
                    <DriftWatchToggle s={s} pushToast={pushToast} />
                    <UpdateDriftCard
                      s={s}
                      tweaks={tweaks}
                      onChanged={refresh}
                      pushToast={pushToast}
                    />
                    <CrashReportsCard s={s} pushToast={pushToast} />
                    <ChangeHistory
                      s={s}
                      lang={lang}
                      tweaks={tweaks}
                      onChanged={refresh}
                      pushToast={pushToast}
                    />
                  </>
                )}

                {showStartup && <StartupManager s={s} pushToast={pushToast} />}

                {/* Keep operation state alive when navigating during a removal. */}
                <div hidden={filter !== "debloat" || searching}>
                  <DebloatPanel
                    lang={lang}
                    active={filter === "debloat" && !searching}
                    onNavigate={setFilter}
                  />
                </div>

                {showStartup && <ScheduledTaskManager s={s} pushToast={pushToast} />}

                {showProfiles && (
                  <ProfilesPanel
                    s={s}
                    lang={lang}
                    lifetimeOwned={
                      isProUnlocked && auth.status === "authenticated" && auth.plan === "lifetime"
                    }
                    onViewPlans={() => setFilter("pricing")}
                    tweaks={tweaks}
                    isPro={isProUnlocked}
                    authed={auth.status === "authenticated"}
                    onRequireAuth={() => {
                      pushToast("error", s.profiles.signInRequired);
                      setAccountMenuOpen(true);
                    }}
                    onRequirePro={() => setPaywallFeature(s.profiles.title)}
                    onChanged={refresh}
                    pushToast={pushToast}
                  />
                )}

                {showPricing && (
                  <PricingPanel
                    s={s}
                    lang={lang}
                    isPro={isProUnlocked}
                    heldPlan={auth.status === "authenticated" ? auth.plan : null}
                    hasBilling={auth.status === "authenticated" && auth.hasBilling}
                    prices={prices}
                    billing={billing ?? null}
                    freeTweakCount={freeTweakCount}
                    onOpenLifetimeTools={() => setFilter("profiles")}
                    onChoosePro={async (plan, startTrial) => {
                      // A visitor without an account is exactly who this button is
                      // for, and it used to answer them with a red toast and
                      // nowhere to go: startCheckout throws without a token and
                      // the catch below only reported it. ProfilesPanel already
                      // had the right shape — say what is missing and open the
                      // place where it is fixed.
                      if (auth.status !== "authenticated") {
                        rememberPlan(plan, startTrial);
                        pushToast("error", s.auth.loginRequiredForCheckout);
                        setAccountMenuOpen(true);
                        return;
                      }
                      try {
                        await startCheckout(plan, startTrial);
                      } catch (e) {
                        // Checkout needs a confirmed inbox. Same shape as above: say
                        // what is missing and open the menu with the resend button.
                        // The server decides, since emailVerified starts false
                        // until refreshAccount() answers.
                        if (e instanceof CheckoutError && e.code === "email_unverified") {
                          rememberPlan(plan, startTrial);
                          pushToast("error", s.auth.verifyEmailForCheckout);
                          setAccountMenuOpen(true);
                          return;
                        }
                        pushToast("error", String(e instanceof Error ? e.message : e));
                      }
                    }}
                    onManageBilling={async () => {
                      try {
                        await openBillingPortal();
                      } catch (e) {
                        pushToast("error", String(e instanceof Error ? e.message : e));
                      }
                    }}
                  />
                )}

                {showPrivacyExtras && (
                  <>
                    <ZeroTraceCard
                      s={s}
                      isPro={isProUnlocked}
                      onRequirePro={() => setPaywallFeature(s.zeroTrace.title)}
                      pushToast={pushToast}
                    />
                    <PasswordBreachCheck s={s} />
                    <RedaxaPromoCard s={s} />
                  </>
                )}

                {showGamingExtras && (
                  <>
                    <TurboBoostPanel
                      s={s}
                      applied={turboBoostApplied}
                      onChanged={refresh}
                      pushToast={pushToast}
                    />
                    <GameSessionsPanel
                      s={s}
                      isPro={isProUnlocked}
                      onRequirePro={() => setPaywallFeature(s.gameSessions.title)}
                    />
                  </>
                )}

                {/* On the UI screen: it is a panel the user places, sizes and
              locks, which is the kind of thing that screen is for. Above the
              tweak list, like every other screen's headline card — below
              forty-odd rows nobody scrolled far enough to find it. */}
                {filter === "ui" && !searching && (
                  <GamingHudCard
                    s={s}
                    isPro={isProUnlocked}
                    onRequirePro={() => setPaywallFeature(s.hud.title)}
                    pushToast={pushToast}
                  />
                )}

                <ul className="flex flex-col gap-3">
                  {visibleTweaks.map((t, i) => {
                    if (
                      t.id === "ecoqos_rules" ||
                      t.id === "limit_do_background_download" ||
                      t.id === "monitor_refresh_profile"
                    ) {
                      return (
                        <li
                          key={t.id}
                          data-tweak-id={t.id}
                          data-priority={
                            !searching && (filter === "performance" || filter === "gaming") && i < 3
                          }
                          className="animate-card section-tweak"
                        >
                          <AdvancedControlCard
                            id={t.id}
                            lang={lang}
                            isPro={isProUnlocked}
                            onRequirePro={setPaywallFeature}
                            onChanged={refresh}
                          />
                        </li>
                      );
                    }
                    const style = CATEGORY_STYLE[t.category];
                    const text = textFor(s.tweaks, t.id, t.name, t.description);
                    return (
                      <li
                        key={t.id}
                        data-tweak-id={t.id}
                        data-priority={
                          !searching && (filter === "performance" || filter === "gaming") && i < 3
                        }
                        style={{ animationDelay: `${i * 40}ms` }}
                        className="animate-card section-tweak panel panel-hover group relative overflow-hidden p-4"
                      >
                        <div className="relative flex items-center gap-4">
                          <div
                            className="icon-module grid shrink-0 place-items-center"
                            style={{ "--module-tint": style.tint } as React.CSSProperties}
                          >
                            <TweakIcon id={t.id} fallback={style.icon} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                                {text.name}
                              </h2>
                              {/* The (i) is the door to the exact system change.
                            A description can be argued with; a registry path
                            can be checked in regedit, so it is one click away
                            rather than buried in a FAQ. */}
                              {t.changes.length > 0 ? (
                                <TechnicalToggle
                                  open={inspecting === t.id}
                                  label={s.transparency.title}
                                  hive={t.hive}
                                  onClick={() => {
                                    setInspecting(inspecting === t.id ? null : t.id);
                                  }}
                                />
                              ) : (
                                t.hive !== "—" && <Badge>{t.hive}</Badge>
                              )}
                              {t.requires_admin && <Badge kind="admin">{s.badges.admin}</Badge>}
                              {t.requires_pro && <Badge kind="pro">{s.badges.pro}</Badge>}
                              {t.already_set && !t.applied && (
                                <Badge kind="ok" title={s.badges.alreadySetHint}>
                                  {s.badges.alreadySet}
                                </Badge>
                              )}
                              {(t.min_build || t.pro_edition || t.enterprise_edition) && (
                                <Badge kind="muted">
                                  {[
                                    t.min_build
                                      ? format(s.requirements.minBuild, {
                                          version: buildName(t.min_build),
                                        })
                                      : null,
                                    t.pro_edition ? s.requirements.proEdition : null,
                                    t.enterprise_edition ? s.requirements.enterpriseEdition : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.55] text-ink-3">
                              {text.description}
                            </p>
                            {t.unavailable && !t.applied && (
                              <p className="mt-1.5 max-w-[52ch] text-[12px] leading-[1.5] text-warn">
                                {t.unavailable === "windows_version"
                                  ? format(s.requirements.unavailableVersion, {
                                      version: buildName(t.min_build ?? 22000),
                                    })
                                  : t.unavailable === "windows_edition"
                                    ? s.requirements.unavailableEdition
                                    : t.unavailable === "windows_edition_enterprise"
                                      ? s.requirements.unavailableEnterpriseEdition
                                      : t.unavailable === "windows_protected"
                                        ? s.requirements.windowsProtected
                                        : s.requirements.notPresent}
                              </p>
                            )}
                            {inspecting === t.id && (
                              <TechnicalDetails changes={t.changes} s={s} previewId={t.id} />
                            )}
                          </div>
                          <Toggle
                            label={text.name}
                            busyLabel={t.applied ? s.restore.running : s.profiles.applying}
                            checked={t.applied}
                            busy={busyId === t.id}
                            disabled={!!t.unavailable && !t.applied}
                            onClick={() => toggle(t)}
                            s={s}
                          />
                        </div>
                      </li>
                    );
                  })}

                  {showGamingExtras && (
                    <li>
                      <X3dPanel s={s} pushToast={pushToast} />
                      <NetworkCheckPanel s={s} tweaks={tweaks} />
                    </li>
                  )}

                  {showPrivacyExtras && (
                    <IpMaskCard
                      s={s}
                      onExplain={() => pushToast("error", s.ipMask.explainerToast)}
                    />
                  )}

                  {showCleanup &&
                    cleanupTargets.map((c) => (
                      <CleanupCard
                        key={c.id}
                        s={s}
                        info={c}
                        text={textFor(s.cleanup, c.id, c.name, c.description)}
                        busy={busyId === c.id}
                        isPro={isProUnlocked}
                        onRequirePro={() =>
                          setPaywallFeature(textFor(s.cleanup, c.id, c.name, c.description).name)
                        }
                        onRun={(info) => setConfirmCleanup(info)}
                      />
                    ))}

                  {showCleanup && (
                    <ScheduledCleanupCard
                      s={s}
                      isPro={isProUnlocked}
                      onRequirePro={() => setPaywallFeature(s.scheduledCleanup.title)}
                      onToast={pushToast}
                    />
                  )}

                  {showCleanup && <DnsFlushCard s={s} onToast={pushToast} />}

                  {showCleanup && <BrowserCleanupCard s={s} onToast={pushToast} />}

                  {/* Directly under the browser cleaner it supersedes for cookies:
                that card wipes the whole cookie file and signs the user out of
                everything, which is why most people click it once. This one is
                the version they can use every week. */}
                  {showCleanup && (
                    <CookieCleanerCard
                      s={s}
                      isPro={isProUnlocked}
                      onRequirePro={() => setPaywallFeature(s.cookieCleaner.title)}
                      onToast={pushToast}
                    />
                  )}

                  {showCleanup && (
                    <AppCacheCard
                      s={s}
                      isPro={isProUnlocked}
                      onRequirePro={() => setPaywallFeature(s.appCache.title)}
                      onToast={pushToast}
                    />
                  )}

                  {showCleanup && (
                    <DuplicateFinder
                      s={s}
                      isPro={isProUnlocked}
                      onRequirePro={() => setPaywallFeature(s.duplicateFinder.title)}
                      onToast={pushToast}
                    />
                  )}

                  {showCleanup && (
                    <LargeFileFinder
                      s={s}
                      isPro={isProUnlocked}
                      onRequirePro={() => setPaywallFeature(s.largeFiles.title)}
                      onToast={pushToast}
                    />
                  )}

                  {showCleanup && <UninstallerPromoCard s={s} />}

                  {/* "No tweaks in this category" only makes sense on a screen that
                IS a tweak category. It was an opt-out list of every other
                section, which meant each new screen had to remember to add
                itself — PC Health never did, and has been telling people it
                had no tweaks coming soon ever since. Asking whether the
                current filter is a real category cannot drift that way. */}
                  {visibleTweaks.length === 0 &&
                    (searching || Object.prototype.hasOwnProperty.call(CATEGORY_STYLE, filter)) &&
                    !showCleanup &&
                    !showPrivacyExtras &&
                    !showScan &&
                    !showStartup &&
                    !showPricing && (
                      <li className="animate-card rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-3">
                        {searching
                          ? format(s.search.noResults, { query: query.trim() })
                          : s.emptyCategory}
                      </li>
                    )}
                </ul>

                {/* Only where a change can be applied: on Scan, Overview, Profiles,
              Hardware, Startup and Plans the same sentence was noise. */}
                {(Object.prototype.hasOwnProperty.call(CATEGORY_STYLE, filter) ||
                  showCleanup ||
                  showHealth) && (
                  <p className="mx-auto mt-8 max-w-lg text-center text-xs leading-relaxed text-ink-3">
                    {s.headerNote}
                  </p>
                )}
              </PageBoundary>
            </div>
          </div>
        </div>
      </main>

      {confirmCleanup && (
        <CleanupConfirmModal
          s={s}
          info={confirmCleanup}
          displayName={
            textFor(s.cleanup, confirmCleanup.id, confirmCleanup.name, confirmCleanup.description)
              .name
          }
          onCancel={() => setConfirmCleanup(null)}
          onConfirmAll={() => runCleanup(confirmCleanup)}
          onConfirmSelected={(names) => runCleanupSelected(confirmCleanup, names)}
        />
      )}

      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="animate-card w-full max-w-sm rounded-2xl border border-line bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink">{s.restore.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              {format(s.restore.body, { count: restorableCount })}
            </p>
            <button
              onClick={restoreAll}
              className="mt-5 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400"
            >
              {s.restore.confirm}
            </button>
            <button
              onClick={() => setConfirmRestore(false)}
              className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-ink-3 hover:text-ink-2"
            >
              {s.restore.cancel}
            </button>
          </div>
        </div>
      )}

      {paywallFeature && (
        <PaywallModal
          s={s}
          lang={lang}
          featureName={paywallFeature}
          // The plans then offer the trial on monthly and yearly.
          trialDays={trialDays}
          onClose={() => setPaywallFeature(null)}
          // Send them to the plans instead of straight to a checkout for a
          // plan they never picked — they should see monthly vs yearly first.
          onNotify={() => {
            setPaywallFeature(null);
            setFilter("pricing");
          }}
        />
      )}

      {billingNotice && !paywallFeature && (
        <BillingNotice
          s={s}
          lang={lang}
          kind={billingNotice.kind}
          onClose={() => setBillingNotice(null)}
          onPortal={() => {
            setBillingNotice(null);
            openBillingPortal().catch((e) =>
              pushToast("error", String(e instanceof Error ? e.message : e)),
            );
          }}
          onPlans={() => {
            setBillingNotice(null);
            setFilter("pricing");
          }}
        />
      )}

      <UpdateBanner s={s} onToast={pushToast} />

      <div className="pointer-events-none fixed bottom-6 right-6 flex flex-col gap-2">
        {toasts.map((t) => (
          // Calm feedback: an opaque surface with a status-colored icon and
          // hairline. Status is carried by icon shape AND color, never color
          // alone.
          <div
            key={t.id}
            className={`animate-toast bg-surface-2 border-line-2 text-ink pointer-events-auto flex items-center gap-2.5 rounded-[10px] border px-4 py-3 text-[13px] font-medium ${
              t.kind === "success" ? "[&>svg]:text-ok" : "[&>svg]:text-danger"
            }`}
          >
            {t.kind === "success" ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0">
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0">
                <path
                  d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
