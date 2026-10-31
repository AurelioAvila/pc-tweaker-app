// Account and support helpers: the wait a 429 asks for (Retry-After), the PC
// label sent for the account's PC list, and the "Copy diagnosis" text, which
// must never carry the account's email, a licence, an ID or a hash.
// Run with: node scripts/test-account-extras.mjs
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundle = await build({
  stdin: {
    contents: `export { retryAfterSeconds, waitPhrase } from './src/retry-after';
      export { pcLabel } from './src/device-label';
      export { diagnosisText, redact } from './src/diagnosis';
      export { newScanSession, scanReport } from './src/scan-runner';
      export { STRINGS, format, localeOf } from './src/i18n';`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
});
const m = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// Retry-After: seconds or an HTTP date, never a past, empty or malformed value.
const now = Date.parse("2026-10-31T12:00:00Z");
assert.equal(m.retryAfterSeconds("120", now), 120);
assert.equal(m.retryAfterSeconds(" 7 ", now), 7);
assert.equal(m.retryAfterSeconds("Sat, 31 Oct 2026 12:01:30 GMT", now), 90);
for (const bad of [null, "", "0", "-5", "abc", "1.5", "Sat, 31 Oct 2026 11:00:00 GMT"])
  assert.equal(m.retryAfterSeconds(bad, now), null, String(bad));
assert.equal(m.retryAfterSeconds("99999999", now), 86_400);

// The message reads naturally in every language and keeps no placeholder.
for (const [lang, strings] of Object.entries(m.STRINGS)) {
  for (const seconds of [1, 45, 60, 61, 840]) {
    const text = m.format(strings.auth.errorRateLimitedIn, {
      when: m.waitPhrase(seconds, m.localeOf(lang) ?? "en"),
    });
    assert.doesNotMatch(text, /[{}]/, `${lang}: ${text}`);
    assert.match(text, seconds < 60 ? new RegExp(`\\b${seconds}\\b`) : /\b(1|2|14)\b/, `${lang}: ${text}`);
  }
}
assert.equal(
  m.format(m.STRINGS.en.auth.errorRateLimitedIn, { when: m.waitPhrase(840, "en") }),
  "Too many attempts. Try again in 14 minutes.",
);
assert.equal(
  m.format(m.STRINGS.it.auth.errorRateLimitedIn, { when: m.waitPhrase(60, "it") }),
  "Troppi tentativi. Riprova tra 1 minuto.",
);

// The PC label: Windows edition and processor, tidied, nothing else.
assert.equal(
  m.pcLabel("Windows 11 Pro", "Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz"),
  "Windows 11 Pro · Intel Core i7-9700K",
);
assert.equal(
  m.pcLabel("Windows 11 Home", "AMD Ryzen 7 5800X3D 8-Core Processor   "),
  "Windows 11 Home · AMD Ryzen 7 5800X3D 8-Core Processor",
);
assert.equal(m.pcLabel("Windows 10 Pro", "CPU"), "Windows 10 Pro");
assert.equal(m.pcLabel("", ""), null);
assert.ok(m.pcLabel("W".repeat(100), "x").length <= 80);

// Copy diagnosis.
const session = m.newScanSession(now - 60_000);
const at = now - 30_000;
const done = (value) => ({ state: "complete", at, value });
const tweak = (id, name, extra = {}) => ({
  id,
  name,
  description: "",
  category: "performance",
  hive: "HKCU",
  requires_admin: false,
  requires_pro: false,
  applied: false,
  changes: [],
  ...extra,
});
session.steps = {
  list_tweaks: done([
    tweak("game_dvr", "Disable Game DVR"),
    tweak("hags", "Hardware-accelerated GPU scheduling", { requires_pro: true }),
  ]),
  scan_relevant_ids: done(["game_dvr", "hags"]),
  advise_tweaks: done([
    { id: "game_dvr", verdict: "recommended", reason_key: null },
    { id: "hags", verdict: "recommended", reason_key: null },
  ]),
  system_profile: done({
    windows_version: "Windows 11 24H2",
    windows_build: "26100.1742",
    cpu: "AMD Ryzen 7 5800X3D",
    cpu_physical_cores: 8,
    cpu_logical_cores: 16,
    gpu: "NVIDIA GeForce RTX 3080",
    ram_total_bytes: 32 * 1024 ** 3,
    system_disk: "nvme",
    form_factor: "desktop",
    power_plan_guid: "381b4222-f694-41f0-9685-ff5bb260df2e",
    power_plan: "Balanced",
  }),
  list_drives_cmd: done([
    { letter: "C:", media_type: "SSD", total_bytes: 500e9, free_bytes: 20e9, is_system: true },
  ]),
  list_startup_items: done([{ name: "Steam", enabled: true, command: "C:\\Users\\aurel\\steam.exe" }]),
  reboot_pending: done(true),
  health_report: { state: "unavailable", at, value: null },
};
const report = m.scanReport(session, at);
const text = m.diagnosisText({
  appVersion: "1.18.27",
  lang: "de",
  isPro: false,
  report,
  outcome: {
    fixed: ["game_dvr"],
    failed: [],
    skipped: [],
    errors: [
      "Access denied: C:\\Users\\aurel\\AppData\\Local\\x.json for person@example.com",
      "device 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef {4F8341A7-4D16-077A-E184-9DC8B8CAC99F}",
    ],
  },
  history: [
    { ts: now / 1000 - 60, action: "tweak-reverted", target: "game_dvr", elevated: false, success: true },
    { ts: now / 1000 - 120, action: "files-deleted", target: "C:\\Users\\aurel\\Downloads\\a.zip", elevated: false, success: true },
    { ts: now / 1000 - 180, action: "tweak-applied", target: "game_dvr", elevated: false, success: false },
    { ts: now / 1000 - 30 * 86_400, action: "tweak-applied", target: "old_one", elevated: false, success: true },
  ],
  now,
});
for (const expected of [
  "PC Tweaker diagnosis",
  "App: 1.18.27 · Plan: Free · Language: de",
  "Windows: Windows 11 24H2, build 26100.1742",
  "AMD Ryzen 7 5800X3D · NVIDIA GeForce RTX 3080 · 32 GB RAM · NVMe system disk · desktop",
  "Recommended changes (1):\n- Disable Game DVR [game_dvr]",
  "Recommendations available with Pro (1):\n- Hardware-accelerated GPU scheduling [hags]",
  "Low free storage: C: · 18.6 GB · 4%",
  "Review programs that start with Windows: Steam",
  "Windows reports a pending restart",
  "Security signals (unavailable)",
  "Applied from this scan: 1 verified",
  "2026-10-31 11:59 UTC reverted Disable Game DVR [game_dvr]",
  "applied Disable Game DVR [game_dvr] (failed)",
  "C:\\Users\\<user>",
]) {
  assert.ok(text.includes(expected), `missing: ${expected}\n---\n${text}`);
}
for (const forbidden of ["aurel", "person@example.com", "@", "0123456789abcdef0123", "4F8341A7", "a.zip", "old_one", "381b4222"]) {
  assert.ok(!text.includes(forbidden), `leaked: ${forbidden}\n---\n${text}`);
}
assert.equal(m.redact("C:\\Users\\Ana María\\Desktop"), "C:\\Users\\<user>\\Desktop");

console.log("account extras OK");
