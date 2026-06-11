import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  RouteMapCard,
  buildRouteMapSrc,
  hslTripletToHex,
  resolveActiveRouteCoords,
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

  it("tolerates malformed feeds", () => {
    expect(resolveActiveRouteCoords(undefined, [CHI, ATX])).toBeNull();
    expect(resolveActiveRouteCoords([plan()], "nope")).toBeNull();
    expect(resolveActiveRouteCoords([null, plan({ fromAddressId: 7 })], [CHI, ATX])).toBeNull();
  });
});

describe("hslTripletToHex", () => {
  it("converts the plan-accent token shapes from globals.css", () => {
    expect(hslTripletToHex("347 100% 81%")).toBe("FF9EB3"); // .plan-free (dark)
    expect(hslTripletToHex("207 67% 70%")).toBe("7FB8E6"); // default --primary (dark) ≈ #7FB6E8
    expect(hslTripletToHex("0 0% 100%")).toBe("FFFFFF");
    expect(hslTripletToHex(" 41 85% 68% ")).toMatch(/^[0-9A-F]{6}$/);
  });

  it("returns null for unparseable values", () => {
    expect(hslTripletToHex("")).toBeNull();
    expect(hslTripletToHex("#FF9DB2")).toBeNull();
    expect(hslTripletToHex("347 100%")).toBeNull();
  });
});

describe("buildRouteMapSrc", () => {
  it("builds the same-origin proxy URL with rounded coords, size, theme, and accent", () => {
    const src = buildRouteMapSrc(
      { lat: 41.87810001234, lng: -87.62980004321 },
      { lat: 30.2672, lng: -97.7431 },
      { width: 640, height: 224, theme: "dark", accent: "#FF9DB2" },
    );
    expect(src).toBe(
      "/api/maps/static?from=41.8781%2C-87.6298&to=30.2672%2C-97.7431&w=640&h=224&theme=dark&accent=FF9DB2",
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
    // stylized fallback is showing, and no <img> exists yet
    expect(html).toContain("Stylized view");
    expect(html).not.toContain("<img");
  });
});
