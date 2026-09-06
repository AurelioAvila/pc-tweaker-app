import { useState } from "react";
import type { Lang, Strings } from "../i18n";
import { textFor } from "../lib";
import type { TweakInfo, TweakProfile } from "../types";
import { STARTER_PRESETS, presetSelection } from "./starter-presets.mjs";
import { STARTER_COPY } from "./starter-copy";
import "./starter-profiles.css";

export function StarterProfiles({
  s,
  lang,
  tweaks,
  isPro,
  busy,
  onApply,
}: {
  s: Strings;
  lang: Lang;
  tweaks: TweakInfo[];
  isPro: boolean;
  busy: boolean;
  onApply: (profile: TweakProfile) => Promise<void>;
}) {
  const copy = STARTER_COPY[lang];
  const [current, setCurrent] = useState(STARTER_PRESETS[0].id);
  const [selections, setSelections] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      STARTER_PRESETS.map((p) => [p.id, p.tweaks.filter((t) => t.selected).map((t) => t.id)]),
    ),
  );
  const preset = STARTER_PRESETS.find((p) => p.id === current)!;
  const selection = selections[current];
  const { available, missing, pending } = presetSelection(preset, tweaks, selection, isPro);
  const body = { gaming: copy.gamingBody, study: copy.studyBody, work: copy.workBody };
  const note = { gaming: copy.gamingNote, study: copy.studyNote, work: copy.workNote };
  return (
    <section className="starter-profiles" aria-label={copy.heading}>
      <header>
        <h3>{copy.heading}</h3>
        <p>{copy.intro}</p>
      </header>
      <div className="starter-choices" role="group" aria-label={copy.heading}>
        {STARTER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={current === p.id}
            disabled={busy}
            onClick={() => setCurrent(p.id)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              {p.id === "gaming" ? (
                <>
                  <path d="M7 7h10c2 0 3 2 3.5 5l.5 5c.2 2-2 3-3 1l-2-3H8l-2 3c-1 2-3.2 1-3-1l.5-5C4 9 5 7 7 7Z" />
                  <path d="M6 11h4m-2-2v4m7-2h.01M18 12h.01" />
                </>
              ) : p.id === "study" ? (
                <>
                  <path d="M12 6C9 4 6 4 3 5v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15" />
                  <path d="M6 9h3m-3 4h3m6-4h3m-3 4h3" />
                </>
              ) : (
                <>
                  <rect x="3" y="7" width="18" height="14" rx="2" />
                  <path d="M8 7V4h8v3M3 12c6 3 12 3 18 0m-9 1v3" />
                </>
              )}
            </svg>
            <span>
              <strong>{copy[p.id]}</strong>
              <small>{body[p.id]}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="starter-detail">
        <div className="starter-detail-heading">
          <h4>{copy[current]}</h4>
          <span>{copy.free}</span>
        </div>
        <p className="starter-tradeoff">{note[current]}</p>
        <fieldset disabled={busy}>
          <legend className="sr-only">{copy[current]}</legend>
          {available.map((t) => {
            const text = textFor(s.tweaks, t.id, t.name, t.description);
            const optional = !preset.tweaks.find((item) => item.id === t.id)?.selected;
            return (
              <label key={t.id} className="starter-option">
                <input
                  type="checkbox"
                  checked={selection.includes(t.id)}
                  onChange={(e) =>
                    setSelections((prev) => ({
                      ...prev,
                      [current]: e.target.checked
                        ? [...new Set([...prev[current], t.id])]
                        : prev[current].filter((id) => id !== t.id),
                    }))
                  }
                />
                <span>
                  <strong>{text.name}</strong>
                  <small>{text.description}</small>
                </span>
                {(t.applied || optional) && <em>{t.applied ? copy.active : copy.optional}</em>}
              </label>
            );
          })}
        </fieldset>
        {missing.length > 0 && <p role="status">{copy.missing}</p>}
        <footer>
          <p>{copy.notice}</p>
          <button
            className="workspace-button workspace-button-primary"
            disabled={busy || !pending.length || !!missing.length}
            aria-busy={busy}
            onClick={() =>
              void onApply({
                format: 1,
                name: copy[current],
                created_at: "",
                tweaks: pending.map((t) => t.id),
              })
            }
          >
            {busy ? copy.applying : `${copy.apply} (${pending.length})`}
          </button>
        </footer>
        {!pending.length && (
          <p className="starter-complete" role="status">
            {selection.length ? copy.ready : copy.empty}
          </p>
        )}
      </div>
    </section>
  );
}
