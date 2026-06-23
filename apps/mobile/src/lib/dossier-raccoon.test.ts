import { describe, expect, it } from "vitest";
import {
  dossierRaccoonFor,
  type DossierRaccoonInput,
  type DossierRaccoonMood,
} from "./dossier-raccoon";
import type { AmbientIntensity, AmbientKind, AmbientVariant } from "./home-dossier";

const ALL_KINDS: ReadonlyArray<AmbientKind> = [
  "flood",
  "school",
  "hazard",
  "radon",
  "water",
  "air",
  "housing",
  "evCharging",
  "neighborhood",
  "weather",
];

const ALL_LEVELS: ReadonlyArray<AmbientIntensity> = [0, 1, 2];

const VALID_MOODS: ReadonlyArray<DossierRaccoonMood> = [
  "calm",
  "alert",
  "happy",
  "thinking",
  "approved",
];

const GOOD_MOODS: ReadonlyArray<DossierRaccoonMood> = ["happy", "approved"];

function mood(input: DossierRaccoonInput): DossierRaccoonMood {
  return dossierRaccoonFor(input);
}

describe("dossierRaccoonFor", () => {
  it("maps every kind at every level to a valid raccoon mood", () => {
    for (const kind of ALL_KINDS) {
      for (const intensity of ALL_LEVELS) {
        const result = mood({ kind, intensity });
        expect(VALID_MOODS, `${kind}@${intensity}`).toContain(result);
      }
    }
  });

  it("alarms (alert) on every high-risk / bad reading", () => {
    // Risk/quality scenes whose level 2 means danger -> the raccoon must alert.
    expect(mood({ kind: "flood", intensity: 2 })).toBe("alert");
    expect(mood({ kind: "hazard", intensity: 2 })).toBe("alert");
    expect(mood({ kind: "radon", intensity: 2 })).toBe("alert");
    expect(mood({ kind: "water", intensity: 2 })).toBe("alert");
    expect(mood({ kind: "air", intensity: 2 })).toBe("alert");
    expect(mood({ kind: "weather", intensity: 2, variant: "storm" })).toBe("alert");
    expect(mood({ kind: "weather", intensity: 2, variant: "lightning" })).toBe("alert");
    expect(mood({ kind: "weather", intensity: 2, variant: "snow" })).toBe("alert");
  });

  it("delights (happy/approved) on safe / good readings", () => {
    expect(GOOD_MOODS).toContain(mood({ kind: "flood", intensity: 0 }));
    expect(GOOD_MOODS).toContain(mood({ kind: "radon", intensity: 0 }));
    expect(GOOD_MOODS).toContain(mood({ kind: "water", intensity: 0 }));
    expect(GOOD_MOODS).toContain(mood({ kind: "air", intensity: 0 }));
    expect(GOOD_MOODS).toContain(mood({ kind: "housing", intensity: 0 }));
    expect(GOOD_MOODS).toContain(mood({ kind: "school", intensity: 1 }));
    expect(GOOD_MOODS).toContain(mood({ kind: "weather", intensity: 0, variant: "sun" }));
    // "More is better" scenes: their elevated level is GOOD, not bad.
    expect(GOOD_MOODS).toContain(mood({ kind: "evCharging", intensity: 2 }));
    expect(GOOD_MOODS).toContain(mood({ kind: "neighborhood", intensity: 2 }));
  });

  it("stays neutral (calm/thinking) on mid / unknown readings", () => {
    const neutral: ReadonlyArray<DossierRaccoonMood> = ["calm", "thinking"];
    expect(neutral).toContain(mood({ kind: "flood", intensity: 1 })); // unknown risk
    expect(neutral).toContain(mood({ kind: "hazard", intensity: 1 }));
    expect(neutral).toContain(mood({ kind: "radon", intensity: 1 }));
    expect(neutral).toContain(mood({ kind: "water", intensity: 1 })); // unknown count
    expect(neutral).toContain(mood({ kind: "air", intensity: 1 }));
    expect(neutral).toContain(mood({ kind: "housing", intensity: 1 }));
    expect(neutral).toContain(mood({ kind: "housing", intensity: 2 })); // high cost = concern, not hazard
    expect(neutral).toContain(mood({ kind: "weather", intensity: 1, variant: "cloud" }));
    expect(neutral).toContain(mood({ kind: "weather", intensity: 1, variant: "rain" }));
  });

  it("covers every weather variant with a valid mood", () => {
    const variants: ReadonlyArray<AmbientVariant> = [
      "lightning",
      "wind",
      "winter",
      "sun",
      "cloud",
      "rain",
      "storm",
      "snow",
      "fog",
      "heat",
      "cold",
    ];
    for (const variant of variants) {
      for (const intensity of ALL_LEVELS) {
        const result = mood({ kind: "weather", intensity, variant });
        expect(VALID_MOODS, `weather/${variant}@${intensity}`).toContain(result);
      }
    }
  });
});
