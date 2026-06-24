import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DossierRaccoon, dossierRaccoonFor } from "./dossier-raccoon";

/**
 * The mood table is the data-honesty contract: a given reading must surface the
 * SAME expression on web and mobile (apps/mobile/src/lib/dossier-raccoon.ts).
 */
describe("dossierRaccoonFor — mood mapping (mobile parity)", () => {
  it("flood: safe -> approved, unknown -> thinking, high-risk -> alert", () => {
    expect(dossierRaccoonFor({ kind: "flood", intensity: 0 })).toBe("approved");
    expect(dossierRaccoonFor({ kind: "flood", intensity: 1 })).toBe("thinking");
    expect(dossierRaccoonFor({ kind: "flood", intensity: 2 })).toBe("alert");
  });

  it("school is always happy (known district is good news)", () => {
    expect(dossierRaccoonFor({ kind: "school", intensity: 0 })).toBe("happy");
    expect(dossierRaccoonFor({ kind: "school", intensity: 1 })).toBe("happy");
  });

  it("hazard / radon / air / water scale from good to alarmed", () => {
    expect(dossierRaccoonFor({ kind: "hazard", intensity: 0 })).toBe("calm");
    expect(dossierRaccoonFor({ kind: "hazard", intensity: 2 })).toBe("alert");
    expect(dossierRaccoonFor({ kind: "radon", intensity: 0 })).toBe("happy");
    expect(dossierRaccoonFor({ kind: "radon", intensity: 2 })).toBe("alert");
    expect(dossierRaccoonFor({ kind: "air", intensity: 0 })).toBe("happy");
    expect(dossierRaccoonFor({ kind: "water", intensity: 0 })).toBe("approved");
    expect(dossierRaccoonFor({ kind: "water", intensity: 2 })).toBe("alert");
  });

  it("housing high-cost is a concern (thinking), not a hazard (alert)", () => {
    expect(dossierRaccoonFor({ kind: "housing", intensity: 0 })).toBe("happy");
    expect(dossierRaccoonFor({ kind: "housing", intensity: 2 })).toBe("thinking");
  });

  it("ev / neighborhood: more is better -> approved at the top", () => {
    expect(dossierRaccoonFor({ kind: "evCharging", intensity: 0 })).toBe("calm");
    expect(dossierRaccoonFor({ kind: "evCharging", intensity: 2 })).toBe("approved");
    expect(dossierRaccoonFor({ kind: "neighborhood", intensity: 2 })).toBe("approved");
  });

  it("weather reads the variant first: storm alarms, sun delights", () => {
    expect(dossierRaccoonFor({ kind: "weather", intensity: 2, variant: "storm" })).toBe("alert");
    expect(dossierRaccoonFor({ kind: "weather", intensity: 0, variant: "sun" })).toBe("happy");
    expect(dossierRaccoonFor({ kind: "weather", intensity: 1, variant: "cloud" })).toBe("calm");
    expect(dossierRaccoonFor({ kind: "weather", intensity: 1, variant: "rain" })).toBe("thinking");
    expect(dossierRaccoonFor({ kind: "weather", intensity: 2, variant: "rain" })).toBe("alert");
  });
});

describe("DossierRaccoon rendering", () => {
  it("is an aria-hidden SVG tagged with its mood", () => {
    const markup = renderToStaticMarkup(<DossierRaccoon mood="approved" />);
    expect(markup).toContain("<svg");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-mood="approved"');
  });

  it("shows the approved sparkles and the happy smile only at the right moods", () => {
    // approved = sparkle + smile; alert = neither smile.
    const approved = renderToStaticMarkup(<DossierRaccoon mood="approved" />);
    const alert = renderToStaticMarkup(<DossierRaccoon mood="alert" />);
    expect(approved).toContain("M24 37 L25.5 33"); // sparkle path
    expect(approved).toContain("M43 75 Q50 81 57 75"); // happy smile
    expect(alert).not.toContain("M43 75 Q50 81 57 75");
  });
});
