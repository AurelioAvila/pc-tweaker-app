import type { ReactNode } from "react";
import { STRINGS, type Lang, type Strings } from "../i18n";
import "./tool-surfaces.css";

/** Presentational structure shared by desktop tools; no native effects. */
export function ToolHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="tool-header">
      {icon && (
        <span className="tool-header-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="tool-header-copy">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="tool-header-actions">{actions}</div>}
    </header>
  );
}

export function ToolDetails({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`tool-details ${className}`}>
      <summary>
        {label}
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="tool-details-content">{children}</div>
    </details>
  );
}

export function ToolStatus({
  children,
  busy = false,
  tone = "neutral",
}: {
  children: ReactNode;
  busy?: boolean;
  tone?: "neutral" | "active" | "error";
}) {
  return (
    <div className="tool-status" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      {busy && <span className="tool-status-spinner" aria-hidden="true" />}
      {tone === "active" && <span className="tool-status-dot" aria-hidden="true" />}
      <span>{children}</span>
    </div>
  );
}

// This label describes a local list filter, unlike the app-wide tweak search.
const LIST_SEARCH: Record<Lang, string> = {
  it: "Cerca in questo elenco",
  en: "Search this list",
  fr: "Rechercher dans cette liste",
  es: "Buscar en esta lista",
  de: "Diese Liste durchsuchen",
  pt: "Pesquisar nesta lista",
};

export function ToolSearch({
  s,
  value,
  onChange,
  count,
  total,
}: {
  s: Strings;
  value: string;
  onChange: (value: string) => void;
  count: number;
  total: number;
}) {
  const language = (Object.keys(STRINGS) as Lang[]).find((key) => STRINGS[key] === s) ?? "en";
  const label = LIST_SEARCH[language];
  return (
    <div className="tool-list-filter">
      <label className="tool-search-field">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
          <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="m12.5 12.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={value}
          aria-label={label}
          placeholder={label}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {value && (
        <button type="button" className="tool-filter-clear" onClick={() => onChange("")}>
          {s.search.clear}
        </button>
      )}
      <span className="tool-list-count" aria-live="polite">
        {count} / {total}
      </span>
    </div>
  );
}
