import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DossierAmbient, ambientForSection } from "./dossier-ambient";

describe("ambientForSection — flood", () => {
  it("maps FEMA high-risk to elevated, low-risk to calm, unknown to moderate", () => {
    expect(ambientForSection({ kind: "flood", isHighRisk: true })).toEqual({
      kind: "flood",
      intensity: 2,
    });
    expect(ambientForSection({ kind: "flood", isHighRisk: false })).toEqual({
      kind: "flood",
      intensity: 0,
    });
    expect(ambientForSection({ kind: "flood", isHighRisk: null })).toEqual({
      kind: "flood",
      intensity: 1,
    });
  });
});

describe("ambientForSection — school", () => {
  it("is a fixed moderate ambience (directory data carries no risk signal)", () => {
    expect(ambientForSection({ kind: "school" })).toEqual({ kind: "school", intensity: 1 });
  });
});

describe("ambientForSection — hazard", () => {
  const risk = (hazard: string, rating: string) => ({ kind: "hazard" as const, topRisks: [{ hazard, rating }] });

  it("takes intensity from the TOP risk chip's NRI rating", () => {
    expect(ambientForSection(risk("Strong Wind", "Relatively High")).intensity).toBe(2);
    expect(ambientForSection(risk("Strong Wind", "Very High")).intensity).toBe(2);
    expect(ambientForSection(risk("Strong Wind", "Relatively Moderate")).intensity).toBe(1);
    expect(ambientForSection(risk("Strong Wind", "Relatively Low")).intensity).toBe(0);
    expect(ambientForSection(risk("Strong Wind", "Very Low")).intensity).toBe(0);
  });

  it("maps the TOP hazard name to the lightning / winter / wind variant", () => {
    expect(ambientForSection(risk("Lightning", "Relatively High")).variant).toBe("lightning");
    expect(ambientForSection(risk("Winter Weather", "Relatively Moderate")).variant).toBe("winter");
    expect(ambientForSection(risk("Ice Storm", "Relatively Moderate")).variant).toBe("winter");
    expect(ambientForSection(risk("Hail", "Relatively Moderate")).variant).toBe("winter");
    expect(ambientForSection(risk("Cold Wave", "Relatively Low")).variant).toBe("winter");
    expect(ambientForSection(risk("Strong Wind", "Relatively High")).variant).toBe("wind");
    expect(ambientForSection(risk("Tornado", "Relatively High")).variant).toBe("wind");
  });

  it("falls back to a calm wind scene for unknown hazards and empty lists", () => {
    expect(ambientForSection(risk("Wildfire", "Relatively High")).variant).toBe("wind");
    expect(ambientForSection({ kind: "hazard", topRisks: [] })).toEqual({
      kind: "hazard",
      intensity: 0,
      variant: "wind",
    });
  });

  it("only reads the FIRST (top) risk", () => {
    const spec = ambientForSection({
      kind: "hazard",
      topRisks: [
        { hazard: "Hail", rating: "Relatively Low" },
        { hazard: "Lightning", rating: "Very High" },
      ],
    });
    expect(spec).toEqual({ kind: "hazard", intensity: 0, variant: "winter" });
  });
});

describe("ambientForSection — radon", () => {
  it("maps EPA zones to intensity (zone 1 = highest potential)", () => {
    expect(ambientForSection({ kind: "radon", zone: 1 }).intensity).toBe(2);
    expect(ambientForSection({ kind: "radon", zone: 2 }).intensity).toBe(1);
    expect(ambientForSection({ kind: "radon", zone: 3 }).intensity).toBe(0);
  });
});

describe("ambientForSection — air", () => {
  it("bands AQI at 50 and 100", () => {
    expect(ambientForSection({ kind: "air", aqi: 12 }).intensity).toBe(0);
    expect(ambientForSection({ kind: "air", aqi: 50 }).intensity).toBe(0);
    expect(ambientForSection({ kind: "air", aqi: 51 }).intensity).toBe(1);
    expect(ambientForSection({ kind: "air", aqi: 100 }).intensity).toBe(1);
    expect(ambientForSection({ kind: "air", aqi: 101 }).intensity).toBe(2);
    expect(ambientForSection({ kind: "air", aqi: 180 }).intensity).toBe(2);
  });

  it("falls back to AirNow category when AQI is absent", () => {
    expect(ambientForSection({ kind: "air", aqi: null, category: "Good" }).intensity).toBe(0);
    expect(ambientForSection({ kind: "air", aqi: null, category: "Moderate" }).intensity).toBe(1);
    expect(ambientForSection({ kind: "air", aqi: null, category: "Unhealthy" }).intensity).toBe(2);
  });
});

describe("ambientForSection - water / housing / EV", () => {
  it("maps water violations to clear / notice / violation bands", () => {
    expect(ambientForSection({ kind: "water", violations5y: 0 })).toEqual({ kind: "water", intensity: 0 });
    expect(ambientForSection({ kind: "water", violations5y: null })).toEqual({ kind: "water", intensity: 1 });
    expect(ambientForSection({ kind: "water", violations5y: 3 })).toEqual({ kind: "water", intensity: 2 });
  });

  it("derives housing ambience from HUD rent and income figures", () => {
    expect(
      ambientForSection({ kind: "housing", twoBedroomFmr: 1200, medianIncome: 52000, lowIncome4Person: 42000 }),
    ).toEqual({ kind: "housing", intensity: 0 });
    expect(
      ambientForSection({ kind: "housing", twoBedroomFmr: 1800, medianIncome: 70000, lowIncome4Person: 68000 }),
    ).toEqual({ kind: "housing", intensity: 1 });
    expect(
      ambientForSection({ kind: "housing", twoBedroomFmr: 2600, medianIncome: 110000, lowIncome4Person: 98000 }),
    ).toEqual({ kind: "housing", intensity: 2 });
  });

  it("maps EV charging density from station and fast-port counts", () => {
    expect(
      ambientForSection({ kind: "evCharging", stationCount: 0, dcFastPortCount: 0, level2PortCount: 0 }),
    ).toEqual({ kind: "evCharging", intensity: 0 });
    expect(
      ambientForSection({ kind: "evCharging", stationCount: 3, dcFastPortCount: 0, level2PortCount: 8 }),
    ).toEqual({ kind: "evCharging", intensity: 1 });
    expect(
      ambientForSection({ kind: "evCharging", stationCount: 3, dcFastPortCount: 1, level2PortCount: 8 }),
    ).toEqual({ kind: "evCharging", intensity: 2 });
  });
});

describe("ambientForSection — neighborhood", () => {
  it("derives footstep cadence intensity from the walk band", () => {
    expect(ambientForSection({ kind: "neighborhood", walkBand: "most" }).intensity).toBe(2);
    expect(ambientForSection({ kind: "neighborhood", walkBand: "above_average" }).intensity).toBe(1);
    expect(ambientForSection({ kind: "neighborhood", walkBand: "below_average" }).intensity).toBe(0);
    expect(ambientForSection({ kind: "neighborhood", walkBand: "least" }).intensity).toBe(0);
    expect(ambientForSection({ kind: "neighborhood", walkBand: null }).intensity).toBe(0);
  });
});

describe("ambientForSection — weather", () => {
  it("maps explicit severe/cold/fog/wind/heat summaries before generic rain/cloud/sun", () => {
    expect(
      ambientForSection({ kind: "weather", summary: "Thunderstorms likely", precipChancePct: 30 }),
    ).toEqual({ kind: "weather", intensity: 2, variant: "storm" });
    expect(
      ambientForSection({ kind: "weather", summary: "Heavy snow", precipChancePct: 80 }),
    ).toEqual({ kind: "weather", intensity: 2, variant: "snow" });
    expect(
      ambientForSection({ kind: "weather", summary: "Dense fog", precipChancePct: 20 }),
    ).toEqual({ kind: "weather", intensity: 2, variant: "fog" });
    expect(
      ambientForSection({ kind: "weather", summary: "Wind gusts", precipChancePct: 20 }),
    ).toEqual({ kind: "weather", intensity: 2, variant: "wind" });
    expect(
      ambientForSection({ kind: "weather", summary: "Sunny", precipChancePct: 10, tempHighF: 101 }),
    ).toEqual({ kind: "weather", intensity: 2, variant: "heat" });
    expect(
      ambientForSection({ kind: "weather", summary: "Clear", precipChancePct: 0, tempLowF: 24 }),
    ).toEqual({ kind: "weather", intensity: 2, variant: "cold" });
  });

  it("precip >= 50 wins as rain, elevated at >= 80, even when the summary mentions clouds", () => {
    expect(
      ambientForSection({ kind: "weather", summary: "Cloudy", precipChancePct: 60 }),
    ).toEqual({ kind: "weather", intensity: 1, variant: "rain" });
    expect(
      ambientForSection({ kind: "weather", summary: "Showers", precipChancePct: 85 }),
    ).toEqual({ kind: "weather", intensity: 2, variant: "rain" });
  });

  it("summary mentioning cloud (any case) maps to the cloud scene", () => {
    expect(
      ambientForSection({ kind: "weather", summary: "Partly Cloudy", precipChancePct: 20 }),
    ).toEqual({ kind: "weather", intensity: 1, variant: "cloud" });
    expect(
      ambientForSection({ kind: "weather", summary: "clouds increasing", precipChancePct: null }),
    ).toEqual({ kind: "weather", intensity: 1, variant: "cloud" });
  });

  it("defaults to the calm sun scene", () => {
    expect(ambientForSection({ kind: "weather", summary: "Sunny", precipChancePct: 10 })).toEqual({
      kind: "weather",
      intensity: 0,
      variant: "sun",
    });
    expect(ambientForSection({ kind: "weather", summary: null, precipChancePct: null })).toEqual({
      kind: "weather",
      intensity: 0,
      variant: "sun",
    });
  });
});

describe("DossierAmbient rendering", () => {
  it("renders an aria-hidden, pointer-events-none masked layer with data attributes", () => {
    const markup = renderToStaticMarkup(<DossierAmbient kind="flood" intensity={2} />);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("da-layer");
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain('data-kind="flood"');
    expect(markup).toContain('data-intensity="2"');
  });

  it("clamps out-of-range intensity into the 0-2 contract", () => {
    expect(renderToStaticMarkup(<DossierAmbient kind="radon" intensity={7} />)).toContain(
      'data-intensity="2"',
    );
    expect(renderToStaticMarkup(<DossierAmbient kind="radon" intensity={-3} />)).toContain(
      'data-intensity="0"',
    );
  });

  it("renders the three parallax waves for the flood scene", () => {
    const markup = renderToStaticMarkup(<DossierAmbient kind="flood" intensity={1} />);
    expect(markup).toContain("da-wave-back");
    expect(markup).toContain("da-wave-mid");
    expect(markup).toContain("da-wave-front");
  });

  it("renders the hazard scene by variant", () => {
    expect(
      renderToStaticMarkup(<DossierAmbient kind="hazard" intensity={2} variant="lightning" />),
    ).toContain("da-bolt");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="hazard" intensity={1} variant="winter" />),
    ).toContain("da-snow");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="hazard" intensity={1} variant="wind" />),
    ).toContain("da-streak");
  });

  it("scales scene density with intensity (wind streak count)", () => {
    const calm = renderToStaticMarkup(<DossierAmbient kind="hazard" intensity={0} variant="wind" />);
    const elevated = renderToStaticMarkup(<DossierAmbient kind="hazard" intensity={2} variant="wind" />);
    expect(calm.match(/da-streak-track/g)).toHaveLength(3);
    expect(elevated.match(/da-streak-track/g)).toHaveLength(5);
  });

  it("renders the air extras only at their bands (leaf at 0, haze at 2)", () => {
    const calm = renderToStaticMarkup(<DossierAmbient kind="air" intensity={0} />);
    const moderate = renderToStaticMarkup(<DossierAmbient kind="air" intensity={1} />);
    const elevated = renderToStaticMarkup(<DossierAmbient kind="air" intensity={2} />);
    expect(calm).toContain("da-leaf");
    expect(calm).not.toContain("da-haze");
    expect(moderate).not.toContain("da-leaf");
    expect(moderate).not.toContain("da-haze");
    expect(elevated).toContain("da-haze");
    expect(elevated).not.toContain("da-leaf");
  });

  it("renders water, housing, and EV scenes", () => {
    const water = renderToStaticMarkup(<DossierAmbient kind="water" intensity={2} />);
    expect(water).toContain("da-water-ripple");
    expect(water).toContain("da-water-drop");

    const housing = renderToStaticMarkup(<DossierAmbient kind="housing" intensity={1} />);
    expect(housing).toContain("da-housing-homes");
    expect(housing.match(/da-housing-bar/g)).toHaveLength(4);

    const ev = renderToStaticMarkup(<DossierAmbient kind="evCharging" intensity={2} />);
    expect(ev).toContain("da-ev-path");
    expect(ev.match(/da-ev-node/g)).toHaveLength(3);
    expect(ev).toContain("da-ev-bolt");
  });

  it("renders the weather scene by variant", () => {
    expect(renderToStaticMarkup(<DossierAmbient kind="weather" intensity={0} variant="sun" />)).toContain(
      "da-sun",
    );
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="cloud" />),
    ).toContain("da-wcloud");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="rain" />),
    ).toContain("da-rain");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={2} variant="storm" />),
    ).toContain("da-bolt");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={2} variant="snow" />),
    ).toContain("da-snow");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="fog" />),
    ).toContain("da-fog-line");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="heat" />),
    ).toContain("da-heat-line");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="wind" />),
    ).toContain("da-streak");
  });

  it("renders the neighborhood skyline with staggered windows and footsteps", () => {
    const markup = renderToStaticMarkup(<DossierAmbient kind="neighborhood" intensity={2} />);
    expect(markup.match(/da-bld/g)).toHaveLength(7);
    expect(markup.match(/da-window/g)).toHaveLength(8);
    expect(markup.match(/da-step(?!-)/g)).toHaveLength(3);
    expect(markup).toContain("da-walkpath");
  });
});
