import { useEffect, useState } from "react";
import { MICROSOFT_STORE } from "./constants";
import { pageEntryLabels } from "./entry-attribution";

const FACEBOOK_POST_CAMPAIGNS = new Map([
  ["native-evidence-20261019:dpc-trace", "pct-facebook-dpc-trace-20261019"],
  ["native-evidence-20261019:saved-values", "pct-facebook-saved-values-20261019"],
]);
const CAMPAIGNS = new Set([
  "pct-instagram-profile", "pct-youtube-profile", "pct-youtube-profiles-01",
  "pct-youtube-file-extensions", "pct-youtube-keep-game-clips", "pct-youtube-work-after-gaming",
  "pct-github-readme",
  "pct-facebook-profile", ...FACEBOOK_POST_CAMPAIGNS.values(),
]);
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
let entryCampaign: string | undefined;
let entryUtm: Record<string, string> = {};

// Retain only campaign labels from the landing URL, in memory for this page
// session. No cookies, identifiers, storage or analytics scripts. Called once
// from main.tsx, before client-side navigation drops the query string.
export function captureEntry(search: string, pathname = "") {
  if (entryCampaign !== undefined) return;
  const params = new URLSearchParams(search);
  const requested = params.get("cid") || "";
  const source = params.get("utm_source")?.toLowerCase();
  entryCampaign = CAMPAIGNS.has(requested) ? requested
    : source === "ig" || source === "instagram" ? "pct-instagram-profile"
    : source === "youtube" ? "pct-youtube-profile"
    : source === "facebook" || source === "fb" ? FACEBOOK_POST_CAMPAIGNS.get(`${params.get("utm_campaign")}:${params.get("utm_content")}`) || "pct-facebook-profile"
    : "";
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value && /^[A-Za-z0-9_.-]{1,80}$/.test(value)) entryUtm[key] = value;
  }
  if (!entryUtm.utm_source) entryUtm = pageEntryLabels(pathname);
}

/** First entry labels, sent only with a download click or a checkout the
 * visitor starts. Owned-content labels describe the entry page, not a search engine. */
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
