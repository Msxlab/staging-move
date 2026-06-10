// Pure helpers for VehicleCheckCard — deliberately free of React Native /
// Expo imports so VIN validation and the decode-response → render-state
// derivation stay unit-testable under vitest's node environment (same split
// as MoveBriefingCard.helpers.ts / lib/home-dossier.ts).
//
// HERMES NOTE: no Intl.* APIs here — plain string/array work only.

export const NHTSA_RECALLS_URL = "https://www.nhtsa.gov/recalls";

// ── VIN validation ───────────────────────────────────────────────────────────

// 17 characters; letters I, O, and Q are never used in a VIN (ISO 3779).
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Trim + uppercase a raw VIN input. Does NOT validate — see isValidVin. */
export function normalizeVinInput(raw: string | null | undefined): string {
  return (raw || "").trim().toUpperCase();
}

/** True when `vin` is a syntactically valid, already-normalized VIN. */
export function isValidVin(vin: string): boolean {
  return VIN_PATTERN.test(vin);
}

// ── Task matching ────────────────────────────────────────────────────────────

/**
 * True when a move task is the relocation checklist's vehicle-registration
 * item. Primary signal is the stable template id (P3_VEHICLE_REG, see
 * packages/shared/src/constants.ts); older rows generated before templateId
 * existed fall back to a title match.
 */
export function isVehicleRegistrationTask(
  task: { templateId?: string | null; title?: string | null } | null | undefined,
): boolean {
  if (!task) return false;
  if (task.templateId === "P3_VEHICLE_REG") return true;
  return typeof task.title === "string" && /vehicle registration/i.test(task.title);
}

// ── Decode response contract (GET /api/vehicles/decode?vin=…) ────────────────

export interface VehicleRecallItem {
  campaignNumber: string | null;
  component: string | null;
  summary: string | null;
}

export interface VehicleDecodeResponse {
  vehicle?: {
    status: "ok" | "no_match" | "error";
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
  };
  recalls?: {
    status: "ok" | "unavailable";
    count: number | null;
    items: VehicleRecallItem[];
  };
}

// ── Render-state derivation ──────────────────────────────────────────────────

export type VehicleCheckView =
  | {
      kind: "vehicle";
      /** e.g. "2019 HONDA CR-V" — always non-empty for this kind. */
      headline: string;
      /** null ⇒ recall info unavailable (render the honest fallback line). */
      recallCount: number | null;
      /** Max 3 well-formed items; may be empty even when recallCount > 0. */
      recallItems: VehicleRecallItem[];
    }
  | { kind: "no_match" }
  | { kind: "error" };

/**
 * Decide what the card shows for a decode response. Defensive against
 * partial/missing payloads: anything malformed degrades to "error", an "ok"
 * vehicle without a single displayable field degrades to "no_match" (never an
 * empty headline), and malformed recall items are dropped, not rendered blank.
 */
export function deriveVehicleCheckView(
  data: VehicleDecodeResponse | null | undefined,
): VehicleCheckView {
  const vehicle = data?.vehicle;
  if (!vehicle || typeof vehicle !== "object") return { kind: "error" };
  if (vehicle.status === "no_match") return { kind: "no_match" };
  if (vehicle.status !== "ok") return { kind: "error" };

  const parts: string[] = [];
  if (typeof vehicle.year === "number" && Number.isFinite(vehicle.year)) parts.push(String(vehicle.year));
  if (typeof vehicle.make === "string" && vehicle.make.trim()) parts.push(vehicle.make.trim());
  if (typeof vehicle.model === "string" && vehicle.model.trim()) parts.push(vehicle.model.trim());
  const headline = parts.join(" ");
  if (!headline) return { kind: "no_match" };

  const recalls = data?.recalls;
  const recallCount =
    recalls?.status === "ok" &&
    typeof recalls.count === "number" &&
    Number.isFinite(recalls.count) &&
    recalls.count >= 0
      ? Math.round(recalls.count)
      : null;

  const recallItems =
    recalls?.status === "ok" && Array.isArray(recalls.items)
      ? recalls.items
          .filter(
            (item): item is VehicleRecallItem =>
              !!item &&
              typeof item === "object" &&
              [item.campaignNumber, item.component, item.summary].some(
                (v) => typeof v === "string" && v.trim().length > 0,
              ),
          )
          .slice(0, 3)
      : [];

  return { kind: "vehicle", headline, recallCount, recallItems };
}
