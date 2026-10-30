import { useMemo, useState } from "react";
import { Link } from "../../router";
import { CATEGORIES, CHECKED, sourceFile } from "../../reference/catalog";
import { MS } from "../../reference/sources";
import { VERDICTS } from "../../reference/tweak-notes";
import { WINDOWS_DB, DB_VERDICTS, dbPath, type DbEntry } from "../../reference/windows-db";
import { ProBox, SourceList, Steps } from "../../components/ReferenceBlocks";
import { DOWNLOAD_EXE } from "../../constants";
import { DEBLOAT_APPS, debloatListJson, debloatPowerShell } from "../../reference/debloat";
import { Badge, Crumbs, Head, P, Panel, Shell } from "./pages";
import { CATEGORY_KEYS, TOOLS, TWEAKS } from "./data";

type Nav = (to: string) => void;
const tool = (path: string) => TOOLS.find((t) => t.path === path)!;

/* ------------------------------------------------------------------ *
 * Process & Service Safety Checker
 * ------------------------------------------------------------------ */

const norm = (s: string) => s.trim().toLowerCase().replace(/\.exe$/, "");

export function lookup(query: string): DbEntry[] {
  const q = norm(query);
  if (!q) return [];
  const exact = WINDOWS_DB.filter((e) => norm(e.name) === q);
  if (exact.length) return exact;
  return WINDOWS_DB.filter((e) => norm(e.name).includes(q) || e.displayName.toLowerCase().includes(q));
}

export function ProcessChecker({ navigate }: { navigate: Nav }) {
  const meta = tool("/tools/process-checker");
  const [q, setQ] = useState("");
  const hits = useMemo(() => lookup(q), [q]);
  const unknown = q.trim() !== "" && hits.length === 0;
  const name = q.trim().replace(/\.exe$/i, "") || "name";
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Tools", "/tools/"], [meta.name, `${meta.path}/`]]} />
      <Head eyebrow="FREE TOOL" title={meta.title} intro="Type the name you see in Task Manager or Services. The answer comes from the Windows database on this site, where every entry cites Microsoft's documentation; nothing you type leaves this page." />
      <label className="mt-10 block">
        <span className="font-mono-t text-[12px] tracking-[0.12em] text-[var(--fg-dim)]">PROCESS OR SERVICE NAME</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="for example dwm.exe or SysMain"
          className="mt-2 w-full rounded-xl border border-white/10 bg-[var(--bg-2)] px-4 py-3 text-[15px] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
        />
      </label>
      <div aria-live="polite">
        {hits.map((e) => {
          const v = DB_VERDICTS[e.verdict];
          return (
            <section key={e.slug} className="mt-6 rounded-2xl bg-[var(--surface)] p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-mono-t text-lg font-bold text-[var(--fg)]">{e.name}</h2>
                <span className="text-[14px] text-[var(--fg-dim)]">{e.displayName}</span>
                <Badge label={v.label} tone={v.tone} />
              </div>
              <p className="mt-3 text-[15px] leading-7 text-[var(--fg-dim)]">{e.why}</p>
              <p className="mt-2 text-[14px] text-[var(--fg-dim)]">Expected location: <span className="font-mono-t text-[var(--fg)] [overflow-wrap:anywhere]">{e.path}</span></p>
              <Link to={`${dbPath(e)}/`} onNavigate={navigate} className="text-accent mt-3 inline-block text-[14px] font-medium">Full entry, sources and commands</Link>
            </section>
          );
        })}
        {unknown && (
          <section className="mt-6 rounded-2xl bg-[var(--surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--fg)]">Not in the database yet</h2>
            <p className="mt-2 text-[15px] leading-7 text-[var(--fg-dim)]">
              Entries are added only when every statement can be sourced, so this says nothing about whether "{q.trim()}" is safe. Check where the file runs from and who signed it:
            </p>
            <Steps
              steps={[
                { title: "Find the file", code: `Get-Process ${name} -ErrorAction SilentlyContinue | Select-Object Id, Path`, shell: "PowerShell" },
                { title: "Check the signature", code: `Get-Process ${name} | ForEach-Object { Get-AuthenticodeSignature $_.Path } | Format-List Status, SignerCertificate`, shell: "PowerShell", note: "A Windows component lives under C:\\Windows and is signed by Microsoft Windows. A familiar Windows name in another folder, or an unsigned file, is worth scanning with Microsoft Defender." },
              ]}
            />
          </section>
        )}
      </div>
      <Panel title="Everything the checker knows" id="all">
        <P>The same {WINDOWS_DB.length} entries as the database, with their verdicts.</P>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">
            <thead><tr className="text-[var(--fg-dim)]"><th className="py-2 pr-4 font-medium">Name</th><th className="py-2 pr-4 font-medium">What it is</th><th className="py-2 font-medium">Verdict</th></tr></thead>
            <tbody>
              {WINDOWS_DB.map((e) => (
                <tr key={e.slug} className="border-t border-white/5">
                  <td className="py-2.5 pr-4"><Link to={`${dbPath(e)}/`} onNavigate={navigate} className="font-mono-t text-accent">{e.name}</Link></td>
                  <td className="py-2.5 pr-4 text-[var(--fg-dim)]">{e.displayName}</td>
                  <td className="py-2.5 text-[var(--fg)]">{DB_VERDICTS[e.verdict].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <SourceList checked={CHECKED} items={[{ label: "The Windows database on this site, with every entry's sources", url: "https://pctweaker.app/database/" }, MS.serverServices]} />
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * Timer & latency calculator
 * ------------------------------------------------------------------ */

/** Every figure the calculator shows, from the formulas printed beside it. */
export function latency(input: { timerMs: number; fps: number; pollingHz: number; bufferSamples: number; sampleRate: number }) {
  const frameMs = 1000 / input.fps;
  const pollMs = 1000 / input.pollingHz;
  return {
    frameMs,
    timerWorstMs: input.timerMs,
    timerAvgMs: input.timerMs / 2,
    timerShareOfFrame: input.timerMs / frameMs,
    pollMs,
    pollAvgMs: pollMs / 2,
    bufferMs: (input.bufferSamples / input.sampleRate) * 1000,
  };
}

const fmt = (n: number) => (Number.isFinite(n) ? (n >= 10 ? n.toFixed(1) : n.toFixed(3)) : "–");

function Num({ label, value, onChange, step, min, unit }: { label: string; value: number; onChange: (n: number) => void; step: number; min: number; unit: string }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-[var(--fg-dim)]">{label}</span>
      <span className="mt-1.5 flex items-center gap-2">
        <input type="number" inputMode="decimal" min={min} step={step} value={value} onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))} className="w-full rounded-lg border border-white/10 bg-[var(--bg-2)] px-3 py-2 text-[15px] text-[var(--fg)] outline-none focus:border-[var(--accent)]" />
        <span className="font-mono-t text-[12px] text-[var(--fg-dim)]">{unit}</span>
      </span>
    </label>
  );
}

export function TimerCalculator({ navigate }: { navigate: Nav }) {
  const meta = tool("/tools/timer-resolution-calculator");
  const [timerMs, setTimer] = useState(15.625);
  const [fps, setFps] = useState(144);
  const [pollingHz, setPoll] = useState(1000);
  const [bufferSamples, setBuffer] = useState(256);
  const [sampleRate, setRate] = useState(48000);
  const r = latency({ timerMs, fps, pollingHz, bufferSamples, sampleRate });
  const rows: [string, string, string][] = [
    ["Frame time", `${fmt(r.frameMs)} ms`, "1000 ÷ frame rate"],
    ["Longest extra wait from the timer period", `${fmt(r.timerWorstMs)} ms`, "one timer period: a wait can end up to one tick late"],
    ["Average extra wait from the timer period", `${fmt(r.timerAvgMs)} ms`, "half a period, if the wait starts at a random point in the tick"],
    ["Timer period as a share of one frame", `${fmt(r.timerShareOfFrame * 100)} %`, "timer period ÷ frame time"],
    ["Mouse report interval", `${fmt(r.pollMs)} ms`, "1000 ÷ polling rate"],
    ["Average wait for the next mouse report", `${fmt(r.pollAvgMs)} ms`, "half the report interval"],
    ["One audio buffer", `${fmt(r.bufferMs)} ms`, "buffer size ÷ sample rate × 1000"],
  ];
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Tools", "/tools/"], [meta.name, `${meta.path}/`]]} />
      <Head eyebrow="FREE TOOL" title={meta.title} intro="Arithmetic, not measurement: these are upper bounds and averages that follow from the numbers you enter, with every formula shown. Your PC's real latency also depends on drivers, the game and the display, which only a measurement shows." />
      <Panel title="Your numbers" id="inputs">
        <div className="mt-3 flex flex-wrap gap-2">
          {[15.625, 1, 0.5].map((v) => (
            <button key={v} type="button" onClick={() => setTimer(v)} className={`rounded-lg border px-3 py-1.5 text-[13px] ${timerMs === v ? "border-[var(--accent)] text-[var(--fg)]" : "border-white/10 text-[var(--fg-dim)]"}`}>
              {v} ms{v === 15.625 ? " (64 Hz)" : ""}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Num label="Timer period" value={timerMs} onChange={setTimer} step={0.5} min={0.1} unit="ms" />
          <Num label="Frame rate" value={fps} onChange={setFps} step={1} min={1} unit="fps" />
          <Num label="Mouse polling rate" value={pollingHz} onChange={setPoll} step={125} min={1} unit="Hz" />
          <Num label="Audio buffer" value={bufferSamples} onChange={setBuffer} step={32} min={1} unit="samples" />
          <Num label="Sample rate" value={sampleRate} onChange={setRate} step={100} min={1} unit="Hz" />
        </div>
      </Panel>
      <Panel title="Results" id="results">
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[14px]" aria-live="polite">
            <thead><tr className="text-[var(--fg-dim)]"><th className="py-2 pr-4 font-medium">Figure</th><th className="py-2 pr-4 font-medium">Value</th><th className="py-2 font-medium">Formula</th></tr></thead>
            <tbody>
              {rows.map(([a, b, c]) => (
                <tr key={a} className="border-t border-white/5 align-top">
                  <td className="py-2.5 pr-4 text-[var(--fg)]">{a}</td>
                  <td className="font-mono-t py-2.5 pr-4 text-[var(--fg)]">{b}</td>
                  <td className="py-2.5 text-[var(--fg-dim)]">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="What these numbers do and do not tell you" id="limits">
        <P>
          A program that sleeps or waits on a periodic timer can wake up to one timer period late, which is where the timer rows come from. Microsoft documents that since Windows 10 version 2004 a timer resolution request applies to the process that makes it rather than to the whole system, and that on Windows 11 a process whose windows are minimized or fully hidden is no longer guaranteed the higher resolution it asked for. Many games do not rely on sleeping for frame pacing at all, so a smaller period is not automatically lower latency.
        </P>
        <P>
          The mouse and audio rows are the same kind of arithmetic: a report or a buffer cannot be acted on before it exists. To see what your PC actually does, measure: a driver latency trace for audio problems, and a frame-time capture in the game for stutter.
        </P>
        <ul className="mt-5 space-y-2 text-[15px]">
          <li><Link to="/fixes/dpc-latency-audio-crackling/" onNavigate={navigate} className="text-accent font-medium">Measure driver latency behind audio crackling</Link></li>
          <li><Link to="/tweaks/gaming/global-timer-resolution/" onNavigate={navigate} className="text-accent font-medium">The GlobalTimerResolutionRequests control, explained</Link></li>
        </ul>
      </Panel>
      <SourceList checked={CHECKED} items={[MS.timer, MS.timerIgnore]} />
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * Profile builder
 * ------------------------------------------------------------------ */

/** The file PC Tweaker's Profiles screen imports (src-tauri/src/profiles.rs, format 1). */
/** The app's rules for a name: 1 to 40 characters, no control characters. */
export const profileName = (name: string) =>
  // eslint-disable-next-line no-control-regex
  name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) || "My profile";

export function profileJson(name: string, ids: readonly string[], now = Date.now()) {
  // created_at is seconds since the epoch, as the app writes it (profiles.rs).
  return JSON.stringify({ format: 1, name: profileName(name), created_at: String(Math.floor(now / 1000)), tweaks: [...new Set(ids)] }, null, 2) + "\n";
}

export function profileMarkdown(name: string, ids: readonly string[]) {
  const picked = TWEAKS.filter((p) => ids.includes(p.t.id));
  const lines = [
    `# ${name.trim() || "My profile"}: PC Tweaker plan`,
    "",
    `${picked.length} controls. ${picked.filter((p) => p.t.requires_pro).length} need Pro; ${picked.filter((p) => p.t.requires_admin).length} need administrator approval.`,
    "",
  ];
  for (const p of picked) {
    lines.push(`## ${p.t.name}`, "", `- Category: ${CATEGORIES[p.category].app}`, `- Plan: ${p.t.requires_pro ? "Pro" : "Free"}`, `- Administrator: ${p.t.requires_admin ? "yes" : "no"}`, `- Verdict: ${VERDICTS[p.note.verdict].label}`, `- Reference: https://pctweaker.app${p.path}/`);
    for (const c of p.t.changes) {
      lines.push(c.kind === "registry" ? `- Sets \`${c.path}\\${c.valueName}\` (${c.valueType}) to ${c.setsTo}` : c.kind === "service" ? `- Service ${c.name}: ${c.action}` : `- Runs ${c.program}: ${c.arguments}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The ids the released app accepts in a profile file: every single-value
 * control in tweaks.rs plus the composites listed in known_tweak_ids()
 * (src-tauri/src/profiles.rs, 1.18.4). Anything else is dropped on import
 * with a count, so it is not offered here.
 */
// ponytail: copy of the composite list in known_tweak_ids(); widen it when the app's list grows.
const PROFILE_COMPOSITES = new Set([
  "power_plan_performance", "turbo_gaming", "reduce_input_lag", "turbo_boost", "reduce_keyboard_delay",
  "games_task_priority", "disable_activity_history", "disable_typing_personalization", "classic_context_menu",
  "disable_windows_search_service", "network_latency", "privacy_dns", "disable_filter_keys_shortcut",
]);
const BUILDABLE = TWEAKS.filter(
  (p) => !p.t.manual_only && (PROFILE_COMPOSITES.has(p.t.id) || sourceFile(p.t).url.endsWith("/tweaks.rs")),
);

export function ProfileBuilder({ navigate }: { navigate: Nav }) {
  const meta = tool("/tools/profile-builder");
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const file = `${(name.trim() || "my-profile").replace(/[^\w-]+/g, "-")}.pctweaker.json`;
  const pro = BUILDABLE.filter((p) => ids.includes(p.t.id) && p.t.requires_pro).length;
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Tools", "/tools/"], [meta.name, `${meta.path}/`]]} />
      <Head eyebrow="FREE TOOL" title={meta.title} intro="Plan a set of changes here, then import the file in PC Tweaker under Profiles, Import from file. The app loads it for review and applies nothing until you confirm; it drops any entry it does not recognise and tells you how many." />
      <Panel title="1. Name it" id="name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gaming laptop" maxLength={40} className="mt-4 w-full rounded-xl border border-white/10 bg-[var(--bg-2)] px-4 py-3 text-[15px] text-[var(--fg)] outline-none focus:border-[var(--accent)]" />
      </Panel>
      <Panel title="2. Pick the controls" id="pick">
        <P>
          These are the {BUILDABLE.length} controls the current release accepts in a profile file. Left out on purpose: Memory Integrity, which PC Tweaker never applies from a profile, the controls with their own settings panel, and the newest controls the import does not recognise yet. Set those in the app.
        </P>
        {CATEGORY_KEYS.map((c) => (
          <fieldset key={c} className="mt-6">
            <legend className="font-mono-t text-[12px] tracking-[0.12em] text-[var(--fg-dim)]">{CATEGORIES[c].label.toUpperCase()}</legend>
            <div className="mt-2 grid gap-1.5 md:grid-cols-2">
              {BUILDABLE.filter((p) => p.category === c).map((p) => (
                <label key={p.t.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <input type="checkbox" checked={ids.includes(p.t.id)} onChange={() => toggle(p.t.id)} className="mt-1 accent-[var(--accent)]" />
                  <span className="text-[14px] leading-6 text-[var(--fg)]">
                    {p.t.name}
                    <span className="ml-2 text-[12px] text-[var(--fg-dim)]">{p.t.requires_pro ? "Pro" : "Free"}{p.t.requires_admin ? " · admin" : ""}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </Panel>
      <Panel title="3. Download" id="download">
        <P>
          {ids.length} selected{pro ? `, ${pro} of them Pro: on the Free plan those stay locked when you apply the profile` : ""}.
        </P>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" disabled={ids.length === 0} onClick={() => download(file, profileJson(name, ids), "application/json")} className="bg-accent rounded-lg px-5 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-40">Download profile (.json)</button>
          <button type="button" disabled={ids.length === 0} onClick={() => download(file.replace(/\.json$/, ".md"), profileMarkdown(name, ids), "text/markdown")} className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-[var(--fg)] disabled:opacity-40">Download checklist (.md)</button>
        </div>
        {ids.length > 0 && <pre className="mt-5 max-h-64 overflow-auto rounded-xl bg-black/40 p-4 text-[12.5px] text-[var(--fg)]"><code>{profileJson(name, ids)}</code></pre>}
        <P>There is no link that applies a profile from a web page, by design: a profile is a list of control names, and importing one only fills the review screen.</P>
        <ProBox campaign="pct-tool-profile-builder" />
      </Panel>
      <SourceList checked={CHECKED} items={[{ label: "PC Tweaker source code: the profile format and import checks (profiles.rs)", url: "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/profiles.rs" }]} />
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * Debloat list builder
 * ------------------------------------------------------------------ */

const DEBLOAT_SRC = "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src/debloat.rs";

export function DebloatBuilder({ navigate }: { navigate: Nav }) {
  const meta = tool("/tools/debloat-windows-11");
  const [ids, setIds] = useState<string[]>([]);
  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const picked = DEBLOAT_APPS.filter((a) => ids.includes(a.id));
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Tools", "/tools/"], [meta.name, `${meta.path}/`]]} />
      <Head eyebrow="FREE TOOL" title={meta.title} intro="Most debloat scripts remove dozens of packages in one go and give no way back. This page starts from the other end: the preinstalled apps PC Tweaker is willing to remove, what each removal costs, and the Microsoft Store page that brings each one back." />
      <Panel title="1. Pick the apps" id="pick">
        <P>
          These are the {DEBLOAT_APPS.length} apps in PC Tweaker&apos;s Debloat catalogue, the same list the app offers. Each one is a Microsoft Store app that a single account can remove and reinstall. What is not here is left out on purpose: Microsoft Edge, the Store itself, system components, and anything Windows marks as not removable.
        </P>
        <div className="mt-6 grid gap-2 md:grid-cols-2">
          {DEBLOAT_APPS.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-white/5">
              <input type="checkbox" checked={ids.includes(a.id)} onChange={() => toggle(a.id)} className="mt-1.5 accent-[var(--accent)]" />
              <span className="text-[14px] leading-6">
                <span className="font-semibold text-[var(--fg)]">{a.name}</span>
                <span className="block text-[var(--fg-dim)]">{a.description} {a.impact}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="2. Load the list in PC Tweaker" id="app">
        <P>
          {ids.length} selected. Download the list, then in PC Tweaker open Debloat and choose Load list. Loading only ticks the apps: before anything is removed the app checks again that each package comes from the expected publisher, that no other installed package depends on it and that Windows allows its removal, then shows a preview to confirm. Every removal is written to a journal, and each app keeps its Reinstall link. Debloat is part of the Free plan.
        </P>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" disabled={ids.length === 0} onClick={() => download("pc-tweaker-debloat-list.json", debloatListJson(ids), "application/json")} className="bg-accent rounded-lg px-5 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-40">Download list (.json)</button>
          <a href={DOWNLOAD_EXE} className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-[var(--fg)]">Download PC Tweaker Free</a>
        </div>
      </Panel>
      <Panel title="3. Or remove them by hand" id="manual">
        <P>
          The same removal from PowerShell, for the account you are signed in to. Nothing here needs administrator rights. Unlike the app, these lines do not check publishers or dependencies and keep no record, so read them before you run them.
        </P>
        <Steps
          steps={[
            { title: "Open PowerShell as yourself", note: "Start menu › type PowerShell › Windows PowerShell. Do not choose Run as administrator: the removal is meant for your account only." },
            { title: "Run the lines for the apps you picked", note: ids.length ? undefined : "Pick at least one app above and its line appears here.", code: ids.length ? debloatPowerShell(ids) : undefined, shell: "PowerShell" },
            { title: "Check what is left", code: picked.length ? picked.map((a) => `Get-AppxPackage -Name '${a.package_name}'`).join("\n") : "Get-AppxPackage | Select-Object Name, Publisher", shell: "PowerShell", note: "An empty result for an app means it is gone from this account." },
          ]}
        />
        <P>
          Other accounts on the PC keep their copy, and new accounts still receive the apps Windows provisions for them. Removing a provisioned package for every future account is a different, system-wide change that PC Tweaker does not make.
        </P>
      </Panel>
      <Panel title="4. Getting an app back" id="reinstall">
        <P>Every app in the catalogue has a Microsoft Store page. Open it while signed in to the same account and press Get or Install. Data the app kept locally, such as settings or game progress, may not return.</P>
        <ul className="mt-5 space-y-2 text-[15px] leading-7">
          {(picked.length ? picked : DEBLOAT_APPS).map((a) => (
            <li key={a.id}><a href={a.store_url} className="text-accent font-medium" rel="noopener">{a.name} in Microsoft Store</a><span className="text-[var(--fg-dim)]"> ({a.package_name})</span></li>
          ))}
        </ul>
      </Panel>
      <Panel title="What removing these apps will not do" id="limits">
        <P>
          Removing an app you never open frees its disk space; it saves memory or processor time only if the app was running in the background, and PC Tweaker&apos;s Debloat screen shows which ones are running and how much memory they use. The other gains are fewer Start menu entries and fewer Store updates for apps you never use. For background work and services, see the <Link to="/database/" onNavigate={navigate} className="text-accent font-medium">Windows processes and services database</Link>; for settings, the <Link to="/tools/profile-builder/" onNavigate={navigate} className="text-accent font-medium">Profile Builder</Link>. Desktop programs that came with the PC, such as vendor utilities or a trial antivirus, are not Store apps: <Link to="/uninstaller/" onNavigate={navigate} className="text-accent font-medium">PC Tweaker Uninstaller</Link> removes those and shows what each one leaves behind.
        </P>
      </Panel>
      <SourceList
        checked={CHECKED}
        items={[
          { label: "PC Tweaker source code: the Debloat catalogue, eligibility checks and journal (debloat.rs)", url: DEBLOAT_SRC },
          { label: "Microsoft Learn: Remove-AppxPackage", url: "https://learn.microsoft.com/en-us/powershell/module/appx/remove-appxpackage" },
          { label: "Microsoft Learn: Get-AppxPackage", url: "https://learn.microsoft.com/en-us/powershell/module/appx/get-appxpackage" },
        ]}
      />
    </Shell>
  );
}
