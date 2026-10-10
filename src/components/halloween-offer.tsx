import type { ReactNode } from "react";
import { HALLOWEEN_DECOR_LEFT, HALLOWEEN_DECOR_RIGHT } from "../halloween-decor";
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
}) {
  const clock = promoClock(remaining);
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
          <p className="hw-offer-kicker">
            {kicker}
            {badge}
          </p>
          <p className="hw-offer-heading" id={reserved ? undefined : headingId}>
            {heading}
          </p>
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
