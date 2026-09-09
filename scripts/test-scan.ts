import { test } from "node:test";
import assert from "node:assert/strict";
import { collectScan, readLastScan } from "../src/scan-runner";

test("scan reads fresh inventory and completes hardware advice before returning", async () => {
  const calls: string[] = [];
  const progress: number[] = [];
  const result = await collectScan(
    async <T>(command: string) => {
      calls.push(command);
      return [] as T;
    },
    (p) => progress.push(p),
  );
  assert.equal(new Set(calls).size, 4);
  assert.equal(result.partial, false);
  assert.deepEqual(progress, [25, 100]);
});
test("a failed optional probe stays unavailable rather than becoming an empty clean result", async () => {
  const result = await collectScan(
    async <T>(command: string) => {
      if (command === "advise_tweaks") throw Error("Access denied");
      return [] as T;
    },
    () => {},
  );
  assert.equal(result.partial, true);
  assert.equal(result.advice, null);
});
test("failed inventory aborts the scan rather than reusing old tweak states", async () => {
  await assert.rejects(
    collectScan(
      async () => {
        throw Error("Unavailable");
      },
      () => {},
    ),
  );
});
test("last scan rejects corrupt, future or incomplete stored data", () => {
  for (const value of [
    "invalid",
    "null",
    "{}",
    JSON.stringify({ at: Date.now() + 60000, partial: false }),
  ]) {
    assert.equal(readLastScan(value), null);
  }
  const valid = { at: Date.now() - 1000, partial: true };
  assert.deepEqual(readLastScan(JSON.stringify(valid)), valid);
});
