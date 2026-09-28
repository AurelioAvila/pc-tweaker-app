import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { LANGUAGES, Lang, Strings } from "../i18n";
import { THEMES, ThemeName } from "../theme";
import {
  ERROR_REPORTS_KEY,
  errorReportsEnabled,
  fileToAvatarDataUrl,
  readAvatar,
  removeAvatar,
  writeAvatar,
} from "../lib";
import { AuthState } from "../types";
import { CheckIcon, CrownIcon } from "./icons";
import { Avatar } from "./ui";
import "./account-menu.css";

export function AuthSection({
  s,
  auth,
  avatar = null,
  onChangePhoto,
  onRemovePhoto,
  onAuthenticate,
  onLogout,
  onResendVerification,
  onForgotPassword,
}: {
  s: Strings;
  auth: AuthState;
  /** Device-local profile photo and its controls, owned by AccountMenu. */
  avatar?: string | null;
  onChangePhoto?: () => void;
  onRemovePhoto?: () => void | Promise<void>;
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
      <div className="relative overflow-hidden border-b border-line p-3.5">
        {/* A wash of the active theme behind the account block, so the top of
            the menu reads as a header rather than as the first grey row of a
            list. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-20 blur-2xl"
          style={{ background: auth.isPro ? "#fbbf24" : "var(--app-accent)" }}
        />
        <div className="relative flex items-center gap-3">
          {/* Clicking the avatar itself opens the photo picker — the picture
              is the control, no extra row of buttons needed for the happy
              path. The photo stays on this device only. */}
          <button
            type="button"
            onClick={onChangePhoto}
            title={s.menu.changePhoto}
            aria-label={s.menu.changePhoto}
            className="group relative shrink-0 rounded-full transition-transform hover:scale-105"
          >
            <Avatar email={auth.email} isPro={auth.isPro} photo={avatar} />
            <span className="pointer-events-none absolute inset-[2px] grid place-items-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
                <path
                  d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-8Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink" title={auth.email}>
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
        {avatar && (
          <button
            onClick={onRemovePhoto}
            className="mt-2 w-full text-left text-[11px] font-medium text-ink-3 transition-colors hover:text-ink-2"
          >
            {s.menu.removePhoto}
          </button>
        )}
        <button
          onClick={onLogout}
          className="mt-2 w-full rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink-2"
        >
          {s.auth.logout}
        </button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="border-b border-line p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
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
            className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-[var(--app-accent)]"
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
            className="text-xs text-ink-3 hover:text-ink-2"
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
    <div className="border-b border-line p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
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
              className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-[var(--app-accent)]"
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={s.auth.lastName}
              className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-[var(--app-accent)]"
            />
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-[var(--app-accent)]"
            />
          </>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={s.auth.email}
          className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-[var(--app-accent)]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={s.auth.password}
          className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-[var(--app-accent)]"
        />
        {mode === "login" && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-3 select-none">
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
            className="text-xs text-ink-3 hover:text-ink-2"
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
          className="text-xs text-ink-3 hover:text-ink-2"
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
  open: openProp,
  onOpenChange,
  onAuthenticate,
  onLogout,
  onResendVerification,
  onForgotPassword,
  onUpgrade,
  onViewPlan,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  auth: AuthState;
  /** Lets a caller elsewhere in the tree (e.g. "sign in to save this")
   *  force the menu open. Falls back to purely internal state when omitted,
   *  so every other existing call site keeps working unchanged. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  /** Opens the plans screen. Same destination for both tiers: a Free
   *  account is comparing, a Pro account is checking what it pays for. */
  onViewPlan: () => void;
  pushToast: (kind: "success" | "error", message: string) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(open) : v;
    onOpenChange?.(next);
    setInternalOpen(next);
  };
  const [errReports, setErrReports] = useState(() => errorReportsEnabled());
  const isPro = auth.status === "authenticated" && auth.isPro;

  // Device-local profile photo, kept as a file by the Rust side; there is no
  // upload — see fileToAvatarDataUrl in lib.ts and src-tauri/src/avatar.rs.
  // Loaded in an effect rather than a useState initializer because reading it
  // is async, and reloaded whenever the signed-in account changes.
  // Stored together with the address it was loaded for, and only rendered
  // when the two still agree. Holding the photo alone was half of the bug
  // where a new account wore the previous one's face: even once the files
  // were separated, the picture already in memory stayed on screen across a
  // sign-out and the next sign-in.
  const [loadedAvatar, setLoadedAvatar] = useState<{
    email: string;
    photo: string | null;
  } | null>(null);
  const signedInAs = auth.status === "authenticated" ? auth.email : null;
  const avatar = loadedAvatar && loadedAvatar.email === signedInAs ? loadedAvatar.photo : null;
  const photoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!signedInAs) return;
    let alive = true;
    void readAvatar(signedInAs).then((photo) => {
      if (alive) setLoadedAvatar({ email: signedInAs, photo });
    });
    return () => {
      alive = false;
    };
  }, [signedInAs]);

  async function onPhotoPicked(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      // Persist before showing it. The old order set state first and swallowed
      // a failed write, so a photo that never made it to disk still appeared
      // to have been saved until the next launch proved otherwise.
      if (!signedInAs) return;
      await writeAvatar(signedInAs, dataUrl);
      setLoadedAvatar({ email: signedInAs, photo: dataUrl });
    } catch {
      // Not an image, or the browser refused to decode it: keep whatever was
      // there before, but say so - a picker that silently does nothing on
      // failure is indistinguishable from a picker that is simply broken.
      // The thrown error's own message is internal/English and not meant for
      // display, so the toast always uses the translated string instead.
      pushToast("error", s.menu.photoFailed);
    }
  }

  async function removePhoto() {
    try {
      if (!signedInAs) return;
      await removeAvatar(signedInAs);
      setLoadedAvatar({ email: signedInAs, photo: null });
    } catch {
      pushToast("error", s.menu.photoFailed);
    }
  }

  function toggleErrorReports() {
    const next = !errReports;
    setErrReports(next);
    localStorage.setItem(ERROR_REPORTS_KEY, next ? "on" : "off");
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
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
            : `bg-surface-2 text-ink-2 ring-1 ring-line-2 hover:bg-surface-hover ${
                open ? "ring-2 ring-white/40" : ""
              }`
        }`}
        aria-label={s.menu.account}
        aria-expanded={open}
      >
        {auth.status === "authenticated" ? (
          <Avatar email={auth.email} isPro={isPro} photo={avatar} size="sm" />
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
          <div className="account-panel animate-card absolute right-0 z-50 mt-2 max-h-[calc(100vh-9rem)] overflow-y-auto overflow-x-hidden">
            <details name="account-settings" className="account-setting account-identity">
              <summary>
                <span>
                  {s.menu.account}
                  <small>{signedInAs || s.auth.loginButton}</small>
                </span>
                <span className="account-chevron" aria-hidden="true">
                  ›
                </span>
              </summary>
              <div className="account-setting-body">
                <AuthSection
                  s={s}
                  auth={auth}
                  avatar={avatar}
                  onChangePhoto={() => photoInput.current?.click()}
                  onRemovePhoto={removePhoto}
                  onAuthenticate={onAuthenticate}
                  onLogout={onLogout}
                  onResendVerification={onResendVerification}
                  onForgotPassword={onForgotPassword}
                />
              </div>
            </details>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onPhotoPicked(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="account-plan-row">
              <span>
                <CrownIcon className="h-4 w-4" />
                {isPro ? s.menu.planPro : s.menu.planFree}
              </span>
              <button
                onClick={() => {
                  setOpen(false);
                  if (isPro) onViewPlan();
                  else onUpgrade();
                }}
              >
                {isPro ? s.menu.viewPlan : s.menu.upgradeButton} <span aria-hidden="true">↗</span>
              </button>
            </div>
            <details name="account-settings" className="account-setting">
              <summary>
                <span>{s.menu.language}</span>
                <span className="account-current">
                  {LANGUAGES.find((l) => l.code === lang)?.native}
                </span>
                <span className="account-chevron" aria-hidden="true">
                  ›
                </span>
              </summary>
              <div className="account-setting-body account-languages">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    className="account-language"
                    aria-pressed={lang === l.code}
                    onClick={(e) => {
                      setLang(l.code);
                      e.currentTarget.closest("details")?.removeAttribute("open");
                      e.currentTarget.closest("details")?.querySelector("summary")?.focus();
                    }}
                  >
                    {l.native}
                    {lang === l.code && <CheckIcon className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </details>
            <details name="account-settings" className="account-setting">
              <summary>
                <span>{s.menu.theme}</span>
                <span className="account-current">
                  <i style={{ background: THEMES.find((t) => t.code === theme)?.swatch }} />
                  {THEMES.find((t) => t.code === theme)?.label}
                </span>
                <span className="account-chevron" aria-hidden="true">
                  ›
                </span>
              </summary>
              <div className="account-setting-body account-theme-options">
                {THEMES.map((t) => (
                  <button
                    key={t.code}
                    className="account-theme-option"
                    aria-pressed={theme === t.code}
                    onClick={(e) => {
                      setTheme(t.code);
                      e.currentTarget.closest("details")?.removeAttribute("open");
                      e.currentTarget.closest("details")?.querySelector("summary")?.focus();
                    }}
                  >
                    <i style={{ background: t.swatch }} />
                    <span>{t.label}</span>
                    {theme === t.code && <CheckIcon className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </details>
            <details name="account-settings" className="account-setting">
              <summary>
                <span>{s.menu.errorReports}</span>
                <span className="account-chevron" aria-hidden="true">
                  ›
                </span>
              </summary>
              <div className="account-setting-body account-privacy">
                <p>{s.menu.errorReportsBody}</p>
                <button
                  role="switch"
                  aria-checked={errReports}
                  aria-label={s.menu.errorReports}
                  onClick={toggleErrorReports}
                  className="account-switch"
                >
                  <span />
                </button>
              </div>
            </details>
            <button
              className="account-support"
              onClick={() => void openUrl("https://pctweaker.app/support")}
            >
              {s.menu.reportIssue}
              <span aria-hidden="true">↗</span>
            </button>
            <details name="account-settings" className="account-setting">
              <summary>
                <span>{s.menu.about}</span>
                <span className="account-chevron" aria-hidden="true">
                  ›
                </span>
              </summary>
              <div className="account-setting-body">
                <p>{s.menu.aboutBody}</p>
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
