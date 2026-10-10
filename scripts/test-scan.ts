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
      if (cmd === "apply_tweaks") {
        writes++;
        submitted = args?.ids as string[];
        return ["fails: denied"] as T;
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
        if (cmd === "apply_tweaks") writes++;
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
      if (cmd === "apply_tweaks") return [] as T;
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
  assert.deepEqual(unknownSecuritySignals(r), ["Defender: Unreadable", "SmartScreen: Unknown"]);
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

test("scan progress weighs the driver inventory and never reaches 100 before the report", async () => {
  const { scanProgress } = await import("../src/scan-runner");
  const step = { state: "complete" as const, at: 0, value: null };
  assert.equal(scanProgress({}, null), 0);
  assert.equal(Math.round(scanProgress({}, { done: 5, total: 10 })), 30);
  assert.equal(scanProgress({}, { done: 1, total: 0 }), 0, "an empty class list is not progress");
  const all = Object.fromEntries(SCAN_PROBES.map((p) => [p, step]));
  assert.equal(scanProgress(all, null), 99);
  const noDrivers = Object.fromEntries(
    SCAN_PROBES.filter((p) => p !== "driver_audit").map((p) => [p, step]),
  );
  assert.equal(Math.round(scanProgress(noDrivers, null)), 40);
});
