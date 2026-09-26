import "./tool-surfaces.css";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { formatBytes } from "../lib";
import { DpcReport, NetworkSnapshot, NetworkVerification, TweakInfo } from "../types";
import { ToolHeader, ToolStatus } from "./tool-section";

const CAPTURE_LENGTHS = [5, 10, 30];
const DRIVER_ROWS = 8;
/** Overruns past Microsoft's 100 us / 25 us guidance are routine on healthy
 *  machines. A routine that holds a processor for over a millisecond is where
 *  audio buffers and frame deadlines start to be at risk. */
const AUDIBLE_US = 1000;

const us = (value: number) => value.toFixed(1);
const ms = (value: number | null) => (value === null ? "–" : value.toFixed(1));

/**
 * DPC and ISR execution times per driver, measured by the kernel (see
 * src-tauri/src/diagnostics/dpc.rs). Read-only: nothing is changed, so there
 * is nothing to restore, and it is free.
 */
export function LatencyTracePanel({ s }: { s: Strings }) {
  const t = s.latencyTrace;
  const [seconds, setSeconds] = useState(10);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DpcReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      setReport(await invoke<DpcReport>("trace_dpc_latency", { seconds }));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setRunning(false);
    }
  }

  const longest = (d: DpcReport["drivers"][number]) => Math.max(d.dpc.maxUs, d.isr.maxUs);
  // The longest absolute stall names the driver, not the ranking by limit
  // ratio the list arrives in: a millisecond is a millisecond for audio.
  const severe = report?.drivers
    .filter((d) => longest(d) >= AUDIBLE_US)
    .reduce<DpcReport["drivers"][number] | undefined>(
      (worst, d) => (!worst || longest(d) > longest(worst) ? d : worst),
      undefined,
    );
  const overruns = report ? report.dpc.overLimit + report.isr.overLimit : 0;
  const peak = report ? Math.max(report.dpc.maxUs, report.isr.maxUs) : 0;

  return (
    <section className="tool-panel" aria-busy={running}>
      <ToolHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <>
            <select
              aria-label={t.duration}
              value={seconds}
              disabled={running}
              onChange={(event) => setSeconds(Number(event.target.value))}
              className="rounded-lg border border-line bg-surface-1 px-2 py-1.5 text-[12px] text-ink-2"
            >
              {CAPTURE_LENGTHS.map((value) => (
                <option key={value} value={value}>
                  {format(t.secondsOption, { seconds: value })}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="tool-primary-action"
              disabled={running}
              onClick={() => void run()}
            >
              {t.run}
            </button>
          </>
        }
      />
      {running && <ToolStatus busy>{format(t.running, { seconds })}</ToolStatus>}
      {error && <ToolStatus tone="error">{error}</ToolStatus>}
      {report && !running && (
        <div className="mt-3 space-y-2 text-[12px] text-ink-2">
          <ToolStatus tone={severe ? "error" : overruns > 0 ? "neutral" : "active"}>
            {severe
              ? severe.driver
                ? format(t.verdictBad, { driver: severe.driver, max: us(longest(severe)) })
                : format(t.verdictBadUnattributed, { max: us(longest(severe)) })
              : overruns > 0
                ? format(t.verdictMinor, { over: overruns, max: us(peak) })
                : t.verdictGood}
          </ToolStatus>
          {[report.dpc, report.isr].map((totals) => (
            <p key={totals.kind}>
              {format(totals.kind === "dpc" ? t.dpcSummary : t.isrSummary, {
                max: us(totals.maxUs),
                limit: totals.limitUs,
                over: totals.overLimit,
                count: totals.count,
              })}
            </p>
          ))}
          {report.drivers.length > 0 && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-1 font-medium">{t.colDriver}</th>
                  <th className="py-1 text-right font-medium">{t.colDpc}</th>
                  <th className="py-1 text-right font-medium">{t.colIsr}</th>
                  <th className="py-1 text-right font-medium">{t.colOver}</th>
                </tr>
              </thead>
              <tbody>
                {report.drivers.slice(0, DRIVER_ROWS).map((row) => {
                  const over = row.dpc.overLimit + row.isr.overLimit;
                  return (
                    <tr key={row.driver ?? "?"} className="border-t border-white/5">
                      <td className="py-1 text-ink-2">{row.driver ?? t.unattributed}</td>
                      <td className="py-1 text-right tabular-nums text-white/75">
                        {row.dpc.count > 0 ? `${us(row.dpc.maxUs)} µs` : "–"}
                      </td>
                      <td className="py-1 text-right tabular-nums text-white/75">
                        {row.isr.count > 0 ? `${us(row.isr.maxUs)} µs` : "–"}
                      </td>
                      <td
                        className={`py-1 text-right tabular-nums ${over > 0 ? "text-rose-300/90" : "text-ink-3"}`}
                      >
                        {over}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {report.worst.length > 0 && (
            <>
              <p className="pt-1 font-medium text-ink">{t.spikesTitle}</p>
              <ul className="space-y-0.5 text-[11px] text-ink-3">
                {report.worst.slice(0, 5).map((spike, index) => (
                  <li key={index} className="tabular-nums">
                    {format(t.spikeLine, {
                      kind: spike.kind.toUpperCase(),
                      duration: us(spike.durationUs),
                      driver: spike.driver ?? t.unattributed,
                      at: (spike.atMs / 1000).toFixed(2),
                    })}
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.eventsLost + report.buffersLost > 0 && (
            <p className="text-ink-3">
              {format(t.lost, { events: report.eventsLost, buffers: report.buffersLost })}
            </p>
          )}
          {!report.driversResolved && <p className="text-ink-3">{t.hidden}</p>}
          <p className="text-[11px] text-ink-3">{t.note}</p>
        </div>
      )}
    </section>
  );
}

function SnapshotLines({ s, snapshot }: { s: Strings; snapshot: NetworkSnapshot }) {
  const t = s.networkCheck;
  const { link, tcp } = snapshot;
  if (!snapshot.online && link.received === 0) return <p>{t.offline}</p>;
  return (
    <>
      <p>
        {format(t.rtt, {
          median: ms(link.medianMs),
          min: ms(link.minMs),
          max: ms(link.maxMs),
        })}
      </p>
      <p>{format(t.jitter, { jitter: ms(link.jitterMs) })}</p>
      <p>{format(t.loss, { received: link.received, sent: link.sent })}</p>
      {tcp?.rttUs != null && <p>{format(t.tcpRtt, { rtt: ms(tcp.rttUs / 1000) })}</p>}
      {tcp?.nodelay != null && <p>{tcp.nodelay ? t.nagleOff : t.nagleOn}</p>}
      {tcp?.soRcvbuf != null && tcp.rcvBuf != null && (
        <p>
          {format(t.buffers, {
            reserved: formatBytes(tcp.soRcvbuf),
            autotuned: formatBytes(tcp.rcvBuf),
          })}
        </p>
      )}
    </>
  );
}

/**
 * The same measurement the apply funnel takes around the TCP tweaks (see
 * src-tauri/src/diagnostics/network_verify.rs), on demand, plus the
 * before/after record of the most recent one.
 */
export function NetworkCheckPanel({ s, tweaks }: { s: Strings; tweaks: TweakInfo[] }) {
  const t = s.networkCheck;
  const [running, setRunning] = useState(false);
  const [snapshot, setSnapshot] = useState<NetworkSnapshot | null>(null);
  const [last, setLast] = useState<NetworkVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-read whenever the tweak list changes: an apply writes a new record
  // from the elevated helper, and this panel sits next to that list.
  useEffect(() => {
    invoke<NetworkVerification | null>("last_network_verification")
      .then(setLast)
      .catch(() => setLast(null));
  }, [tweaks]);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      setSnapshot(await invoke<NetworkSnapshot>("verify_network"));
      setLast(await invoke<NetworkVerification | null>("last_network_verification"));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setRunning(false);
    }
  }

  const verdict = last
    ? {
        lineChanged: t.verdictLineChanged,
        noMeasurableChange: t.verdictNone,
        inconclusive: t.verdictInconclusive,
      }[last.latency]
    : null;

  return (
    <section className="tool-panel" aria-busy={running}>
      <ToolHeader
        title={t.title}
        description={t.subtitle}
        actions={
          <button
            type="button"
            className="tool-primary-action"
            disabled={running}
            onClick={() => void run()}
          >
            {running ? t.running : t.run}
          </button>
        }
      />
      {error && <ToolStatus tone="error">{error}</ToolStatus>}
      {snapshot && (
        <div className="mt-3 space-y-1 text-[12px] text-ink-2">
          <SnapshotLines s={s} snapshot={snapshot} />
        </div>
      )}
      {last && verdict && (
        <div className="mt-3 space-y-1 text-[12px] text-ink-2">
          <p className="font-medium text-ink">
            {format(t.lastTitle, {
              tweak:
                s.tweaks[last.tweakId]?.name ??
                tweaks.find((tweak) => tweak.id === last.tweakId)?.name ??
                last.tweakId,
              time: last.measuredAt ? new Date(last.measuredAt).toLocaleString() : "–",
            })}
          </p>
          <p>
            {format(verdict, {
              delta:
                last.medianDeltaMs === null
                  ? "–"
                  : `${last.medianDeltaMs > 0 ? "+" : ""}${last.medianDeltaMs.toFixed(1)}`,
            })}
          </p>
          {last.before.tcp && last.after.tcp && (
            <p className="text-ink-3">
              {format(t.socketsBeforeAfter, {
                nagleBefore: last.before.tcp.nodelay ? t.stateOff : t.stateOn,
                nagleAfter: last.after.tcp.nodelay ? t.stateOff : t.stateOn,
                bufBefore:
                  last.before.tcp.rcvBuf === null ? "–" : formatBytes(last.before.tcp.rcvBuf),
                bufAfter: last.after.tcp.rcvBuf === null ? "–" : formatBytes(last.after.tcp.rcvBuf),
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
