// Safe optimize: one button, only low-risk settings, a restore point first,
// then the proof card.
import { useId, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Lang, Strings } from "../i18n";
import { format } from "../i18n";
import { friendlyError, textFor } from "../lib";
import type { RestoreStatus, Toast, TweakInfo } from "../types";
import { Badge } from "./ui";
import { PROOF_COPY } from "./proof-copy";
import { runWithProof, useProofBusy } from "./proof-card";
import "./safe-optimize.css";

/**
 * The only settings Safe optimize touches. Each one is undone from Change
 * history, trades away no security, switches off nothing the user relies on,
 * writes no Windows policy (no "managed by your organization" banner), needs
 * no restart and fits every PC (Windows offers it or the catalogue marks it
 * unavailable). The reason the user reads is in proof-copy.ts `safeReasons`,
 * same ids; scripts/test-safe-optimize.mjs keeps the two in step and checks
 * that every id is a real catalogue tweak.
 */
export const SAFE_OPTIMIZE: readonly string[] = [
  // Ads and promoted apps in Start (one HKCU value); pinned apps and search stay.
  "disable_start_suggestions",
  // Windows installing promoted apps by itself (HKCU); installed apps untouched.
  "disable_suggested_apps",
  // Feedback survey pop-ups (HKCU); Feedback Hub still opens.
  "disable_feedback_requests",
  // Ads and tips tailored from diagnostic data (HKCU); no feature depends on it.
  "disable_tailored_experiences",
  // The advertising ID apps use to profile (HKCU); no app needs it to work.
  "reset_advertising_id",
  // The built-in wait before startup apps launch (HKCU); the apps are unchanged.
  "disable_startup_delay",
  // The 400 ms menu delay (HKCU); only timing changes.
  "menu_show_delay",
  // Pro: Windows' own tips, welcome screens and suggested notifications (HKCU).
  "disable_windows_suggestions",
  // Pro: device makers' apps installing themselves (the Control Panel switch,
  // not a policy); drivers still install.
  "block_oem_device_apps",
];

/** What Safe optimize would do on this PC: `ready` now, `locked` with Pro,
 *  `items` every listed setting this PC can have (for the review list). */
export function safePlan(tweaks: TweakInfo[], isPro: boolean) {
  const byId = new Map(tweaks.map((t) => [t.id, t]));
  const items = SAFE_OPTIMIZE.flatMap((id) => byId.get(id) ?? []).filter((t) => !t.unavailable);
  const open = items.filter((t) => !t.applied && !t.already_set);
  return {
    items,
    ready: open.filter((t) => !t.requires_pro || isPro),
    locked: open.filter((t) => t.requires_pro && !isPro),
  };
}

/** Mirrors `SafeApplyResult` in lib.rs. */
type SafeApplyResult = { restorePoint: RestoreStatus; failures: string[] };

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m8.8 12.2 2.2 2.2 4.3-4.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SafeOptimizeCard({
  s,
  lang,
  tweaks,
  isPro,
  onChanged,
  onRequirePro,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  tweaks: TweakInfo[];
  isPro: boolean;
  onChanged: () => Promise<void>;
  onRequirePro: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const c = PROOF_COPY[lang];
  const busy = useProofBusy();
  const titleId = useId();
  const [declined, setDeclined] = useState(false);
  const plan = safePlan(tweaks, isPro);
  const name = (t: TweakInfo) => textFor(s.tweaks, t.id, t.name, t.description).name;

  async function run(withRestorePoint: boolean) {
    setDeclined(false);
    // Without the restore point only what needs no administrator rights runs.
    const attempted = withRestorePoint ? plan.ready : plan.ready.filter((t) => !t.requires_admin);
    const ids = attempted.map((t) => t.id);
    try {
      await runWithProof(
        "safe",
        async () => {
          let restorePoint: RestoreStatus;
          if (withRestorePoint) {
            try {
              restorePoint = (await invoke<SafeApplyResult>("safe_apply", { ids })).restorePoint;
            } catch (e) {
              // The prompt was declined: nothing changed, and the card says so.
              if (String(e).startsWith("elevation was cancelled or failed")) {
                setDeclined(true);
                return null;
              }
              throw e;
            }
          } else {
            await invoke<string[]>("apply_tweaks", { ids, source: "safe-optimize" });
            restorePoint = { kind: "skipped" };
          }
          // Counted from what is in effect now, not from the failure list.
          const after = await invoke<TweakInfo[]>("list_tweaks");
          await onChanged();
          const done = attempted.filter((t) => after.some((a) => a.id === t.id && a.applied));
          return {
            changed: done.map(name),
            failures: attempted.length - done.length,
            restorePoint,
          };
        },
        { admin: true },
      );
    } catch (e) {
      pushToast("error", friendlyError(e, s));
    }
  }

  const allSet = plan.ready.length === 0;

  return (
    <section className="safe-card" aria-labelledby={titleId} data-state={allSet ? "done" : "ready"}>
      <span className="safe-emblem" aria-hidden="true">
        <ShieldIcon />
      </span>
      <div className="safe-copy">
        <p className="safe-eyebrow">{c.safeEyebrow}</p>
        <h3 id={titleId}>{c.safeTitle}</h3>
        <p className="safe-body">
          {allSet ? c.safeAllSet : format(c.safeBody, { count: plan.ready.length })}
        </p>
        {!allSet && <p className="safe-undo">{c.safeUndo}</p>}
      </div>
      <div className="safe-action">
        {!allSet && (
          <button
            type="button"
            className="tool-primary-action"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void run(true)}
          >
            <ShieldIcon />
            {busy ? c.safeBusy : c.safeButton}
          </button>
        )}
        {plan.locked.length > 0 && (
          <button type="button" className="safe-pro" onClick={onRequirePro}>
            <Badge kind="pro">{s.badges.pro}</Badge>
            {format(c.safeProMore, { count: plan.locked.length })}
          </button>
        )}
      </div>
      {plan.items.length > 0 && (
        <details className="safe-review">
          <summary>{c.safeReview}</summary>
          <ul role="list">
            {plan.items.map((t) => {
              const inPlace = t.applied || !!t.already_set;
              const locked = !inPlace && t.requires_pro && !isPro;
              return (
                <li key={t.id} data-done={inPlace}>
                  <span className="safe-mark" aria-hidden="true">
                    {inPlace ? "✓" : "•"}
                  </span>
                  <span className="safe-item">
                    <strong>
                      {name(t)}
                      {locked && <Badge kind="pro">{s.badges.pro}</Badge>}
                    </strong>
                    <span>{c.safeReasons[t.id]}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {declined && (
        <div className="safe-declined" role="alert">
          <p>{c.safeDeclined}</p>
          {plan.ready.some((t) => !t.requires_admin) && (
            <div>
              <button
                type="button"
                className="tool-secondary-action"
                disabled={busy}
                onClick={() => void run(false)}
              >
                {c.safeContinue}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
