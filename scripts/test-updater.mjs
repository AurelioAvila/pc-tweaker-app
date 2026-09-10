import assert from "node:assert/strict";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Exercise the actual component's effects with deterministic event/network adapters.
const mocks = {
  react: `export const useState=initial=>h.state(initial); export const useRef=value=>h.ref(value); export const useEffect=fn=>h.effects.push(fn); export const useMemo=fn=>fn();`,
  "react/jsx-runtime": `export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
  "@tauri-apps/plugin-updater": `export const check=()=>h.check();`,
  "@tauri-apps/api/event": `export const listen=(event,fn)=>{h.listeners.set(event,fn);return Promise.resolve(()=>h.listeners.delete(event))};`,
  "@tauri-apps/plugin-process": `export const relaunch=()=>Promise.resolve();`,
};
const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/components/ui.tsx", import.meta.url))],
  bundle: true,
  write: false,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  plugins: [
    {
      name: "adapters",
      setup(build) {
        build.onResolve({ filter: /^(react(?:\/jsx-runtime)?|@tauri-apps\/)/ }, (args) =>
          args.path in mocks ? { path: args.path, namespace: "mock" } : undefined,
        );
        build.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
          contents: mocks[args.path],
          loader: "js",
        }));
      },
    },
  ],
});
const h = {
  values: [],
  refs: [],
  effects: [],
  listeners: new Map(),
  requests: [],
  index: 0,
  refIndex: 0,
  state(initial) {
    const i = this.index++;
    if (!(i in this.values)) this.values[i] = initial;
    return [this.values[i], (v) => (this.values[i] = v)];
  },
  ref(value) {
    const i = this.refIndex++;
    return (this.refs[i] ??= { current: value });
  },
  check() {
    return new Promise((resolve, reject) => this.requests.push({ resolve, reject }));
  },
};
const context = vm.createContext({ h, module: { exports: {} } });
vm.runInContext(compiled.outputFiles[0].text, context);
const toasts = [];
const render = () => {
  h.index = 0;
  h.refIndex = 0;
  return context.module.exports.UpdateBanner({
    s: {
      updater: {
        title: "Update {version}",
        body: "Available",
        install: "Install",
        later: "Later",
        checkFailed: "Check failed: {message}",
        error: "Error: {message}",
      },
    },
    onToast: (...args) => toasts.push(args),
  });
};
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
render();
const stop = h.effects[0]();
assert.equal(h.requests.length, 1, "startup checks for updates");
h.listeners.get("app-reopened")();
h.listeners.get("app-reopened")();
assert.equal(h.requests.length, 1, "reopening during a pending check does not duplicate it");
let installs = 0,
  rejectInstall;
const update = {
  version: "9.0.0",
  downloadAndInstall: () => {
    installs++;
    return new Promise((resolve, reject) => (rejectInstall = reject));
  },
};
h.requests[0].resolve(update);
await flush();
const buttons = (node) =>
  !node || typeof node !== "object"
    ? []
    : [
        ...(node.type === "button" ? [node] : []),
        ...[node.props?.children].flat().flatMap(buttons),
      ];
let actions = buttons(render());
actions.find((b) => b.props.children === "Later").props.onClick();
assert.equal(render(), null, "Later dismisses the current offer");
h.listeners.get("app-reopened")();
assert.equal(h.requests.length, 2);
h.requests[1].resolve(update);
await flush();
actions = buttons(render());
assert.ok(actions.length, "reopening shows the dismissed offer again");
const install = actions.find((b) => b.props.children === "Install").props.onClick;
const attempt = install();
void install();
assert.equal(installs, 1, "rapid clicks cannot install twice");
h.listeners.get("app-reopened")();
assert.equal(h.requests.length, 2, "no concurrent check while installing");
rejectInstall(Error("network unavailable"));
await attempt;
assert.equal(h.values[1], "offer", "failed installation can be retried");
h.listeners.get("app-reopened")();
h.requests[2].reject(Error("offline"));
await flush();
assert.equal(toasts.length, 2, "installation and check failures are visible");
h.listeners.get("app-reopened")();
const old = h.values[0];
stop();
h.requests[3].resolve({ version: "10.0.0" });
await flush();
assert.equal(h.values[0], old, "late response after unmount cannot update state");
assert.equal(h.listeners.size, 0, "unmount removes tray listener");
console.log(
  "Updater lifecycle passed: startup, tray reopen, dismissal, concurrency, failure and unmount.",
);
