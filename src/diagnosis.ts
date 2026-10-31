// The "Copy diagnosis" text: what the last scan found and what was changed,
// as plain English lines for a support email. Built only from what the scan
// screen and Change history already show; never the account's email, a
// licence, the Windows installation ID or any hash. Tested by
// scripts/test-account-extras.mjs.
import {
  optionalScanTweaks,
  recommendedTweaks,
  SCAN_PROBES,
  scanObservations,
  type ScanReport,
} from "./scan-runner";
import { SCAN_COPY } from "./components/scan-copy";
import type { AuditEntry } from "./types";

export type DiagnosisInput = {
  appVersion: string;
  /** The app's language code, so support knows which texts the person saw. */
  lang: string;
  isPro: boolean;
  report: ScanReport;
  /** The "Fix all" / "Apply selected" result of this scan, if any. */
  outcome?: { fixed: string[]; failed: string[]; skipped: string[]; errors: string[] } | null;
  /** list_audit_log, newest first. */
  history?: AuditEntry[];
  /** This Windows user's profile folder, for redact(). */
  home?: string | null;
  now?: number;
};

const EN = SCAN_COPY.en;
const TWEAK_ACTIONS: Record<string, string> = {
  "tweak-applied": "applied",
  "tweak-reverted": "reverted",
  "tweak-auto-reverted": "reverted automatically",
};
const DISKS = { hdd: "HDD", ssd: "SSD", nvme: "NVMe" } as const;
const HISTORY_DAYS = 14;
const HISTORY_LINES = 20;

const utc = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** Drops what a pasted report must not carry even when an error message
 *  happens to contain it. `home` is this Windows user's profile folder
 *  (C:\Users\name): its last part, the user name, is replaced wherever it
 *  appears, whatever the separators or quoting (as crash.rs scrub_with does).
 *  Then, without relying on it: any other user folder (\, \\ or /, drive or
 *  \Device path), Windows account SIDs, email addresses, GUIDs and long hex
 *  identifiers. Over-redacting is accepted; leaking is not. */
export function redact(text: string, home?: string | null): string {
  let out = text;
  const user =
    home
      ?.split(/[\\/]+/)
      .filter(Boolean)
      .pop() ?? "";
  // Very short names ("PC", "Al") would blank ordinary words; the folder rules below still apply.
  if (user.length >= 3 && !/^[A-Za-z]:$/.test(user)) {
    const name = user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])`, "giu"), "<user>");
  }
  return out
    .replace(
      /((?:\\{1,2}|\/)(?:Users|Documents and Settings)(?:\\{1,2}|\/))(?!<user>)[^\\/\r\n"`]+/gi,
      "$1<user>",
    )
    .replace(/\bS-1-5-21(?:-\d+){2,4}\b/g, "<sid>")
    .replace(/[^\s@<>"']+@[^\s@<>"']+\.[A-Za-z]{2,}/g, "<email>")
    .replace(/\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?/gi, "<id>")
    .replace(/(?<![0-9a-f])[0-9a-f]{32,}(?![0-9a-f])/gi, "<id>");
}

export function diagnosisText(input: DiagnosisInput): string {
  const { report, isPro } = input;
  const now = input.now ?? Date.now();
  const names = new Map((report.tweaks ?? []).map((t) => [t.id, t.name]));
  const tweak = (id: string) => (names.has(id) ? `${names.get(id)} [${id}]` : id);
  const lines: string[] = [];
  const section = (title: string, items: string[]) => {
    if (!items.length) return;
    lines.push("", `${title} (${items.length}):`, ...items.map((item) => `- ${item}`));
  };

  const p = report.profile;
  lines.push(
    "PC Tweaker diagnosis",
    `App: ${input.appVersion || "unknown"} · Plan: ${isPro ? "Pro" : "Free"} · Language: ${input.lang}`,
    `Windows: ${p?.windows_version ?? "unknown"}, build ${p?.windows_build ?? "unknown"}`,
  );
  if (p) {
    const ram = p.ram_total_bytes ? `${Math.round(p.ram_total_bytes / 1024 ** 3)} GB RAM` : null;
    const disk = p.system_disk !== "unknown" ? `${DISKS[p.system_disk]} system disk` : null;
    const form = p.form_factor !== "unknown" ? p.form_factor : null;
    const hardware = [p.cpu, p.gpu, ram, disk, form].filter(Boolean);
    if (hardware.length) lines.push(`Hardware: ${hardware.join(" · ")}`);
  }
  const read = SCAN_PROBES.length - report.unavailable.length - report.skipped.length;
  lines.push(
    `Scan: ${utc(report.at)}, ${read} of ${SCAN_PROBES.length} checks read${report.partial ? " (partial)" : ""}`,
  );
  const missing = [
    ...report.unavailable.map((probe) => `${EN.probes[SCAN_PROBES.indexOf(probe)]} (unavailable)`),
    ...report.skipped.map((probe) => `${EN.probes[SCAN_PROBES.indexOf(probe)]} (not run)`),
  ];
  if (missing.length) lines.push(`Not read: ${missing.join(", ")}`);

  const fixes = recommendedTweaks(report, isPro);
  const locked = isPro ? [] : recommendedTweaks(report, true).filter((t) => t.requires_pro);
  section(
    EN.recommendations,
    fixes.map((t) => tweak(t.id)),
  );
  if (report.tweaks && report.advice && report.ids && !fixes.length)
    lines.push("", `${EN.recommendations}: none`);
  section(
    EN.proRecommendations,
    locked.map((t) => tweak(t.id)),
  );
  section(
    EN.review,
    scanObservations(report).map((o) => {
      const title = EN.observations[o.kind][0];
      return o.evidence ? `${title}: ${o.evidence}` : title;
    }),
  );
  section(
    EN.optional,
    optionalScanTweaks(report).map((t) => tweak(t.id)),
  );

  const outcome = input.outcome;
  if (outcome) {
    lines.push(
      "",
      `Applied from this scan: ${outcome.fixed.length} verified, ${outcome.failed.length} not applied or not verified, ${outcome.skipped.length} no longer eligible`,
      ...outcome.failed.map((id) => `- not verified: ${tweak(id)}`),
      ...outcome.errors.map((error) => `- error: ${error}`),
    );
  }

  const since = now / 1000 - HISTORY_DAYS * 86_400;
  const changes = (input.history ?? [])
    .filter((entry) => entry.action in TWEAK_ACTIONS && entry.ts >= since)
    .slice(0, HISTORY_LINES)
    .map(
      (entry) =>
        `${utc(entry.ts * 1000)} ${TWEAK_ACTIONS[entry.action]} ${tweak(entry.target)}${entry.success ? "" : " (failed)"}`,
    );
  section(`Changes in the last ${HISTORY_DAYS} days, newest first`, changes);
  if (!changes.length) lines.push("", `Changes in the last ${HISTORY_DAYS} days: none`);

  return redact(lines.join("\n"), input.home) + "\n";
}
