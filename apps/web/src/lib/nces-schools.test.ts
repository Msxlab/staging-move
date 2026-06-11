import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearNearbySchoolsCache,
  lookupNearbySchools,
  normalizeSchoolLevel,
  selectNearbySchools,
} from "./nces-schools";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const COORDS = { latitude: 30.2672, longitude: -97.7431 };

/** A raw ArcGIS feature for the HIFLD/ORNL Public Schools layer. */
function feature(name: string, level: string | null, status: number, x: number, y: number) {
  return { attributes: { NAME: name, LEVEL_: level, STATUS: status }, geometry: { x, y } };
}

describe("nces-schools pure helpers", () => {
  it("normalizeSchoolLevel maps known levels and nulls unknown/unreported (never guessed)", () => {
    expect(normalizeSchoolLevel("ELEMENTARY")).toBe("Elementary");
    expect(normalizeSchoolLevel("middle")).toBe("Middle");
    expect(normalizeSchoolLevel(" High ")).toBe("High");
    expect(normalizeSchoolLevel("OTHER")).toBe("Other");
    expect(normalizeSchoolLevel("NOT REPORTED")).toBeNull();
    expect(normalizeSchoolLevel("")).toBeNull();
    expect(normalizeSchoolLevel("M")).toBeNull();
    expect(normalizeSchoolLevel(null)).toBeNull();
    expect(normalizeSchoolLevel(42)).toBeNull();
  });

  it("selectNearbySchools sorts by distance, drops closed/unnamed/duplicates, caps the list", () => {
    const features = [
      feature("Far High", "HIGH", 1, -97.80, 30.30), // farther
      feature("Closed School", "ELEMENTARY", 2, -97.7432, 30.2673), // STATUS != 1 → dropped
      feature("Near Elementary", "ELEMENTARY", 1, -97.7432, 30.2673), // closest
      feature("", "MIDDLE", 1, -97.744, 30.268), // unnamed → dropped
      feature("Near Elementary", "ELEMENTARY", 1, -97.7433, 30.2674), // duplicate name → dropped
      feature("Mid Middle", "MIDDLE", 1, -97.75, 30.27), // middle distance
    ];
    const result = selectNearbySchools(features, COORDS.latitude, COORDS.longitude);
    expect(result).toEqual([
      { name: "Near Elementary", level: "Elementary" },
      { name: "Mid Middle", level: "Middle" },
      { name: "Far High", level: "High" },
    ]);
  });

  it("selectNearbySchools tolerates missing geometry (sorted last, still listed)", () => {
    const features = [
      { attributes: { NAME: "No Geo", LEVEL_: "HIGH", STATUS: 1 }, geometry: null },
      feature("Has Geo", "ELEMENTARY", 1, -97.7432, 30.2673),
    ];
    const result = selectNearbySchools(features, COORDS.latitude, COORDS.longitude);
    expect(result.map((s) => s.name)).toEqual(["Has Geo", "No Geo"]);
  });
});

describe("lookupNearbySchools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearNearbySchoolsCache();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await lookupNearbySchools({ latitude: null, longitude: null })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the nearest open schools for a live answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          features: [
            feature("Zilker Elementary", "ELEMENTARY", 1, -97.7432, 30.2673),
            feature("Austin High School", "HIGH", 1, -97.75, 30.27),
          ],
        }),
      ),
    );
    const result = await lookupNearbySchools(COORDS);
    expect(result.status).toBe("ok");
    expect(result.schools).toEqual([
      { name: "Zilker Elementary", level: "Elementary" },
      { name: "Austin High School", level: "High" },
    ]);
  });

  it("returns ok with an empty list when no schools fall in the radius", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ features: [] })));
    const result = await lookupNearbySchools(COORDS);
    expect(result.status).toBe("ok");
    expect(result.schools).toEqual([]);
  });

  it("degrades to error on an ArcGIS error payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code: 400 } })));
    expect((await lookupNearbySchools(COORDS)).status).toBe("error");
  });

  it("degrades to error when fetch rejects (never throws into the caller)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect((await lookupNearbySchools(COORDS)).status).toBe("error");
  });
});
