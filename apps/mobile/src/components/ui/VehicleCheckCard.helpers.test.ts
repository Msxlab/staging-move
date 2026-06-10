import { describe, expect, it } from "vitest";
import {
  deriveVehicleCheckView,
  isValidVin,
  isVehicleRegistrationTask,
  normalizeVinInput,
  type VehicleDecodeResponse,
} from "./VehicleCheckCard.helpers";

const VIN = "2HKRW2H59KH601234";

function okResponse(overrides: Partial<VehicleDecodeResponse> = {}): VehicleDecodeResponse {
  return {
    vehicle: { status: "ok", vin: VIN, year: 2019, make: "HONDA", model: "CR-V" },
    recalls: {
      status: "ok",
      count: 2,
      items: [
        { campaignNumber: "19V182000", component: "FUEL SYSTEM, GASOLINE", summary: "Fuel pump may fail." },
        { campaignNumber: "20V314000", component: "AIR BAGS", summary: "Inflator may rupture." },
      ],
    },
    ...overrides,
  };
}

describe("VIN input helpers", () => {
  it("normalizes raw input (trim + uppercase, null-safe)", () => {
    expect(normalizeVinInput("  2hkrw2h59kh601234 ")).toBe(VIN);
    expect(normalizeVinInput(null)).toBe("");
    expect(normalizeVinInput(undefined)).toBe("");
  });

  it("accepts only 17-character VINs without I/O/Q", () => {
    expect(isValidVin(VIN)).toBe(true);
    expect(isValidVin("2HKRW2H59KH60123")).toBe(false); // 16 chars
    expect(isValidVin("IHKRW2H59KH601234")).toBe(false); // contains I
    expect(isValidVin("OHKRW2H59KH601234")).toBe(false); // contains O
    expect(isValidVin("QHKRW2H59KH601234")).toBe(false); // contains Q
    expect(isValidVin("")).toBe(false);
  });
});

describe("isVehicleRegistrationTask", () => {
  it("matches the stable checklist template id", () => {
    expect(isVehicleRegistrationTask({ templateId: "P3_VEHICLE_REG", title: "x" })).toBe(true);
  });

  it("falls back to a title match for pre-templateId rows", () => {
    expect(isVehicleRegistrationTask({ templateId: null, title: "Transfer Vehicle Registration" })).toBe(true);
  });

  it("does not match other DMV tasks or null input", () => {
    expect(isVehicleRegistrationTask({ templateId: "P3_DRIVERS_LICENSE", title: "Transfer Driver's License" })).toBe(false);
    expect(isVehicleRegistrationTask({ templateId: null, title: "Set up electricity" })).toBe(false);
    expect(isVehicleRegistrationTask(null)).toBe(false);
    expect(isVehicleRegistrationTask(undefined)).toBe(false);
  });
});

describe("deriveVehicleCheckView", () => {
  it("derives the vehicle headline + recall data from an ok payload", () => {
    expect(deriveVehicleCheckView(okResponse())).toEqual({
      kind: "vehicle",
      headline: "2019 HONDA CR-V",
      recallCount: 2,
      recallItems: [
        { campaignNumber: "19V182000", component: "FUEL SYSTEM, GASOLINE", summary: "Fuel pump may fail." },
        { campaignNumber: "20V314000", component: "AIR BAGS", summary: "Inflator may rupture." },
      ],
    });
  });

  it("builds a partial headline from whichever fields decoded", () => {
    const view = deriveVehicleCheckView(
      okResponse({
        vehicle: { status: "ok", vin: VIN, year: null, make: "HONDA", model: "CR-V" },
        recalls: { status: "unavailable", count: null, items: [] },
      }),
    );
    expect(view).toEqual({ kind: "vehicle", headline: "HONDA CR-V", recallCount: null, recallItems: [] });
  });

  it("treats an ok vehicle with nothing displayable as no_match (never an empty headline)", () => {
    const view = deriveVehicleCheckView(
      okResponse({ vehicle: { status: "ok", vin: VIN, year: null, make: "  ", model: null } }),
    );
    expect(view).toEqual({ kind: "no_match" });
  });

  it("maps no_match / error statuses through", () => {
    expect(
      deriveVehicleCheckView(
        okResponse({ vehicle: { status: "no_match", vin: VIN, year: null, make: null, model: null } }),
      ),
    ).toEqual({ kind: "no_match" });
    expect(
      deriveVehicleCheckView(
        okResponse({ vehicle: { status: "error", vin: VIN, year: null, make: null, model: null } }),
      ),
    ).toEqual({ kind: "error" });
  });

  it("degrades malformed/missing payloads to error", () => {
    expect(deriveVehicleCheckView(null)).toEqual({ kind: "error" });
    expect(deriveVehicleCheckView(undefined)).toEqual({ kind: "error" });
    expect(deriveVehicleCheckView({} as VehicleDecodeResponse)).toEqual({ kind: "error" });
  });

  it("reports unavailable recalls as a null count (vehicle still renders)", () => {
    const view = deriveVehicleCheckView(
      okResponse({ recalls: { status: "unavailable", count: null, items: [] } }),
    );
    expect(view).toMatchObject({ kind: "vehicle", recallCount: null, recallItems: [] });
  });

  it("keeps a zero recall count honest (0, not unavailable)", () => {
    const view = deriveVehicleCheckView(okResponse({ recalls: { status: "ok", count: 0, items: [] } }));
    expect(view).toMatchObject({ kind: "vehicle", recallCount: 0 });
  });

  it("drops malformed recall items and caps the list at 3", () => {
    const items = [
      { campaignNumber: "", component: " ", summary: null }, // dropped
      ...Array.from({ length: 5 }, (_, i) => ({
        campaignNumber: `21V00${i}000`,
        component: `COMPONENT ${i}`,
        summary: `Summary ${i}`,
      })),
    ];
    const view = deriveVehicleCheckView(okResponse({ recalls: { status: "ok", count: 5, items } }));
    expect(view.kind).toBe("vehicle");
    if (view.kind === "vehicle") {
      expect(view.recallItems).toHaveLength(3);
      expect(view.recallItems[0].campaignNumber).toBe("21V000000");
    }
  });
});
