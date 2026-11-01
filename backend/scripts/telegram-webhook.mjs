// Registers (or with --delete removes) the Telegram webhook of the PC Tweaker bot.
// Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL (the public backend URL) from the environment.
// Usage: node scripts/telegram-webhook.mjs [--delete]
import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
if (!token || !secret || !base.startsWith("https://")) {
  console.error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and an https APP_URL first.");
  process.exit(1);
}
const call = async (method, body) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}),
  });
  return response.json();
};
if (process.argv.includes("--delete")) {
  console.log(await call("deleteWebhook", { drop_pending_updates: false }));
} else {
  console.log(await call("setWebhook", {
    url: `${base}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  }));
  console.log(await call("setMyCommands", { commands: [
    { command: "start", description: "Unlock +4 days of PC Tweaker Pro trial" },
    { command: "invite", description: "Your invite link and progress" },
  ] }));
  const info = await call("getWebhookInfo");
  console.log({ url: info.result?.url, pending: info.result?.pending_update_count, last_error: info.result?.last_error_message ?? null });
}
