import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
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

/** Navigable sections: the tweak categories plus the two standalone screens. */
type Section = Category | "scan" | "startup" | "pricing";

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

/**
 * Resolves a tweak/cleanup id to its translated name and description, falling
 * back to the English text the Rust side ships with when a locale is missing
 * the id. Module-level so every screen resolves text the same way — the Scan
 * list used to read `tweak.name` directly and so showed English rows inside a
 * translated UI.
 */
function textFor(
  dict: Record<string, { name: string; description: string }>,
  id: string,
  fallbackName: string,
  fallbackDescription: string,
): { name: string; description: string } {
  return dict[id] ?? { name: fallbackName, description: fallbackDescription };
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
  onAuthenticate: (
    mode: "login" | "register",
    email: string,
    password: string,
    registerDetails?: { firstName: string; lastName: string; dateOfBirth: string },
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
      );
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
  onAuthenticate: (
    mode: "login" | "register",
    email: string,
    password: string,
    registerDetails?: { firstName: string; lastName: string; dateOfBirth: string },
  ) => Promise<void>;
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

type GameEntry = { path: string; name: string };

function GameSessionsPanel({
  s,
  isPro,
  onRequirePro,
}: {
  s: Strings;
  isPro: boolean;
  onRequirePro: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [games, setGames] = useState<GameEntry[]>([]);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function refresh() {
    const [e, list] = await Promise.all([
      invoke<boolean>("game_sessions_enabled"),
      invoke<GameEntry[]>("list_game_sessions"),
    ]);
    setEnabled(e);
    setGames(list);
  }

  useEffect(() => {
    refresh().catch(() => {});
    const unlisten = listen<{ active: boolean; name: string | null }>("game-session-changed", (event) => {
      setActiveGame(event.payload.active ? event.payload.name : null);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleEnabled() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    const next = !enabled;
    await invoke("set_game_sessions_enabled", { enabled: next });
    setEnabled(next);
  }

  async function addGame() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    const path = await openFolderDialog({
      multiple: false,
      filters: [{ name: "Eseguibile", extensions: ["exe"] }],
    });
    if (!path || Array.isArray(path)) return;
    await invoke("add_game_session", { path });
    await refresh();
  }

  async function removeGame(path: string) {
    await invoke("remove_game_session", { path });
    await refresh();
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            {s.gameSessions.title}
            <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-2 py-0.5 text-[10px] font-bold text-amber-950">
              PRO
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {activeGame ? format(s.gameSessions.active, { name: activeGame }) : s.gameSessions.subtitle}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggleEnabled}
          className={`relative inline-flex h-8 w-14 shrink-0 appearance-none items-center rounded-full border-0 p-0
            outline-none transition-colors duration-300 ease-out ${enabled ? "" : "bg-white/15"}`}
          style={enabled ? { backgroundColor: "var(--app-accent)" } : undefined}
        >
          <span
            className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${enabled ? "translate-x-6" : "translate-x-0"}`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            {format(s.gameSessions.gamesCount, { count: games.length })} {expanded ? "▲" : "▼"}
          </button>
          {expanded && (
            <div className="mt-2 flex flex-col gap-1.5">
              {games.map((g) => (
                <div key={g.path} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs">
                  <span className="truncate text-slate-300">{g.name}</span>
                  <button onClick={() => removeGame(g.path)} className="shrink-0 text-slate-500 hover:text-red-400">
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addGame}
                className="mt-1 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-white/30 hover:text-slate-200"
              >
                {s.gameSessions.addGame}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Lightning-bolt icon shared by the Turbo Boost panel. */
function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  );
}

/**
 * Dedicated Turbo Boost card (Gaming tab only) instead of a plain toggle row —
 * this is the app's most visually "gamer" preset, so it gets its own eye
 * candy: a spinning conic-gradient glow and a pulsing bolt icon while the
 * apply/rollback call is in flight.
 */
function TurboBoostPanel({
  s,
  applied,
  onChanged,
  pushToast,
}: {
  s: Strings;
  applied: boolean;
  onChanged: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggleTurbo() {
    setBusy(true);
    try {
      if (applied) {
        await invoke("rollback_tweak", { id: "turbo_boost" });
        pushToast("success", format(s.toasts.rolledBack, { name: s.turboBoost.title }));
      } else {
        await invoke("apply_tweak", { id: "turbo_boost" });
        pushToast("success", format(s.toasts.applied, { name: s.turboBoost.title }));
      }
      await onChanged();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = busy
    ? applied
      ? s.turboBoost.deactivating
      : s.turboBoost.activating
    : applied
      ? s.turboBoost.active
      : s.turboBoost.inactive;

  return (
    <div className="mb-6 flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-8">
      <h2 className="text-lg font-semibold text-slate-100">{s.turboBoost.title}</h2>
      <p className="mt-1 max-w-xs text-center text-sm text-slate-400">{s.turboBoost.subtitle}</p>

      <button
        onClick={toggleTurbo}
        disabled={busy}
        className="group relative mt-6 grid h-40 w-40 shrink-0 place-items-center rounded-full outline-none disabled:cursor-wait"
      >
        {busy && (
          <>
            <span className="absolute inset-0 rounded-full bg-orange-400/25 [animation:ping_1.6s_ease-out_infinite]" />
            <span className="absolute inset-0 rounded-full bg-orange-400/20 [animation:ping_1.6s_ease-out_infinite] [animation-delay:400ms]" />
          </>
        )}
        <span
          className={`absolute inset-0 rounded-full bg-gradient-to-br transition-all duration-500 ${
            applied
              ? "from-orange-400 to-red-500 shadow-[0_0_45px_rgba(251,146,60,0.55)]"
              : "from-white/15 to-white/5 shadow-inner group-hover:from-white/20"
          }`}
        />
        <span className="relative flex flex-col items-center gap-1.5 text-white">
          <BoltIcon className={`h-9 w-9 ${busy ? "animate-pulse" : ""}`} />
          <span className="text-base font-black tracking-wider">
            {busy ? "···" : applied ? s.turboBoost.stopLabel : s.turboBoost.startLabel}
          </span>
        </span>
      </button>

      <p
        className={`mt-4 text-sm font-medium ${
          busy ? "text-orange-300" : applied ? "text-orange-300" : "text-slate-500"
        }`}
      >
        {statusLabel}
      </p>
    </div>
  );
}

function MagnifierIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ScanIssue = {
  kind: "tweak" | "cleanup";
  id: string;
  name: string;
  description: string;
};

/**
 * "Scan for problems, fix them with one click" landing screen — same idea as
 * the scan/fix flow in tools like Advanced SystemCare, but grounded in this
 * app's own real data: the "problems" it finds are simply this PC's
 * not-yet-applied free tweaks and pending temp-file cleanup, nothing
 * fabricated. The staged reveal during "scanning" is cosmetic pacing over
 * data that's already loaded, not a fake progress bar over fake work.
 */
function ScanPanel({
  s,
  tweaks,
  cleanupTargets,
  isPro,
  onRequirePro,
  onFixed,
  pushToast,
}: {
  s: Strings;
  tweaks: TweakInfo[];
  cleanupTargets: CleanupInfo[];
  isPro: boolean;
  onRequirePro: () => void;
  onFixed: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "results" | "done">("idle");
  const [scanPct, setScanPct] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [fixing, setFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [fixedCount, setFixedCount] = useState(0);
  const scanTimer = useRef<number | null>(null);

  const SCAN_DURATION_MS = 4200;
  const scanStep = Math.min(4, Math.floor((scanPct / 100) * 4));

  const steps = [s.scan.stepPerformance, s.scan.stepPrivacy, s.scan.stepGaming, s.scan.stepJunk];

  // Fixable now = anything the user can actually apply today: every free
  // tweak/cleanup, plus Pro ones too once they're unlocked. Locked = Pro
  // items only shown as an upsell when the account isn't Pro yet.
  // Names/descriptions go through `textFor` so this list is translated like
  // the rest of the UI instead of showing the raw English text from Rust.
  const fixableIssues: ScanIssue[] = useMemo(() => {
    const fromTweaks = tweaks
      .filter((t) => !t.applied && (isPro || !t.requires_pro) && t.id !== "turbo_boost")
      .map((t) => ({ kind: "tweak" as const, id: t.id, ...textFor(s.tweaks, t.id, t.name, t.description) }));
    const fromCleanup = cleanupTargets
      .filter((c) => isPro || !c.requires_pro)
      .map((c) => ({ kind: "cleanup" as const, id: c.id, ...textFor(s.cleanup, c.id, c.name, c.description) }));
    return [...fromTweaks, ...fromCleanup];
  }, [tweaks, cleanupTargets, isPro, s]);

  const lockedIssues = useMemo(
    () =>
      isPro
        ? []
        : tweaks
            .filter((t) => !t.applied && t.requires_pro)
            .map((t) => ({ id: t.id, ...textFor(s.tweaks, t.id, t.name, t.description) })),
    [tweaks, isPro, s],
  );

  useEffect(() => {
    return () => {
      if (scanTimer.current) window.clearInterval(scanTimer.current);
    };
  }, []);

  function startScan() {
    setPhase("scanning");
    setScanPct(0);
    const start = performance.now();
    scanTimer.current = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / SCAN_DURATION_MS) * 100));
      setScanPct(pct);
      if (pct >= 100) {
        if (scanTimer.current) window.clearInterval(scanTimer.current);
        const initialChecked: Record<string, boolean> = {};
        fixableIssues.forEach((issue) => {
          initialChecked[issue.id] = true;
        });
        setChecked(initialChecked);
        setPhase("results");
      }
    }, 60);
  }

  async function fixAll() {
    const toFix = fixableIssues.filter((issue) => checked[issue.id]);
    if (toFix.length === 0) return;
    setFixing(true);
    setFixProgress(0);

    const tweakIds = toFix.filter((i) => i.kind === "tweak").map((i) => i.id);
    const cleanupIds = toFix.filter((i) => i.kind === "cleanup").map((i) => i.id);
    let failed = 0;

    try {
      if (tweakIds.length > 0) {
        // Single call: the backend groups every admin-level tweak behind one
        // UAC prompt instead of one prompt per tweak.
        const failures = await invoke<string[]>("apply_tweaks", { ids: tweakIds });
        failed += failures.length;
        failures.forEach((f) => pushToast("error", f));
        setFixProgress(tweakIds.length);
      }
    } catch (e) {
      failed += tweakIds.length;
      pushToast("error", String(e));
    }

    for (let i = 0; i < cleanupIds.length; i++) {
      try {
        await invoke("run_cleanup", { id: cleanupIds[i] });
      } catch (e) {
        failed += 1;
        pushToast("error", String(e));
      }
      setFixProgress(tweakIds.length + i + 1);
    }

    await onFixed();
    setFixing(false);
    const fixed = toFix.length - failed;
    setFixedCount(fixed);
    // Land on an explicit "Done!" screen rather than dropping the user back
    // into a half-empty checklist: the result of the click is then unmistakable.
    setPhase("done");
    if (fixed > 0) pushToast("success", format(s.scan.fixedToast, { count: fixed }));
  }

  const totalIssues = fixableIssues.length + lockedIssues.length;
  const checkedCount = fixableIssues.filter((i) => checked[i.id]).length;

  return (
    <div className="mb-6 flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-8">
      <h2 className="text-lg font-semibold text-slate-100">{s.scan.title}</h2>
      <p className="mt-1 max-w-sm text-center text-sm text-slate-400">{s.scan.subtitle}</p>

      {phase === "idle" && (
        <button
          onClick={startScan}
          className="group relative mt-6 grid h-40 w-40 place-items-center rounded-full outline-none"
        >
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-[0_0_45px_rgba(217,70,239,0.45)] transition-transform duration-300 group-hover:scale-105" />
          <span className="relative flex flex-col items-center gap-1.5 text-white">
            <MagnifierIcon className="h-9 w-9" />
            <span className="text-base font-black tracking-wider">{s.scan.startLabel}</span>
          </span>
        </button>
      )}

      {phase === "scanning" && (
        <>
          <div className="relative mt-6 grid h-40 w-40 place-items-center">
            <span className="absolute inset-0 rounded-full border-4 border-white/10" />
            <span
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-fuchsia-400 border-r-indigo-400 transition-[transform] duration-75 ease-linear"
              style={{ transform: `rotate(${scanPct * 3.6}deg)` }}
            />
            <div className="relative flex flex-col items-center gap-1 text-fuchsia-300">
              <MagnifierIcon className="h-7 w-7 animate-pulse" />
              <span className="text-2xl font-black tabular-nums text-white">{scanPct}%</span>
            </div>
          </div>
          <ul className="mt-5 flex flex-col gap-1.5 text-sm">
            {steps.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2 transition-opacity duration-300 ${
                  i < scanStep ? "text-emerald-300 opacity-100" : "text-slate-500 opacity-40"
                }`}
              >
                <span className="w-4">{i < scanStep ? "✓" : "…"}</span>
                {label}
              </li>
            ))}
          </ul>
        </>
      )}

      {phase === "done" && (
        <div className="animate-card mt-6 flex w-full flex-col items-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-4xl text-emerald-300 ring-4 ring-emerald-400/20">
            ✓
          </span>
          <p className="mt-4 text-xl font-black tracking-tight text-emerald-300">{s.scan.doneTitle}</p>
          <p className="mt-1 text-center text-sm text-slate-400">
            {format(s.scan.doneBody, { count: fixedCount })}
          </p>
          <button
            onClick={() => {
              setFixedCount(0);
              setPhase("idle");
            }}
            className="mt-5 rounded-xl bg-white/10 px-5 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/15"
          >
            {s.scan.scanAgain}
          </button>
        </div>
      )}

      {phase === "results" && (
        <div className="mt-6 w-full">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${
                totalIssues === 0 ? "bg-emerald-400/20 text-emerald-300" : "bg-amber-400/20 text-amber-300"
              }`}
            >
              {totalIssues === 0 ? "✓" : totalIssues}
            </span>
            <p className={`text-sm font-semibold ${totalIssues === 0 ? "text-emerald-400" : "text-amber-300"}`}>
              {totalIssues === 0 ? s.scan.allGood : format(s.scan.issuesFound, { count: totalIssues })}
            </p>
          </div>

          {fixableIssues.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* The primary action sits above the list: after a scan the user
                  wants to act, not to scroll a checklist to find the button. */}
              <button
                onClick={fixAll}
                disabled={fixing || checkedCount === 0}
                className="relative overflow-hidden rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-[1.01] disabled:cursor-wait disabled:opacity-50"
              >
                {fixing && (
                  <span
                    className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-300"
                    style={{ width: `${(fixProgress / Math.max(1, checkedCount)) * 100}%` }}
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {fixing && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  {fixing ? format(s.scan.fixing, { done: fixProgress, total: checkedCount }) : s.scan.fixAll}
                </span>
              </button>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.scan.fixHeading}</p>
                <button
                  onClick={() => {
                    const allChecked = fixableIssues.every((i) => checked[i.id]);
                    const next: Record<string, boolean> = {};
                    fixableIssues.forEach((i) => {
                      next[i.id] = !allChecked;
                    });
                    setChecked(next);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  {fixableIssues.every((i) => checked[i.id]) ? s.scan.deselectAll : s.scan.selectAll}
                </button>
              </div>

              {fixableIssues.map((issue) => (
                <label
                  key={issue.id}
                  className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm transition-colors hover:bg-white/[0.07]"
                >
                  <input
                    type="checkbox"
                    checked={checked[issue.id] ?? true}
                    onChange={(e) => setChecked((c) => ({ ...c, [issue.id]: e.target.checked }))}
                    className="mt-1 accent-fuchsia-500"
                  />
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                      issue.kind === "cleanup" ? "bg-sky-400/15 text-sky-300" : "bg-fuchsia-400/15 text-fuchsia-300"
                    }`}
                  >
                    {issue.kind === "cleanup" ? <TrashIcon className="h-3.5 w-3.5" /> : <BoltIcon className="h-3.5 w-3.5" />}
                  </span>
                  <span>
                    <span className="font-medium text-slate-100">{issue.name}</span>
                    <p className="text-xs text-slate-400">{issue.description}</p>
                  </span>
                </label>
              ))}
            </div>
          )}

          {lockedIssues.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
              <p className="mb-2 text-xs font-semibold text-amber-300">{s.scan.proIssuesTitle}</p>
              <ul className="mb-3 flex flex-col gap-1 text-xs text-slate-400">
                {lockedIssues.map((issue) => (
                  <li key={issue.id}>• {issue.name}</li>
                ))}
              </ul>
              <button
                onClick={onRequirePro}
                className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/30"
              >
                {s.scan.unlockPro}
              </button>
            </div>
          )}

          <button
            onClick={() => setPhase("idle")}
            className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-300"
          >
            {s.scan.scanAgain}
          </button>
        </div>
      )}
    </div>
  );
}

/** SHA-1 hex digest via the Web Crypto API already available in the webview. */
async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Checks a password against Have I Been Pwned's Pwned Passwords range API
 * using k-anonymity: only the first 5 hex chars of the SHA-1 hash ever leave
 * the device, never the password itself or its full hash.
 */
function PasswordBreachCheck({ s }: { s: Strings }) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ kind: "safe" | "breached" | "error"; count?: number } | null>(null);

  async function check() {
    if (!password) return;
    setChecking(true);
    setResult(null);
    try {
      const hash = await sha1Hex(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      const match = body.split("\n").find((line) => line.startsWith(suffix));
      if (match) {
        const count = parseInt(match.split(":")[1]?.trim() ?? "0", 10);
        setResult({ kind: "breached", count });
      } else {
        setResult({ kind: "safe" });
      }
    } catch {
      setResult({ kind: "error" });
    } finally {
      setChecking(false);
    }
  }

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-100">{s.passwordCheck.title}</h2>
          <p className="mt-0.5 text-sm text-slate-400">{s.passwordCheck.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setResult(null);
              }}
              placeholder={s.passwordCheck.placeholder}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
            />
            <button
              onClick={check}
              disabled={checking || !password}
              className="shrink-0 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
            >
              {checking ? s.passwordCheck.checking : s.passwordCheck.button}
            </button>
          </div>
          {result && (
            <p
              className={`mt-2 text-sm font-medium ${
                result.kind === "safe" ? "text-emerald-400" : result.kind === "breached" ? "text-rose-400" : "text-slate-400"
              }`}
            >
              {result.kind === "safe"
                ? s.passwordCheck.safe
                : result.kind === "breached"
                  ? format(s.passwordCheck.breached, { count: result.count ?? 0 })
                  : s.passwordCheck.error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

type SystemStats = {
  cpu_usage: number;
  cpu_name: string;
  cpu_cores: number;
  ram_used: number;
  ram_total: number;
  disk_used: number;
  disk_total: number;
  os_name: string;
  uptime_secs: number;
};

/** "12.4 / 31.1 GB" — one unit shown once, so it fits next to the gauge. */
function gbPair(used: number, total: number): string {
  const gb = (n: number) => (n / 1024 ** 3).toFixed(1);
  return `${gb(used)} / ${gb(total)} GB`;
}

/** Green under light load, amber when it starts to matter, red when it hurts. */
function loadColor(pct: number): string {
  if (pct >= 85) return "#f87171";
  if (pct >= 60) return "#fbbf24";
  return "#34d399";
}

function StatRing({ label, sublabel, pct }: { label: string; sublabel: string; pct: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-white/10" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            stroke={loadColor(clamped)}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * clamped) / 100}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-slate-100">
          {Math.round(clamped)}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">{label}</p>
        <p className="truncate text-xs text-slate-500" title={sublabel}>
          {sublabel}
        </p>
      </div>
    </div>
  );
}

/**
 * Live snapshot of the machine, polled from the Rust side. Every number here
 * is read from the real system (sysinfo) — no synthetic "health score".
 */
function SystemMonitor({ s }: { s: Strings }) {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      invoke<SystemStats>("system_stats")
        .then((v) => {
          // The backend call takes ~200ms (it needs two CPU samples), so the
          // component can unmount mid-flight — don't set state after that.
          if (alive) setStats(v);
        })
        .catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!stats) {
    return <div className="mb-6 h-[104px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />;
  }

  const ramPct = stats.ram_total > 0 ? (stats.ram_used / stats.ram_total) * 100 : 0;
  const diskPct = stats.disk_total > 0 ? (stats.disk_used / stats.disk_total) * 100 : 0;
  const hours = Math.floor(stats.uptime_secs / 3600);
  const minutes = Math.floor((stats.uptime_secs % 3600) / 60);

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
      <div className="grid gap-5 sm:grid-cols-3">
        <StatRing
          label={s.systemMonitor.cpu}
          sublabel={format(s.systemMonitor.cores, { count: stats.cpu_cores })}
          pct={stats.cpu_usage}
        />
        <StatRing label={s.systemMonitor.ram} sublabel={gbPair(stats.ram_used, stats.ram_total)} pct={ramPct} />
        <StatRing label={s.systemMonitor.disk} sublabel={gbPair(stats.disk_used, stats.disk_total)} pct={diskPct} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 pt-3 text-xs text-slate-500">
        <span className="truncate" title={stats.cpu_name}>
          {stats.cpu_name}
        </span>
        <span className="text-slate-700">•</span>
        <span>{stats.os_name}</span>
        <span className="text-slate-700">•</span>
        <span>
          {s.systemMonitor.uptime} {format(s.systemMonitor.uptimeValue, { hours, minutes })}
        </span>
      </div>
    </div>
  );
}

type RamCleanResult = {
  freed_bytes: number;
  trimmed_processes: number;
  skipped_processes: number;
  ram_used_before: number;
  ram_used_after: number;
  ram_total: number;
};

/** Auto-cleanup choices, in minutes. `0` means "off". */
const RAM_AUTO_INTERVALS = [0, 10, 30, 60, 180, 360] as const;

function ramIntervalLabel(minutes: number, s: Strings): string {
  if (minutes === 0) return s.ram.autoOff;
  const text = minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
  return format(s.ram.autoEvery, { interval: text });
}

/**
 * Asks Windows to page out the unused part of every process's working set —
 * the same thing Windows does on its own under memory pressure, just requested
 * early. Safe to run repeatedly, which is why it can also be scheduled.
 */
function RamCleaner({
  s,
  pushToast,
}: {
  s: Strings;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<RamCleanResult | null>(null);
  const [autoMinutes, setAutoMinutes] = useState<number>(() => {
    const stored = Number(localStorage.getItem("pc-tweaker-ram-auto"));
    // Only honor a value we actually offer: a hand-edited or stale entry must
    // not turn into a rogue interval (or a 0ms one, which would spin the CPU).
    return (RAM_AUTO_INTERVALS as readonly number[]).includes(stored) ? stored : 0;
  });

  // The interval callback is created once per `autoMinutes` change and closes
  // over whatever `busy` was at that moment, so it can't read the live value.
  // A ref can, which is what stops a slow cleanup from being re-entered by the
  // next tick and firing two overlapping passes.
  const busyRef = useRef(false);

  const runClean = useCallback(
    async (silent: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const result = await invoke<RamCleanResult>("clean_ram");
        setLast(result);
        if (!silent) {
          pushToast(
            "success",
            result.freed_bytes > 0
              ? format(s.ram.freed, { amount: formatBytes(result.freed_bytes) })
              : s.ram.freedNothing,
          );
        }
      } catch (e) {
        // A scheduled run failing shouldn't spam toasts every 10 minutes.
        if (!silent) pushToast("error", String(e));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [s, pushToast],
  );

  // `runClean` gets a new identity whenever the parent re-renders (pushToast is
  // redefined each render). Depending on it directly would tear down and
  // rebuild the interval on every render, so a 10-minute timer would keep
  // restarting from zero and effectively never fire. Reading it through a ref
  // keeps the effect keyed on the interval alone.
  const runCleanRef = useRef(runClean);
  useEffect(() => {
    runCleanRef.current = runClean;
  }, [runClean]);

  useEffect(() => {
    if (autoMinutes === 0) return;
    const id = window.setInterval(() => void runCleanRef.current(true), autoMinutes * 60_000);
    // Clearing on change/unmount is what guarantees exactly one timer is ever
    // alive, no matter how often the user flips the interval.
    return () => window.clearInterval(id);
  }, [autoMinutes]);

  function chooseInterval(minutes: number) {
    setAutoMinutes(minutes);
    localStorage.setItem("pc-tweaker-ram-auto", String(minutes));
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <ChipIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-100">{s.ram.title}</h2>
          <p className="mt-0.5 text-sm text-slate-400">{s.ram.subtitle}</p>
        </div>
        <button
          onClick={() => void runClean(false)}
          disabled={busy}
          className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-2.5 text-sm font-bold text-emerald-950 transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? s.ram.cleaning : s.ram.button}
        </button>
      </div>

      {last && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-emerald-400/10 px-3 py-2 text-sm">
          <span className="font-semibold text-emerald-300">
            {last.freed_bytes > 0
              ? format(s.ram.freed, { amount: formatBytes(last.freed_bytes) })
              : s.ram.freedNothing}
          </span>
          <span className="text-xs text-slate-400">
            {format(s.ram.inUse, {
              used: formatBytes(last.ram_used_after),
              total: formatBytes(last.ram_total),
            })}
          </span>
        </div>
      )}

      <div className="mt-4 border-t border-white/5 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.ram.autoLabel}</p>
        <div className="flex flex-wrap gap-1.5">
          {RAM_AUTO_INTERVALS.map((m) => (
            <button
              key={m}
              onClick={() => chooseInterval(m)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                autoMinutes === m
                  ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {ramIntervalLabel(m, s)}
            </button>
          ))}
        </div>
        {autoMinutes > 0 && <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.ram.autoHint}</p>}
      </div>
    </div>
  );
}

function ChipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type StartupEntry = {
  name: string;
  command: string;
  scope: string;
  enabled: boolean;
  requires_admin: boolean;
};

/**
 * Reads and toggles the same Run + StartupApproved registry entries Windows'
 * own Task Manager uses, so what's shown here matches what Windows reports
 * and disabling something is exactly as reversible as doing it there.
 */
function StartupManager({
  s,
  pushToast,
}: {
  s: Strings;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [items, setItems] = useState<StartupEntry[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const keyOf = (item: StartupEntry) => `${item.scope}:${item.name}`;

  async function refresh() {
    const list = await invoke<StartupEntry[]>("list_startup_items");
    setItems(list);
    setLoaded(true);
  }

  useEffect(() => {
    refresh().catch((e) => pushToast("error", String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleItem(item: StartupEntry) {
    setBusyKey(keyOf(item));
    try {
      await invoke("set_startup_enabled", {
        scope: item.scope,
        name: item.name,
        enabled: !item.enabled,
      });
      await refresh();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusyKey(null);
    }
  }

  const enabledCount = items.filter((i) => i.enabled).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-100">{s.startupManager.title}</h2>
          {loaded && items.length > 0 && (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-300">
              {format(s.startupManager.activeCount, { enabled: enabledCount, total: items.length })}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-400">{s.startupManager.description}</p>
        <p className="mt-2 text-xs text-slate-500">{s.startupManager.impactNote}</p>
      </div>

      {loaded && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          {s.startupManager.empty}
        </div>
      )}

      {items.map((item, i) => (
        <div
          key={keyOf(item)}
          style={{ animationDelay: `${i * 40}ms` }}
          className="animate-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
        >
          <div className="flex items-center gap-4">
            <div
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                item.enabled
                  ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-white/5 text-slate-500 ring-1 ring-white/10"
              }`}
            >
              <RocketIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-100">{item.name}</h3>
                {item.requires_admin && (
                  <>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                      {s.startupManager.machineWide}
                    </span>
                    <ShieldBadge label={s.badges.admin} />
                  </>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500" title={item.command}>
                {item.command}
              </p>
            </div>
            <Toggle checked={item.enabled} busy={busyKey === keyOf(item)} onClick={() => toggleItem(item)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Pro pricing, in EUR. Kept here so the displayed price, the "you save X%"
// badge and the per-month equivalent are all derived from the same two
// numbers — a hardcoded badge that drifts from the real price is the kind of
// thing that turns into a refund request.
const PRICE_MONTHLY = 9.99;
const PRICE_ANNUAL = 59;

const savingsPercent = Math.round((1 - PRICE_ANNUAL / (PRICE_MONTHLY * 12)) * 100);

function money(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function CheckIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PricingPanel({
  s,
  lang,
  isPro,
  freeTweakCount,
  onChoosePro,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  freeTweakCount: number;
  onChoosePro: (plan: "monthly" | "annual") => void;
}) {
  const [annual, setAnnual] = useState(true);

  const price = annual ? PRICE_ANNUAL : PRICE_MONTHLY;
  const perMonthEquivalent = PRICE_ANNUAL / 12;

  return (
    <div className="animate-card">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-50">{s.pricing.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{s.pricing.subtitle}</p>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="relative inline-flex items-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
          <button
            onClick={() => setAnnual(false)}
            className={`relative z-10 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              annual ? "text-slate-400 hover:text-slate-200" : "text-white"
            }`}
            style={!annual ? { backgroundColor: "var(--app-accent)" } : undefined}
          >
            {s.pricing.monthly}
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              annual ? "text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            style={annual ? { backgroundColor: "var(--app-accent)" } : undefined}
          >
            {s.pricing.annual}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                annual ? "bg-white/25 text-white" : "bg-emerald-400/20 text-emerald-300"
              }`}
            >
              {format(s.pricing.saveBadge, { percent: savingsPercent })}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-7 grid items-start gap-4 md:grid-cols-2">
        {/* Free */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-100">{s.pricing.freeName}</h3>
            {!isPro && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                {s.pricing.freeCurrent}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">{s.pricing.freeTagline}</p>

          <p className="mt-5 text-4xl font-black tracking-tight text-slate-100">{money(0, lang)}</p>
          <p className="mt-1 text-xs text-slate-500">{s.pricing.freePriceNote}</p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {/* The tweak count is filled in from the real list rather than
                written into the copy: it was hardcoded as "20" and silently
                became a lie the moment new tweaks shipped. */}
            {s.pricing.freeFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-300">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{format(feature, { count: freeTweakCount })}</span>
              </li>
            ))}
          </ul>

          {/* Only claim they're on Free when they actually are — a Pro user
              seeing "you're on the Free plan" would reasonably think their
              payment didn't go through. */}
          {!isPro && (
            <p className="mt-6 rounded-xl bg-white/5 py-2.5 text-center text-sm font-medium text-slate-400">
              {s.pricing.freeCta}
            </p>
          )}
        </div>

        {/* Pro */}
        <div className="relative rounded-2xl p-[1.5px]">
          <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent2),var(--app-accent))] opacity-80" />
          <div className="relative rounded-[15px] bg-[var(--app-bg-b)] p-6">
            <span
              className="absolute -top-3 right-6 rounded-full px-3 py-1 text-[10px] font-black tracking-wide text-slate-900 shadow-lg shadow-black/40"
              style={{ backgroundColor: "var(--app-accent2)" }}
            >
              {s.pricing.mostChosen}
            </span>

            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-100">{s.pricing.proName}</h3>
              {isPro && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {s.pricing.proCurrent}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">{s.pricing.proTagline}</p>

            <div className="mt-5 flex items-end gap-1.5">
              <span className="text-4xl font-black tracking-tight text-slate-50">{money(price, lang)}</span>
              <span className="pb-1.5 text-sm font-medium text-slate-400">
                {annual ? s.pricing.perYear : s.pricing.perMonth}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {annual
                ? format(s.pricing.annualDetail, {
                    monthly: money(perMonthEquivalent, lang),
                    yearly: money(PRICE_ANNUAL, lang),
                  })
                : format(s.pricing.annualNudge, { price: money(perMonthEquivalent, lang) })}
            </p>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {s.pricing.everythingInFree}
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {s.pricing.proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-200">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--app-accent2)" }} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => onChoosePro(annual ? "annual" : "monthly")}
              disabled={isPro}
              className="mt-6 w-full rounded-xl bg-[linear-gradient(to_right,var(--app-accent),var(--app-accent2))] py-3 text-sm font-bold text-slate-900 transition-transform hover:scale-[1.02] disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100"
            >
              {isPro ? s.pricing.proCurrent : s.pricing.proCta}
            </button>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-lg text-center text-xs leading-relaxed text-slate-500">
        {s.pricing.reassurance}
      </p>
    </div>
  );
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 9h11a5 5 0 0 1 0 10h-6M4 9l4-4M4 9l4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 8.5l3.6 2.7L12 4.5l5.4 6.7L21 8.5 19.2 19H4.8L3 8.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3.5 13.8 9l5.7 1.9-5.7 1.9L12 18.3l-1.8-5.5L4.5 11l5.7-1.9L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M18.5 4v3M20 5.5h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3c3.5 1.5 5.5 5 5.5 9l-2 3h-7l-2-3c0-4 2-7.5 5.5-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 18c0 1.5 1.3 3 3 3s3-1.5 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
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

  async function authenticate(
    mode: "login" | "register",
    email: string,
    password: string,
    registerDetails?: { firstName: string; lastName: string; dateOfBirth: string },
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
  async function startCheckout(plan: "monthly" | "annual" = "annual") {
    if (!API_BASE_URL) {
      throw new Error(s.auth.backendNotConfigured);
    }
    const token = localStorage.getItem("pc-tweaker-token");
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
    { key: "scan", label: s.tabs.scan, icon: <MagnifierIcon className="h-[18px] w-[18px]" /> },
    { key: "performance", label: s.tabs.performance, icon: CATEGORY_STYLE.performance.icon },
    { key: "gaming", label: s.tabs.gaming, icon: CATEGORY_STYLE.gaming.icon },
    { key: "privacy", label: s.tabs.privacy, icon: CATEGORY_STYLE.privacy.icon },
    { key: "startup", label: s.tabs.startup, icon: <RocketIcon className="h-[18px] w-[18px]" /> },
    { key: "ui", label: s.tabs.ui, icon: CATEGORY_STYLE.ui.icon },
    { key: "manutenzione", label: s.tabs.manutenzione, icon: CATEGORY_STYLE.manutenzione.icon },
    { key: "pricing", label: s.tabs.pricing, icon: <SparkIcon className="h-[18px] w-[18px]" /> },
  ];

  const [tweaks, setTweaks] = useState<TweakInfo[]>([]);
  const [cleanupTargets, setCleanupTargets] = useState<CleanupInfo[]>([]);
  const [filter, setFilter] = useState<Section>("scan");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState<CleanupInfo | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
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
      const base = format(s.cleanupResultToast, { deleted: result.deleted_count, freed: formatBytes(result.freed_bytes) });
      const suffix = result.skipped_count > 0 ? format(s.cleanupResultToastSkipped, { skipped: result.skipped_count }) : ".";
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
          text.name.toLowerCase().includes(needle) || text.description.toLowerCase().includes(needle)
        );
      });
    }

    return filter === "scan" || filter === "startup" || filter === "pricing"
      ? []
      : base.filter((t) => t.category === filter);
  }, [tweaks, filter, query, searching, s]);

  const showCleanup = filter === "manutenzione" && !searching;
  const showPrivacyExtras = filter === "privacy" && !searching;
  const showGamingExtras = filter === "gaming" && !searching;
  const showScan = filter === "scan" && !searching;
  const showStartup = filter === "startup" && !searching;
  const showPricing = filter === "pricing" && !searching;
  const turboBoostApplied = tweaks.find((t) => t.id === "turbo_boost")?.applied ?? false;
  const appliedCount = tweaks.filter((t) => t.applied).length;
  // What the pricing page can honestly promise a Free user.
  const freeTweakCount = tweaks.filter((t) => !t.requires_pro).length;

  const currentLabel = CATEGORIES.find((c) => c.key === filter)?.label ?? "";

  return (
    <main className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,var(--app-bg-a),var(--app-bg-b)_65%)] text-slate-100 [font-family:var(--app-font)]">
      <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r border-white/5 bg-black/25 p-4 backdrop-blur-xl">
        <div className="mb-7 flex items-center gap-2.5 px-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(to_bottom_right,var(--app-accent),var(--app-accent2))] text-slate-900 shadow-lg shadow-black/40">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M12 2 4 6v6c0 5 3.4 9 8 10 4.6-1 8-5 8-10V6l-8-4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="truncate text-[15px] font-bold tracking-tight">{s.appName}</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {CATEGORIES.map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                  active ? "text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
                style={active ? { backgroundColor: "color-mix(in srgb, var(--app-accent) 22%, transparent)" } : undefined}
              >
                {active && (
                  <span
                    className="absolute inset-y-2 left-0 w-[3px] rounded-full"
                    style={{ backgroundColor: "var(--app-accent)" }}
                  />
                )}
                <span
                  className={`shrink-0 transition-colors ${active ? "" : "text-slate-500 group-hover:text-slate-300"}`}
                  style={active ? { color: "var(--app-accent)" } : undefined}
                >
                  {c.icon}
                </span>
                <span className="truncate">{c.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4">
          {isProUnlocked ? (
            /* Paying for Pro should feel like it bought something: a gold
               gradient frame, a glow and a crown, not the same flat chip a
               Free account sees. Free deliberately stays plain. */
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 p-[1.5px] shadow-[0_0_22px_rgba(251,191,36,0.28)]">
              <div className="relative rounded-[10px] bg-slate-950/90 p-3">
                <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-amber-400/20 blur-2xl" />
                <p className="relative flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                  <CrownIcon className="h-4 w-4" />
                  {s.menu.planPro}
                </p>
                {auth.status === "authenticated" && (
                  <p className="relative mt-1.5 truncate text-[11px] leading-snug text-slate-400" title={auth.email}>
                    {auth.email}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPaywallFeature(s.menu.planPro)}
              className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-3 py-2.5 text-xs font-bold text-amber-950 transition-transform hover:scale-[1.02]"
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
              {!showPricing && <h1 className="text-2xl font-bold tracking-tight">{currentLabel}</h1>}
              {/* The tweak tally is meaningless on the startup screen, which
                  isn't made of tweaks and shows its own count instead. */}
              {!showStartup && !showPricing && (
                <div className="mt-1 flex items-center gap-3">
                  <p className="text-sm text-slate-400">
                    {format(s.appliedCount, { applied: appliedCount, total: tweaks.length })}
                  </p>
                  {/* One-click way back to a stock Windows: only offered when
                      there is actually something applied to undo. */}
                  {appliedCount > 0 && (
                    <button
                      onClick={() => setConfirmRestore(true)}
                      disabled={restoring}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
                    >
                      <UndoIcon className="h-3.5 w-3.5" />
                      {restoring ? s.restore.running : s.restore.button}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="relative ml-auto w-56 shrink-0">
              <MagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                placeholder={s.search.placeholder}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-white/25 focus:bg-white/[0.07]"
              />
              {searching && (
                <button
                  onClick={() => setQuery("")}
                  aria-label={s.search.clear}
                  className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-slate-500 hover:bg-white/10 hover:text-slate-200"
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
              onAuthenticate={authenticate}
              onLogout={logout}
              onResendVerification={resendVerification}
              onForgotPassword={forgotPassword}
              onUpgrade={() => setPaywallFeature(s.menu.planPro)}
            />
          </header>

          {showScan && <SystemMonitor s={s} />}

          {showScan && <RamCleaner s={s} pushToast={pushToast} />}

          {showStartup && <StartupManager s={s} pushToast={pushToast} />}

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
          <ScanPanel
            s={s}
            tweaks={tweaks}
            cleanupTargets={cleanupTargets}
            isPro={isProUnlocked}
            onRequirePro={() => setPaywallFeature(s.menu.planPro)}
            onFixed={refresh}
            pushToast={pushToast}
          />
        )}

        {showPrivacyExtras && <PasswordBreachCheck s={s} />}

        {showGamingExtras && (
          <>
            <GameSessionsPanel
              s={s}
              isPro={isProUnlocked}
              onRequirePro={() => setPaywallFeature(s.gameSessions.title)}
            />
            <TurboBoostPanel s={s} applied={turboBoostApplied} onChanged={refresh} pushToast={pushToast} />
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

          {visibleTweaks.length === 0 &&
            !showCleanup &&
            !showPrivacyExtras &&
            !showScan &&
            !showStartup &&
            !showPricing && (
              <li className="animate-card rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                {searching ? format(s.search.noResults, { query: query.trim() }) : s.emptyCategory}
              </li>
            )}
        </ul>

          <p className="mx-auto mt-8 max-w-lg text-center text-xs leading-relaxed text-slate-600">
            {s.headerNote}
          </p>
        </div>
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

      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="animate-card w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">{s.restore.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
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
              className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
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
