/**
 * Normalize ISP brand names for matching FCC-reported names to catalog names.
 *
 * FCC data, catalog rows, and provider-owned pages rarely agree byte-for-byte:
 * "AT&T Internet", "AT&T", "Comcast Communications", and "Xfinity (Comcast)"
 * need a stable comparison key. Keep this in shared code so live FCC lookups
 * and bulk FCC ingestion use the same identity rules.
 */
export function normalizeIspName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(internet|communications|broadband|fiber|cable|telecom|networks?|inc|llc|corp|co|the)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
