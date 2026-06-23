import type { AmbientIntensity, AmbientKind, AmbientVariant } from "./home-dossier";

/**
 * DOSSIER RACCOON — a mood-driven character layered ON TOP of the existing
 * data-derived ambient scenes ({@link AmbientSpec} from ambientForSection).
 *
 * The raccoon REACTS to the home's real readings without touching the data
 * layer: ambientForSection stays the data-honest source of truth, and this
 * pure mapper translates each scene's (kind, level, variant) into one of the
 * five {@link MoveRaccoon} moods so the character's expression mirrors the
 * data honesty —
 *   - a GOOD / safe reading   -> happy | approved
 *   - a NEUTRAL / mid reading  -> calm  | thinking
 *   - a BAD / high-risk reading -> alert
 *
 * Kept deliberately framework-free (no react-native-svg import) so it is a
 * cheap pure unit and can be exercised in the node vitest environment.
 */

/** The five expressions exposed by the parametric MoveRaccoon mark. */
export type DossierRaccoonMood = "calm" | "alert" | "happy" | "thinking" | "approved";

/** The scene signals the character reacts to (a subset of the AmbientSpec). */
export interface DossierRaccoonInput {
  kind: AmbientKind;
  /** Clamped scene level: 0 = safe/calm, 1 = moderate, 2 = elevated/high-risk. */
  intensity: AmbientIntensity;
  variant?: AmbientVariant;
}

/**
 * Weather reads its mood from the variant (the dramatic axis) first, then the
 * intensity, because a sunny level-0 and a stormy level-2 are different KINDS
 * of weather, not just degrees of one. Storm/lightning always alarms the
 * raccoon; clear/sun delights it.
 */
function weatherMood(variant: AmbientVariant | undefined, level: AmbientIntensity): DossierRaccoonMood {
  switch (variant) {
    case "storm":
    case "lightning":
      return "alert";
    case "sun":
      return "happy";
    case "cloud":
      return "calm";
    case "snow":
    case "winter":
    case "cold":
    case "fog":
    case "wind":
    case "rain":
    case "heat":
      // Mild weather (level 1) makes the raccoon pensive; severe (level 2) alarms it.
      return level >= 2 ? "alert" : "thinking";
    default:
      return level >= 2 ? "alert" : level === 1 ? "calm" : "happy";
  }
}

/**
 * Map a dossier scene's (kind + level + variant) to the raccoon mood that
 * honestly reflects the underlying reading. EVERY AmbientKind and level is
 * covered — there is no scene-state without a fitting expression.
 *
 * Level semantics come straight from ambientForSection (unchanged):
 *   flood   0 safe / 1 unknown / 2 high-risk
 *   school  always 1 (directory data carries no risk signal) -> friendly
 *   hazard  0 low / 1 moderate / 2 high NRI rating
 *   radon   0 zone 3 / 1 zone 2 / 2 zone 1
 *   water   0 no violations / 1 unknown / 2 violations
 *   air     0 good AQI / 1 moderate / 2 unhealthy+
 *   housing 0 low-cost / 1 moderate / 2 high-cost
 *   ev      0 none / 1 some L2 / 2 DC-fast or many
 *   nbhd    0 car-dependent / 1 above-average / 2 most-walkable
 *   weather variant-driven (see weatherMood)
 */
export function dossierRaccoonFor(input: DossierRaccoonInput): DossierRaccoonMood {
  const { kind, intensity, variant } = input;
  switch (kind) {
    case "flood":
      // Safe is a clean bill of health (approved); high-risk alarms; unknown ponders.
      return intensity >= 2 ? "alert" : intensity === 1 ? "thinking" : "approved";
    case "school":
      // Fixed moderate ambience, but a known district is good news.
      return "happy";
    case "hazard":
      return intensity >= 2 ? "alert" : intensity === 1 ? "thinking" : "calm";
    case "radon":
      // zone 1 (level 2) is the dangerous one; zone 3 (level 0) is the safe one.
      return intensity >= 2 ? "alert" : intensity === 1 ? "calm" : "happy";
    case "water":
      // Any violation alarms; unknown count ponders; a clean record is approved.
      return intensity >= 2 ? "alert" : intensity === 1 ? "thinking" : "approved";
    case "air":
      return intensity >= 2 ? "alert" : intensity === 1 ? "calm" : "happy";
    case "housing":
      // High cost is a concern (not a hazard) -> thinking, not alert.
      return intensity >= 2 ? "thinking" : intensity === 1 ? "calm" : "happy";
    case "evCharging":
      // More charging is better here: many/DC-fast -> approved, some -> happy, none -> calm.
      return intensity >= 2 ? "approved" : intensity === 1 ? "happy" : "calm";
    case "neighborhood":
      // More walkable is better: most -> approved, above-average -> happy, else calm.
      return intensity >= 2 ? "approved" : intensity === 1 ? "happy" : "calm";
    case "weather":
      return weatherMood(variant, intensity);
    default: {
      // Exhaustiveness guard: a new AmbientKind must extend the table above.
      const _never: never = kind;
      return _never;
    }
  }
}
