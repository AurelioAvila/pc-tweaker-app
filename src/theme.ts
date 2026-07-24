export type ThemeName = "default" | "certsprint";

export const THEMES: { code: ThemeName; label: string }[] = [
  { code: "default", label: "PC Tweaker" },
  { code: "certsprint", label: "CertSprint" },
];

export function detectInitialTheme(): ThemeName {
  const stored = localStorage.getItem("pc-tweaker-theme");
  return stored === "certsprint" ? "certsprint" : "default";
}
