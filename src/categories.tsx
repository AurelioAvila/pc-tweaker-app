// Category visual identity: icon + accent classes per tweak category.
// Own module so both App and the section components can use it without an
// import cycle.
import React from "react";
import { Category } from "./types";

/**
 * Per-section colour for the sidebar glyph.
 *
 * The nav used to tint every active icon with the single app accent, which
 * made the twelve sections indistinguishable at a glance — the column read as
 * one grey list with one highlighted row, so the icon carried no information.
 * Giving each section its own hue turns the glyph into a landmark you learn
 * once and then navigate by, instead of re-reading labels every time.
 *
 * Deliberately keyed by section string rather than by `Category`: half of
 * these sections (scan, health, hardware, startup, profiles, ledger, pricing)
 * are screens, not tweak categories, so they have no entry in CATEGORY_STYLE.
 * The five that ARE categories reuse the same hue as their category chip, so
 * a section and its tweaks stay visually connected.
 */
export const NAV_ACCENT: Record<string, string> = {
  scan: "text-cyan-300",
  health: "text-emerald-300",
  hardware: "text-orange-300",
  performance: "text-amber-300",
  gaming: "text-rose-300",
  privacy: "text-teal-300",
  ui: "text-fuchsia-300",
  startup: "text-violet-300",
  manutenzione: "text-sky-300",
  profiles: "text-indigo-300",
  ledger: "text-blue-300",
  pricing: "text-yellow-300",
};

export const CATEGORY_STYLE: Record<
  Category,
  { icon: React.ReactElement; ring: string; chip: string; glyph: string; tint: string }
> = {
  performance: {
    // Plate hue. Kept separate from `glyph` because the module paints
    // itself with this and the icon has to stay legible on top of it.
    tint: "#f59e0b",
    ring: "from-amber-400/30 to-orange-500/10",
    glyph: "text-[#1a1205]",
    chip: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    // Speedometer mid-sweep: performance is measured, not just "zapped".
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 15.5a8 8 0 1 1 16 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M17.4 9.8a8 8 0 0 1 2.6 5.7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path d="M12 15.5 15.6 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="15.5" r="1.7" fill="currentColor" />
        <path
          d="M5.6 11.2l1.2.7M12 7.5v1.4M18.4 11.2l-1.2.7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    ),
  },
  privacy: {
    // Plate hue. Kept separate from `glyph` because the module paints
    // itself with this and the icon has to stay legible on top of it.
    tint: "#10b981",
    ring: "from-emerald-400/30 to-teal-500/10",
    glyph: "text-[#04140d]",
    chip: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    // Shield with a keyhole: protection of what is yours, not just defense.
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 3 5.2 5.8v5.2c0 4.3 2.9 8.2 6.8 9.5 3.9-1.3 6.8-5.2 6.8-9.5V5.8L12 3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <circle cx="12" cy="10.4" r="1.7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 12.1v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  ui: {
    // Plate hue. Kept separate from `glyph` because the module paints
    // itself with this and the icon has to stay legible on top of it.
    tint: "#d946ef",
    ring: "from-fuchsia-400/30 to-purple-500/10",
    glyph: "text-[#180420]",
    chip: "bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30",
    // An app window with its chrome: these tweaks reshape Windows' interface.
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect
          x="3.5"
          y="4.5"
          width="17"
          height="15"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M3.5 9.2h17" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M3.5 7a2.5 2.5 0 0 1 2.5-2.5h12A2.5 2.5 0 0 1 20.5 7v2.2h-17V7Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <circle cx="6.4" cy="6.9" r="0.85" fill="currentColor" />
        <circle cx="9.1" cy="6.9" r="0.85" fill="currentColor" opacity="0.45" />
        <path
          d="M6.5 12.5h6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M6.5 15.7h9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
    ),
  },
  manutenzione: {
    // Plate hue. Kept separate from `glyph` because the module paints
    // itself with this and the icon has to stay legible on top of it.
    tint: "#0ea5e9",
    ring: "from-sky-400/30 to-cyan-500/10",
    glyph: "text-[#04121c]",
    chip: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30",
    // Wrench plus a sparkle: upkeep that leaves the machine cleaner.
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M14.9 6.6a4 4 0 0 0-5.2 5.2l-5.2 5.2a1.9 1.9 0 1 0 2.7 2.7l5.2-5.2a4 4 0 0 0 5.2-5.2l-2.5 2.5-2.7-2.7 2.5-2.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path
          d="M18.6 3.6v3.2M20.2 5.2H17"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  gaming: {
    // Plate hue. Kept separate from `glyph` because the module paints
    // itself with this and the icon has to stay legible on top of it.
    tint: "#f43f5e",
    ring: "from-rose-400/30 to-red-500/10",
    glyph: "text-[#1c0409]",
    chip: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    // A modern pad with real grips, d-pad and face buttons two-toned.
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M7.7 6.8h8.6c2.6 0 4.7 2.1 4.9 4.9l.3 3.6a2.3 2.3 0 0 1-4 1.8l-1.9-2H8.4l-1.9 2a2.3 2.3 0 0 1-4-1.8l.3-3.6c.2-2.8 2.3-4.9 4.9-4.9Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path
          d="M8.6 9.6v3.2M7 11.2h3.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="15.3" cy="10.1" r="0.95" fill="currentColor" />
        <circle cx="17.5" cy="12.1" r="0.95" fill="currentColor" opacity="0.55" />
      </svg>
    ),
  },
};
