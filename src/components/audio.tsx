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
import { ToolHeader, ToolStatus } from "./tool-section";
import "./audio.css";
import { DISPLAY_AUDIO_CODEC, TweakIcon } from "./tweak-icon";

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
  iconOnly = false,
  onError,
}: {
  label: string;
  endpoint?: string;
  disabled?: boolean;
  /** A square button with the label as its name and tooltip (device cards). */
  iconOnly?: boolean;
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
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={() =>
        void invoke("open_sound_settings", { endpoint: endpoint ?? null }).catch((e: unknown) =>
          onError(String(e)),
        )
      }
    >
      {iconOnly ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="17" r="2" />
        </svg>
      ) : (
        <>
          {label} <span aria-hidden="true">↗</span>
        </>
      )}
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
    <div className="audio-device border-line flex min-w-0 flex-col gap-2.5 rounded-xl border p-3.5">
      <div className="flex items-start gap-3">
        <span className="bg-surface-2 border-line text-accent grid h-9 w-9 shrink-0 place-items-center rounded-lg border">
          <DeviceGlyph endpoint={endpoint} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-label !text-ink-3">
            {endpoint.flow === "render" ? c.output : c.input}
            {roles.length > 0 && ` · ${roles.join(" · ")}`}
          </p>
          {/* Two lines, then an ellipsis: Bluetooth hands-free names run long
              and the part that tells two headsets apart is often at the end. */}
          <p
            id={nameId}
            className="selectable mt-0.5 line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]"
            title={endpoint.name}
          >
            {endpoint.name}
          </p>
          <p className="type-data mt-0.5 text-[11.5px] text-ink-3">
            {[c.bus[endpoint.bus], endpoint.format && formatLine(c, endpoint.format)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <SoundSettingsButton
          label={c.deviceSettings}
          endpoint={endpoint.id}
          describedBy={nameId}
          iconOnly
          className="audio-icon-action"
          onError={onError}
        />
      </div>
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-12">
          {facts.map((f) => (
            <Badge key={f}>{f}</Badge>
          ))}
        </div>
      )}
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
      body: c.eapoInactiveBody,
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

/** Scrolls a section's heading into view and moves focus there, so a
 *  keyboard or screen-reader user lands where the eye does. */
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  el.focus({ preventScroll: true });
}

const CHECK_GLYPH = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[22px] w-[22px]"
    aria-hidden="true"
  >
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/** One figure of the page's summary, and the way to its section: every
 *  number comes from `audio_status` or the tweak list, nothing is estimated.
 *  `clear` swaps the number for a check when there is nothing to show. */
function Stat({
  label,
  value,
  of,
  tone,
  clear,
  target,
}: {
  label: string;
  value: number;
  of?: number;
  tone?: "ok" | "warn";
  clear?: boolean;
  target: string;
}) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        className="audio-stat"
        // The two lines are separate boxes; spell the name out for readers.
        aria-label={
          clear
            ? label
            : `${label}: ${formatNumber(value)}${of === undefined ? "" : `/${formatNumber(of)}`}`
        }
        onClick={() => jumpTo(target)}
      >
        <span className="audio-stat-label type-label [overflow-wrap:anywhere]">{label}</span>
        <span
          className={`flex h-[22px] items-center text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${
            tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink"
          }`}
        >
          {clear ? (
            CHECK_GLYPH
          ) : (
            <>
              {formatNumber(value)}
              {of !== undefined && (
                <span className="text-ink-3 ml-0.5 self-end text-[13px] font-medium">
                  /{formatNumber(of)}
                </span>
              )}
            </>
          )}
        </span>
      </button>
    </li>
  );
}

/** The fixes this page lists: T1/T2 (`rows`, App's audio rows) plus the
 *  per-device T3/T4 rows AudioExtras draws. */
function fixCounts(rows: TweakInfo[], a: AudioStatus) {
  const device = [...a.idle, ...a.usbPower.filter((p) => p.mayPowerDown || p.applied)];
  return {
    on: rows.filter((t) => t.applied).length + device.filter((d) => d.applied).length,
    total: rows.length + device.length,
  };
}

export function AudioPanel({
  lang,
  status,
  error,
  rows,
  onRetry,
  pushToast,
}: {
  lang: Lang;
  status: AudioStatus | null;
  error: boolean;
  /** The catalogue's audio rows shown on the page (T1, T2). */
  rows: TweakInfo[];
  onRetry: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const c = AUDIO_COPY[lang];
  const onError = (message: string) => pushToast("error", message);
  const header = (
    <ToolHeader icon={CATEGORY_STYLE.audio.icon} title={c.heroTitle} description={c.subtitle} />
  );
  if (!status)
    return (
      <section className="tool-panel audio-hero" aria-busy={!error}>
        {header}
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToolStatus tone="error">{c.readError}</ToolStatus>
            <button type="button" className="tool-secondary-action" onClick={onRetry}>
              {c.retry}
            </button>
          </div>
        ) : (
          <div className="audio-skeleton grid gap-3 min-[900px]:grid-cols-2" aria-hidden="true">
            <div className="bg-surface-2 border-line h-[128px] rounded-xl border" />
            <div className="bg-surface-2 border-line h-[128px] rounded-xl border" />
          </div>
        )}
      </section>
    );

  // The defaults, plus a communications device only when it is another one.
  const shown = status.endpoints.filter((e) => e.default || e.comms);
  const found = findings(c, status, onError);
  const fixes = fixCounts(rows, status);
  return (
    <>
      <section className="tool-panel audio-hero">
        {header}
        <ul className="audio-stats border-line divide-line mb-5 grid grid-cols-3 divide-x rounded-xl border">
          <Stat label={c.statDevices} value={shown.length} target="audio-devices-title" />
          {found.length ? (
            <Stat
              label={c.statFindings}
              value={found.length}
              tone={found.some((r) => r.tone === "warn") ? "warn" : undefined}
              target="audio-findings-title"
            />
          ) : (
            <Stat label={c.statClear} value={0} tone="ok" clear target="audio-findings-title" />
          )}
          <Stat label={c.statFixes} value={fixes.on} of={fixes.total} target="audio-fixes-title" />
        </ul>
        <h3
          id="audio-devices-title"
          tabIndex={-1}
          className="audio-anchor type-label !text-ink-2 mb-2.5"
        >
          {c.devicesTitle}
        </h3>
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
      </section>

      <section className="audio-findings mb-6" aria-labelledby="audio-findings-title">
        <h2
          id="audio-findings-title"
          tabIndex={-1}
          className="audio-anchor type-section mb-2.5 text-ink"
        >
          {c.findingsTitle}
        </h2>
        {found.length ? (
          <ul className="flex flex-col gap-2">
            {found.map((r) => (
              <li
                key={r.key}
                className={`audio-finding bg-surface-1 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border p-3.5 ${
                  r.tone === "warn" ? "border-warn/30" : "border-line"
                }`}
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
                  <h3 className="text-[13px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                    {r.title}
                  </h3>
                  <p className="mt-1 max-w-[60ch] text-[12.5px] leading-relaxed text-ink-3">
                    {r.body}
                  </p>
                </div>
                {r.action}
              </li>
            ))}
          </ul>
        ) : (
          <ToolStatus tone="active">{c.noFindings}</ToolStatus>
        )}
      </section>

      <h2 id="audio-fixes-title" tabIndex={-1} className="audio-anchor type-section text-ink">
        {c.fixesTitle}
      </h2>
      <p className="mb-3 mt-0.5 text-[12px] text-ink-3">{c.fixesLead}</p>
    </>
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
  label,
  device,
  body,
  note,
  warning,
  tweak,
  busy,
  onToggle,
  extra,
}: {
  s: Strings;
  /** Short heading; `label` (with the device's name) names the switch. */
  title: string;
  label: string;
  device: string;
  body: string;
  note?: string;
  warning?: string;
  tweak: TweakInfo;
  busy: boolean;
  onToggle: (t: TweakInfo) => void;
  /** Gets the device line's id, for a button that needs the device's name. */
  extra?: (deviceId: string) => ReactNode;
}) {
  const style = CATEGORY_STYLE.audio;
  const deviceId = useId();
  return (
    <li className="animate-card section-tweak panel panel-hover group relative overflow-hidden p-4">
      <div className="relative flex items-center gap-4">
        <div
          className="icon-module grid shrink-0 place-items-center"
          style={{ "--module-tint": style.tint } as CSSProperties}
        >
          <TweakIcon id={tweak.id} fallback={style.icon} />
        </div>
        <div className="min-w-0 flex-1">
          {/* The badges wrap as one group, never one left alone on a line. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h2 className="min-w-0 text-[15px] font-semibold tracking-[-0.01em] text-ink [overflow-wrap:anywhere]">
              {title}
            </h2>
            <span className="inline-flex shrink-0 items-center gap-2">
              <Badge kind="admin">{s.badges.admin}</Badge>
              <Badge kind="pro">{s.badges.pro}</Badge>
            </span>
          </div>
          <p
            id={deviceId}
            className="type-data mt-1 text-[12px] font-medium text-ink-2 [overflow-wrap:anywhere]"
          >
            {device}
          </p>
          <p className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.55] text-ink-3">{body}</p>
          {warning && (
            <p className="mt-1.5 max-w-[52ch] text-[12px] leading-[1.5] text-warn">{warning}</p>
          )}
          {note && (
            <p className="mt-1.5 max-w-[52ch] text-[12px] leading-[1.5] text-ink-3">{note}</p>
          )}
          {extra?.(deviceId)}
        </div>
        <Toggle
          label={label}
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

const RESTART_GLYPH = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
  </svg>
);

/** Rows that follow T1 and T2 in the list: the per-device fixes, the crackle
 *  check and Equalizer APO. */
export function AudioExtras({
  s,
  lang,
  status,
  isPro,
  busyId,
  onToggle,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  status: AudioStatus | null;
  /** Free: T3's restart button is hidden; it only finishes a Pro change. */
  isPro: boolean;
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
        const label = format(c.idleName, { device: t.name });
        return (
          <DeviceFixRow
            key={t.id}
            s={s}
            title={DISPLAY_AUDIO_CODEC.test(t.id) ? c.idleHdmi : c.idleChip}
            label={label}
            device={t.name}
            body={
              t.applied ? c.idleApplied : format(c.idleBody, { seconds: formatNumber(t.seconds) })
            }
            note={isPro || t.applied ? c.idleRestartNote : undefined}
            tweak={deviceTweak(t.id, label, t.applied)}
            busy={busyId === t.id}
            onToggle={onToggle}
            extra={
              isPro || t.applied
                ? (deviceId) => (
                    <button
                      type="button"
                      className="tool-secondary-action audio-inline-action mt-1.5"
                      aria-describedby={deviceId}
                      disabled={restarting !== null}
                      aria-busy={restarting === t.id}
                      onClick={() => void restart(t.id, t.name)}
                    >
                      {restarting === t.id ? (
                        <span className="tool-status-spinner" aria-hidden="true" />
                      ) : (
                        RESTART_GLYPH
                      )}
                      {restarting === t.id ? c.restarting : c.restartDevice}
                    </button>
                  )
                : undefined
            }
          />
        );
      })}
      {power.map((p) => {
        const label = format(c.powerName, { device: p.name });
        return (
          <DeviceFixRow
            key={p.id}
            s={s}
            title={c.powerShort}
            label={label}
            device={p.name}
            body={p.applied ? c.powerApplied : c.powerBody}
            warning={status.modernStandby ? c.modernStandby : undefined}
            tweak={deviceTweak(p.id, label, p.applied)}
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
        <CrackleCheck c={c} s={s} />
      </li>

      {status.eapo.installed && (
        <li>
          <section className="tool-panel animate-card !mb-0">
            <ToolHeader
              icon={EQ_GLYPH}
              title={c.eapoTitle}
              description={c.eapoAbout}
              actions={
                <Badge kind="ok">
                  {status.eapo.version
                    ? format(c.eapoVersion, { version: status.eapo.version })
                    : c.eapoInstalled}
                </Badge>
              }
            />
            <ul className="type-data flex flex-col gap-1.5 text-[12px] text-ink-2">
              {render && (
                <li className="flex flex-wrap items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      render.eq === "active" ? "bg-ok" : "bg-warn"
                    }`}
                    aria-hidden="true"
                  />
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
                <li className="pl-3.5 text-ink-3">
                  {format(c.eapoStale, { count: formatNumber(status.eapo.stale) })}
                </li>
              )}
            </ul>
            <div className="border-line mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2">
              {status.eapo.selector ? (
                <>
                  <DeviceSelectorButton
                    c={c}
                    className="tool-secondary-action audio-inline-action"
                    onError={onError}
                  />
                  <p className="text-[11.5px] text-ink-3">{c.eapoSelectorNote}</p>
                </>
              ) : (
                <p className="py-2 text-[11.5px] text-ink-3">{c.eapoSelectorMissing}</p>
              )}
            </div>
          </section>
        </li>
      )}
    </>
  );
}

const EQ_GLYPH = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d="M6 4v16M12 4v16M18 4v16" opacity=".35" />
    <path d="M4 15h4M10 8h4M16 12h4" />
  </svg>
);

const WAVE_GLYPH = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d="M2.5 12h3l2-5 3 11 2.5-8 1.8 4H21.5" />
  </svg>
);

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

/** A driver's longest routine against Microsoft's limit. Every bar of one
 *  report shares the scale (`scale` times the limit fills the track), so the
 *  bars compare; the tick marks the limit itself. */
function LimitBar({
  c,
  kind,
  maxUs,
  limitUs,
  scale,
  audible,
}: {
  c: Copy;
  kind: string;
  maxUs: number;
  limitUs: number;
  scale: number;
  audible: boolean;
}) {
  const over = maxUs > limitUs;
  const fill = over ? (audible ? "bg-danger" : "bg-warn") : "bg-ok";
  const value = format(c.micro, { value: formatNumber(Math.round(maxUs)) });
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem] items-center gap-2.5">
      {/* The bar is a picture; this is what it says. */}
      <span className="sr-only">
        {`${kind} ${value}. `}
        {format(c.crackleLimit, { value: format(c.micro, { value: formatNumber(limitUs) }) })}
      </span>
      <span className="type-data text-[10.5px] text-ink-3" aria-hidden="true">
        {kind}
      </span>
      <span className="bg-surface-hover relative h-1.5 rounded-full" aria-hidden="true">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${fill}`}
          style={{ width: `${Math.max(2, Math.min(100, (maxUs / limitUs / scale) * 100))}%` }}
        />
        <span
          className="bg-ink-2 absolute -top-1 h-3.5 w-px"
          style={{ left: `${(1 / scale) * 100}%` }}
        />
      </span>
      <span
        className={`type-data text-right text-[11.5px] tabular-nums ${over ? "text-ink" : "text-ink-3"}`}
        aria-hidden="true"
      >
        {value}
      </span>
    </div>
  );
}

/** The 10-second DPC/ISR trace (diagnostics/dpc.rs), grouped by the hardware
 *  each driver serves. Never claims a driver causes anything. */
function CrackleCheck({ c, s }: { c: Copy; s: Strings }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [report, setReport] = useState<DpcReport | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  // Set on every mount: React's development double mount runs the cleanup once.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

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
      setError(friendlyError(e, s));
      setState("error");
    }
  }

  const over = (d: DriverLatency) =>
    !!report && (d.dpc.maxUs > report.dpc.limitUs || d.isr.maxUs > report.isr.limitUs);
  const ratio = (d: DriverLatency) =>
    report
      ? Math.max(
          d.dpc.count > 0 ? d.dpc.maxUs / report.dpc.limitUs : 0,
          d.isr.count > 0 ? d.isr.maxUs / report.isr.limitUs : 0,
        )
      : 0;
  const flagged = (report?.drivers.filter(over) ?? []).sort((a, b) => ratio(b) - ratio(a));
  const groups = AREA_ORDER.map((area) => ({
    area,
    drivers: flagged.filter((d) => (d.area ?? "other") === area),
  })).filter((g) => g.drivers.length > 0);
  // Room past the worst bar, and the limit tick never sits at the very edge.
  const scale = Math.max(2, ...flagged.map(ratio)) * 1.05;
  const audible = flagged.some((d) => d.audible);
  const running = state === "running";

  return (
    <section
      className="tool-panel audio-crackle animate-card !mb-0"
      aria-busy={running}
      data-idle={state === "idle"}
    >
      <ToolHeader
        icon={WAVE_GLYPH}
        title={c.crackleTitle}
        description={c.crackleBody}
        actions={
          <button
            type="button"
            className="tool-primary-action"
            onClick={() => void measure()}
            disabled={running}
          >
            {running ? c.crackleRunning : c.crackleRun}
          </button>
        }
      />
      <div aria-live="polite">
        {running && <ToolStatus busy>{c.crackleWait}</ToolStatus>}
        {!running && error && <ToolStatus tone="error">{error}</ToolStatus>}
        {!running && report && (
          <>
            <ToolStatus tone={audible ? "error" : flagged.length ? "neutral" : "active"}>
              {flagged.length
                ? format(c.crackleOver, { count: formatNumber(flagged.length) })
                : c.crackleOk}
            </ToolStatus>
            <dl className="border-line divide-line mt-3 grid grid-cols-2 divide-x rounded-xl border">
              {[report.dpc, report.isr].map((t) => (
                <div key={t.kind} className="flex min-w-0 flex-col-reverse gap-1 px-4 py-3">
                  <dt className="text-[11px] leading-snug text-ink-3">
                    <span className="type-label !text-ink-3 block">
                      {format(c.cracklePeak, { kind: t.kind.toUpperCase() })}
                    </span>
                    <span className="block">
                      {format(c.crackleLimit, {
                        value: format(c.micro, { value: formatNumber(t.limitUs) }),
                      })}
                    </span>
                    <span className="block">
                      {format(c.crackleTimesOver, { count: formatNumber(t.overLimit) })}
                    </span>
                  </dt>
                  <dd
                    className={`text-[20px] font-semibold leading-none tabular-nums ${
                      t.maxUs > t.limitUs ? "text-warn" : "text-ok"
                    }`}
                  >
                    {format(c.micro, { value: formatNumber(Math.round(t.maxUs)) })}
                  </dd>
                </div>
              ))}
            </dl>
            {groups.length > 0 && (
              <>
                <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">{c.crackleLegend}</p>
                {groups.map((g) => (
                  <div key={g.area} className="border-line mt-3 border-t pt-3">
                    <h3 className="type-label !text-ink-2">{c.areas[g.area][0]}</h3>
                    <ul className="mt-2 flex flex-col gap-3">
                      {g.drivers.map((d) => (
                        <li key={d.driver ?? "unattributed"}>
                          <p className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="type-data selectable text-[12px] font-semibold text-ink [overflow-wrap:anywhere]">
                              {d.driver ?? c.unattributed}
                            </span>
                            {d.audible && <Badge kind="warn">{c.crackleAudible}</Badge>}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {d.dpc.count > 0 && (
                              <LimitBar
                                c={c}
                                kind="DPC"
                                maxUs={d.dpc.maxUs}
                                limitUs={report.dpc.limitUs}
                                scale={scale}
                                audible={!!d.audible}
                              />
                            )}
                            {d.isr.count > 0 && (
                              <LimitBar
                                c={c}
                                kind="ISR"
                                maxUs={d.isr.maxUs}
                                limitUs={report.isr.limitUs}
                                scale={scale}
                                audible={!!d.audible}
                              />
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
                      {c.areas[g.area][1]}
                    </p>
                  </div>
                ))}
                <p className="border-line mt-3 border-t pt-3 text-[11.5px] leading-relaxed text-ink-3">
                  {c.crackleNote}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
