import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { format, Strings } from "../i18n";
import { formatBytes, LARGE_FILE_THRESHOLD_BYTES, sha1Hex } from "../lib";
import { CATEGORY_STYLE } from "../categories";
import {
  CleanupInfo,
  CleanupPreview,
  CleanupResult,
  DiskHealthInfo,
  DiskOptResult,
  DriveInfo,
  DuplicateGroup,
  FlushDnsResult,
  LargeFile,
  Toast,
} from "../types";
import { DriveIcon, GlobeIcon, HeartPulseIcon, TrashIcon } from "./icons";
import { ProBadge, ShieldBadge, SoonBadge } from "./ui";
import uninstallerIcon from "../assets/uninstaller-icon.png";

export function IpMaskCard({ s, onExplain }: { s: Strings; onExplain: () => void }) {
  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M9.5 12.5 11 14l3.5-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">{s.ipMask.title}</h2>
            <SoonBadge label={s.badges.soon} />
          </div>
          <p className="mt-0.5 text-sm text-ink-3">{s.ipMask.description}</p>
        </div>
        <button
          onClick={onExplain}
          className="shrink-0 rounded-xl bg-surface-2 px-4 py-2 text-sm font-semibold text-ink-2 transition-transform hover:scale-[1.03]"
        >
          {s.ipMask.button}
        </button>
      </div>
    </li>
  );
}

export function DuplicateFinder({
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
        format(s.duplicateFinder.deletedToast, {
          count: result.deleted_count,
          freed: formatBytes(result.freed_bytes),
        }),
      );
      setGroups(
        (g) =>
          g
            ?.map((grp) => ({ ...grp, paths: grp.paths.filter((p) => !selected.has(p)) }))
            .filter((g) => g.paths.length > 1) ?? null,
      );
      setSelected(new Set());
    } catch (e) {
      onToast("error", String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
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
            <h2 className="font-semibold text-ink">{s.duplicateFinder.title}</h2>
            <ProBadge label={s.badges.pro} />
          </div>
          <p className="mt-0.5 text-sm text-ink-3">{s.duplicateFinder.description}</p>
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
        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto border-t border-line pt-4">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-xl bg-black/20 p-3">
              <p className="mb-2 text-xs font-medium text-ink-3">
                {format(s.duplicateFinder.copies, {
                  count: g.paths.length,
                  size: formatBytes(g.size),
                })}
              </p>
              {g.paths.map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 truncate py-0.5 text-xs text-ink-2"
                >
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
            {deleting
              ? s.duplicateFinder.deleting
              : format(s.duplicateFinder.moveSelected, { count: selected.size })}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Runs Windows' own Optimize Drives (defrag/TRIM). Pro-gated: unlike temp
 * cleanup this is a heavier, higher-value action, in line with the other
 * admin-requiring maintenance tools already behind Pro.
 */
export function DiskOptimizeCard({
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
    <li className="animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30">
          <DriveIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">
              {s.diskOptimize.title} <span className="font-normal text-ink-3">({drive})</span>
            </h2>
            <ShieldBadge label={s.badges.admin} />
            <ProBadge label={s.badges.pro} />
          </div>
          <p className="mt-0.5 text-sm text-ink-3">
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
export function DnsFlushCard({
  s,
  onToast,
}: {
  s: Strings;
  onToast: (kind: Toast["kind"], message: string) => void;
}) {
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
    <li className="animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/30">
          <GlobeIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{s.dnsFlush.title}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{s.dnsFlush.description}</p>
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
export function UninstallerPromoCard({ s }: { s: Strings }) {
  function openPage() {
    void openUrl("https://github.com/AurelioAvila/pc-tweaker-uninstaller");
  }

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <img
          src={uninstallerIcon}
          alt=""
          className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-fuchsia-400/30"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{s.uninstallerPromo.title}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{s.uninstallerPromo.description}</p>
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

/** Same scan/select/delete shape as DuplicateFinder, but by size threshold
 *  instead of content hash — a different, complementary way to find space to
 *  reclaim (a single 4 GB video has no duplicate to find, but is easy to spot
 *  once it's just sorted by size). */
export function LargeFileFinder({
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
        onToast(
          "success",
          format(s.largeFiles.noneFound, { size: formatBytes(LARGE_FILE_THRESHOLD_BYTES) }),
        );
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
        format(s.largeFiles.deletedToast, {
          count: result.deleted_count,
          freed: formatBytes(result.freed_bytes),
        }),
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
    <li className="animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30">
          <TrashIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">{s.largeFiles.title}</h2>
            <ProBadge label={s.badges.pro} />
          </div>
          <p className="mt-0.5 text-sm text-ink-3">{s.largeFiles.description}</p>
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
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium text-ink-3">
            {format(s.largeFiles.foundCount, { count: files.length })}
          </p>
          <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl bg-black/20 p-3">
            {files.map((f) => (
              <label
                key={f.path}
                className="flex cursor-pointer items-center gap-2 truncate py-0.5 text-xs text-ink-2"
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.path)}
                  onChange={() => toggleSelected(f.path)}
                  className="h-3.5 w-3.5 shrink-0 accent-fuchsia-500"
                />
                <span className="shrink-0 font-medium text-ink-2">{formatBytes(f.size)}</span>
                <span className="truncate text-ink-3">{f.path}</span>
              </label>
            ))}
          </div>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0 || deleting}
            className="mt-3 w-full rounded-xl bg-red-500/90 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {deleting
              ? s.largeFiles.deleting
              : format(s.largeFiles.moveSelected, { count: selected.size })}
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
export function DiskHealthCard({ s, drive }: { s: Strings; drive: string }) {
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
        return { text: s.diskHealth.unknown, color: "text-ink-3", dot: "bg-ink-3" };
    }
  };

  const info = health ? statusLabel(health.status) : null;

  return (
    <li className="animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30">
          <HeartPulseIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{s.diskHealth.title}</h2>
          <p className="mt-0.5 text-sm text-ink-3">
            {health ? `${health.drive} · ${health.media_type}` : s.diskHealth.loading}
          </p>
        </div>
        {info && (
          <span
            className={`flex shrink-0 items-center gap-1.5 text-sm font-semibold ${info.color}`}
          >
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
export function DiskToolsSection({
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
        <li className="animate-card flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-1 p-3">
          <span className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
            {s.diskHealth.selectDrive}:
          </span>
          {drives.map((d) => (
            <button
              key={d.letter}
              onClick={() => setSelected(d.letter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selected === d.letter
                  ? "bg-rose-400/20 text-rose-300 ring-1 ring-rose-400/40"
                  : "bg-surface-2 text-ink-3 hover:bg-surface-hover hover:text-ink-2"
              }`}
            >
              {d.letter} · {d.media_type} ·{" "}
              {format(s.diskHealth.freeSpace, { size: formatBytes(d.free_bytes) })}
            </button>
          ))}
        </li>
      )}
      <DiskHealthCard s={s} drive={selected} />
      <DiskOptimizeCard
        s={s}
        drive={selected}
        isPro={isPro}
        onRequirePro={onRequirePro}
        onToast={onToast}
      />
    </>
  );
}

export function CleanupCard({
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
    <li className="animate-card group relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20 transition-all duration-200 hover:border-line-2 hover:bg-surface-2">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${style.ring}`}
      />
      <div className="relative flex items-center gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${style.chip}`}>
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">{text.name}</h2>
            {info.requires_admin && <ShieldBadge label={s.badges.admin} />}
            {info.requires_pro && <ProBadge label={s.badges.pro} />}
          </div>
          <p className="mt-0.5 text-sm text-ink-3">{text.description}</p>
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
 * Checks a password against Have I Been Pwned's Pwned Passwords range API
 * using k-anonymity: only the first 5 hex chars of the SHA-1 hash ever leave
 * the device, never the password itself or its full hash.
 */
export function PasswordBreachCheck({ s }: { s: Strings }) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    kind: "safe" | "breached" | "error";
    count?: number;
  } | null>(null);

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
    <li className="animate-card relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <rect
              x="5"
              y="11"
              width="14"
              height="9"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M8 11V7a4 4 0 0 1 8 0v4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{s.passwordCheck.title}</h2>
          <p className="mt-0.5 text-sm text-ink-3">{s.passwordCheck.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setResult(null);
              }}
              placeholder={s.passwordCheck.placeholder}
              className="min-w-0 flex-1 rounded-lg border border-line bg-black/20 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-line-2"
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
                result.kind === "safe"
                  ? "text-emerald-400"
                  : result.kind === "breached"
                    ? "text-rose-400"
                    : "text-ink-3"
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

/**
 * The cleanup confirmation dialog, upgraded from "are you sure?" to a real
 * preview: exactly which top-level items will move to the Recycle Bin, with
 * sizes, and per-item checkboxes. The preview is a read-only dry run; if it
 * cannot be loaded at all, the dialog degrades to the plain confirmation
 * rather than blocking the cleanup.
 */
export function CleanupConfirmModal({
  s,
  info,
  displayName,
  onCancel,
  onConfirmAll,
  onConfirmSelected,
}: {
  s: Strings;
  info: CleanupInfo;
  displayName: string;
  onCancel: () => void;
  onConfirmAll: () => void;
  onConfirmSelected: (names: string[]) => void;
}) {
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    invoke<CleanupPreview>("preview_cleanup", { id: info.id })
      .then((v) => {
        if (alive) setPreview(v);
      })
      .catch(() => {
        if (alive) setPreviewFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [info.id]);

  const items = preview?.items ?? [];
  const selected = items.filter((i) => !unchecked.has(i.name));
  const allSelected = unchecked.size === 0;
  const selectedBytes = selected.reduce((sum, i) => sum + i.bytes, 0);
  const loading = preview === null && !previewFailed;
  const listable = preview !== null && preview.accessible && items.length > 0;
  const nothingToClean = preview !== null && preview.accessible && preview.item_count === 0;

  function toggle(name: string) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function confirm() {
    // "Everything selected" (or no usable preview) takes the plain full path:
    // it also covers items beyond the preview cap and anything created since.
    if (!listable || allSelected) onConfirmAll();
    else onConfirmSelected(selected.map((i) => i.name));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="animate-card w-full max-w-md rounded-2xl border border-line bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-ink">{s.cleanupConfirm.title}</h3>
        <p className="mt-2 text-sm text-ink-3">
          {format(s.cleanupConfirm.body, { name: displayName })}
        </p>

        {loading && (
          <p className="mt-4 text-[12.5px] text-ink-3">{s.cleanupConfirm.previewLoading}</p>
        )}
        {nothingToClean && (
          <p className="mt-4 text-[12.5px] text-ink-3">{s.cleanupConfirm.previewEmpty}</p>
        )}
        {preview !== null && !preview.accessible && (
          <p className="mt-4 text-[12.5px] leading-relaxed text-amber-200/80">
            {s.cleanupConfirm.previewNotAccessible}
          </p>
        )}

        {listable && (
          <>
            <ul className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface-1">
              {items.map((item) => (
                <li key={item.name}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12.5px] hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={!unchecked.has(item.name)}
                      onChange={() => toggle(item.name)}
                      className="h-3.5 w-3.5 accent-sky-500"
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-2">
                      {item.name}
                      {item.is_dir && <span className="text-ink-3">{"\\"}</span>}
                    </span>
                    <span className="shrink-0 text-ink-3">{formatBytes(item.bytes)}</span>
                  </label>
                </li>
              ))}
            </ul>
            {preview.truncated && (
              <p className="mt-2 text-[11px] text-ink-3">{s.cleanupConfirm.previewTruncated}</p>
            )}
            <p className="mt-2 text-[12px] font-medium text-ink-3">
              {format(s.cleanupConfirm.selectedSummary, {
                count: selected.length,
                size: formatBytes(allSelected ? preview.total_bytes : selectedBytes),
              })}
            </p>
          </>
        )}

        <button
          onClick={confirm}
          disabled={nothingToClean || (listable && selected.length === 0)}
          className="mt-5 w-full rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {listable && !allSelected ? s.cleanupConfirm.confirmSelected : s.cleanupConfirm.confirm}
        </button>
        <button
          onClick={onCancel}
          className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-ink-3 hover:text-ink-2"
        >
          {s.cleanupConfirm.cancel}
        </button>
      </div>
    </div>
  );
}
