import type { TweakInfo } from "../types";
export type StarterPreset = {
  id: "gaming" | "study" | "work";
  icon: string;
  tweaks: { id: string; selected: boolean }[];
};
export const STARTER_PRESETS: StarterPreset[];
export function presetSelection(
  preset: StarterPreset,
  tweaks: TweakInfo[],
  selected: string[],
  isPro: boolean,
): { available: TweakInfo[]; missing: string[]; pending: TweakInfo[]; locked: TweakInfo[] };
