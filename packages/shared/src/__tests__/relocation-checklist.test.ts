import { describe, expect, it } from "vitest";
import { getCurrentRelocationPhase } from "../constants";
import { generateChecklist, type UserChecklistProfile } from "../relocation-checklist";

const profile: UserChecklistProfile = {
  hasChildren: false,
  childrenCount: 0,
  hasPets: false,
  hasSenior: false,
  carCount: 1,
  hasDisability: false,
  needsStorage: false,
  hasMotorcycle: false,
  hasBoatRV: false,
  isImmigrant: false,
  isBusinessOwner: false,
  moveType: "PERSONAL",
};

describe("relocation phase boundaries", () => {
  it("uses one shared current phase boundary policy", () => {
    expect(getCurrentRelocationPhase(-8)).toBe(0);
    expect(getCurrentRelocationPhase(-7)).toBe(1);
    expect(getCurrentRelocationPhase(3)).toBe(1);
    expect(getCurrentRelocationPhase(4)).toBe(2);
    expect(getCurrentRelocationPhase(10)).toBe(2);
    expect(getCurrentRelocationPhase(11)).toBe(3);
  });
});

describe("generateChecklist", () => {
  it("only marks template-matched checklist items complete", () => {
    const checklist = generateChecklist(
      profile,
      new Date(),
      "FL",
      "CA",
      new Set(["P3_DRIVERS_LICENSE"]),
      null,
    );

    const license = checklist.phases.flatMap((phase) => phase.items).find((item) => item.id === "P3_DRIVERS_LICENSE");
    const registration = checklist.phases.flatMap((phase) => phase.items).find((item) => item.id === "P3_VEHICLE_REG");

    expect(license?.isCompleted).toBe(true);
    expect(registration?.isCompleted).toBe(false);
  });

  it("creates deadline dates for deadline-driven checklist items", () => {
    const checklist = generateChecklist(
      profile,
      new Date(),
      "FL",
      "CA",
      new Set(),
      null,
    );

    const license = checklist.phases.flatMap((phase) => phase.items).find((item) => item.id === "P3_DRIVERS_LICENSE");

    expect(license?.deadlineDays).toBeGreaterThan(0);
    expect(license?.deadlineDate).toBeInstanceOf(Date);
  });
});
