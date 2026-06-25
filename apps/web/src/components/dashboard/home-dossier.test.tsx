import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  HomeDossierCard,
  HomeDossierTeaser,
  deriveEvCharging,
  deriveDossierView,
  deriveHousing,
  deriveNeighborhood,
  floodLabelKey,
  formatForecastDate,
  formatUsd,
  isDossierGated,
  isHazardWarnRating,
  radonZoneLabelKey,
  waterLabelKey,
  type HomeDossierResponse,
} from "./home-dossier";

// lucide-react ships its own nested React copy, which breaks hooks under the
// test renderer — stub the icons used by the card with plain SVGs.
vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return {
    CloudSun: icon("cloud-sun"),
    Check: icon("check"),
    Compass: icon("compass"),
    Download: icon("download"),
    Droplets: icon("droplets"),
    FlaskConical: icon("flask-conical"),
    GraduationCap: icon("graduation-cap"),
    Home: icon("home"),
    MapPin: icon("map-pin"),
    Mountain: icon("mountain"),
    Sparkles: icon("sparkles"),
    Waves: icon("waves"),
    Wind: icon("wind"),
    Zap: icon("zap"),
  };
});

// next/link → plain anchor so the teaser CTA href is assertable without a router.
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));

// Resolve translations from the REAL en.json catalog so these tests pin the
// mandated copy (FEMA disclaimer, NCES fine print, no-location hint) — a copy
// regression in the catalog fails here, not just in review.
vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<
    string,
    Record<string, string>
  >;
  const resolve = (key: string): string => {
    const raw = en.dashboard?.[key];
    if (typeof raw !== "string") throw new Error(`Missing dashboard.${key} in en.json`);
    return raw;
  };
  const useTranslations = () => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      resolve(key).replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    t.rich = (key: string, vars?: Record<string, (chunks: unknown) => unknown>) => {
      const raw = resolve(key);
      const m = /^(.*)<em>(.*)<\/em>(.*)$/.exec(raw);
      if (!m || typeof vars?.em !== "function") return raw;
      return (
        <>
          {m[1]}
          {vars.em(m[2])}
          {m[3]}
        </>
      );
    };
    return t;
  };
  return { useTranslations, useLocale: () => "en-US" };
});

function dossier(overrides: {
  configured?: boolean;
  flood?: Partial<HomeDossierResponse["flood"]>;
  school?: Partial<HomeDossierResponse["school"]>;
  weather?: Partial<HomeDossierResponse["weather"]>;
  hazards?: Partial<NonNullable<HomeDossierResponse["hazards"]>>;
  radon?: Partial<NonNullable<HomeDossierResponse["radon"]>>;
  water?: Partial<NonNullable<HomeDossierResponse["water"]>>;
  air?: Partial<NonNullable<HomeDossierResponse["air"]>>;
  housing?: Partial<NonNullable<HomeDossierResponse["housing"]>>;
  evCharging?: Partial<NonNullable<HomeDossierResponse["evCharging"]>>;
} = {}): HomeDossierResponse {
  return {
    configured: overrides.configured ?? true,
    address: { id: "addr-1", city: "Austin", state: "TX" },
    flood: { status: "ok", zone: "X", isHighRisk: false, ...overrides.flood },
    school: { status: "ok", districtName: "Austin ISD", ncesId: "4808940", ...overrides.school },
    weather: {
      status: "ok",
      forecastDate: "2026-06-12",
      summary: "Sunny",
      tempHighF: 84,
      tempLowF: 62,
      precipChancePct: 10,
      ...overrides.weather,
    },
    hazards: {
      status: "ok",
      topRisks: [{ hazard: "Riverine Flooding", rating: "Relatively Moderate" }],
      overallRating: "Relatively Low",
      ...overrides.hazards,
    },
    radon: { status: "ok", zone: 1, ...overrides.radon },
    water: { status: "ok", systemName: "Austin Water", violations5y: 0, ...overrides.water },
    air: { status: "ok", aqi: 42, category: "Good", ...overrides.air },
    housing: {
      status: "ok",
      zip: "78701",
      countyName: "Travis County",
      metroName: "Austin-Round Rock-Georgetown, TX",
      areaName: "Austin-Round Rock-Georgetown, TX HUD Metro FMR Area",
      fairMarketRent: {
        year: 2026,
        efficiency: 1350,
        oneBedroom: 1540,
        twoBedroom: 1840,
        threeBedroom: 2380,
        fourBedroom: 2860,
        zipSpecific: false,
      },
      incomeLimits: {
        year: 2026,
        medianIncome: 126000,
        extremelyLowIncome4Person: 37800,
        veryLowIncome4Person: 63000,
        lowIncome4Person: 100800,
      },
      caveat: "HUD area context",
      ...overrides.housing,
    },
    evCharging: {
      status: "ok",
      radiusMiles: 10,
      totalResults: 14,
      stationCount: 14,
      nearestDistanceMiles: 0.8,
      dcFastPortCount: 4,
      level2PortCount: 18,
      teslaCompatibleCount: 3,
      ccsCompatibleCount: 4,
      stations: [{ name: "Downtown Garage", distanceMiles: 0.8, city: "Austin", state: "TX" }],
      caveat: "Public active stations",
      ...overrides.evCharging,
    },
  };
}

/** Every extended section degraded — for the card-hide tests. */
function degradedExtended(status: "no_location" | "error"): Pick<HomeDossierResponse, "hazards" | "radon" | "water" | "air" | "housing" | "evCharging"> {
  return {
    hazards: { status, topRisks: [], overallRating: null },
    radon: { status, zone: null },
    water: { status, systemName: null, violations5y: null },
    air: { status, aqi: null, category: null },
    housing: {
      status,
      zip: null,
      countyName: null,
      metroName: null,
      areaName: null,
      fairMarketRent: null,
      incomeLimits: null,
      caveat: null,
    },
    evCharging: {
      status,
      radiusMiles: 10,
      totalResults: null,
      stationCount: 0,
      nearestDistanceMiles: null,
      dcFastPortCount: 0,
      level2PortCount: 0,
      teslaCompatibleCount: 0,
      ccsCompatibleCount: 0,
      stations: [],
      caveat: null,
    },
  };
}

function previewDossier(): HomeDossierResponse {
  return {
    configured: true,
    preview: true,
    homeDossierPreview: true,
    fullDossier: false,
    dossierPdf: false,
    address: { id: "addr-1", city: "Austin", state: "TX" },
    lockedSections: ["hazards", "radon", "water", "air", "housing", "evCharging", "neighborhood", "pdf"],
    flood: { status: "ok", zone: "X", isHighRisk: false },
    school: { status: "ok", districtName: "Austin ISD", ncesId: "4808940" },
    weather: {
      status: "ok",
      forecastDate: "2026-06-12",
      summary: "Sunny",
      tempHighF: 84,
      tempLowF: 62,
      precipChancePct: 10,
    },
  };
}

describe("deriveDossierView", () => {
  it("hides the whole card when every section is no_location", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "no_location", zone: null, isHighRisk: null },
        school: { status: "no_location", districtName: null, ncesId: null },
        weather: { status: "no_location", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        ...degradedExtended("no_location"),
      }),
    );
    expect(view.visible).toBe(false);
  });

  it("hides the whole card when every section errored", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "error", zone: null, isHighRisk: null },
        school: { status: "error", districtName: null, ncesId: null },
        weather: { status: "error", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        ...degradedExtended("error"),
      }),
    );
    expect(view.visible).toBe(false);
  });

  it("hides an empty shell: flood/school error + weather too_far renders nothing", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "error", zone: null, isHighRisk: null },
        school: { status: "error", districtName: null, ncesId: null },
        weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        ...degradedExtended("error"),
      }),
    );
    expect(view.visible).toBe(false);
  });

  it("treats air not_configured as degraded for the card-hide check", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "error", zone: null, isHighRisk: null },
        school: { status: "error", districtName: null, ncesId: null },
        weather: { status: "error", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        ...degradedExtended("error"),
        air: { status: "not_configured", aqi: null, category: null },
      }),
    );
    expect(view.visible).toBe(false);
  });

  it("shows all seven rows for a fully ok dossier (no hint)", () => {
    const view = deriveDossierView(dossier());
    expect(view.visible).toBe(true);
    expect(view.flood).toEqual({ zone: "X", isHighRisk: false });
    expect(view.school).toEqual({ districtName: "Austin ISD" });
    expect(view.weather?.summary).toBe("Sunny");
    expect(view.hazards).toEqual({
      topRisks: [{ hazard: "Riverine Flooding", rating: "Relatively Moderate" }],
      overallRating: "Relatively Low",
    });
    expect(view.radon).toEqual({ zone: 1 });
    expect(view.water).toEqual({ systemName: "Austin Water", violations5y: 0 });
    expect(view.air).toEqual({ aqi: 42, category: "Good" });
    expect(view.showLocationHint).toBe(false);
  });

  it("keeps working against legacy payloads without the extended sections", () => {
    const legacy = dossier();
    delete legacy.hazards;
    delete legacy.radon;
    delete legacy.water;
    delete legacy.air;
    const view = deriveDossierView(legacy);
    expect(view.visible).toBe(true);
    expect(view.flood).not.toBeNull();
    expect(view.hazards).toBeNull();
    expect(view.radon).toBeNull();
    expect(view.water).toBeNull();
    expect(view.air).toBeNull();
  });

  it("primary address without coordinates: no_location sections + too_far weather → hint row only", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "no_location", zone: null, isHighRisk: null },
        school: { status: "no_location", districtName: null, ncesId: null },
        weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        ...degradedExtended("no_location"),
      }),
    );
    expect(view.visible).toBe(true);
    expect(view.flood).toBeNull();
    expect(view.school).toBeNull();
    expect(view.weather).toBeNull();
    expect(view.hazards).toBeNull();
    expect(view.radon).toBeNull();
    expect(view.water).toBeNull();
    expect(view.air).toBeNull();
    expect(view.showLocationHint).toBe(true);
  });

  it("hides the weather row on too_far but keeps the ok rows", () => {
    const view = deriveDossierView(
      dossier({
        weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
      }),
    );
    expect(view.visible).toBe(true);
    expect(view.weather).toBeNull();
    expect(view.flood).not.toBeNull();
    expect(view.school).not.toBeNull();
    expect(view.showLocationHint).toBe(false);
  });

  it("skips an ok section that is missing its headline datum", () => {
    const view = deriveDossierView(
      dossier({
        flood: { zone: null },
        school: { districtName: "  " },
      }),
    );
    expect(view.flood).toBeNull();
    expect(view.school).toBeNull();
    expect(view.weather).not.toBeNull();
    expect(view.visible).toBe(true);
  });

  it("degrades to hidden on null / unconfigured / malformed payloads", () => {
    expect(deriveDossierView(null).visible).toBe(false);
    expect(deriveDossierView(undefined).visible).toBe(false);
    expect(deriveDossierView(dossier({ configured: false })).visible).toBe(false);
    expect(deriveDossierView({ configured: true } as HomeDossierResponse).visible).toBe(false);
  });

  it("renders a free preview payload from only flood, school, and moving-day weather", () => {
    const view = deriveDossierView(previewDossier());
    expect(view.visible).toBe(true);
    expect(view.preview).toBe(true);
    expect(view.flood).toEqual({ zone: "X", isHighRisk: false });
    expect(view.school).toEqual({ districtName: "Austin ISD" });
    expect(view.weather).toEqual({
      forecastDate: "2026-06-12",
      summary: "Sunny",
      tempHighF: 84,
      tempLowF: 62,
      precipChancePct: 10,
    });
    expect(view.hazards).toBeNull();
    expect(view.radon).toBeNull();
    expect(view.water).toBeNull();
    expect(view.air).toBeNull();
    expect(view.housing).toBeNull();
    expect(view.evCharging).toBeNull();
    expect(view.neighborhood).toBeNull();
  });
});

describe("deriveDossierView — extended sections", () => {
  it("drops malformed hazard entries and caps the list at 3", () => {
    const view = deriveDossierView(
      dossier({
        hazards: {
          topRisks: [
            { hazard: "  Wildfire  ", rating: " Relatively High " },
            { hazard: "", rating: "Very High" },
            { hazard: "Tornado", rating: "" },
            null as never,
            { hazard: "Hail", rating: "Relatively Moderate" },
            { hazard: "Drought", rating: "Relatively Moderate" },
            { hazard: "Heat Wave", rating: "Relatively Moderate" },
          ],
        },
      }),
    );
    expect(view.hazards?.topRisks).toEqual([
      { hazard: "Wildfire", rating: "Relatively High" },
      { hazard: "Hail", rating: "Relatively Moderate" },
      { hazard: "Drought", rating: "Relatively Moderate" },
    ]);
  });

  it("skips the hazards row when ok but no risks survive (still shows the rest)", () => {
    const view = deriveDossierView(dossier({ hazards: { topRisks: [], overallRating: "Relatively Low" } }));
    expect(view.hazards).toBeNull();
    expect(view.visible).toBe(true);
  });

  it("skips radon when the zone is missing or out of range", () => {
    expect(deriveDossierView(dossier({ radon: { zone: null } })).radon).toBeNull();
    expect(deriveDossierView(dossier({ radon: { zone: 7 as never } })).radon).toBeNull();
    expect(deriveDossierView(dossier({ radon: { status: "error", zone: 1 } })).radon).toBeNull();
  });

  it("water needs BOTH a system name and a numeric count — zero is meaningful", () => {
    expect(deriveDossierView(dossier({ water: { violations5y: null } })).water).toBeNull();
    expect(deriveDossierView(dossier({ water: { systemName: "  " } })).water).toBeNull();
    expect(deriveDossierView(dossier({ water: { violations5y: 0 } })).water).toEqual({
      systemName: "Austin Water",
      violations5y: 0,
    });
  });

  it("air renders on AQI alone, category alone, and never on not_configured", () => {
    expect(deriveDossierView(dossier({ air: { category: null } })).air).toEqual({ aqi: 42, category: null });
    expect(deriveDossierView(dossier({ air: { aqi: null } })).air).toEqual({ aqi: null, category: "Good" });
    expect(deriveDossierView(dossier({ air: { aqi: null, category: null } })).air).toBeNull();
    expect(deriveDossierView(dossier({ air: { status: "not_configured", aqi: 42 } })).air).toBeNull();
  });

  it("an ok extended section keeps the card alive when the original three degrade", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "error", zone: null, isHighRisk: null },
        school: { status: "error", districtName: null, ncesId: null },
        weather: { status: "error", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        ...degradedExtended("error"),
        air: { status: "ok", aqi: 51, category: "Moderate" },
      }),
    );
    expect(view.visible).toBe(true);
    expect(view.air).toEqual({ aqi: 51, category: "Moderate" });
    expect(view.flood).toBeNull();
  });

  it("a locked neighborhood (upgrade_required) keeps the card alive when every other section degrades", () => {
    const view = deriveDossierView({
      ...dossier({
        flood: { status: "error", zone: null, isHighRisk: null },
        school: { status: "error", districtName: null, ncesId: null },
        weather: { status: "error", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        ...degradedExtended("error"),
      }),
      neighborhood: {
        status: "upgrade_required",
        medianHomeValue: null,
        medianGrossRent: null,
        medianHouseholdIncome: null,
        ownerOccupiedPct: null,
        schools: null,
      },
    });
    expect(view.visible).toBe(true);
    expect(view.neighborhood).toEqual({ locked: true });
    expect(view.flood).toBeNull();
  });
});

describe("floodLabelKey", () => {
  it("maps isHighRisk to the plain-English label key", () => {
    expect(floodLabelKey(true)).toBe("dossier_flood_high");
    expect(floodLabelKey(false)).toBe("dossier_flood_low");
    expect(floodLabelKey(null)).toBe("dossier_flood_unknown");
  });
});

describe("extended-section label helpers", () => {
  it("warn tone is reserved for Relatively High / Very High NRI ratings", () => {
    expect(isHazardWarnRating("Relatively High")).toBe(true);
    expect(isHazardWarnRating("Very High")).toBe(true);
    expect(isHazardWarnRating("  very high ")).toBe(true);
    expect(isHazardWarnRating("Relatively Moderate")).toBe(false);
    expect(isHazardWarnRating("Relatively Low")).toBe(false);
    expect(isHazardWarnRating("Very Low")).toBe(false);
  });

  it("maps radon zones to plain-English label keys", () => {
    expect(radonZoneLabelKey(1)).toBe("dossier_radon_zone1");
    expect(radonZoneLabelKey(2)).toBe("dossier_radon_zone2");
    expect(radonZoneLabelKey(3)).toBe("dossier_radon_zone3");
  });

  it("zero violations gets the reassuring water copy; counts pluralize", () => {
    expect(waterLabelKey(0)).toBe("dossier_water_clean");
    expect(waterLabelKey(1)).toBe("dossier_water_violationsOne");
    expect(waterLabelKey(3)).toBe("dossier_water_violationsMany");
  });
});

describe("formatForecastDate", () => {
  it("parses YYYY-MM-DD as a local date (no UTC off-by-one)", () => {
    const out = formatForecastDate("2026-06-12", "en-US");
    expect(out).toContain("Jun");
    expect(out).toContain("12");
  });

  it("returns empty string for null/invalid input", () => {
    expect(formatForecastDate(null, "en-US")).toBe("");
    expect(formatForecastDate(undefined, "en-US")).toBe("");
    expect(formatForecastDate("not-a-date", "en-US")).toBe("");
  });
});

describe("HomeDossierCard rendering", () => {
  it("renders the rows with the mandated disclaimers and FEMA link", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard data={dossier({ flood: { zone: "AE", isHighRisk: true } })} />,
    );

    // Flood: zone + plain-English high-risk label + honey warn pill
    expect(markup).toContain("Zone AE — high-risk flood area");
    expect(markup).toContain("High risk");
    expect(markup).toContain("bg-tone-honey-bg");
    // MANDATORY fine print + official FEMA link
    expect(markup).toContain("Informational, from FEMA flood maps — not an insurance determination.");
    expect(markup).toContain('href="https://msc.fema.gov"');

    // School district + NCES fine print
    expect(markup).toContain("Served by Austin ISD");
    expect(markup).toContain("District boundaries (NCES) — school assignment may differ.");

    // Weather: summary + figures + moving-day date label
    expect(markup).toContain("Sunny");
    expect(markup).toContain("High 84°F");
    expect(markup).toContain("Low 62°F");
    expect(markup).toContain("10% precip");
    expect(markup).toContain("Moving day:");

    // City/state eyebrow
    expect(markup).toContain("Austin, TX");
  });

  it("renders the minimal-risk label without the warn pill", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier()} />);
    expect(markup).toContain("Zone X — minimal flood risk");
    // Default hazards rating is "Relatively Moderate" — neutral, never honey.
    expect(markup).not.toMatch(/bg-tone-honey-bg[^>]*>Riverine Flooding · Relatively Moderate/);
  });

  it("wires every real data row to the source dossier scene stage", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier()} />);

    expect(markup).toContain("lf-dossier-source-toolbar");
    expect(markup).toContain("View full");
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('data-expanded="false"');
    expect(markup).toContain('data-source-compact="true"');
    expect((markup.match(/lf-dossier-source-card/g) ?? []).length).toBeGreaterThanOrEqual(9);
    expect(markup).toContain("lf-move-rise");
    expect(markup).toContain("lf-dossier-source-stage");
    expect(markup).toContain("ds-root");
    expect(markup).toContain("lf-dossier-source-tag");
    expect(markup).toContain("lf-dossier-source-bars");
    expect(markup).toContain("lf-dossier-source-band");
    expect(markup).toContain("lf-dossier-source-dots");
    expect(markup).toContain('data-pause-offscreen="false"');
    expect(markup).toContain("--ds-tone");
    expect(markup).toMatch(/ds-(bob|breathe|pass|wave|mote|rain|stroll)/);
    expect((markup.match(/lf-dossier-scene-card/g) ?? []).length).toBeGreaterThanOrEqual(9);
    for (const sourceType of [
      "flood",
      "school",
      "weather",
      "radon",
      "water",
      "air",
      "housing",
      "ev",
    ]) {
      expect(markup).toContain(`data-ds-type="${sourceType}"`);
    }
  });

  it("renders the honest no-location hint instead of fabricated rows", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={dossier({
          flood: { status: "no_location", zone: null, isHighRisk: null },
          school: { status: "no_location", districtName: null, ncesId: null },
          weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
          ...degradedExtended("no_location"),
        })}
      />,
    );
    expect(markup).toContain("Add a precise address to unlock local insights");
    expect(markup).not.toContain("Served by");
    expect(markup).not.toContain("FEMA");
    expect(markup).not.toContain("EPA");
    expect(markup).not.toContain("AQI");
  });

  it("renders the free preview subset with an included-feature CTA and no full dossier rows", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={previewDossier()} />);

    expect(markup).toContain("Free preview");
    expect(markup).toContain("Zone X");
    expect(markup).toContain("Served by Austin ISD");
    expect(markup).toContain("Moving day:");
    expect(markup).toContain("Sunny");
    expect(markup).toContain("High 84");
    expect(markup).toContain("Open the full Home Dossier");
    expect(markup).toContain("Natural hazards, radon, water, air, housing, EV charging");
    expect(markup).toContain("exports are included when consumer-free access is active.");
    expect(markup).not.toContain("Unlock the full Home Dossier + PDF");
    expect(markup).toContain('href="/addresses"');
    expect(markup).not.toContain("Natural hazard profile");
    expect(markup).not.toContain("Radon");
    expect(markup).not.toContain("Drinking water");
    expect(markup).not.toContain("Air quality");
    expect(markup).not.toContain("Housing context");
    expect(markup).not.toContain("EV charging nearby");
    expect(markup).not.toContain("Export PDF");
  });

  it("renders nothing when every section degrades", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={dossier({
          flood: { status: "error", zone: null, isHighRisk: null },
          school: { status: "error", districtName: null, ncesId: null },
          weather: { status: "error", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
          ...degradedExtended("error"),
        })}
      />,
    );
    expect(markup).toBe("");
  });

  it("omits the weather row when the move is too far out", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={dossier({
          weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        })}
      />,
    );
    expect(markup).not.toContain("Moving day:");
    expect(markup).toContain("Zone X — minimal flood risk");
  });
});

describe("HomeDossierCard — extended rows rendering", () => {
  it("renders the hazard profile with per-risk pills and the mandated NRI fine print", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={dossier({
          hazards: {
            topRisks: [
              { hazard: "Wildfire", rating: "Relatively High" },
              { hazard: "Hail", rating: "Relatively Moderate" },
            ],
            overallRating: "Relatively Moderate",
          },
        })}
      />,
    );
    expect(markup).toContain("Natural hazard profile");
    expect(markup).toContain("Overall: Relatively Moderate");
    expect(markup).toContain("Wildfire · Relatively High");
    expect(markup).toContain("Hail · Relatively Moderate");
    // Honey warn tone ONLY on the Relatively High pill (flood default is low-risk).
    expect(markup).toMatch(/bg-tone-honey-bg[^>]*>Wildfire · Relatively High/);
    expect(markup).not.toMatch(/bg-tone-honey-bg[^>]*>Hail · Relatively Moderate/);
    // MANDATORY fine print — relative, tract-level, not a property score.
    expect(markup).toContain("FEMA National Risk Index — relative, tract-level context, not a property score.");
  });

  it("Very High also gets the warn tone; lower ratings stay neutral", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={dossier({ hazards: { topRisks: [{ hazard: "Tornado", rating: "Very High" }] } })}
      />,
    );
    expect(markup).toContain("Tornado · Very High");
    expect(markup).toMatch(/bg-tone-honey-bg[^>]*>Tornado · Very High/);
  });

  it("renders the radon zone with the MANDATORY test-regardless fine print", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier({ radon: { zone: 1 } })} />);
    expect(markup).toContain("EPA Radon Zone 1 — highest radon potential");
    expect(markup).toContain("regardless of zone");
  });

  it("labels every radon zone in plain English", () => {
    expect(renderToStaticMarkup(<HomeDossierCard data={dossier({ radon: { zone: 2 } })} />)).toContain(
      "EPA Radon Zone 2 — moderate radon potential",
    );
    expect(renderToStaticMarkup(<HomeDossierCard data={dossier({ radon: { zone: 3 } })} />)).toContain(
      "EPA Radon Zone 3 — low radon potential",
    );
  });

  it("zero water violations reads reassuring, with the SDWIS source link", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier({ water: { violations5y: 0 } })} />);
    expect(markup).toContain("Austin Water: no health-based violations in the last 5 years");
    expect(markup).toContain('href="https://enviro.epa.gov"');
    expect(markup).toContain("enviro.epa.gov");
    expect(markup).toContain("EPA Safe Drinking Water Information System (SDWIS)");
  });

  it("reports water violation counts honestly (singular and plural)", () => {
    expect(renderToStaticMarkup(<HomeDossierCard data={dossier({ water: { violations5y: 1 } })} />)).toContain(
      "Austin Water: 1 health-based violation (5 yrs)",
    );
    expect(renderToStaticMarkup(<HomeDossierCard data={dossier({ water: { violations5y: 3 } })} />)).toContain(
      "Austin Water: 3 health-based violations (5 yrs)",
    );
  });

  it("renders current air quality with AQI and category", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier({ air: { aqi: 42, category: "Good" } })} />);
    expect(markup).toContain("Air quality now: AQI 42 (Good)");
  });

  it("renders AQI without a category when the category is missing", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier({ air: { aqi: 55, category: null } })} />);
    expect(markup).toContain("Air quality now: AQI 55");
    expect(markup).not.toContain("(Good)");
  });

  it("renders current air quality when only the AirNow category is present", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier({ air: { aqi: null, category: "Moderate" } })} />);
    expect(markup).toContain("Air quality now: Moderate");
  });

  it("omits the air row entirely when the section is not_configured", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard data={dossier({ air: { status: "not_configured", aqi: null, category: null } })} />,
    );
    expect(markup).not.toContain("Air quality now:");
    expect(markup).toContain("Zone X — minimal flood risk");
  });

  it("derives and renders HUD housing context", () => {
    const view = deriveDossierView(dossier());
    expect(view.housing).toEqual(
      expect.objectContaining({
        zip: "78701",
        twoBedroomFmr: 1840,
        medianIncome: 126000,
        lowIncome4Person: 100800,
      }),
    );
    expect(deriveHousing(dossier().housing)).toEqual(view.housing);

    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier()} />);
    expect(markup).toContain("Housing context");
    expect(markup).toContain("$1,840/mo HUD 2BR FMR");
    expect(markup).toContain("Area median income");
    expect(markup).toContain("HUD User Fair Market Rent and Income Limits");
  });

  it("derives and renders nearby public EV charging context", () => {
    const view = deriveDossierView(dossier());
    expect(view.evCharging).toEqual(
      expect.objectContaining({
        stationCount: 14,
        nearestDistanceMiles: 0.8,
        dcFastPortCount: 4,
        level2PortCount: 18,
      }),
    );
    expect(deriveEvCharging(dossier().evCharging)).toEqual(view.evCharging);

    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier()} />);
    expect(markup).toContain("EV charging nearby");
    expect(markup).toContain("14 public active stations within 10 mi");
    expect(markup).toContain("0.8 mi nearest");
    expect(markup).toContain("18 Level 2");
    expect(markup).toContain("NLR Alternative Fuel Stations");
  });
});

describe("isDossierGated — GATE-API plan gate (entitled:false, HTTP 200)", () => {
  it("is gated when configured and entitled:false", () => {
    expect(isDossierGated({ configured: true, entitled: false } as HomeDossierResponse)).toBe(true);
  });

  it("is gated on a truthy upgradeRequired signal too", () => {
    expect(isDossierGated({ configured: true, upgradeRequired: true } as HomeDossierResponse)).toBe(true);
  });

  it("is NOT gated when configured:false — never tease an unconfigured feature", () => {
    expect(isDossierGated({ configured: false, entitled: false } as HomeDossierResponse)).toBe(false);
  });

  it("is NOT gated for entitled/legacy payloads (entitled absent or true)", () => {
    expect(isDossierGated(dossier())).toBe(false);
    expect(isDossierGated({ ...dossier(), entitled: true })).toBe(false);
    expect(isDossierGated(null)).toBe(false);
    expect(isDossierGated(undefined)).toBe(false);
  });
});

describe("HomeDossierCard — plan-gate teaser rendering", () => {
  const gated = {
    configured: true,
    entitled: false,
    upgradeRequired: true,
    code: "DOSSIER_UPGRADE_REQUIRED",
  } as HomeDossierResponse;

  it("renders the four curated included insight rows + check glyphs + address CTA (no sections in payload)", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={gated} />);

    // Card chrome (serif dossier title) + pitch
    expect(markup).toContain("<em>new home</em>");
    expect(markup).toContain(
      "Nine sourced insights about your next home — from FEMA, HUD, EPA, NCES, NLR, and National Weather Service data.",
    );

    // The teaser shows the 4 highest-signal rows as a curated preview — not a
    // wall of 9 near-identical rows (the CTA conveys the full report has more).
    expect(markup).toContain("Flood zone");
    expect(markup).toContain("School district");
    expect(markup).toContain("Moving-day weather");
    expect(markup).toContain("Natural hazard profile");
    expect(markup.match(/data-lucide="check"/g)).toHaveLength(4);

    // The remaining insights are summarized by the CTA, not listed as more locks.
    expect(markup).not.toContain("Radon");
    expect(markup).not.toContain("Drinking water");
    expect(markup).not.toContain("Air quality");
    expect(markup).not.toContain("Housing context");
    expect(markup).not.toContain("EV charging nearby");

    // CTA -> /addresses
    expect(markup).toContain('href="/addresses"');
    expect(markup).toContain("View dossier");

    // Honest: no fabricated data, no real-row artifacts
    expect(markup).not.toContain("Served by");
    expect(markup).not.toContain("Zone ");
    expect(markup).not.toContain("Moving day:");
  });

  it("teaser takes precedence over data rows even if a gated payload carries sections", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={{ ...dossier(), entitled: false }} />);
    expect(markup).toContain("View dossier");
    expect(markup).not.toContain("Served by Austin ISD");
    expect(markup).not.toContain("Sunny");
  });

  it("shows the place eyebrow when the gated payload includes the address", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard data={{ ...gated, address: { id: "a1", city: "Austin", state: "TX" } }} />,
    );
    expect(markup).toContain("Austin, TX");
  });

  it("still renders nothing when configured:false, even with entitled:false", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard data={{ configured: false, entitled: false } as HomeDossierResponse} />,
    );
    expect(markup).toBe("");
  });

  it("entitled payloads keep rendering the real rows (no teaser)", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={{ ...dossier(), entitled: true }} />);
    expect(markup).toContain("Served by Austin ISD");
    expect(markup).not.toContain("View dossier");
  });

  it("HomeDossierTeaser renders standalone without a place", () => {
    const markup = renderToStaticMarkup(<HomeDossierTeaser />);
    expect(markup).toContain('href="/addresses"');
    expect(markup).toContain("View dossier");
  });
});

describe("deriveNeighborhood — Pro-only section", () => {
  const ok = (
    over: Partial<NonNullable<HomeDossierResponse["neighborhood"]>> = {},
  ): HomeDossierResponse["neighborhood"] => ({
    status: "ok",
    medianHomeValue: 412000,
    medianGrossRent: 1850,
    medianHouseholdIncome: 96500,
    ownerOccupiedPct: 58,
    walkScore: 18.8,
    walkBand: "most",
    schools: [{ name: "Hill Elementary", level: "Elementary" }],
    ...over,
  });

  it("returns the locked teaser variant on upgrade_required", () => {
    expect(deriveNeighborhood(ok({ status: "upgrade_required" }))).toEqual({ locked: true });
  });

  it("sanitizes figures, normalizes the walk band, and caps schools at 3 when ok", () => {
    const row = deriveNeighborhood(
      ok({
        medianHomeValue: 411999.6,
        ownerOccupiedPct: 58.7,
        walkScore: 18.83,
        walkBand: "most",
        schools: [
          { name: " Hill Elementary ", level: " Elementary " },
          { name: "Bryker Woods", level: null },
          { name: "", level: "High" },
          { name: "Casis", level: "Elementary" },
          { name: "Extra", level: "Middle" },
        ],
      }),
    );
    expect(row).toEqual({
      locked: false,
      medianHomeValue: 412000,
      medianGrossRent: 1850,
      medianHouseholdIncome: 96500,
      ownerOccupiedPct: 59,
      walkScore: 18.8,
      walkBand: "most",
      schools: [
        { name: "Hill Elementary", level: "Elementary" },
        { name: "Bryker Woods", level: null },
        { name: "Casis", level: "Elementary" },
      ],
    });
  });

  it("keeps a 0% ownership share but drops non-positive dollar figures", () => {
    expect(
      deriveNeighborhood(
        ok({
          medianHomeValue: 0,
          medianGrossRent: -1,
          medianHouseholdIncome: null,
          ownerOccupiedPct: 0,
          walkScore: null,
          walkBand: null,
          schools: null,
        }),
      ),
    ).toEqual({
      locked: false,
      medianHomeValue: null,
      medianGrossRent: null,
      medianHouseholdIncome: null,
      ownerOccupiedPct: 0,
      walkScore: null,
      walkBand: null,
      schools: [],
    });
  });

  it("keeps the card alive on walkability alone (an unset Census key still has walkability)", () => {
    const row = deriveNeighborhood(
      ok({
        medianHomeValue: null,
        medianGrossRent: null,
        medianHouseholdIncome: null,
        ownerOccupiedPct: null,
        walkScore: 12.4,
        walkBand: "above_average",
        schools: [],
      }),
    );
    expect(row).toEqual({
      locked: false,
      medianHomeValue: null,
      medianGrossRent: null,
      medianHouseholdIncome: null,
      ownerOccupiedPct: null,
      walkScore: 12.4,
      walkBand: "above_average",
      schools: [],
    });
  });

  it("drops an unknown walk band to null (no fabricated label)", () => {
    const row = deriveNeighborhood(ok({ walkScore: 9, walkBand: "weird" as never }));
    expect(row && !row.locked && row.walkBand).toBe(null);
    expect(row && !row.locked && row.walkScore).toBe(9);
  });

  it("hides on degraded statuses and on a legacy omitted section", () => {
    for (const status of ["no_location", "not_configured", "error"] as const) {
      expect(deriveNeighborhood(ok({ status }))).toBeNull();
    }
    expect(deriveNeighborhood(undefined)).toBeNull();
  });

  it("hides an ok section with nothing honest to show", () => {
    expect(
      deriveNeighborhood(
        ok({
          medianHomeValue: null,
          medianGrossRent: null,
          medianHouseholdIncome: null,
          ownerOccupiedPct: null,
          walkScore: null,
          walkBand: null,
          schools: [],
        }),
      ),
    ).toBeNull();
  });
});

describe("formatUsd", () => {
  it("formats whole dollars with grouping and no cents", () => {
    expect(formatUsd(412000, "en-US")).toBe("$412,000");
  });

  it("returns empty string for null/invalid input", () => {
    expect(formatUsd(null, "en-US")).toBe("");
    expect(formatUsd(Number.NaN, "en-US")).toBe("");
  });
});

describe("HomeDossierCard — neighborhood section rendering", () => {
  const withNeighborhood = (n: HomeDossierResponse["neighborhood"]): HomeDossierResponse => ({
    ...dossier(),
    dossierPdf: false,
    neighborhood: n,
  });

  it("renders the area medians, walkability, a school, and the not-this-home caveat", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={withNeighborhood({
          status: "ok",
          medianHomeValue: 412000,
          medianGrossRent: 1850,
          medianHouseholdIncome: 96500,
          ownerOccupiedPct: 58,
          walkScore: 18.8,
          walkBand: "most",
          schools: [{ name: "Hill Elementary", level: "Elementary" }],
        })}
      />,
    );
    expect(markup).toContain("Neighborhood");
    expect(markup).toContain("Median home value");
    expect(markup).toContain("$412,000");
    expect(markup).toContain("$1,850/mo");
    expect(markup).toContain("Median household income");
    expect(markup).toContain("$96,500");
    expect(markup).toContain("58%");
    // EPA walkability row — score + band label.
    expect(markup).toContain("Walkability");
    expect(markup).toContain("18.8/20");
    expect(markup).toContain("Most walkable");
    // Nearby schools — directory data only (name + level), never a rating.
    expect(markup).toContain("Hill Elementary");
    expect(markup).toContain("Elementary");
    // MANDATORY honesty caveat — area medians, not a valuation of this home.
    expect(markup).toContain("not a valuation of this home");
  });

  it("renders the included neighborhood teaser (no figures) on upgrade_required", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={withNeighborhood({
          status: "upgrade_required",
          medianHomeValue: null,
          medianGrossRent: null,
          medianHouseholdIncome: null,
          ownerOccupiedPct: null,
          schools: null,
        })}
      />,
    );
    expect(markup).toContain("Neighborhood");
    expect(markup).toContain("View neighborhood");
    expect(markup).toContain('href="/addresses"');
    expect(markup).toContain("Included");
    // No fabricated neighborhood figures leak into the locked variant.
    expect(markup).not.toContain("$412,000");
    expect(markup).not.toContain("$1,850");
    expect(markup).not.toContain("$96,500");
    expect(markup).not.toContain("Median home value");
  });

  it("omits the whole neighborhood row on a legacy payload without the section", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier()} />);
    expect(markup).not.toContain("Median home value");
    expect(markup).not.toContain("View neighborhood");
  });
});

describe("HomeDossierCard — Pro PDF export affordance", () => {
  it("shows the Export PDF link wired to the dossier PDF route only when dossierPdf is true", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard data={{ ...dossier(), dossierPdf: true }} />,
    );
    expect(markup).toContain("Export PDF");
    expect(markup).toContain('href="/api/addresses/addr-1/dossier/pdf"');
    expect(markup).toContain("aria-label=");
  });

  it("hides the Export PDF link for non-Pro / older payloads (no dead click to the teaser)", () => {
    expect(renderToStaticMarkup(<HomeDossierCard data={dossier()} />)).not.toContain("Export PDF");
    expect(
      renderToStaticMarkup(<HomeDossierCard data={{ ...dossier(), dossierPdf: false }} />),
    ).not.toContain("Export PDF");
  });

  it("never shows the Export PDF link on the plan-gate teaser (non-entitled)", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={{ configured: true, entitled: false, upgradeRequired: true, dossierPdf: true } as HomeDossierResponse}
      />,
    );
    expect(markup).not.toContain("Export PDF");
  });
});

describe("dashboard wiring regression", () => {
  function readWebSource(relativePath: string) {
    const cwd = process.cwd();
    const webRoot = cwd.endsWith(`${path.sep}apps${path.sep}web`) ? cwd : path.join(cwd, "apps", "web");
    return readFileSync(path.join(webRoot, relativePath), "utf8");
  }

  it("registers the homeDossier widget in the dashboard registry", () => {
    const source = readWebSource("src/app/(app)/dashboard/dashboard-client.tsx");
    expect(source).toContain('{ key: "homeDossier", default: true }');
    expect(source).toContain('homeDossier: td("widget_homeDossier")');
    expect(source).toContain('case "homeDossier":');
    expect(source).toContain('"moving", "homeDossier", "spending"');
    expect(source).toContain("stats: true");
  });

  it("uses the plan-accent primary classes on the header Plan-a-Move CTA (not the always-cool orange tone)", () => {
    const source = readWebSource("src/app/(app)/dashboard/dashboard-client.tsx");
    expect(source).toContain("rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90");
    expect(source).not.toContain("rounded-xl bg-tone-orange-fg text-white text-sm font-medium");
  });

  it("keeps en/es dossier catalog keys in parity", () => {
    const en = JSON.parse(readWebSource("src/i18n/messages/en.json"));
    const es = JSON.parse(readWebSource("src/i18n/messages/es.json"));
    const dossierKeys = (cat: Record<string, Record<string, string>>) =>
      Object.keys(cat.dashboard).filter((k) => k.startsWith("dossier_") || k === "widget_homeDossier");
    expect(dossierKeys(en).sort()).toEqual(dossierKeys(es).sort());
    expect(dossierKeys(en).length).toBeGreaterThan(0);
  });

  it("keeps the source dossier deck as the primary view and preserves its controls", () => {
    const source = readWebSource("src/components/dashboard/home-dossier.tsx");
    const css = readWebSource("src/styles/globals.css");

    expect(source).toContain('className="lf-dossier-source-toolbar px-5 pb-2"');
    expect(source).toContain('data-expanded={dossierFull ? "true" : "false"}');
    expect(source).toContain('showTag={false} pauseOffscreen={false}');
    expect(source).toContain('data-source-compact={hasSourceDeck ? "true" : "false"}');

    expect(css).toContain('.lf-dossier-grid[data-source-compact="true"]');
    expect(css).toContain("display: none;");
    expect(css).toContain('.lf-dossier-source-deck:not([data-expanded="true"]) .lf-dossier-source-card');
    expect(css).toContain("@keyframes lf-mv-rise");
    expect(css).toContain(".lf-move-rise");
    expect(css).not.toContain(".lf-dossier-source-toolbar { display: none;");
    expect(css).not.toContain(".lf-dossier-source-deck { display: none;");
  });
});
