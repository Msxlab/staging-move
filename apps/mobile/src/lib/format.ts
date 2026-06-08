/**
 * Shared numeric / currency formatting for the mobile app.
 *
 * Before this, money was formatted three different ways across screens:
 *   - dashboard:        `Intl.NumberFormat(..., { style: "currency" })`  ($1,234)
 *   - service detail:   `$${n.toLocaleString()}`                          ($1,234)
 *   - services list:    `$${n.toLocaleString()}`                          ($1,234)
 * The hand-rolled `$` prefix hard-codes the symbol on the left and ignores
 * locale currency conventions. Routing every call site through one helper
 * keeps the symbol, grouping, and decimal handling identical everywhere and
 * respects the active i18n locale.
 *
 * `formatCurrency` mirrors the dashboard's prior behaviour (whole-dollar,
 * no cents) since every monthly-cost surface displays rounded dollars.
 */

const DEFAULT_LOCALE = "en";
const DEFAULT_CURRENCY = "USD";

/**
 * Format a number as whole-dollar currency for the given locale, e.g.
 * `formatCurrency(1234.5)` → `"$1,235"`. Falls back gracefully on any
 * `Intl` failure (unknown locale on an old engine) to a `$`-prefixed,
 * grouped string so a stat is never rendered blank.
 */
export function formatCurrency(
  value: number,
  locale: string = DEFAULT_LOCALE,
  currency: string = DEFAULT_CURRENCY,
): string {
  const n = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(locale || DEFAULT_LOCALE, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

/**
 * Locale-aware grouped integer, e.g. `formatNumber(1234)` → `"1,234"`.
 * Used for non-currency counts that still want thousands separators.
 */
export function formatNumber(value: number, locale: string = DEFAULT_LOCALE): string {
  const n = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(locale || DEFAULT_LOCALE, {
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return Math.round(n).toLocaleString();
  }
}
