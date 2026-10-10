import { Component, type ErrorInfo, type ReactNode } from "react";
import type { Strings } from "../i18n";

/**
 * Keeps one page's failure inside that page. Without it, an exception while
 * rendering any panel took the whole window down to a blank screen; now the
 * sidebar and every other page keep working, and this page offers to reload
 * itself. Moving to another page (a new `resetKey`) also clears the error.
 */
export class PageBoundary extends Component<
  {
    s: Strings;
    resetKey: string;
    /** "app" when nothing else is left on screen: different words, and the
     *  fallback can drag the frameless window. */
    scope?: "page" | "app";
    children: ReactNode;
  },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page failed to render", error, info.componentStack);
  }

  componentDidUpdate(previous: { resetKey: string }) {
    if (this.state.error && previous.resetKey !== this.props.resetKey)
      this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const t = this.props.s.pageError;
    const app = this.props.scope === "app";
    return (
      <section
        className="page-error tool-panel"
        role="alert"
        data-scope={app ? "app" : "page"}
        data-tauri-drag-region={app || undefined}
      >
        <span className="page-error-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2>{app ? t.appTitle : t.title}</h2>
        <p>{app ? t.appBody : t.body}</p>
        <div className="page-error-actions">
          {!app && (
            <button
              type="button"
              className="tool-primary-action"
              onClick={() => this.setState({ error: null })}
            >
              {t.reload}
            </button>
          )}
          <button
            type="button"
            className={app ? "tool-primary-action" : "tool-secondary-action"}
            onClick={() => window.location.reload()}
          >
            {t.reloadApp}
          </button>
        </div>
        <details>
          <summary>{t.details}</summary>
          <code>{error.message}</code>
        </details>
      </section>
    );
  }
}
