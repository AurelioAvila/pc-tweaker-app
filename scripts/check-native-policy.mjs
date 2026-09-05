import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Explicitly selected tests use signed fixtures, a mock IPC runtime, temporary
// files, or fake operations. The complete integration suite belongs in a VM.
const filters = [
  "ipc_tests",
  "rollback::tests",
  "game_sessions::tests",
  "license::tests",
  "lifetime_tools::tests",
  "power_tuning::tests",
  "dns::tests",
  "services::tests",
  "tests::a_free_tweak_is_never_blocked_by_the_license_check",
  "tests::a_pro_tweak_is_refused_with_no_cached_license",
  "tests::duplicate_batch_ids_execute_only_once_and_keep_input_order",
];

for (const filter of filters) {
  console.log(`\nChecking isolated native policy: ${filter}`);
  const result = spawnSync(
    "cargo",
    ["test", "--manifest-path", "src-tauri/Cargo.toml", "--lib", filter],
    { cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
