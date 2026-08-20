import { useEffect, useMemo, useState } from "react";
import { check as checkForUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { format, Strings } from "../i18n";
import { Toast } from "../types";
import { CrownIcon } from "./icons";

export function ShieldBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-400/30">
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
        <path
          d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}

export function ProBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-2 py-0.5 text-[11px] font-bold text-amber-950">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
        <path d="m12 2 2.7 6.6L21 9l-5 4.5L17.3 21 12 17.3 6.7 21 8 13.5 3 9l6.3-.4Z" />
      </svg>
      {label}
    </span>
  );
}

export function SoonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-300 ring-1 ring-white/20">
      {label}
    </span>
  );
}

/**
 * Sized and labeled like the switch in Windows 11's own Settings app (a
 * pill roughly 36×20px with an "On"/"Off" caption to its right) rather than
 * the oversized iOS-style control this used to be — the previous h-8 w-14
 * (32×56px) knob was noticeably larger than any toggle in Windows itself or
 * in the apps it's meant to sit alongside.
 */
export function Toggle({
  checked,
  busy,
  onClick,
  s,
}: {
  checked: boolean;
  busy: boolean;
  onClick: () => void;
  s: Strings;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-pressed={checked}
      className="group flex shrink-0 items-center gap-2 outline-none disabled:cursor-wait"
    >
      <span
        className={`text-xs font-semibold tabular-nums transition-colors ${
          checked ? "text-emerald-400" : "text-slate-500"
        }`}
      >
        {checked ? s.toggle.on : s.toggle.off}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-out
          ${checked ? "bg-emerald-500" : "bg-white/15 group-hover:bg-white/25"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-white shadow transition-transform duration-200 ease-out
            ${checked ? "translate-x-4" : "translate-x-0"}`}
        >
          {busy && (
            <svg
              className="h-2.5 w-2.5 animate-spin text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="3"
                className="opacity-25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}

export function PaywallModal({
  s,
  featureName,
  onClose,
  onNotify,
}: {
  s: Strings;
  featureName: string;
  onClose: () => void;
  onNotify: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="animate-card w-full max-w-sm rounded-2xl border border-amber-400/20 bg-slate-900 p-6 shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 shadow-lg shadow-amber-500/30">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
            <path d="m12 2 2.7 6.6L21 9l-5 4.5L17.3 21 12 17.3 6.7 21 8 13.5 3 9l6.3-.4Z" />
          </svg>
        </div>
        <h3 className="text-center text-lg font-bold text-slate-100">{s.paywall.title}</h3>
        <p className="mt-2 text-center text-sm text-slate-400">
          {format(s.paywall.body, { feature: featureName })}
        </p>
        <button
          onClick={onNotify}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 py-2.5 text-sm font-bold text-amber-950 transition-transform hover:scale-[1.02]"
        >
          {s.paywall.unlock}
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          {s.paywall.notNow}
        </button>
      </div>
    </div>
  );
}

/**
 * The signed-in user's avatar.
 *
 * The first character of the email address used to be the whole design, which
 * produced a giant "C" for canadesino91@gmail.com — a letter that means
 * nothing to the person looking at it. Instead this draws a person glyph
 * inside a ring tinted from the address itself, so two different accounts are
 * still visually distinct without pretending a mailbox prefix is a name.
 *
 * Pro accounts get the gold treatment used everywhere else in the app, so the
 * thing you paid for is visible the moment the menu opens.
 */
export function Avatar({
  email,
  isPro,
  size = "md",
}: {
  email: string;
  isPro: boolean;
  /** `sm` is the header trigger, `md` the one inside the menu. A real size
   *  rather than a CSS scale: `scale-*` is a transform, so a scaled 44px
   *  avatar still occupies 44px of layout and spilled out of the 36px button
   *  it was sitting in — which is what made the trigger look like two
   *  overlapping circles. */
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const glyph = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const badge = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  const crown = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  // Stable hue per address: same account, same colour, every launch.
  const hue = useMemo(() => {
    let acc = 0;
    for (const ch of email.trim().toLowerCase()) acc = (acc * 31 + ch.charCodeAt(0)) % 360;
    return acc;
  }, [email]);

  return (
    <span className={`relative grid ${box} shrink-0 place-items-center`}>
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: isPro
            ? "conic-gradient(from 200deg, #fde68a, #f59e0b, #fbbf24, #fde68a)"
            : `conic-gradient(from 200deg, hsl(${hue} 80% 62%), hsl(${(hue + 60) % 360} 80% 55%), hsl(${hue} 80% 62%))`,
        }}
      />
      {/* Inner disc knocks a hole in the ring so the gradient reads as a rim
          rather than as a bright blob with a letter stamped on it. */}
      <span className="absolute inset-[2px] rounded-full bg-slate-900" />
      <svg viewBox="0 0 24 24" fill="none" className={`relative ${glyph} text-slate-300`}>
        <circle cx="12" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M4.8 20c1.3-3.5 4.1-5.3 7.2-5.3s5.9 1.8 7.2 5.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      {isPro && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 grid ${badge} place-items-center rounded-full bg-slate-900 ring-1 ring-amber-400/50`}
        >
          <CrownIcon className={`${crown} text-amber-300`} />
        </span>
      )}
    </span>
  );
}

/**
 * Checks GitHub once at startup for a newer signed build and, when one
 * exists, offers it in a small card next to the toasts. The check is silent
 * on failure on purpose: dev builds have no update endpoint and an offline
 * start is not something the user can act on, so neither is worth a toast.
 * Installation goes through the updater plugin's signature verification —
 * a manifest pointing at an unsigned or tampered binary is rejected before
 * anything runs.
 */
export function UpdateBanner({
  s,
  onToast,
}: {
  s: Strings;
  onToast: (kind: Toast["kind"], message: string) => void;
}) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<"offer" | "downloading" | "installing">("offer");
  const [percent, setPercent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    checkForUpdate()
      .then((u) => {
        if (alive && u) setUpdate(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!update || dismissed) return null;

  async function install() {
    if (!update) return;
    try {
      setPhase("downloading");
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total > 0) setPercent(Math.min(100, Math.round((received / total) * 100)));
        } else if (event.event === "Finished") {
          setPhase("installing");
        }
      });
      await relaunch();
    } catch (err) {
      setPhase("offer");
      onToast("error", format(s.updater.error, { message: String(err) }));
    }
  }

  return (
    <div className="animate-toast pointer-events-auto fixed bottom-6 left-6 z-40 w-80 rounded-2xl border border-white/10 bg-[#14121f]/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
          <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5">
            <path
              d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            {format(s.updater.title, { version: update.version })}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.updater.body}</p>
        </div>
      </div>
      {phase === "offer" ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={install}
            className="flex-1 rounded-lg bg-emerald-400/90 px-3 py-1.5 text-xs font-bold text-emerald-950 transition-colors hover:bg-emerald-300"
          >
            {s.updater.install}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
          >
            {s.updater.later}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs font-semibold text-emerald-300">
            {phase === "downloading"
              ? format(s.updater.downloading, { percent })
              : s.updater.installing}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: phase === "installing" ? "100%" : `${percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
