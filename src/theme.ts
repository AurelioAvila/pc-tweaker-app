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
  | "coral_sunset";

export const THEMES: { code: ThemeName; label: string; swatch: [string, string] }[] = [
  { code: "violet", label: "Violet", swatch: ["#FF5C8A", "#35E0C0"] },
  { code: "teal_depths", label: "Teal Depths", swatch: ["#35E0C0", "#FF5C8A"] },
  { code: "amber_dusk", label: "Amber Dusk", swatch: ["#FFB84D", "#5BD1FF"] },
  { code: "crimson_steel", label: "Crimson Steel", swatch: ["#FF4D6D", "#4CE0B3"] },
  { code: "ocean_blue", label: "Ocean Blue", swatch: ["#3D8BFF", "#FFB74D"] },
  { code: "forest_emerald", label: "Forest Emerald", swatch: ["#2ECC71", "#FF6F91"] },
  { code: "royal_gold", label: "Royal Gold", swatch: ["#E8B923", "#6F5BFF"] },
  { code: "slate_mono", label: "Slate Mono", swatch: ["#9AA5B1", "#6EE7B7"] },
  { code: "indigo_night", label: "Indigo Night", swatch: ["#6C63FF", "#FFC155"] },
  { code: "coral_sunset", label: "Coral Sunset", swatch: ["#FF7A45", "#4DD9E8"] },
];

export function detectInitialTheme(): ThemeName {
  const stored = localStorage.getItem("pc-tweaker-theme");
  return THEMES.some((t) => t.code === stored) ? (stored as ThemeName) : "violet";
}
