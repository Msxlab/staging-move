import { ZCTA_CENTROIDS_RAW } from "./data/zcta-centroids";

export interface ZipCentroid {
  latitude: number;
  longitude: number;
}

let cache: Map<string, ZipCentroid> | null = null;

/**
 * Parse the embedded Census ZCTA gazetteer ("GEOID,lat,lng" per line) into a
 * ZIP -> centroid map exactly once, then memoize. ~34k rows; the cost is a single
 * lazy pass on first lookup per process.
 */
function load(): Map<string, ZipCentroid> {
  if (cache) return cache;
  const map = new Map<string, ZipCentroid>();
  for (const line of ZCTA_CENTROIDS_RAW.split("\n")) {
    if (!line) continue;
    const c1 = line.indexOf(",");
    const c2 = line.indexOf(",", c1 + 1);
    if (c1 < 0 || c2 < 0) continue;
    const zip = line.slice(0, c1);
    const lat = Number(line.slice(c1 + 1, c2));
    const lng = Number(line.slice(c2 + 1));
    if (zip.length === 5 && Number.isFinite(lat) && Number.isFinite(lng)) {
      map.set(zip, { latitude: lat, longitude: lng });
    }
  }
  cache = map;
  return map;
}

/**
 * Resolve a US 5-digit ZIP to its ZCTA centroid coordinates, or null when the ZIP
 * isn't a known ZCTA (PO-box-only ZIPs and non-US input have no ZCTA). Accepts a
 * ZIP+4 (uses the leading 5 digits). This lets the recommendation engine do
 * distance-based provider ranking for ANY address that has a ZIP, instead of only
 * those with stored lat/lng — the finer alternative to the coarse 3-digit-prefix
 * heuristic.
 */
export function zipCentroid(zip: string | null | undefined): ZipCentroid | null {
  if (!zip) return null;
  const z5 = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(z5)) return null;
  return load().get(z5) ?? null;
}

/** Count of ZCTAs in the dataset — for diagnostics / tests. */
export function zipCentroidCount(): number {
  return load().size;
}
