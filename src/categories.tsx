// Category visual identity: icon + accent classes per tweak category.
// Own module so both App and the section components can use it without an
// import cycle.
import React from "react";
import { Category } from "./types";

export const CATEGORY_STYLE: Record<
  Category,
  { icon: React.ReactElement; ring: string; chip: string }
> = {
  performance: {
    ring: "from-amber-400/30 to-orange-500/10",
    chip: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  privacy: {
    ring: "from-emerald-400/30 to-teal-500/10",
    chip: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  ui: {
    ring: "from-fuchsia-400/30 to-purple-500/10",
    chip: "bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 21a9 9 0 1 1 0-18c4 0 8 2.5 8 6.5 0 2-1.5 3.5-3.5 3.5H15a1.7 1.7 0 0 0-1 3.1c.4.3.6.7.6 1.2 0 1-1 2-2.6 2.7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
        <circle cx="11" cy="7" r="1" fill="currentColor" />
        <circle cx="15.5" cy="9" r="1" fill="currentColor" />
      </svg>
    ),
  },
  manutenzione: {
    ring: "from-sky-400/30 to-cyan-500/10",
    chip: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  gaming: {
    ring: "from-rose-400/30 to-red-500/10",
    chip: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M6 8h4m-2-2v4M15.5 10h.01M18 12h.01M8 16h8a4 4 0 0 0 4-4v0a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v0a4 4 0 0 0 4 4Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
};
