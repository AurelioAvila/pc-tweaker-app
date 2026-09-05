import { useCallback, useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFolderDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { format, Lang, Strings } from "../i18n";
import { formatEpochDate } from "../lib";
import { FolderIcon, LayersIcon } from "./icons";
import { LoadedProfile, Toast, TweakInfo, TweakProfile } from "../types";
import "./workspace-panels.css";
import { LifetimeTools } from "./lifetime-tools";

/**
 * Saved configurations: capture what's applied, put it back later, or hand it
 * to someone else.
 *
 * Applying goes through the same `apply_tweaks` path as everything else, so a
 * profile can never reach a tweak the app wouldn't otherwise let the user
 * apply — including the Pro gate, which is re-checked here rather than trusted
 * from the file.
 */
/** One saved (or just-imported) profile card. Top-level on purpose: defining
 *  it inside ProfilesPanel recreated the component type every render, which
 *  remounts the subtree (react-hooks/component-hook-factories). */
export function ProfileRow({
  s,
  profile,
  imported,
  busy,
  onApply,
  onExport,
  onRemove,
}: {
  s: Strings;
  profile: TweakProfile;
  imported?: boolean;
  busy: string | null;
  onApply: (profile: TweakProfile) => void;
  onExport?: (profile: TweakProfile) => void;
  onRemove?: (name: string) => void;
}) {
  return (
    <article className={`workspace-profile-row ${imported ? "is-imported" : ""}`}>
      <span className="workspace-profile-symbol" aria-hidden="true">
        {imported ? <FolderIcon className="h-5 w-5" /> : <LayersIcon className="h-5 w-5" />}
      </span>
      <div className="workspace-profile-identity">
        <h3>{profile.name || "—"}</h3>
        <p>
          {format(s.profiles.tweakCount, { count: profile.tweaks.length })}
          {!imported && profile.created_at ? ` · ${formatEpochDate(profile.created_at)}` : ""}
        </p>
      </div>
      <div className="workspace-profile-actions">
        <button
          onClick={() => onApply(profile)}
          disabled={busy !== null || profile.tweaks.length === 0}
          aria-label={`${s.profiles.apply} · ${profile.name}`}
          aria-busy={busy === profile.name}
          className="workspace-button workspace-button-primary"
        >
          {busy === profile.name ? s.profiles.applying : s.profiles.apply}
        </button>
        {!imported && (
          <>
            <button
              onClick={() => onExport?.(profile)}
              aria-label={`${s.profiles.exportButton} · ${profile.name}`}
              className="workspace-button workspace-button-secondary"
            >
              {s.profiles.exportButton}
            </button>
            <button
              onClick={() => onRemove?.(profile.name)}
              aria-label={`${s.profiles.deleteButton} · ${profile.name}`}
              className="workspace-button workspace-button-delete"
            >
              {s.profiles.deleteButton}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function ProfilesPanel({
  s,
  lang,
  lifetimeOwned,
  onViewPlans,
  tweaks,
  isPro,
  authed,
  onRequireAuth,
  onRequirePro,
  onChanged,
  pushToast,
}: {
  s: Strings;
  lang: Lang;
  lifetimeOwned: boolean;
  onViewPlans: () => void;
  tweaks: TweakInfo[];
  isPro: boolean;
  /** Saving/loading a configuration is an account feature — free or Pro,
   *  but never anonymous, so a profile can always be tied back to a customer. */
  authed: boolean;
  onRequireAuth: () => void;
  onRequirePro: () => void;
  onChanged: () => Promise<void>;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [saved, setSaved] = useState<TweakProfile[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<LoadedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const readRequest = useRef(0);

  const readProfiles = useCallback(() => {
    const request = ++readRequest.current;
    invoke<TweakProfile[]>("list_profiles")
      .then((profiles) => {
        if (request === readRequest.current) setSaved(profiles);
      })
      .catch((e: unknown) => {
        if (request === readRequest.current) setLoadError(String(e));
      })
      .finally(() => {
        if (request === readRequest.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    readProfiles();
    return () => {
      readRequest.current += 1;
    };
  }, [readProfiles]);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    readProfiles();
  }

  async function saveCurrent() {
    if (saving) return;
    if (!authed) {
      onRequireAuth();
      return;
    }
    if (!name.trim()) {
      pushToast("error", s.profiles.nameRequired);
      return;
    }
    setSaving(true);
    try {
      const profile = await invoke<TweakProfile>("capture_profile", { name: name.trim() });
      await invoke("save_profile", { profile });
      pushToast("success", format(s.profiles.savedToast, { name: profile.name }));
      setName("");
      refresh();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Applies a profile's tweaks.
   *
   * The Pro check is done against this app's own tweak list, not against
   * anything in the file — otherwise a shared profile would be a way to hand
   * someone the paid tweaks for free.
   */
  async function applyProfile(profile: TweakProfile) {
    const locked = profile.tweaks.filter((id) => {
      const t = tweaks.find((x) => x.id === id);
      return t?.requires_pro && !isPro;
    });
    if (locked.length > 0 && !isPro) {
      onRequirePro();
      return;
    }

    setBusy(profile.name);
    try {
      const failures = await invoke<string[]>("apply_tweaks", { ids: profile.tweaks });
      failures.forEach((f) =>
        pushToast("error", f.includes("PRO_REQUIRED: ") ? s.toasts.licenseNeedsRefresh : f),
      );
      await onChanged();
      pushToast(
        "success",
        format(s.profiles.appliedToast, { count: profile.tweaks.length - failures.length }),
      );
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusy(null);
    }
  }

  async function exportProfile(profile: TweakProfile) {
    try {
      const path = await saveFileDialog({
        defaultPath: `${profile.name || "pctweaker"}.pctweaker.json`,
        filters: [{ name: "PC Tweaker profile", extensions: ["json"] }],
      });
      if (!path) return;
      await invoke("write_profile_file", { path, profile });
      pushToast("success", s.profiles.exportedToast);
    } catch (e) {
      pushToast("error", String(e));
    }
  }

  async function importProfile() {
    try {
      const picked = await openFolderDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "PC Tweaker profile", extensions: ["json"] }],
      });
      if (typeof picked !== "string") return;
      const loaded = await invoke<LoadedProfile>("read_profile_file", { path: picked });
      // Loaded, never applied: the user sees what's in it and decides.
      setPending(loaded);
      pushToast(
        "success",
        format(s.profiles.importedToast, { count: loaded.profile.tweaks.length }),
      );
      if (loaded.unknown.length > 0) {
        pushToast("error", format(s.profiles.droppedWarning, { count: loaded.unknown.length }));
      }
    } catch (e) {
      pushToast("error", String(e));
    }
  }

  async function removeProfile(profileName: string) {
    try {
      await invoke("delete_profile", { name: profileName });
      refresh();
    } catch (e) {
      pushToast("error", String(e));
    }
  }

  return (
    <div className="workspace-profiles">
      <header className="workspace-panel-header">
        <div>
          <h2>{s.profiles.title}</h2>
          <p>{s.profiles.subtitle}</p>
        </div>
        {!loading && !loadError && (
          <span className="workspace-count">
            {s.profiles.savedHeading}
            <strong>{saved.length}</strong>
          </span>
        )}
      </header>

      <section className="workspace-profile-compose">
        <div className="workspace-compose-heading">
          <label htmlFor={nameId}>{s.profiles.saveHeading}</label>
          <button onClick={importProfile} className="workspace-button workspace-button-secondary">
            <span aria-hidden="true">
              <FolderIcon className="h-4 w-4" />
            </span>
            {s.profiles.importButton}
          </button>
        </div>
        <form
          className="workspace-profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveCurrent();
          }}
        >
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={s.profiles.namePlaceholder}
            maxLength={40}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="workspace-button workspace-button-primary"
          >
            {saving ? "···" : s.profiles.saveButton}
          </button>
        </form>
        <p className="workspace-profile-notice">
          {authed ? s.profiles.reviewNotice : s.profiles.signInRequired}
        </p>
      </section>

      {pending && (
        <section className="workspace-profile-section">
          <h3 className="workspace-section-label">{s.profiles.importButton}</h3>
          <ProfileRow s={s} profile={pending.profile} imported busy={busy} onApply={applyProfile} />
          {pending.unknown.length > 0 && (
            <p className="workspace-import-warning" role="status">
              {format(s.profiles.droppedWarning, { count: pending.unknown.length })}
            </p>
          )}
        </section>
      )}

      <section className="workspace-profile-section" aria-busy={loading}>
        <h3 className="workspace-section-label">{s.profiles.savedHeading}</h3>
        {loadError && (
          <div className="workspace-panel-error" role="alert">
            <p>{loadError}</p>
            <button onClick={refresh} className="workspace-button workspace-button-secondary">
              {s.scheduledTasks.refresh}
            </button>
          </div>
        )}
        {loading && saved.length === 0 ? (
          <div className="workspace-panel-empty" role="status">
            {s.scheduledTasks.refreshing}
          </div>
        ) : saved.length === 0 && !loadError ? (
          <div className="workspace-panel-empty">
            <span className="workspace-empty-symbol" aria-hidden="true">
              <LayersIcon className="h-8 w-8" />
            </span>
            <p>{s.profiles.empty}</p>
          </div>
        ) : saved.length > 0 ? (
          <div className="workspace-profile-list">
            {saved.map((p) => (
              <ProfileRow
                key={p.name}
                s={s}
                profile={p}
                busy={busy}
                onApply={applyProfile}
                onExport={exportProfile}
                onRemove={removeProfile}
              />
            ))}
          </div>
        ) : null}
      </section>
      <LifetimeTools
        s={s}
        lang={lang}
        profiles={saved}
        tweaks={tweaks}
        owned={lifetimeOwned}
        onViewPlans={onViewPlans}
      />
    </div>
  );
}
