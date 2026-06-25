import { prisma } from "@/lib/db";
import type { Prisma } from "@locateflow/db";
import {
  isMissingDbColumnError,
  warnSchemaCompatibilityFallback,
} from "@/lib/db-schema-compat";

export type UserPreferences = {
  dashboardWidgetPrefs: unknown | null;
  showBudget: boolean;
  firstName: string | null;
  persisted: boolean;
};

export async function loadUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dashboardWidgetPrefs: true, showBudget: true, firstName: true },
    });
    return {
      dashboardWidgetPrefs: user?.dashboardWidgetPrefs ?? null,
      showBudget: user?.showBudget ?? true,
      firstName: user?.firstName ?? null,
      persisted: true,
    };
  } catch (error) {
    if (isMissingDbColumnError(error, "dashboardWidgetPrefs") || isMissingDbColumnError(error, "showBudget")) {
      warnSchemaCompatibilityFallback("user-preferences:read", error);
      return { dashboardWidgetPrefs: null, showBudget: true, firstName: null, persisted: false };
    }
    throw error;
  }
}

export async function loadShowBudgetPreference(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { showBudget: true },
    });
    return user?.showBudget ?? true;
  } catch (error) {
    if (isMissingDbColumnError(error, "showBudget")) {
      warnSchemaCompatibilityFallback("user-preferences:showBudget", error);
      return true;
    }
    throw error;
  }
}

export async function saveShowBudgetPreference(
  userId: string,
  showBudget: boolean,
): Promise<{ showBudget: boolean; persisted: boolean }> {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { showBudget },
      select: { showBudget: true },
    });
    return { showBudget: updated.showBudget, persisted: true };
  } catch (error) {
    if (isMissingDbColumnError(error, "showBudget")) {
      warnSchemaCompatibilityFallback("user-preferences:save-showBudget", error);
      return { showBudget, persisted: false };
    }
    throw error;
  }
}

export async function saveDashboardWidgetPrefs(
  userId: string,
  dashboardWidgetPrefs: unknown,
): Promise<{ dashboardWidgetPrefs: unknown; persisted: boolean }> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { dashboardWidgetPrefs: dashboardWidgetPrefs as Prisma.InputJsonValue },
    });
    return { dashboardWidgetPrefs, persisted: true };
  } catch (error) {
    if (isMissingDbColumnError(error, "dashboardWidgetPrefs")) {
      warnSchemaCompatibilityFallback("user-preferences:save-dashboard", error);
      return { dashboardWidgetPrefs, persisted: false };
    }
    throw error;
  }
}
