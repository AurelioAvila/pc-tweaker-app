import type { ReactNode } from "react";

/* ============================================================
   FORM PRIMITIVES
   Shared by the review form and the support form so the two
   never drift apart visually. Every color reads a theme var, so
   these repaint with the rest of the page on a theme switch.
   ============================================================ */

const CONTROL =
  "w-full rounded-xl border border-white/10 bg-[var(--bg)] px-4 py-3 text-[14.5px] text-[var(--fg)] " +
  "outline-none transition-colors placeholder:text-[var(--fg-dim)]/60 focus:border-[var(--accent)]";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="font-mono-t mb-2 block text-[11px] tracking-[0.14em] text-[var(--fg-dim)]">
        {label.toUpperCase()}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[12.5px] text-[var(--fg-dim)]">{hint}</span>}
    </label>
  );
}

/**
 * Same visual treatment as `Field`, but renders a <fieldset> instead of a
 * <label>. Use it for controls that are themselves a group of inputs — a
 * <label> wrapping several radios is invalid HTML, and browsers resolve it by
 * forwarding a click on the group's caption to the *first* radio, so clicking
 * the word "Rating" would silently set a 1-star score.
 */
export function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="block border-0 p-0">
      <legend className="font-mono-t mb-2 block p-0 text-[11px] tracking-[0.14em] text-[var(--fg-dim)]">
        {label.toUpperCase()}
      </legend>
      {children}
      {hint && <span className="mt-1.5 block text-[12.5px] text-[var(--fg-dim)]">{hint}</span>}
    </fieldset>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={CONTROL} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} resize-y leading-relaxed`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // `bg-[var(--bg)]` also applies to the native dropdown list on most
  // platforms, which is why the options below stay readable on a dark page.
  return <select {...props} className={`${CONTROL} cursor-pointer`} />;
}

/** Inline validation / transport error. Never renders an empty box. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border px-4 py-3 text-[13.5px]"
      style={{ borderColor: "#ff4d4d55", background: "#ff4d4d12", color: "#ff9b9b" }}
    >
      {children}
    </p>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent glow-accent-sm cursor-pointer rounded-xl px-7 py-3.5 text-[14.5px] font-bold text-[var(--bg)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Star rating input. Renders real radio inputs underneath so it is
 * keyboard-operable and announced correctly, with the stars as the visual
 * layer — a row of clickable <span>s would be invisible to a screen reader.
 */
export function StarRating({
  value,
  onChange,
  name,
}: {
  value: number;
  onChange: (v: number) => void;
  name: string;
}) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className="cursor-pointer text-[26px] leading-none transition-transform hover:scale-110"
          style={{ color: n <= value ? "var(--accent)" : "var(--line-2)" }}
        >
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            className="sr-only"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          />
          ★
        </label>
      ))}
    </div>
  );
}

/** Read-only star row used in review cards and the aggregate header. */
export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} out of 5`} style={{ fontSize: size, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= Math.round(value) ? "var(--accent)" : "var(--line-2)" }}>
          ★
        </span>
      ))}
    </span>
  );
}
