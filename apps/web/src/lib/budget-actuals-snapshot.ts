import { prisma } from "@/lib/db";
import {
  calculateBudgetActuals,
  type ServiceCostInput,
} from "@/lib/budget-planning";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";

// Shared money-layer snapshot logic so the budget route and the per-month
// actuals route compute realized actuals identically (single source of truth).

const GLOBAL_BUDGET_SCOPE_KEY = "__global__";

export function budgetScopeKey(
  addressId: string | null | undefined,
  workspaceId?: string | null,
): string {
  if (addressId) return addressId;
  return workspaceId ? `workspace:${workspaceId}:global` : GLOBAL_BUDGET_SCOPE_KEY;
}

// Select the service fields the engine needs PLUS the cost log for the viewed
// month only. `costLogs` is always present (possibly empty) so the engine
// resolves the actual from the viewed month's log, never the legacy scalar.
export function budgetServiceSelectForMonth(month: Date) {
  return {
    id: true,
    providerName: true,
    category: true,
    addressId: true,
    monthlyCost: true,
    actualMonthlyCost: true,
    billingCycle: true,
    isActive: true,
    activatedAt: true,
    createdAt: true,
    costLogs: {
      where: { month },
      select: { month: true, amount: true },
    },
  } as const;
}

export function toBudgetServiceInput(row: any): ServiceCostInput {
  return {
    id: row.id,
    providerName: row.providerName,
    category: row.category,
    addressId: row.addressId,
    monthlyCost: row.monthlyCost,
    actualMonthlyCost: row.actualMonthlyCost,
    billingCycle: row.billingCycle,
    isActive: row.isActive,
    activatedAt: row.activatedAt,
    createdAt: row.createdAt,
    costLogs: Array.isArray(row.costLogs)
      ? row.costLogs.map((log: any) => ({ month: log.month, amount: Number(log.amount) }))
      : [],
  };
}

/**
 * The REAL realized cost + substantiated savings rate for a month + scope,
 * computed from the per-month ServiceCostLog rows (NOT the projection and NOT the
 * single scalar). When nothing is logged for the month, actualExpenses is 0 and
 * savingsRate is null — an honest "no real costs captured for this month".
 */
export async function resolveBudgetActualsForMonth(
  userId: string,
  month: Date,
  addressId?: string | null,
  workspaceId?: string | null,
): Promise<{ actualExpenses: number; savingsRate: number | null }> {
  const services = await prisma.service.findMany({
    where: activeTrackedServiceWhereForScope({ userId, workspaceId }, addressId ? { addressId } : {}),
    select: budgetServiceSelectForMonth(month),
  });

  const actuals = calculateBudgetActuals(services.map(toBudgetServiceInput), { month, addressId });
  return {
    actualExpenses: Math.round(actuals.actualThisMonth * 100) / 100,
    savingsRate: actuals.savingsRate,
  };
}

/**
 * Refresh the realized actual + savingsRate on any EXISTING Budget snapshot rows
 * that a freshly-logged actual affects, so "Budget History" stays truthful
 * without forcing the user to re-save their budget. Never creates a Budget row.
 * The affected scopes for a service are the address-scoped budget (if the
 * service has an address) and the all-addresses (global) budget for that month.
 */
export async function refreshBudgetSnapshotsForServiceMonth(params: {
  userId: string;
  workspaceId?: string | null;
  serviceAddressId: string | null;
  month: Date;
}): Promise<void> {
  const { userId, workspaceId, serviceAddressId, month } = params;

  // Distinct (addressId, scopeKey) pairs that could include this service line.
  const scopes: Array<{ addressId: string | null; scopeKey: string }> = [
    { addressId: null, scopeKey: budgetScopeKey(null, workspaceId) },
  ];
  if (serviceAddressId) {
    scopes.push({ addressId: serviceAddressId, scopeKey: budgetScopeKey(serviceAddressId, workspaceId) });
  }

  // The budget row owner: the workspace owner for a shared budget, else the user.
  const ownerWhere = workspaceId ? { workspaceId } : { userId };

  for (const scope of scopes) {
    const existing = await prisma.budget.findFirst({
      where: { ...ownerWhere, scopeKey: scope.scopeKey, month, deletedAt: null },
      select: { id: true },
    });
    if (!existing) continue;

    const { actualExpenses, savingsRate } = await resolveBudgetActualsForMonth(
      userId,
      month,
      scope.addressId,
      workspaceId,
    );
    await prisma.budget.update({
      where: { id: existing.id },
      data: { actualExpenses, savingsRate },
    });
  }
}
