import { describe, expect, it } from "vitest";
import { getCurrentRelocationPhase } from "../constants";
import {
  generateChecklist,
  buildChecklistTaskTemplates,
  type UserChecklistProfile,
} from "../relocation-checklist";

const DAY_MS = 24 * 60 * 60 * 1000;

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

describe("buildChecklistTaskTemplates", () => {
  const moveDate = new Date("2026-07-01T00:00:00.000Z");

  it("persists the federally-required AR-11 task for an immigrant mover", () => {
    const immigrantProfile: UserChecklistProfile = { ...profile, isImmigrant: true };
    const templates = buildChecklistTaskTemplates(immigrantProfile, moveDate, "CA", null);
    const arEleven = templates.find((t) => t.templateId === "P2_USCIS");
    expect(arEleven).toBeTruthy();
    expect(arEleven?.deadlineDays).toBe(10);
    // Deadline-aware due date: soft-due lands at/before the hard deadline.
    expect(arEleven!.dueDate.getTime()).toBeLessThanOrEqual(arEleven!.deadlineDate!.getTime());
  });

  it("schedules deadline-bearing due dates a buffer before the hard deadline", () => {
    const templates = buildChecklistTaskTemplates(profile, moveDate, "CA", null);
    const license = templates.find((t) => t.templateId === "P3_DRIVERS_LICENSE");
    expect(license?.deadlineDate).toBeInstanceOf(Date);
    // CA license deadline is 10 days; the 90-day default is overridden by state.
    const deadlineDays = Math.round((license!.deadlineDate!.getTime() - moveDate.getTime()) / DAY_MS);
    expect(deadlineDays).toBe(10);
    // Soft due must not be after the hard deadline.
    expect(license!.dueDate.getTime()).toBeLessThanOrEqual(license!.deadlineDate!.getTime());
  });

  it("suppresses state income-tax registration in a no-income-tax state", () => {
    const bizProfile: UserChecklistProfile = {
      ...profile,
      moveType: "BUSINESS",
      isBusinessOwner: true,
    };
    const taxState = buildChecklistTaskTemplates(bizProfile, moveDate, "CA", null);
    const noTaxState = buildChecklistTaskTemplates(bizProfile, moveDate, "TX", null);
    expect(taxState.some((t) => t.templateId === "B1_STATE_TAX")).toBe(true);
    expect(noTaxState.some((t) => t.templateId === "B1_STATE_TAX")).toBe(false);
  });

  it("includes PCS-specific tasks for a military mover AND keeps the personal base", () => {
    const militaryProfile: UserChecklistProfile = { ...profile, moveType: "MILITARY" };
    const templates = buildChecklistTaskTemplates(militaryProfile, moveDate, "CA", null);
    const ids = new Set(templates.map((t) => t.templateId));
    // PCS-only items present.
    expect(ids.has("M0_PCS_ORDERS")).toBe(true);
    expect(ids.has("M0_TMO_SCHEDULE")).toBe(true);
    expect(ids.has("M3_TRICARE_TRANSFER")).toBe(true);
    // Personal base still present (USPS forwarding, DMV transfer).
    expect(ids.has("P0_USPS")).toBe(true);
    expect(ids.has("P3_DRIVERS_LICENSE")).toBe(true);
  });

  it("does not include PCS-only items for a non-military personal mover", () => {
    const templates = buildChecklistTaskTemplates(profile, moveDate, "CA", null);
    expect(templates.some((t) => t.templateId === "M0_PCS_ORDERS")).toBe(false);
  });

  it("always yields a non-empty checklist even with a minimal profile", () => {
    const minimal: UserChecklistProfile = {
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      hasSenior: false,
      carCount: 0,
      hasDisability: false,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
      isImmigrant: false,
      isBusinessOwner: false,
      moveType: "PERSONAL",
    };
    const templates = buildChecklistTaskTemplates(minimal, moveDate, "FL", null);
    expect(templates.length).toBeGreaterThan(0);
    // Mail forwarding + IRS are unconditional personal items.
    expect(templates.some((t) => t.templateId === "P0_USPS")).toBe(true);
    expect(templates.some((t) => t.templateId === "P2_IRS")).toBe(true);
  });
});
