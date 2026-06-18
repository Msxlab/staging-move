import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import {
  buildTransitRouteMapPath,
  resolveTransitRouteCoords,
} from "./transit-route-map-url";

const CHI = { id: "addr-from", latitude: 41.8781, longitude: -87.6298 };
const ATX = { id: "addr-to", latitude: 30.2672, longitude: -97.7431 };

describe("resolveTransitRouteCoords", () => {
  const move = (overrides: Record<string, unknown> = {}) => ({
    id: "plan-1",
    status: "IN_PROGRESS",
    fromAddressId: "addr-from",
    toAddressId: "addr-to",
    // mirrors /api/moving's nested select: street/city/state/zip — NO id
    fromAddress: { city: "Chicago", state: "IL" },
    toAddress: { city: "Austin", state: "TX" },
    ...overrides,
  });

  it("resolves coordinates via the plan's fromAddressId/toAddressId", () => {
    expect(resolveTransitRouteCoords(move(), [CHI, ATX])).toEqual({
      from: { lat: 41.8781, lng: -87.6298 },
      to: { lat: 30.2672, lng: -97.7431 },
    });
  });

  it("falls back to nested address ids when the spread ids are absent", () => {
    const legacyMove = move({
      fromAddressId: undefined,
      toAddressId: undefined,
      fromAddress: { id: "addr-from", city: "Chicago" },
      toAddress: { id: "addr-to", city: "Austin" },
    });
    expect(resolveTransitRouteCoords(legacyMove, [CHI, ATX])).not.toBeNull();
  });

  it("returns null when an endpoint has no saved location", () => {
    expect(resolveTransitRouteCoords(move(), [CHI, { id: "addr-to", latitude: null, longitude: null }])).toBeNull();
    expect(resolveTransitRouteCoords(move(), [CHI])).toBeNull();
    expect(
      resolveTransitRouteCoords(move(), [CHI, { id: "addr-to", latitude: Number.NaN, longitude: -97 }]),
    ).toBeNull();
  });

  it("tolerates malformed inputs", () => {
    expect(resolveTransitRouteCoords(null, [CHI, ATX])).toBeNull();
    expect(resolveTransitRouteCoords(move(), undefined as never)).toBeNull();
    expect(resolveTransitRouteCoords("nope", [CHI, ATX])).toBeNull();
  });
});

describe("buildTransitRouteMapPath", () => {
  const from = { lat: 41.87810001234, lng: -87.6298 };
  const to = { lat: 30.2672, lng: -97.7431 };

  it("builds the proxy path with rounded coords, clamped size, theme, and accent", () => {
    const path = buildTransitRouteMapPath(from, to, {
      width: 351.4,
      height: 112,
      theme: "dark",
      accent: "#ff9db2",
    });
    expect(path).toBe(
      "/maps/static?from=41.8781%2C-87.6298&to=30.2672%2C-97.7431&w=351&h=112&theme=dark&accent=FF9DB2",
    );
  });

  it("clamps out-of-range dimensions into the proxy's accepted window", () => {
    const path = buildTransitRouteMapPath(from, to, { width: 9000, height: 10, theme: "light" });
    expect(path).toContain("w=640");
    expect(path).toContain("h=80");
    expect(path).toContain("theme=light");
  });

  it("drops invalid accents instead of sending garbage to the proxy", () => {
    const path = buildTransitRouteMapPath(from, to, {
      width: 320,
      height: 112,
      theme: "dark",
      accent: "tomato",
    });
    expect(path).not.toContain("accent=");
  });

  it("appends preview=1 only for the free OSM preview tier", () => {
    const full = buildTransitRouteMapPath(from, to, { width: 320, height: 112, theme: "dark" });
    expect(full).not.toContain("preview=");
    const preview = buildTransitRouteMapPath(from, to, { width: 320, height: 112, theme: "dark", preview: true });
    expect(preview).toContain("preview=1");
  });
});

describe("transit map catalog", () => {
  it("keeps en/es addresses.transit keys in parity (including mapAlt)", () => {
    const transitKeys = (catalog: { addresses: { transit: Record<string, string> } }) =>
      Object.keys(catalog.addresses.transit).sort();
    expect(transitKeys(en as never)).toEqual(transitKeys(es as never));
    expect((en as never as { addresses: { transit: Record<string, string> } }).addresses.transit.mapAlt).toContain(
      "{{from}}",
    );
  });
});
