import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWaterSystemCache,
  countRecentHealthViolations,
  lookupWaterSystem,
  pickLargestCommunitySystem,
} from "./epa-water";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDaysAgo(days: number): string {
  // Envirofacts date format: "YYYY-MM-DD HH:MM:SS".
  return `${new Date(Date.now() - days * MS_PER_DAY).toISOString().slice(0, 10)} 00:00:00`;
}

const SYSTEM_ROW = {
  pwsid: "IN5272002",
  pws_name: "STUCKER FORK WATER UTILITY",
  pws_type_code: "CWS",
  pws_activity_code: "A",
  population_served_count: 19120,
};

const INPUT = { city: "Austin", state: "IN" };

describe("epa-water community water system lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearWaterSystemCache();
  });

  it("returns no_location without fetching when city or state is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupWaterSystem({ city: null, state: null })).status).toBe("no_location");
    expect((await lookupWaterSystem({ city: "Austin", state: "" })).status).toBe("no_location");
    expect((await lookupWaterSystem({ city: "  ", state: "TX" })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the joined GEOGRAPHIC_AREA→WATER_SYSTEM endpoint, then the matched system's health-based violations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([SYSTEM_ROW]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWaterSystem(INPUT);

    const systemsUrl = String(fetchMock.mock.calls[0][0]);
    expect(systemsUrl).toBe(
      "https://data.epa.gov/efservice/GEOGRAPHIC_AREA/CITY_SERVED/AUSTIN/STATE_SERVED/IN/WATER_SYSTEM/JSON",
    );
    const violationsUrl = String(fetchMock.mock.calls[1][0]);
    expect(violationsUrl).toBe(
      "https://data.epa.gov/efservice/VIOLATION/PWSID/IN5272002/IS_HEALTH_BASED_IND/Y/JSON",
    );
    expect(result).toMatchObject({
      status: "ok",
      systemName: "STUCKER FORK WATER UTILITY",
      pwsid: "IN5272002",
      populationServed: 19120,
      violations5y: 0,
    });
  });

  it("picks the ACTIVE COMMUNITY system serving the largest population", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { ...SYSTEM_ROW, pwsid: "TX0000001", pws_name: "SMALL MUD", population_served_count: 900 },
          { ...SYSTEM_ROW, pwsid: "TX0000002", pws_name: "BIG CITY WATER", population_served_count: 500000 },
          // Non-community and inactive systems never qualify, however large.
          { ...SYSTEM_ROW, pwsid: "TX0000003", pws_name: "CAMPGROUND WELL", pws_type_code: "TNCWS", population_served_count: 999999 },
          { ...SYSTEM_ROW, pwsid: "TX0000004", pws_name: "DEFUNCT WATER CO", pws_activity_code: "I", population_served_count: 999999 },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWaterSystem({ city: "Springfield", state: "TX" });

    expect(result.systemName).toBe("BIG CITY WATER");
    expect(result.pwsid).toBe("TX0000002");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/PWSID/TX0000002/");
  });

  it("returns ok with honest nulls (no second call) when no active community system matches", async () => {
    // Real-world case: systems registered only by county (e.g. Austin TX) —
    // never guess; report "couldn't identify the system".
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWaterSystem({ city: "Austin", state: "TX" });

    expect(result).toMatchObject({ status: "ok", systemName: null, pwsid: null, violations5y: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("counts only health-based violations from the last 5 years", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([SYSTEM_ROW]))
      .mockResolvedValueOnce(
        jsonResponse([
          { is_health_based_ind: "Y", compl_per_begin_date: isoDaysAgo(30) }, // counts
          { is_health_based_ind: "Y", compl_per_begin_date: isoDaysAgo(4 * 365) }, // counts
          { is_health_based_ind: "Y", compl_per_begin_date: isoDaysAgo(6 * 365) }, // too old
          { is_health_based_ind: "N", compl_per_begin_date: isoDaysAgo(10) }, // not health-based
          { is_health_based_ind: "Y", compl_per_begin_date: null }, // unparseable → excluded
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWaterSystem(INPUT);

    expect(result.status).toBe("ok");
    expect(result.violations5y).toBe(2);
  });

  it("degrades the WHOLE section to error when the violations call fails (never a system with an unknown record)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([SYSTEM_ROW]))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupWaterSystem(INPUT);

    expect(result.status).toBe("error");
    expect(result.systemName).toBeNull();
    expect(result.violations5y).toBeNull();
  });

  it("degrades to error (not throw) on network failure and non-2xx / non-array payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect((await lookupWaterSystem(INPUT)).status).toBe("error");

    clearWaterSystemCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    expect((await lookupWaterSystem(INPUT)).status).toBe("error");

    clearWaterSystemCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })));
    expect((await lookupWaterSystem(INPUT)).status).toBe("error");
  });

  it("caches ok results per city+state (case-insensitive) but never caches errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([SYSTEM_ROW]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupWaterSystem(INPUT)).systemName).toBe("STUCKER FORK WATER UTILITY");
    // Different casing hits the same cache entry — no third fetch.
    expect((await lookupWaterSystem({ city: "AUSTIN", state: "in" })).systemName).toBe(
      "STUCKER FORK WATER UTILITY",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2); // systems + violations only

    clearWaterSystemCache();
    const failingFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(jsonResponse([SYSTEM_ROW]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", failingFetch);
    expect((await lookupWaterSystem(INPUT)).status).toBe("error");
    expect((await lookupWaterSystem(INPUT)).status).toBe("ok");
  });

  describe("pickLargestCommunitySystem", () => {
    it("breaks population ties deterministically by PWSID", () => {
      const pick = pickLargestCommunitySystem([
        { ...SYSTEM_ROW, pwsid: "TX0000002", population_served_count: 100 },
        { ...SYSTEM_ROW, pwsid: "TX0000001", population_served_count: 100 },
      ]);
      expect(pick?.pwsid).toBe("TX0000001");
    });

    it("treats a missing population as smaller than any reported population", () => {
      const pick = pickLargestCommunitySystem([
        { ...SYSTEM_ROW, pwsid: "TX0000001", population_served_count: null },
        { ...SYSTEM_ROW, pwsid: "TX0000002", population_served_count: 5 },
      ]);
      expect(pick?.pwsid).toBe("TX0000002");
    });
  });

  describe("countRecentHealthViolations", () => {
    it("excludes malformed dates instead of inflating the count", () => {
      expect(
        countRecentHealthViolations([
          { is_health_based_ind: "Y", compl_per_begin_date: "not-a-date" },
          { is_health_based_ind: "Y", compl_per_begin_date: "" },
          { is_health_based_ind: "Y", compl_per_begin_date: isoDaysAgo(1) },
        ]),
      ).toBe(1);
    });
  });
});
