import { useState } from "react";
import { postNewsletterSignup, ApiError } from "../api";
import { text } from "../i18n/dictionary";

/**
 * Compact email-capture form for the footer. Kept deliberately small — one
 * input, one button — because the footer renders on every page and this must
 * never compete with the download CTA. The hidden `company` input is the
 * honeypot the backend checks (same convention as the support form).
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState("");

  if (state === "done") {
    return (
      <p className="mt-5 max-w-xs text-[13px] text-[var(--accent)]">{text.newsletter.thanks}</p>
    );
  }

  return (
    <form
      className="mt-5 max-w-xs"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setState("pending");
        try {
          await postNewsletterSignup({ email, source: "site-footer", company });
          setState("done");
        } catch (err) {
          setError(err instanceof ApiError ? err.message : text.newsletter.genericError);
          setState("idle");
        }
      }}
    >
      <p className="mb-2.5 text-[13px] text-[var(--fg-dim)]">{text.newsletter.pitch}</p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={text.newsletter.placeholder}
          aria-label={text.newsletter.placeholder}
          className="w-full rounded-xl border border-white/10 bg-[var(--bg)] px-3.5 py-2.5 text-[13.5px] text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--fg-dim)]/60 focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={state === "pending"}
          className="bg-accent shrink-0 cursor-pointer rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-[var(--bg)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {state === "pending" ? "…" : text.newsletter.button}
        </button>
      </div>
      {/* Honeypot: hidden from people (and from the tab order / screen
          readers), filled only by bots that submit every field they find. */}
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      {error && (
        <p role="alert" className="mt-2 text-[12.5px]" style={{ color: "#ff9b9b" }}>
          {error}
        </p>
      )}
    </form>
  );
}
