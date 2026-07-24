import React, { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { STRINGS, LANGUAGES, Lang, Strings, detectInitialLang, format } from "./i18n";
import { THEMES, ThemeName, detectInitialTheme } from "./theme";
import "./App.css";

// Set at build time once the backend (backend/, deployed to Railway per the
// project brief) is live: `VITE_API_BASE_URL=https://your-app.up.railway.app npm run build`.
// Until then, auth/checkout calls fail honestly instead of faking success.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

type AuthState =
  | { status: "anonymous" }
  | { status: "authenticated"; email: string; isPro: boolean; emailVerified: boolean };

type Category = "performance" | "privacy" | "ui" | "manutenzione" | "gaming";

type TweakInfo = {
  id: string;
  name: string;
  description: string;
  category: Category;
  hive: string;
  requires_admin: boolean;
  requires_pro: boolean;
  applied: boolean;
};

type CleanupInfo = {
  id: string;
  name: string;
  description: string;
  requires_admin: boolean;
  requires_pro: boolean;
};

type CleanupResult = {
  freed_bytes: number;
  deleted_count: number;
  skipped_count: number;
};

type DuplicateGroup = {
  size: number;
  paths: string[];
};

type Toast = {
  id: number;
  kind: "success" | "error";
  message: string;
};

const CATEGORY_STYLE: Record<Category, { icon: React.ReactElement; ring: string; chip: string }> = {
  performance: {
    ring: "from-amber-400/30 to-orange-500/10",
    chip: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  privacy: {
    ring: "from-emerald-400/30 to-teal-500/10",
    chip: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  ui: {
    ring: "from-fuchsia-400/30 to-purple-500/10",
    chip: "bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 21a9 9 0 1 1 0-18c4 0 8 2.5 8 6.5 0 2-1.5 3.5-3.5 3.5H15a1.7 1.7 0 0 0-1 3.1c.4.3.6.7.6 1.2 0 1-1 2-2.6 2.7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
        <circle cx="11" cy="7" r="1" fill="currentColor" />
        <circle cx="15.5" cy="9" r="1" fill="currentColor" />
      </svg>
    ),
  },
  manutenzione: {
    ring: "from-sky-400/30 to-cyan-500/10",
    chip: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  gaming: {
    ring: "from-rose-400/30 to-red-500/10",
    chip: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M6 8h4m-2-2v4M15.5 10h.01M18 12h.01M8 16h8a4 4 0 0 0 4-4v0a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v0a4 4 0 0 0 4 4Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function ShieldBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-400/30">
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
        <path
          d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}

function ProBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-2 py-0.5 text-[11px] font-bold text-amber-950">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
        <path d="m12 2 2.7 6.6L21 9l-5 4.5L17.3 21 12 17.3 6.7 21 8 13.5 3 9l6.3-.4Z" />
      </svg>
      {label}
    </span>
  );
}

function SoonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-300 ring-1 ring-white/20">
      {label}
    </span>
  );
}

function Toggle({
  checked,
  busy,
  onClick,
}: {
  checked: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-pressed={checked}
      className={`relative inline-flex h-8 w-14 shrink-0 appearance-none items-center rounded-full border-0 p-0
        outline-none transition-colors duration-300 ease-out disabled:cursor-wait
        ${checked ? "bg-emerald-500" : "bg-white/15"} `}
    >
      <span
        className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-out
          ${checked ? "translate-x-6" : "translate-x-0"}`}
      >
        {busy && (
          <svg
            className="absolute inset-0 m-auto h-4 w-4 animate-spin text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}

function PaywallModal({
  s,
  featureName,
  onClose,
  onNotify,
}: {
  s: Strings;
  featureName: string;
  onClose: () => void;
  onNotify: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="animate-card w-full max-w-sm rounded-2xl border border-amber-400/20 bg-slate-900 p-6 shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 shadow-lg shadow-amber-500/30">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
            <path d="m12 2 2.7 6.6L21 9l-5 4.5L17.3 21 12 17.3 6.7 21 8 13.5 3 9l6.3-.4Z" />
          </svg>
        </div>
        <h3 className="text-center text-lg font-bold text-slate-100">{s.paywall.title}</h3>
        <p className="mt-2 text-center text-sm text-slate-400">{format(s.paywall.body, { feature: featureName })}</p>
        <button
          onClick={onNotify}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 py-2.5 text-sm font-bold text-amber-950 transition-transform hover:scale-[1.02]"
        >
          {s.paywall.unlock}
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          {s.paywall.notNow}
        </button>
      </div>
    </div>
  );
}

function IpMaskCard({ s, onExplain }: { s: Strings; onExplain: () => void }) {
  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M9.5 12.5 11 14l3.5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-100">{s.ipMask.title}</h2>
            <SoonBadge label={s.badges.soon} />
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{s.ipMask.description}</p>
        </div>
        <button
          onClick={onExplain}
          className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition-transform hover:scale-[1.03]"
        >
          {s.ipMask.button}
        </button>
      </div>
    </li>
  );
}

function DuplicateFinder({
  s,
  isPro,
  onRequirePro,
  onToast,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
  onToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function scan() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    const folder = await openFolderDialog({ directory: true, multiple: false });
    if (!folder || typeof folder !== "string") return;
    setScanning(true);
    setGroups(null);
    setSelected(new Set());
    try {
      const result = await invoke<DuplicateGroup[]>("scan_duplicates", { root: folder });
      setGroups(result);
      if (result.length === 0) {
        onToast("success", s.duplicateFinder.noneFound);
      }
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setScanning(false);
    }
  }

  function toggleSelected(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function deleteSelected() {
    setDeleting(true);
    try {
      const result = await invoke<CleanupResult>("delete_files", { paths: Array.from(selected) });
      onToast(
        "success",
        format(s.duplicateFinder.deletedToast, { count: result.deleted_count, freed: formatBytes(result.freed_bytes) }),
      );
      setGroups((g) => g?.map((grp) => ({ ...grp, paths: grp.paths.filter((p) => !selected.has(p)) })).filter((g) => g.paths.length > 1) ?? null);
      setSelected(new Set());
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M8 4h8l4 4v12H8V4Zm-4 4h8v12H4V8Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-100">{s.duplicateFinder.title}</h2>
            <ProBadge label={s.badges.pro} />
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{s.duplicateFinder.description}</p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="shrink-0 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
        >
          {scanning ? s.duplicateFinder.scanning : s.duplicateFinder.chooseFolder}
        </button>
      </div>

      {groups && groups.length > 0 && (
        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto border-t border-white/10 pt-4">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-xl bg-black/20 p-3">
              <p className="mb-2 text-xs font-medium text-slate-400">
                {format(s.duplicateFinder.copies, { count: g.paths.length, size: formatBytes(g.size) })}
              </p>
              {g.paths.map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2 truncate py-0.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selected.has(p)}
                    onChange={() => toggleSelected(p)}
                    className="h-3.5 w-3.5 shrink-0 accent-sky-500"
                  />
                  <span className="truncate">{p}</span>
                </label>
              ))}
            </div>
          ))}
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0 || deleting}
            className="w-full rounded-xl bg-red-500/90 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {deleting ? s.duplicateFinder.deleting : format(s.duplicateFinder.moveSelected, { count: selected.size })}
          </button>
        </div>
      )}
    </li>
  );
}

function CleanupCard({
  s,
  info,
  text,
  busy,
  isPro,
  onRequirePro,
  onRun,
}: {
  s: Strings;
  info: CleanupInfo;
  text: { name: string; description: string };
  busy: boolean;
  isPro: boolean;
  onRequirePro: () => void;
  onRun: (info: CleanupInfo) => void;
}) {
  const style = CATEGORY_STYLE.manutenzione;
  const locked = info.requires_pro && !isPro;

  return (
    <li className="animate-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${style.ring}`} />
      <div className="relative flex items-center gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${style.chip}`}>{style.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-100">{text.name}</h2>
            {info.requires_admin && <ShieldBadge label={s.badges.admin} />}
            {info.requires_pro && <ProBadge label={s.badges.pro} />}
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{text.description}</p>
        </div>
        <button
          disabled={busy}
          onClick={() => (locked ? onRequirePro() : onRun(info))}
          className="shrink-0 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
        >
          {busy ? s.cleanupRunning : s.cleanupButton}
        </button>
      </div>
    </li>
  );
}

function AuthSection({
  s,
  auth,
  onAuthenticate,
  onLogout,
  onResendVerification,
  onForgotPassword,
}: {
  s: Strings;
  auth: AuthState;
  onAuthenticate: (mode: "login" | "register", email: string, password: string) => Promise<void>;
  onLogout: () => void;
  onResendVerification: () => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (auth.status === "authenticated") {
    return (
      <div className="border-b border-white/10 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.menu.account}</p>
        <p className="mb-2 truncate text-sm text-slate-300">{format(s.auth.loggedInAs, { email: auth.email })}</p>
        {!auth.emailVerified && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-amber-400/10 px-2 py-1.5">
            <span className="text-xs text-amber-300">{s.auth.emailNotVerified}</span>
            <button
              onClick={() => {
                setError(null);
                setInfo(null);
                onResendVerification()
                  .then(() => setInfo(s.auth.verificationSent))
                  .catch((err) => setError(String(err instanceof Error ? err.message : err)));
              }}
              className="shrink-0 text-xs font-semibold text-amber-300 underline hover:text-amber-200"
            >
              {s.auth.resendVerification}
            </button>
          </div>
        )}
        {info && <p className="mb-2 text-xs text-emerald-400">{info}</p>}
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        <button
          onClick={onLogout}
          className="w-full rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/15"
        >
          {s.auth.logout}
        </button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="border-b border-white/10 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.menu.account}</p>
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

    setWorking(true);
    try {
      // Safe: the "forgot" mode returns its own JSX earlier above, so this
      // code path only ever runs for "login" | "register".
      await onAuthenticate(mode as "login" | "register", email, password);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="border-b border-white/10 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.menu.account}</p>
      <form onSubmit={submit} className="flex flex-col gap-2">
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

function AccountMenu({
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
  onAuthenticate: (mode: "login" | "register", email: string, password: string) => Promise<void>;
  onLogout: () => void;
  onResendVerification: () => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isPro = auth.status === "authenticated" && auth.isPro;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-slate-200 ring-1 ring-white/15 transition-colors hover:bg-white/20"
        aria-label={s.menu.account}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="animate-card absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <AuthSection
              s={s}
              auth={auth}
              onAuthenticate={onAuthenticate}
              onLogout={onLogout}
              onResendVerification={onResendVerification}
              onForgotPassword={onForgotPassword}
            />

            <div className="border-b border-white/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.menu.plan}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">
                  {isPro ? s.menu.planPro : s.menu.planFree}
                </span>
                {!isPro && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onUpgrade();
                    }}
                    className="rounded-lg bg-gradient-to-r from-amber-300 to-yellow-500 px-3 py-1 text-xs font-bold text-amber-950"
                  >
                    {s.menu.upgradeButton}
                  </button>
                )}
              </div>
            </div>

            <div className="border-b border-white/10 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.menu.language}</p>
              <div className="flex flex-col gap-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                      lang === l.code ? "bg-indigo-500/20 text-indigo-300" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-white/10 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.menu.theme}</p>
              <div className="grid grid-cols-2 gap-1">
                {THEMES.map((t) => (
                  <button
                    key={t.code}
                    onClick={() => setTheme(t.code)}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      theme === t.code ? "bg-white/10 text-slate-100" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
                      style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }}
                    />
                    <span className="truncate">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.menu.about}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.menu.aboutBody}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
    const email = localStorage.getItem("pc-tweaker-email");
    const token = localStorage.getItem("pc-tweaker-token");
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
    const token = localStorage.getItem("pc-tweaker-token");
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
      setAuth({ status: "authenticated", email: data.email, isPro: data.isPro, emailVerified: data.emailVerified });
    } catch {
      // Network hiccup: keep whatever Pro status we already had rather than
      // dropping the user back to Free on a transient failure.
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
    localStorage.removeItem("pc-tweaker-email");
    localStorage.removeItem("pc-tweaker-token");
    setAuth({ status: "anonymous" });
  }

  async function authenticate(mode: "login" | "register", email: string, password: string) {
    if (!API_BASE_URL) {
      throw new Error(s.auth.backendNotConfigured);
    }
    const res = await fetch(`${API_BASE_URL}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { token: string };
    localStorage.setItem("pc-tweaker-token", data.token);
    localStorage.setItem("pc-tweaker-email", email);
    setAuth({ status: "authenticated", email, isPro: false, emailVerified: false });
    await refreshAccount();
  }

  async function resendVerification() {
    if (!API_BASE_URL) throw new Error(s.auth.backendNotConfigured);
    const token = localStorage.getItem("pc-tweaker-token");
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
  async function startCheckout() {
    if (!API_BASE_URL) {
      throw new Error(s.auth.backendNotConfigured);
    }
    const token = localStorage.getItem("pc-tweaker-token");
    if (!token) {
      throw new Error(s.auth.loginRequiredForCheckout);
    }
    const res = await fetch(`${API_BASE_URL}/api/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { url: string };
    await openUrl(data.url);
  }

  const CATEGORIES: { key: Category | "all"; label: string }[] = [
    { key: "all", label: s.tabs.all },
    { key: "performance", label: s.tabs.performance },
    { key: "privacy", label: s.tabs.privacy },
    { key: "ui", label: s.tabs.ui },
    { key: "gaming", label: s.tabs.gaming },
    { key: "manutenzione", label: s.tabs.manutenzione },
  ];

  const [tweaks, setTweaks] = useState<TweakInfo[]>([]);
  const [cleanupTargets, setCleanupTargets] = useState<CleanupInfo[]>([]);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState<CleanupInfo | null>(null);
  const toastSeq = useRef(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushToast(kind: Toast["kind"], message: string) {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }

  function textFor(dict: Record<string, { name: string; description: string }>, id: string, fallbackName: string, fallbackDescription: string) {
    return dict[id] ?? { name: fallbackName, description: fallbackDescription };
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
      pushToast("error", String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function runCleanup(info: CleanupInfo) {
    setBusyId(info.id);
    setConfirmCleanup(null);
    try {
      const result = await invoke<CleanupResult>("run_cleanup", { id: info.id });
      const base = format(s.cleanupResultToast, { deleted: result.deleted_count, freed: formatBytes(result.freed_bytes) });
      const suffix = result.skipped_count > 0 ? format(s.cleanupResultToastSkipped, { skipped: result.skipped_count }) : ".";
      pushToast("success", base + suffix);
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusyId(null);
    }
  }

  const visibleTweaks = useMemo(
    () => (filter === "all" ? tweaks : tweaks.filter((t) => t.category === filter)),
    [tweaks, filter],
  );

  const showCleanup = filter === "all" || filter === "manutenzione";
  const showPrivacyExtras = filter === "all" || filter === "privacy";
  const appliedCount = tweaks.filter((t) => t.applied).length;

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top,var(--app-bg-a),var(--app-bg-b)_60%)] px-8 py-10 text-slate-100 [font-family:var(--app-font)]"
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(to_bottom_right,var(--app-accent),var(--app-accent2))] text-slate-900 shadow-lg shadow-black/30">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M12 2 4 6v6c0 5 3.4 9 8 10 4.6-1 8-5 8-10V6l-8-4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {s.appName}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {format(s.appliedCount, { applied: appliedCount, total: tweaks.length })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <p className="hidden max-w-[15rem] text-right text-xs leading-relaxed text-slate-500 sm:block">
              {s.headerNote}
            </p>
            <AccountMenu
              s={s}
              lang={lang}
              setLang={setLang}
              theme={theme}
              setTheme={setTheme}
              auth={auth}
              onAuthenticate={authenticate}
              onLogout={logout}
              onResendVerification={resendVerification}
              onForgotPassword={forgotPassword}
              onUpgrade={() => setPaywallFeature(s.menu.planPro)}
            />
          </div>
        </header>

        <nav className="mb-6 flex gap-1 rounded-full bg-white/5 p-1 backdrop-blur">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200
                ${filter === c.key ? "text-white shadow" : "text-slate-400 hover:text-slate-100"}`}
              style={filter === c.key ? { backgroundColor: "var(--app-accent)" } : undefined}
            >
              {c.label}
            </button>
          ))}
        </nav>

        <ul className="flex flex-col gap-3">
          {visibleTweaks.map((t, i) => {
            const style = CATEGORY_STYLE[t.category];
            const text = textFor(s.tweaks, t.id, t.name, t.description);
            return (
              <li
                key={t.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`animate-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4
                  shadow-lg shadow-black/20 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06]`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${style.ring}`}
                />
                <div className="relative flex items-center gap-4">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${style.chip}`}>
                    {style.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-100">{text.name}</h2>
                      {t.hive !== "—" && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          {t.hive}
                        </span>
                      )}
                      {t.requires_admin && <ShieldBadge label={s.badges.admin} />}
                      {t.requires_pro && <ProBadge label={s.badges.pro} />}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-400">{text.description}</p>
                  </div>
                  <Toggle
                    checked={t.applied}
                    busy={busyId === t.id}
                    onClick={() => toggle(t)}
                  />
                </div>
              </li>
            );
          })}

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
                onRequirePro={() => setPaywallFeature(textFor(s.cleanup, c.id, c.name, c.description).name)}
                onRun={(info) => setConfirmCleanup(info)}
              />
            ))}

          {showCleanup && (
            <DuplicateFinder
              s={s}
              isPro={isProUnlocked}
              onRequirePro={() => setPaywallFeature(s.duplicateFinder.title)}
              onToast={pushToast}
            />
          )}

          {visibleTweaks.length === 0 && !showCleanup && !showPrivacyExtras && (
            <li className="animate-card rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
              {s.emptyCategory}
            </li>
          )}
        </ul>
      </div>

      {confirmCleanup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="animate-card w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">{s.cleanupConfirm.title}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {format(s.cleanupConfirm.body, { name: textFor(s.cleanup, confirmCleanup.id, confirmCleanup.name, confirmCleanup.description).name })}
            </p>
            <button
              onClick={() => runCleanup(confirmCleanup)}
              className="mt-5 w-full rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white"
            >
              {s.cleanupConfirm.confirm}
            </button>
            <button
              onClick={() => setConfirmCleanup(null)}
              className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            >
              {s.cleanupConfirm.cancel}
            </button>
          </div>
        </div>
      )}

      {paywallFeature && (
        <PaywallModal
          s={s}
          featureName={paywallFeature}
          onClose={() => setPaywallFeature(null)}
          onNotify={async () => {
            setPaywallFeature(null);
            try {
              await startCheckout();
            } catch (e) {
              pushToast("error", String(e instanceof Error ? e.message : e));
            }
          }}
        />
      )}

      <div className="pointer-events-none fixed bottom-6 right-6 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl backdrop-blur
              ${
                t.kind === "success"
                  ? "bg-emerald-500/90 text-emerald-950"
                  : "bg-red-500/90 text-red-950"
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
