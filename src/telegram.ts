import { openUrl } from "@tauri-apps/plugin-opener";
import { adoptRenewedToken, API_BASE_URL, readToken } from "./lib";

/** Final states of a Telegram unlock request (backend src/telegram.ts). */
export type TelegramResult = "granted" | "linked" | "already" | "rejected" | "expired" | "failed";

let available: Promise<boolean> | null = null;
/** Off (404) until the bot is configured on the server: the menu entry stays hidden. */
export function telegramAvailable(): Promise<boolean> {
  available ??= fetch(`${API_BASE_URL}/api/telegram/config`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
    .then((r) => r.ok)
    .catch(() => {
      available = null; // offline now: ask again next time the menu opens
      return false;
    });
  return available;
}

async function call(path: string, method: "GET" | "POST"): Promise<Response> {
  const token = readToken();
  if (!token) throw new Error("signed_out");
  const response = await fetch(`${API_BASE_URL}/api/telegram${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  adoptRenewedToken(response);
  return response;
}

/** Opens the bot with a one-time link and waits (up to the link's 10 minutes) for the outcome.
 *  `onNotMember` fires once when the bot is waiting for the user to join the channel. */
export async function unlockWithTelegram(
  onNotMember: () => void,
  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
): Promise<TelegramResult> {
  const created = await call("/intents", "POST").catch(() => null);
  if (!created?.ok) return "failed";
  const intent = (await created.json()) as { id: string; url: string; expiresAt: string };
  await openUrl(intent.url);
  const deadline = new Date(intent.expiresAt).getTime();
  let warned = false;
  while (Date.now() < deadline) {
    await sleep(3000);
    const response = await call(`/intents/${encodeURIComponent(intent.id)}`, "GET").catch(
      () => null,
    );
    if (!response?.ok) continue;
    const { status } = (await response.json()) as { status: string };
    if (status === "not_member" && !warned) {
      warned = true;
      onNotMember();
    }
    if (["granted", "linked", "already", "rejected", "expired"].includes(status))
      return status as TelegramResult;
  }
  return "expired";
}
