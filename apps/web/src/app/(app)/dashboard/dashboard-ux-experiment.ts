import type { UxAiBriefingExperienceVariant } from "@locateflow/shared";

export const DASHBOARD_TOP_SLOTS_CONTROL = [
  "briefing",
  "householdActivation",
  "commandCenter",
  "nextCriticalActions",
] as const;
export const DASHBOARD_TOP_SLOTS_VARIANT = [
  "commandCenter",
  "nextCriticalActions",
  "briefing",
  "householdActivation",
] as const;

export const DASHBOARD_DETAILS_WIDGETS = [
  "homeDossier",
  "spending",
  "routeMap",
  "budgetDonut",
  "monthlySpark",
  "categories",
  "topSpending",
] as const;

export function resolveDashboardTopSlots(variant: UxAiBriefingExperienceVariant) {
  return variant === "variant" ? DASHBOARD_TOP_SLOTS_VARIANT : DASHBOARD_TOP_SLOTS_CONTROL;
}

export function hasSavedDashboardWidgetCustomization(prefs: {
  order?: string[];
  visibility?: Record<string, boolean>;
  collapsed?: Record<string, boolean>;
} | null | undefined): boolean {
  return Boolean(
    (Array.isArray(prefs?.order) && prefs.order.length > 0) ||
      (prefs?.visibility && Object.keys(prefs.visibility).length > 0) ||
      (prefs?.collapsed && Object.keys(prefs.collapsed).length > 0),
  );
}

export function shouldUseDashboardDetailsSection(
  variant: UxAiBriefingExperienceVariant,
  prefs: {
    order?: string[];
    visibility?: Record<string, boolean>;
    collapsed?: Record<string, boolean>;
  } | null | undefined,
): boolean {
  return variant === "variant" && !hasSavedDashboardWidgetCustomization(prefs);
}

export function splitDashboardDetailWidgets<T extends string>(order: T[], detailKeys: readonly string[]) {
  const detailSet = new Set(detailKeys);
  return {
    primary: order.filter((key) => !detailSet.has(key)),
    details: order.filter((key) => detailSet.has(key)),
  };
}
