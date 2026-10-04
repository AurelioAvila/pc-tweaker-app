import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Strings } from "../i18n";
import driverMark from "../assets/tweaky-driver-icon.png";

export const TWEAKY_DRIVER_URL =
  "https://pctweaker.app/tweaky-driver/?utm_source=pc-tweaker&utm_medium=app&utm_campaign=tweaky-driver-card";

/** A separate product, not a scan finding or a bundled Pro entitlement. */
export function TweakyDriverPromoCard({ s }: { s: Strings }) {
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  async function openPage() {
    setFailed(false);
    setOpening(true);
    try {
      await openUrl(TWEAKY_DRIVER_URL);
    } catch {
      setFailed(true);
    } finally {
      setOpening(false);
    }
  }
  return (
    <section className="tool-product-link">
      <div className="flex flex-wrap items-center gap-4">
        <img src={driverMark} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 basis-52">
          <h2 className="font-semibold text-ink">{s.tweakyDriverPromo.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-3">
            {s.tweakyDriverPromo.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openPage()}
          disabled={opening}
          aria-busy={opening}
          className="tool-product-action"
        >
          <span>{s.tweakyDriverPromo.button}</span>
          <span className="tool-product-arrow" aria-hidden="true">
            {opening ? (
              <span className="scan-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 18 18 6M6 6h12v12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </button>
      </div>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-ink">
          {s.tweakyDriverPromo.error}
        </p>
      )}
    </section>
  );
}
