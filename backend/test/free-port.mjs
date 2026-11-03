import net from "node:net";

// A port the OS has just confirmed free. The HTTP suites spawn the built server
// from parallel test files; picking random numbers made them collide with each
// other (or with Windows' reserved ranges) and fail with "server exited with 1".
export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer().unref().on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}
