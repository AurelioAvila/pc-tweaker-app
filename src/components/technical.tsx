// "Technical details" — the exact system change behind a tweak's commercial
// description.
//
// Design intent: this panel is evidence, so it reads like a spec sheet, not
// like marketing. Monospace values, a type chip per row, no icons competing
// with the data, and copy-to-clipboard on the registry path because the point
// of showing it is that the user can go and check it in regedit.
//
// One component for every tweak: rows are driven by the tagged union, so
// hundreds of tweaks need no per-tweak UI code, and a new backend variant
// fails the build here rather than rendering as the wrong kind of row.
import { useState } from "react";
import { Strings } from "../i18n";
import { TechnicalChange } from "../types";

const KIND_CHIP: Record<TechnicalChange["kind"], string> = {
  registry: "bg-sky-400/10 text-sky-300 ring-sky-400/25",
  command: "bg-violet-400/10 text-violet-300 ring-violet-400/25",
  service: "bg-amber-400/10 text-amber-300 ring-amber-400/25",
};

function Row({ change, s }: { change: TechnicalChange; s: Strings }) {
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1400);
      })
      .catch(() => {
        // Clipboard denied: the value is on screen and selectable anyway.
      });
  }

  const kindLabel =
    change.kind === "registry"
      ? s.transparency.kindRegistry
      : change.kind === "command"
        ? s.transparency.kindCommand
        : s.transparency.kindService;

  return (
    <li className="rounded-lg bg-black/30 p-2.5 ring-1 ring-white/[0.06]">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ring-1 ${KIND_CHIP[change.kind]}`}
        >
          {kindLabel}
        </span>
        {change.kind === "registry" && (
          <>
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-3">
              {change.valueType}
            </span>
            <button
              type="button"
              onClick={() => copy(`${change.path}\\${change.valueName}`)}
              className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-ink-3 transition-colors hover:bg-white/5 hover:text-ink-2"
            >
              {copied ? s.transparency.copied : s.transparency.copy}
            </button>
          </>
        )}
      </div>

      {change.kind === "registry" && (
        <dl className="grid gap-0.5 text-[11px]">
          <div className="flex flex-wrap gap-x-2">
            <dt className="w-14 shrink-0 text-ink-3">{s.transparency.key}</dt>
            <dd className="min-w-0 flex-1 break-all font-mono text-ink-2">{change.path}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="w-14 shrink-0 text-ink-3">{s.transparency.value}</dt>
            <dd className="min-w-0 flex-1 break-all font-mono text-ink-2">{change.valueName}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="w-14 shrink-0 text-ink-3">{s.transparency.setsTo}</dt>
            <dd className="min-w-0 flex-1 break-all font-mono text-emerald-300/90">
              {change.setsTo}
            </dd>
          </div>
        </dl>
      )}

      {change.kind === "command" && (
        <p className="break-all font-mono text-[11px] leading-relaxed text-ink-2">
          <span className="text-violet-300/90">{change.program}</span> {change.arguments}
        </p>
      )}

      {change.kind === "service" && (
        <p className="break-all font-mono text-[11px] leading-relaxed text-ink-2">
          <span className="text-amber-300/90">{change.name}</span> — {change.action}
        </p>
      )}
    </li>
  );
}

/** The disclosure panel. Renders nothing when there is nothing precise to
 *  say — an empty "Technical details" box would imply we're hiding something. */
export function TechnicalDetails({ changes, s }: { changes: TechnicalChange[]; s: Strings }) {
  if (changes.length === 0) return null;
  return (
    <div className="mt-2.5 rounded-xl border border-line-2 bg-black/20 p-2.5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-3">
        {s.transparency.title}
      </p>
      <ul className="grid gap-1.5">
        {changes.map((c, i) => (
          <Row key={`${c.kind}-${String(i)}`} change={c} s={s} />
        ))}
      </ul>
      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-3">{s.transparency.note}</p>
    </div>
  );
}

/** The (i) trigger that sits next to a tweak's badges. */
export function TechnicalToggle({
  open,
  label,
  hive,
  onClick,
}: {
  open: boolean;
  label: string;
  hive: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      title={label}
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
        open
          ? "bg-[var(--app-accent)]/20 text-ink"
          : "bg-surface-2 text-ink-2 hover:bg-surface-hover hover:text-ink"
      }`}
    >
      {hive !== "—" && hive}
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 opacity-70">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="7.9" r="1" fill="currentColor" />
      </svg>
    </button>
  );
}
