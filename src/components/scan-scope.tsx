// "What we check": the Scan's 19 checks as one list. Every row has the same
// height and the same columns: a status mark in one 18px slot (waiting,
// reading, done, something to look at), the check's name with an optional
// one-line description, and, once it is done, its measured result.
import { format, type Lang } from "../i18n";
import { formatBytes, formatNumber } from "../lib";
import {
  FIRST_NEW_PROBE,
  SCAN_PROBES,
  probeResult,
  type ProbeResult,
  type ProbeStatus,
  type ScanProbe,
} from "../scan-runner";
import { CheckMark } from "./fix-progress";
import { Badge } from "./ui";
import { SCAN_COPY } from "./scan-copy";

type Copy = (typeof SCAN_COPY)[Lang];

function resultText(r: ProbeResult, c: Copy): string {
  switch (r.kind) {
    case "ok":
      return c.resultOk;
    case "found":
      return format(c.resultFound, { count: formatNumber(r.count) });
    case "checked":
      return format(c.resultChecked, { count: formatNumber(r.count) });
    case "bytes":
      return formatBytes(r.bytes);
    case "percent":
      return `${formatNumber(r.percent)}${c.percentSign}`;
  }
}

export function ScanScope({
  lang,
  unavailable,
  states,
  valueOf,
  progress,
  open,
}: {
  lang: Lang;
  /** The word for a check that could not be read. */
  unavailable: string;
  /** Each check's state as the list shows it. */
  states: (probe: ScanProbe) => ProbeStatus | "idle";
  /** A finished check's answer. */
  valueOf: (probe: ScanProbe) => unknown;
  /** Checks done while a scan runs; null otherwise. */
  progress: number | null;
  open: boolean;
}) {
  const c = SCAN_COPY[lang];
  const total = SCAN_PROBES.length;
  return (
    <aside className="scan-scope">
      <details open={open || undefined}>
        <summary>
          <span className="scan-scope-title">
            <span>{c.scope}</span>
            <small>{c.scopeHint}</small>
          </span>
          <span className="scan-scope-count">
            {progress !== null && (
              <span className="scan-scope-meter" aria-hidden="true">
                <span style={{ width: `${(progress / total) * 100}%` }} />
              </span>
            )}
            <Badge>
              {progress !== null
                ? format(c.scopeProgress, { done: progress, total })
                : format(c.scopeCount, { count: total })}
            </Badge>
          </span>
        </summary>
        <ol className="scope-list" role="list">
          {SCAN_PROBES.map((probe, i) => {
            const state = states(probe);
            const result = state === "complete" ? probeResult(probe, valueOf(probe)) : null;
            const mark =
              state === "unavailable" || result?.issue
                ? "issue"
                : state === "complete"
                  ? "done"
                  : state === "reading"
                    ? "running"
                    : "waiting";
            const name = c.probes[i];
            const detail = i >= FIRST_NEW_PROBE ? c.newDetails[i - FIRST_NEW_PROBE] : "";
            const text =
              state === "unavailable" ? unavailable : result ? resultText(result, c) : "";
            return (
              <li
                key={probe}
                className="scope-row"
                data-mark={mark}
                data-unavailable={state === "unavailable" || undefined}
                title={detail ? `${name}: ${detail}` : undefined}
              >
                <span className="scope-mark" aria-hidden="true">
                  {mark === "done" ? <CheckMark /> : null}
                </span>
                <span className="scope-text">
                  <span className="scope-name">
                    <span className="scope-name-text">{name}</span>
                    {detail && <span className="scope-tag">{c.newBadge}</span>}
                  </span>
                  {detail && <span className="scope-detail">{detail}</span>}
                </span>
                <span className="scope-result">{text}</span>
              </li>
            );
          })}
        </ol>
      </details>
    </aside>
  );
}
