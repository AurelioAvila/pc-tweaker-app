import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../lib";
import {
  LifetimeOffer,
  offerRemainingSeconds,
  parseLifetimeOffer,
  previewLifetimeOffer,
} from "../lifetime-offer";

type ReceivedOffer = {
  offer: LifetimeOffer;
  receivedAt: number;
  wallAt: number;
  requestMs: number;
};

export function useLifetimeOffer() {
  const [received, setReceived] = useState<ReceivedOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const previewDeadline = import.meta.env.DEV
    ? import.meta.env.VITE_LIFETIME_PREVIEW_ENDS_AT
    : undefined;
  const preview = Boolean(previewDeadline);
  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    let request: AbortController | null = null;
    async function read() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const started = performance.now();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        let offer: LifetimeOffer | null;
        if (preview) {
          offer = previewLifetimeOffer(previewDeadline, Date.now());
        } else {
          const response = await fetch(`${API_BASE_URL}/api/offers/lifetime`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Offer unavailable");
          offer = parseLifetimeOffer(await response.json());
        }
        if (!offer || offer.status === "invalid") throw new Error("Invalid offer");
        if (!disposed && request === controller) {
          const requestMs = performance.now() - started;
          setReceived({ offer, receivedAt: performance.now(), wallAt: Date.now(), requestMs });
          setElapsed(requestMs);
          setFailed(false);
        }
      } catch {
        if (!disposed && request === controller) {
          setFailed(true);
          setReceived(null);
        }
      } finally {
        window.clearTimeout(timeout);
        if (!disposed && request === controller) setLoading(false);
      }
    }
    void read();
    const interval = window.setInterval(() => void read(), 60_000);
    const focus = () => void read();
    window.addEventListener("focus", focus);
    return () => {
      disposed = true;
      request?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [preview, previewDeadline, revision]);

  useEffect(() => {
    if (!received) return;
    const tick = () =>
      setElapsed(
        received.requestMs +
          Math.max(0, performance.now() - received.receivedAt, Date.now() - received.wallAt),
      );
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [received]);

  useEffect(() => {
    if (received?.offer.status !== "scheduled" || !received.offer.startsAt) return;
    const delay =
      Date.parse(received.offer.startsAt) -
      Date.parse(received.offer.serverTime) -
      received.requestMs;
    const timer = window.setTimeout(refresh, Math.min(2_147_483_647, Math.max(100, delay + 50)));
    return () => window.clearTimeout(timer);
  }, [received, refresh]);

  const offer = received?.offer ?? null;
  const remaining = offer ? offerRemainingSeconds(offer, elapsed) : 0;
  const expired = offer?.status === "expired" || (offer?.status === "active" && remaining === 0);
  const available = Boolean(offer?.available && !expired && !failed && !loading);
  return { offer, remaining, expired, available, loading, failed, preview, refresh };
}
