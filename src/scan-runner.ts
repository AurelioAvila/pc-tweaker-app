import type { CleanupInfo, TweakAdvice, TweakInfo } from "./types";
type Call = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** Fresh reads only. A failed optional probe remains unknown, never a clean bill of health. */
export async function collectScan(call: Call, progress: (percent: number) => void) {
  const [tweaks, cleanup, ids] = await Promise.all([
    call<TweakInfo[]>("list_tweaks"),
    call<CleanupInfo[]>("list_cleanup_targets"),
    call<string[]>("scan_relevant_ids"),
  ]);
  progress(25);
  const probe = async <T>(command: string, args?: Record<string, unknown>): Promise<T | null> => {
    try {
      return await call<T>(command, args);
    } catch {
      return null;
    } finally {
      progress(100);
    }
  };
  const advice = await probe<TweakAdvice[]>("advise_tweaks", { ids });
  return {
    tweaks,
    cleanup,
    ids,
    advice,
    partial: advice === null,
  };
}

export const LAST_SCAN_KEY = "pc-tweaker-last-scan-v1";
export type LastScan = { at: number; partial: boolean };
export function readLastScan(raw: string | null): LastScan | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value &&
      Number.isFinite(value.at) &&
      value.at > 0 &&
      value.at <= Date.now() &&
      typeof value.partial === "boolean"
      ? { at: value.at, partial: value.partial }
      : null;
  } catch {
    return null;
  }
}
