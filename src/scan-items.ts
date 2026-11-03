// Scan 2.0: the report as eight categories of items, each either fixable from
// the Scan (with what it would free, measured on this PC) or a finding to
// review. Pure, so the rules are tested without a window (scripts/test-scan.ts).
import type {
  AudioEndpoint,
  AudioIdleTimer,
  AudioUsbPower,
  CacheGroup,
  HardwareAudit,
  InterruptSample,
  JunkTarget,
  RegistryClass,
  RegistryItem,
  TweakInfo,
} from "./types";
import {
  audioIssues,
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
  "audio",
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
    | { type: "audio"; finding: AudioFinding; fix: string | null }
  );

/** One Audio finding (AUDIO-SPEC 5, A2-A9 and T2). `fix` is the tweak id the
 *  Scan applies for it, when it has one. */
export type AudioFinding =
  | { kind: "devices"; output: AudioEndpoint | null; input: AudioEndpoint | null }
  | { kind: "callMode"; device: string; process: string }
  | { kind: "ducking"; value: number | null; changes: TweakInfo["changes"] }
  | { kind: "idle"; timer: AudioIdleTimer }
  | { kind: "power"; device: AudioUsbPower; modernStandby: boolean }
  | { kind: "eapo"; endpoint: AudioEndpoint; stale: number; selector: boolean }
  | { kind: "effectsOff"; endpoint: AudioEndpoint }
  | { kind: "mic"; endpoint: AudioEndpoint | null; muted: boolean; level: number; name: string }
  | { kind: "bluetooth" };

export const AUDIO_DUCKING_ID = "audio_ducking_off";
export const BT_VOLUME_ID = "bt_absolute_volume_off";
/** A default microphone below this level is worth a note (A9). */
export const LOW_MIC_LEVEL = 10;

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

  items.push(...audioItems(report));

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

/** The Audio category. Fixable items carry the tweak they apply; notes (the
 *  devices, effects off, the microphone, Bluetooth volume) are never counted
 *  and never in Fix all. */
function audioItems(report: ScanReport): ScanItem[] {
  const a = report.audio;
  if (!a) return [];
  const items: ScanItem[] = [];
  const add = (
    key: string,
    finding: AudioFinding,
    over: Partial<Base> = {},
    fix: string | null = null,
  ) =>
    items.push({
      ...flags({ key: `audio:${key}`, category: "audio", ...over }),
      type: "audio",
      finding,
      fix,
    });
  const issues = audioIssues(a);
  const render = a.endpoints.find((e) => e.flow === "render" && e.default) ?? null;
  const capture = a.endpoints.find((e) => e.flow === "capture" && e.default) ?? null;

  add("devices", { kind: "devices", output: render, input: capture });
  for (const [i, c] of issues.callMode.entries())
    add(`call:${i}`, { kind: "callMode", device: c.device, process: c.process }, { issue: true });
  const ducking = report.tweaks?.find((t) => t.id === AUDIO_DUCKING_ID);
  if (issues.ducking && !ducking?.applied && !ducking?.already_set)
    add(
      "ducking",
      { kind: "ducking", value: a.ducking, changes: ducking?.changes ?? [] },
      { fixable: !!ducking, recommended: !!ducking, issue: true },
      ducking ? AUDIO_DUCKING_ID : null,
    );
  for (const timer of issues.idle)
    add(
      `idle:${timer.id}`,
      { kind: "idle", timer },
      { fixable: true, recommended: true, pro: true, admin: true, issue: true },
      timer.id,
    );
  for (const device of a.usbPower.filter((p) => p.mayPowerDown && !p.applied)) {
    const fixable = !a.modernStandby;
    add(
      `power:${device.id}`,
      { kind: "power", device, modernStandby: a.modernStandby },
      { fixable, recommended: fixable, pro: true, admin: true, issue: fixable },
      fixable ? device.id : null,
    );
  }
  if (issues.eapo)
    add(
      "eapo",
      { kind: "eapo", endpoint: issues.eapo, stale: a.eapo.stale, selector: a.eapo.selector },
      { issue: true },
    );
  // A8: upgraded to "Equalizer APO is bypassed" when it is set up there.
  for (const e of [render, capture])
    if (e?.effectsOff) add(`effects:${e.id}`, { kind: "effectsOff", endpoint: e });
  if (a.mic && (a.mic.muted || a.mic.level < LOW_MIC_LEVEL))
    add("mic", { kind: "mic", endpoint: capture, ...a.mic });
  const bt = report.tweaks?.find((t) => t.id === BT_VOLUME_ID);
  if (a.bluetooth && bt && !bt.applied) add("bluetooth", { kind: "bluetooth" });
  return items;
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
    else if (item.type === "audio" && item.fix) tweaks.push(item.fix);
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
    [
      "system_settings",
      has((i) => (i.type === "tweak" && i.tweak.requires_admin) || (i.type === "audio" && i.admin)),
    ],
    ["system_junk", has((i) => i.type === "junk" && i.target.requires_admin)],
    [
      "system_registry",
      has((i) => i.type === "registry" && i.entries.some((e) => e.hive === "HKLM")),
    ],
    ["memory", has((i) => i.type === "purge")],
  ];
  const user: [FixStepId, boolean][] = [
    [
      "settings",
      has(
        (i) => (i.type === "tweak" && !i.tweak.requires_admin) || (i.type === "audio" && !i.admin),
      ),
    ],
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
  /** Audio fixes (T1, T3, T4). */
  audio: number;
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
    audio: 0,
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
    else if (item.type === "audio" && item.fixable) t.audio++;
  }
  return t;
}

/** What Pro would add to this account's Fix all, measured on this PC. */
export const lockedTotals = (items: ScanItem[], isPro: boolean) =>
  scanTotals(items, (i) => i.fixable && i.recommended && locked(i, isPro));

export function categoryIssues(items: ScanItem[], category: ScanCategory): number {
  return items.filter((i) => i.category === category && i.issue).length;
}
