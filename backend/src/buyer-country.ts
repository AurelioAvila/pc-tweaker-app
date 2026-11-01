import net from "net";
import type { Request } from "express";
import { parityCountry } from "./stripe-policy";

/**
 * The buyer's country from the request, for crypto price parity
 * (stripe-policy.ts CARD_TOTAL_UPLIFT_PERCENT). api.pctweaker.app is proxied by
 * Cloudflare, which sets CF-IPCountry; Railway's edge then overwrites X-Real-IP
 * with the address it accepted the connection from (client-ip.ts). So the
 * header is believed only when that address is one of Cloudflare's: a caller
 * reaching Railway directly could send any CF-IPCountry it likes.
 *
 * Ranges: https://www.cloudflare.com/ips-v4 and /ips-v6, fetched 2026-11-01.
 * ponytail: static list; Cloudflare announces changes, refresh it then.
 * Someone else's Cloudflare Worker calling the Railway host directly could still
 * forge the header; the most it saves is the parity uplift on one purchase.
 */
const CLOUDFLARE = new net.BlockList();
for (const range of [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
]) CLOUDFLARE.addSubnet(range.split("/")[0], Number(range.split("/")[1]), "ipv4");
for (const range of [
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
  "2a06:98c0::/29", "2c0f:f248::/32",
]) CLOUDFLARE.addSubnet(range.split("/")[0], Number(range.split("/")[1]), "ipv6");

export function fromCloudflare(address: string | undefined | null): boolean {
  const ip = address?.replace(/^::ffff:/, "") ?? "";
  const family = net.isIP(ip);
  return family !== 0 && CLOUDFLARE.check(ip, family === 4 ? "ipv4" : "ipv6");
}

let warned = false;
/** CF-IPCountry when the request provably came through Cloudflare, else null. */
export function requestCountry(req: { get?: Request["get"]; socket?: { remoteAddress?: string } }, env: NodeJS.ProcessEnv = process.env): string | null {
  const claimed = req.get?.("cf-ipcountry");
  if (!claimed) return null;
  // On Railway the edge's X-Real-IP is the peer; elsewhere the socket is.
  const peer = env.RAILWAY_ENVIRONMENT_ID ? req.get?.("x-real-ip") : req.socket?.remoteAddress;
  if (!fromCloudflare(peer)) {
    if (!warned) console.warn("CF-IPCountry ignored: the request did not come from a Cloudflare address");
    warned = true;
    return null;
  }
  // "XX" (unknown) and "T1" (Tor) are not countries.
  const country = parityCountry(claimed);
  return country && country !== "XX" && country !== "T1" ? country : null;
}
