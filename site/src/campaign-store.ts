import { useEffect, useState } from "react";
import { MICROSOFT_STORE } from "./constants";

const CAMPAIGNS = new Set([
  "pct-instagram-profile", "pct-youtube-profile", "pct-youtube-profiles-01",
  "pct-youtube-file-extensions", "pct-youtube-keep-game-clips", "pct-youtube-work-after-gaming",
]);
let entryCampaign: string | undefined;

// Retain only a known campaign label in memory for this page session.
// No cookies, identifiers, storage, network calls or analytics scripts.
export function useCampaignStoreLink(fallback: string) {
  const [campaign, setCampaign] = useState(fallback);
  useEffect(() => {
    if (entryCampaign === undefined) {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("cid") || "";
      const source = params.get("utm_source");
      entryCampaign = CAMPAIGNS.has(requested) ? requested
        : source === "ig" || source === "instagram" ? "pct-instagram-profile"
        : source === "youtube" ? "pct-youtube-profile" : "";
    }
    setCampaign(entryCampaign || fallback);
  }, [fallback]);
  return `${MICROSOFT_STORE.split("?")[0]}?cid=${encodeURIComponent(campaign)}`;
}
