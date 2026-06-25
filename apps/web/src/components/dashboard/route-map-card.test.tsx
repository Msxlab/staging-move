import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  RouteMapCard,
  buildRouteMapImageSources,
  buildRouteMapSrc,
  hslTripletToHex,
  nextRouteMapSrcAfterError,
  resolveActiveRouteCoords,
  routeMarkerCorners,
} from "./route-map-card";

// lucide-react ships its own nested React copy, which breaks hooks under the
// test renderer — stub the icon used by the card with a plain SVG.
vi.mock("lucide-react", () => ({
  Map: (props: { className?: string }) => <svg data-lucide="map" className={props.className} />,
}));

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({
    theme: "dark" as const,
    preference: "dark" as const,
    setTheme: () => {},
    toggleTheme: () => {},
  }),
}));

// Resolve translations from the REAL en.json catalog so a copy regression in
// the catalog fails here, not just in review (home-dossier test pattern).
vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<
    string,
    Record<string, string>
  >;
  const useTranslations = () => (key: string, vars?: Record<string, unknown>) => {
    const raw = en.dashboard?.[key];
    if (typeof raw !== "string") throw new Error(`Missing dashboard.${key} in en.json`);
    return raw.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
  };
  return { useTranslations };
});

const CHI = { id: "addr-from", latitude: 41.8781, longitude: -87.6298 };
const ATX = { id: "addr-to", latitude: 30.2672, longitude: -97.7431 };

describe("resolveActiveRouteCoords", () => {
  const plan = (overrides: Record<string, unknown> = {}) => ({
    id: "plan-1",
    status: "IN_PROGRESS",
    fromAddressId: "addr-from",
    toAddressId: "addr-to",
    ...overrides,
  });

  it("resolves both endpoints for an in-progress plan", () => {
    expect(resolveActiveRouteCoords([plan()], [CHI, ATX])).toEqual({
      from: { lat: 41.8781, lng: -87.6298 },
      to: { lat: 30.2672, lng: -97.7431 },
    });
  });

  it("prefers IN_PROGRESS over PLANNING and never picks terminal plans", () => {
    const planning = plan({ id: "p2", status: "PLANNING", fromAddressId: "addr-to", toAddressId: "addr-from" });
    const completed = plan({ id: "p3", status: "COMPLETED" });

    const preferred = resolveActiveRouteCoords([completed, planning, plan()], [CHI, ATX]);
    expect(preferred?.from.lat).toBe(41.8781);

    // PLANNING fallback (reversed endpoints prove which plan was used)
    const fallback = resolveActiveRouteCoords([completed, planning], [CHI, ATX]);
    expect(fallback?.from.lat).toBe(30.2672);

    // terminal-only → null
    expect(resolveActiveRouteCoords([completed], [CHI, ATX])).toBeNull();
  });

  it("returns null when either endpoint lacks finite coordinates", () => {
    expect(resolveActiveRouteCoords([plan()], [CHI, { id: "addr-to", latitude: null, longitude: -97 }])).toBeNull();
    expect(resolveActiveRouteCoords([plan()], [CHI])).toBeNull();
    expect(resolveActiveRouteCoords([plan()], [CHI, { id: "addr-to", latitude: Number.NaN, longitude: -97 }])).toBeNull();
  });

  it("falls back to nested moving-plan coordinates when the address feed is incomplete", () => {
    expect(
      resolveActiveRouteCoords(
        [
          plan({
            fromAddress: { latitude: 41.8781, longitude: -87.6298 },
            toAddress: { latitude: 30.2672, longitude: -97.7431 },
          }),
        ],
        [],
      ),
    ).toEqual({
      from: { lat: 41.8781, lng: -87.6298 },
      to: { lat: 30.2672, lng: -97.7431 },
    });
  });

  it("tolerates malformed feeds", () => {
    expect(resolveActiveRouteCoords(undefined, [CHI, ATX])).toBeNull();
    expect(resolveActiveRouteCoords([plan()], "nope")).toBeNull();
    expect(resolveActiveRouteCoords([null, plan({ fromAddressId: 7 })], [CHI, ATX])).toBeNull();
  });
});

describe("routeMarkerCorners", () => {
  it("anchors each endpoint to its true north-up corner (origin north+east → top-right)", () => {
    // Chicago (origin) is north + east of Austin (destination): the OLD-home /
    // origin marker must land top-right and NEW-home / destination bottom-left,
    // not the fixed old=bottom-left default that read as swapped on the basemap.
    const corners = routeMarkerCorners({
      from: { lat: CHI.latitude, lng: CHI.longitude },
      to: { lat: ATX.latitude, lng: ATX.longitude },
    });
    expect(corners).toEqual({
      from: { x: "right", y: "top" },
      to: { x: "left", y: "bottom" },
    });
  });

  it("places the destination diagonally opposite the origin (origin south+west → bottom-left)", () => {
    const corners = routeMarkerCorners({
      from: { lat: ATX.latitude, lng: ATX.longitude },
      to: { lat: CHI.latitude, lng: CHI.longitude },
    });
    expect(corners).toEqual({
      from: { x: "left", y: "bottom" },
      to: { x: "right", y: "top" },
    });
  });

  it("returns null without coordinates so the stylized canvas keeps its default diagonal", () => {
    expect(routeMarkerCorners(null)).toBeNull();
  });
});

describe("hslTripletToHex", () => {
  it("converts the Gold/Sapphire token shapes from globals.css", () => {
    expect(hslTripletToHex("38.53 51.17% 58.24%")).toBe("CBA45E"); // .plan-free/.plan-family/.plan-pro (dark)
    expect(hslTripletToHex("217.38 58.56% 43.53%")).toBe("2E5FB0"); // .light plan classes
    expect(hslTripletToHex("0 0% 100%")).toBe("FFFFFF");
    expect(hslTripletToHex(" 38.53 51.17% 58.24% ")).toMatch(/^[0-9A-F]{6}$/);
  });

  it("returns null for unparseable values", () => {
    expect(hslTripletToHex("")).toBeNull();
    expect(hslTripletToHex("#5B8DEF")).toBeNull();
    expect(hslTripletToHex("347 100%")).toBeNull();
  });
});

describe("buildRouteMapSrc", () => {
  it("builds the same-origin proxy URL with rounded coords, size, theme, and accent", () => {
    const src = buildRouteMapSrc(
      { lat: 41.87810001234, lng: -87.62980004321 },
      { lat: 30.2672, lng: -97.7431 },
      { width: 640, height: 224, theme: "dark", accent: "#CBA45E" },
    );
    expect(src).toBe(
      "/api/maps/static?from=41.8781%2C-87.6298&to=30.2672%2C-97.7431&w=640&h=224&theme=dark&accent=CBA45E",
    );
  });

  it("omits the accent param when no accent resolved", () => {
    const src = buildRouteMapSrc(
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
      { width: 320, height: 160, theme: "light", accent: null },
    );
    expect(src).toContain("theme=light");
    expect(src).not.toContain("accent=");
  });

  it("can build the OSM preview fallback URL", () => {
    const src = buildRouteMapSrc(
      { lat: 41.8781, lng: -87.6298 },
      { lat: 30.2672, lng: -97.7431 },
      { width: 640, height: 224, theme: "dark", accent: "#CBA45E", preview: true },
    );
    expect(src).toContain("preview=1");
    expect(src).toContain("accent=CBA45E");
  });
});

describe("nextRouteMapSrcAfterError", () => {
  it("falls back from the full map to the preview map once", () => {
    const full = "/api/maps/static?from=1%2C2&to=3%2C4";
    const preview = "/api/maps/static?from=1%2C2&to=3%2C4&preview=1";
    expect(nextRouteMapSrcAfterError(full, preview)).toBe(preview);
    expect(nextRouteMapSrcAfterError(preview, preview)).toBeNull();
    expect(nextRouteMapSrcAfterError(full, null)).toBeNull();
  });
});

describe("buildRouteMapImageSources", () => {
  it("uses the full map first for entitled plans and keeps the preview fallback", () => {
    const sources = buildRouteMapImageSources(
      { from: { lat: 1, lng: 2 }, to: { lat: 3, lng: 4 } },
      { width: 640, height: 224, theme: "dark", accent: "FF9DB2" },
      true,
    );

    expect(sources.initialSrc).not.toContain("preview=1");
    expect(sources.previewSrc).toContain("preview=1");
  });

  it("uses the preview source first when the rich realMap entitlement is absent", () => {
    const sources = buildRouteMapImageSources(
      { from: { lat: 1, lng: 2 }, to: { lat: 3, lng: 4 } },
      { width: 640, height: 224, theme: "dark", accent: "FF9DB2" },
      false,
    );

    expect(sources.initialSrc).toBe(sources.previewSrc);
    expect(sources.initialSrc).toContain("preview=1");
  });
});

describe("route map catalog", () => {
  it("keeps en/es routeMap keys in parity (including the new imageAlt)", async () => {
    const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<string, Record<string, string>>;
    const es = (await import("@/i18n/messages/es.json")).default as unknown as Record<string, Record<string, string>>;
    const routeMapKeys = (cat: Record<string, Record<string, string>>) =>
      Object.keys(cat.dashboard).filter((k) => k.startsWith("routeMap_") || k === "widget_routeMap").sort();
    expect(routeMapKeys(en)).toEqual(routeMapKeys(es));
    expect(routeMapKeys(en)).toContain("routeMap_imageAlt");
    expect(en.dashboard.routeMap_imageAlt).toContain("{from}");
  });
});

describe("route map light chrome", () => {
  it("uses light paper labels instead of dark overlay labels in light mode", () => {
    const globals = readFileSync(new URL("../../styles/globals.css", import.meta.url), "utf8");
    const start = globals.indexOf(".light .lf-route-map-label {");
    const end = globals.indexOf(".light .lf-route-map-label[data-endpoint=\"from\"]", start);
    const block = globals.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(block).toContain("#F5F0E7");
    expect(block).not.toContain("rgba(10, 15, 28");
  });
});

describe("RouteMapCard markup", () => {
  it("renders the stylized fallback canvas (never a broken image) before any map resolves", () => {
    const html = renderToStaticMarkup(<RouteMapCard fromCity="Chicago" toCity="Austin" />);

    // header chrome + route line
    expect(html).toContain("Route Map");
    expect(html).toContain("Relocation route");
    expect(html).toContain("Chicago");
    expect(html).toContain("Austin");
    // overlay labels from the real catalog
    expect(html).toContain("Old home");
    expect(html).toContain("New home");
    expect(html).toContain("lf-route-map-label");
    expect(html).toContain('data-endpoint="from"');
    expect(html).toContain('data-endpoint="to"');
    // stylized fallback is showing, and no <img> exists yet
    expect(html).toContain("Stylized view");
    expect(html).not.toContain("<img");
  });

  it("renders the stylized fallback before the preview source resolves when realMap is gated off", () => {
    const html = renderToStaticMarkup(
      <RouteMapCard fromCity="Chicago" toCity="Austin" realMap={false} />,
    );
    expect(html).toContain("Stylized view");
    expect(html).not.toContain("<img");
    // Card chrome stays identical to the entitled card (only the basemap differs).
    expect(html).toContain("Chicago");
    expect(html).toContain("Austin");
  });
});
