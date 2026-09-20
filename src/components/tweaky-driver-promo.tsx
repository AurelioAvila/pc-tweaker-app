import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Strings } from "../i18n";
import driverMark from "../assets/tweaky-driver-icon.png";

export const TWEAKY_DRIVER_URL =
  "https://github.com/AurelioAvila/Tweaky-Driver-Releases/releases/latest";

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
    <section className="my-5 rounded-2xl border border-line bg-surface-1 p-4">
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
          className="max-w-full rounded-xl border border-line bg-accent-soft px-4 py-2 text-sm font-semibold text-accent transition hover:brightness-110 disabled:opacity-60"
        >
          {s.tweakyDriverPromo.button}
          <span aria-hidden="true"> ↗</span>
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
