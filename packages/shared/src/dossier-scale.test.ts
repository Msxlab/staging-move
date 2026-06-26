import { describe, it, expect } from "vitest";
import { scoreForAir, scoreForFlood, scoreForWeather } from "./dossier-scale";

describe("scoreForAir", () => {
  it("maps EPA AQI bands to 5 levels", () => {
    expect(scoreForAir({ aqi: 30 }).level).toBe(1);
    expect(scoreForAir({ aqi: 75 }).level).toBe(2);
    expect(scoreForAir({ aqi: 130 }).level).toBe(3);
    expect(scoreForAir({ aqi: 180 }).level).toBe(4);
    expect(scoreForAir({ aqi: 260 }).level).toBe(5);
  });

  it("exposes displayValue, bandLabel, narrationKey", () => {
    const r = scoreForAir({ aqi: 75 });
    expect(r.displayValue).toBe("AQI 75");
    expect(r.bandLabel).toBe("Moderate");
    expect(r.narrationKey).toBe("dossier.air.l2");
    expect(r.available).toBe(true);
  });

  it("clamps the score to 0-100", () => {
    expect(scoreForAir({ aqi: 30 }).score).toBe(15);
    expect(scoreForAir({ aqi: 260 }).score).toBe(100);
  });

  it("is unavailable with no reading", () => {
    expect(scoreForAir({ aqi: null }).available).toBe(false);
    expect(scoreForAir({ aqi: null }).narrationKey).toBe("dossier.air.unavailable");
  });
});

describe("scoreForFlood", () => {
  it("maps zones to a documented risk level", () => {
    expect(scoreForFlood({ zone: "X", isHighRisk: false }).level).toBe(1);
    expect(scoreForFlood({ zone: "AO", isHighRisk: true }).level).toBe(3);
    expect(scoreForFlood({ zone: "AE", isHighRisk: true }).level).toBe(4);
    expect(scoreForFlood({ zone: "VE", isHighRisk: true }).level).toBe(5);
  });

  it("falls back to isHighRisk when zone is unknown", () => {
    expect(scoreForFlood({ zone: null, isHighRisk: true }).level).toBe(4);
    expect(scoreForFlood({ zone: null, isHighRisk: false }).level).toBe(1);
    expect(scoreForFlood({ zone: null, isHighRisk: null }).available).toBe(false);
  });

  it("is case-insensitive on the zone code", () => {
    expect(scoreForFlood({ zone: "ae", isHighRisk: null }).level).toBe(4);
  });
});

describe("scoreForWeather", () => {
  it("scores moving-day disruption into 5 levels", () => {
    expect(
      scoreForWeather({ summary: "Sunny", precipChancePct: 0, tempHighF: 72, tempLowF: 55 }).level,
    ).toBe(1);
    expect(
      scoreForWeather({ summary: "Heavy snow", precipChancePct: 90, tempHighF: 28, tempLowF: 15 }).level,
    ).toBe(5);
  });

  it("derives the weather type for the glyph", () => {
    expect(scoreForWeather({ summary: "Sunny", precipChancePct: 0, tempHighF: 72, tempLowF: 55 }).typeKey).toBe("sun");
    expect(scoreForWeather({ summary: "Thunderstorms", precipChancePct: 80, tempHighF: 70, tempLowF: 60 }).typeKey).toBe("storm");
  });

  it("is unavailable without a forecast", () => {
    expect(
      scoreForWeather({ summary: null, precipChancePct: null, tempHighF: null, tempLowF: null }).available,
    ).toBe(false);
  });
});
