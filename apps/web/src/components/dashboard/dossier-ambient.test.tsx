import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DossierAmbient, ambientForSection, sourceDossierSceneFor } from "./dossier-ambient";

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

describe("sourceDossierSceneFor", () => {
  it("maps current ambient rows to the source DossierScene type/level matrix", () => {
    expect(sourceDossierSceneFor({ kind: "air", intensity: 0 })).toEqual({ type: "air", level: "good" });
    expect(sourceDossierSceneFor({ kind: "air", intensity: 1 })).toEqual({ type: "air", level: "mid" });
    expect(sourceDossierSceneFor({ kind: "air", intensity: 2 })).toEqual({ type: "air", level: "bad" });
    expect(sourceDossierSceneFor({ kind: "flood", intensity: 2 })).toEqual({ type: "flood", level: "bad" });
    expect(sourceDossierSceneFor({ kind: "water", intensity: 2 })).toEqual({ type: "water", level: "bad" });
    expect(sourceDossierSceneFor({ kind: "housing", intensity: 2 })).toEqual({ type: "housing", level: "mid" });
    expect(sourceDossierSceneFor({ kind: "hazard", intensity: 2, variant: "lightning" })).toEqual({
      type: "weather",
      level: "storm",
    });
  });

  it("preserves source weather variants and positive availability bands", () => {
    expect(sourceDossierSceneFor({ kind: "weather", intensity: 2, variant: "storm" })).toEqual({
      type: "weather",
      level: "storm",
    });
    expect(sourceDossierSceneFor({ kind: "weather", intensity: 1, variant: "winter" })).toEqual({
      type: "weather",
      level: "snow",
    });
    expect(sourceDossierSceneFor({ kind: "evCharging", intensity: 2 })).toEqual({
      type: "transit",
      level: "good",
    });
    expect(sourceDossierSceneFor({ kind: "evCharging", intensity: 0 })).toEqual({
      type: "transit",
      level: "bad",
    });
    expect(sourceDossierSceneFor({ kind: "neighborhood", intensity: 2 })).toEqual({
      type: "area",
      level: "good",
    });
  });
});

describe("DossierAmbient rendering", () => {
  it("defines every rendered source-scene CSS class", () => {
    const source = readFileSync(new URL("./dossier-ambient.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../../styles/source-dossier-scene.css", import.meta.url), "utf8");
    const used = new Set(
      Array.from(source.matchAll(/className="([^"]+)"/g))
        .flatMap((match) => match[1].split(/\s+/))
        .filter((className) => className.startsWith("ds-")),
    );
    const defined = new Set(
      Array.from(css.matchAll(/\.([A-Za-z0-9_-]+)/g))
        .map((match) => match[1])
        .filter((className) => className.startsWith("ds-")),
    );
    const missing = Array.from(used).filter((className) => !defined.has(className));

    expect(missing).toEqual([]);
  });

  it("renders an aria-hidden, pointer-events-none masked layer with data attributes", () => {
    const markup = renderToStaticMarkup(<DossierAmbient kind="flood" intensity={2} />);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("da-layer");
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain('data-kind="flood"');
    expect(markup).toContain('data-intensity="2"');
    // Flood maps to its dedicated FLOOD scene (not water, not the area crime/patrol scene).
    expect(markup).toContain('data-source-type="flood"');
    expect(markup).toContain('data-source-level="bad"');
    expect(markup).toContain('data-ds-type="flood"');
    expect(markup).toContain('data-ds-level="bad"');
    expect(markup).toContain("ds-flood-band");
    expect(markup).toContain("lf-dossier-scene-tag");
    expect(markup).toContain("ALERT");
    expect(markup).toContain("--ds-tone");
    expect(markup).toContain("--rc-head");
  });

  it("clamps out-of-range intensity into the 0-2 contract", () => {
    expect(renderToStaticMarkup(<DossierAmbient kind="radon" intensity={7} />)).toContain(
      'data-intensity="2"',
    );
    expect(renderToStaticMarkup(<DossierAmbient kind="radon" intensity={-3} />)).toContain(
      'data-intensity="0"',
    );
  });

  it("maps flood to its dedicated flood scene and radon to air (not the area crime/streetlight scenes)", () => {
    const flood = renderToStaticMarkup(<DossierAmbient kind="flood" intensity={2} />);
    expect(flood).toContain('data-ds-type="flood"');
    expect(flood).toContain('data-ds-level="bad"');
    expect(flood).toContain("ds-flood");
    expect(flood).toContain("ds-flood-bad");
    expect(flood).not.toContain("ds-chase-pack");

    const radon = renderToStaticMarkup(<DossierAmbient kind="radon" intensity={0} />);
    expect(radon).toContain('data-ds-type="air"');
    expect(radon).toContain('data-ds-level="good"');
  });

  it("never renders the area crime/chase scene for school or low-walkability neighborhood", () => {
    // School is informational: calm, well-lit area scene.
    const school = renderToStaticMarkup(<DossierAmbient kind="school" intensity={1} />);
    expect(school).toContain('data-ds-type="area"');
    expect(school).toContain('data-ds-level="good"');

    // Walkability is not a safety signal: a low walk band must clamp to "mid", never "bad".
    const lowWalk = renderToStaticMarkup(<DossierAmbient kind="neighborhood" intensity={0} />);
    expect(lowWalk).toContain('data-ds-type="area"');
    expect(lowWalk).toContain('data-ds-level="mid"');
    expect(lowWalk).not.toContain("ds-chase-pack");
  });

  it("renders the source air and storm character props", () => {
    const air = renderToStaticMarkup(<DossierAmbient kind="air" intensity={2} />);
    expect(air).toContain('data-ds-type="air"');
    expect(air).toContain('data-ds-level="bad"');
    expect(air).toContain("ds-mask");
    expect(air).toContain("ds-popmark");

    const storm = renderToStaticMarkup(<DossierAmbient kind="weather" intensity={2} variant="storm" />);
    expect(storm).toContain('data-ds-level="storm"');
    expect(storm).toContain("ds-flash");
    expect(storm).toContain("ds-lightning");
  });

  it("renders hazard rows through source weather variants", () => {
    expect(
      renderToStaticMarkup(<DossierAmbient kind="hazard" intensity={2} variant="lightning" />),
    ).toContain('data-ds-level="storm"');
    expect(
      renderToStaticMarkup(<DossierAmbient kind="hazard" intensity={1} variant="winter" />),
    ).toContain('data-ds-level="snow"');
    expect(
      renderToStaticMarkup(<DossierAmbient kind="hazard" intensity={1} variant="wind" />),
    ).toContain('data-ds-level="wind"');
  });

  it("renders the source transit availability bands", () => {
    const frequent = renderToStaticMarkup(<DossierAmbient kind="evCharging" intensity={2} />);
    expect(frequent).toContain('data-ds-type="transit"');
    expect(frequent).toContain('data-ds-level="good"');
    expect(frequent.match(/ds-vehicle/g)).not.toBeNull();

    const none = renderToStaticMarkup(<DossierAmbient kind="evCharging" intensity={0} />);
    expect(none).toContain('data-ds-level="bad"');
    expect(none).toContain("ds-sign");
  });

  it("renders the source air extras at their bands", () => {
    const calm = renderToStaticMarkup(<DossierAmbient kind="air" intensity={0} />);
    const moderate = renderToStaticMarkup(<DossierAmbient kind="air" intensity={1} />);
    const elevated = renderToStaticMarkup(<DossierAmbient kind="air" intensity={2} />);
    expect(calm).toContain("ds-leaf");
    expect(calm).not.toContain("ds-mask");
    expect(moderate).toContain("ds-mote-amber");
    expect(moderate).toContain("ds-mask");
    expect(elevated).toContain("ds-haze-bg");
    expect(elevated).toContain("ds-mask");
  });

  it("renders source water and housing scenes", () => {
    const water = renderToStaticMarkup(<DossierAmbient kind="water" intensity={2} />);
    expect(water).toContain('data-ds-type="water"');
    expect(water).toContain('data-ds-level="bad"');
    expect(water).toContain("ds-alert-symbol");

    const housing = renderToStaticMarkup(<DossierAmbient kind="housing" intensity={1} />);
    expect(housing).toContain('data-ds-type="housing"');
    expect(housing).toContain("ds-house-row");
    expect(housing.match(/ds-house/g)).not.toBeNull();
  });

  it("renders the weather scene by variant", () => {
    expect(renderToStaticMarkup(<DossierAmbient kind="weather" intensity={0} variant="sun" />)).toContain(
      "ds-sun-core",
    );
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="cloud" />),
    ).toContain("ds-cloud-a");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="rain" />),
    ).toContain("ds-umbrella");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={2} variant="storm" />),
    ).toContain("ds-lightning");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={2} variant="snow" />),
    ).toContain("ds-snowman");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="fog" />),
    ).toContain("ds-fogband");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="heat" />),
    ).toContain("ds-ac");
    expect(
      renderToStaticMarkup(<DossierAmbient kind="weather" intensity={1} variant="wind" />),
    ).toContain("ds-streak");
  });

  it("renders neighborhood as the source area confidence scene", () => {
    const markup = renderToStaticMarkup(<DossierAmbient kind="neighborhood" intensity={2} />);
    expect(markup).toContain('data-ds-type="area"');
    expect(markup).toContain('data-ds-level="good"');
    expect(markup).toContain("ds-lamp-glow");
    expect(markup).toContain("ds-badge");
  });
});
