import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(here, "..");

/**
 * Runs the server in a child process, waits until it is listening, then makes
 * it handle a termination signal, and returns what it printed plus how it
 * exited.
 *
 * The signal is raised inside the child with `process.emit` rather than sent
 * from here with `process.kill`. That is not a shortcut: Windows has no POSIX
 * signals, so `process.kill(pid, "SIGTERM")` terminates the process outright
 * and the handler never runs — which is exactly what happened the first time
 * this was tried by hand. Emitting it in-process runs the same listener the
 * real signal would, so the drain-and-close logic is genuinely exercised
 * here; only the delivery of the signal itself is out of reach on Windows,
 * and that part is the operating system's job, not this code's.
 */
function runUntilShutdown(signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
        const { once } = await import("node:events");
        await import("./dist/index.js");
        // The server binds asynchronously; give it the tick it needs before
        // asking it to shut down, otherwise there is nothing to drain yet.
        await new Promise((r) => setTimeout(r, 800));
        process.emit(${JSON.stringify(signal)});
        `,
      ],
      {
        cwd: backendRoot,
        // Port 0 lets the OS pick a free one: a test must never collide with
        // a real server someone has running on the usual port.
        env: { ...process.env, PORT: "0", DATABASE_URL: "" },
      },
    );

    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`the server never exited after ${signal}; output:\n${out}`));
    }, 15_000);

    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
    child.on("error", reject);
  });
}

test("SIGTERM drains the server and exits cleanly", async () => {
  const { code, out } = await runUntilShutdown("SIGTERM");

  assert.match(
    out,
    /SIGTERM received: refusing new connections/,
    "the handler should announce that it is draining, so a deploy log shows why the process stopped",
  );
  assert.match(out, /shutdown complete/, "the drain should run to completion");
  assert.doesNotMatch(
    out,
    /shutdown timed out/,
    "an idle server has nothing to drain and must not reach the force-exit path",
  );
  assert.equal(code, 0, "a deliberate shutdown is not a crash and must not look like one");
});

test("SIGINT is handled the same way, so a local Ctrl+C is not a hard kill", async () => {
  const { code, out } = await runUntilShutdown("SIGINT");
  assert.match(out, /SIGINT received: refusing new connections/);
  assert.match(out, /shutdown complete/);
  assert.equal(code, 0);
});
