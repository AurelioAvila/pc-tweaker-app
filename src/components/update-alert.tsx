// "A Windows update changed N of your settings": asked when the window opens
// (and when it comes back from the tray, or after the notification's Restore),
// from the same read-only check as the History card (updatewatch.rs). Never
// re-applies on its own: Restore is the user's click.
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { format, type Lang, type Strings } from "../i18n";
import { friendlyError, textFor } from "../lib";
import { MANUAL_ONLY_TWEAK_IDS } from "../catalog";
import type { DriftReport, Toast, TweakInfo } from "../types";
import { Badge, Toggle } from "./ui";
import { ToolHeader } from "./tool-section";
import { PROOF_COPY } from "./proof-copy";
import "./update-alert.css";

/** At most one check every 30 seconds, however often the window gains focus. */
const RECHECK_MS = 30_000;

function UpdateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UpdateAlertDialog({
  s,
  lang,
  tweaks,
  isPro,
  onChanged,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  tweaks: TweakInfo[];
  isPro: boolean;
  onChanged: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const c = PROOF_COPY[lang];
  const [report, setReport] = useState<DriftReport | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const opener = useRef<HTMLElement | null>(null);

  const check = useCallback(() => {
    if (Date.now() - last.current < RECHECK_MS) return;
    last.current = Date.now();
    invoke<DriftReport>("check_update_drift")
      .then((r) => {
        const offered = r.alert ? r.reverted.filter((id) => !MANUAL_ONLY_TWEAK_IDS.has(id)) : [];
        if (offered.length === 0) return;
        setReport((open) => {
          if (!open) {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }
          return { ...r, reverted: offered };
        });
      })
      .catch(() => {
        // An unreadable patch level is not something to put in front of the
        // user: the alert simply has nothing to say.
      });
  }, []);

  useEffect(() => {
    check();
    const unlisten = listen("app-reopened", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("focus", check);
      void unlisten.then((stop) => stop()).catch(() => {});
    };
  }, [check]);

  if (!report) return null;

  const offered = report.reverted;
  const chosen = offered.filter((id) => !skipped.has(id));
  const one = offered.length === 1;
  const nameOf = (id: string) => {
    const t = tweaks.find((x) => x.id === id);
    return t ? textFor(s.tweaks, t.id, t.name, t.description).name : id;
  };

  function close() {
    setReport(null);
    setSkipped(new Set());
    opener.current?.focus();
  }

  async function notNow() {
    await invoke("dismiss_update_alert").catch(() => undefined);
    close();
  }

  async function restore() {
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const failures = await invoke<string[]>("apply_tweaks", { ids: chosen, source: "reapply" });
      // Counted from what is in effect now: a declined prompt reports one
      // failure for the whole administrator part.
      const after = await invoke<TweakInfo[]>("list_tweaks");
      const done = chosen.filter((id) => after.some((t) => t.id === id && t.applied));
      await onChanged();
      failures.forEach((f) => pushToast("error", friendlyError(f, s)));
      if (done.length > 0) {
        pushToast(
          "success",
          done.length === 1
            ? c.alertRestoredOne
            : format(c.alertRestoredMany, { count: done.length }),
        );
        await invoke("dismiss_update_alert").catch(() => undefined);
        close();
      }
    } catch (e) {
      pushToast("error", friendlyError(e, s));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={(node) => {
        if (node && !node.open) {
          node.showModal();
          // The answer most people want is the primary button.
          node.querySelector<HTMLButtonElement>(".alert-actions .tool-primary-action")?.focus();
        }
      }}
      className="alert-dialog"
      aria-labelledby="alert-title"
      aria-describedby="alert-body"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) void notNow();
      }}
    >
      <span className="alert-emblem" aria-hidden="true">
        <UpdateIcon />
      </span>
      <h2 id="alert-title">
        {one ? c.alertTitleOne : format(c.alertTitleMany, { count: offered.length })}
      </h2>
      <p id="alert-body" className="alert-body">
        {format(c.alertBody, { patch: report.currentPatch })}
      </p>
      {!one && <p className="alert-hint">{s.drift.pickHint}</p>}
      <ul className="alert-list" role="list">
        {offered.map((id) => {
          const picked = !skipped.has(id);
          return (
            <li key={id}>
              <label data-picked={picked}>
                <input
                  type="checkbox"
                  checked={picked}
                  disabled={busy || one}
                  onChange={() =>
                    setSkipped((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                />
                <span>{nameOf(id)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {!isPro && (
        <p className="alert-pro">
          <Badge kind="pro">{s.badges.pro}</Badge>
          <span>{c.alertProHint}</span>
        </p>
      )}
      <footer className="alert-actions">
        <button
          type="button"
          className="tool-secondary-action"
          disabled={busy}
          onClick={() => void notNow()}
        >
          {c.alertNotNow}
        </button>
        <button
          type="button"
          className="tool-primary-action"
          disabled={busy || chosen.length === 0}
          aria-busy={busy}
          onClick={() => void restore()}
        >
          {busy && <span className="scan-spinner" aria-hidden="true" />}
          {busy
            ? c.alertRestoring
            : chosen.length === 1
              ? c.alertRestoreOne
              : format(c.alertRestoreMany, { count: chosen.length })}
        </button>
      </footer>
    </dialog>
  );
}

/** Mirrors `AlertStatus` in update_alert.rs. */
type AlertStatus = { on: boolean; chosen: boolean };

/** The Pro switch for the notification with the app closed. Free accounts see
 *  it with the Pro badge; turning it on opens the plans. */
export function UpdateAlertToggle({
  s,
  lang,
  isPro,
  onRequirePro,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  isPro: boolean;
  onRequirePro: () => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const c = PROOF_COPY[lang];
  const [status, setStatus] = useState<AlertStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Re-read when Pro changes: the task follows the licence.
    invoke<AlertStatus>("update_alert_status")
      .then(setStatus)
      .catch(() => setStatus({ on: false, chosen: true }));
  }, [isPro]);

  async function toggle() {
    if (!isPro) {
      onRequirePro();
      return;
    }
    if (!status || busy) return;
    setBusy(true);
    try {
      setStatus(await invoke<AlertStatus>("set_update_alert", { enabled: !status.on }));
    } catch (e) {
      pushToast("error", friendlyError(e, s));
    }
    setBusy(false);
  }

  return (
    <div className="tool-panel mb-6">
      <ToolHeader
        title={
          <span className="alert-toggle-title">
            {c.alertToggleTitle}
            <Badge kind="pro">{s.badges.pro}</Badge>
          </span>
        }
        description={c.alertToggleBody}
        icon={<UpdateIcon className="h-5 w-5" />}
        actions={
          <Toggle
            checked={isPro && status?.on === true}
            busy={busy || (isPro && status === null)}
            onClick={() => void toggle()}
            s={s}
            label={c.alertToggleTitle}
          />
        }
      />
    </div>
  );
}
