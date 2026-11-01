import { useState, type ReactNode } from "react";
import { Link } from "../../router";
import { CATALOG, CATEGORIES, CHECKED, manualMethod, requirementsOf, scopeOf, sourceFile, type Change } from "../../reference/catalog";
import { VERDICTS } from "../../reference/tweak-notes";
import { WINDOWS_DB, DB_VERDICTS, dbBySlug, dbPath, type DbEntry } from "../../reference/windows-db";
import { FIX_GUIDES } from "../fix-guides";
import { ProBox, SourceList, Steps, TechSummary, type Step } from "../../components/ReferenceBlocks";
import { CATEGORY_KEYS, TOOLS, TWEAKS, categoryPath, dbFaq, tweakById, type CategoryKey, type TweakPage } from "./data";

type Nav = (to: string) => void;

const TONES: Record<string, string> = {
  good: "border-emerald-400/40 text-emerald-300",
  neutral: "border-white/15 text-[var(--fg)]",
  muted: "border-white/10 text-[var(--fg-dim)]",
  warn: "border-amber-400/40 text-amber-300",
};

export function Badge({ label, tone }: { label: string; tone: string }) {
  return <span className={`font-mono-t inline-block rounded-full border px-2.5 py-0.5 text-[11px] tracking-wide ${TONES[tone]}`}>{label}</span>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="px-5 pt-32 pb-24 md:px-12">
      <article className="mx-auto max-w-4xl">{children}</article>
    </main>
  );
}

function Crumbs({ trail, navigate }: { trail: readonly (readonly [string, string])[]; navigate: Nav }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-[var(--fg-dim)]">
      <ol className="flex flex-wrap gap-x-2 gap-y-1">
        <li><Link to="/" onNavigate={navigate} className="hover:text-[var(--fg)]">Home</Link></li>
        {trail.map(([name, to], i) => (
          <li key={to} className="flex gap-2">
            <span aria-hidden="true">/</span>
            {i === trail.length - 1 ? <span aria-current="page" className="text-[var(--fg)]">{name}</span> : <Link to={to} onNavigate={navigate} className="hover:text-[var(--fg)]">{name}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Head({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <>
      <p className="font-mono-t text-accent mb-5 text-[12px] tracking-[0.15em]">{eyebrow}</p>
      <h1 className="font-display max-w-3xl text-4xl leading-[1.08] font-bold tracking-[-0.03em] text-[var(--fg)] md:text-5xl">{title}</h1>
      <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--fg-dim)]">{intro}</p>
    </>
  );
}

function Panel({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl bg-[var(--surface)] p-7 md:p-9" aria-labelledby={id}>
      <h2 id={id} className="font-display text-2xl font-bold text-[var(--fg)]">{title}</h2>
      {children}
    </section>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="mt-4 max-w-3xl leading-7 text-[var(--fg-dim)]">{children}</p>;

/* ------------------------------------------------------------------ *
 * Tweak pages
 * ------------------------------------------------------------------ */

function changeRow(c: Change) {
  if (c.kind === "registry") return { where: `${c.path}`, what: `${c.valueName} (${c.valueType}) = ${c.setsTo}` };
  if (c.kind === "service") return { where: `Service ${c.name}`, what: c.action };
  return { where: c.program, what: c.arguments };
}

function restoreText(p: TweakPage) {
  const kinds = new Set(p.t.changes.map((c) => c.kind));
  if (p.t.changes.length === 1 && kinds.has("registry"))
    return "Restore writes back the value PC Tweaker found before applying, or deletes the value if it was absent.";
  if (kinds.has("service")) return "Restore puts back the service's start type and whether it was running.";
  return "Restore puts back every setting this control changed, as PC Tweaker recorded it before applying.";
}

function TweakRow({ p, navigate }: { p: TweakPage; navigate: Nav }) {
  const v = VERDICTS[p.note.verdict];
  return (
    <li className="border-t border-white/5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link to={`${p.path}/`} onNavigate={navigate} className="text-[16px] font-semibold text-[var(--fg)] hover:text-[var(--accent)]">{p.title}</Link>
        <Badge label={v.label} tone={v.tone} />
        <Badge label={p.t.requires_pro ? "Pro" : "Free"} tone="muted" />
      </div>
      <p className="mt-1.5 text-[14px] leading-6 text-[var(--fg-dim)]">{p.note.lead ?? p.t.description}</p>
    </li>
  );
}

export function TweakDetail({ p, navigate }: { p: TweakPage; navigate: Nav }) {
  const { t, note } = p;
  const v = VERDICTS[note.verdict];
  const method = manualMethod(t);
  const cat = CATEGORIES[p.category];
  const steps: Step[] = note.manual
    ? [...note.manual.steps]
    : method
      ? [...method.check, ...method.apply, ...method.undo]
      : [];
  const related = [
    ...(note.related ?? []).map(tweakById).filter((x): x is TweakPage => !!x),
    ...TWEAKS.filter((x) => x.category === p.category && x.t.id !== t.id && !(note.related ?? []).includes(x.t.id)).slice(0, 4),
  ];
  const sources = [sourceFile(t), ...(note.sources ?? [])];
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Windows tweaks", "/tweaks/"], [cat.label, `${categoryPath(p.category)}/`], [p.title, `${p.path}/`]]} />
      <Head eyebrow={`${cat.label.toUpperCase()} · ${t.requires_pro ? "PRO" : "FREE"} · PC TWEAKER CONTROL`} title={p.title} intro={note.lead ?? t.description} />

      <TechSummary
        rows={[
          { label: "In PC Tweaker", value: `${t.name} (${cat.label})` },
          ...t.changes.slice(0, 3).map((c, i) => ({ label: i === 0 ? "What it changes" : "Also changes", value: `${changeRow(c).where}: ${changeRow(c).what}` })),
          ...(t.changes.length > 3 ? [{ label: "And", value: `${t.changes.length - 3} more value${t.changes.length - 3 === 1 ? "" : "s"}, listed below` }] : []),
          ...(t.changes.length === 0 ? [{ label: "What it changes", value: "A configurable tool; see the method below" }] : []),
          { label: "Applies to", value: scopeOf(t) },
          { label: "Administrator rights", value: t.requires_admin ? "Yes, Windows asks once" : "No" },
          { label: "Requires", value: requirementsOf(t) },
          { label: "Plan", value: t.requires_pro ? "Pro" : "Free, no account needed" },
          { label: "In profiles and batches", value: t.manual_only ? "Never: only from its own switch" : "Yes" },
          { label: "Undo", value: restoreText(p) },
        ]}
      />

      <section className="mt-8 rounded-2xl border border-white/10 p-7 md:p-9" aria-labelledby="verdict">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="verdict" className="font-display text-2xl font-bold text-[var(--fg)]">Verdict</h2>
          <Badge label={v.label} tone={v.tone} />
        </div>
        <dl className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <dt className="text-[13px] font-semibold tracking-wide text-[var(--fg)]">When it helps</dt>
            <dd className="mt-1.5 text-[15px] leading-7 text-[var(--fg-dim)]">{note.helps}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold tracking-wide text-[var(--fg)]">When to skip it</dt>
            <dd className="mt-1.5 text-[15px] leading-7 text-[var(--fg-dim)]">{note.skip}</dd>
          </div>
        </dl>
      </section>

      {t.changes.length > 0 && (
        <Panel title="Exactly what changes" id="changes">
          <P>The same list PC Tweaker shows under Technical details before you apply it, generated from the app's source code.</P>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="text-[var(--fg-dim)]"><th className="py-2 pr-4 font-medium">Where</th><th className="py-2 font-medium">Change</th></tr>
              </thead>
              <tbody>
                {t.changes.map((c, i) => (
                  <tr key={i} className="border-t border-white/5 align-top">
                    <td className="py-2.5 pr-4 font-mono-t text-[12.5px] [overflow-wrap:anywhere] text-[var(--fg)]">{changeRow(c).where}</td>
                    <td className="py-2.5 font-mono-t text-[12.5px] [overflow-wrap:anywhere] text-[var(--fg)]">{changeRow(c).what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Method A: do it by hand" id="by-hand">
        {note.manual ? (
          <P>{note.manual.intro}</P>
        ) : method ? (
          <P>
            {method.elevated ? "Open Command Prompt or PowerShell as administrator. " : "An ordinary Command Prompt or PowerShell window is enough. "}
            Record the current state first, so you can put it back exactly.
            {method.signOut ? " Values under Control Panel are read when you sign in: sign out and back in after changing them." : ""}
          </P>
        ) : (
          <P>This control's mechanism is not a single value you can set by hand, so no command is offered here rather than a guess.</P>
        )}
        {steps.length > 0 && <Steps steps={steps} />}
      </Panel>

      <Panel title="Method B: with PC Tweaker" id="with-pct">
        <P>
          Open PC Tweaker, go to {cat.app} and find "{t.name}". Technical details lists the change above before anything runs.
          {t.requires_admin ? " Windows asks for administrator approval once." : ""} Applying records the previous state, and {restoreText(p).charAt(0).toLowerCase() + restoreText(p).slice(1)}
          {t.manual_only ? " This control is never applied as part of a profile or a batch, only from its own switch." : ""}
        </P>
        <ProBox campaign={`pct-tweak-${t.id}`} />
      </Panel>

      {(related.length > 0 || note.db || note.guides) && (
        <nav aria-label="Related" className="mt-14 border-t border-white/10 pt-9">
          <h2 className="font-display text-xl font-bold text-[var(--fg)]">Related</h2>
          <ul className="mt-5 space-y-2.5 text-[15px] leading-7 text-[var(--fg-dim)]">
            {(note.guides ?? []).map((g) => (
              <li key={g}><Link to={g} onNavigate={navigate} className="text-accent font-medium">{guideLabel(g)}</Link></li>
            ))}
            {(note.db ?? []).map((k) => dbBySlug(k)).filter((e): e is DbEntry => !!e).map((e) => (
              <li key={e.slug}><Link to={`${dbPath(e)}/`} onNavigate={navigate} className="text-accent font-medium">{e.name}</Link>{` — ${e.displayName}, in the Windows database`}</li>
            ))}
            {related.map((r) => (
              <li key={r.t.id}><Link to={`${r.path}/`} onNavigate={navigate} className="text-accent font-medium">{r.title}</Link>{` — ${VERDICTS[r.note.verdict].label}`}</li>
            ))}
          </ul>
        </nav>
      )}
      <SourceList checked={CHECKED} items={sources} />
    </Shell>
  );
}

function guideLabel(path: string) {
  const fix = FIX_GUIDES[path.replace(/\/$/, "") as keyof typeof FIX_GUIDES];
  if (fix) return fix.title;
  const tool = TOOLS.find((t) => `${t.path}/` === path);
  if (tool) return tool.name;
  const known: Record<string, string> = {
    "/windows-privacy-tool/": "The Windows privacy guide",
    "/turn-off-windows-recall/": "How to turn off Windows Recall, and keep it off",
    "/gaming-performance/": "The gaming performance guide",
    "/guides/amd-ryzen-x3d-core-parking-windows-11/": "Ryzen X3D core parking on Windows 11",
    "/guides/windows-11-privacy-telemetry-rollback/": "Windows 11 privacy and telemetry settings, with rollback",
  };
  return known[path] ?? path;
}

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="mt-10 block">
      <span className="font-mono-t text-[12px] tracking-[0.12em] text-[var(--fg-dim)]">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-[var(--bg-2)] px-4 py-3 text-[15px] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
        placeholder="Name, registry value or service"
      />
    </label>
  );
}

const matches = (q: string, ...fields: string[]) => {
  const needle = q.trim().toLowerCase();
  return !needle || fields.some((f) => f.toLowerCase().includes(needle));
};
const tweakText = (p: TweakPage) => [p.title, p.t.name, p.t.id, ...p.t.changes.map((c) => (c.kind === "registry" ? `${c.path} ${c.valueName}` : c.kind === "service" ? c.name : c.program))];

export function TweakIndex({ navigate }: { navigate: Nav }) {
  const [q, setQ] = useState("");
  const pro = CATALOG.filter((t) => t.requires_pro).length;
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Windows tweaks", "/tweaks/"]]} />
      <Head
        eyebrow="REFERENCE · WINDOWS TWEAKS"
        title="Windows tweaks, explained one setting at a time"
        intro={`All ${CATALOG.length} controls in PC Tweaker (${CATALOG.length - pro} Free, ${pro} Pro), each with the exact value or service it changes, how to do it by hand, how to undo it and an honest verdict. The values come straight from the app's source code; nothing here promises a frame-rate gain.`}
      />
      <SearchBox value={q} onChange={setQ} label="FILTER THE LIST" />
      {CATEGORY_KEYS.map((c) => {
        const items = TWEAKS.filter((p) => p.category === c && matches(q, ...tweakText(p)));
        if (items.length === 0) return null;
        return (
          <section key={c} className="mt-12" aria-labelledby={`cat-${c}`}>
            <h2 id={`cat-${c}`} className="font-display text-2xl font-bold text-[var(--fg)]">
              <Link to={`${categoryPath(c)}/`} onNavigate={navigate} className="hover:text-[var(--accent)]">{CATEGORIES[c].label}</Link>
            </h2>
            <ul className="mt-3">{items.map((p) => <TweakRow key={p.t.id} p={p} navigate={navigate} />)}</ul>
          </section>
        );
      })}
      <p className="mt-12 text-[14px] text-[var(--fg-dim)]">
        Verdicts: <strong className="text-[var(--fg)]">Worth it on most PCs</strong>, <strong className="text-[var(--fg)]">Depends on your setup</strong>, <strong className="text-[var(--fg)]">No measured benefit</strong> (we have no measurement showing an effect, or Microsoft documents the value as unused) and <strong className="text-[var(--fg)]">Trade-off: read first</strong> (it costs protection, power or a feature).
      </p>
    </Shell>
  );
}

const CATEGORY_INTROS: Record<CategoryKey, string> = {
  performance: "Delays, animations, background work and power settings. Several of these change how the desktop feels rather than how fast the hardware is, and the verdicts say which.",
  gaming: "Settings gaming guides talk about, with what Windows documentation actually says about each one. Some are useful, some are documented as unused, and none comes with a promised frame-rate gain.",
  privacy: "Diagnostic data, advertising, suggestions and AI features. Most are per-account switches; the ones that are machine-wide policies say so, and the verdicts note what each one does not cover.",
  ui: "Taskbar, Start, File Explorer and theme preferences. These are about how Windows looks and behaves, not speed.",
  maintenance: "Updates, file paths, search indexing, startup and storage. Several trade convenience for control; the verdicts spell out the cost.",
};

export function CategoryIndex({ c, navigate }: { c: CategoryKey; navigate: Nav }) {
  const items = TWEAKS.filter((p) => p.category === c);
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Windows tweaks", "/tweaks/"], [CATEGORIES[c].label, `${categoryPath(c)}/`]]} />
      <Head eyebrow={`WINDOWS TWEAKS · ${CATEGORIES[c].label.toUpperCase()}`} title={`${CATEGORIES[c].label} tweaks for Windows`} intro={`${items.length} controls. ${CATEGORY_INTROS[c]}`} />
      <ul className="mt-10">{items.map((p) => <TweakRow key={p.t.id} p={p} navigate={navigate} />)}</ul>
      <p className="mt-10 text-[14px] text-[var(--fg-dim)]">
        Other categories:{" "}
        {CATEGORY_KEYS.filter((k) => k !== c).map((k, i) => (
          <span key={k}>{i > 0 && ", "}<Link to={`${categoryPath(k)}/`} onNavigate={navigate} className="text-accent">{CATEGORIES[k].label}</Link></span>
        ))}
        .
      </p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * Windows database
 * ------------------------------------------------------------------ */

function DbRow({ e, navigate }: { e: DbEntry; navigate: Nav }) {
  const v = DB_VERDICTS[e.verdict];
  return (
    <li className="border-t border-white/5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link to={`${dbPath(e)}/`} onNavigate={navigate} className="font-mono-t text-[15px] font-semibold text-[var(--fg)] hover:text-[var(--accent)]">{e.name}</Link>
        <span className="text-[14px] text-[var(--fg-dim)]">{e.displayName}</span>
        <Badge label={v.label} tone={v.tone} />
      </div>
    </li>
  );
}

/** The entries a page names as related, topped up with entries of the same kind so every page links to at least four others. */
export function dbRelated(e: DbEntry, min = 4): DbEntry[] {
  const named = (e.related ?? []).map(dbBySlug).filter((x): x is DbEntry => !!x);
  const seen = new Set([e.slug, ...named.map((x) => x.slug)]);
  const at = WINDOWS_DB.indexOf(e);
  // ponytail: neighbours in the list, not topic matching; good enough while the list is hand-ordered by theme.
  const rest = [...WINDOWS_DB.slice(at + 1), ...WINDOWS_DB.slice(0, at)].filter((x) => x.kind === e.kind && !seen.has(x.slug));
  return [...named, ...rest.slice(0, Math.max(0, min - named.length))];
}

/** The entries people look up most, from Search Console impressions (28 days to 29 Oct 2026) and autocomplete demand. */
const DB_POPULAR = [
  "processes/msedgewebview2-exe", "processes/conhost-exe", "processes/smss-exe", "processes/spoolsv-exe", "processes/lsaiso-exe",
  "processes/lsass-exe", "processes/svchost-exe", "processes/tiworker-exe", "processes/ctfmon-exe", "processes/rundll32-exe",
  "services/wsaifabricsvc", "services/dmwappushservice", "services/dosvc", "services/wuauserv", "services/sysmain", "services/usosvc",
];

export function DbIndex({ navigate }: { navigate: Nav }) {
  const [q, setQ] = useState("");
  const list = (kind: DbEntry["kind"]) => WINDOWS_DB.filter((e) => e.kind === kind && matches(q, e.name, e.displayName, e.slug));
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Windows database", "/database/"]]} />
      <Head
        eyebrow="REFERENCE · PROCESSES AND SERVICES"
        title="Windows processes and services: what to leave alone"
        intro="What common Windows processes and services do, according to Microsoft's documentation, which ones to leave alone and which can safely start only when needed. Every entry shows how to check the file and its signature on your own PC, and what PC Tweaker does, or refuses to do, with it."
      />
      <SearchBox value={q} onChange={setQ} label="FIND A PROCESS OR SERVICE" />
      {!q && (
        <nav aria-labelledby="db-popular" className="mt-10">
          <h2 id="db-popular" className="font-display text-xl font-bold text-[var(--fg)]">Most looked up</h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {DB_POPULAR.map(dbBySlug).filter((x): x is DbEntry => !!x).map((x) => (
              <li key={x.slug}><Link to={`${dbPath(x)}/`} onNavigate={navigate} className="font-mono-t inline-block rounded-lg border border-white/10 px-3 py-1.5 text-[13.5px] text-[var(--fg)] hover:border-white/25">{x.name}</Link></li>
            ))}
          </ul>
        </nav>
      )}
      {(["process", "service"] as const).map((kind) => {
        const items = list(kind);
        return items.length ? (
          <section key={kind} className="mt-12" aria-labelledby={`db-${kind}`}>
            <h2 id={`db-${kind}`} className="font-display text-2xl font-bold text-[var(--fg)]">{kind === "process" ? "Processes" : "Services"}</h2>
            <ul className="mt-3">{items.map((e) => <DbRow key={e.slug} e={e} navigate={navigate} />)}</ul>
          </section>
        ) : null;
      })}
      <p className="mt-12 text-[14px] text-[var(--fg-dim)]">
        Not listed? The <Link to="/tools/process-checker/" onNavigate={navigate} className="text-accent">safety checker</Link> shows how to check any process yourself. Entries are added only when every statement on the page can be sourced.
      </p>
    </Shell>
  );
}

export function checkSteps(e: DbEntry): Step[] {
  const base = e.name.replace(/\.exe$/i, "");
  if (e.kind === "process") {
    const known = !e.path.includes("<");
    return [
      { title: "See where it runs from", code: `Get-Process ${base} -ErrorAction SilentlyContinue | Select-Object Id, Path`, shell: "PowerShell", note: "Protected processes hide their path from a normal window; run PowerShell as administrator to see it." },
      { title: "Check who signed the file", code: known ? `Get-AuthenticodeSignature "${e.path}" | Format-List Status, SignerCertificate` : `Get-Process ${base} | ForEach-Object { Get-AuthenticodeSignature $_.Path } | Format-List Status, SignerCertificate`, shell: "PowerShell", note: `Expect Status: Valid and a certificate issued to ${e.signer}. A file with this name anywhere else, or with another signer, deserves a closer look.` },
    ];
  }
  const steps: Step[] = [
    { title: "See its state and start type", code: `Get-Service ${e.name} | Format-List Name, DisplayName, Status, StartType\nsc qc ${e.name}`, shell: "PowerShell" },
  ];
  if (e.verdict !== "leave") {
    steps.push(
      { title: "Let it start only when needed (administrator)", code: `sc config ${e.name} start= demand`, shell: "cmd", note: "Note the START_TYPE that sc qc printed first, so you can put it back." },
      { title: "Put it back", code: `sc config ${e.name} start= <auto|delayed-auto|demand>`, shell: "cmd", note: "Use the start type you noted." },
    );
  }
  return steps;
}

export function DbDetail({ e, navigate }: { e: DbEntry; navigate: Nav }) {
  const v = DB_VERDICTS[e.verdict];
  const tweaks = (e.tweaks ?? []).map(tweakById).filter((x): x is TweakPage => !!x);
  const related = dbRelated(e);
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Windows database", "/database/"], [e.name, `${dbPath(e)}/`]]} />
      <Head eyebrow={e.kind === "process" ? "WINDOWS PROCESS" : "WINDOWS SERVICE"} title={`${e.name}: ${e.displayName}`} intro={e.purpose} />
      <TechSummary
        rows={[
          { label: e.kind === "process" ? "Process" : "Service name", value: e.name },
          { label: "Display name", value: e.displayName },
          { label: e.kind === "process" ? "File" : "Runs from", value: e.path },
          ...(e.binary ? [{ label: "Command line", value: e.binary }] : []),
          ...(e.account ? [{ label: "Runs as", value: e.account }] : []),
          ...(e.signer ? [{ label: "Signed by", value: e.signer }] : []),
          { label: "Verdict", value: v.label },
          ...(e.serverGuidance ? [{ label: "Microsoft, Windows Server 2016 guidance", value: e.serverGuidance }] : []),
        ]}
      />
      <p className="mt-3 text-[13px] text-[var(--fg-dim)]">Paths, signer and service account observed on Windows 11 build 26300 on {e.checked ?? CHECKED}. Run the commands below to check your own PC.</p>

      <section className="mt-8 rounded-2xl border border-white/10 p-7 md:p-9" aria-labelledby="verdict">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="verdict" className="font-display text-2xl font-bold text-[var(--fg)]">Should you touch it?</h2>
          <Badge label={v.label} tone={v.tone} />
        </div>
        <P>{e.why}</P>
      </section>

      <Panel title="What PC Tweaker does with it" id="pct">
        <P>{e.pcTweaker}</P>
        {tweaks.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {tweaks.map((p) => (
              <li key={p.t.id}><Link to={`${p.path}/`} onNavigate={navigate} className="inline-block rounded-lg border border-white/10 px-3.5 py-2 text-[13.5px] text-[var(--fg)] hover:border-white/25">{p.title}</Link></li>
            ))}
          </ul>
        )}
        {tweaks.length > 0 && <ProBox campaign={`pct-db-${e.slug}`} />}
      </Panel>

      <Panel title="Check it yourself" id="check">
        <Steps steps={checkSteps(e)} />
      </Panel>

      <section className="mt-14 border-t border-white/10 pt-9" aria-labelledby="faq">
        <h2 id="faq" className="font-display text-2xl font-bold text-[var(--fg)]">Common questions</h2>
        {dbFaq(e).map((f) => (
          <div key={f.q} className="mt-5">
            <h3 className="text-[17px] font-semibold text-[var(--fg)]">{f.q}</h3>
            <P>{f.a}</P>
          </div>
        ))}
      </section>

      {(related.length > 0 || e.guides) && (
        <nav aria-label="Related" className="mt-14 border-t border-white/10 pt-9">
          <h2 className="font-display text-xl font-bold text-[var(--fg)]">{e.kind === "process" ? "Related processes and services" : "Related services and processes"}</h2>
          <ul className="mt-5 space-y-2.5 text-[15px] leading-7 text-[var(--fg-dim)]">
            {(e.guides ?? []).map((g) => <li key={g}><Link to={g} onNavigate={navigate} className="text-accent font-medium">{guideLabel(g)}</Link></li>)}
            {related.map((r) => <li key={r.slug}><Link to={`${dbPath(r)}/`} onNavigate={navigate} className="text-accent font-medium">{r.name}</Link>{` — ${r.displayName}`}</li>)}
          </ul>
        </nav>
      )}
      <SourceList checked={e.checked ?? CHECKED} items={e.sources} />
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * Fixes and tools hubs
 * ------------------------------------------------------------------ */

export function FixesIndex({ navigate }: { navigate: Nav }) {
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Fixes", "/fixes/"]]} />
      <Head eyebrow="GUIDES · PROBLEM FIRST" title="Windows fixes you can undo" intro="Each guide starts from a problem PC Tweaker can actually help with, shows the manual route first, and lists the sources it was checked against." />
      <ul className="mt-10">
        {Object.entries(FIX_GUIDES).map(([path, g]) => (
          <li key={path} className="border-t border-white/5 py-5">
            <Link to={`${path}/`} onNavigate={navigate} className="text-[17px] font-semibold text-[var(--fg)] hover:text-[var(--accent)]">{g.title}</Link>
            <p className="mt-1.5 text-[14.5px] leading-6 text-[var(--fg-dim)]">{g.seoDescription}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

export function ToolsIndex({ navigate }: { navigate: Nav }) {
  return (
    <Shell>
      <Crumbs navigate={navigate} trail={[["Tools", "/tools/"]]} />
      <Head eyebrow="FREE TOOLS" title="Small Windows tools that run in your browser" intro="Nothing to install and nothing sent anywhere: each tool runs on this page, with data taken from the same reference pages." />
      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {TOOLS.map((tool) => (
          <li key={tool.path} className="rounded-2xl bg-[var(--surface)] p-6">
            <Link to={`${tool.path}/`} onNavigate={navigate} className="font-display text-lg font-bold text-[var(--fg)] hover:text-[var(--accent)]">{tool.name}</Link>
            <p className="mt-2 text-[14px] leading-6 text-[var(--fg-dim)]">{tool.blurb}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

export { Shell, Crumbs, Head, Panel, P, SearchBox, matches };
