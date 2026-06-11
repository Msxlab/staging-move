import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * GET /api/maps/static — authenticated Google Static Maps proxy.
 *
 * Replaces the CSS-stylized "fake map" canvases with a real basemap while
 * keeping the server-side GOOGLE_MAPS_API_KEY server-side: the key is read
 * from runtime config, appended to the upstream URL here, and NEVER appears
 * in the response (the PNG bytes are streamed back instead of redirecting).
 *
 * Query contract (shared by web RouteMapCard and the mobile transit banner):
 *   from=lat,lng   origin pin (sage marker)
 *   to=lat,lng     destination pin (plan-accent marker)
 *   w, h           image size in CSS px (clamped to the Static Maps free
 *                  limits; scale=2 is always requested for retina density)
 *   theme          dark | light — Aurora-styled muted navy/ink palettes
 *   accent         optional RRGGBB plan-accent override (validated hex);
 *                  defaults to the Aurora cool-blue accent per theme
 *
 * Cost / cache posture: responses are immutable per (coords, size, theme,
 * accent) so they get long private cache headers, plus a small in-process
 * LRU so repeat dashboard loads don't re-hit Google at all. At ~10k free
 * loads/month this stays at zero cost for our scale; per-user and per-IP
 * rate limits keep an abusive client from burning quota.
 *
 * Failure posture (graceful degradation): any error — unauthenticated, bad
 * params, key unconfigured, upstream failure — returns JSON with a non-200
 * status. Clients treat ANY non-image response as "fall back to the existing
 * stylized canvas"; nothing user-facing ever shows a broken image.
 */

export const dynamic = "force-dynamic";

const STATIC_MAPS_BASE_URL = "https://maps.googleapis.com/maps/api/staticmap";

const SIZE_MIN = 80;
// Static Maps free-tier max is 640x640 per dimension (scale multiplies after).
const SIZE_MAX = 640;
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 320;

/** Aurora map palettes — hexes mirror web globals.css / mobile theme.ts. */
const MAP_THEMES = {
  dark: {
    // sage --sage #87DDC0, accent --rose / default --primary #7FB6E8
    sage: "87DDC0",
    accent: "7FB6E8",
    styles: [
      "element:geometry|color:0x0F1726",
      "element:labels.text.fill|color:0x8A99AD",
      "element:labels.text.stroke|color:0x0F1726",
      "element:labels.icon|visibility:off",
      "feature:water|element:geometry|color:0x0A111D",
      "feature:road|element:geometry|color:0x1C2940",
      "feature:road|element:geometry.stroke|visibility:off",
      "feature:poi|visibility:off",
      "feature:transit|visibility:off",
      "feature:administrative|element:geometry|color:0x233048",
      "feature:landscape.natural|element:geometry|color:0x121C2E",
    ],
  },
  light: {
    // light-mode tokens: --sage #2E9B79, --rose #2D7BC4
    sage: "2E9B79",
    accent: "2D7BC4",
    styles: [
      "element:geometry|color:0xEDF1F7",
      "element:labels.text.fill|color:0x5B6B7E",
      "element:labels.text.stroke|color:0xFFFFFF",
      "element:labels.icon|visibility:off",
      "feature:water|element:geometry|color:0xC7D9EC",
      "feature:road|element:geometry|color:0xFFFFFF",
      "feature:road|element:geometry.stroke|color:0xDCE3EC",
      "feature:poi|visibility:off",
      "feature:transit|visibility:off",
      "feature:administrative|element:geometry|color:0xD8E0EA",
      "feature:landscape.natural|element:geometry|color:0xE2EAF2",
    ],
  },
} as const;

type MapTheme = keyof typeof MAP_THEMES;

interface LatLng {
  lat: number;
  lng: number;
}

/** ~1m precision — also normalizes cache keys across jittery float inputs. */
function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

function parseLatLng(raw: string | null): LatLng | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length !== 2) return null;
  const lat = Number.parseFloat(parts[0]);
  const lng = Number.parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: round5(lat), lng: round5(lng) };
}

function clampSize(raw: string | null, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, parsed));
}

function parseTheme(raw: string | null): MapTheme {
  return raw === "light" ? "light" : "dark";
}

/** Optional plan-accent override — strict 6-digit hex (leading # tolerated). */
function parseAccent(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : null;
}

function formatLatLng(coord: LatLng): string {
  return `${coord.lat},${coord.lng}`;
}

interface StaticMapParams {
  from: LatLng;
  to: LatLng;
  width: number;
  height: number;
  theme: MapTheme;
  accent: string | null;
}

/** Builds the upstream Google Static Maps URL. Exported for tests. */
export function buildStaticMapUrl(params: StaticMapParams, apiKey: string): string {
  const palette = MAP_THEMES[params.theme];
  const accent = params.accent ?? palette.accent;
  const search = new URLSearchParams();
  search.append("size", `${params.width}x${params.height}`);
  search.append("scale", "2");
  search.append("format", "png");
  search.append("maptype", "roadmap");
  // Old home — sage; new home — plan accent (matches the card pin language).
  search.append("markers", `size:mid|color:0x${palette.sage}|${formatLatLng(params.from)}`);
  search.append("markers", `size:mid|color:0x${accent}|${formatLatLng(params.to)}`);
  // Geodesic route line in the plan accent (CC alpha keeps the basemap readable).
  search.append(
    "path",
    `color:0x${accent}CC|weight:3|geodesic:true|${formatLatLng(params.from)}|${formatLatLng(params.to)}`,
  );
  for (const style of palette.styles) {
    search.append("style", style);
  }
  search.append("key", apiKey);
  return `${STATIC_MAPS_BASE_URL}?${search.toString()}`;
}

// ── In-process LRU (key NEVER part of the cache key) ────────────────────────
const CACHE_MAX_ENTRIES = 64;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  body: Buffer;
  contentType: string;
  expiresAt: number;
}

const mapCache = new Map<string, CacheEntry>();

function cacheKeyFor(params: StaticMapParams): string {
  return [
    formatLatLng(params.from),
    formatLatLng(params.to),
    params.width,
    params.height,
    params.theme,
    params.accent ?? "default",
  ].join("|");
}

function cacheGet(key: string): CacheEntry | null {
  const entry = mapCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    mapCache.delete(key);
    return null;
  }
  // Refresh recency (Map preserves insertion order — re-insert moves to tail).
  mapCache.delete(key);
  mapCache.set(key, entry);
  return entry;
}

function cacheSet(key: string, entry: CacheEntry): void {
  mapCache.delete(key);
  while (mapCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = mapCache.keys().next().value;
    if (oldest === undefined) break;
    mapCache.delete(oldest);
  }
  mapCache.set(key, entry);
}

/** Test hook — keeps LRU assertions deterministic across cases. */
export function __resetStaticMapCacheForTests(): void {
  mapCache.clear();
}

function imageResponse(entry: CacheEntry, cacheState: "HIT" | "MISS"): NextResponse {
  return new NextResponse(new Uint8Array(entry.body), {
    status: 200,
    headers: {
      "Content-Type": entry.contentType,
      // Immutable per (coords, size, theme, accent); private — this is an
      // authenticated, per-user-agnostic proxy that must not land on CDNs.
      "Cache-Control": "private, max-age=604800, immutable",
      "X-Maps-Cache": cacheState,
    },
  });
}

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Cost control: most requests are served by the LRU/browser cache; these
    // caps only bite a client hammering unique coordinates.
    const [userRl, ipRl] = await Promise.all([
      rateLimit(`maps:static:user:${userId}`, { limit: 60, windowSeconds: 60 }),
      rateLimit(getRateLimitKey(request, "maps:static"), { limit: 120, windowSeconds: 60 }),
    ]);
    if (!userRl.success || !ipRl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait.", code: "MAPS_RATE_LIMITED" },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const from = parseLatLng(searchParams.get("from"));
    const to = parseLatLng(searchParams.get("to"));
    if (!from || !to) {
      return NextResponse.json(
        { error: "Invalid or missing from/to coordinates", code: "MAPS_INVALID_COORDINATES" },
        { status: 400 },
      );
    }

    const params: StaticMapParams = {
      from,
      to,
      width: clampSize(searchParams.get("w"), DEFAULT_WIDTH),
      height: clampSize(searchParams.get("h"), DEFAULT_HEIGHT),
      theme: parseTheme(searchParams.get("theme")),
      accent: parseAccent(searchParams.get("accent")),
    };

    // Graceful degradation: no key → 503; clients keep their stylized canvas.
    const apiKey = await getRuntimeConfigValue("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Maps are not configured", code: "MAPS_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const cacheKey = cacheKeyFor(params);
    const cached = cacheGet(cacheKey);
    if (cached) {
      return imageResponse(cached, "HIT");
    }

    const upstream = await fetch(buildStaticMapUrl(params, apiKey), { cache: "no-store" });
    if (!upstream.ok) {
      // Never forward the upstream body — error text is useless to clients
      // and this guarantees nothing key-adjacent can leak through the proxy.
      console.error(`[maps/static] upstream returned ${upstream.status}`);
      return NextResponse.json(
        { error: "Map image unavailable", code: "MAPS_UPSTREAM_ERROR" },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      console.error(`[maps/static] upstream returned non-image content-type: ${contentType}`);
      return NextResponse.json(
        { error: "Map image unavailable", code: "MAPS_UPSTREAM_ERROR" },
        { status: 502 },
      );
    }

    const entry: CacheEntry = {
      body: Buffer.from(await upstream.arrayBuffer()),
      contentType,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    cacheSet(cacheKey, entry);
    return imageResponse(entry, "MISS");
  } catch (error) {
    console.error("[maps/static] failed:", error);
    return NextResponse.json(
      { error: "Map image unavailable", code: "MAPS_PROXY_ERROR" },
      { status: 502 },
    );
  }
}
