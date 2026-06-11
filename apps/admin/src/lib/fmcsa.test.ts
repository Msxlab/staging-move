import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValue: (...args: unknown[]) => mocks.getAdminRuntimeConfigValue(...args),
}));

import {
  extractCarrier,
  extractHhgAuthorized,
  lookupFmcsaCarrier,
  normalizeSafetyRating,
  parseYesNo,
} from "./fmcsa";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function configure(key: string | null) {
  mocks.getAdminRuntimeConfigValue.mockImplementation(async (k: string) =>
    k === "FMCSA_WEBKEY" ? key : null,
  );
}

describe("fmcsa pure parsers", () => {
  it("parseYesNo maps Y/N variants and rejects junk", () => {
    expect(parseYesNo("Y")).toBe(true);
    expect(parseYesNo("yes")).toBe(true);
    expect(parseYesNo("N")).toBe(false);
    expect(parseYesNo("no")).toBe(false);
    expect(parseYesNo(true)).toBe(true);
    expect(parseYesNo("maybe")).toBeNull();
    expect(parseYesNo(null)).toBeNull();
  });

  it("normalizeSafetyRating expands S/C/U and nulls not-rated", () => {
    expect(normalizeSafetyRating("S")).toBe("Satisfactory");
    expect(normalizeSafetyRating("C")).toBe("Conditional");
    expect(normalizeSafetyRating("U")).toBe("Unsatisfactory");
    expect(normalizeSafetyRating("N")).toBeNull();
    expect(normalizeSafetyRating("Not Rated")).toBeNull();
    expect(normalizeSafetyRating("Satisfactory")).toBe("Satisfactory");
    expect(normalizeSafetyRating("")).toBeNull();
    expect(normalizeSafetyRating(null)).toBeNull();
  });

  it("extractCarrier reads content.carrier and the array-wrapped variant", () => {
    expect(extractCarrier({ content: { carrier: { legalName: "ACME" } } })).toEqual({ legalName: "ACME" });
    expect(extractCarrier({ content: [{ carrier: { legalName: "ACME" } }] })).toEqual({ legalName: "ACME" });
    expect(extractCarrier({ content: {} })).toBeNull();
    expect(extractCarrier(null)).toBeNull();
  });

  it("extractHhgAuthorized finds Household Goods in the cargo classes", () => {
    expect(extractHhgAuthorized({ content: [{ cargoClassDesc: "Household Goods" }] })).toBe(true);
    expect(extractHhgAuthorized({ content: { cargoClassList: [{ description: "General Freight" }] } })).toBe(false);
    expect(extractHhgAuthorized({ content: [] })).toBeNull();
    expect(extractHhgAuthorized({})).toBeNull();
  });
});

describe("lookupFmcsaCarrier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    configure("test-webkey");
  });

  it("returns not_configured without fetching when FMCSA_WEBKEY is unset", async () => {
    configure(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await lookupFmcsaCarrier(1234567);
    expect(res.status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the parsed carrier + HHG flag on a live answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          content: {
            carrier: { legalName: "Lone Star Moving", dbaName: null, allowedToOperate: "Y", safetyRating: "S", phyState: "tx" },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ content: [{ cargoClassDesc: "Household Goods" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await lookupFmcsaCarrier(1234567);
    expect(res).toMatchObject({
      status: "ok",
      legalName: "Lone Star Moving",
      authorityActive: true,
      hhgAuthorized: true,
      safetyRating: "Satisfactory",
      phyState: "TX",
    });
  });

  it("returns not_found when the carrier object is absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: {} })));
    expect((await lookupFmcsaCarrier(1234567)).status).toBe("not_found");
  });

  it("degrades to error on a non-2xx carrier response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    expect((await lookupFmcsaCarrier(1234567)).status).toBe("error");
  });

  it("keeps the carrier with hhg unknown when the cargo call fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ content: { carrier: { legalName: "ACME", allowedToOperate: "N", safetyRating: "C" } } }),
      )
      .mockRejectedValueOnce(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await lookupFmcsaCarrier(1234567);
    expect(res.status).toBe("ok");
    expect(res.authorityActive).toBe(false);
    expect(res.safetyRating).toBe("Conditional");
    expect(res.hhgAuthorized).toBeNull();
  });

  it("never throws — a rejected carrier fetch degrades to error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect((await lookupFmcsaCarrier(1234567)).status).toBe("error");
  });
});
