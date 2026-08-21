import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFolderDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { format, Strings } from "../i18n";
import { formatEpochDate } from "../lib";
import { FolderIcon } from "./icons";
import { LoadedProfile, Toast, TweakInfo, TweakProfile } from "../types";

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
    <div
      className={`rounded-xl border p-3 ${
        imported ? "border-amber-400/30 bg-amber-400/[0.06]" : "border-line bg-surface-1"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-ink">{profile.name || "—"}</span>
        <span className="text-xs text-ink-3">
          {format(s.profiles.tweakCount, { count: profile.tweaks.length })}
          {!imported && profile.created_at ? ` · ${formatEpochDate(profile.created_at)}` : ""}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={() => onApply(profile)}
          disabled={busy === profile.name || profile.tweaks.length === 0}
          className="rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy === profile.name ? s.profiles.applying : s.profiles.apply}
        </button>
        {!imported && (
          <>
            <button
              onClick={() => onExport?.(profile)}
              className="rounded-lg border border-line-2 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-2"
            >
              {s.profiles.exportButton}
            </button>
            <button
              onClick={() => onRemove?.(profile.name)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-3 hover:text-red-300"
            >
              {s.profiles.deleteButton}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ProfilesPanel({
  s,
  tweaks,
  isPro,
  authed,
  onRequireAuth,
  onRequirePro,
  onChanged,
  pushToast,
}: {
  s: Strings;
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

  const refresh = useCallback(() => {
    invoke<TweakProfile[]>("list_profiles")
      .then(setSaved)
      .catch(() => setSaved([]));
  }, []);

  useEffect(refresh, [refresh]);

  async function saveCurrent() {
    if (!authed) {
      onRequireAuth();
      return;
    }
    if (!name.trim()) {
      pushToast("error", s.profiles.nameRequired);
      return;
    }
    try {
      const profile = await invoke<TweakProfile>("capture_profile", { name: name.trim() });
      await invoke("save_profile", { profile });
      pushToast("success", format(s.profiles.savedToast, { name: profile.name }));
      setName("");
      refresh();
    } catch (e) {
      pushToast("error", String(e));
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
    <div className="mb-6 flex flex-col gap-5">
      <div className="rounded-2xl border border-line bg-surface-1 p-5">
        <h2 className="text-lg font-semibold text-ink">{s.profiles.title}</h2>
        <p className="mt-1 max-w-lg text-sm text-ink-3">{s.profiles.subtitle}</p>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          {s.profiles.saveHeading}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
            placeholder={s.profiles.namePlaceholder}
            maxLength={40}
            className="min-w-[180px] flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-[var(--app-accent)]"
          />
          <button
            onClick={saveCurrent}
            className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-bold text-white"
          >
            {s.profiles.saveButton}
          </button>
          <button
            onClick={importProfile}
            className="flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2"
          >
            <FolderIcon className="h-4 w-4" />
            {s.profiles.importButton}
          </button>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-3">
          {authed ? s.profiles.reviewNotice : s.profiles.signInRequired}
        </p>
      </div>

      {pending && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            {s.profiles.importButton}
          </p>
          <ProfileRow s={s} profile={pending.profile} imported busy={busy} onApply={applyProfile} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          {s.profiles.savedHeading}
        </p>
        {saved.length === 0 ? (
          <p className="text-sm text-ink-3">{s.profiles.empty}</p>
        ) : (
          saved.map((p) => (
            <ProfileRow
              key={p.name}
              s={s}
              profile={p}
              busy={busy}
              onApply={applyProfile}
              onExport={exportProfile}
              onRemove={removeProfile}
            />
          ))
        )}
      </div>
    </div>
  );
}
