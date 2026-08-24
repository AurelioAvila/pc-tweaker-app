import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ============================================================
   DYNAMIC THEME SYSTEM
   One source of truth: CSS custom properties on <html>.
   Switching a theme repaints every glow, border, surface and
   text-clip on the page without a single component re-render
   below the provider — the DOM reads the vars live.

   A theme is not just an accent: it also carries the dominant
   surface ramp (page + card background) and a type/hairline ramp
   tinted to match it. Components never hardcode a hex, so this
   repaints the whole site without touching a layout value.
   ============================================================ */

export type AccentTheme =
  | "amber"
  | "cyan"
  | "acid"
  | "ruby"
  | "monochrome"
  | "azure"
  | "emerald"
  | "violet"
  | "gold"
  | "copper"
  | "teal"
  | "indigo"
  | "magenta";

interface AccentSpec {
  readonly hex: string;
  readonly glow: string;
  readonly soft: string;
  readonly label: string;
  /** page background — the dominant color of the whole site */
  readonly bg: string;
  /** raised card / panel background, one step above `bg` */
  readonly bg2: string;
  /** primary text */
  readonly fg: string;
  /** supporting text */
  readonly fgDim: string;
  /** default hairline */
  readonly line: string;
  /** emphasized hairline */
  readonly line2: string;
}

export const ACCENTS: Record<AccentTheme, AccentSpec> = {
  amber: {
    hex: "#ff5500",
    glow: "rgba(255,85,0,0.35)",
    soft: "rgba(255,85,0,0.08)",
    label: "AMBER",
    bg: "#050506",
    bg2: "#0a0a0c",
    fg: "#f3f4f6",
    fgDim: "#9ca3af",
    line: "#2a2d33",
    line2: "#3f434b",
  },
  cyan: {
    hex: "#00f0ff",
    glow: "rgba(0,240,255,0.3)",
    soft: "rgba(0,240,255,0.07)",
    label: "CYAN",
    bg: "#070d14",
    bg2: "#0c141d",
    fg: "#eef4f7",
    fgDim: "#93a4b1",
    line: "#22303a",
    line2: "#354754",
  },
  acid: {
    hex: "#d4ff00",
    glow: "rgba(212,255,0,0.3)",
    soft: "rgba(212,255,0,0.07)",
    label: "ACID",
    bg: "#0a0c05",
    bg2: "#10130a",
    fg: "#f2f5ea",
    fgDim: "#9ea795",
    line: "#2b301f",
    line2: "#3f462f",
  },
  ruby: {
    hex: "#ff0055",
    glow: "rgba(255,0,85,0.32)",
    soft: "rgba(255,0,85,0.08)",
    label: "RUBY",
    bg: "#0e0709",
    bg2: "#150c10",
    fg: "#f7eff1",
    fgDim: "#ab979d",
    line: "#33242a",
    line2: "#4a353c",
  },
  monochrome: {
    hex: "#ffffff",
    glow: "rgba(255,255,255,0.25)",
    soft: "rgba(255,255,255,0.06)",
    label: "MONO",
    bg: "#060606",
    bg2: "#0c0c0c",
    fg: "#f4f4f4",
    fgDim: "#a1a1a1",
    line: "#2c2c2c",
    line2: "#424242",
  },
  azure: {
    hex: "#3b82f6",
    glow: "rgba(59,130,246,0.32)",
    soft: "rgba(59,130,246,0.08)",
    label: "AZURE",
    bg: "#0a1120",
    bg2: "#101a2d",
    fg: "#eff3fb",
    fgDim: "#94a2bb",
    line: "#232e44",
    line2: "#36445f",
  },
  emerald: {
    hex: "#10e08a",
    glow: "rgba(16,224,138,0.3)",
    soft: "rgba(16,224,138,0.07)",
    label: "EMERALD",
    bg: "#071310",
    bg2: "#0c1c17",
    fg: "#eef7f2",
    fgDim: "#93aaa0",
    line: "#20332b",
    line2: "#32493e",
  },
  violet: {
    hex: "#a855f7",
    glow: "rgba(168,85,247,0.32)",
    soft: "rgba(168,85,247,0.08)",
    label: "VIOLET",
    bg: "#12081b",
    bg2: "#1a0f26",
    fg: "#f3eff9",
    fgDim: "#a297b5",
    line: "#2e2440",
    line2: "#443558",
  },
  gold: {
    hex: "#f0b429",
    glow: "rgba(240,180,41,0.3)",
    soft: "rgba(240,180,41,0.07)",
    label: "GOLD",
    bg: "#14110c",
    bg2: "#1d1913",
    fg: "#f7f3ea",
    fgDim: "#a89e8b",
    line: "#332c1f",
    line2: "#4a412e",
  },
  copper: {
    hex: "#d98b4a",
    glow: "rgba(217,139,74,0.3)",
    soft: "rgba(217,139,74,0.07)",
    label: "COPPER",
    bg: "#17100a",
    bg2: "#211810",
    fg: "#f7f1e9",
    fgDim: "#ab9c8b",
    line: "#382b1f",
    line2: "#4f3e2e",
  },
  teal: {
    hex: "#14c8c4",
    glow: "rgba(20,200,196,0.3)",
    soft: "rgba(20,200,196,0.07)",
    label: "TEAL",
    bg: "#071516",
    bg2: "#0c1f21",
    fg: "#eaf6f6",
    fgDim: "#8fa9aa",
    line: "#1e3536",
    line2: "#2e4b4d",
  },
  indigo: {
    hex: "#6366f1",
    glow: "rgba(99,102,241,0.32)",
    soft: "rgba(99,102,241,0.08)",
    label: "INDIGO",
    bg: "#0c0d20",
    bg2: "#14162e",
    fg: "#eff0fb",
    fgDim: "#9a9cbb",
    line: "#282b47",
    line2: "#3b3f63",
  },
  magenta: {
    hex: "#ff2fd0",
    glow: "rgba(255,47,208,0.3)",
    soft: "rgba(255,47,208,0.07)",
    label: "MAGENTA",
    bg: "#1a0817",
    bg2: "#241020",
    fg: "#f9edf6",
    fgDim: "#b294ab",
    line: "#3b2135",
    line2: "#54324b",
  },
};

/** Display order for the picker — walks the colour wheel warm to cool, so
 *  neighbouring dots read as a gradient rather than a random assortment. */
export const THEME_ORDER: readonly AccentTheme[] = [
  "amber",
  "copper",
  "gold",
  "acid",
  "emerald",
  "teal",
  "cyan",
  "azure",
  "indigo",
  "violet",
  "magenta",
  "ruby",
  "monochrome",
];

const STORAGE_KEY = "pct-theme";

function storedTheme(): AccentTheme {
  if (typeof window === "undefined") return "amber";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in ACCENTS) return saved as AccentTheme;
  } catch {
    // Private-browsing modes throw on localStorage access. A theme
    // preference is not worth crashing the page over — fall back to default.
  }
  return "amber";
}

interface ThemeContextValue {
  readonly theme: AccentTheme;
  readonly setTheme: (t: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Server and browser must start from the same value for deterministic
  // hydration. The saved preference is restored in a layout effect before
  // the browser paints, so returning visitors keep their theme without a
  // hydration mismatch or a visible flash.
  const [theme, setThemeState] = useState<AccentTheme>("amber");

  const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
  useIsomorphicLayoutEffect(() => {
    setThemeState(storedTheme());
  }, []);

  const setTheme = useCallback((t: AccentTheme) => setThemeState(t), []);

  useEffect(() => {
    const spec = ACCENTS[theme];
    const root = document.documentElement;
    root.style.setProperty("--accent", spec.hex);
    root.style.setProperty("--accent-glow", spec.glow);
    root.style.setProperty("--accent-soft", spec.soft);
    root.style.setProperty("--bg", spec.bg);
    root.style.setProperty("--bg-2", spec.bg2);
    root.style.setProperty("--fg", spec.fg);
    root.style.setProperty("--fg-dim", spec.fgDim);
    root.style.setProperty("--line", spec.line);
    root.style.setProperty("--line-2", spec.line2);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // See storedTheme() — a failed write just means the choice won't persist.
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
