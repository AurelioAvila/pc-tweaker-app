import { useEffect, useState } from "react";
import { MICROSOFT_STORE } from "./constants";

const CAMPAIGNS = new Set([
  "pct-instagram-profile", "pct-youtube-profile", "pct-youtube-profiles-01",
  "pct-youtube-file-extensions", "pct-youtube-keep-game-clips", "pct-youtube-work-after-gaming",
]);
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
let entryCampaign: string | undefined;
let entryUtm: Record<string, string> = {};

// Retain only campaign labels from the landing URL, in memory for this page
// session. No cookies, identifiers, storage or analytics scripts. Called once
// from main.tsx, before client-side navigation drops the query string.
export function captureEntry(search: string) {
  if (entryCampaign !== undefined) return;
  const params = new URLSearchParams(search);
  const requested = params.get("cid") || "";
  const source = params.get("utm_source");
  entryCampaign = CAMPAIGNS.has(requested) ? requested
    : source === "ig" || source === "instagram" ? "pct-instagram-profile"
    : source === "youtube" ? "pct-youtube-profile" : "";
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value && /^[A-Za-z0-9_.-]{1,80}$/.test(value)) entryUtm[key] = value;
  }
  if (!entryUtm.utm_source) entryUtm = {};
}

/** The social post that brought this visitor, sent only with a checkout the
 *  visitor starts, so the Stripe session records which post led to it. */
export function campaignLabels(): Record<string, string> {
  return { ...entryUtm };
}

export function useCampaignStoreLink(fallback: string) {
  const [campaign, setCampaign] = useState(fallback);
  useEffect(() => {
    captureEntry(window.location.search);
    setCampaign(entryCampaign || fallback);
  }, [fallback]);
  return `${MICROSOFT_STORE.split("?")[0]}?cid=${encodeURIComponent(campaign)}`;
}
