import { useState, type ReactNode } from "react";
import {
  HALLOWEEN_DECOR_LEFT,
  HALLOWEEN_DECOR_RIGHT,
  HALLOWEEN_MARK_EMBER,
  HALLOWEEN_MARK_INK,
} from "../halloween-decor";
import { promoClock } from "../promo";
import "./halloween-offer.css";

/**
 * The Halloween offer banner with its countdown, shared by the app and the
 * website (and reusable by any React product). It renders what it is given:
 * the caller decides whether an offer exists, from its own server.
 *
 * `reserved` renders an invisible copy of exactly the same size, used while
 * the server has not answered yet, so the plans below never jump.
 */
export function HalloweenOfferBanner({
  kicker,
  heading,
  fine,
  endsIn,
  units,
  remaining,
  badge,
  reserved = false,
  headingId = "halloween-offer-title",
  headingLevel = 2,
}: {
  kicker: string;
  heading: ReactNode;
  fine?: string;
  /** "Ends in", shown above the countdown. */
  endsIn: string;
  /** Labels for days, hours, minutes, seconds. */
  units: [string, string, string, string];
  /** Milliseconds to the real deadline, on the server's clock. */
  remaining: number;
  badge?: ReactNode;
  reserved?: boolean;
  headingId?: string;
  /** 2 in the app; 3 on a page whose plans section is already an h2. */
  headingLevel?: 2 | 3;
}) {
  const clock = promoClock(remaining);
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section
      className={`hw-offer${reserved ? " hw-offer-reserved" : ""}`}
      aria-hidden={reserved || undefined}
      aria-labelledby={reserved ? undefined : headingId}
    >
      <div className="hw-offer-inner">
        <span
          className="hw-offer-decor hw-offer-decor-left"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: HALLOWEEN_DECOR_LEFT }}
        />
        <span
          className="hw-offer-decor hw-offer-decor-right"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: HALLOWEEN_DECOR_RIGHT }}
        />
        <div className="hw-offer-copy">
          <Heading className="hw-offer-kicker" id={reserved ? undefined : headingId}>
            {kicker}
            {badge}
          </Heading>
          <p className="hw-offer-heading">{heading}</p>
          {fine && <p className="hw-offer-fine">{fine}</p>}
        </div>
        <div className="hw-offer-timer">
          <span aria-hidden="true">{endsIn}</span>
          <div
            className="hw-offer-cells"
            role="timer"
            aria-live="off"
            aria-label={`${endsIn} ${clock
              .slice(0, 3)
              .map((value, i) => `${Number(value)} ${units[i]}`)
              .join(", ")}`}
          >
            {clock.map((value, i) => (
              <div key={i} className="hw-offer-cell" aria-hidden="true">
                <strong>{value}</strong>
                <small>{units[i]}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** "12d 04h 08m 33s" style countdown text for the compact strip. */
function stripClock(remaining: number): string {
  const [d, h, m, s] = promoClock(remaining);
  return `${Number(d)}d ${h}h ${m}m ${s}s`;
}

/**
 * Slim full-width strip for the top of a page: ember background, dark text,
 * a pumpkin, the countdown and one button. Dismissible; the choice is kept in
 * localStorage under `storageKey` (include the promo id so a new offer shows
 * again) and the strip works without storage. Fixed 40px tall.
 */
export function HalloweenStrip({
  label,
  shortLabel,
  endsIn,
  units,
  remaining,
  cta,
  href,
  closeLabel,
  storageKey,
}: {
  label: string;
  /** Used on narrow screens. */
  shortLabel: string;
  endsIn: string;
  units: [string, string, string, string];
  remaining: number;
  cta: string;
  href: string;
  closeLabel: string;
  storageKey: string;
}) {
  // Read once, when the strip mounts: the site mounts it only after the offer is known
  // (never during hydration), and a new key comes with a new strip.
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false; // storage blocked (or no browser): the strip simply shows
    }
  });
  if (closed) return null;
  const clock = promoClock(remaining);
  return (
    <div className="hw-strip">
      <div className="hw-strip-inner">
        <span
          className="hw-strip-pumpkin"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: HALLOWEEN_MARK_INK }}
        />
        <strong className="hw-strip-label">
          <span className="hw-strip-full">{label}</span>
          <span className="hw-strip-short">{shortLabel}</span>
        </strong>
        <span
          className="hw-strip-timer"
          role="timer"
          aria-live="off"
          aria-label={`${endsIn} ${clock
            .slice(0, 3)
            .map((value, i) => `${Number(value)} ${units[i]}`)
            .join(", ")}`}
        >
          <span aria-hidden="true">{endsIn} </span>
          <span aria-hidden="true" className="hw-strip-digits">
            {stripClock(remaining)}
          </span>
        </span>
        <a className="hw-strip-cta" href={href}>
          {cta}
        </a>
        <button
          type="button"
          className="hw-strip-close"
          aria-label={closeLabel}
          onClick={() => {
            setClosed(true);
            try {
              localStorage.setItem(storageKey, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Offer card for beside a page headline: ember border and glow, the struck reference price,
 *  the promo price and the real percentage, with a hairline footer for the deadline and link. */
export function HalloweenCard({
  tag,
  plan,
  was,
  now,
  pct,
  note,
  cta,
  href,
}: {
  /** e.g. "HALLOWEEN" */
  tag: string;
  plan: string;
  /** Formatted struck reference price, promo price and "-50%" text. */
  was: string;
  now: string;
  pct: string;
  note: string;
  cta: string;
  href: string;
}) {
  return (
    <aside className="hw-card" aria-label={`${tag} ${pct}`}>
      <span
        className="hw-card-mark"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: HALLOWEEN_MARK_EMBER }}
      />
      <span className="hw-card-tag">{tag}</span>
      <div className="hw-card-row">
        <span className="hw-card-now">{now}</span>
        <s className="hw-card-was">{was}</s>
        <span className="hw-card-pct">{pct}</span>
      </div>
      <span className="hw-card-plan">{plan}</span>
      <div className="hw-card-foot">
        <span className="hw-card-note">{note}</span>
        <a className="hw-card-cta" href={href}>
          {cta}
          <svg viewBox="0 0 14 10" width="14" height="10" aria-hidden="true" focusable="false">
            <path
              d="M1 5h11M8 1l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </aside>
  );
}
