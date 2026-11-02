// Scan 2.0: the report as eight categories of items, each either fixable from
// the Scan (with what it would free, measured on this PC) or a finding to
// review. Pure, so the rules are tested without a window (scripts/test-scan.ts).
import type {
  CacheGroup,
  HardwareAudit,
  InterruptSample,
  JunkTarget,
  RegistryClass,
  RegistryItem,
  TweakInfo,
} from "./types";
import {
  NO_EXTRAS,
  optionalScanTweaks,
  recommendedTweaks,
  scanObservations,
  type ScanExtras,
  type ScanObservation,
  type ScanReport,
} from "./scan-runner";
import type { FixStepId } from "./fix-steps";

export const SCAN_CATEGORIES = [
  "performance",
  "junk",
  "startup",
  "privacy",
  "registry",
  "memory",
  "hardware",
  "latency",
] as const;
export type ScanCategory = (typeof SCAN_CATEGORIES)[number];

export const BOOSTER_ID = "smart_ram_booster";
/** Below this much free memory a standby release is worth recommending; the
 *  booster's own default threshold. */
export const LOW_FREE_MB = 1024;
/** A standby cache smaller than this is not worth releasing. */
export const MIN_STANDBY_MB = 512;
const MIN_JUNK_BYTES = 1024 * 1024;
export const REGISTRY_CLASSES: RegistryClass[] = [
  "uninstall",
  "app_paths",
  "mui_cache",
  "shared_dlls",
  "startup_run",
];

type Base = {
  key: string;
  category: ScanCategory;
  /** Can be applied from the Scan. */
  fixable: boolean;
  /** Part of Fix all (and pre-ticked in Custom). */
  recommended: boolean;
  /** Needs Pro: shown locked, with its gain, to everyone else. */
  pro: boolean;
  admin: boolean;
  /** Counts as something wrong in the totals; notes and states do not. */
  issue: boolean;
};

export type ScanItem = Base &
  (
    | { type: "tweak"; tweak: TweakInfo; reason: string | null; optional: boolean }
    | { type: "junk"; target: JunkTarget }
    | { type: "caches"; groups: CacheGroup[]; bytes: number; files: number }
    | { type: "registry"; cls: RegistryClass; entries: RegistryItem[] }
    | { type: "purge"; standbyMb: number; freeMb: number }
    | { type: "booster"; tweak: TweakInfo; enabled: boolean; thresholdMb: number }
    | { type: "observation"; observation: ScanObservation }
    | { type: "ram"; memory: NonNullable<HardwareAudit["memory"]> }
    | { type: "link"; link: HardwareAudit["links"][number] }
    | { type: "rebar"; rebar: HardwareAudit["rebar"][number] }
    | { type: "interrupts"; sample: InterruptSample }
    | { type: "dpc" }
  );

const OBSERVATION_CATEGORY: Record<ScanObservation["kind"], ScanCategory> = {
  storage: "junk",
  startup: "startup",
  tasks: "startup",
  memory: "memory",
  restart: "performance",
  efficiency: "performance",
  apps: "performance",
  security: "privacy",
  drivers: "hardware",
};

const flags = (over: Partial<Base> & Pick<Base, "key" | "category">): Base => ({
  fixable: false,
  recommended: false,
  pro: false,
  admin: false,
  issue: false,
  ...over,
});

/** Every item the report supports, in category order. Missing reads (an
 *  unavailable check) produce no items rather than guesses. */
export function scanItems(report: ScanReport): ScanItem[] {
  const items: ScanItem[] = [];
  const advice = new Map((report.advice ?? []).map((a) => [a.id, a.reason_key]));

  // Settings the hardware advice recommends, every tier: Pro ones show locked.
  for (const tweak of recommendedTweaks(report, true)) {
    if (tweak.id === BOOSTER_ID) continue;
    items.push({
      ...flags({
        key: `tweak:${tweak.id}`,
        category: tweak.category === "privacy" ? "privacy" : "performance",
        fixable: true,
        recommended: true,
        pro: tweak.requires_pro,
        admin: tweak.requires_admin,
        issue: true,
      }),
      type: "tweak",
      tweak,
      reason: advice.get(tweak.id) ?? null,
      optional: false,
    });
  }
  for (const tweak of optionalScanTweaks(report)) {
    if (tweak.id === BOOSTER_ID) continue;
    items.push({
      ...flags({
        key: `optional:${tweak.id}`,
        category: tweak.category === "privacy" ? "privacy" : "performance",
        pro: tweak.requires_pro,
      }),
      type: "tweak",
      tweak,
      reason: null,
      optional: true,
    });
  }

  for (const target of report.junk ?? []) {
    if (!target.accessible || target.bytes < MIN_JUNK_BYTES) continue;
    items.push({
      ...flags({
        key: `junk:${target.id}`,
        category: "junk",
        fixable: true,
        recommended: true,
        pro: target.requires_pro,
        admin: target.requires_admin,
        issue: true,
      }),
      type: "junk",
      target,
    });
  }
  const groups = (report.caches ?? []).filter((g) => g.bytes > 0);
  const cacheBytes = groups.reduce((sum, g) => sum + g.bytes, 0);
  if (cacheBytes >= MIN_JUNK_BYTES)
    items.push({
      ...flags({
        key: "caches",
        category: "junk",
        fixable: true,
        recommended: true,
        pro: true,
        issue: true,
      }),
      type: "caches",
      groups,
      bytes: cacheBytes,
      files: groups.reduce((sum, g) => sum + g.files, 0),
    });

  const entries = report.registry?.items ?? [];
  for (const cls of REGISTRY_CLASSES) {
    const found = entries.filter((e) => e.class === cls);
    if (!found.length) continue;
    items.push({
      ...flags({
        key: `registry:${cls}`,
        category: "registry",
        fixable: true,
        recommended: true,
        pro: true,
        admin: found.some((e) => e.hive === "HKLM"),
        issue: true,
      }),
      type: "registry",
      cls,
      entries: found,
    });
  }

  const memory = report.memory;
  const lists = memory?.lists;
  if (lists && lists.standby_mb >= MIN_STANDBY_MB) {
    const short = lists.free_mb < (memory.threshold_mb || LOW_FREE_MB);
    items.push({
      ...flags({
        key: "purge",
        category: "memory",
        fixable: true,
        recommended: short,
        pro: true,
        admin: true,
        issue: short,
      }),
      type: "purge",
      standbyMb: lists.standby_mb,
      freeMb: lists.free_mb,
    });
  }
  const booster = report.tweaks?.find((t) => t.id === BOOSTER_ID);
  if (booster) {
    const enabled = booster.applied || !!booster.already_set || !!memory?.enabled;
    items.push({
      ...flags({ key: "booster", category: "memory", fixable: !enabled, pro: true }),
      type: "booster",
      tweak: booster,
      enabled,
      thresholdMb: memory?.threshold_mb || LOW_FREE_MB,
    });
  }

  const hardware = report.hardware;
  if (hardware?.memory)
    items.push({
      ...flags({ key: "hw:ram", category: "hardware", issue: hardware.memory.below_rated }),
      type: "ram",
      memory: hardware.memory,
    });
  for (const [i, link] of (hardware?.links ?? []).entries())
    items.push({
      ...flags({ key: `hw:link:${i}`, category: "hardware", issue: link.below_max }),
      type: "link",
      link,
    });
  for (const [i, rebar] of (hardware?.rebar ?? []).entries())
    if (rebar.state !== "not_supported")
      items.push({
        ...flags({ key: `hw:rebar:${i}`, category: "hardware", issue: rebar.state === "off" }),
        type: "rebar",
        rebar,
      });

  if (report.latency)
    items.push({
      ...flags({
        key: "latency:interrupts",
        category: "latency",
        issue: report.latency.concentrated,
      }),
      type: "interrupts",
      sample: report.latency,
    });
  items.push({ ...flags({ key: "latency:dpc", category: "latency" }), type: "dpc" });

  for (const observation of scanObservations(report))
    items.push({
      ...flags({
        key: `review:${observation.id}`,
        category: OBSERVATION_CATEGORY[observation.kind],
        issue: observation.warning,
      }),
      type: "observation",
      observation,
    });

  const order = (c: ScanCategory) => SCAN_CATEGORIES.indexOf(c);
  return items.sort((a, b) => order(a.category) - order(b.category));
}

/** Locked for this account: needs Pro it does not have. */
export const locked = (item: ScanItem, isPro: boolean) => item.pro && !isPro;

/** What Fix all applies for this account. */
export function fixAllKeys(items: ScanItem[], isPro: boolean): string[] {
  return items.filter((i) => i.fixable && i.recommended && !locked(i, isPro)).map((i) => i.key);
}

/** The native plan for a set of item keys; locked and review items are
 *  never part of it, whatever the keys say. */
export function fixPlan(
  items: ScanItem[],
  keys: Iterable<string>,
  isPro: boolean,
): { tweaks: string[]; extras: ScanExtras; booster: boolean } {
  const wanted = new Set(keys);
  const extras: ScanExtras = { ...NO_EXTRAS, cleanups: [], app_caches: [], registry: [] };
  const tweaks: string[] = [];
  let booster = false;
  for (const item of items) {
    if (!wanted.has(item.key) || !item.fixable || locked(item, isPro)) continue;
    // The booster is a switch, not a hardware recommendation: it is applied
    // on its own (`apply_tweak`), never through the Scan's eligibility gate.
    if (item.type === "booster") booster = true;
    else if (item.type === "tweak") tweaks.push(item.tweak.id);
    else if (item.type === "junk") extras.cleanups.push(item.target.id);
    else if (item.type === "caches") extras.app_caches.push(...item.groups.map((g) => g.id));
    else if (item.type === "registry") extras.registry.push(...item.entries.map((e) => e.id));
    else if (item.type === "purge") extras.purge = true;
  }
  return { tweaks, extras, booster };
}

/** The steps a fix of these items will run, in the backend's order
 *  (scanfix.rs `fix_parts`: the administrator part first), so the progress
 *  ring lists them from the start; the backend's own plan replaces them. */
export function fixSteps(items: ScanItem[], keys: Iterable<string>, isPro: boolean): FixStepId[] {
  const wanted = new Set(keys);
  const chosen = items.filter((i) => wanted.has(i.key) && i.fixable && !locked(i, isPro));
  const has = (test: (i: ScanItem) => boolean) => chosen.some(test);
  const system: [FixStepId, boolean][] = [
    ["system_settings", has((i) => i.type === "tweak" && i.tweak.requires_admin)],
    ["system_junk", has((i) => i.type === "junk" && i.target.requires_admin)],
    [
      "system_registry",
      has((i) => i.type === "registry" && i.entries.some((e) => e.hive === "HKLM")),
    ],
    ["memory", has((i) => i.type === "purge")],
  ];
  const user: [FixStepId, boolean][] = [
    ["settings", has((i) => i.type === "tweak" && !i.tweak.requires_admin)],
    ["junk", has((i) => i.type === "junk" && !i.target.requires_admin)],
    ["caches", has((i) => i.type === "caches")],
    ["registry", has((i) => i.type === "registry" && i.entries.some((e) => e.hive === "HKCU"))],
    ["booster", has((i) => i.type === "booster")],
  ];
  const elevated = system.some(([, on]) => on);
  return [
    ...(elevated ? (["restore_point"] as FixStepId[]) : []),
    ...[...system, ...user].filter(([, on]) => on).map(([id]) => id),
  ];
}

/** Measured totals for the headline and the Pro line. */
export type ScanTotals = {
  junkBytes: number;
  junkFiles: number;
  /** Performance settings: what "slowing you down" counts. */
  settings: number;
  privacy: number;
  registry: number;
  standbyMb: number;
  freeMb: number | null;
  hardware: number;
  issues: number;
};

export function scanTotals(items: ScanItem[], only: (i: ScanItem) => boolean = () => true) {
  const t: ScanTotals = {
    junkBytes: 0,
    junkFiles: 0,
    settings: 0,
    privacy: 0,
    registry: 0,
    standbyMb: 0,
    freeMb: null,
    hardware: 0,
    issues: 0,
  };
  for (const item of items.filter(only)) {
    if (item.issue) t.issues++;
    if (item.type === "junk") {
      t.junkBytes += item.target.bytes;
      t.junkFiles += item.target.files;
    } else if (item.type === "caches") {
      t.junkBytes += item.bytes;
      t.junkFiles += item.files;
    } else if (item.type === "tweak" && !item.optional) {
      // Privacy switches are findings of their own, never "slowing you down".
      if (item.category === "privacy") t.privacy++;
      else t.settings++;
    } else if (item.type === "registry") t.registry += item.entries.length;
    else if (item.type === "purge") {
      t.standbyMb = item.standbyMb;
      t.freeMb = item.freeMb;
    } else if (item.category === "hardware" && item.issue) t.hardware++;
  }
  return t;
}

/** What Pro would add to this account's Fix all, measured on this PC. */
export const lockedTotals = (items: ScanItem[], isPro: boolean) =>
  scanTotals(items, (i) => i.fixable && i.recommended && locked(i, isPro));

export function categoryIssues(items: ScanItem[], category: ScanCategory): number {
  return items.filter((i) => i.category === category && i.issue).length;
}
