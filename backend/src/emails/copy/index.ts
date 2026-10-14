/**
 * The languages the family's apps offer, and how a message picks one: the
 * language the app sent, else the one saved on the account, else the
 * reader's browser or Windows language, else English.
 */
import { en } from "./en";
import { it } from "./it";
import { fr } from "./fr";
import { es } from "./es";
import { de } from "./de";
import { pt } from "./pt";

export type Copy = typeof en;
export const LOCALES = ["en", "it", "fr", "es", "de", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

const COPY: Record<Locale, Copy> = { en, it, fr, es, de, pt };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function copyFor(locale: unknown): Copy {
  return COPY[isLocale(locale) ? locale : "en"];
}

/** The first supported language in an Accept-Language header, or null. */
export function fromAcceptLanguage(header: string | undefined | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(",").slice(0, 10)) {
    const tag = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (isLocale(tag)) return tag;
  }
  return null;
}

/** A date in the reader's language, e.g. "14 October 2027". */
export function formatDay(c: Copy, date: Date): string {
  return new Intl.DateTimeFormat(c.dateLocale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

/** A moment in the reader's language, always in UTC and saying so. */
export function formatMoment(c: Copy, date: Date): string {
  return `${new Intl.DateTimeFormat(c.dateLocale, { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}
