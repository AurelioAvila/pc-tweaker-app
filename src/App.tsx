import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { open as openFolderDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check as checkForUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { listen } from "@tauri-apps/api/event";
import { STRINGS, LANGUAGES, Lang, Strings, detectInitialLang, format } from "./i18n";
import { THEMES, ThemeName, detectInitialTheme } from "./theme";
import "./App.css";

// Set at build time once the backend (backend/, deployed to Railway per the
// project brief) is live: `VITE_API_BASE_URL=https://your-app.up.railway.app npm run build`.
// Until then, auth/checkout calls fail honestly instead of faking success.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// ---- Anonymous, opt-in error reporting --------------------------------------
// Off by default; the AccountMenu toggle flips a localStorage flag that is
// read at send time (no state plumbing). What leaves the machine: app name,
// version, and the error message the user already saw — nothing else.
const ERROR_REPORTS_KEY = "pc-tweaker-error-reports";

let cachedAppVersion = "";
void getVersion()
  .then((v) => {
    cachedAppVersion = v;
  })
  .catch(() => {
    // Without a version the backend rejects the report; reporting simply
    // stays silent, which is the correct failure mode for telemetry.
  });

function errorReportsEnabled(): boolean {
  return localStorage.getItem(ERROR_REPORTS_KEY) === "on";
}

function reportError(message: string) {
  if (!API_BASE_URL || !cachedAppVersion || !errorReportsEnabled()) return;
  fetch(`${API_BASE_URL}/api/error-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app: "pctweaker",
      appVersion: cachedAppVersion,
      message: message.slice(0, 500),
    }),
  }).catch(() => {
    // Fire-and-forget by design: a failed report must never surface an error.
  });
}

type AuthState =
  | { status: "anonymous" }
  | { status: "authenticated"; email: string; isPro: boolean; emailVerified: boolean };

type Category = "performance" | "privacy" | "ui" | "manutenzione" | "gaming";

/** Navigable sections: the tweak categories plus the two standalone screens. */
type Section = Category | "scan" | "startup" | "profiles" | "pricing";

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

type LargeFile = {
  path: string;
  size: number;
};

type DiskOptResult = {
  drive: string;
  media_type: string;
  summary: string;
};

type DiskHealthInfo = {
  drive: string;
  media_type: string;
  status: string;
};

type FlushDnsResult = {
  success: boolean;
  detail: string;
};

type DriveInfo = {
  letter: string;
  media_type: string;
  total_bytes: number;
  free_bytes: number;
  is_system: boolean;
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

/**
 * Sized and labeled like the switch in Windows 11's own Settings app (a
 * pill roughly 36×20px with an "On"/"Off" caption to its right) rather than
 * the oversized iOS-style control this used to be — the previous h-8 w-14
 * (32×56px) knob was noticeably larger than any toggle in Windows itself or
 * in the apps it's meant to sit alongside.
 */
function Toggle({
  checked,
  busy,
  onClick,
  s,
}: {
  checked: boolean;
  busy: boolean;
  onClick: () => void;
  s: Strings;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-pressed={checked}
      className="group flex shrink-0 items-center gap-2 outline-none disabled:cursor-wait"
    >
      <span
        className={`text-xs font-semibold tabular-nums transition-colors ${
          checked ? "text-emerald-400" : "text-slate-500"
        }`}
      >
        {checked ? s.toggle.on : s.toggle.off}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-out
          ${checked ? "bg-emerald-500" : "bg-white/15 group-hover:bg-white/25"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-white shadow transition-transform duration-200 ease-out
            ${checked ? "translate-x-4" : "translate-x-0"}`}
        >
          {busy && (
            <svg className="h-2.5 w-2.5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
        </span>
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

function DriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 14h18" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 12h17M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function HeartPulseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 12h4l2-5 3 10 2-7 1.5 2H21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Runs Windows' own Optimize Drives (defrag/TRIM). Pro-gated: unlike temp
 * cleanup this is a heavier, higher-value action, in line with the other
 * admin-requiring maintenance tools already behind Pro.
 */
function DiskOptimizeCard({
  s,
  drive,
  isPro,
  onRequirePro,
  onToast,
}: {
  s: Strings;
  drive: string;
  isPro: boolean;
  onRequirePro: () => void;
  onToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [running, setRunning] = useState(false);

  async function run() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    setRunning(true);
    try {
      const result = await invoke<DiskOptResult>("optimize_disk", { drive });
      onToast("success", format(s.diskOptimize.resultToast, { media: result.media_type }));
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30">
          <DriveIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-100">
              {s.diskOptimize.title} <span className="font-normal text-slate-500">({drive})</span>
            </h2>
            <ShieldBadge label={s.badges.admin} />
            <ProBadge label={s.badges.pro} />
          </div>
          <p className="mt-0.5 text-sm text-slate-400">
            {running ? s.diskOptimize.running : s.diskOptimize.description}
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-60"
        >
          {running ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-950/30 border-t-amber-950" />
          ) : (
            s.diskOptimize.button
          )}
        </button>
      </div>
    </li>
  );
}

/** Clears the resolver's DNS cache. Free, no elevation, no rollback needed —
 *  a one-shot action rather than a persistent setting. */
function DnsFlushCard({ s, onToast }: { s: Strings; onToast: (kind: Toast["kind"], message: string) => void }) {
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      await invoke<FlushDnsResult>("flush_dns_cache");
      onToast("success", s.dnsFlush.resultToast);
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/30">
          <GlobeIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-100">{s.dnsFlush.title}</h2>
          <p className="mt-0.5 text-sm text-slate-400">{s.dnsFlush.description}</p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="shrink-0 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-cyan-950 transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-60"
        >
          {running ? s.dnsFlush.running : s.dnsFlush.button}
        </button>
      </div>
    </li>
  );
}

/** Cross-promo for the sibling product. It lives at the end of the cleanup
 *  section deliberately: someone deleting temp files and duplicates is one
 *  step away from wanting whole programs gone — that is the uninstaller's
 *  job. Static card, no IPC, links out to the product page. */
function UninstallerPromoCard({ s }: { s: Strings }) {
  function openPage() {
    void openUrl("https://github.com/AurelioAvila/pc-tweaker-uninstaller");
  }

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fuchsia-400/15 text-sm font-bold text-fuchsia-300 ring-1 ring-fuchsia-400/30">
          PU
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-100">{s.uninstallerPromo.title}</h2>
          <p className="mt-0.5 text-sm text-slate-400">{s.uninstallerPromo.description}</p>
        </div>
        <button
          onClick={openPage}
          className="shrink-0 rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-fuchsia-950 transition-transform hover:scale-[1.03]"
        >
          {s.uninstallerPromo.button}
        </button>
      </div>
    </li>
  );
}

const LARGE_FILE_THRESHOLD_BYTES = 100 * 1024 * 1024;

/** Same scan/select/delete shape as DuplicateFinder, but by size threshold
 *  instead of content hash — a different, complementary way to find space to
 *  reclaim (a single 4 GB video has no duplicate to find, but is easy to spot
 *  once it's just sorted by size). */
function LargeFileFinder({
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
  const [files, setFiles] = useState<LargeFile[] | null>(null);
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
    setFiles(null);
    setSelected(new Set());
    try {
      const result = await invoke<LargeFile[]>("scan_large_files", {
        root: folder,
        minBytes: LARGE_FILE_THRESHOLD_BYTES,
      });
      setFiles(result);
      if (result.length === 0) {
        onToast("success", format(s.largeFiles.noneFound, { size: formatBytes(LARGE_FILE_THRESHOLD_BYTES) }));
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
        format(s.largeFiles.deletedToast, { count: result.deleted_count, freed: formatBytes(result.freed_bytes) }),
      );
      setFiles((prev) => prev?.filter((f) => !selected.has(f.path)) ?? null);
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
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30">
          <TrashIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-100">{s.largeFiles.title}</h2>
            <ProBadge label={s.badges.pro} />
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{s.largeFiles.description}</p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="shrink-0 rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
        >
          {scanning ? s.largeFiles.scanning : s.largeFiles.chooseFolder}
        </button>
      </div>

      {files && files.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-400">
            {format(s.largeFiles.foundCount, { count: files.length })}
          </p>
          <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl bg-black/20 p-3">
            {files.map((f) => (
              <label
                key={f.path}
                className="flex cursor-pointer items-center gap-2 truncate py-0.5 text-xs text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.path)}
                  onChange={() => toggleSelected(f.path)}
                  className="h-3.5 w-3.5 shrink-0 accent-fuchsia-500"
                />
                <span className="shrink-0 font-medium text-slate-200">{formatBytes(f.size)}</span>
                <span className="truncate text-slate-500">{f.path}</span>
              </label>
            ))}
          </div>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0 || deleting}
            className="mt-3 w-full rounded-xl bg-red-500/90 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {deleting ? s.largeFiles.deleting : format(s.largeFiles.moveSelected, { count: selected.size })}
          </button>
        </div>
      )}
    </li>
  );
}

/** Reads Windows' own S.M.A.R.T./reliability HealthStatus for the system
 *  drive. Free — this is a trust-building diagnostic, not a premium action,
 *  and checked once on mount rather than on the fast system-monitor poll
 *  since drive health changes on the order of days, not seconds. */
function DiskHealthCard({ s, drive }: { s: Strings; drive: string }) {
  const [health, setHealth] = useState<DiskHealthInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Clear the previous drive's result immediately rather than leaving it on
    // screen while the new one loads — otherwise switching drives briefly
    // shows the wrong drive's health status attributed to the new selection.
    setHealth(null);
    setFailed(false);
    invoke<DiskHealthInfo>("disk_health", { drive })
      .then((v) => {
        if (alive) setHealth(v);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [drive]);

  if (failed) return null;

  const statusLabel = (status: string | undefined) => {
    switch (status) {
      case "Healthy":
        return { text: s.diskHealth.healthy, color: "text-emerald-400", dot: "bg-emerald-400" };
      case "Warning":
        return { text: s.diskHealth.warning, color: "text-amber-400", dot: "bg-amber-400" };
      case "Unhealthy":
        return { text: s.diskHealth.unhealthy, color: "text-red-400", dot: "bg-red-400" };
      default:
        return { text: s.diskHealth.unknown, color: "text-slate-400", dot: "bg-slate-500" };
    }
  };

  const info = health ? statusLabel(health.status) : null;

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30">
          <HeartPulseIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-100">{s.diskHealth.title}</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {health ? `${health.drive} · ${health.media_type}` : s.diskHealth.loading}
          </p>
        </div>
        {info && (
          <span className={`flex shrink-0 items-center gap-1.5 text-sm font-semibold ${info.color}`}>
            <span className={`h-2 w-2 rounded-full ${info.dot}`} />
            {info.text}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * Owns which fixed drive Drive Health / Optimize Drive act on. Fetches the
 * real list once (via sysinfo on the Rust side, not hardcoded to C:), so a
 * machine with a second HDD/SSD for games or media can check and optimize
 * that one too — the earlier version silently only ever touched the system
 * drive with no way to pick another.
 */
function DiskToolsSection({
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
  const [drives, setDrives] = useState<DriveInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    invoke<DriveInfo[]>("list_drives_cmd")
      .then((list) => {
        if (!alive) return;
        setDrives(list);
        setSelected(list.find((d) => d.is_system)?.letter ?? list[0]?.letter ?? null);
      })
      .catch(() => {
        if (alive) setDrives([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Nothing to operate on yet (still loading) or the call failed outright —
  // either way there is no drive to hand the two cards below.
  if (!selected) return null;

  return (
    <>
      {drives && drives.length > 0 && (
        // Shown even with a single drive: it doubles as explicit confirmation
        // of which drive Health/Optimize below are about to act on, not just
        // a chooser for when there happens to be more than one.
        <li className="animate-card flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <span className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {s.diskHealth.selectDrive}:
          </span>
          {drives.map((d) => (
            <button
              key={d.letter}
              onClick={() => setSelected(d.letter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selected === d.letter
                  ? "bg-rose-400/20 text-rose-300 ring-1 ring-rose-400/40"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {d.letter} · {d.media_type} · {format(s.diskHealth.freeSpace, { size: formatBytes(d.free_bytes) })}
            </button>
          ))}
        </li>
      )}
      <DiskHealthCard s={s} drive={selected} />
      <DiskOptimizeCard s={s} drive={selected} isPro={isPro} onRequirePro={onRequirePro} onToast={onToast} />
    </>
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

/**
 * The signed-in user's avatar.
 *
 * The first character of the email address used to be the whole design, which
 * produced a giant "C" for canadesino91@gmail.com — a letter that means
 * nothing to the person looking at it. Instead this draws a person glyph
 * inside a ring tinted from the address itself, so two different accounts are
 * still visually distinct without pretending a mailbox prefix is a name.
 *
 * Pro accounts get the gold treatment used everywhere else in the app, so the
 * thing you paid for is visible the moment the menu opens.
 */
function Avatar({
  email,
  isPro,
  size = "md",
}: {
  email: string;
  isPro: boolean;
  /** `sm` is the header trigger, `md` the one inside the menu. A real size
   *  rather than a CSS scale: `scale-*` is a transform, so a scaled 44px
   *  avatar still occupies 44px of layout and spilled out of the 36px button
   *  it was sitting in — which is what made the trigger look like two
   *  overlapping circles. */
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const glyph = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const badge = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  const crown = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  // Stable hue per address: same account, same colour, every launch.
  const hue = useMemo(() => {
    let acc = 0;
    for (const ch of email.trim().toLowerCase()) acc = (acc * 31 + ch.charCodeAt(0)) % 360;
    return acc;
  }, [email]);

  return (
    <span className={`relative grid ${box} shrink-0 place-items-center`}>
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: isPro
            ? "conic-gradient(from 200deg, #fde68a, #f59e0b, #fbbf24, #fde68a)"
            : `conic-gradient(from 200deg, hsl(${hue} 80% 62%), hsl(${(hue + 60) % 360} 80% 55%), hsl(${hue} 80% 62%))`,
        }}
      />
      {/* Inner disc knocks a hole in the ring so the gradient reads as a rim
          rather than as a bright blob with a letter stamped on it. */}
      <span className="absolute inset-[2px] rounded-full bg-slate-900" />
      <svg viewBox="0 0 24 24" fill="none" className={`relative ${glyph} text-slate-300`}>
        <circle cx="12" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M4.8 20c1.3-3.5 4.1-5.3 7.2-5.3s5.9 1.8 7.2 5.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      {isPro && (
        <span className={`absolute -bottom-0.5 -right-0.5 grid ${badge} place-items-center rounded-full bg-slate-900 ring-1 ring-amber-400/50`}>
          <CrownIcon className={`${crown} text-amber-300`} />
        </span>
      )}
    </span>
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
              <p className="mt-0.5 text-[11px] font-medium text-amber-400">{s.auth.emailNotVerified}</p>
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
            <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.menu.plan}</p>
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
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.menu.language}</p>
              <div className="flex flex-col gap-0.5">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`rounded-lg px-2.5 py-1 text-left text-[13px] transition-colors ${
                      lang === l.code ? "bg-indigo-500/20 text-indigo-300" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-white/10 p-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.menu.theme}</p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.menu.errorReports}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.menu.errorReportsBody}</p>
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.menu.about}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.menu.aboutBody}</p>
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
/**
 * Turbo Boost, presented as the tachometer the product's own logo already
 * carries.
 *
 * The old control was a circle that pulsed while an invoke was in flight,
 * which told the user nothing except "wait". This sweeps a real gauge needle
 * and names each step as the backend reaches it. The steps are not
 * decoration: they map to what `apply_turbo_boost` actually does — read the
 * plan's current boost indexes, write the new AC/DC ceiling, activate the
 * plan.
 *
 * A minimum duration is enforced so the sweep is legible; the button does not
 * settle until the invoke has *also* resolved, so the gauge can never claim
 * success before the registry write returned.
 */

/** Gauge geometry: a 260° arc opening at the bottom, like a rev counter. */
const GAUGE_START = 140;
const GAUGE_SWEEP = 260;
const GAUGE_R = 62;
const GAUGE_C = 80;

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: GAUGE_C + radius * Math.cos(rad), y: GAUGE_C + radius * Math.sin(rad) };
}

function arcPath(fromFrac: number, toFrac: number, radius: number) {
  const a0 = GAUGE_START + GAUGE_SWEEP * fromFrac;
  const a1 = GAUGE_START + GAUGE_SWEEP * toFrac;
  const p0 = polar(a0, radius);
  const p1 = polar(a1, radius);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

function TurboGauge({ value, engaged }: { value: number; engaged: boolean }) {
  const needle = polar(GAUGE_START + GAUGE_SWEEP * value, GAUGE_R - 12);
  // The last fifth is the "redline" — the part boost mode actually unlocks.
  const REDLINE = 0.8;

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40">
      <defs>
        <linearGradient id="turbo-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>

      {/* Track */}
      <path d={arcPath(0, 1, GAUGE_R)} stroke="rgba(255,255,255,0.10)" strokeWidth="9" fill="none" strokeLinecap="round" />
      {/* Redline zone, always visible so the goal of the sweep is legible */}
      <path d={arcPath(REDLINE, 1, GAUGE_R)} stroke="rgba(239,68,68,0.30)" strokeWidth="9" fill="none" strokeLinecap="round" />

      {/* Tick marks */}
      {Array.from({ length: 11 }, (_, i) => {
        const f = i / 10;
        const a = GAUGE_START + GAUGE_SWEEP * f;
        const outer = polar(a, GAUGE_R - 8);
        const inner = polar(a, GAUGE_R - (i % 5 === 0 ? 17 : 13));
        return (
          <line
            key={i}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={f >= REDLINE ? "rgba(248,113,113,0.75)" : "rgba(255,255,255,0.35)"}
            strokeWidth={i % 5 === 0 ? 2.2 : 1.2}
            strokeLinecap="round"
          />
        );
      })}

      {/* Filled portion */}
      {value > 0.002 && (
        <path
          d={arcPath(0, value, GAUGE_R)}
          stroke="url(#turbo-fill)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          style={{ filter: engaged ? "drop-shadow(0 0 8px rgba(251,146,60,0.65))" : "none" }}
        />
      )}

      {/* Needle */}
      <line
        x1={GAUGE_C}
        y1={GAUGE_C}
        x2={needle.x}
        y2={needle.y}
        stroke={engaged ? "#fb923c" : "#cbd5e1"}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={GAUGE_C} cy={GAUGE_C} r="7" fill="#0f172a" stroke={engaged ? "#fb923c" : "#64748b"} strokeWidth="2.5" />
    </svg>
  );
}

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
  const [needle, setNeedle] = useState(0);
  const [stage, setStage] = useState<string | null>(null);
  // Rated clock, shown as a fact under the gauge. Deliberately not a live
  // frequency: Windows reports a nominal constant on CPPC processors, so a
  // "current MHz" readout would be a fixed number pretending to be live.
  // See src-tauri/src/cpuclock.rs.
  const [ratedMhz, setRatedMhz] = useState<number | null>(null);
  // Live CPU load. This is what the needle rests on when idle, so the gauge is
  // a working instrument between activations rather than a dead dial.
  const [load, setLoad] = useState(0);
  // The measured before/after ratio, kept until the next activation so the
  // user can still read it after the sweep settles.
  const [gain, setGain] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  // The live needle value. `needle` state is only for rendering; reading it
  // inside an async sequence would capture whatever it was when the click
  // handler started, so every sweep after the first would jump back to that
  // stale value instead of continuing from where the last one stopped.
  const needleRef = useRef(0);

  const setNeedleValue = useCallback((v: number) => {
    needleRef.current = v;
    setNeedle(v);
  }, []);

  useEffect(() => {
    invoke<{ max_mhz: number } | null>("cpu_clock")
      .then((c) => setRatedMhz(c?.max_mhz ?? null))
      .catch(() => setRatedMhz(null));
  }, []);

  // Poll CPU load while the panel is on screen, and let the needle follow it
  // whenever an activation isn't driving it.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      invoke<{ cpu_usage: number }>("system_stats")
        .then((st) => {
          if (!cancelled) setLoad(Math.max(0, Math.min(100, st.cpu_usage)));
        })
        .catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Resting position: the live load, so the dial breathes with the machine.
  useEffect(() => {
    if (!busy) setNeedleValue(load / 100);
  }, [load, busy, setNeedleValue]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const stages = [s.turboBoost.stageReading, s.turboBoost.stageRaising, s.turboBoost.stageApplying];

  /**
   * Sweeps the needle to `to`, resolving when it lands.
   *
   * Driven by setTimeout rather than requestAnimationFrame on purpose:
   * browsers stop firing rAF entirely for a window that isn't being
   * composited. Since the whole activation sequence awaits these sweeps,
   * an rAF that never fires would leave the promise pending forever — the
   * button stuck disabled and the gauge frozen — if the user minimised the
   * window mid-activation. Timers keep firing (throttled) when hidden, so the
   * sequence always finishes even if it finishes without being watched.
   */
  function sweep(to: number, ms: number): Promise<void> {
    const from = needleRef.current;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / ms);
        // Ease-out: quick off the line, settling into the target the way a rev
        // counter does rather than crawling linearly.
        const eased = 1 - Math.pow(1 - t, 3);
        setNeedleValue(from + (to - from) * eased);
        if (t < 1) timer.current = window.setTimeout(step, 16);
        else resolve();
      };
      step();
    });
  }

  async function toggleTurbo() {
    setBusy(true);
    const engaging = !applied;

    // Kick the real work off immediately; the animation runs alongside it
    // rather than delaying it.
    const work = engaging
      ? invoke("apply_tweak", { id: "turbo_boost" })
      : invoke("rollback_tweak", { id: "turbo_boost" });

    // Never let an unhandled rejection escape while the sweep is running.
    const settled = work.then(
      () => ({ ok: true as const }),
      (e) => ({ ok: false as const, error: e }),
    );

    try {
      if (engaging) {
        // Measure first, so the "after" number has something honest to be
        // compared against. Both runs use the same fixed workload on the same
        // machine minutes apart, which is the only comparison that means
        // anything — the absolute score is never shown.
        setStage(s.turboBoost.stageMeasuringBefore);
        const before = await invoke<{ score: number }>("cpu_benchmark", { budgetMs: 900 }).catch(() => null);
        await sweep(0.3, 300);

        for (let i = 0; i < stages.length; i++) {
          setStage(stages[i]);
          await sweep(0.3 + ((i + 1) / stages.length) * 0.62, 340);
        }

        // The registry write has to have landed before the second run, or the
        // comparison measures nothing.
        // Deliberately not named `applied`: that shadowed the outer applied
        // state, and the fallback below then read the result *object* — always
        // truthy — so a failed activation pinned the needle at the redline
        // while showing an error, the exact opposite of what happened.
        const engaged = await settled;
        if (!engaged.ok) {
          setNeedleValue(applied ? 1 : 0);
          pushToast("error", String(engaged.error));
          return;
        }

        setStage(s.turboBoost.stageMeasuringAfter);
        const after = await invoke<{ score: number }>("cpu_benchmark", { budgetMs: 900 }).catch(() => null);
        // No fabricated figure when either run failed: no number beats a
        // wrong one.
        setGain(before && after && before.score > 0 ? after.score / before.score : null);

        await sweep(1, 260);
        pushToast("success", format(s.toasts.applied, { name: s.turboBoost.title }));
        await onChanged();
        return;
      } else {
        setStage(s.turboBoost.deactivating);
        setGain(null);
        await sweep(0, 620);
      }

      const result = await settled;
      if (!result.ok) {
        // Fall back to whatever the machine is really in, so a failed apply
        // never leaves the gauge sitting at the redline.
        setNeedleValue(applied ? 1 : 0);
        pushToast("error", String(result.error));
        return;
      }

      // The redline flourish is a transition, not a resting state: the
      // effect above takes the needle back to real load once `busy` clears.
      pushToast(
        "success",
        format(engaging ? s.toasts.applied : s.toasts.rolledBack, { name: s.turboBoost.title }),
      );
      await onChanged();
    } finally {
      setStage(null);
      setBusy(false);
    }
  }

  // "Aggressive mode - 4.20 GHz" after "Default mode - 4.20 GHz" read as
  // nothing having changed, because the rated clock is a constant of the
  // silicon and never moves. What changed is the ceiling, so that is what the
  // readout names — and once measured, by how much it actually mattered.
  const ceiling = applied ? s.turboBoost.ceilingUnlocked : s.turboBoost.ceilingLocked;
  // Three bands rather than "gain / no gain". Reporting a measured 1.02x as
  // "no measurable gain" understated a real if small result and read as the
  // app admitting it did nothing; and when there genuinely is no headroom,
  // that is a fact about the processor — already running flat out — not a
  // failure of the tweak, so it is worded as such.
  const gainText =
    gain === null
      ? null
      : gain >= 1.03
        ? format(s.turboBoost.gainMeasured, { factor: gain.toFixed(2) })
        : gain >= 1.005
          ? format(s.turboBoost.gainSlight, { factor: gain.toFixed(2) })
          : s.turboBoost.gainAtCeiling;
  const readout = busy ? stage : (gainText ?? ceiling);

  return (
    <div className="mb-6 flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-8">
      <h2 className="text-lg font-semibold text-slate-100">{s.turboBoost.title}</h2>
      <p className="mt-1 max-w-xs text-center text-sm text-slate-400">{s.turboBoost.subtitle}</p>

      <div className="relative mt-6 grid place-items-center">
        {applied && !busy && (
          <span className="absolute h-32 w-32 rounded-full bg-orange-500/15 blur-2xl" />
        )}
        <TurboGauge value={needle} engaged={applied || busy} />
        {/* Percentage sits inside the gauge's open bottom, where a rev counter
            puts its gear readout. */}
        <span className="pointer-events-none absolute bottom-7 flex flex-col items-center">
          <span
            className={`font-black tabular-nums leading-none transition-colors ${
              applied || busy ? "text-orange-300" : "text-slate-500"
            }`}
            style={{ fontSize: 26 }}
          >
            {Math.round(needle * 100)}
            <span className="text-[13px]">%</span>
          </span>
        </span>
      </div>

      <p
        className={`mt-1 h-5 text-center text-[12.5px] font-semibold transition-colors ${
          busy ? "text-orange-300" : gain !== null ? "text-emerald-300" : applied ? "text-orange-300/80" : "text-slate-500"
        }`}
      >
        {readout}
      </p>
      {!busy && ratedMhz !== null && (
        <p className="text-center text-[11px] text-slate-500">
          {(ratedMhz / 1000).toFixed(2)} GHz · {applied ? s.turboBoost.modeAggressive : s.turboBoost.modeDefault}
        </p>
      )}

      <button
        onClick={toggleTurbo}
        disabled={busy}
        className={`mt-4 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all disabled:cursor-wait ${
          applied
            ? "bg-white/10 text-slate-200 hover:bg-white/15"
            : "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 shadow-lg shadow-orange-500/25 hover:scale-[1.03]"
        }`}
      >
        <BoltIcon className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />
        {busy ? "···" : applied ? s.turboBoost.stopLabel : s.turboBoost.startLabel}
      </button>
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
 * A hardware-derived verdict for one tweak, from the Rust `advise_tweaks`
 * command. `reason_key` indexes `s.scan.reasons` so the explanation is
 * translated like everything else rather than arriving as English from Rust.
 */
type TweakAdvice = {
  id: string;
  verdict: "recommended" | "notrecommended" | "neutral" | "unsupported";
  reason_key: string | null;
};

/** Shape of the Rust `system_profile` command's reply. */
type SystemProfile = {
  windows_version: string | null;
  windows_build: string | null;
  cpu: string | null;
  cpu_physical_cores: number | null;
  cpu_logical_cores: number | null;
  gpu: string | null;
  ram_total_bytes: number | null;
  system_disk: "hdd" | "ssd" | "nvme" | "unknown";
  form_factor: "desktop" | "laptop" | "unknown";
  power_plan_guid: string | null;
  power_plan: string | null;
};

/**
 * The machine the Scan is about to judge, as a row of facts.
 *
 * This is the difference between "we ran a scan" and "we looked at *your*
 * PC": the advice below is derived from exactly these values, so showing them
 * lets the user check the reasoning instead of taking the verdicts on faith.
 * Anything the probe couldn't establish is simply left out rather than shown
 * as a blank or a guess.
 */
function MachineStrip({ s, profile }: { s: Strings; profile: SystemProfile | null }) {
  if (!profile) return null;

  const diskLabel =
    profile.system_disk === "hdd"
      ? s.scan.diskHdd
      : profile.system_disk === "ssd"
        ? s.scan.diskSsd
        : profile.system_disk === "nvme"
          ? s.scan.diskNvme
          : null;

  const formLabel =
    profile.form_factor === "desktop"
      ? s.scan.formDesktop
      : profile.form_factor === "laptop"
        ? s.scan.formLaptop
        : null;

  const ram = profile.ram_total_bytes
    ? `${Math.round(profile.ram_total_bytes / 1024 ** 3)} GB`
    : null;

  const facts = [profile.windows_version, profile.cpu, profile.gpu, ram, diskLabel, formLabel]
    .filter((f): f is string => Boolean(f));

  if (facts.length === 0) return null;

  return (
    <div className="mt-5 w-full">
      <p className="mb-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {s.scan.thisPc}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {facts.map((fact) => (
          <span
            key={fact}
            className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11.5px] font-medium text-slate-300 ring-1 ring-white/10"
          >
            {fact}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The one-line explanation under a scanned item, when the hardware has an
 * opinion about it.
 *
 * Renders nothing for a `neutral` verdict: most tweaks have no
 * hardware-derived argument either way, and printing "no opinion" under each
 * of them would be noise. A missing translation falls back to no note at all
 * rather than to a raw key.
 */
function AdviceNote({ s, advice }: { s: Strings; advice?: TweakAdvice }) {
  if (!advice || advice.verdict === "neutral") return null;

  const reason = advice.reason_key
    ? (s.scan.reasons as Record<string, string | undefined>)[advice.reason_key]
    : undefined;

  const tone =
    advice.verdict === "recommended"
      ? "text-emerald-300"
      : advice.verdict === "unsupported"
        ? "text-slate-500"
        : "text-amber-300";

  const label =
    advice.verdict === "recommended"
      ? s.scan.verdictRecommended
      : advice.verdict === "unsupported"
        ? s.scan.verdictUnsupported
        : s.scan.verdictNotRecommended;

  return (
    <p className={`mt-1 text-[11px] font-medium ${tone}`}>
      {label}
      {reason ? ` — ${reason}` : ""}
    </p>
  );
}

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
  // Hardware-derived verdicts, keyed by tweak id. Empty until a scan runs, and
  // empty again if the backend can't profile the machine — in which case the
  // Scan simply behaves as it always did rather than showing made-up advice.
  const [advice, setAdvice] = useState<Record<string, TweakAdvice>>({});
  const [profile, setProfile] = useState<SystemProfile | null>(null);

  // Read the machine once when the screen mounts, so the hardware strip is
  // already there before the user commits to a scan — that is the part that
  // says "this is about your PC" rather than about PCs in general. A failure
  // just leaves the strip out.
  useEffect(() => {
    invoke<SystemProfile>("system_profile")
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);
  const [fixing, setFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);
  const [fixTotal, setFixTotal] = useState(0);
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
  //
  // The UI category is excluded on purpose: dark mode or a left-aligned
  // taskbar are personal preferences, not "problems" a PC health scan can
  // honestly claim to have found — counting them would inflate the issue
  // count exactly the way the snake-oil cleaners this app defines itself
  // against do. They stay fully available under their own section.
  // Which tweaks a performance scan may report is decided in Rust
  // (`recommend::is_scan_relevant`), so the curation and the reasoning behind
  // it live together. Until that list arrives the Scan reports nothing rather
  // than falling back to "everything", which is what used to pad the count
  // with taskbar and Cortana toggles.
  const [scanIds, setScanIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    invoke<string[]>("scan_relevant_ids")
      .then((ids) => setScanIds(new Set(ids)))
      .catch(() => setScanIds(new Set()));
  }, []);
  const scanRelevant = (t: TweakInfo) => scanIds?.has(t.id) ?? false;
  const fixableIssues: ScanIssue[] = useMemo(() => {
    const fromTweaks = tweaks
      .filter((t) => scanRelevant(t) && !t.applied && (isPro || !t.requires_pro) && t.id !== "turbo_boost")
      .map((t) => ({ kind: "tweak" as const, id: t.id, ...textFor(s.tweaks, t.id, t.name, t.description) }));
    const fromCleanup = cleanupTargets
      .filter((c) => isPro || !c.requires_pro)
      .map((c) => ({ kind: "cleanup" as const, id: c.id, ...textFor(s.cleanup, c.id, c.name, c.description) }));
    return [...fromTweaks, ...fromCleanup];
  }, [tweaks, cleanupTargets, isPro, s, scanIds]);

  const lockedIssues = useMemo(
    () =>
      isPro
        ? []
        : tweaks
            .filter((t) => scanRelevant(t) && !t.applied && t.requires_pro)
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

    // Profile the machine while the progress ring runs, so the verdicts are
    // ready by the time the results appear. A failure here is not fatal: the
    // advice map stays empty and every issue is offered exactly as before.
    const adviceReady = invoke<TweakAdvice[]>("advise_tweaks", {
      ids: fixableIssues.map((i) => i.id),
    })
      .then((list) => Object.fromEntries(list.map((a) => [a.id, a])) as Record<string, TweakAdvice>)
      .catch(() => ({}) as Record<string, TweakAdvice>);

    const start = performance.now();
    scanTimer.current = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / SCAN_DURATION_MS) * 100));
      setScanPct(pct);
      if (pct >= 100) {
        if (scanTimer.current) window.clearInterval(scanTimer.current);
        void adviceReady.then((map) => {
          setAdvice(map);
          // Pre-tick only what this PC actually benefits from. Anything the
          // hardware argues against stays listed but unticked, so "Fix all"
          // can never quietly apply something that costs the user battery
          // life or Start-menu search on their particular machine.
          const initialChecked: Record<string, boolean> = {};
          fixableIssues.forEach((issue) => {
            const verdict = map[issue.id]?.verdict;
            initialChecked[issue.id] = verdict !== "notrecommended" && verdict !== "unsupported";
          });
          setChecked(initialChecked);
          setPhase("results");
        });
      }
    }, 60);
  }

  /** Ids the hardware actually argues for, in list order. */
  const recommendedIds = useMemo(
    () => fixableIssues.filter((i) => advice[i.id]?.verdict === "recommended").map((i) => i.id),
    [fixableIssues, advice],
  );

  /**
   * Applies exactly the ids handed in.
   *
   * Takes its work as an argument rather than reading the checkbox state, so
   * "apply the recommended ones" means precisely that no matter what the user
   * has ticked — the button's label and what it does can never drift apart.
   */
  async function fixAll(ids: string[]) {
    const toFix = fixableIssues.filter((issue) => ids.includes(issue.id));
    if (toFix.length === 0) return;
    // Reflect the batch in the checkboxes, so after "apply the recommended
    // ones" the list shows exactly what was applied rather than the selection
    // the user happened to be looking at.
    setChecked(Object.fromEntries(fixableIssues.map((i) => [i.id, ids.includes(i.id)])));
    setFixing(true);
    setFixTotal(toFix.length);
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
        // Each entry is "{id}: {error}" — a PRO_REQUIRED one gets the same
        // reconnect-focused wording as the single-tweak toggle, rather than
        // Rust's raw "requires an active subscription" reaching a real
        // subscriber whose cached proof of that just went stale offline.
        failures.forEach((f) =>
          pushToast("error", f.includes("PRO_REQUIRED: ") ? s.toasts.licenseNeedsRefresh : f),
        );
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
        <>
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

          <MachineStrip s={s} profile={profile} />
          {profile && (
            <p className="mt-3 max-w-sm text-center text-[11.5px] leading-relaxed text-slate-500">
              {s.scan.tailoredNote}
            </p>
          )}
        </>
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
          {/* A bare number told the user nothing — "35" could have been 35 of
              anything. The headline now says what the number counts and what
              it is about ("worth fixing on this PC"), which is a claim the
              grouped list below can actually back up. */}
          <div className="mb-4 flex flex-col items-center gap-1">
            <span
              className={`grid h-11 w-11 place-items-center rounded-full text-lg font-black ${
                totalIssues === 0 ? "bg-emerald-400/20 text-emerald-300" : "bg-amber-400/20 text-amber-300"
              }`}
            >
              {totalIssues === 0 ? "✓" : totalIssues}
            </span>
            <p className={`text-sm font-semibold ${totalIssues === 0 ? "text-emerald-400" : "text-amber-200"}`}>
              {totalIssues === 0 ? s.scan.foundNone : format(s.scan.foundHeadline, { count: totalIssues })}
            </p>
          </div>

          {fixableIssues.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* The primary action sits above the list: after a scan the user
                  wants to act, not to scroll a checklist to find the button. */}
              {/* Two explicit choices, each carrying its own count, instead of
                  one button whose meaning depended on checkboxes further down
                  the page. "Recommended" is primary because it is the answer
                  for the user who does not want to audit a list; "all" stays
                  one click away for the user who does. */}
              <button
                onClick={() => fixAll(recommendedIds)}
                disabled={fixing || recommendedIds.length === 0}
                className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {fixing && (
                  <span
                    className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-300"
                    style={{ width: `${(fixProgress / Math.max(1, fixTotal)) * 100}%` }}
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {fixing && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  {fixing
                    ? format(s.scan.fixing, { done: fixProgress, total: fixTotal })
                    : format(s.scan.fixRecommended, { count: recommendedIds.length })}
                </span>
              </button>

              <button
                onClick={() => fixAll(fixableIssues.filter((i) => checked[i.id]).map((i) => i.id))}
                disabled={fixing || checkedCount === 0}
                className="rounded-xl border border-white/15 py-2.5 text-[13px] font-semibold text-slate-200 transition-colors hover:bg-white/5 disabled:opacity-40"
              >
                {format(s.scan.fixEverything, { count: checkedCount })}
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

              {/* Grouped by what the hardware says, strongest case first, so
                  the list reads as a set of judgements about this machine
                  rather than as an undifferentiated pile of checkboxes. The
                  groups are only rendered when the profile produced verdicts;
                  otherwise everything falls into "optional" and the headings
                  would be noise. */}
              {(
                [
                  ["recommended", s.scan.groupRecommended, "text-emerald-300"],
                  ["optional", s.scan.groupOptional, "text-slate-400"],
                  ["notrecommended", s.scan.groupNotRecommended, "text-amber-300"],
                ] as const
              ).map(([group, heading, tone]) => {
                const items = fixableIssues.filter((issue) => {
                  const verdict = advice[issue.id]?.verdict;
                  if (group === "recommended") return verdict === "recommended";
                  if (group === "notrecommended") return verdict === "notrecommended" || verdict === "unsupported";
                  return verdict === undefined || verdict === "neutral";
                });
                if (items.length === 0) return null;

                const showHeading = Object.keys(advice).length > 0;
                return (
                  <div key={group} className="flex flex-col gap-2">
                    {showHeading && (
                      <p className={`mt-2 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
                        {heading} · {items.length}
                      </p>
                    )}
                    {items.map((issue) => (
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
                            issue.kind === "cleanup"
                              ? "bg-sky-400/15 text-sky-300"
                              : "bg-fuchsia-400/15 text-fuchsia-300"
                          }`}
                        >
                          {issue.kind === "cleanup" ? (
                            <TrashIcon className="h-3.5 w-3.5" />
                          ) : (
                            <BoltIcon className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span>
                          <span className="font-medium text-slate-100">{issue.name}</span>
                          <p className="text-xs text-slate-400">{issue.description}</p>
                          <AdviceNote s={s} advice={advice[issue.id]} />
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
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

const RAM_AUTO_STORAGE_KEY = "pc-tweaker-ram-auto";

/** Only honor a stored value we actually offer: a hand-edited or stale entry
 *  must not become a rogue interval (or a 0ms one, which would spin the CPU). */
const TOKEN_KEY = "pc-tweaker-token";
const EMAIL_KEY = "pc-tweaker-email";

/**
 * The session token, from whichever store it was put in.
 *
 * localStorage survives a restart, sessionStorage does not — which is exactly
 * the difference "remember me" promises. Reading checks both so the rest of
 * the app never has to care which one was used.
 */
function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

function readStoredEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY) ?? sessionStorage.getItem(EMAIL_KEY);
}

function storeSession(token: string, email: string, remember: boolean) {
  // Clear both first, so switching the choice can never leave a stale token
  // behind in the store that is no longer being written to.
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(EMAIL_KEY, email);
}

function clearSession() {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(TOKEN_KEY);
    store.removeItem(EMAIL_KEY);
  }
}

function storedRamAutoMinutes(): number {
  const stored = Number(localStorage.getItem(RAM_AUTO_STORAGE_KEY));
  return (RAM_AUTO_INTERVALS as readonly number[]).includes(stored) ? stored : 0;
}

function ramIntervalLabel(minutes: number, s: Strings): string {
  if (minutes === 0) return s.ram.autoOff;
  const text = minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
  return format(s.ram.autoEvery, { interval: text });
}

/**
 * Module-level so the manual button and the background scheduler share one
 * guard. Two `EmptyWorkingSet` passes racing over the same process list would
 * make the "freed" figure meaningless and double the work for nothing.
 */
let ramCleanInFlight = false;

async function runRamClean(): Promise<RamCleanResult | null> {
  if (ramCleanInFlight) return null;
  ramCleanInFlight = true;
  try {
    return await invoke<RamCleanResult>("clean_ram");
  } finally {
    ramCleanInFlight = false;
  }
}

/**
 * Runs the scheduled RAM cleanup for as long as the app is open.
 *
 * This deliberately lives in `App`, not in `RamCleaner`: the card only renders
 * on the Scan screen, so hosting the timer there meant switching to any other
 * tab unmounted it and silently stopped the automatic cleanup the user had
 * just switched on.
 */
function useScheduledRamClean(autoMinutes: number) {
  useEffect(() => {
    if (autoMinutes === 0) return;
    const id = window.setInterval(() => {
      // A scheduled pass is best-effort: failing quietly beats a toast every
      // ten minutes, and the next tick will try again.
      void runRamClean().catch(() => {});
    }, autoMinutes * 60_000);
    // Clearing on change/unmount is what guarantees exactly one timer is ever
    // alive, no matter how often the user changes the interval.
    return () => window.clearInterval(id);
  }, [autoMinutes]);
}

/**
 * Asks Windows to page out the unused part of every process's working set —
 * the same thing Windows does on its own under memory pressure, just requested
 * early. Safe to run repeatedly, which is why it can also be scheduled.
 */
function RamCleaner({
  s,
  autoMinutes,
  onChangeAuto,
  pushToast,
}: {
  s: Strings;
  autoMinutes: number;
  onChangeAuto: (minutes: number) => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<RamCleanResult | null>(null);

  async function cleanNow() {
    setBusy(true);
    try {
      const result = await runRamClean();
      // `null` means a scheduled pass was already running; the button simply
      // does nothing rather than queueing a second, pointless sweep.
      if (!result) return;
      setLast(result);
      pushToast(
        "success",
        result.freed_bytes > 0
          ? format(s.ram.freed, { amount: formatBytes(result.freed_bytes) })
          : s.ram.freedNothing,
      );
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusy(false);
    }
  }

  const chooseInterval = onChangeAuto;

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
          onClick={() => void cleanNow()}
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
            <Toggle checked={item.enabled} busy={busyKey === keyOf(item)} onClick={() => toggleItem(item)} s={s} />
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

type TweakProfile = {
  format: number;
  name: string;
  created_at: string;
  tweaks: string[];
};

type LoadedProfile = { profile: TweakProfile; unknown: string[] };

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h9A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Saved configurations: capture what's applied, put it back later, or hand it
 * to someone else.
 *
 * Applying goes through the same `apply_tweaks` path as everything else, so a
 * profile can never reach a tweak the app wouldn't otherwise let the user
 * apply — including the Pro gate, which is re-checked here rather than trusted
 * from the file.
 */
function ProfilesPanel({
  s,
  tweaks,
  isPro,
  onRequirePro,
  onChanged,
  pushToast,
}: {
  s: Strings;
  tweaks: TweakInfo[];
  isPro: boolean;
  onRequirePro: () => void;
  onChanged: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [saved, setSaved] = useState<TweakProfile[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<LoadedProfile | null>(null);

  const refresh = useCallback(() => {
    invoke<TweakProfile[]>("list_profiles")
      .then(setSaved)
      .catch(() => setSaved([]));
  }, []);

  useEffect(refresh, [refresh]);

  function formatDate(epochSeconds: string): string {
    const n = Number(epochSeconds);
    if (!Number.isFinite(n) || n <= 0) return "";
    return new Date(n * 1000).toLocaleDateString();
  }

  async function saveCurrent() {
    if (!name.trim()) {
      pushToast("error", s.profiles.nameRequired);
      return;
    }
    try {
      const profile = await invoke<TweakProfile>("capture_profile", { name: name.trim() });
      await invoke("save_profile", { profile });
      pushToast("success", format(s.profiles.savedToast, { name: profile.name }));
      setName("");
      refresh();
    } catch (e) {
      pushToast("error", String(e));
    }
  }

  /**
   * Applies a profile's tweaks.
   *
   * The Pro check is done against this app's own tweak list, not against
   * anything in the file — otherwise a shared profile would be a way to hand
   * someone the paid tweaks for free.
   */
  async function applyProfile(profile: TweakProfile) {
    const locked = profile.tweaks.filter((id) => {
      const t = tweaks.find((x) => x.id === id);
      return t?.requires_pro && !isPro;
    });
    if (locked.length > 0 && !isPro) {
      onRequirePro();
      return;
    }

    setBusy(profile.name);
    try {
      const failures = await invoke<string[]>("apply_tweaks", { ids: profile.tweaks });
      failures.forEach((f) =>
        pushToast("error", f.includes("PRO_REQUIRED: ") ? s.toasts.licenseNeedsRefresh : f),
      );
      await onChanged();
      pushToast(
        "success",
        format(s.profiles.appliedToast, { count: profile.tweaks.length - failures.length }),
      );
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusy(null);
    }
  }

  async function exportProfile(profile: TweakProfile) {
    try {
      const path = await saveFileDialog({
        defaultPath: `${profile.name || "pctweaker"}.pctweaker.json`,
        filters: [{ name: "PC Tweaker profile", extensions: ["json"] }],
      });
      if (!path) return;
      await invoke("write_profile_file", { path, profile });
      pushToast("success", s.profiles.exportedToast);
    } catch (e) {
      pushToast("error", String(e));
    }
  }

  async function importProfile() {
    try {
      const picked = await openFolderDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "PC Tweaker profile", extensions: ["json"] }],
      });
      if (typeof picked !== "string") return;
      const loaded = await invoke<LoadedProfile>("read_profile_file", { path: picked });
      // Loaded, never applied: the user sees what's in it and decides.
      setPending(loaded);
      pushToast("success", format(s.profiles.importedToast, { count: loaded.profile.tweaks.length }));
      if (loaded.unknown.length > 0) {
        pushToast("error", format(s.profiles.droppedWarning, { count: loaded.unknown.length }));
      }
    } catch (e) {
      pushToast("error", String(e));
    }
  }

  async function removeProfile(profileName: string) {
    try {
      await invoke("delete_profile", { name: profileName });
      refresh();
    } catch (e) {
      pushToast("error", String(e));
    }
  }

  function ProfileRow({ profile, imported }: { profile: TweakProfile; imported?: boolean }) {
    return (
      <div
        className={`rounded-xl border p-3 ${
          imported ? "border-amber-400/30 bg-amber-400/[0.06]" : "border-white/10 bg-white/[0.04]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-slate-100">{profile.name || "—"}</span>
          <span className="text-xs text-slate-500">
            {format(s.profiles.tweakCount, { count: profile.tweaks.length })}
            {!imported && profile.created_at ? ` · ${formatDate(profile.created_at)}` : ""}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            onClick={() => applyProfile(profile)}
            disabled={busy === profile.name || profile.tweaks.length === 0}
            className="rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === profile.name ? s.profiles.applying : s.profiles.apply}
          </button>
          {!imported && (
            <>
              <button
                onClick={() => exportProfile(profile)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                {s.profiles.exportButton}
              </button>
              <button
                onClick={() => removeProfile(profile.name)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-300"
              >
                {s.profiles.deleteButton}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold text-slate-100">{s.profiles.title}</h2>
        <p className="mt-1 max-w-lg text-sm text-slate-400">{s.profiles.subtitle}</p>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {s.profiles.saveHeading}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
            placeholder={s.profiles.namePlaceholder}
            maxLength={40}
            className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--app-accent)]"
          />
          <button
            onClick={saveCurrent}
            className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-bold text-white"
          >
            {s.profiles.saveButton}
          </button>
          <button
            onClick={importProfile}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
          >
            <FolderIcon className="h-4 w-4" />
            {s.profiles.importButton}
          </button>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-500">{s.profiles.reviewNotice}</p>
      </div>

      {pending && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            {s.profiles.importButton}
          </p>
          <ProfileRow profile={pending.profile} imported />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {s.profiles.savedHeading}
        </p>
        {saved.length === 0 ? (
          <p className="text-sm text-slate-500">{s.profiles.empty}</p>
        ) : (
          saved.map((p) => <ProfileRow key={p.name} profile={p} />)
        )}
      </div>
    </div>
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

/**
 * Checks GitHub once at startup for a newer signed build and, when one
 * exists, offers it in a small card next to the toasts. The check is silent
 * on failure on purpose: dev builds have no update endpoint and an offline
 * start is not something the user can act on, so neither is worth a toast.
 * Installation goes through the updater plugin's signature verification —
 * a manifest pointing at an unsigned or tampered binary is rejected before
 * anything runs.
 */
function UpdateBanner({
  s,
  onToast,
}: {
  s: Strings;
  onToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<"offer" | "downloading" | "installing">("offer");
  const [percent, setPercent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    checkForUpdate()
      .then((u) => {
        if (alive && u) setUpdate(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!update || dismissed) return null;

  async function install() {
    if (!update) return;
    try {
      setPhase("downloading");
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total > 0) setPercent(Math.min(100, Math.round((received / total) * 100)));
        } else if (event.event === "Finished") {
          setPhase("installing");
        }
      });
      await relaunch();
    } catch (err) {
      setPhase("offer");
      onToast("error", format(s.updater.error, { message: String(err) }));
    }
  }

  return (
    <div className="animate-toast pointer-events-auto fixed bottom-6 left-6 z-40 w-80 rounded-2xl border border-white/10 bg-[#14121f]/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
          <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5">
            <path
              d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            {format(s.updater.title, { version: update.version })}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.updater.body}</p>
        </div>
      </div>
      {phase === "offer" ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={install}
            className="flex-1 rounded-lg bg-emerald-400/90 px-3 py-1.5 text-xs font-bold text-emerald-950 transition-colors hover:bg-emerald-300"
          >
            {s.updater.install}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
          >
            {s.updater.later}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs font-semibold text-emerald-300">
            {phase === "downloading" ? format(s.updater.downloading, { percent }) : s.updater.installing}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: phase === "installing" ? "100%" : `${percent}%` }}
            />
          </div>
        </div>
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
      setAuth({ status: "authenticated", email: data.email, isPro: data.isPro, emailVerified: data.emailVerified });
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
    { key: "scan", label: s.tabs.scan, icon: <MagnifierIcon className="h-[18px] w-[18px]" /> },
    { key: "performance", label: s.tabs.performance, icon: CATEGORY_STYLE.performance.icon },
    { key: "gaming", label: s.tabs.gaming, icon: CATEGORY_STYLE.gaming.icon },
    { key: "privacy", label: s.tabs.privacy, icon: CATEGORY_STYLE.privacy.icon },
    { key: "startup", label: s.tabs.startup, icon: <RocketIcon className="h-[18px] w-[18px]" /> },
    { key: "ui", label: s.tabs.ui, icon: CATEGORY_STYLE.ui.icon },
    { key: "manutenzione", label: s.tabs.manutenzione, icon: CATEGORY_STYLE.manutenzione.icon },
    { key: "profiles", label: s.tabs.profiles, icon: <FolderIcon className="h-[18px] w-[18px]" /> },
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
  // Owned here rather than inside RamCleaner so the schedule keeps running
  // when the user navigates away from the Scan screen.
  const [ramAutoMinutes, setRamAutoMinutes] = useState<number>(storedRamAutoMinutes);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (filter === "scan" || filter === "startup" || filter === "pricing" || filter === "profiles") return [];

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
  const showStartup = filter === "startup" && !searching;
  const showPricing = filter === "pricing" && !searching;
  const showProfiles = filter === "profiles" && !searching;
  const turboBoostApplied = tweaks.find((t) => t.id === "turbo_boost")?.applied ?? false;
  const appliedCount = tweaks.filter((t) => t.applied).length;
  // What the pricing page can honestly promise a Free user.
  const freeTweakCount = tweaks.filter((t) => !t.requires_pro).length;

  const currentLabel = CATEGORIES.find((c) => c.key === filter)?.label ?? "";

  return (
    <main className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,var(--app-bg-a),var(--app-bg-b)_65%)] text-slate-100 [font-family:var(--app-font)]">
      <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r border-white/5 bg-black/25 p-4 backdrop-blur-xl">
        <div className="mb-7 flex items-center gap-2.5 px-1">
          <img src="/logo-mark.png" alt="" className="h-9 w-9 shrink-0 rounded-xl shadow-lg shadow-black/40" />
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

          {showScan && (
            <RamCleaner
              s={s}
              autoMinutes={ramAutoMinutes}
              onChangeAuto={chooseRamAuto}
              pushToast={pushToast}
            />
          )}

          {showStartup && <StartupManager s={s} pushToast={pushToast} />}

          {showProfiles && (
            <ProfilesPanel
              s={s}
              tweaks={tweaks}
              isPro={isProUnlocked}
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
                    s={s}
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
                onRequirePro={() => setPaywallFeature(textFor(s.cleanup, c.id, c.name, c.description).name)}
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

      <UpdateBanner s={s} onToast={pushToast} />

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
