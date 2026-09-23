import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Lang } from "../i18n";
import type { DownloadLimitState, EcoQosState, MonitorProfilesState } from "../types";
import { ADVANCED_COPY } from "./advanced-copy";
import { reconcileDownloadState } from "./download-limit-reconcile";
import { ToolHeader, ToolStatus } from "./tool-section";
import "./advanced-controls.css";

export type AdvancedId =
  "ecoqos_rules" | "limit_do_background_download" | "monitor_refresh_profile";

async function chooseExecutable() {
  const path = await open({
    multiple: false,
    filters: [{ name: "Windows executable", extensions: ["exe"] }],
  });
  return typeof path === "string" ? path : null;
}

export function AdvancedControlCard({
  id,
  lang,
  isPro,
  onRequirePro,
}: {
  id: AdvancedId;
  lang: Lang;
  isPro: boolean;
  onRequirePro: (title: string) => void;
}) {
  const c = ADVANCED_COPY[lang];
  if (id === "ecoqos_rules")
    return <EcoCard lang={lang} isPro={isPro} onRequirePro={() => onRequirePro(c.ecoTitle)} />;
  if (id === "limit_do_background_download")
    return <DownloadCard lang={lang} isPro={isPro} onRequirePro={() => onRequirePro(c.doTitle)} />;
  return (
    <MonitorCard lang={lang} isPro={isPro} onRequirePro={() => onRequirePro(c.monitorTitle)} />
  );
}

function EcoCard({
  lang,
  isPro,
  onRequirePro,
}: {
  lang: Lang;
  isPro: boolean;
  onRequirePro: () => void;
}) {
  const c = ADVANCED_COPY[lang];
  const [state, setState] = useState<EcoQosState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    setState(await invoke<EcoQosState>("ecoqos_status"));
  }
  useEffect(() => {
    void invoke<EcoQosState>("ecoqos_status")
      .then(setState)
      .catch((e: unknown) => setError(String(e)));
  }, []);
  async function act(task: () => Promise<unknown>, requiresPro = true) {
    if (requiresPro && !isPro) {
      onRequirePro();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await task();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tool-panel advanced-card" aria-busy={busy}>
      <ToolHeader
        title={
          <>
            {c.ecoTitle} <span className="tool-pro-tag">PRO</span>
          </>
        }
        description={c.ecoDescription}
        actions={
          <button
            className="advanced-switch"
            type="button"
            role="switch"
            aria-label={c.ecoTitle}
            aria-checked={state?.enabled ?? false}
            disabled={busy || !state}
            onClick={() =>
              void act(
                () => invoke("ecoqos_set_enabled", { enabled: !state?.enabled }),
                !state?.enabled,
              )
            }
          >
            <span />
          </button>
        }
      />
      {state?.blocked_global && <ToolStatus tone="error">{c.ecoConflict}</ToolStatus>}
      {state && (
        <div className="advanced-facts">
          <span>{state.enabled ? c.ecoOn : c.ecoOff}</span>
          <span>{state.engine_running ? c.ecoRunning : c.ecoStopped}</span>
          <span>
            {c.ecoActive}: {state.active_processes}
          </span>
          {state.pending_restore > 0 && (
            <span>
              {c.ecoPending}: {state.pending_restore}
            </span>
          )}
        </div>
      )}
      <button
        className="advanced-refresh"
        type="button"
        disabled={busy}
        onClick={() => void refresh().catch((e: unknown) => setError(String(e)))}
      >
        {c.refresh}
      </button>
      <div className="advanced-toolbar">
        <strong>{c.path}</strong>
        <button
          type="button"
          data-tone="primary"
          disabled={busy || !!state?.blocked_global}
          onClick={() =>
            void act(async () => {
              const path = await chooseExecutable();
              if (path) await invoke("ecoqos_add_rule", { path });
            })
          }
        >
          {c.ecoAdd}
        </button>
      </div>
      {state?.rules.length ? (
        <ul className="advanced-rules">
          {state.rules.map((rule) => (
            <li key={rule.path}>
              <span>
                <strong>{rule.name}</strong>
                <small title={rule.path}>{rule.path}</small>
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={`${c.remove}: ${rule.name}`}
                onClick={() =>
                  void act(() => invoke("ecoqos_remove_rule", { path: rule.path }), false)
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="advanced-empty">{c.ecoEmpty}</p>
      )}
      {(error || state?.last_error) && (
        <ToolStatus tone="error">{error || state?.last_error}</ToolStatus>
      )}
    </section>
  );
}

function DownloadCard({
  lang,
  isPro,
  onRequirePro,
}: {
  lang: Lang;
  isPro: boolean;
  onRequirePro: () => void;
}) {
  const c = ADVANCED_COPY[lang];
  const [state, setState] = useState<DownloadLimitState | null>(null);
  const [value, setValue] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    const next = await invoke<DownloadLimitState>("download_limit_state");
    setState(next);
    if (next.configuredKbps !== null) setValue(next.configuredKbps);
  }
  useEffect(() => {
    void invoke<DownloadLimitState>("download_limit_state")
      .then((next) => {
        setState(next);
        if (next.configuredKbps !== null) setValue(next.configuredKbps);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);
  async function act(task: () => Promise<DownloadLimitState>, requiresPro = true) {
    if (requiresPro && !isPro) {
      onRequirePro();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await task();
      setState(next);
      if (next.configuredKbps !== null) setValue(next.configuredKbps);
    } catch (e) {
      setError(String(e));
      await reconcileDownloadState(
        () => invoke<DownloadLimitState>("download_limit_state"),
        (next) => {
          setState(next);
          if (next && next.configuredKbps !== null) setValue(next.configuredKbps);
        },
      );
    } finally {
      setBusy(false);
    }
  }
  const valid = Number.isInteger(value) && value >= 1 && value <= 1_000_000;
  return (
    <section className="tool-panel advanced-card" aria-busy={busy}>
      <ToolHeader
        title={
          <>
            {c.doTitle} <span className="tool-pro-tag">PRO</span>
          </>
        }
        description={c.doDescription}
      />
      {state && !state.supported && <ToolStatus tone="error">{c.doUnsupported}</ToolStatus>}
      {state?.conflict && <ToolStatus tone="error">{state.conflict}</ToolStatus>}
      <div className="advanced-facts">
        <span>
          {c.doConfigured}:{" "}
          {state?.configuredKbps === null
            ? c.doUnlimited
            : state
              ? `${state.configuredKbps} KB/s`
              : "…"}
        </span>
        {state && (
          <span>
            {c.doProvider}: {state.provider}
          </span>
        )}
      </div>
      <div className="advanced-toolbar">
        <label>
          {c.doValue}
          <input
            type="number"
            min="1"
            max="1000000"
            step="1"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            disabled={busy || state?.supported === false}
          />
        </label>
        <button
          type="button"
          data-tone="primary"
          disabled={
            busy || !state || !valid || !state.supported || !!state.conflict || !!state.applied
          }
          onClick={() =>
            void act(() => invoke<DownloadLimitState>("set_download_limit", { kbps: value }))
          }
        >
          {c.doSave}
        </button>
        <button
          type="button"
          disabled={busy || !state?.applied}
          onClick={() =>
            void act(() => invoke<DownloadLimitState>("restore_download_limit"), false)
          }
        >
          {c.doRestore}
        </button>
      </div>
      <button
        className="advanced-refresh"
        type="button"
        disabled={busy}
        onClick={() =>
          void refresh()
            .then(() => setError(null))
            .catch((e: unknown) => setError(String(e)))
        }
      >
        {c.refresh}
      </button>
      <p className="advanced-note">{c.doReadback}</p>
      {error && <ToolStatus tone="error">{error}</ToolStatus>}
    </section>
  );
}

function MonitorCard({
  lang,
  isPro,
  onRequirePro,
}: {
  lang: Lang;
  isPro: boolean;
  onRequirePro: () => void;
}) {
  const c = ADVANCED_COPY[lang];
  const [state, setState] = useState<MonitorProfilesState | null>(null);
  const [displayId, setDisplayId] = useState("");
  const [hz, setHz] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  async function refresh() {
    setState(await invoke<MonitorProfilesState>("monitor_profiles_state"));
    setNow(Date.now());
  }
  useEffect(() => {
    void invoke<MonitorProfilesState>("monitor_profiles_state")
      .then((next) => {
        setState(next);
        setNow(Date.now());
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);
  const selectedDisplayId = state?.displays.some((d) => d.id === displayId && d.supported)
    ? displayId
    : (state?.displays.find((d) => d.supported)?.id ?? "");
  const display = state?.displays.find((d) => d.id === selectedDisplayId);
  const selectedHz = display?.frequencies.includes(hz)
    ? hz
    : display?.current_hz || display?.frequencies[0] || 0;
  useEffect(() => {
    if (!state?.deadline_ms) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    const reload = window.setTimeout(
      () => {
        void invoke<MonitorProfilesState>("monitor_profiles_state")
          .then(setState)
          .catch((e: unknown) => setError(String(e)));
      },
      Math.max(0, state.deadline_ms - Date.now() + 200),
    );
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(reload);
    };
  }, [state?.deadline_ms]);
  async function act(task: () => Promise<unknown>, requiresPro = true) {
    if (requiresPro && !isPro) {
      onRequirePro();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await task();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const canChange = !!display?.supported && selectedHz > 0;
  const remaining = state?.deadline_ms
    ? Math.max(0, Math.ceil((state.deadline_ms - now) / 1000))
    : 0;
  return (
    <section className="tool-panel advanced-card" aria-busy={busy}>
      <ToolHeader
        title={
          <>
            {c.monitorTitle} <span className="tool-pro-tag">PRO</span>
          </>
        }
        description={c.monitorDescription}
        actions={
          <button
            className="advanced-switch"
            type="button"
            role="switch"
            aria-label={c.monitorTitle}
            aria-checked={state?.enabled ?? false}
            disabled={busy || !state}
            onClick={() =>
              void act(
                () => invoke("monitor_set_enabled", { enabled: !state?.enabled }),
                !state?.enabled,
              )
            }
          >
            <span />
          </button>
        }
      />
      {state && !state.displays.some((d) => d.supported) && (
        <ToolStatus>{c.monitorNoDisplays}</ToolStatus>
      )}
      <div className="advanced-toolbar">
        <label>
          {c.monitorDisplay}
          <select
            value={selectedDisplayId}
            onChange={(e) => setDisplayId(e.target.value)}
            disabled={busy}
          >
            {state?.displays
              .filter((d) => d.supported)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.current_hz} Hz
                </option>
              ))}
          </select>
        </label>
        <label>
          {c.monitorFrequency}
          <select
            value={selectedHz}
            onChange={(e) => setHz(Number(e.target.value))}
            disabled={busy || !display}
          >
            {display?.frequencies.map((rate) => (
              <option key={rate} value={rate}>
                {rate} Hz
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="advanced-toolbar">
        <button
          type="button"
          data-tone="primary"
          disabled={busy || !canChange || !!state?.pending_confirmation}
          onClick={() =>
            void act(async () => {
              await invoke("monitor_preview", { displayId: selectedDisplayId, hz: selectedHz });
            })
          }
        >
          {c.monitorPreview}
        </button>
        {state?.pending_confirmation && (
          <button
            type="button"
            data-tone="primary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await invoke("monitor_confirm");
              })
            }
          >
            {c.monitorConfirm}
            {remaining ? ` · ${remaining}s` : ""}
          </button>
        )}
        <button
          type="button"
          disabled={busy || (!state?.active && !state?.pending_confirmation)}
          onClick={() =>
            void act(async () => {
              await invoke("monitor_restore");
            }, false)
          }
        >
          {c.monitorRestore}
        </button>
      </div>
      {state?.pending_confirmation && (
        <ToolStatus tone="active">
          {c.monitorPending}
          {remaining ? ` · ${remaining}s` : ""}
        </ToolStatus>
      )}
      <button
        className="advanced-refresh"
        type="button"
        disabled={busy}
        onClick={() => void refresh().catch((e: unknown) => setError(String(e)))}
      >
        {c.refresh}
      </button>
      <div className="advanced-toolbar">
        <strong>{c.monitorRules}</strong>
        <button
          type="button"
          data-tone="primary"
          disabled={busy || !canChange || selectedHz !== display?.current_hz}
          onClick={() =>
            void act(async () => {
              const path = await chooseExecutable();
              if (path)
                await invoke("monitor_save_rule", {
                  path,
                  displayId: selectedDisplayId,
                  hz: selectedHz,
                });
            })
          }
        >
          {c.monitorGame} · {c.monitorAdd}
        </button>
      </div>
      {canChange && selectedHz !== display?.current_hz && (
        <p className="advanced-note">{c.monitorGuide}</p>
      )}
      {state?.rules.length ? (
        <ul className="advanced-rules">
          {state.rules.map((rule) => (
            <li key={rule.path}>
              <span>
                <strong>
                  {rule.name} · {rule.hz} Hz
                </strong>
                <small title={rule.path}>{rule.path}</small>
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={`${c.remove}: ${rule.name}`}
                onClick={() =>
                  void act(() => invoke("monitor_remove_rule", { path: rule.path }), false)
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="advanced-empty">{c.monitorEmpty}</p>
      )}
      {(error || state?.error) && <ToolStatus tone="error">{error || state?.error}</ToolStatus>}
    </section>
  );
}
