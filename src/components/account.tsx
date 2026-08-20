import { useState } from "react";
import { LANGUAGES, Lang, Strings } from "../i18n";
import { THEMES, ThemeName } from "../theme";
import { ERROR_REPORTS_KEY, errorReportsEnabled } from "../lib";
import { AuthState } from "../types";
import { CheckIcon, CrownIcon } from "./icons";
import { Avatar } from "./ui";

export function AuthSection({
  s,
  auth,
  onAuthenticate,
  onLogout,
  onResendVerification,
  onForgotPassword,
}: {
  s: Strings;
  auth: AuthState;
  onAuthenticate: (
    mode: "login" | "register",
    email: string,
    password: string,
    registerDetails?: { firstName: string; lastName: string; dateOfBirth: string },
    remember?: boolean,
  ) => Promise<void>;
  onLogout: () => void;
  onResendVerification: () => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // Defaults on, like every desktop app people already use. Off means the
  // session lives only until the app closes.
  const [remember, setRemember] = useState(true);

  if (auth.status === "authenticated") {
    // "Logged in as name@example.com" as a bare line of text reads like a
    // status message. An avatar + the address + a verification badge reads
    // like an account — same information, and it's the first thing anyone
    // sees when they open this menu.
    return (
      <div className="relative overflow-hidden border-b border-white/10 p-3.5">
        {/* A wash of the active theme behind the account block, so the top of
            the menu reads as a header rather than as the first grey row of a
            list. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-20 blur-2xl"
          style={{ background: auth.isPro ? "#fbbf24" : "var(--app-accent)" }}
        />
        <div className="relative flex items-center gap-3">
          <Avatar email={auth.email} isPro={auth.isPro} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-100" title={auth.email}>
              {auth.email}
            </p>
            {auth.emailVerified ? (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <CheckIcon className="h-3 w-3" />
                {s.auth.emailVerified}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] font-medium text-amber-400">
                {s.auth.emailNotVerified}
              </p>
            )}
          </div>
        </div>

        {!auth.emailVerified && (
          <button
            onClick={() => {
              setError(null);
              setInfo(null);
              onResendVerification()
                .then(() => setInfo(s.auth.verificationSent))
                .catch((err) => setError(String(err instanceof Error ? err.message : err)));
            }}
            className="mt-2 w-full rounded-lg bg-amber-400/10 px-2 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-400/20"
          >
            {s.auth.resendVerification}
          </button>
        )}
        {info && <p className="mt-2 text-xs text-emerald-400">{info}</p>}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button
          onClick={onLogout}
          className="mt-2 w-full rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
        >
          {s.auth.logout}
        </button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="border-b border-white/10 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {s.menu.account}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setInfo(null);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              setError(s.auth.emailInvalid);
              return;
            }
            setWorking(true);
            try {
              await onForgotPassword(email);
              setInfo(s.auth.forgotPasswordSent);
            } catch (err) {
              setError(String(err instanceof Error ? err.message : err));
            } finally {
              setWorking(false);
            }
          }}
          className="flex flex-col gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={s.auth.email}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--app-accent)]"
          />
          {info && <p className="text-xs text-emerald-400">{info}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={working}
            className="rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {working ? s.auth.working : s.auth.forgotPasswordButton}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
              setInfo(null);
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            {s.auth.backToLogin}
          </button>
        </form>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(s.auth.emailInvalid);
      return;
    }
    if (password.length < 8) {
      setError(s.auth.passwordTooShort);
      return;
    }
    if (mode === "register" && (!firstName.trim() || !lastName.trim() || !dateOfBirth)) {
      setError(s.auth.registerDetailsRequired);
      return;
    }

    setWorking(true);
    try {
      // Safe: the "forgot" mode returns its own JSX earlier above, so this
      // code path only ever runs for "login" | "register".
      await onAuthenticate(
        mode as "login" | "register",
        email,
        password,
        mode === "register" ? { firstName, lastName, dateOfBirth } : undefined,
        // Registering always remembers: someone who just created an account
        // has no reason to be signed out the moment they close the window.
        mode === "register" ? true : remember,
      );
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="border-b border-white/10 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {s.menu.account}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        {mode === "register" && (
          <>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={s.auth.firstName}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--app-accent)]"
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={s.auth.lastName}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--app-accent)]"
            />
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--app-accent)]"
            />
          </>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={s.auth.email}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--app-accent)]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={s.auth.password}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--app-accent)]"
        />
        {mode === "login" && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--app-accent)]"
            />
            {s.auth.rememberMe}
          </label>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={working}
          className="rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {working ? s.auth.working : mode === "login" ? s.auth.loginButton : s.auth.registerButton}
        </button>
        {mode === "login" && (
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setError(null);
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            {s.auth.forgotPasswordLink}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "login" ? "register" : "login"));
            setError(null);
          }}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === "login" ? s.auth.switchToRegister : s.auth.switchToLogin}
        </button>
      </form>
    </div>
  );
}

export function AccountMenu({
  s,
  lang,
  setLang,
  theme,
  setTheme,
  auth,
  onAuthenticate,
  onLogout,
  onResendVerification,
  onForgotPassword,
  onUpgrade,
}: {
  s: Strings;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  auth: AuthState;
  onAuthenticate: (
    mode: "login" | "register",
    email: string,
    password: string,
    registerDetails?: { firstName: string; lastName: string; dateOfBirth: string },
    remember?: boolean,
  ) => Promise<void>;
  onLogout: () => void;
  onResendVerification: () => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [errReports, setErrReports] = useState(() => errorReportsEnabled());
  const isPro = auth.status === "authenticated" && auth.isPro;

  function toggleErrorReports() {
    const next = !errReports;
    setErrReports(next);
    localStorage.setItem(ERROR_REPORTS_KEY, next ? "on" : "off");
  }

  return (
    <div className="relative">
      {/* Signed in, the trigger *is* the avatar — the same face shown inside
          the menu, so the button says whose account this is before it's
          opened. Signed out there is no account to represent, so it stays a
          plain glyph. */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-105 ${
          auth.status === "authenticated"
            ? // The avatar draws its own rim; a second ring here just stacked
              // another circle on a slightly different radius.
              ""
            : `bg-white/10 text-slate-200 ring-1 ring-white/15 hover:bg-white/20 ${
                open ? "ring-2 ring-white/40" : ""
              }`
        }`}
        aria-label={s.menu.account}
        aria-expanded={open}
      >
        {auth.status === "authenticated" ? (
          <Avatar email={auth.email} isPro={isPro} size="sm" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Sized to the content rather than to the widest possible email:
              at w-72 with p-4 sections this panel covered most of the window
              on a small screen. `max-h` + scroll keeps the themes reachable
              without the panel ever running past the bottom edge. */}
          <div className="animate-card absolute right-0 z-50 mt-2 max-h-[calc(100vh-5rem)] w-60 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <AuthSection
              s={s}
              auth={auth}
              onAuthenticate={onAuthenticate}
              onLogout={onLogout}
              onResendVerification={onResendVerification}
              onForgotPassword={onForgotPassword}
            />

            <div className="border-b border-white/10 p-3">
              {isPro ? (
                /* Same reasoning as the sidebar card: a Pro subscriber should
                   see that they bought something, not the same grey line a
                   Free account gets. */
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 p-[1.5px]">
                  <div className="relative flex items-center gap-2 rounded-[10px] bg-slate-950/90 px-3 py-2.5">
                    <span className="pointer-events-none absolute -right-4 -top-4 h-14 w-14 rounded-full bg-amber-400/20 blur-2xl" />
                    <CrownIcon className="relative h-4 w-4 shrink-0 text-amber-300" />
                    <span className="relative text-sm font-black uppercase tracking-wider text-amber-300">
                      {s.menu.planPro}
                    </span>
                    <span className="relative ml-auto text-[10px] font-semibold uppercase tracking-wide text-amber-500/70">
                      {s.menu.plan}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {s.menu.plan}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-100">{s.menu.planFree}</span>
                    <button
                      onClick={() => {
                        setOpen(false);
                        onUpgrade();
                      }}
                      className="rounded-lg bg-gradient-to-r from-amber-300 to-yellow-500 px-3 py-1 text-xs font-bold text-amber-950 transition-transform hover:scale-105"
                    >
                      {s.menu.upgradeButton}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="border-b border-white/10 p-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {s.menu.language}
              </p>
              <div className="flex flex-col gap-0.5">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`rounded-lg px-2.5 py-1 text-left text-[13px] transition-colors ${
                      lang === l.code
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-white/10 p-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {s.menu.theme}
              </p>
              {/* Swatches only: with a dozen themes the labels forced a
                  two-column grid that dominated the panel. The color is the choice.

                  A fixed 7-column grid rather than flex-wrap, so the dots line
                  up in even columns instead of drifting with the panel width —
                  and 14 themes fill it exactly, leaving no orphan gaps. */}
              {/* 24px dots on a 7-column grid left only ~3px of clearance
                  either side inside this panel, so the selected dot's 2px ring
                  and the hover scale both spilled onto their neighbours. 20px
                  dots with a wider gap leave room for both. `ring-offset` keeps
                  the ring off the swatch itself rather than growing outwards. */}
              <div className="grid grid-cols-7 justify-items-center gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.code}
                    onClick={() => setTheme(t.code)}
                    title={t.label}
                    aria-label={t.label}
                    aria-pressed={theme === t.code}
                    className={`h-5 w-5 shrink-0 rounded-full transition-transform hover:scale-110 ${
                      theme === t.code
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
                        : "ring-1 ring-white/20"
                    }`}
                    style={{ background: t.swatch }}
                  />
                ))}
              </div>
            </div>

            <div className="border-b border-white/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {s.menu.errorReports}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {s.menu.errorReportsBody}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={errReports}
                  aria-label={s.menu.errorReports}
                  onClick={toggleErrorReports}
                  className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
                    errReports ? "bg-indigo-500" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                      errReports ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {s.menu.about}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.menu.aboutBody}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
