// The Audio page (1.20, AUDIO-SPEC 8.1): the devices Windows uses, what is
// wrong with them, the per-device fixes (T3/T4), the crackle check and
// Equalizer APO's health. Every value shown is read on this PC by audio.rs;
// T1 and T2 are ordinary catalogue rows that App lists between the panel and
// the extras.
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, type Lang, type Strings } from "../i18n";
import { formatNumber, friendlyError } from "../lib";
import { CATEGORY_STYLE } from "../categories";
import type {
  AudioEndpoint,
  AudioFormat,
  AudioStatus,
  DpcReport,
  DriverArea,
  DriverLatency,
  Toast,
  TweakInfo,
} from "../types";
import { LOW_MIC_LEVEL } from "../scan-items";
import { AUDIO_COPY } from "./audio-copy";
import { Badge, Toggle } from "./ui";
import { TweakIcon } from "./tweak-icon";

type Copy = (typeof AUDIO_COPY)["en"];

/** Reads `audio_status` while the page is open, again whenever `refreshKey`
 *  changes (a toggle refreshes the tweak list, so a fix shows at once). */
export function useAudioStatus(enabled: boolean, refreshKey: unknown) {
  const [status, setStatus] = useState<AudioStatus | null>(null);
  const [error, setError] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    invoke<AudioStatus>("audio_status")
      .then((s) => {
        if (!alive) return;
        setStatus(s);
        setError(false);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [enabled, refreshKey, round]);
  const reload = useCallback(() => setRound((r) => r + 1), []);
  return { status, error, reload };
}

/** "48 kHz · 24-bit · stereo", measured. */
export function formatLine(c: Copy, f: AudioFormat): string {
  const rate = format(c.rate, { rate: formatNumber(f.rate / 1000, f.rate % 1000 ? 1 : 0) });
  const bits = format(f.float ? c.float : c.bits, { bits: f.bits });
  const channels =
    f.channels === 2
      ? c.stereo
      : f.channels === 1
        ? c.mono
        : format(c.channels, { count: f.channels });
  return [rate, bits, channels].join(" · ");
}

export function duckingTitle(c: Copy, value: number | null): string {
  return value === 0 ? c.duckingMute : format(c.duckingPercent, { percent: value === 2 ? 50 : 80 });
}

/** Opens Sound settings, or one device's page (audio.rs `settings_uri`). */
export function SoundSettingsButton({
  label,
  endpoint,
  disabled,
  describedBy,
  className = "tool-secondary-action shrink-0",
  onError,
}: {
  label: string;
  endpoint?: string;
  disabled?: boolean;
  /** The device's name, so several identical buttons stay distinct. */
  describedBy?: string;
  /** The Scan's rows use their own action style. */
  className?: string;
  onError: (message: string) => void;
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-describedby={describedBy}
      onClick={() =>
        void invoke("open_sound_settings", { endpoint: endpoint ?? null }).catch((e: unknown) =>
          onError(String(e)),
        )
      }
    >
      {label} <span aria-hidden="true">↗</span>
    </button>
  );
}

/** Launches the user's own Equalizer APO Device Selector, on this click only. */
export function DeviceSelectorButton({
  c,
  disabled,
  className = "tool-secondary-action shrink-0",
  onError,
}: {
  c: Copy;
  disabled?: boolean;
  className?: string;
  onError: (message: string) => void;
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() =>
        void invoke("open_eapo_device_selector").catch((e: unknown) => onError(String(e)))
      }
    >
      {c.openSelector} <span aria-hidden="true">↗</span>
    </button>
  );
}

const DEVICE_GLYPH: Record<"speaker" | "headphones" | "mic" | "display", ReactNode> = {
  speaker: (
    <path d="M4.5 9.3h3l4.3-3.6v12.6l-4.3-3.6h-3a1 1 0 0 1-1-1V10.3a1 1 0 0 1 1-1ZM15.2 9.2a4 4 0 0 1 0 5.6M17.8 6.6a7.6 7.6 0 0 1 0 10.8" />
  ),
  headphones: (
    <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h2.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5ZM20 14h-2.5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-5Z" />
  ),
  mic: (
    <path d="M12 3.5a2.8 2.8 0 0 1 2.8 2.8v5.4a2.8 2.8 0 0 1-5.6 0V6.3A2.8 2.8 0 0 1 12 3.5ZM6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5M9 20.5h6" />
  ),
  display: <path d="M3.5 5.5h17v11h-17zM9 20h6M12 16.5V20" />,
};

function DeviceGlyph({ endpoint }: { endpoint: AudioEndpoint }) {
  const kind =
    endpoint.flow === "capture"
      ? "mic"
      : endpoint.kind === "headphones" || endpoint.kind === "headset"
        ? "headphones"
        : endpoint.kind === "hdmi" || endpoint.kind === "spdif"
          ? "display"
          : "speaker";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {DEVICE_GLYPH[kind]}
    </svg>
  );
}

function DeviceCard({
  c,
  endpoint,
  onError,
}: {
  c: Copy;
  endpoint: AudioEndpoint;
  onError: (message: string) => void;
}) {
  const facts = [
    endpoint.effectsOff === null ? null : endpoint.effectsOff ? c.effectsOff : c.effectsOn,
    endpoint.flow === "render" && endpoint.spatial !== null
      ? endpoint.spatial
        ? c.spatialOn
        : c.spatialOff
      : null,
    endpoint.eq === "active" ? c.eqActive : endpoint.eq === "bypassed" ? c.eqBypassed : null,
  ].filter((f): f is string => f !== null);
  const nameId = useId();
  const roles = [endpoint.default && c.defaultLabel, endpoint.comms && c.commsLabel].filter(
    (r): r is string => !!r,
  );
  return (
    <div className="audio-device border-line bg-surface-2 flex min-w-0 flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <span className="bg-surface-1 border-line text-accent grid h-9 w-9 shrink-0 place-items-center rounded-lg border">
          <DeviceGlyph endpoint={endpoint} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-label !text-ink-3">
            {endpoint.flow === "render" ? c.output : c.input}
            {roles.length > 0 && ` · ${roles.join(" · ")}`}
          </p>
          <p
            id={nameId}
            className="selectable truncate text-[13.5px] font-semibold text-ink"
            title={endpoint.name}
          >
            {endpoint.name}
          </p>
          <p className="type-data text-[11.5px] text-ink-3">
            {[c.bus[endpoint.bus], endpoint.format && formatLine(c, endpoint.format)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <Badge key={f} kind="muted">
              {f}
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-auto">
        <SoundSettingsButton
          label={c.deviceSettings}
          endpoint={endpoint.id}
          describedBy={nameId}
          onError={onError}
        />
      </div>
    </div>
  );
}

/** The findings the page shows (A3, A7, A8, A9); the fixable ones (A4-A6)
 *  are the fix rows below it. */
function findings(c: Copy, a: AudioStatus, onError: (m: string) => void) {
  const rows: {
    key: string;
    tone: "warn" | "info";
    title: string;
    body: string;
    action?: ReactNode;
  }[] = [];
  const render = a.endpoints.find((e) => e.flow === "render" && e.default) ?? null;
  const capture = a.endpoints.find((e) => e.flow === "capture" && e.default) ?? null;
  for (const [i, call] of a.callMode.entries())
    rows.push({
      key: `call:${i}`,
      tone: "warn",
      title: format(c.callModeTitle, { device: call.device }),
      body: format(c.callModeBody, { process: call.process }),
      action: <SoundSettingsButton label={c.soundSettings} onError={onError} />,
    });
  if (a.eapo.installed && render?.eq === "none")
    rows.push({
      key: "eapo",
      tone: "warn",
      title: format(c.eapoInactiveTitle, { name: render.name }),
      body: [
        c.eapoInactiveBody,
        a.eapo.stale > 0 ? format(c.eapoStale, { count: formatNumber(a.eapo.stale) }) : "",
      ]
        .filter(Boolean)
        .join(" "),
      action: a.eapo.selector ? <DeviceSelectorButton c={c} onError={onError} /> : undefined,
    });
  for (const e of [render, capture])
    if (e?.effectsOff)
      rows.push({
        key: `effects:${e.id}`,
        tone: "info",
        title: format(e.eq === "none" ? c.effectsOffTitle : c.eapoBypassedTitle, { name: e.name }),
        body: e.eq === "none" ? c.effectsOffBody : c.eapoBypassedBody,
        action: <SoundSettingsButton label={c.deviceSettings} endpoint={e.id} onError={onError} />,
      });
  if (a.mic && (a.mic.muted || a.mic.level < LOW_MIC_LEVEL))
    rows.push({
      key: "mic",
      tone: "info",
      title: a.mic.muted ? c.micMuted : format(c.micLow, { level: formatNumber(a.mic.level) }),
      body: format(c.micBody, { name: a.mic.name }),
      action: (
        <SoundSettingsButton label={c.deviceSettings} endpoint={capture?.id} onError={onError} />
      ),
    });
  return rows;
}

export function AudioPanel({
  lang,
  status,
  error,
  onRetry,
  pushToast,
}: {
  lang: Lang;
  status: AudioStatus | null;
  error: boolean;
  onRetry: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const c = AUDIO_COPY[lang];
  const onError = (message: string) => pushToast("error", message);
  if (!status)
    return (
      <section className="audio-panel mb-4" aria-busy={!error}>
        <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-3">{c.subtitle}</p>
        {error ? (
          <div className="border-line flex items-center justify-between gap-3 rounded-xl border border-dashed p-4">
            <p className="text-[12.5px] text-ink-3" role="alert">
              {c.readError}
            </p>
            <button type="button" className="tool-secondary-action" onClick={onRetry}>
              {c.retry}
            </button>
          </div>
        ) : (
          <div className="audio-skeleton grid gap-3 min-[900px]:grid-cols-2" aria-hidden="true">
            <div className="bg-surface-2 border-line h-[132px] rounded-xl border" />
            <div className="bg-surface-2 border-line h-[132px] rounded-xl border" />
          </div>
        )}
      </section>
    );

  // The defaults, plus a communications device only when it is another one.
  const shown = status.endpoints.filter((e) => e.default || e.comms);
  const rows = findings(c, status, onError);
  return (
    <section className="audio-panel mb-4">
      <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-ink-3">{c.subtitle}</p>

      <h2 className="type-section mb-2.5 text-ink">{c.devicesTitle}</h2>
      {shown.length ? (
        <div className="grid gap-3 min-[900px]:grid-cols-2">
          {shown.map((e) => (
            <DeviceCard key={e.id} c={c} endpoint={e} onError={onError} />
          ))}
        </div>
      ) : (
        <p className="border-line rounded-xl border border-dashed p-4 text-[12.5px] text-ink-3">
          {c.noDevices}
        </p>
      )}

      <h2 className="type-section mb-2.5 mt-6 text-ink">{c.findingsTitle}</h2>
      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.key}
              className="audio-finding border-line bg-surface-1 flex flex-wrap items-start gap-3 rounded-xl border p-3"
              data-tone={r.tone}
            >
              <span
                className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  r.tone === "warn" ? "bg-warn/15 text-warn" : "bg-surface-2 text-ink-3"
                }`}
                aria-hidden="true"
              >
                {r.tone === "warn" ? "!" : "i"}
              </span>
              <div className="min-w-[12rem] flex-1">
                <h3 className="text-[13px] font-semibold text-ink">{r.title}</h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">{r.body}</p>
              </div>
              {r.action}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-line rounded-xl border border-dashed p-4 text-[12.5px] text-ink-3">
          {c.noFindings}
        </p>
      )}

      <h2 className="type-section mt-6 text-ink">{c.fixesTitle}</h2>
      <p className="mt-0.5 text-[12px] text-ink-3">{c.fixesLead}</p>
    </section>
  );
}

/** The tweak row a T3/T4 device switch goes through (App's `toggle`). */
function deviceTweak(id: string, name: string, applied: boolean): TweakInfo {
  return {
    id,
    name,
    description: "",
    category: "audio",
    hive: "—",
    requires_admin: true,
    requires_pro: true,
    applied,
    changes: [],
  };
}

function DeviceFixRow({
  s,
  title,
  body,
  note,
  warning,
  tweak,
  busy,
  onToggle,
  extra,
}: {
  s: Strings;
  title: string;
  body: string;
  note?: string;
  warning?: string;
  tweak: TweakInfo;
  busy: boolean;
  onToggle: (t: TweakInfo) => void;
  /** Gets the title's id, for a button that needs the device's name. */
  extra?: (titleId: string) => ReactNode;
}) {
  const style = CATEGORY_STYLE.audio;
  const titleId = useId();
  return (
    <li className="animate-card section-tweak panel panel-hover group relative overflow-hidden p-4">
      <div className="relative flex items-center gap-4">
        <div
          className="icon-module grid shrink-0 place-items-center"
          style={{ "--module-tint": style.tint } as CSSProperties}
        >
          <TweakIcon id="audio" fallback={style.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={titleId}
              className="min-w-0 text-[15px] font-semibold tracking-[-0.01em] text-ink [overflow-wrap:anywhere]"
            >
              {title}
            </h2>
            <Badge kind="admin">{s.badges.admin}</Badge>
            <Badge kind="pro">{s.badges.pro}</Badge>
          </div>
          <p className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.55] text-ink-3">{body}</p>
          {warning && (
            <p className="mt-1.5 max-w-[52ch] text-[12px] leading-[1.5] text-warn">{warning}</p>
          )}
          {note && (
            <p className="mt-1.5 max-w-[52ch] text-[12px] leading-[1.5] text-ink-3">{note}</p>
          )}
          {extra?.(titleId)}
        </div>
        <Toggle
          label={title}
          busyLabel={tweak.applied ? s.restore.running : s.profiles.applying}
          checked={tweak.applied}
          busy={busy}
          onClick={() => onToggle(tweak)}
          s={s}
        />
      </div>
    </li>
  );
}

/** Rows that follow T1 and T2 in the list: the per-device fixes, the crackle
 *  check and Equalizer APO. */
export function AudioExtras({
  s,
  lang,
  status,
  busyId,
  onToggle,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  status: AudioStatus | null;
  busyId: string | null;
  onToggle: (t: TweakInfo) => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const c = AUDIO_COPY[lang];
  const [restarting, setRestarting] = useState<string | null>(null);
  if (!status) return null;
  const onError = (message: string) => pushToast("error", message);
  const power = status.usbPower.filter((p) => p.mayPowerDown || p.applied);

  async function restart(id: string, name: string) {
    setRestarting(id);
    try {
      await invoke("restart_audio_device", { id });
      pushToast("success", format(c.restarted, { device: name }));
    } catch (e) {
      pushToast("error", friendlyError(e, s));
    } finally {
      setRestarting(null);
    }
  }

  const render = status.endpoints.find((e) => e.flow === "render" && e.default) ?? null;
  return (
    <>
      {status.idle.map((t) => {
        const title = format(c.idleName, { device: t.name });
        return (
          <DeviceFixRow
            key={t.id}
            s={s}
            title={title}
            body={
              t.applied ? c.idleApplied : format(c.idleBody, { seconds: formatNumber(t.seconds) })
            }
            note={c.idleRestartNote}
            tweak={deviceTweak(t.id, title, t.applied)}
            busy={busyId === t.id}
            onToggle={onToggle}
            extra={(titleId) => (
              <button
                type="button"
                className="tool-secondary-action mt-2.5"
                aria-describedby={titleId}
                disabled={restarting !== null}
                aria-busy={restarting === t.id}
                onClick={() => void restart(t.id, t.name)}
              >
                {restarting === t.id ? c.restarting : c.restartDevice}
              </button>
            )}
          />
        );
      })}
      {power.map((p) => {
        const title = format(c.powerName, { device: p.name });
        return (
          <DeviceFixRow
            key={p.id}
            s={s}
            title={title}
            body={p.applied ? c.powerApplied : c.powerBody}
            warning={status.modernStandby ? c.modernStandby : undefined}
            tweak={deviceTweak(p.id, title, p.applied)}
            busy={busyId === p.id}
            onToggle={onToggle}
          />
        );
      })}
      {status.idle.length === 0 && power.length === 0 && (
        <li className="border-line rounded-2xl border border-dashed p-4 text-[12.5px] text-ink-3">
          {c.noDeviceFixes}
        </li>
      )}

      <li>
        <CrackleCheck c={c} />
      </li>

      {status.eapo.installed && (
        <li>
          <section className="tool-panel tool-card animate-card border-line bg-surface-1 rounded-2xl border p-5 !mb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="type-section text-ink">{c.eapoTitle}</h2>
                <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-3">
                  {c.eapoAbout}
                </p>
              </div>
              <Badge kind="ok">
                {status.eapo.version
                  ? format(c.eapoVersion, { version: status.eapo.version })
                  : c.eapoInstalled}
              </Badge>
            </div>
            <ul className="type-data border-line mt-3 flex flex-col gap-1 border-t pt-3 text-[12px] text-ink-2">
              {render && (
                <li>
                  {format(c.eapoOnDevice, {
                    name: render.name,
                    state:
                      render.eq === "active"
                        ? c.eapoStateActive
                        : render.eq === "bypassed"
                          ? c.eapoStateBypassed
                          : c.eapoStateNone,
                  })}
                </li>
              )}
              {status.eapo.stale > 0 && (
                <li>{format(c.eapoStale, { count: formatNumber(status.eapo.stale) })}</li>
              )}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {status.eapo.selector ? (
                <>
                  <DeviceSelectorButton c={c} onError={onError} />
                  <p className="text-[11.5px] text-ink-3">{c.eapoSelectorNote}</p>
                </>
              ) : (
                <p className="text-[11.5px] text-ink-3">{c.eapoSelectorMissing}</p>
              )}
            </div>
          </section>
        </li>
      )}
    </>
  );
}

const AREA_ORDER: DriverArea[] = [
  "audio",
  "usb",
  "bluetooth",
  "graphics",
  "network",
  "storage",
  "platform",
  "ambiguous",
  "other",
];

/** The 10-second DPC/ISR trace (diagnostics/dpc.rs), grouped by the hardware
 *  each driver serves. Never claims a driver causes anything. */
function CrackleCheck({ c }: { c: Copy }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [report, setReport] = useState<DpcReport | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  async function measure() {
    setState("running");
    setError("");
    try {
      const r = await invoke<DpcReport>("trace_dpc_latency", { seconds: 10 });
      if (!alive.current) return;
      setReport(r);
      setState("done");
    } catch (e) {
      if (!alive.current) return;
      setError(String(e));
      setState("error");
    }
  }

  const over = (d: DriverLatency) =>
    !!report && (d.dpc.maxUs > report.dpc.limitUs || d.isr.maxUs > report.isr.limitUs);
  const flagged = report?.drivers.filter(over) ?? [];
  const groups = AREA_ORDER.map((area) => ({
    area,
    drivers: flagged.filter((d) => (d.area ?? "other") === area),
  })).filter((g) => g.drivers.length > 0);

  return (
    <section
      className="tool-panel tool-card animate-card border-line bg-surface-1 rounded-2xl border p-5 !mb-0"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="type-section text-ink">{c.crackleTitle}</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-3">{c.crackleBody}</p>
        </div>
        <button
          type="button"
          className="tool-primary-action shrink-0"
          onClick={() => void measure()}
          disabled={state === "running"}
          aria-busy={state === "running"}
        >
          {state === "running" ? c.crackleRunning : c.crackleRun}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-[12px] text-warn" role="alert">
          {error}
        </p>
      )}
      {report && (
        <div className="border-line mt-4 border-t pt-3">
          <p className="text-[13px] font-semibold text-ink">
            {flagged.length
              ? format(c.crackleOver, { count: formatNumber(flagged.length) })
              : c.crackleOk}
          </p>
          {groups.map((g) => (
            <div key={g.area} className="mt-3">
              <p className="type-label !text-ink-2">{c.areas[g.area][0]}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {g.drivers.map((d) => (
                  <li
                    key={d.driver ?? "unattributed"}
                    className="type-data selectable flex flex-wrap items-center gap-2 text-[12px] text-ink-2"
                  >
                    {format(c.crackleDriver, {
                      driver: d.driver ?? c.unattributed,
                      dpc: formatNumber(Math.round(d.dpc.maxUs)),
                      isr: formatNumber(Math.round(d.isr.maxUs)),
                    })}
                    {d.audible && <Badge kind="warn">{c.crackleAudible}</Badge>}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{c.areas[g.area][1]}</p>
            </div>
          ))}
          {flagged.length > 0 && (
            <p className="mt-3 max-w-2xl text-[11.5px] leading-relaxed text-ink-3">
              {c.crackleNote}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
