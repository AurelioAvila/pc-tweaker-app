import type { ReactNode } from "react";

// Match stable tweak identifiers, never translated display names.
export function TweakIcon({ id, fallback }: { id: string; fallback: ReactNode }) {
  let drawing: ReactNode;
  if (/kernel|memory|ram/.test(id)) {
    drawing = (
      <>
        <rect x="3" y="7" width="18" height="10" rx="1.5" />
        <path d="M6 17v3m4-3v3m4-3v3m4-3v3M7 10v4m5-4v4m5-4v4" />
      </>
    );
  } else if (/gpu|hags/.test(id)) {
    drawing = (
      <>
        <rect x="3" y="5" width="18" height="13" rx="2" />
        <circle cx="14" cy="11.5" r="3.5" />
        <path d="M6 9h2m-2 4h2m-2 5v3m4-3v3m4-3v3" />
      </>
    );
  } else if (/dvr|recall|record/.test(id)) {
    drawing = (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3M8 10v4m-2-2h4" />
      </>
    );
  } else if (/startup|boot/.test(id)) {
    drawing = (
      <>
        <path d="M12 3v9m-5-7a8 8 0 1 0 10 0M17 3v4h4" />
      </>
    );
  } else if (/timer|delay/.test(id)) {
    drawing = (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M9 2h6m-3 3V2m0 7v4l3 2m3-10 2 2" />
      </>
    );
  } else if (/power|energy|boost|parking|idle/.test(id)) {
    drawing = (
      <>
        <path d="m13 2-8 12h6l-1 8 9-12h-6l1-8Z" />
      </>
    );
  } else if (/cpu|priority|responsiveness|core|processor/.test(id)) {
    drawing = (
      <>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3" />
      </>
    );
  } else if (/network|tcp|nagle|dns/.test(id)) {
    drawing = (
      <>
        <rect x="9" y="3" width="6" height="5" rx="1" />
        <path d="M12 8v5M5 16v-3h14v3" />
        <rect x="2" y="16" width="6" height="5" rx="1" />
        <rect x="16" y="16" width="6" height="5" rx="1" />
      </>
    );
  } else if (/file|folder|extension/.test(id)) {
    drawing = (
      <>
        <path d="M3 7V5a1 1 0 0 1 1-1h5l3 3h8a1 1 0 0 1 1 1v11H3V7Z" />
        <path d="M7 12h10m-10 3h6" />
      </>
    );
  } else if (/location/.test(id)) {
    drawing = (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    );
  } else if (/telemetry|tracking|advertising|tailored|feedback|cortana|privacy/.test(id)) {
    drawing = (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    );
  } else if (/search|bing/.test(id)) {
    drawing = (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    );
  } else if (/dark/.test(id)) {
    drawing = <path d="M20 14A8.5 8.5 0 0 1 10 3 9 9 0 1 0 20 14Z" />;
  } else if (/taskbar|menu|start|fullscreen|visual|animation|transparen/.test(id)) {
    drawing = (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 8h18M3 16h18M7 18h2m3 0h2" />
      </>
    );
  } else if (/frozen|task/.test(id)) {
    drawing = (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M6 13h3l2-5 3 9 2-4h2" />
      </>
    );
  } else {
    return (
      <span className="tweak-symbol-fallback" aria-hidden="true">
        {fallback}
      </span>
    );
  }
  return (
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
      {drawing}
    </svg>
  );
}
