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
    unavailable: [],
    partial: false,
    at: Date.now(),
    ...extra,
  }) as ScanReport;

test("ten native reads report monotonic real progress; failures stay unknown", async () => {
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
  assert.equal(failed.unavailable.length, 10);
  assert.deepEqual(recommendedTweaks(failed, true), []);
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
