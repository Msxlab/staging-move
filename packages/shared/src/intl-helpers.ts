/**
 * Intl formatters — locale-aware date, currency, number helpers.
 *
 * All three apps consume these so date "Apr 21, 2026" (en-US) becomes
 * "21 abr 2026" (es-US) automatically without each call site
 * instantiating its own Intl.* object. Formatters are cached per
 * (locale, options) pair because constructing Intl formatters has
 * measurable overhead — reusing instances cuts per-row cost inside
 * tables of hundreds of rows.
 *
 * Usage:
 *   import { formatCurrency, formatDate } from "@locateflow/shared";
 *   formatCurrency(7.99, locale); // "$7.99" (en) / "US$7.99" (es)
 *   formatDate(date, locale, "short"); // "Apr 21" / "21 abr"
 */

type DateStyle = "short" | "medium" | "long" | "full";

interface FormatterCacheKey {
  locale: string;
  type: "date" | "number" | "currency";
  options: string;
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const numberFormatterCache = new Map<string, Intl.NumberFormat>();

function keyOf(k: FormatterCacheKey): string {
  return `${k.type}|${k.locale}|${k.options}`;
}

function getDateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = keyOf({ locale, type: "date", options: JSON.stringify(options) });
  let formatter = dateFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatterCache.set(key, formatter);
  }
  return formatter;
}

function getNumberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const isCurrency = Boolean(options.currency);
  const key = keyOf({
    locale,
    type: isCurrency ? "currency" : "number",
    options: JSON.stringify(options),
  });
  let formatter = numberFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Format a date in the caller's locale. `style` maps to standard
 * DateTimeFormat presets; pass a custom options object for one-offs.
 */
export function formatDate(
  value: Date | string | number,
  locale: string,
  style: DateStyle = "medium",
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return getDateFormatter(locale, { dateStyle: style }).format(date);
}

export function formatDateCustom(
  value: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return getDateFormatter(locale, options).format(date);
}

/**
 * Format currency. Defaults to USD — pass `currency` explicitly once
 * we support multi-currency billing. Negative amounts render as
 * "-$X" (en) / "-US$X" (es) without extra work.
 */
export function formatCurrency(
  amount: number,
  locale: string,
  currency: string = "USD",
  options: Omit<Intl.NumberFormatOptions, "style" | "currency"> = {},
): string {
  if (!Number.isFinite(amount)) return "";
  return getNumberFormatter(locale, {
    style: "currency",
    currency,
    ...options,
  }).format(amount);
}

/** Format a plain number (comma/decimal handling per locale). */
export function formatNumber(
  value: number,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "";
  return getNumberFormatter(locale, options).format(value);
}

/** Format a percent value (0-1 → "50%"). */
export function formatPercent(
  value: number,
  locale: string,
  fractionDigits = 0,
): string {
  if (!Number.isFinite(value)) return "";
  return getNumberFormatter(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * "2 days ago" / "in 3 hours" helpers — relative time. The Intl
 * RelativeTimeFormat API is well-supported on every target runtime.
 */
export function formatRelativeTime(
  from: Date | string | number,
  locale: string,
  now: Date = new Date(),
): string {
  const date = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 60 * 60) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 60 * 60 * 24) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 60 * 60 * 24 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 60 * 60 * 24 * 30) return rtf.format(Math.round(diffSec / 604800), "week");
  if (abs < 60 * 60 * 24 * 365) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}
