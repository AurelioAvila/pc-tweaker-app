export type ThemeName =
  | "violet"
  | "teal_depths"
  | "amber_dusk"
  | "crimson_steel"
  | "ocean_blue"
  | "forest_emerald"
  | "royal_gold"
  | "slate_mono"
  | "indigo_night"
  | "coral_sunset"
  | "rose_quartz"
  | "cyber_lime"
  | "copper_forge"
  | "magenta_pulse";

/**
 * `swatch` is the single colour the picker paints for this theme, and it is
 * each theme's own `--app-accent` from App.css — so the dot you click is
 * literally the colour you get.
 *
 * It used to be a *pair* rendered as a hard 50/50 diagonal, which read as a
 * dot someone had sliced in half rather than as a colour choice, and didn't
 * match the solid dots on pctweaker.app.
 *
 * The count is deliberately 14: the picker lays these out 7 per row, so 12
 * left two visibly empty slots dangling under the second row.
 */
export const THEMES: { code: ThemeName; label: string; swatch: string }[] = [
  { code: "violet", label: "Violet", swatch: "#ff5c8a" },
  { code: "teal_depths", label: "Teal Depths", swatch: "#35e0c0" },
  { code: "amber_dusk", label: "Amber Dusk", swatch: "#ffb84d" },
  { code: "crimson_steel", label: "Crimson Steel", swatch: "#ff4d6d" },
  { code: "ocean_blue", label: "Ocean Blue", swatch: "#3d8bff" },
  { code: "forest_emerald", label: "Forest Emerald", swatch: "#2ecc71" },
  { code: "royal_gold", label: "Royal Gold", swatch: "#e8b923" },
  { code: "slate_mono", label: "Slate Mono", swatch: "#9aa5b1" },
  { code: "indigo_night", label: "Indigo Night", swatch: "#6c63ff" },
  { code: "coral_sunset", label: "Coral Sunset", swatch: "#ff7a45" },
  { code: "rose_quartz", label: "Rose Quartz", swatch: "#ffafcb" },
  { code: "cyber_lime", label: "Cyber Lime", swatch: "#b6ff3c" },
  { code: "copper_forge", label: "Copper Forge", swatch: "#d98b4a" },
  { code: "magenta_pulse", label: "Magenta Pulse", swatch: "#ff2fd0" },
];

export function detectInitialTheme(): ThemeName {
  const stored = localStorage.getItem("pc-tweaker-theme");
  return THEMES.some((t) => t.code === stored) ? (stored as ThemeName) : "violet";
}
