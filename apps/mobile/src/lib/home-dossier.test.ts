import { describe, expect, it } from "vitest";
import {
  clampPct,
  deriveHomeDossier,
  deriveHomeDossierView,
  formatForecastDate,
  getAirRow,
  getFloodRow,
  getHazardsRow,
  getRadonRow,
  getSchoolRow,
  getWaterRow,
  getWeatherRow,
  roundTemp,
  type HomeDossierResponse,
} from "./home-dossier";

/**
 * Base factory deliberately OMITS the four extended sections (hazards, radon,
 * water, air) — it models both today's older servers and the minimal valid
 * payload, so every base-row test doubles as a backward-compatibility check.
 */
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

/** Factory with all four extended sections healthy. */
function extendedDossier(overrides: Partial<HomeDossierResponse> = {}): HomeDossierResponse {
  return dossier({
    hazards: {
      status: "ok",
      topRisks: [
        { hazard: "Wildfire", rating: "Relatively High" },
        { hazard: "Drought", rating: "Relatively Moderate" },
      ],
      overallRating: "Relatively Moderate",
    },
    radon: { status: "ok", zone: 1 },
    water: { status: "ok", systemName: "Austin Water", violations5y: 0 },
    air: { status: "ok", aqi: 42.4, category: "Good" },
    ...overrides,
  });
}

const DEGRADED_BASE: Partial<HomeDossierResponse> = {
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
};

describe("deriveHomeDossier — card-level gating", () => {
  it("renders nothing for null/undefined payloads", () => {
    expect(deriveHomeDossier(null).hasContent).toBe(false);
    expect(deriveHomeDossier(undefined).hasContent).toBe(false);
  });

  it("renders nothing when the server reports unconfigured", () => {
    const rows = deriveHomeDossier(dossier({ configured: false as unknown as true }));
    expect(rows).toEqual({
      flood: null,
      school: null,
      weather: null,
      hazards: null,
      radon: null,
      water: null,
      air: null,
      hasContent: false,
    });
  });

  it("renders nothing when a malformed payload is missing sections", () => {
    const broken = { configured: true, address: { id: "a", city: "", state: "" } };
    expect(deriveHomeDossier(broken as HomeDossierResponse).hasContent).toBe(false);
  });

  it("renders nothing when every section degraded (no_location / error / too_far)", () => {
    const rows = deriveHomeDossier(dossier(DEGRADED_BASE));
    expect(rows.hasContent).toBe(false);
  });

  it("renders nothing when base AND extended sections all degraded", () => {
    const rows = deriveHomeDossier(
      extendedDossier({
        ...DEGRADED_BASE,
        hazards: { status: "error", topRisks: [], overallRating: null },
        radon: { status: "no_location", zone: null },
        water: { status: "error", systemName: null, violations5y: null },
        air: { status: "not_configured", aqi: null, category: null },
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

  it("renders no data rows for an unentitled payload, even if sections leaked in", () => {
    // Defense in depth: rows must never render for a free user — extended
    // sections (hazards/radon/water/air) included.
    expect(deriveHomeDossier(dossier({ entitled: false })).hasContent).toBe(false);
    expect(deriveHomeDossier(extendedDossier({ entitled: false })).hasContent).toBe(false);
  });
});

describe("deriveHomeDossier — extended sections (hazards / radon / water / air)", () => {
  it("treats sections omitted by older servers as absent rows, never an error", () => {
    const rows = deriveHomeDossier(dossier());
    expect(rows.hasContent).toBe(true);
    expect(rows.hazards).toBeNull();
    expect(rows.radon).toBeNull();
    expect(rows.water).toBeNull();
    expect(rows.air).toBeNull();
  });

  it("derives all four extended rows from a healthy payload", () => {
    const rows = deriveHomeDossier(extendedDossier());
    expect(rows.hazards).toEqual({
      topRisks: [
        { hazard: "Wildfire", rating: "Relatively High" },
        { hazard: "Drought", rating: "Relatively Moderate" },
      ],
      overallRating: "Relatively Moderate",
    });
    expect(rows.radon).toEqual({ zone: 1 });
    expect(rows.water).toEqual({ systemName: "Austin Water", violations5y: 0 });
    expect(rows.air).toEqual({ aqi: 42, category: "Good" });
  });

  it("keeps content when only an extended section survives (sections independent)", () => {
    const rows = deriveHomeDossier(
      extendedDossier({
        ...DEGRADED_BASE,
        hazards: { status: "error", topRisks: [], overallRating: null },
        radon: { status: "ok", zone: 2 },
        water: { status: "no_location", systemName: null, violations5y: null },
        air: { status: "error", aqi: null, category: null },
      }),
    );
    expect(rows.flood).toBeNull();
    expect(rows.school).toBeNull();
    expect(rows.weather).toBeNull();
    expect(rows.hazards).toBeNull();
    expect(rows.water).toBeNull();
    expect(rows.air).toBeNull();
    expect(rows.radon).toEqual({ zone: 2 });
    expect(rows.hasContent).toBe(true);
  });
});

describe("deriveHomeDossierView — entitlement gating", () => {
  it("hides for null payloads and fetch failures", () => {
    expect(deriveHomeDossierView(null)).toEqual({ kind: "hidden" });
    expect(deriveHomeDossierView(undefined)).toEqual({ kind: "hidden" });
  });

  it("hides (never teases) when the server reports unconfigured", () => {
    expect(deriveHomeDossierView(dossier({ configured: false, entitled: false }))).toEqual({
      kind: "hidden",
    });
    expect(deriveHomeDossierView({ configured: false })).toEqual({ kind: "hidden" });
  });

  it("teases on entitled:false, with or without data sections in the payload", () => {
    // Typical unentitled payload: no sections at all.
    expect(
      deriveHomeDossierView({
        configured: true,
        entitled: false,
        address: { id: "addr_1", city: "Austin", state: "TX" },
      }),
    ).toEqual({ kind: "teaser" });
    // Sections present anyway → still a teaser, never real rows.
    expect(deriveHomeDossierView(dossier({ entitled: false }))).toEqual({ kind: "teaser" });
  });

  it("shows content when entitled:true", () => {
    const view = deriveHomeDossierView(dossier({ entitled: true }));
    expect(view.kind).toBe("content");
    if (view.kind === "content") {
      expect(view.rows.hasContent).toBe(true);
      expect(view.rows.flood).toEqual({ zone: "AE", isHighRisk: true });
    }
  });

  it("treats a missing entitled flag as entitled (pre-flag servers degrade gracefully)", () => {
    const view = deriveHomeDossierView(dossier());
    expect(view.kind).toBe("content");
  });

  it("hides an entitled dossier whose every section degraded", () => {
    const view = deriveHomeDossierView(
      dossier({
        entitled: true,
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
    expect(view).toEqual({ kind: "hidden" });
  });

  it("hides an entitled but malformed payload missing its sections", () => {
    expect(deriveHomeDossierView({ configured: true, entitled: true })).toEqual({
      kind: "hidden",
    });
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

describe("getHazardsRow", () => {
  it("returns trimmed pills plus the overall rating", () => {
    expect(getHazardsRow(extendedDossier())).toEqual({
      topRisks: [
        { hazard: "Wildfire", rating: "Relatively High" },
        { hazard: "Drought", rating: "Relatively Moderate" },
      ],
      overallRating: "Relatively Moderate",
    });
  });

  it("re-caps at 3 pills and drops blank entries even if the server over-delivers", () => {
    const row = getHazardsRow(
      extendedDossier({
        hazards: {
          status: "ok",
          topRisks: [
            { hazard: "  Wildfire ", rating: " Very High " },
            { hazard: "", rating: "Relatively High" },
            { hazard: "Drought", rating: "  " },
            { hazard: "Heat Wave", rating: "Relatively High" },
            { hazard: "Hail", rating: "Relatively Moderate" },
            { hazard: "Tornado", rating: "Relatively Moderate" },
          ],
          overallRating: null,
        },
      }),
    );
    expect(row).toEqual({
      topRisks: [
        { hazard: "Wildfire", rating: "Very High" },
        { hazard: "Heat Wave", rating: "Relatively High" },
        { hazard: "Hail", rating: "Relatively Moderate" },
      ],
      overallRating: null,
    });
  });

  it("renders with an overall rating alone (no notable per-hazard risks)", () => {
    const row = getHazardsRow(
      extendedDossier({
        hazards: { status: "ok", topRisks: [], overallRating: "Relatively Low" },
      }),
    );
    expect(row).toEqual({ topRisks: [], overallRating: "Relatively Low" });
  });

  it("tolerates a malformed topRisks value", () => {
    const row = getHazardsRow(
      extendedDossier({
        hazards: {
          status: "ok",
          topRisks: null as unknown as [],
          overallRating: "Relatively Low",
        },
      }),
    );
    expect(row).toEqual({ topRisks: [], overallRating: "Relatively Low" });
  });

  it("hides when ok but there is nothing honest to show", () => {
    expect(
      getHazardsRow(extendedDossier({ hazards: { status: "ok", topRisks: [], overallRating: "  " } })),
    ).toBeNull();
  });

  it.each(["no_location", "error"] as const)("hides on status %s", (status) => {
    expect(
      getHazardsRow(extendedDossier({ hazards: { status, topRisks: [], overallRating: null } })),
    ).toBeNull();
  });

  it("hides when the section is absent (older server)", () => {
    expect(getHazardsRow(dossier())).toBeNull();
  });
});

describe("getRadonRow", () => {
  it.each([1, 2, 3] as const)("returns zone %s", (zone) => {
    expect(getRadonRow(extendedDossier({ radon: { status: "ok", zone } }))).toEqual({ zone });
  });

  it("hides on a null or out-of-range zone (EPA never published it)", () => {
    expect(getRadonRow(extendedDossier({ radon: { status: "ok", zone: null } }))).toBeNull();
    expect(getRadonRow(extendedDossier({ radon: { status: "ok", zone: 0 as unknown as 1 } }))).toBeNull();
    expect(getRadonRow(extendedDossier({ radon: { status: "ok", zone: 4 as unknown as 1 } }))).toBeNull();
    expect(getRadonRow(extendedDossier({ radon: { status: "ok", zone: 2.5 as unknown as 2 } }))).toBeNull();
  });

  it.each(["no_location", "error"] as const)("hides on status %s", (status) => {
    expect(getRadonRow(extendedDossier({ radon: { status, zone: 1 } }))).toBeNull();
  });

  it("hides when the section is absent (older server)", () => {
    expect(getRadonRow(dossier())).toBeNull();
  });
});

describe("getWaterRow", () => {
  it("returns the system name and keeps a zero violation count (honest good news)", () => {
    expect(getWaterRow(extendedDossier())).toEqual({
      systemName: "Austin Water",
      violations5y: 0,
    });
  });

  it("keeps a positive violation count", () => {
    const row = getWaterRow(
      extendedDossier({ water: { status: "ok", systemName: " City Utility ", violations5y: 3 } }),
    );
    expect(row).toEqual({ systemName: "City Utility", violations5y: 3 });
  });

  it("keeps the row but nulls a negative or non-finite count", () => {
    expect(
      getWaterRow(extendedDossier({ water: { status: "ok", systemName: "X", violations5y: -2 } })),
    ).toEqual({ systemName: "X", violations5y: null });
    expect(
      getWaterRow(
        extendedDossier({ water: { status: "ok", systemName: "X", violations5y: Number.NaN } }),
      ),
    ).toEqual({ systemName: "X", violations5y: null });
  });

  it("hides without a system name, even when a count is present", () => {
    expect(
      getWaterRow(extendedDossier({ water: { status: "ok", systemName: "  ", violations5y: 2 } })),
    ).toBeNull();
    expect(
      getWaterRow(extendedDossier({ water: { status: "ok", systemName: null, violations5y: 2 } })),
    ).toBeNull();
  });

  it.each(["no_location", "error"] as const)("hides on status %s", (status) => {
    expect(
      getWaterRow(extendedDossier({ water: { status, systemName: "X", violations5y: 0 } })),
    ).toBeNull();
  });

  it("hides when the section is absent (older server)", () => {
    expect(getWaterRow(dossier())).toBeNull();
  });
});

describe("getAirRow", () => {
  it("rounds the AQI and trims the category", () => {
    expect(
      getAirRow(extendedDossier({ air: { status: "ok", aqi: 42.6, category: " Good " } })),
    ).toEqual({ aqi: 43, category: "Good" });
  });

  it("renders with an AQI alone or a category alone", () => {
    expect(getAirRow(extendedDossier({ air: { status: "ok", aqi: 55, category: null } }))).toEqual({
      aqi: 55,
      category: null,
    });
    expect(
      getAirRow(extendedDossier({ air: { status: "ok", aqi: null, category: "Moderate" } })),
    ).toEqual({ aqi: null, category: "Moderate" });
  });

  it("nulls a negative or non-finite AQI", () => {
    expect(
      getAirRow(extendedDossier({ air: { status: "ok", aqi: -10, category: "Good" } })),
    ).toEqual({ aqi: null, category: "Good" });
    expect(
      getAirRow(extendedDossier({ air: { status: "ok", aqi: Number.NaN, category: null } })),
    ).toBeNull();
  });

  it("hides when ok but there is no usable figure at all", () => {
    expect(
      getAirRow(extendedDossier({ air: { status: "ok", aqi: null, category: "  " } })),
    ).toBeNull();
  });

  it.each(["not_configured", "no_location", "error"] as const)("hides on status %s", (status) => {
    expect(
      getAirRow(extendedDossier({ air: { status, aqi: 50, category: "Good" } })),
    ).toBeNull();
  });

  it("hides when the section is absent (older server)", () => {
    expect(getAirRow(dossier())).toBeNull();
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
