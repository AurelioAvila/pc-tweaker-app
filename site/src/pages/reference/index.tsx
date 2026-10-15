import type { ReactNode } from "react";
import { WINDOWS_DB, dbPath } from "../../reference/windows-db";
import { CATEGORY_KEYS, REFERENCE_JSONLD, REFERENCE_SEO, TWEAKS, categoryPath, ogCards } from "./data";
import { CategoryIndex, DbDetail, DbIndex, FixesIndex, ToolsIndex, TweakDetail, TweakIndex } from "./pages";
import { ProcessChecker, ProfileBuilder, TimerCalculator } from "./tools";

export { REFERENCE_JSONLD, REFERENCE_SEO, ogCards };

type Nav = (to: string) => void;

const PAGES: Record<string, (navigate: Nav) => ReactNode> = {
  "/tweaks": (n) => <TweakIndex navigate={n} />,
  ...Object.fromEntries(CATEGORY_KEYS.map((c) => [categoryPath(c), (n: Nav) => <CategoryIndex c={c} navigate={n} />])),
  ...Object.fromEntries(TWEAKS.map((p) => [p.path, (n: Nav) => <TweakDetail p={p} navigate={n} />])),
  "/database": (n) => <DbIndex navigate={n} />,
  ...Object.fromEntries(WINDOWS_DB.map((e) => [dbPath(e), (n: Nav) => <DbDetail e={e} navigate={n} />])),
  "/fixes": (n) => <FixesIndex navigate={n} />,
  "/tools": (n) => <ToolsIndex navigate={n} />,
  "/tools/process-checker": (n) => <ProcessChecker navigate={n} />,
  "/tools/timer-resolution-calculator": (n) => <TimerCalculator navigate={n} />,
  "/tools/profile-builder": (n) => <ProfileBuilder navigate={n} />,
};

/** The page for a reference route, or null when the path is not one. */
export function referencePage(path: string, navigate: Nav): ReactNode | null {
  return PAGES[path]?.(navigate) ?? null;
}
