// Scan 2.0 result screen: health score, measured headline and counts, Fix all
// and Custom, and the eight categories with their items. State and native
// calls stay in ScanPanel; this renders and reports clicks.
import { useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { format, type Lang, type Strings } from "../i18n";
import { formatBytes, formatNumber, textFor } from "../lib";
import type { DpcReport, Section } from "../types";
import {
  SCAN_CATEGORIES,
  categoryIssues,
  locked,
  lockedTotals,
  scanTotals,
  type ScanCategory,
  type ScanItem,
} from "../scan-items";
import type { ScanReport } from "../scan-runner";
import { factorLabel } from "./health-copy";
import { AUDIO_COPY } from "./audio-copy";
import { DeviceSelectorButton, SoundSettingsButton, duckingTitle, formatLine } from "./audio";
import { SCAN_COPY } from "./scan-copy";
import { SCAN2_COPY, type Scan2Copy } from "./scan2-copy";
import { TRIAL_COPY } from "./trial-copy";
import { TechnicalDetails } from "./technical";
import { CheckIcon } from "./icons";
import { Badge } from "./ui";

const mb = (value: number) => formatBytes(value * 1024 * 1024);
const pct = (share: number) => `${formatNumber(Math.round(share * 100))}%`;

function tone(score: number) {
  return score >= 85 ? "ok" : score >= 65 ? "warn" : score >= 45 ? "caution" : "danger";
}

export function LockIcon({ className = "scan2-lock" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <rect
        x="3.25"
        y="7"
        width="9.5"
        height="6.75"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

const ICON: Record<ScanCategory, ReactNode> = {
  performance: <path d="M3.5 11.5a6.5 6.5 0 1 1 13 0M10 11.5l3-4.2" />,
  junk: (
    <path d="M4.5 6h11l-1 10.2a1.5 1.5 0 0 1-1.5 1.3H7a1.5 1.5 0 0 1-1.5-1.3L4.5 6ZM3 6h14M8 6V4.3c0-.7.6-1.3 1.3-1.3h1.4c.7 0 1.3.6 1.3 1.3V6" />
  ),
  startup: <path d="M10 3v6.5M6 5.6a6 6 0 1 0 8 0" />,
  privacy: <path d="M10 2.8 4.5 5v4.4c0 3.6 2.4 6.6 5.5 7.8 3.1-1.2 5.5-4.2 5.5-7.8V5L10 2.8Z" />,
  registry: <path d="M4 4.5h12M4 8.5h12M4 12.5h7M4 16.5h5M14.5 12.5l2.5 2.5-2.5 2.5" />,
  memory: (
    <path d="M4 6.5h12v7H4zM7 6.5v7M10 6.5v7M13 6.5v7M6 13.5V16M14 13.5V16M6 4v2.5M14 4v2.5" />
  ),
  hardware: (
    <path d="M6 6h8v8H6zM8.5 3v3M11.5 3v3M8.5 14v3M11.5 14v3M3 8.5h3M3 11.5h3M14 8.5h3M14 11.5h3" />
  ),
  latency: <path d="M2.5 10h3l2-4.5 3 9 2-4.5h5" />,
  audio: (
    <path d="M3.5 8h2.6L10 5v10l-3.9-3H3.5a.8.8 0 0 1-.8-.8V8.8a.8.8 0 0 1 .8-.8ZM13 7.6a3.4 3.4 0 0 1 0 4.8M15.3 5.4a6.5 6.5 0 0 1 0 9.2" />
  ),
};

function CategoryIcon({ category }: { category: ScanCategory }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON[category]}
    </svg>
  );
}

/** Score, headline, measured counts and the two buttons. */
export function ScanSummary({
  lang,
  report,
  items,
  isPro,
  custom,
  fixCount,
  busy,
  trialDays,
  onFix,
  onCustom,
  onUnlock,
}: {
  lang: Lang;
  report: ScanReport;
  items: ScanItem[];
  isPro: boolean;
  custom: boolean;
  /** Fix all's count, or the ticked count in Custom. */
  fixCount: number;
  busy: boolean;
  trialDays: number | null;
  onFix: () => void;
  onCustom: (on: boolean) => void;
  onUnlock: () => void;
}) {
  const c = SCAN2_COPY[lang];
  const totals = scanTotals(items);
  const score = report.health?.report.overall ?? null;
  const lists = report.memory?.lists ?? null;
  const headline =
    totals.junkBytes >= 100 * 1024 * 1024
      ? format(c.headlineWaste, { size: formatBytes(totals.junkBytes) })
      : totals.issues > 0
        ? format(c.headlineIssues, { count: formatNumber(totals.issues) })
        : c.headlineClean;
  const gains = lockedTotals(items, isPro);
  const proGains = [
    {
      key: "bytes",
      value: gains.junkBytes > 0 && formatBytes(gains.junkBytes),
      label: c.proStatBytes,
    },
    {
      key: "registry",
      value: gains.registry > 0 && formatNumber(gains.registry),
      label: c.proStatRegistry,
    },
    { key: "standby", value: gains.standbyMb > 0 && mb(gains.standbyMb), label: c.proStatStandby },
    {
      key: "settings",
      value:
        gains.settings + gains.privacy + gains.audio > 0 &&
        formatNumber(gains.settings + gains.privacy + gains.audio),
      label: c.proStatSettings,
    },
  ].filter((g) => g.value);
  const customizable = items.some((i) => i.fixable && !locked(i, isPro));
  const tiles = [
    {
      key: "junk",
      value: report.junk ? formatBytes(totals.junkBytes) : "—",
      label: report.junk
        ? format(c.tileJunk, { count: formatNumber(totals.junkFiles) })
        : c.tileUnknown,
      warn: totals.junkBytes >= 100 * 1024 * 1024,
    },
    {
      key: "settings",
      value: report.advice ? formatNumber(totals.settings) : "—",
      label: report.advice ? c.tileSettings : c.tileUnknown,
      warn: totals.settings > 0,
    },
    {
      key: "registry",
      value: report.registry ? formatNumber(totals.registry) : "—",
      label: report.registry ? c.tileRegistry : c.tileUnknown,
      warn: totals.registry > 0,
    },
    {
      key: "memory",
      value: lists ? mb(lists.standby_mb) : "—",
      label: lists ? format(c.tileStandby, { free: mb(lists.free_mb) }) : c.tileUnknown,
      warn: !!lists && lists.free_mb < (report.memory?.threshold_mb ?? 1024),
    },
  ];
  return (
    <section className="scan2-summary" aria-labelledby="scan2-headline">
      <div className="scan2-heading">
        {score !== null && (
          <div className="scan2-score" data-tone={tone(score)}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="27" className="scan2-score-track" />
              <circle
                cx="32"
                cy="32"
                r="27"
                className="scan2-score-value"
                pathLength="100"
                strokeDasharray={`${score} 100`}
              />
            </svg>
            <strong aria-label={`${c.scoreLabel}: ${score} / 100`}>{score}</strong>
          </div>
        )}
        <div className="scan2-heading-copy">
          {score !== null && <p className="scan-eyebrow">{c.scoreLabel}</p>}
          <h2 id="scan2-headline">{headline}</h2>
          <p>{c.measuredNote}</p>
        </div>
      </div>
      <ul className="scan2-tiles">
        {tiles.map((t) => (
          <li key={t.key} data-warn={t.warn}>
            <strong className="selectable">{t.value}</strong>
            <span>{t.label}</span>
          </li>
        ))}
      </ul>
      <div className="scan2-actions">
        {fixCount > 0 || custom ? (
          <button
            type="button"
            className="scan-primary scan2-fix"
            onClick={onFix}
            disabled={busy || !fixCount}
          >
            {`${custom ? c.fixSelected : c.fixAll} (${formatNumber(fixCount)})`}
          </button>
        ) : (
          <p className="scan2-all-done">
            <CheckIcon className="h-4 w-4" />
            {c.nothingToFix}
          </p>
        )}
        {customizable && (
          <button
            type="button"
            className="scan-secondary"
            aria-pressed={custom}
            onClick={() => onCustom(!custom)}
            disabled={busy}
          >
            {custom ? c.customDone : c.custom}
          </button>
        )}
        {custom && <p className="scan2-hint">{c.customHint}</p>}
      </div>
      {!isPro && proGains.length > 0 && (
        <div className="scan2-pro">
          <LockIcon />
          <div className="scan2-pro-copy">
            <h3>{c.proTitle}</h3>
            <p>{c.proLead}</p>
            <ul className="scan2-pro-stats">
              {proGains.map((g) => (
                <li key={g.key}>
                  <strong>{g.value}</strong>
                  <span>{g.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="scan-primary" onClick={onUnlock} disabled={busy}>
            {trialDays ? format(TRIAL_COPY[lang].start, { days: trialDays }) : c.unlock}
          </button>
        </div>
      )}
    </section>
  );
}

/** The eight categories, each a disclosure of its items. */
export function ScanCategoryList({
  s,
  lang,
  report,
  items,
  isPro,
  custom,
  selected,
  busy,
  onToggle,
  onNavigate,
  onUnlock,
  onTurnOn,
  onError,
}: {
  s: Strings;
  lang: Lang;
  report: ScanReport;
  items: ScanItem[];
  isPro: boolean;
  custom: boolean;
  selected: Set<string>;
  busy: boolean;
  onToggle: (key: string, on: boolean) => void;
  onNavigate: (section: Section) => void;
  onUnlock: () => void;
  onTurnOn: (id: string) => void;
  /** A Windows settings page that would not open. */
  onError: (message: string) => void;
}) {
  const c = SCAN2_COPY[lang];
  const checked: Partial<Record<ScanCategory, boolean>> = {
    performance: !!report.advice,
    junk: !!report.junk || !!report.caches,
    startup: !!report.startup || !!report.tasks,
    privacy: !!report.advice,
    registry: !!report.registry,
    memory: !!report.memory,
    hardware: !!report.hardware || !!report.drivers,
    latency: true,
    audio: !!report.audio,
  };
  return (
    <div className="scan2-categories">
      {SCAN_CATEGORIES.map((category) => {
        const rows = items.filter((i) => i.category === category);
        const issues = categoryIssues(items, category);
        const state = !checked[category] ? "unknown" : issues ? "issue" : "ok";
        return (
          <details
            key={category}
            className="scan2-category"
            data-state={state}
            open={custom && issues > 0 ? true : undefined}
          >
            <summary>
              <span className="scan2-category-icon">
                <CategoryIcon category={category} />
              </span>
              <span className="scan2-category-name">{c.categories[category]}</span>
              <span className="scan2-category-status">
                {state === "unknown"
                  ? c.categoryUnavailable
                  : issues
                    ? format(c.categoryIssues, { count: formatNumber(issues) })
                    : c.categoryClean}
              </span>
              <svg className="scan2-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </summary>
            {rows.length ? (
              <ul className="scan2-items">
                {rows.map((item) => (
                  <ItemRow
                    key={item.key}
                    s={s}
                    lang={lang}
                    c={c}
                    item={item}
                    isPro={isPro}
                    custom={custom}
                    checked={selected.has(item.key)}
                    busy={busy}
                    onToggle={onToggle}
                    onNavigate={onNavigate}
                    onUnlock={onUnlock}
                    onTurnOn={onTurnOn}
                    onError={onError}
                  />
                ))}
              </ul>
            ) : (
              <p className="scan2-empty">
                {checked[category] ? c.categoryEmpty : SCAN_COPY[lang].unavailable}
              </p>
            )}
          </details>
        );
      })}
    </div>
  );
}

function Steps({ title, steps, note }: { title: string; steps: string[]; note?: string }) {
  return (
    <details className="scan2-more">
      <summary>{title}</summary>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {note && <p>{note}</p>}
    </details>
  );
}

type RowText = {
  title: string;
  body: string;
  evidence?: string;
  gain?: string;
  /** What Pro would do, for the lock line. */
  lockedGain?: string;
  more?: ReactNode;
  badges?: ReactNode;
  /** Shown instead of a checkbox or mark: an "On" state. */
  stateLabel?: string;
  action?: ReactNode;
};

function ItemRow({
  s,
  lang,
  c,
  item,
  isPro,
  custom,
  checked,
  busy,
  onToggle,
  onNavigate,
  onUnlock,
  onTurnOn,
  onError,
}: {
  s: Strings;
  lang: Lang;
  c: Scan2Copy;
  item: ScanItem;
  isPro: boolean;
  custom: boolean;
  checked: boolean;
  busy: boolean;
  onToggle: (key: string, on: boolean) => void;
  onNavigate: (section: Section) => void;
  onUnlock: () => void;
  onTurnOn: (id: string) => void;
  onError: (message: string) => void;
}) {
  // Only something the Scan could apply is locked; an optional or review row
  // stays a review row whatever the plan.
  const isLocked = locked(item, isPro) && item.fixable;
  const text = describe(s, lang, c, item, onNavigate, onTurnOn, busy, isLocked, onError);
  const id = `scan2-${item.key.replace(/[^a-z0-9]/gi, "-")}`;
  const mark = isLocked ? "locked" : item.issue ? "issue" : text.stateLabel ? "ok" : "note";
  return (
    <li className="scan2-item" data-mark={mark}>
      {custom && item.fixable && !isLocked ? (
        <input
          type="checkbox"
          id={id}
          checked={checked}
          disabled={busy}
          onChange={(e) => onToggle(item.key, e.target.checked)}
        />
      ) : (
        <span className="scan2-mark" aria-hidden="true">
          {mark === "locked" ? (
            <LockIcon />
          ) : mark === "ok" ? (
            <CheckIcon className="h-3 w-3" />
          ) : mark === "issue" ? (
            "!"
          ) : (
            "i"
          )}
        </span>
      )}
      <div className="scan2-item-copy">
        <div className="scan2-item-title">
          {custom && item.fixable && !isLocked ? (
            <label htmlFor={id}>{text.title}</label>
          ) : (
            <h4>{text.title}</h4>
          )}
          {text.badges}
          {item.admin && !isLocked && <Badge kind="admin">{s.badges.admin}</Badge>}
          {item.pro && <Badge kind="pro">{s.badges.pro}</Badge>}
          {text.stateLabel && <Badge kind="ok">{text.stateLabel}</Badge>}
        </div>
        <p>{text.body}</p>
        {text.evidence && <p className="scan2-evidence selectable">{text.evidence}</p>}
        {text.gain && !isLocked && <p className="scan2-gain">{text.gain}</p>}
        {isLocked && (
          <p className="scan2-locked-line">
            <LockIcon />
            {format(c.lockedLine, { gain: text.lockedGain ?? text.gain ?? c.lockedSetting })}
          </p>
        )}
        {text.more}
      </div>
      {isLocked ? (
        <button
          type="button"
          className="scan-secondary scan2-row-action"
          onClick={onUnlock}
          disabled={busy}
        >
          {c.unlock}
        </button>
      ) : (
        text.action
      )}
    </li>
  );
}

function reviewButton(
  label: string,
  section: Section,
  onNavigate: (s: Section) => void,
  busy: boolean,
) {
  return (
    <button
      type="button"
      className="scan-secondary scan2-row-action"
      onClick={() => onNavigate(section)}
      disabled={busy}
    >
      {label} <span aria-hidden="true">↗</span>
    </button>
  );
}

function describe(
  s: Strings,
  lang: Lang,
  c: Scan2Copy,
  item: ScanItem,
  onNavigate: (section: Section) => void,
  onTurnOn: (id: string) => void,
  busy: boolean,
  isLocked: boolean,
  onError: (message: string) => void,
): RowText {
  const scan = SCAN_COPY[lang];
  switch (item.type) {
    case "tweak": {
      const t = textFor(s.tweaks, item.tweak.id, item.tweak.name, item.tweak.description);
      return {
        title: t.name,
        body: t.description,
        evidence: item.reason ? (s.scan.reasons as Record<string, string>)[item.reason] : undefined,
        badges: item.optional ? <Badge>{c.optional}</Badge> : undefined,
        more:
          item.tweak.changes.length > 0 ? (
            <details className="scan2-more">
              <summary>{s.transparency.title}</summary>
              <TechnicalDetails changes={item.tweak.changes} s={s} />
            </details>
          ) : undefined,
        action: item.optional
          ? reviewButton(c.review, item.tweak.category, onNavigate, busy)
          : undefined,
      };
    }
    case "junk": {
      const [title, body] = c.junk[item.target.id] ?? [item.target.id, ""];
      return {
        title,
        body,
        gain: format(c.junkGain, {
          size: formatBytes(item.target.bytes),
          count: formatNumber(item.target.files),
        }),
        lockedGain: format(c.lockedFrees, { size: formatBytes(item.target.bytes) }),
      };
    }
    case "caches": {
      const names = item.groups
        .slice()
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 4)
        .map((g) => s.appCache.names[g.id] ?? g.name)
        .join(", ");
      return {
        title: c.cachesTitle,
        body: c.cachesBody,
        gain: format(c.cachesGain, { size: formatBytes(item.bytes), names }),
        lockedGain: format(c.lockedFrees, { size: formatBytes(item.bytes) }),
      };
    }
    case "registry": {
      const [title, body] = c.registry[item.cls];
      return {
        title,
        body,
        gain: format(c.registryGain, { count: formatNumber(item.entries.length) }),
        lockedGain: format(c.lockedRemoves, { count: formatNumber(item.entries.length) }),
        more: (
          <details className="scan2-more">
            <summary>{c.showEntries}</summary>
            <ul className="scan2-entries selectable">
              {item.entries.slice(0, 200).map((e) => (
                <li key={e.id}>
                  <strong>{e.label}</strong>
                  {e.missing && <span>{e.missing}</span>}
                </li>
              ))}
            </ul>
            <p>{c.registryNote}</p>
          </details>
        ),
      };
    }
    case "purge":
      return {
        title: c.purgeTitle,
        body: format(item.recommended ? c.purgeBody : c.purgeBodyOk, {
          free: mb(item.freeMb),
          standby: mb(item.standbyMb),
        }),
        gain: format(c.purgeGain, { size: mb(item.standbyMb) }),
        lockedGain: format(c.lockedRelease, { size: mb(item.standbyMb) }),
      };
    case "booster":
      return {
        title: c.boosterTitle,
        body: format(c.boosterBody, { threshold: mb(item.thresholdMb) }),
        stateLabel: item.enabled ? c.on : undefined,
        evidence: c.boosterNeedsAdmin,
        more: isLocked ? undefined : (
          <BoosterThreshold c={c} initial={item.thresholdMb} busy={busy} />
        ),
        action:
          !item.enabled && !isLocked ? (
            <button
              type="button"
              className="scan-secondary scan2-row-action"
              onClick={() => onTurnOn(item.tweak.id)}
              disabled={busy}
            >
              {c.turnOn}
            </button>
          ) : undefined,
      };
    case "observation": {
      const o = item.observation;
      const [title, body] = scan.observations[o.kind];
      return {
        title,
        body,
        evidence: o.evidence
          ? o.kind === "security"
            ? factorLabel(lang, o.id, o.evidence)
            : o.evidence
          : undefined,
        action: reviewButton(scan.manual, o.section, onNavigate, busy),
      };
    }
    case "ram": {
      const m = item.memory;
      const source =
        m.rated_source === "part_number"
          ? format(c.ramSourcePart, { part: m.part_number })
          : c.ramSourceModule;
      return {
        title: m.below_rated ? c.ramBelow : c.ramOk,
        body:
          format(c.ramBody, {
            configured: formatNumber(m.configured_mts),
            rated: formatNumber(m.rated_mts),
            source,
          }) + (m.below_rated ? ` ${c.ramBodyLikely}` : ""),
        more: m.below_rated ? (
          <Steps title={c.howToFix} steps={c.ramFix} note={c.readOnly} />
        ) : undefined,
      };
    }
    case "link": {
      const l = item.link;
      const nvme = l.kind === "nvme";
      return {
        title: nvme
          ? l.below_max
            ? c.linkNvmeBelow
            : c.linkNvmeOk
          : l.below_max
            ? c.linkGpuBelow
            : c.linkGpuOk,
        body: format(c.linkBody, {
          name: l.name,
          current: l.current_gen,
          currentWidth: l.current_width,
          max: l.max_gen,
          maxWidth: l.max_width,
        }),
        evidence: nvme ? undefined : c.linkGpuNote,
        more: l.below_max ? (
          <Steps title={c.howToFix} steps={nvme ? c.linkFixNvme : c.linkFixGpu} note={c.readOnly} />
        ) : undefined,
      };
    }
    case "rebar": {
      const r = item.rebar;
      return {
        title: r.state === "on" ? c.rebarOn : r.state === "off" ? c.rebarOff : c.rebarUnknown,
        body: format(c.rebarBody, { gpu: r.gpu, size: mb(r.largest_window_mb) }),
        more:
          r.state === "off" ? (
            <Steps title={c.howToFix} steps={c.rebarFix} note={c.readOnly} />
          ) : undefined,
      };
    }
    case "interrupts": {
      const l = item.sample;
      return {
        title: l.concentrated ? c.irqBad : c.irqOk,
        body: format(c.irqBody, {
          seconds: formatNumber(Math.round(l.seconds * 10) / 10, 1),
          irq: pct(l.cpu0_interrupt_share),
          dpc: pct(l.cpu0_dpc_share),
          cpus: formatNumber(l.cpus),
        }),
        evidence: l.concentrated ? c.irqExplain : undefined,
      };
    }
    case "dpc":
      return { title: c.dpcTitle, body: c.dpcBody, more: <DpcMeasure c={c} busy={busy} /> };
    case "audio":
      return describeAudio(lang, c, item.finding, onNavigate, busy, onError);
  }
}

/** The class of every row's own button (wraps under the text when narrow). */
const ROW_ACTION = "scan-secondary scan2-row-action";

/** The Audio category's rows (AUDIO-SPEC 5): measured values only. */
function describeAudio(
  lang: Lang,
  c: Scan2Copy,
  f: Extract<ScanItem, { type: "audio" }>["finding"],
  onNavigate: (section: Section) => void,
  busy: boolean,
  onError: (message: string) => void,
): RowText {
  const a = AUDIO_COPY[lang];
  const review = reviewButton(a.openAudio, "audio", onNavigate, busy);
  switch (f.kind) {
    case "devices": {
      const name = (e: typeof f.output) =>
        e ? (e.format ? `${e.name} (${formatLine(a, e.format)})` : e.name) : a.none;
      return {
        title: a.scanDevicesTitle,
        body: format(a.scanDevicesBody, { output: name(f.output), input: name(f.input) }),
        action: review,
      };
    }
    case "callMode":
      return {
        title: format(a.callModeTitle, { device: f.device }),
        body: format(a.callModeBody, { process: f.process }),
        action: (
          <SoundSettingsButton
            label={a.soundSettings}
            disabled={busy}
            className={ROW_ACTION}
            onError={onError}
          />
        ),
      };
    case "ducking":
      return { title: duckingTitle(a, f.value), body: a.duckingBody };
    case "idle": {
      const values = { device: f.timer.name, seconds: formatNumber(f.timer.seconds) };
      return {
        title: format(a.scanIdleTitle, values),
        body: format(a.idleBody, { seconds: values.seconds }),
        lockedGain: format(a.scanIdleLocked, values),
      };
    }
    case "power":
      return {
        title: format(a.scanPowerTitle, { device: f.device.name }),
        body: a.powerBody,
        evidence: f.modernStandby ? a.modernStandby : undefined,
        lockedGain: format(a.scanPowerLocked, { device: f.device.name }),
        action: f.modernStandby ? review : undefined,
      };
    case "eapo":
      return {
        title: format(a.eapoInactiveTitle, { name: f.endpoint.name }),
        body: [
          a.eapoInactiveBody,
          f.stale > 0 ? format(a.eapoStale, { count: formatNumber(f.stale) }) : "",
        ]
          .filter(Boolean)
          .join(" "),
        evidence: a.eapoAbout,
        action: f.selector ? (
          <DeviceSelectorButton c={a} disabled={busy} className={ROW_ACTION} onError={onError} />
        ) : (
          review
        ),
      };
    case "effectsOff": {
      const eq = f.endpoint.eq !== "none";
      return {
        title: format(eq ? a.eapoBypassedTitle : a.effectsOffTitle, { name: f.endpoint.name }),
        body: eq ? a.eapoBypassedBody : a.effectsOffBody,
        action: (
          <SoundSettingsButton
            label={a.deviceSettings}
            endpoint={f.endpoint.id}
            disabled={busy}
            className={ROW_ACTION}
            onError={onError}
          />
        ),
      };
    }
    case "mic":
      return {
        title: f.muted ? a.micMuted : format(a.micLow, { level: formatNumber(f.level) }),
        body: format(a.micBody, { name: f.name }),
        action: (
          <SoundSettingsButton
            label={a.deviceSettings}
            endpoint={f.endpoint?.id}
            disabled={busy}
            className={ROW_ACTION}
            onError={onError}
          />
        ),
      };
    case "bluetooth":
      return {
        title: a.scanBtTitle,
        body: a.scanBtBody,
        badges: <Badge>{c.optional}</Badge>,
        action: review,
      };
  }
}

const THRESHOLDS = [512, 1024, 2048, 4096];

/** The booster's threshold, saved at once (ramboost.rs clamps it again). */
function BoosterThreshold({ c, initial, busy }: { c: Scan2Copy; initial: number; busy: boolean }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const options = THRESHOLDS.includes(value)
    ? THRESHOLDS
    : [...THRESHOLDS, value].sort((a, b) => a - b);
  async function choose(mb: number) {
    setError("");
    try {
      setValue(await invoke<number>("set_ram_boost_threshold", { mb }));
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <div className="scan2-threshold">
      <label>
        <span>{c.boosterThreshold}</span>
        <select value={value} disabled={busy} onChange={(e) => void choose(Number(e.target.value))}>
          {options.map((mb) => (
            <option key={mb} value={mb}>
              {formatBytes(mb * 1024 * 1024)}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="scan2-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** The 10-second DPC/ISR trace from diagnostics/dpc.rs, on request. */
function DpcMeasure({ c, busy }: { c: Scan2Copy; busy: boolean }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [report, setReport] = useState<DpcReport | null>(null);
  const [error, setError] = useState("");
  async function measure() {
    setState("running");
    setError("");
    try {
      setReport(await invoke<DpcReport>("trace_dpc_latency", { seconds: 10 }));
      setState("done");
    } catch (e) {
      setError(String(e));
      setState("error");
    }
  }
  const over = report
    ? report.dpc.maxUs > report.dpc.limitUs || report.isr.maxUs > report.isr.limitUs
    : false;
  const worst = report?.drivers[0]?.driver ?? c.dpcUnknownDriver;
  return (
    <div className="scan2-dpc" aria-live="polite">
      {report && (
        <p className="scan2-evidence selectable">
          <Badge kind={over ? "warn" : "ok"}>{over ? c.dpcOver : c.dpcOk}</Badge>{" "}
          {format(c.dpcResult, {
            dpc: formatNumber(Math.round(report.dpc.maxUs)),
            isr: formatNumber(Math.round(report.isr.maxUs)),
            driver: worst,
          })}
        </p>
      )}
      {error && (
        <p className="scan2-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="scan-secondary"
        onClick={() => void measure()}
        disabled={busy || state === "running"}
      >
        {state === "running" ? c.dpcMeasuring : c.dpcMeasure}
      </button>
    </div>
  );
}
