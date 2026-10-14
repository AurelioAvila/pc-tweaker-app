/**
 * The one way out for transactional mail: Resend first, then SMTP2GO, then
 * Mailjet, all over HTTPS, all on their free plans.
 *
 * Canonical source: my-apps/email-resilienza/email-relay.ts (email-relay.mjs is
 * generated from it). Every product carries an identical copy; change the
 * canonical file, regenerate, copy, and keep the copies byte for byte equal.
 *
 * Rules the code below enforces:
 * - A provider without its key is skipped, so a chain with only RESEND_API_KEY
 *   behaves exactly like the old direct Resend call.
 * - A message is handed to the next provider only when the previous one did not
 *   take it: quota (429), refusal (4xx, unverified domain included), 5xx,
 *   timeout or network error. A 409 from Resend means the same key is already
 *   in flight there, so nothing else is tried.
 * - Never two copies. One idempotency key per message, kept for every provider.
 *   Any 2xx counts as taken, even with an unreadable body. Resend dedupes on the
 *   key for 24 hours, so an ambiguous Resend answer (timeout, network error,
 *   5xx) is asked once more with the same key before moving on.
 *   Within one process a key that was accepted is never sent again.
 * - EMAIL_SINK=1 (or true / dry-run) sends nothing anywhere: the message is
 *   written to EMAIL_SINK_DIR (default <tmp>/email-sink) for previews where a
 *   file system exists, and only logged elsewhere.
 * - Logs carry provider, outcome, status, the provider's error code and the
 *   key. Never addresses, subjects or bodies: they can hold codes and links.
 *
 * Adding a provider (Cloudflare Email Sending, for example) is one more entry
 * in PROVIDERS with the same shape, and its name in EMAIL_PROVIDERS.
 */

export type Mail = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  /** One per message. Derive it from the event (order, user, token) when there is one. */
  idempotencyKey?: string;
};

export type Outcome = "sent" | "skipped" | "rejected" | "ambiguous" | "conflict";
export type Attempt = { provider: string; outcome: Outcome; status?: number; code?: string };
export type Result =
  /** id: the provider's message id, null when a 2xx carried none (still taken, never handed on). */
  | { ok: true; provider: string; id: string | null; key: string; attempts: Attempt[]; duplicate?: boolean }
  | { ok: false; error: "no_provider_configured" | "all_providers_failed" | "in_flight_elsewhere"; key: string; attempts: Attempt[]; rejectedAddress: boolean };

type Env = Record<string, string | undefined>;
type Fetch = (url: string, init: { method: string; redirect: "error"; signal: AbortSignal; headers: Record<string, string>; body: string }) => Promise<Response>;
export type Options = {
  env?: Env;
  fetch?: Fetch;
  /** Per request. Default 10 s. */
  timeoutMs?: number;
  log?: (entry: Record<string, unknown>) => void;
};

/** What a provider has to say about one message. */
export type Provider = {
  ready(env: Env): boolean;
  /** True when the provider dedupes on the key, so asking twice cannot send twice. */
  idempotent: boolean;
  request(env: Env, mail: Mail, key: string): { url: string; headers: Record<string, string>; body: unknown };
  /** The provider's message id when it took the message, else null. */
  accepted(json: any): string | null;
  /** True when a 2xx body says the message was refused rather than taken. */
  refused(json: any): boolean;
  code(json: any): unknown;
};

const list = (to: string | string[]) => (Array.isArray(to) ? to : [to]);
/** "Name <a@b.c>" or "a@b.c" into its parts. */
export function address(value: string): { email: string; name?: string } {
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/.exec(value);
  if (match) return match[1] ? { email: match[2], name: match[1].trim() } : { email: match[2] };
  return { email: value.trim() };
}

export const PROVIDERS: Record<string, Provider> = {
  resend: {
    ready: (env) => Boolean(env.RESEND_API_KEY),
    idempotent: true,
    request: (env, mail, key) => ({
      url: "https://api.resend.com/emails",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Idempotency-Key": key },
      body: {
        from: mail.from,
        to: mail.to, // as given: Resend takes a string or a list
        subject: mail.subject,
        html: mail.html,
        ...(mail.text ? { text: mail.text } : {}),
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        ...(mail.headers ? { headers: mail.headers } : {}),
      },
    }),
    accepted: (json) => (typeof json?.id === "string" && json.id ? json.id : null),
    refused: () => false,
    code: (json) => json?.name,
  },
  smtp2go: {
    ready: (env) => Boolean(env.SMTP2GO_API_KEY),
    idempotent: false,
    request: (env, mail) => {
      const headers = { ...(mail.replyTo ? { "Reply-To": mail.replyTo } : {}), ...mail.headers };
      return {
        url: "https://api.smtp2go.com/v3/email/send",
        headers: { "X-Smtp2go-Api-Key": String(env.SMTP2GO_API_KEY) },
        body: {
          sender: mail.from,
          to: list(mail.to),
          subject: mail.subject,
          html_body: mail.html,
          ...(mail.text ? { text_body: mail.text } : {}),
          ...(Object.keys(headers).length ? { custom_headers: Object.entries(headers).map(([header, value]) => ({ header, value })) } : {}),
        },
      };
    },
    accepted: (json) => (json?.data?.succeeded > 0 ? String(json.data.email_id || "accepted") : null),
    refused: (json) => json?.data?.succeeded === 0,
    code: (json) => json?.data?.error_code,
  },
  mailjet: {
    ready: (env) => Boolean(env.MAILJET_API_KEY && env.MAILJET_API_SECRET),
    idempotent: false,
    request: (env, mail, key) => {
      const from = address(mail.from);
      return {
        url: "https://api.mailjet.com/v3.1/send",
        headers: { Authorization: `Basic ${btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_API_SECRET}`)}` },
        body: {
          Messages: [{
            From: from.name ? { Email: from.email, Name: from.name } : { Email: from.email },
            To: list(mail.to).map((to) => ({ Email: address(to).email })),
            Subject: mail.subject,
            HTMLPart: mail.html,
            ...(mail.text ? { TextPart: mail.text } : {}),
            ...(mail.replyTo ? { ReplyTo: { Email: address(mail.replyTo).email } } : {}),
            ...(mail.headers ? { Headers: mail.headers } : {}),
            CustomID: key.slice(0, 250),
          }],
        },
      };
    },
    accepted: (json) => {
      const message = json?.Messages?.[0];
      return message?.Status === "success" ? String(message.To?.[0]?.MessageUUID || message.To?.[0]?.MessageID || "accepted") : null;
    },
    refused: (json) => json?.Messages?.[0]?.Status === "error",
    code: (json) => json?.Messages?.[0]?.Errors?.[0]?.ErrorCode ?? json?.ErrorIdentifier,
  },
};

export const DEFAULT_ORDER = "resend,smtp2go,mailjet";
const DAY_MS = 86_400_000;
const REMEMBERED = 1000;
const BODY_LIMIT = 16_384;
const sentKeys = new Map<string, { provider: string; id: string | null; at: number }>();
const inFlight = new Map<string, Promise<Result>>();
const counters: Record<string, Record<Outcome, number>> = {};

const envOf = (options: Options): Env => options.env ?? (globalThis as any).process?.env ?? {};
const order = (env: Env) => (env.EMAIL_PROVIDERS || DEFAULT_ORDER).split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
const sinkOn = (env: Env) => ["1", "true", "yes", "dry-run"].includes(String(env.EMAIL_SINK || "").trim().toLowerCase());
const safeCode = (value: unknown) => (typeof value === "string" && /^[\w.:-]{1,80}$/.test(value) ? value : undefined);
const count = (provider: string, outcome: Outcome) => {
  counters[provider] ??= { sent: 0, skipped: 0, rejected: 0, ambiguous: 0, conflict: 0 };
  counters[provider][outcome] += 1;
};

/** Providers in chain order that have their keys: what "mail is configured" means now. */
export function readyProviders(env: Env = envOf({})): string[] {
  return order(env).filter((name) => PROVIDERS[name]?.ready(env));
}

/** Per provider counts since the process started. */
export function relayStats(): Record<string, Record<Outcome, number>> {
  return JSON.parse(JSON.stringify(counters));
}

/** Optional allowlist, e.g. SMTP2GO_DOMAINS=pctweaker.app: the provider is then used only for those sender domains. */
function domainEnabled(env: Env, name: string, from: string): boolean {
  const allowed = env[`${name.toUpperCase()}_DOMAINS`];
  if (!allowed) return true;
  const domain = address(from).email.split("@").pop()?.toLowerCase() ?? "";
  return allowed.split(",").map((d) => d.trim().toLowerCase()).includes(domain);
}

async function readJson(response: Response): Promise<any> {
  try {
    const length = response.headers.get("content-length");
    if (length !== null && Number(length) > BODY_LIMIT) return null;
    if (!/json/i.test(response.headers.get("content-type") || "")) return null;
    const text = await response.text();
    return text.length > BODY_LIMIT ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

async function attempt(name: string, provider: Provider, env: Env, mail: Mail, key: string, fetcher: Fetch, timeoutMs: number): Promise<Attempt & { id?: string }> {
  const request = provider.request(env, mail, key);
  let response: Response;
  try {
    response = await fetcher(request.url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { ...request.headers, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request.body),
    });
  } catch (error) {
    return { provider: name, outcome: "ambiguous", code: (error as Error)?.name === "TimeoutError" ? "timeout" : "network_error" };
  }
  const status = response.status;
  const json = await readJson(response);
  const code = safeCode(provider.code(json));
  if (status >= 200 && status < 300) {
    // A 2xx is the provider taking the message unless its body says otherwise.
    // An unreadable body still counts as taken: handing it on could mail twice.
    if (json && provider.refused(json)) return { provider: name, outcome: "rejected", status, code };
    return { provider: name, outcome: "sent", status, id: (json && provider.accepted(json)) || undefined };
  }
  if (status === 409) return { provider: name, outcome: "conflict", status, code };
  return { provider: name, outcome: status >= 500 ? "ambiguous" : "rejected", status, code };
}

function sink(env: Env, mail: Mail, key: string, log: (entry: Record<string, unknown>) => void): Result {
  // getBuiltinModule rather than an import: bundlers for Workers never see node:fs.
  const process = (globalThis as any).process;
  const fs = process?.getBuiltinModule?.("node:fs");
  const path = process?.getBuiltinModule?.("node:path");
  const os = process?.getBuiltinModule?.("node:os");
  let file: string | undefined;
  if (fs && path && os) {
    const dir = env.EMAIL_SINK_DIR || path.join(os.tmpdir(), "email-sink");
    fs.mkdirSync(dir, { recursive: true });
    const stem = `${new Date().toISOString().replace(/[:.]/g, "-")}-${mail.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
    file = path.join(dir, `${stem}.html`);
    fs.writeFileSync(file, mail.html);
    if (mail.text) fs.writeFileSync(path.join(dir, `${stem}.txt`), mail.text);
  }
  log({ event: "mail_sink", key, file: file ?? null, note: "EMAIL_SINK is on: nothing was sent" });
  return { ok: true, provider: "sink", id: `sink-${key}`, key, attempts: [{ provider: "sink", outcome: "sent" }] };
}

async function run(env: Env, mail: Mail, key: string, fetcher: Fetch, timeoutMs: number, log: (entry: Record<string, unknown>) => void): Promise<Result> {
  const attempts: Attempt[] = [];
  for (const name of order(env)) {
    const provider = PROVIDERS[name];
    const skip = !provider ? "unknown_provider" : !provider.ready(env) ? "no_key" : !domainEnabled(env, name, mail.from) ? "domain_not_enabled" : null;
    if (skip || !provider) {
      attempts.push({ provider: name, outcome: "skipped", code: skip ?? undefined });
      count(name, "skipped");
      continue;
    }
    let result = await attempt(name, provider, env, mail, key, fetcher, timeoutMs);
    // Same key, same provider: if the first request did arrive, the answer is the first message, not a second one.
    if (result.outcome === "ambiguous" && provider.idempotent) result = await attempt(name, provider, env, mail, key, fetcher, timeoutMs);
    const { id, ...entry } = result;
    attempts.push(entry);
    count(name, entry.outcome);
    log({ event: "mail_attempt", key, ...entry });
    if (entry.outcome === "sent") {
      sentKeys.set(key, { provider: name, id: id ?? null, at: Date.now() });
      if (sentKeys.size > REMEMBERED) sentKeys.delete(sentKeys.keys().next().value as string);
      return { ok: true, provider: name, id: id ?? null, key, attempts };
    }
    if (entry.outcome === "conflict") {
      log({ event: "mail_in_flight_elsewhere", key, provider: name });
      return { ok: false, error: "in_flight_elsewhere", key, attempts, rejectedAddress: false };
    }
  }
  const tried = attempts.filter((a) => a.outcome !== "skipped");
  const first = tried[0];
  const rejectedAddress = Boolean(first && first.outcome === "rejected" && first.status && first.status >= 400 && first.status < 500 && ![401, 403, 429].includes(first.status));
  const error = tried.length ? "all_providers_failed" : "no_provider_configured";
  log({ event: "mail_undelivered", key, error, attempts });
  return { ok: false, error, key, attempts, rejectedAddress };
}

/** Sends one message through the first provider that takes it. Never throws for a provider failure. */
export async function sendEmail(mail: Mail, options: Options = {}): Promise<Result> {
  const env = envOf(options);
  const log = options.log ?? ((entry) => console.log(JSON.stringify({ level: entry.event === "mail_undelivered" ? "error" : "info", ...entry })));
  const key = mail.idempotencyKey || globalThis.crypto.randomUUID();
  if (sinkOn(env)) return sink(env, mail, key, log);
  const done = sentKeys.get(key);
  if (done && Date.now() - done.at < DAY_MS) {
    log({ event: "mail_duplicate_skipped", key, provider: done.provider });
    return { ok: true, provider: done.provider, id: done.id, key, attempts: [], duplicate: true };
  }
  const running = inFlight.get(key);
  if (running) return running;
  const fetcher = options.fetch ?? (globalThis.fetch as unknown as Fetch);
  const pending = run(env, mail, key, fetcher, options.timeoutMs ?? 10_000, log).finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}
