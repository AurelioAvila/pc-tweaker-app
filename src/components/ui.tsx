import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { check as checkForUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { format, Lang, Strings } from "../i18n";
import { money, PRICE_ANNUAL, PRICE_LIFETIME, PRICE_MONTHLY } from "../lib";
import { Toast } from "../types";
import { CrownIcon } from "./icons";

/**
 * The app's only badge. Pro, Admin, registry hive, requirements, Soon and
 * status verdicts all share one shape, size and position, so a tag means the
 * same thing wherever it appears; the look lives in `.badge` (App.css).
 * `className` is for layout only (e.g. hiding it on narrow windows).
 */
export type BadgeKind =
  "pro" | "admin" | "info" | "neutral" | "muted" | "accent" | "ok" | "warn" | "caution" | "danger";

export function Badge({
  kind = "neutral",
  children,
  title,
  className,
}: {
  kind?: BadgeKind;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span className={className ? `badge ${className}` : "badge"} data-kind={kind} title={title}>
      {kind === "pro" && <BadgeIcon d={STAR} fill />}
      {kind === "admin" && <BadgeIcon d={SHIELD} />}
      {children}
    </span>
  );
}

const STAR = "m12 2 2.7 6.6L21 9l-5 4.5L17.3 21 12 17.3 6.7 21 8 13.5 3 9l6.3-.4Z";
const SHIELD = "M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z";

function BadgeIcon({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill={fill ? "currentColor" : "none"}>
      {!fill && <path d={d} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />}
      {fill && <path d={d} />}
    </svg>
  );
}

/**
 * Sized and labeled like the switch in Windows 11's own Settings app (a
 * pill roughly 36×20px with an "On"/"Off" caption to its right) rather than
 * the oversized iOS-style control this used to be — the previous h-8 w-14
 * (32×56px) knob was noticeably larger than any toggle in Windows itself or
 * in the apps it's meant to sit alongside.
 */
// Keep a fast operation legible without delaying its native execution.
// This timer controls presentation only, never success or progress.
export function useBusyPresentation(busy: boolean) {
  const [visible, setVisible] = useState(false);
  const started = useRef(0);
  useEffect(() => {
    if (busy) started.current = performance.now();
    const timer = window.setTimeout(
      () => setVisible(busy),
      busy ? 0 : Math.max(0, 500 - (performance.now() - started.current)),
    );
    return () => window.clearTimeout(timer);
  }, [busy]);
  return busy || visible;
}

export function Toggle({
  checked,
  busy,
  onClick,
  s,
  label,
  busyLabel,
  disabled = false,
}: {
  label?: string;
  busyLabel?: string;
  disabled?: boolean;
  checked: boolean;
  busy: boolean;
  onClick: () => void;
  s: Strings;
}) {
  const [feedback, setFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);
  const presenting = useBusyPresentation(busy) || feedback;
  return (
    <button
      type="button"
      disabled={presenting || disabled}
      onClick={() => {
        // A click is visible even when the parent operation settles within one render.
        setFeedback(true);
        feedbackTimer.current = setTimeout(() => setFeedback(false), 550);
        onClick();
      }}
      aria-pressed={checked}
      aria-busy={presenting}
      aria-label={label}
      className="tweak-toggle group flex shrink-0 items-center gap-2 rounded-md disabled:cursor-wait"
    >
      <span
        className={`max-w-24 text-right text-xs font-medium tabular-nums transition-colors ${
          checked ? "text-accent" : "text-ink-3"
        }`}
      >
        {presenting ? (busyLabel ?? s.profiles.applying) : checked ? s.toggle.on : s.toggle.off}
      </span>
      <span
        className={`switch relative inline-flex h-5 w-9 items-center rounded-full
          ${checked ? "switch-on" : "switch-off"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full shadow transition-all duration-200 ease-out
            ${checked ? "translate-x-4 bg-white" : "translate-x-0 bg-[#9aa1b0]"}`}
        >
          {presenting && (
            <svg
              aria-hidden="true"
              className="h-2.5 w-2.5 animate-spin text-zinc-800"
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
  lang,
  featureName,
  onClose,
  onNotify,
}: {
  s: Strings;
  lang: Lang;
  featureName: string;
  onClose: () => void;
  onNotify: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="pro-feature-dialog"
      aria-labelledby="pro-feature-title"
      aria-describedby="pro-feature-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className="pro-feature-header">
        <span className="pro-feature-brand">
          <CrownIcon className="h-4 w-4" /> PC Tweaker Pro
        </span>
        <button className="pro-feature-close" onClick={onClose} aria-label={s.paywall.notNow}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m6 6 12 12M6 18 18 6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <div className="pro-feature-content">
        <span className="pro-feature-eyebrow">{s.paywall.title}</span>
        <h2 id="pro-feature-title">{featureName}</h2>
        <p id="pro-feature-description">{format(s.paywall.body, { feature: featureName })}</p>
        {/* Lifetime leads because it is what people actually buy; the
            subscriptions follow so nobody has to open the plans to learn
            the price of the thing they just tried to use. */}
        <p className="pro-feature-price">
          {format(s.paywall.priceLine, {
            lifetime: money(PRICE_LIFETIME, lang),
            annual: money(PRICE_ANNUAL, lang),
            monthly: money(PRICE_MONTHLY, lang),
          })}
        </p>
      </div>
      <footer className="pro-feature-actions">
        <button onClick={onNotify} className="tool-primary-action">
          {s.paywall.unlock}
          <span aria-hidden="true">→</span>
        </button>
        <button onClick={onClose} className="tool-secondary-action">
          {s.paywall.notNow}
        </button>
      </footer>
    </dialog>
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
  photo = null,
  size = "md",
}: {
  email: string;
  isPro: boolean;
  /** Device-local photo (data URL). Replaces the glyph, keeps rim + badge. */
  photo?: string | null;
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
      {/* Halo under the rim. It sits outside the avatar's box, so it grows on
          hover without moving anything in the layout. */}
      <span
        aria-hidden
        className="avatar-halo"
        style={
          {
            "--halo-color": isPro ? "rgb(245 158 11 / 0.75)" : `hsl(${hue} 85% 60% / 0.7)`,
          } as React.CSSProperties
        }
      />
      <span
        aria-hidden
        className="avatar-ring absolute inset-0 rounded-full"
        style={{
          background: isPro
            ? "conic-gradient(from 200deg, #fde68a, #f59e0b, #fbbf24, #fde68a)"
            : `conic-gradient(from 200deg, hsl(${hue} 80% 62%), hsl(${(hue + 60) % 360} 80% 55%), hsl(${hue} 80% 62%))`,
        }}
      />
      {/* Inner disc knocks a hole in the ring so the gradient reads as a rim
          rather than as a bright blob with a letter stamped on it. */}
      <span className="absolute inset-[2px] rounded-full bg-slate-900" />
      {photo ? (
        <img
          src={photo}
          alt=""
          // `inset-[2px]` alone leaves width/height at their default (auto),
          // and a replaced element with auto sizing falls back to its own
          // intrinsic dimensions rather than stretching to the inset box —
          // which is what made the 128px source photo render off-center
          // inside a 36-44px frame instead of filling it. `h-full w-full`
          // forces the box the insets were meant to describe.
          className="absolute inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)] rounded-full object-cover"
          draggable={false}
        />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className={`relative ${glyph} text-ink-2`}>
          <circle cx="12" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M4.8 20c1.3-3.5 4.1-5.3 7.2-5.3s5.9 1.8 7.2 5.3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
      {/* Pro already has a crown; stacking a second mark on the same corner
          would say the same thing twice. A signed-in Free account gets the
          micro-LED instead, so every state carries one status mark. */}
      {isPro ? (
        <span
          className={`absolute -bottom-0.5 -right-0.5 grid ${badge} place-items-center rounded-full bg-slate-900 ring-1 ring-amber-400/50`}
        >
          <CrownIcon className={`${crown} text-amber-300`} />
        </span>
      ) : (
        <span
          aria-hidden
          className="icon-led !right-0 !top-0"
          style={{ "--led-color": "var(--accent)" } as React.CSSProperties}
        />
      )}
    </span>
  );
}

/**
 * Checks GitHub (outside the Microsoft Store build, which the Store updates)
 * at startup and after reopening from the tray for a newer signed build and, when one
 * exists, offers it in a small card next to the toasts. A failed check
 * surfaces as the same brief, auto-dismissing toast used for every other
 * background error — never a blocking popup — so a broken updater is
 * visible instead of vanishing, and the failure has a chance to reach the
 * opt-in error reports (which only ever send what the user has already
 * seen). Installation goes through the updater plugin's signature
 * verification — a manifest pointing at an unsigned or tampered binary is
 * rejected before anything runs.
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
  const installing = useRef(false);

  useEffect(() => {
    let alive = true;
    let checking = false;
    let reopenOffer = false;
    const check = (reopened = false) => {
      if (!alive || installing.current) return;
      reopenOffer ||= reopened;
      if (checking) return;
      checking = true;
      void invoke<boolean>("is_store_install")
        .catch(() => false)
        .then((store) => (store ? null : checkForUpdate()))
        .then((u) => {
          if (alive && u) {
            setUpdate(u);
            if (reopenOffer) setDismissed(false);
          }
        })
        .catch((err) => {
          if (alive) onToast("error", format(s.updater.checkFailed, { message: String(err) }));
        })
        .finally(() => {
          checking = false;
          reopenOffer = false;
        });
    };
    check();
    const unlisten = listen("app-reopened", () => check(true));
    void unlisten.catch(() => {});
    return () => {
      alive = false;
      void unlisten.then((stop) => stop()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!update || dismissed) return null;

  async function install() {
    if (!update || installing.current) return;
    installing.current = true;
    try {
      setPercent(0);
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
      installing.current = false;
      setPhase("offer");
      onToast("error", format(s.updater.error, { message: String(err) }));
    }
  }

  return (
    <div className="animate-toast pointer-events-auto fixed bottom-6 left-6 z-40 w-80 rounded-2xl border border-line bg-raised p-4 shadow-2xl backdrop-blur">
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
          <p className="text-sm font-semibold text-ink">
            {format(s.updater.title, { version: update.version })}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">{s.updater.body}</p>
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
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-hover"
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
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
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
