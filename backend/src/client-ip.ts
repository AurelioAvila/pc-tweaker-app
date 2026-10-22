import net from "net";
import type { NextFunction, Request, Response } from "express";

/**
 * The connecting client's address, for every per-IP limiter in the app.
 *
 * `trust proxy` alone is not enough here: Railway's edge does not strip an
 * inbound X-Forwarded-For, so with `trust proxy: 1` a value the caller typed
 * became req.ip and rotating it bypassed every IP-keyed limit (see
 * public-form-guard.ts). Railway's edge *sets* X-Real-IP to the address it
 * accepted the connection from, overwriting anything the client sent, so on
 * Railway that header is the address to trust.
 *
 * CLIENT_IP_HEADER names the header explicitly (lowercase, e.g. `x-real-ip`,
 * or `cf-connecting-ip` behind Cloudflare). `none` turns the override off and
 * leaves req.ip to Express's `trust proxy` (TRUST_PROXY_HOPS). Unset: X-Real-IP
 * on Railway, nothing elsewhere. Only ever name a header the proxy in front
 * of the app overwrites; a header the client can set is no better than XFF.
 */
export function clientIpHeader(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (configured === "none") return null;
  if (configured) return configured;
  return env.RAILWAY_ENVIRONMENT_ID ? "x-real-ip" : null;
}

/** Hops Express trusts in X-Forwarded-For when no header override applies. */
export function trustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const hops = Number(env.TRUST_PROXY_HOPS ?? 1);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
}

/** The address from the configured header, when it holds a valid IP. */
export function trustedClientIp(req: Request, header = clientIpHeader()): string | null {
  if (!header) return null;
  const value = req.get(header)?.split(",")[0]?.trim() ?? "";
  return net.isIP(value) ? value : null;
}

/**
 * Replaces req.ip for the rest of the request, so express-rate-limit's
 * default key and every `ip:${req.ip}` key use the trusted address. A missing
 * or malformed header falls back to Express's own req.ip.
 */
export function clientIpMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const ip = trustedClientIp(req);
  if (ip) Object.defineProperty(req, "ip", { value: ip, configurable: true, enumerable: true });
  next();
}
