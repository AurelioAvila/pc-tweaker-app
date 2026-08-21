import React, { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { STRINGS, Lang, detectInitialLang, format } from "./i18n";
import { ThemeName, detectInitialTheme } from "./theme";
import {
  API_BASE_URL,
  FEATURE_INTELLIGENCE,
  RAM_AUTO_STORAGE_KEY,
  clearSession,
  formatBytes,
  readStoredEmail,
  readToken,
  storeSession,
  storedRamAutoMinutes,
  textFor,
} from "./lib";
import { AuthState, CleanupInfo, CleanupResult, Section, Toast, TweakInfo } from "./types";
import {
  CrownIcon,
  GemIcon,
  HistoryIcon,
  LayersIcon,
  MagnifierIcon,
  RadarIcon,
  RocketIcon,
  UndoIcon,
  HeartPulseIcon,
} from "./components/icons";
import { PaywallModal, ProBadge, ShieldBadge, Toggle, UpdateBanner } from "./components/ui";
import {
  CleanupCard,
  CleanupConfirmModal,
  DiskToolsSection,
  DnsFlushCard,
  DuplicateFinder,
  IpMaskCard,
  LargeFileFinder,
  PasswordBreachCheck,
  PromptShieldPromoCard,
  UninstallerPromoCard,
} from "./components/maintenance";
import { AccountMenu } from "./components/account";
import { DashboardCards } from "./components/dashboard";
import { GameSessionsPanel, TurboBoostPanel } from "./components/gaming";
import { ScanPanel } from "./components/scan";
import { HealthPanel } from "./components/health";
import { RamCleaner, SystemMonitor, useScheduledRamClean } from "./components/monitor";
import { AdvisorCard, LedgerPanel } from "./components/intelligence";
import { usePulseSamples } from "./components/command";
import { StartupManager } from "./components/startup";
import { ProfilesPanel } from "./components/profiles";
import { PricingPanel } from "./components/pricing";
import { CATEGORY_STYLE } from "./categories";
import "./App.css";

function App() {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang());
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

  const [auth, setAuth] = useState<AuthState>(() => {
    const email = readStoredEmail();
    const token = readToken();
    // isPro/emailVerified start false and are corrected by refreshAccount()
    // below as soon as it resolves — avoids briefly trusting a stale/forged
    // local value.
    return email && token
      ? { status: "authenticated", email, isPro: false, emailVerified: false }
      : { status: "anonymous" };
  });

  const isProUnlocked = auth.status === "authenticated" && auth.isPro;

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
      if (!res.ok) return;
      const data = (await res.json()) as { email: string; isPro: boolean; emailVerified: boolean };
      setAuth({
        status: "authenticated",
        email: data.email,
        isPro: data.isPro,
        emailVerified: data.emailVerified,
      });
      // Fire-and-forget: refreshLicense() has its own error handling and
      // must never block the UI's account status on a signing hiccup.
      void refreshLicense();
    } catch {
      // Network hiccup: keep whatever Pro status we already had rather than
      // dropping the user back to Free on a transient failure.
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
      const res = await fetch(`${API_BASE_URL}/api/license`, {
        headers: { Authorization: `Bearer ${token}` },
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

  useEffect(() => {
    refreshAccount();
    function onFocus() {
      refreshAccount();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clearSession();
    setAuth({ status: "anonymous" });
    // Without this, a still-fresh cached Pro license would keep unlocking
    // Pro tweaks for whoever uses the app next on this machine, for up to
    // its grace period — including an anonymous session.
    void invoke("clear_license").catch(() => {});
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
    const res = await fetch(`${API_BASE_URL}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, ...registerDetails }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { token: string };
    // "Remember me" decides *where* the session lives, not just whether we
    // prefill an address: sessionStorage is cleared when the app closes, so
    // unticking it genuinely means "don't keep me signed in on this machine"
    // rather than being a cosmetic checkbox.
    storeSession(data.token, email, remember);
    setAuth({ status: "authenticated", email, isPro: false, emailVerified: false });
    await refreshAccount();
  }

  async function resendVerification() {
    if (!API_BASE_URL) throw new Error(s.auth.backendNotConfigured);
    const token = readToken();
    if (!token) throw new Error(s.auth.loginRequiredForCheckout);
    const res = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || `HTTP ${res.status}`);
    }
  }

  async function forgotPassword(email: string) {
    if (!API_BASE_URL) throw new Error(s.auth.backendNotConfigured);
    const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || `HTTP ${res.status}`);
    }
  }

  // Opens real Stripe Checkout in the system browser (Checkout can't run
  // inside the app's webview). Throws with a clear reason when the backend
  // isn't configured or the user isn't logged in yet, instead of pretending
  // to charge anything.
  async function startCheckout(plan: "monthly" | "annual" = "annual") {
    if (!API_BASE_URL) {
      throw new Error(s.auth.backendNotConfigured);
    }
    const token = readToken();
    if (!token) {
      throw new Error(s.auth.loginRequiredForCheckout);
    }
    const res = await fetch(`${API_BASE_URL}/api/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { url: string };
    await openUrl(data.url);
  }

  const CATEGORIES: { key: Section; label: string; icon: React.ReactElement }[] = [
    { key: "scan", label: s.tabs.scan, icon: <RadarIcon className="h-[18px] w-[18px]" /> },
    { key: "health", label: s.tabs.health, icon: <HeartPulseIcon className="h-[18px] w-[18px]" /> },
    { key: "performance", label: s.tabs.performance, icon: CATEGORY_STYLE.performance.icon },
    { key: "gaming", label: s.tabs.gaming, icon: CATEGORY_STYLE.gaming.icon },
    { key: "privacy", label: s.tabs.privacy, icon: CATEGORY_STYLE.privacy.icon },
    { key: "startup", label: s.tabs.startup, icon: <RocketIcon className="h-[18px] w-[18px]" /> },
    { key: "ui", label: s.tabs.ui, icon: CATEGORY_STYLE.ui.icon },
    { key: "manutenzione", label: s.tabs.manutenzione, icon: CATEGORY_STYLE.manutenzione.icon },
    { key: "profiles", label: s.tabs.profiles, icon: <LayersIcon className="h-[18px] w-[18px]" /> },
    { key: "ledger", label: s.tabs.ledger, icon: <HistoryIcon className="h-[18px] w-[18px]" /> },
    { key: "pricing", label: s.tabs.pricing, icon: <GemIcon className="h-[18px] w-[18px]" /> },
  ];

  const [tweaks, setTweaks] = useState<TweakInfo[]>([]);
  const [cleanupTargets, setCleanupTargets] = useState<CleanupInfo[]>([]);
  const [filter, setFilter] = useState<Section>("scan");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState<CleanupInfo | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Owned here rather than inside RamCleaner so the schedule keeps running
  // when the user navigates away from the Scan screen.
  const [ramAutoMinutes, setRamAutoMinutes] = useState<number>(storedRamAutoMinutes);
  // Command Center bridge: the Pulse asks for scans and mirrors the panel.
  const pulseSamples = usePulseSamples();
  const toastSeq = useRef(0);

  useScheduledRamClean(ramAutoMinutes);

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

  function pushToast(kind: Toast["kind"], message: string) {
    // Every user-visible error funnels through here, which makes it the one
    // honest hook for opt-in error reporting: what gets reported is exactly
    // what the user saw, never more.
    if (kind === "error") reportError(message);
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }

  async function toggle(tweak: TweakInfo) {
    const text = textFor(s.tweaks, tweak.id, tweak.name, tweak.description);
    if (tweak.requires_pro && !isProUnlocked) {
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
        pushToast("error", message);
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
    const appliedIds = tweaks.filter((t) => t.applied).map((t) => t.id);
    setConfirmRestore(false);
    if (appliedIds.length === 0) {
      pushToast("error", s.restore.nothingToast);
      return;
    }
    setRestoring(true);
    try {
      const failures = await invoke<string[]>("rollback_tweaks", { ids: appliedIds });
      failures.forEach((f) => pushToast("error", f));
      await refresh();
      const restored = appliedIds.length - failures.length;
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
      filter === "scan" ||
      filter === "health" ||
      filter === "startup" ||
      filter === "pricing" ||
      filter === "profiles"
    )
      return [];

    const inCategory = base.filter((t) => t.category === filter);

    // Give Pro items some prominence without turning a section into a
    // storefront: the first two Pro tweaks move to the top, and every other
    // one keeps its place further down among the free ones. A section that
    // opened with nothing but padlocks would read as "this app is all about
    // the money", which is the opposite of what earns the upgrade.
    //
    // Order within each group is preserved (a stable partition), so this never
    // scrambles the list — it only lifts the first couple of entries.
    const PROMOTED_PRO = 2;
    const promoted: TweakInfo[] = [];
    const rest: TweakInfo[] = [];
    for (const t of inCategory) {
      if (t.requires_pro && promoted.length < PROMOTED_PRO) promoted.push(t);
      else rest.push(t);
    }
    return [...promoted, ...rest];
  }, [tweaks, filter, query, searching, s]);

  const showCleanup = filter === "manutenzione" && !searching;
  const showPrivacyExtras = filter === "privacy" && !searching;
  const showGamingExtras = filter === "gaming" && !searching;
  const showScan = filter === "scan" && !searching;
  const showHealth = filter === "health" && !searching;
  const showStartup = filter === "startup" && !searching;
  const showPricing = filter === "pricing" && !searching;
  const showProfiles = filter === "profiles" && !searching;
  const showLedger = FEATURE_INTELLIGENCE && filter === "ledger" && !searching;
  const turboBoostApplied = tweaks.find((t) => t.id === "turbo_boost")?.applied ?? false;
  const appliedCount = tweaks.filter((t) => t.applied).length;
  // What the pricing page can honestly promise a Free user.
  const freeTweakCount = tweaks.filter((t) => !t.requires_pro).length;

  const currentLabel = CATEGORIES.find((c) => c.key === filter)?.label ?? "";

  return (
    <main className="bg-app text-ink flex min-h-screen [font-family:var(--font-app)]">
      {/* Control Room shell: an opaque raised band for navigation, separated
          from the content floor by a hairline — depth from luminance and
          borders, never blur or shadows. */}
      <aside className="bg-raised border-line sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r p-4">
        <div className="mb-6 flex items-center gap-2.5 px-1">
          <img src="/logo-mark.png" alt="" className="h-8 w-8 shrink-0 rounded-[8px]" />
          <span className="truncate text-[14px] font-semibold tracking-tight">{s.appName}</span>
        </div>

        {/* Navigation grouped by intention (monitor / optimize / manage),
            not by internal feature list. The active item is marked by the
            system's signal hairline and primary ink — never a filled block. */}
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {(
            [
              [s.tabs.groupMonitor, ["scan", "health"]],
              [s.tabs.groupOptimize, ["performance", "gaming", "privacy", "ui"]],
              [
                s.tabs.groupManage,
                FEATURE_INTELLIGENCE
                  ? ["startup", "manutenzione", "profiles", "ledger"]
                  : ["startup", "manutenzione", "profiles"],
              ],
            ] as [string, Section[]][]
          ).map(([groupLabel, keys]) => (
            <div key={groupLabel} className="mb-2.5">
              <p className="type-label mb-1 px-3">{groupLabel}</p>
              {keys.map((key) => {
                const c = CATEGORIES.find((x) => x.key === key);
                if (!c) return null;
                const active = filter === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setFilter(c.key)}
                    className={`signal group relative flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium transition-colors duration-150 ${
                      active
                        ? "bg-surface-1 text-ink"
                        : "text-ink-3 hover:bg-surface-1/60 hover:text-ink-2"
                    }`}
                    data-active={active}
                  >
                    <span
                      className={`shrink-0 transition-colors ${active ? "text-accent" : "text-ink-3 group-hover:text-ink-2"}`}
                    >
                      {c.icon}
                    </span>
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Plan area: quiet by design. Pro is a state, not a billboard; the
            upgrade entry is discreet and never shows personal data. */}
        <div className="border-line mt-auto border-t pt-3">
          {isProUnlocked ? (
            <button
              onClick={() => setFilter("pricing")}
              className={`text-ink-2 hover:text-ink flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-[12px] font-semibold transition-colors duration-150 ${
                filter === "pricing" ? "bg-surface-1 text-ink" : ""
              }`}
            >
              <CrownIcon className="text-accent h-4 w-4" />
              {s.menu.planPro}
            </button>
          ) : (
            <button
              onClick={() => setFilter("pricing")}
              className={`border-line-2 text-ink-2 hover:border-accent/40 hover:text-ink w-full rounded-[8px] border px-3 py-2 text-[12px] font-semibold transition-colors duration-150 ${
                filter === "pricing" ? "border-accent/50 text-ink" : ""
              }`}
            >
              {s.menu.upgradeButton}
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-8 py-8">
        {/* The pricing comparison needs the extra width to sit side by side;
            every other screen reads better kept narrow. */}
        <div className={`mx-auto ${showPricing ? "max-w-5xl" : "max-w-3xl"}`}>
          <header className="mb-6 flex items-start justify-between gap-4">
            {/* The pricing screen leads with its own centred hero title, so
                the section heading would just be a duplicate above it. */}
            <div className="min-w-0">
              {!showPricing && <h1 className="type-page">{currentLabel}</h1>}
              {/* The tweak tally is meaningless on the startup screen, which
                  isn't made of tweaks and shows its own count instead. */}
              {!showStartup && !showPricing && (
                <div className="mt-1 flex items-center gap-3">
                  <p className="text-ink-3 type-data text-[12.5px]">
                    {format(s.appliedCount, { applied: appliedCount, total: tweaks.length })}
                  </p>
                  {/* One-click way back to a stock Windows: only offered when
                      there is actually something applied to undo. */}
                  {appliedCount > 0 && (
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
            <div className="relative ml-auto w-56 shrink-0">
              <MagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
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

            <AccountMenu
              s={s}
              lang={lang}
              setLang={setLang}
              theme={theme}
              setTheme={setTheme}
              auth={auth}
              open={accountMenuOpen}
              onOpenChange={setAccountMenuOpen}
              onAuthenticate={authenticate}
              onLogout={logout}
              onResendVerification={resendVerification}
              onForgotPassword={forgotPassword}
              onUpgrade={() => setPaywallFeature(s.menu.planPro)}
            />
          </header>

          {/* Free RAM leads the home screen: it is the card people use every
              day (one click, schedulable), so it earns the top spot over the
              passive monitor below it. */}
          {showScan && (
            <>
              <RamCleaner
                s={s}
                samples={pulseSamples}
                autoMinutes={ramAutoMinutes}
                onChangeAuto={chooseRamAuto}
                pushToast={pushToast}
              />
              <SystemMonitor s={s} />
              {/* One concrete, hardware-motivated recommendation — never a
                  pile. Hidden entirely when the flag is off. */}
              {FEATURE_INTELLIGENCE && (
                <AdvisorCard
                  s={s}
                  tweaks={tweaks}
                  busyId={busyId}
                  isPro={isProUnlocked}
                  onRequirePro={() => setPaywallFeature(s.menu.planPro)}
                  onApply={toggle}
                />
              )}
            </>
          )}

          {showScan && <DashboardCards s={s} onNavigate={setFilter} />}

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
              baseline={{
                title: s.healthPanel.baselineTitle,
                hint: s.healthPanel.baselineHint,
                run: s.healthPanel.baselineRun,
                running: s.healthPanel.baselineRunning,
                empty: s.healthPanel.baselineEmpty,
              }}
            />
          )}

          {showLedger && (
            <LedgerPanel s={s} tweaks={tweaks} onChanged={refresh} pushToast={pushToast} />
          )}

          {showStartup && <StartupManager s={s} pushToast={pushToast} />}

          {showProfiles && (
            <ProfilesPanel
              s={s}
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
              freeTweakCount={freeTweakCount}
              onChoosePro={async (plan) => {
                try {
                  await startCheckout(plan);
                } catch (e) {
                  pushToast("error", String(e instanceof Error ? e.message : e));
                }
              }}
            />
          )}

          {showScan && (
            <div id="scan-results">
              <ScanPanel
                s={s}
                tweaks={tweaks}
                cleanupTargets={cleanupTargets}
                isPro={isProUnlocked}
                onRequirePro={() => setPaywallFeature(s.menu.planPro)}
                onFixed={refresh}
                pushToast={pushToast}
              />
            </div>
          )}

          {showPrivacyExtras && (
            <>
              <PasswordBreachCheck s={s} />
              <PromptShieldPromoCard s={s} />
            </>
          )}

          {showGamingExtras && (
            <>
              <GameSessionsPanel
                s={s}
                isPro={isProUnlocked}
                onRequirePro={() => setPaywallFeature(s.gameSessions.title)}
              />
              <TurboBoostPanel
                s={s}
                applied={turboBoostApplied}
                onChanged={refresh}
                pushToast={pushToast}
              />
            </>
          )}

          <ul className="flex flex-col gap-3">
            {visibleTweaks.map((t, i) => {
              const style = CATEGORY_STYLE[t.category];
              const text = textFor(s.tweaks, t.id, t.name, t.description);
              return (
                <li
                  key={t.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`animate-card group relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4
                  shadow-lg shadow-black/20 transition-all duration-200 hover:border-line-2 hover:bg-surface-2`}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${style.ring}`}
                  />
                  <div className="relative flex items-center gap-4">
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${style.chip}`}
                    >
                      {style.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-ink">{text.name}</h2>
                        {t.hive !== "—" && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
                            {t.hive}
                          </span>
                        )}
                        {t.requires_admin && <ShieldBadge label={s.badges.admin} />}
                        {t.requires_pro && <ProBadge label={s.badges.pro} />}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-3">{text.description}</p>
                    </div>
                    <Toggle
                      checked={t.applied}
                      busy={busyId === t.id}
                      onClick={() => toggle(t)}
                      s={s}
                    />
                  </div>
                </li>
              );
            })}

            {showPrivacyExtras && (
              <IpMaskCard s={s} onExplain={() => pushToast("error", s.ipMask.explainerToast)} />
            )}

            {showCleanup && (
              <DiskToolsSection
                s={s}
                isPro={isProUnlocked}
                onRequirePro={() => setPaywallFeature(s.diskOptimize.title)}
                onToast={pushToast}
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

            {showCleanup && <DnsFlushCard s={s} onToast={pushToast} />}

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

            {visibleTweaks.length === 0 &&
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

          <p className="mx-auto mt-8 max-w-lg text-center text-xs leading-relaxed text-ink-3">
            {s.headerNote}
          </p>
        </div>
      </div>

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
              {format(s.restore.body, { count: appliedCount })}
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
          featureName={paywallFeature}
          onClose={() => setPaywallFeature(null)}
          // Send them to the plans instead of straight to a checkout for a
          // plan they never picked — they should see monthly vs yearly first.
          onNotify={() => {
            setPaywallFeature(null);
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
    </main>
  );
}

export default App;
