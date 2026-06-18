"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
// Renamed import: a bare `Map` would shadow the global Map constructor used
// by resolveActiveRouteCoords below.
import { Map as MapGlyph } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

/**
 * ROUTE MAP CARD — Aurora dashboard widget (Edition VII parity).
 *
 * Now renders a REAL basemap: the card resolves the active plan's origin and
 * destination coordinates (from the already-warm /api/moving + /api/addresses
 * feeds) and loads a Geoapify static map through the authenticated server-side
 * proxy at /api/maps/static — GEOAPIFY_API_KEY never reaches the client.
 * Markers: old home in sage, new home in the plan accent
 * (read from the live `--primary` token so Free/Family/Pro tiers match), with
 * a geodesic accent route between them. The image is a static PNG — no
 * pan/zoom animation, so reduced-motion preferences are inherently respected
 * (the only motion is a motion-safe opacity fade-in).
 *
 * Graceful degradation: until the image is loaded — and forever if the key is
 * unconfigured, the addresses have no coordinates, or the proxy errors — the
 * EXISTING CSS/SVG-stylized canvas renders instead. Never a broken image.
 *
 * The canvas area is INTENTIONALLY DARK-FIXED in its fallback form (same
 * decision as mobile's AddressesMap stylized canvas); the real map follows
 * the app theme via the proxy's Aurora dark/light style sets.
 */

export type RouteCoord = { lat: number; lng: number };

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Picks the active move (IN_PROGRESS, else PLANNING — never COMPLETED or
 * CANCELED, mirroring the dashboard's own selection) and resolves both
 * endpoint coordinates from the addresses feed. Null whenever anything is
 * missing — the caller falls back to the stylized canvas.
 */
export function resolveActiveRouteCoords(
  plans: unknown,
  addresses: unknown,
): { from: RouteCoord; to: RouteCoord } | null {
  if (!Array.isArray(plans)) return null;
  const plan =
    plans.find((p: any) => p?.status === "IN_PROGRESS") ??
    plans.find((p: any) => p?.status === "PLANNING") ??
    null;
  if (!plan) return null;
  const byId = new Map<string, any>(
    Array.isArray(addresses)
      ? addresses.filter((a: any) => a && typeof a.id === "string").map((a: any) => [a.id, a])
      : [],
  );
  const coordFromAddress = (address: unknown): RouteCoord | null => {
    const value = address as { latitude?: unknown; longitude?: unknown } | null;
    if (!value || !isFiniteNumber(value.latitude) || !isFiniteNumber(value.longitude)) return null;
    return { lat: value.latitude, lng: value.longitude };
  };
  const coordFor = (id: unknown, nestedAddress: unknown): RouteCoord | null => {
    const address = typeof id === "string" ? byId.get(id) : undefined;
    return coordFromAddress(address) ?? coordFromAddress(nestedAddress);
  };
  const from = coordFor((plan as any).fromAddressId, (plan as any).fromAddress);
  const to = coordFor((plan as any).toAddressId, (plan as any).toAddress);
  return from && to ? { from, to } : null;
}

/**
 * Converts a space-separated HSL token triplet (the shape of `--primary`,
 * e.g. "347 100% 81%") to an RRGGBB hex string (no #) for the proxy's
 * `accent` param. Null on anything unparseable.
 */
export function hslTripletToHex(triplet: string): string | null {
  const match = /^\s*([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%\s*$/.exec(triplet);
  if (!match) return null;
  const h = ((Number.parseFloat(match[1]) % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, Number.parseFloat(match[2]))) / 100;
  const l = Math.min(100, Math.max(0, Number.parseFloat(match[3]))) / 100;
  if (![h, s, l].every(Number.isFinite)) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x];
  const toHex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v + m)) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

/** Builds the same-origin proxy URL for a route map image. */
export function buildRouteMapSrc(
  from: RouteCoord,
  to: RouteCoord,
  opts: { width: number; height: number; theme: "dark" | "light"; accent?: string | null; preview?: boolean },
): string {
  const round5 = (v: number) => Math.round(v * 1e5) / 1e5;
  const params = new URLSearchParams({
    from: `${round5(from.lat)},${round5(from.lng)}`,
    to: `${round5(to.lat)},${round5(to.lng)}`,
    w: String(Math.round(opts.width)),
    h: String(Math.round(opts.height)),
    theme: opts.theme,
  });
  if (opts.accent) params.set("accent", opts.accent.replace(/^#/, ""));
  if (opts.preview) params.set("preview", "1");
  return `/api/maps/static?${params.toString()}`;
}

export function nextRouteMapSrcAfterError(currentSrc: string | null, previewSrc: string | null): string | null {
  if (currentSrc && previewSrc && currentSrc !== previewSrc) return previewSrc;
  return null;
}

export function buildRouteMapImageSources(
  coords: { from: RouteCoord; to: RouteCoord },
  opts: { width: number; height: number; theme: "dark" | "light"; accent?: string | null },
  realMap: boolean,
): { initialSrc: string; previewSrc: string } {
  const previewSrc = buildRouteMapSrc(coords.from, coords.to, { ...opts, preview: true });
  return {
    initialSrc: realMap ? buildRouteMapSrc(coords.from, coords.to, opts) : previewSrc,
    previewSrc,
  };
}

/** Teardrop map pin (rotated rounded square), colored via a CSS var string. */
function MapPin({ left, top, color }: { left: string; top: string; color: string }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-full"
      style={{ left, top }}
      aria-hidden="true"
    >
      <span
        className="flex h-6 w-6 -rotate-45 items-center justify-center rounded-[50%_50%_50%_4px] border-2"
        style={{
          borderColor: color,
          background: `color-mix(in srgb, ${color} 24%, transparent)`,
        }}
      >
        <span className="h-2 w-2 rotate-45 rounded-full" style={{ background: color }} />
      </span>
    </div>
  );
}

/** Mono uppercase label chip pinned onto the canvas. */
function MapLabel({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  return (
    <span
      className={`absolute max-w-[45%] truncate rounded-md border border-white/10 bg-black/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/70 backdrop-blur-sm ${className}`}
    >
      {text}
    </span>
  );
}

/**
 * The original CSS/SVG-stylized canvas — kept verbatim as the loading state
 * and the graceful fallback whenever a real map image can't be shown.
 */
function StylizedCanvas() {
  return (
    <>
      {/* terrain — blurred tone blobs (brand CSS vars over the dark base) */}
      <div
        className="absolute -left-10 top-1/3 h-32 w-44 rounded-full blur-2xl"
        style={{ background: "color-mix(in srgb, var(--sage) 16%, transparent)" }}
      />
      <div
        className="absolute -right-8 -top-8 h-32 w-48 rounded-full blur-2xl"
        style={{ background: "color-mix(in srgb, var(--rose) 16%, transparent)" }}
      />
      {/* water — soft cool inlet, bottom-right */}
      <div
        className="absolute -bottom-12 -right-10 h-40 w-56 rounded-[50%_0_0_50%/60%_0_0_40%]"
        style={{ background: "color-mix(in srgb, var(--rose) 11%, transparent)" }}
      />
      {/* street grid — white-alpha linework on the dark-fixed tile */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 34px, rgba(255,255,255,0.05) 34px, rgba(255,255,255,0.05) 35px), repeating-linear-gradient(90deg, transparent, transparent 46px, rgba(255,255,255,0.05) 46px, rgba(255,255,255,0.05) 47px)",
        }}
      />
      {/* city blocks + parks */}
      <div className="absolute left-[6%] top-[10%] h-12 w-20 rounded-[5px] bg-white/[0.03]" />
      <div className="absolute left-[30%] top-[6%] h-20 w-16 rounded-[5px] bg-white/[0.03]" />
      <div className="absolute left-[52%] top-[40%] h-14 w-20 rounded-[5px] bg-white/[0.03]" />
      <div className="absolute left-[70%] top-[12%] h-16 w-24 rounded-[5px] bg-white/[0.03]" />
      <div
        className="absolute left-[12%] top-[48%] h-16 w-28 rounded-[14px]"
        style={{ background: "color-mix(in srgb, var(--sage) 8%, transparent)" }}
      />
      <div
        className="absolute left-[64%] top-[66%] h-12 w-20 rounded-xl"
        style={{ background: "color-mix(in srgb, var(--sage) 8%, transparent)" }}
      />
      {/* avenues */}
      <div className="absolute left-0 top-[72%] h-0.5 w-[64%] -rotate-[7deg] origin-top-left bg-white/[0.07]" />
      <div className="absolute left-[38%] top-0 h-[120%] w-0.5 rotate-[14deg] origin-top-left bg-white/[0.07]" />

      {/* dashed accent route — plan accent flows via .plan-* (--primary) */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 640 296"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M84 224 C 170 240, 220 150, 320 152 S 500 92, 556 78"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="1 9"
        />
      </svg>

      {/* pins — origin in sage, destination in the plan accent */}
      <MapPin left="13%" top="76%" color="var(--sage)" />
      <MapPin left="87%" top="27%" color="hsl(var(--primary))" />
    </>
  );
}

// Image request size: matches the canvas geometry (max column width x h-56).
const MAP_IMG_WIDTH = 640;
const MAP_IMG_HEIGHT = 224;

export function RouteMapCard({
  fromCity,
  toCity,
  realMap = true,
}: {
  fromCity: string;
  toCity: string;
  /**
   * `realMap` plan entitlement (Family and up). When false, the card skips the
   * full Geoapify route map but still tries the free OSM preview source so the
   * route slot is not permanently a fake/stylized canvas when coordinates exist.
   */
  realMap?: boolean;
}) {
  const td = useTranslations("dashboard");
  const { theme } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [imgState, setImgState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Both feeds are already requested by the dashboard, so these resolve
        // warm; any failure simply leaves the stylized canvas in place.
        const [movingRes, addrRes] = await Promise.all([
          fetch("/api/moving"),
          fetch("/api/addresses?limit=200"),
        ]);
        if (!movingRes.ok || !addrRes.ok) return;
        const [movingData, addrData] = await Promise.all([movingRes.json(), addrRes.json()]);
        const coords = resolveActiveRouteCoords(movingData?.plans, addrData?.addresses);
        if (!coords || cancelled) return;
        // Live plan accent (Free/Family/Pro re-point --primary via .plan-*).
        const accent = cardRef.current
          ? hslTripletToHex(getComputedStyle(cardRef.current).getPropertyValue("--primary"))
          : null;
        const { initialSrc, previewSrc: fallbackPreviewSrc } = buildRouteMapImageSources(
          coords,
          {
            width: MAP_IMG_WIDTH,
            height: MAP_IMG_HEIGHT,
            theme,
            accent,
          },
          realMap,
        );
        setImgState("loading");
        setPreviewSrc(fallbackPreviewSrc);
        setSrc(initialSrc);
      } catch {
        // graceful: stylized canvas remains
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [theme, realMap]);

  const showStylized = !src || imgState !== "ready";

  return (
    <div
      ref={cardRef}
      className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden"
    >
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <MapGlyph className="h-4 w-4 text-tone-sky-fg" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{td("widget_routeMap")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{td("routeMap_sub")}</p>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {fromCity} → {toCity}
        </span>
      </div>

      {/* Map canvas — real basemap once loaded, stylized fallback otherwise */}
      <div className="relative mx-4 mb-4 h-56 overflow-hidden rounded-xl border border-border bg-black">
        {showStylized && <StylizedCanvas />}

        {src && imgState !== "failed" && (
          /* Same-origin authenticated proxy image — next/image's optimizer
             would re-fetch without the session cookie context, so a plain
             <img> is intentional here. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={td("routeMap_imageAlt", { from: fromCity, to: toCity })}
            className={`absolute inset-0 h-full w-full object-cover motion-safe:transition-opacity motion-safe:duration-300 ${
              imgState === "ready" ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImgState("ready")}
            onError={() => {
              const fallback = nextRouteMapSrcAfterError(src, previewSrc);
              if (fallback) {
                setImgState("loading");
                setSrc(fallback);
                return;
              }
              setImgState("failed");
            }}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        )}

        {/* labels overlay both the real map and the stylized fallback */}
        <MapLabel text={`${td("routeMap_oldHome")} · ${fromCity}`} className="left-[8%] top-[79%]" />
        <MapLabel text={`${td("routeMap_newHome")} · ${toCity}`} className="right-[4%] top-[7%]" />

        {showStylized && (
          <span className="absolute bottom-1.5 right-2 font-mono text-[8px] uppercase tracking-[0.08em] text-white/30">
            {td("routeMap_stylized")}
          </span>
        )}
      </div>
    </div>
  );
}
