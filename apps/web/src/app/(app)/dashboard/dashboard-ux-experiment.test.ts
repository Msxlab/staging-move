import { describe, expect, it } from "vitest";
import {
  DASHBOARD_DETAILS_WIDGETS,
  resolveDashboardTopSlots,
  shouldUseDashboardDetailsSection,
  splitDashboardDetailWidgets,
} from "./dashboard-ux-experiment";

describe("dashboard UX experiment v1", () => {
  it("keeps the control top-slot order unchanged", () => {
    expect(resolveDashboardTopSlots("control")).toEqual([
      "briefing",
      "householdActivation",
      "commandCenter",
      "nextCriticalActions",
    ]);
  });

  it("pins Command Center, Next Critical Actions, and Briefing as the first three variant slots", () => {
    expect(resolveDashboardTopSlots("variant").slice(0, 3)).toEqual([
      "commandCenter",
      "nextCriticalActions",
      "briefing",
    ]);
  });

  it("uses the collapsed Details section only for first-session variant users", () => {
    expect(shouldUseDashboardDetailsSection("control", null)).toBe(false);
    expect(shouldUseDashboardDetailsSection("variant", null)).toBe(true);
    expect(shouldUseDashboardDetailsSection("variant", { order: ["spending"] })).toBe(false);
    expect(shouldUseDashboardDetailsSection("variant", { collapsed: { routeMap: false } })).toBe(false);
  });

  it("demotes route map, budget/spend, and Home Dossier widgets into details", () => {
    const split = splitDashboardDetailWidgets(
      ["nextCritical", "moving", "homeDossier", "spending", "routeMap", "budgetDonut", "categories", "topSpending", "recent"],
      DASHBOARD_DETAILS_WIDGETS,
    );
    expect(split.primary).toEqual(["nextCritical", "moving", "recent"]);
    expect(split.details).toEqual(["homeDossier", "spending", "routeMap", "budgetDonut", "categories", "topSpending"]);
  });
});
