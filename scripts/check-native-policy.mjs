import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Explicitly selected tests use signed fixtures, a mock IPC runtime, temporary
// files, fake operations, the in-memory registry and power backends, or (for
// core steering) CPU sets on the test process itself. The complete
// integration suite belongs in a VM.
const filters = [
  "ipc_tests",
  "rollback::tests",
  "game_sessions::tests",
  "license::tests",
  "lifetime_tools::tests",
  "power_tuning::tests",
  "dns::tests",
  "services::tests",
  "power::tests",
  "turbo::tests",
  "gaming::tests",
  "everyday::tests",
  "contextmenu::tests",
  "netshaper::tests",
  "download_limit::tests",
  "mock_registry",
  "diagnostics::dpc::tests",
  "diagnostics::network_verify::tests",
  "engine::dynamic_session::tests",
  "tests::a_free_tweak_is_never_blocked_by_the_license_check",
  "tests::a_pro_tweak_is_refused_with_no_cached_license",
  "tests::duplicate_batch_ids_execute_only_once_and_keep_input_order",
];

for (const filter of filters) {
  console.log(`\nChecking isolated native policy: ${filter}`);
  const result = spawnSync(
    "cargo",
    ["test", "--manifest-path", "src-tauri/Cargo.toml", "--lib", filter],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stdio: ["inherit", "pipe", "inherit"],
      encoding: "utf8",
    },
  );
  if (result.error) throw result.error;
  process.stdout.write(result.stdout);
  if (result.status !== 0) process.exit(result.status ?? 1);
  // A filter that matches nothing passes with "running 0 tests"; a renamed
  // or re-gated module must fail here instead.
  const ran = [...result.stdout.matchAll(/running (\d+) tests?/g)].reduce((n, m) => n + Number(m[1]), 0);
  if (ran === 0) {
    console.error(`No test matched ${filter}`);
    process.exit(1);
  }
}
