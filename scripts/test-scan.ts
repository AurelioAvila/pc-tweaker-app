import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectScan,
  readLastScan,
  recommendedTweaks,
  optionalScanTweaks,
  scanObservations,
  unknownSecuritySignals,
  applyScanSelection,
  SCAN_PROBES,
  type ScanReport,
} from "../src/scan-runner";
import type { TweakInfo } from "../src/types";
const tweak = (id: string, extra = {}) =>
  ({
    id,
    name: id,
    description: "",
    category: "performance",
    hive: "HKCU",
    changes: [],
    requires_admin: false,
    requires_pro: false,
    applied: false,
    ...extra,
  }) as TweakInfo;
const report = (extra = {}) =>
  ({
    tweaks: [],
    ids: [],
    advice: [],
    profile: null,
    drives: [],
    startup: [],
    stats: null,
    reboot: false,
    health: null,
    drivers: null,
    tasks: [],
    apps: [],
    eco: null,
    unavailable: [],
    partial: false,
    at: Date.now(),
    ...extra,
  }) as ScanReport;

test("all native reads report monotonic real progress; failures stay unknown", async () => {
  const calls: string[] = [];
  const progress: number[] = [];
  const r = await collectScan(
    async <T>(command: string) => {
      calls.push(command);
      if (command === "driver_audit") throw Error("denied");
      return [] as T;
    },
    (p) => progress.push(p),
  );
  assert.equal(new Set(calls).size, SCAN_PROBES.length);
  assert.equal(progress.at(-1), 100);
  assert.ok(progress.every((p, i) => !i || p >= progress[i - 1]));
  assert.deepEqual(r.unavailable, ["driver_audit"]);
  assert.equal(r.drivers, null);
  assert.equal(r.partial, true);
  const failed = await collectScan(
    async () => {
      throw Error("unavailable");
    },
    () => {},
  );
  assert.equal(failed.unavailable.length, SCAN_PROBES.length);
  assert.deepEqual(recommendedTweaks(failed, true), []);
});
test("new checks offer genuine review items without turning optional apps or tasks into defects", () => {
  const r = report({
    tasks: [
      { name: "Updater", enabled: true },
      { name: "Off", enabled: false },
    ],
    apps: [
      { name: "Weather", installed: true, removable: true },
      { name: "Core", installed: true, removable: false },
    ],
    eco: { enabled: true, blocked_global: true },
  });
  const rows = scanObservations(r);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.warning, row.section]),
    [
      ["tasks", false, "startup"],
      ["apps", false, "debloat"],
      ["efficiency", true, "performance"],
    ],
  );
  assert.deepEqual(recommendedTweaks(r, true), []);
  assert.equal(rows[0].evidence, "Updater");
  assert.equal(rows[1].evidence, "Weather");
  assert.deepEqual(scanObservations(report({ eco: { enabled: false, blocked_global: true } })), []);
});
test("fixes require supported hardware advice and respect tiers and dedicated controls", () => {
  const tweaks = [
    tweak("ok"),
    tweak("paid", { requires_pro: true }),
    tweak("optional"),
    tweak("outside"),
    tweak("ecoqos_rules"),
    tweak("turbo_boost"),
    tweak("done", { applied: true }),
    // Set by Windows or another tool: nothing to fix, never part of Fix all.
    tweak("elsewhere", { already_set: true }),
  ];
  const r = report({
    tweaks,
    ids: tweaks.filter((t) => t.id !== "outside").map((t) => t.id),
    advice: tweaks.map((t) => ({
      id: t.id,
      verdict: t.id === "optional" ? "neutral" : "recommended",
      reason_key: null,
    })),
  });
  assert.deepEqual(
    recommendedTweaks(r, false).map((t) => t.id),
    ["ok"],
  );
  assert.deepEqual(
    recommendedTweaks(r, true).map((t) => t.id),
    ["ok", "paid"],
  );
  assert.deepEqual(recommendedTweaks({ ...r, advice: null }, true), []);
});
test("neutral scan settings stay review-only and cannot leak into Fix all", () => {
  const tweaks = [
    tweak("neutral"),
    tweak("paid", { requires_pro: true }),
    tweak("done", { applied: true }),
    tweak("unsupported"),
    tweak("discouraged"),
    tweak("outside"),
    tweak("turbo_boost"),
    tweak("ecoqos_rules"),
  ];
  const r = report({
    tweaks,
    ids: tweaks.filter((t) => t.id !== "outside").map((t) => t.id),
    advice: tweaks.map((t) => ({
      id: t.id,
      verdict:
        t.id === "unsupported"
          ? "unsupported"
          : t.id === "discouraged"
            ? "notrecommended"
            : "neutral",
    })),
  });
  assert.deepEqual(
    optionalScanTweaks(r).map((t) => t.id),
    ["neutral", "paid"],
  );
  assert.deepEqual(recommendedTweaks(r, true), []);
  assert.deepEqual(optionalScanTweaks({ ...r, advice: null }), []);
  assert.deepEqual(optionalScanTweaks({ ...r, ids: null }), []);
});

test("diagnostics distinguish measurements, manual reviews and unknown security", () => {
  const r = report({
    drives: [
      { letter: "C:", total_bytes: 100, free_bytes: 8 },
      { letter: "D:", total_bytes: 100, free_bytes: 80 },
    ],
    startup: [{ name: "Chat", enabled: true }],
    stats: { ram_used: 20, ram_total: 100 },
    drivers: { entries: [{ device: "Old", date: "2022-01-01", version: "1", age_days: 1000 }] },
    health: {
      report: {
        categories: [
          {
            id: "security",
            factors: [
              { id: "sec_defender", earned: 20 },
              { id: "sec_uac", earned: 0, label: "UAC" },
              { id: "sec_smartscreen", earned: 15 },
            ],
          },
        ],
      },
    },
  });
  const rows = scanObservations(r);
  assert.deepEqual(
    rows.map((x) => x.kind),
    ["storage", "startup", "security", "drivers"],
  );
  assert.equal(rows.at(-1)?.warning, false);
  assert.equal(rows[2].id, "sec_uac");
});
test("Fix all revalidates eligibility, applies once and verifies actual state including partial failure", async () => {
  const ts = [tweak("ok"), tweak("fails"), tweak("changed")];
  const r = report({
    tweaks: ts,
    ids: ts.map((t) => t.id),
    advice: ts.map((t) => ({ id: t.id, verdict: "recommended" })),
  });
  let writes = 0,
    read = 0;
  let submitted: string[] = [];
  const result = await applyScanSelection(
    async <T>(cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "list_tweaks") {
        read++;
        return (read === 1 ? ts : ts.map((t) => ({ ...t, applied: t.id === "ok" }))) as T;
      }
      if (cmd === "scan_relevant_ids") return ["ok", "fails"] as T;
      if (cmd === "advise_tweaks") return r.advice as T;
      if (cmd === "scan_fix") {
        writes++;
        const plan = args?.plan as { tweaks: string[] };
        submitted = plan.tweaks;
        return {
          tweak_errors: ["fails: denied"],
          cleanups: [],
          app_caches: null,
          registry: null,
          purge: null,
          errors: [],
        } as T;
      }
      throw Error(cmd);
    },
    r,
    true,
    ["ok", "ok", "fails", "changed", "injected"],
  );
  assert.equal(writes, 1);
  assert.deepEqual(submitted, ["ok", "fails"]);
  assert.deepEqual(result.fixed, ["ok"]);
  assert.deepEqual(result.failed, ["fails"]);
  assert.deepEqual(result.skipped, ["changed"]);
});
test("failed eligibility read never writes; failed verification never reports success", async () => {
  const r = report({
    tweaks: [tweak("ok")],
    ids: ["ok"],
    advice: [{ id: "ok", verdict: "recommended" }],
  });
  let writes = 0;
  await assert.rejects(
    applyScanSelection(
      async <T>(cmd: string) => {
        if (cmd === "scan_fix") writes++;
        throw Error("read failure");
      },
      r,
      true,
      ["ok"],
    ),
  );
  assert.equal(writes, 0);
  let reads = 0;
  const result = await applyScanSelection(
    async <T>(cmd: string) => {
      if (cmd === "list_tweaks") {
        if (++reads > 1) throw Error("verify failed");
        return r.tweaks as T;
      }
      if (cmd === "scan_relevant_ids") return r.ids as T;
      if (cmd === "advise_tweaks") return r.advice as T;
      if (cmd === "scan_fix")
        return {
          tweak_errors: [],
          cleanups: [],
          app_caches: null,
          registry: null,
          purge: null,
          errors: [],
        } as T;
      throw Error(cmd);
    },
    r,
    true,
    ["ok"],
  );
  assert.deepEqual(result.fixed, []);
  assert.deepEqual(result.failed, ["ok"]);
  assert.equal(result.tweaks, null);
});
test("last scan rejects corrupt and future timestamps", () => {
  for (const raw of [
    "invalid",
    "null",
    "{}",
    JSON.stringify({ at: Date.now() + 60000, partial: false }),
  ])
    assert.equal(readLastScan(raw), null);
  const valid = { at: Date.now() - 1000, partial: true };
  assert.deepEqual(readLastScan(JSON.stringify(valid)), valid);
});

test("unknown security signals are not reported as passed or disabled", () => {
  const r = report({
    health: {
      report: {
        categories: [
          {
            id: "security",
            factors: [
              { id: "sec_defender", label: "Defender", earned: 20, evidence: "Unreadable" },
              { id: "sec_uac", label: "UAC", earned: 30, evidence: "On" },
              { id: "sec_smartscreen", label: "SmartScreen", earned: 15, evidence: "Unknown" },
            ],
          },
        ],
      },
    },
  });
  // Known ids are named in the user's language; evidence without a key keeps its English.
  assert.deepEqual(unknownSecuritySignals(r), [
    "Real-time antivirus: Unreadable",
    "SmartScreen: Unknown",
  ]);
  assert.deepEqual(unknownSecuritySignals(r, "fr"), [
    "Antivirus en temps réel : Unreadable",
    "SmartScreen : Unknown",
  ]);
  assert.deepEqual(scanObservations(r), []);
});

test("stopping a scan rejects at once, drops late answers and lets the next scan run", async () => {
  const { ScanCancelled } = await import("../src/scan-runner");
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const calls: { command: string; args?: Record<string, unknown> }[] = [];
  const slowDrivers = async <T>(command: string, args?: Record<string, unknown>) => {
    calls.push({ command, args });
    if (command === "driver_audit") await held;
    return [] as T;
  };
  const controller = new AbortController();
  const states: string[] = [];
  const running = collectScan(
    slowDrivers,
    (_p, probe, state) => states.push(`${probe}:${state}`),
    controller.signal,
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(states.includes("driver_audit:reading"));
  const before = states.length;
  controller.abort();
  controller.abort(); // a second click changes nothing
  const started = Date.now();
  await assert.rejects(running, (e) => e instanceof ScanCancelled);
  assert.ok(Date.now() - started < 1000, "did not wait for the slow read");
  // The audit was told it may be cancelled; nothing after the stop is reported.
  assert.equal(calls.find((c) => c.command === "driver_audit")?.args?.cancellable, true);
  release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(states.length, before, "no progress after the stop");

  // A scan started after the cancelled one completes normally.
  const again = await collectScan(
    async <T>() => [] as T,
    () => undefined,
    new AbortController().signal,
  );
  assert.equal(again.unavailable.length, 0);
  assert.equal(again.partial, false);
});

test("a signal aborted before the scan starts reads nothing", async () => {
  const { ScanCancelled } = await import("../src/scan-runner");
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    collectScan(
      async <T>() => (calls++, [] as T),
      () => undefined,
      controller.signal,
    ),
    (e) => e instanceof ScanCancelled,
  );
  assert.equal(calls, 0);
});

test("a paused scan keeps what it finished and a resume reads only what is missing", async () => {
  const { newScanSession, runScanSession, scanReport, finishedSteps } =
    await import("../src/scan-runner");
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const calls: string[] = [];
  const auditArgs: unknown[] = [];
  const reads = async <T>(command: string, args?: Record<string, unknown>) => {
    calls.push(command);
    if (command === "driver_audit") {
      auditArgs.push(args);
      await held;
    }
    if (command === "health_report") throw Error("denied");
    return [] as T;
  };
  const session = newScanSession();
  const pause = new AbortController();
  const running = runScanSession(reads, session, () => undefined, pause.signal);
  await new Promise((resolve) => setTimeout(resolve, 10));
  pause.abort();
  pause.abort(); // a double click changes nothing
  assert.equal(await running, false, "paused, not finished");
  release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(finishedSteps(session), SCAN_PROBES.length - 1, "everything but the audit kept");
  assert.equal(session.steps.driver_audit, undefined, "the late audit answer is dropped");

  // Readable while paused: what ran, what failed and what never ran are distinct.
  const partial = scanReport(session);
  assert.deepEqual(partial.skipped, ["driver_audit"]);
  assert.deepEqual(partial.unavailable, ["health_report"]);
  assert.equal(partial.partial, true);

  // Resume: only the missing read runs, under the same session id.
  calls.length = 0;
  assert.equal(await runScanSession(reads, session, () => undefined), true);
  assert.deepEqual(calls, ["driver_audit"]);
  assert.equal((auditArgs[0] as { session: string }).session, session.id);
  assert.equal((auditArgs[1] as { session: string }).session, session.id);
  const full = scanReport(session);
  assert.deepEqual(full.skipped, []);
  assert.deepEqual(full.unavailable, ["health_report"]);

  // A scan run again after ending starts from nothing.
  calls.length = 0;
  const again = newScanSession();
  assert.notEqual(again.id, session.id);
  assert.equal(
    await runScanSession(
      async <T>(c: string) => (calls.push(c), [] as T),
      again,
      () => undefined,
    ),
    true,
  );
  assert.equal(new Set(calls).size, SCAN_PROBES.length);
});

test("pausing during the last read resumes with just that read", async () => {
  const { newScanSession, runScanSession } = await import("../src/scan-runner");
  const session = newScanSession();
  const pause = new AbortController();
  const last = new Promise<void>(() => undefined); // never answers before the pause
  const reads = async <T>(command: string) => {
    if (command === "ecoqos_status") await last;
    return [] as T;
  };
  const running = runScanSession(reads, session, () => undefined, pause.signal);
  await new Promise((resolve) => setTimeout(resolve, 10));
  pause.abort();
  assert.equal(await running, false);
  const resumed: string[] = [];
  await runScanSession(
    async <T>(c: string) => (resumed.push(c), [] as T),
    session,
    () => undefined,
  );
  assert.deepEqual(resumed, ["ecoqos_status"]);
});

test("scan ring: at least SCAN_MIN_MS, never a check done early, never 100 before the scan returns", async () => {
  const { SCAN_WEIGHT, SCAN_MIN_MS, scanShare, scanDwellMs, scanRingTarget } =
    await import("../src/scan-runner");
  assert.deepEqual(
    Object.keys(SCAN_WEIGHT).sort(),
    [...SCAN_PROBES].sort(),
    "every check weighted",
  );
  const sum = (f: (p: (typeof SCAN_PROBES)[number]) => number) =>
    SCAN_PROBES.reduce((total, p) => total + f(p), 0);
  assert.equal(
    sum((p) => SCAN_WEIGHT[p]),
    100,
  );
  assert.ok(Math.abs(sum(scanShare) - 100) < 1e-9, "the slices fill the ring");
  assert.ok(Math.abs(sum(scanDwellMs) - SCAN_MIN_MS) < 1e-6, "the times add up to the minimum");
  assert.ok(SCAN_MIN_MS >= 60_000);
  assert.ok(scanDwellMs("driver_audit") > scanDwellMs("system_stats"), "weighted");
  assert.ok(scanDwellMs("system_stats") >= 1500, "every check readable");

  const head = "junk_summary" as const;
  const t = (headMs: number, headDone: boolean, ticked = [] as (typeof SCAN_PROBES)[number][]) =>
    scanRingTarget({ ticked, head, headDone, headMs, finished: false });
  const slice = scanShare(head);
  // A finished check fills its slice over its time on screen, exactly.
  assert.equal(t(0, true), 0);
  assert.ok(Math.abs(t(scanDwellMs(head) / 2, true) - slice / 2) < 1e-9);
  assert.ok(Math.abs(t(scanDwellMs(head), true) - slice) < 1e-9);
  assert.ok(Math.abs(t(10 * scanDwellMs(head), true) - slice) < 1e-9, "never past its slice");
  // A check still reading never reaches the end of its slice, however long.
  assert.ok(t(10 * 60_000, false) < slice * 0.93);
  let last = 0;
  for (let ms = 0; ms <= 30_000; ms += 500) {
    assert.ok(t(ms, false) <= t(ms, true), "reading is never ahead of finished");
    assert.ok(t(ms, false) >= last, "monotonic while reading");
    last = t(ms, false);
  }
  // Ticked checks count in full; 99 until the scan returns, then 100.
  assert.ok(Math.abs(t(0, true, ["list_tweaks"]) - scanShare("list_tweaks")) < 1e-9);
  const all = [...SCAN_PROBES];
  const done = { ticked: all, head: null, headDone: false, headMs: 0 };
  assert.equal(scanRingTarget({ ...done, finished: false }), 99);
  assert.equal(scanRingTarget({ ...done, finished: true }), 100);
  assert.equal(
    scanRingTarget({
      ticked: all.slice(0, -1),
      head: all[all.length - 1],
      headDone: true,
      headMs: 1e9,
      finished: true,
    }),
    99,
    "the last check is still on screen",
  );
});

test("a pause waits for the backend audit before anything can resume or discard it", async () => {
  const { newScanSession, runScanSession, settled } = await import("../src/scan-runner");
  const order: string[] = [];
  let finishFirst!: () => void;
  const firstAudit = new Promise<void>((resolve) => (finishFirst = resolve));
  let audits = 0;
  const reads = async <T>(command: string) => {
    if (command === "driver_audit") {
      audits++;
      if (audits === 1) {
        await firstAudit;
        order.push("first audit saved its place");
        throw Error("SCAN_CANCELLED");
      }
      order.push("resumed audit started");
    }
    return [] as T;
  };
  const session = newScanSession();
  const pause = new AbortController();
  const running = runScanSession(reads, session, () => undefined, pause.signal);
  await new Promise((resolve) => setTimeout(resolve, 10));
  pause.abort();
  assert.equal(await running, false);
  const waiting = settled(session).then(() => order.push("settled"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(order, [], "still waiting for the backend");
  finishFirst();
  await waiting;
  await runScanSession(reads, session, () => undefined);
  assert.deepEqual(order, ["first audit saved its place", "settled", "resumed audit started"]);
});

// ---- Scan 2.0 (1.19): categories, Fix all / Custom, measured totals ----
import {
  fixAllKeys,
  fixPlan,
  lockedTotals,
  scanItems,
  scanTotals,
  BOOSTER_ID,
} from "../src/scan-items";

const busyReport = () => {
  const ts = [
    tweak("perf_free"),
    tweak("perf_pro", { requires_pro: true, requires_admin: true }),
    tweak("privacy_free", { category: "privacy" }),
    tweak(BOOSTER_ID, { requires_pro: true, category: "maintenance" }),
  ];
  return report({
    tweaks: ts,
    ids: ["perf_free", "perf_pro", "privacy_free"],
    advice: ["perf_free", "perf_pro", "privacy_free"].map((id) => ({ id, verdict: "recommended" })),
    junk: [
      {
        id: "temp_cleanup",
        files: 1284,
        bytes: 2.3e9,
        accessible: true,
        requires_admin: false,
        requires_pro: false,
      },
      {
        id: "winupdate_cache_cleanup",
        files: 3,
        bytes: 5e8,
        accessible: true,
        requires_admin: true,
        requires_pro: true,
      },
      {
        id: "unreadable",
        files: 0,
        bytes: 9e9,
        accessible: false,
        requires_admin: false,
        requires_pro: false,
      },
    ],
    caches: [
      { id: "shader_dx", category: "shaders", name: "DX", bytes: 4e8, files: 10, blocked_by: "" },
    ],
    registry: {
      items: [
        {
          id: "r1",
          class: "uninstall",
          hive: "HKLM",
          key: "k",
          value: null,
          label: "Gone",
          missing: "C:/x",
        },
        {
          id: "r2",
          class: "mui_cache",
          hive: "HKCU",
          key: "k",
          value: "v",
          label: "Gone",
          missing: "C:/y",
        },
      ],
    },
    memory: {
      enabled: false,
      threshold_mb: 1024,
      can_run: false,
      lists: { free_mb: 300, standby_mb: 6000, modified_mb: 0 },
      total_mb: 16000,
      last: null,
      session_count: 0,
      session_freed_mb: 0,
      last_skip: null,
    },
    hardware: {
      memory: {
        configured_mts: 2133,
        rated_mts: 3600,
        rated_source: "part_number",
        part_number: "F4-3600C16",
        generation: "DDR4",
        modules: 2,
        below_rated: true,
      },
      links: [
        {
          kind: "gpu",
          name: "GPU",
          current_gen: 1,
          max_gen: 4,
          current_width: 16,
          max_width: 16,
          below_max: false,
        },
      ],
      rebar: [{ gpu: "GTX", state: "not_supported", largest_window_mb: 256 }],
    },
    latency: {
      seconds: 1.5,
      cpus: 16,
      interrupts_per_sec: 9000,
      dpcs_per_sec: 900,
      cpu0_interrupt_share: 0.5,
      cpu0_dpc_share: 0.7,
      concentrated: true,
    },
  });
};

test("Scan 2.0 puts every finding in its category with measured totals", () => {
  const items = scanItems(busyReport());
  const cats = (category: string) => items.filter((i) => i.category === category).map((i) => i.key);
  assert.deepEqual(
    cats("performance"),
    ["tweak:perf_free", "tweak:perf_pro", "review:startup"].filter((k) =>
      items.some((i) => i.key === k),
    ),
  );
  assert.deepEqual(cats("privacy"), ["tweak:privacy_free"]);
  assert.deepEqual(cats("junk"), ["junk:temp_cleanup", "junk:winupdate_cache_cleanup", "caches"]);
  assert.deepEqual(cats("registry"), ["registry:uninstall", "registry:mui_cache"]);
  assert.deepEqual(cats("memory"), ["purge", "booster"]);
  // A GPU that cannot use Resizable BAR is not a finding at all.
  assert.deepEqual(cats("hardware"), ["hw:ram", "hw:link:0"]);
  assert.deepEqual(cats("latency"), ["latency:interrupts", "latency:dpc"]);
  const t = scanTotals(items);
  // The unreadable folder counts nothing; privacy is never "slowing you down".
  assert.equal(t.junkBytes, 2.3e9 + 5e8 + 4e8);
  assert.equal(t.junkFiles, 1284 + 3 + 10);
  assert.equal(t.settings, 2);
  assert.equal(t.privacy, 1);
  assert.equal(t.registry, 2);
  assert.equal(t.standbyMb, 6000);
});

test("Fix all never includes Pro items for Free, review rows or the booster", () => {
  const items = scanItems(busyReport());
  assert.deepEqual(
    fixAllKeys(items, false),
    ["tweak:perf_free", "junk:temp_cleanup", "tweak:privacy_free"].sort(
      (a, b) => items.findIndex((i) => i.key === a) - items.findIndex((i) => i.key === b),
    ),
  );
  const pro = fixAllKeys(items, true);
  assert.ok(pro.includes("purge") && pro.includes("registry:mui_cache") && pro.includes("caches"));
  assert.ok(!pro.includes("booster"), "a background switch is a choice, not a fix");
  // Forged keys for locked or review items are dropped from the native plan.
  const free = fixPlan(
    items,
    ["tweak:perf_pro", "purge", "registry:uninstall", "hw:ram", "booster", "junk:temp_cleanup"],
    false,
  );
  assert.deepEqual(free.tweaks, []);
  assert.deepEqual(free.extras, {
    cleanups: ["temp_cleanup"],
    app_caches: [],
    registry: [],
    purge: false,
  });
  assert.equal(free.booster, false);
  const all = fixPlan(items, [...pro, "booster"], true);
  assert.deepEqual(all.tweaks.sort(), ["perf_free", "perf_pro", "privacy_free"]);
  assert.deepEqual(all.extras.registry, ["r1", "r2"]);
  assert.deepEqual(all.extras.app_caches, ["shader_dx"]);
  assert.equal(all.extras.purge, true);
  assert.equal(all.booster, true);
});

test("the Pro line states only what is locked, measured", () => {
  const items = scanItems(busyReport());
  const locked = lockedTotals(items, false);
  assert.equal(locked.junkBytes, 5e8 + 4e8);
  assert.equal(locked.registry, 2);
  assert.equal(locked.standbyMb, 6000);
  assert.equal(locked.settings, 1);
  assert.deepEqual(lockedTotals(items, true).junkBytes, 0);
});

test("plenty of free memory is not a finding; missing reads produce no items", () => {
  const r = busyReport();
  r.memory = { ...r.memory!, lists: { free_mb: 9000, standby_mb: 6000, modified_mb: 0 } };
  const purge = scanItems(r).find((i) => i.key === "purge");
  assert.equal(purge?.recommended, false);
  assert.equal(purge?.issue, false);
  const empty = scanItems(report());
  assert.deepEqual(
    empty.map((i) => i.key),
    ["latency:dpc"],
  );
});

import { applyStepEvent, bands, closeWork, creep, initialSteps } from "../src/fix-steps";

test("fix progress: the backend plan replaces the generic step, measurements stay at the ends", () => {
  let steps = applyStepEvent(initialSteps(), { step: "measure_before", done: true });
  steps = applyStepEvent(steps, { plan: ["restore_point", "system_junk", "settings", "nope"] });
  assert.deepEqual(
    steps.map((s) => `${s.id}:${s.state}`),
    [
      "measure_before:done",
      "restore_point:todo",
      "system_junk:todo",
      "settings:todo",
      "measure_after:todo",
    ],
  );
  steps = applyStepEvent(steps, { step: "system_junk", done: true, bytes: 2048 });
  steps = applyStepEvent(steps, { step: "booster" });
  // A later plan keeps the window's own step at the end.
  const replanned = applyStepEvent(steps, { plan: ["settings"] });
  assert.deepEqual(
    replanned.map((s) => s.id),
    ["measure_before", "system_junk", "settings", "booster", "measure_after"],
  );
  assert.deepEqual(steps.map((s) => s.id).slice(-2), ["booster", "measure_after"]);
  assert.equal(steps.find((s) => s.id === "system_junk")?.bytes, 2048);
  const closed = closeWork(steps);
  assert.ok(closed.filter((s) => s.id !== "measure_after").every((s) => s.state === "done"));
  assert.equal(closed.at(-1)?.state, "todo");
});

test("fix progress: bands cover 0-100 in order and a running step never reaches its end", () => {
  const steps = applyStepEvent(initialSteps(), { plan: ["restore_point", "settings", "junk"] });
  const b = bands(steps);
  assert.deepEqual(b[0], [0, 15]);
  assert.deepEqual(b.at(-1), [85, 100]);
  for (let i = 1; i < b.length; i++) assert.ok(Math.abs(b[i][0] - b[i - 1][1]) < 1e-9);
  assert.ok(creep(b[1], 10 * 60_000, "restore_point") < b[1][1]);
  assert.ok(creep(b[1], 2_000, "restore_point") > b[1][0]);
  const noAfter = bands(steps.filter((s) => s.id !== "measure_after"));
  assert.equal(noAfter.at(-1)?.[1], 100);
});

test("scope list results: measured, an issue only where there is something to look at", async () => {
  const { probeResult, REPORT_KEY } = await import("../src/scan-runner");
  assert.deepEqual(Object.keys(REPORT_KEY).sort(), [...SCAN_PROBES].sort());
  assert.equal(probeResult("junk_summary", null), null);
  assert.deepEqual(probeResult("reboot_pending", false), { kind: "ok", issue: false });
  assert.deepEqual(probeResult("reboot_pending", true), { kind: "found", count: 1, issue: true });
  assert.deepEqual(probeResult("registry_scan", { items: [] }), { kind: "ok", issue: false });
  assert.deepEqual(
    probeResult("junk_summary", [
      {
        id: "a",
        files: 1,
        bytes: 100,
        accessible: true,
        requires_admin: false,
        requires_pro: false,
      },
      {
        id: "b",
        files: 1,
        bytes: 900,
        accessible: false,
        requires_admin: false,
        requires_pro: false,
      },
    ]),
    { kind: "bytes", bytes: 100, issue: true },
    "unreadable folders are not counted",
  );
  const startup = probeResult("list_startup_items", [{ enabled: true }, { enabled: false }]);
  assert.deepEqual(
    startup,
    { kind: "found", count: 1, issue: false },
    "startup apps are not faults",
  );
  assert.deepEqual(probeResult("system_stats", { ram_used: 90, ram_total: 100 }), {
    kind: "percent",
    percent: 90,
    issue: true,
  });
});

test("Audio: notes never count or reach Fix all; per-device fixes are Pro only", async () => {
  const { probeResult } = await import("../src/scan-runner");
  const out = "{0.0.0.00000000}.{6a1c2f3e-9b8d-4c7a-8e21-3f5d7b9c0a14}";
  const mic = "{0.0.1.00000000}.{3d9f8e7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f}";
  const endpoint = (id: string, flow: "render" | "capture") => ({
    id,
    name: id,
    flow,
    default: true,
    comms: true,
    kind: flow === "render" ? "speakers" : "microphone",
    bus: "usb",
    format: { rate: 48_000, bits: 24, channels: 2, float: false },
    effectsOff: true,
    spatial: null,
    eq: "none",
  });
  const audio = {
    endpoints: [endpoint(out, "render"), endpoint(mic, "capture")],
    callMode: [{ device: "Headset", process: "Discord.exe" }],
    mic: { name: "Mic", muted: false, level: 6 },
    idle: [
      { id: "audio_idle:HDAUDIO/A", name: "HDMI", seconds: 4, applied: false },
      { id: "audio_idle:HDAUDIO/B", name: "Off", seconds: 0, applied: false },
    ],
    usbPower: [{ id: "audio_power:USB/M", name: "Mic", mayPowerDown: true, applied: false }],
    bluetooth: true,
    modernStandby: false,
    ducking: null,
    eapo: { installed: true, version: "1.4.2", selector: true, stale: 1 },
  };
  const tweaks = [
    tweak("audio_ducking_off", { category: "audio" }),
    tweak("bt_absolute_volume_off", { category: "audio", requires_admin: true }),
  ];
  const r = report({ tweaks, audio });
  const items = scanItems(r).filter((i) => i.category === "audio");
  const keys = (pred: (i: (typeof items)[number]) => boolean) =>
    items.filter(pred).map((i) => i.key);
  const idle = "audio:idle:audio_idle:HDAUDIO/A";
  const power = "audio:power:audio_power:USB/M";
  assert.deepEqual(
    keys(() => true),
    [
      "audio:devices",
      "audio:call:0",
      "audio:ducking",
      idle,
      power,
      "audio:eapo",
      `audio:effects:${out}`,
      `audio:effects:${mic}`,
      "audio:mic",
      "audio:bluetooth",
    ],
  );
  // A2, A8, A9 and T2 are notes: not issues, never in Fix all.
  assert.deepEqual(
    keys((i) => i.issue),
    ["audio:call:0", "audio:ducking", idle, power, "audio:eapo"],
  );
  const free = fixAllKeys(items, false);
  assert.deepEqual(free, ["audio:ducking"]);
  assert.deepEqual(fixAllKeys(items, true), ["audio:ducking", idle, power]);
  assert.deepEqual(fixPlan(items, fixAllKeys(items, true), true).tweaks, [
    "audio_ducking_off",
    "audio_idle:HDAUDIO/A",
    "audio_power:USB/M",
  ]);
  // A locked key never reaches the plan, whatever the selection says.
  assert.deepEqual(fixPlan(items, [idle, power], false).tweaks, []);
  assert.equal(scanTotals(items).audio, 3);
  assert.deepEqual(probeResult("audio_status", audio), { kind: "found", count: 5, issue: true });

  // Modern Standby: the USB power fix is opt-in in the Audio page, not a Scan fix.
  const standby = scanItems(report({ tweaks, audio: { ...audio, modernStandby: true } }));
  const p = standby.find((i) => i.key === power)!;
  assert.equal(p.fixable || p.issue || p.recommended, false);
  assert.ok(!fixAllKeys(standby, true).includes(power));

  // Everything in place: only the device overview remains, nothing to fix.
  const done = scanItems(
    report({
      tweaks: [
        tweak("audio_ducking_off", { category: "audio", applied: true }),
        tweak("bt_absolute_volume_off", { category: "audio", applied: true }),
      ],
      audio: {
        ...audio,
        endpoints: [{ ...endpoint(out, "render"), effectsOff: false, eq: "peq" }],
        callMode: [],
        mic: { name: "Mic", muted: false, level: 80 },
        idle: [{ ...audio.idle[0], seconds: 0, applied: true }],
        usbPower: [{ ...audio.usbPower[0], mayPowerDown: false, applied: true }],
        ducking: 3,
      },
    }),
  ).filter((i) => i.category === "audio");
  assert.deepEqual(
    done.map((i) => i.key),
    ["audio:devices"],
  );
});
