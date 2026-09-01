import { useState } from "react";
import cupImage from "../assets/coffee-cup.webp";
import { buyCoffee } from "../api";
import { text } from "../i18n/dictionary";

/** Matches TIP_MAX_QUANTITY on the backend, which clamps to it regardless —
 *  this copy only keeps the stepper from offering a number that gets clamped. */
const MAX_COFFEES = 10;

/**
 * The tip card. Deliberately the last thing on the page, after the FAQ: it is
 * the one band that asks for money without offering a product, so it earns its
 * size by being where the reading has already finished rather than by
 * competing with the download CTA further up.
 *
 * `id="tip"` is the landing target for GitHub's Sponsor button, wired in
 * .github/FUNDING.yml — which is why this is the one section on the page that
 * does NOT reveal on scroll like the others. Arriving straight at the anchor
 * raced framer's viewport observer and showed an empty card frame, so someone
 * following the Sponsor link saw a blank box. A scroll-reveal is not worth
 * that on the section the whole repo points at.
 */
export function CoffeeSection() {
  const [count, setCount] = useState(1);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  return (
    <section
      id="tip"
      // The nav is fixed, so without this the anchor would drop the card's own
      // heading behind it.
      className="scroll-mt-24 border-t border-white/5 px-5 py-24 md:px-12"
    >
      <div className="mx-auto max-w-6xl">
        {/* The gradient hairline is the card's whole decoration: it reproduces
            the template's orange-to-violet rim without a second background
            layer to keep in sync with the 13 accent themes. */}
        <div className="rounded-[26px] bg-gradient-to-br from-[var(--accent)]/45 via-white/5 to-[#a855f7]/40 p-px">
          <div className="grid items-center gap-8 rounded-[25px] bg-[var(--bg-2)] p-7 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-12 md:p-10">
            <div className="flex justify-center">
              {/* Framed, as in the source artwork: the render's dark plate is
                  part of the art, so it gets a panel of its own rather than
                  being keyed out — keying left a halo where the plate meets
                  the cup's own reflection. */}
              <img
                src={cupImage}
                alt=""
                // Decorative: every word it could convey is in the heading
                // beside it, so announcing it would just repeat that.
                aria-hidden="true"
                width={440}
                height={509}
                loading="lazy"
                decoding="async"
                className="w-[210px] max-w-full rounded-[18px] border border-white/8 md:w-[280px]"
              />
            </div>

            <div>
              <p
                className="font-mono-t text-accent text-[11.5px] tracking-[0.18em] uppercase"
              >
                {text.coffee.eyebrow}
              </p>
              <h2
                className="mt-4 text-[clamp(1.6rem,3.4vw,2.5rem)] leading-[1.1] font-extrabold tracking-tight"
              >
                {text.coffee.headline}
              </h2>
              <p
                className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-[var(--fg-dim)]"
              >
                {text.coffee.body}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1">
                  <StepperButton
                    label={text.coffee.fewer}
                    disabled={count <= 1}
                    onClick={() => setCount((n) => Math.max(1, n - 1))}
                  >
                    −
                  </StepperButton>
                  {/* aria-live, or the buttons announce on each press but the
                      number they changed never does. */}
                  <span
                    aria-live="polite"
                    className="font-mono-t min-w-[62px] text-center text-[14px] font-bold"
                  >
                    {count} ☕
                  </span>
                  <StepperButton
                    label={text.coffee.more}
                    disabled={count >= MAX_COFFEES}
                    onClick={() => setCount((n) => Math.min(MAX_COFFEES, n + 1))}
                  >
                    +
                  </StepperButton>
                </div>

                <button
                  type="button"
                  disabled={state === "pending"}
                  onClick={() => {
                    setState("pending");
                    buyCoffee(count)
                      .then(({ url }) => {
                        window.location.href = url;
                      })
                      .catch(() => setState("error"));
                  }}
                  className="bg-accent glow-accent-sm grow cursor-pointer rounded-xl px-7 py-3 text-[14px] font-bold text-[var(--bg)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60 sm:grow-0"
                >
                  {state === "pending" ? "…" : text.coffee.cta}
                </button>
              </div>

              <p
                role={state === "error" ? "alert" : undefined}
                className="mt-4 text-[12.5px] text-[var(--fg-dim)]"
                style={state === "error" ? { color: "#ff9b9b" } : undefined}
              >
                {state === "error" ? text.coffee.unavailable : text.coffee.caption}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-9 w-9 shrink-0 cursor-pointer rounded-lg text-[16px] leading-none text-[var(--fg-dim)] transition-colors hover:bg-white/5 hover:text-[var(--fg)] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
