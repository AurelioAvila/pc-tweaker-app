// The data rules behind the live charts on PC Health.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatRate,
  hasSensors,
  HISTORY,
  memorySplit,
  niceCeiling,
  push,
  sparkPoints,
  verdict,
} from "../src/live-metrics";

test("the history keeps the newest readings and never grows past its length", () => {
  let values: number[] = [];
  for (let i = 0; i < HISTORY + 25; i++) {
    const before = values;
    values = push(values, i);
    assert.notEqual(values, before, "a new array every time");
  }
  assert.equal(values.length, HISTORY);
  assert.equal(values[0], 25);
  assert.equal(values[HISTORY - 1], HISTORY + 24);
  assert.deepEqual(push([1, 2, 3], 4, 3), [2, 3, 4]);
});

test("rate charts scale to a round ceiling and an idle line stays flat", () => {
  const floor = 1_000_000;
  assert.equal(niceCeiling([], floor), floor, "nothing yet: the floor");
  assert.equal(niceCeiling([null, null], floor), floor, "missing readings are not noise");
  assert.equal(niceCeiling([300_000], floor), floor, "an idle disk stays low on the chart");
  assert.equal(niceCeiling([3_100_000], floor), 5_000_000);
  assert.equal(niceCeiling([1_048_576], floor), 2_000_000, "always a round 1/2/5 step");
  assert.equal(niceCeiling([150], 100), 200);
  assert.equal(niceCeiling([1000], 100), 1000);
  assert.equal(niceCeiling([Number.NaN, 50], 10), 50);
});

test("the verdict needs three readings and follows load and memory", () => {
  assert.equal(verdict([10, 12], 40), null);
  assert.equal(verdict([10, 12, 14], 40)?.verdict, "smooth");
  assert.equal(verdict([10, 12, 14], 40)?.cpu, 12);
  assert.equal(verdict([75, 80, 72], 40)?.verdict, "busy");
  assert.equal(verdict([10, 10, 10], 87)?.verdict, "busy");
  assert.equal(verdict([95, 92, 99], 40)?.verdict, "strained");
  assert.equal(verdict([10, 10, 10], 95)?.verdict, "strained");
  // Only the last ten seconds count.
  assert.equal(verdict([...Array(20).fill(100), ...Array(10).fill(5)], 30)?.verdict, "smooth");
  assert.equal(verdict([5, 5, 5], null)?.verdict, "smooth", "unknown memory does not alarm");
});

test("memory splits into used, cached and free that add up, even from odd readings", () => {
  const GB = 1024 ** 3;
  const split = memorySplit({ ram_total: 32 * GB, ram_used: 16 * GB, ram_cached: 8 * GB });
  assert.deepEqual(split, { used: 0.5, cached: 0.25, free: 0.25 });
  const capped = memorySplit({ ram_total: 8 * GB, ram_used: 6 * GB, ram_cached: 5 * GB });
  assert.ok(capped);
  assert.equal(capped.used + capped.cached + capped.free, 1);
  assert.equal(capped.free, 0, "cache never pushes the total past 100%");
  assert.equal(memorySplit({ ram_total: 0, ram_used: 0, ram_cached: null }), null);
  assert.equal(memorySplit({ ram_total: 4 * GB, ram_used: 2 * GB, ram_cached: null })?.cached, 0);
});

test("rates read naturally and missing ones say so instead of showing zero", () => {
  assert.equal(formatRate(null), null);
  assert.equal(formatRate(Number.NaN), null);
  assert.equal(formatRate(-5), null);
  assert.equal(formatRate(512, "en"), "512 B/s");
  assert.equal(formatRate(820 * 1024, "en"), "820 KB/s");
  assert.equal(formatRate(12.4 * 1024 * 1024, "en"), "12.4 MB/s");
  assert.equal(formatRate(12.4 * 1024 * 1024, "it"), "12,4 MB/s");
});

test("no sensor reading means no sensor card, not a zero", () => {
  assert.equal(hasSensors(null), false);
  assert.equal(hasSensors({ cpu_temp_c: null, gpus: [] }), false);
  assert.equal(
    hasSensors({
      cpu_temp_c: null,
      gpus: [{ temp_c: null, utilization_pct: null, fan_pct: null }],
    }),
    false,
  );
  assert.equal(hasSensors({ cpu_temp_c: 48, gpus: [] }), true);
  assert.equal(
    hasSensors({ cpu_temp_c: null, gpus: [{ temp_c: null, utilization_pct: 3, fan_pct: null }] }),
    true,
  );
});

test("chart points fill from the right, clamp to the box and draw gaps at zero", () => {
  const points = sparkPoints([50, null, 200], 100, 60, 10, 4);
  assert.equal(points.length, 3);
  assert.deepEqual(points[0], [20, 5]);
  assert.deepEqual(points[1], [40, 10], "a missing reading sits on the baseline");
  assert.deepEqual(points[2], [60, 0], "over the ceiling is clamped");
  assert.deepEqual(sparkPoints([10], 0, 60, 10, 4)[0], [60, 10], "no ceiling: flat");
});
