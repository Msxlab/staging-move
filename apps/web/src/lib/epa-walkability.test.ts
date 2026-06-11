import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyWalkBand, clearWalkabilityCache, lookupWalkability, parseWalkScore } from "./epa-walkability";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const COORDS = { latitude: 30.2672, longitude: -97.7431 };

describe("epa-walkability pure helpers", () => {
  it("classifyWalkBand buckets a 1–20 index per the EPA methodology bins", () => {
    expect(classifyWalkBand(1)).toBe("least");
    expect(classifyWalkBand(5.75)).toBe("least");
    expect(classifyWalkBand(5.76)).toBe("below_average");
    expect(classifyWalkBand(10.5)).toBe("below_average");
    expect(classifyWalkBand(10.51)).toBe("above_average");
    expect(classifyWalkBand(15.25)).toBe("above_average");
    expect(classifyWalkBand(15.26)).toBe("most");
    expect(classifyWalkBand(20)).toBe("most");
    // Out of range / null → unknown (never a fabricated band).
    expect(classifyWalkBand(0)).toBe("unknown");
    expect(classifyWalkBand(21)).toBe("unknown");
    expect(classifyWalkBand(null)).toBe("unknown");
  });

  it("parseWalkScore accepts a finite 1–20 double, rounds to 1 decimal, rejects junk", () => {
    expect(parseWalkScore(18.833333333)).toBe(18.8);
    expect(parseWalkScore(1)).toBe(1);
    expect(parseWalkScore(20)).toBe(20);
    expect(parseWalkScore(0.5)).toBeNull();
    expect(parseWalkScore(25)).toBeNull();
    expect(parseWalkScore("18.8")).toBeNull();
    expect(parseWalkScore(null)).toBeNull();
    expect(parseWalkScore(Number.NaN)).toBeNull();
  });
});

describe("lookupWalkability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearWalkabilityCache();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await lookupWalkability({ latitude: null, longitude: null })).status).toBe("no_location");
    expect((await lookupWalkability({ longitude: -97 })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the score + band for a live block-group answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ features: [{ attributes: { NatWalkInd: 18.833333 } }] })),
    );
    const result = await lookupWalkability(COORDS);
    expect(result.status).toBe("ok");
    expect(result.score).toBe(18.8);
    expect(result.band).toBe("most");
  });

  it("reports ok with a null score when the point has no mapped block group", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ features: [] })));
    const result = await lookupWalkability(COORDS);
    expect(result.status).toBe("ok");
    expect(result.score).toBeNull();
    expect(result.band).toBe("unknown");
  });

  it("degrades to error on an ArcGIS error payload (HTTP 200 + error object)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code: 400 } })));
    expect((await lookupWalkability(COORDS)).status).toBe("error");
  });

  it("degrades to error on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    expect((await lookupWalkability(COORDS)).status).toBe("error");
  });

  it("degrades to error when fetch rejects (never throws into the caller)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect((await lookupWalkability(COORDS)).status).toBe("error");
  });
});
