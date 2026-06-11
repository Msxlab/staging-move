/**
 * Pure helpers for the move-in-transit real route map (TransitRouteMap).
 * Kept free of React Native imports so they run under the colocated vitest
 * node environment.
 *
 * The image itself is served by the web app's authenticated proxy at
 * GET /api/maps/static (Google Static Maps; the API key stays server-side).
 */

export interface RouteLatLng {
  lat: number;
  lng: number;
}

export interface TransitRouteCoords {
  from: RouteLatLng;
  to: RouteLatLng;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** ~1m precision; also keeps proxy cache keys stable across float jitter. */
const round5 = (value: number) => Math.round(value * 1e5) / 1e5;

/**
 * Resolves the active move's origin/destination coordinates from the
 * addresses feed. The /api/moving payload spreads the full plan record, so
 * `fromAddressId`/`toAddressId` are authoritative; the nested address
 * selects only street/city/state/zip (no id), so it is only a fallback.
 * Null whenever anything is missing — callers keep the stylized banner.
 */
export function resolveTransitRouteCoords(
  activeMove: unknown,
  addresses: unknown,
): TransitRouteCoords | null {
  if (!activeMove || typeof activeMove !== "object" || !Array.isArray(addresses)) return null;
  const move = activeMove as Record<string, any>;
  const byId = new Map<string, any>(
    addresses
      .filter((a: any) => a && typeof a.id === "string")
      .map((a: any) => [a.id as string, a]),
  );
  const coordFor = (id: unknown): RouteLatLng | null => {
    const address = typeof id === "string" ? byId.get(id) : undefined;
    if (!address || !isFiniteNumber(address.latitude) || !isFiniteNumber(address.longitude)) {
      return null;
    }
    return { lat: address.latitude, lng: address.longitude };
  };
  const from = coordFor(move.fromAddressId ?? move.fromAddress?.id);
  const to = coordFor(move.toAddressId ?? move.toAddress?.id);
  return from && to ? { from, to } : null;
}

export interface TransitRouteMapOptions {
  width: number;
  height: number;
  theme: "dark" | "light";
  /** Plan-accent hex (leading # tolerated); omitted when unavailable. */
  accent?: string | null;
}

/**
 * Builds the proxy path (append to the app's API base URL, which already
 * ends in `/api`). Width/height are clamped to the proxy's accepted range
 * client-side too so layout jitter can't produce a 400.
 */
export function buildTransitRouteMapPath(
  from: RouteLatLng,
  to: RouteLatLng,
  options: TransitRouteMapOptions,
): string {
  const clamp = (v: number) => Math.min(640, Math.max(80, Math.round(v)));
  const params = new URLSearchParams({
    from: `${round5(from.lat)},${round5(from.lng)}`,
    to: `${round5(to.lat)},${round5(to.lng)}`,
    w: String(clamp(options.width)),
    h: String(clamp(options.height)),
    theme: options.theme === "light" ? "light" : "dark",
  });
  const accent = options.accent?.replace(/^#/, "");
  if (accent && /^[0-9a-fA-F]{6}$/.test(accent)) {
    params.set("accent", accent.toUpperCase());
  }
  return `/maps/static?${params.toString()}`;
}
