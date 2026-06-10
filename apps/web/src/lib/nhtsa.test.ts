import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVehicleCache,
  isValidVin,
  lookupVehicleByVin,
  normalizeVin,
} from "./nhtsa";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VIN = "2HKRW2H59KH601234"; // syntactically valid (17 chars, no I/O/Q)

function vpicPayload(row: Record<string, unknown>) {
  return { Count: 1, Message: "Results returned successfully", Results: [row] };
}

const VPIC_OK = vpicPayload({ Make: "HONDA", Model: "CR-V", ModelYear: "2019" });

function recallsPayload(count: number, rows: Array<Record<string, unknown>>) {
  return { Count: count, Message: "Results returned successfully", results: rows };
}

const RECALLS_OK = recallsPayload(2, [
  {
    NHTSACampaignNumber: "19V182000",
    Component: "FUEL SYSTEM, GASOLINE",
    Summary: "Fuel pump may fail.",
  },
  {
    NHTSACampaignNumber: "20V314000",
    Component: "AIR BAGS",
    Summary: "Inflator may rupture.",
  },
]);

describe("nhtsa VIN helpers", () => {
  it("normalizes raw input (trim + uppercase)", () => {
    expect(normalizeVin("  2hkrw2h59kh601234 ")).toBe("2HKRW2H59KH601234");
    expect(normalizeVin(null)).toBe("");
    expect(normalizeVin(undefined)).toBe("");
  });

  it("accepts only 17-character VINs without I/O/Q", () => {
    expect(isValidVin(VIN)).toBe(true);
    expect(isValidVin("2HKRW2H59KH60123")).toBe(false); // 16 chars
    expect(isValidVin("2HKRW2H59KH6012345")).toBe(false); // 18 chars
    expect(isValidVin("IHKRW2H59KH601234")).toBe(false); // contains I
    expect(isValidVin("OHKRW2H59KH601234")).toBe(false); // contains O
    expect(isValidVin("QHKRW2H59KH601234")).toBe(false); // contains Q
    expect(isValidVin("")).toBe(false);
  });
});

describe("nhtsa vehicle lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearVehicleCache();
  });

  it("returns invalid_vin without fetching for a syntactically bad VIN", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const bad of ["", "SHORT", "IHKRW2H59KH601234", "2HKRW2H59KH60123!"]) {
      const result = await lookupVehicleByVin(bad);
      expect(result.status).toBe("invalid_vin");
      expect(result.vehicle).toBeNull();
      expect(result.recalls).toEqual({ status: "unavailable", count: null, topItems: [] });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decodes via vPIC then queries recalls by make/model/modelYear", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(VPIC_OK))
      .mockResolvedValueOnce(jsonResponse(RECALLS_OK));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupVehicleByVin(VIN);

    expect(result.status).toBe("ok");
    expect(result.vehicle).toEqual({ vin: VIN, year: 2019, make: "HONDA", model: "CR-V" });
    expect(result.recalls).toEqual({
      status: "ok",
      count: 2,
      topItems: [
        {
          campaignNumber: "19V182000",
          component: "FUEL SYSTEM, GASOLINE",
          summary: "Fuel pump may fail.",
        },
        {
          campaignNumber: "20V314000",
          component: "AIR BAGS",
          summary: "Inflator may rupture.",
        },
      ],
    });

    const decodeUrl = String(fetchMock.mock.calls[0][0]);
    expect(decodeUrl).toContain(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${VIN}`);
    expect(decodeUrl).toContain("format=json");

    const recallsUrl = String(fetchMock.mock.calls[1][0]);
    expect(recallsUrl).toContain("https://api.nhtsa.gov/recalls/recallsByVehicle");
    expect(recallsUrl).toContain("make=HONDA");
    expect(recallsUrl).toContain("model=CR-V");
    expect(recallsUrl).toContain("modelYear=2019");
  });

  it("normalizes a lowercase, padded VIN before decoding", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(VPIC_OK))
      .mockResolvedValueOnce(jsonResponse(recallsPayload(0, [])));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupVehicleByVin(`  ${VIN.toLowerCase()} `);

    expect(result.status).toBe("ok");
    expect(result.vehicle?.vin).toBe(VIN);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/decodevinvalues/${VIN}`);
  });

  it("reports zero recalls honestly (ok, count 0, no items)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(VPIC_OK))
        .mockResolvedValueOnce(jsonResponse(recallsPayload(0, []))),
    );

    const result = await lookupVehicleByVin(VIN);
    expect(result.status).toBe("ok");
    expect(result.recalls).toEqual({ status: "ok", count: 0, topItems: [] });
  });

  it("caps topItems at 3 while keeping the full count", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      NHTSACampaignNumber: `21V00${i}000`,
      Component: `COMPONENT ${i}`,
      Summary: `Summary ${i}`,
    }));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(VPIC_OK))
        .mockResolvedValueOnce(jsonResponse(recallsPayload(5, rows))),
    );

    const result = await lookupVehicleByVin(VIN);
    expect(result.recalls.count).toBe(5);
    expect(result.recalls.topItems).toHaveLength(3);
    expect(result.recalls.topItems[0].campaignNumber).toBe("21V000000");
  });

  it("returns no_match when vPIC decodes nothing usable (and never calls recalls)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(vpicPayload({ Make: "", Model: null, ModelYear: "0" })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupVehicleByVin(VIN);
    expect(result.status).toBe("no_match");
    expect(result.vehicle).toBeNull();
    expect(result.recalls.status).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a partial decode (no year) as ok but reports recalls unavailable without querying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(vpicPayload({ Make: "HONDA", Model: "CR-V", ModelYear: "" })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupVehicleByVin(VIN);
    expect(result.status).toBe("ok");
    expect(result.vehicle).toEqual({ vin: VIN, year: null, make: "HONDA", model: "CR-V" });
    expect(result.recalls).toEqual({ status: "unavailable", count: null, topItems: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1); // recalls API never called
  });

  it("degrades to error (not throw) when the vPIC call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await lookupVehicleByVin(VIN);
    expect(result.status).toBe("error");
    expect(result.vehicle).toBeNull();
  });

  it("degrades to error on a non-2xx vPIC response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    expect((await lookupVehicleByVin(VIN)).status).toBe("error");
  });

  it("survives a recalls failure: vehicle ok, recalls unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(VPIC_OK))
        .mockRejectedValueOnce(new Error("recalls down")),
    );

    const result = await lookupVehicleByVin(VIN);
    expect(result.status).toBe("ok");
    expect(result.vehicle?.make).toBe("HONDA");
    expect(result.recalls).toEqual({ status: "unavailable", count: null, topItems: [] });
  });

  it("caches fully-ok answers per VIN (no second fetch)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(VPIC_OK))
      .mockResolvedValueOnce(jsonResponse(RECALLS_OK));
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupVehicleByVin(VIN)).recalls.count).toBe(2);
    expect((await lookupVehicleByVin(VIN)).recalls.count).toBe(2); // served from cache
    expect(fetchMock).toHaveBeenCalledTimes(2); // decode + recalls, once each
  });

  it("never caches errors or recall-degraded answers (next call retries)", async () => {
    // 1st call: decode fails entirely.
    const failingFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      // 2nd call: decode ok, recalls fail → ok-but-unavailable, still uncached.
      .mockResolvedValueOnce(jsonResponse(VPIC_OK))
      .mockRejectedValueOnce(new Error("recalls blip"))
      // 3rd call: both succeed.
      .mockResolvedValueOnce(jsonResponse(VPIC_OK))
      .mockResolvedValueOnce(jsonResponse(RECALLS_OK));
    vi.stubGlobal("fetch", failingFetch);

    expect((await lookupVehicleByVin(VIN)).status).toBe("error");
    const second = await lookupVehicleByVin(VIN);
    expect(second.status).toBe("ok");
    expect(second.recalls.status).toBe("unavailable");
    const third = await lookupVehicleByVin(VIN);
    expect(third.recalls).toMatchObject({ status: "ok", count: 2 });
    expect(failingFetch).toHaveBeenCalledTimes(5);
  });

  it("caches the authoritative no_match answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(vpicPayload({ Make: "", Model: "", ModelYear: "" })));
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupVehicleByVin(VIN)).status).toBe("no_match");
    expect((await lookupVehicleByVin(VIN)).status).toBe("no_match"); // cached
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drops malformed recall rows instead of rendering empty items", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(VPIC_OK))
        .mockResolvedValueOnce(
          jsonResponse(
            recallsPayload(2, [
              { NHTSACampaignNumber: "", Component: "  ", Summary: null },
              { NHTSACampaignNumber: "22V100000", Component: "BRAKES", Summary: "Brake hose may leak." },
            ]),
          ),
        ),
    );

    const result = await lookupVehicleByVin(VIN);
    expect(result.recalls.count).toBe(2);
    expect(result.recalls.topItems).toEqual([
      { campaignNumber: "22V100000", component: "BRAKES", summary: "Brake hose may leak." },
    ]);
  });

  it("rejects implausible model years instead of inventing one", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(vpicPayload({ Make: "HONDA", Model: "CR-V", ModelYear: "3025" }))),
    );

    const result = await lookupVehicleByVin(VIN);
    expect(result.status).toBe("ok");
    expect(result.vehicle?.year).toBeNull();
  });
});
