// The rules behind Change history: where each change came from, how changes
// are grouped into days and sessions, the filters, the summary numbers and
// the exports. Pure functions, tested without a window
// (scripts/test-history-model.mjs).
import type { AuditEntry, ValueChange } from "./types";

export type HistoryKind = "tweak" | "cleanup" | "debloat" | "system";
export type OriginKind = "switch" | "profile" | "starter" | "scan" | "reapply" | "app";

/** A history row: an audit entry, or an app removal from the Debloat history. */
export type HistoryItem = {
  /** Stable within one listing: used as the React key and for selection. */
  key: string;
  ts: number;
  action: string;
  target: string;
  success: boolean;
  elevated: boolean;
  detail: string | null;
  changes: ValueChange[];
  kind: HistoryKind;
  origin: { kind: OriginKind; label?: string };
};

export type Session = { start: number; end: number; items: HistoryItem[] };

/** Minimal shape of a Debloat history record (components/debloat.tsx). */
export type RemovalRecord = {
  catalogId: string;
  packageFullName: string;
  status: "pending" | "removed" | "failed" | "unknown";
  error: string | null;
  timestamp: number;
};

/** Two changes more than this far apart belong to different sessions. */
export const SESSION_GAP_S = 30 * 60;
/** An "origin" marker explains the changes written up to this long after it. */
const ORIGIN_WINDOW_S = 10 * 60;

const TWEAK_ACTIONS = new Set(["tweak-applied", "tweak-reverted", "tweak-auto-reverted"]);
const CLEANUP_ACTIONS = new Set([
  "cleanup",
  "files-deleted",
  "app-cache-clean",
  "cookie-clean",
  "cookie-restore",
  "disk-optimize",
  "secure-defrag",
  "secure-shred",
  "ram-trim",
  "memory-purge",
  "temp-cleanup-scheduled",
]);

export function kindOf(action: string): HistoryKind {
  if (TWEAK_ACTIONS.has(action)) return "tweak";
  if (CLEANUP_ACTIONS.has(action)) return "cleanup";
  return "system";
}

function originOf(marker: string): HistoryItem["origin"] {
  const [kind, ...rest] = marker.split(":");
  const label = rest.join(":") || undefined;
  return kind === "profile" || kind === "starter" || kind === "scan" || kind === "reapply"
    ? { kind, label }
    : { kind: "switch" };
}

/**
 * Audit entries (newest first, as the app returns them) and app removals,
 * merged newest first. "origin" markers are not rows of their own: each one
 * names where the tweak changes listed in it, written just after it, came
 * from. A tweak change with no marker was made with its own switch.
 */
export function buildHistory(entries: AuditEntry[], removals: RemovalRecord[] = []): HistoryItem[] {
  // Oldest first, so each marker claims the first apply of each of its ids
  // after it, and only that one: a later switch or a restore is not the batch.
  const claimed = new Map<number, HistoryItem["origin"]>();
  const open: { ts: number; origin: HistoryItem["origin"]; ids: Set<string> }[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.action === "origin") {
      open.push({ ts: e.ts, origin: originOf(e.target), ids: new Set((e.detail ?? "").split(",")) });
    } else if (e.action === "tweak-applied") {
      const marker = [...open]
        .reverse()
        .find((m) => m.ids.has(e.target) && e.ts >= m.ts && e.ts - m.ts <= ORIGIN_WINDOW_S);
      if (marker) {
        claimed.set(i, marker.origin);
        marker.ids.delete(e.target);
      }
    }
  }
  const items: HistoryItem[] = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.action !== "origin")
    .map(({ e, i }) => {
      const kind = kindOf(e.action);
      let origin: HistoryItem["origin"] = { kind: kind === "tweak" ? "switch" : "app" };
      if (kind === "tweak") {
        origin = claimed.get(i) ?? origin;
        if (e.action === "tweak-auto-reverted") origin = { kind: "app" };
      }
      return {
        key: `a${i}-${e.ts}`,
        ts: e.ts,
        action: e.action,
        target: e.target,
        success: e.success,
        elevated: e.elevated,
        detail: e.detail ?? null,
        changes: e.changes ?? [],
        kind,
        origin,
      };
    });
  removals.forEach((r, i) =>
    items.push({
      key: `d${i}-${r.timestamp}`,
      ts: r.timestamp,
      action: `app-removal-${r.status}`,
      target: r.catalogId,
      success: r.status === "removed",
      elevated: false,
      detail: r.error,
      changes: [],
      kind: "debloat",
      origin: { kind: "app" },
    }),
  );
  return items.sort((a, b) => b.ts - a.ts);
}

/** Newest first in, newest first out: a new session starts at every gap. */
export function sessions(items: HistoryItem[], gap = SESSION_GAP_S): Session[] {
  const out: Session[] = [];
  for (const item of items) {
    const current = out[out.length - 1];
    if (current && current.start - item.ts <= gap) {
      current.items.push(item);
      current.start = item.ts;
    } else {
      out.push({ start: item.ts, end: item.ts, items: [item] });
    }
  }
  return out;
}

export type Filters = {
  kind: HistoryKind | "all";
  outcome: "all" | "success" | "failed";
  /** Only changes at or after this time (Unix seconds); 0 for all. */
  since: number;
  query: string;
};

export const NO_FILTERS: Filters = { kind: "all", outcome: "all", since: 0, query: "" };

export function filterItems(
  items: HistoryItem[],
  f: Filters,
  nameOf: (item: HistoryItem) => string,
): HistoryItem[] {
  const q = f.query.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      (f.kind === "all" || item.kind === f.kind) &&
      (f.outcome === "all" || (f.outcome === "success") === item.success) &&
      item.ts >= f.since &&
      (!q ||
        nameOf(item).toLocaleLowerCase().includes(q) ||
        item.target.toLocaleLowerCase().includes(q) ||
        item.changes.some((c) => `${c.path}\\${c.name}`.toLocaleLowerCase().includes(q))),
  );
}

/** The headline numbers. "Undone" counts restores that worked. */
export function summary(items: HistoryItem[], activeNow: number) {
  return {
    active: activeNow,
    // Restores the user asked for; the network check's automatic ones are not.
    undone: items.filter((i) => i.success && i.action === "tweak-reverted").length,
    failed: items.filter((i) => !i.success).length,
  };
}

/**
 * The tweaks a session applied that are still in effect because of it, in
 * the order they were applied: what "Undo this session" restores. A tweak
 * restored or applied again later belongs to that later change instead.
 */
export function sessionUndoable(
  session: Session,
  appliedNow: Set<string>,
  latest: Map<string, string>,
): string[] {
  const ids: string[] = [];
  for (const item of [...session.items].reverse()) {
    if (latest.get(item.target) === item.key && appliedNow.has(item.target)) ids.push(item.target);
  }
  return ids;
}

/**
 * For each tweak, the key of its most recent successful apply: the only row
 * that can say "in effect" and offer Undo. An older apply of the same tweak
 * was superseded by a restore or a later apply.
 */
/** An apply that wrote nothing new: every recorded value was already there. */
export const unchanged = (item: HistoryItem) =>
  item.action === "tweak-applied" &&
  item.changes.length > 0 &&
  item.changes.every((c) => c.before === c.after);

export function latestApplies(items: HistoryItem[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const item of items) {
    if (item.kind !== "tweak" || latest.has(item.target) || unchanged(item)) continue;
    // Newest first: the first tweak row decides. A restore after the last
    // apply means nothing in this history is in effect for it.
    latest.set(item.target, item.action === "tweak-applied" && item.success ? item.key : "");
  }
  return latest;
}

const CSV_HEADER = [
  "time",
  "type",
  "action",
  "item",
  "origin",
  "result",
  "administrator",
  "value",
  "before",
  "after",
  "detail",
];

function csvCell(value: string): string {
  // Quoted always; a leading = + - @ is neutralised so a spreadsheet never
  // runs it as a formula.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** One line per changed value (or per change when no values were recorded). */
export function toCsv(items: HistoryItem[], nameOf: (item: HistoryItem) => string): string {
  const lines = [CSV_HEADER.map(csvCell).join(",")];
  for (const item of items) {
    const base = [
      new Date(item.ts * 1000).toISOString(),
      item.kind,
      item.action,
      nameOf(item),
      item.origin.label ? `${item.origin.kind}: ${item.origin.label}` : item.origin.kind,
      item.success ? "ok" : "failed",
      item.elevated ? "yes" : "no",
    ];
    const rows = item.changes.length
      ? item.changes.map((c) => [
          `${c.path}\\${c.name}`,
          c.before ?? "(not set)",
          c.after ?? "(not set)",
        ])
      : [["", "", ""]];
    for (const r of rows) lines.push([...base, ...r, item.detail ?? ""].map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function toJson(items: HistoryItem[], nameOf: (item: HistoryItem) => string): string {
  return (
    JSON.stringify(
      items.map((item) => ({
        time: new Date(item.ts * 1000).toISOString(),
        type: item.kind,
        action: item.action,
        item: nameOf(item),
        id: item.target,
        origin: item.origin,
        success: item.success,
        administrator: item.elevated,
        detail: item.detail,
        changes: item.changes,
      })),
      null,
      2,
    ) + "\n"
  );
}
