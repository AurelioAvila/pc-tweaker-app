import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, Strings } from "../i18n";
import { formatBytes } from "../lib";
import { ProcessEntry, Toast, X3dReport } from "../types";
import { ChipIcon } from "./icons";

/**
 * The 3D V-Cache die aligner.
 *
 * The panel is honest about the machine it is running on: on a single-die
 * part it says there is nothing to align rather than offering a switch that
 * would do nothing, and it never claims the alignment survives the game
 * closing — process affinity does not.
 */

/** Whether a process is already pinned to exactly one die. */
function isAlignedTo(p: ProcessEntry, mask: number): boolean {
  return p.affinity !== null && p.affinity === mask;
}

function DieCard({
  s,
  index,
  l3Bytes,
  threads,
  isVCache,
}: {
  s: Strings;
  index: number;
  l3Bytes: number;
  threads: number;
  isVCache: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-xl border p-3 transition-colors ${
        isVCache ? "border-accent/45 bg-accent-soft" : "border-line bg-surface-2"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="type-label !text-ink-2">
          {format(s.x3d.dieLabel, { index: String(index) })}
        </span>
        {isVCache && (
          <span className="text-accent rounded-full border border-accent/40 px-1.5 py-px text-[10px] font-bold tracking-wide">
            {s.x3d.vcacheBadge}
          </span>
        )}
      </div>
      <p className="type-data mt-1.5 text-[15px] font-semibold text-ink">
        {format(s.x3d.dieCache, { mb: String(Math.round(l3Bytes / (1024 * 1024))) })}
      </p>
      <p className="type-data text-[11.5px] text-ink-3">
        {format(s.x3d.dieThreads, { count: String(threads) })}
      </p>
    </div>
  );
}

export function X3dPanel({
  s,
  pushToast,
}: {
  s: Strings;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [report, setReport] = useState<X3dReport | null>(null);
  const [processes, setProcesses] = useState<ProcessEntry[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [busyPid, setBusyPid] = useState<number | null>(null);

  // `pushToast` is a fresh function on every App render. Depending on it
  // directly made the mount effect re-run on every render, and each re-run's
  // cleanup flipped `alive` to false before the previous read resolved — so
  // the report was never committed and the panel silently rendered nothing.
  // The ref keeps the callback current without making it a dependency.
  const toastRef = useRef(pushToast);
  useEffect(() => {
    toastRef.current = pushToast;
  }, [pushToast]);

  const loadProcesses = useCallback(() => {
    setLoadingProcesses(true);
    invoke<ProcessEntry[]>("x3d_processes")
      .then(setProcesses)
      .catch((e: unknown) => toastRef.current("error", String(e)))
      .finally(() => setLoadingProcesses(false));
  }, []);

  useEffect(() => {
    let alive = true;
    invoke<X3dReport>("x3d_report")
      .then((r) => {
        if (!alive) return;
        setReport(r);
        // The process list costs a 300ms CPU sampling window, so it is only
        // paid for on a machine where the alignment can actually be used.
        if (r.status === "ready") loadProcesses();
      })
      .catch((e: unknown) => {
        // A topology read that fails is worth saying out loud: the panel
        // disappearing without a word is indistinguishable from a machine
        // where the feature simply does not apply.
        if (alive) toastRef.current("error", String(e));
      });
    return () => {
      alive = false;
    };
  }, [loadProcesses]);

  if (report === null) return null;

  const vcache =
    report.vcache_ccd !== null ? (report.ccds[report.vcache_ccd] ?? null) : null;

  const explanation =
    report.status === "single_die"
      ? s.x3d.singleDie
      : report.status === "uniform_cache"
        ? s.x3d.uniformCache
        : report.status === "unavailable"
          ? s.x3d.unavailable
          : null;

  return (
    <section className="animate-card border-line bg-surface-1 mb-4 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <div className="bg-surface-2 border-line grid h-10 w-10 shrink-0 place-items-center rounded-xl border">
          <ChipIcon className="text-accent h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="type-section text-ink">{s.x3d.title}</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-3">
            {s.x3d.subtitle}
          </p>
        </div>
      </div>

      <p className="type-data border-line mt-4 border-t pt-3 text-[12px] text-ink-3">
        <span className="type-label !text-ink-3">{s.x3d.cpuLabel}</span>{" "}
        <span className="text-ink-2">{report.cpu}</span>
      </p>

      {report.ccds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {report.ccds.map((c) => (
            <DieCard
              key={c.index}
              s={s}
              index={c.index}
              l3Bytes={c.l3_bytes}
              threads={c.logical_count}
              isVCache={report.vcache_ccd === c.index}
            />
          ))}
        </div>
      )}

      {explanation !== null && (
        <p className="border-line mt-3 rounded-xl border border-dashed p-3 text-[12.5px] leading-relaxed text-ink-3">
          {explanation}
        </p>
      )}

      {report.status === "ready" && vcache !== null && (
        <>
          <p className="mt-3 text-[13px] font-semibold text-ink">
            {format(s.x3d.readyHeadline, { cores: String(vcache.logical_count) })}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{s.x3d.readyBody}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="type-card text-ink">{s.x3d.processesTitle}</h3>
              <p className="text-[11.5px] text-ink-3">{s.x3d.processesHint}</p>
            </div>
            <button
              onClick={loadProcesses}
              disabled={loadingProcesses}
              className="border-line-2 text-ink-2 hover:border-accent/40 hover:text-ink shrink-0 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              {loadingProcesses ? s.x3d.refreshing : s.x3d.refresh}
            </button>
          </div>

          <ul className="mt-2 flex flex-col gap-1.5">
            {processes.map((p) => {
              const aligned = isAlignedTo(p, vcache.mask);
              return (
                <li
                  key={p.pid}
                  className="border-line bg-surface-2 flex items-center gap-3 rounded-xl border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">
                      {p.name}
                      {aligned && (
                        <span className="text-accent ml-2 text-[10.5px] font-bold uppercase tracking-wide">
                          {s.x3d.alignedBadge}
                        </span>
                      )}
                    </p>
                    <p className="type-data text-[11px] text-ink-3">
                      {p.cpu_pct.toFixed(1)}% · {formatBytes(p.memory_bytes)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setBusyPid(p.pid);
                      const call = aligned
                        ? invoke("x3d_reset", { pid: p.pid })
                        : invoke("x3d_align", { pid: p.pid, mask: vcache.mask });
                      call
                        .then(() => {
                          toastRef.current(
                            "success",
                            format(aligned ? s.x3d.resetToast : s.x3d.alignedToast, {
                              name: p.name,
                            }),
                          );
                          loadProcesses();
                        })
                        .catch((e: unknown) => toastRef.current("error", String(e)))
                        .finally(() => setBusyPid(null));
                    }}
                    disabled={busyPid === p.pid}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-60 ${
                      aligned
                        ? "border-line-2 text-ink-2 border"
                        : "bg-accent text-on-accent"
                    }`}
                  >
                    {aligned ? s.x3d.reset : s.x3d.align}
                  </button>
                </li>
              );
            })}
            {processes.length === 0 && !loadingProcesses && (
              <li className="border-line rounded-xl border border-dashed p-6 text-center text-[12.5px] text-ink-3">
                {s.x3d.noProcesses}
              </li>
            )}
          </ul>

          <p className="mt-3 max-w-2xl text-[11.5px] leading-relaxed text-ink-3">
            {s.x3d.persistenceNote}
          </p>
        </>
      )}
    </section>
  );
}
