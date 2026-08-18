/**
 * Where support requests and review notifications are delivered.
 *
 * This address is deliberately server-side only: it is never returned by any
 * API response, never rendered into the public landing page, and never
 * shipped to the website bundle. The support form relays messages to it so
 * visitors get a reply without the inbox itself being harvestable by
 * scrapers. Keep it that way — if a route ever needs to show a contact
 * address, add a separate public alias instead of exporting this one.
 */
export const SUPPORT_INBOX = process.env.SUPPORT_EMAIL || "canadesino91@gmail.com";
