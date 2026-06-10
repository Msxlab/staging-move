import { describe, expect, it } from "vitest";
import {
  clampPct,
  deriveHomeDossier,
  formatForecastDate,
  getFloodRow,
  getSchoolRow,
  getWeatherRow,
  roundTemp,
  type HomeDossierResponse,
} from "./home-dossier";

function dossier(overrides: Partial<HomeDossierResponse> = {}): HomeDossierResponse {
  return {
    configured: true,
    address: { id: "addr_1", city: "Austin", state: "TX" },
    flood: { status: "ok", zone: "AE", isHighRisk: true },
    school: { status: "ok", districtName: "Austin ISD", ncesId: "4808940" },
    weather: {
      status: "ok",
      forecastDate: "2026-06-12",
      summary: "Sunny",
      tempHighF: 92.6,
      tempLowF: 71.2,
      precipChancePct: 10,
    },
    ...overrides,
  };
}

describe("deriveHomeDossier — card-level gating", () => {
  it("renders nothing for null/undefined payloads", () => {
    expect(deriveHomeDossier(null).hasContent).toBe(false);
    expect(deriveHomeDossier(undefined).hasContent).toBe(false);
  });

  it("renders nothing when the server reports unconfigured", () => {
    const rows = deriveHomeDossier(dossier({ configured: false as unknown as true }));
    expect(rows).toEqual({ flood: null, school: null, weather: null, hasContent: false });
  });

  it("renders nothing when a malformed payload is missing sections", () => {
    const broken = { configured: true, address: { id: "a", city: "", state: "" } };
    expect(deriveHomeDossier(broken as HomeDossierResponse).hasContent).toBe(false);
  });

  it("renders nothing when every section degraded (no_location / error / too_far)", () => {
    const rows = deriveHomeDossier(
      dossier({
        flood: { status: "no_location", zone: null, isHighRisk: null },
        school: { status: "error", districtName: null, ncesId: null },
        weather: {
          status: "too_far",
          forecastDate: null,
          summary: null,
          tempHighF: null,
          tempLowF: null,
          precipChancePct: null,
        },
      }),
    );
    expect(rows.hasContent).toBe(false);
  });

  it("has content when at least one row survives", () => {
    const rows = deriveHomeDossier(
      dossier({
        flood: { status: "error", zone: null, isHighRisk: null },
        weather: {
          status: "too_far",
          forecastDate: null,
          summary: null,
          tempHighF: null,
          tempLowF: null,
          precipChancePct: null,
        },
      }),
    );
    expect(rows.flood).toBeNull();
    expect(rows.weather).toBeNull();
    expect(rows.school).toEqual({ districtName: "Austin ISD", ncesId: "4808940" });
    expect(rows.hasContent).toBe(true);
  });
});

describe("getFloodRow", () => {
  it("returns the zone and high-risk flag when FEMA answered", () => {
    expect(getFloodRow(dossier())).toEqual({ zone: "AE", isHighRisk: true });
  });

  it("treats null isHighRisk as not-high-risk (no honey pill on unknowns)", () => {
    const row = getFloodRow(
      dossier({ flood: { status: "ok", zone: "X", isHighRisk: null } }),
    );
    expect(row).toEqual({ zone: "X", isHighRisk: false });
  });

  it.each(["no_location", "error"] as const)("hides on status %s", (status) => {
    expect(getFloodRow(dossier({ flood: { status, zone: null, isHighRisk: null } }))).toBeNull();
  });

  it("hides when status is ok but the zone is null or blank", () => {
    expect(getFloodRow(dossier({ flood: { status: "ok", zone: null, isHighRisk: false } }))).toBeNull();
    expect(getFloodRow(dossier({ flood: { status: "ok", zone: "  ", isHighRisk: false } }))).toBeNull();
  });
});

describe("getSchoolRow", () => {
  it("returns district + NCES id when present", () => {
    expect(getSchoolRow(dossier())).toEqual({ districtName: "Austin ISD", ncesId: "4808940" });
  });

  it("keeps the row but drops a blank NCES id", () => {
    const row = getSchoolRow(
      dossier({ school: { status: "ok", districtName: "Austin ISD", ncesId: "  " } }),
    );
    expect(row).toEqual({ districtName: "Austin ISD", ncesId: null });
  });

  it("hides without a district name or on degraded statuses", () => {
    expect(getSchoolRow(dossier({ school: { status: "ok", districtName: null, ncesId: "1" } }))).toBeNull();
    expect(getSchoolRow(dossier({ school: { status: "no_location", districtName: null, ncesId: null } }))).toBeNull();
    expect(getSchoolRow(dossier({ school: { status: "error", districtName: null, ncesId: null } }))).toBeNull();
  });
});

describe("getWeatherRow", () => {
  it("rounds temps and clamps precipitation", () => {
    expect(getWeatherRow(dossier())).toEqual({
      forecastDate: "2026-06-12",
      summary: "Sunny",
      tempHighF: 93,
      tempLowF: 71,
      precipChancePct: 10,
    });
  });

  it.each(["no_location", "too_far", "error"] as const)("hides on status %s", (status) => {
    const row = getWeatherRow(
      dossier({
        weather: {
          status,
          forecastDate: "2026-06-12",
          summary: "Sunny",
          tempHighF: 90,
          tempLowF: 70,
          precipChancePct: 0,
        },
      }),
    );
    expect(row).toBeNull();
  });

  it("hides when there is neither a summary nor a complete high/low pair", () => {
    const row = getWeatherRow(
      dossier({
        weather: {
          status: "ok",
          forecastDate: "2026-06-12",
          summary: null,
          tempHighF: 90,
          tempLowF: null,
          precipChancePct: 40,
        },
      }),
    );
    expect(row).toBeNull();
  });

  it("renders a summary-only forecast with the lone temp suppressed", () => {
    const row = getWeatherRow(
      dossier({
        weather: {
          status: "ok",
          forecastDate: null,
          summary: "Rain likely",
          tempHighF: 80,
          tempLowF: null,
          precipChancePct: 140,
        },
      }),
    );
    expect(row).toEqual({
      forecastDate: null,
      summary: "Rain likely",
      tempHighF: null,
      tempLowF: null,
      precipChancePct: 100,
    });
  });
});

describe("numeric helpers", () => {
  it("roundTemp rounds finite numbers and nulls everything else", () => {
    expect(roundTemp(71.5)).toBe(72);
    expect(roundTemp(-0.4)).toBe(-0);
    expect(roundTemp(null)).toBeNull();
    expect(roundTemp(undefined)).toBeNull();
    expect(roundTemp(Number.NaN)).toBeNull();
    expect(roundTemp(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("clampPct clamps into 0–100 and nulls non-finite input", () => {
    expect(clampPct(12.4)).toBe(12);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(250)).toBe(100);
    expect(clampPct(null)).toBeNull();
    expect(clampPct(Number.NaN)).toBeNull();
  });
});

describe("formatForecastDate", () => {
  it("parses YYYY-MM-DD as a LOCAL calendar date (no UTC backshift)", () => {
    const label = formatForecastDate("2026-06-12", "en-US");
    expect(label).toBeTruthy();
    // Whatever the host timezone, a local parse must keep the day at 12.
    expect(label).toContain("12");
    expect(label).toContain("Jun");
  });

  it("accepts full ISO datetimes", () => {
    expect(formatForecastDate("2026-06-12T12:00:00Z", "en-US")).toBeTruthy();
  });

  it("returns null for null/blank/garbage input", () => {
    expect(formatForecastDate(null, "en-US")).toBeNull();
    expect(formatForecastDate("   ", "en-US")).toBeNull();
    expect(formatForecastDate("not-a-date", "en-US")).toBeNull();
  });
});
